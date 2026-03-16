"""
RBAC Middleware
Enforces role-based access control on API endpoints.
Works with JWT tokens and RBAC service to check permissions.
"""

import logging
from typing import Optional, Callable, List
from fastapi import Request, HTTPException, status
from functools import wraps
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.core.rbac_service import rbac_service
from app.middleware.tenant_middleware import get_tenant_id, get_user_id, _current_request, _current_request

logger = logging.getLogger(__name__)


class RBACMiddleware(BaseHTTPMiddleware):
    """
    Middleware that enforces RBAC on all requests.
    Checks permissions from JWT token or RBAC service.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip RBAC for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Get user and tenant context
        user_id = get_user_id(request)
        tenant_id = get_tenant_id(request)
        
        # If no user context, allow through (will be caught by auth middleware)
        if not user_id:
            return await call_next(request)
        
        # Store permissions in request state for decorator use
        if user_id and tenant_id:
            try:
                permissions = await rbac_service.get_user_permissions(user_id, tenant_id)
                request.state.permissions = permissions
            except Exception as e:
                logger.warning(f"Error fetching permissions: {e}")
                request.state.permissions = []
        else:
            request.state.permissions = []
        
        return await call_next(request)
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public"""
        public_paths = [
            "/health",
            "/health/database",
            "/health/metrics",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/auth",
        ]
        return any(path.startswith(public) for public in public_paths)


def require_permission(permission: str):
    """
    Decorator to require a specific permission.
    
    Usage:
        @router.post("/test-cases")
        @require_permission("test_cases:create")
        async def create_test_case(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find request object in args or kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")
            
            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )
            
            # Get user and tenant
            user_id = get_user_id(request)
            tenant_id = get_tenant_id(request)

            # If no user context, allow through (matches middleware behavior).
            # Auth middleware upstream is responsible for enforcing login when
            # authentication is configured.  Without a user_id the RBAC
            # decorator cannot check permissions, so it gracefully allows the
            # request — the same way RBACMiddleware.dispatch() does.
            if not user_id:
                return await func(*args, **kwargs)

            # Check permission
            has_permission = await rbac_service.check_permission(
                user_id=user_id,
                permission=permission,
                tenant_id=tenant_id
            )

            if not has_permission:
                logger.warning(
                    f"Permission denied: user {user_id} attempted {permission}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission}"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_role(role: str):
    """
    Decorator to require a specific role.

    Usage:
        @router.delete("/test-cases/{id}")
        @require_role("admin")
        async def delete_test_case(...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )

            user_id = get_user_id(request)
            tenant_id = get_tenant_id(request)

            # Allow through if no auth context (matches middleware behavior)
            if not user_id:
                return await func(*args, **kwargs)

            # Get user roles
            user_roles = await rbac_service._get_user_roles(user_id, tenant_id)
            role_names = [r.get("name") for r in user_roles]

            if role not in role_names:
                logger.warning(
                    f"Role denied: user {user_id} attempted {role}, has {role_names}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role required: {role}"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def require_any_permission(permissions: List[str]):
    """
    Decorator to require any one of multiple permissions.

    Usage:
        @require_any_permission(["test_cases:read", "test_cases:write"])
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )

            user_id = get_user_id(request)
            tenant_id = get_tenant_id(request)

            # Allow through if no auth context (matches middleware behavior)
            if not user_id:
                return await func(*args, **kwargs)

            # Check if user has any of the required permissions
            has_permission = False
            for permission in permissions:
                if await rbac_service.check_permission(user_id, permission, tenant_id):
                    has_permission = True
                    break

            if not has_permission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: requires one of {permissions}"
                )

            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_project_permission(permission: str):
    """
    Decorator to require a project-level permission.
    Checks permissions from the JWT token's project context.

    Uses the permissions already resolved by tenant_middleware and
    stored in request.state.permissions (from JWT claims).

    If request.state.permissions is empty (no auth configured),
    falls back to allowing the request through.

    Usage:
        @router.post("/test-cases")
        @require_project_permission("test_cases:create")
        async def create_test_case(request: Request, ...):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request:
                request = kwargs.get("request")

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found"
                )

            user_id = get_user_id(request)
            if not user_id:
                return await func(*args, **kwargs)

            # Get permissions from request.state (set by tenant middleware from JWT)
            perms = getattr(request.state, "permissions", [])

            # Wildcard check
            if "*" in perms:
                return await func(*args, **kwargs)

            # Exact match
            if permission in perms:
                return await func(*args, **kwargs)

            # Module wildcard (e.g., "test_cases:*")
            module = permission.split(":")[0] if ":" in permission else ""
            if module and f"{module}:*" in perms:
                return await func(*args, **kwargs)

            # Fallback: check via RBAC service
            tenant_id = get_tenant_id(request)
            if tenant_id:
                try:
                    has_perm = await rbac_service.check_permission(
                        user_id=user_id,
                        permission=permission,
                        tenant_id=tenant_id
                    )
                    if has_perm:
                        return await func(*args, **kwargs)
                except Exception:
                    pass

            logger.warning(
                f"Project permission denied: user {user_id} attempted {permission}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission}"
            )

        return wrapper
    return decorator


def get_current_auth_user_id() -> Optional[str]:
    """
    Get user_id from current request context.
    Returns None if called outside of a request context.
    """
    request = _current_request.get()
    if request:
        return get_user_id(request)
    return None

