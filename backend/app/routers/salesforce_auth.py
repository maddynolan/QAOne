"""
Salesforce Authentication API Router

Endpoints for managing Salesforce authentication in parallel test execution environments.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

from app.services.salesforce.auth_service import (
    get_auth_service, 
    SalesforceAuthService,
    SalesforceOrg,
    SalesforceToken,
    TokenPool
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/salesforce/auth", tags=["salesforce-auth"])

# Global token pool for parallel execution
_token_pool: Optional[TokenPool] = None


# ============================================================================
# Request/Response Models
# ============================================================================

class OrgConfigRequest(BaseModel):
    """Request to configure a Salesforce org"""
    name: str = Field(..., description="Unique name for this org")
    instance_url: str = Field(..., description="Salesforce instance URL")
    login_url: str = Field(default="https://login.salesforce.com")
    
    # OAuth credentials
    client_id: str = Field(..., description="Connected App Client ID")
    client_secret: Optional[str] = Field(default=None, description="Connected App Client Secret")
    
    # Authentication method - provide ONE of these
    username: Optional[str] = Field(default=None, description="Username for JWT/Password flow")
    private_key: Optional[str] = Field(default=None, description="PEM-encoded private key for JWT flow")
    refresh_token: Optional[str] = Field(default=None, description="OAuth refresh token")
    password: Optional[str] = Field(default=None, description="Password for legacy auth")
    security_token: Optional[str] = Field(default=None, description="Security token for password flow")


class TokenResponse(BaseModel):
    """Response containing an access token"""
    access_token: str
    instance_url: str
    token_type: str = "Bearer"
    expires_in: int = Field(..., description="Seconds until token expires")
    issued_at: float
    

class OrgInfoResponse(BaseModel):
    """Information about a configured org"""
    name: str
    instance_url: str
    login_url: str
    has_token: bool
    token_expires_in: Optional[int] = None
    auth_method: str


class TokenPoolStatus(BaseModel):
    """Status of the token pool"""
    pool_size: int
    available_tokens: int
    total_acquisitions: int
    org_name: str


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/status")
async def get_auth_status():
    """
    Get the current authentication status.
    Shows configured orgs and their token status.
    """
    auth_service = get_auth_service()
    
    orgs_info = []
    for org_name in auth_service.list_orgs():
        org = auth_service.get_org(org_name)
        
        auth_method = "none"
        if org.private_key or org.private_key_path:
            auth_method = "jwt_bearer"
        elif org.refresh_token:
            auth_method = "refresh_token"
        elif org.username and org.password:
            auth_method = "password"
        
        orgs_info.append({
            "name": org.name,
            "instance_url": org.instance_url,
            "login_url": org.login_url,
            "has_token": org.current_token is not None,
            "token_expires_in": org.current_token.time_remaining if org.current_token else None,
            "auth_method": auth_method,
            "is_default": org_name == auth_service.default_org,
        })
    
    return {
        "configured_orgs": orgs_info,
        "default_org": auth_service.default_org,
        "token_pool_active": _token_pool is not None,
    }


@router.post("/configure")
async def configure_org(config: OrgConfigRequest):
    """
    Configure a Salesforce org for authentication.
    
    Supports three authentication methods:
    1. JWT Bearer Flow (recommended): Provide client_id, username, private_key
    2. Refresh Token Flow: Provide client_id, client_secret, refresh_token
    3. Password Flow (legacy): Provide client_id, username, password, security_token
    """
    auth_service = get_auth_service()
    
    org = SalesforceOrg(
        name=config.name,
        instance_url=config.instance_url,
        login_url=config.login_url,
        client_id=config.client_id,
        client_secret=config.client_secret,
        username=config.username,
        private_key=config.private_key,
        refresh_token=config.refresh_token,
        password=config.password,
        security_token=config.security_token,
    )
    
    auth_service.add_org(org)
    
    # Determine auth method
    auth_method = "none"
    if config.private_key:
        auth_method = "jwt_bearer"
    elif config.refresh_token:
        auth_method = "refresh_token"
    elif config.username and config.password:
        auth_method = "password"
    
    return {
        "success": True,
        "org_name": config.name,
        "auth_method": auth_method,
        "message": f"Org '{config.name}' configured successfully"
    }


@router.post("/token")
async def get_access_token(org_name: Optional[str] = None):
    """
    Get an access token for a configured org.
    
    This endpoint handles token acquisition and refresh automatically.
    Use this for single-instance test execution.
    
    For parallel execution, use the /pool endpoints instead.
    """
    auth_service = get_auth_service()
    
    try:
        token = await auth_service.get_token(org_name)
        return TokenResponse(
            access_token=token.access_token,
            instance_url=token.instance_url,
            token_type=token.token_type,
            expires_in=token.time_remaining,
            issued_at=token.issued_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Token acquisition failed: {e}")
        raise HTTPException(status_code=500, detail=f"Token acquisition failed: {str(e)}")


@router.post("/token/validate")
async def validate_token(access_token: str, instance_url: str):
    """
    Validate that an access token is still valid.
    """
    auth_service = get_auth_service()
    
    token = SalesforceToken(
        access_token=access_token,
        instance_url=instance_url,
    )
    
    is_valid = await auth_service.validate_token(token)
    
    return {
        "valid": is_valid,
        "message": "Token is valid" if is_valid else "Token is invalid or expired"
    }


# ============================================================================
# Token Pool Endpoints (for parallel execution)
# ============================================================================

@router.post("/pool/initialize")
async def initialize_token_pool(pool_size: int = 5, org_name: Optional[str] = None):
    """
    Initialize a token pool for parallel test execution.
    
    Call this once before starting parallel tests. The pool will:
    - Pre-warm the specified number of tokens
    - Distribute tokens across test runners
    - Handle automatic refresh
    
    Args:
        pool_size: Number of tokens to maintain in the pool
        org_name: Name of the org to use (default org if not specified)
    """
    global _token_pool
    
    auth_service = get_auth_service()
    
    _token_pool = TokenPool(
        auth_service=auth_service,
        pool_size=pool_size,
        org_name=org_name,
    )
    
    try:
        await _token_pool.initialize()
        return {
            "success": True,
            "pool_size": pool_size,
            "available_tokens": _token_pool.available_count,
            "message": f"Token pool initialized with {_token_pool.available_count} tokens"
        }
    except Exception as e:
        _token_pool = None
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to initialize token pool: {str(e)}"
        )


@router.get("/pool/status")
async def get_pool_status():
    """
    Get the current status of the token pool.
    """
    if _token_pool is None:
        return {
            "active": False,
            "message": "Token pool not initialized. Call /pool/initialize first."
        }
    
    return {
        "active": True,
        "pool_size": _token_pool.pool_size,
        "available_tokens": _token_pool.available_count,
        "total_acquisitions": _token_pool.token_index,
        "org_name": _token_pool.org_name or "default",
    }


@router.post("/pool/acquire")
async def acquire_token_from_pool():
    """
    Acquire a token from the pool.
    
    Use this endpoint from parallel test runners to get tokens.
    Tokens are distributed round-robin for load balancing.
    """
    if _token_pool is None:
        raise HTTPException(
            status_code=400,
            detail="Token pool not initialized. Call /pool/initialize first."
        )
    
    try:
        token = await _token_pool.acquire()
        return TokenResponse(
            access_token=token.access_token,
            instance_url=token.instance_url,
            token_type=token.token_type,
            expires_in=token.time_remaining,
            issued_at=token.issued_at,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pool/shutdown")
async def shutdown_token_pool():
    """
    Shutdown the token pool.
    Call this after parallel tests complete.
    """
    global _token_pool
    
    if _token_pool is None:
        return {"success": True, "message": "Token pool was not active"}
    
    _token_pool = None
    return {"success": True, "message": "Token pool shutdown complete"}


# ============================================================================
# Org Management
# ============================================================================

@router.get("/orgs")
async def list_orgs():
    """
    List all configured Salesforce orgs.
    """
    auth_service = get_auth_service()
    return {
        "orgs": auth_service.list_orgs(),
        "default": auth_service.default_org,
    }


@router.post("/orgs/{org_name}/set-default")
async def set_default_org(org_name: str):
    """
    Set the default Salesforce org.
    """
    auth_service = get_auth_service()
    
    try:
        auth_service.set_default_org(org_name)
        return {"success": True, "default_org": org_name}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/orgs/{org_name}")
async def remove_org(org_name: str):
    """
    Remove a configured org.
    """
    auth_service = get_auth_service()
    
    if org_name not in auth_service.orgs:
        raise HTTPException(status_code=404, detail=f"Org '{org_name}' not found")
    
    del auth_service.orgs[org_name]
    
    if auth_service.default_org == org_name:
        auth_service.default_org = next(iter(auth_service.orgs.keys()), None)
    
    return {"success": True, "message": f"Org '{org_name}' removed"}

