"""
Simple, Robust Salesforce Playwright Generator
- Preserves exact order from action graph (sorted by timestamp)
- Fast generation (no LLM calls)
- Uses proper Salesforce selectors
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class SimpleSalesforceGenerator:
    """
    Simple, robust Salesforce generator that preserves order and generates fast.
    """
    
    def __init__(self):
        self.ACTION_TIMEOUT = 10000
        self.NETWORK_TIMEOUT = 3000
    
    def generate_script(
        self,
        nodes: List[Any],
        session_element_models: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate Playwright script preserving exact order from nodes.
        Nodes are sorted by timestamp to maintain correct sequence.
        """
        
        # CRITICAL: Sort nodes by timestamp to preserve order
        sorted_nodes = sorted(
            nodes,
            key=lambda n: self._get_timestamp(n)
        )
        
        logger.info(f"[SIMPLE-SF] Generating script from {len(sorted_nodes)} nodes (sorted by timestamp)")
        
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "// Configuration",
            f"const ACTION_TIMEOUT = {self.ACTION_TIMEOUT};  // 10 seconds",
            f"const NETWORK_TIMEOUT = {self.NETWORK_TIMEOUT};  // 3 seconds",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        # Find initial URL (first navigate node)
        initial_url = None
        for node in sorted_nodes:
            event_type = self._get_property(node, 'event_type')
            url = self._get_property(node, 'url')
            if event_type == "navigate" and url:
                initial_url = url
                break
        
        # Add navigation
        if initial_url:
            script_lines.append(f"  // Navigate to initial page")
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
            script_lines.append("")
        
        # Process nodes in timestamp order
        for node in sorted_nodes:
            event_type = self._get_property(node, 'event_type')
            
            # Skip navigate (already handled)
            if event_type == "navigate":
                continue
            
            # Get properties
            target_text = self._get_property(node, 'target_text') or ""
            target_selector = self._get_property(node, 'target_selector') or ""
            action_desc = self._get_property(node, 'action_description') or ""
            
            # Use target_text for description
            if target_text:
                if event_type in ["click", "click_button"]:
                    action_desc = f"User clicks '{target_text}'"
                elif event_type in ["input", "type", "fill_field"]:
                    action_desc = f"User fills '{target_text}'"
            
            # Extract element data
            element_data = self._extract_element_data(node)
            
            # Generate locator
            locator = self._generate_locator(element_data, node, target_text, target_selector)
            
            if not locator:
                logger.warning(f"[SIMPLE-SF] No locator generated for {event_type}, skipping")
                continue
            
            # Generate action code
            if event_type in ["click", "click_button"]:
                script_lines.append(f"  // {action_desc}")
                script_lines.append(f"  await {locator}.click({{ timeout: ACTION_TIMEOUT }});")
                script_lines.append(f"  await page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}});")
            
            elif event_type in ["input", "type", "fill_field"]:
                value = self._get_property(node, 'input_value') or self._get_property(node, 'value') or "TEST_VALUE"
                script_lines.append(f"  // {action_desc}")
                script_lines.append(f"  await {locator}.fill('{self._escape_string(value)}', {{ timeout: ACTION_TIMEOUT }});")
                script_lines.append(f"  await page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}});")
        
        script_lines.append("});")
        return "\n".join(script_lines)
    
    def _generate_locator(
        self,
        element_data: Dict[str, Any],
        node: Any,
        target_text: str,
        target_selector: str
    ) -> Optional[str]:
        """
        Generate locator with priority:
        1. ID extraction (Radio 1 71 -> #radio-1-71)
        2. getByTitle() for Salesforce
        3. href for links
        4. getByRole().filter({ hasText })
        """
        import re
        
        tag_name = (element_data.get("tag_name") or "").lower()
        title = element_data.get("title") or ""
        href = element_data.get("href") or ""
        attributes = element_data.get("attributes") or {}
        if isinstance(attributes, str):
            attributes = {}
        
        # Extract from attributes
        if isinstance(attributes, dict):
            if not title:
                title = attributes.get("title") or attributes.get("Title") or ""
            if not href:
                href = attributes.get("href") or attributes.get("Href") or ""
        
        # PRIORITY 1: Extract ID from target_text or action_description
        action_desc = self._get_property(node, 'action_description') or ""
        text_to_check = (action_desc + " " + target_text).strip()
        
        id_patterns = [
            (r'radio\s+(\d+)\s+(\d+)', r'#radio-\1-\2'),
            (r'checkbox\s+(\d+)', r'#checkbox-\1'),
            (r'input\s+(\d+)', r'#input-\1'),
            (r'button\s+(\d+)', r'#button-\1'),
        ]
        
        for pattern, replacement in id_patterns:
            match = re.search(pattern, text_to_check, re.IGNORECASE)
            if match:
                id_selector = re.sub(pattern, replacement, match.group(0), flags=re.IGNORECASE)
                logger.info(f"[SIMPLE-SF] Using ID: {id_selector}")
                return f"page.locator('{id_selector}')"
        
        # PRIORITY 2: getByTitle() for Salesforce
        if title and len(title) > 5 and not title.endswith('...'):
            logger.info(f"[SIMPLE-SF] Using getByTitle: '{title[:50]}'")
            return f"page.getByTitle('{self._escape_string(title[:100])}')"
        
        # PRIORITY 3: href for links
        if tag_name == "a" and href and href != "#" and not href.startswith("javascript:"):
            logger.info(f"[SIMPLE-SF] Using href: {href[:50]}")
            return f"page.locator('a[href=\"{self._escape_string(href)}\"]')"
        
        # PRIORITY 4: getByRole().filter({ hasText })
        if target_text and len(target_text.strip()) > 0:
            element_type = element_data.get("type") or ""
            
            # Determine role
            if tag_name == "a":
                role = "link"
            elif tag_name == "input" and element_type == "radio":
                role = "radio"
            elif tag_name == "input" and element_type == "checkbox":
                role = "checkbox"
            elif tag_name == "input":
                role = "textbox"
            elif tag_name == "button":
                role = "button"
            else:
                role = element_data.get("role") or "button"
            
            logger.info(f"[SIMPLE-SF] Using getByRole('{role}').filter({{ hasText: '{target_text[:50]}' }})")
            return f"page.getByRole('{role}').filter({{ hasText: '{self._escape_string(target_text.strip()[:100])}' }})"
        
        # FALLBACK: Use target_selector if available
        if target_selector:
            if target_selector.startswith('#'):
                logger.info(f"[SIMPLE-SF] Using target_selector: {target_selector}")
                return f"page.locator('{target_selector}')"
        
        logger.warning(f"[SIMPLE-SF] No locator found for {tag_name}")
        return None
    
    def _extract_element_data(self, node: Any) -> Dict[str, Any]:
        """Extract element data from node"""
        element_data = {}
        
        metadata = self._get_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
        if isinstance(interacted_element, dict):
            element_data.update({
                "tag_name": interacted_element.get("tag_name"),
                "title": interacted_element.get("title"),
                "href": interacted_element.get("href"),
                "type": interacted_element.get("type"),
                "role": interacted_element.get("role"),
                "attributes": interacted_element.get("attributes", {}),
            })
        
        return element_data
    
    def _get_property(self, node: Any, prop: str) -> Any:
        """Get property from node"""
        if hasattr(node, prop):
            return getattr(node, prop)
        if hasattr(node, 'metadata') and isinstance(node.metadata, dict):
            return node.metadata.get(prop)
        return None
    
    def _get_timestamp(self, node: Any) -> datetime:
        """Get timestamp from node for sorting"""
        timestamp = self._get_property(node, 'timestamp')
        if timestamp:
            if isinstance(timestamp, str):
                try:
                    from dateutil import parser
                    return parser.parse(timestamp)
                except:
                    pass
            elif isinstance(timestamp, datetime):
                return timestamp
        # Fallback to current time if no timestamp
        return datetime.utcnow()
    
    def _escape_string(self, s: str) -> str:
        """Escape string for JavaScript"""
        if not s:
            return ""
        return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")


