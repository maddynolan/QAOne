"""
Test Case Synthesizer - Phase 2
Synthesizes test cases from analyzed action graphs using rules and templates.
Components:
1. Precondition Extractor
2. Test Step Generator (Gherkin mapping)
3. Expected Result Inference
4. Test Description Generator
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from uuid import uuid4
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge
from app.services.engines.html_constraint_extractor import HTMLConstraintExtractor
from app.services.engines.screenshot_analyzer import ScreenshotAnalyzer
from app.services.engines.selector_strategy import SelectorStrategyEngine
from app.services.engines.expected_results_generator import ExpectedResultsGenerator
from app.services.engines.flowstral_template_engine import FlowstralTemplateEngine
from app.services.engines.test_case_enhancements import TestCaseEnhancements

logger = logging.getLogger(__name__)


class TestCaseSynthesizer:
    """
    Synthesizes test cases from action graphs.
    
    Uses deterministic rules and templates - no LLM dependency.
    """
    
    def __init__(self):
        # Gherkin keyword mapping
        self.gherkin_mapping = {
            "navigate": "Given",
            "click": "When",
            "input": "And",
            "type": "And",
            "select": "And",
            "submit": "And",
            "assert": "Then",
            "verify": "Then"
        }
        
        # Layer 1: HTML Constraint Extractor
        self.constraint_extractor = HTMLConstraintExtractor()
        
        # Screenshot Analyzer (OCR for text extraction)
        try:
            self.screenshot_analyzer = ScreenshotAnalyzer(ocr_provider="tesseract")
            logger.info("ScreenshotAnalyzer initialized - OCR available for page/element name extraction")
        except Exception as e:
            logger.warning(f"ScreenshotAnalyzer not available: {e} - OCR features disabled")
            self.screenshot_analyzer = None
        
        # Advanced Selector Strategy Engine
        self.selector_engine = SelectorStrategyEngine()
        logger.info("SelectorStrategyEngine initialized - advanced selector strategies available")
        
        # Enhanced Expected Results Generator
        self.expected_results_generator = ExpectedResultsGenerator()
        logger.info("ExpectedResultsGenerator initialized - contextual expected results available")
        
        # Element naming strategies (priority order)
        self.naming_strategies = [
            "aria-label",
            "aria-labelledby",
            "title",
            "placeholder",
            "id",
            "name",
            "text",
            "label"
        ]
        
        # Flowstral Template Engine for fluent language generation
        try:
            self.flowstral_engine = FlowstralTemplateEngine()
            logger.info("FlowstralTemplateEngine initialized - fluent language generation available")
        except Exception as e:
            logger.warning(f"FlowstralTemplateEngine not available: {e} - using basic templates")
            self.flowstral_engine = None
        
        # Test Case Enhancements for universal improvements
        self.enhancements = TestCaseEnhancements()
        logger.info("TestCaseEnhancements initialized - entry point, element names, expected results improvements available")
    
    def synthesize_test_cases(
        self,
        action_graph: ActionGraph,
        analysis: Dict[str, Any],
        dom_snapshots: Optional[Dict[str, Any]] = None,
        screenshot_data: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Synthesize test cases from action graph and analysis.
        
        Args:
            action_graph: Action graph
            analysis: Analysis result from ActionGraphAnalyzer
            dom_snapshots: Optional DOM snapshots for element context
            
        Returns:
            List of synthesized test cases
        """
        test_cases = []
        
        # Process each scenario
        for scenario in analysis.get("scenarios", []):
            # Get intent for this scenario
            intent = next(
                (i for i in analysis.get("intents", []) if i["scenario_id"] == scenario["scenario_id"]),
                None
            )
            
            # Synthesize test case
            test_case = self._synthesize_single_test_case(
                scenario=scenario,
                intent=intent,
                action_graph=action_graph,
                dom_snapshots=dom_snapshots,
                screenshot_data=screenshot_data
            )
            
            if test_case:
                test_cases.append(test_case)
        
        # Also generate from critical paths
        for critical_path in analysis.get("critical_paths", [])[:10]:  # Top 10
            if critical_path.get("is_main_flow"):
                test_case = self._synthesize_from_path(
                    critical_path=critical_path,
                    action_graph=action_graph,
                    dom_snapshots=dom_snapshots
                )
                if test_case:
                    test_cases.append(test_case)
        
        logger.info(f"Synthesized {len(test_cases)} test cases")
        return test_cases
    
    def _synthesize_single_test_case(
        self,
        scenario: Dict[str, Any],
        intent: Optional[Dict[str, Any]],
        action_graph: ActionGraph,
        dom_snapshots: Optional[Dict[str, Any]],
        screenshot_data: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Synthesize a single test case from scenario"""
        # Extract nodes
        nodes = [action_graph.node_map.get(nid) for nid in scenario["nodes"] if action_graph.node_map.get(nid)]
        nodes = [n for n in nodes if n is not None]  # Filter out None values
        
        if not nodes:
            return None
        
        # Build edges from node sequence (follow the flow)
        edges = []
        for i in range(len(nodes) - 1):
            from_node = nodes[i]
            to_node = nodes[i + 1]
            
            # First, try to find an edge connecting these nodes directly
            edge = next(
                (e for e in action_graph.edges if e.from_node_id == from_node.id and e.to_node_id == to_node.id),
                None
            )
            
            if edge:
                edges.append(edge)
            else:
                # No direct edge found - create synthetic edge from node information
                # Use the target node's event type and description to infer the action
                action_type = to_node.event_type or "navigate"
                if action_type == "navigate" and from_node.url_pattern != to_node.url_pattern:
                    # Navigation between different pages
                    description = f"Navigate from {from_node.title} to {to_node.title}"
                elif to_node.action_description:
                    description = to_node.action_description
                else:
                    description = f"Transition from {from_node.title} to {to_node.title}"
                
                # Create synthetic edge with all available information from node
                # Use target_selector for locators
                locators = {}
                if to_node.target_selector:
                    locators["primary"] = to_node.target_selector
                
                # Use metadata.value for inputs
                inputs = {}
                if to_node.metadata and to_node.metadata.get("value"):
                    inputs["value"] = to_node.metadata.get("value")
                
                # Build better description using target_text if available
                if to_node.target_text:
                    if action_type in ["click", "submit"]:
                        description = f"Click {to_node.target_text}"
                    elif action_type in ["input", "type", "fill_input"]:
                        description = f"Enter text in {to_node.target_text}"
                    else:
                        description = f"{action_type} on {to_node.target_text}"
                elif to_node.target_selector:
                    # Extract element name from selector
                    selector = to_node.target_selector
                    # Try to extract ID or class
                    id_match = re.search(r'#([^\s\.#\[\]]+)', selector)
                    if id_match:
                        element_id = id_match.group(1)
                        name = element_id.replace("_", " ").replace("-", " ").title()
                        description = f"{action_type} on {name}"
                    else:
                        description = description  # Use existing description
                
                # Create synthetic edge
                synthetic_edge = ActionGraphEdge(
                    from_node_id=from_node.id,
                    to_node_id=to_node.id,
                    action=action_type,
                    description=description,
                    locators=locators,
                    inputs=inputs,
                    expected_outcome=f"Navigate to {to_node.title}" if action_type == "navigate" else f"Action on {to_node.title} completes"
                )
                edges.append(synthetic_edge)
                logger.debug(f"Created synthetic edge: {action_type} from {from_node.id} to {to_node.id}, description: '{description}', target_text: '{to_node.target_text}', selector: '{to_node.target_selector}'")
        
        # Component 1: Precondition Extractor
        preconditions = self._extract_preconditions(nodes[0], action_graph, dom_snapshots)
        
        # Component 2: Test Step Generator
        # Debug logging
        logger.info(f"Generating steps from {len(edges)} edges for scenario {scenario.get('scenario_id')}")
        if not edges:
            logger.warning(f"No edges found for scenario {scenario.get('scenario_id')}, nodes: {[n.id for n in nodes]}")
        else:
            logger.info(f"Edges to process: {[f'{e.from_node_id}->{e.to_node_id} ({e.action})' for e in edges]}")
        
        # Extract persona from action graph metadata if available, otherwise use "user"
        persona = None
        if hasattr(action_graph, 'metadata') and action_graph.metadata:
            persona = action_graph.metadata.get('persona') or action_graph.metadata.get('user_role')
        
        steps = self._generate_test_steps(edges, nodes, action_graph, dom_snapshots, persona=persona)
        logger.info(f"Generated {len(steps)} steps from {len(edges)} edges")
        
        if not steps:
            logger.warning(f"No steps generated from {len(edges)} edges")
            # Don't return None - create a minimal test case with just navigation
            if nodes:
                steps = [{
                    "step_number": 1,
                    "action": f"Navigate to {nodes[0].title or nodes[0].url_pattern}",
                    "gherkin_keyword": "Given",
                    "element_name": nodes[0].title or "page",
                    "selector": None,
                    "test_data": None,
                    "page": nodes[0].title,
                    "expected_result": f"Page {nodes[0].title} is displayed"
                }]
        
        # Component 3: Expected Result Inference
        expected_results = self._infer_expected_results(edges, nodes, action_graph, dom_snapshots)
        
        # Merge expected results into steps
        for i, step in enumerate(steps):
            if i < len(expected_results):
                step["expected_result"] = expected_results[i]
        
        # Component 4: Test Description Generator
        description = self._generate_description(
            nodes=nodes,
            edges=edges,
            intent=intent,
            preconditions=preconditions
        )
        
        # Determine priority
        priority = self._determine_priority(scenario, intent, nodes)
        
        # Create test case
        test_case = {
            "test_case_id": f"TC_{uuid4().hex[:8].upper()}",
            "title": description["title"],
            "description": description["description"],
            "preconditions": preconditions,
            "steps": steps,
            "postconditions": self._extract_postconditions(nodes[-1] if nodes else None),
            "priority": priority,
            "test_type": "automated",
            "tags": self._generate_tags(intent, nodes),
            "traceability": None,  # Will be linked later if requirements available
            "source": "action_graph",
            "scenario_id": scenario["scenario_id"]
        }
        
        # Post-process to improve quality
        test_case = self._post_process_test_case(test_case)
        
        # Enhance with Flowstral fluent language if available
        if self.flowstral_engine:
            test_case = self._enhance_with_flowstral_language(test_case, action_graph)
        
        # Apply universal enhancements (entry point, element names, expected results)
        test_case = self.enhancements.enhance_test_case(test_case, action_graph)
        
        return test_case
    
    def _extract_preconditions(
        self,
        first_node: ActionGraphNode,
        action_graph: ActionGraph,
        dom_snapshots: Optional[Dict[str, Any]]
    ) -> List[str]:
        """
        Extract preconditions from initial DOM state.
        
        Rules:
        - Initial DOM state → Starting conditions
        - Authentication states → User role requirements
        - Data dependencies → Test data needs
        """
        preconditions = []
        
        # Check URL pattern
        if first_node.url_pattern:
            url_lower = first_node.url_pattern.lower()
            
            # Authentication preconditions
            if "/login" in url_lower or "/signin" in url_lower:
                preconditions.append("User is not logged in")
            elif "/dashboard" in url_lower or "/admin" in url_lower:
                preconditions.append("User must be logged in")
            
            # Role-based preconditions
            if "/admin" in url_lower:
                preconditions.append("User has Admin role")
            elif "/user" in url_lower or "/profile" in url_lower:
                preconditions.append("User account exists")
        
        # Check DOM for authentication indicators
        if dom_snapshots and first_node.dom_snapshot_id:
            dom = dom_snapshots.get(first_node.dom_snapshot_id, {})
            if isinstance(dom, dict):
                # Check for welcome messages, user info
                dom_text = str(dom).lower()
                if "welcome" in dom_text and "admin" in dom_text:
                    preconditions.append("User has Admin role")
                elif "welcome" in dom_text:
                    preconditions.append("User is logged in")
        
        # Check key elements for data dependencies
        if first_node.key_elements:
            for element in first_node.key_elements:
                element_lower = element.lower()
                if "cart" in element_lower:
                    preconditions.append("Cart contains items")
                elif "product" in element_lower:
                    preconditions.append("Products are available")
        
        if not preconditions:
            preconditions.append("Application is accessible")
        
        return preconditions
    
    def _group_consecutive_inputs(self, edges: List[ActionGraphEdge]) -> List[ActionGraphEdge]:
        """
        Group consecutive input/type events on the same field into a single edge.
        This prevents character-by-character input from creating multiple steps.
        Works across node transitions (e.g., when user types in same field but page state changes).
        
        Strategy:
        1. Try to match by field ID (most accurate)
        2. If field ID unclear, group consecutive inputs on same page (fallback)
        3. Group until a different action type or clear field change
        """
        if not edges:
            return edges
        
        grouped = []
        i = 0
        
        while i < len(edges):
            edge = edges[i]
            action_type = edge.action.lower()
            
            # If this is an input/type action, check if next edges are also inputs on same field
            if action_type in ["input", "type", "fill_input"]:
                # Get the selector/field identifier (normalize to handle variations)
                field_id = self._normalize_field_id(self._get_field_identifier(edge))
                from_node_id = edge.from_node_id
                
                # Collect consecutive inputs on the same field (even if nodes change)
                input_edges = [edge]
                j = i + 1
                
                while j < len(edges):
                    next_edge = edges[j]
                    next_action = next_edge.action.lower()
                    
                    # Stop if not an input action
                    if next_action not in ["input", "type", "fill_input"]:
                        break
                    
                    # Strategy 1: Try to match by field ID
                    next_field_id = self._normalize_field_id(self._get_field_identifier(next_edge))
                    
                    # If we have valid field IDs, use them for matching
                    if field_id and field_id != "edge_id_fallback" and next_field_id and next_field_id != "edge_id_fallback":
                        if next_field_id != field_id:
                            break
                    else:
                        # Strategy 2: If field IDs unclear, group consecutive inputs on same page
                        # This handles cases where descriptions don't have clear field IDs
                        # Group if same from_node (same page) or if descriptions suggest same field
                        if next_edge.from_node_id != from_node_id:
                            # Different page - check if descriptions suggest same field
                            current_desc = edge.description or ""
                            next_desc = next_edge.description or ""
                            
                            # Extract field hints from descriptions
                            current_field_hint = self._extract_field_hint_from_description(current_desc)
                            next_field_hint = self._extract_field_hint_from_description(next_desc)
                            
                            # If both have same field hint, continue grouping
                            if current_field_hint and next_field_hint and current_field_hint == next_field_hint:
                                pass  # Continue grouping
                            else:
                                # Different field or unclear - stop grouping
                                break
                        # If same page and field IDs unclear, continue grouping (likely same field)
                        # This is important for character-by-character typing on same page
                        # We'll group all consecutive inputs on the same page until a different action
                    
                    input_edges.append(next_edge)
                    j += 1
                
                # Merge into single edge with full value
                if len(input_edges) > 1:
                    merged_edge = self._merge_input_edges(input_edges, field_id)
                    grouped.append(merged_edge)
                    i = j  # Skip all merged edges
                else:
                    grouped.append(edge)
                    i += 1
            else:
                grouped.append(edge)
                i += 1
        
        logger.info(f"Grouped {len(edges)} edges into {len(grouped)} edges (removed {len(edges) - len(grouped)} duplicate inputs)")
        return grouped
    
    def _extract_field_hint_from_description(self, description: str) -> Optional[str]:
        """Extract field hint from description for grouping when field ID is unclear"""
        if not description:
            return None
        
        # Pattern: "FILL_INPUT: INPUT#user-name[user-name]" -> "user-name"
        # Pattern: "FILL_PASSWORD: INPUT#password[password]" -> "password"
        id_match = re.search(r'#([^\s\[\]]+)', description)
        if id_match:
            return id_match.group(1).lower()
        
        # Pattern: "[user-name]" or "[password]"
        bracket_match = re.search(r'\[([^\]]+)\]', description)
        if bracket_match:
            return bracket_match.group(1).lower()
        
        return None
    
    def _normalize_field_id(self, field_id: str) -> str:
        """Normalize field ID for comparison (handle variations like user-name vs user_name vs username)"""
        # Convert to lowercase and replace common separators
        normalized = field_id.lower().replace("-", "_").replace(" ", "_")
        # Remove common prefixes/suffixes
        normalized = re.sub(r'^(input|field|text|txt)_', '', normalized)
        normalized = re.sub(r'_(input|field|text|txt)$', '', normalized)
        return normalized
    
    def _get_field_identifier(self, edge: ActionGraphEdge) -> str:
        """Get a unique identifier for a form field (selector, name, id, etc.)"""
        # Priority: Extract ID from selector/description > selector > name > id > description
        
        # Method 1: Extract ID from selector (e.g., INPUT#user-name -> user-name)
        if edge.locators and edge.locators.get("primary"):
            selector = edge.locators["primary"]
            id_match = re.search(r'#([^\s\[\]]+)', selector)
            if id_match:
                return id_match.group(1)
            return selector
        
        if edge.locators and edge.locators.get("fallback"):
            selector = edge.locators["fallback"]
            id_match = re.search(r'#([^\s\[\]]+)', selector)
            if id_match:
                return id_match.group(1)
            return selector
        
        # Method 2: Extract ID from description (e.g., "FILL_INPUT: INPUT#user-name[user-name]" -> user-name)
        if edge.description:
            # Pattern: ACTION: ELEMENT#id[name] - prioritize #id over [name]
            id_match = re.search(r'#([^\s\[\]]+)', edge.description)
            if id_match:
                field_id = id_match.group(1)
                # Clean up common patterns
                field_id = field_id.split('[')[0]  # Remove [name] part if present
                return field_id
            # Pattern: [name] or [id] as fallback
            bracket_match = re.search(r'\[([^\]]+)\]', edge.description)
            if bracket_match:
                return bracket_match.group(1)
        
        # Return a special marker so we know field ID is unclear
        return "edge_id_fallback"
    
    def _merge_input_edges(self, input_edges: List[ActionGraphEdge], field_id: str) -> ActionGraphEdge:
        """
        Merge multiple input edges into a single edge with the full concatenated value.
        
        Handles two scenarios:
        1. Character-by-character typing: ["a", "b", "c"] -> "abc"
        2. Full value updates: ["abc", "def"] -> "def" (use latest)
        """
        # Use the last edge as base (has final state)
        base_edge = input_edges[-1]
        
        # Strategy: Collect all values and determine if they're characters or full strings
        all_values = []
        has_full_string = False
        full_string_value = None
        
        # First pass: collect all values
        for edge in input_edges:
            if edge.inputs and edge.inputs.get("value"):
                val = str(edge.inputs["value"]).strip()
                
                if not val:  # Skip empty values
                    continue
                
                # Check if this is a full string (length > 1)
                if len(val) > 1:
                    # Full string found - this is likely the final/cumulative value
                    full_string_value = val
                    has_full_string = True
                    # Don't break - continue to check all edges, but prefer longer strings
                    if full_string_value and len(val) > len(full_string_value):
                        full_string_value = val
                elif len(val) == 1:
                    # Single character - part of typing sequence
                    all_values.append(val)
        
        # Determine final value
        if has_full_string and full_string_value:
            # Use the full string (prefer longer one if multiple)
            final_value = full_string_value
        elif all_values:
            # Concatenate all single characters
            final_value = "".join(all_values)
            logger.debug(f"Concatenated {len(all_values)} single characters: '{final_value}'")
        else:
            # Fallback: try to get from last edge
            final_value = base_edge.inputs.get("value", "") if base_edge.inputs else ""
            if final_value:
                final_value = str(final_value).strip()
                if len(final_value) == 1:
                    # If last edge only has single char, try to concatenate all
                    all_chars = [str(e.inputs.get("value", "")) for e in input_edges if e.inputs and e.inputs.get("value")]
                    if all_chars:
                        final_value = "".join(all_chars)
                        logger.debug(f"Fallback: concatenated all values: '{final_value}'")
        
        # Ensure we have a value
        if not final_value:
            logger.warning(f"No value found after merging {len(input_edges)} input edges for field {field_id}")
        
        # Preserve the best description (one with field ID if available)
        best_description = base_edge.description
        for edge in input_edges:
            if edge.description and ("#" in edge.description or "[" in edge.description):
                best_description = edge.description
                break
        
        # Preserve the best locators
        best_locators = base_edge.locators
        for edge in input_edges:
            if edge.locators and edge.locators.get("primary"):
                best_locators = edge.locators
                break
        
        # Create merged edge with full value
        merged = ActionGraphEdge(
            from_node_id=base_edge.from_node_id,
            to_node_id=base_edge.to_node_id,
            action=base_edge.action,
            description=best_description,
            locators=best_locators,
            inputs={"value": final_value} if final_value else {},
            edge_id=base_edge.id
        )
        
        logger.info(f"Merged {len(input_edges)} input edges into one. Field: {field_id}, Value: '{final_value}' (length: {len(final_value) if final_value else 0})")
        
        return merged
    
    def _remove_duplicate_steps(self, edges: List[ActionGraphEdge]) -> List[ActionGraphEdge]:
        """Remove duplicate steps (same action, same element)"""
        seen = set()
        unique_edges = []
        
        for edge in edges:
            # Create a signature: action + field identifier
            action_type = edge.action.lower()
            field_id = self._get_field_identifier(edge)
            signature = f"{action_type}:{field_id}"
            
            if signature not in seen:
                seen.add(signature)
                unique_edges.append(edge)
            else:
                logger.debug(f"Removing duplicate step: {action_type} on {field_id}")
        
        logger.info(f"Removed {len(edges) - len(unique_edges)} duplicate steps")
        return unique_edges
    
    def _filter_flowstral_events(self, edges: List[ActionGraphEdge]) -> List[ActionGraphEdge]:
        """Filter out Flowstral internal events that shouldn't be in test cases"""
        filtered = []
        flowstral_events = {"page_load", "wcag_scan", "change", "session_end", "session_start", "scroll"}
        
        for edge in edges:
            action = edge.action.lower()
            # Check action type - filter out scroll events
            if action in flowstral_events:
                logger.debug(f"Filtering out Flowstral internal event: {action}")
                continue
            
            # Check description for Flowstral patterns including scroll
            if edge.description:
                desc_lower = edge.description.lower()
                if any(pattern in desc_lower for pattern in ["page_load", "wcag_scan", "session_end", "session_start", "user scroll", "scroll"]):
                    logger.debug(f"Filtering out Flowstral event from description: {edge.description[:50]}")
                    continue
            
            # Filter out edges with generic element names that are clearly scroll events
            if edge.description and ("scroll" in edge.description.lower() or "user scroll" in edge.description.lower()):
                logger.debug(f"Filtering out scroll event: {edge.description[:50]}")
                continue
            
            filtered.append(edge)
        
        logger.info(f"Filtered {len(edges)} edges to {len(filtered)} (removed {len(edges) - len(filtered)} Flowstral internal events)")
        return filtered
    
    def _generate_test_steps(
        self,
        edges: List[ActionGraphEdge],
        nodes: List[ActionGraphNode],
        action_graph: ActionGraph,
        dom_snapshots: Optional[Dict[str, Any]],
        persona: Optional[str] = None,
        screenshot_data: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate test steps with Gherkin mapping.
        
        DOM Action Type → Gherkin Keyword:
        - Navigation (URL change) → Given user is on [page]
        - Click on button/link → When user clicks [element name]
        - Input text → And user enters "[text]" in [field name]
        - Select dropdown → And user selects "[option]" from [dropdown]
        - Assertion (DOM check) → Then user should see [element/text]
        
        Note: Uses "user" by default, or persona if provided in action graph metadata.
        """
        # Step 0: Filter out Flowstral internal events
        edges = self._filter_flowstral_events(edges)
        
        # Step 1: Group consecutive inputs on same field (even across node transitions)
        edges = self._group_consecutive_inputs(edges)
        
        # Step 2: Remove duplicate steps (same action, same element)
        edges = self._remove_duplicate_steps(edges)
        
        steps = []
        
        logger.debug(f"_generate_test_steps called with {len(edges)} edges (after grouping)")
        
        for i, edge in enumerate(edges):
            logger.debug(f"Processing edge {i+1}/{len(edges)}: {edge.from_node_id}->{edge.to_node_id}, action={edge.action}")
            step_number = i + 1
            
            # Get source and target nodes
            from_node = action_graph.node_map.get(edge.from_node_id)
            to_node = action_graph.node_map.get(edge.to_node_id)
            
            # Map action to Gherkin
            action_type = edge.action.lower()
            gherkin_keyword = self.gherkin_mapping.get(action_type, "And")
            
            # Get screenshot data for this element if available
            element_screenshot = None
            if screenshot_data and to_node:
                element_screenshot = screenshot_data.get(to_node.id) or screenshot_data.get(to_node.dom_snapshot_id)
            
            # Generate element name (smart naming) - use to_node for target_text
            element_name = self._generate_element_name(edge, to_node, dom_snapshots, {to_node.id: element_screenshot} if element_screenshot else None)
            # Final cleanup - ensure no action words in element name (aggressive cleaning)
            # Remove "I click", "I enter", "click", "enter", etc. from anywhere in the string
            element_name = re.sub(r'\b(i\s+)?(user\s+)?(clicks?|enters?|selects?|submits?|navigates?)\s+', '', element_name, flags=re.I)
            element_name = re.sub(r'^(i\s+)?(user\s+)?(clicks?|enters?|selects?|submits?|navigates?)\s+', '', element_name, flags=re.I)
            element_name = element_name.strip()
            # Final check - if element name starts with "I click" or "I enter", remove it
            if element_name.lower().startswith(('i click', 'i enter', 'click', 'enter')):
                element_name = re.sub(r'^(i\s+)?(click|enter|select|submit|navigate)\s+', '', element_name, flags=re.I).strip()
            if not element_name:
                # Fallback to selector or action
                if edge.locators and edge.locators.get("primary"):
                    selector = edge.locators["primary"]
                    if "data-test" in selector:
                        match = re.search(r"data-test=['\"]([^'\"]+)['\"]", selector)
                        if match:
                            element_name = match.group(1).replace("-", " ").title()
                if not element_name:
                    element_name = edge.action.replace("_", " ").title()
            
            logger.debug(f"Element name for edge {edge.id}: '{element_name}' (from description: '{edge.description}')")
            
            # Generate action description (use persona if available, otherwise defaults to "user")
            action_desc = self._generate_action_description(edge, element_name, gherkin_keyword, persona=persona)
            logger.debug(f"Action description: '{action_desc}'")
            
            # Extract test data
            test_data = self._extract_test_data(edge)
            
            # Extract clean page name (remove Flowstral internal descriptions)
            # Get screenshot data for this node if available
            node_screenshot = None
            if screenshot_data and from_node:
                node_screenshot = screenshot_data.get(from_node.id) or screenshot_data.get(from_node.dom_snapshot_id)
            
            page_name = None
            if from_node:
                page_name = self._extract_clean_page_name(from_node)
            
            # CRITICAL FIX: Ensure action description uses element name, not selector
            # Check for bad formats like "click: [selector]" or "fill: [selector]"
            action_type = edge.action.lower()
            actor = persona if persona else "user"
            
            # Pattern 1: Check if action_desc is in bad format "click: [selector]" or "fill: [selector]"
            bad_pattern = re.match(rf'^(click|fill|type|select|navigate):\s*(.+)$', action_desc, re.I)
            if bad_pattern:
                # This is a bad format - rebuild it properly
                detected_action = bad_pattern.group(1).lower()
                detected_selector = bad_pattern.group(2).strip()
                
                # If element_name is still a selector or empty, try to extract from selector
                if not element_name or element_name == detected_selector or element_name.startswith('.') or element_name.startswith('#'):
                    # Try to extract element name from selector
                    if detected_selector.startswith('#'):
                        # ID selector - extract and convert
                        element_id = detected_selector[1:].split('.')[0].split('[')[0]
                        element_name = element_id.replace("_", " ").replace("-", " ")
                        element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)  # camelCase
                        element_name = element_name.title()
                        # Apply mappings
                        name_lower = element_name.lower()
                        if "vehicle" in name_lower:
                            if "year" in name_lower:
                                element_name = "Vehicle Year"
                            elif "make" in name_lower:
                                element_name = "Vehicle Make"
                            elif "model" in name_lower:
                                element_name = "Vehicle Model"
                            elif "sub" in name_lower and "model" in name_lower:
                                element_name = "Vehicle Submodel"
                        elif "tire" in name_lower and "size" in name_lower:
                            element_name = "Tire Size"
                        elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                            element_name = "Smart Submodel"
                
                # Rebuild action description with proper element name
                if detected_action == "click":
                    action_desc = f"{gherkin_keyword} {actor} clicks {element_name}"
                elif detected_action in ["fill", "type", "input"]:
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} enters "{test_data}" in {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} enters text in {element_name}"
                elif detected_action == "select":
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} selects "{test_data}" from {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} selects option from {element_name}"
            
            # Pattern 2: Check if action_desc contains raw selector (even if not in "action: selector" format)
            elif edge.locators and edge.locators.get("primary"):
                selector = edge.locators["primary"]
                # Check if action_desc contains the raw selector
                if selector in action_desc or f": {selector}" in action_desc:
                    # Rebuild action description with proper element name
                    if action_type == "click":
                        action_desc = f"{gherkin_keyword} {actor} clicks {element_name}"
                    elif action_type in ["input", "type", "fill_input"]:
                        if test_data:
                            action_desc = f'{gherkin_keyword} {actor} enters "{test_data}" in {element_name}'
                        else:
                            action_desc = f"{gherkin_keyword} {actor} enters text in {element_name}"
                    elif action_type == "select":
                        if test_data:
                            action_desc = f'{gherkin_keyword} {actor} selects "{test_data}" from {element_name}'
                        else:
                            action_desc = f"{gherkin_keyword} {actor} selects option from {element_name}"
            
            # Ensure action description uses element name, not selector
            # If action_desc still contains a selector pattern, replace it with element name
            if edge.locators and edge.locators.get("primary"):
                selector = edge.locators["primary"]
                # Check if action_desc contains the raw selector (bad format like "click: .selector")
                if selector in action_desc or f": {selector}" in action_desc or action_desc.startswith(f"{edge.action.lower()}: "):
                    # Rebuild action description with proper element name
                    action_type = edge.action.lower()
                    actor = persona if persona else "user"
                    if action_type == "click":
                        action_desc = f"{gherkin_keyword} {actor} clicks {element_name}"
                    elif action_type in ["input", "type", "fill_input"]:
                        if test_data:
                            action_desc = f'{gherkin_keyword} {actor} enters "{test_data}" in {element_name}'
                        else:
                            action_desc = f"{gherkin_keyword} {actor} enters text in {element_name}"
                    elif action_type == "select":
                        if test_data:
                            action_desc = f'{gherkin_keyword} {actor} selects "{test_data}" from {element_name}'
                        else:
                            action_desc = f"{gherkin_keyword} {actor} selects option from {element_name}"
            
            # FINAL SAFETY CHECK: If action_desc is still in bad format "click: [selector]", fix it
            # Also check if element_name is a selector (starts with . or #) and action_desc uses it
            if (element_name and (element_name.startswith('.') or element_name.startswith('#')) and 
                (element_name in action_desc or f": {element_name}" in action_desc)):
                # Element name is still a selector - extract semantic name from it
                if element_name.startswith('#'):
                    element_id = element_name[1:].split('.')[0].split('[')[0]
                    element_name = element_id.replace("_", " ").replace("-", " ")
                    element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)
                    element_name = element_name.title()
                    # Apply mappings
                    name_lower = element_name.lower()
                    if "vehicle" in name_lower:
                        if "year" in name_lower:
                            element_name = "Vehicle Year"
                        elif "make" in name_lower:
                            element_name = "Vehicle Make"
                        elif "model" in name_lower:
                            element_name = "Vehicle Model"
                        elif "sub" in name_lower and "model" in name_lower:
                            element_name = "Vehicle Submodel"
                    elif "tire" in name_lower and "size" in name_lower:
                        element_name = "Tire Size"
                    elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                        element_name = "Smart Submodel"
                    elif "continue" in name_lower and "checkout" in name_lower:
                        element_name = "Continue to Checkout Button"
                    elif "continue" in name_lower:
                        element_name = "Continue Button"
                elif element_name.startswith('.'):
                    # CSS class selector - try to extract meaningful class
                    classes = re.findall(r'\.([a-zA-Z0-9_-]+)', element_name)
                    meaningful_classes = [c for c in classes if len(c) > 3 and c.lower() not in ['ld', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'pa', 'ph', 'pv', 'ma', 'mh', 'mv', 'tc', 'tl', 'tr', 'db', 'dn', 'flex', 'items', 'justify', 'center', 'w', 'h', 'bg', 'f', 'sans', 'serif', 'bn', 'pointer', 'shadow', 'nowrap', 'underline', 'redesigned', 'cart', 'total']]
                    if meaningful_classes:
                        best_class = max(meaningful_classes, key=len)
                        name = best_class.replace("_", " ").replace("-", " ")
                        name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
                        element_name = name.title()
                    else:
                        # Generic class - infer from action
                        if action_type == "click":
                            element_name = "Button"
                        elif action_type in ["input", "type", "fill_input"]:
                            element_name = "Input Field"
                        else:
                            element_name = "Element"
                
                # Rebuild action description with proper element name
                actor = persona if persona else "user"
                if action_type == "click":
                    action_desc = f"{gherkin_keyword} {actor} clicks {element_name}"
                elif action_type in ["fill", "type", "input"]:
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} enters "{test_data}" in {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} enters text in {element_name}"
                elif action_type == "select":
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} selects "{test_data}" from {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} selects option from {element_name}"
                
                logger.info(f"Fixed action description from selector: '{action_desc}' with element_name: '{element_name}'")
            
            bad_format_match = re.match(r'^(click|fill|type|select|navigate):\s*(.+)$', action_desc, re.I)
            if bad_format_match:
                logger.warning(f"FINAL FIX: Action description still in bad format: '{action_desc}'. Rebuilding.")
                detected_action = bad_format_match.group(1).lower()
                detected_selector = bad_format_match.group(2).strip()
                
                # Extract element name from selector if needed
                if not element_name or element_name == detected_selector or element_name.startswith('.') or element_name.startswith('#'):
                    if detected_selector.startswith('#'):
                        element_id = detected_selector[1:].split('.')[0].split('[')[0]
                        element_name = element_id.replace("_", " ").replace("-", " ")
                        element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)
                        element_name = element_name.title()
                        # Apply mappings
                        name_lower = element_name.lower()
                        if "vehicle" in name_lower:
                            if "year" in name_lower:
                                element_name = "Vehicle Year"
                            elif "make" in name_lower:
                                element_name = "Vehicle Make"
                            elif "model" in name_lower:
                                element_name = "Vehicle Model"
                            elif "sub" in name_lower and "model" in name_lower:
                                element_name = "Vehicle Submodel"
                        elif "tire" in name_lower and "size" in name_lower:
                            element_name = "Tire Size"
                        elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                            element_name = "Smart Submodel"
                        elif "continue" in name_lower and "checkout" in name_lower:
                            element_name = "Continue to Checkout Button"
                        elif "continue" in name_lower:
                            element_name = "Continue Button"
                
                # Rebuild action description
                actor = persona if persona else "user"
                if detected_action == "click":
                    action_desc = f"{gherkin_keyword} {actor} clicks {element_name}"
                elif detected_action in ["fill", "type", "input"]:
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} enters "{test_data}" in {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} enters text in {element_name}"
                elif detected_action == "select":
                    if test_data:
                        action_desc = f'{gherkin_keyword} {actor} selects "{test_data}" from {element_name}'
                    else:
                        action_desc = f"{gherkin_keyword} {actor} selects option from {element_name}"
                
                logger.info(f"Fixed action description: '{action_desc}' with element_name: '{element_name}'")
            
            # Generate expected result using enhanced generator
            expected_result = self.expected_results_generator.generate_expected_result(
                edge=edge,
                from_node=from_node,
                to_node=to_node,
                element_name=element_name,
                action_description=action_desc,
                action_graph=action_graph
            )
            
            # Enhance selector using selector strategy engine
            enhanced_selector = None
            selector_strategy = None
            if edge.locators:
                # Try to enhance selector with better strategy
                element_data = {
                    "tag": edge.locators.get("tag", "div"),
                    "id": edge.locators.get("id"),
                    "class": edge.locators.get("class"),
                    "data_testid": edge.locators.get("data-testid"),
                    "aria_label": edge.locators.get("aria-label"),
                    "name": edge.locators.get("name"),
                    "role": edge.locators.get("role")
                }
                try:
                    selector_result = self.selector_engine.get_selector_with_fallback(element_data)
                    enhanced_selector = selector_result.get("primary")
                    selector_strategy = selector_result.get("strategy")
                except Exception as e:
                    logger.debug(f"Selector enhancement failed: {e}, using original")
                    enhanced_selector = edge.locators.get("primary")
            else:
                enhanced_selector = edge.locators.get("primary") if edge.locators else None
            
            step = {
                "step_number": step_number,
                "action": action_desc,
                "gherkin_keyword": gherkin_keyword,
                "element_name": element_name,
                "selector": enhanced_selector,
                "selector_strategy": selector_strategy,
                "test_data": test_data,
                "page": page_name,
                "expected_result": expected_result
            }
            
            steps.append(step)
        
        return steps
    
    def _identify_element_type(self, edge: ActionGraphEdge, selector: Optional[str] = None) -> str:
        """Identify element type: form_field, button, link, label, text, etc."""
        action_type = edge.action.lower()
        selector_str = selector or (edge.locators.get("primary") if edge.locators else "")
        selector_lower = selector_str.lower() if selector_str else ""
        
        # Determine by action type
        if action_type in ["input", "type", "fill_input"]:
            return "form_field"
        elif action_type == "click":
            # Check selector to determine if button, link, or other
            if "button" in selector_lower or "btn" in selector_lower:
                return "button"
            elif "a[" in selector_lower or "link" in selector_lower:
                return "link"
            else:
                return "button"  # Default for clicks
        elif action_type == "select":
            return "dropdown"
        elif action_type == "submit":
            return "button"
        else:
            return "element"
    
    def _extract_label_for_field(self, edge: ActionGraphEdge, selector: Optional[str] = None) -> Optional[str]:
        """Extract label text for a form field using various methods"""
        selector_str = selector or (edge.locators.get("primary") if edge.locators else "")
        if not selector_str:
            return None
        
        # Method 1: Extract id from selector and look for label[for=id]
        id_match = re.search(r'id=["\']([^"\']+)["\']', selector_str)
        if id_match:
            field_id = id_match.group(1)
            # In real DOM, we'd look for label[for=field_id], but here we can infer from common patterns
            # Common patterns: user-name -> "Username", password -> "Password"
            if "user" in field_id.lower() or "username" in field_id.lower() or "email" in field_id.lower():
                return "Username"
            elif "pass" in field_id.lower():
                return "Password"
            elif "name" in field_id.lower() and "user" not in field_id.lower():
                return "Name"
            elif "email" in field_id.lower():
                return "Email"
        
        # Method 2: Extract from placeholder
        placeholder_match = re.search(r'placeholder=["\']([^"\']+)["\']', selector_str)
        if placeholder_match:
            placeholder = placeholder_match.group(1)
            # Clean placeholder (remove "Enter", "Type", etc.)
            placeholder = re.sub(r'^(enter|type|input)\s+', '', placeholder, flags=re.I)
            return placeholder.strip().title()
        
        # Method 3: Extract from name attribute
        name_match = re.search(r'name=["\']([^"\']+)["\']', selector_str)
        if name_match:
            name_value = name_match.group(1)
            # Convert snake_case or kebab-case to readable
            name_value = name_value.replace("_", " ").replace("-", " ").title()
            return name_value
        
        return None
    
    def _generate_element_name(
        self,
        edge: ActionGraphEdge,
        node: Optional[ActionGraphNode],
        dom_snapshots: Optional[Dict[str, Any]],
        screenshot_data: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate readable element name using accessibility attributes and labels.
        
        Priority:
        1. node.target_text (button text, element text) - MOST RELIABLE
        2. aria-label
        3. Associated label (for form fields)
        4. title
        5. placeholder
        6. id (if semantic)
        7. nearby label or parent context
        """
        action_type = edge.action.lower()
        element_type = self._identify_element_type(edge)
        
        # PRIORITY 1: Use node.target_text if available (button text, element text)
        if node and node.target_text:
            text = str(node.target_text).strip()
            if text and len(text) < 100:  # Reasonable length
                # FILTER OUT PRICES AND CURRENCY - these are not clickable elements
                if re.match(r'^\$?[\d,]+\.?\d*$', text.strip()):
                    # This is a price - infer element name from selector instead
                    logger.debug(f"Filtered out price '{text}' from target_text, using selector-based inference")
                    # Fall through to selector-based naming
                else:
                    # Clean the text
                    cleaned = self._clean_element_name(text)
                    # Filter out generic/meaningless text
                    if cleaned and cleaned.lower() not in ["click", "input", "scroll", "button", "link", "user scroll", "user"]:
                        # Check if it's truncated (ends with single letter that might be cut off)
                        if len(cleaned) > 50 and cleaned[-1].isupper() and cleaned[-2] == " ":
                            # Might be truncated, but use it anyway
                            pass
                        logger.debug(f"Using node.target_text for element name: '{cleaned}'")
                        return cleaned
        
        # For form fields, try to get label first
        if element_type == "form_field":
            label = self._extract_label_for_field(edge)
            if label:
                return label
        
        # Try locators first
        if edge.locators:
            selector_str = str(edge.locators.get("primary", ""))
            
            # Check for aria-label
            aria_match = re.search(r'aria-label=["\']([^"\']+)["\']', selector_str, re.I)
            if aria_match:
                return self._clean_element_name(aria_match.group(1))
            
            # Check for title
            title_match = re.search(r'title=["\']([^"\']+)["\']', selector_str, re.I)
            if title_match:
                return self._clean_element_name(title_match.group(1))
            
            # Check for placeholder (for form fields)
            if element_type == "form_field":
                placeholder_match = re.search(r'placeholder=["\']([^"\']+)["\']', selector_str, re.I)
                if placeholder_match:
                    placeholder = placeholder_match.group(1)
                    # Clean placeholder
                    placeholder = re.sub(r'^(enter|type|input)\s+', '', placeholder, flags=re.I)
                    return self._clean_element_name(placeholder.strip())
            
            # Check for id (if semantic)
            id_match = re.search(r'id=["\']([^"\']+)["\']', selector_str, re.I)
            if id_match:
                id_value = id_match.group(1)
                if self._is_semantic_id(id_value):
                    # Convert to readable name
                    name = id_value.replace("_", " ").replace("-", " ").title()
                    return self._clean_element_name(name)
        
        # Try DOM snapshot with Layer 1: HTML Constraint Extractor
        if node and node.dom_snapshot_id and dom_snapshots:
            dom = dom_snapshots.get(node.dom_snapshot_id, {})
            if isinstance(dom, dict):
                # Layer 1: Extract ARIA attributes using constraint extractor
                html_content = dom.get("html_structure") or dom.get("html") or ""
                if html_content and edge.locators:
                    selector = edge.locators.get("primary", "")
                    if selector:
                        aria_attrs = self.constraint_extractor.extract_aria_attributes(html_content, selector)
                        if aria_attrs.get("aria_label"):
                            return self._clean_element_name(aria_attrs["aria_label"])
                        if aria_attrs.get("aria_labelledby"):
                            # Try to find the element referenced by aria-labelledby
                            labelledby_id = aria_attrs["aria_labelledby"]
                            # Extract label text from HTML
                            label_pattern = rf'<[^>]+\s+id=["\']{re.escape(labelledby_id)}["\'][^>]*>(.*?)</[^>]+>'
                            label_match = re.search(label_pattern, html_content, re.DOTALL | re.IGNORECASE)
                            if label_match:
                                label_text = re.sub(r'<[^>]+>', '', label_match.group(1)).strip()
                                if label_text:
                                    return self._clean_element_name(label_text)
                
                # Fallback: Look for accessibility attributes directly in DOM
                for attr in ["aria-label", "title", "placeholder", "name"]:
                    if attr in dom:
                        value = dom[attr]
                        if value and isinstance(value, str) and len(value) < 50:
                            cleaned = self._clean_element_name(value)
                            if attr == "placeholder":
                                # Clean placeholder text
                                cleaned = re.sub(r'^(enter|type|input)\s+', '', cleaned, flags=re.I).strip()
                            return cleaned
        
        # Fallback to edge description - clean it properly
        if edge.description:
            # Extract meaningful part
            desc = edge.description
            # Remove ALL action words and prefixes (including "I click", "user clicks", etc.)
            desc = re.sub(r'^(i\s+)?(user\s+)?(clicks?|enters?|selects?|submits?|navigates?)\s+', '', desc, flags=re.I)
            desc = re.sub(r'^(to|on|in)\s+', '', desc, flags=re.I)
            
            # PRIORITY 1: Extract element name from description patterns like "FILL_INPUT: INPUT#user-name[user-name]"
            # Pattern: ACTION: ELEMENT#id[name]
            pattern_match = re.search(r':\s*[A-Z]+\#([^\s\[\]]+)', desc)
            if pattern_match:
                element_id = pattern_match.group(1)
                # Split on [ if present (e.g., "user-name[user-name]")
                element_id = element_id.split('[')[0]
                # Convert to readable name
                name = element_id.replace("_", " ").replace("-", " ").title()
                # Common field name mappings
                if "user" in name.lower() and ("name" in name.lower() or "id" in name.lower()):
                    return "Username"
                elif "pass" in name.lower():
                    return "Password"
                elif "first" in name.lower() and "name" in name.lower():
                    return "First Name"
                elif "last" in name.lower() and "name" in name.lower():
                    return "Last Name"
                elif "postal" in name.lower() or "zip" in name.lower():
                    return "Postal Code"
                elif "email" in name.lower():
                    return "Email"
                elif "phone" in name.lower():
                    return "Phone"
                elif "address" in name.lower():
                    return "Address"
                return self._clean_element_name(name)
            
            # PRIORITY 2: Button text in patterns like "BUTTON#add-to-cart-sauce-labs-backpack - Add to cart"
            button_match = re.search(r'BUTTON[^:]*:\s*[^#]*#([^-]+)\s*-\s*([^-]+)', desc)
            if button_match:
                button_text = button_match.group(2).strip()
                if button_text:
                    return self._clean_element_name(button_text)
            
            # PRIORITY 3: Action-based patterns
            # Pattern: "LOGIN: INPUT#login-button" -> "Login Button"
            if "LOGIN:" in desc or "login:" in desc.lower():
                login_match = re.search(r'LOGIN:\s*[A-Z]+#([^\s\[\]]+)', desc, re.I)
                if login_match:
                    element_id = login_match.group(1)
                    name = element_id.replace("_", " ").replace("-", " ").title()
                    if "login" in name.lower():
                        return "Login Button"
                    return self._clean_element_name(name)
                return "Login Button"
            
            # Pattern: "ADD_TO_CART: BUTTON#add-to-cart-sauce-labs-backpack" -> "Add to Cart"
            if "ADD_TO_CART" in desc or "add_to_cart" in desc.lower():
                return "Add to Cart Button"
            
            # Pattern: "CHECKOUT: BUTTON#checkout" -> "Checkout Button"
            if "CHECKOUT:" in desc or "checkout:" in desc.lower():
                return "Checkout Button"
            
            # Pattern: "CLICK: SPAN - 3" -> "Cart Icon" or "Item Count"
            if "CLICK:" in desc and "SPAN" in desc:
                return "Cart Icon"
            
            # Keep "button", "field", etc. - they're useful context
            if desc and len(desc) < 50:
                cleaned = self._clean_element_name(desc)
                # Capitalize first letter
                if cleaned:
                    cleaned = cleaned[0].upper() + cleaned[1:] if len(cleaned) > 1 else cleaned.upper()
                return cleaned
        
        # Final fallback - use selector if available
        if edge.locators and edge.locators.get("primary"):
            selector = edge.locators["primary"]
            # Extract meaningful part from selector
            if "data-test" in selector:
                match = re.search(r"data-test=['\"]([^'\"]+)['\"]", selector)
                if match:
                    name = match.group(1).replace("-", " ").title()
                    # Remove any action words that might have gotten in
                    name = re.sub(r'^(click|enter|select|submit|navigate)\s+', '', name, flags=re.I)
                    return name
            
            # Extract from ID selector (e.g., #vehicleYear -> Vehicle Year, #user-name -> Username)
            id_match = re.search(r'#([a-zA-Z0-9_-]+)', selector)
            if id_match:
                element_id = id_match.group(1)
                # Convert camelCase to Title Case (e.g., "vehicleYear" -> "Vehicle Year")
                name = element_id.replace("_", " ").replace("-", " ")
                name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)  # Insert space before capital letters
                name = name.title()
                name_lower = name.lower()
                
                # Apply common field name mappings
                if "user" in name_lower and ("name" in name_lower or "id" in name_lower or "login" in name_lower):
                    return "Username"
                elif "pass" in name_lower:
                    return "Password"
                elif "first" in name_lower and "name" in name_lower:
                    return "First Name"
                elif "last" in name_lower and "name" in name_lower:
                    return "Last Name"
                elif "postal" in name_lower or "zip" in name_lower:
                    return "Postal Code"
                elif "email" in name_lower:
                    return "Email"
                elif "phone" in name_lower:
                    return "Phone"
                elif "vehicle" in name_lower:
                    if "year" in name_lower:
                        return "Vehicle Year"
                    elif "make" in name_lower:
                        return "Vehicle Make"
                    elif "model" in name_lower:
                        return "Vehicle Model"
                    elif "sub" in name_lower and "model" in name_lower:
                        return "Vehicle Submodel"
                elif "tire" in name_lower and "size" in name_lower:
                    return "Tire Size"
                elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                    return "Smart Submodel"
                elif "login" in name_lower and "button" in name_lower:
                    return "Login Button"
                elif "add" in name_lower and "cart" in name_lower:
                    return "Add to Cart Button"
                elif "checkout" in name_lower:
                    return "Checkout Button"
                elif "continue" in name_lower:
                    return "Continue Button"
                # If it's a semantic ID (not auto-generated), use it
                if self._is_semantic_id(element_id):
                    return self._clean_element_name(name)
                # Even if not semantic, if it looks meaningful, use it
                if len(element_id) > 3 and not re.match(r'^[a-z]+$', element_id):  # Not just lowercase letters
                    return self._clean_element_name(name)
            
            # Handle CSS class selectors (e.g., .ld.ld-ChevronDown.pl2) - try to extract meaningful parts
            class_match = re.search(r'\.([a-zA-Z0-9_-]+)', selector)
            if class_match:
                # Try to find the most meaningful class name
                classes = re.findall(r'\.([a-zA-Z0-9_-]+)', selector)
                # Filter out generic/utility classes (ld, pl2, mt1, etc.)
                meaningful_classes = [c for c in classes if len(c) > 3 and c.lower() not in ['ld', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'pa', 'ph', 'pv', 'ma', 'mh', 'mv', 'tc', 'tl', 'tr', 'db', 'dn', 'flex', 'items', 'justify', 'center', 'w', 'h', 'bg', 'f', 'sans', 'serif', 'bn', 'pointer', 'shadow', 'nowrap', 'underline']]
                
                # SPECIAL HANDLING: Cart-related selectors
                if any("cart" in c.lower() or "total" in c.lower() for c in classes):
                    if "cart-total" in selector.lower() or "redesigned-cart-total" in selector.lower():
                        return "Cart Button"  # Cart total area is clickable, treat as cart button
                    elif "cart" in selector.lower():
                        return "Cart Button"
                
                if meaningful_classes:
                    # Use the longest/most meaningful class
                    best_class = max(meaningful_classes, key=len)
                    # Convert to readable name
                    name = best_class.replace("_", " ").replace("-", " ")
                    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)  # camelCase
                    name = name.title()
                    
                    # Apply common mappings
                    name_lower = name.lower()
                    if "chevron" in name_lower or "dropdown" in name_lower:
                        return "Dropdown Arrow"
                    elif "plus" in name_lower or "add" in name_lower:
                        return "Add Button"
                    elif "minus" in name_lower or "remove" in name_lower:
                        return "Remove Button"
                    elif "checkout" in name_lower:
                        return "Checkout Button"
                    elif "continue" in name_lower:
                        return "Continue Button"
                    elif "cart" in name_lower:
                        return "Cart Button"
                    elif "subcategory" in name_lower or "category" in name_lower:
                        return "Category Link"
                    else:
                        return self._clean_element_name(name)
                else:
                    # All classes are generic - infer from action type and context
                    if action_type == "click":
                        # Check selector for cart/total patterns
                        if "cart" in selector.lower() or "total" in selector.lower():
                            return "Cart Button"
                        if to_node and to_node.target_text:
                            text = str(to_node.target_text).strip()
                            # Filter out prices
                            if not re.match(r'^\$?[\d,]+\.?\d*$', text):
                                return text[:30]
                        return "Button"
                    elif action_type in ["input", "type", "fill_input"]:
                        return "Input Field"
                    elif action_type == "select":
                        return "Dropdown"
        
        # Try to extract from node.target_selector if available
        if node and node.target_selector:
            selector = node.target_selector
            id_match = re.search(r'#([a-zA-Z0-9_-]+)', selector)
            if id_match:
                element_id = id_match.group(1)
                name = element_id.replace("_", " ").replace("-", " ").title()
                # Apply mappings
                name_lower = name.lower()
                if "user" in name_lower and ("name" in name_lower or "id" in name_lower):
                    return "Username"
                elif "pass" in name_lower:
                    return "Password"
                elif self._is_semantic_id(element_id):
                    return self._clean_element_name(name)
        
        # OCR FALLBACK: Use screenshot OCR only when all DOM-based methods fail
        # This is the LAST RESORT before using generic action types
        if screenshot_data and node and self.screenshot_analyzer and self.screenshot_analyzer.ocr_available:
            try:
                # Get screenshot for this node
                element_screenshot = screenshot_data.get(node.id) or screenshot_data.get(node.dom_snapshot_id)
                if element_screenshot:
                    logger.debug(f"Attempting OCR fallback for element name from screenshot for node {node.id}")
                    ocr_result = self.screenshot_analyzer.extract_text_from_screenshot(element_screenshot)
                    
                    if ocr_result and ocr_result.get("text") and ocr_result.get("confidence", 0) > 0.5:
                        ocr_text = ocr_result["text"].strip()
                        
                        # Try to find element-specific text in OCR result
                        # Strategy 1: Look for text that matches the edge description or selector
                        if edge.description:
                            desc_keywords = re.findall(r'\b\w+\b', edge.description.lower())[:3]  # Get first 3 keywords
                            for line in ocr_text.split('\n'):
                                line_lower = line.lower().strip()
                                # Check if line contains any of the keywords and is short (likely a button/label)
                                if any(kw in line_lower for kw in desc_keywords) and len(line) < 50:
                                    cleaned = self._clean_element_name(line)
                                    if cleaned and cleaned.lower() not in ["click", "input", "scroll", "button", "link"]:
                                        logger.debug(f"OCR found element name: '{cleaned}' (confidence: {ocr_result.get('confidence', 0):.2f})")
                                        return cleaned
                        
                        # Strategy 2: For buttons, look for short lines (likely button text)
                        if action_type == "click":
                            for line in ocr_text.split('\n'):
                                line = line.strip()
                                # Button text is usually short (2-30 chars) and on its own line
                                if 2 <= len(line) <= 30 and line[0].isupper():
                                    cleaned = self._clean_element_name(line)
                                    if cleaned and cleaned.lower() not in ["click", "input", "scroll", "button", "link", "add", "remove"]:
                                        logger.debug(f"OCR found button text: '{cleaned}' (confidence: {ocr_result.get('confidence', 0):.2f})")
                                        return cleaned
                        
                        # Strategy 3: For form fields, look for label patterns
                        if element_type == "form_field":
                            # Look for lines that might be labels (often end with colon or are short)
                            for line in ocr_text.split('\n'):
                                line = line.strip().rstrip(':')
                                if 3 <= len(line) <= 25:
                                    cleaned = self._clean_element_name(line)
                                    if cleaned:
                                        logger.debug(f"OCR found form label: '{cleaned}' (confidence: {ocr_result.get('confidence', 0):.2f})")
                                        return cleaned
                        
                        # Strategy 4: Use first meaningful line as last resort
                        for line in ocr_text.split('\n'):
                            line = line.strip()
                            if 3 <= len(line) <= 40:
                                cleaned = self._clean_element_name(line)
                                if cleaned and cleaned.lower() not in ["click", "input", "scroll", "button", "link", "page", "user"]:
                                    logger.debug(f"OCR found text: '{cleaned}' (confidence: {ocr_result.get('confidence', 0):.2f})")
                                    return cleaned
            except Exception as e:
                logger.debug(f"OCR fallback failed for node {node.id}: {e}")
                # Continue to next fallback
        
        # Last resort - use action type but make it more descriptive
        action_type = edge.action.replace("_", " ").title()
        # Don't return generic "Click", "Input", "Scroll" - try to infer from context
        if action_type in ["Click", "Input", "Scroll"] and node:
            # Try to use node title or description
            if node.title and node.title != "Flowstral session started":
                return node.title[:50]
            elif node.action_description:
                # Extract from action description
                desc = node.action_description
                # Try to find element name in description
                if ":" in desc:
                    parts = desc.split(":")
                    if len(parts) > 1:
                        element_part = parts[-1].strip()
                        # Remove tags like INPUT, BUTTON
                        element_part = re.sub(r'\b(INPUT|BUTTON|DIV|SPAN|A)\b', '', element_part, flags=re.I)
                        element_part = element_part.strip()
                        if element_part:
                            return self._clean_element_name(element_part[:50])
        
        return action_type  # Final fallback
    
    def _clean_element_name(self, name: str) -> str:
        """Clean element name for readability"""
        # Remove special chars, normalize
        name = re.sub(r'[^\w\s-]', '', name)
        name = re.sub(r'\s+', ' ', name).strip()
        return name[:50]  # Limit length
    
    def _is_meaningless_pattern(self, s: str) -> bool:
        """Check if string looks like a GUID or meaningless pattern"""
        if not s:
            return True
        # Check for GUIDs (e.g., "C/03Bb49F4 E60B 4Cfd 8181 8924A3Df8589")
        if re.search(r'[0-9A-Fa-f]{8}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{12}', s):
            return True
        # Check for very short or single-character patterns
        if len(s.strip()) < 3:
            return True
        # Check for patterns like "C/..." that look like file paths or GUIDs
        if re.match(r'^[A-Z]/[0-9A-Fa-f]', s):
            return True
        return False
    
    def _is_semantic_id(self, id_value: str) -> bool:
        """Check if ID is semantic (not auto-generated like 'input_23')"""
        # Semantic IDs don't end with numbers or have underscores with numbers
        if re.match(r'.*_\d+$', id_value):
            return False
        if re.match(r'^[a-z]+\d+$', id_value):
            return False
        return True
    
    def _generate_action_description(
        self,
        edge: ActionGraphEdge,
        element_name: str,
        gherkin_keyword: str,
        persona: Optional[str] = None
    ) -> str:
        """
        Generate action description in Gherkin format.
        
        Args:
            edge: Action graph edge
            element_name: Clean element name
            gherkin_keyword: Gherkin keyword (Given/When/And/Then)
            persona: Persona performing the action (defaults to "user" if not provided)
        """
        action_type = edge.action.lower()
        # Use persona if provided, otherwise default to "user"
        actor = persona if persona else "user"
        
        # Element name should already be clean (cleaned in _generate_test_steps)
        # But be extra aggressive - remove ALL action words from anywhere
        clean_element = element_name.strip()
        
        # Remove action words from anywhere in the string (multiple passes for safety)
        clean_element = re.sub(r'\b(i\s+)?(user\s+)?(clicks?|enters?|selects?|submits?|navigates?)\s+', '', clean_element, flags=re.I)
        clean_element = re.sub(r'^(i\s+)?(user\s+)?(clicks?|enters?|selects?|submits?|navigates?)\s+', '', clean_element, flags=re.I)
        clean_element = clean_element.strip()
        
        # Final check - if it still starts with action words, remove them
        if clean_element.lower().startswith(('i click', 'i enter', 'click', 'enter', 'user click', 'user enter')):
            clean_element = re.sub(r'^(i\s+)?(user\s+)?(click|enter|select|submit|navigate)\s+', '', clean_element, flags=re.I).strip()
        
        # Capitalize first letter if needed
        if clean_element:
            clean_element = clean_element[0].upper() + clean_element[1:] if len(clean_element) > 1 else clean_element.upper()
        
        if action_type == "navigate":
            # For navigation, use the target page title
            to_node = None
            if hasattr(edge, 'to_node_id'):
                # Try to get target node from context if available
                pass
            to_url = edge.description or clean_element
            # Clean up navigation descriptions
            if "navigate" in to_url.lower():
                to_url = to_url.replace("Navigate to", "").replace("navigate to", "").strip()
            return f"{gherkin_keyword} {actor} is on {to_url}" if gherkin_keyword == "Given" else f"{gherkin_keyword} {actor} navigates to {to_url}"
        
        elif action_type in ["click", "submit"]:
            # Element name should already be clean, but ensure no action words anywhere
            # Remove "I click", "click", "I", etc. from anywhere in the string
            clean_element = re.sub(r'\b(i\s+)?click\s+', '', clean_element, flags=re.I)
            clean_element = re.sub(r'^(i\s+)?click\s+', '', clean_element, flags=re.I)
            clean_element = clean_element.strip()
            # Add "button" if it's a click action and element doesn't already have it
            if action_type == "click" and "button" not in clean_element.lower() and "link" not in clean_element.lower():
                clean_element = f"{clean_element} button"
            # Final check - ensure element name doesn't start with "I click"
            if clean_element.lower().startswith("i click"):
                clean_element = re.sub(r'^i\s+click\s+', '', clean_element, flags=re.I).strip()
            return f"{gherkin_keyword} {actor} clicks {clean_element}"
        
        elif action_type in ["input", "type", "fill_input"]:
            # Remove "I enter", "user enters", "enter", etc. from clean_element if present (from anywhere)
            clean_element = re.sub(r'\b(i\s+)?(user\s+)?enter(s)?\s+', '', clean_element, flags=re.I)
            clean_element = re.sub(r'\b(i\s+)?(user\s+)?fill(s)?\s+', '', clean_element, flags=re.I)
            clean_element = clean_element.strip()
            
            # Get value from edge inputs (should be full value after merging)
            value = None
            if edge.inputs:
                value = edge.inputs.get("value")
                if value:
                    value = str(value).strip()
                    if not value:  # Empty string
                        value = None
            
            if value:
                # Check if parameterized
                if value.startswith("{{") and value.endswith("}}"):
                    return f"{gherkin_keyword} {actor} enters {value} in {clean_element}"
                else:
                    # Use the full value
                    return f'{gherkin_keyword} {actor} enters "{value}" in {clean_element}'
            else:
                return f"{gherkin_keyword} {actor} enters text in {clean_element}"
        
        elif action_type == "select":
            # Remove "I select", "user selects", etc. from clean_element
            clean_element = re.sub(r'\b(i\s+)?(user\s+)?select(s)?\s+', '', clean_element, flags=re.I)
            clean_element = clean_element.strip()
            value = edge.inputs.get("value", "") if edge.inputs else ""
            if value:
                return f'{gherkin_keyword} {actor} selects "{value}" from {clean_element}'
            else:
                return f"{gherkin_keyword} {actor} selects option from {clean_element}"
        
        else:
            # For other action types, use third person verb form
            verb = action_type
            # Convert to third person (add 's' for most verbs, handle special cases)
            if verb not in ['click', 'enter', 'select', 'submit', 'navigate']:
                if not verb.endswith('s'):
                    verb = f"{verb}s"
            return f"{gherkin_keyword} {actor} {verb} {clean_element}"
    
    def _extract_test_data(self, edge: ActionGraphEdge) -> Optional[str]:
        """
        Extract test data from edge - returns value string for test_data field.
        
        This should get the full merged value after grouping.
        """
        if not edge.inputs:
            logger.debug(f"Edge {edge.id} has no inputs")
            return None
        
        value = edge.inputs.get("value", "")
        if value:
            value = str(value).strip()
            logger.debug(f"Extracted test data from edge {edge.id}: '{value}' (length: {len(value)})")
            # Check if parameterized
            if value.startswith("{{") and value.endswith("}}"):
                return value
            elif value:  # Non-empty value
                return value
        
        logger.debug(f"Edge {edge.id} has empty or no value")
        return None
    
    def _infer_expected_results(
        self,
        edges: List[ActionGraphEdge],
        nodes: List[ActionGraphNode],
        action_graph: ActionGraph,
        dom_snapshots: Optional[Dict[str, Any]]
    ) -> List[str]:
        """
        Infer expected results using multi-layered verification.
        
        Layers:
        1. DOM-based assertions (element visibility, content changes)
        2. Visual regression baselines (screenshots)
        3. State transitions (URL, storage, cookies)
        4. Data validation (form submissions, success indicators)
        """
        expected_results = []
        flowstral_patterns = ["wcag_scan", "page_load", "session_end", "session_start", "change:", "user wcag_scan", "user scroll"]
        
        for i, edge in enumerate(edges):
            to_node = action_graph.node_map.get(edge.to_node_id)
            from_node = action_graph.node_map.get(edge.from_node_id)
            
            expected = None
            action_type = edge.action.lower()
            
            # Clean any Flowstral patterns from edge description/expected_outcome
            edge_desc = edge.description or ""
            edge_expected = edge.expected_outcome or ""
            
            # Remove Flowstral internal patterns from descriptions
            for pattern in flowstral_patterns:
                edge_desc = edge_desc.replace(pattern, "").replace(pattern.upper(), "")
                edge_expected = edge_expected.replace(pattern, "").replace(pattern.upper(), "")
            
            # Layer 1: Use edge's expected_outcome if available and clean
            if edge_expected and not any(p in edge_expected.lower() for p in flowstral_patterns):
                expected = edge_expected.strip()
            
            # Layer 2: Navigation/URL change
            elif action_type == "navigate" and to_node:
                clean_title = self._extract_clean_page_name(to_node) or to_node.url_pattern
                expected = f"User navigates to {clean_title}"
            
            # Layer 3: State transition (URL change)
            elif to_node and from_node and to_node.url_pattern != from_node.url_pattern:
                clean_title = self._extract_clean_page_name(to_node)
                if clean_title and not self._is_meaningless_pattern(clean_title):
                    expected = f"Page navigates to {clean_title} page"
                elif to_node.url_pattern and not self._is_meaningless_pattern(to_node.url_pattern):
                    pattern = to_node.url_pattern.strip("/").replace("-", " ").replace("_", " ").title()
                    expected = f"Page navigates to {pattern} page"
                else:
                    # Use element name if available
                    element_name = "the target page"
                    if to_node.target_text:
                        element_name = to_node.target_text[:30]
                    expected = f"Page navigates to {element_name}"
            
            # Layer 4: Input actions - infer based on element and value
            elif action_type in ["input", "type", "fill_input"]:
                # Get element name - use to_node for target_text
                element_name = "field"
                
                # Try to get from node.target_text first (most reliable)
                if to_node and to_node.target_text:
                    element_name = str(to_node.target_text).strip()
                elif edge.description:
                    # Try to extract from description
                    field_hint = self._extract_field_hint_from_description(edge.description)
                    if field_hint:
                        # Convert to readable name
                        name = field_hint.replace("_", " ").replace("-", " ").title()
                        if "user" in name.lower() and ("name" in name.lower() or "id" in name.lower()):
                            element_name = "Username"
                        elif "pass" in name.lower():
                            element_name = "Password"
                        elif "first" in name.lower() and "name" in name.lower():
                            element_name = "First Name"
                        elif "last" in name.lower() and "name" in name.lower():
                            element_name = "Last Name"
                        elif "postal" in name.lower() or "zip" in name.lower():
                            element_name = "Postal Code"
                        else:
                            element_name = name
                
                # Get value from edge inputs (should be full value after merging)
                value = None
                if edge.inputs:
                    value = edge.inputs.get("value")
                    if value:
                        value = str(value).strip()
                        if not value:  # Empty string
                            value = None
                
                # Also try node.metadata.value as fallback
                if not value and to_node and to_node.metadata and to_node.metadata.get("value"):
                    value = str(to_node.metadata.get("value")).strip()
                
                if value and len(value) > 0:
                    # If we have a value, expect it to be entered (use full value)
                    # Truncate very long values for readability
                    display_value = value[:50] + "..." if len(value) > 50 else value
                    expected = f'"{display_value}" is entered in {element_name} field'
                else:
                    # Generic input expectation
                    expected = f"Text is entered in {element_name} field"
            
            # Layer 5: Click actions - infer based on element and navigation
            elif action_type in ["click", "submit"]:
                element_name = "button"
                
                # Try to get from node.target_text first (most reliable - button text)
                if to_node and to_node.target_text:
                    element_name = str(to_node.target_text).strip()
                    # Add "Button" if not already present
                    if "button" not in element_name.lower():
                        element_name = f"{element_name} Button"
                elif edge.description:
                    # Extract button name from description
                    if "LOGIN:" in edge.description or "login" in edge.description.lower():
                        element_name = "Login Button"
                    elif "ADD_TO_CART" in edge.description or "add to cart" in edge.description.lower():
                        element_name = "Add to Cart Button"
                    elif "CHECKOUT" in edge.description or "checkout" in edge.description.lower():
                        element_name = "Checkout Button"
                    elif "BUTTON#" in edge.description:
                        # Extract button text if available
                        button_match = re.search(r'BUTTON[^:]*:\s*[^#]*#([^-]+)\s*-\s*([^-]+)', edge.description)
                        if button_match:
                            element_name = button_match.group(2).strip()
                        else:
                            # Extract ID
                            id_match = re.search(r'BUTTON#([^\s\[\]]+)', edge.description)
                            if id_match:
                                element_name = id_match.group(1).replace("-", " ").replace("_", " ").title() + " Button"
                
                # If navigation happens, use that
                if to_node and from_node and to_node.url_pattern != from_node.url_pattern:
                    clean_title = self._extract_clean_page_name(to_node)
                    if clean_title and not self._is_meaningless_pattern(clean_title):
                        expected = f"{element_name} is clicked and page navigates to {clean_title} page"
                    elif to_node.url_pattern and not self._is_meaningless_pattern(to_node.url_pattern):
                        pattern = to_node.url_pattern.strip("/").replace("-", " ").replace("_", " ").title()
                        expected = f"{element_name} is clicked and page navigates to {pattern} page"
                    else:
                        expected = f"{element_name} is clicked and page navigates to the next page"
                else:
                    # Same page click - be more specific
                    if element_name and element_name.lower() not in ["button", "link", "element"]:
                        expected = f"{element_name} is clicked and action is triggered"
                    else:
                        expected = f"Element is clicked successfully"
            
            # Layer 6: Select actions
            elif action_type == "select":
                element_name = "dropdown"
                value = edge.inputs.get("value", "") if edge.inputs else ""
                if value:
                    expected = f'"{value}" is selected from {element_name}'
                else:
                    expected = f"Option is selected from {element_name}"
            
            # Fallback: Generic but meaningful
            if not expected:
                if edge_desc and not any(p in edge_desc.lower() for p in flowstral_patterns):
                    # Clean description
                    desc = edge_desc
                    # Remove action prefixes
                    desc = re.sub(r'^(CLICK|FILL_INPUT|FILL_PASSWORD|SUBMIT_FORM|LOGIN|ADD_TO_CART|CHECKOUT):\s*', '', desc, flags=re.I)
                    desc = re.sub(r'\[[^\]]+\]', '', desc)  # Remove brackets
                    desc = desc.strip()
                    if desc:
                        expected = desc
                else:
                    expected = "Action completes successfully"
            
            # Final cleanup - remove any remaining Flowstral patterns
            for pattern in flowstral_patterns:
                expected = expected.replace(pattern, "").replace(pattern.upper(), "")
            expected = re.sub(r'\s+', ' ', expected).strip()  # Normalize whitespace
            
            # Validate expected result - don't add if it's too short or meaningless
            if expected and len(expected) > 3 and expected.lower() not in ["user", "action", "page", "element"]:
                expected_results.append(expected)
            else:
                # Fallback to a more generic but meaningful result
                if action_type in ["click", "submit"]:
                    expected_results.append("Action is triggered successfully")
                elif action_type in ["input", "type"]:
                    expected_results.append("Value is entered in the field")
                elif action_type == "navigate":
                    expected_results.append("User navigates to the target page")
                else:
                    expected_results.append("Action completes successfully")
        
        return expected_results
    
    def _post_process_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process test case to improve quality:
        - Remove duplicate steps
        - Clean up element names
        - Remove Flowstral patterns from expected results
        - Ensure test data is preserved from merged inputs
        - Fix step numbering after deduplication
        """
        steps = test_case.get("test_steps") or test_case.get("steps", [])
        if not steps:
            return test_case
        
        # Clean up steps
        cleaned_steps = []
        seen_actions = set()
        
        for step in steps:
            action = step.get("action", "")
            element = step.get("element_name", "")
            
            # Skip if duplicate action+element (but preserve test data from first occurrence)
            action_key = f"{action}:{element}"
            if action_key in seen_actions:
                # Check if this step has test data that the previous one doesn't
                existing_step = next((s for s in cleaned_steps if f"{s.get('action', '')}:{s.get('element_name', '')}" == action_key), None)
                if existing_step and not existing_step.get("test_data") and step.get("test_data"):
                    # Update existing step with test data
                    existing_step["test_data"] = step.get("test_data")
                continue
            seen_actions.add(action_key)
            
            # Clean expected result
            expected = step.get("expected_result", "")
            if expected:
                flowstral_patterns = ["wcag_scan", "page_load", "session_end", "change:", "user wcag_scan", "user scroll"]
                for pattern in flowstral_patterns:
                    expected = expected.replace(pattern, "").replace(pattern.upper(), "")
                expected = re.sub(r'\s+', ' ', expected).strip()
                step["expected_result"] = expected
            
            # Skip scroll steps entirely - they shouldn't be in test cases
            if "scroll" in action.lower() or element.lower() in ["scroll", "user scroll"]:
                logger.debug(f"Skipping scroll step in post-processing: {action}")
                continue
            
            # CRITICAL FIX: Check if action is in bad format "click: [selector]" or "fill: [selector]"
            bad_format_match = re.match(r'^(click|fill|type|select|navigate):\s*(.+)$', action, re.I)
            if bad_format_match:
                detected_action = bad_format_match.group(1).lower()
                detected_selector = bad_format_match.group(2).strip()
                
                # Extract element name from selector
                if detected_selector.startswith('#'):
                    element_id = detected_selector[1:].split('.')[0].split('[')[0]
                    element_name = element_id.replace("_", " ").replace("-", " ")
                    element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)
                    element_name = element_name.title()
                    # Apply mappings
                    name_lower = element_name.lower()
                    if "vehicle" in name_lower:
                        if "year" in name_lower:
                            element_name = "Vehicle Year"
                        elif "make" in name_lower:
                            element_name = "Vehicle Make"
                        elif "model" in name_lower:
                            element_name = "Vehicle Model"
                        elif "sub" in name_lower and "model" in name_lower:
                            element_name = "Vehicle Submodel"
                    elif "tire" in name_lower and "size" in name_lower:
                        element_name = "Tire Size"
                    elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                        element_name = "Smart Submodel"
                    elif "continue" in name_lower and "checkout" in name_lower:
                        element_name = "Continue to Checkout Button"
                    elif "continue" in name_lower:
                        element_name = "Continue Button"
                    step["element_name"] = element_name
                elif detected_selector.startswith('.'):
                    # CSS class selector - extract meaningful class
                    classes = re.findall(r'\.([a-zA-Z0-9_-]+)', detected_selector)
                    meaningful_classes = [c for c in classes if len(c) > 3 and c.lower() not in ['ld', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'pa', 'ph', 'pv', 'ma', 'mh', 'mv', 'tc', 'tl', 'tr', 'db', 'dn', 'flex', 'items', 'justify', 'center', 'w', 'h', 'bg', 'f', 'sans', 'serif', 'bn', 'pointer', 'shadow', 'nowrap', 'underline', 'redesigned', 'cart', 'total']]
                    if meaningful_classes:
                        best_class = max(meaningful_classes, key=len)
                        name = best_class.replace("_", " ").replace("-", " ")
                        name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
                        element_name = name.title()
                        # Apply mappings
                        name_lower = element_name.lower()
                        if "chevron" in name_lower or "dropdown" in name_lower:
                            element_name = "Dropdown Arrow"
                        elif "plus" in name_lower or "add" in name_lower:
                            element_name = "Add Button"
                        elif "checkout" in name_lower:
                            element_name = "Checkout Button"
                        elif "continue" in name_lower:
                            element_name = "Continue Button"
                        elif "cart" in name_lower:
                            element_name = "Cart Button"
                        elif "subcategory" in name_lower or "category" in name_lower:
                            element_name = "Category Link"
                        step["element_name"] = element_name
                    else:
                        # Generic class - infer from action
                        if detected_action == "click":
                            step["element_name"] = "Button"
                        elif detected_action in ["fill", "type", "input"]:
                            step["element_name"] = "Input Field"
                        else:
                            step["element_name"] = "Element"
                
                # Rebuild action description
                actor = "user"  # Default persona
                if detected_action == "click":
                    step["action"] = f"{actor} clicks {step['element_name']}"
                elif detected_action in ["fill", "type", "input"]:
                    test_data = step.get("test_data", "")
                    if test_data:
                        step["action"] = f'{actor} enters "{test_data}" in {step["element_name"]}'
                    else:
                        step["action"] = f"{actor} enters text in {step['element_name']}"
                elif detected_action == "select":
                    test_data = step.get("test_data", "")
                    if test_data:
                        step["action"] = f'{actor} selects "{test_data}" from {step["element_name"]}'
                    else:
                        step["action"] = f"{actor} selects option from {step['element_name']}"
                
                logger.info(f"Post-process fixed action: '{step['action']}' with element_name: '{step['element_name']}'")
            
            # Clean element name if still generic
            if element in ["Input", "Click", "Scroll", "User scroll"] or (element and (element.startswith('.') or element.startswith('#'))):
                # Try to extract from action or expected result
                action_lower = action.lower()
                if "username" in action_lower or "user-name" in action_lower or "user_name" in action_lower:
                    step["element_name"] = "Username"
                elif "password" in action_lower or "pass" in action_lower:
                    step["element_name"] = "Password"
                elif "first" in action_lower and "name" in action_lower:
                    step["element_name"] = "First Name"
                elif "last" in action_lower and "name" in action_lower:
                    step["element_name"] = "Last Name"
                elif "login" in action_lower:
                    step["element_name"] = "Login Button"
                elif "cart" in action_lower:
                    step["element_name"] = "Add to Cart Button"
                elif "checkout" in action_lower:
                    step["element_name"] = "Checkout Button"
                elif "vehicle" in action_lower:
                    if "make" in action_lower:
                        step["element_name"] = "Vehicle Make"
                    elif "model" in action_lower:
                        step["element_name"] = "Vehicle Model"
                    elif "year" in action_lower:
                        step["element_name"] = "Vehicle Year"
                elif "tire" in action_lower:
                    step["element_name"] = "Tire Size"
            
            # Ensure test_data is extracted from action if present
            # Action might be: 'And user enters "testuser" in Username'
            if not step.get("test_data") and action:
                # Extract value from action string
                value_match = re.search(r'enters\s+"([^"]+)"', action, re.I)
                if value_match:
                    step["test_data"] = value_match.group(1)
            
            cleaned_steps.append(step)
        
        # Renumber steps after deduplication
        for i, step in enumerate(cleaned_steps, 1):
            step["step_number"] = i
        
        # Update test case
        if "test_steps" in test_case:
            test_case["test_steps"] = cleaned_steps
        if "steps" in test_case:
            test_case["steps"] = cleaned_steps
        
        logger.info(f"Post-processed test case: {len(steps)} steps -> {len(cleaned_steps)} steps (removed {len(steps) - len(cleaned_steps)} duplicates)")
        
        return test_case
    
    def _enhance_with_flowstral_language(
        self,
        test_case: Dict[str, Any],
        action_graph: ActionGraph
    ) -> Dict[str, Any]:
        """
        Enhance test case with fluent language from Flowstral template engine.
        This adds natural language variations and better phrasing.
        """
        if not self.flowstral_engine:
            return test_case
        
        try:
            # Generate test cases using Flowstral engine
            flowstral_result = self.flowstral_engine.generate_test_cases_from_action_graph(action_graph)
            flowstral_cases = flowstral_result.get("test_cases", {}).get("manual", [])
            
            if not flowstral_cases:
                return test_case
            
            # Try to match current test case with Flowstral case by comparing steps
            # For now, use the first Flowstral case that has similar structure
            best_match = None
            current_steps = test_case.get("steps") or test_case.get("test_steps", [])
            
            for fc in flowstral_cases:
                fc_steps = fc.get("steps", [])
                if len(fc_steps) == len(current_steps):
                    best_match = fc
                    break
            
            if not best_match and flowstral_cases:
                best_match = flowstral_cases[0]
            
            if best_match:
                # Enhance action and expected_result text with Flowstral phrases
                fc_steps = best_match.get("steps", [])
                for i, step in enumerate(current_steps):
                    if i < len(fc_steps):
                        fc_step = fc_steps[i]
                        # Use Flowstral action text if it's more fluent
                        if fc_step.get("action"):
                            step["action"] = fc_step["action"]
                        # Use Flowstral expected result if available
                        if fc_step.get("expected_result"):
                            step["expected_result"] = fc_step["expected_result"]
                
                # Enhance title and description if Flowstral has better ones
                if best_match.get("title"):
                    test_case["title"] = best_match["title"]
                if best_match.get("description"):
                    test_case["description"] = best_match["description"]
                if best_match.get("priority"):
                    test_case["priority"] = best_match["priority"]
                if best_match.get("test_type"):
                    test_case["test_type"] = best_match["test_type"]
                
                logger.debug("Enhanced test case with Flowstral fluent language")
        
        except Exception as e:
            logger.warning(f"Failed to enhance with Flowstral language: {e}")
        
        return test_case
    
    def _extract_clean_page_name(self, node: ActionGraphNode) -> Optional[str]:
        """Extract clean page name, removing Flowstral internal descriptions and GUIDs"""
        # Priority: title > URL pattern > URL
        
        # Helper to check if string looks like a GUID or meaningless pattern
        def is_meaningless_pattern(s: str) -> bool:
            if not s:
                return True
            # Check for GUIDs (e.g., "C/03Bb49F4 E60B 4Cfd 8181 8924A3Df8589")
            if re.search(r'[0-9A-Fa-f]{8}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{4}[- ]?[0-9A-Fa-f]{12}', s):
                return True
            # Check for very short or single-character patterns
            if len(s.strip()) < 3:
                return True
            # Check for patterns like "C/..." that look like file paths or GUIDs
            if re.match(r'^[A-Z]/[0-9A-Fa-f]', s):
                return True
            return False
        
        # Use title if it doesn't contain Flowstral patterns and is meaningful
        if node.title:
            title = node.title.strip()
            # Filter out Flowstral internal patterns
            flowstral_patterns = [
                "flowstral", "page_load", "wcag_scan", "session_start", "session_end",
                "click:", "fill_input:", "fill_password:", "submit_form:", "login:",
                "add_to_cart:", "checkout:", "change:", "user scroll", "user wcag_scan"
            ]
            title_lower = title.lower()
            
            # Check if title contains Flowstral patterns
            has_flowstral_pattern = any(pattern in title_lower for pattern in flowstral_patterns)
            
            if not has_flowstral_pattern and not is_meaningless_pattern(title):
                # Clean up title
                # Remove "Page load:" prefix if present
                title = re.sub(r'^Page\s+load:\s*', '', title, flags=re.I)
                # Remove URL if present
                title = re.sub(r'https?://[^\s]+', '', title)
                title = title.strip()
                if title and not is_meaningless_pattern(title):
                    return title[:50]  # Limit length
            
            # Try to extract meaningful part from title
            # Pattern: "Page load: https://example.com/credit-cards" -> "Credit Cards"
            url_match = re.search(r'https?://[^/]+(?:/([^/\s?]+))?', title)
            if url_match:
                path = url_match.group(1) if url_match.group(1) else None
                if path and not is_meaningless_pattern(path):
                    name = path.replace("-", " ").replace("_", " ").title()
                    # Remove common file extensions
                    name = re.sub(r'\.(html|htm|aspx|php|jsp)$', '', name, flags=re.I)
                    return name
        
        # Use URL pattern if available and meaningful (not a GUID)
        if node.url_pattern and node.url_pattern not in ["/", ""]:
            pattern = node.url_pattern.strip("/")
            if pattern and not is_meaningless_pattern(pattern):
                # Convert to readable name
                name = pattern.replace("-", " ").replace("_", " ").title()
                # Remove common prefixes
                name = re.sub(r'^(Page|Screen|View)\s+', '', name, flags=re.I)
                # Remove file extensions
                name = re.sub(r'\.(html|htm|aspx|php|jsp)$', '', name, flags=re.I)
                if name and not is_meaningless_pattern(name):
                    return name
        
        # Use URL if available - extract meaningful path
        if node.url:
            # Extract path from URL
            url_match = re.search(r'https?://[^/]+(?:/([^/\s?]+))?', node.url)
            if url_match:
                path = url_match.group(1) if url_match.group(1) else "home"
                return path.replace("-", " ").replace("_", " ").title()
        
        return None
    
    def _generate_description(
        self,
        nodes: List[ActionGraphNode],
        edges: List[ActionGraphEdge],
        intent: Optional[Dict[str, Any]],
        preconditions: List[str]
    ) -> Dict[str, str]:
        """
        Generate test description using template.
        
        Template:
        "Verify that [user_role] can [action_sequence] on [page/feature] 
         when [precondition] and expect [outcome]"
        """
        # Extract user role from preconditions
        user_role = "user"
        for precond in preconditions:
            if "admin" in precond.lower():
                user_role = "admin"
                break
            elif "logged in" in precond.lower():
                user_role = "authenticated user"
        
        # Extract meaningful action sequence (filter out Flowstral events)
        action_sequence = []
        for edge in edges[:5]:  # First 5 meaningful actions
            action_type = edge.action.lower()
            # Skip Flowstral internal events
            if action_type in ["page_load", "wcag_scan", "change", "session_end", "session_start"]:
                continue
            
            # Extract meaningful action description
            if edge.description:
                desc = edge.description
                # Clean Flowstral patterns
                desc = re.sub(r'^(CLICK|FILL_INPUT|FILL_PASSWORD|SUBMIT_FORM|LOGIN|ADD_TO_CART|CHECKOUT):\s*', '', desc, flags=re.I)
                desc = re.sub(r'\[[^\]]+\]', '', desc)  # Remove brackets
                desc = desc.strip()
                if desc and len(desc) < 50:
                    action_sequence.append(desc)
        
        # Build action text
        if action_sequence:
            # Summarize: "login", "add to cart", "checkout", etc.
            action_keywords = []
            for action in action_sequence[:3]:
                action_lower = action.lower()
                if "login" in action_lower or "sign in" in action_lower:
                    action_keywords.append("login")
                elif "cart" in action_lower or "add" in action_lower:
                    action_keywords.append("add to cart")
                elif "checkout" in action_lower:
                    action_keywords.append("checkout")
                elif "search" in action_lower:
                    action_keywords.append("search")
                elif "submit" in action_lower:
                    action_keywords.append("submit form")
            
            if action_keywords:
                action_text = " → ".join(set(action_keywords))  # Remove duplicates
            else:
                action_text = " → ".join(action_sequence[:3])
        else:
            action_text = "complete the workflow"
        
        # Extract page/feature (use clean page name)
        page = "application"
        if nodes:
            clean_page = self._extract_clean_page_name(nodes[0])
            if clean_page:
                page = clean_page
            elif nodes[0].url_pattern:
                page = nodes[0].url_pattern.strip("/").replace("-", " ").title() or "application"
        
        # Extract outcome
        outcome = "complete successfully"
        if edges:
            last_edge = edges[-1]
            action_type = last_edge.action.lower()
            if action_type == "submit":
                outcome = "form is submitted successfully"
            elif action_type == "navigate":
                if len(nodes) > 1:
                    clean_page = self._extract_clean_page_name(nodes[-1])
                    if clean_page:
                        outcome = f"navigate to {clean_page}"
            elif "checkout" in action_text.lower():
                outcome = "checkout is completed"
            elif "login" in action_text.lower():
                outcome = "user is logged in"
            elif "cart" in action_text.lower():
                outcome = "item is added to cart"
        
        # Build description (remove Flowstral references)
        title = f"Verify {action_text}"
        if page and page != "application":
            title += f" on {page}"
        
        description = f"Verify that {user_role} can {action_text}"
        if page and page != "application":
            description += f" on {page}"
        if preconditions:
            description += f" when {preconditions[0].lower()}"
        description += f" and expect {outcome}"
        
        # Add intent if available
        if intent and intent.get("primary_intent"):
            description += f" (Intent: {intent['primary_intent']})"
        
        return {
            "title": title,
            "description": description
        }
    
    def _extract_postconditions(self, last_node: Optional[ActionGraphNode]) -> List[str]:
        """Extract postconditions from final state"""
        postconditions = []
        
        if last_node:
            if last_node.url_pattern:
                postconditions.append(f"User is on {last_node.title or last_node.url_pattern}")
            
            if last_node.key_elements:
                postconditions.append(f"Page displays {', '.join(last_node.key_elements[:2])}")
        
        return postconditions
    
    def _determine_priority(
        self,
        scenario: Dict[str, Any],
        intent: Optional[Dict[str, Any]],
        nodes: List[ActionGraphNode]
    ) -> str:
        """Determine test case priority"""
        # Check intent
        if intent and intent.get("primary_intent"):
            intent_name = intent["primary_intent"]
            if intent_name in ["login", "checkout", "payment"]:
                return "critical"
            elif intent_name in ["search", "add_to_cart"]:
                return "high"
        
        # Check nodes
        for node in nodes:
            url_lower = (node.url_pattern or "").lower()
            if any(kw in url_lower for kw in ["login", "checkout", "payment", "purchase"]):
                return "critical"
            elif any(kw in url_lower for kw in ["search", "cart", "profile"]):
                return "high"
        
        return "medium"
    
    def _generate_tags(
        self,
        intent: Optional[Dict[str, Any]],
        nodes: List[ActionGraphNode]
    ) -> List[str]:
        """Generate tags for test case"""
        tags = ["automated", "ui"]
        
        if intent and intent.get("primary_intent"):
            tags.append(intent["primary_intent"])
        
        # Add tags based on nodes
        for node in nodes:
            url_lower = (node.url_pattern or "").lower()
            if "checkout" in url_lower or "cart" in url_lower:
                tags.append("ecommerce")
            elif "admin" in url_lower:
                tags.append("admin")
            elif "login" in url_lower:
                tags.append("authentication")
        
        return list(set(tags))  # Remove duplicates
    
    def _synthesize_from_path(
        self,
        critical_path: Dict[str, Any],
        action_graph: ActionGraph,
        dom_snapshots: Optional[Dict[str, Any]],
        screenshot_data: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Synthesize test case from critical path"""
        path_nodes = [action_graph.node_map.get(nid) for nid in critical_path["nodes"] if action_graph.node_map.get(nid)]
        path_edges = [e for e in action_graph.edges if e.id in critical_path["edges"]]
        
        if not path_nodes or not path_edges:
            return None
        
        # Get screenshot data for path nodes
        path_screenshots = {}
        if screenshot_data:
            for node in path_nodes:
                if node.id in screenshot_data or (node.dom_snapshot_id and node.dom_snapshot_id in screenshot_data):
                    path_screenshots[node.id] = screenshot_data.get(node.id) or screenshot_data.get(node.dom_snapshot_id)
        
        # Use same synthesis logic
        preconditions = self._extract_preconditions(path_nodes[0], action_graph, dom_snapshots)
        steps = self._generate_test_steps(path_edges, path_nodes, action_graph, dom_snapshots, screenshot_data=path_screenshots if path_screenshots else None)
        expected_results = self._infer_expected_results(path_edges, path_nodes, action_graph, dom_snapshots)
        
        for i, step in enumerate(steps):
            if i < len(expected_results):
                step["expected_result"] = expected_results[i]
        
        description = self._generate_description(path_nodes, path_edges, None, preconditions)
        
        return {
            "test_case_id": f"TC_{uuid4().hex[:8].upper()}",
            "title": f"Critical Path: {description['title']}",
            "description": description["description"],
            "preconditions": preconditions,
            "steps": steps,
            "postconditions": self._extract_postconditions(path_nodes[-1]),
            "priority": "high" if critical_path.get("is_main_flow") else "medium",
            "test_type": "automated",
            "tags": ["critical_path", "main_flow" if critical_path.get("is_main_flow") else "edge_case"],
            "source": "critical_path",
            "path_id": critical_path["path_id"]
        }

