"""
HEALING ORCHESTRATOR
====================
Unified layered self-healing pipeline for test execution.

Chain order (fastest to slowest):
  1. Healing Knowledge Lookup (SelfHealingController) - ~0ms, cached JSON
  2. Deterministic Selector Variants - ~0ms, string transforms
  3. Vision AI Healing (GPT-4o) - ~2-5s, requires screenshot + OPENAI_API_KEY
  4. OCR Fallback (Tesseract) - ~500ms, requires screenshot + Tesseract

Returns early on first success. Budget-controlled via ai_automation_api.
Records successes to SelfHealingController for future runs.
"""

import re
import time
import logging
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


@dataclass
class HealingAttempt:
    """Record of a single healing attempt within the chain."""
    strategy: str       # "knowledge", "deterministic", "vision_ai", "ocr", "failed"
    selector_tried: str
    success: bool
    confidence: float
    duration_ms: int
    error: Optional[str] = None


@dataclass
class HealingPipelineResult:
    """Complete result from the healing orchestrator."""
    healed: bool
    original_selector: str
    healed_selector: Optional[str] = None
    healed_code: Optional[str] = None
    winning_strategy: Optional[str] = None
    confidence: float = 0.0
    attempts: List[HealingAttempt] = field(default_factory=list)
    ai_calls_made: int = 0


class HealingOrchestrator:
    """
    Coordinates all healing services into a single layered pipeline.

    Reuses existing services:
    - SelfHealingController (flowstral_engine/self_healer.py)
    - VisionSelfHealingService (ai/vision_self_healing.py)
    - OCR fallback (routers/ocr_fallback_api.py)
    """

    def __init__(self):
        self._healing_controller = None
        self._vision_service = None
        self._initialized = False

    def _init_services(self):
        """Lazy-init services to avoid import issues at module load time."""
        if self._initialized:
            return
        self._initialized = True

        # SelfHealingController
        try:
            from app.services.flowstral_engine.self_healer import SelfHealingController
            self._healing_controller = SelfHealingController()
            logger.info("[HealingOrchestrator] SelfHealingController loaded")
        except Exception as e:
            logger.warning(f"[HealingOrchestrator] SelfHealingController unavailable: {e}")

        # VisionSelfHealingService
        try:
            from app.services.ai.vision_self_healing import get_vision_healing_service
            self._vision_service = get_vision_healing_service()
            if self._vision_service and self._vision_service.available:
                logger.info("[HealingOrchestrator] VisionSelfHealingService loaded")
            else:
                logger.info("[HealingOrchestrator] VisionSelfHealingService not available (no API key)")
                self._vision_service = None
        except Exception as e:
            logger.warning(f"[HealingOrchestrator] VisionSelfHealingService unavailable: {e}")

    def _check_ai_budget(self) -> bool:
        """Check if we can make an AI call within budget."""
        try:
            from app.routers.ai.ai_automation_api import _budget_state
            return _budget_state["current_run_calls"] < _budget_state["max_calls_per_run"]
        except Exception:
            return True  # If budget module not available, allow calls

    def _record_ai_call(self, success: bool):
        """Record an AI call for budget tracking."""
        try:
            from app.routers.ai.ai_automation_api import record_ai_usage
            record_ai_usage(success)
        except Exception:
            pass

    async def heal(
        self,
        test_code: str,
        failed_selector: str,
        error_message: str,
        step_info: Optional[Dict[str, Any]] = None,
        screenshot_b64: Optional[str] = None,
        page_html: Optional[str] = None,
        page_url: Optional[str] = None,
        intent_dict: Optional[Dict[str, Any]] = None,
        execution_id: Optional[str] = None,
    ) -> HealingPipelineResult:
        """
        Run the full healing chain. Returns as soon as any layer succeeds.

        Args:
            test_code: Full test code (for string replacement if healing)
            failed_selector: The selector that failed
            error_message: Error message from test execution
            step_info: Step metadata (action type, text, etc.)
            screenshot_b64: Base64-encoded screenshot (for vision/OCR layers)
            page_html: Page HTML (for vision healing context)
            page_url: Page URL (for context)
            intent_dict: Intent dict for knowledge lookup (description, text, role)
            execution_id: For WebSocket events
        """
        self._init_services()

        result = HealingPipelineResult(
            healed=False,
            original_selector=failed_selector,
        )

        logger.info(f"[HealingOrchestrator] Starting healing chain for: {failed_selector[:60]}...")

        # Emit WebSocket event: chain started
        await self._emit_ws(execution_id, "healing_chain_start", {
            "failed_selector": failed_selector[:100],
        })

        # --- Layer 1: Knowledge Lookup ---
        healed = await self._try_knowledge_lookup(failed_selector, intent_dict, result)
        if healed:
            result.healed_code = self._apply_fix(test_code, failed_selector, result.healed_selector)
            await self._emit_ws(execution_id, "healing_chain_complete", {
                "healed": True, "strategy": result.winning_strategy,
            })
            return result

        # --- Layer 2: Deterministic Variants ---
        healed = await self._try_deterministic_variants(failed_selector, result)
        if healed:
            result.healed_code = self._apply_fix(test_code, failed_selector, result.healed_selector)
            await self._emit_ws(execution_id, "healing_chain_complete", {
                "healed": True, "strategy": result.winning_strategy,
            })
            return result

        # --- Layer 3: Vision AI Healing ---
        if screenshot_b64 and self._check_ai_budget():
            element_desc = ""
            if intent_dict:
                element_desc = intent_dict.get("description", "") or intent_dict.get("text", "")
            if not element_desc and step_info:
                element_desc = step_info.get("text", "") or step_info.get("label", "")

            healed = await self._try_vision_healing(
                screenshot_b64, failed_selector, element_desc,
                page_html, error_message, result
            )
            if healed:
                result.healed_code = self._apply_fix(test_code, failed_selector, result.healed_selector)
                await self._emit_ws(execution_id, "healing_chain_complete", {
                    "healed": True, "strategy": result.winning_strategy,
                })
                return result

        # --- Layer 4: OCR Fallback ---
        if screenshot_b64:
            target_text = ""
            if intent_dict:
                target_text = intent_dict.get("text", "")
            if not target_text and step_info:
                target_text = step_info.get("text", "") or step_info.get("label", "")

            if target_text:
                healed = await self._try_ocr_fallback(screenshot_b64, target_text, result)
                if healed:
                    result.healed_code = self._apply_fix(test_code, failed_selector, result.healed_selector)
                    await self._emit_ws(execution_id, "healing_chain_complete", {
                        "healed": True, "strategy": result.winning_strategy,
                    })
                    return result

        # --- All layers failed ---
        logger.warning(f"[HealingOrchestrator] All layers failed for: {failed_selector[:60]}")
        await self._emit_ws(execution_id, "healing_chain_complete", {
            "healed": False, "total_attempts": len(result.attempts),
        })
        return result

    # ======================================================================
    # Layer 1: Knowledge Lookup
    # ======================================================================

    async def _try_knowledge_lookup(
        self, failed_selector: str, intent_dict: Optional[Dict], result: HealingPipelineResult
    ) -> bool:
        """Query SelfHealingController for previously-healed selectors."""
        if not self._healing_controller or not intent_dict:
            return False

        start = time.time()
        try:
            suggestions = self._healing_controller.get_healing_suggestions(intent_dict)
            duration_ms = int((time.time() - start) * 1000)

            # Filter out the failed selector itself
            suggestions = [s for s in suggestions if s != failed_selector]

            if suggestions:
                best = suggestions[0]
                result.attempts.append(HealingAttempt(
                    strategy="knowledge", selector_tried=best,
                    success=True, confidence=0.8, duration_ms=duration_ms,
                ))
                result.healed = True
                result.healed_selector = best
                result.winning_strategy = "knowledge"
                result.confidence = 0.8
                logger.info(f"[HealingOrchestrator] Layer 1 (knowledge) found: {best[:60]}")
                return True

            result.attempts.append(HealingAttempt(
                strategy="knowledge", selector_tried="(no suggestions)",
                success=False, confidence=0.0, duration_ms=duration_ms,
            ))
        except Exception as e:
            result.attempts.append(HealingAttempt(
                strategy="knowledge", selector_tried="(error)",
                success=False, confidence=0.0, duration_ms=0, error=str(e),
            ))
        return False

    # ======================================================================
    # Layer 2: Deterministic Selector Variants
    # ======================================================================

    async def _try_deterministic_variants(
        self, failed_selector: str, result: HealingPipelineResult
    ) -> bool:
        """Generate and try alternative selectors based on string transforms."""
        start = time.time()
        alternatives = self._generate_alternatives(failed_selector)
        duration_ms = int((time.time() - start) * 1000)

        if alternatives:
            # We can't actually test them here (no browser page),
            # but we return the best candidates for the retry
            best = alternatives[0]
            result.attempts.append(HealingAttempt(
                strategy="deterministic", selector_tried=best,
                success=True, confidence=0.5, duration_ms=duration_ms,
            ))
            result.healed = True
            result.healed_selector = best
            result.winning_strategy = "deterministic"
            result.confidence = 0.5
            logger.info(f"[HealingOrchestrator] Layer 2 (deterministic) generated: {best[:60]}")
            return True

        result.attempts.append(HealingAttempt(
            strategy="deterministic", selector_tried="(no alternatives)",
            success=False, confidence=0.0, duration_ms=duration_ms,
        ))
        return False

    def _generate_alternatives(self, failed_selector: str) -> List[str]:
        """Generate alternative selectors based on the failed one."""
        alternatives = []

        # ID selector → try attribute variants
        if failed_selector.startswith("#"):
            element_id = failed_selector[1:]
            alternatives.append(f"[data-testid='{element_id}']")
            alternatives.append(f"[id*='{element_id}']")

        # Attribute selector → try partial/data variants
        elif "=" in failed_selector and "[" in failed_selector:
            attr_match = re.match(r"\[(\w+)=['\"]([^'\"]+)['\"]\]", failed_selector)
            if attr_match:
                attr, value = attr_match.groups()
                alternatives.append(f"[{attr}*='{value}']")
                alternatives.append(f"[data-{attr}='{value}']")

        # Text selector → try case-insensitive, partial
        elif "text=" in failed_selector.lower():
            text_match = re.search(r"text=['\"]([^'\"]+)['\"]", failed_selector, re.IGNORECASE)
            if text_match:
                text = text_match.group(1)
                alternatives.append(f"text=/{text}/i")
                if len(text) > 10:
                    alternatives.append(f"text='{text[:20]}'")

        # Playwright locators → try getByRole/getByText variants
        elif "getByRole" in failed_selector or "getByText" in failed_selector:
            # Extract text content from locator
            text_match = re.search(r"['\"]([^'\"]+)['\"]", failed_selector)
            if text_match:
                text = text_match.group(1)
                alternatives.append(f"text='{text}'")
                alternatives.append(f"text=/{text}/i")

        return alternatives

    # ======================================================================
    # Layer 3: Vision AI Healing
    # ======================================================================

    async def _try_vision_healing(
        self, screenshot_b64: str, failed_selector: str,
        element_description: str, page_html: Optional[str],
        error_message: str, result: HealingPipelineResult
    ) -> bool:
        """Use GPT-4o vision to analyze screenshot and suggest new selector."""
        if not self._vision_service:
            result.attempts.append(HealingAttempt(
                strategy="vision_ai", selector_tried="(service unavailable)",
                success=False, confidence=0.0, duration_ms=0,
                error="Vision service not available (OPENAI_API_KEY not set)",
            ))
            return False

        start = time.time()
        try:
            healing = await self._vision_service.heal_broken_selector(
                screenshot_base64=screenshot_b64,
                original_selector=failed_selector,
                element_description=element_description or "interactive element",
                page_html=page_html[:5000] if page_html else None,
                error_message=error_message[:500],
            )
            duration_ms = int((time.time() - start) * 1000)
            result.ai_calls_made += 1
            self._record_ai_call(healing.success)

            if healing.success and healing.healed_selector:
                result.attempts.append(HealingAttempt(
                    strategy="vision_ai", selector_tried=healing.healed_selector,
                    success=True, confidence=healing.confidence, duration_ms=duration_ms,
                ))
                result.healed = True
                result.healed_selector = healing.healed_selector
                result.winning_strategy = "vision_ai"
                result.confidence = healing.confidence
                logger.info(f"[HealingOrchestrator] Layer 3 (vision) healed: {healing.healed_selector[:60]}")
                return True

            result.attempts.append(HealingAttempt(
                strategy="vision_ai", selector_tried=healing.healed_selector or "(none)",
                success=False, confidence=healing.confidence, duration_ms=duration_ms,
                error=healing.error,
            ))
        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            result.ai_calls_made += 1
            self._record_ai_call(False)
            result.attempts.append(HealingAttempt(
                strategy="vision_ai", selector_tried="(error)",
                success=False, confidence=0.0, duration_ms=duration_ms, error=str(e),
            ))
            logger.error(f"[HealingOrchestrator] Layer 3 (vision) error: {e}")
        return False

    # ======================================================================
    # Layer 4: OCR Fallback
    # ======================================================================

    async def _try_ocr_fallback(
        self, screenshot_b64: str, target_text: str, result: HealingPipelineResult
    ) -> bool:
        """Use Tesseract OCR to find text and generate coordinate-based selector."""
        start = time.time()
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "http://localhost:8000/api/ocr/find-text",
                    json={"screenshot": screenshot_b64, "target_text": target_text},
                    timeout=10.0,
                )
                duration_ms = int((time.time() - start) * 1000)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("found") and data.get("center_x") is not None:
                        # Generate coordinate-based click code
                        coord_selector = f"coordinates:{data['center_x']},{data['center_y']}"
                        confidence = data.get("confidence", 0.6)

                        result.attempts.append(HealingAttempt(
                            strategy="ocr", selector_tried=coord_selector,
                            success=True, confidence=confidence, duration_ms=duration_ms,
                        ))
                        result.healed = True
                        result.healed_selector = coord_selector
                        result.winning_strategy = "ocr"
                        result.confidence = confidence
                        logger.info(f"[HealingOrchestrator] Layer 4 (OCR) found text at: {coord_selector}")
                        return True

                result.attempts.append(HealingAttempt(
                    strategy="ocr", selector_tried="(text not found)",
                    success=False, confidence=0.0, duration_ms=duration_ms,
                ))
        except Exception as e:
            duration_ms = int((time.time() - start) * 1000)
            result.attempts.append(HealingAttempt(
                strategy="ocr", selector_tried="(error)",
                success=False, confidence=0.0, duration_ms=duration_ms, error=str(e),
            ))
            logger.debug(f"[HealingOrchestrator] Layer 4 (OCR) error: {e}")
        return False

    # ======================================================================
    # Helpers
    # ======================================================================

    def _apply_fix(self, test_code: str, old_selector: str, new_selector: Optional[str]) -> Optional[str]:
        """Apply the healed selector to the test code."""
        if not new_selector or not test_code:
            return None

        # Handle coordinate-based selectors (from OCR)
        if new_selector.startswith("coordinates:"):
            parts = new_selector.replace("coordinates:", "").split(",")
            x, y = int(parts[0]), int(parts[1])
            # Replace the selector-based action with coordinate click
            # e.g., page.click("#btn") → page.mouse.click(x, y)
            healed = re.sub(
                rf"""(page\.\w+)\(['"]{re.escape(old_selector)}['"]""",
                f"page.mouse.click({x}, {y}",
                test_code,
            )
            if healed != test_code:
                return healed
            return None

        # Standard selector replacement
        healed = test_code.replace(old_selector, new_selector)
        if healed != test_code:
            return healed

        # Try with different quote styles
        for old_q, new_q in [("'", '"'), ('"', "'")]:
            old_variant = old_selector.replace(old_q, new_q)
            healed = test_code.replace(old_variant, new_selector)
            if healed != test_code:
                return healed

        return None

    def record_healing_success(
        self, intent_dict: Dict, strategy: str, selector: str,
        attributes: Dict[str, str], context: Dict[str, str]
    ):
        """Record a healing success to SelfHealingController for future runs."""
        self._init_services()
        if self._healing_controller:
            try:
                self._healing_controller.record_success(
                    intent_dict=intent_dict,
                    strategy=strategy,
                    selector=selector,
                    attributes=attributes,
                    context=context,
                )
                logger.info(f"[HealingOrchestrator] Recorded healing success: {strategy} → {selector[:40]}")
            except Exception as e:
                logger.warning(f"[HealingOrchestrator] Failed to record success: {e}")

    async def detect_false_positive(
        self, screenshot_b64: str, element_description: str, page_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if a failed step is a false positive using vision AI.

        If the element is visually present (confidence > 70%) but the selector
        failed, it's likely a false positive (selector broke, not the app).
        """
        self._init_services()
        if not self._vision_service:
            return {"is_false_positive": False, "reason": "Vision AI not available"}

        if not self._check_ai_budget():
            return {"is_false_positive": False, "reason": "AI budget exceeded"}

        try:
            location = await self._vision_service.find_element_by_description(
                screenshot_base64=screenshot_b64,
                description=element_description,
                context=f"URL: {page_url}" if page_url else "",
            )
            self._record_ai_call(location.found)

            if location.found and location.confidence > 0.7:
                return {
                    "is_false_positive": True,
                    "confidence": location.confidence,
                    "suggested_selector": location.selector_suggestion,
                    "coordinates": {"x": location.x, "y": location.y} if location.x else None,
                    "reason": "Element visually present but selector failed",
                }

            return {
                "is_false_positive": False,
                "confidence": location.confidence if location else 0,
                "reason": "Element not found visually",
            }
        except Exception as e:
            logger.error(f"[HealingOrchestrator] False positive detection error: {e}")
            return {"is_false_positive": False, "reason": f"Detection error: {str(e)}"}

    async def _emit_ws(self, execution_id: Optional[str], event_type: str, data: Dict):
        """Emit a WebSocket event if execution_id is available."""
        if not execution_id:
            return
        try:
            from app.services.execution_websocket_manager import execution_ws_manager
            await execution_ws_manager.send_log(
                execution_id,
                level="info",
                message=f"[Healing] {event_type}: {data}",
            )
        except Exception:
            pass


# Module-level singleton
_orchestrator_instance = None


def get_healing_orchestrator() -> HealingOrchestrator:
    """Get or create the singleton HealingOrchestrator."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = HealingOrchestrator()
    return _orchestrator_instance
