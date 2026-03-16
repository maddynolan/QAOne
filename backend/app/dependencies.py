"""
Shared FastAPI Dependencies
Common dependency injection functions used across all module routers.

Usage in routers:
    from app.dependencies import get_current_project, get_current_user, get_current_tenant

    @router.get("/items")
    async def list_items(project_id: str = Depends(get_current_project)):
        ...

    @router.post("/items")
    async def create_item(
        project_id: str = Depends(get_current_project),
        user_id: str = Depends(get_current_user)
    ):
        ...
"""

import logging
import os
from typing import Optional, List
from fastapi import Request, HTTPException, Depends

logger = logging.getLogger(__name__)

# In development mode, fall back to demo IDs when no auth context is present
_IS_DEV = os.getenv("APP_ENV", "development") != "production"
_DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")

# Import default IDs for backward compatibility
from app.utils.endpoint_helpers import DEFAULT_ORG_ID, DEFAULT_PROJECT_ID, DEFAULT_USER_ID


def get_current_project(request: Request) -> str:
    """
    FastAPI dependency that extracts project_id from auth context.

    Resolution order:
    1. request.state.project_id (set by TenantContextMiddleware from JWT)
    2. X-Project-ID header
    3. project_id query parameter
    4. In dev/demo mode: fall back to ensure_default_org_project()

    Raises HTTPException 401 if no project context available in production.
    """
    # 1. From JWT (set by middleware)
    project_id = getattr(request.state, 'project_id', None)
    if project_id:
        return project_id

    # 2. From header
    project_id = request.headers.get("X-Project-ID")
    if project_id:
        return project_id

    # 3. From query parameter
    project_id = request.query_params.get("project_id")
    if project_id:
        return project_id

    # 4. Dev/demo fallback
    if _IS_DEV or _DEMO_MODE:
        return DEFAULT_PROJECT_ID

    raise HTTPException(
        status_code=401,
        detail="Project context required. Provide JWT token with project_id claim or X-Project-ID header."
    )


def get_current_user(request: Request) -> str:
    """
    FastAPI dependency that extracts user_id from auth context.

    Resolution order:
    1. request.state.user_id (set by TenantContextMiddleware from JWT)
    2. X-User-ID header (dev mode only)
    3. In dev/demo mode: fall back to DEFAULT_USER_ID

    Raises HTTPException 401 if no user context available in production.
    """
    # 1. From JWT (set by middleware)
    user_id = getattr(request.state, 'user_id', None)
    if user_id:
        return user_id

    # 2. From header (dev mode only)
    if _IS_DEV:
        user_id = request.headers.get("X-User-ID")
        if user_id:
            return user_id

    # 3. Dev/demo fallback
    if _IS_DEV or _DEMO_MODE:
        return DEFAULT_USER_ID

    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide JWT token in Authorization header."
    )


def get_current_tenant(request: Request) -> str:
    """
    FastAPI dependency that extracts tenant_id (org_id) from auth context.

    Resolution order:
    1. request.state.tenant_id (set by TenantContextMiddleware from JWT)
    2. X-Tenant-ID header (dev mode only)
    3. In dev/demo mode: fall back to DEFAULT_ORG_ID
    """
    tenant_id = getattr(request.state, 'tenant_id', None)
    if tenant_id:
        return tenant_id

    if _IS_DEV:
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id:
            return tenant_id

    if _IS_DEV or _DEMO_MODE:
        return DEFAULT_ORG_ID

    raise HTTPException(
        status_code=401,
        detail="Tenant context required. Provide JWT token with tenant_id claim."
    )


def get_accessible_project_ids(request: Request) -> List[str]:
    """
    FastAPI dependency that returns all project IDs the current user can access.
    Used for queries that need to scope across multiple projects.
    """
    project_ids = getattr(request.state, 'accessible_project_ids', None)
    if project_ids:
        return project_ids

    # Fall back to single project
    project_id = get_current_project(request)
    return [project_id] if project_id else []


def get_user_roles(request: Request) -> List[str]:
    """Get current user's roles from auth context."""
    return getattr(request.state, 'roles', [])


def get_user_permissions(request: Request) -> List[str]:
    """Get current user's permissions from auth context."""
    return getattr(request.state, 'permissions', [])


# ==================== Backward Compatibility ====================

async def get_project_with_fallback(request: Request) -> str:
    """
    Backward-compatible dependency that tries the new auth system first,
    then falls back to ensure_default_org_project().

    Use this during migration period. Eventually replace with get_current_project().
    """
    try:
        return get_current_project(request)
    except HTTPException:
        # Fall back to the old helper
        try:
            from app.utils.endpoint_helpers import ensure_default_org_project
            _, project_id = await ensure_default_org_project()
            return project_id
        except Exception:
            return DEFAULT_PROJECT_ID


async def get_org_and_project_with_fallback(request: Request):
    """
    Backward-compatible dependency that returns (org_id, project_id).
    Tries new auth system first, falls back to ensure_default_org_project().
    """
    org_id = getattr(request.state, 'tenant_id', None)
    project_id = getattr(request.state, 'project_id', None)

    if org_id and project_id:
        return org_id, project_id

    # Fall back
    try:
        from app.utils.endpoint_helpers import ensure_default_org_project
        return await ensure_default_org_project()
    except Exception:
        return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
