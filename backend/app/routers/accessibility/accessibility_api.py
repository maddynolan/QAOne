"""
Standalone Accessibility API - REST endpoints for accessibility scanning
Supports full-page scans, component scans, site-wide audits, and VPAT generation
"""

from fastapi import APIRouter, HTTPException, Request, Header, Depends
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import asyncio
import secrets
from pydantic import BaseModel, field_validator

from app.services.flowstral.flowstral_wcag_pipeline import WCAGPipeline
from app.services.agents.accessibility_agent import AccessibilityAgent
from app.services.core.plugin_service import PluginService
from app.middleware.rbac_middleware import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accessibility", tags=["accessibility"])

# Global instances
wcag_pipeline = WCAGPipeline()
accessibility_agent = AccessibilityAgent()


async def run_axe_core_scan(url: str, component_selector: Optional[str] = None, wcag_level: str = "AA", wcag_version: str = "2.1") -> Dict[str, Any]:
    """
    Run axe-core accessibility scan using Playwright via subprocess.
    Uses subprocess to completely isolate Playwright from uvicorn's event loop
    to avoid Windows asyncio subprocess issues.
    """
    import subprocess
    import sys
    import json
    import os

    violations = []
    html_content = ""

    scanner_error = None

    try:
        # Path to the scanner script — go up TWO levels from routers/accessibility/
        # to reach app/, then down to services/accessibility/
        script_path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "services", "accessibility", "axe_scanner.py"
        )
        script_path = os.path.abspath(script_path)

        logger.info(f"[A11Y] Scanner script path: {script_path}")
        logger.info(f"[A11Y] Script exists: {os.path.exists(script_path)}")

        if not os.path.exists(script_path):
            scanner_error = "Axe-core scanner script not found"
            logger.error(f"[A11Y] Scanner script not found at {script_path}")
            return {"violations": violations, "html": html_content, "scanner_error": scanner_error}

        # Build command — pass component_selector (or "None"), wcag_level, wcag_version
        cmd = [sys.executable, script_path, url, component_selector or "None", wcag_level, wcag_version]

        logger.info(f"[A11Y] Running axe-core scan via subprocess: {url}")
        logger.info(f"[A11Y] Command: {' '.join(cmd)}")

        # Run in subprocess with timeout — use asyncio.to_thread to avoid blocking the event loop
        result = await asyncio.to_thread(
            subprocess.run,
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.dirname(script_path)
        )

        logger.info(f"[A11Y] Subprocess returncode: {result.returncode}")
        logger.info(f"[A11Y] Stdout length: {len(result.stdout) if result.stdout else 0}")
        logger.info(f"[A11Y] Stderr: {result.stderr[:500] if result.stderr else 'None'}")

        if result.returncode == 0 and result.stdout:
            data = json.loads(result.stdout)
            violations = data.get("violations", [])
            html_content = data.get("html", "")

            logger.info(f"[A11Y] Parsed violations: {len(violations)}")

            if data.get("error"):
                scanner_error = data["error"]
                logger.warning(f"[A11Y] Axe scanner warning: {scanner_error}")
        else:
            scanner_error = result.stderr[:500] if result.stderr else f"Scanner exited with code {result.returncode}"
            logger.error(f"[A11Y] Axe scanner failed: {scanner_error}")
            # Try to parse partial output even on failure
            if result.stdout:
                try:
                    data = json.loads(result.stdout)
                    if data.get("error"):
                        scanner_error = data["error"]
                    html_content = data.get("html", "")
                except json.JSONDecodeError:
                    pass

    except subprocess.TimeoutExpired:
        scanner_error = "Axe-core scan timed out after 120 seconds"
        logger.error(f"[A11Y] {scanner_error}")
    except json.JSONDecodeError as e:
        scanner_error = "Failed to parse axe scanner output"
        logger.error(f"[A11Y] Failed to parse axe scanner output: {e}")
    except Exception as e:
        scanner_error = "Axe-core scanner encountered an unexpected error"
        logger.error(f"Error running axe-core scan: {e}", exc_info=True)

    return {"violations": violations, "html": html_content, "scanner_error": scanner_error}


# Valid parameter constants
VALID_SCAN_TYPES = {"full_page", "component", "site_wide"}
VALID_WCAG_LEVELS = {"A", "AA", "AAA"}
VALID_WCAG_VERSIONS = {"2.0", "2.1", "2.2"}


# Request/Response Models
class ScanRequest(BaseModel):
    url: str
    scan_type: str = "full_page"  # full_page, component, site_wide
    component_selector: Optional[str] = None
    project_id: Optional[str] = None
    wcag_level: str = "AA"  # A, AA, AAA
    wcag_version: str = "2.1"  # 2.0, 2.1, 2.2

    @field_validator("url")
    @classmethod
    def validate_url_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("URL is required")
        if len(v) > 2048:
            raise ValueError("URL exceeds maximum length (2048 characters)")
        return v.strip()

    @field_validator("scan_type")
    @classmethod
    def validate_scan_type(cls, v: str) -> str:
        if v not in VALID_SCAN_TYPES:
            raise ValueError(f"scan_type must be one of: {', '.join(VALID_SCAN_TYPES)}")
        return v

    @field_validator("wcag_level")
    @classmethod
    def validate_wcag_level(cls, v: str) -> str:
        if v.upper() not in VALID_WCAG_LEVELS:
            raise ValueError(f"wcag_level must be one of: {', '.join(VALID_WCAG_LEVELS)}")
        return v.upper()

    @field_validator("wcag_version")
    @classmethod
    def validate_wcag_version(cls, v: str) -> str:
        if v.strip() not in VALID_WCAG_VERSIONS:
            raise ValueError(f"wcag_version must be one of: {', '.join(VALID_WCAG_VERSIONS)}")
        return v.strip()

    @field_validator("component_selector")
    @classmethod
    def validate_component_selector(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 500:
            raise ValueError("component_selector exceeds maximum length (500 characters)")
        return v


class SiteWideScanRequest(BaseModel):
    base_url: str
    max_pages: int = 50
    include_paths: Optional[List[str]] = None
    exclude_paths: Optional[List[str]] = None
    project_id: Optional[str] = None
    wcag_level: str = "AA"

    @field_validator("base_url")
    @classmethod
    def validate_base_url_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("base_url is required")
        if len(v) > 2048:
            raise ValueError("base_url exceeds maximum length (2048 characters)")
        return v.strip()

    @field_validator("max_pages")
    @classmethod
    def validate_max_pages(cls, v: int) -> int:
        if v < 1 or v > 200:
            raise ValueError("max_pages must be between 1 and 200")
        return v

    @field_validator("wcag_level")
    @classmethod
    def validate_wcag_level(cls, v: str) -> str:
        if v.upper() not in VALID_WCAG_LEVELS:
            raise ValueError(f"wcag_level must be one of: {', '.join(VALID_WCAG_LEVELS)}")
        return v.upper()


class VPATRequest(BaseModel):
    project_id: str
    urls: List[str]
    wcag_level: str = "AA"

    @field_validator("urls")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one URL is required")
        if len(v) > 50:
            raise ValueError("Maximum 50 URLs allowed")
        for url in v:
            if len(url) > 2048:
                raise ValueError("URL exceeds maximum length (2048 characters)")
        return v

    @field_validator("wcag_level")
    @classmethod
    def validate_wcag_level(cls, v: str) -> str:
        if v.upper() not in VALID_WCAG_LEVELS:
            raise ValueError(f"wcag_level must be one of: {', '.join(VALID_WCAG_LEVELS)}")
        return v.upper()


# Dependency to verify API key and extract tenant_id (optional for web UI access)
async def verify_api_key_and_tenant(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify API key (optional - allows web UI access without API key)"""
    if not authorization:
        # Return default tenant for web UI access
        logger.info("Accessibility request without API key - using default tenant (web UI access)")
        return {
            "tenant_id": None,
            "key_id": None,
            "permissions": []
        }
    
    if not authorization.startswith("Bearer "):
        # Try to use as direct API key
        api_key = authorization
    else:
        api_key = authorization[7:]
    
    plugin_service = PluginService()
    key_data = await plugin_service.validate_api_key(api_key)
    
    if not key_data or not key_data.get("tenant_id"):
        # If key is provided but invalid, still allow with default tenant for web UI
        logger.warning(f"Invalid API key provided for accessibility, using default tenant")
        return {
            "tenant_id": None,
            "key_id": None,
            "permissions": []
        }
    
    return {"tenant_id": key_data["tenant_id"]}


@router.post("/scan")
async def scan_page(
    request: Request,
    body: ScanRequest,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Scan a single page or component for accessibility issues.
    
    Supports:
    - Full page scan
    - Component-specific scan
    - WCAG A, AA, AAA compliance
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        if body.scan_type == "component" and not body.component_selector:
            raise HTTPException(
                status_code=400,
                detail="component_selector is required for component scans"
            )

        # SEC-INPUT-004: SSRF prevention — validate URL before scanning
        from app.utils.url_validator import validate_url, sanitize_url_for_logging
        try:
            validate_url(body.url)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid or blocked URL. Please provide a valid, publicly accessible URL.")

        logger.info(f"Starting accessibility scan for URL: {sanitize_url_for_logging(body.url)}")

        # Run actual axe-core scan using Playwright
        axe_result = await run_axe_core_scan(
            url=body.url,
            component_selector=body.component_selector if body.scan_type == "component" else None,
            wcag_level=body.wcag_level,
            wcag_version=body.wcag_version,
        )
        
        axe_violations = axe_result.get("violations", [])
        html_content = axe_result.get("html", "")
        scanner_error = axe_result.get("scanner_error")

        logger.info(f"Axe-core found {len(axe_violations)} violations")
        if scanner_error:
            logger.warning(f"Scanner error (will use fallback): {scanner_error}")

        # If axe-core subprocess failed AND we have no HTML, try fetching HTML directly
        if not axe_violations and not html_content and scanner_error:
            logger.info("[A11Y] Axe subprocess failed, attempting direct HTML fetch for basic checks")
            try:
                import httpx
                # SEC-DATA-002: SSL verification enabled (removed verify=False)
                async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                    resp = await client.get(body.url)
                    html_content = resp.text
                    logger.info(f"[A11Y] Fetched HTML directly: {len(html_content)} chars")
            except Exception as fetch_err:
                logger.warning(f"[A11Y] Direct HTML fetch also failed: {fetch_err}")

        # Run WCAG scan using the pipeline with real axe-core results
        wcag_result = await wcag_pipeline.scan_page(
            html=html_content,
            url=body.url,
            component_selector=body.component_selector if body.scan_type == "component" else None,
            wcag_scan_data={"violations": axe_violations} if axe_violations else None
        )

        # Convert WCAG violations to issues format
        issues = []
        for violation in wcag_result.get("violations", []):
            # Get element HTML from nodes
            element_html = ""
            selector = ""
            if violation.get("nodes"):
                first_node = violation.get("nodes", [{}])[0]
                if isinstance(first_node, dict):
                    element_html = first_node.get("html", "")
                    selector = first_node.get("selector", "")
                else:
                    element_html = str(first_node)

            issues.append({
                "id": violation.get("id", "unknown"),
                "rule": violation.get("rule", "") or violation.get("description", ""),
                "impact": violation.get("impact", "minor"),
                "description": violation.get("description", "") or violation.get("help", ""),
                "element": element_html,
                "selector": selector,
                "suggested_fix": violation.get("suggested_fix", ""),
                "wcag_criterion": violation.get("wcag_criterion", ""),
                "help_url": violation.get("helpUrl", "")
            })

        scan_id = f"scan-{secrets.token_urlsafe(12)}"

        # Generate simple report without LLM
        summary = wcag_result.get("summary", {})
        report = {
            "compliance_status": "non_compliant" if summary.get("critical", 0) > 0 else ("compliant" if summary.get("total", 0) == 0 else "mostly_compliant"),
            "total_issues": summary.get("total", 0),
            "critical_issues": summary.get("critical", 0),
            "serious_issues": summary.get("serious", 0),
            "moderate_issues": summary.get("moderate", 0),
            "minor_issues": summary.get("minor", 0)
        }

        logger.info(f"Scan complete: {summary.get('total', 0)} total issues found")

        result = {
            "status": "success",
            "scan_id": scan_id,
            "url": body.url,
            "scan_type": body.scan_type,
            "wcag_level": body.wcag_level,
            "summary": summary,
            "issues": issues,
            "report": report,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Include scanner warning if axe-core couldn't run (so frontend can show it)
        if scanner_error and not axe_violations:
            result["scanner_warning"] = "Axe-core scanner unavailable. Results are from basic HTML analysis only — install Playwright for full axe-core scanning."
            result["scan_method"] = "basic_html"
            logger.warning(f"[A11Y] Scanner fallback to basic HTML: {scanner_error}")
        else:
            result["scan_method"] = "axe_core"

        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scanning page: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to scan page")


@router.post("/scan/site-wide")
@require_permission("accessibility:execute")
async def scan_site_wide(
    request: Request,
    body: SiteWideScanRequest,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Perform site-wide accessibility audit.

    Scans multiple pages and provides aggregated report.
    """
    try:
        tenant_id = auth_data["tenant_id"]

        # TODO: Implement site-wide scanning
        # For now, return structure
        return {
            "status": "success",
            "scan_id": f"site-scan-{secrets.token_urlsafe(12)}",
            "base_url": body.base_url,
            "max_pages": body.max_pages,
            "message": "Site-wide scanning is being processed",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error in site-wide scan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to perform site-wide scan")


@router.get("/scans")
@require_permission("accessibility:read")
async def list_scans(
    request: Request,
    project_id: Optional[str] = None,
    limit: int = 20,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    List all accessibility scans for a project.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Query database for scans
        # For now, return structure
        return {
            "status": "success",
            "scans": [],
            "total": 0,
            "project_id": project_id
        }
    
    except Exception as e:
        logger.error(f"Error listing scans: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list scans")


@router.get("/scans/{scan_id}")
@require_permission("accessibility:read")
async def get_scan(
    request: Request,
    scan_id: str,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Get details of a specific accessibility scan.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Query database for scan
        return {
            "status": "success",
            "scan_id": scan_id,
            "scan": None,
            "message": "Scan retrieval not yet implemented"
        }
    
    except Exception as e:
        logger.error(f"Error getting scan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get scan")


@router.get("/issues")
@require_permission("accessibility:read")
async def list_issues(
    request: Request,
    project_id: Optional[str] = None,
    severity: Optional[str] = None,  # critical, serious, moderate, minor
    limit: int = 50,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    List all accessibility issues for a project.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Query database for issues
        return {
            "status": "success",
            "issues": [],
            "total": 0,
            "project_id": project_id,
            "severity_filter": severity
        }
    
    except Exception as e:
        logger.error(f"Error listing issues: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list issues")


@router.get("/issues/{issue_id}")
@require_permission("accessibility:read")
async def get_issue(
    request: Request,
    issue_id: str,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Get details of a specific accessibility issue.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Query database for issue
        return {
            "status": "success",
            "issue_id": issue_id,
            "issue": None,
            "message": "Issue retrieval not yet implemented"
        }
    
    except Exception as e:
        logger.error(f"Error getting issue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get issue")


@router.post("/issues/{issue_id}/fix")
@require_permission("accessibility:execute")
async def generate_fix(
    request: Request,
    issue_id: str,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Generate code fix for an accessibility issue.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        result = await accessibility_agent.generate_fixes(
            issue_id=issue_id,
            tenant_id=tenant_id
        )
        
        return {
            "status": "success",
            "issue_id": issue_id,
            "fix": result
        }
    
    except Exception as e:
        logger.error(f"Error generating fix: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate fix")


@router.post("/vpat/generate")
@require_permission("accessibility:execute")
async def generate_vpat(
    request: Request,
    body: VPATRequest,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Generate VPAT (Voluntary Product Accessibility Template) report.
    """
    try:
        tenant_id = auth_data["tenant_id"]

        # TODO: Implement VPAT generation
        return {
            "status": "success",
            "vpat_id": f"vpat-{secrets.token_urlsafe(12)}",
            "project_id": body.project_id,
            "wcag_level": body.wcag_level,
            "urls": body.urls,
            "message": "VPAT generation is being processed",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error generating VPAT: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate VPAT")


@router.get("/compliance/{project_id}")
@require_permission("accessibility:read")
async def get_compliance_status(
    request: Request,
    project_id: str,
    wcag_level: str = "AA",
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Get overall accessibility compliance status for a project.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Calculate compliance from all scans
        return {
            "status": "success",
            "project_id": project_id,
            "wcag_level": wcag_level,
            "compliance_score": 0,
            "total_issues": 0,
            "critical_issues": 0,
            "serious_issues": 0,
            "compliance_status": "unknown"
        }
    
    except Exception as e:
        logger.error(f"Error getting compliance status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get compliance status")


@router.get("/debt/{project_id}")
@require_permission("accessibility:read")
async def get_accessibility_debt(
    request: Request,
    project_id: str,
    auth_data: Dict[str, Any] = Depends(verify_api_key_and_tenant)
):
    """
    Get accessibility debt summary for a project.
    """
    try:
        tenant_id = auth_data["tenant_id"]
        
        # TODO: Calculate debt from all issues
        return {
            "status": "success",
            "project_id": project_id,
            "total_issues": 0,
            "estimated_fix_time_hours": 0,
            "priority_breakdown": {
                "critical": 0,
                "serious": 0,
                "moderate": 0,
                "minor": 0
            }
        }
    
    except Exception as e:
        logger.error(f"Error getting accessibility debt: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get accessibility debt")

