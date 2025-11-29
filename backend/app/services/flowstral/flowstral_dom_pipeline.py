"""
Flowstral DOM Snapshot Pipeline
Captures DOM state with selector generation and component detection
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import re

logger = logging.getLogger(__name__)


class DOMSnapshotPipeline:
    """
    Pipeline A: DOM Snapshot Pipeline
    Captures full DOM tree with selector candidates and component hierarchy
    """
    
    def __init__(self):
        pass
    
    async def capture_snapshot(
        self,
        html: str,
        url: str,
        interacted_element: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Capture DOM snapshot with:
        - Full DOM tree
        - Unique element selector candidates
        - Element bounding box + visual location
        - Component hierarchy (React/Vue/Angular)
        - Screenshot reference
        """
        snapshot_id = str(uuid4())
        
        # Parse HTML structure
        html_structure = self._parse_html_structure(html)
        
        # Generate selector candidates for interacted element
        selector_set = {}
        if interacted_element:
            selector_set = self._generate_selector_candidates(interacted_element, html)
        
        # Detect component framework
        component_tree = self._detect_component_framework(html)
        
        # Extract CSS state
        css_state = self._extract_css_state(html)
        
        snapshot = {
            "dom_snapshot_id": snapshot_id,
            "url": url,
            "html_structure": html_structure,
            "css_state": css_state,
            "component_tree": component_tree,
            "selector_set": selector_set,
            "screenshot": None,  # Screenshot captured separately at stable states
            "screenshot_captured": False,  # Flag to indicate if screenshot was taken
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "html_length": len(html),
                "element_count": html_structure.get("element_count", 0),
                "needs_screenshot": self._should_capture_screenshot(interacted_element)  # Determine if this is a stable state
            }
        }
        
        return snapshot
    
    def _parse_html_structure(self, html: str) -> Dict[str, Any]:
        """Parse HTML to extract structure"""
        # Count elements
        element_count = len(re.findall(r'<[^/][^>]*>', html))
        
        # Extract forms
        forms = re.findall(r'<form[^>]*>.*?</form>', html, re.DOTALL)
        
        # Extract inputs
        inputs = re.findall(r'<input[^>]*>', html)
        
        # Extract buttons
        buttons = re.findall(r'<button[^>]*>.*?</button>', html, re.DOTALL)
        
        # Extract links
        links = re.findall(r'<a[^>]*href=["\']([^"\']+)["\']', html)
        
        return {
            "element_count": element_count,
            "forms_count": len(forms),
            "inputs_count": len(inputs),
            "buttons_count": len(buttons),
            "links_count": len(links),
            "has_react": "data-reactroot" in html or "react" in html.lower(),
            "has_vue": "v-" in html or "vue" in html.lower(),
            "has_angular": "ng-" in html or "angular" in html.lower()
        }
    
    def _generate_selector_candidates(
        self,
        element: Dict[str, Any],
        html: str
    ) -> Dict[str, Any]:
        """
        Generate selector candidates in priority order:
        1. ARIA roles/labels
        2. CSS (ID, class, data-testid)
        3. Text fallback locators
        4. XPath
        """
        candidates = []
        
        # ARIA selectors (highest priority)
        if element.get("aria_label"):
            candidates.append({
                "type": "aria",
                "selector": f'[aria-label="{element["aria_label"]}"]',
                "priority": 1,
                "confidence": 0.95
            })
        
        if element.get("role"):
            candidates.append({
                "type": "aria",
                "selector": f'[role="{element["role"]}"]',
                "priority": 2,
                "confidence": 0.90
            })
        
        # CSS selectors
        if element.get("id"):
            candidates.append({
                "type": "css_id",
                "selector": f"#{element['id']}",
                "priority": 3,
                "confidence": 0.95
            })
        
        if element.get("data_testid"):
            candidates.append({
                "type": "css_data_testid",
                "selector": f'[data-testid="{element["data_testid"]}"]',
                "priority": 4,
                "confidence": 0.90
            })
        
        if element.get("class_name"):
            classes = element["class_name"].split()
            if classes:
                candidates.append({
                    "type": "css_class",
                    "selector": f".{'.'.join(classes)}",
                    "priority": 5,
                    "confidence": 0.70
                })
        
        # Text fallback
        if element.get("text_content"):
            text = element["text_content"].strip()[:50]  # Limit length
            candidates.append({
                "type": "text",
                "selector": f'text="{text}"',
                "priority": 6,
                "confidence": 0.60
            })
        
        # XPath (lowest priority)
        if element.get("xpath"):
            candidates.append({
                "type": "xpath",
                "selector": element["xpath"],
                "priority": 7,
                "confidence": 0.50
            })
        
        # Sort by priority
        candidates.sort(key=lambda x: x["priority"])
        
        return {
            "candidates": candidates,
            "recommended": candidates[0] if candidates else None,
            "element_info": {
                "tag": element.get("tag_name"),
                "id": element.get("id"),
                "classes": element.get("class_name"),
                "text": element.get("text_content", "")[:100]
            }
        }
    
    def _detect_component_framework(self, html: str) -> Dict[str, Any]:
        """Detect React/Vue/Angular component hierarchy"""
        framework = None
        components = []
        
        # React detection
        if "data-reactroot" in html or "react" in html.lower():
            framework = "react"
            # Extract React component names (basic detection)
            react_components = re.findall(r'data-react-component="([^"]+)"', html)
            components = react_components
        
        # Vue detection
        elif "v-" in html or "vue" in html.lower():
            framework = "vue"
            # Extract Vue component names
            vue_components = re.findall(r'<([A-Z][a-zA-Z0-9]+)', html)
            components = vue_components
        
        # Angular detection
        elif "ng-" in html or "angular" in html.lower():
            framework = "angular"
            # Extract Angular component names
            angular_components = re.findall(r'<([a-z-]+-[a-z-]+)', html)
            components = angular_components
        
        return {
            "framework": framework,
            "components": components,
            "component_count": len(components)
        }
    
    def _extract_css_state(self, html: str) -> Dict[str, Any]:
        """Extract CSS-related information"""
        # Extract inline styles
        inline_styles = re.findall(r'style=["\']([^"\']+)["\']', html)
        
        # Extract style tags
        style_tags = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
        
        # Extract link tags for external stylesheets
        stylesheet_links = re.findall(r'<link[^>]*rel=["\']stylesheet["\'][^>]*>', html)
        
        return {
            "inline_styles_count": len(inline_styles),
            "style_tags_count": len(style_tags),
            "stylesheet_links_count": len(stylesheet_links),
            "has_css": len(inline_styles) > 0 or len(style_tags) > 0 or len(stylesheet_links) > 0
        }
    
    def _should_capture_screenshot(self, interacted_element: Optional[Dict[str, Any]]) -> bool:
        """
        Determine if screenshot should be captured at this state.
        Screenshots are for visual anchors/documentation, NOT for element detection.
        Capture at:
        - Page load completion
        - After major actions (form submit, navigation)
        - Before/after state changes
        """
        if not interacted_element:
            return False
        
        # Capture screenshots for major actions
        action_type = interacted_element.get("action_type", "")
        tag_name = interacted_element.get("tag_name", "").lower()
        
        # Major actions that indicate stable states
        major_actions = ["submit", "click", "navigate", "load"]
        is_major_action = any(action in action_type.lower() for action in major_actions)
        
        # Form submissions and navigation are key stable states
        is_form_submit = tag_name == "form" or "submit" in action_type.lower()
        is_navigation = "navigate" in action_type.lower() or tag_name == "a"
        
        return is_major_action and (is_form_submit or is_navigation)

