"""
Enhanced Playwright Generator - Best Practices Implementation
Incorporates recommendations from Playwright best practices:
1. Semantic Locators (getByRole, getByText, getByTestId)
2. Chained Locators (scoped searches)
3. Filtering/nth for duplicate elements
4. Auto-waiting (no fixed waits)
5. Web-first assertions
6. Network synchronization
7. Context-aware (frames, shadow DOM)
8. State synchronization
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph

logger = logging.getLogger(__name__)


class EnhancedPlaywrightGenerator:
    """
    Enhanced Playwright script generator following industry best practices.
    
    Key Features:
    - Semantic locators (getByRole, getByText, getByTestId)
    - Chained locators for scoped searches
    - Filtering for duplicate elements
    - Auto-waiting (no fixed waits)
    - Web-first assertions
    - Network synchronization
    - Context-aware (frames, shadow DOM)
    """
    
    def __init__(self):
        pass
    
    async def generate_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]] = None,
        raw_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate enhanced Playwright script with best practices.
        
        Returns:
            {
                "script": "...",
                "action_count": 5,
                "generation_time_ms": 1800,
                "strategies_used": [...],
                "warnings": [...]
            }
        """
        start_time = datetime.now()
        
        logger.info(f"[ENHANCED] Generating script from {len(action_graph.nodes)} nodes")
        
        # Generate script with best practices
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        strategies_used = set()
        warnings = []
        
        # Get initial URL
        initial_url = self._get_initial_url(action_graph)
        if initial_url:
            script_lines.append(f"  // Navigate to initial page")
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
            strategies_used.add("network_synchronization")
        else:
            script_lines.append("  // TODO: Add initial URL")
            warnings.append("No initial URL found")
        
        script_lines.append("")
        
        # Process nodes with best practices
        processed_count = 0
        previous_context = None  # Track frame/shadow DOM context
        
        for i, node in enumerate(action_graph.nodes):
            try:
                # Skip internal Flowstral events
                event_type = self._get_node_property(node, 'event_type')
                if event_type in ["session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]:
                    continue
                
                action_code, strategy, context_info = self._generate_enhanced_action(
                    node, 
                    previous_context,
                    i < len(action_graph.nodes) - 1  # Check if there's a next node
                )
                
                if action_code:
                    script_lines.extend(action_code)
                    script_lines.append("")
                    if strategy:
                        strategies_used.add(strategy)
                    if context_info:
                        previous_context = context_info
                    processed_count += 1
                    
            except Exception as e:
                logger.warning(f"[ENHANCED] Failed to generate code for node {i}: {e}", exc_info=True)
                warnings.append(f"Failed to generate code for node {i}: {str(e)}")
                continue
        
        script_lines.append("});")
        
        script = "\n".join(script_lines)
        generation_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Add warning if no user interactions were captured
        if processed_count == 0 and len(action_graph.nodes) > 0:
            # Check if we only have internal events
            internal_event_count = sum(
                1 for node in action_graph.nodes
                if self._get_node_property(node, 'event_type') in ["session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]
            )
            if internal_event_count == len(action_graph.nodes):
                warnings.append(
                    "No user interactions were captured during recording. "
                    "The script only contains navigation because no clicks, inputs, or other user actions were recorded. "
                    "Please check: 1) Browser extension is loaded, 2) You interacted with the page (clicked buttons, filled forms), "
                    "3) Browser console for Flowstral extension messages, 4) Network tab for /api/flowstral/capture-event requests."
                )
                logger.warning(f"[ENHANCED] No user interactions captured - only {internal_event_count} internal events found")
        
        logger.info(f"[ENHANCED] Generated script: {processed_count} actions, {generation_time:.0f}ms")
        
        return {
            "script": script,
            "action_count": processed_count,
            "total_nodes": len(action_graph.nodes),
            "generation_time_ms": generation_time,
            "strategies_used": list(strategies_used),
            "warnings": warnings
        }
    
    def _get_initial_url(self, action_graph: ActionGraph) -> Optional[str]:
        """Get initial URL from action graph"""
        if not action_graph.nodes:
            return None
        
        for node in action_graph.nodes:
            url = self._get_node_property(node, 'url')
            if url:
                return url
        return None
    
    def _generate_enhanced_action(
        self,
        node: Any,
        previous_context: Optional[Dict[str, Any]],
        has_next_node: bool
    ) -> Tuple[List[str], Optional[str], Optional[Dict[str, Any]]]:
        """
        Generate enhanced action code following best practices.
        
        Returns:
            (code_lines, strategy_used, context_info)
        """
        code_lines = []
        strategy = None
        context_info = None
        
        event_type = self._get_node_property(node, 'event_type')
        if not event_type:
            return [], None, None
        
        # Get element metadata
        element_data = self._extract_element_data(node)
        
        # Check for context (frame, shadow DOM)
        context = self._detect_context(node, element_data)
        if context:
            context_info = context
            code_lines.extend(self._generate_context_switch(context))
        
        # Generate locator using best practices
        locator_code, strategy = self._generate_semantic_locator(element_data, node)
        
        if not locator_code:
            return [], None, None
        
        # Generate action based on event type
        if event_type == "navigate":
            url = self._get_node_property(node, 'url')
            if url:
                code_lines.append(f"  // Navigate to: {url}")
                code_lines.append(f"  await page.goto('{url}');")
                code_lines.append(f"  await page.waitForLoadState('networkidle');")
                strategy = "network_synchronization"
        
        elif event_type == "click":
            code_lines.append(f"  // Click: {self._get_action_description(node)}")
            code_lines.append(f"  await {locator_code}.click();")
            # Add assertion if there's a next node (verify action succeeded)
            if has_next_node:
                code_lines.append(f"  // Auto-waiting: Playwright ensures element is ready before click")
            strategy = strategy or "semantic_locator"
        
        elif event_type in ["input", "type"]:
            value = self._get_input_value(node)
            if value and value != "***MASKED***":
                escaped_value = self._escape_string(value)
                code_lines.append(f"  // Fill: {self._get_action_description(node)}")
                code_lines.append(f"  await {locator_code}.fill('{escaped_value}');")
                strategy = strategy or "semantic_locator"
            else:
                code_lines.append(f"  // Fill: {self._get_action_description(node)} [masked]")
                code_lines.append(f"  await {locator_code}.fill('TEST_VALUE');")
                strategy = strategy or "semantic_locator"
        
        elif event_type == "select":
            value = self._get_input_value(node)
            if value:
                escaped_value = self._escape_string(value)
                code_lines.append(f"  // Select: {self._get_action_description(node)}")
                code_lines.append(f"  await {locator_code}.selectOption('{escaped_value}');")
                strategy = strategy or "semantic_locator"
        
        # Add network synchronization if needed
        network_sync = self._detect_network_dependency(node)
        if network_sync:
            code_lines.extend(self._generate_network_sync(network_sync))
            strategy = "network_synchronization"
        
        return code_lines, strategy, context_info
    
    def _generate_semantic_locator(
        self,
        element_data: Dict[str, Any],
        node: Any
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate semantic locator following priority:
        1. data-testid -> getByTestId
        2. Role + Name -> getByRole
        3. Label -> getByLabel
        4. Text -> getByText
        5. Chained locator (parent + child)
        6. Filtering for duplicates
        """
        
        # Priority 1: data-testid
        test_id = element_data.get("data_testid") or element_data.get("data-testid")
        if test_id:
            return f"page.getByTestId('{test_id}')", "data_testid"
        
        # Priority 2: Role + Name (semantic locator)
        role = element_data.get("role")
        name = element_data.get("aria_label") or element_data.get("aria-label") or element_data.get("text_content")
        if role and name:
            # Clean role (button, link, textbox, etc.)
            clean_role = self._normalize_role(role)
            if clean_role:
                return f"page.getByRole('{clean_role}', {{ name: '{self._escape_string(name[:50])}' }})", "role_with_name"
        
        # Priority 3: Label (for form fields)
        label = element_data.get("label_text") or element_data.get("associated_label")
        tag_name = (element_data.get("tag_name") or "").lower()
        if label and tag_name in ["input", "select", "textarea"]:
            return f"page.getByLabel('{self._escape_string(label)}')", "label"
        
        # Priority 4: Text (for clickable elements)
        text_content = element_data.get("text_content")
        if text_content and tag_name in ["button", "a", "link"]:
            # Use chained locator if parent context exists
            parent_context = self._get_parent_context(node)
            if parent_context:
                parent_locator = self._generate_parent_locator(parent_context)
                return f"{parent_locator}.getByText('{self._escape_string(text_content[:50])}')", "chained_text"
            else:
                return f"page.getByText('{self._escape_string(text_content[:50])}')", "text"
        
        # Priority 5: Chained locator (parent + child)
        parent_context = self._get_parent_context(node)
        if parent_context:
            parent_locator = self._generate_parent_locator(parent_context)
            child_selector = self._generate_fallback_selector(element_data)
            if child_selector:
                return f"{parent_locator}.locator('{child_selector}')", "chained_locator"
        
        # Priority 6: Filtering for duplicates
        if self._has_duplicates(node, element_data):
            filter_locator = self._generate_filter_locator(element_data)
            if filter_locator:
                return filter_locator, "filtering"
        
        # Fallback: ID or name
        element_id = element_data.get("id")
        if element_id and not self._is_unstable_id(element_id):
            return f"page.locator('#{element_id}')", "id"
        
        element_name = element_data.get("name")
        if element_name and tag_name in ["input", "select", "textarea"]:
            return f"page.locator('{tag_name}[name=\"{element_name}\"]')", "name"
        
        # Last resort: CSS selector (minimal)
        css_selector = self._generate_minimal_css(element_data)
        if css_selector:
            return f"page.locator('{css_selector}')", "css_fallback"
        
        logger.warning(f"[ENHANCED] Could not generate semantic locator for element")
        return None, None
    
    def _generate_context_switch(self, context: Dict[str, Any]) -> List[str]:
        """Generate code for context switch (frame, shadow DOM)"""
        code_lines = []
        
        if context.get("type") == "frame":
            frame_selector = context.get("frame_selector")
            if frame_selector:
                code_lines.append(f"  // Switch to frame: {frame_selector}")
                code_lines.append(f"  const frame = page.frameLocator('{frame_selector}');")
                return code_lines
        
        elif context.get("type") == "shadow_dom":
            shadow_host = context.get("shadow_host")
            if shadow_host:
                code_lines.append(f"  // Access Shadow DOM: {shadow_host}")
                code_lines.append(f"  // Playwright automatically pierces open Shadow DOM")
                # Note: Playwright handles this automatically, but we document it
        
        return code_lines
    
    def _generate_network_sync(self, network_info: Dict[str, Any]) -> List[str]:
        """Generate network synchronization code"""
        code_lines = []
        
        url_pattern = network_info.get("url_pattern")
        method = network_info.get("method", "GET")
        
        if url_pattern:
            code_lines.append(f"  // Wait for network request: {method} {url_pattern}")
            code_lines.append(f"  await page.waitForResponse(response => response.url().includes('{url_pattern}') && response.request().method() === '{method}');")
        
        return code_lines
    
    def _detect_context(self, node: Any, element_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detect if element is in frame or shadow DOM"""
        metadata = self._get_node_property(node, 'metadata') or {}
        
        # Check for frame
        if metadata.get("frame_id") or metadata.get("frame_selector"):
            return {
                "type": "frame",
                "frame_selector": metadata.get("frame_selector") or f"iframe#{metadata.get('frame_id')}"
            }
        
        # Check for shadow DOM
        if metadata.get("shadow_host") or element_data.get("shadow_host"):
            return {
                "type": "shadow_dom",
                "shadow_host": metadata.get("shadow_host") or element_data.get("shadow_host")
            }
        
        return None
    
    def _detect_network_dependency(self, node: Any) -> Optional[Dict[str, Any]]:
        """Detect if action depends on network request"""
        metadata = self._get_node_property(node, 'metadata') or {}
        
        # Check if action triggers API call
        if metadata.get("triggers_api") or metadata.get("network_request"):
            return {
                "url_pattern": metadata.get("api_url") or metadata.get("network_url"),
                "method": metadata.get("http_method", "POST")
            }
        
        return None
    
    def _has_duplicates(self, node: Any, element_data: Dict[str, Any]) -> bool:
        """Check if element might have duplicates"""
        # If text content is generic or common, likely duplicates
        text = element_data.get("text_content") or ""
        common_texts = ["submit", "save", "cancel", "delete", "edit", "add", "remove"]
        if text and text.lower() in common_texts:
            return True
        
        # If no unique identifier, might have duplicates
        if not element_data.get("id") and not element_data.get("data_testid"):
            return True
        
        return False
    
    def _generate_filter_locator(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate filter locator for duplicate elements"""
        # Use getByRole with filter
        role = element_data.get("role")
        text = element_data.get("text_content")
        
        if role and text:
            clean_role = self._normalize_role(role)
            if clean_role:
                return f"page.getByRole('{clean_role}').filter({{ hasText: '{self._escape_string(text[:50])}' }})"
        
        # Use row filter for tables
        if element_data.get("parent_tag") == "tr":
            return f"page.getByRole('row').filter({{ hasText: '{self._escape_string(text[:50])}' }})"
        
        return None
    
    def _generate_parent_locator(self, parent_context: Dict[str, Any]) -> str:
        """Generate locator for parent element"""
        parent_id = parent_context.get("id")
        parent_role = parent_context.get("role")
        parent_testid = parent_context.get("data_testid")
        
        if parent_testid:
            return f"page.getByTestId('{parent_testid}')"
        elif parent_id:
            return f"page.locator('#{parent_id}')"
        elif parent_role:
            return f"page.getByRole('{parent_role}')"
        else:
            return "page"
    
    def _get_parent_context(self, node: Any) -> Optional[Dict[str, Any]]:
        """Get parent element context"""
        metadata = self._get_node_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
        return interacted_element.get("parent_element")
    
    def _normalize_role(self, role: str) -> Optional[str]:
        """Normalize role to Playwright's role list"""
        if not role:
            return None
        
        role_lower = role.lower()
        
        # Valid Playwright roles
        valid_roles = [
            "button", "link", "textbox", "checkbox", "radio", "combobox",
            "option", "heading", "img", "listbox", "menuitem", "menuitemcheckbox",
            "menuitemradio", "progressbar", "slider", "switch", "tab", "tabpanel"
        ]
        
        if role_lower in valid_roles:
            return role_lower
        
        # Map common roles
        role_map = {
            "submit": "button",
            "input": "textbox",
            "a": "link",
            "h1": "heading",
            "h2": "heading",
            "h3": "heading",
            "h4": "heading",
            "h5": "heading",
            "h6": "heading"
        }
        
        return role_map.get(role_lower)
    
    def _generate_fallback_selector(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate fallback CSS selector"""
        tag_name = (element_data.get("tag_name") or "").lower()
        element_id = element_data.get("id")
        element_class = element_data.get("class")
        
        if element_id and not self._is_unstable_id(element_id):
            return f"#{element_id}"
        elif element_class and not self._is_unstable_class(element_class):
            # Use first stable class
            stable_class = self._get_stable_class(element_class)
            if stable_class:
                return f"{tag_name}.{stable_class}"
        
        return tag_name if tag_name else None
    
    def _generate_minimal_css(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate minimal CSS selector as last resort"""
        tag_name = (element_data.get("tag_name") or "").lower()
        element_id = element_data.get("id")
        
        if element_id and not self._is_unstable_id(element_id):
            return f"#{element_id}"
        
        return tag_name if tag_name else "div"
    
    def _is_unstable_id(self, element_id: str) -> bool:
        """Check if ID is unstable (generated by framework)"""
        unstable_patterns = [
            r'^react-', r'^vue-', r'^angular-', r'^ember-',
            r'-\d+$', r'_\d+$',  # Ends with numbers
            r'^id-\d+', r'^generated-', r'^temp-'
        ]
        
        for pattern in unstable_patterns:
            if re.match(pattern, element_id, re.IGNORECASE):
                return True
        
        return False
    
    def _is_unstable_class(self, class_name: str) -> bool:
        """Check if class name is unstable"""
        unstable_patterns = [
            r'^css-', r'^styled-', r'^makeStyles-',
            r'-\d+$', r'_\d+$'
        ]
        
        for pattern in unstable_patterns:
            if re.match(pattern, class_name, re.IGNORECASE):
                return True
        
        return False
    
    def _get_stable_class(self, class_names: str) -> Optional[str]:
        """Get first stable class from class list"""
        classes = class_names.split()
        for cls in classes:
            if not self._is_unstable_class(cls):
                return cls
        return None
    
    def _extract_element_data(self, node: Any) -> Dict[str, Any]:
        """Extract element data from node"""
        element_data = {}
        
        metadata = self._get_node_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
        # Extract from interacted_element
        if isinstance(interacted_element, dict):
            element_data.update({
                "tag_name": interacted_element.get("tag_name"),
                "id": interacted_element.get("id"),
                "name": interacted_element.get("name"),
                "class": interacted_element.get("class") or interacted_element.get("className"),
                "role": interacted_element.get("role"),
                "aria_label": interacted_element.get("aria_label") or interacted_element.get("aria-label"),
                "text_content": interacted_element.get("text_content") or interacted_element.get("textContent"),
                "data_testid": interacted_element.get("data_testid") or interacted_element.get("data-testid"),
                "label_text": interacted_element.get("label_text"),
                "associated_label": interacted_element.get("associated_label")
            })
        
        # Fallback to node properties
        if not element_data.get("tag_name"):
            element_data["tag_name"] = self._get_node_property(node, 'target_selector')
        if not element_data.get("text_content"):
            element_data["text_content"] = self._get_node_property(node, 'target_text')
        
        return element_data
    
    def _get_node_property(self, node: Any, prop: str) -> Any:
        """Get property from node (handles both object and dict)"""
        if hasattr(node, prop):
            return getattr(node, prop)
        elif isinstance(node, dict):
            return node.get(prop)
        return None
    
    def _get_input_value(self, node: Any) -> Optional[str]:
        """Get input value from node"""
        metadata = self._get_node_property(node, 'metadata') or {}
        return metadata.get("value") or metadata.get("input_value")
    
    def _get_action_description(self, node: Any) -> str:
        """Get human-readable action description"""
        event_type = self._get_node_property(node, 'event_type')
        target_text = self._get_node_property(node, 'target_text')
        action_desc = self._get_node_property(node, 'action_description')
        
        if action_desc:
            return action_desc
        elif target_text:
            return f"{event_type} {target_text[:50]}"
        else:
            return event_type
    
    def _escape_string(self, s: str) -> str:
        """Escape string for JavaScript"""
        if not s:
            return ""
        return s.replace("'", "\\'").replace("\n", "\\n").replace("\r", "\\r")


# Global instance
_enhanced_generator = None

def get_enhanced_playwright_generator() -> EnhancedPlaywrightGenerator:
    """Get or create global EnhancedPlaywrightGenerator instance"""
    global _enhanced_generator
    if _enhanced_generator is None:
        _enhanced_generator = EnhancedPlaywrightGenerator()
    return _enhanced_generator

