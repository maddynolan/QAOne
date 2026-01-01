"""
Salesforce Metadata Validation API

Endpoints for:
- Connecting to Salesforce
- Fetching metadata
- Validating objects, fields, selectors
- Workflow validation
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/salesforce", tags=["salesforce"])


# ============================================================================
# Request/Response Models
# ============================================================================

class SalesforceConnectionRequest(BaseModel):
    username: str
    password: str
    security_token: str = ""
    domain: str = "login"  # "login" for prod, "test" for sandbox, or custom domain
    login_url: Optional[str] = None  # Full login URL for custom domains


class SalesforceConnectionResponse(BaseModel):
    connected: bool
    instance_url: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    id: Optional[str] = None
    error: Optional[str] = None


class SalesforceOAuthStartRequest(BaseModel):
    """Start OAuth browser flow"""
    domain: str = "login"  # "login", "test", or custom domain like "orgfam"
    

class SalesforceOAuthCallbackRequest(BaseModel):
    """Handle OAuth callback"""
    code: str
    state: Optional[str] = None


class FetchMetadataRequest(BaseModel):
    objects: Optional[List[str]] = None  # If None, fetches common objects


class ValidateObjectRequest(BaseModel):
    object_name: str


class ValidateFieldRequest(BaseModel):
    object_name: str
    field_name: str


class ValidatePicklistRequest(BaseModel):
    object_name: str
    field_name: str
    value: str


class ValidateSelectorRequest(BaseModel):
    selector: str


class ValidateWorkflowRequest(BaseModel):
    nodes: List[Dict[str, Any]]
    app_type: str = "salesforce"


class FieldSuggestionRequest(BaseModel):
    object_name: str
    partial: str
    limit: int = 10


class ObjectSuggestionRequest(BaseModel):
    partial: str
    limit: int = 10


# ============================================================================
# Connection Endpoints
# ============================================================================

@router.get("/status")
async def get_connection_status():
    """
    Get Salesforce connection and cache status.
    Returns both cache status AND current connection info from environment.
    """
    import os
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    cache_status = service.get_cache_status()
    
    # Also include current connection info from environment variables
    session_id = os.environ.get("SF_SESSION_ID", "")
    instance_url = os.environ.get("SF_INSTANCE_URL", "")
    username = os.environ.get("SF_USERNAME", "")
    domain = os.environ.get("SF_DOMAIN", "login")
    
    is_connected = bool(session_id and instance_url)
    
    return {
        **cache_status,
        "connected": is_connected,
        "instance_url": instance_url if is_connected else None,
        "access_token": session_id if is_connected else None,
        "username": username if is_connected else None,
        "domain": domain if is_connected else None,
    }


@router.post("/connect", response_model=SalesforceConnectionResponse)
async def connect_to_salesforce(request: SalesforceConnectionRequest):
    """
    Connect to a Salesforce org using simple-salesforce library.
    
    Supports:
    - Production (login.salesforce.com)
    - Sandbox (test.salesforce.com)  
    - Custom domains (mydomain.my.salesforce.com)
    - Developer editions
    """
    import os
    from simple_salesforce import Salesforce, SalesforceLogin
    from simple_salesforce.exceptions import SalesforceAuthenticationFailed
    
    logger.info(f"Attempting Salesforce login for user: {request.username}")
    logger.info(f"Domain: {request.domain}, Login URL: {request.login_url}")
    
    # Determine domain for simple-salesforce
    # simple-salesforce uses 'domain' parameter: 'login' for prod, 'test' for sandbox
    # For custom domains, use the full domain without .my.salesforce.com
    sf_domain = None
    instance_url_override = None
    
    if request.login_url and '.salesforce.com' in request.login_url:
        # Extract instance URL from provided URL
        instance_url_override = request.login_url.rstrip('/')
        if not instance_url_override.startswith('https://'):
            instance_url_override = f"https://{instance_url_override}"
        
        # For custom domains, we need to extract the domain part
        # e.g., https://orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com
        if '.develop.my.salesforce.com' in request.login_url:
            # Developer edition custom domain
            sf_domain = request.login_url.replace('https://', '').replace('http://', '').replace('.my.salesforce.com', '').rstrip('/')
        elif '.my.salesforce.com' in request.login_url:
            # Standard custom domain
            sf_domain = request.login_url.replace('https://', '').replace('http://', '').replace('.my.salesforce.com', '').rstrip('/')
    
    if not sf_domain:
        if request.domain in ["test", "sandbox"]:
            sf_domain = "test"
        else:
            sf_domain = "login"
    
    logger.info(f"Using domain: {sf_domain}")
    
    try:
        # Try connecting with simple-salesforce
        password_with_token = request.password + (request.security_token or "")
        
        # Try multiple authentication approaches
        sf = None
        last_error = None
        
        # Determine which domains to try based on org type
        domains_to_try = []
        if request.domain == "sandbox":
            domains_to_try = ["test", "login"]
        elif request.domain == "developer":
            # Developer editions typically use login.salesforce.com
            domains_to_try = ["login", "test"]
        else:
            domains_to_try = ["login", "test"]
        
        # Try with and without security token
        token_options = [request.security_token or "", ""]  # Try with token first, then without
        if not request.security_token:
            token_options = [""]  # Only try without if no token provided
        
        for try_domain in domains_to_try:
            for token in token_options:
                try:
                    token_status = "with token" if token else "without token"
                    logger.info(f"Trying authentication with domain: {try_domain}, {token_status}")
                    sf = Salesforce(
                        username=request.username,
                        password=request.password,
                        security_token=token,
                        domain=try_domain
                    )
                    logger.info(f"Success with domain: {try_domain}, {token_status}")
                    break  # Success!
                except SalesforceAuthenticationFailed as e:
                    last_error = str(e)
                    logger.warning(f"Login failed with domain {try_domain}, {token_status}: {last_error}")
                    continue
            if sf:
                break
        
        if sf is None:
            raise SalesforceAuthenticationFailed("", last_error or "Authentication failed")
        
        # Success! Extract session info
        instance_url = sf.sf_instance
        if not instance_url.startswith('https://'):
            instance_url = f"https://{instance_url}"
        
        session_id = sf.session_id
        
        # Store credentials for backend services
        os.environ["SF_USERNAME"] = request.username
        os.environ["SF_PASSWORD"] = request.password
        os.environ["SF_SECURITY_TOKEN"] = request.security_token or ""
        os.environ["SF_DOMAIN"] = request.domain
        os.environ["SF_SESSION_ID"] = session_id
        os.environ["SF_INSTANCE_URL"] = instance_url
        
        logger.info(f"Successfully connected to Salesforce: {instance_url}")
        
        return SalesforceConnectionResponse(
            connected=True,
            instance_url=instance_url,
            access_token=session_id,
            id=""
        )
        
    except SalesforceAuthenticationFailed as e:
        error_msg = str(e)
        logger.error(f"Salesforce authentication failed: {error_msg}")
        
        # Parse common error messages for user-friendly feedback
        if "INVALID_LOGIN" in error_msg:
            return SalesforceConnectionResponse(
                connected=False,
                error="Invalid username, password, or security token. Please check your credentials."
            )
        elif "API_DISABLED_FOR_ORG" in error_msg:
            return SalesforceConnectionResponse(
                connected=False,
                error="API access is disabled for this org. Please enable API access in Setup."
            )
        elif "INVALID_OPERATION_WITH_EXPIRED_PASSWORD" in error_msg:
            return SalesforceConnectionResponse(
                connected=False,
                error="Your password has expired. Please reset it in Salesforce."
            )
        else:
            return SalesforceConnectionResponse(
                connected=False,
                error=error_msg
            )
            
    except Exception as e:
        logger.error(f"Salesforce login error: {str(e)}")
        return SalesforceConnectionResponse(
            connected=False,
            error=str(e)
        )


@router.post("/disconnect")
async def disconnect_from_salesforce():
    """
    Disconnect from Salesforce org.
    """
    import os
    
    # Clear environment variables
    for key in ["SF_USERNAME", "SF_PASSWORD", "SF_SECURITY_TOKEN"]:
        if key in os.environ:
            del os.environ[key]
    
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._sf_client = None
    service.connected = False
    
    return {"disconnected": True}


# ============================================================================
# OAuth Browser Flow with PKCE (More Reliable than Username/Password)
# ============================================================================

import hashlib
import base64
import secrets as secrets_module

# Flowdev Connected App credentials (loaded from environment variables)
import os
OAUTH_CLIENT_ID = os.getenv("SALESFORCE_CLIENT_ID", "")
OAUTH_CLIENT_SECRET = os.getenv("SALESFORCE_CLIENT_SECRET", "")
OAUTH_CALLBACK_URL = os.getenv("SALESFORCE_CALLBACK_URL", "http://localhost:8000/api/salesforce/oauth/callback")

# Store pending OAuth sessions
_oauth_sessions = {}


def generate_pkce_pair():
    """Generate PKCE code_verifier and code_challenge pair."""
    # Generate a random code verifier (43-128 characters)
    code_verifier = secrets_module.token_urlsafe(64)[:128]
    
    # Create code challenge using SHA256
    code_challenge_digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(code_challenge_digest).decode('ascii').rstrip('=')
    
    return code_verifier, code_challenge


@router.get("/oauth/start")
async def start_oauth_flow(domain: str = "login", use_pkce: bool = True):
    """
    Start OAuth browser flow with PKCE support.
    
    Returns a URL that the user should open in their browser to authenticate.
    
    Args:
        domain: "login" for production, "test" for sandbox, or custom domain
        use_pkce: Whether to use PKCE (recommended)
    """
    logger.info(f"Starting OAuth flow for domain: {domain}, PKCE: {use_pkce}")
    
    # Generate state for CSRF protection
    state = secrets_module.token_urlsafe(32)
    
    # Generate PKCE pair
    code_verifier, code_challenge = generate_pkce_pair() if use_pkce else (None, None)
    
    # Determine the authorization URL
    if domain in ["login", "production"]:
        auth_base = "https://login.salesforce.com"
    elif domain in ["test", "sandbox"]:
        auth_base = "https://test.salesforce.com"
    elif ".develop" in domain:
        # Developer edition with .develop.my.salesforce.com format
        auth_base = f"https://{domain}.my.salesforce.com"
    elif "-dev-ed" in domain.lower():
        # Developer edition - use login.salesforce.com
        auth_base = "https://login.salesforce.com"
    else:
        # Custom domain
        auth_base = f"https://{domain}.my.salesforce.com"
    
    logger.info(f"Using auth base: {auth_base}")
    
    # Build authorization URL
    auth_url = (
        f"{auth_base}/services/oauth2/authorize"
        f"?response_type=code"
        f"&client_id={OAUTH_CLIENT_ID}"
        f"&redirect_uri={OAUTH_CALLBACK_URL}"
        f"&state={state}"
        f"&prompt=login"
    )
    
    # Add PKCE parameters if enabled
    if use_pkce and code_challenge:
        auth_url += f"&code_challenge={code_challenge}"
        auth_url += "&code_challenge_method=S256"
    
    # Store session info including PKCE verifier
    _oauth_sessions[state] = {
        "domain": domain,
        "auth_base": auth_base,
        "code_verifier": code_verifier,  # Needed to exchange the code
        "use_pkce": use_pkce,
        "created": __import__("time").time()
    }
    
    logger.info(f"OAuth flow started for domain: {domain}, PKCE: {use_pkce}")
    
    return {
        "auth_url": auth_url,
        "state": state,
        "instructions": "Open this URL in your browser to authenticate with Salesforce"
    }


@router.get("/oauth/callback")
async def oauth_callback(code: str = None, state: str = None, error: str = None, error_description: str = None):
    """
    Handle OAuth callback from Salesforce.
    
    This endpoint receives the authorization code after user authenticates.
    """
    import os
    import httpx
    
    if error:
        logger.error(f"OAuth error: {error} - {error_description}")
        # Return HTML page showing error
        return HTMLResponse(f"""
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">❌ Authentication Failed</h1>
            <p>{error_description or error}</p>
            <p>You can close this window and try again.</p>
        </body>
        </html>
        """)
    
    if not code or not state:
        return HTMLResponse("""
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">❌ Missing Parameters</h1>
            <p>Authorization code or state is missing.</p>
        </body>
        </html>
        """)
    
    # Verify state
    session = _oauth_sessions.get(state)
    if not session:
        return HTMLResponse("""
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">❌ Invalid Session</h1>
            <p>Session expired or invalid. Please try again.</p>
        </body>
        </html>
        """)
    
    # Exchange code for access token
    token_url = f"{session['auth_base']}/services/oauth2/token"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Build token request data
            token_data = {
                "grant_type": "authorization_code",
                "code": code,
                "client_id": OAUTH_CLIENT_ID,
                "client_secret": OAUTH_CLIENT_SECRET,
                "redirect_uri": OAUTH_CALLBACK_URL
            }
            
            # Add PKCE code_verifier if this was a PKCE flow
            if session.get("use_pkce") and session.get("code_verifier"):
                token_data["code_verifier"] = session["code_verifier"]
                logger.info("Using PKCE code_verifier for token exchange")
            
            response = await client.post(token_url, data=token_data)
            
            if response.status_code != 200:
                error_data = response.json()
                logger.error(f"Token exchange failed: {error_data}")
                return HTMLResponse(f"""
                <html>
                <head><title>Authentication Failed</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1 style="color: #dc2626;">❌ Token Exchange Failed</h1>
                    <p>{error_data.get('error_description', 'Unknown error')}</p>
                </body>
                </html>
                """)
            
            token_data = response.json()
            
            # Store credentials
            os.environ["SF_SESSION_ID"] = token_data.get("access_token", "")
            os.environ["SF_INSTANCE_URL"] = token_data.get("instance_url", "")
            
            # Update session with token info
            _oauth_sessions[state] = {
                **session,
                "access_token": token_data.get("access_token"),
                "instance_url": token_data.get("instance_url"),
                "refresh_token": token_data.get("refresh_token"),
                "id": token_data.get("id"),
                "completed": True
            }
            
            logger.info(f"OAuth successful! Instance: {token_data.get('instance_url')}")
            
            # Return success HTML
            return HTMLResponse(f"""
            <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #0f172a; color: white;">
                <h1 style="color: #22c55e;">✅ Connected to Salesforce!</h1>
                <p>Instance: {token_data.get('instance_url')}</p>
                <p style="margin-top: 20px;">You can close this window and return to the app.</p>
                <script>
                    // Notify parent window if in popup
                    if (window.opener) {{
                        window.opener.postMessage({{
                            type: 'SALESFORCE_AUTH_SUCCESS',
                            instanceUrl: '{token_data.get("instance_url")}',
                            state: '{state}'
                        }}, '*');
                    }}
                </script>
            </body>
            </html>
            """)
            
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        return HTMLResponse(f"""
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #dc2626;">❌ Error</h1>
            <p>{str(e)}</p>
        </body>
        </html>
        """)
    finally:
        # Clean up old sessions (older than 10 minutes)
        import time
        current_time = time.time()
        expired = [s for s, d in _oauth_sessions.items() if current_time - d.get("created", 0) > 600]
        for s in expired:
            del _oauth_sessions[s]


@router.get("/oauth/status/{state}")
async def get_oauth_status(state: str):
    """
    Check the status of an OAuth flow.
    
    Frontend can poll this to know when authentication is complete.
    """
    session = _oauth_sessions.get(state)
    
    if not session:
        return {"status": "not_found"}
    
    if session.get("completed"):
        return {
            "status": "completed",
            "instance_url": session.get("instance_url"),
            "access_token": session.get("access_token"),
            "refresh_token": session.get("refresh_token"),
            "id": session.get("id")
        }
    
    return {"status": "pending"}


# ============================================================================
# Proxy Endpoint for Direct Salesforce API Calls
# ============================================================================

class SalesforceProxyRequest(BaseModel):
    """Proxy request to Salesforce API"""
    instance_url: str
    access_token: str
    endpoint: str  # e.g., /services/data/v59.0/query?q=SELECT...
    method: str = "GET"
    body: Optional[Dict[str, Any]] = None


@router.post("/proxy")
async def proxy_salesforce_request(request: SalesforceProxyRequest):
    """
    Proxy requests to Salesforce API to avoid CORS issues.
    
    The frontend sends the instance URL, access token, and desired endpoint,
    and this backend makes the actual request to Salesforce.
    """
    import httpx
    
    # Build the full URL
    full_url = f"{request.instance_url.rstrip('/')}{request.endpoint}"
    
    headers = {
        "Authorization": f"Bearer {request.access_token}",
        "Content-Type": "application/json",
    }
    
    logger.info(f"Proxying {request.method} request to: {full_url}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            if request.method.upper() == "GET":
                response = await client.get(full_url, headers=headers)
            elif request.method.upper() == "POST":
                response = await client.post(full_url, headers=headers, json=request.body)
            elif request.method.upper() == "PATCH":
                response = await client.patch(full_url, headers=headers, json=request.body)
            elif request.method.upper() == "DELETE":
                response = await client.delete(full_url, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {request.method}")
            
            # Return the response
            try:
                return {
                    "status": response.status_code,
                    "data": response.json() if response.text else None,
                    "success": response.status_code < 400
                }
            except:
                return {
                    "status": response.status_code,
                    "data": response.text,
                    "success": response.status_code < 400
                }
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Salesforce timed out")
    except Exception as e:
        logger.error(f"Proxy error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class AutoProxyRequest(BaseModel):
    """Request for auto-authenticated proxy - no token needed from client"""
    endpoint: str  # e.g., /sobjects or /query?q=SELECT...
    method: str = "GET"
    body: Optional[Dict[str, Any]] = None


@router.post("/auto-proxy")
async def auto_proxy_salesforce_request(request: AutoProxyRequest):
    """
    Auto-authenticated proxy - gets token automatically from backend auth service.
    
    This is the recommended endpoint for parallel/CI/CD scenarios.
    The client just specifies what API endpoint to call, and the backend handles auth.
    """
    import httpx
    
    # Get token from auth service
    try:
        from app.services.salesforce.auth_service import get_auth_service
        auth_service = get_auth_service()
        token = await auth_service.get_token()
        
        instance_url = auth_service.get_org().instance_url
        access_token = token.access_token
    except Exception as e:
        logger.error(f"Auto-auth failed: {e}")
        raise HTTPException(status_code=401, detail=f"Salesforce authentication failed: {str(e)}")
    
    # Build the full URL
    endpoint = request.endpoint
    if not endpoint.startswith('/services'):
        endpoint = f"/services/data/v59.0{endpoint}"
    
    full_url = f"{instance_url.rstrip('/')}{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    logger.info(f"Auto-proxying {request.method} request to: {full_url}")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            if request.method.upper() == "GET":
                response = await client.get(full_url, headers=headers)
            elif request.method.upper() == "POST":
                response = await client.post(full_url, headers=headers, json=request.body)
            elif request.method.upper() == "PATCH":
                response = await client.patch(full_url, headers=headers, json=request.body)
            elif request.method.upper() == "DELETE":
                response = await client.delete(full_url, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {request.method}")
            
            # Return the response
            try:
                return {
                    "status": response.status_code,
                    "data": response.json() if response.text else None,
                    "success": response.status_code < 400,
                    "instance_url": instance_url  # Include for reference
                }
            except:
                return {
                    "status": response.status_code,
                    "data": response.text,
                    "success": response.status_code < 400,
                    "instance_url": instance_url
                }
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Salesforce timed out")
    except Exception as e:
        logger.error(f"Auto-proxy error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query")
async def execute_soql_query_proxy(
    instance_url: str,
    access_token: str,
    query: str
):
    """
    Execute a SOQL query via proxy.
    """
    import httpx
    
    encoded_query = query.replace(" ", "+")
    full_url = f"{instance_url.rstrip('/')}/services/data/v59.0/query?q={encoded_query}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    logger.info(f"Executing SOQL query: {query[:100]}...")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(full_url, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                error_text = response.text
                logger.error(f"SOQL query failed: {error_text}")
                raise HTTPException(status_code=response.status_code, detail=error_text)
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Query timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Query error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Metadata Endpoints
# ============================================================================

@router.post("/metadata/fetch")
async def fetch_metadata(
    request: FetchMetadataRequest,
    background_tasks: BackgroundTasks
):
    """
    Fetch metadata from Salesforce org.
    
    This is a potentially long-running operation, so it can run in background.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    
    if not service.is_connected():
        raise HTTPException(
            status_code=400,
            detail="Not connected to Salesforce. Call /connect first."
        )
    
    # Fetch synchronously for now (could be background task)
    result = await service.fetch_org_metadata(request.objects)
    
    return result


@router.get("/metadata/objects")
async def list_cached_objects():
    """
    List all objects in the metadata cache.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    objects = []
    for obj_name, obj_data in service._objects_cache.items():
        objects.append({
            "name": obj_name,
            "label": obj_data.get("label", obj_name),
            "custom": obj_data.get("custom", obj_name.endswith("__c")),
            "fields_count": len(obj_data.get("fields", {})),
            "record_types_count": len(obj_data.get("record_types", []))
        })
    
    return {
        "objects": objects,
        "total": len(objects)
    }


@router.get("/metadata/objects/{object_name}")
async def get_object_metadata(object_name: str):
    """
    Get detailed metadata for a specific object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    if object_name not in service._objects_cache:
        raise HTTPException(
            status_code=404,
            detail=f"Object '{object_name}' not in cache. Fetch metadata first."
        )
    
    return service._objects_cache[object_name]


@router.get("/metadata/objects/{object_name}/fields")
async def get_object_fields(object_name: str):
    """
    Get all fields for a specific object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    service._load_cache()
    
    if object_name not in service._fields_cache:
        # Return standard fields as fallback
        from app.services.salesforce.metadata_service import STANDARD_FIELDS
        return {
            "object": object_name,
            "fields": [{"name": f, "label": f, "type": "unknown"} for f in STANDARD_FIELDS],
            "cached": False
        }
    
    fields = []
    for name, data in service._fields_cache[object_name].items():
        fields.append({
            "name": name,
            "label": data.get("label", name),
            "type": data.get("type", "unknown"),
            "required": data.get("required", False),
            "custom": data.get("custom", name.endswith("__c")),
            "picklist": bool(data.get("picklistValues"))
        })
    
    return {
        "object": object_name,
        "fields": fields,
        "cached": True
    }


# ============================================================================
# Validation Endpoints
# ============================================================================

@router.post("/validate/object")
async def validate_object(request: ValidateObjectRequest):
    """
    Validate a Salesforce object API name.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_object(request.object_name)


@router.post("/validate/field")
async def validate_field(request: ValidateFieldRequest):
    """
    Validate a field API name for a given object.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_field(request.object_name, request.field_name)


@router.post("/validate/picklist")
async def validate_picklist(request: ValidatePicklistRequest):
    """
    Validate a picklist value.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_picklist_value(
        request.object_name,
        request.field_name,
        request.value
    )


@router.post("/validate/selector")
async def validate_selector(request: ValidateSelectorRequest):
    """
    Validate a Salesforce selector pattern.
    
    Extracts and validates field/object references from the selector.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    return service.validate_selector(request.selector)


@router.post("/validate/workflow")
async def validate_workflow(request: ValidateWorkflowRequest):
    """
    Validate an entire workflow for Salesforce metadata.
    
    Returns comprehensive validation report including:
    - Per-step validation
    - Field/object references
    - Invalid selectors
    - Suggestions for fixes
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    
    workflow = {
        "nodes": request.nodes,
        "app_type": request.app_type
    }
    
    return service.validate_workflow(workflow)


# ============================================================================
# Autocomplete Endpoints
# ============================================================================

@router.post("/suggest/fields")
async def suggest_fields(request: FieldSuggestionRequest):
    """
    Get field suggestions for autocomplete.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    suggestions = service.get_field_suggestions(
        request.object_name,
        request.partial,
        request.limit
    )
    
    return {"suggestions": suggestions}


@router.post("/suggest/objects")
async def suggest_objects(request: ObjectSuggestionRequest):
    """
    Get object suggestions for autocomplete.
    """
    from app.services.salesforce.metadata_service import get_metadata_service
    
    service = get_metadata_service()
    suggestions = service.get_object_suggestions(
        request.partial,
        request.limit
    )
    
    return {"suggestions": suggestions}


# ============================================================================
# SOQL Endpoints
# ============================================================================

class SOQLQueryRequest(BaseModel):
    query: str
    parameters: Optional[Dict[str, Any]] = None


class SOQLAssertionRequest(BaseModel):
    query: str
    expected_count: int
    parameters: Optional[Dict[str, Any]] = None


@router.post("/soql/query")
async def execute_soql_query(request: SOQLQueryRequest):
    """
    Execute a SOQL query against the connected Salesforce org.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    return await service.execute_query(request.query, request.parameters)


@router.post("/soql/assert")
async def execute_soql_assertion(request: SOQLAssertionRequest):
    """
    Execute a SOQL query and validate record count for test assertions.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    return await service.validate_assertion(
        request.query,
        request.expected_count,
        request.parameters
    )


@router.post("/soql/generate-code")
async def generate_soql_code(request: SOQLAssertionRequest):
    """
    Generate assertion code for a SOQL query.
    """
    from app.services.salesforce.soql_service import get_soql_service
    
    service = get_soql_service()
    
    return {
        "python": service.generate_assertion_code(request.query, request.expected_count, "python"),
        "java": service.generate_assertion_code(request.query, request.expected_count, "java"),
        "typescript": service.generate_assertion_code(request.query, request.expected_count, "typescript")
    }












