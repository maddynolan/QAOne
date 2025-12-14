"""
Scenario Skeleton Generator
Converts action graphs into scenario skeletons with raw_steps for LLM rewriting.
"""

import logging
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

logger = logging.getLogger(__name__)


class ScenarioSkeletonGenerator:
    """
    Generates scenario skeletons with raw_steps from action graphs.
    These skeletons are then sent to LLM for rewriting into high-quality test cases.
    """
    
    def __init__(self):
        # Scenario boundary markers
        self.milestone_controls = [
            "checkout", "place order", "login", "sign in", "submit", 
            "continue to checkout", "proceed to checkout", "complete order",
            "payment", "confirm", "register", "sign up"
        ]
        
        # URL patterns that indicate scenario boundaries
        self.boundary_url_patterns = [
            r"/account/login",
            r"/cart",
            r"/checkout",
            r"/order",
            r"/payment",
            r"/confirmation",
            r"/success"
        ]
    
    def generate_scenario_skeletons(
        self,
        action_graph: ActionGraph,
        session_id: Optional[str] = None,
        project_name: Optional[str] = None,
        application_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate scenario skeletons from action graph.
        
        Returns:
            {
                "type": "scenario_skeletons",
                "format": "structured",
                "session_id": "...",
                "project_name": "...",
                "application_name": "...",
                "scenarios": [...]
            }
        """
        if not action_graph or not action_graph.edges:
            return {
                "type": "scenario_skeletons",
                "format": "structured",
                "session_id": session_id or "unknown",
                "project_name": project_name,
                "application_name": application_name,
                "scenarios": []
            }
        
        # Extract application name from first URL if not provided
        if not application_name and action_graph.nodes:
            first_node = action_graph.nodes[0]
            if first_node.url:
                parsed = urlparse(first_node.url)
                application_name = parsed.netloc.replace("www.", "").split(".")[0].title()
        
        # Segment edges into scenarios
        scenarios = self._segment_into_scenarios(action_graph)
        
        # Convert each scenario to skeleton format
        scenario_skeletons = []
        for i, scenario_edges in enumerate(scenarios, 1):
            skeleton = self._build_scenario_skeleton(
                scenario_edges=scenario_edges,
                action_graph=action_graph,
                scenario_id=f"scenario_{i}",
                project_name=project_name,
                application_name=application_name
            )
            if skeleton:
                scenario_skeletons.append(skeleton)
        
        return {
            "type": "scenario_skeletons",
            "format": "structured",
            "session_id": session_id or action_graph.session_id or "unknown",
            "project_name": project_name,
            "application_name": application_name,
            "scenarios": scenario_skeletons
        }
    
    def _segment_into_scenarios(self, action_graph: ActionGraph) -> List[List[ActionGraphEdge]]:
        """
        Segment action graph edges into logical scenarios.
        
        Rules:
        - Start new scenario at first page_load for a new domain
        - Start new scenario at milestone controls (checkout, login, etc.)
        - Start new scenario when URL path changes root context
        """
        scenarios = []
        current_scenario = []
        last_url_domain = None
        
        # Filter out internal events (wcag_scan, api_request, scroll, session_end)
        # CRITICAL: Normalize action types - edges might have "click_button", "fill_field", etc.
        user_interaction_events = ["click", "click_button", "input", "type", "fill_field", "select", "submit", "navigate", "page_load"]
        
        for edge in action_graph.edges:
            # Get action type (normalize from action_type or action)
            action_type = edge.action_type or edge.action or ""
            # Normalize: click_button -> click, fill_field -> input
            if action_type == "click_button":
                action_type = "click"
            elif action_type == "fill_field":
                action_type = "input"
            
            # Skip internal events (but keep page_load for navigation)
            if action_type not in user_interaction_events and action_type != "page_load":
                continue
            
            from_node = action_graph.node_map.get(edge.from_node_id)
            to_node = action_graph.node_map.get(edge.to_node_id)
            
            # Check if this is a scenario boundary
            is_boundary = False
            
            # Check for milestone controls (use normalized action_type)
            if action_type == "click" and to_node:
                target_text = (to_node.target_text or "").lower()
                if any(milestone in target_text for milestone in self.milestone_controls):
                    is_boundary = True
                    logger.debug(f"Scenario boundary detected: milestone control '{to_node.target_text}'")
            
            # Check for URL boundary patterns
            if to_node and to_node.url:
                parsed = urlparse(to_node.url)
                current_domain = parsed.netloc
                current_path = parsed.path
                
                # New domain = new scenario
                if last_url_domain and current_domain != last_url_domain:
                    is_boundary = True
                    logger.debug(f"Scenario boundary detected: domain change {last_url_domain} -> {current_domain}")
                
                # Check for boundary URL patterns
                if any(re.search(pattern, current_path) for pattern in self.boundary_url_patterns):
                    is_boundary = True
                    logger.debug(f"Scenario boundary detected: boundary URL pattern in {current_path}")
                
                last_url_domain = current_domain
            
            # If boundary and current scenario has content, start new scenario
            if is_boundary and current_scenario:
                scenarios.append(current_scenario)
                current_scenario = []
            
            current_scenario.append(edge)
        
        # Add final scenario
        if current_scenario:
            scenarios.append(current_scenario)
        
        logger.info(f"Segmented {len(action_graph.edges)} edges into {len(scenarios)} scenarios")
        return scenarios
    
    def _build_scenario_skeleton(
        self,
        scenario_edges: List[ActionGraphEdge],
        action_graph: ActionGraph,
        scenario_id: str,
        project_name: Optional[str] = None,
        application_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Build a scenario skeleton from edges."""
        if not scenario_edges:
            return None
        
        # Infer high-level intent from first and last nodes
        first_edge = scenario_edges[0]
        last_edge = scenario_edges[-1]
        
        first_node = action_graph.node_map.get(first_edge.from_node_id)
        last_node = action_graph.node_map.get(last_edge.to_node_id)
        
        # Infer intent from URLs and actions
        high_level_intent = self._infer_intent(scenario_edges, action_graph)
        
        # Build raw_steps
        raw_steps = []
        for i, edge in enumerate(scenario_edges, 1):
            from_node = action_graph.node_map.get(edge.from_node_id)
            to_node = action_graph.node_map.get(edge.to_node_id)
            
            # Extract element text
            element_text = None
            if to_node:
                element_text = to_node.target_text
            
            # Extract selector
            selector = None
            if edge.locators and edge.locators.get("primary"):
                selector = edge.locators["primary"]
            elif to_node and to_node.target_selector:
                selector = to_node.target_selector
            
            # Infer field role from selector/ID
            field_role = self._infer_field_role(selector, element_text, to_node)
            
            # Get URL
            url = None
            if to_node:
                url = to_node.url or to_node.url_pattern
            elif from_node:
                url = from_node.url or from_node.url_pattern
            
            raw_step = {
                "order": i,
                "event_type": edge.action_type or edge.action,
                "url": url,
                "element_text": element_text,
                "selector": selector,
                "field_role": field_role
            }
            
            raw_steps.append(raw_step)
        
        return {
            "scenario_id": scenario_id,
            "scenario_type": "functional",
            "high_level_intent": high_level_intent,
            "raw_steps": raw_steps
        }
    
    def _infer_intent(
        self,
        scenario_edges: List[ActionGraphEdge],
        action_graph: ActionGraph
    ) -> str:
        """Infer high-level intent from scenario edges."""
        # Collect keywords from URLs and element text
        keywords = []
        
        for edge in scenario_edges:
            to_node = action_graph.node_map.get(edge.to_node_id)
            if to_node:
                if to_node.url:
                    # Extract meaningful parts from URL
                    parsed = urlparse(to_node.url)
                    path_parts = [p for p in parsed.path.split("/") if p and p not in ["", "www"]]
                    keywords.extend(path_parts[:2])  # Take first 2 meaningful path parts
                
                if to_node.target_text:
                    keywords.append(to_node.target_text.lower())
        
        # Common intent patterns
        keywords_lower = [k.lower() for k in keywords if k]
        
        if any(k in keywords_lower for k in ["checkout", "cart", "buy", "purchase"]):
            return "checkout_flow"
        elif any(k in keywords_lower for k in ["login", "sign in", "authenticate"]):
            return "authentication"
        elif any(k in keywords_lower for k in ["register", "sign up", "create account"]):
            return "registration"
        elif any(k in keywords_lower for k in ["search", "find", "browse"]):
            return "search_browse"
        elif any(k in keywords_lower for k in ["cake", "tire", "product", "item"]):
            return "product_configuration"
        else:
            return "user_journey"
    
    def _infer_field_role(
        self,
        selector: Optional[str],
        element_text: Optional[str],
        node: Optional[ActionGraphNode]
    ) -> Optional[str]:
        """Infer field role from selector, element text, or node data."""
        if not selector and not element_text:
            return None
        
        # Check selector patterns
        if selector:
            # ID-based patterns
            id_match = re.search(r'#([a-z0-9_-]+)', selector, re.I)
            if id_match:
                id_value = id_match.group(1).lower()
                
                # Common patterns
                if "username" in id_value or "email" in id_value or "user" in id_value:
                    return "username"
                elif "password" in id_value or "pass" in id_value:
                    return "password"
                elif "size" in id_value:
                    return "product_size"
                elif "flavor" in id_value:
                    return "product_flavor"
                elif "color" in id_value or "icing" in id_value:
                    return "product_color"
                elif "checkout" in id_value:
                    return "checkout"
                elif "login" in id_value or "signin" in id_value:
                    return "login"
                elif "search" in id_value:
                    return "search"
                elif "cart" in id_value:
                    return "cart"
            
            # Class-based patterns
            if "nav" in selector.lower() or "menu" in selector.lower():
                return "navigation"
            elif "button" in selector.lower() and "checkout" in selector.lower():
                return "checkout"
        
        # Check element text
        if element_text:
            text_lower = element_text.lower()
            if any(word in text_lower for word in ["checkout", "place order", "buy now"]):
                return "checkout"
            elif any(word in text_lower for word in ["login", "sign in"]):
                return "login"
            elif any(word in text_lower for word in ["search", "find"]):
                return "search"
            elif any(word in text_lower for word in ["cart", "basket"]):
                return "cart"
            elif any(word in text_lower for word in ["services", "menu"]):
                return "navigation"
        
        return None






