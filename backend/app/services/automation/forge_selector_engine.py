"""
Forge Selector Engine - Production-Grade Minimal Approach
Based on the principle: Trust Playwright first, heal only when needed.

Golden Rules:
1. Trust Playwright's built-in robustness (getByRole, getByTestId, etc.)
2. Only generate 1-2 candidate locators max
3. Speed is the ultimate robustness (<4s generation, <15s runtime)
4. Store intent, not just selectors
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class ForgeSelectorEngine:
    """
    Minimal, production-grade selector engine.
    
    Follows the Forge v2 principles:
    - Trust Playwright first (getByRole, getByTestId, etc.)
    - Generate max 2 candidates (primary + one fallback)
    - Fast (<4s generation)
    - Intent-preserving
    """
    
    def __init__(self):
        # Patterns for unstable IDs (to avoid)
        self.unstable_id_patterns = [
            r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',  # UUID
            r'^react-.*$', r'^vue-.*$', r'^angular-.*$',
            r'^[0-9]+$',  # All numbers
            r'^id-[0-9]+$',  # id-123
        ]
    
    def generate_selector(
        self, 
        element: Dict[str, Any],
        intent: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate minimal selector following Forge principles.
        
        Returns:
            {
                "primary": "page.getByRole('button', { name: 'Sign in' })",
                "fallback": None or one fallback,
                "intent": "click the primary submit button",
                "strategy": "role_with_name"
            }
        """
        # Priority 1: data-testid (99% reliable, Playwright's getByTestId)
        data_testid = element.get("data_testid") or element.get("data-testid")
        if data_testid:
            primary = f"page.getByTestId('{data_testid}')"
            return {
                "primary": primary,
                "fallback": None,  # data-testid is so reliable, no fallback needed
                "intent": intent or f"interact with element with test-id: {data_testid}",
                "strategy": "data_testid"
            }
        
        # Priority 2: Stable ID (95% reliable)
        element_id = element.get("id")
        if element_id and self._is_stable_id(element_id):
            primary = f"page.locator('#{element_id}')"
            # Fallback: try by role if available
            fallback = self._try_role_fallback(element)
            return {
                "primary": primary,
                "fallback": fallback,
                "intent": intent or f"interact with element with id: {element_id}",
                "strategy": "stable_id"
            }
        
        # Priority 3: Role + Name (90% reliable - Playwright's strongest)
        role_selector = self._generate_role_selector(element)
        if role_selector:
            primary = role_selector
            # Fallback: try text if role fails
            fallback = self._try_text_fallback(element)
            return {
                "primary": primary,
                "fallback": fallback,
                "intent": intent or self._infer_intent(element),
                "strategy": "role_with_name"
            }
        
        # Priority 4: Label (for form fields - Playwright's getByLabel)
        label_selector = self._generate_label_selector(element)
        if label_selector:
            primary = label_selector
            return {
                "primary": primary,
                "fallback": None,
                "intent": intent or f"fill form field: {element.get('name') or element.get('aria_label')}",
                "strategy": "label"
            }
        
        # Priority 5: Text (for clickable elements only)
        text_selector = self._generate_text_selector(element)
        if text_selector:
            primary = text_selector
            return {
                "primary": primary,
                "fallback": None,
                "intent": intent or f"click element with text: {element.get('text_content', '')[:30]}",
                "strategy": "text"
            }
        
        # Last resort: CSS (minimal, stable only)
        css_selector = self._generate_minimal_css(element)
        if css_selector:
            primary = f"page.locator('{css_selector}')"
            return {
                "primary": primary,
                "fallback": None,
                "intent": intent or "interact with element",
                "strategy": "css_minimal"
            }
        
        # Ultimate fallback (should rarely happen)
        logger.warning(f"[FORGE] No good selector found for element, using tag fallback")
        tag = element.get("tag_name", "div")
        return {
            "primary": f"page.locator('{tag}').first()",
            "fallback": None,
            "intent": intent or "interact with element",
            "strategy": "tag_fallback"
        }
    
    def _generate_role_selector(self, element: Dict[str, Any]) -> Optional[str]:
        """Generate Playwright getByRole selector (most robust)"""
        tag_name = element.get("tag_name", "").lower()
        accessibility = element.get("accessibility", {}) or {}
        
        # Get role
        role = accessibility.get("role", "").lower()
        if not role:
            # Infer role from tag
            if tag_name == "a":
                role = "link"
            elif tag_name == "button":
                role = "button"
            elif tag_name == "input":
                input_type = element.get("type", "text").lower()
                if input_type in ["checkbox", "radio"]:
                    role = input_type
                else:
                    role = "textbox"
            elif tag_name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                role = "heading"
            else:
                return None
        
        # Get name (aria-label, text, or placeholder)
        name = None
        aria_label = accessibility.get("aria_label") or accessibility.get("ariaLabel")
        if aria_label:
            name = aria_label
        else:
            text_content = (element.get("text_content") or "").strip()
            if text_content and len(text_content) < 100:
                name = text_content
            else:
                placeholder = element.get("placeholder")
                if placeholder:
                    name = placeholder
        
        if not name:
            return None
        
        # Escape quotes
        escaped_name = name.replace("'", "\\'")
        
        # Use exact match for short text, regex for longer
        if len(name) < 20:
            return f"page.getByRole('{role}', {{ name: '{escaped_name}', exact: true }})"
        else:
            # Use case-insensitive regex for longer text
            return f"page.getByRole('{role}', {{ name: /{escaped_name[:20]}/i }})"
    
    def _generate_label_selector(self, element: Dict[str, Any]) -> Optional[str]:
        """Generate Playwright getByLabel selector (for form fields)"""
        tag_name = element.get("tag_name", "").lower()
        if tag_name not in ["input", "select", "textarea"]:
            return None
        
        accessibility = element.get("accessibility", {}) or {}
        aria_label = accessibility.get("aria_label") or accessibility.get("ariaLabel")
        
        if aria_label:
            escaped_label = aria_label.replace("'", "\\'")
            return f"page.getByLabel('{escaped_label}')"
        
        # Try to find associated label element
        element_id = element.get("id")
        if element_id:
            # Label might be associated via "for" attribute
            return f"page.getByLabel({{ for: '{element_id}' }})"
        
        return None
    
    def _generate_text_selector(self, element: Dict[str, Any]) -> Optional[str]:
        """Generate Playwright getByText selector (for clickable elements only)"""
        tag_name = element.get("tag_name", "").lower()
        accessibility = element.get("accessibility", {}) or {}
        role = accessibility.get("role", "").lower()
        
        # Only use text for clickable elements
        is_clickable = (
            tag_name in ["a", "button"] or 
            role in ["link", "button", "menuitem"]
        )
        
        if not is_clickable:
            return None
        
        text_content = (element.get("text_content") or "").strip()
        if not text_content or len(text_content) > 100:
            return None
        
        escaped_text = text_content.replace("'", "\\'")
        
        # Use exact match for short text
        if len(text_content) < 30:
            return f"page.getByText('{escaped_text}', {{ exact: true }})"
        else:
            # Use first() for longer text (might match multiple)
            return f"page.getByText('{escaped_text}', {{ exact: false }}).first()"
    
    def _try_role_fallback(self, element: Dict[str, Any]) -> Optional[str]:
        """Try role-based fallback if ID selector fails"""
        return self._generate_role_selector(element)
    
    def _try_text_fallback(self, element: Dict[str, Any]) -> Optional[str]:
        """Try text-based fallback if role selector fails"""
        return self._generate_text_selector(element)
    
    def _generate_minimal_css(self, element: Dict[str, Any]) -> Optional[str]:
        """Generate minimal CSS selector (last resort)"""
        tag_name = element.get("tag_name", "div").lower()
        
        # Only use stable attributes
        element_name = element.get("name")
        if element_name and tag_name in ["input", "select", "textarea"]:
            return f"{tag_name}[name=\"{element_name}\"]"
        
        # Try type for inputs
        if tag_name == "input":
            input_type = element.get("type", "")
            if input_type:
                return f"input[type=\"{input_type}\"]"
        
        return None
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if ID looks stable (not auto-generated)"""
        if not element_id or len(element_id) > 50:
            return False
        
        import re
        # Check against unstable patterns
        for pattern in self.unstable_id_patterns:
            if re.match(pattern, element_id, re.IGNORECASE):
                return False
        
        # Check if all numbers (likely timestamp/counter)
        if element_id.replace('-', '').replace('_', '').isdigit():
            return False
        
        return True
    
    def _infer_intent(self, element: Dict[str, Any]) -> str:
        """Infer human-readable intent from element"""
        tag_name = element.get("tag_name", "").lower()
        text_content = (element.get("text_content") or "").strip()
        accessibility = element.get("accessibility", {}) or {}
        aria_label = accessibility.get("aria_label") or accessibility.get("ariaLabel")
        
        action = "interact with"
        if tag_name == "a" or tag_name == "link":
            action = "click link"
        elif tag_name == "button":
            action = "click button"
        elif tag_name in ["input", "select", "textarea"]:
            action = "fill"
        
        target = aria_label or text_content or element.get("name") or "element"
        if len(target) > 30:
            target = target[:30] + "..."
        
        return f"{action}: {target}"


# Global instance
_forge_engine = None

def get_forge_selector_engine() -> ForgeSelectorEngine:
    """Get or create global ForgeSelectorEngine instance"""
    global _forge_engine
    if _forge_engine is None:
        _forge_engine = ForgeSelectorEngine()
    return _forge_engine

