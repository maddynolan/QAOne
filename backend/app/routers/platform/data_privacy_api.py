"""
Data Privacy API Router — GDPR Compliance Endpoints

Endpoints:
    POST /api/privacy/erasure-request    — Request data erasure (30-day grace period)
    GET  /api/privacy/erasure-status/{id} — Check erasure request status
    POST /api/privacy/erasure-cancel/{id} — Cancel pending erasure request
    POST /api/privacy/erasure-execute     — Execute immediate erasure (admin only)
    POST /api/privacy/data-export         — Export all user data (Article 20)
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.core.data_erasure_service import data_erasure_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


class ErasureRequest(BaseModel):
    user_id: Optional[str] = None  # If None, uses authenticated user
    org_id: Optional[str] = None
    immediate: bool = False
    confirmation: Optional[str] = None  # Must be "DELETE ALL MY DATA" for immediate


class ExecuteErasureRequest(BaseModel):
    user_id: str
    org_id: str
    confirmation: str  # Must be "PERMANENTLY DELETE"


def _get_auth_context(request: Request) -> tuple:
    """Extract user_id and org_id from request."""
    user_id = getattr(request.state, "user_id", None)
    tenant_id = getattr(request.state, "tenant_id", None)
    return user_id, tenant_id


@router.post("/erasure-request")
async def request_erasure(request: Request, body: ErasureRequest) -> Dict[str, Any]:
    """
    Request data erasure under GDPR Article 17.
    By default, a 30-day grace period applies before permanent deletion.
    Set immediate=true with confirmation="DELETE ALL MY DATA" for immediate deletion.
    """
    user_id, org_id = _get_auth_context(request)
    target_user = body.user_id or user_id
    target_org = body.org_id or org_id

    if not target_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Only allow users to delete their own data (unless admin)
    if target_user != user_id:
        roles = set(getattr(request.state, "roles", []))
        if not roles.intersection({"admin", "owner"}):
            raise HTTPException(status_code=403, detail="Can only request erasure for your own data")

    # Immediate deletion requires explicit confirmation
    if body.immediate and body.confirmation != "DELETE ALL MY DATA":
        raise HTTPException(
            status_code=400,
            detail='Immediate deletion requires confirmation="DELETE ALL MY DATA"'
        )

    result = await data_erasure_service.request_erasure(
        user_id=target_user,
        org_id=target_org or "",
        immediate=body.immediate,
    )

    # If immediate, execute now
    if body.immediate:
        erasure_result = await data_erasure_service.execute_erasure(target_user, target_org or "")
        result["erasure_result"] = erasure_result

    return result


@router.get("/erasure-status/{request_id}")
async def get_erasure_status(request_id: str) -> Dict[str, Any]:
    """Check the status of an erasure request."""
    status = await data_erasure_service.get_erasure_status(request_id)
    if not status:
        raise HTTPException(status_code=404, detail="Erasure request not found")
    return status


@router.post("/erasure-cancel/{request_id}")
async def cancel_erasure(request_id: str) -> Dict[str, Any]:
    """Cancel a pending erasure request (within grace period)."""
    success = await data_erasure_service.cancel_erasure(request_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot cancel — request not found or already processed"
        )
    return {"message": "Erasure request cancelled", "request_id": request_id}


@router.post("/data-export")
async def export_data(request: Request) -> Dict[str, Any]:
    """
    Export all user data as JSON (GDPR Article 20 — Data Portability).
    Returns all data associated with the authenticated user.
    """
    user_id, org_id = _get_auth_context(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    logger.info(f"[GDPR] Data export requested by user {user_id}")
    return await data_erasure_service.export_user_data(user_id, org_id or "")


@router.post("/erasure-execute")
async def execute_erasure(request: Request, body: ExecuteErasureRequest) -> Dict[str, Any]:
    """
    Execute immediate data erasure (admin only).
    Requires confirmation="PERMANENTLY DELETE".
    """
    roles = set(getattr(request.state, "roles", []))
    if not roles.intersection({"admin", "owner"}):
        raise HTTPException(status_code=403, detail="Admin role required for direct erasure execution")

    if body.confirmation != "PERMANENTLY DELETE":
        raise HTTPException(
            status_code=400,
            detail='Requires confirmation="PERMANENTLY DELETE"'
        )

    logger.info(
        f"[GDPR] Admin {getattr(request.state, 'user_id', 'unknown')} "
        f"executing erasure for user {body.user_id}"
    )
    return await data_erasure_service.execute_erasure(body.user_id, body.org_id)
