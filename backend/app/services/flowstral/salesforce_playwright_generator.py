"""
Salesforce Experience Cloud Playwright Generator
Dedicated generator for Salesforce based on best practices:
- getByTitle() for menu items
- href for links
- getByRole().filter({ hasText }) for Shadow DOM
- Lightning component selectors
- Scoped selectors
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class SalesforcePlaywrightGenerator:
    """
    Dedicated Salesforce Experience Cloud Playwright script generator.
    Follows best practices from Salesforce documentation.
    """
    
    def __init__(self):
        self.ACTION_TIMEOUT = 10000
        self.NETWORK_TIMEOUT = 3000
    
    def generate_script(
        self,
        nodes: List[Any],
        session_element_models: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate Playwright script for Salesforce Experience Cloud"""
        
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "// Configuration",
            f"const ACTION_TIMEOUT = {self.ACTION_TIMEOUT};  // 10 seconds",
            f"const NETWORK_TIMEOUT = {self.NETWORK_TIMEOUT};  // 3 seconds",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        # CRITICAL: Find initial URL from first navigate node or first node with URL
        initial_url = None
        for node in nodes:
            event_type = self._get_property(node, 'event_type')
            url = self._get_property(node, 'url')
            if event_type == "navigate" and url:
                initial_url = url
                break
            elif url and not initial_url:  # Fallback: use first URL found
                initial_url = url
        
        # Add navigation at the start
        if initial_url:
            script_lines.append(f"  // Navigate to initial page")
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
            script_lines.append("")
        
        # Process each node (skip navigate events as we already handled initial URL)
        for idx, node in enumerate(nodes):
            event_type = self._get_property(node, 'event_type')
            
            # Skip navigate events (already handled)
            if event_type == "navigate":
                continue
            
            # Get actual text from target_text (not from element_data which might be wrong)
            target_text = self._get_property(node, 'target_text') or ""
            action_desc = self._get_property(node, 'action_description') or ""
            
            # Use target_text for action description if available
            if target_text:
                action_desc = f"User clicks '{target_text}'" if event_type in ["click", "click_button"] else action_desc
            
            # Extract element data
            element_data = self._extract_element_data(node)
            
            # CRITICAL: Override text_content with target_text (more accurate)
            if target_text:
                element_data["text_content"] = target_text
            
            # Generate action code
            if event_type in ["click", "click_button"]:
                locator = self._generate_salesforce_locator(element_data, node)
                if locator:
                    script_lines.append(f"  // {action_desc}")
                    script_lines.append(f"  await {locator}.click({{ timeout: ACTION_TIMEOUT }});")
                    script_lines.append(f"  await page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}});")
            
            elif event_type in ["input", "type", "fill_field"]:
                locator = self._generate_salesforce_locator(element_data, node)
                value = self._get_property(node, 'input_value') or self._get_property(node, 'value') or "TEST_VALUE"
                if locator:
                    script_lines.append(f"  // {action_desc}")
                    script_lines.append(f"  await {locator}.fill('{self._escape_string(value)}', {{ timeout: ACTION_TIMEOUT }});")
                    script_lines.append(f"  await page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}});")
        
        script_lines.append("});")
        return "\n".join(script_lines)
    
    def _generate_salesforce_locator(
        self,
        element_data: Dict[str, Any],
        node: Any
    ) -> Optional[str]:
        """
        Generate Salesforce locator following priority:
        1. getByTitle() - Most robust
        2. href attribute - Very stable
        3. getByRole().filter({ hasText }) - Works with Shadow DOM
        4. Lightning component selectors
        5. data-menulist-item + text filter
        6. Combined attributes
        7. Scoped selectors
        """
        
        tag_name = (element_data.get("tag_name") or "").lower()
        text_content = element_data.get("text_content") or ""
        title = element_data.get("title") or ""
        href = element_data.get("href") or ""
        attributes = element_data.get("attributes") or {}
        if isinstance(attributes, str):
            attributes = {}
        
        # Extract title from attributes if not directly available
        if not title and isinstance(attributes, dict):
            title = attributes.get("title") or attributes.get("Title") or ""
        
        # Extract href from attributes if not directly available
        if not href and isinstance(attributes, dict):
            href = attributes.get("href") or attributes.get("Href") or ""
        
        # Extract text from target_text if not in element_data
        if not text_content:
            text_content = self._get_property(node, 'target_text') or ""
        
        # PRIORITY 1: getByTitle() - Most robust for Salesforce
        if title and len(title) > 5 and not title.endswith('...'):
            escaped_title = self._escape_string(title[:100])
            logger.info(f"[SALESFORCE] Using getByTitle: '{escaped_title[:50]}'")
            return f"page.getByTitle('{escaped_title}')"
        
        # PRIORITY 2: href attribute for links (very stable)
        if tag_name == "a" and href and href != "#" and not href.startswith("javascript:"):
            escaped_href = self._escape_string(href)
            # Try scoped first (more specific)
            if self._is_menu_item(attributes):
                logger.info(f"[SALESFORCE] Using scoped href: header a[href='{escaped_href}']")
                return f"page.locator('header a[href=\"{escaped_href}\"]')"
            else:
                logger.info(f"[SALESFORCE] Using href: a[href='{escaped_href}']")
                return f"page.locator('a[href=\"{escaped_href}\"]')"
        
        # PRIORITY 3: Extract ID from description/target_text FIRST (before text filter)
        # CRITICAL: This should be HIGHER priority than text filter for IDs
        action_desc = self._get_property(node, 'action_description') or ""
        target_text = self._get_property(node, 'target_text') or ""
        text_to_check = (action_desc + " " + target_text + " " + text_content).strip()
        
        id_patterns = [
            (r'radio\s+(\d+)\s+(\d+)', r'#radio-\1-\2'),  # "Radio 1 71" -> "#radio-1-71"
            (r'checkbox\s+(\d+)', r'#checkbox-\1'),  # "Checkbox 88" -> "#checkbox-88"
            (r'input\s+(\d+)', r'#input-\1'),  # "Input 175" -> "#input-175"
            (r'button\s+(\d+)', r'#button-\1'),  # "Button 123" -> "#button-123"
        ]
        
        for pattern, replacement in id_patterns:
            match = re.search(pattern, text_to_check, re.IGNORECASE)
            if match:
                id_selector = re.sub(pattern, replacement, match.group(0), flags=re.IGNORECASE)
                logger.info(f"[SALESFORCE] ✅ Priority 3: Extracted ID selector: {id_selector} from '{text_to_check[:50]}'")
                return f"page.locator('{id_selector}')"
        
        # PRIORITY 4: getByRole().filter({ hasText }) - Works with Shadow DOM
        if text_content and len(text_content.strip()) > 0:
            escaped_text = self._escape_string(text_content.strip()[:100])
            
            # Determine role - CRITICAL: Check element type, not just tag
            element_type = element_data.get("type") or ""
            if tag_name == "a":
                role = "link"
            elif tag_name == "input" and element_type == "radio":
                role = "radio"  # Radio buttons, not buttons!
            elif tag_name == "input" and element_type == "checkbox":
                role = "checkbox"  # Checkboxes, not buttons!
            elif tag_name == "input":
                role = "textbox"  # Input fields
            elif tag_name == "button":
                role = "button"
            else:
                role = element_data.get("role") or "button"
            
            logger.info(f"[SALESFORCE] Priority 4: Using getByRole('{role}').filter({{ hasText: '{escaped_text[:50]}' }})")
            return f"page.getByRole('{role}').filter({{ hasText: '{escaped_text}' }})"
        
        # PRIORITY 5: Lightning component selectors
        if text_content and len(text_content.strip()) > 0:
            escaped_text = self._escape_string(text_content.strip()[:100])
            parent_tag = element_data.get("parent_tag") or ""
            classes = str(element_data.get("class") or "")
            
            if "lightning-input" in parent_tag.lower() or "lightning-input" in classes.lower():
                logger.info(f"[SALESFORCE] Using lightning-input:has-text('{escaped_text[:50]}')")
                return f"page.locator('lightning-input:has-text(\"{escaped_text}\")')"
            elif "lightning-button" in parent_tag.lower() or "lightning-button" in classes.lower():
                logger.info(f"[SALESFORCE] Using lightning-button:has-text('{escaped_text[:50]}')")
                return f"page.locator('lightning-button:has-text(\"{escaped_text}\")')"
        
        # PRIORITY 5: data-menulist-item + text filter
        if isinstance(attributes, dict) and attributes.get("data-menulist-item") is not None:
            if text_content and len(text_content.strip()) > 0:
                escaped_text = self._escape_string(text_content.strip()[:100])
                logger.info(f"[SALESFORCE] Using data-menulist-item + filter")
                return f"page.locator('header a[data-menulist-item]').filter({{ hasText: '{escaped_text}' }})"
        
        # PRIORITY 6: Combined attributes (title + href + data-menulist-item)
        if tag_name == "a" and title and href:
            escaped_title = self._escape_string(title[:100])
            escaped_href = self._escape_string(href)
            if self._is_menu_item(attributes):
                logger.info(f"[SALESFORCE] Using combined attributes")
                return f"page.locator('a[data-menulist-item][href=\"{escaped_href}\"][title=\"{escaped_title}\"]')"
        
        # PRIORITY 7: Scoped to visible dropdown
        if text_content and len(text_content.strip()) > 0:
            escaped_text = self._escape_string(text_content.strip()[:100])
            logger.info(f"[SALESFORCE] Using scoped dropdown selector")
            return f"page.locator('.slds-dropdown-visible').locator('a').filter({{ hasText: '{escaped_text}' }})"
        
        # LAST RESORT: Use tag + text filter
        if tag_name and text_content:
            escaped_text = self._escape_string(text_content.strip()[:100])
            logger.warning(f"[SALESFORCE] Using last resort: tag + text filter")
            return f"page.locator('{tag_name}').filter({{ hasText: '{escaped_text}' }})"
        
        # FINAL FALLBACK: Generic (should rarely happen)
        logger.error(f"[SALESFORCE] No locator generated - using generic fallback")
        if tag_name in ["input", "button", "a"]:
            return f"page.locator('{tag_name}').first()"
        return "page.locator('span').first()"
    
    def _extract_element_data(self, node: Any) -> Dict[str, Any]:
        """Extract element data from node"""
        element_data = {}
        
        metadata = self._get_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
        if isinstance(interacted_element, dict):
            element_data.update({
                "tag_name": interacted_element.get("tag_name"),
                "text_content": interacted_element.get("text_content") or interacted_element.get("textContent"),
                "title": interacted_element.get("title"),
                "href": interacted_element.get("href"),
                "role": interacted_element.get("role"),
                "class": interacted_element.get("class") or interacted_element.get("className"),
                "attributes": interacted_element.get("attributes", {}),
                "parent_tag": interacted_element.get("parent_tag") or interacted_element.get("parentTag"),
            })
            
            # Extract from attributes if not directly available
            attrs = element_data.get("attributes", {})
            if isinstance(attrs, dict):
                if not element_data.get("title"):
                    element_data["title"] = attrs.get("title") or attrs.get("Title") or ""
                if not element_data.get("href"):
                    element_data["href"] = attrs.get("href") or attrs.get("Href") or ""
        
        return element_data
    
    def _is_menu_item(self, attributes: Dict) -> bool:
        """Check if element is a menu item"""
        if not isinstance(attributes, dict):
            return False
        return attributes.get("data-menulist-item") is not None or attributes.get("data-menubar-item") is not None
    
    def _get_property(self, node: Any, prop: str) -> Any:
        """Get property from node"""
        if hasattr(node, prop):
            return getattr(node, prop)
        if hasattr(node, 'metadata') and isinstance(node.metadata, dict):
            return node.metadata.get(prop)
        return None
    
    def _escape_string(self, s: str) -> str:
        """Escape string for JavaScript"""
        if not s:
            return ""
        return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")

