"""
Salesforce Metadata Validation API

Endpoints for:
- Connecting to Salesforce
- Fetching metadata
- Validating objects, fields, selectors
- Workflow validation
- Auto-reconnect on startup using saved credentials
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
import json
import os
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/salesforce", tags=["salesforce"])

# Path to saved credentials
CREDENTIALS_FILE = Path(__file__).parent.parent.parent / "config" / "salesforce_credentials.json"


# ============================================================================
# Salesforce Client Helper
# ============================================================================

def get_salesforce_client():
    """
    Get a connected Salesforce client using stored credentials.
    Returns None if not connected.
    """
    from simple_salesforce import Salesforce
    
    session_id = os.environ.get("SF_SESSION_ID")
    instance_url = os.environ.get("SF_INSTANCE_URL")
    
    if not session_id or not instance_url:
        # Try to load from credentials file
        if CREDENTIALS_FILE.exists():
            try:
                with open(CREDENTIALS_FILE, "r") as f:
                    creds = json.load(f)
                session_id = creds.get("access_token")
                instance_url = creds.get("instance_url")
            except Exception as e:
                logger.error(f"Failed to load credentials: {e}")
                return None
    
    if not session_id or not instance_url:
        logger.warning("No Salesforce credentials available")
        return None
    
    try:
        # Ensure instance_url is properly formatted
        if not instance_url.startswith("https://"):
            instance_url = f"https://{instance_url}"
        
        sf = Salesforce(instance_url=instance_url, session_id=session_id)
        return sf
    except Exception as e:
        logger.error(f"Failed to create Salesforce client: {e}")
        return None


# ============================================================================
# Auto-Reconnect Functions (Persist across restarts)
# ============================================================================

async def auto_connect_salesforce() -> dict:
    """
    Automatically connect to Salesforce using saved credentials.
    Called on backend startup to restore connection after restart.
    
    Uses refresh token to get a new access token if available.
    """
    import httpx
    
    if not CREDENTIALS_FILE.exists():
        logger.info("No saved Salesforce credentials found - skipping auto-connect")
        return {"connected": False, "reason": "no_credentials"}
    
    try:
        with open(CREDENTIALS_FILE, "r") as f:
            creds = json.load(f)
        
        refresh_token = creds.get("refresh_token")
        client_id = creds.get("client_id")
        client_secret = creds.get("client_secret")
        instance_url = creds.get("instance_url", "")
        
        if not refresh_token or not client_id:
            logger.warning("Missing refresh_token or client_id in saved credentials")
            return {"connected": False, "reason": "incomplete_credentials"}
        
        # Determine token endpoint from instance URL
        # For custom domains like orgfarm-xxx.develop.my.salesforce.com
        if ".develop.my.salesforce.com" in instance_url:
            # Developer edition - use login.salesforce.com for token refresh
            token_url = "https://login.salesforce.com/services/oauth2/token"
        elif ".sandbox.my.salesforce.com" in instance_url or "test.salesforce.com" in instance_url:
            token_url = "https://test.salesforce.com/services/oauth2/token"
        else:
            token_url = "https://login.salesforce.com/services/oauth2/token"
        
        logger.info(f"Attempting Salesforce auto-connect using refresh token...")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                token_url,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret or "",
                }
            )
            
            if response.status_code == 200:
                token_data = response.json()
                new_access_token = token_data.get("access_token", "")
                new_instance_url = token_data.get("instance_url", instance_url)
                
                # Store in environment variables
                os.environ["SF_SESSION_ID"] = new_access_token
                os.environ["SF_INSTANCE_URL"] = new_instance_url
                os.environ["SF_USERNAME"] = creds.get("username", "")
                
                # Update saved credentials with new access token
                creds["access_token"] = new_access_token
                creds["instance_url"] = new_instance_url
                
                # If new refresh token was issued, update it too
                if token_data.get("refresh_token"):
                    creds["refresh_token"] = token_data["refresh_token"]
                
                with open(CREDENTIALS_FILE, "w") as f:
                    json.dump(creds, f, indent=4)
                
                logger.info(f"[OK] Salesforce auto-connect successful! Instance: {new_instance_url}")
                return {
                    "connected": True,
                    "instance_url": new_instance_url,
                    "username": creds.get("username", ""),
                    "org_name": creds.get("org_name", "")
                }
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                logger.warning(f"Refresh token failed: {error_data}")
                
                # If refresh token is invalid, clear the session
                if "invalid_grant" in str(error_data).lower():
                    logger.warning("Refresh token expired - you'll need to re-authenticate via OAuth")
                    return {"connected": False, "reason": "refresh_token_expired", "error": str(error_data)}
                
                return {"connected": False, "reason": "token_refresh_failed", "error": str(error_data)}
                
    except Exception as e:
        logger.error(f"Salesforce auto-connect error: {str(e)}")
        return {"connected": False, "reason": "error", "error": str(e)}


def save_credentials_to_file(
    access_token: str,
    instance_url: str,
    refresh_token: str = None,
    username: str = None,
    org_name: str = None,
    client_id: str = None,
    client_secret: str = None
):
    """Save credentials to file for persistence across restarts."""
    try:
        # Load existing credentials if any
        existing = {}
        if CREDENTIALS_FILE.exists():
            with open(CREDENTIALS_FILE, "r") as f:
                existing = json.load(f)
        
        # Update with new values (keep existing if not provided)
        creds = {
            "org_name": org_name or existing.get("org_name", "Default Org"),
            "instance_url": instance_url,
            "access_token": access_token,
            "refresh_token": refresh_token or existing.get("refresh_token"),
            "client_id": client_id or existing.get("client_id"),
            "client_secret": client_secret or existing.get("client_secret"),
            "username": username or existing.get("username", ""),
            "created_at": existing.get("created_at", ""),
            "notes": "OAuth tokens. Access token expires in 2 hours, use refresh_token to get new one."
        }
        
        # Ensure config directory exists
        CREDENTIALS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        with open(CREDENTIALS_FILE, "w") as f:
            json.dump(creds, f, indent=4)
        
        logger.info(f"Saved Salesforce credentials to {CREDENTIALS_FILE}")
        return True
    except Exception as e:
        logger.error(f"Failed to save credentials: {e}")
        return False


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


@router.post("/auto-connect")
async def trigger_auto_connect():
    """
    Manually trigger auto-connect using saved credentials.
    Useful if auto-connect on startup failed or you want to reconnect.
    """
    result = await auto_connect_salesforce()
    return result


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
            
            # Store credentials in environment variables
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
            
            # Save credentials to file for persistence across restarts
            # Extract username from ID URL if available
            username_from_id = ""
            if token_data.get("id"):
                try:
                    # ID URL format: https://login.salesforce.com/id/00Dxxxx/005xxxx
                    id_url = token_data.get("id", "")
                    if id_url:
                        # Get user info to extract username
                        async with httpx.AsyncClient(timeout=30.0) as user_client:
                            user_response = await user_client.get(
                                id_url,
                                headers={"Authorization": f"Bearer {token_data.get('access_token')}"}
                            )
                            if user_response.status_code == 200:
                                user_info = user_response.json()
                                username_from_id = user_info.get("username", "")
                except Exception as e:
                    logger.warning(f"Could not extract username from ID: {e}")
            
            save_credentials_to_file(
                access_token=token_data.get("access_token", ""),
                instance_url=token_data.get("instance_url", ""),
                refresh_token=token_data.get("refresh_token"),
                username=username_from_id,
                client_id=OAUTH_CLIENT_ID,
                client_secret=OAUTH_CLIENT_SECRET
            )
            
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


# ============================================================================
# Orchestrator Endpoints - Test Discovery & Generation
# ============================================================================

@router.get("/orchestrator/scan")
async def orchestrator_scan_org():
    """
    Scan the connected Salesforce org for testable metadata:
    - Validation Rules
    - Flows (Process Builder, Flow Builder)
    - Apex Triggers
    - Apex Test Classes
    - Custom Objects
    
    Returns discovered items that can be used to generate tests.
    """
    sf = get_salesforce_client()
    if not sf:
        raise HTTPException(status_code=400, detail="Not connected to Salesforce")
    
    results = {
        "validation_rules": [],
        "flows": [],
        "triggers": [],
        "apex_classes": [],
        "custom_objects": [],
        "summary": {
            "total_items": 0,
            "by_type": {}
        }
    }
    
    # Scan Validation Rules
    try:
        vr_result = sf.toolingexecute(
            "query/?q=SELECT+Id,ValidationName,EntityDefinition.QualifiedApiName,Active,ErrorMessage,Description+FROM+ValidationRule+WHERE+Active=true"
        )
        for rule in vr_result.get('records', []):
            results["validation_rules"].append({
                "id": rule['Id'],
                "name": rule['ValidationName'],
                "object": rule['EntityDefinition']['QualifiedApiName'],
                "type": "validation",
                "active": rule.get('Active', True),
                "errorMessage": rule.get('ErrorMessage', ''),
                "description": rule.get('Description', '')
            })
    except Exception as e:
        logger.warning(f"Error scanning validation rules: {e}")
    
    # Scan Flows via Tooling API
    try:
        flow_result = sf.toolingexecute(
            "query/?q=SELECT+Id,MasterLabel,ProcessType,Status,Description+FROM+Flow+WHERE+Status='Active'"
        )
        for flow in flow_result.get('records', []):
            results["flows"].append({
                "id": flow['Id'],
                "name": flow['MasterLabel'],
                "type": "flow",
                "processType": flow.get('ProcessType', 'Unknown'),
                "status": flow.get('Status', ''),
                "description": flow.get('Description', '')
            })
    except Exception as e:
        logger.warning(f"Error scanning flows: {e}")
    
    # Scan Apex Triggers
    try:
        trigger_result = sf.query(
            "SELECT Id, Name, TableEnumOrId, Status, IsValid FROM ApexTrigger WHERE Status = 'Active'"
        )
        for trigger in trigger_result.get('records', []):
            results["triggers"].append({
                "id": trigger['Id'],
                "name": trigger['Name'],
                "object": trigger['TableEnumOrId'],
                "type": "trigger",
                "valid": trigger.get('IsValid', True)
            })
    except Exception as e:
        logger.warning(f"Error scanning triggers: {e}")
    
    # Scan Apex Test Classes
    try:
        class_result = sf.query(
            "SELECT Id, Name, Status, IsValid FROM ApexClass WHERE (Name LIKE '%Test%' OR Name LIKE '%test%') AND Status = 'Active'"
        )
        for cls in class_result.get('records', []):
            results["apex_classes"].append({
                "id": cls['Id'],
                "name": cls['Name'],
                "type": "apex_test",
                "valid": cls.get('IsValid', True)
            })
    except Exception as e:
        logger.warning(f"Error scanning apex classes: {e}")
    
    # Scan Custom Objects
    try:
        obj_result = sf.query(
            "SELECT Id, DeveloperName, QualifiedApiName, Label FROM EntityDefinition WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c' LIMIT 50"
        )
        for obj in obj_result.get('records', []):
            results["custom_objects"].append({
                "id": obj['Id'],
                "name": obj['QualifiedApiName'],
                "label": obj.get('Label', obj['DeveloperName']),
                "type": "custom_object",
                "developerName": obj['DeveloperName']
            })
    except Exception as e:
        logger.warning(f"Error scanning custom objects: {e}")
    
    # Calculate summary
    results["summary"]["by_type"] = {
        "validation_rules": len(results["validation_rules"]),
        "flows": len(results["flows"]),
        "triggers": len(results["triggers"]),
        "apex_classes": len(results["apex_classes"]),
        "custom_objects": len(results["custom_objects"])
    }
    results["summary"]["total_items"] = sum(results["summary"]["by_type"].values())
    
    return results


class TestGenerationRequest(BaseModel):
    object_name: str = Field(default="Account", description="Object to generate tests for")
    test_types: List[str] = Field(default=["crud", "validation", "api"], description="Types of tests to generate")
    include_negative_tests: bool = Field(default=True)
    include_boundary_tests: bool = Field(default=True)


@router.post("/orchestrator/generate-tests")
async def orchestrator_generate_tests(request: TestGenerationRequest):
    """
    Generate test cases based on object schema and discovered metadata.
    
    Returns a test suite with:
    - CRUD tests (Create, Read, Update, Delete)
    - Validation rule tests (positive and negative)
    - API endpoint tests
    - Field validation tests
    """
    sf = get_salesforce_client()
    if not sf:
        raise HTTPException(status_code=400, detail="Not connected to Salesforce")
    
    tests = []
    test_id = 1
    
    try:
        # Get object describe
        obj_describe = getattr(sf, request.object_name).describe()
        fields = obj_describe.get('fields', [])
        required_fields = [f for f in fields if not f.get('nillable', True) and f.get('createable', True)]
        
        # Get validation rules for this object
        vr_result = sf.toolingexecute(
            f"query/?q=SELECT+Id,ValidationName,ErrorMessage,Description+FROM+ValidationRule+WHERE+EntityDefinition.QualifiedApiName='{request.object_name}'+AND+Active=true"
        )
        validation_rules = vr_result.get('records', [])
        
    except Exception as e:
        logger.error(f"Error describing object: {e}")
        raise HTTPException(status_code=400, detail=f"Could not describe object {request.object_name}: {str(e)}")
    
    # Generate CRUD Tests
    if "crud" in request.test_types:
        tests.append({
            "id": f"test_{test_id}",
            "name": f"Create {request.object_name} - Valid Data",
            "category": "CRUD",
            "type": "positive",
            "object": request.object_name,
            "action": "create",
            "description": f"Verify that a valid {request.object_name} record can be created",
            "steps": [
                f"Create {request.object_name} with all required fields",
                "Verify record is created successfully",
                "Verify all field values are saved correctly"
            ],
            "expectedResult": "Record created successfully with valid ID"
        })
        test_id += 1
        
        tests.append({
            "id": f"test_{test_id}",
            "name": f"Read {request.object_name} by ID",
            "category": "CRUD",
            "type": "positive",
            "object": request.object_name,
            "action": "read",
            "description": f"Verify that a {request.object_name} record can be retrieved by ID",
            "steps": [
                f"Query {request.object_name} by ID",
                "Verify record data is returned",
                "Verify all fields are accessible"
            ],
            "expectedResult": "Record data returned correctly"
        })
        test_id += 1
        
        tests.append({
            "id": f"test_{test_id}",
            "name": f"Update {request.object_name}",
            "category": "CRUD",
            "type": "positive",
            "object": request.object_name,
            "action": "update",
            "description": f"Verify that a {request.object_name} record can be updated",
            "steps": [
                f"Retrieve existing {request.object_name}",
                "Update field values",
                "Save changes",
                "Verify updates are persisted"
            ],
            "expectedResult": "Record updated successfully"
        })
        test_id += 1
        
        tests.append({
            "id": f"test_{test_id}",
            "name": f"Delete {request.object_name}",
            "category": "CRUD",
            "type": "positive",
            "object": request.object_name,
            "action": "delete",
            "description": f"Verify that a {request.object_name} record can be deleted",
            "steps": [
                f"Create test {request.object_name}",
                "Delete the record",
                "Verify record no longer exists"
            ],
            "expectedResult": "Record deleted successfully"
        })
        test_id += 1
    
    # Generate Validation Rule Tests
    if "validation" in request.test_types:
        for vr in validation_rules:
            # Positive test (valid data should pass)
            tests.append({
                "id": f"test_{test_id}",
                "name": f"Validation: {vr['ValidationName']} - Valid Data",
                "category": "Validation",
                "type": "positive",
                "object": request.object_name,
                "action": "validate",
                "validationRule": vr['ValidationName'],
                "description": f"Verify valid data passes validation: {vr.get('Description', vr['ValidationName'])}",
                "steps": [
                    "Prepare valid data that satisfies validation rule",
                    f"Create/Update {request.object_name}",
                    "Verify operation succeeds"
                ],
                "expectedResult": "Record saved successfully (validation passes)"
            })
            test_id += 1
            
            # Negative test (invalid data should fail)
            if request.include_negative_tests:
                tests.append({
                    "id": f"test_{test_id}",
                    "name": f"Validation: {vr['ValidationName']} - Invalid Data",
                    "category": "Validation",
                    "type": "negative",
                    "object": request.object_name,
                    "action": "validate",
                    "validationRule": vr['ValidationName'],
                    "description": f"Verify invalid data triggers validation error",
                    "steps": [
                        "Prepare invalid data that violates validation rule",
                        f"Attempt to Create/Update {request.object_name}",
                        "Verify validation error is returned"
                    ],
                    "expectedResult": f"Validation error: {vr.get('ErrorMessage', 'Validation failed')}"
                })
                test_id += 1
    
    # Generate API Tests
    if "api" in request.test_types:
        tests.append({
            "id": f"test_{test_id}",
            "name": f"API: GET /sobjects/{request.object_name}/describe",
            "category": "API Tests",
            "type": "positive",
            "object": request.object_name,
            "action": "api_call",
            "method": "GET",
            "endpoint": f"/sobjects/{request.object_name}/describe",
            "description": f"Verify {request.object_name} describe endpoint returns metadata",
            "steps": [
                f"Call GET /sobjects/{request.object_name}/describe",
                "Verify response status is 200",
                "Verify fields array is returned"
            ],
            "expectedResult": "Metadata returned with fields and record types"
        })
        test_id += 1
        
        tests.append({
            "id": f"test_{test_id}",
            "name": f"API: POST /sobjects/{request.object_name}",
            "category": "API Tests",
            "type": "positive",
            "object": request.object_name,
            "action": "api_call",
            "method": "POST",
            "endpoint": f"/sobjects/{request.object_name}",
            "description": f"Verify {request.object_name} can be created via REST API",
            "steps": [
                "Prepare valid JSON payload with required fields",
                f"POST to /sobjects/{request.object_name}",
                "Verify response contains new record ID"
            ],
            "expectedResult": "201 Created with record ID"
        })
        test_id += 1
    
    # Generate Boundary Tests
    if request.include_boundary_tests:
        for field in required_fields[:5]:  # Limit to first 5 required fields
            if field['type'] == 'string':
                tests.append({
                    "id": f"test_{test_id}",
                    "name": f"Boundary: {field['name']} - Max Length",
                    "category": "Boundary Tests",
                    "type": "boundary",
                    "object": request.object_name,
                    "field": field['name'],
                    "action": "boundary_test",
                    "description": f"Verify {field['name']} handles max length ({field.get('length', 'N/A')} chars)",
                    "steps": [
                        f"Create {request.object_name} with {field['name']} at max length",
                        "Verify record is created",
                        "Verify value is truncated or saved correctly"
                    ],
                    "expectedResult": "Field handles max length appropriately"
                })
                test_id += 1
    
    return {
        "object": request.object_name,
        "testCount": len(tests),
        "tests": tests,
        "summary": {
            "crud": len([t for t in tests if t["category"] == "CRUD"]),
            "validation": len([t for t in tests if t["category"] == "Validation"]),
            "api": len([t for t in tests if t["category"] == "API Tests"]),
            "boundary": len([t for t in tests if t["category"] == "Boundary Tests"])
        }
    }


# ============================================================================
# Integration Testing Endpoints - Execute API Tests
# ============================================================================

class IntegrationTestRequest(BaseModel):
    method: str = Field(description="HTTP method (GET, POST, PATCH, DELETE)")
    endpoint: str = Field(description="API endpoint path")
    body: Optional[Dict[str, Any]] = Field(default=None, description="Request body for POST/PATCH")
    assertions: List[Dict[str, Any]] = Field(default=[], description="Assertions to validate response")


@router.post("/integration/execute-test")
async def execute_integration_test(request: IntegrationTestRequest):
    """
    Execute an API test against the connected Salesforce org.
    
    Supports:
    - GET, POST, PATCH, DELETE methods
    - Response validation with assertions
    - Field path checking (e.g., response.Id exists)
    """
    sf = get_salesforce_client()
    if not sf:
        raise HTTPException(status_code=400, detail="Not connected to Salesforce")
    
    result = {
        "success": False,
        "method": request.method,
        "endpoint": request.endpoint,
        "response": None,
        "assertions": [],
        "error": None
    }
    
    try:
        # Build full URL
        base_url = f"https://{sf.sf_instance}/services/data/v59.0"
        full_url = f"{base_url}{request.endpoint}"
        
        # Execute request based on method
        import httpx
        headers = {
            "Authorization": f"Bearer {sf.session_id}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            if request.method.upper() == "GET":
                response = await client.get(full_url, headers=headers)
            elif request.method.upper() == "POST":
                response = await client.post(full_url, headers=headers, json=request.body or {})
            elif request.method.upper() == "PATCH":
                response = await client.patch(full_url, headers=headers, json=request.body or {})
            elif request.method.upper() == "DELETE":
                response = await client.delete(full_url, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {request.method}")
        
        result["statusCode"] = response.status_code
        
        # Parse response
        try:
            result["response"] = response.json()
        except:
            result["response"] = response.text
        
        # Run assertions
        for assertion in request.assertions:
            assertion_result = {
                "path": assertion.get("path"),
                "condition": assertion.get("condition"),
                "expected": assertion.get("expected"),
                "passed": False,
                "actual": None
            }
            
            # Get value at path
            try:
                value = result["response"]
                for key in assertion.get("path", "").split("."):
                    if key and isinstance(value, dict):
                        value = value.get(key)
                assertion_result["actual"] = value
                
                # Evaluate condition
                condition = assertion.get("condition", "exists")
                if condition == "exists":
                    assertion_result["passed"] = value is not None
                elif condition == "notEmpty":
                    assertion_result["passed"] = bool(value)
                elif condition == "equals":
                    assertion_result["passed"] = value == assertion.get("expected")
                elif condition == "contains":
                    assertion_result["passed"] = assertion.get("expected") in str(value)
                elif condition == "greaterThan":
                    assertion_result["passed"] = float(value) > float(assertion.get("expected", 0))
                elif condition == "lessThan":
                    assertion_result["passed"] = float(value) < float(assertion.get("expected", 0))
                    
            except Exception as e:
                assertion_result["error"] = str(e)
            
            result["assertions"].append(assertion_result)
        
        # Overall success
        result["success"] = response.status_code < 400 and all(a.get("passed") for a in result["assertions"])
        
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Integration test error: {e}")
    
    return result


@router.post("/integration/run-crud-test")
async def run_crud_test(object_name: str = "Account"):
    """
    Run a full CRUD test cycle on an object.
    Creates, reads, updates, and deletes a test record.
    """
    sf = get_salesforce_client()
    if not sf:
        raise HTTPException(status_code=400, detail="Not connected to Salesforce")
    
    results = {
        "object": object_name,
        "steps": [],
        "success": True,
        "recordId": None
    }
    
    test_data = {
        "Account": {"Name": f"CRUD Test {__import__('time').time()}", "Industry": "Technology", "Website": "https://crudtest.example.com"},
        "Contact": {"FirstName": "Test", "LastName": f"Contact {__import__('time').time()}", "Email": "test@example.com"},
        "Lead": {"Company": f"Test Company {__import__('time').time()}", "LastName": "Lead"},
        "Opportunity": {"Name": f"Test Opp {__import__('time').time()}", "StageName": "Prospecting", "CloseDate": "2025-12-31"}
    }
    
    data = test_data.get(object_name, {"Name": f"Test {__import__('time').time()}"})
    
    try:
        # CREATE
        sf_object = getattr(sf, object_name)
        create_result = sf_object.create(data)
        record_id = create_result.get('id')
        results["recordId"] = record_id
        results["steps"].append({
            "action": "CREATE",
            "success": bool(record_id),
            "recordId": record_id
        })
        
        # READ
        if record_id:
            read_result = sf_object.get(record_id)
            results["steps"].append({
                "action": "READ",
                "success": bool(read_result.get('Id')),
                "data": {k: v for k, v in read_result.items() if not k.startswith('attributes')}
            })
        
        # UPDATE
        if record_id:
            update_data = {"Description": f"Updated at {__import__('time').time()}"}
            sf_object.update(record_id, update_data)
            results["steps"].append({
                "action": "UPDATE",
                "success": True,
                "updatedFields": list(update_data.keys())
            })
        
        # DELETE
        if record_id:
            sf_object.delete(record_id)
            results["steps"].append({
                "action": "DELETE",
                "success": True
            })
            results["recordId"] = None  # Cleared after delete
            
    except Exception as e:
        results["success"] = False
        results["error"] = str(e)
        results["steps"].append({
            "action": "ERROR",
            "success": False,
            "error": str(e)
        })
        
        # Cleanup on error
        if results.get("recordId"):
            try:
                getattr(sf, object_name).delete(results["recordId"])
            except:
                pass
    
    return results












