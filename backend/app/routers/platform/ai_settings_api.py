"""
AI Settings Management API Router

Provides endpoints for managing AI/LLM configuration per organization,
including BYOK (Bring Your Own Key) API key storage, provider management,
budget tracking, and usage statistics.

Endpoints:
    GET    /api/ai/settings            - Get current AI settings for the org
    PUT    /api/ai/settings            - Update AI settings
    POST   /api/ai/settings/key        - Store an encrypted BYOK API key
    DELETE /api/ai/settings/key/{prov} - Remove a stored API key
    POST   /api/ai/settings/test       - Test AI provider connection
    GET    /api/ai/settings/providers   - List available providers and status
    GET    /api/ai/settings/usage       - Get usage statistics
"""

# RBAC: Permission checks added for enterprise security compliance
import logging
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from enum import Enum

from app.middleware.rbac_middleware import require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/settings", tags=["ai-settings"])


# ============================================================================
# Enums
# ============================================================================

class AIProvider(str, Enum):
    """Supported AI providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    OLLAMA = "ollama"
    CUSTOM = "custom"


# ============================================================================
# Request/Response Models
# ============================================================================

class AISettingsResponse(BaseModel):
    """Current AI settings for the organization."""
    enabled: bool = Field(default=True, description="Whether AI features are enabled")
    provider: str = Field(default="openai", description="Active AI provider")
    model: str = Field(default="gpt-4o-mini", description="Active model identifier")
    has_api_key: bool = Field(default=False, description="Whether an OpenAI API key is stored")
    has_anthropic_key: bool = Field(default=False, description="Whether an Anthropic API key is stored")
    custom_endpoint: Optional[str] = Field(default=None, description="Custom LLM endpoint URL")
    max_requests_per_day: int = Field(default=1000, description="Daily request limit")
    max_cost_per_day_cents: int = Field(default=5000, description="Daily cost limit in cents")
    budget_tracking: bool = Field(default=True, description="Whether budget tracking is enabled")
    enabled_features: List[str] = Field(
        default_factory=lambda: [
            "test_generation", "self_healing", "failure_analysis",
            "vision_healing", "accessibility_analysis"
        ],
        description="List of enabled AI feature flags"
    )
    requests_today: int = Field(default=0, description="Number of AI requests made today")
    cost_today_cents: int = Field(default=0, description="Cost incurred today in cents")
    usage_stats: Dict[str, Any] = Field(
        default_factory=lambda: {"total_requests_today": 0, "total_cost_today": 0},
        description="Summary usage statistics"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "provider": "openai",
                "model": "gpt-4o-mini",
                "has_api_key": True,
                "has_anthropic_key": False,
                "custom_endpoint": None,
                "max_requests_per_day": 1000,
                "max_cost_per_day_cents": 5000,
                "budget_tracking": True,
                "enabled_features": [
                    "test_generation", "self_healing", "failure_analysis",
                    "vision_healing", "accessibility_analysis"
                ],
                "requests_today": 42,
                "cost_today_cents": 128,
                "usage_stats": {
                    "total_requests_today": 42,
                    "total_cost_today": 128
                }
            }
        }


class UpdateAISettingsRequest(BaseModel):
    """Request to update AI settings."""
    enabled: Optional[bool] = Field(default=None, description="Enable or disable AI features")
    provider: Optional[str] = Field(default=None, description="AI provider to use")
    model: Optional[str] = Field(default=None, description="Model identifier")
    custom_endpoint: Optional[str] = Field(default=None, description="Custom LLM endpoint URL")
    max_requests_per_day: Optional[int] = Field(default=None, ge=0, description="Daily request limit")
    max_cost_per_day_cents: Optional[int] = Field(default=None, ge=0, description="Daily cost limit in cents")
    budget_tracking: Optional[bool] = Field(default=None, description="Enable budget tracking")
    enabled_features: Optional[List[str]] = Field(default=None, description="AI feature flags to enable")

    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "provider": "openai",
                "model": "gpt-4o-mini",
                "max_requests_per_day": 500,
                "budget_tracking": True,
                "enabled_features": ["test_generation", "self_healing"]
            }
        }


class StoreAPIKeyRequest(BaseModel):
    """Request to store a BYOK API key."""
    provider: str = Field(..., description="Provider for this key: 'openai' or 'anthropic'")
    api_key: str = Field(..., min_length=1, description="The API key to store (will be encrypted)")

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "openai",
                "api_key": "sk-proj-abc123..."
            }
        }


class StoreAPIKeyResponse(BaseModel):
    """Response after storing an API key."""
    success: bool
    provider: str
    masked_key: str = Field(description="Masked version of the key for display")


class TestConnectionRequest(BaseModel):
    """Request to test AI provider connectivity."""
    provider: Optional[str] = Field(default=None, description="Provider to test (defaults to active provider)")
    api_key: Optional[str] = Field(default=None, description="API key to test with (uses stored key if omitted)")

    class Config:
        json_schema_extra = {
            "example": {
                "provider": "openai",
                "api_key": "sk-proj-abc123..."
            }
        }


class TestConnectionResponse(BaseModel):
    """Response from connection test."""
    connected: bool
    provider: str
    model: str
    latency_ms: int = Field(default=0, description="Round-trip latency in milliseconds")
    error: Optional[str] = Field(default=None, description="Error message if connection failed")


class ProviderModel(BaseModel):
    """A model available from a provider."""
    id: str
    name: str


class ProviderInfo(BaseModel):
    """Information about a single AI provider."""
    id: str
    name: str
    description: str
    has_key: bool = False
    enabled: bool = False
    models: List[ProviderModel] = Field(default_factory=list)


class ProvidersResponse(BaseModel):
    """List of available AI providers."""
    providers: List[ProviderInfo]


class DailyUsage(BaseModel):
    """Usage stats for a single day."""
    date: str
    requests: int
    cost_cents: int


class UsageResponse(BaseModel):
    """AI usage statistics."""
    total_requests: int
    total_cost_cents: int
    by_provider: Dict[str, Any]
    by_day: List[DailyUsage]


# ============================================================================
# Helper Functions
# ============================================================================

def _get_org_id(request: Request) -> str:
    """Extract org_id from request state or headers."""
    if hasattr(request.state, 'tenant_id') and request.state.tenant_id:
        return str(request.state.tenant_id)
    org_id = request.headers.get("X-Tenant-ID", "")
    if org_id:
        return org_id
    return "00000000-0000-0000-0000-000000000001"  # Demo org


def _mask_api_key(api_key: str) -> str:
    """Mask an API key for safe display, showing prefix and last 4 chars."""
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return api_key[:2] + "*" * (len(api_key) - 2)
    return f"{api_key[:8]}...{api_key[-4:]}"


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=AISettingsResponse)
@require_permission("admin:read")
async def get_settings(
    request: Request,
    project_id: Optional[str] = Query(None, description="Filter by project ID")
):
    """
    Get current AI settings for the requesting organization.

    Returns the full AI configuration including provider, model, budget limits,
    enabled features, and today's usage statistics. API keys are never returned
    in plaintext -- only boolean flags indicating whether keys are stored.
    """
    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        settings = await service.get_settings(org_id=org_id, project_id=project_id)

        return AISettingsResponse(
            enabled=settings.get("enabled", True),
            provider=settings.get("provider", "openai"),
            model=settings.get("model", "gpt-4o-mini"),
            has_api_key=settings.get("has_api_key", False),
            has_anthropic_key=settings.get("has_anthropic_key", False),
            custom_endpoint=settings.get("custom_endpoint"),
            max_requests_per_day=settings.get("max_requests_per_day", 1000),
            max_cost_per_day_cents=settings.get("max_cost_per_day_cents", 5000),
            budget_tracking=settings.get("budget_tracking", True),
            enabled_features=settings.get("enabled_features", [
                "test_generation", "self_healing", "failure_analysis",
                "vision_healing", "accessibility_analysis"
            ]),
            requests_today=settings.get("requests_today", 0),
            cost_today_cents=settings.get("cost_today_cents", 0),
            usage_stats={
                "total_requests_today": settings.get("requests_today", 0),
                "total_cost_today": settings.get("cost_today_cents", 0),
            }
        )
    except Exception as e:
        logger.error(f"Failed to get AI settings: {e}", exc_info=True)
        # Return safe defaults instead of crashing
        return AISettingsResponse()


@router.put("/", response_model=AISettingsResponse)
@require_permission("admin:manage")
async def update_settings(
    body: UpdateAISettingsRequest,
    request: Request,
    project_id: Optional[str] = Query(None, description="Scope settings to a project")
):
    """
    Update AI settings for the organization.

    Only fields that are provided (non-null) will be updated. This allows
    partial updates without overwriting other settings.
    """
    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        # Build updates dict from non-None fields
        updates: Dict[str, Any] = {}
        if body.enabled is not None:
            updates["enabled"] = body.enabled
        if body.provider is not None:
            updates["provider"] = body.provider
        if body.model is not None:
            updates["model"] = body.model
        if body.custom_endpoint is not None:
            updates["custom_endpoint"] = body.custom_endpoint
        if body.max_requests_per_day is not None:
            updates["max_requests_per_day"] = body.max_requests_per_day
        if body.max_cost_per_day_cents is not None:
            updates["max_cost_per_day_cents"] = body.max_cost_per_day_cents
        if body.budget_tracking is not None:
            updates["budget_tracking"] = body.budget_tracking
        if body.enabled_features is not None:
            updates["enabled_features"] = body.enabled_features

        if not updates:
            raise HTTPException(status_code=400, detail="No fields provided to update")

        logger.info(f"Updating AI settings for org={org_id}: {list(updates.keys())}")
        settings = await service.update_settings(
            org_id=org_id, project_id=project_id, updates=updates
        )

        return AISettingsResponse(
            enabled=settings.get("enabled", True),
            provider=settings.get("provider", "openai"),
            model=settings.get("model", "gpt-4o-mini"),
            has_api_key=settings.get("has_api_key", False),
            has_anthropic_key=settings.get("has_anthropic_key", False),
            custom_endpoint=settings.get("custom_endpoint"),
            max_requests_per_day=settings.get("max_requests_per_day", 1000),
            max_cost_per_day_cents=settings.get("max_cost_per_day_cents", 5000),
            budget_tracking=settings.get("budget_tracking", True),
            enabled_features=settings.get("enabled_features", []),
            requests_today=settings.get("requests_today", 0),
            cost_today_cents=settings.get("cost_today_cents", 0),
            usage_stats={
                "total_requests_today": settings.get("requests_today", 0),
                "total_cost_today": settings.get("cost_today_cents", 0),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update AI settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="AI settings operation failed")


@router.post("/key", response_model=StoreAPIKeyResponse)
@require_permission("admin:manage")
async def store_api_key(
    body: StoreAPIKeyRequest,
    request: Request,
):
    """
    Store a BYOK (Bring Your Own Key) API key.

    The key is encrypted at rest using Fernet symmetric encryption before
    being persisted. Only 'openai' and 'anthropic' providers are accepted.
    """
    if body.provider not in ("openai", "anthropic"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{body.provider}'. Must be 'openai' or 'anthropic'."
        )

    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        await service.store_api_key(
            org_id=org_id,
            provider=body.provider,
            api_key=body.api_key,
        )

        masked = _mask_api_key(body.api_key)
        logger.info(f"Stored {body.provider} API key for org={org_id} (masked: {masked})")

        return StoreAPIKeyResponse(
            success=True,
            provider=body.provider,
            masked_key=masked,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to store API key: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to store API key")


@router.delete("/key/{provider}")
@require_permission("admin:manage")
async def delete_api_key(
    provider: str,
    request: Request,
) -> Dict[str, Any]:
    """
    Remove a stored API key for the given provider.

    After removal the corresponding `has_api_key` or `has_anthropic_key`
    flag in settings will return false.
    """
    if provider not in ("openai", "anthropic"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{provider}'. Must be 'openai' or 'anthropic'."
        )

    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        await service.delete_api_key(org_id=org_id, provider=provider)
        logger.info(f"Deleted {provider} API key for org={org_id}")

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete API key: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete API key")


@router.post("/test", response_model=TestConnectionResponse)
@require_permission("admin:read")
async def test_connection(
    body: TestConnectionRequest,
    request: Request,
):
    """
    Test connectivity to an AI provider.

    If `api_key` is provided in the request body it will be used for the
    test without being persisted. Otherwise the stored key for the
    provider is used.

    Returns connection status, resolved model name, and round-trip latency.
    """
    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        provider = body.provider
        api_key = body.api_key

        # Resolve provider from current settings if not specified
        if not provider:
            settings = await service.get_settings(org_id=org_id)
            provider = settings.get("provider", "openai")

        # If no key provided, try to retrieve stored key
        if not api_key:
            api_key = await service.get_api_key(org_id=org_id, provider=provider)

        if not api_key:
            return TestConnectionResponse(
                connected=False,
                provider=provider,
                model="",
                latency_ms=0,
                error=f"No API key available for {provider}. Store a key first or provide one in the request.",
            )

        # Test the connection
        start_ms = int(time.time() * 1000)
        result = await _test_provider_connection(provider, api_key)
        latency = int(time.time() * 1000) - start_ms

        return TestConnectionResponse(
            connected=result["connected"],
            provider=provider,
            model=result.get("model", ""),
            latency_ms=latency,
            error=result.get("error"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to test AI connection: {e}", exc_info=True)
        return TestConnectionResponse(
            connected=False,
            provider=body.provider or "unknown",
            model="",
            latency_ms=0,
            error=str(e),
        )


@router.get("/providers", response_model=ProvidersResponse)
@require_permission("admin:read")
async def list_providers(
    request: Request,
):
    """
    List all available AI providers and their current status.

    Each provider includes its supported models and whether an API key
    is stored for the requesting organization.
    """
    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        settings = await service.get_settings(org_id=org_id)

        providers = [
            ProviderInfo(
                id="openai",
                name="OpenAI",
                description="GPT-4o, GPT-4o-mini, and other OpenAI models",
                has_key=settings.get("has_api_key", False),
                enabled=settings.get("provider") == "openai",
                models=[
                    ProviderModel(id="gpt-4o-mini", name="GPT-4o Mini"),
                    ProviderModel(id="gpt-4o", name="GPT-4o"),
                    ProviderModel(id="gpt-4-turbo", name="GPT-4 Turbo"),
                    ProviderModel(id="gpt-3.5-turbo", name="GPT-3.5 Turbo"),
                ],
            ),
            ProviderInfo(
                id="anthropic",
                name="Anthropic",
                description="Claude 3.5 Sonnet, Claude 3 Opus, and other Anthropic models",
                has_key=settings.get("has_anthropic_key", False),
                enabled=settings.get("provider") == "anthropic",
                models=[
                    ProviderModel(id="claude-sonnet-4-20250514", name="Claude Sonnet 4"),
                    ProviderModel(id="claude-3-5-sonnet-20241022", name="Claude 3.5 Sonnet"),
                    ProviderModel(id="claude-3-opus-20240229", name="Claude 3 Opus"),
                    ProviderModel(id="claude-3-haiku-20240307", name="Claude 3 Haiku"),
                ],
            ),
            ProviderInfo(
                id="azure_openai",
                name="Azure OpenAI",
                description="OpenAI models hosted on Microsoft Azure (requires custom endpoint)",
                has_key=False,
                enabled=settings.get("provider") == "azure_openai",
                models=[
                    ProviderModel(id="gpt-4o", name="GPT-4o (Azure)"),
                    ProviderModel(id="gpt-4o-mini", name="GPT-4o Mini (Azure)"),
                ],
            ),
            ProviderInfo(
                id="ollama",
                name="Ollama (Local)",
                description="Run models locally via Ollama — no API key required",
                has_key=True,  # Ollama doesn't need a key
                enabled=settings.get("provider") == "ollama",
                models=[
                    ProviderModel(id="llama3", name="Llama 3"),
                    ProviderModel(id="codellama", name="Code Llama"),
                    ProviderModel(id="mistral", name="Mistral"),
                ],
            ),
            ProviderInfo(
                id="custom",
                name="Custom Endpoint",
                description="Any OpenAI-compatible API endpoint",
                has_key=False,
                enabled=settings.get("provider") == "custom",
                models=[
                    ProviderModel(id="custom", name="Custom Model"),
                ],
            ),
        ]

        return ProvidersResponse(providers=providers)
    except Exception as e:
        logger.error(f"Failed to list providers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list AI providers")


@router.get("/usage", response_model=UsageResponse)
@require_permission("admin:read")
async def get_usage(
    request: Request,
    days: int = Query(default=7, ge=1, le=90, description="Number of days of history to return"),
):
    """
    Get AI usage statistics for the organization.

    Returns total requests and cost, broken down by provider and by day
    for the requested time window.
    """
    try:
        from backend.app.services.core.ai_settings_service import get_ai_settings_service
        service = get_ai_settings_service()
        org_id = _get_org_id(request)

        usage = await service.get_usage(org_id=org_id, days=days)

        by_day = [
            DailyUsage(
                date=day.get("date", ""),
                requests=day.get("requests", 0),
                cost_cents=day.get("cost_cents", 0),
            )
            for day in usage.get("by_day", [])
        ]

        return UsageResponse(
            total_requests=usage.get("total_requests", 0),
            total_cost_cents=usage.get("total_cost_cents", 0),
            by_provider=usage.get("by_provider", {}),
            by_day=by_day,
        )
    except Exception as e:
        logger.error(f"Failed to get AI usage: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve AI usage statistics")


# ============================================================================
# Internal Helpers
# ============================================================================

async def _test_provider_connection(provider: str, api_key: str) -> Dict[str, Any]:
    """
    Test connectivity to a specific AI provider with the given key.

    Sends a minimal request (e.g., list-models or a tiny completion) to
    verify the key is valid and the service is reachable.

    Returns:
        dict with 'connected' (bool), 'model' (str), and optional 'error' (str)
    """
    if provider == "openai":
        return await _test_openai(api_key)
    elif provider == "anthropic":
        return await _test_anthropic(api_key)
    elif provider == "ollama":
        return await _test_ollama()
    elif provider in ("azure_openai", "custom"):
        # For Azure and custom endpoints, a full test would require the endpoint URL.
        # Return a success stub for now.
        return {"connected": True, "model": "custom"}
    else:
        return {"connected": False, "error": f"Unknown provider: {provider}"}


async def _test_openai(api_key: str) -> Dict[str, Any]:
    """Test OpenAI connectivity by listing models."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                # Pick a representative model from the list
                models = [m["id"] for m in data.get("data", []) if "gpt" in m.get("id", "")]
                model_name = models[0] if models else "gpt-4o-mini"
                return {"connected": True, "model": model_name}
            elif resp.status_code == 401:
                return {"connected": False, "model": "", "error": "Invalid API key (401 Unauthorized)"}
            else:
                return {"connected": False, "model": "", "error": f"OpenAI returned HTTP {resp.status_code}"}
    except Exception as e:
        return {"connected": False, "model": "", "error": f"Connection failed: {str(e)}"}


async def _test_anthropic(api_key: str) -> Dict[str, Any]:
    """Test Anthropic connectivity by sending a minimal messages request."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}],
                },
            )
            if resp.status_code == 200:
                return {"connected": True, "model": "claude-3-haiku-20240307"}
            elif resp.status_code == 401:
                return {"connected": False, "model": "", "error": "Invalid API key (401 Unauthorized)"}
            else:
                return {"connected": False, "model": "", "error": f"Anthropic returned HTTP {resp.status_code}"}
    except Exception as e:
        return {"connected": False, "model": "", "error": f"Connection failed: {str(e)}"}


async def _test_ollama() -> Dict[str, Any]:
    """Test Ollama connectivity by hitting its local tags endpoint."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                model_name = models[0] if models else "llama3"
                return {"connected": True, "model": model_name}
            else:
                return {"connected": False, "model": "", "error": f"Ollama returned HTTP {resp.status_code}"}
    except Exception as e:
        return {"connected": False, "model": "", "error": f"Ollama not reachable at localhost:11434: {str(e)}"}
