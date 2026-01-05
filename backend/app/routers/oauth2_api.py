"""
OAuth 2.0 Authentication API
Endpoints for managing OAuth2 configurations and tokens
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum

from app.services.api_testing.oauth2_authenticator import (
    get_oauth2_authenticator,
    OAuth2Config,
    OAuth2GrantType,
    TokenLocation
)

router = APIRouter(prefix="/api/oauth2", tags=["oauth2-authentication"])


class GrantTypeEnum(str, Enum):
    authorization_code = "authorization_code"
    client_credentials = "client_credentials"
    password = "password"
    implicit = "implicit"


class TokenLocationEnum(str, Enum):
    header = "header"
    query = "query"
    body = "body"


class OAuth2ConfigRequest(BaseModel):
    """Request to create OAuth2 configuration"""
    config_id: str
    name: str
    grant_type: GrantTypeEnum
    
    # Endpoints
    authorization_url: Optional[str] = None
    token_url: str
    
    # Client credentials
    client_id: str
    client_secret: Optional[str] = None
    
    # Resource owner credentials (password grant)
    username: Optional[str] = None
    password: Optional[str] = None
    
    # Scopes and audience
    scopes: List[str] = []
    audience: Optional[str] = None
    
    # Token settings
    token_location: TokenLocationEnum = TokenLocationEnum.header
    header_name: str = "Authorization"
    header_prefix: str = "Bearer"
    
    # PKCE settings
    use_pkce: bool = False
    code_challenge_method: str = "S256"
    
    # Advanced
    redirect_uri: Optional[str] = None
    additional_params: Dict[str, str] = {}


class ExchangeCodeRequest(BaseModel):
    """Request to exchange authorization code for token"""
    authorization_code: str
    redirect_uri: Optional[str] = None


@router.post("/configs")
async def create_oauth2_config(request: OAuth2ConfigRequest):
    """
    Create a new OAuth2 configuration
    
    Supports:
    - Client Credentials Flow (server-to-server)
    - Password Flow (legacy apps)
    - Authorization Code Flow (user authorization)
    - Authorization Code + PKCE (mobile/SPA apps)
    """
    auth = get_oauth2_authenticator()
    
    config = OAuth2Config(
        config_id=request.config_id,
        name=request.name,
        grant_type=OAuth2GrantType(request.grant_type.value),
        authorization_url=request.authorization_url,
        token_url=request.token_url,
        client_id=request.client_id,
        client_secret=request.client_secret,
        username=request.username,
        password=request.password,
        scopes=request.scopes,
        audience=request.audience,
        token_location=TokenLocation(request.token_location.value),
        header_name=request.header_name,
        header_prefix=request.header_prefix,
        use_pkce=request.use_pkce,
        code_challenge_method=request.code_challenge_method,
        redirect_uri=request.redirect_uri,
        additional_params=request.additional_params
    )
    
    auth.add_config(config)
    
    return {
        "status": "success",
        "message": f"OAuth2 config '{request.name}' created",
        "config_id": request.config_id,
        "grant_type": request.grant_type.value
    }


@router.get("/configs")
async def list_oauth2_configs():
    """List all OAuth2 configurations"""
    auth = get_oauth2_authenticator()
    configs = auth.list_configs()
    
    return {
        "status": "success",
        "configs": configs
    }


@router.get("/configs/{config_id}")
async def get_oauth2_config(config_id: str):
    """Get OAuth2 configuration details"""
    auth = get_oauth2_authenticator()
    config = auth.get_config(config_id)
    
    if not config:
        raise HTTPException(status_code=404, detail=f"Config not found: {config_id}")
    
    return {
        "status": "success",
        "config": {
            "config_id": config.config_id,
            "name": config.name,
            "grant_type": config.grant_type.value,
            "token_url": config.token_url,
            "authorization_url": config.authorization_url,
            "client_id": config.client_id,
            "scopes": config.scopes,
            "use_pkce": config.use_pkce
        }
    }


@router.delete("/configs/{config_id}")
async def delete_oauth2_config(config_id: str):
    """Delete an OAuth2 configuration"""
    auth = get_oauth2_authenticator()
    auth.remove_config(config_id)
    
    return {
        "status": "success",
        "message": f"Config {config_id} deleted"
    }


@router.post("/token/{config_id}")
async def get_oauth2_token(config_id: str, force_refresh: bool = False):
    """
    Get OAuth2 token for a configuration
    
    - Automatically obtains new token if none exists
    - Refreshes token if expired (using refresh_token if available)
    - Returns cached token if still valid
    
    Use force_refresh=true to always get a new token
    """
    auth = get_oauth2_authenticator()
    
    try:
        token = await auth.get_token(config_id, force_refresh=force_refresh)
        
        if not token:
            raise HTTPException(status_code=400, detail="Failed to obtain token")
        
        return {
            "status": "success",
            "token": {
                "access_token": token.access_token[:20] + "...",  # Truncate for security
                "token_type": token.token_type,
                "expires_in": token.expires_in,
                "expires_at": token.expires_at.isoformat() if token.expires_at else None,
                "has_refresh_token": bool(token.refresh_token),
                "scope": token.scope,
                "is_expired": token.is_expired()
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authorization-url/{config_id}")
async def get_authorization_url(config_id: str, state: Optional[str] = None):
    """
    Get authorization URL for Authorization Code flow
    
    Returns URL that user must visit to authorize the application.
    After authorization, user is redirected to redirect_uri with code.
    """
    auth = get_oauth2_authenticator()
    
    try:
        url = auth.get_authorization_url(config_id, state)
        
        return {
            "status": "success",
            "authorization_url": url,
            "instructions": "Redirect user to this URL. After authorization, exchange the code using POST /oauth2/exchange/{config_id}"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/exchange/{config_id}")
async def exchange_authorization_code(config_id: str, request: ExchangeCodeRequest):
    """
    Exchange authorization code for tokens
    
    Use this after user completes authorization and you receive the code.
    """
    auth = get_oauth2_authenticator()
    
    try:
        token = await auth.exchange_code_for_token(
            config_id=config_id,
            authorization_code=request.authorization_code,
            redirect_uri=request.redirect_uri
        )
        
        if not token:
            raise HTTPException(status_code=400, detail="Code exchange failed")
        
        return {
            "status": "success",
            "message": "Authorization code exchanged successfully",
            "token": {
                "access_token": token.access_token[:20] + "...",
                "token_type": token.token_type,
                "expires_in": token.expires_in,
                "has_refresh_token": bool(token.refresh_token)
            }
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/headers/{config_id}")
async def get_auth_headers(config_id: str):
    """
    Get authorization headers for a configuration
    
    Use these headers in your API requests.
    Automatically includes the current valid token.
    """
    auth = get_oauth2_authenticator()
    
    # Ensure we have a valid token
    token = await auth.get_token(config_id)
    if not token:
        raise HTTPException(status_code=400, detail="No valid token available")
    
    headers = auth.get_auth_headers(config_id)
    query_params = auth.get_query_params(config_id)
    
    return {
        "status": "success",
        "headers": headers,
        "query_params": query_params
    }


@router.post("/clear/{config_id}")
async def clear_token(config_id: str):
    """Clear stored token for a configuration"""
    auth = get_oauth2_authenticator()
    auth.clear_token(config_id)
    
    return {
        "status": "success",
        "message": f"Token cleared for {config_id}"
    }


@router.get("/comparison")
async def compare_with_readyapi():
    """
    How QAAI OAuth2 compares to ReadyAPI/Postman
    """
    return {
        "title": "QAAI OAuth2 Authentication",
        "features": {
            "grant_types": {
                "client_credentials": "✅ Server-to-server authentication",
                "password": "✅ Resource owner password (legacy)",
                "authorization_code": "✅ Standard user authorization",
                "authorization_code_pkce": "✅ Mobile/SPA apps (more secure)",
                "implicit": "🔜 Coming soon (deprecated flow)"
            },
            "token_management": {
                "automatic_refresh": "✅ Tokens refreshed before expiry",
                "token_caching": "✅ Valid tokens reused",
                "multiple_configs": "✅ Store many OAuth2 configs",
                "header_injection": "✅ Auto-add Authorization header",
                "query_param_token": "✅ Token in URL if needed"
            },
            "security": {
                "pkce_support": "✅ Proof Key for Code Exchange",
                "token_truncation": "✅ Tokens hidden in responses",
                "secure_storage": "✅ In-memory token storage"
            },
            "comparison_to_readyapi": "Feature parity achieved for all common OAuth2 flows"
        },
        "example_usage": {
            "step_1": "POST /api/oauth2/configs - Create configuration",
            "step_2": "POST /api/oauth2/token/{config_id} - Get token",
            "step_3": "GET /api/oauth2/headers/{config_id} - Get auth headers",
            "step_4": "Use headers in your API test requests"
        }
    }

