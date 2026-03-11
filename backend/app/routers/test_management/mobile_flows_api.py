"""
Mobile Test Flows Persistence Router

Server-side CRUD endpoints for mobile test flows, folders, and run history.
Enables team sharing and cross-device sync of mobile YAML test flows.

Prefix: /api/mobile
"""

import logging
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request

from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mobile", tags=["mobile-testing"])

# ─── Validation Helpers ──────────────────────────────────────────────────

VALID_PLATFORMS = {"ios", "android"}
MAX_RUNS_LIMIT = 500
MAX_FLOW_NAME_LENGTH = 200
MAX_YAML_SIZE = 500_000  # 500KB max YAML content
MAX_SYNC_ITEMS = 1000  # Max items per sync batch
_SAFE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{1,128}$")


def _validate_platform(platform: Optional[str]) -> Optional[str]:
    """Validate platform parameter is ios or android."""
    if platform is not None and platform not in VALID_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Invalid platform: must be one of {sorted(VALID_PLATFORMS)}")
    return platform


def _validate_id(value: str, label: str = "ID") -> str:
    """Validate that an ID parameter is safe (alphanumeric, hyphens, underscores)."""
    if not value or not _SAFE_ID_PATTERN.match(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label}: must be 1-128 alphanumeric characters, hyphens, or underscores")
    return value


def _validate_flow_data(data: dict) -> dict:
    """Validate flow data has required fields and reasonable sizes."""
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object")
    name = data.get("name")
    if name and len(str(name)) > MAX_FLOW_NAME_LENGTH:
        raise HTTPException(status_code=400, detail=f"Flow name must be {MAX_FLOW_NAME_LENGTH} characters or fewer")
    yaml_content = data.get("yaml", "")
    if yaml_content and len(str(yaml_content)) > MAX_YAML_SIZE:
        raise HTTPException(status_code=400, detail=f"YAML content exceeds maximum size of {MAX_YAML_SIZE} bytes")
    platform = data.get("platform")
    if platform:
        _validate_platform(platform)
    return data


# ─── Flows ───────────────────────────────────────────────────────────────

@router.get("/flows")
async def get_flows(project_id: Optional[str] = None, platform: Optional[str] = None):
    """Get all mobile test flows for a project, optionally filtered by platform"""
    try:
        _validate_platform(platform)
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        flows = await mobile_flow_service.get_flows(project_id, platform=platform)
        return {"flows": flows, "total": len(flows)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mobile flows: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve mobile flows")


@router.post("/flows")
async def save_flow(request: Request, project_id: Optional[str] = None):
    """Create or update a mobile test flow"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        _validate_flow_data(data)
        result = await mobile_flow_service.save_flow(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save flow")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving mobile flow: {e}")
        raise HTTPException(status_code=500, detail="Failed to save mobile flow")


@router.delete("/flows/{flow_id}")
async def delete_flow(flow_id: str):
    """Delete a mobile test flow"""
    try:
        _validate_id(flow_id, "flow_id")
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        deleted = await mobile_flow_service.delete_flow(flow_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Flow not found")
        return {"status": "deleted", "id": flow_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mobile flow: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete mobile flow")


# ─── Folders ─────────────────────────────────────────────────────────────

@router.get("/folders")
async def get_folders(project_id: Optional[str] = None):
    """Get all mobile test folders for a project"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        folders = await mobile_flow_service.get_folders(project_id)
        return {"folders": folders}
    except Exception as e:
        logger.error(f"Error getting mobile folders: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve mobile folders")


@router.post("/folders")
async def save_folder(request: Request, project_id: Optional[str] = None):
    """Create or update a mobile test folder"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
        folder_name = data.get("name")
        if folder_name and len(str(folder_name)) > MAX_FLOW_NAME_LENGTH:
            raise HTTPException(status_code=400, detail=f"Folder name must be {MAX_FLOW_NAME_LENGTH} characters or fewer")
        result = await mobile_flow_service.save_folder(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save folder")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving mobile folder: {e}")
        raise HTTPException(status_code=500, detail="Failed to save mobile folder")


# ─── Runs ────────────────────────────────────────────────────────────────

@router.get("/runs")
async def get_runs(
    project_id: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=MAX_RUNS_LIMIT),
):
    """Get recent mobile test runs for a project"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        runs = await mobile_flow_service.get_runs(project_id, limit=limit)
        return {"runs": runs, "total": len(runs)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mobile runs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve mobile test runs")


@router.post("/runs")
async def save_run(request: Request, project_id: Optional[str] = None):
    """Record a mobile test run"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
        platform = data.get("platform")
        if platform:
            _validate_platform(platform)
        result = await mobile_flow_service.save_run(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save run")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving mobile run: {e}")
        raise HTTPException(status_code=500, detail="Failed to save mobile test run")


# ─── Bulk Sync ───────────────────────────────────────────────────────────

@router.post("/sync")
async def sync_from_client(request: Request, project_id: Optional[str] = None):
    """
    Bulk sync: receive full mobile test data from client localStorage and persist to server.
    Use for initial migration from localStorage-only to server-persisted flows.
    """
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        if not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")
        # Enforce size limits on sync batches
        for key in ("flows", "folders", "runs"):
            items = data.get(key, [])
            if isinstance(items, list) and len(items) > MAX_SYNC_ITEMS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Sync batch too large: {key} contains {len(items)} items (max {MAX_SYNC_ITEMS})"
                )
        result = await mobile_flow_service.sync_from_client(project_id, data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in mobile bulk sync: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync mobile test data")
