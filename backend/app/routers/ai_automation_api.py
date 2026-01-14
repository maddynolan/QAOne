"""
AI-Enhanced Automation API
===========================

Endpoints for the high-impact AI features:
1. Unified Element Resolution (with AI fallback)
2. Failure Analysis (post-run)
3. AI Budget Management
"""

import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-automation", tags=["AI Automation"])


# ============================================================================
# Helper to get shared API key (same as explorer/flowmap)
# ============================================================================

def _get_shared_api_key() -> str:
    """Get API key from shared config (used by explorer/flowmap)."""
    try:
        from app.routers.vision_healing_api import get_openai_api_key
        return get_openai_api_key()
    except ImportError:
        import os
        return os.getenv("OPENAI_API_KEY", "")


# ============================================================================
# Request/Response Models
# ============================================================================

class ResolveElementRequest(BaseModel):
    """Request to resolve an element with AI fallback"""
    step: Dict[str, Any] = Field(..., description="Test step with selector info")
    page_url: str = Field(..., description="Current page URL")
    screenshot_b64: Optional[str] = Field(None, description="Base64 screenshot")
    dom_snippet: Optional[str] = Field(None, description="Relevant DOM snippet")
    app_type: str = Field("generic", description="Application type")
    enable_ai: bool = Field(True, description="Enable AI fallback")


class ResolveElementResponse(BaseModel):
    """Response with resolution result"""
    success: bool
    selector: str
    method: str  # primary, recipe, auto_heal, ai_vision, failed
    confidence: float
    ai_called: bool
    attempts: List[str]
    error: Optional[str] = None


class AnalyzeFailureRequest(BaseModel):
    """Request to analyze a test failure"""
    error_message: str = Field(..., description="The error that occurred")
    step_info: Dict[str, Any] = Field(..., description="Info about failed step")
    screenshot_b64: Optional[str] = Field(None, description="Screenshot at failure")
    dom_snapshot: Optional[str] = Field(None, description="DOM state")
    console_logs: Optional[List[str]] = Field(None, description="Console errors")
    network_errors: Optional[List[str]] = Field(None, description="Network errors")
    previous_steps: Optional[List[Dict[str, Any]]] = Field(None, description="Prior steps")


class AnalyzeFailureResponse(BaseModel):
    """Response with failure analysis"""
    root_cause: str
    category: str
    confidence: float
    explanation: str
    suggested_fix: str
    fix_type: str


class AIBudgetResponse(BaseModel):
    """AI usage budget status"""
    max_calls_per_run: int
    calls_used: int
    calls_remaining: int
    reset_at: Optional[str] = None


class AIUsageStats(BaseModel):
    """AI usage statistics"""
    today_calls: int
    today_cost_estimate: float
    this_month_calls: int
    this_month_cost_estimate: float
    healing_success_rate: float


# ============================================================================
# In-Memory Budget Tracking (for demo - use DB in production)
# ============================================================================

_budget_state = {
    "max_calls_per_run": 3,
    "current_run_calls": 0,
    "today_calls": 0,
    "today_date": datetime.now().strftime("%Y-%m-%d"),
    "month_calls": 0,
    "healing_successes": 0,
    "healing_attempts": 0
}


def _reset_daily_if_needed():
    """Reset daily counters if it's a new day"""
    today = datetime.now().strftime("%Y-%m-%d")
    if _budget_state["today_date"] != today:
        _budget_state["today_date"] = today
        _budget_state["today_calls"] = 0


def _record_ai_call(success: bool = True):
    """Record an AI call for tracking"""
    _reset_daily_if_needed()
    _budget_state["current_run_calls"] += 1
    _budget_state["today_calls"] += 1
    _budget_state["month_calls"] += 1
    _budget_state["healing_attempts"] += 1
    if success:
        _budget_state["healing_successes"] += 1


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/resolve-element", response_model=ResolveElementResponse)
async def resolve_element_with_ai(request: ResolveElementRequest):
    """
    Resolve an element using the unified resolver with AI fallback.
    
    This endpoint demonstrates the resolution flow:
    1. Try primary selector
    2. Try recipe-based selectors
    3. Try fallback chain
    4. AI Vision (if enabled and budget allows)
    
    NOTE: This is a SIMULATION endpoint for testing.
    In production, this runs within the Playwright context.
    """
    try:
        # Check AI budget
        can_use_ai = request.enable_ai and _budget_state["current_run_calls"] < _budget_state["max_calls_per_run"]
        
        # Simulate resolution flow
        step = request.step
        attempts = []
        
        # 1. Primary selector
        primary = step.get('selector') or step.get('selectorObj', {}).get('selector')
        if primary:
            attempts.append(f"Primary: {primary}")
        
        # 2. Recipe-based
        recipe = step.get('recipe', {})
        if recipe:
            what = recipe.get('what', {})
            if what.get('role'):
                attempts.append(f"Recipe (role): role={what['role']}")
            if what.get('text'):
                attempts.append(f"Recipe (text): text='{what['text']}'")
        
        # 3. Fallbacks from selectorObj
        fallbacks = step.get('selectorObj', {}).get('strategies', [])
        for fb in fallbacks[:3]:
            selector = fb.get('selector', fb.get('playwright', ''))
            if selector:
                attempts.append(f"Fallback: {selector}")
        
        # 4. AI Vision (simulate)
        if can_use_ai and not primary:
            attempts.append("AI Vision (would be called)")
            
            # In real implementation, this would call the vision service
            if request.screenshot_b64:
                try:
                    from app.services.ai.vision_self_healing import get_vision_healing_service
                    service = get_vision_healing_service()
                    
                    if service.available:
                        description = step.get('description') or step.get('text') or 'element'
                        result = await service.find_element_by_description(
                            screenshot_base64=request.screenshot_b64,
                            description=description,
                            context=f"App: {request.app_type}, URL: {request.page_url}"
                        )
                        
                        _record_ai_call(result.found)
                        
                        if result.found:
                            return ResolveElementResponse(
                                success=True,
                                selector=result.selector_suggestion or f"coordinates:{result.x},{result.y}",
                                method="ai_vision",
                                confidence=result.confidence,
                                ai_called=True,
                                attempts=attempts
                            )
                except Exception as e:
                    logger.warning(f"AI Vision failed: {e}")
                    attempts.append(f"AI Error: {str(e)}")
        
        # Return simulation result
        return ResolveElementResponse(
            success=bool(primary),
            selector=primary or "",
            method="primary" if primary else "failed",
            confidence=1.0 if primary else 0.0,
            ai_called=False,
            attempts=attempts,
            error=None if primary else "No selector found (simulation mode)"
        )
        
    except Exception as e:
        logger.error(f"Resolution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-failure", response_model=AnalyzeFailureResponse)
async def analyze_test_failure(request: AnalyzeFailureRequest):
    """
    Analyze a test failure using AI.
    
    This is a POST-RUN analysis - called after test execution,
    not during. Cost: ~$0.01-0.02 per analysis (GPT-4o-mini).
    
    Uses the same API key as explorer/flowmap (configured via /vision-healing/config).
    """
    try:
        from app.services.llm.failure_analyzer import get_failure_analyzer
        
        analyzer = get_failure_analyzer()
        
        # Refresh key from shared config in case it was updated
        if not analyzer.available:
            analyzer.refresh_api_key()
        
        if not analyzer.available:
            raise HTTPException(
                status_code=503,
                detail="Failure analyzer not available. Configure OPENAI_API_KEY."
            )
        
        # Track usage
        _record_ai_call()
        
        result = await analyzer.analyze_failure(
            error_message=request.error_message,
            step_info=request.step_info,
            screenshot_b64=request.screenshot_b64,
            dom_snapshot=request.dom_snapshot,
            console_logs=request.console_logs,
            network_errors=request.network_errors,
            previous_steps=request.previous_steps
        )
        
        return AnalyzeFailureResponse(
            root_cause=result.root_cause,
            category=result.category,
            confidence=result.confidence,
            explanation=result.explanation,
            suggested_fix=result.suggested_fix,
            fix_type=result.fix_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failure analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/budget", response_model=AIBudgetResponse)
async def get_ai_budget():
    """
    Get current AI usage budget for this test run.
    
    Budget resets at start of each test run.
    Default: 3 AI calls per run maximum.
    """
    _reset_daily_if_needed()
    
    return AIBudgetResponse(
        max_calls_per_run=_budget_state["max_calls_per_run"],
        calls_used=_budget_state["current_run_calls"],
        calls_remaining=max(0, _budget_state["max_calls_per_run"] - _budget_state["current_run_calls"])
    )


@router.post("/budget/reset")
async def reset_ai_budget():
    """Reset AI budget for a new test run."""
    _budget_state["current_run_calls"] = 0
    return {"status": "ok", "message": "Budget reset for new test run"}


@router.post("/budget/configure")
async def configure_ai_budget(max_calls: int = 3):
    """Configure the maximum AI calls per test run."""
    if max_calls < 0 or max_calls > 10:
        raise HTTPException(status_code=400, detail="max_calls must be between 0 and 10")
    
    _budget_state["max_calls_per_run"] = max_calls
    return {"status": "ok", "max_calls_per_run": max_calls}


@router.get("/usage-stats", response_model=AIUsageStats)
async def get_ai_usage_stats():
    """
    Get AI usage statistics.
    
    Useful for cost monitoring and optimization.
    """
    _reset_daily_if_needed()
    
    # Estimate costs (GPT-4o-mini pricing)
    cost_per_call = 0.015  # Approximate per call
    
    healing_rate = 0.0
    if _budget_state["healing_attempts"] > 0:
        healing_rate = _budget_state["healing_successes"] / _budget_state["healing_attempts"]
    
    return AIUsageStats(
        today_calls=_budget_state["today_calls"],
        today_cost_estimate=round(_budget_state["today_calls"] * cost_per_call, 2),
        this_month_calls=_budget_state["month_calls"],
        this_month_cost_estimate=round(_budget_state["month_calls"] * cost_per_call, 2),
        healing_success_rate=round(healing_rate, 2)
    )


@router.get("/health")
async def health_check():
    """Check if AI automation services are available."""
    services = {
        "vision_self_healing": False,
        "failure_analyzer": False,
        "unified_resolver": True,  # Always available (deterministic fallback)
        "step_validator": True     # Always available (no AI needed)
    }
    
    # Check if API key is configured
    api_key = _get_shared_api_key()
    
    try:
        from app.services.ai.vision_self_healing import get_vision_healing_service
        service = get_vision_healing_service()
        if not service.available and api_key:
            service.set_api_key(api_key)
        services["vision_self_healing"] = service.available
    except:
        pass
    
    try:
        from app.services.llm.failure_analyzer import get_failure_analyzer
        analyzer = get_failure_analyzer()
        if not analyzer.available and api_key:
            analyzer.refresh_api_key()
        services["failure_analyzer"] = analyzer.available
    except:
        pass
    
    return {
        "status": "ok",
        "services": services,
        "ai_enabled": any([services["vision_self_healing"], services["failure_analyzer"]]),
        "has_api_key": bool(api_key),
        "budget": {
            "calls_remaining": max(0, _budget_state["max_calls_per_run"] - _budget_state["current_run_calls"])
        }
    }


# ============================================================================
# Step Validation Endpoints (No AI - Always Available)
# ============================================================================

class ValidateStepsRequest(BaseModel):
    """Request to validate recorded steps"""
    steps: List[Dict[str, Any]] = Field(..., description="List of recorded steps")
    strict: bool = Field(False, description="Strict mode - don't auto-fix")


class ValidationReport(BaseModel):
    """Validation report for steps"""
    total_steps: int
    valid_steps: int
    removed_steps: int
    modified_steps: int
    quality_score: float
    issues_found: int
    issue_breakdown: Dict[str, int]


class ValidateStepsResponse(BaseModel):
    """Response with cleaned steps and report"""
    cleaned_steps: List[Dict[str, Any]]
    report: ValidationReport


@router.post("/validate-steps", response_model=ValidateStepsResponse)
async def validate_recorded_steps(request: ValidateStepsRequest):
    """
    Validate and clean recorded steps.
    
    This catches "garbage steps" like:
    - Clicks on React internal elements
    - Invalid/empty selectors
    - Duplicate consecutive actions
    - Clicks on non-interactive elements
    
    No AI required - runs locally, instant.
    """
    try:
        from app.services.automation.step_validator import validate_and_clean_flow
        
        cleaned_steps, report = validate_and_clean_flow(
            steps=request.steps,
            strict=request.strict
        )
        
        return ValidateStepsResponse(
            cleaned_steps=cleaned_steps,
            report=ValidationReport(
                total_steps=report['total_steps'],
                valid_steps=report['valid_steps'],
                removed_steps=report['removed_steps'],
                modified_steps=report['modified_steps'],
                quality_score=report['quality_score'],
                issues_found=report['issues_found'],
                issue_breakdown=report['issue_breakdown']
            )
        )
        
    except Exception as e:
        logger.error(f"Step validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quality-score")
async def get_flow_quality(request: ValidateStepsRequest):
    """
    Get quality score for a recorded flow (0-100).
    
    Quick check to see if recording is usable.
    """
    try:
        from app.services.automation.step_validator import get_flow_quality_score
        
        score = get_flow_quality_score(request.steps)
        
        return {
            "quality_score": score,
            "rating": "excellent" if score >= 90 else "good" if score >= 70 else "fair" if score >= 50 else "poor",
            "recommendation": (
                "Ready for playback" if score >= 70 
                else "Review flagged steps before playback" if score >= 50 
                else "Recording has significant issues - consider re-recording"
            )
        }
        
    except Exception as e:
        logger.error(f"Quality score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
