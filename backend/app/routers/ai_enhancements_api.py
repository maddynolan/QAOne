"""
AI Enhancements API Router
============================

Independent API endpoints that ENHANCE existing workflows.
All endpoints are additive — they don't modify any existing routers.

The existing flow (manual false-positive flagging, basic failure messages,
user fix buttons) continues to work exactly as before.

These endpoints add:
  1. False-positive persistence (save/load across sessions)
  2. Flaky step detection (per-step analytics)
  3. AI failure explanation with multiple fix options

Prefix: /api/ai/enhancements
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/enhancements", tags=["ai-enhancements"])


# ============================================================================
# Request/Response Models
# ============================================================================

class FalsePositiveFlagRequest(BaseModel):
    """Request to flag a step as false positive."""
    test_id: str = Field(..., description="Test/recording ID")
    step_id: str = Field(..., description="Action ID of the step")
    step_index: int = Field(..., description="Step index in action list")
    step_label: str = Field("", description="Human-readable step label")
    screenshot: Optional[str] = Field(None, description="Base64 screenshot (auto-truncated)")
    reason: Optional[str] = Field(None, description="User-provided reason")

    class Config:
        json_schema_extra = {
            "example": {
                "test_id": "rec_abc123",
                "step_id": "action_456",
                "step_index": 3,
                "step_label": "Click Submit",
                "reason": "Button moved after page redesign"
            }
        }


class FalsePositiveFlagResponse(BaseModel):
    success: bool
    message: str
    flags: List[Dict[str, Any]] = []


class StepResultBatchRequest(BaseModel):
    """Batch record step results from a test run."""
    test_id: str
    run_id: str = Field(default="")
    step_results: List[Dict[str, Any]] = Field(
        ...,
        description="Array of step results: {step_id, index, label, status, error, duration_ms, healed}"
    )


class ExplainFailureRequest(BaseModel):
    """Request AI explanation for a failure."""
    test_id: str
    step_id: str
    step_index: int = 0
    step_label: str = ""
    error_message: str = ""
    step_info: Dict[str, Any] = Field(default_factory=dict)
    screenshot_b64: Optional[str] = None
    dom_snapshot: Optional[str] = None
    console_logs: Optional[List[str]] = None
    previous_steps: Optional[List[Dict[str, Any]]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "test_id": "rec_abc123",
                "step_id": "action_456",
                "step_index": 3,
                "step_label": "Click Submit",
                "error_message": "locator.click: Timeout 30000ms exceeded. Waiting for locator('#submit-btn')",
                "step_info": {"action": "click", "selector": "#submit-btn"}
            }
        }


class FixOptionResponse(BaseModel):
    fix_id: str
    title: str
    description: str
    fix_type: str
    confidence: float
    auto_applicable: bool
    details: Dict[str, Any] = {}


class FailureExplanationResponse(BaseModel):
    step_id: str
    step_label: str
    failure_type: str
    plain_explanation: str
    technical_detail: str = ""
    root_cause: str
    confidence: float
    fix_options: List[FixOptionResponse] = []
    is_known_flaky: bool = False
    flakiness_score: float = 0.0
    was_previously_flagged: bool = False
    ai_enhanced: bool = False


# ============================================================================
# Service accessors (lazy import to avoid circular deps)
# ============================================================================

def _get_fp_service():
    from app.services.ai.ai_enhancements import get_false_positive_service
    return get_false_positive_service()


def _get_flaky_tracker():
    from app.services.ai.ai_enhancements import get_flaky_step_tracker
    return get_flaky_step_tracker()


def _get_explainer():
    from app.services.ai.ai_enhancements import get_failure_explainer
    return get_failure_explainer()


# ============================================================================
# STATUS
# ============================================================================

@router.get("/status")
async def get_enhancement_status():
    """
    Check what AI enhancement features are available.
    
    Returns availability of each service:
    - false_positives: Always available (no AI needed)
    - flaky_detection: Always available (no AI needed)
    - ai_explanation: Available only if OpenAI API key is configured
    """
    explainer = _get_explainer()
    return {
        "services": {
            "false_positive_persistence": {"available": True, "requires_ai": False},
            "flaky_step_detection": {"available": True, "requires_ai": False},
            "ai_failure_explanation": {
                "available": explainer.ai_available,
                "requires_ai": True,
                "note": "Set OPENAI_API_KEY to enable AI-powered explanations"
                        if not explainer.ai_available else "AI explanations active"
            }
        },
        "note": "All features work independently. AI explanation is optional — "
                "basic fix options are always available without AI."
    }


# ============================================================================
# FALSE POSITIVE ENDPOINTS
# ============================================================================

@router.post("/false-positives", response_model=FalsePositiveFlagResponse)
async def save_false_positive(request: FalsePositiveFlagRequest):
    """
    Save a false-positive flag for a step.
    
    This persists the flag so it survives page refreshes and session restarts.
    The existing in-memory flow in PlaywrightRecorderPage still works —
    this just adds persistence behind it.
    """
    from app.services.ai.ai_enhancements import FalsePositiveFlag
    
    svc = _get_fp_service()
    flag = FalsePositiveFlag(
        step_id=request.step_id,
        step_index=request.step_index,
        step_label=request.step_label,
        screenshot=request.screenshot,
        reason=request.reason,
        flagged_at=datetime.utcnow().isoformat(),
        flagged_by="user"
    )
    
    success = svc.save_flag(request.test_id, flag)
    flags = svc.get_flags(request.test_id)
    
    return FalsePositiveFlagResponse(
        success=success,
        message=f"Step '{request.step_label}' flagged as false positive" if success else "Failed to save flag",
        flags=flags
    )


@router.get("/false-positives/{test_id}")
async def get_false_positives(test_id: str):
    """
    Get all false-positive flags for a test/recording.
    
    Called on page load to restore flags from previous sessions.
    """
    svc = _get_fp_service()
    flags = svc.get_flags(test_id)
    return {
        "test_id": test_id,
        "flags": flags,
        "count": len(flags)
    }


@router.delete("/false-positives/{test_id}/{step_id}")
async def remove_false_positive(test_id: str, step_id: str):
    """Remove a false-positive flag (unflag a step)."""
    svc = _get_fp_service()
    removed = svc.remove_flag(test_id, step_id)
    return {
        "success": removed,
        "message": "Flag removed" if removed else "Flag not found"
    }


@router.post("/false-positives/{test_id}/{step_id}/resolve")
async def resolve_false_positive(test_id: str, step_id: str):
    """Mark a false-positive flag as resolved (step was fixed)."""
    svc = _get_fp_service()
    resolved = svc.resolve_flag(test_id, step_id)
    return {
        "success": resolved,
        "message": "Flag marked as resolved" if resolved else "Flag not found"
    }


@router.get("/false-positives-analytics/most-flagged")
async def get_most_flagged_steps(limit: int = 20):
    """
    Analytics: Get steps most frequently flagged as false positives.
    
    Useful for identifying systematic selector issues across tests.
    """
    svc = _get_fp_service()
    return {
        "most_flagged": svc.get_most_flagged_steps(limit=limit)
    }


# ============================================================================
# FLAKY STEP ENDPOINTS
# ============================================================================

@router.post("/flaky-steps/record")
async def record_step_results(request: StepResultBatchRequest):
    """
    Record step results from a test run for flaky detection.
    
    Call this after each test run completes. The tracker accumulates
    per-step history and calculates flakiness scores.
    """
    svc = _get_flaky_tracker()
    svc.record_batch(request.test_id, request.run_id, request.step_results)
    return {
        "success": True,
        "message": f"Recorded {len(request.step_results)} step results for flaky tracking"
    }


@router.get("/flaky-steps/{test_id}")
async def get_flaky_steps(test_id: str):
    """
    Get flaky step analysis for a test.
    
    Returns all steps with their flakiness scores, sorted by score descending.
    Steps with score >= 0.25 are marked as flaky.
    """
    svc = _get_flaky_tracker()
    flaky_steps = svc.get_flaky_steps(test_id)
    return {
        "test_id": test_id,
        "flaky_steps": flaky_steps,
        "total_flaky": sum(1 for s in flaky_steps if s["is_flaky"]),
        "threshold": svc.flakiness_threshold
    }


@router.get("/flaky-steps/{test_id}/{step_id}/history")
async def get_step_history(test_id: str, step_id: str):
    """Get full execution history for a specific step."""
    svc = _get_flaky_tracker()
    history = svc.get_step_history(test_id, step_id)
    return {
        "test_id": test_id,
        "step_id": step_id,
        "history": history,
        "total_executions": len(history)
    }


# ============================================================================
# AI FAILURE EXPLANATION ENDPOINTS
# ============================================================================

@router.post("/explain-failure", response_model=FailureExplanationResponse)
async def explain_failure(request: ExplainFailureRequest):
    """
    Get an AI-enhanced failure explanation with multiple fix options.
    
    This is the key endpoint that provides rich failure context:
    - Plain-language explanation (always available)
    - Technical detail (with AI)
    - 3-5 specific fix options with confidence scores
    - Flaky step context (if this step has a history of flipping)
    - False positive context (if this step was previously flagged)
    
    Without AI key: Returns basic classification + standard fix options.
    With AI key: Returns enhanced explanation + AI-suggested fix.
    
    Cost: ~$0.01 per call (GPT-4o-mini).
    """
    explainer = _get_explainer()
    
    result = await explainer.explain_failure(
        test_id=request.test_id,
        step_id=request.step_id,
        step_index=request.step_index,
        step_label=request.step_label,
        error_message=request.error_message,
        step_info=request.step_info,
        screenshot_b64=request.screenshot_b64,
        dom_snapshot=request.dom_snapshot,
        console_logs=request.console_logs,
        previous_steps=request.previous_steps
    )
    
    return FailureExplanationResponse(
        step_id=result.step_id,
        step_label=result.step_label,
        failure_type=result.failure_type,
        plain_explanation=result.plain_explanation,
        technical_detail=result.technical_detail,
        root_cause=result.root_cause,
        confidence=result.confidence,
        fix_options=[
            FixOptionResponse(
                fix_id=fo.fix_id,
                title=fo.title,
                description=fo.description,
                fix_type=fo.fix_type,
                confidence=fo.confidence,
                auto_applicable=fo.auto_applicable,
                details=fo.details
            )
            for fo in result.fix_options
        ],
        is_known_flaky=result.is_known_flaky,
        flakiness_score=result.flakiness_score,
        was_previously_flagged=result.was_previously_flagged,
        ai_enhanced=explainer.ai_available
    )


@router.post("/explain-failure/batch")
async def explain_failures_batch(failures: List[ExplainFailureRequest]):
    """
    Batch explain multiple failures from a single test run.
    
    More efficient than calling explain-failure for each step individually.
    Limits to 10 failures per batch for cost control.
    """
    if len(failures) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 failures per batch")
    
    explainer = _get_explainer()
    results = []
    
    for req in failures:
        result = await explainer.explain_failure(
            test_id=req.test_id,
            step_id=req.step_id,
            step_index=req.step_index,
            step_label=req.step_label,
            error_message=req.error_message,
            step_info=req.step_info,
            screenshot_b64=req.screenshot_b64,
            dom_snapshot=req.dom_snapshot,
            console_logs=req.console_logs,
            previous_steps=req.previous_steps
        )
        
        results.append(FailureExplanationResponse(
            step_id=result.step_id,
            step_label=result.step_label,
            failure_type=result.failure_type,
            plain_explanation=result.plain_explanation,
            technical_detail=result.technical_detail,
            root_cause=result.root_cause,
            confidence=result.confidence,
            fix_options=[
                FixOptionResponse(
                    fix_id=fo.fix_id,
                    title=fo.title,
                    description=fo.description,
                    fix_type=fo.fix_type,
                    confidence=fo.confidence,
                    auto_applicable=fo.auto_applicable,
                    details=fo.details
                )
                for fo in result.fix_options
            ],
            is_known_flaky=result.is_known_flaky,
            flakiness_score=result.flakiness_score,
            was_previously_flagged=result.was_previously_flagged,
            ai_enhanced=explainer.ai_available
        ))
    
    return {
        "explanations": results,
        "count": len(results),
        "ai_enhanced": explainer.ai_available
    }
