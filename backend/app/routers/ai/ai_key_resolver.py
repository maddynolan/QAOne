"""
AI Key Resolver — shared helper for resolving BYOK keys in AI routers.

Usage in any AI endpoint:
    from app.routers.ai.ai_key_resolver import resolve_ai_key, require_ai_key

    @router.post("/my-endpoint")
    async def my_endpoint(request: Request):
        api_key = resolve_ai_key(request, provider="openai")
        if not api_key:
            raise HTTPException(503, "AI not configured. Add your API key in Settings > AI.")
        # Use api_key...
"""

import os
import logging
from typing import Optional
from fastapi import Request

logger = logging.getLogger(__name__)

# Default org ID for unauthenticated/demo mode
DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'


def _get_org_id(request: Request) -> str:
    """Extract org_id from request (tenant middleware or header or default)."""
    # Try tenant middleware
    org_id = getattr(request.state, 'tenant_id', None) if hasattr(request, 'state') else None
    if org_id:
        return str(org_id)
    # Try header
    org_id = request.headers.get('X-Tenant-ID') or request.headers.get('x-tenant-id')
    if org_id:
        return str(org_id)
    return DEFAULT_ORG_ID


def _get_project_id(request: Request) -> Optional[str]:
    """Extract project_id from request if available."""
    proj = getattr(request.state, 'project_id', None) if hasattr(request, 'state') else None
    if proj:
        return str(proj)
    proj = request.headers.get('X-Project-ID') or request.headers.get('x-project-id')
    return str(proj) if proj else None


def resolve_ai_key(request: Request, provider: str = "openai") -> Optional[str]:
    """
    Resolve API key using BYOK → env var fallback chain.

    Returns the API key string or None if no key is available.
    """
    org_id = _get_org_id(request)
    project_id = _get_project_id(request)

    try:
        from app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        key = service.resolve_api_key(org_id, project_id, provider)
        if key:
            return key
    except Exception as e:
        logger.debug(f"AISettingsService unavailable, falling back to env: {e}")

    # Fallback to environment variables
    env_map = {
        'openai': 'OPENAI_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
    }
    env_var = env_map.get(provider)
    if env_var:
        return os.getenv(env_var)

    return None


def require_ai_key(request: Request, provider: str = "openai") -> str:
    """
    Like resolve_ai_key but raises HTTPException if no key found.
    Use this in endpoints that absolutely require AI.
    """
    from fastapi import HTTPException
    key = resolve_ai_key(request, provider)
    if not key:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "AI not configured",
                "message": f"No {provider} API key available. Configure your key in Settings > AI.",
                "setup_url": "/settings?tab=ai"
            }
        )
    return key
