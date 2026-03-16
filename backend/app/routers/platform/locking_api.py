"""
Artifact Locking API — Check-out / Check-in (Tosca-style)

Provides endpoints for acquiring, releasing, and managing exclusive edit locks
on any artifact type (test cases, API collections, perf scenarios, etc.).

Endpoints:
    POST   /api/locks/acquire            — Acquire lock (check-out)
    POST   /api/locks/release            — Release lock (check-in)
    POST   /api/locks/force-release      — Admin force-release
    GET    /api/locks/status/{type}/{id}  — Check lock status
    GET    /api/locks/mine               — List my locks
    GET    /api/locks/project            — List all locks in project
    GET    /api/locks/history/{type}/{id} — Lock history
    POST   /api/locks/batch-check        — Batch check locks
    POST   /api/locks/cleanup            — Admin: cleanup expired locks
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

locking_router = APIRouter(prefix="/api/locks", tags=["Artifact Locking"])


# ==================== Request/Response Models ====================

class AcquireLockRequest(BaseModel):
    artifact_type: str = Field(..., description="Type: test_case, api_collection, perf_scenario, etc.")
    artifact_id: str = Field(..., description="UUID of the artifact to lock")
    duration_hours: float = Field(4.0, ge=0.1, le=24.0, description="Lock duration in hours (max 24)")
    reason: str = Field("", description="Optional reason for checking out")


class ReleaseLockRequest(BaseModel):
    artifact_type: str = Field(..., description="Type of artifact")
    artifact_id: str = Field(..., description="UUID of the artifact to unlock")


class ForceReleaseRequest(BaseModel):
    artifact_type: str = Field(..., description="Type of artifact")
    artifact_id: str = Field(..., description="UUID of the artifact")
    reason: str = Field("", description="Reason for force-release")


class BatchCheckRequest(BaseModel):
    artifact_type: str = Field(..., description="Type of artifact")
    artifact_ids: List[str] = Field(..., description="List of artifact UUIDs to check")


# ==================== Helper: Extract user from request ====================

def _get_user_from_request(request: Request):
    """Extract user_id and user_name from request.state (set by middleware)."""
    user_id = getattr(request.state, "user_id", None)
    user_name = getattr(request.state, "user_name", "")

    if not user_id:
        # Fallback: try JWT payload
        jwt_payload = getattr(request.state, "_last_jwt_payload", None)
        if jwt_payload:
            user_id = jwt_payload.get("sub") or jwt_payload.get("user_id")
            user_name = jwt_payload.get("name", "")

    if not user_id:
        # Development fallback
        user_id = request.query_params.get("user_id", "22222222-2222-2222-2222-222222222222")
        user_name = request.query_params.get("user_name", "Dev User")

    return user_id, user_name


def _get_project_from_request(request: Request):
    """Extract project_id from request.state."""
    project_id = getattr(request.state, "project_id", None)
    if not project_id:
        project_id = request.query_params.get("project_id")
    return project_id


# ==================== Endpoints ====================

@locking_router.post("/acquire")
async def acquire_lock(request: Request, body: AcquireLockRequest):
    """
    Acquire an exclusive lock on an artifact (check-out).
    Returns 200 with success=true if lock acquired, success=false if already locked.
    """
    user_id, user_name = _get_user_from_request(request)
    project_id = _get_project_from_request(request)

    from app.services.core.locking_service import locking_service
    result = await locking_service.acquire_lock(
        artifact_type=body.artifact_type,
        artifact_id=body.artifact_id,
        user_id=user_id,
        user_name=user_name,
        project_id=project_id,
        duration_hours=body.duration_hours,
        reason=body.reason,
    )

    # Log to audit trail
    try:
        from app.services.core.audit_service import audit_service
        await audit_service.log(
            action="lock.acquire" if result["success"] else "lock.acquire_failed",
            user_id=user_id,
            resource_type=body.artifact_type,
            resource_id=body.artifact_id,
            details={"reason": body.reason, "success": result["success"]},
        )
    except Exception:
        pass

    return result


@locking_router.post("/release")
async def release_lock(request: Request, body: ReleaseLockRequest):
    """
    Release a lock on an artifact (check-in).
    Only the lock owner can release their lock.
    """
    user_id, user_name = _get_user_from_request(request)

    from app.services.core.locking_service import locking_service
    result = await locking_service.release_lock(
        artifact_type=body.artifact_type,
        artifact_id=body.artifact_id,
        user_id=user_id,
        user_name=user_name,
    )

    try:
        from app.services.core.audit_service import audit_service
        await audit_service.log(
            action="lock.release",
            user_id=user_id,
            resource_type=body.artifact_type,
            resource_id=body.artifact_id,
        )
    except Exception:
        pass

    return result


@locking_router.post("/force-release")
async def force_release_lock(request: Request, body: ForceReleaseRequest):
    """
    Force-release a lock (admin/lead action).
    Removes the lock regardless of who owns it.
    Requires 'locks:admin' permission or admin/owner role.
    """
    user_id, user_name = _get_user_from_request(request)

    # Check admin permission
    roles = getattr(request.state, "roles", [])
    permissions = getattr(request.state, "permissions", [])
    is_admin = any(r in ("admin", "owner", "lead") for r in roles) or "locks:admin" in permissions or "*" in permissions

    # In development/demo mode, allow force-release
    import os
    app_env = os.environ.get("APP_ENV", "development")
    if app_env == "development":
        is_admin = True

    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Force-release requires admin, owner, or lead role, or 'locks:admin' permission",
        )

    from app.services.core.locking_service import locking_service
    result = await locking_service.force_release(
        artifact_type=body.artifact_type,
        artifact_id=body.artifact_id,
        admin_user_id=user_id,
        admin_user_name=user_name,
        reason=body.reason,
    )

    try:
        from app.services.core.audit_service import audit_service
        await audit_service.log(
            action="lock.force_release",
            user_id=user_id,
            resource_type=body.artifact_type,
            resource_id=body.artifact_id,
            details={"reason": body.reason},
        )
    except Exception:
        pass

    return result


@locking_router.get("/status/{artifact_type}/{artifact_id}")
async def check_lock_status(artifact_type: str, artifact_id: str):
    """Check if an artifact is currently locked."""
    from app.services.core.locking_service import locking_service
    return await locking_service.check_lock(artifact_type, artifact_id)


@locking_router.get("/mine")
async def list_my_locks(request: Request):
    """List all locks held by the current user."""
    user_id, _ = _get_user_from_request(request)
    project_id = _get_project_from_request(request)

    from app.services.core.locking_service import locking_service
    locks = await locking_service.list_user_locks(user_id, project_id)
    return {"locks": locks, "count": len(locks)}


@locking_router.get("/project")
async def list_project_locks(request: Request):
    """List all active locks in the current project."""
    project_id = _get_project_from_request(request)
    if not project_id:
        raise HTTPException(status_code=400, detail="Project context required")

    from app.services.core.locking_service import locking_service
    locks = await locking_service.list_project_locks(project_id)
    return {"locks": locks, "count": len(locks)}


@locking_router.get("/history/{artifact_type}/{artifact_id}")
async def get_lock_history(artifact_type: str, artifact_id: str, limit: int = 50):
    """Get lock history for an artifact."""
    from app.services.core.locking_service import locking_service
    history = await locking_service.get_lock_history(artifact_type, artifact_id, limit)
    return {"history": history, "count": len(history)}


@locking_router.post("/batch-check")
async def batch_check_locks(body: BatchCheckRequest):
    """Check lock status for multiple artifacts at once."""
    if len(body.artifact_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 artifacts per batch check")

    from app.services.core.locking_service import locking_service
    result = await locking_service.check_locks_batch(body.artifact_type, body.artifact_ids)
    return {"locks": result}


@locking_router.post("/cleanup")
async def cleanup_expired_locks(request: Request):
    """
    Admin endpoint: cleanup expired locks.
    Also runs automatically via background task.
    """
    # Check admin permission
    roles = getattr(request.state, "roles", [])
    permissions = getattr(request.state, "permissions", [])
    is_admin = any(r in ("admin", "owner") for r in roles) or "*" in permissions

    import os
    if os.environ.get("APP_ENV", "development") == "development":
        is_admin = True

    if not is_admin:
        raise HTTPException(status_code=403, detail="Cleanup requires admin role")

    from app.services.core.locking_service import locking_service
    count = await locking_service.cleanup_expired_locks()
    return {"cleaned_up": count, "message": f"Removed {count} expired locks"}
