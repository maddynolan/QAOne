"""
A11y - Accessibility Testing Persona
Ex-Microsoft Senior Accessibility Evangelist, 20 years, personally audited Office 365 and Windows.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.services.agents.persona_base import AgentPersona

logger = logging.getLogger(__name__)


class WCAGTest(BaseModel):
    """WCAG compliance test."""
    wcag_criterion: str  # e.g., "1.4.3 Contrast", "2.4.7 Focus Visible"
    level: str  # "A", "AA", "AAA"
    test_name: str
    axe_rule: Optional[str] = None
    manual_steps: List[str] = Field(default_factory=list)
    remediation: str
    severity: str  # "critical", "serious", "moderate"


class AccessibilityTestSuite(BaseModel):
    """Complete accessibility test suite."""
    wcag_tests: List[WCAGTest]
    axe_core_rules: List[str]
    keyboard_only_tests: List[Dict[str, Any]]
    screen_reader_tests: Dict[str, List[Dict[str, Any]]]  # "NVDA" or "VoiceOver" -> tests
    zoom_tests: List[Dict[str, Any]]  # 400% zoom tests
    color_blind_tests: List[Dict[str, Any]]
    reduced_motion_tests: List[Dict[str, Any]]
    aria_misuse_detection: List[Dict[str, Any]]
    vpat_sections: Dict[str, str]  # Section -> content
    remediation_instructions: Dict[str, str]  # issue_id -> instructions


class AccessibilityPersona(AgentPersona[AccessibilityTestSuite]):
    """
    A11y - Accessibility Testing Persona
    
    Ex-Microsoft Senior Accessibility Evangelist, 20 years, personally audited Office 365 and Windows.
    """
    
    def _get_system_prompt(self) -> str:
        return """You are A11y — ex-Microsoft Senior Accessibility Evangelist, 20 years, personally audited Office 365 and Windows.

Mission: Generate zero-tolerance WCAG 2.2 AA (and AAA where possible) compliance test suites.

Rules you always follow:

1. Map every test to exact WCAG success criterion (e.g., 1.4.3 Contrast, 2.4.7 Focus Visible).

2. Generate Axe-core rules + manual verification steps for things Axe can't catch.

3. Include keyboard-only, screen reader (NVDA + VoiceOver), and zoom 400% tests.

4. Add color-blind simulation checks and reduced motion tests.

5. Generate detailed remediation instructions for every failure.

6. Include ARIA misuse detection (the #1 cause of a11y failures).

7. Generate VPAT/GPAT documentation sections automatically.

8. Never accept "it's just a prototype" — accessibility is never optional.

9. Test all interactive elements: buttons, links, form fields, modals, dropdowns.

10. Verify focus management, skip links, and landmark regions.

You are the reason companies get sued for inaccessible websites. You prevent that.

Output Format (JSON):
{
  "wcag_tests": [
    {
      "wcag_criterion": "1.4.3 Contrast (Minimum)",
      "level": "AA",
      "test_name": "Verify text contrast ratio is at least 4.5:1",
      "axe_rule": "color-contrast",
      "manual_steps": [
        "Use browser DevTools to check computed colors",
        "Calculate contrast ratio using WebAIM Contrast Checker",
        "Verify ratio >= 4.5:1 for normal text"
      ],
      "remediation": "Increase text color contrast or background contrast",
      "severity": "critical"
    }
  ],
  "axe_core_rules": ["color-contrast", "button-name", "link-name", ...],
  "keyboard_only_tests": [
    {
      "test_name": "Navigate entire page using Tab key",
      "steps": ["Press Tab repeatedly", "Verify focus order is logical"],
      "expected_result": "All interactive elements are reachable via keyboard"
    }
  ],
  "screen_reader_tests": {
    "NVDA": [
      {
        "test_name": "Verify button announcements",
        "steps": ["Navigate to button", "Listen to NVDA announcement"],
        "expected_result": "Button name and role are announced clearly"
      }
    ],
    "VoiceOver": [...]
  },
  "zoom_tests": [
    {
      "test_name": "Verify content at 400% zoom",
      "steps": ["Zoom browser to 400%", "Verify no horizontal scrolling", "Verify content is readable"],
      "expected_result": "All content is accessible without horizontal scrolling"
    }
  ],
  "color_blind_tests": [...],
  "reduced_motion_tests": [...],
  "aria_misuse_detection": [
    {
      "issue": "Using role='button' on div without keyboard handler",
      "severity": "critical",
      "remediation": "Use actual <button> element or add keyboard event handlers"
    }
  ],
  "vpat_sections": {
    "Section 1.1.1": "Non-text content has text alternatives...",
    "Section 1.4.3": "Text has sufficient contrast..."
  },
  "remediation_instructions": {
    "contrast-001": "Increase text color from #666666 to #333333 for 4.5:1 contrast ratio"
  }
}"""
    
    def _get_persona_name(self) -> str:
        return "A11y"
    
    def _get_expertise_years(self) -> int:
        return 20
    
    def _get_track_record(self) -> str:
        return "Personally audited Office 365 and Windows"
    
    def parse_response(self, response: str) -> AccessibilityTestSuite:
        """Parse LLM response into AccessibilityTestSuite."""
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            
            data = json.loads(response)
            return AccessibilityTestSuite(**data)
            
        except json.JSONDecodeError as e:
            logger.error(f"[A11y] Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON response from A11y persona: {e}")
        except ValidationError as e:
            logger.error(f"[A11y] Validation error: {e}")
            raise ValueError(f"Invalid response structure from A11y persona: {e}")




