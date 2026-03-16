"""
SSO API Router
Handles SAML 2.0 and OIDC Single Sign-On flows.

Endpoints:
    GET  /api/auth/sso/saml/{org_slug}/login     - Redirect to SAML IdP
    POST /api/auth/sso/saml/{org_slug}/acs        - SAML Assertion Consumer Service (callback)
    GET  /api/auth/sso/saml/{org_slug}/metadata   - SP Metadata XML
    GET  /api/auth/sso/oidc/{org_slug}/login      - Redirect to OIDC IdP
    GET  /api/auth/sso/oidc/{org_slug}/callback    - OIDC callback (code exchange)
    GET  /api/auth/sso/config                      - Get SSO config for current org
    PUT  /api/auth/sso/config                      - Update SSO config
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Form, Query
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

sso_router = APIRouter(prefix="/api/auth/sso", tags=["SSO"])


# ==================== Request/Response Models ====================

class SSOConfigRequest(BaseModel):
    protocol: str  # 'saml' or 'oidc'
    is_enabled: bool = False

    # SAML fields
    idp_entity_id: Optional[str] = None
    idp_sso_url: Optional[str] = None
    idp_slo_url: Optional[str] = None
    idp_certificate: Optional[str] = None
    sp_entity_id: Optional[str] = None

    # OIDC fields
    oidc_issuer: Optional[str] = None
    oidc_client_id: Optional[str] = None
    oidc_client_secret: Optional[str] = None
    oidc_scopes: str = "openid profile email"
    oidc_discovery_url: Optional[str] = None

    # JIT
    auto_provision_users: bool = True
    default_role: str = "member"
    group_attribute_name: str = "groups"
    group_mapping: dict = {}
    enforce_sso: bool = False


# ==================== Helper ====================

async def _resolve_org_id(org_slug: str) -> str:
    """Resolve org_slug to org_id. Supports both slugs and UUIDs."""
    # If it looks like a UUID, use directly
    if len(org_slug) == 36 and org_slug.count("-") == 4:
        return org_slug

    # Lookup by slug
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        if pool and hasattr(pool, 'getconn'):
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id FROM organizations WHERE slug = %s",
                        (org_slug,)
                    )
                    row = cur.fetchone()
                    if row:
                        return str(row[0])
            finally:
                pool.putconn(conn)
    except Exception as e:
        logger.error(f"Error resolving org slug: {e}")

    raise HTTPException(status_code=404, detail="Organization not found")


# ==================== SAML Endpoints ====================

@sso_router.get("/saml/{org_slug}/login")
async def saml_login(org_slug: str, request: Request):
    """
    Initiate SAML SSO login.
    Redirects to IdP login page with AuthnRequest.
    """
    org_id = await _resolve_org_id(org_slug)

    from app.services.auth.saml_service import saml_service
    redirect_url = await saml_service.get_login_redirect(
        org_id, str(request.url)
    )

    if not redirect_url:
        raise HTTPException(
            status_code=400,
            detail="SAML SSO not configured or not available for this organization"
        )

    return RedirectResponse(url=redirect_url)


@sso_router.post("/saml/{org_slug}/acs")
async def saml_acs(
    org_slug: str,
    request: Request,
    SAMLResponse: str = Form(...),
    RelayState: Optional[str] = Form(None),
):
    """
    SAML Assertion Consumer Service (ACS).
    Receives and processes SAML Response from IdP.
    Creates or updates user, then redirects to frontend with JWT.
    """
    org_id = await _resolve_org_id(org_slug)

    from app.services.auth.saml_service import saml_service
    user_attrs = await saml_service.process_response(
        org_id, SAMLResponse, str(request.url)
    )

    if not user_attrs:
        raise HTTPException(status_code=401, detail="SAML authentication failed")

    # JIT provisioning via group mapping
    from app.services.auth.group_mapping_service import group_mapping_service
    session = await group_mapping_service.provision_or_update_user(
        org_id=org_id,
        user_attrs=user_attrs,
        ad_groups=user_attrs.get("groups", []),
        protocol="saml",
    )

    # Redirect to frontend with token
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    token = session.get("token", "")
    redirect_to = RelayState or f"{frontend_url}/dashboard"

    # Pass token via URL fragment (not visible to server logs)
    if "?" in redirect_to:
        redirect_url = f"{redirect_to}&sso_token={token}"
    else:
        redirect_url = f"{redirect_to}?sso_token={token}"

    return RedirectResponse(url=redirect_url, status_code=302)


@sso_router.get("/saml/{org_slug}/metadata")
async def saml_metadata(org_slug: str):
    """
    Return SAML SP Metadata XML.
    Used by IdP administrators to configure the trust relationship.
    """
    org_id = await _resolve_org_id(org_slug)

    from app.services.auth.saml_service import saml_service
    metadata = await saml_service.get_metadata(org_id)

    if not metadata:
        raise HTTPException(
            status_code=400,
            detail="SAML metadata not available"
        )

    return Response(content=metadata, media_type="application/xml")


# ==================== OIDC Endpoints ====================

@sso_router.get("/oidc/{org_slug}/login")
async def oidc_login(org_slug: str, request: Request):
    """
    Initiate OIDC SSO login.
    Redirects to IdP authorization endpoint.
    """
    org_id = await _resolve_org_id(org_slug)

    from app.services.auth.oidc_service import oidc_service
    result = await oidc_service.get_authorization_url(org_id)

    if not result:
        raise HTTPException(
            status_code=400,
            detail="OIDC SSO not configured or not available for this organization"
        )

    return RedirectResponse(url=result["url"])


@sso_router.get("/oidc/{org_slug}/callback")
async def oidc_callback(
    org_slug: str,
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """
    OIDC callback endpoint.
    Exchanges authorization code for tokens, creates/updates user.
    """
    if error:
        logger.error(f"OIDC callback error: {error} — {error_description}")
        raise HTTPException(
            status_code=401,
            detail=f"OIDC authentication failed: {error_description or error}"
        )

    org_id = await _resolve_org_id(org_slug)

    from app.services.auth.oidc_service import oidc_service
    user_attrs = await oidc_service.exchange_code(org_id, code, state)

    if not user_attrs:
        raise HTTPException(status_code=401, detail="OIDC authentication failed")

    # JIT provisioning via group mapping
    from app.services.auth.group_mapping_service import group_mapping_service
    session = await group_mapping_service.provision_or_update_user(
        org_id=org_id,
        user_attrs=user_attrs,
        ad_groups=user_attrs.get("groups", []),
        protocol="oidc",
    )

    # Redirect to frontend with token
    import os
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    token = session.get("token", "")

    redirect_url = f"{frontend_url}/dashboard?sso_token={token}"
    return RedirectResponse(url=redirect_url, status_code=302)


# ==================== Config Endpoints ====================

@sso_router.get("/config")
async def get_sso_config(request: Request):
    """
    Get SSO configuration for the current user's organization.
    Returns both SAML and OIDC configs.
    """
    org_id = getattr(request.state, "tenant_id", None) or getattr(request.state, "org_id", None)
    if not org_id:
        raise HTTPException(status_code=401, detail="Organization context required")

    configs = {}

    from app.services.auth.saml_service import saml_service
    saml_config = await saml_service.get_sso_config(org_id)
    if saml_config:
        # Remove sensitive fields
        saml_config.pop("idp_certificate", None)
        configs["saml"] = saml_config

    from app.services.auth.oidc_service import oidc_service
    oidc_config = await oidc_service.get_sso_config(org_id)
    if oidc_config:
        # Remove sensitive fields
        oidc_config.pop("oidc_client_secret", None)
        configs["oidc"] = oidc_config

    return {"configs": configs}


@sso_router.put("/config")
async def update_sso_config(request: Request, config: SSOConfigRequest):
    """
    Update SSO configuration for the current user's organization.
    Requires admin role.
    """
    org_id = getattr(request.state, "tenant_id", None) or getattr(request.state, "org_id", None)
    if not org_id:
        raise HTTPException(status_code=401, detail="Organization context required")

    # Check admin role
    roles = getattr(request.state, "roles", [])
    if not any(r in roles for r in ["owner", "admin"]):
        raise HTTPException(status_code=403, detail="Admin role required to manage SSO")

    config_dict = config.dict(exclude_none=True)

    if config.protocol == "saml":
        from app.services.auth.saml_service import saml_service
        result = await saml_service.save_sso_config(org_id, config_dict)
    elif config.protocol == "oidc":
        from app.services.auth.oidc_service import oidc_service
        result = await oidc_service.save_sso_config(org_id, config_dict)
    else:
        raise HTTPException(status_code=400, detail="Invalid protocol. Use 'saml' or 'oidc'")

    logger.info(f"SSO config updated: org={org_id}, protocol={config.protocol}")
    return {"status": "ok", "config": result}
