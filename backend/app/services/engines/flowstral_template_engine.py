"""
Flowstral Template Engine
Implements the Flowstral algorithm for generating fluent test cases from action graphs
without LLM dependency. Uses phrase banks, page types, controls, and scenario templates.
"""

import logging
import json
import re
import random
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from urllib.parse import urlparse

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

logger = logging.getLogger(__name__)


class FlowstralTemplateEngine:
    """
    Generates fluent test cases from action graphs using templates and phrase banks.
    
    Core Algorithm:
    1. Enrich events with context (page_type, control_id, element_name, etc.)
    2. Segment into scenarios
    3. Match scenario templates
    4. Generate fluent language using phrase banks with randomness
    """
    
    def __init__(self, templates_path: Optional[str] = None):
        """
        Initialize the template engine.
        
        Args:
            templates_path: Path to flowstral_templates.json (defaults to same directory)
        """
        if templates_path is None:
            templates_path = Path(__file__).parent / "flowstral_templates.json"
        
        self.templates = self._load_templates(templates_path)
        self.page_types = {pt["id"]: pt for pt in self.templates.get("page_types", [])}
        self.controls = {c["id"]: c for c in self.templates.get("controls", [])}
        self.action_phrases = self.templates.get("action_phrases", {})
        self.expected_phrases = self.templates.get("expected_phrases", {})
        self.scenario_templates = self.templates.get("scenario_templates", [])
        
        logger.info(f"FlowstralTemplateEngine initialized with {len(self.page_types)} page types, "
                    f"{len(self.controls)} controls, {len(self.scenario_templates)} scenario templates")
    
    def _load_templates(self, templates_path: str) -> Dict[str, Any]:
        """Load templates from JSON file"""
        try:
            with open(templates_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load templates from {templates_path}: {e}")
            return {
                "page_types": [],
                "controls": [],
                "action_phrases": {},
                "expected_phrases": {},
                "scenario_templates": []
            }
    
    def generate_test_cases_from_action_graph(
        self,
        action_graph: ActionGraph
    ) -> Dict[str, Any]:
        """
        Generate test cases from action graph using Flowstral algorithm.
        
        Args:
            action_graph: ActionGraph instance
            
        Returns:
            Dict with test_cases structure
        """
        # Step 1: Enrich events with context
        enriched_events = self._enrich_events(action_graph)
        
        # Step 2: Segment into scenarios
        scenarios = self._segment_into_scenarios(enriched_events, action_graph)
        
        # Step 3: Generate test cases for each scenario
        test_cases = []
        for scenario in scenarios:
            test_case = self._generate_test_case_for_scenario(scenario, action_graph)
            if test_case:
                test_cases.append(test_case)
        
        return {
            "type": "test_cases",
            "format": "structured",
            "test_cases": {
                "manual": test_cases,
                "automated": []
            }
        }
    
    def _enrich_events(self, action_graph: ActionGraph) -> List[Dict[str, Any]]:
        """
        Enrich action graph nodes with context variables:
        - page_type, page_label
        - control_id, element_name
        - product_type (inferred)
        - user_role (inferred)
        - intent (inferred)
        """
        enriched = []
        
        for node in action_graph.nodes:
            event = {
                "node_id": node.id,
                "event_type": node.event_type,
                "url": node.url,
                "url_pattern": node.url_pattern,
                "title": node.title,
                "target_selector": node.target_selector,
                "target_text": node.target_text,
                "action_description": node.action_description,
                "metadata": node.metadata or {}
            }
            
            # Enrich with page_type and page_label
            page_type_info = self._identify_page_type(node.url or node.url_pattern or "")
            event["page_type"] = page_type_info["id"]
            event["page_label"] = page_type_info["label"]
            
            # Enrich with control_id and element_name
            control_info = self._identify_control(node)
            event["control_id"] = control_info["id"]
            event["element_name"] = control_info["element_name"]
            event["control_type"] = control_info["type"]
            
            # Infer product_type from context
            event["product_type"] = self._infer_product_type(node, page_type_info)
            
            # Infer user_role (default to "user", can be enhanced)
            event["user_role"] = self._infer_user_role(node, action_graph)
            
            # Infer intent from action
            event["intent"] = self._infer_intent(node, event)
            
            enriched.append(event)
        
        return enriched
    
    def _identify_page_type(self, url: str) -> Dict[str, str]:
        """Identify page type from URL using match patterns"""
        if not url:
            return {"id": "unknown", "label": "unknown page"}
        
        url_lower = url.lower()
        
        for page_type in self.page_types.values():
            for pattern in page_type.get("match", []):
                # Support regex patterns
                if pattern.startswith("^"):
                    if re.search(pattern, url, re.IGNORECASE):
                        return {"id": page_type["id"], "label": page_type["label"]}
                else:
                    # Simple substring match
                    if pattern.lower() in url_lower:
                        return {"id": page_type["id"], "label": page_type["label"]}
        
        # Default: try to infer from URL path
        parsed = urlparse(url)
        path = parsed.path.lower()
        
        if "/cart" in path:
            return {"id": "cart", "label": "cart page"}
        elif "/login" in path or "/sign-in" in path:
            return {"id": "login", "label": "login page"}
        elif "/checkout" in path:
            return {"id": "checkout", "label": "checkout page"}
        elif "/search" in path or "/s/" in path:
            return {"id": "search_results", "label": "search results page"}
        elif path == "/" or path == "":
            return {"id": "home", "label": "home page"}
        else:
            return {"id": "unknown", "label": "unknown page"}
    
    def _identify_control(self, node: ActionGraphNode) -> Dict[str, str]:
        """Identify control from node using selector and text matching"""
        selector = (node.target_selector or "").lower()
        text = (node.target_text or "").lower()
        element_name = node.target_text or "element"
        
        for control in self.controls.values():
            # Check selector matches
            selector_matches = False
            for sel_pattern in control.get("selector_contains", []):
                if sel_pattern.lower() in selector:
                    selector_matches = True
                    break
            
            # Check text matches
            text_matches = False
            for text_pattern in control.get("text_contains", []):
                if text_pattern.lower() in text:
                    text_matches = True
                    break
            
            # Check exact selector match
            exact_match = False
            for exact_sel in control.get("selector_exact", []):
                if exact_sel.lower() == selector:
                    exact_match = True
                    break
            
            if selector_matches or text_matches or exact_match:
                return {
                    "id": control["id"],
                    "element_name": control.get("element_name", element_name),
                    "type": control.get("type", "unknown")
                }
        
        # Default: use target_text or selector
        if node.target_text:
            element_name = node.target_text
        elif node.target_selector:
            # Extract meaningful name from selector
            element_name = self._extract_name_from_selector(node.target_selector)
        
        return {
            "id": "unknown",
            "element_name": element_name,
            "type": "unknown"
        }
    
    def _extract_name_from_selector(self, selector: str) -> str:
        """Extract a readable name from CSS selector"""
        # Try to extract ID
        id_match = re.search(r'#([^\s\.#\[\]]+)', selector)
        if id_match:
            name = id_match.group(1).replace("_", " ").replace("-", " ").title()
            return name
        
        # Try to extract class
        class_match = re.search(r'\.([^\s\.#\[\]]+)', selector)
        if class_match:
            name = class_match.group(1).replace("_", " ").replace("-", " ").title()
            return name
        
        return "element"
    
    def _infer_product_type(self, node: ActionGraphNode, page_type_info: Dict[str, str]) -> str:
        """Infer product type from page context"""
        page_id = page_type_info.get("id", "")
        
        if "tire" in page_id or "tire" in (node.url or "").lower():
            return "tire"
        elif "product" in page_id:
            # Could extract from URL or page title
            return "product"
        else:
            return "item"
    
    def _infer_user_role(self, node: ActionGraphNode, action_graph: ActionGraph) -> str:
        """Infer user role from context (default: user)"""
        # Check if login page suggests authenticated user
        if node.url_pattern and "login" in node.url_pattern.lower():
            return "unauthenticated user"
        
        # Could check action_graph metadata for persona
        if hasattr(action_graph, 'metadata') and action_graph.metadata:
            role = action_graph.metadata.get('user_role') or action_graph.metadata.get('persona')
            if role:
                return role
        
        return "user"
    
    def _infer_intent(self, node: ActionGraphNode, event: Dict[str, Any]) -> str:
        """Infer intent from event type and context"""
        event_type = (node.event_type or "").lower()
        action_desc = (node.action_description or "").lower()
        
        if "login" in event_type or "login" in action_desc or "sign in" in action_desc:
            return "login"
        elif "checkout" in event_type or "checkout" in action_desc:
            return "checkout"
        elif "cart" in event_type or "add" in action_desc:
            return "add_to_cart"
        elif "search" in event_type or "search" in action_desc:
            return "search"
        elif "remove" in action_desc:
            return "remove_from_cart"
        elif "navigate" in event_type:
            return "navigate"
        else:
            return "interact"
    
    def _segment_into_scenarios(
        self,
        enriched_events: List[Dict[str, Any]],
        action_graph: ActionGraph
    ) -> List[Dict[str, Any]]:
        """
        Segment enriched events into logical scenarios.
        Uses simple heuristics: break on major page transitions or intent changes.
        """
        if not enriched_events:
            return []
        
        scenarios = []
        current_scenario = {
            "events": [enriched_events[0]],
            "page_types": {enriched_events[0]["page_type"]},
            "control_ids": {enriched_events[0]["control_id"]} if enriched_events[0]["control_id"] != "unknown" else set(),
            "event_types": {enriched_events[0]["event_type"]}
        }
        
        for i in range(1, len(enriched_events)):
            prev_event = enriched_events[i - 1]
            curr_event = enriched_events[i]
            
            # Check if we should start a new scenario
            should_break = False
            
            # Break on major page type change (e.g., home -> cart -> login)
            if curr_event["page_type"] != prev_event["page_type"]:
                major_pages = {"home", "cart", "checkout", "login"}
                if prev_event["page_type"] in major_pages and curr_event["page_type"] in major_pages:
                    should_break = True
            
            # Break on intent change (e.g., navigate -> add_to_cart -> checkout)
            if curr_event["intent"] != prev_event["intent"]:
                major_intents = {"checkout", "login", "add_to_cart", "remove_from_cart"}
                if prev_event["intent"] in major_intents or curr_event["intent"] in major_intents:
                    should_break = True
            
            if should_break and len(current_scenario["events"]) > 0:
                # Finalize current scenario
                scenarios.append(current_scenario)
                # Start new scenario
                current_scenario = {
                    "events": [curr_event],
                    "page_types": {curr_event["page_type"]},
                    "control_ids": {curr_event["control_id"]} if curr_event["control_id"] != "unknown" else set(),
                    "event_types": {curr_event["event_type"]}
                }
            else:
                # Continue current scenario
                current_scenario["events"].append(curr_event)
                current_scenario["page_types"].add(curr_event["page_type"])
                if curr_event["control_id"] != "unknown":
                    current_scenario["control_ids"].add(curr_event["control_id"])
                current_scenario["event_types"].add(curr_event["event_type"])
        
        # Add final scenario
        if current_scenario["events"]:
            scenarios.append(current_scenario)
        
        return scenarios
    
    def _match_scenario_template(self, scenario: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Match scenario to a template based on page types and controls"""
        scenario_page_types = scenario["page_types"]
        scenario_control_ids = scenario["control_ids"]
        scenario_event_types = scenario["event_types"]
        
        best_match = None
        best_score = 0
        
        for template in self.scenario_templates:
            score = 0
            when = template.get("when", {})
            
            # Check page types
            required_page_types = set(when.get("includes_page_types", []))
            if required_page_types.issubset(scenario_page_types):
                score += len(required_page_types) * 2
            
            # Check controls
            required_controls = set(when.get("includes_controls_any", []))
            if required_controls.intersection(scenario_control_ids):
                score += len(required_controls.intersection(scenario_control_ids))
            
            # Check excluded controls
            excluded_controls = set(when.get("excludes_controls_any", []))
            if excluded_controls.intersection(scenario_control_ids):
                score = 0  # Disqualify if excluded controls are present
            
            # Check event types
            required_event_types = set(when.get("includes_event_types", []))
            if required_event_types.intersection(scenario_event_types):
                score += len(required_event_types.intersection(scenario_event_types)) * 2
            
            if score > best_score:
                best_score = score
                best_match = template
        
        return best_match
    
    def _generate_test_case_for_scenario(
        self,
        scenario: Dict[str, Any],
        action_graph: ActionGraph
    ) -> Optional[Dict[str, Any]]:
        """Generate a single test case for a scenario"""
        events = scenario["events"]
        if not events:
            return None
        
        # Match scenario template
        template = self._match_scenario_template(scenario)
        
        # Generate steps
        steps = []
        for i, event in enumerate(events):
            step = {
                "step_number": i + 1,
                "element_name": event.get("element_name", "element"),
                "selector": event.get("target_selector") or event.get("url")
            }
            
            # Generate action text using phrase banks
            action_text = self._generate_action_text(event, events, i)
            step["action"] = action_text
            
            # Generate expected result
            next_event = events[i + 1] if i + 1 < len(events) else None
            expected_result = self._generate_expected_result(event, next_event, scenario)
            step["expected_result"] = expected_result
            
            steps.append(step)
        
        # Build test case
        if template:
            title = template["title"]
            description = template["description"]
            test_type = template.get("test_type", "functional")
            priority = template.get("priority", "medium")
        else:
            # Generate default title and description
            title = self._generate_default_title(scenario)
            description = self._generate_default_description(scenario)
            test_type = "functional"
            priority = "medium"
        
        return {
            "title": title,
            "description": description,
            "test_type": test_type,
            "priority": priority,
            "steps": steps
        }
    
    def _generate_action_text(
        self,
        event: Dict[str, Any],
        all_events: List[Dict[str, Any]],
        index: int
    ) -> str:
        """Generate fluent action text using phrase banks"""
        event_type = event.get("event_type", "").lower()
        control_type = event.get("control_type", "")
        intent = event.get("intent", "")
        
        # Classify action to get phrase key
        phrase_key = self._classify_action(event_type, control_type, intent)
        
        # Get phrase templates
        phrase_templates = self.action_phrases.get(phrase_key, [])
        if not phrase_templates:
            # Fallback to simple description
            element_name = event.get("element_name", "element")
            if event_type == "click":
                return f"Click on '{element_name}'."
            elif event_type == "navigate" or event_type == "page_load":
                page_label = event.get("page_label", "page")
                return f"Navigate to the {page_label}."
            else:
                return f"Perform {event_type} on {element_name}."
        
        # Pick random template for variation
        template = random.choice(phrase_templates)
        
        # Fill template with context variables
        context = {
            "element_name": event.get("element_name", "element"),
            "page_label": event.get("page_label", "page"),
            "target_text": event.get("target_text", ""),
            "product_type": event.get("product_type", "item"),
            "context_target": event.get("element_name", "target"),
            "user_role": event.get("user_role", "user")
        }
        
        return self._fill_template(template, context)
    
    def _classify_action(
        self,
        event_type: str,
        control_type: str,
        intent: str
    ) -> str:
        """Classify action to map to phrase bank key"""
        event_lower = event_type.lower()
        
        # Map based on control type and intent
        if control_type == "nav_menu":
            return "click_nav_menu"
        elif control_type == "nav_link":
            return "click_nav_link"
        elif intent == "add_to_cart" or "add" in event_lower:
            return "click_add_to_cart"
        elif intent == "remove_from_cart" or "remove" in event_lower:
            return "click_remove"
        elif intent == "checkout" or "checkout" in event_lower:
            return "click_checkout"
        elif intent == "search":
            return "click_search"
        elif event_type == "input" or event_type == "fill_input":
            return "fill_input"
        elif event_type == "scroll":
            return "scroll"
        elif event_type == "navigate" or event_type == "page_load":
            return "open_url"
        elif event_type == "wcag_scan":
            return "wcag_scan"
        elif intent == "login":
            return "login"
        else:
            return "click_nav_link"  # Default
    
    def _generate_expected_result(
        self,
        event: Dict[str, Any],
        next_event: Optional[Dict[str, Any]],
        scenario: Dict[str, Any]
    ) -> str:
        """Generate expected result using phrase banks"""
        expected_key = self._derive_expected_key(event, next_event, scenario)
        
        if not expected_key:
            return ""  # No expected result
        
        phrase_templates = self.expected_phrases.get(expected_key, [])
        if not phrase_templates:
            return ""
        
        # Pick random template
        template = random.choice(phrase_templates)
        
        # Fill template
        context = {
            "page_label": next_event.get("page_label", event.get("page_label", "page")) if next_event else event.get("page_label", "page"),
            "target_text": event.get("target_text", ""),
            "product_type": event.get("product_type", "item"),
            "element_name": event.get("element_name", "element")
        }
        
        return self._fill_template(template, context)
    
    def _derive_expected_key(
        self,
        event: Dict[str, Any],
        next_event: Optional[Dict[str, Any]],
        scenario: Dict[str, Any]
    ) -> Optional[str]:
        """Derive expected result key from event and next event"""
        event_type = event.get("event_type", "").lower()
        intent = event.get("intent", "")
        control_id = event.get("control_id", "")
        
        # Rule-based derivation
        if event_type == "navigate" or event_type == "page_load":
            if next_event and next_event.get("page_type") != event.get("page_type"):
                return "nav_to_page"
        
        if intent == "add_to_cart" or control_id == "add_to_cart":
            return "add_to_cart"
        
        if intent == "remove_from_cart" or control_id == "remove_item":
            return "remove_from_cart"
        
        if control_id == "cart_total_link":
            if next_event and next_event.get("page_type") == "cart":
                return "open_cart"
        
        if control_id == "checkout_button" or intent == "checkout":
            if next_event and next_event.get("page_type") == "login":
                return "checkout_redirect_to_login"
            elif next_event and next_event.get("page_type") == "checkout":
                return "checkout_success"
        
        if event_type == "wcag_scan":
            return "wcag_scan_ok"
        
        if intent == "search":
            return "search_results"
        
        if intent == "login":
            return "login_success"
        
        if control_id == "services_menu":
            return "menu_opened"
        
        return None
    
    def _fill_template(self, template: str, context: Dict[str, str]) -> str:
        """Fill template string with context variables"""
        result = template
        for key, value in context.items():
            placeholder = "{" + key + "}"
            result = result.replace(placeholder, str(value))
        return result
    
    def _generate_default_title(self, scenario: Dict[str, Any]) -> str:
        """Generate default title when no template matches"""
        page_types = list(scenario["page_types"])
        if page_types:
            page_type = page_types[0]
            page_label = self.page_types.get(page_type, {}).get("label", page_type)
            return f"Test {page_label} Flow"
        return "Test Scenario"
    
    def _generate_default_description(self, scenario: Dict[str, Any]) -> str:
        """Generate default description when no template matches"""
        events = scenario["events"]
        if not events:
            return "Verify the workflow completes successfully."
        
        first_event = events[0]
        last_event = events[-1]
        
        first_page = first_event.get("page_label", "page")
        last_page = last_event.get("page_label", "page")
        
        return f"Verify that a user can navigate from {first_page} to {last_page} and complete the workflow."
    
    def _infer_context_target(self, event: Dict[str, Any]) -> str:
        """Infer context target for scroll actions"""
        return event.get("element_name", "target element")




