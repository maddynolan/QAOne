"""
Industry-Standard Locator Engine
Generates stable, resilient locators following industry best practices.
Supports auto-healing with fallback strategies.
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from enum import Enum

# Import robust discovery engine
from app.services.automation.robust_element_discovery import (
    RobustElementDiscovery,
    ElementSignature,
    get_robust_element_discovery
)

logger = logging.getLogger(__name__)


class LocatorPriority(Enum):
    """Locator priority levels (industry standard order)"""
    DATA_TESTID = 1
    ARIA_LABEL = 2
    ARIA_LABELLEDBY = 3
    ROLE = 4
    ID = 5
    NAME = 6
    CSS_STABLE = 7
    TEXT_CONTENT = 8
    CSS_FALLBACK = 9
    XPATH = 10


class LocatorEngine:
    """
    Industry-standard locator engine that generates stable, resilient locators.
    Follows best practices from Playwright, Selenium, Cypress documentation.
    """
    
    def __init__(self):
        self.priority_order = [
            LocatorPriority.DATA_TESTID,
            LocatorPriority.ARIA_LABEL,
            LocatorPriority.ARIA_LABELLEDBY,
            LocatorPriority.ROLE,
            LocatorPriority.ID,
            LocatorPriority.NAME,
            LocatorPriority.CSS_STABLE,
            LocatorPriority.TEXT_CONTENT,
            LocatorPriority.CSS_FALLBACK,
            LocatorPriority.XPATH
        ]
        
        # Initialize robust discovery engine for advanced element finding
        self.robust_discovery = get_robust_element_discovery()
    
    def generate_optimal_locator(
        self,
        element_html: str,
        element_text: Optional[str] = None,
        element_attributes: Optional[Dict[str, str]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate optimal locator with fallback chain.
        
        Returns:
            Dict with:
                - primary: Best locator
                - fallbacks: List of fallback locators in priority order
                - strategy: Strategy used
                - confidence: Confidence score (0-1)
        """
        if not element_html:
            return self._generate_fallback_locator(element_text)
        
        # Extract attributes from HTML
        attributes = self._extract_attributes(element_html)
        if element_attributes:
            attributes.update(element_attributes)
        
        # Generate locators in priority order
        locators = []
        
        # 1. data-testid (highest priority)
        if 'data-testid' in attributes:
            testid = attributes['data-testid']
            locators.append({
                "locator": f'[data-testid="{testid}"]',
                "priority": LocatorPriority.DATA_TESTID,
                "strategy": "data-testid",
                "confidence": 0.95,
                "description": f"data-testid attribute: {testid}"
            })
        
        # 2. aria-label
        if 'aria-label' in attributes:
            aria_label = attributes['aria-label']
            locators.append({
                "locator": f'[aria-label="{aria_label}"]',
                "priority": LocatorPriority.ARIA_LABEL,
                "strategy": "aria-label",
                "confidence": 0.90,
                "description": f"aria-label: {aria_label}"
            })
        
        # 3. aria-labelledby
        if 'aria-labelledby' in attributes:
            labelledby = attributes['aria-labelledby']
            locators.append({
                "locator": f'[aria-labelledby="{labelledby}"]',
                "priority": LocatorPriority.ARIA_LABELLEDBY,
                "strategy": "aria-labelledby",
                "confidence": 0.85,
                "description": f"aria-labelledby: {labelledby}"
            })
        
        # 4. role attribute
        if 'role' in attributes:
            role = attributes['role']
            # Combine with other attributes for specificity
            if 'aria-label' in attributes:
                locators.append({
                    "locator": f'[role="{role}"][aria-label="{attributes["aria-label"]}"]',
                    "priority": LocatorPriority.ROLE,
                    "strategy": "role+aria-label",
                    "confidence": 0.88,
                    "description": f"role={role} with aria-label"
                })
            else:
                locators.append({
                    "locator": f'[role="{role}"]',
                    "priority": LocatorPriority.ROLE,
                    "strategy": "role",
                    "confidence": 0.75,
                    "description": f"role: {role}"
                })
        
        # 5. id attribute
        if 'id' in attributes:
            element_id = attributes['id']
            # Check if ID looks stable (not auto-generated)
            if self._is_stable_id(element_id):
                locators.append({
                    "locator": f'#{element_id}',
                    "priority": LocatorPriority.ID,
                    "strategy": "id",
                    "confidence": 0.80,
                    "description": f"id: {element_id}"
                })
        
        # 6. name attribute (for form elements)
        if 'name' in attributes:
            name = attributes['name']
            tag_name = self._extract_tag_name(element_html)
            if tag_name in ['input', 'select', 'textarea', 'button']:
                locators.append({
                    "locator": f'{tag_name}[name="{name}"]',
                    "priority": LocatorPriority.NAME,
                    "strategy": "name",
                    "confidence": 0.75,
                    "description": f"name: {name}"
                })
        
        # 7. Stable CSS selectors
        css_locator = self._generate_stable_css(element_html, attributes)
        if css_locator:
            locators.append({
                "locator": css_locator,
                "priority": LocatorPriority.CSS_STABLE,
                "strategy": "css-stable",
                "confidence": 0.70,
                "description": "Stable CSS selector"
            })
        
        # 8. Text content (if available and unique)
        if element_text and self._is_unique_text(element_text, context):
            # Escape special characters
            escaped_text = self._escape_text_for_selector(element_text)
            locators.append({
                "locator": f'text="{escaped_text}"',
                "priority": LocatorPriority.TEXT_CONTENT,
                "strategy": "text",
                "confidence": 0.65,
                "description": f"Text content: {element_text[:50]}"
            })
            # Also try :has-text() for Playwright
            locators.append({
                "locator": f':has-text("{escaped_text}")',
                "priority": LocatorPriority.TEXT_CONTENT,
                "strategy": "has-text",
                "confidence": 0.60,
                "description": f"has-text: {element_text[:50]}"
            })
        
        # 9. CSS fallback (less stable)
        css_fallback = self._generate_css_fallback(element_html, attributes)
        if css_fallback:
            locators.append({
                "locator": css_fallback,
                "priority": LocatorPriority.CSS_FALLBACK,
                "strategy": "css-fallback",
                "confidence": 0.50,
                "description": "CSS fallback selector"
            })
        
        # 10. XPath (last resort)
        xpath_locator = self._generate_xpath(element_html, attributes, element_text)
        if xpath_locator:
            locators.append({
                "locator": xpath_locator,
                "priority": LocatorPriority.XPATH,
                "strategy": "xpath",
                "confidence": 0.40,
                "description": "XPath selector"
            })
        
        # Sort by priority
        locators.sort(key=lambda x: x["priority"].value)
        
        if not locators:
            # Ultimate fallback
            return self._generate_fallback_locator(element_text)
        
        primary = locators[0]
        fallbacks = locators[1:] if len(locators) > 1 else []
        
        return {
            "primary": primary["locator"],
            "strategy": primary["strategy"],
            "confidence": primary["confidence"],
            "fallbacks": [f["locator"] for f in fallbacks],
            "fallback_details": fallbacks,
            "all_locators": locators
        }
    
    def _extract_attributes(self, html: str) -> Dict[str, str]:
        """Extract all attributes from HTML element."""
        attributes = {}
        
        # Extract tag name
        tag_match = re.search(r'<(\w+)', html, re.IGNORECASE)
        if tag_match:
            attributes['_tag'] = tag_match.group(1).lower()
        
        # Extract all attributes using regex
        attr_pattern = r'(\w+(?:-\w+)*)=["\']([^"\']*)["\']'
        for match in re.finditer(attr_pattern, html, re.IGNORECASE):
            attr_name = match.group(1).lower()
            attr_value = match.group(2)
            attributes[attr_name] = attr_value
        
        return attributes
    
    def _extract_tag_name(self, html: str) -> str:
        """Extract HTML tag name."""
        match = re.search(r'<(\w+)', html, re.IGNORECASE)
        return match.group(1).lower() if match else "div"
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if ID looks stable (not auto-generated)."""
        # Auto-generated IDs often contain:
        # - UUIDs: contains hyphens and long alphanumeric
        # - Timestamps: numbers only or very long
        # - Random strings: very long alphanumeric
        
        # Stable IDs are usually:
        # - Short and descriptive
        # - Use kebab-case, camelCase, or snake_case
        # - Don't contain only numbers
        
        if len(element_id) > 50:  # Likely auto-generated
            return False
        
        # Check for UUID pattern
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if re.match(uuid_pattern, element_id, re.IGNORECASE):
            return False
        
        # Check if it's all numbers (likely timestamp or counter)
        if element_id.replace('-', '').replace('_', '').isdigit():
            return False
        
        return True
    
    def _generate_stable_css(self, html: str, attributes: Dict[str, str]) -> Optional[str]:
        """Generate stable CSS selector."""
        tag_name = attributes.get('_tag', 'div')
        
        # Try class names (if they look stable)
        if 'class' in attributes:
            classes = attributes['class'].split()
            # Filter out likely dynamic classes
            stable_classes = [c for c in classes if self._is_stable_class(c)]
            if stable_classes:
                class_selector = '.'.join(stable_classes)
                return f'{tag_name}.{class_selector}'
        
        # Try type attribute for inputs
        if tag_name == 'input' and 'type' in attributes:
            input_type = attributes['type']
            if 'name' in attributes:
                return f'input[type="{input_type}"][name="{attributes["name"]}"]'
            return f'input[type="{input_type}"]'
        
        # Try button type
        if tag_name == 'button' and 'type' in attributes:
            return f'button[type="{attributes["type"]}"]'
        
        return None
    
    def _is_stable_class(self, class_name: str) -> bool:
        """Check if CSS class looks stable (not auto-generated)."""
        # Auto-generated classes often:
        # - Are very long
        # - Contain random strings
        # - Are all lowercase with no semantic meaning
        
        if len(class_name) > 30:
            return False
        
        # Common patterns for stable classes:
        # - kebab-case: button-primary, nav-item
        # - BEM: block__element--modifier
        # - camelCase: primaryButton
        
        # If it looks like a semantic class, it's probably stable
        semantic_patterns = [
            r'^[a-z]+(-[a-z]+)+$',  # kebab-case
            r'^[a-z]+(__[a-z]+)?(--[a-z]+)?$',  # BEM
            r'^[a-z][a-zA-Z0-9]+$'  # camelCase
        ]
        
        for pattern in semantic_patterns:
            if re.match(pattern, class_name):
                return True
        
        return False
    
    def _generate_css_fallback(self, html: str, attributes: Dict[str, str]) -> Optional[str]:
        """Generate CSS fallback selector (less stable)."""
        tag_name = attributes.get('_tag', 'div')
        
        # Use any class (even if unstable)
        if 'class' in attributes:
            classes = attributes['class'].split()
            if classes:
                class_selector = '.'.join(classes[0].split()[:2])  # Limit to 2 classes
                return f'{tag_name}.{class_selector}'
        
        # Use tag + any attribute
        if attributes:
            # Try to find a unique attribute
            for attr, value in attributes.items():
                if attr not in ['_tag', 'class', 'style'] and value:
                    return f'{tag_name}[{attr}="{value}"]'
        
        return f'{tag_name}'
    
    def _generate_xpath(self, html: str, attributes: Dict[str, str], text: Optional[str]) -> Optional[str]:
        """Generate XPath selector (last resort)."""
        tag_name = attributes.get('_tag', 'div')
        
        # Try to build XPath with attributes
        xpath_parts = [f'//{tag_name}']
        
        if 'id' in attributes:
            xpath_parts.append(f'[@id="{attributes["id"]}"]')
        elif 'name' in attributes:
            xpath_parts.append(f'[@name="{attributes["name"]}"]')
        elif 'class' in attributes:
            classes = attributes['class'].split()
            if classes:
                xpath_parts.append(f'[contains(@class, "{classes[0]}")]')
        elif text:
            xpath_parts.append(f'[text()="{text}"]')
        else:
            return None  # XPath without any identifier is too fragile
        
        return ''.join(xpath_parts)
    
    def _is_unique_text(self, text: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Check if text is likely unique on the page."""
        if not text or len(text.strip()) < 3:
            return False
        
        # Very short text is probably not unique
        if len(text.strip()) < 5:
            return False
        
        # Common non-unique text
        common_texts = [
            'click', 'submit', 'ok', 'cancel', 'close', 'next', 'previous',
            'save', 'delete', 'edit', 'add', 'remove', 'search', 'filter'
        ]
        
        if text.strip().lower() in common_texts:
            return False
        
        return True
    
    def _escape_text_for_selector(self, text: str) -> str:
        """Escape special characters in text for use in selectors."""
        # Escape quotes
        text = text.replace('"', '\\"')
        text = text.replace("'", "\\'")
        return text
    
    def _generate_fallback_locator(self, text: Optional[str] = None) -> Dict[str, Any]:
        """Generate ultimate fallback locator."""
        if text:
            return {
                "primary": f'text="{text}"',
                "strategy": "text-fallback",
                "confidence": 0.30,
                "fallbacks": [],
                "fallback_details": [],
                "all_locators": []
            }
        else:
            return {
                "primary": "body",  # Last resort
                "strategy": "body-fallback",
                "confidence": 0.10,
                "fallbacks": [],
                "fallback_details": [],
                "all_locators": []
            }
    
    def build_auto_healing_locator(self, locator_info: Dict[str, Any]) -> str:
        """
        Build Playwright code with auto-healing fallback chain.
        
        Returns Playwright code that tries locators in order until one works.
        """
        primary = locator_info.get("primary", "")
        fallbacks = locator_info.get("fallbacks", [])
        
        if not fallbacks:
            return f'page.locator("{primary}")'
        
        # Build try-catch with fallbacks
        code_lines = [
            "let element = null;",
            f'try {{',
            f'  element = page.locator("{primary}");',
            f'  await element.waitFor({{ state: "visible", timeout: 5000 }});',
            f'}} catch (e) {{'
        ]
        
        for i, fallback in enumerate(fallbacks):
            if i < len(fallbacks) - 1:
                code_lines.append(f'  try {{')
                code_lines.append(f'    element = page.locator("{fallback}");')
                code_lines.append(f'    await element.waitFor({{ state: "visible", timeout: 5000 }});')
                code_lines.append(f'    break;')
                code_lines.append(f'  }} catch (e{i+1}) {{')
            else:
                code_lines.append(f'  element = page.locator("{fallback}");')
                code_lines.append(f'  await element.waitFor({{ state: "visible", timeout: 5000 }});')
        
        # Close all try-catch blocks
        for _ in range(len(fallbacks)):
            code_lines.append('  }')
        code_lines.append('}')
        code_lines.append('if (!element) throw new Error("Element not found with any locator");')
        
        return '\n'.join(code_lines)


# Global instance
_locator_engine = None

def get_locator_engine() -> LocatorEngine:
    """Get or create global LocatorEngine instance"""
    global _locator_engine
    if _locator_engine is None:
        _locator_engine = LocatorEngine()
    return _locator_engine

