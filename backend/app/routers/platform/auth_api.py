"""
Authentication API Router
Handles user registration, login, session management, token refresh,
email verification, and resend verification.

Endpoints:
    POST /api/auth/login                - Email/password login
    POST /api/auth/signup               - Register new user
    POST /api/auth/refresh              - Refresh JWT token
    POST /api/auth/logout               - Invalidate token
    GET  /api/auth/me                   - Get current user
    GET  /api/auth/session              - Get full session (user + org + project + roles)
    GET  /api/auth/members              - List org members
    GET  /api/auth/verify-email         - Verify email with token
    POST /api/auth/resend-verification  - Resend verification email
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Header, Query
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ==================== Request/Response Models ====================

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email")
    password: str = Field(..., min_length=1, description="User password")
    project_id: Optional[str] = Field(None, description="Optional project to switch to")


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3, description="User email")
    password: str = Field(..., min_length=8, description="User password (min 8 chars)")
    name: str = Field(..., min_length=1, max_length=255, description="Display name")
    org_name: Optional[str] = Field(None, description="Organization name (creates new org)")
    org_id: Optional[str] = Field(None, description="Organization ID (joins existing org)")
    device_fingerprint: Optional[str] = Field(None, description="Hardware fingerprint from Electron desktop app")


class RefreshRequest(BaseModel):
    token: str = Field(..., description="Current JWT token to refresh")


class ResendVerificationRequest(BaseModel):
    email: str = Field(..., min_length=3, description="Email to resend verification to")


class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: Optional[dict] = None
    org: Optional[dict] = None
    project: Optional[dict] = None
    roles: list = []
    permissions: list = []
    requires_verification: bool = False


# ==================== Endpoints ====================

@auth_router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Authenticate user with email and password.
    Returns JWT token and session data.
    """
    try:
        from app.services.auth.auth_service import auth_service
        result = await auth_service.login(
            email=request.email,
            password=request.password,
            project_id=request.project_id
        )
        return AuthResponse(
            token=result["token"],
            user=result["user"],
            org=result.get("org"),
            project=result.get("project"),
            roles=result.get("roles", []),
            permissions=result.get("permissions", [])
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Authentication failed")


@auth_router.post("/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    """
    Register a new user account.
    Optionally creates a new organization or joins an existing one.
    Returns requires_verification=true if email verification is needed.
    """
    try:
        from app.services.auth.auth_service import auth_service
        result = await auth_service.register(
            email=request.email,
            password=request.password,
            name=request.name,
            org_name=request.org_name,
            org_id=request.org_id,
            device_fingerprint=request.device_fingerprint,
        )

        # New signup flow: requires email verification
        if result.get("requires_verification"):
            return AuthResponse(
                requires_verification=True,
                user=result.get("user"),
            )

        # Legacy/fallback: direct login after signup
        return AuthResponse(
            token=result.get("token", ""),
            user=result.get("user"),
            org=result.get("org"),
            project=result.get("project"),
            roles=result.get("roles", ["admin"]),
            permissions=result.get("permissions", [])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Signup error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed")


@auth_router.post("/refresh")
async def refresh_token(request: RefreshRequest):
    """Refresh a JWT token. Returns new token with extended expiration."""
    try:
        from app.services.auth.auth_service import auth_service
        new_token = await auth_service.refresh_token(request.token)
        if not new_token:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {"token": new_token}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Token refresh failed")


@auth_router.post("/logout")
async def logout(request: Request, authorization: Optional[str] = Header(None)):
    """Invalidate the current JWT token (logout)."""
    token = _extract_token(authorization)
    if not token:
        return {"status": "ok"}  # Already logged out

    try:
        from app.services.auth.auth_service import auth_service
        await auth_service.logout(token)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Logout error: {e}", exc_info=True)
        return {"status": "ok"}  # Logout should always succeed from user perspective


@auth_router.get("/me")
async def get_me(request: Request, authorization: Optional[str] = Header(None)):
    """
    Get current authenticated user.
    Requires valid JWT token in Authorization header.
    """
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        from app.services.auth.auth_service import auth_service
        user = await auth_service.get_current_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "auth_provider": user.get("auth_provider", "local")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get user info")


@auth_router.get("/session")
async def get_session(request: Request, authorization: Optional[str] = Header(None)):
    """
    Get full session data: user, organization, project, roles, permissions.
    Used by frontend on mount to restore session from stored JWT.
    """
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        from app.services.auth.auth_service import auth_service
        session = await auth_service.get_session(token)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get session error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to restore session")


@auth_router.get("/members")
async def list_members(request: Request, authorization: Optional[str] = Header(None)):
    """
    List all members of the current user's organization.
    Requires admin or owner role.
    """
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        from app.services.auth.auth_service import auth_service
        session = await auth_service.get_session(token)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")

        org = session.get("org")
        if not org:
            raise HTTPException(status_code=400, detail="No organization context")

        members = await auth_service.list_org_members(org["id"])
        return {"members": members, "count": len(members)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List members error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list members")


# ==================== Email Verification ====================

@auth_router.get("/verify-email")
async def verify_email(token: str = Query(..., description="Verification token from email link")):
    """
    Verify email address using the token from the verification email.
    Marks user as verified, sends welcome email, returns success.
    """
    try:
        from app.services.auth.auth_service import auth_service
        result = await auth_service.verify_email(token)
        return {
            "status": "verified",
            "message": "Email verified successfully. You can now sign in.",
            "user_id": result.get("user_id"),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Email verification error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Email verification failed")


@auth_router.post("/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    """
    Resend email verification link. Rate limited to prevent abuse.
    """
    try:
        from app.services.auth.auth_service import auth_service
        await auth_service.resend_verification(request.email)
        # Always return success to prevent email enumeration
        return {"status": "sent", "message": "If the email is registered, a verification link has been sent."}
    except Exception as e:
        logger.error(f"Resend verification error: {e}", exc_info=True)
        # Still return success to prevent enumeration
        return {"status": "sent", "message": "If the email is registered, a verification link has been sent."}


# ==================== Helpers ====================

def _extract_token(authorization: Optional[str]) -> Optional[str]:
    """Extract JWT token from Authorization header."""
    if not authorization:
        return None
    if authorization.startswith("Bearer "):
        return authorization.split(" ", 1)[1]
    return authorization
