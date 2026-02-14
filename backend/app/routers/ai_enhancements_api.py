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


# ============================================================================
# AUTO-FIX STEP - AI-powered healing when user clicks "Fix"
# ============================================================================

class AutoFixStepRequest(BaseModel):
    """Request to auto-fix a failed/flagged step using AI healing chain."""
    test_id: str
    step_id: str
    step_index: int = 0
    step_label: str = ""
    failed_selector: str = ""
    error_message: str = ""
    step_info: Dict[str, Any] = Field(default_factory=dict)
    screenshot_b64: Optional[str] = None
    page_html: Optional[str] = None
    page_url: Optional[str] = None


class AutoFixAttempt(BaseModel):
    strategy: str
    selector: str
    success: bool
    duration_ms: int = 0


class AutoFixStepResponse(BaseModel):
    """Response with auto-fix result."""
    success: bool
    fixed_selector: Optional[str] = None
    strategy_used: Optional[str] = None
    confidence: float = 0.0
    attempts: List[AutoFixAttempt] = []
    message: str = ""
    needs_manual_fix: bool = True


@router.post("/auto-fix-step", response_model=AutoFixStepResponse)
async def auto_fix_step(request: AutoFixStepRequest):
    """
    Attempt to automatically fix a failed/flagged step using the healing chain.

    Called when user clicks "Fix" on a failed step. Tries AI healing first,
    then returns whether manual fix is needed.

    Healing chain: Knowledge → Deterministic → Vision AI → OCR
    """
    try:
        from app.services.automation.healing_orchestrator import get_healing_orchestrator

        orchestrator = get_healing_orchestrator()

        intent_dict = {
            "description": request.step_label,
            "text": request.step_info.get("text", ""),
            "role": request.step_info.get("role", ""),
        }

        result = await orchestrator.heal(
            test_code="",  # Not needed for selector-only fix
            failed_selector=request.failed_selector,
            error_message=request.error_message,
            step_info=request.step_info,
            screenshot_b64=request.screenshot_b64,
            page_html=request.page_html,
            page_url=request.page_url,
            intent_dict=intent_dict,
        )

        attempts = [
            AutoFixAttempt(
                strategy=a.strategy,
                selector=a.selector_tried[:200],
                success=a.success,
                duration_ms=a.duration_ms,
            )
            for a in result.attempts
        ]

        if result.healed:
            # Record success for future runs
            orchestrator.record_healing_success(
                intent_dict=intent_dict,
                strategy=result.winning_strategy,
                selector=result.healed_selector,
                attributes={},
                context={"url": request.page_url or "", "test_id": request.test_id},
            )

            # Resolve any existing false-positive flag
            try:
                fp_svc = _get_fp_service()
                fp_svc.resolve_flag(request.test_id, request.step_id)
            except Exception:
                pass

            return AutoFixStepResponse(
                success=True,
                fixed_selector=result.healed_selector,
                strategy_used=result.winning_strategy,
                confidence=result.confidence,
                attempts=attempts,
                message=f"Fixed using {result.winning_strategy} strategy",
                needs_manual_fix=False,
            )

        return AutoFixStepResponse(
            success=False,
            attempts=attempts,
            message="Auto-fix unsuccessful. Please fix manually.",
            needs_manual_fix=True,
        )

    except Exception as e:
        logger.error(f"Auto-fix error: {e}")
        return AutoFixStepResponse(
            success=False,
            message=f"Auto-fix error: {str(e)}",
            needs_manual_fix=True,
        )


# ============================================================================
# DETECT FALSE POSITIVE - Vision-based automatic false-positive detection
# ============================================================================

class DetectFalsePositiveRequest(BaseModel):
    """Request to detect if a failure is a false positive."""
    test_id: str
    step_id: str
    step_index: int = 0
    step_label: str = ""
    failed_selector: str = ""
    screenshot_b64: str = ""
    page_url: Optional[str] = None
    step_info: Dict[str, Any] = Field(default_factory=dict)


@router.post("/detect-false-positive")
async def detect_false_positive(request: DetectFalsePositiveRequest):
    """
    Vision-based false positive detection.

    If a step failed but the element is visually present on the page
    (confidence > 70%), auto-flag it as a false positive.

    Called automatically after test failure if screenshot is available.
    """
    if not request.screenshot_b64:
        return {"is_false_positive": False, "reason": "No screenshot available"}

    try:
        from app.services.automation.healing_orchestrator import get_healing_orchestrator

        orchestrator = get_healing_orchestrator()
        element_desc = request.step_label or request.step_info.get("description", "element")

        result = await orchestrator.detect_false_positive(
            screenshot_b64=request.screenshot_b64,
            element_description=element_desc,
            page_url=request.page_url,
        )

        if result.get("is_false_positive"):
            # Auto-flag it
            try:
                fp_svc = _get_fp_service()
                from app.services.ai.ai_enhancements import FalsePositiveFlag
                fp_svc.save_flag(request.test_id, FalsePositiveFlag(
                    step_id=request.step_id,
                    step_index=request.step_index,
                    step_label=request.step_label,
                    screenshot=None,
                    reason=f"Auto-detected: Element visually present (confidence {result.get('confidence', 0):.0%}) but selector failed",
                    flagged_at=datetime.utcnow().isoformat(),
                    flagged_by="ai_vision",
                ))
            except Exception as e:
                logger.debug(f"Could not auto-flag false positive: {e}")

        return result

    except Exception as e:
        logger.error(f"False positive detection error: {e}")
        return {"is_false_positive": False, "reason": f"Detection error: {str(e)}"}


# ============================================================================
# MANUAL ASSIST — User-provided DOM / selector / screenshot for fixing steps
# ============================================================================

class ManualAssistRequest(BaseModel):
    """Request for manual-assist selector generation."""
    mode: str = Field(..., description="paste_element | enter_selector | paste_screenshot")
    test_id: str
    step_id: str
    step_index: int = 0
    step_label: str = ""
    # Mode-specific fields
    html_content: Optional[str] = Field(None, description="Pasted outerHTML from DevTools (paste_element mode)")
    selector_type: Optional[str] = Field(None, description="css | xpath | text (enter_selector mode)")
    selector_value: Optional[str] = Field(None, description="User-entered selector (enter_selector mode)")
    screenshot_b64: Optional[str] = Field(None, description="Base64 screenshot (paste_screenshot mode)")
    failed_selector: Optional[str] = Field(None, description="Original broken selector for context")
    page_url: Optional[str] = None


class SelectorCandidate(BaseModel):
    strategy: str
    selector: str
    confidence: float = 0.0
    description: str = ""
    playwright_locator: str = ""


class ManualAssistResponse(BaseModel):
    success: bool
    selectors: List[SelectorCandidate] = []
    recommended_selector: Optional[str] = None
    message: str = ""


@router.post("/manual-assist", response_model=ManualAssistResponse)
async def manual_assist(request: ManualAssistRequest):
    """
    Manual assist endpoint — generates selectors from user-provided input
    when AI auto-fix and Smart Suggestions both fail.

    Three modes:
      - paste_element: User pastes outerHTML from DevTools → parse → generate selectors
      - enter_selector: User types CSS/XPath/text selector → validate → format
      - paste_screenshot: User provides screenshot → Vision AI → suggest selectors
    """
    mode = (request.mode or "").lower().strip()

    if mode == "paste_element":
        return _handle_paste_element(request)
    elif mode == "enter_selector":
        return _handle_enter_selector(request)
    elif mode == "paste_screenshot":
        return await _handle_paste_screenshot(request)
    else:
        return ManualAssistResponse(
            success=False,
            message=f"Unknown mode: {mode}. Use paste_element, enter_selector, or paste_screenshot.",
        )


def _handle_paste_element(request: ManualAssistRequest) -> ManualAssistResponse:
    """Parse pasted HTML and generate robust selectors."""
    if not request.html_content or not request.html_content.strip():
        return ManualAssistResponse(
            success=False,
            message="No HTML content provided. Paste the element's outerHTML from DevTools.",
        )

    try:
        from app.services.automation.dom_element_parser import parse_and_generate_selectors

        result = parse_and_generate_selectors(request.html_content)

        if result.get("error"):
            return ManualAssistResponse(
                success=False,
                message=result["error"],
            )

        # Convert candidates to response format
        candidates = []
        all_candidates = result.get("all_candidates", [])

        for c in all_candidates:
            candidates.append(SelectorCandidate(
                strategy=c.strategy.name if hasattr(c.strategy, 'name') else str(c.strategy),
                selector=c.selector,
                confidence=c.confidence,
                description=c.description,
                playwright_locator=c.playwright_locator,
            ))

        # Sort by confidence descending
        candidates.sort(key=lambda x: x.confidence, reverse=True)

        recommended = result.get("primary", "")
        if not recommended and candidates:
            recommended = candidates[0].selector

        return ManualAssistResponse(
            success=True,
            selectors=candidates,
            recommended_selector=recommended,
            message=f"Generated {len(candidates)} selector(s) from pasted element.",
        )

    except Exception as e:
        logger.error(f"Manual assist paste_element error: {e}")
        return ManualAssistResponse(
            success=False,
            message=f"Failed to parse element: {str(e)}",
        )


def _handle_enter_selector(request: ManualAssistRequest) -> ManualAssistResponse:
    """Validate a user-entered selector and format as Playwright locator."""
    if not request.selector_value or not request.selector_value.strip():
        return ManualAssistResponse(
            success=False,
            message="No selector value provided.",
        )

    try:
        from app.services.automation.dom_element_parser import validate_selector

        result = validate_selector(
            selector_type=request.selector_type or "css",
            selector_value=request.selector_value,
        )

        if not result.get("valid"):
            return ManualAssistResponse(
                success=False,
                message=result.get("message", "Invalid selector"),
            )

        candidate = SelectorCandidate(
            strategy=result.get("strategy", "css"),
            selector=result["selector"],
            confidence=result.get("confidence", 0.80),
            description=result.get("message", "User-provided selector"),
            playwright_locator=result.get("playwright_locator", ""),
        )

        return ManualAssistResponse(
            success=True,
            selectors=[candidate],
            recommended_selector=result["selector"],
            message=result.get("message", "Selector validated successfully."),
        )

    except Exception as e:
        logger.error(f"Manual assist enter_selector error: {e}")
        return ManualAssistResponse(
            success=False,
            message=f"Selector validation failed: {str(e)}",
        )


async def _handle_paste_screenshot(request: ManualAssistRequest) -> ManualAssistResponse:
    """Use Vision AI to analyze a screenshot and suggest selectors."""
    if not request.screenshot_b64:
        return ManualAssistResponse(
            success=False,
            message="No screenshot provided. Paste or upload a screenshot of the element area.",
        )

    try:
        from app.services.automation.healing_orchestrator import get_healing_orchestrator

        orchestrator = get_healing_orchestrator()
        element_desc = request.step_label or "the target element"

        # Use the orchestrator's vision healing to find the element in screenshot
        result = await orchestrator.detect_false_positive(
            screenshot_b64=request.screenshot_b64,
            element_description=element_desc,
            page_url=request.page_url,
        )

        candidates = []

        # If vision found the element, try to generate a selector suggestion
        if result.get("suggested_selector"):
            candidates.append(SelectorCandidate(
                strategy="vision_ai",
                selector=result["suggested_selector"],
                confidence=result.get("confidence", 0.70),
                description=f"AI-identified from screenshot: {result.get('reason', '')}",
                playwright_locator=f"page.locator('{result['suggested_selector']}')",
            ))

        if result.get("coordinates"):
            coords = result["coordinates"]
            # Coordinate-based click as fallback
            candidates.append(SelectorCandidate(
                strategy="coordinates",
                selector=f"click({coords['x']}, {coords['y']})",
                confidence=0.50,
                description=f"Click at coordinates ({coords['x']}, {coords['y']}) — use as last resort",
                playwright_locator=f"page.click({{ position: {{ x: {coords['x']}, y: {coords['y']} }} }})",
            ))

        if not candidates:
            # Try the full healing chain with screenshot
            try:
                heal_result = await orchestrator.heal(
                    test_code="",
                    failed_selector=request.failed_selector or "",
                    error_message=f"Element not found: {element_desc}",
                    step_info={"description": element_desc},
                    screenshot_b64=request.screenshot_b64,
                    page_url=request.page_url,
                    intent_dict={"description": element_desc},
                )
                if heal_result.healed:
                    candidates.append(SelectorCandidate(
                        strategy=heal_result.winning_strategy or "ai_healing",
                        selector=heal_result.healed_selector,
                        confidence=heal_result.confidence,
                        description=f"AI healing found selector via {heal_result.winning_strategy}",
                        playwright_locator=f"page.locator('{heal_result.healed_selector}')",
                    ))
            except Exception as heal_err:
                logger.debug(f"Healing chain during screenshot assist failed: {heal_err}")

        if not candidates:
            return ManualAssistResponse(
                success=False,
                message="Could not identify the element from the screenshot. Try pasting the element HTML instead.",
            )

        recommended = candidates[0].selector if candidates else None

        return ManualAssistResponse(
            success=True,
            selectors=candidates,
            recommended_selector=recommended,
            message=f"Found {len(candidates)} selector(s) from screenshot analysis.",
        )

    except Exception as e:
        logger.error(f"Manual assist paste_screenshot error: {e}")
        return ManualAssistResponse(
            success=False,
            message=f"Screenshot analysis failed: {str(e)}. Try pasting element HTML instead.",
        )
