"""
Test Case Enhancements
Universal improvements for all test case generation:
1. Always add entry point navigation as first step
2. Improve element name extraction (natural language)
3. Improve expected results (context-aware, natural language)
4. Work generically for all flows
"""

import logging
import re
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode

logger = logging.getLogger(__name__)


class TestCaseEnhancements:
    """
    Universal enhancements for test case generation that work for all flows.
    """
    
    def __init__(self):
        # Common technical suffixes to remove from element names
        self.technical_suffixes = [
            "input", "button", "link", "span", "div", "a", "select", 
            "textarea", "form", "field", "element", "container"
        ]
        
        # Common technical prefixes
        self.technical_prefixes = [
            "click:", "fill:", "type:", "select:", "navigate:",
            "CLICK:", "FILL:", "TYPE:", "SELECT:", "NAVIGATE:"
        ]
    
    def add_entry_point_navigation(
        self,
        test_case: Dict[str, Any],
        action_graph: ActionGraph
    ) -> Dict[str, Any]:
        """
        Always add entry point navigation as the first step.
        Extracts the first meaningful URL from the action graph.
        """
        steps = test_case.get("steps") or test_case.get("test_steps", [])
        
        # Check if first step is already a navigation step
        if steps and len(steps) > 0:
            first_action = steps[0].get("action", "").lower()
            if any(keyword in first_action for keyword in ["navigate", "open", "go to", "visit", "load"]):
                # Already has navigation, check if it's the entry point
                first_url = self._extract_first_url(action_graph)
                if first_url:
                    # Update first step to be more specific
                    site_name = self._extract_site_name(first_url)
                    steps[0]["action"] = f"Navigate to {site_name}"
                    steps[0]["expected_result"] = f"{site_name} home page loads successfully"
                return test_case
        
        # No navigation step found, add one
        first_url = self._extract_first_url(action_graph)
        if first_url:
            site_name = self._extract_site_name(first_url)
            entry_step = {
                "step_number": 1,
                "action": f"Navigate to {site_name}",
                "expected_result": f"{site_name} home page loads successfully",
                "element_name": f"{site_name} URL",
                "selector": first_url
            }
            
            # Renumber existing steps
            for i, step in enumerate(steps, start=2):
                step["step_number"] = i
            
            # Insert entry step at the beginning
            steps.insert(0, entry_step)
            
            # Update test case
            if "steps" in test_case:
                test_case["steps"] = steps
            if "test_steps" in test_case:
                test_case["test_steps"] = steps
        
        return test_case
    
    def _extract_first_url(self, action_graph: ActionGraph) -> Optional[str]:
        """Extract the first meaningful URL from action graph, excluding localhost/Flowstral UI"""
        if not action_graph or not action_graph.nodes:
            return None
        
        # URLs to exclude (Flowstral UI, localhost, internal)
        excluded_patterns = [
            r'localhost',
            r'127\.0\.0\.1',
            r':8080',
            r':8081',
            r':3000',
            r':5173',  # Vite dev server
            r'flowstral',
            r'qa.*platform',
        ]
        
        # Find first node with a valid URL (skip session_start, etc.)
        for node in action_graph.nodes:
            if node.url and node.event_type not in ["session_start", "session_end"]:
                # Skip localhost/internal URLs
                url_lower = node.url.lower()
                if any(re.search(pattern, url_lower, re.I) for pattern in excluded_patterns):
                    logger.debug(f"Skipping localhost/internal URL: {node.url}")
                    continue
                
                # Extract base URL (domain only)
                try:
                    parsed = urlparse(node.url)
                    if parsed.netloc:
                        # Double-check it's not localhost
                        netloc_lower = parsed.netloc.lower()
                        if 'localhost' in netloc_lower or '127.0.0.1' in netloc_lower:
                            logger.debug(f"Skipping localhost URL: {node.url}")
                            continue
                        
                        # Return full URL for home page, or base domain
                        if parsed.path == "/" or not parsed.path:
                            return f"{parsed.scheme}://{parsed.netloc}"
                        else:
                            # Return base domain
                            return f"{parsed.scheme}://{parsed.netloc}"
                except Exception as e:
                    logger.debug(f"Error parsing URL {node.url}: {e}")
                    # Only return if it's not obviously localhost
                    if 'localhost' not in node.url.lower() and '127.0.0.1' not in node.url.lower():
                        return node.url
        
        return None
    
    def _extract_site_name(self, url: str) -> str:
        """Extract site name from URL (e.g., 'Walmart' from 'walmart.com')"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or url
            
            # Skip if it's localhost/internal
            if 'localhost' in domain.lower() or '127.0.0.1' in domain.lower():
                return "the website"
            
            # Remove www. prefix
            domain = re.sub(r'^www\.', '', domain, flags=re.I)
            
            # Remove port numbers
            domain = re.sub(r':\d+$', '', domain)
            
            # Extract site name (first part before .)
            site_name = domain.split('.')[0]
            
            # Capitalize
            site_name = site_name.capitalize()
            
            # Common site name mappings
            site_mappings = {
                "walmart": "Walmart",
                "amazon": "Amazon",
                "target": "Target",
                "ebay": "eBay",
                "etsy": "Etsy",
                "saucedemo": "Sauce Demo",
                "example": "Example"
            }
            
            return site_mappings.get(site_name.lower(), site_name)
        except:
            # Fallback: try to extract from URL string
            match = re.search(r'([a-zA-Z0-9-]+)\.(com|net|org|io)', url, re.I)
            if match:
                return match.group(1).capitalize()
            return "the website"
    
    def improve_element_names(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Improve element names to be more natural and less technical.
        Converts "Size 10 Inch Input" → "Size 10 Inch"
        Converts "Bottom Border Border Input" → "Bottom Border"
        Converts URLs/query params to readable names
        """
        steps = test_case.get("steps") or test_case.get("test_steps", [])
        
        for step in steps:
            element_name = step.get("element_name", "")
            if not element_name:
                continue
            
            improved_name = element_name
            
            # Remove URLs and query parameters (e.g., "ahead/cake?povid=..." → "Custom Cakes")
            if "/" in improved_name or "?" in improved_name or "=" in improved_name:
                # Try to extract meaningful text from URL path
                # "ahead/cake?povid=..." → "Custom Cakes"
                # "order/custom-cakes" → "Custom Cakes"
                url_match = re.search(r'/([^/?]+)', improved_name)
                if url_match:
                    path_part = url_match.group(1)
                    # Convert kebab-case/snake_case to Title Case
                    improved_name = re.sub(r'[-_]', ' ', path_part)
                    improved_name = ' '.join(word.capitalize() for word in improved_name.split())
                    # Common mappings
                    if "cake" in improved_name.lower():
                        improved_name = "Custom Cakes"
                    elif "tire" in improved_name.lower():
                        improved_name = "Car Tires"
                    elif "order" in improved_name.lower():
                        improved_name = "Order"
                else:
                    # If we can't extract, use a generic name based on context
                    improved_name = "Link"
            
            # Remove technical suffixes
            for suffix in self.technical_suffixes:
                # Remove suffix if it's at the end (case insensitive)
                pattern = rf'\s+{re.escape(suffix)}\s*$'
                improved_name = re.sub(pattern, '', improved_name, flags=re.I)
            
            # Remove technical prefixes
            for prefix in self.technical_prefixes:
                improved_name = re.sub(rf'^{re.escape(prefix)}\s*', '', improved_name, flags=re.I)
            
            # Clean up common patterns
            # "Bottom Border Border" → "Bottom Border"
            improved_name = re.sub(r'\b(\w+)\s+\1\b', r'\1', improved_name, flags=re.I)
            
            # Remove redundant words
            improved_name = re.sub(r'\b(Input|Button|Link|Field)\s+(Input|Button|Link|Field)\b', r'\1', improved_name, flags=re.I)
            
            # If name is too generic (Button, Link, Span, Div), try to infer from selector or action
            if improved_name.lower() in ["button", "link", "span", "div", "a", "input"]:
                # Try to get better name from selector or action
                selector = step.get("selector", "")
                action = step.get("action", "")
                
                # Extract from selector (e.g., "#flavor-chocolate-input" → "Flavor Chocolate")
                if selector:
                    selector_match = re.search(r'#([a-z0-9-]+)', selector, re.I)
                    if selector_match:
                        selector_id = selector_match.group(1)
                        # Convert kebab-case to Title Case
                        improved_name = ' '.join(word.capitalize() for word in selector_id.replace('-', ' ').split())
                        # Remove technical words
                        improved_name = re.sub(r'\s+(input|button|link|field)\s*$', '', improved_name, flags=re.I)
                
                # Extract from action if selector didn't help
                if improved_name.lower() in ["button", "link", "span", "div"] and action:
                    # "Click on Check out" → "Check Out"
                    action_match = re.search(r'(?:click|select|choose)\s+(?:on|the)\s+(.+?)(?:\s+button|\s+link|\s+input|$)', action, re.I)
                    if action_match:
                        improved_name = action_match.group(1).strip()
            
            # Capitalize properly
            if improved_name:
                # Preserve existing capitalization for proper nouns
                words = improved_name.split()
                if len(words) > 1:
                    # Title case but keep common words lowercase
                    title_words = []
                    for word in words:
                        if word.lower() in ["to", "the", "a", "an", "and", "or", "of", "in", "on", "at", "for"]:
                            title_words.append(word.lower())
                        else:
                            title_words.append(word.capitalize())
                    improved_name = ' '.join(title_words)
                else:
                    improved_name = improved_name.capitalize()
            
            # Update step
            if improved_name and improved_name != element_name:
                step["element_name"] = improved_name
                logger.debug(f"Improved element name: '{element_name}' → '{improved_name}'")
        
        return test_case
    
    def improve_expected_results(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Improve expected results to be more natural and context-aware.
        Converts "User is navigated to click_button: button - custom cakes page" 
        → "Custom Cakes page is displayed"
        """
        steps = test_case.get("steps") or test_case.get("test_steps", [])
        
        for i, step in enumerate(steps):
            expected = step.get("expected_result", "")
            if not expected:
                continue
            
            # Remove technical patterns
            improved = expected
            
            # Remove "User is navigated to click_button: button - X page"
            improved = re.sub(
                r'User is navigated to (click|fill|type|select|navigate)[_:\s]+[^-\s]+[-–]\s*',
                '',
                improved,
                flags=re.I
            )
            
            # Remove "click_button:", "fill_input:", etc.
            improved = re.sub(
                r'(click|fill|type|select|navigate)[_:\s]+[^:\s]+:\s*',
                '',
                improved,
                flags=re.I
            )
            
            # Remove "Element is clicked successfully" → more specific
            if "element is clicked successfully" in improved.lower():
                action = step.get("action", "").lower()
                element = step.get("element_name", "")
                
                if "button" in action or "button" in element.lower():
                    improved = f"{element} is clicked and action is triggered"
                elif "link" in action or "link" in element.lower():
                    improved = f"User is navigated to {element} page"
                elif "dropdown" in action or "dropdown" in element.lower():
                    improved = f"{element} dropdown opens"
                else:
                    improved = f"{element} is clicked successfully"
            
            # Remove "User is navigated to X page" → "X page is displayed"
            improved = re.sub(
                r'User is navigated to (.+?)\s+page',
                r'\1 page is displayed',
                improved,
                flags=re.I
            )
            
            # Clean up page references
            improved = re.sub(r'\s+page\s+page', ' page', improved, flags=re.I)
            
            # Capitalize first letter
            if improved:
                improved = improved[0].upper() + improved[1:] if len(improved) > 1 else improved.upper()
            
            # Update step
            if improved and improved != expected:
                step["expected_result"] = improved
                logger.debug(f"Improved expected result: '{expected}' → '{improved}'")
        
        return test_case
    
    def improve_action_descriptions(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Improve action descriptions to be more natural.
        Converts "Click on Button" → "Click on [element name]"
        Converts "Enter text in Input" → "Enter text in [element name]"
        """
        steps = test_case.get("steps") or test_case.get("test_steps", [])
        
        for step in steps:
            action = step.get("action", "")
            element_name = step.get("element_name", "")
            
            if not action or not element_name:
                continue
            
            improved_action = action
            
            # Replace generic element types with actual element names
            # "Click on Button" → "Click on [element name]"
            if re.search(r'\b(Button|Link|Input|Span|Div|Field)\s*$', action, re.I):
                # Extract the action verb (Click, Enter, Select, etc.)
                action_match = re.match(r'^(Click|Enter|Select|Choose|Type|Fill|Navigate)\s+(?:on|in|the)?\s*', action, re.I)
                if action_match:
                    action_verb = action_match.group(1)
                    # Build new action with element name
                    if action_verb.lower() in ["click", "select", "choose"]:
                        improved_action = f"Click on {element_name}"
                    elif action_verb.lower() in ["enter", "type", "fill"]:
                        improved_action = f"Enter text in {element_name}"
                    elif action_verb.lower() == "navigate":
                        improved_action = f"Navigate to {element_name}"
                    else:
                        improved_action = f"{action_verb} {element_name}"
            
            # Replace generic "Click on" without element name
            elif re.search(r'Click\s+on\s+(?:Button|Link|Input|Span|Div|Field)\s*$', action, re.I):
                improved_action = f"Click on {element_name}"
            
            # Replace generic "Enter text in" without element name
            elif re.search(r'Enter\s+text\s+in\s+(?:Button|Link|Input|Span|Div|Field)\s*$', action, re.I):
                improved_action = f"Enter text in {element_name}"
            
            # If action contains URL fragments, replace with element name
            elif "/" in action or "?" in action or "=" in action:
                # "Click on ahead/cake?povid=..." → "Click on [element name]"
                action_match = re.match(r'^(Click|Enter|Select|Choose|Type|Fill|Navigate)\s+(?:on|in|the)?\s*', action, re.I)
                if action_match:
                    action_verb = action_match.group(1)
                    if action_verb.lower() in ["click", "select", "choose"]:
                        improved_action = f"Click on {element_name}"
                    elif action_verb.lower() in ["enter", "type", "fill"]:
                        improved_action = f"Enter text in {element_name}"
                    else:
                        improved_action = f"{action_verb} {element_name}"
            
            # Remove technical prefixes
            for prefix in self.technical_prefixes:
                improved_action = re.sub(rf'^{re.escape(prefix)}\s*', '', improved_action, flags=re.I)
            
            # Improve "user clicks X" → "Click on X"
            improved_action = re.sub(
                r'^user\s+clicks\s+(.+)$',
                r'Click on \1',
                improved_action,
                flags=re.I
            )
            
            # Improve "user enters text in X" → "Enter text in X"
            improved_action = re.sub(
                r'^user\s+enters\s+text\s+in\s+(.+)$',
                r'Enter text in \1',
                improved_action,
                flags=re.I
            )
            
            # Improve "user enters "value" in X" → "Enter "value" in X"
            improved_action = re.sub(
                r'^user\s+enters\s+"([^"]+)"\s+in\s+(.+)$',
                r'Enter "\1" in \2',
                improved_action,
                flags=re.I
            )
            
            # Capitalize first letter
            if improved_action:
                improved_action = improved_action[0].upper() + improved_action[1:] if len(improved_action) > 1 else improved_action.upper()
            
            # Update step
            if improved_action and improved_action != action:
                step["action"] = improved_action
                logger.debug(f"Improved action: '{action}' → '{improved_action}'")
        
        return test_case
    
    def enhance_test_case(
        self,
        test_case: Dict[str, Any],
        action_graph: ActionGraph
    ) -> Dict[str, Any]:
        """
        Apply all enhancements to a test case.
        This is the main entry point.
        """
        # 1. Add entry point navigation
        test_case = self.add_entry_point_navigation(test_case, action_graph)
        
        # 2. Improve element names
        test_case = self.improve_element_names(test_case)
        
        # 3. Improve expected results
        test_case = self.improve_expected_results(test_case)
        
        # 4. Improve action descriptions
        test_case = self.improve_action_descriptions(test_case)
        
        return test_case
    
    def enhance_test_cases_batch(
        self,
        test_cases: List[Dict[str, Any]],
        action_graph: ActionGraph
    ) -> List[Dict[str, Any]]:
        """Enhance a batch of test cases"""
        enhanced = []
        for tc in test_cases:
            enhanced_tc = self.enhance_test_case(tc, action_graph)
            enhanced.append(enhanced_tc)
        return enhanced

