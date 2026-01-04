"""
Vision Self-Healing API Router

Provides endpoints for AI-powered element detection and self-healing.
This is ADDITIVE - does not modify any existing endpoints.

Endpoints:
    POST /api/ai/vision/find-element - Find element by description
    POST /api/ai/vision/heal-selector - Heal a broken selector
    POST /api/ai/vision/suggest-selectors - Get selector suggestions
    GET  /api/ai/vision/status - Check if GPT-4 Vision is available
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/vision", tags=["ai-vision-healing"])


# ============================================================================
# Request/Response Models
# ============================================================================

class FindElementRequest(BaseModel):
    """Request to find an element using AI vision"""
    screenshot_base64: str = Field(..., description="Base64-encoded screenshot")
    description: str = Field(..., description="Natural language description of element")
    context: Optional[str] = Field(None, description="Optional page/app context")
    
    class Config:
        json_schema_extra = {
            "example": {
                "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
                "description": "the blue Submit button at the bottom right",
                "context": "Login page of e-commerce site"
            }
        }


class FindElementResponse(BaseModel):
    """Response from element finding"""
    found: bool
    x: Optional[int] = None
    y: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    confidence: float = 0.0
    selector_suggestion: Optional[str] = None
    description: Optional[str] = None
    error: Optional[str] = None


class HealSelectorRequest(BaseModel):
    """Request to heal a broken selector"""
    screenshot_base64: str = Field(..., description="Current screenshot")
    original_selector: str = Field(..., description="The selector that failed")
    element_description: str = Field(..., description="What the element should be")
    page_html: Optional[str] = Field(None, description="Current page HTML")
    error_message: Optional[str] = Field(None, description="Error that occurred")
    
    class Config:
        json_schema_extra = {
            "example": {
                "screenshot_base64": "iVBORw0KGgoAAAANSUhEUgAA...",
                "original_selector": "#submit-btn",
                "element_description": "Submit button to complete form",
                "error_message": "Element not found"
            }
        }


class HealSelectorResponse(BaseModel):
    """Response from selector healing"""
    success: bool
    original_selector: str
    healed_selector: Optional[str] = None
    healing_method: Optional[str] = None
    confidence: float = 0.0
    explanation: Optional[str] = None
    error: Optional[str] = None


class SuggestSelectorsRequest(BaseModel):
    """Request for selector suggestions"""
    screenshot_base64: str
    current_selector: str
    page_html: Optional[str] = None


class SelectorSuggestion(BaseModel):
    """A single selector suggestion"""
    selector: str
    type: str  # data-testid, aria, text, xpath
    confidence: float
    reason: str


class StatusResponse(BaseModel):
    """Status of the vision healing service"""
    available: bool
    provider: str = "gpt-4-vision"
    message: str


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/status", response_model=StatusResponse)
async def get_vision_status():
    """
    Check if GPT-4 Vision self-healing is available.
    
    Requires OPENAI_API_KEY environment variable to be set.
    """
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        
        return StatusResponse(
            available=service.available,
            provider="gpt-4-vision" if service.available else "none",
            message="GPT-4 Vision is ready" if service.available else "Set OPENAI_API_KEY to enable"
        )
    except Exception as e:
        logger.error(f"Error checking vision status: {e}")
        return StatusResponse(
            available=False,
            provider="none",
            message=f"Error: {str(e)}"
        )


@router.post("/find-element", response_model=FindElementResponse)
async def find_element_by_description(request: FindElementRequest):
    """
    Find an element in a screenshot using natural language description.
    
    Uses GPT-4 Vision to analyze the screenshot and locate the described element.
    Returns coordinates that can be used for clicking.
    
    **Example descriptions:**
    - "the blue Submit button at bottom right"
    - "the checkbox next to 'Remember me'"
    - "the search icon in the header"
    - "the third item in the product list"
    """
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        
        if not service.available:
            raise HTTPException(
                status_code=503,
                detail="GPT-4 Vision not available. Set OPENAI_API_KEY environment variable."
            )
        
        result = await service.find_element_by_description(
            screenshot_base64=request.screenshot_base64,
            description=request.description,
            context=request.context
        )
        
        return FindElementResponse(
            found=result.found,
            x=result.x,
            y=result.y,
            width=result.width,
            height=result.height,
            confidence=result.confidence,
            selector_suggestion=result.selector_suggestion,
            description=result.description,
            error=result.error
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding element: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/heal-selector", response_model=HealSelectorResponse)
async def heal_broken_selector(request: HealSelectorRequest):
    """
    Heal a broken selector using AI analysis.
    
    This is the REACTIVE self-healing endpoint. Call this when a test fails
    due to a broken selector, and it will analyze the current page state
    to suggest a working replacement.
    
    **How it works:**
    1. Analyzes the screenshot to find the visual element
    2. Examines the page HTML (if provided) for stable attributes
    3. Suggests a new selector prioritizing:
       - data-testid attributes
       - aria-label/role attributes
       - Unique text content
       - Structural path (last resort)
    
    **Integration example:**
    ```python
    try:
        await page.click(selector)
    except:
        screenshot = await page.screenshot()
        result = heal_selector(screenshot, selector, description)
        if result.success:
            await page.click(result.healed_selector)
            # Log the healing for review
    ```
    """
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        
        if not service.available:
            raise HTTPException(
                status_code=503,
                detail="GPT-4 Vision not available. Set OPENAI_API_KEY environment variable."
            )
        
        result = await service.heal_broken_selector(
            screenshot_base64=request.screenshot_base64,
            original_selector=request.original_selector,
            element_description=request.element_description,
            page_html=request.page_html,
            error_message=request.error_message
        )
        
        return HealSelectorResponse(
            success=result.success,
            original_selector=result.original_selector,
            healed_selector=result.healed_selector,
            healing_method=result.healing_method,
            confidence=result.confidence,
            explanation=result.explanation,
            error=result.error
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error healing selector: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-selectors", response_model=List[SelectorSuggestion])
async def suggest_better_selectors(request: SuggestSelectorsRequest):
    """
    Get suggestions for more robust selectors.
    
    Use this proactively during test creation to get better selectors upfront,
    reducing the need for self-healing later.
    
    Returns selectors ordered from most to least robust.
    """
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        
        if not service.available:
            raise HTTPException(
                status_code=503,
                detail="GPT-4 Vision not available"
            )
        
        suggestions = await service.suggest_better_selectors(
            screenshot_base64=request.screenshot_base64,
            current_selector=request.current_selector,
            page_html=request.page_html
        )
        
        return [
            SelectorSuggestion(
                selector=s.get("selector", ""),
                type=s.get("type", "unknown"),
                confidence=s.get("confidence", 0.0),
                reason=s.get("reason", "")
            )
            for s in suggestions
        ]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suggesting selectors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AI Configuration Endpoint
# ============================================================================

# Global storage for AI config (in production, use proper config management)
# Initialize with environment variable if available
import os
_env_api_key = os.getenv("OPENAI_API_KEY", "")
_ai_config = {
    "api_key": _env_api_key,
    "model": "gpt-4o-mini",
    "provider": "openai",
    "enabled": bool(_env_api_key)
}

# Initialize the vision service with env key if available
if _env_api_key:
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        service.set_api_key(_env_api_key)
        logger.info("Vision service initialized with OPENAI_API_KEY from environment")
    except Exception as e:
        logger.warning(f"Could not initialize vision service with env key: {e}")


class AIConfigRequest(BaseModel):
    """Request to update AI configuration"""
    api_key: Optional[str] = None
    model: Optional[str] = "gpt-4o-mini"
    provider: Optional[str] = "openai"


class AIConfigResponse(BaseModel):
    """Response with AI configuration status"""
    enabled: bool
    model: str
    provider: str
    has_api_key: bool


@router.post("/config", response_model=AIConfigResponse)
async def update_ai_config(request: AIConfigRequest):
    """
    Update AI configuration (API key, model, provider).
    The API key is stored in memory for use by AI services.
    """
    global _ai_config
    
    if request.api_key is not None:
        _ai_config["api_key"] = request.api_key
        _ai_config["enabled"] = bool(request.api_key)
        
        # Update the vision healing service with new key
        try:
            from app.services.ai.vision_self_healing import get_vision_healing_service
            service = get_vision_healing_service()
            service.set_api_key(request.api_key)
        except Exception as e:
            logger.warning(f"Could not update vision service API key: {e}")
    
    if request.model:
        _ai_config["model"] = request.model
    if request.provider:
        _ai_config["provider"] = request.provider
    
    logger.info(f"AI config updated: model={_ai_config['model']}, provider={_ai_config['provider']}, has_key={bool(_ai_config['api_key'])}")
    
    return AIConfigResponse(
        enabled=_ai_config["enabled"],
        model=_ai_config["model"],
        provider=_ai_config["provider"],
        has_api_key=bool(_ai_config["api_key"])
    )


@router.get("/config", response_model=AIConfigResponse)
async def get_ai_config():
    """Get current AI configuration (without exposing API key)"""
    return AIConfigResponse(
        enabled=_ai_config["enabled"],
        model=_ai_config["model"],
        provider=_ai_config["provider"],
        has_api_key=bool(_ai_config["api_key"])
    )


class MaskedKeyResponse(BaseModel):
    """Response with masked API key"""
    masked_key: str
    has_key: bool
    source: str  # "env" | "manual" | "none"


@router.get("/config/key", response_model=MaskedKeyResponse)
async def get_masked_api_key():
    """Get masked API key for display in settings (shows first 8 and last 4 chars)"""
    api_key = _ai_config.get("api_key", "")
    
    if not api_key:
        return MaskedKeyResponse(
            masked_key="",
            has_key=False,
            source="none"
        )
    
    # Mask the key: show first 8 chars and last 4 chars
    if len(api_key) > 12:
        masked = f"{api_key[:8]}...{api_key[-4:]}"
    else:
        masked = "sk-****"
    
    # Determine source
    env_key = os.getenv("OPENAI_API_KEY", "")
    source = "env" if api_key == env_key else "manual"
    
    return MaskedKeyResponse(
        masked_key=masked,
        has_key=True,
        source=source
    )


def get_openai_api_key() -> str:
    """Utility function for other services to get the configured API key"""
    return _ai_config.get("api_key", "")

