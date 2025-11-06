"""
Self-Healing Service - Selector Repair and Flake Classification
Handles automatic selector repair and flaky test classification.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
import logging
import re

logger = logging.getLogger(__name__)


class FlakeType(Enum):
    LEGIT = "legit"  # Real failure
    FLAKY = "flaky"  # Intermittent failure
    INFRA = "infra"  # Infrastructure issue
    TIMEOUT = "timeout"  # Timeout issue
    UNKNOWN = "unknown"


@dataclass
class SelectorCandidate:
    """A candidate selector for replacement"""
    selector: str
    selector_type: str  # 'role', 'label', 'text', 'xpath', 'css', 'data-testid'
    confidence: float  # 0-1
    reason: str


@dataclass
class FlakeAnalysis:
    """Analysis of a test failure to determine if it's flaky"""
    test_id: str
    flake_type: FlakeType
    confidence: float  # 0-1
    signals: Dict[str, Any]
    recommendation: str


class SelfHealingService:
    """
    Service for self-healing test failures.
    Handles selector repair and flake classification.
    """

    def __init__(self):
        self.selector_types_priority = [
            "data-testid",
            "role",
            "label",
            "text",
            "aria-label",
            "id",
            "css",
            "xpath"
        ]

    def repair_selectors(
        self,
        failed_step: Dict[str, Any],
        page_context: Optional[Dict[str, Any]] = None
    ) -> List[SelectorCandidate]:
        """
        Generate candidate selectors to replace a failed one.
        
        Args:
            failed_step: Step that failed with selector information
            page_context: Optional page context (DOM, screenshots, etc.)
            
        Returns:
            List of candidate selectors, sorted by confidence
        """
        original_selector = failed_step.get("selector", "")
        selector_type = self._detect_selector_type(original_selector)
        element_info = failed_step.get("element_info", {})

        candidates = []

        # Try different selector strategies in priority order
        if "data-testid" not in original_selector:
            # Try data-testid (most stable)
            test_id = element_info.get("data_testid") or self._extract_test_id(element_info)
            if test_id:
                candidates.append(SelectorCandidate(
                    selector=f'[data-testid="{test_id}"]',
                    selector_type="data-testid",
                    confidence=0.9,
                    reason="Most stable selector type"
                ))

        # Try role-based selector
        role = element_info.get("role") or self._extract_role(element_info)
        if role:
            candidates.append(SelectorCandidate(
                selector=f'[role="{role}"]',
                selector_type="role",
                confidence=0.8,
                reason="Accessible role-based selector"
            ))

        # Try label-based selector
        label = element_info.get("label") or element_info.get("aria_label") or element_info.get("text")
        if label:
            # Try get_by_label or get_by_text
            candidates.append(SelectorCandidate(
                selector=f'get_by_label("{label}")',
                selector_type="label",
                confidence=0.75,
                reason="Label-based selector"
            ))

        # Try text-based selector
        visible_text = element_info.get("text") or element_info.get("visible_text")
        if visible_text and len(visible_text) < 50:
            candidates.append(SelectorCandidate(
                selector=f'get_by_text("{visible_text}")',
                selector_type="text",
                confidence=0.7,
                reason="Text-based selector"
            ))

        # Try ID-based selector
        element_id = element_info.get("id")
        if element_id:
            candidates.append(SelectorCandidate(
                selector=f"#{element_id}",
                selector_type="id",
                confidence=0.6,
                reason="ID-based selector"
            ))

        # Sort by confidence
        candidates.sort(key=lambda c: c.confidence, reverse=True)

        return candidates

    def classify_flake(
        self,
        test_run: Dict[str, Any],
        historical_runs: List[Dict[str, Any]] = None
    ) -> FlakeAnalysis:
        """
        Classify a test failure as flaky or legitimate.
        
        Args:
            test_run: Current test run with failure
            historical_runs: Previous runs for this test
            
        Returns:
            FlakeAnalysis with classification
        """
        historical_runs = historical_runs or []
        signals = {}

        # Signal 1: Variance in results (pass/fail/pass pattern)
        pass_fail_pattern = [run.get("status") == "passed" for run in historical_runs[-10:]]
        variance = self._calculate_variance(pass_fail_pattern)
        signals["result_variance"] = variance

        # Signal 2: Timeout occurrences
        timeout_count = sum(1 for run in historical_runs if "timeout" in run.get("error", "").lower())
        signals["timeout_count"] = timeout_count

        # Signal 3: Infrastructure errors
        infra_error_keywords = ["connection", "network", "dns", "503", "502", "504"]
        infra_error_count = sum(
            1 for run in historical_runs
            if any(keyword in run.get("error", "").lower() for keyword in infra_error_keywords)
        )
        signals["infra_error_count"] = infra_error_count

        # Signal 4: Timing issues
        timing_variance = self._calculate_timing_variance(historical_runs)
        signals["timing_variance"] = timing_variance

        # Signal 5: Selector issues
        selector_error_count = sum(
            1 for run in historical_runs
            if "selector" in run.get("error", "").lower() or "locator" in run.get("error", "").lower()
        )
        signals["selector_error_count"] = selector_error_count

        # Classify based on signals
        flake_type = FlakeType.UNKNOWN
        confidence = 0.5
        recommendation = "Review manually"

        # High variance = flaky
        if variance > 0.4:
            flake_type = FlakeType.FLAKY
            confidence = min(0.9, 0.5 + variance)
            recommendation = "Mark as flaky and investigate root cause"

        # Timeout issues
        elif timeout_count >= 2:
            flake_type = FlakeType.TIMEOUT
            confidence = 0.8
            recommendation = "Increase timeout or optimize test execution"

        # Infrastructure errors
        elif infra_error_count >= 2:
            flake_type = FlakeType.INFRA
            confidence = 0.75
            recommendation = "Infrastructure issue, not a test failure"

        # Selector issues - might be self-healable
        elif selector_error_count >= 1:
            flake_type = FlakeType.FLAKY
            confidence = 0.7
            recommendation = "Selector instability detected, attempt auto-repair"

        # Low variance = likely legitimate failure
        elif variance < 0.1:
            flake_type = FlakeType.LEGIT
            confidence = 0.85
            recommendation = "Legitimate failure, investigate root cause"

        return FlakeAnalysis(
            test_id=test_run.get("test_id", "unknown"),
            flake_type=flake_type,
            confidence=confidence,
            signals=signals,
            recommendation=recommendation
        )

    def _detect_selector_type(self, selector: str) -> str:
        """Detect the type of selector"""
        if selector.startswith("[data-testid"):
            return "data-testid"
        elif selector.startswith("[role"):
            return "role"
        elif selector.startswith("get_by_label"):
            return "label"
        elif selector.startswith("get_by_text"):
            return "text"
        elif selector.startswith("#"):
            return "id"
        elif selector.startswith("/") or selector.startswith("//"):
            return "xpath"
        else:
            return "css"

    def _extract_test_id(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Extract data-testid from element info"""
        return element_info.get("data_testid") or element_info.get("data-testid")

    def _extract_role(self, element_info: Dict[str, Any]) -> Optional[str]:
        """Extract ARIA role from element info"""
        return element_info.get("role") or element_info.get("aria_role")

    def _calculate_variance(self, results: List[bool]) -> float:
        """Calculate variance in pass/fail results"""
        if not results:
            return 0.0

        pass_count = sum(results)
        fail_count = len(results) - pass_count

        if pass_count == 0 or fail_count == 0:
            return 0.0  # No variance if all pass or all fail

        # Calculate variance as ratio of alternating results
        alternations = sum(
            1 for i in range(len(results) - 1)
            if results[i] != results[i + 1]
        )
        return alternations / len(results) if results else 0.0

    def _calculate_timing_variance(self, runs: List[Dict[str, Any]]) -> float:
        """Calculate variance in test execution times"""
        if len(runs) < 2:
            return 0.0

        durations = [run.get("duration", 0) for run in runs if run.get("duration")]
        if not durations:
            return 0.0

        avg_duration = sum(durations) / len(durations)
        variance = sum((d - avg_duration) ** 2 for d in durations) / len(durations)
        std_dev = variance ** 0.5

        # Normalize to 0-1 scale
        if avg_duration > 0:
            coefficient_of_variation = std_dev / avg_duration
            return min(1.0, coefficient_of_variation)
        return 0.0


# Global instance
self_healing_service = SelfHealingService()

