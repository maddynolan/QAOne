"""
AI Enhancement Services — Independent Modules
================================================

Three independent services that ENHANCE existing workflows without replacing them.
Each service works standalone — no AI key needed for persistence features.

Services:
  1. FalsePositivePersistence — Save/load false-positive flags across sessions (NO AI needed)
  2. FlakyStepTracker — Per-step pass/fail history + flaky scoring (NO AI needed)
  3. AIFailureExplainer — AI-powered root cause + multiple fix options (AI optional)

All services use file-based storage (JSON) so they work without PostgreSQL.
When Postgres is available, they can optionally sync there too.
"""

import logging
import json
import os
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

logger = logging.getLogger(__name__)

# Storage directory — next to backend/data/
_STORAGE_DIR = Path(__file__).parent.parent.parent / "data" / "ai_enhancements"


def _ensure_storage():
    """Create storage directory if it doesn't exist."""
    _STORAGE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# 1. FALSE POSITIVE PERSISTENCE
# ============================================================================

@dataclass
class FalsePositiveFlag:
    """A single false-positive flag on a step."""
    step_id: str               # Action ID from the recorded step
    step_index: int            # Index in the action list
    step_label: str            # Human-readable label (e.g., "Click Submit")
    screenshot: Optional[str]  # Base64 screenshot at flag time (truncated for storage)
    reason: Optional[str]      # User-provided reason
    flagged_at: str            # ISO timestamp
    flagged_by: str            # User ID or "user"
    resolved: bool = False     # Whether it's been fixed
    resolved_at: Optional[str] = None


class FalsePositivePersistence:
    """
    Persist false-positive flags to disk so they survive across sessions.
    
    Current behavior (in-memory only):
      - User flags step → stored in React useState
      - Page refresh → all flags lost
      - Next run → doesn't know about previous flags
    
    Enhanced behavior (with this service):
      - User flags step → saved to backend + local state
      - Page refresh → flags loaded from backend
      - Next run → stops at flagged steps automatically
      - History kept for analytics (which steps get flagged most?)
    
    Storage: JSON file per test (recording) ID.
    No AI required — this is pure persistence.
    """

    def __init__(self):
        _ensure_storage()
        self._dir = _STORAGE_DIR / "false_positives"
        self._dir.mkdir(parents=True, exist_ok=True)

    def _file_for(self, test_id: str) -> Path:
        """Get storage file for a test/recording."""
        safe_id = test_id.replace("/", "_").replace("\\", "_")
        return self._dir / f"{safe_id}.json"

    def save_flag(self, test_id: str, flag: FalsePositiveFlag) -> bool:
        """Save a false-positive flag for a step."""
        try:
            existing = self.get_flags(test_id)
            # Upsert — replace if same step_id exists
            existing = [f for f in existing if f["step_id"] != flag.step_id]
            existing.append(asdict(flag))
            
            # Don't store full screenshots in persistence (too large)
            for f in existing:
                if f.get("screenshot") and len(f["screenshot"]) > 200:
                    f["screenshot"] = f["screenshot"][:100] + "...[truncated]"
            
            with open(self._file_for(test_id), "w") as fp:
                json.dump({"test_id": test_id, "flags": existing, "updated_at": datetime.utcnow().isoformat()}, fp, indent=2)
            
            logger.info(f"Saved false-positive flag for step {flag.step_id} in test {test_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to save false-positive flag: {e}")
            return False

    def get_flags(self, test_id: str) -> List[Dict[str, Any]]:
        """Get all false-positive flags for a test."""
        try:
            fp = self._file_for(test_id)
            if fp.exists():
                with open(fp, "r") as f:
                    data = json.load(f)
                return data.get("flags", [])
        except Exception as e:
            logger.error(f"Failed to read false-positive flags: {e}")
        return []

    def remove_flag(self, test_id: str, step_id: str) -> bool:
        """Remove a false-positive flag (unflag)."""
        try:
            existing = self.get_flags(test_id)
            filtered = [f for f in existing if f["step_id"] != step_id]
            if len(filtered) == len(existing):
                return False  # Not found
            
            with open(self._file_for(test_id), "w") as fp:
                json.dump({"test_id": test_id, "flags": filtered, "updated_at": datetime.utcnow().isoformat()}, fp, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to remove false-positive flag: {e}")
            return False

    def resolve_flag(self, test_id: str, step_id: str) -> bool:
        """Mark a false-positive flag as resolved (step was fixed)."""
        try:
            existing = self.get_flags(test_id)
            for f in existing:
                if f["step_id"] == step_id:
                    f["resolved"] = True
                    f["resolved_at"] = datetime.utcnow().isoformat()
            
            with open(self._file_for(test_id), "w") as fp:
                json.dump({"test_id": test_id, "flags": existing, "updated_at": datetime.utcnow().isoformat()}, fp, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to resolve false-positive flag: {e}")
            return False

    def get_most_flagged_steps(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get steps that are most frequently flagged across all tests (analytics)."""
        try:
            step_counts: Dict[str, int] = defaultdict(int)
            step_labels: Dict[str, str] = {}
            
            for fp in self._dir.glob("*.json"):
                try:
                    with open(fp, "r") as f:
                        data = json.load(f)
                    for flag in data.get("flags", []):
                        sid = flag.get("step_id", "")
                        step_counts[sid] += 1
                        step_labels[sid] = flag.get("step_label", "Unknown")
                except Exception:
                    continue
            
            sorted_steps = sorted(step_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
            return [{"step_id": sid, "label": step_labels.get(sid, ""), "flag_count": count} for sid, count in sorted_steps]
        except Exception as e:
            logger.error(f"Failed to get most flagged steps: {e}")
            return []


# ============================================================================
# 2. FLAKY STEP TRACKER
# ============================================================================

@dataclass
class StepExecution:
    """Record of a single step execution."""
    step_id: str
    step_index: int
    step_label: str
    status: str  # passed, failed, skipped
    error: Optional[str] = None
    duration_ms: int = 0
    executed_at: str = ""
    run_id: Optional[str] = None
    healed: bool = False  # Was self-healing used?


class FlakyStepTracker:
    """
    Track per-STEP pass/fail history to detect flaky steps.
    
    Different from the existing FlakyDetector (which works at test level with Postgres):
    - This works at the STEP level (individual actions within a test)
    - Uses local file storage (works without Postgres)
    - Calculates flakiness score per step
    - Auto-flags steps that flip between pass/fail
    
    A step is "flaky" if it sometimes passes and sometimes fails
    across consecutive test runs, suggesting a timing or selector issue.
    
    No AI required — this is pure statistical analysis.
    """

    def __init__(self, max_history: int = 50):
        _ensure_storage()
        self._dir = _STORAGE_DIR / "flaky_steps"
        self._dir.mkdir(parents=True, exist_ok=True)
        self.max_history = max_history
        self.flakiness_threshold = 0.25  # 25% flip rate = flaky

    def _file_for(self, test_id: str) -> Path:
        safe_id = test_id.replace("/", "_").replace("\\", "_")
        return self._dir / f"{safe_id}.json"

    def record_step_result(self, test_id: str, execution: StepExecution) -> None:
        """Record a step execution result."""
        try:
            data = self._load(test_id)
            step_key = execution.step_id or f"step_{execution.step_index}"
            
            if step_key not in data:
                data[step_key] = {
                    "step_id": step_key,
                    "step_label": execution.step_label,
                    "history": []
                }
            
            # Update label if it changed
            data[step_key]["step_label"] = execution.step_label
            
            # Add to history (capped)
            data[step_key]["history"].append({
                "status": execution.status,
                "error": execution.error[:200] if execution.error else None,
                "duration_ms": execution.duration_ms,
                "executed_at": execution.executed_at or datetime.utcnow().isoformat(),
                "run_id": execution.run_id,
                "healed": execution.healed
            })
            
            # Cap history
            if len(data[step_key]["history"]) > self.max_history:
                data[step_key]["history"] = data[step_key]["history"][-self.max_history:]
            
            self._save(test_id, data)
        except Exception as e:
            logger.error(f"Failed to record step result: {e}")

    def record_batch(self, test_id: str, run_id: str, step_results: List[Dict[str, Any]]) -> None:
        """Record all step results from a single test run."""
        for sr in step_results:
            execution = StepExecution(
                step_id=sr.get("step_id", sr.get("actionId", f"step_{sr.get('index', 0)}")),
                step_index=sr.get("index", 0),
                step_label=sr.get("label", sr.get("description", f"Step {sr.get('index', 0) + 1}")),
                status=sr.get("status", "unknown"),
                error=sr.get("error"),
                duration_ms=sr.get("duration_ms", sr.get("duration", 0)),
                executed_at=datetime.utcnow().isoformat(),
                run_id=run_id,
                healed=sr.get("healed", False)
            )
            self.record_step_result(test_id, execution)

    def get_flaky_steps(self, test_id: str) -> List[Dict[str, Any]]:
        """Get all steps with their flakiness scores for a test."""
        try:
            data = self._load(test_id)
            results = []
            
            for step_key, step_data in data.items():
                history = step_data.get("history", [])
                if len(history) < 3:  # Need at least 3 runs for meaningful analysis
                    continue
                
                score = self._calculate_flakiness(history)
                if score > 0:
                    results.append({
                        "step_id": step_key,
                        "step_label": step_data.get("step_label", ""),
                        "flakiness_score": round(score, 3),
                        "is_flaky": score >= self.flakiness_threshold,
                        "total_runs": len(history),
                        "pass_count": sum(1 for h in history if h["status"] == "passed"),
                        "fail_count": sum(1 for h in history if h["status"] == "failed"),
                        "heal_count": sum(1 for h in history if h.get("healed")),
                        "last_status": history[-1]["status"] if history else "unknown",
                        "last_error": history[-1].get("error") if history and history[-1]["status"] == "failed" else None
                    })
            
            results.sort(key=lambda x: x["flakiness_score"], reverse=True)
            return results
        except Exception as e:
            logger.error(f"Failed to get flaky steps: {e}")
            return []

    def get_step_history(self, test_id: str, step_id: str) -> List[Dict[str, Any]]:
        """Get full execution history for a specific step."""
        try:
            data = self._load(test_id)
            step_data = data.get(step_id, {})
            return step_data.get("history", [])
        except Exception:
            return []

    def _calculate_flakiness(self, history: List[Dict]) -> float:
        """
        Calculate flakiness score for a step based on its history.
        
        Score components:
          - Flip rate: How often status alternates between pass/fail (0-1)
          - Failure rate balance: Closer to 50/50 = more flaky (0-1)
          - Recent trend: Weight recent results more heavily
        
        Returns: 0.0 (stable) to 1.0 (very flaky)
        """
        if len(history) < 2:
            return 0.0
        
        statuses = [h["status"] for h in history if h["status"] in ("passed", "failed")]
        if len(statuses) < 2:
            return 0.0
        
        # 1. Flip rate: count status changes / total transitions
        flips = sum(1 for i in range(1, len(statuses)) if statuses[i] != statuses[i-1])
        flip_rate = flips / (len(statuses) - 1)
        
        # 2. Balance: how close to 50/50 pass/fail split
        pass_rate = sum(1 for s in statuses if s == "passed") / len(statuses)
        # Balance = 1.0 when 50/50, 0.0 when 100/0
        balance = 1.0 - abs(pass_rate - 0.5) * 2
        
        # 3. Recent trend: last 5 results weighted more
        recent = statuses[-5:] if len(statuses) >= 5 else statuses
        recent_flips = sum(1 for i in range(1, len(recent)) if recent[i] != recent[i-1])
        recent_flip_rate = recent_flips / (len(recent) - 1) if len(recent) > 1 else 0
        
        # Weighted score
        score = (flip_rate * 0.4) + (balance * 0.3) + (recent_flip_rate * 0.3)
        return min(score, 1.0)

    def _load(self, test_id: str) -> Dict[str, Any]:
        fp = self._file_for(test_id)
        if fp.exists():
            try:
                with open(fp, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save(self, test_id: str, data: Dict[str, Any]) -> None:
        with open(self._file_for(test_id), "w") as fp:
            json.dump(data, fp, indent=2, default=str)


# ============================================================================
# 3. AI FAILURE EXPLAINER — Multi-Fix Options
# ============================================================================

@dataclass
class FixOption:
    """A single fix option for a failure."""
    fix_id: str              # Unique ID (e.g., "fix_1")
    title: str               # Short title (e.g., "Update selector")
    description: str         # What this fix does
    fix_type: str            # update_selector, add_wait, skip_step, mark_false_positive, investigate
    confidence: float        # 0.0-1.0
    auto_applicable: bool    # Can be applied automatically?
    details: Dict[str, Any] = field(default_factory=dict)  # Fix-specific data (e.g., new selector)


@dataclass
class FailureExplanation:
    """AI-powered failure explanation with multiple fix options."""
    step_id: str
    step_label: str
    # Classification (from existing failureClassification.ts categories)
    failure_type: str        # couldnt_find_it, found_wrong_one, page_not_ready, sometimes_works
    # AI-enhanced explanation
    plain_explanation: str   # One sentence, no jargon
    technical_detail: str    # For advanced users (collapsible)
    root_cause: str          # element_changed, timing_issue, app_bug, env_issue, test_issue
    confidence: float
    # Multiple fix options (the key differentiator)
    fix_options: List[FixOption] = field(default_factory=list)
    # Flakiness context
    is_known_flaky: bool = False
    flakiness_score: float = 0.0
    # False positive context
    was_previously_flagged: bool = False


class AIFailureExplainer:
    """
    Analyze test failures and provide multiple fix options.
    
    This ENHANCES the existing flow:
      - Without AI: Users still see the existing classifyFailure() message + "Click correct one" button
      - With AI: Users see a richer explanation + 3-5 specific fix options
    
    The AI call is OPTIONAL and POST-RUN — the UI renders immediately with
    the basic classification, then lazily loads AI explanation if available.
    
    Uses the existing FailureAnalyzer under the hood but wraps it with
    multi-fix generation and flaky/false-positive context.
    """

    def __init__(self):
        self._analyzer = None
        self._fp_service = FalsePositivePersistence()
        self._flaky_service = FlakyStepTracker()
        self._init_analyzer()

    def _init_analyzer(self):
        """Lazily initialize the AI analyzer (only if API key available)."""
        try:
            from app.services.llm.failure_analyzer import get_failure_analyzer
            self._analyzer = get_failure_analyzer()
        except Exception as e:
            logger.warning(f"AI failure analyzer not available: {e}")

    @property
    def ai_available(self) -> bool:
        return self._analyzer is not None and self._analyzer.available

    async def explain_failure(
        self,
        test_id: str,
        step_id: str,
        step_index: int,
        step_label: str,
        error_message: str,
        step_info: Dict[str, Any],
        screenshot_b64: Optional[str] = None,
        dom_snapshot: Optional[str] = None,
        console_logs: Optional[List[str]] = None,
        previous_steps: Optional[List[Dict[str, Any]]] = None
    ) -> FailureExplanation:
        """
        Generate a rich failure explanation with multiple fix options.
        
        Always returns a result — uses basic classification if AI is unavailable.
        """
        # 1. Start with basic classification (instant, no AI)
        basic_type = self._classify_basic(error_message)
        basic_message = self._basic_message(basic_type, step_label)
        
        # 2. Check flaky context
        flaky_steps = self._flaky_service.get_flaky_steps(test_id)
        flaky_info = next((s for s in flaky_steps if s["step_id"] == step_id), None)
        is_flaky = flaky_info["is_flaky"] if flaky_info else False
        flakiness_score = flaky_info["flakiness_score"] if flaky_info else 0.0
        
        # 3. Check false-positive context
        fp_flags = self._fp_service.get_flags(test_id)
        was_fp = any(f["step_id"] == step_id for f in fp_flags)
        
        # 4. Generate fix options (always — even without AI)
        fix_options = self._generate_basic_fix_options(basic_type, step_label, step_info, is_flaky, was_fp)
        
        # 5. Try AI enhancement (optional, best-effort)
        ai_explanation = None
        ai_root_cause = basic_type
        ai_technical = ""
        
        if self.ai_available:
            try:
                ai_result = await self._analyzer.analyze_failure(
                    error_message=error_message,
                    step_info=step_info,
                    screenshot_b64=screenshot_b64,
                    dom_snapshot=dom_snapshot,
                    console_logs=console_logs,
                    previous_steps=previous_steps
                )
                
                if ai_result and ai_result.confidence > 0.3:
                    # Enhance with AI insights
                    basic_message = ai_result.explanation
                    ai_technical = ai_result.suggested_fix
                    ai_root_cause = ai_result.root_cause
                    
                    # Add AI-specific fix option at top
                    ai_fix = FixOption(
                        fix_id="ai_suggested",
                        title=self._fix_title_for(ai_result.fix_type),
                        description=ai_result.suggested_fix,
                        fix_type=ai_result.fix_type,
                        confidence=ai_result.confidence,
                        auto_applicable=ai_result.fix_type in ("add_wait", "update_selector"),
                        details={"ai_root_cause": ai_result.root_cause, "ai_category": ai_result.category}
                    )
                    fix_options.insert(0, ai_fix)
                    
            except Exception as e:
                logger.warning(f"AI enhancement failed (falling back to basic): {e}")
        
        return FailureExplanation(
            step_id=step_id,
            step_label=step_label,
            failure_type=basic_type,
            plain_explanation=basic_message,
            technical_detail=ai_technical,
            root_cause=ai_root_cause,
            confidence=0.9 if self.ai_available else 0.6,
            fix_options=fix_options,
            is_known_flaky=is_flaky,
            flakiness_score=flakiness_score,
            was_previously_flagged=was_fp
        )

    def _classify_basic(self, error: str) -> str:
        """Mirror of frontend classifyFailure — same 5 types."""
        err = (error or "").lower()
        
        if any(kw in err for kw in ["multiple", "several", "ambiguous", "wrong element", "strict mode"]):
            return "found_wrong_one"
        if any(kw in err for kw in ["timeout", "timed out", "exceeded", "not ready", "still loading"]):
            return "page_not_ready"
        if any(kw in err for kw in ["flak", "intermittent", "sometimes fail"]):
            return "sometimes_works"
        if any(kw in err for kw in ["no element", "0 element", "not found", "hidden", "disabled", "detached", "can't find", "couldn't find"]):
            return "couldnt_find_it"
        
        return "couldnt_find_it"

    def _basic_message(self, failure_type: str, step_label: str) -> str:
        """Plain-language message matching the frontend classifier."""
        label = f'"{step_label}"' if step_label else "the item"
        messages = {
            "couldnt_find_it": f"We couldn't find {label} on the page. It may have moved or the page changed.",
            "found_wrong_one": "We found several options and clicked the wrong one. Please click the one you meant.",
            "page_not_ready": "The page wasn't ready in time. We can wait longer and try again.",
            "sometimes_works": "This step has failed in some runs. You can make it more stable.",
            "not_real_failure": "This may not be a real failure. You can mark it and we'll check next time."
        }
        return messages.get(failure_type, messages["couldnt_find_it"])

    def _generate_basic_fix_options(
        self,
        failure_type: str,
        step_label: str,
        step_info: Dict[str, Any],
        is_flaky: bool,
        was_fp: bool
    ) -> List[FixOption]:
        """
        Generate 3-5 fix options based on failure type.
        These are always available — no AI needed.
        """
        options: List[FixOption] = []
        
        if failure_type == "couldnt_find_it":
            options.append(FixOption(
                fix_id="pick_element",
                title="Click the correct element",
                description="Open the element picker and click the right element on the page. We'll update the selector automatically.",
                fix_type="update_selector",
                confidence=0.95,
                auto_applicable=False
            ))
            options.append(FixOption(
                fix_id="smart_suggestions",
                title="Choose from suggestions",
                description="We found similar elements on the page. Pick the right one from the list.",
                fix_type="update_selector",
                confidence=0.8,
                auto_applicable=False
            ))
            options.append(FixOption(
                fix_id="add_wait",
                title="Wait longer for page to load",
                description="The element might appear after the page finishes loading. Add a wait before this step.",
                fix_type="add_wait",
                confidence=0.5,
                auto_applicable=True,
                details={"wait_ms": 3000}
            ))
        
        elif failure_type == "found_wrong_one":
            options.append(FixOption(
                fix_id="pick_element",
                title="Click the correct element",
                description="Multiple matching elements found. Click the exact one you meant.",
                fix_type="update_selector",
                confidence=0.95,
                auto_applicable=False
            ))
            options.append(FixOption(
                fix_id="narrow_selector",
                title="Make selector more specific",
                description="The current selector matches multiple elements. Use a more specific identifier.",
                fix_type="update_selector",
                confidence=0.7,
                auto_applicable=False
            ))
        
        elif failure_type == "page_not_ready":
            options.append(FixOption(
                fix_id="add_wait",
                title="Wait longer",
                description="Increase the wait time for this step. The page may need more time to load.",
                fix_type="add_wait",
                confidence=0.85,
                auto_applicable=True,
                details={"wait_ms": 5000}
            ))
            options.append(FixOption(
                fix_id="wait_for_network",
                title="Wait for network to settle",
                description="Wait until all network requests complete before trying this step.",
                fix_type="add_wait",
                confidence=0.7,
                auto_applicable=True,
                details={"wait_type": "networkidle"}
            ))
            options.append(FixOption(
                fix_id="retry_step",
                title="Retry this step",
                description="Run this step again. Sometimes pages load slower than expected.",
                fix_type="retry",
                confidence=0.6,
                auto_applicable=True
            ))
        
        elif failure_type == "sometimes_works":
            options.append(FixOption(
                fix_id="stabilize",
                title="Stabilize this step",
                description="Add retry logic and smart waits to make this step more reliable.",
                fix_type="add_wait",
                confidence=0.7,
                auto_applicable=True,
                details={"retry_count": 3, "wait_ms": 2000}
            ))
            options.append(FixOption(
                fix_id="pick_element",
                title="Use a more stable selector",
                description="The current selector may be fragile. Pick the element again for a stronger selector.",
                fix_type="update_selector",
                confidence=0.6,
                auto_applicable=False
            ))
        
        # Always offer these universal options
        if not was_fp:
            options.append(FixOption(
                fix_id="mark_false_positive",
                title="Not a real failure",
                description="Mark this as a false positive. On next run, we'll pause here so you can verify.",
                fix_type="mark_false_positive",
                confidence=0.5,
                auto_applicable=False
            ))
        
        options.append(FixOption(
            fix_id="skip_step",
            title="Skip this step",
            description="Skip this step and continue with the rest of the test.",
            fix_type="skip_step",
            confidence=0.3,
            auto_applicable=True
        ))
        
        # If flaky, add quarantine option
        if is_flaky:
            options.insert(0, FixOption(
                fix_id="quarantine",
                title="Quarantine flaky step",
                description=f"This step flips between pass/fail. Quarantine it while you investigate.",
                fix_type="quarantine",
                confidence=0.6,
                auto_applicable=False
            ))
        
        return options

    def _fix_title_for(self, fix_type: str) -> str:
        """Human-readable title for AI fix types."""
        titles = {
            "update_selector": "AI: Update selector",
            "add_wait": "AI: Add smarter wait",
            "update_assertion": "AI: Fix assertion",
            "config_change": "AI: Fix configuration",
            "investigate": "AI: Needs investigation"
        }
        return titles.get(fix_type, f"AI: {fix_type}")


# ============================================================================
# SINGLETON INSTANCES
# ============================================================================

_fp_instance: Optional[FalsePositivePersistence] = None
_flaky_instance: Optional[FlakyStepTracker] = None
_explainer_instance: Optional[AIFailureExplainer] = None


def get_false_positive_service() -> FalsePositivePersistence:
    global _fp_instance
    if _fp_instance is None:
        _fp_instance = FalsePositivePersistence()
    return _fp_instance


def get_flaky_step_tracker() -> FlakyStepTracker:
    global _flaky_instance
    if _flaky_instance is None:
        _flaky_instance = FlakyStepTracker()
    return _flaky_instance


def get_failure_explainer() -> AIFailureExplainer:
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = AIFailureExplainer()
    return _explainer_instance
