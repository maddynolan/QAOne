"""
Simple, Robust Selector Engine
Based on how professional tools (UiPath, Selenium IDE, Playwright Codegen) actually work.

Principle: Generate ONE good selector at capture time, use it directly.
No complex fallback chains, no regeneration, just simple and reliable.
"""

import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class SimpleSelectorEngine:
    """
    Simple selector engine that generates ONE reliable selector.
    Follows the KISS principle - Keep It Simple, Stupid.
    
    Priority (industry standard):
    1. data-testid (99% reliable)
    2. Stable ID (95% reliable)
    3. Role + name (for links/buttons - 90% reliable)
    4. Text content (for links/buttons only - 80% reliable)
    5. CSS selector (last resort - 60% reliable)
    """
    
    def __init__(self):
        # Patterns for unstable IDs (to avoid)
        self.unstable_id_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',  # UUID
            r'^react-.*$', r'^vue-.*$', r'^angular-.*$',
            r'^[0-9]+$',  # All numbers
            r'^id-[0-9]+$',  # id-123
        ]
    
    def generate_selector(self, element: Dict[str, Any]) -> str:
        """
        Generate ONE reliable selector for an element.
        
        Returns Playwright locator code (e.g., "page.getByRole('link', { name: 'Login' })")
        """
        # Priority 1: data-testid (most reliable)
        data_testid = element.get("data_testid") or element.get("data-testid")
        if data_testid:
            logger.debug(f"[SIMPLE] Using data-testid: {data_testid}")
            return f"page.getByTestId('{data_testid}')"
        
        # Priority 2: Stable ID
        element_id = element.get("id")
        if element_id and self._is_stable_id(element_id):
            logger.debug(f"[SIMPLE] Using stable ID: {element_id}")
            return f"page.locator('#{element_id}')"
        
        # Priority 3: Role + name (for links, buttons, form elements)
        tag_name = element.get("tag_name", "").lower()
        text_content = (element.get("text_content") or "").strip()
        aria_label = None
        
        # Get ARIA label from accessibility data
        accessibility = element.get("accessibility", {}) or {}
        if isinstance(accessibility, dict):
            aria_label = accessibility.get("aria_label") or accessibility.get("ariaLabel")
            role = accessibility.get("role", "").lower()
        else:
            role = None
        
        # For links: use getByRole('link')
        if tag_name == "a" or tag_name == "link":
            if aria_label:
                escaped_label = aria_label.replace("'", "\\'")
                logger.debug(f"[SIMPLE] Using role+aria-label for link: {aria_label}")
                return f"page.getByRole('link', {{ name: '{escaped_label}' }})"
            elif text_content and len(text_content) < 100:
                escaped_text = text_content.replace("'", "\\'")
                logger.debug(f"[SIMPLE] Using role+text for link: {text_content[:30]}")
                return f"page.getByRole('link', {{ name: '{escaped_text}' }})"
        
        # For buttons: use getByRole('button')
        if tag_name == "button" or (role and role == "button"):
            if aria_label:
                escaped_label = aria_label.replace("'", "\\'")
                logger.debug(f"[SIMPLE] Using role+aria-label for button: {aria_label}")
                return f"page.getByRole('button', {{ name: '{escaped_label}' }})"
            elif text_content and len(text_content) < 100:
                escaped_text = text_content.replace("'", "\\'")
                logger.debug(f"[SIMPLE] Using role+text for button: {text_content[:30]}")
                return f"page.getByRole('button', {{ name: '{escaped_text}' }})"
        
        # For form inputs: use name attribute
        element_name = element.get("name")
        if tag_name in ["input", "select", "textarea"] and element_name:
            logger.debug(f"[SIMPLE] Using name attribute for form element: {element_name}")
            return f"page.locator('{tag_name}[name=\"{element_name}\"]')"
        
        # Priority 4: Text content (only for clickable elements)
        if text_content and len(text_content.strip()) > 0 and len(text_content.strip()) < 100:
            # Only use text for links, buttons, or elements with click handlers
            is_clickable = tag_name in ["a", "button"] or role in ["link", "button"]
            if is_clickable:
                escaped_text = text_content.strip().replace("'", "\\'")
                logger.debug(f"[SIMPLE] Using text for clickable element: {text_content[:30]}")
                return f"page.getByText('{escaped_text}', {{ exact: true }})"
        
        # Priority 5: CSS selector (last resort)
        css_selector = self._generate_css_selector(element)
        if css_selector:
            logger.debug(f"[SIMPLE] Using CSS selector (last resort): {css_selector}")
            return f"page.locator('{css_selector}')"
        
        # Ultimate fallback: tag name (not ideal, but better than nothing)
        logger.warning(f"[SIMPLE] Using tag name fallback for {tag_name}")
        return f"page.locator('{tag_name}').first()"
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if ID looks stable (not auto-generated)"""
        if not element_id or len(element_id) > 50:
            return False
        
        # Check against unstable patterns
        for pattern in self.unstable_id_patterns:
            if re.match(pattern, element_id, re.IGNORECASE):
                return False
        
        # Check if all numbers (likely timestamp/counter)
        if element_id.replace('-', '').replace('_', '').isdigit():
            return False
        
        return True
    
    def _generate_css_selector(self, element: Dict[str, Any]) -> Optional[str]:
        """Generate simple CSS selector as last resort"""
        tag_name = element.get("tag_name", "div").lower()
        
        # Try class name (if it looks stable)
        class_name = element.get("class_name", "")
        if class_name:
            classes = class_name.split()
            # Use first class that looks stable
            for cls in classes[:1]:  # Only use first class
                if len(cls) < 30 and not cls.startswith('_'):  # Basic stability check
                    return f"{tag_name}.{cls}"
        
        # Try type attribute for inputs
        if tag_name == "input":
            input_type = element.get("type", "")
            if input_type:
                return f"input[type=\"{input_type}\"]"
        
        return None


# Global instance
_simple_engine = None

def get_simple_selector_engine() -> SimpleSelectorEngine:
    """Get or create global SimpleSelectorEngine instance"""
    global _simple_engine
    if _simple_engine is None:
        _simple_engine = SimpleSelectorEngine()
    return _simple_engine




