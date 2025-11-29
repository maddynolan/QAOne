"""
Enhanced Expected Results Generator
Generates contextual, actionable expected results for test cases
"""

import logging
import re
from typing import Dict, List, Any, Optional
from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

logger = logging.getLogger(__name__)


class ExpectedResultsGenerator:
    """
    Generates contextual expected results for test steps.
    
    Expected results should be:
    1. Specific and measurable
    2. Context-aware (page state, element visibility, data changes)
    3. Actionable (clear validation criteria)
    4. Include before/after states when relevant
    """
    
    def __init__(self):
        # Action-to-result mappings
        self.action_result_patterns = {
            "navigate": {
                "pattern": r"navigat(?:e|ion)",
                "template": "User is navigated to {destination}",
                "context_required": ["destination_page", "url_pattern"]
            },
            "click": {
                "pattern": r"click",
                "template": "{element} is {state}",
                "context_required": ["element_name", "target_page", "element_state"]
            },
            "input": {
                "pattern": r"input|type|fill",
                "template": "{element} contains the entered value",
                "context_required": ["element_name", "input_value"]
            },
            "select": {
                "pattern": r"select",
                "template": "{element} displays the selected option",
                "context_required": ["element_name", "selected_value"]
            },
            "submit": {
                "pattern": r"submit",
                "template": "Form is submitted and {outcome}",
                "context_required": ["outcome", "target_page"]
            }
        }
        
        # Page state patterns
        self.page_state_keywords = {
            "cart": ["cart", "shopping cart", "basket"],
            "checkout": ["checkout", "payment", "billing"],
            "login": ["login", "sign in", "authentication"],
            "dashboard": ["dashboard", "home", "main"],
            "product": ["product", "item", "details"],
            "search": ["search", "results", "filter"],
            "profile": ["profile", "account", "settings"]
        }
        
        # Element state patterns
        self.element_state_keywords = {
            "visible": ["visible", "displayed", "shown", "appears"],
            "enabled": ["enabled", "active", "clickable"],
            "disabled": ["disabled", "inactive", "grayed out"],
            "selected": ["selected", "checked", "highlighted"],
            "updated": ["updated", "changed", "modified", "refreshed"]
        }
    
    def generate_expected_result(
        self,
        edge: ActionGraphEdge,
        from_node: Optional[ActionGraphNode],
        to_node: Optional[ActionGraphNode],
        element_name: str,
        action_description: str,
        action_graph: Optional[ActionGraph] = None
    ) -> str:
        """
        Generate contextual expected result for a test step.
        
        Args:
            edge: Action graph edge
            from_node: Source node
            to_node: Target node
            element_name: Clean element name
            action_description: Action description
            action_graph: Optional action graph for context
            
        Returns:
            Contextual expected result string
        """
        action_type = edge.action.lower()
        
        # Strategy 1: Use edge.expected_outcome if available (from action graph)
        if edge.expected_outcome:
            expected = str(edge.expected_outcome).strip()
            # Clean up common bad patterns
            if not self._is_bad_expected_result(expected):
                return self._enhance_expected_result(expected, to_node, element_name)
        
        # Strategy 2: Infer from target node (page navigation)
        if to_node and action_type == "navigate":
            destination = self._extract_destination_page(to_node)
            if destination:
                return f"User is navigated to {destination}"
        
        # Strategy 3: Infer from target node title/URL pattern
        if to_node:
            destination = self._infer_destination_from_node(to_node)
            if destination and action_type in ["click", "submit"]:
                # Check if this is a navigation action
                if to_node.url_pattern and to_node.url_pattern != (from_node.url_pattern if from_node else ""):
                    return f"User is navigated to {destination}"
        
        # Strategy 4: Element-specific results based on action type
        if action_type == "click":
            return self._generate_click_expected_result(edge, to_node, element_name)
        elif action_type in ["input", "type", "fill_input"]:
            return self._generate_input_expected_result(edge, element_name)
        elif action_type == "select":
            return self._generate_select_expected_result(edge, element_name)
        elif action_type == "submit":
            return self._generate_submit_expected_result(edge, to_node)
        elif action_type == "navigate":
            return self._generate_navigate_expected_result(edge, to_node)
        
        # Strategy 5: Generic fallback (should be rare)
        return f"Action completes successfully"
    
    def _generate_click_expected_result(
        self,
        edge: ActionGraphEdge,
        to_node: Optional[ActionGraphNode],
        element_name: str
    ) -> str:
        """Generate expected result for click actions"""
        # Filter out bad expected results
        if self._is_bad_expected_result(element_name):
            element_name = "element"
        
        # Check if click leads to navigation
        if to_node and to_node.url_pattern:
            destination = self._infer_destination_from_node(to_node)
            if destination and destination.lower() != "scroll page":
                return f"User is navigated to {destination}"
        
        # Check element name for context
        element_lower = element_name.lower()
        
        # Filter out price/currency patterns - these shouldn't be clickable
        if re.match(r'^\$?[\d,]+\.?\d*$', element_name.strip()):
            # This is a price - infer from selector or context
            if edge.locators and edge.locators.get("primary"):
                selector = edge.locators.get("primary", "")
                if "cart" in selector.lower() or "total" in selector.lower():
                    return "Cart is displayed"
                else:
                    return "Element is clicked successfully"
        
        # Cart-related actions
        if "cart" in element_lower or "add" in element_lower:
            if "add" in element_lower:
                return "Item is added to cart"
            elif "remove" in element_lower:
                return "Item is removed from cart"
            elif "cart" in element_lower:
                return "User is navigated to cart page"
        
        # Checkout actions
        if "checkout" in element_lower:
            return "User is navigated to checkout page"
        
        # Navigation menu items
        if any(keyword in element_lower for keyword in ["menu", "nav", "services", "category"]):
            return f"User is navigated to {element_name} page"
        
        # Form actions
        if "save" in element_lower or "submit" in element_lower:
            return "Changes are saved successfully"
        
        if "edit" in element_lower or "change" in element_lower:
            return "Edit form is displayed"
        
        # Dropdown/select actions
        if "dropdown" in element_lower or "select" in element_lower:
            return f"{element_name} dropdown is opened"
        
        # Generic click result
        return f"{element_name} is clicked successfully"
    
    def _generate_input_expected_result(
        self,
        edge: ActionGraphEdge,
        element_name: str
    ) -> str:
        """Generate expected result for input actions"""
        value = None
        if edge.inputs:
            value = edge.inputs.get("value")
            if value:
                value = str(value).strip()
        
        if value:
            # Truncate long values
            display_value = value[:30] + "..." if len(value) > 30 else value
            return f"{element_name} contains the value '{display_value}'"
        else:
            return f"{element_name} is filled with the entered text"
    
    def _generate_select_expected_result(
        self,
        edge: ActionGraphEdge,
        element_name: str
    ) -> str:
        """Generate expected result for select actions"""
        value = None
        if edge.inputs:
            value = edge.inputs.get("value")
            if value:
                value = str(value).strip()
        
        if value:
            return f"{element_name} displays the selected option '{value}'"
        else:
            return f"{element_name} displays the selected option"
    
    def _generate_submit_expected_result(
        self,
        edge: ActionGraphEdge,
        to_node: Optional[ActionGraphNode]
    ) -> str:
        """Generate expected result for submit actions"""
        if to_node:
            destination = self._infer_destination_from_node(to_node)
            if destination:
                return f"Form is submitted and user is navigated to {destination}"
        
        return "Form is submitted successfully"
    
    def _generate_navigate_expected_result(
        self,
        edge: ActionGraphEdge,
        to_node: Optional[ActionGraphNode]
    ) -> str:
        """Generate expected result for navigate actions"""
        if to_node:
            destination = self._infer_destination_from_node(to_node)
            if destination:
                return f"User is navigated to {destination}"
        
        # Fallback to description
        if edge.description:
            url_match = re.search(r'https?://[^\s]+', edge.description)
            if url_match:
                url = url_match.group(0)
                # Extract domain or page name
                domain_match = re.search(r'://([^/]+)', url)
                if domain_match:
                    domain = domain_match.group(1)
                    return f"User is navigated to {domain}"
        
        return "User is navigated to the target page"
    
    def _extract_destination_page(self, node: ActionGraphNode) -> Optional[str]:
        """Extract destination page name from node"""
        if node.title:
            # Clean title
            title = str(node.title).strip()
            # Remove Flowstral internal patterns
            if not self._is_internal_event(title):
                return self._clean_page_name(title)
        
        if node.url_pattern:
            return self._extract_page_from_url(node.url_pattern)
        
        return None
    
    def _infer_destination_from_node(self, node: ActionGraphNode) -> Optional[str]:
        """Infer destination page from node attributes"""
        # Try title first
        if node.title:
            title = str(node.title).strip()
            if not self._is_internal_event(title):
                cleaned = self._clean_page_name(title)
                if cleaned and cleaned.lower() != "scroll page":
                    return cleaned
        
        # Try URL pattern
        if node.url_pattern:
            page = self._extract_page_from_url(node.url_pattern)
            if page and page.lower() != "scroll page":
                return page
        
        # Try to infer from URL path
        if hasattr(node, 'url') and node.url:
            page = self._extract_page_from_url(node.url)
            if page and page.lower() != "scroll page":
                return page
        
        return None
    
    def _extract_page_from_url(self, url: str) -> Optional[str]:
        """Extract page name from URL"""
        if not url:
            return None
        
        # Remove protocol
        url = re.sub(r'^https?://', '', url)
        
        # Extract path
        path_match = re.search(r'/([^/?]+)', url)
        if path_match:
            path = path_match.group(1)
            # Clean path
            path = path.replace("-", " ").replace("_", " ").title()
            return path
        
        # Extract domain
        domain_match = re.search(r'^([^/]+)', url)
        if domain_match:
            domain = domain_match.group(1)
            # Remove www. and .com
            domain = re.sub(r'^www\.', '', domain)
            domain = re.sub(r'\.(com|net|org|io)$', '', domain)
            return domain.title()
        
        return None
    
    def _clean_page_name(self, name: str) -> str:
        """Clean page name for expected results"""
        # Remove "User " prefix
        name = re.sub(r'^User\s+', '', name, flags=re.I)
        
        # Remove internal event patterns
        if self._is_internal_event(name):
            return ""
        
        # Remove "page" suffix if redundant
        name = re.sub(r'\s+page$', '', name, flags=re.I)
        
        # Capitalize properly
        name = name.strip()
        if name:
            name = name[0].upper() + name[1:] if len(name) > 1 else name.upper()
        
        return name
    
    def _is_internal_event(self, text: str) -> bool:
        """Check if text is a Flowstral internal event"""
        if not text:
            return True
        
        text_lower = text.lower()
        internal_patterns = [
            "wcag_scan", "api_request", "page_load", "dom_snapshot",
            "session", "scroll", "loading", "please wait", "processing"
        ]
        
        return any(pattern in text_lower for pattern in internal_patterns)
    
    def _is_bad_expected_result(self, result: str) -> bool:
        """Check if expected result is in a bad format"""
        if not result:
            return True
        
        result_lower = result.lower()
        
        # Bad patterns
        bad_patterns = [
            r'^click:', r'^fill:', r'^select:', r'^submit:', r'^input:',
            r'^navigate:', r'^scroll\s+page$', r'^element\s+clicked\s+successfully$',
            r'^action\s+completes\s+successfully$', r'^user\s+is\s+navigated\s+to\s+click:',
            r'^user\s+is\s+navigated\s+to\s+scroll\s+page$', r'^user\s+is\s+navigated\s+to\s+user\s+wcag',
            r'^user\s+is\s+navigated\s+to\s+user\s+api_request', r'^choose\s+model',
            r'^choose\s+sub\s+model', r'^submit_form:', r'^fill_input:',
            r'scroll\s+page', r'user\s+scroll', r'page\s+scroll'
        ]
        
        for pattern in bad_patterns:
            if re.search(pattern, result_lower):
                return True
        
        return False
    
    def _enhance_expected_result(
        self,
        result: str,
        to_node: Optional[ActionGraphNode],
        element_name: str
    ) -> str:
        """Enhance an existing expected result with context"""
        # If result is generic, try to enhance it
        if result.lower() in ["action completes successfully", "element clicked successfully"]:
            # Try to infer from context
            if to_node:
                destination = self._infer_destination_from_node(to_node)
                if destination:
                    return f"User is navigated to {destination}"
            
            # Try to infer from element name
            element_lower = element_name.lower()
            if "add" in element_lower and "cart" in element_lower:
                return "Item is added to cart"
            elif "checkout" in element_lower:
                return "User is navigated to checkout page"
            elif "save" in element_lower:
                return "Changes are saved successfully"
        
        return result

