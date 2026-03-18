"""
Shared FastAPI Dependencies
Common dependency injection functions used across all module routers.

Usage in routers:
    from app.dependencies import get_current_project, get_current_user, get_current_tenant
    from app.dependencies import enforce_project_limit, enforce_test_run_limit, require_plan

    @router.get("/items")
    async def list_items(project_id: str = Depends(get_current_project)):
        ...

    @router.post("/items")
    async def create_item(
        project_id: str = Depends(get_current_project),
        user_id: str = Depends(get_current_user)
    ):
        ...

    # Enforce project limit before creating
    @router.post("/projects")
    async def create_project(
        _: None = Depends(enforce_project_limit),
        ...
    ):
        ...

    # Require a specific plan tier for a feature
    @router.post("/ai-testing/start")
    async def start_ai_testing(
        _: None = Depends(require_plan("flowpilot")),
        ...
    ):
        ...
"""

import logging
import os
from typing import Optional, List, Callable
from fastapi import Request, HTTPException, Depends
from fastapi.responses import JSONResponse

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


# ==================== Subscription Enforcement ====================

class SubscriptionLimitExceeded(HTTPException):
    """
    Raised when a subscription limit is exceeded.
    Returns a structured 403 response with upgrade info.
    """
    def __init__(self, resource: str, current: int, limit: int, plan: str):
        detail = {
            "error": "subscription_limit_exceeded",
            "resource": resource,
            "current": current,
            "limit": limit,
            "plan": plan,
            "upgrade_url": "/pricing",
        }
        super().__init__(status_code=403, detail=detail)


class FeatureNotAvailable(HTTPException):
    """
    Raised when a feature requires a higher plan tier.
    Returns a structured 403 response with upgrade info.
    """
    def __init__(self, feature: str, required_tier: str, current_plan: str):
        detail = {
            "error": "feature_not_available",
            "feature": feature,
            "required_tier": required_tier,
            "current_plan": current_plan,
            "upgrade_url": "/pricing",
        }
        super().__init__(status_code=403, detail=detail)


async def _get_org_subscription(request: Request):
    """
    Internal helper to get org subscription.
    Returns (org_id, subscription_dict) or (org_id, None) if no sub.
    Skips enforcement in demo mode.
    """
    if _DEMO_MODE:
        return None, None

    org_id = getattr(request.state, 'tenant_id', None)
    if not org_id:
        if _IS_DEV:
            org_id = DEFAULT_ORG_ID
        else:
            return None, None  # No org context, skip enforcement

    try:
        from app.services.core.subscription_service import subscription_service
        sub = await subscription_service.get_subscription(org_id)
        return org_id, sub
    except Exception as e:
        logger.error(f"[Enforcement] Failed to get subscription: {e}")
        return org_id, None


async def enforce_project_limit(request: Request) -> None:
    """
    FastAPI dependency: checks project count vs plan limit.
    Add to project creation endpoints as Depends(enforce_project_limit).
    """
    org_id, sub = await _get_org_subscription(request)
    if not sub:
        return  # No subscription = no enforcement (backward compat)

    try:
        from app.services.core.subscription_service import subscription_service
        usage = await subscription_service.get_usage(org_id)
        limit = sub.get("max_projects", 999999)
        current = usage["projects"]
        if current >= limit:
            raise SubscriptionLimitExceeded("projects", current, limit, sub.get("plan", "free"))
    except SubscriptionLimitExceeded:
        raise
    except Exception as e:
        logger.error(f"[Enforcement] Project limit check failed: {e}")


async def enforce_user_limit(request: Request) -> None:
    """
    FastAPI dependency: checks user count vs plan limit.
    Add to user invitation endpoints as Depends(enforce_user_limit).
    """
    org_id, sub = await _get_org_subscription(request)
    if not sub:
        return

    try:
        from app.services.core.subscription_service import subscription_service
        usage = await subscription_service.get_usage(org_id)
        limit = sub.get("max_users", 999999)
        current = usage["users"]
        if current >= limit:
            raise SubscriptionLimitExceeded("users", current, limit, sub.get("plan", "free"))
    except SubscriptionLimitExceeded:
        raise
    except Exception as e:
        logger.error(f"[Enforcement] User limit check failed: {e}")


async def enforce_test_run_limit(request: Request) -> None:
    """
    FastAPI dependency: checks monthly test runs AND daily playbacks vs plan limits.
    Add to test run creation endpoints as Depends(enforce_test_run_limit).
    """
    org_id, sub = await _get_org_subscription(request)
    if not sub:
        return

    try:
        from app.services.core.subscription_service import subscription_service, PLAN_LIMITS
        usage = await subscription_service.get_usage(org_id)
        plan = sub.get("plan", "free")
        plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        # Check monthly test runs
        monthly_limit = sub.get("max_test_runs_per_month", plan_limits.get("max_test_runs_per_month", 999999))
        monthly_current = usage["test_runs_this_month"]
        if monthly_current >= monthly_limit:
            raise SubscriptionLimitExceeded("test_runs_per_month", monthly_current, monthly_limit, plan)

        # Check daily playbacks
        daily_limit = plan_limits.get("max_playbacks_per_day", 999999)
        daily_current = usage["playbacks_today"]
        if daily_current >= daily_limit:
            raise SubscriptionLimitExceeded("playbacks_per_day", daily_current, daily_limit, plan)
    except SubscriptionLimitExceeded:
        raise
    except Exception as e:
        logger.error(f"[Enforcement] Test run limit check failed: {e}")


def require_plan(feature: str) -> Callable:
    """
    Factory that returns a FastAPI dependency checking if the org's plan
    includes the specified feature.

    Usage:
        @router.post("/flowpilot/start")
        async def start(
            _: None = Depends(require_plan("flowpilot")),
        ):
            ...
    """
    async def _check_plan(request: Request) -> None:
        if _DEMO_MODE:
            return  # All features available in demo mode

        org_id, sub = await _get_org_subscription(request)
        if not sub:
            return  # No subscription = no enforcement

        plan = sub.get("plan", "free")

        from app.services.core.subscription_service import subscription_service
        if not subscription_service.is_feature_available(plan, feature):
            from app.services.core.subscription_service import FEATURE_TIER_MAP
            required = FEATURE_TIER_MAP.get(feature, "pro")
            raise FeatureNotAvailable(feature, required, plan)

    return _check_plan
