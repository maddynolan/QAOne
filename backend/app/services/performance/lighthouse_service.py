"""
Lighthouse Service - Run Google Lighthouse for performance and Core Web Vitals.

Runs Lighthouse CLI (npx lighthouse) and returns Performance score plus
LCP, FCP, CLS, TBT, TTI for integration with load testing and PWA performance.
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# In-memory store for report payloads (keyed by run_id)
_lighthouse_reports: Dict[str, Dict[str, Any]] = {}


def _find_node() -> Optional[str]:
    """Find node executable (node or nodejs)."""
    for name in ("node", "nodejs"):
        path = shutil.which(name)
        if path:
            return path
    return None


def _find_npx() -> Optional[str]:
    """Find npx executable."""
    path = shutil.which("npx")
    if path:
        return path
    node = _find_node()
    if node:
        # npx may be next to node
        node_dir = str(Path(node).parent)
        for name in ("npx", "npx.cmd", "npx.ps1"):
            candidate = Path(node_dir) / name
            if candidate.exists():
                return str(candidate)
    return None


async def run_lighthouse(
    url: str,
    form_factor: str = "desktop",
    output: str = "json",
    timeout_seconds: int = 120,
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run Lighthouse against a URL and return performance + Web Vitals.

    Args:
        url: URL to audit (must be http/https).
        form_factor: "desktop" or "mobile".
        output: "json" (default) for machine-readable report.
        timeout_seconds: Max time for Lighthouse run.
        run_id: Optional ID to store report; one is generated if not provided.

    Returns:
        {
            "run_id": str,
            "success": bool,
            "url": str,
            "performance_score": float 0-1,
            "lcp_ms": float | None,
            "fcp_ms": float | None,
            "cls": float | None,
            "tbt_ms": float | None,
            "tti_ms": float | None,
            "categories": { ... },
            "audits": { ... },
            "error": str | None
        }
    """
    run_id = run_id or str(uuid.uuid4())
    result: Dict[str, Any] = {
        "run_id": run_id,
        "success": False,
        "url": url,
        "performance_score": None,
        "lcp_ms": None,
        "fcp_ms": None,
        "cls": None,
        "tbt_ms": None,
        "tti_ms": None,
        "categories": {},
        "audits": {},
        "error": None,
    }

    npx = _find_npx()
    if not npx:
        result["error"] = "npx not found. Install Node.js and ensure npx is on PATH."
        logger.warning(result["error"])
        return result

    if not url.startswith(("http://", "https://")):
        result["error"] = "URL must start with http:// or https://"
        return result

    out_file = tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        delete=False,
        prefix="lighthouse_",
    )
    out_path = out_file.name
    out_file.close()

    try:
        cmd: List[str] = [
            npx,
            "--yes",
            "lighthouse",
            url,
            "--output=json",
            f"--output-path={out_path}",
            "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage",
            "--quiet",
            "--max-wait-for-load=45000",
        ]
        if form_factor == "mobile":
            cmd.append("--form-factor=mobile")
            cmd.append("--screenEmulation.mobile=True")
        else:
            cmd.append("--form-factor=desktop")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "CI": "1"},
        )
        try:
            _, stderr = await asyncio.wait_for(
                proc.communicate(),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            proc.kill()
            result["error"] = f"Lighthouse run timed out after {timeout_seconds}s"
            return result

        if not Path(out_path).exists():
            result["error"] = (stderr.decode("utf-8", errors="replace") or "Lighthouse produced no output.").strip()
            return result

        with open(out_path, "r", encoding="utf-8") as f:
            report = json.load(f)

        # Extract categories (scores 0-1)
        categories = report.get("categories", {})
        result["categories"] = {
            k: {
                "id": v.get("id"),
                "title": v.get("title"),
                "score": v.get("score"),
            }
            for k, v in categories.items()
        }

        perf_cat = categories.get("performance", {})
        result["performance_score"] = perf_cat.get("score")

        # Core Web Vitals and key audits
        audits = report.get("audits", {})

        def _numeric_value(audit: Optional[Dict]) -> Optional[float]:
            if not audit:
                return None
            v = audit.get("numericValue")
            if v is not None:
                return float(v)
            return None

        lcp = audits.get("largest-contentful-paint")
        result["lcp_ms"] = _numeric_value(lcp)

        fcp = audits.get("first-contentful-paint")
        result["fcp_ms"] = _numeric_value(fcp)

        cls = audits.get("cumulative-layout-shift")
        result["cls"] = _numeric_value(cls)

        tbt = audits.get("total-blocking-time")
        result["tbt_ms"] = _numeric_value(tbt)

        tti = audits.get("interactive")
        result["tti_ms"] = _numeric_value(tti)

        result["success"] = True
        result["audits"] = {
            "largest-contentful-paint": lcp,
            "first-contentful-paint": fcp,
            "cumulative-layout-shift": cls,
            "total-blocking-time": tbt,
            "interactive": tti,
        }

        _lighthouse_reports[run_id] = {
            "report": report,
            "result": result,
            "url": url,
        }
        return result

    except Exception as e:
        logger.exception("Lighthouse run failed")
        result["error"] = str(e)
        return result
    finally:
        try:
            if Path(out_path).exists():
                os.unlink(out_path)
        except OSError:
            pass


def get_lighthouse_report(run_id: str) -> Optional[Dict[str, Any]]:
    """Return stored full report for run_id."""
    return _lighthouse_reports.get(run_id)


def get_lighthouse_result(run_id: str) -> Optional[Dict[str, Any]]:
    """Return stored result summary for run_id."""
    stored = _lighthouse_reports.get(run_id)
    return stored.get("result") if stored else None


def _median(values: List[Optional[float]]) -> Optional[float]:
    """Return median of non-None numeric values."""
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    clean.sort()
    n = len(clean)
    if n % 2 == 1:
        return clean[n // 2]
    return (clean[n // 2 - 1] + clean[n // 2]) / 2.0


async def run_lighthouse_hardened(
    url: str,
    form_factor: str = "desktop",
    timeout_seconds: int = 120,
    runs: int = 3,
    cache_strategy: str = "cold",  # "cold" | "warm"
    save_artifacts: bool = True,
    artifacts_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run Lighthouse multiple times and return median result for stability.
    Optional: save raw JSON/HTML artifacts to disk.
    """
    import statistics
    run_id = str(uuid.uuid4())[:12]
    results: List[Dict[str, Any]] = []
    for i in range(runs):
        r = await run_lighthouse(
            url=url,
            form_factor=form_factor,
            timeout_seconds=timeout_seconds,
            run_id=f"{run_id}_{i}",
        )
        if r.get("success"):
            results.append(r)
    if not results:
        return {
            "run_id": run_id,
            "success": False,
            "url": url,
            "error": "All runs failed",
            "runs_attempted": runs,
        }
    # Median of numeric metrics
    perf_scores = [r.get("performance_score") for r in results if r.get("performance_score") is not None]
    lcp_vals = [r.get("lcp_ms") for r in results if r.get("lcp_ms") is not None]
    fcp_vals = [r.get("fcp_ms") for r in results if r.get("fcp_ms") is not None]
    cls_vals = [r.get("cls") for r in results if r.get("cls") is not None]
    tbt_vals = [r.get("tbt_ms") for r in results if r.get("tbt_ms") is not None]
    tti_vals = [r.get("tti_ms") for r in results if r.get("tti_ms") is not None]
    median_result: Dict[str, Any] = {
        "run_id": run_id,
        "success": True,
        "url": url,
        "performance_score": float(statistics.median(perf_scores)) if perf_scores else None,
        "lcp_ms": _median(lcp_vals),
        "fcp_ms": _median(fcp_vals),
        "cls": _median(cls_vals),
        "tbt_ms": _median(tbt_vals),
        "tti_ms": _median(tti_vals),
        "runs": runs,
        "runs_successful": len(results),
        "cache_strategy": cache_strategy,
        "categories": results[-1].get("categories", {}),
        "audits": results[-1].get("audits", {}),
        "error": None,
    }
    if save_artifacts and results and artifacts_dir:
        base = Path(artifacts_dir)
        base.mkdir(parents=True, exist_ok=True)
        for i, r in enumerate(results):
            stored = _lighthouse_reports.get(r.get("run_id"))
            if stored and stored.get("report"):
                p = base / f"{run_id}_run{i}.json"
                with open(p, "w", encoding="utf-8") as f:
                    json.dump(stored["report"], f, indent=2)
        median_result["artifacts_dir"] = str(base)
    _lighthouse_reports[run_id] = {"report": None, "result": median_result, "url": url}
    return median_result
