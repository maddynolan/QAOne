"""
Service Accounts API — CI/CD and Programmatic API Tokens

Manage service accounts with long-lived API tokens for CI/CD pipelines,
automation scripts, and external integrations.

Prefix: /api/service-accounts
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from app.dependencies import require_plan
from pydantic import BaseModel, Field

from app.services.auth.service_account_service import service_account_service

logger = logging.getLogger(__name__)

service_accounts_router = APIRouter(prefix="/api/service-accounts", tags=["Service Accounts"])


# ==================== Request/Response Models ====================

class CreateServiceAccountRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    permissions: List[str] = Field(default_factory=list)
    project_ids: List[str] = Field(default_factory=list)
    expires_days: Optional[int] = Field(default=None, ge=1, le=365)


class RegenerateTokenRequest(BaseModel):
    account_id: str


class RevokeRequest(BaseModel):
    account_id: str


# ==================== Helpers ====================

def _get_auth(request: Request):
    """Extract org_id and user_id from request state."""
    org_id = getattr(request.state, "org_id", None) or getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)
    return org_id, user_id


# ==================== CRUD ====================

@service_accounts_router.post("/create")
async def create_service_account(body: CreateServiceAccountRequest, request: Request, _: None = Depends(require_plan("service_accounts"))):
    """
    Create a new service account and API token.
    The raw token is returned ONCE — save it immediately.
    """
    org_id, user_id = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        result = await service_account_service.create(
            org_id=org_id,
            name=body.name,
            permissions=body.permissions,
            project_ids=body.project_ids,
            description=body.description,
            expires_days=body.expires_days,
            created_by=user_id,
        )
        if not result.get("success"):
            raise HTTPException(400, result.get("message", "Creation failed"))

        # Audit log
        try:
            from app.services.core.audit_service import audit_service
            await audit_service.log(
                action="service_account.create",
                user_id=user_id or "system",
                org_id=org_id,
                resource_type="service_account",
                resource_id=result.get("id"),
                details={"name": body.name, "permissions": body.permissions},
            )
        except Exception:
            pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create service account error: {e}")
        raise HTTPException(500, "Failed to create service account")


@service_accounts_router.get("/list")
async def list_service_accounts(request: Request):
    """List all service accounts for the organization (no tokens shown)."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        accounts = await service_account_service.list_accounts(org_id)
        return {"accounts": accounts, "total": len(accounts)}
    except Exception as e:
        logger.error(f"List service accounts error: {e}")
        raise HTTPException(500, "Failed to list service accounts")


@service_accounts_router.post("/regenerate")
async def regenerate_token(body: RegenerateTokenRequest, request: Request):
    """
    Regenerate the API token for a service account.
    The old token is immediately invalidated.
    The new token is returned ONCE.
    """
    org_id, user_id = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        result = await service_account_service.regenerate_token(
            account_id=body.account_id,
            org_id=org_id,
        )
        if not result:
            raise HTTPException(404, "Service account not found")

        # Audit log
        try:
            from app.services.core.audit_service import audit_service
            await audit_service.log(
                action="service_account.regenerate_token",
                user_id=user_id or "system",
                org_id=org_id,
                resource_type="service_account",
                resource_id=body.account_id,
            )
        except Exception:
            pass

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Regenerate token error: {e}")
        raise HTTPException(500, "Failed to regenerate token")


@service_accounts_router.post("/revoke")
async def revoke_service_account(body: RevokeRequest, request: Request):
    """Revoke (deactivate) a service account. Its token will no longer work."""
    org_id, user_id = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        success = await service_account_service.revoke(
            account_id=body.account_id,
            org_id=org_id,
        )
        if not success:
            raise HTTPException(404, "Service account not found")

        # Audit log
        try:
            from app.services.core.audit_service import audit_service
            await audit_service.log(
                action="service_account.revoke",
                user_id=user_id or "system",
                org_id=org_id,
                resource_type="service_account",
                resource_id=body.account_id,
            )
        except Exception:
            pass

        return {"success": True, "message": "Service account revoked"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Revoke error: {e}")
        raise HTTPException(500, "Failed to revoke service account")


# ==================== Validate (internal) ====================

@service_accounts_router.post("/validate")
async def validate_token(request: Request):
    """
    Validate an API token (for internal testing).
    In production, token validation happens automatically via middleware.
    """
    api_key = request.headers.get("X-API-Key", "")
    if not api_key:
        raise HTTPException(400, "X-API-Key header required")

    result = await service_account_service.validate_token(
        raw_token=api_key,
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("User-Agent", ""),
        endpoint="/api/service-accounts/validate",
    )
    if not result:
        raise HTTPException(401, "Invalid or expired token")

    return {"valid": True, "account": result}


# ==================== Health ====================

@service_accounts_router.get("/health")
async def service_accounts_health():
    """Service accounts health check."""
    return {"status": "ok", "service": "service_accounts"}
