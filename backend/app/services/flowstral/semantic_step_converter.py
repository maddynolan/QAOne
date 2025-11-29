"""
Semantic Step Converter
Converts Flowstral action graph events into semantic JSON steps that are decoupled from UI changes.
This allows users to update test steps without re-recording.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SemanticStepConverter:
    """
    Converts raw Flowstral events into semantic JSON steps.
    
    Semantic JSON Format:
    {
      "action": "click",
      "target_label": "Submit Button",
      "selectors": {
        "testid": "submit-btn",
        "role": "button",
        "text": "Submit"
      },
      "wait_strategy": "visible",
      "expected_outcome": "Form submission"
    }
    """
    
    def __init__(self):
        pass
    
    def convert_event_to_semantic_step(
        self,
        event: Dict[str, Any],
        step_index: int
    ) -> Dict[str, Any]:
        """
        Convert a Flowstral event into a semantic JSON step.
        
        Args:
            event: Raw event from Flowstral capture
            step_index: Index of the step in the sequence
            
        Returns:
            Semantic JSON step dictionary
        """
        event_type = event.get("event_type", "unknown")
        event_data = event.get("event_data", {})
        interacted_element = event_data.get("interacted_element", {})
        
        # Extract multi-layer selectors
        selectors_data = interacted_element.get("selectors", {})
        accessibility = interacted_element.get("accessibility", {})
        
        # Build semantic selectors object
        semantic_selectors = {}
        
        # Layer 1: data-testid or id
        if selectors_data.get("layer1_gold"):
            selector = selectors_data["layer1_gold"]
            if "[data-testid=" in selector:
                testid = selector.split('"')[1] if '"' in selector else None
                if testid:
                    semantic_selectors["testid"] = testid
            elif selector.startswith("#"):
                element_id = selector[1:]
                if element_id:
                    semantic_selectors["id"] = element_id
        
        # Layer 2: Role + name/aria-label
        if selectors_data.get("layer2_silver"):
            role_selector = selectors_data["layer2_silver"]
            if "[role=" in role_selector:
                role = role_selector.split('role="')[1].split('"')[0] if 'role="' in role_selector else None
                if role:
                    semantic_selectors["role"] = role
            
            if accessibility.get("aria_label"):
                semantic_selectors["aria_label"] = accessibility["aria_label"]
            elif accessibility.get("name"):
                semantic_selectors["name"] = accessibility["name"]
        
        # Layer 3: Text content
        if selectors_data.get("layer3_bronze"):
            text_selector = selectors_data["layer3_bronze"]
            if 'text="' in text_selector:
                text = text_selector.split('text="')[1].split('"')[0] if 'text="' in text_selector else None
                if text:
                    semantic_selectors["text"] = text
        elif interacted_element.get("text_content"):
            text = interacted_element["text_content"].strip()
            if text and len(text) < 50:
                semantic_selectors["text"] = text
        
        # Layer 4: CSS attributes
        if selectors_data.get("layer4_iron"):
            semantic_selectors["css"] = selectors_data["layer4_iron"]
        
        # Generate target label from available data
        target_label = self._generate_target_label(
            event_type,
            interacted_element,
            accessibility,
            semantic_selectors
        )
        
        # Determine wait strategy
        wait_strategy = self._determine_wait_strategy(event_type, interacted_element)
        
        # Determine expected outcome
        expected_outcome = self._determine_expected_outcome(event_type, event_data)
        
        # Build semantic step
        semantic_step = {
            "step_index": step_index,
            "action": event_type,
            "target_label": target_label,
            "selectors": semantic_selectors,
            "wait_strategy": wait_strategy,
            "expected_outcome": expected_outcome,
            "timestamp": event.get("timestamp", datetime.utcnow().isoformat()),
            "url": event_data.get("url", ""),
            "value": event_data.get("value") if event_type == "input" else None
        }
        
        return semantic_step
    
    def _generate_target_label(
        self,
        event_type: str,
        interacted_element: Dict[str, Any],
        accessibility: Dict[str, Any],
        selectors: Dict[str, Any]
    ) -> str:
        """Generate a human-readable target label."""
        # Try aria-label first
        if accessibility.get("aria_label"):
            return accessibility["aria_label"]
        
        # Try text content
        if selectors.get("text"):
            return selectors["text"]
        
        # Try name attribute
        if selectors.get("name"):
            return f"{event_type.title()} {selectors['name']}"
        
        # Try testid
        if selectors.get("testid"):
            return f"{event_type.title()} {selectors['testid']}"
        
        # Try role
        if selectors.get("role"):
            role = selectors["role"]
            if accessibility.get("aria_label"):
                return f"{role.title()} ({accessibility['aria_label']})"
            return f"{role.title()} button"
        
        # Fallback to tag name
        tag_name = interacted_element.get("tag_name", "element")
        return f"{event_type.title()} {tag_name.lower()}"
    
    def _determine_wait_strategy(
        self,
        event_type: str,
        interacted_element: Dict[str, Any]
    ) -> str:
        """Determine the appropriate wait strategy for the action."""
        if event_type == "click":
            return "visible"  # Wait for element to be visible before clicking
        elif event_type == "input" or event_type == "fill":
            return "visible"  # Wait for input to be visible
        elif event_type == "navigate":
            return "networkidle"  # Wait for network to be idle
        else:
            return "visible"  # Default to visible
    
    def _determine_expected_outcome(
        self,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> str:
        """Determine the expected outcome of the action."""
        if event_type == "click":
            # Try to infer from target
            interacted_element = event_data.get("interacted_element", {})
            text = interacted_element.get("text_content", "").lower()
            if "submit" in text or "login" in text:
                return "Form submission or page navigation"
            elif "search" in text:
                return "Search results displayed"
            else:
                return "Element clicked successfully"
        elif event_type == "input":
            return "Value entered successfully"
        elif event_type == "navigate":
            return "Page loaded successfully"
        else:
            return "Action completed successfully"
    
    def convert_events_to_semantic_steps(
        self,
        events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Convert a list of events into semantic JSON steps.
        
        Args:
            events: List of raw Flowstral events
            
        Returns:
            List of semantic JSON steps
        """
        semantic_steps = []
        
        for idx, event in enumerate(events):
            try:
                semantic_step = self.convert_event_to_semantic_step(event, idx + 1)
                semantic_steps.append(semantic_step)
            except Exception as e:
                logger.warning(f"Failed to convert event {idx} to semantic step: {e}")
                continue
        
        return semantic_steps


# Global instance
_semantic_converter = None

def get_semantic_step_converter() -> SemanticStepConverter:
    """Get or create global SemanticStepConverter instance"""
    global _semantic_converter
    if _semantic_converter is None:
        _semantic_converter = SemanticStepConverter()
    return _semantic_converter

