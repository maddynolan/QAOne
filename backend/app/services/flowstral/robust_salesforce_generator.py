"""
Robust Salesforce Playwright Generator - NEW ARCHITECTURE
- Trust metadata first (what was stored during recording)
- Single-pass extraction (locator + text + event_type together)
- Direct element data access (no complex priority chains)
- Simple, fast, reliable
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class RobustSalesforceGenerator:
    """
    New architecture: Simple, direct, metadata-first approach.
    """
    
    def __init__(self):
        self.ACTION_TIMEOUT = 10000
        self.NETWORK_TIMEOUT = 3000
    
    def generate_script(
        self,
        nodes: List[Any],
        session_element_models: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate Playwright script - simple, direct, preserves order."""
        
        logger.info(f"[ROBUST-SF] Generating script from {len(nodes)} nodes")
        
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "// Configuration",
            f"const ACTION_TIMEOUT = {self.ACTION_TIMEOUT};",
            f"const NETWORK_TIMEOUT = {self.NETWORK_TIMEOUT};",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        # Find initial URL
        initial_url = None
        for node in nodes:
            event_type = self._get(node, 'event_type')
            url = self._get(node, 'url') or ""
            if event_type == "navigate" and url:
                initial_url = url
                break
            if not initial_url and url and url.startswith('http'):
                initial_url = url
        
        if initial_url:
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
            script_lines.append("")
        
        # Process nodes - simple, direct
        last_locator = None
        processed = 0
        skipped = 0
        
        for node in nodes:
            event_type = self._get(node, 'event_type')
            
            # Skip internal events
            if event_type in ["navigate", "session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]:
                skipped += 1
                continue
            
            # Extract everything in one pass
            result = self._extract_action(node)
            if not result:
                skipped += 1
                continue
            
            locator, text, action_type, action_desc = result
            
            # Deduplicate by locator
            normalized = re.sub(r'\s+', ' ', locator.strip())
            if normalized == last_locator:
                skipped += 1
                continue
            last_locator = normalized
            
            # GUARD: Skip fill actions with body selector
            if action_type == "fill" and ("body" in locator.lower()):
                script_lines.append(f"  // SKIPPED: Cannot fill into body element")
                script_lines.append(f"  // Original action: {action_desc}")
                skipped += 1
                continue
            
            # Generate code
            if action_type == "fill":
                value = self._get(node, 'input_value') or self._get(node, 'value') or self._get(node, 'metadata', {}).get('value') or "TEST_VALUE"
                script_lines.append(f"  // {action_desc}")
                script_lines.append(f"  await {locator}.fill('{self._escape(value)}', {{ timeout: ACTION_TIMEOUT }});")
            else:
                script_lines.append(f"  // {action_desc}")
                script_lines.append(f"  await {locator}.click({{ timeout: ACTION_TIMEOUT }});")
            
            script_lines.append(f"  await page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}});")
            processed += 1
        
        logger.info(f"[ROBUST-SF] Processed {processed} actions, skipped {skipped} events")
        script_lines.append("});")
        return "\n".join(script_lines)
    
    def _extract_action(self, node: Any) -> Optional[Tuple[str, str, str, str]]:
        """
        NEW ARCHITECTURE: Single-pass extraction.
        Returns: (locator, text, action_type, description) or None
        
        Strategy:
        1. Use pre-generated playwright_locator from metadata (if exists)
        2. Build from element data directly (ID, data-testid, text_content)
        3. Extract text from the SAME source we got locator from
        4. Determine action_type from element.type or locator pattern
        """
        
        metadata = self._get(node, 'metadata') or {}
        if not isinstance(metadata, dict):
            metadata = {}
        
        element = metadata.get("interacted_element") or {}
        if not isinstance(element, dict):
            element = {}
        
        # STEP 1: Try pre-generated Playwright locator (most reliable)
        playwright_locator = metadata.get("playwright_locator") or ""
        if playwright_locator and self._is_playwright_locator(playwright_locator):
            text = self._get_element_text(element)
            action_type = self._determine_action_type(element, playwright_locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'" if text else "User clicks element"
            return playwright_locator, text, action_type, desc
        
        # STEP 2: Try selector_set.primary_selector
        selector_set = metadata.get("selector_set") or {}
        if isinstance(selector_set, dict):
            primary = selector_set.get("primary_selector") or ""
            if primary and self._is_playwright_locator(primary):
                text = self._get_element_text(element)
                action_type = self._determine_action_type(element, primary)
                desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'" if text else "User clicks element"
                return primary, text, action_type, desc
        
        # STEP 3: Build locator from element data directly
        # Priority: data-testid > ID > name > text_content > title
        
        # 3a: data-testid
        testid = element.get("data_testid") or element.get("data-testid") or ""
        if testid:
            locator = f"page.getByTestId('{self._escape(testid)}')"
            text = self._get_element_text(element) or testid
            action_type = self._determine_action_type(element, locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
            return locator, text, action_type, desc
        
        # 3b: ID (if stable)
        element_id = element.get("id") or ""
        if element_id and not any(p in element_id.lower() for p in ["react", "vue", "angular", "generated"]):
            locator = f"page.locator('#{element_id}')"
            text = self._get_element_text(element) or element_id
            action_type = self._determine_action_type(element, locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
            return locator, text, action_type, desc
        
        # 3c: name attribute (for form fields)
        name = element.get("name") or ""
        tag = (element.get("tag_name") or "").lower()
        if name and tag in ["input", "select", "textarea", "button"]:
            locator = f"page.locator('{tag}[name=\"{self._escape(name)}\"]')"
            text = self._get_element_text(element) or name
            action_type = self._determine_action_type(element, locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
            return locator, text, action_type, desc
        
        # 3d: text_content with role
        text_content = element.get("text_content") or ""
        if text_content and len(text_content.strip()) > 0:
            # Skip ID patterns
            if not re.match(r'^(radio|checkbox|input|button)\s+\d+', text_content.strip(), re.IGNORECASE):
                role = self._get_role(element)
                locator = f"page.getByRole('{role}').filter({{ hasText: '{self._escape(text_content.strip()[:100])}' }})"
                action_type = self._determine_action_type(element, locator)
                desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text_content.strip()}'"
                return locator, text_content.strip(), action_type, desc
        
        # 3e: title (for Salesforce)
        title = element.get("title") or ""
        if title and len(title) > 5 and not title.endswith('...'):
            locator = f"page.getByTitle('{self._escape(title[:100])}')"
            text = self._get_element_text(element) or title
            action_type = self._determine_action_type(element, locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
            return locator, text, action_type, desc
        
        # STEP 4: Handle ID patterns from target_selector or target_text
        # Check if target_text or action_description contains ID patterns like "Radio 1 71"
        target_text = self._get(node, 'target_text') or ""
        target_selector = self._get(node, 'target_selector') or ""
        action_desc = self._get(node, 'action_description') or ""
        
        # Try to extract ID pattern from text
        text_to_check = (action_desc + " " + target_text).strip()
        id_patterns = [
            (r'radio\s+(\d+)\s+(\d+)', r'#radio-\1-\2'),
            (r'radio\s+(\d+)', r'#radio-\1'),
            (r'checkbox\s+(\d+)', r'#checkbox-\1'),
            (r'input\s+(\d+)', r'#input-\1'),
            (r'button\s+(\d+)', r'#button-\1'),
        ]
        
        for pattern, replacement in id_patterns:
            match = re.search(pattern, text_to_check, re.IGNORECASE)
            if match:
                id_selector = re.sub(pattern, replacement, match.group(0), flags=re.IGNORECASE)
                locator = f"page.locator('{id_selector}')"
                # Try to get actual text from element (might be "18-35" instead of "Radio 1 71")
                text = self._get_element_text(element)
                # If no actual text, use a cleaner version of the ID pattern
                if not text:
                    # Try to extract from text_content even if it's an ID pattern (might have actual text nearby)
                    text_content = element.get("text_content") or ""
                    if text_content and len(text_content.strip()) > 0:
                        # Sometimes text_content has "18-35" even if target_text is "Radio 1 71"
                        text = text_content.strip()
                    else:
                        # Last resort: use a cleaned version
                        text = id_selector.replace('#', '').replace('-', ' ').title()
                action_type = self._determine_action_type(element, locator)
                desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
                return locator, text, action_type, desc
        
        # STEP 5: Fallback to target_selector if it's an ID
        if target_selector and target_selector.startswith('#'):
            locator = f"page.locator('{target_selector}')"
            text = self._get_element_text(element)
            if not text:
                text_content = element.get("text_content") or ""
                if text_content:
                    text = text_content.strip()
                else:
                    text = target_selector.replace('#', '').replace('-', ' ').title()
            action_type = self._determine_action_type(element, locator)
            desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{text}'"
            return locator, text, action_type, desc
        
        # STEP 6: Extract from action_description (for "Get involved" etc.)
        action_desc = self._get(node, 'action_description') or ""
        if "'" in action_desc:
            parts = action_desc.split("'")
            if len(parts) >= 2:
                extracted_text = parts[1]
                if extracted_text and len(extracted_text.strip()) > 0:
                    role = self._get_role(element)
                    locator = f"page.getByRole('{role}').filter({{ hasText: '{self._escape(extracted_text.strip()[:100])}' }})"
                    action_type = self._determine_action_type(element, locator)
                    desc = f"User {'fills' if action_type == 'fill' else 'clicks'} '{extracted_text.strip()}'"
                    return locator, extracted_text.strip(), action_type, desc
        
        # No locator found
        return None
    
    def _get_element_text(self, element: Dict[str, Any]) -> str:
        """Get actual visible text from element - skip ID patterns."""
        if not isinstance(element, dict):
            return ""
        
        # Priority: text_content > aria_label > name > placeholder
        text_content = element.get("text_content") or ""
        if text_content and len(text_content.strip()) > 0:
            # Skip ID patterns like "Radio 1 71"
            if not re.match(r'^(radio|checkbox|input|button)\s+\d+', text_content.strip(), re.IGNORECASE):
                return text_content.strip()
        
        aria_label = element.get("aria_label") or element.get("ariaLabel") or ""
        if aria_label and len(aria_label.strip()) > 0:
            return aria_label.strip()
        
        # For inputs, use name or placeholder
        if element.get("tag_name", "").lower() == "input":
            name = element.get("name") or ""
            if name:
                return name
            placeholder = element.get("placeholder") or ""
            if placeholder:
                return placeholder
        
        return ""
    
    def _get_role(self, element: Dict[str, Any]) -> str:
        """Get Playwright role from element data."""
        if not isinstance(element, dict):
            return "button"
        
        tag = (element.get("tag_name") or "").lower()
        elem_type = element.get("type") or ""
        role_attr = element.get("role") or ""
        
        # Check element type first
        if elem_type == "radio":
            return "radio"
        elif elem_type == "checkbox":
            return "checkbox"
        elif elem_type in ["text", "email", "password", "tel", "number"]:
            return "textbox"
        
        # Check tag
        if tag == "a":
            return "link"
        elif tag == "input":
            if elem_type == "radio":
                return "radio"
            elif elem_type == "checkbox":
                return "checkbox"
            else:
                return "textbox"
        elif tag == "button":
            return "button"
        elif tag == "select":
            return "combobox"
        
        # Check role attribute
        if role_attr:
            return role_attr.lower()
        
        return "button"
    
    def _determine_action_type(self, element: Dict[str, Any], locator: str) -> str:
        """Determine if action is 'fill' or 'click'."""
        # Check locator pattern
        if "#input" in locator:
            return "fill"
        
        # Check element type
        if isinstance(element, dict):
            elem_type = element.get("type") or ""
            tag = (element.get("tag_name") or "").lower()
            
            if elem_type in ["text", "email", "password", "tel", "number"]:
                return "fill"
            if tag == "input" and elem_type not in ["radio", "checkbox", "button", "submit", "reset"]:
                return "fill"
            if tag in ["textarea"]:
                return "fill"
        
        return "click"
    
    def _is_playwright_locator(self, selector: str) -> bool:
        """Check if selector is a VALID Playwright locator.
        Rejects 'body' selectors which are invalid for fill actions.
        """
        if not selector:
            return False
        
        # CRITICAL: Reject body selectors - these are NEVER valid for user actions
        if 'locator("body")' in selector or "locator('body')" in selector:
            logger.warning(f"[ROBUST-SF] Rejecting invalid body selector: {selector}")
            return False
        
        return any(p in selector for p in ["getByRole", "getByTestId", "getByText", "locator("]) or selector.startswith("page.")
    
    def _get(self, node: Any, prop: str, default: Any = None) -> Any:
        """Safe property getter."""
        try:
            if hasattr(node, prop):
                return getattr(node, prop)
            if hasattr(node, 'metadata') and isinstance(node.metadata, dict):
                return node.metadata.get(prop, default)
            if isinstance(node, dict):
                return node.get(prop, default)
        except Exception:
            pass
        return default
    
    def _escape(self, s: str) -> str:
        """Escape string for JavaScript."""
        if not s:
            return ""
        return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")
