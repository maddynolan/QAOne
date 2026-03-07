"""
Mobile Test Flows Persistence Router

Server-side CRUD endpoints for mobile test flows, folders, and run history.
Enables team sharing and cross-device sync of mobile YAML test flows.

Prefix: /api/mobile
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request

from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mobile", tags=["mobile-testing"])


# ─── Flows ───────────────────────────────────────────────────────────────

@router.get("/flows")
async def get_flows(project_id: Optional[str] = None, platform: Optional[str] = None):
    """Get all mobile test flows for a project, optionally filtered by platform"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        flows = await mobile_flow_service.get_flows(project_id, platform=platform)
        return {"flows": flows, "total": len(flows)}
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
async def get_runs(project_id: Optional[str] = None, limit: int = 50):
    """Get recent mobile test runs for a project"""
    try:
        from app.services.mobile.flow_persistence_service import mobile_flow_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        runs = await mobile_flow_service.get_runs(project_id, limit=limit)
        return {"runs": runs, "total": len(runs)}
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
        result = await mobile_flow_service.sync_from_client(project_id, data)
        return result
    except Exception as e:
        logger.error(f"Error in mobile bulk sync: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync mobile test data")
