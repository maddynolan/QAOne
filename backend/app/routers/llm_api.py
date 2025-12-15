"""
LLM API Router - Cost-Optimized Claude Integration
===================================================

Endpoints for AI-powered test generation with prompt caching.
"""

import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/llm", tags=["llm"])


class GenerateTestRequest(BaseModel):
    """Request model for test generation"""
    page_context: str
    user_request: str
    app_type: str = "generic"
    task_type: str = "test_generation"
    use_cache: bool = True


class GenerateSelectorRequest(BaseModel):
    """Request model for selector generation"""
    element_html: str
    app_type: str = "generic"


class AnalyzeFailureRequest(BaseModel):
    """Request model for failure analysis"""
    error_message: str
    test_code: str
    page_context: str = ""


@router.post("/generate-test")
async def generate_test(request: GenerateTestRequest) -> Dict[str, Any]:
    """
    Generate a Playwright test using Claude with prompt caching.
    
    Cost optimization:
    - Static content (prompts, docs) is cached (90% cheaper on subsequent calls)
    - Identical requests are cached locally (100% free)
    - Simple tasks use cheaper Haiku model
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        result = await service.generate_test(
            page_context=request.page_context,
            user_request=request.user_request,
            app_type=request.app_type,
            task_type=request.task_type,
            use_cache=request.use_cache
        )
        
        return {
            "success": not result.get("error", False),
            "test_code": result.get("content", ""),
            "model": result.get("model"),
            "from_cache": result.get("from_cache", False),
            "usage": result.get("usage", {})
        }
        
    except Exception as e:
        logger.error(f"Generate test error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-selector")
async def generate_selector(request: GenerateSelectorRequest) -> Dict[str, Any]:
    """
    Generate a robust selector for an element.
    Uses cheaper Haiku model for this simple task.
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        result = await service.generate_selector(
            element_html=request.element_html,
            app_type=request.app_type
        )
        
        return {
            "success": not result.get("error", False),
            "selector": result.get("content", ""),
            "model": result.get("model"),
            "usage": result.get("usage", {})
        }
        
    except Exception as e:
        logger.error(f"Generate selector error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_llm_status() -> Dict[str, Any]:
    """
    Get LLM service status including rate limit information.
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        # Check API key
        api_configured = service.api_key is not None and len(service.api_key) > 0
        anthropic_available = service.async_client is not None
        
        # Get rate limit status
        rate_limit_status = service.get_rate_limit_status()
        
        # Get usage stats
        usage_stats = service.usage_tracker.get_summary()
        
        return {
            "anthropic_available": anthropic_available,
            "api_configured": api_configured,
            "rate_limit": rate_limit_status,
            "usage_stats": usage_stats,
            "can_make_requests": anthropic_available and api_configured and not rate_limit_status.get("rate_limit_active", False)
        }
        
    except Exception as e:
        logger.error(f"Status check error: {e}")
        return {
            "anthropic_available": False,
            "api_configured": False,
            "error": str(e),
            "can_make_requests": False
        }


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Simple health check endpoint.
    """
    return await get_llm_status()


@router.post("/analyze-failure")
async def analyze_failure(request: AnalyzeFailureRequest) -> Dict[str, Any]:
    """
    Analyze a test failure and suggest fixes.
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        result = await service.analyze_test_failure(
            error_message=request.error_message,
            test_code=request.test_code,
            page_context=request.page_context
        )
        
        return {
            "success": not result.get("error", False),
            "analysis": result.get("content", ""),
            "model": result.get("model"),
            "usage": result.get("usage", {})
        }
        
    except Exception as e:
        logger.error(f"Analyze failure error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage-stats")
async def get_usage_stats() -> Dict[str, Any]:
    """
    Get comprehensive LLM usage statistics, cache stats, and cost summary.
    
    Returns:
    - Total requests and cache hit rates
    - Token usage and costs
    - Estimated savings from caching
    - SQLite cache statistics
    - Cost optimization tips
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        # Get comprehensive stats including new cache system
        stats = service.get_usage_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Get usage stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-stats")
async def get_cache_stats() -> Dict[str, Any]:
    """
    Get detailed cache statistics from the SQLite-backed PromptCache.
    
    Returns:
    - Total entries and hit rates
    - Stats by task type
    - Cache configuration (TTLs, thresholds)
    - Tokens saved estimates
    """
    try:
        from app.services.llm.prompt_cache import get_prompt_cache
        cache = get_prompt_cache()
        
        return {
            "success": True,
            "cache_stats": cache.get_stats()
        }
        
    except Exception as e:
        logger.error(f"Get cache stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ClearCacheRequest(BaseModel):
    """Request model for clearing cache"""
    task_type: Optional[str] = None  # If None, clears all


@router.post("/clear-cache")
async def clear_cache(request: Optional[ClearCacheRequest] = None) -> Dict[str, Any]:
    """
    Clear the LLM response cache.
    
    Args:
        task_type: Optional - clear only cache for specific task type
                   (e.g., "test_generation", "selector_generation")
                   If not provided, clears entire cache.
    """
    try:
        from app.services.llm.cached_claude_service import get_cached_claude_service
        service = get_cached_claude_service()
        
        task_type = request.task_type if request else None
        service.clear_local_cache(task_type)
        
        return {
            "success": True,
            "message": f"Cache cleared" + (f" for task_type={task_type}" if task_type else " (all)")
        }
        
    except Exception as e:
        logger.error(f"Clear cache error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Check if the LLM service is configured and ready.
    Includes rate limit status.
    """
    return await get_llm_status()



