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
        interacted_element: Optional[Dict[str, Any]] = None,
        previous_html: Optional[str] = None,
        deduplication_enabled: bool = False,
        compression_algorithm: str = "brotli"
    ) -> Dict[str, Any]:
        """
        Capture DOM snapshot with:
        - Full DOM tree
        - Unique element selector candidates
        - Element bounding box + visual location
        - Component hierarchy (React/Vue/Angular)
        - Screenshot reference
        - Optional deduplication
        """
        snapshot_id = str(uuid4())
        
        # Process deduplication if enabled
        content_hash = None
        is_reference = False
        compressed_size = None
        compression_ratio = None
        
        if deduplication_enabled:
            from app.services.flowstral.flowstral_snapshot_deduplicator import get_snapshot_deduplicator
            deduplicator = get_snapshot_deduplicator(
                compression_algorithm=compression_algorithm,
                enable_delta_storage=True
            )
            reference = await deduplicator.process_snapshot(html, previous_html)
            content_hash = reference.content_hash
            is_reference = reference.is_reference
            compressed_size = reference.compressed_size
            compression_ratio = reference.compression_ratio
            snapshot_id = reference.snapshot_id
        
        # Parse HTML structure
        html_structure = self._parse_html_structure(html)
        
        # Generate selector candidates for interacted element
        selector_set = {}
        if interacted_element:
            selector_set = await self._generate_selector_candidates(interacted_element, html)
        
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
        
        # Add deduplication metadata if enabled
        if deduplication_enabled:
            snapshot["content_hash"] = content_hash
            snapshot["is_reference"] = is_reference
            snapshot["compressed_size"] = compressed_size
            snapshot["compression_ratio"] = compression_ratio
            snapshot["original_size"] = len(html.encode('utf-8'))
        
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
    
    async def _generate_selector_candidates(
        self,
        element: Dict[str, Any],
        html: str
    ) -> Dict[str, Any]:
        """
        Generate selector candidates using ENHANCED multi-strategy engine (like Tosca, Mabl, Testim):
        1. data-testid (99% stable)
        2. Stable ID (95% stable)
        3. ARIA label (90% stable)
        4. ARIA labelledby (90% stable)
        5. Role + name (85% stable)
        6. Name attribute (80% stable)
        7. Context-aware (85% stable - parent-child)
        8. Semantic text (75% stable - fuzzy)
        9. Text content (70% stable)
        10. Visual anchor (80% stable - position)
        11. CSS stable (60% stable)
        12. CSS fallback (50% stable)
        13. XPath (50% stable - last resort)
        """
        # Use Simple Selector Engine (robust, reliable, like professional tools)
        from app.services.automation.simple_selector_engine import get_simple_selector_engine
        simple_engine = get_simple_selector_engine()
        
        # Generate ONE reliable selector (simple, like professional tools)
        try:
            playwright_locator = simple_engine.generate_selector(element)
            
            # Convert to our format (for compatibility)
            candidates = [{
                "type": "simple",
                "selector": playwright_locator,
                "priority": 1,
                "confidence": 0.9,
                "stability_score": 0.9,
                "playwright_locator": playwright_locator,
                "description": "Simple reliable selector"
            }]
            
            recommended = candidates[0]
            
            return {
                "candidates": candidates,
                "recommended": recommended,
                "primary_selector": playwright_locator,
                "fallback_selectors": [],  # No fallbacks - one selector is enough
                "stability_score": 0.9,
                "recommended_strategy": "simple",
                "element_info": {
                    "tag": element.get("tag_name"),
                    "id": element.get("id"),
                    "classes": element.get("class_name"),
                    "text": element.get("text_content", "")[:100]
                }
            }
        except Exception as e:
            logger.warning(f"Simple selector engine failed, using basic fallback: {e}")
            # Fall back to basic LocatorEngine
            from app.services.automation.locator_engine import get_locator_engine
            locator_engine = get_locator_engine()
        
        # Extract attributes for LocatorEngine
        element_attributes = {}
        if element.get("id"):
            element_attributes["id"] = element["id"]
        if element.get("data_testid") or element.get("data-testid"):
            element_attributes["data-testid"] = element.get("data_testid") or element.get("data-testid")
        if element.get("name"):
            element_attributes["name"] = element["name"]
        if element.get("type"):
            element_attributes["type"] = element["type"]
        
        # Get accessibility attributes
        accessibility = element.get("accessibility", {})
        if isinstance(accessibility, dict):
            if accessibility.get("aria_label") or accessibility.get("ariaLabel"):
                element_attributes["aria-label"] = accessibility.get("aria_label") or accessibility.get("ariaLabel")
            if accessibility.get("aria_labelledby") or accessibility.get("ariaLabelledBy"):
                element_attributes["aria-labelledby"] = accessibility.get("aria_labelledby") or accessibility.get("ariaLabelledBy")
            if accessibility.get("role"):
                element_attributes["role"] = accessibility["role"]
        
        # Generate optimal locator using LocatorEngine
        try:
            # Build element HTML string for LocatorEngine
            tag_name = element.get("tag_name", "div").lower()
            element_html = f"<{tag_name}"
            for key, value in element_attributes.items():
                element_html += f' {key}="{value}"'
            element_html += ">"
            
            locator_result = locator_engine.generate_optimal_locator(
                element_html=element_html,
                element_text=element.get("text_content"),
                element_attributes=element_attributes
            )
            
            # Convert LocatorEngine result to our format
            primary = locator_result.get("primary", "")
            fallbacks = locator_result.get("fallbacks", [])
            
            if primary:
                candidates.append({
                    "type": locator_result.get("strategy", "unknown"),
                    "selector": primary,
                    "priority": 1,
                    "confidence": locator_result.get("confidence", 0.9),
                    "playwright_locator": self._convert_to_playwright_locator(primary, element_attributes)
                })
            
            # Add fallbacks
            for i, fallback in enumerate(fallbacks[:4]):  # Limit to 4 fallbacks
                candidates.append({
                    "type": fallback.get("strategy", "fallback"),
                    "selector": fallback.get("locator", ""),
                    "priority": i + 2,
                    "confidence": fallback.get("confidence", 0.7),
                    "playwright_locator": self._convert_to_playwright_locator(fallback.get("locator", ""), element_attributes)
                })
        except Exception as e:
            logger.warning(f"LocatorEngine failed, using fallback: {e}")
        
        # Fallback: Generate basic selectors if LocatorEngine fails
        if not candidates:
            # Priority 1: data-testid
            if element.get("data_testid") or element.get("data-testid"):
                testid = element.get("data_testid") or element.get("data-testid")
                candidates.append({
                    "type": "data_testid",
                    "selector": f'[data-testid="{testid}"]',
                    "priority": 1,
                    "confidence": 0.98,
                    "playwright_locator": f"page.getByTestId('{testid}')"
                })
            
            # Priority 2: Stable ID
            if element.get("id"):
                element_id = element["id"]
                # Check if stable (not auto-generated)
                if not any(pattern in element_id.lower() for pattern in ["react", "vue", "angular", "generated", "uuid"]):
                    candidates.append({
                        "type": "css_id",
                        "selector": f"#{element_id}",
                        "priority": 2,
                        "confidence": 0.95,
                        "playwright_locator": f"page.locator('#{element_id}')"
                    })
            
            # Priority 3: ARIA label
            aria_label = element.get("aria_label") or (element.get("accessibility", {}) or {}).get("aria_label")
            if aria_label:
                candidates.append({
                    "type": "aria_label",
                    "selector": f'[aria-label="{aria_label}"]',
                    "priority": 3,
                    "confidence": 0.95,
                    "playwright_locator": f"page.getByRole('{element.get('role', 'button')}', {{ name: '{aria_label}' }})"
                })
            
            # Priority 4: Role + name (BUT ONLY if role is a valid ARIA role, not a tag name)
            role = element.get("role") or (element.get("accessibility", {}) or {}).get("role")
            name = element.get("name")
            
            # CRITICAL: Reject invalid roles (tag names masquerading as roles)
            invalid_roles = ["input", "div", "a", "span", "p", "h1", "h2", "h3", "img", "form", "button", "textarea", "select"]
            if role and role.lower() in invalid_roles:
                # This is a tag name, not a valid ARIA role - skip role-based selectors
                role = None
            
            if role and name:
                # Only use role+name if role is valid
                valid_aria_roles = ["button", "link", "textbox", "checkbox", "radio", "combobox", "menuitem", "tab", "option", "searchbox", "switch"]
                if role.lower() in valid_aria_roles:
                    candidates.append({
                        "type": "role_name",
                        "selector": f'[role="{role}"][name="{name}"]',
                        "priority": 4,
                        "confidence": 0.90,
                        "playwright_locator": f"page.getByRole('{role}', {{ name: '{name}' }})"
                    })
            elif role:
                # ONLY add role if it's a valid ARIA role, not a tag name
                valid_aria_roles = ["button", "link", "textbox", "checkbox", "radio", "combobox", "menuitem", "tab", "option", "searchbox", "switch"]
                if role.lower() in valid_aria_roles:
                    candidates.append({
                        "type": "role",
                        "selector": f'[role="{role}"]',
                        "priority": 5,
                        "confidence": 0.75,
                        "playwright_locator": f"page.getByRole('{role}')"
                    })
        
            # Priority 5: Name attribute (form elements)
            if element_name and tag_name in ["input", "select", "textarea", "button"]:
                candidates.append({
                    "type": "name",
                    "selector": f'{tag_name}[name="{element_name}"]',
                    "priority": 5,
                    "confidence": 0.85,
                    "playwright_locator": f"page.locator('{tag_name}[name=\"{element_name}\"]')"
                })
            
            # Priority 6: Text content (if unique)
            text_content = element.get("text_content")
            if text_content and len(text_content.strip()) < 50:
                candidates.append({
                    "type": "text",
                    "selector": f'text="{text_content.strip()[:50]}"',
                    "priority": 6,
                    "confidence": 0.70,
                    "playwright_locator": f"page.getByText('{text_content.strip()[:50].replace(chr(39), chr(92) + chr(39))}')"
                })
        
        # Sort by priority (lower = higher priority)
        candidates.sort(key=lambda x: x["priority"])
        
        # Get recommended (best) selector
        recommended = candidates[0] if candidates else None
        
        return {
            "candidates": candidates,
            "recommended": recommended,
            "primary_selector": recommended.get("playwright_locator") if recommended else None,
            "fallback_selectors": [c.get("playwright_locator") for c in candidates[1:5] if c.get("playwright_locator")],
            "element_info": {
                "tag": element.get("tag_name"),
                "id": element.get("id"),
                "classes": element.get("class_name"),
                "text": element.get("text_content", "")[:100]
            }
        }
    
    def _convert_to_playwright_locator(self, selector: str, attributes: Dict[str, str]) -> Optional[str]:
        """Convert CSS selector to Playwright locator code"""
        if not selector:
            return None
        
        # If it's already a Playwright locator, return as-is
        if selector.startswith("page."):
            return selector
        
        # data-testid -> getByTestId
        if selector.startswith('[data-testid="'):
            testid = selector.split('"')[1]
            return f"page.getByTestId('{testid}')"
        
        # ID -> locator with #
        if selector.startswith('#'):
            element_id = selector[1:]
            return f"page.locator('#{element_id}')"
        
        # ARIA label -> getByRole
        if selector.startswith('[aria-label="'):
            aria_label = selector.split('"')[1]
            role = attributes.get("role", "button")
            return f"page.getByRole('{role}', {{ name: '{aria_label}' }})"
        
        # Role -> getByRole (ONLY if it's a valid ARIA role, not a tag name)
        if selector.startswith('[role="'):
            role = selector.split('"')[1]
            # NEVER convert generic tag names like "input", "button", "div", "a" to getByRole
            invalid_roles = ["input", "div", "a", "span", "p", "h1", "h2", "h3", "img", "form"]
            if role.lower() in invalid_roles:
                # This is a tag name, not a real role - return None to force fallback
                return None
            if "name=" in selector:
                # Extract name from combined selector
                name_part = selector.split('name="')[1].split('"')[0]
                return f"page.getByRole('{role}', {{ name: '{name_part}' }})"
            return f"page.getByRole('{role}')"
        
        # Name attribute -> locator
        if '[name="' in selector:
            return f"page.locator('{selector}')"
        
        # Default: use locator
        return f"page.locator('{selector}')"
    
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

