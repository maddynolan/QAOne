"""
Tenant Context Middleware
Extracts tenant_id and user_id from JWT tokens or headers and adds to request state.
This ensures all downstream code has access to tenant context for RLS enforcement.
"""

import logging
from typing import Optional
from contextvars import ContextVar
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
try:
    import jwt
except ImportError:
    # PyJWT package name
    from jwt import PyJWT
    import jwt
import os

# Context variable for current request (set by middleware)
_current_request: ContextVar[Optional[Request]] = ContextVar('current_request', default=None)

logger = logging.getLogger(__name__)

# JWT secret key — shared with jwt_service.py
JWT_SECRET = os.getenv("JWT_SECRET_KEY", os.getenv("JWT_SECRET", "dev-only-insecure-secret-change-me"))
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Internal service-to-service key for header-based tenant override
# Only requests with this key in X-Internal-Service-Key can use X-Tenant-ID headers
_INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts tenant_id and user_id from:
    1. JWT token in Authorization header
    2. X-Tenant-ID header (for API keys)
    3. X-User-ID header (for API keys)
    
    Adds to request.state for downstream use.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Set current request in context
        _current_request.set(request)
        
        # Initialize tenant context
        request.state.tenant_id = None
        request.state.user_id = None
        request.state.roles = []
        request.state.permissions = []
        
        # Skip tenant extraction for public endpoints
        if self._is_public_endpoint(request.url.path):
            return await call_next(request)
        
        # Try to extract from JWT token first (TRUSTED source)
        tenant_id, user_id, roles, permissions = self._extract_from_jwt(request)

        # Header-based override ONLY allowed for internal service-to-service calls
        # with a valid X-Internal-Service-Key. This prevents client-side spoofing.
        if not tenant_id:
            internal_key = request.headers.get("X-Internal-Service-Key", "")
            if _INTERNAL_SERVICE_KEY and internal_key == _INTERNAL_SERVICE_KEY:
                tenant_id = request.headers.get("X-Tenant-ID")
                if not user_id:
                    user_id = request.headers.get("X-User-ID")
                logger.debug("Tenant context from internal service key")
            else:
                # For unauthenticated API requests without JWT, tenant headers are
                # still accepted in development mode for backwards compatibility.
                # In production, this should be disabled.
                if os.getenv("APP_ENV", "development") != "production":
                    header_tenant = request.headers.get("X-Tenant-ID")
                    header_user = request.headers.get("X-User-ID")
                    if header_tenant:
                        tenant_id = header_tenant
                    if header_user and not user_id:
                        user_id = header_user

        # Set request state
        request.state.tenant_id = tenant_id
        request.state.user_id = user_id
        request.state.roles = roles or []
        request.state.permissions = permissions or []

        # Log for debugging (only in dev)
        if (tenant_id or user_id) and os.getenv("APP_ENV", "development") != "production":
            logger.debug(f"Tenant context: tenant_id={tenant_id}, user_id={user_id}")
        
        try:
            return await call_next(request)
        finally:
            # Clear context after request
            _current_request.set(None)
    
    def _extract_from_jwt(self, request: Request) -> tuple[Optional[str], Optional[str], list, list]:
        """Extract tenant_id and user_id from JWT token"""
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None, None, [], []
        
        try:
            # Extract token from "Bearer <token>"
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            else:
                token = auth_header
            
            # Decode JWT
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            
            tenant_id = payload.get("tenant_id")
            user_id = payload.get("user_id") or payload.get("sub")
            roles = payload.get("roles", [])
            permissions = payload.get("permissions", [])
            
            return tenant_id, user_id, roles, permissions
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None, None, [], []
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid JWT token: {e}")
            return None, None, [], []
        except Exception as e:
            logger.error(f"Error extracting JWT: {e}")
            return None, None, [], []
    
    def _is_public_endpoint(self, path: str) -> bool:
        """Check if endpoint is public (doesn't require tenant context)"""
        public_paths = [
            "/health",
            "/health/database",
            "/health/metrics",
            "/metrics",  # Prometheus metrics
            "/docs",
            "/openapi.json",
            "/redoc",
        ]
        return any(path.startswith(public) for public in public_paths)


def get_tenant_id(request: Request) -> Optional[str]:
    """Helper function to get tenant_id from request"""
    return getattr(request.state, "tenant_id", None)


def get_user_id(request: Request) -> Optional[str]:
    """Helper function to get user_id from request"""
    return getattr(request.state, "user_id", None)


def require_tenant(request: Request) -> str:
    """
    Require tenant_id to be present, raise 401 if missing.
    Use this in endpoints that require tenant context.
    """
    tenant_id = get_tenant_id(request)
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tenant context required. Provide JWT token or X-Tenant-ID header."
        )
    return tenant_id


def require_user(request: Request) -> str:
    """
    Require user_id to be present, raise 401 if missing.
    Use this in endpoints that require user context.
    """
    user_id = get_user_id(request)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User context required. Provide JWT token or X-User-ID header."
        )
    return user_id


def get_current_tenant_id() -> Optional[str]:
    """
    Get tenant_id from current request context.
    Returns None if called outside of a request context.
    """
    request = _current_request.get()
    if request:
        return get_tenant_id(request)
    return None


def get_current_user_id() -> Optional[str]:
    """
    Get user_id from current request context.
    Returns None if called outside of a request context.
    """
    request = _current_request.get()
    if request:
        return get_user_id(request)
    return None

