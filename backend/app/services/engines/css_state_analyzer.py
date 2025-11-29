"""
CSS State Analyzer - Layer 2
Analyzes CSS states (hover, focus, disabled) and CSS-based validation.
"""

import logging
import re
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class CSSStateAnalyzer:
    """
    Analyzes CSS states and CSS-based validation rules.
    
    Layer 2 Components:
    1. Analyze hover, focus, disabled states
    2. Extract CSS-based validation (e.g., :invalid)
    3. Map visual states to test conditions
    """
    
    def __init__(self):
        self.css_states = {}
        self.validation_states = {}
    
    def analyze_css_states(
        self,
        css_content: str,
        html_content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze CSS to extract state-based rules.
        
        Returns:
        {
            "element_states": {
                "selector": {
                    "hover": Dict,
                    "focus": Dict,
                    "disabled": Dict,
                    "invalid": Dict,
                    "required": Dict
                }
            },
            "validation_states": {
                "selector": {
                    "invalid_style": Dict,
                    "error_message": Optional[str]
                }
            }
        }
        """
        element_states = {}
        validation_states = {}
        
        # Extract CSS rules
        css_rules = self._parse_css_rules(css_content)
        
        for selector, rules in css_rules.items():
            state_info = {}
            
            # Check for :hover
            if ":hover" in selector:
                base_selector = selector.replace(":hover", "").strip()
                state_info["hover"] = rules
                if base_selector not in element_states:
                    element_states[base_selector] = {}
                element_states[base_selector]["hover"] = rules
            
            # Check for :focus
            if ":focus" in selector:
                base_selector = selector.replace(":focus", "").strip()
                state_info["focus"] = rules
                if base_selector not in element_states:
                    element_states[base_selector] = {}
                element_states[base_selector]["focus"] = rules
            
            # Check for :disabled
            if ":disabled" in selector or "[disabled]" in selector:
                base_selector = re.sub(r'\[disabled\]|:disabled', '', selector).strip()
                state_info["disabled"] = rules
                if base_selector not in element_states:
                    element_states[base_selector] = {}
                element_states[base_selector]["disabled"] = rules
            
            # Check for :invalid (CSS validation)
            if ":invalid" in selector:
                base_selector = selector.replace(":invalid", "").strip()
                validation_states[base_selector] = {
                    "invalid_style": rules,
                    "error_message": self._extract_error_message_from_css(rules)
                }
            
            # Check for :required
            if ":required" in selector:
                base_selector = selector.replace(":required", "").strip()
                if base_selector not in element_states:
                    element_states[base_selector] = {}
                element_states[base_selector]["required"] = rules
        
        return {
            "element_states": element_states,
            "validation_states": validation_states
        }
    
    def extract_validation_from_css(
        self,
        css_content: str,
        element_selector: str
    ) -> Dict[str, Any]:
        """
        Extract validation rules from CSS for a specific element.
        
        Returns:
        {
            "required": bool,
            "invalid_style": Dict,
            "error_message": Optional[str],
            "states": {
                "hover": Dict,
                "focus": Dict,
                "disabled": Dict
            }
        }
        """
        validation = {
            "required": False,
            "invalid_style": {},
            "error_message": None,
            "states": {}
        }
        
        # Parse CSS
        css_rules = self._parse_css_rules(css_content)
        
        # Check for :required
        required_selector = f"{element_selector}:required"
        if required_selector in css_rules:
            validation["required"] = True
        
        # Check for :invalid
        invalid_selector = f"{element_selector}:invalid"
        if invalid_selector in css_rules:
            validation["invalid_style"] = css_rules[invalid_selector]
            validation["error_message"] = self._extract_error_message_from_css(css_rules[invalid_selector])
        
        # Extract states
        for state in ["hover", "focus", "disabled"]:
            state_selector = f"{element_selector}:{state}"
            if state_selector in css_rules:
                validation["states"][state] = css_rules[state_selector]
        
        return validation
    
    def _parse_css_rules(self, css_content: str) -> Dict[str, Dict[str, str]]:
        """Parse CSS content into selector -> properties mapping."""
        css_rules = {}
        
        # Remove comments
        css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
        
        # Extract rule blocks
        rule_pattern = r'([^{]+)\{([^}]+)\}'
        for match in re.finditer(rule_pattern, css_content):
            selector = match.group(1).strip()
            properties_text = match.group(2).strip()
            
            # Parse properties
            properties = {}
            for prop_match in re.finditer(r'([^:]+):\s*([^;]+);?', properties_text):
                prop_name = prop_match.group(1).strip()
                prop_value = prop_match.group(2).strip()
                properties[prop_name] = prop_value
            
            css_rules[selector] = properties
        
        return css_rules
    
    def _extract_error_message_from_css(self, css_properties: Dict[str, str]) -> Optional[str]:
        """Extract error message from CSS properties (e.g., content in ::after)."""
        # Look for content property (often used for error messages)
        content = css_properties.get("content")
        if content:
            # Remove quotes
            content = re.sub(r'^["\']|["\']$', '', content)
            return content
        
        # Look for ::after or ::before pseudo-elements (would need full CSS parsing)
        return None
    
    def map_states_to_test_conditions(
        self,
        element_selector: str,
        css_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Map CSS states to test conditions.
        
        Returns:
        [{
            "condition": str,  # "hover", "focus", "disabled", "invalid"
            "test_action": str,  # "hover over", "focus on", "disable", "validate"
            "expected_result": str
        }]
        """
        test_conditions = []
        
        element_states = css_analysis.get("element_states", {}).get(element_selector, {})
        validation_states = css_analysis.get("validation_states", {}).get(element_selector, {})
        
        # Hover state
        if "hover" in element_states:
            test_conditions.append({
                "condition": "hover",
                "test_action": f"Hover over {element_selector}",
                "expected_result": "Element displays hover state",
                "css_properties": element_states["hover"]
            })
        
        # Focus state
        if "focus" in element_states:
            test_conditions.append({
                "condition": "focus",
                "test_action": f"Focus on {element_selector}",
                "expected_result": "Element displays focus state",
                "css_properties": element_states["focus"]
            })
        
        # Disabled state
        if "disabled" in element_states:
            test_conditions.append({
                "condition": "disabled",
                "test_action": f"Verify {element_selector} is disabled",
                "expected_result": "Element is disabled and cannot be interacted with",
                "css_properties": element_states["disabled"]
            })
        
        # Invalid state (validation)
        if validation_states:
            test_conditions.append({
                "condition": "invalid",
                "test_action": f"Enter invalid data in {element_selector}",
                "expected_result": validation_states.get("error_message") or "Element displays invalid state",
                "css_properties": validation_states.get("invalid_style", {})
            })
        
        return test_conditions


