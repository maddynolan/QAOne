"""
API Collection Persistence Router

Server-side CRUD endpoints for API test collections, folders, requests,
environments, and chains. Enables team sharing and cross-device sync.

Prefix: /api/v2/testing/collections
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request

from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/testing/collections", tags=["api-collections"])


@router.get("")
async def get_collections(project_id: Optional[str] = None):
    """Get all API collections for a project"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        collections = await collection_service.get_collections(project_id)
        return {"collections": collections, "total": len(collections)}
    except Exception as e:
        logger.error(f"Error getting collections: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{collection_id}")
async def get_collection(collection_id: str):
    """Get a collection with its folders and requests"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        collection = await collection_service.get_collection(collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        return collection
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("")
async def save_collection(request: Request, project_id: Optional[str] = None):
    """Create or update an API collection"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        result = await collection_service.save_collection(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save collection")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving collection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{collection_id}")
async def delete_collection(collection_id: str):
    """Delete a collection and all its contents"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        deleted = await collection_service.delete_collection(collection_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Collection not found")
        return {"status": "deleted", "id": collection_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting collection: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Requests ────────────────────────────────────────────────────────────

@router.post("/{collection_id}/requests")
async def save_request(collection_id: str, request: Request):
    """Create or update a request in a collection"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        data = await request.json()
        result = await collection_service.save_request(collection_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save request")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{collection_id}/requests/{request_id}")
async def delete_request(collection_id: str, request_id: str):
    """Delete a request from a collection"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        deleted = await collection_service.delete_request(request_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Request not found")
        return {"status": "deleted", "id": request_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Folders ─────────────────────────────────────────────────────────────

@router.post("/{collection_id}/folders")
async def save_folder(collection_id: str, request: Request):
    """Create or update a folder in a collection"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        data = await request.json()
        result = await collection_service.save_folder(collection_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save folder")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving folder: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Environments ────────────────────────────────────────────────────────

@router.get("/environments")
async def get_environments(project_id: Optional[str] = None):
    """Get all API environments for a project"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        envs = await collection_service.get_environments(project_id)
        return {"environments": envs}
    except Exception as e:
        logger.error(f"Error getting environments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/environments")
async def save_environment(request: Request, project_id: Optional[str] = None):
    """Create or update an API environment"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        result = await collection_service.save_environment(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save environment")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving environment: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Chains ──────────────────────────────────────────────────────────────

@router.get("/chains")
async def get_chains(project_id: Optional[str] = None):
    """Get all request chains for a project"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        chains = await collection_service.get_chains(project_id)
        return {"chains": chains}
    except Exception as e:
        logger.error(f"Error getting chains: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/chains")
async def save_chain(request: Request, project_id: Optional[str] = None):
    """Create or update a request chain"""
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        result = await collection_service.save_chain(project_id, data)
        if not result:
            raise HTTPException(status_code=500, detail="Failed to save chain")
        return {"id": result, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving chain: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Bulk Sync ───────────────────────────────────────────────────────────

@router.post("/sync")
async def sync_from_client(request: Request, project_id: Optional[str] = None):
    """
    Bulk sync: receive full collection data from client localStorage and persist to server.
    Use this for initial migration from localStorage-only to server-persisted collections.
    """
    try:
        from app.services.api_testing.collection_persistence_service import collection_service
        _, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        data = await request.json()
        result = await collection_service.sync_from_client(project_id, data)
        return result
    except Exception as e:
        logger.error(f"Error in bulk sync: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
