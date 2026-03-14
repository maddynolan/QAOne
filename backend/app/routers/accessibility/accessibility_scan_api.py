"""
Accessibility Scan API - Real axe-core scanning

NEW API endpoints for real accessibility scanning using Playwright + axe-core.
These endpoints are SEPARATE from the existing accessibility_api.py to avoid
breaking any existing functionality.

Endpoints:
- POST /api/a11y/scan - Scan a URL with real axe-core
- GET /api/a11y/report/{scan_id} - Get report in various formats
- POST /api/a11y/batch-scan - Scan multiple URLs
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, HttpUrl, field_validator
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import secrets
import asyncio
import threading

# Import our new scanner
from app.services.accessibility.axe_core_scanner import get_scanner
from app.services.accessibility.accessibility_report_generator import get_report_generator
from app.utils.url_validator import validate_url, sanitize_url_for_logging
from app.middleware.rbac_middleware import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/a11y", tags=["accessibility-v2"])

# In-memory store for scan results (in production, use Redis or DB)
# Bounded: auto-evicts oldest entries when exceeding MAX_SCAN_RESULTS
# Thread-safe: protected by _scan_lock for concurrent access
_scan_results: Dict[str, Dict[str, Any]] = {}
_scan_timestamps: Dict[str, float] = {}  # track insertion time for TTL eviction
_scan_lock = threading.Lock()
MAX_SCAN_RESULTS = 500
SCAN_TTL_SECONDS = 3600  # 1 hour


def _store_scan_result(key: str, result: Dict[str, Any]):
    """Store a scan result with TTL tracking and bounded size. Thread-safe."""
    import time
    now = time.time()

    with _scan_lock:
        # Evict expired entries first
        expired_keys = [k for k, ts in _scan_timestamps.items() if now - ts > SCAN_TTL_SECONDS]
        for k in expired_keys:
            _scan_results.pop(k, None)
            _scan_timestamps.pop(k, None)

        # If still over limit, evict oldest
        while len(_scan_results) >= MAX_SCAN_RESULTS and _scan_timestamps:
            oldest_key = min(_scan_timestamps, key=_scan_timestamps.get)
            _scan_results.pop(oldest_key, None)
            _scan_timestamps.pop(oldest_key, None)

        _scan_results[key] = result
        _scan_timestamps[key] = now


def _get_scan_result(key: str) -> Optional[Dict[str, Any]]:
    """Get a scan result by key. Thread-safe."""
    with _scan_lock:
        return _scan_results.get(key)


VALID_WCAG_LEVELS = {"A", "AA", "AAA"}
VALID_REPORT_FORMATS = {"html", "json", "markdown", "md"}


class ScanRequest(BaseModel):
    """Request to scan a URL for accessibility issues"""
    url: str
    wcag_level: str = "AA"  # A, AA, AAA
    wait_for_selector: Optional[str] = None
    include_passes: bool = False

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("URL is required")
        if len(v) > 2048:
            raise ValueError("URL exceeds maximum length (2048 characters)")
        return v.strip()

    @field_validator("wcag_level")
    @classmethod
    def validate_wcag_level(cls, v: str) -> str:
        if v.upper() not in VALID_WCAG_LEVELS:
            raise ValueError(f"wcag_level must be one of: {', '.join(VALID_WCAG_LEVELS)}")
        return v.upper()

    @field_validator("wait_for_selector")
    @classmethod
    def validate_wait_for_selector(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("wait_for_selector exceeds maximum length (500 characters)")
        return v


class BatchScanRequest(BaseModel):
    """Request to scan multiple URLs"""
    urls: List[str]
    wcag_level: str = "AA"
    max_concurrent: int = 3

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one URL is required")
        for url in v:
            if not url or not url.strip():
                raise ValueError("Empty URL found in list")
            if len(url) > 2048:
                raise ValueError("URL exceeds maximum length (2048 characters)")
        return [u.strip() for u in v]

    @field_validator("wcag_level")
    @classmethod
    def validate_wcag_level(cls, v: str) -> str:
        if v.upper() not in VALID_WCAG_LEVELS:
            raise ValueError(f"wcag_level must be one of: {', '.join(VALID_WCAG_LEVELS)}")
        return v.upper()

    @field_validator("max_concurrent")
    @classmethod
    def validate_max_concurrent(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("max_concurrent must be between 1 and 5")
        return v


class ScanResponse(BaseModel):
    """Response from accessibility scan"""
    scan_id: str
    status: str
    url: str
    wcag_level: str
    summary: Dict[str, Any]
    report_url: str


@router.post("/scan", response_model=ScanResponse)
async def scan_url(request: Request, body: ScanRequest):
    """
    Scan a URL for accessibility issues using real axe-core.
    
    This performs a REAL scan using Playwright + axe-core, not regex fallback.
    
    Returns:
        - scan_id: Unique ID to retrieve full report
        - summary: Quick overview of issues found
        - report_url: URL to get full HTML report
    """
    # SSRF prevention: validate user-supplied URL
    try:
        validate_url(body.url)
    except ValueError as e:
        logger.error(f"Invalid URL for accessibility scan: {e}")
        raise HTTPException(status_code=400, detail="Invalid URL provided for accessibility scan")

    scan_id = secrets.token_urlsafe(12)

    try:
        logger.info(f"Starting accessibility scan {scan_id} for {sanitize_url_for_logging(body.url)}")

        scanner = get_scanner()

        # Run the real scan
        result = await scanner.scan_url(
            url=body.url,
            wcag_level=body.wcag_level,
            include_passes=body.include_passes,
            wait_for_selector=body.wait_for_selector
        )

        # Store result for later retrieval (bounded + TTL)
        _store_scan_result(scan_id, result)

        logger.info(f"Scan {scan_id} complete: {result['summary']['total_violations']} issues found")

        return ScanResponse(
            scan_id=scan_id,
            status=result["summary"]["status"],
            url=body.url,
            wcag_level=body.wcag_level,
            summary=result["summary"],
            report_url=f"/api/a11y/report/{scan_id}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Scan failed for {scan_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Accessibility scan failed")


@router.get("/report/{scan_id}")
async def get_report(
    request: Request,
    scan_id: str,
    format: str = "html"
):
    """
    Get accessibility report in various formats.
    
    Formats:
        - html: Beautiful HTML report (viewable in browser)
        - json: Raw JSON data
        - markdown: Markdown format
    """
    result = _get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    if format not in VALID_REPORT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Must be one of: {', '.join(VALID_REPORT_FORMATS)}")

    generator = get_report_generator()

    if format == "html":
        html_content = generator.generate_html_report(result)
        return HTMLResponse(content=html_content)

    elif format == "json":
        return JSONResponse(content=result)

    elif format in ("markdown", "md"):
        md_content = generator.generate_markdown_report(result)
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(
            content=md_content,
            media_type="text/markdown"
        )


@router.get("/report/{scan_id}/download")
async def download_report(
    request: Request,
    scan_id: str,
    format: str = "html"
):
    """Download accessibility report as file"""
    result = _get_scan_result(scan_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    if format not in VALID_REPORT_FORMATS:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Must be one of: {', '.join(VALID_REPORT_FORMATS)}")

    generator = get_report_generator()
    url = result.get("scan_info", {}).get("url", "unknown")

    # Create filename — sanitize URL to prevent path traversal in filename
    import re
    safe_url = re.sub(r'[^a-zA-Z0-9._-]', '_', url.replace("https://", "").replace("http://", ""))[:50]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if format == "html":
        content = generator.generate_html_report(result)
        filename = f"accessibility_report_{safe_url}_{timestamp}.html"
        media_type = "text/html"
    elif format == "json":
        content = generator.generate_json_report(result)
        filename = f"accessibility_report_{safe_url}_{timestamp}.json"
        media_type = "application/json"
    elif format in ("markdown", "md"):
        content = generator.generate_markdown_report(result)
        filename = f"accessibility_report_{safe_url}_{timestamp}.md"
        media_type = "text/markdown"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Must be one of: {', '.join(VALID_REPORT_FORMATS)}")
    
    return HTMLResponse(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/batch-scan")
async def batch_scan(
    request: Request,
    body: BatchScanRequest,
    background_tasks: BackgroundTasks
):
    """
    Scan multiple URLs for accessibility issues.
    
    Scans are performed concurrently with a configurable limit.
    Returns a batch ID to check progress.
    """
    # Batch size limits
    if len(body.urls) > 20:
        raise HTTPException(status_code=400, detail="batch scan limited to 20 URLs")
    if body.max_concurrent > 5:
        raise HTTPException(status_code=400, detail="max_concurrent cannot exceed 5")

    # SSRF prevention: validate all user-supplied URLs
    for url in body.urls:
        try:
            validate_url(url)
        except ValueError as e:
            logger.error(f"Invalid URL in batch scan: {e}")
            raise HTTPException(status_code=400, detail="Invalid URL provided in batch scan")

    batch_id = secrets.token_urlsafe(12)

    # Store batch info (bounded + TTL)
    _store_scan_result(f"batch_{batch_id}", {
        "status": "in_progress",
        "urls": body.urls,
        "completed": [],
        "failed": [],
        "total": len(body.urls),
        "started_at": datetime.utcnow().isoformat()
    })

    # Start batch processing in background
    background_tasks.add_task(
        _process_batch,
        batch_id,
        body.urls,
        body.wcag_level,
        body.max_concurrent
    )

    return {
        "batch_id": batch_id,
        "status": "in_progress",
        "total_urls": len(body.urls),
        "progress_url": f"/api/a11y/batch/{batch_id}"
    }


@router.get("/batch/{batch_id}")
async def get_batch_status(request: Request, batch_id: str):
    """Get status of a batch scan"""
    key = f"batch_{batch_id}"
    result = _get_scan_result(key)
    if result is None:
        raise HTTPException(status_code=404, detail="Batch not found")

    return result


async def _process_batch(
    batch_id: str,
    urls: List[str],
    wcag_level: str,
    max_concurrent: int
):
    """Process batch of URLs with thread-safe result updates"""
    key = f"batch_{batch_id}"
    scanner = get_scanner()

    semaphore = asyncio.Semaphore(max_concurrent)

    async def scan_one(url: str):
        async with semaphore:
            try:
                result = await scanner.scan_url(url, wcag_level=wcag_level)
                scan_id = secrets.token_urlsafe(12)
                _store_scan_result(scan_id, result)

                with _scan_lock:
                    batch_data = _scan_results.get(key)
                    if batch_data:
                        batch_data["completed"].append({
                            "url": url,
                            "scan_id": scan_id,
                            "summary": result["summary"]
                        })
            except Exception as e:
                logger.error(f"Batch scan failed for URL in batch {batch_id}: {e}")
                with _scan_lock:
                    batch_data = _scan_results.get(key)
                    if batch_data:
                        batch_data["failed"].append({
                            "url": url,
                            "error": "Scan failed for this URL"
                        })

    tasks = [scan_one(url) for url in urls]
    await asyncio.gather(*tasks)

    with _scan_lock:
        batch_data = _scan_results.get(key)
        if batch_data:
            batch_data["status"] = "completed"
            batch_data["completed_at"] = datetime.utcnow().isoformat()


@router.get("/quick-check")
async def quick_check(request: Request, url: str, wcag_level: str = "AA"):
    """
    Quick accessibility check - returns summary only, no full report.
    
    Faster than full scan, good for CI/CD pipelines.
    """
    # SSRF prevention: validate user-supplied URL
    try:
        validate_url(url)
    except ValueError as e:
        logger.error(f"Invalid URL for quick check: {e}")
        raise HTTPException(status_code=400, detail="Invalid URL provided for accessibility check")

    try:
        scanner = get_scanner()
        result = await scanner.scan_url(url, wcag_level=wcag_level, include_passes=False)

        summary = result["summary"]

        # Determine pass/fail based on critical issues
        passed = summary["critical"] == 0 and summary["serious"] == 0

        return {
            "url": url,
            "wcag_level": wcag_level,
            "passed": passed,
            "compliance_score": summary["compliance_score"],
            "issues": {
                "critical": summary["critical"],
                "serious": summary["serious"],
                "moderate": summary["moderate"],
                "minor": summary["minor"]
            },
            "recommendation": "PASS - No critical or serious issues" if passed else "FAIL - Fix critical/serious issues"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Quick check failed: {e}")
        raise HTTPException(status_code=500, detail="Accessibility quick check failed")
