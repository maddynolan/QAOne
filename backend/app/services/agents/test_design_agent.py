"""
Test Design Agent - Converts Playwright scripts to structured test cases
App-First Flow: Converts recorded flows into structured test cases
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import time
import json
import re

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class TestDesignAgent:
    """
    Agent for test design:
    - Converts Playwright scripts to structured test cases (LLM-based)
    - Generates test cases from action graphs (deterministic + LLM beautification)
    - Uses classical test design patterns (boundary values, equivalence classes)
    - Links to requirements
    - Generates test case metadata
    
    Hybrid Architecture:
    - Deterministic methods: Rule-based test design (80-90% of work)
    - LLM enhancement: Beautification and gap analysis (10-20% of work)
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self.priority_map = {
            "critical": ["login", "checkout", "payment", "auth", "purchase"],
            "high": ["search", "filter", "add_to_cart", "profile", "settings"],
            "medium": ["navigation", "view", "list", "browse"],
            "low": ["help", "about", "footer", "legal"]
        }
    
    # ==================== Deterministic Test Design Methods ====================
    
    def generate_deterministic_test_cases(
        self,
        action_graph: Any,  # ActionGraph type
        requirements: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate test cases deterministically from action graph (no LLM).
        Uses classical test design patterns:
        - Boundary values
        - Equivalence classes
        - Happy path + negative paths
        - Multi-page flow coverage
        
        Args:
            action_graph: ActionGraph instance
            requirements: Optional requirements to map to test cases
            
        Returns:
            List of structured test cases
        """
        test_cases = []
        
        # Step 1: Identify flows (paths through graph)
        flows = self._identify_flows_deterministic(action_graph)
        
        # Step 2: Generate happy path tests
        happy_path_tests = self._generate_happy_path_tests_deterministic(flows, action_graph)
        test_cases.extend(happy_path_tests)
        
        # Step 3: Generate negative tests
        negative_tests = self._generate_negative_tests_deterministic(flows, action_graph)
        test_cases.extend(negative_tests)
        
        # Step 4: Generate boundary tests
        boundary_tests = self._generate_boundary_tests_deterministic(action_graph)
        test_cases.extend(boundary_tests)
        
        # Step 5: Generate edge case tests
        edge_tests = self._generate_edge_case_tests_deterministic(action_graph)
        test_cases.extend(edge_tests)
        
        # Step 6: Map to requirements if provided
        if requirements:
            self._map_to_requirements_deterministic(test_cases, requirements)
        
        # Step 7: Tag and prioritize
        self._tag_and_prioritize_deterministic(test_cases, action_graph)
        
        logger.info(f"Generated {len(test_cases)} deterministic test cases from action graph")
        
        return test_cases
    
    def _identify_flows_deterministic(self, graph: Any) -> List[List[str]]:
        """Identify distinct flows (paths) through the graph"""
        flows = []
        
        # Find entry nodes (nodes with no incoming edges or navigation start)
        entry_nodes = []
        for node in graph.nodes:
            incoming = [e for e in graph.edges if e.to_node_id == node.id]
            if not incoming or (node.url_pattern and "/" in node.url_pattern):
                entry_nodes.append(node)
        
        # For each entry node, find paths to exit nodes
        for entry in entry_nodes[:5]:  # Limit to top 5 entry points
            paths = self._find_paths_from_node_deterministic(graph, entry.id, max_depth=10)
            flows.extend(paths[:3])  # Limit to top 3 paths per entry
        
        # If no flows found, create single flow from all nodes
        if not flows and graph.nodes:
            flows.append([node.id for node in graph.nodes[:10]])  # Limit to 10 nodes
        
        return flows
    
    def _find_paths_from_node_deterministic(self, graph: Any, start_id: str, max_depth: int = 10) -> List[List[str]]:
        """Find all paths from a node using BFS"""
        paths = []
        visited_paths = set()
        
        def dfs(node_id: str, path: List[str], depth: int):
            if depth > max_depth or node_id in path:
                if len(path) > 1:
                    path_sig = "->".join(path)
                    if path_sig not in visited_paths:
                        visited_paths.add(path_sig)
                        paths.append(path[:])
                return
            
            path.append(node_id)
            
            # Find outgoing edges
            outgoing = [e for e in graph.edges if e.from_node_id == node_id]
            
            if not outgoing:
                # End of path
                path_sig = "->".join(path)
                if path_sig not in visited_paths:
                    visited_paths.add(path_sig)
                    paths.append(path[:])
            else:
                for edge in outgoing[:3]:  # Limit outgoing edges
                    dfs(edge.to_node_id, path, depth + 1)
            
            path.pop()
        
        dfs(start_id, [], 0)
        
        return paths if paths else [[start_id]]
    
    def _generate_happy_path_tests_deterministic(self, flows: List[List[str]], graph: Any) -> List[Dict[str, Any]]:
        """Generate happy path test cases deterministically"""
        tests = []
        
        for flow_idx, flow in enumerate(flows[:5], 1):  # Limit to top 5 flows
            steps = []
            preconditions = []
            
            # Build steps from flow
            for i, node_id in enumerate(flow):
                node = graph.node_map.get(node_id)
                if not node:
                    continue
                
                # Get actions for this node
                actions = [e for e in graph.edges if e.from_node_id == node_id]
                
                for action in actions[:3]:  # Limit actions per node
                    step = {
                        "step_number": len(steps) + 1,
                        "action": action.description or action.action,
                        "expected_result": self._expected_result_for_action_deterministic(action, graph),
                        "page": node.title or node.url_pattern,
                        "selector": action.locators.get("primary") if action.locators else None
                    }
                    steps.append(step)
            
            if steps:
                test_case = {
                    "test_case_id": str(uuid4()),
                    "title": f"Happy Path Flow {flow_idx}",
                    "description": f"Verify successful completion of flow through {len(flow)} pages",
                    "test_type": "automated",
                    "preconditions": preconditions,
                    "steps": steps,
                    "tags": ["happy_path", "smoke"],
                    "priority": self._determine_priority_deterministic(flow, graph),
                    "source": "deterministic"
                }
                tests.append(test_case)
        
        return tests
    
    def _generate_negative_tests_deterministic(self, flows: List[List[str]], graph: Any) -> List[Dict[str, Any]]:
        """Generate negative test cases deterministically"""
        tests = []
        
        # Find input fields and forms
        input_actions = []
        for edge in graph.edges:
            if edge.action in ["input", "submit"] and edge.inputs and edge.inputs.get("value"):
                input_actions.append(edge)
        
        # Generate negative tests for inputs
        negative_scenarios = [
            ("empty", ""),
            ("invalid_format", "invalid@"),
            ("too_long", "x" * 1000),
            ("special_chars", "<script>alert('xss')</script>"),
            ("sql_injection", "'; DROP TABLE users; --")
        ]
        
        for action in input_actions[:5]:  # Limit to 5 inputs
            for scenario_name, invalid_value in negative_scenarios[:3]:  # Limit scenarios
                node = graph.node_map.get(action.from_node_id)
                if not node:
                    continue
                
                test_case = {
                    "test_case_id": str(uuid4()),
                    "title": f"Negative: {scenario_name.replace('_', ' ').title()} Input",
                    "description": f"Verify error handling for {scenario_name} input in {node.title}",
                    "test_type": "automated",
                    "preconditions": [f"Navigate to {node.title}"],
                    "steps": [
                        {
                            "step_number": 1,
                            "action": f"Enter invalid value: {invalid_value[:50] if invalid_value else 'empty'}",
                            "expected_result": "Error message displayed or input rejected",
                            "page": node.title,
                            "selector": action.locators.get("primary") if action.locators else None
                        }
                    ],
                    "tags": ["negative", "validation"],
                    "priority": "high",
                    "source": "deterministic"
                }
                tests.append(test_case)
        
        return tests
    
    def _generate_boundary_tests_deterministic(self, graph: Any) -> List[Dict[str, Any]]:
        """Generate boundary value tests deterministically"""
        tests = []
        
        # Find numeric inputs
        for edge in graph.edges:
            if edge.action == "input" and edge.inputs and edge.inputs.get("value"):
                value = edge.inputs["value"]
                
                # Check if numeric
                if value.isdigit() or (value.replace(".", "").isdigit()):
                    node = graph.node_map.get(edge.from_node_id)
                    if not node:
                        continue
                    
                    # Boundary values
                    boundaries = [
                        ("min", "0"),
                        ("max", "999999"),
                        ("negative", "-1")
                    ]
                    
                    for boundary_name, boundary_value in boundaries:
                        test_case = {
                            "test_case_id": str(uuid4()),
                            "title": f"Boundary: {boundary_name} value",
                            "description": f"Test boundary value {boundary_value} in {node.title}",
                            "test_type": "automated",
                            "preconditions": [f"Navigate to {node.title}"],
                            "steps": [
                                {
                                    "step_number": 1,
                                    "action": f"Enter boundary value: {boundary_value}",
                                    "expected_result": "Value accepted or appropriate validation message",
                                    "page": node.title,
                                    "selector": edge.locators.get("primary") if edge.locators else None
                                }
                            ],
                            "tags": ["boundary", "validation"],
                            "priority": "medium",
                            "source": "deterministic"
                        }
                        tests.append(test_case)
        
        return tests
    
    def _generate_edge_case_tests_deterministic(self, graph: Any) -> List[Dict[str, Any]]:
        """Generate edge case tests deterministically"""
        tests = []
        
        # Find navigation patterns
        nav_edges = [e for e in graph.edges if e.action == "navigate"]
        
        # Test rapid navigation
        if len(nav_edges) > 1:
            test_case = {
                "test_case_id": str(uuid4()),
                "title": "Edge Case: Rapid Navigation",
                "description": "Test rapid page navigation without waiting for load",
                "test_type": "automated",
                "preconditions": [],
                "steps": [
                    {
                        "step_number": i + 1,
                        "action": f"Navigate to page {i + 1}",
                        "expected_result": "Page loads correctly or shows loading state",
                        "page": "Multiple",
                        "selector": None
                    }
                    for i in range(min(3, len(nav_edges)))
                ],
                "tags": ["edge_case", "navigation"],
                "priority": "low",
                "source": "deterministic"
            }
            tests.append(test_case)
        
        return tests
    
    def _expected_result_for_action_deterministic(self, action: Any, graph: Any) -> str:
        """Generate expected result for action (deterministic)"""
        to_node = graph.node_map.get(action.to_node_id)
        
        if action.action == "navigate":
            if to_node:
                return f"Navigate to {to_node.title or to_node.url_pattern}"
            return "Navigation successful"
        
        elif action.action == "click":
            if to_node and to_node.id != action.from_node_id:
                return f"Navigate to {to_node.title}"
            return "Element clicked successfully"
        
        elif action.action == "input":
            return "Value entered successfully"
        
        elif action.action == "submit":
            return "Form submitted successfully"
        
        return "Action completed successfully"
    
    def _determine_priority_deterministic(self, flow: List[str], graph: Any) -> str:
        """Determine test case priority (deterministic)"""
        for node_id in flow:
            node = graph.node_map.get(node_id)
            if node:
                url_lower = (node.url_pattern or "").lower()
                title_lower = (node.title or "").lower()
                
                for keyword in self.priority_map["critical"]:
                    if keyword in url_lower or keyword in title_lower:
                        return "critical"
                
                for keyword in self.priority_map["high"]:
                    if keyword in url_lower or keyword in title_lower:
                        return "high"
        
        return "medium"
    
    def _map_to_requirements_deterministic(self, test_cases: List[Dict[str, Any]], requirements: List[Dict[str, Any]]):
        """Map test cases to requirements (keyword matching)"""
        for test_case in test_cases:
            test_title_lower = test_case["title"].lower()
            test_desc_lower = test_case.get("description", "").lower()
            
            matched_requirements = []
            for req in requirements:
                req_text = (req.get("title", "") + " " + req.get("description", "")).lower()
                
                # Check for keyword overlap
                test_words = set(test_title_lower.split() + test_desc_lower.split())
                req_words = set(req_text.split())
                
                common_words = test_words.intersection(req_words)
                if len(common_words) >= 2:  # At least 2 common words
                    matched_requirements.append(req.get("id") or req.get("key"))
            
            if matched_requirements:
                test_case["requirements"] = matched_requirements
    
    def _tag_and_prioritize_deterministic(self, test_cases: List[Dict[str, Any]], graph: Any):
        """Add tags and ensure priority is set"""
        for test_case in test_cases:
            if "tags" not in test_case:
                test_case["tags"] = []
            
            test_type = test_case.get("test_type", "")
            if test_type:
                test_case["tags"].append(test_type)
            
            if "priority" not in test_case:
                test_case["priority"] = "medium"
            
            # Add smoke tag for happy paths
            if "happy_path" in test_case.get("tags", []):
                test_case["tags"].append("smoke")
                if test_case["priority"] == "medium":
                    test_case["priority"] = "high"
    
    def generate_from_action_graph(
        self,
        action_graph: Any,  # ActionGraph type
        dom_snapshots: Optional[Dict[str, Any]] = None,
        output_format: str = "istqb",
        use_enhanced_engine: bool = True
    ) -> Dict[str, Any]:
        """
        Generate test cases from action graph using enhanced engine.
        
        Uses the new TestCaseEngine with all optimization rules.
        
        Args:
            action_graph: ActionGraph instance
            dom_snapshots: Optional DOM snapshots for element context
            output_format: "istqb" or "gherkin"
            use_enhanced_engine: Use new enhanced engine (default: True)
        
        Returns:
            Dict with test cases and statistics
        """
        if use_enhanced_engine:
            from app.services.engines.test_case_engine import TestCaseEngine
            
            engine = TestCaseEngine()
            
            # Extract screenshots from action graph nodes
            # OCR will be used as LAST RESORT fallback after all DOM-based methods fail
            screenshot_data = {}
            for node in action_graph.nodes:
                if node.screenshot_url:
                    screenshot_data[node.id] = node.screenshot_url
                    if node.dom_snapshot_id:
                        screenshot_data[node.dom_snapshot_id] = node.screenshot_url
            
            result = engine.generate_test_cases(
                action_graph=action_graph,
                dom_snapshots=dom_snapshots,
                output_format=output_format,
                optimize=True,
                screenshot_data=screenshot_data if screenshot_data else None  # Re-enabled as fallback
            )
            
            logger.info(f"Generated {len(result['test_cases'])} test cases using enhanced engine")
            return result
        else:
            # Fallback to deterministic method
            test_cases = self.generate_deterministic_test_cases(action_graph)
            return {
                "test_cases": test_cases,
                "statistics": {
                    "total_test_cases": len(test_cases)
                }
            }
    
    async def convert_script_to_test_case(
        self,
        playwright_script: str,
        recording_data: Optional[Dict[str, Any]] = None,
        requirement_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Convert Playwright script to structured test case
        
        Args:
            playwright_script: Playwright test code
            recording_data: Original recording data (DOM snapshots, etc.)
            requirement_id: Related requirement ID
            project_id: Project ID
            tenant_id: Tenant ID
        """
        logger.info(f"📝 Converting Playwright script to test case (script length: {len(playwright_script)} chars)")
        # Parse Playwright script
        parsed_script = self._parse_playwright_script(playwright_script)
        logger.info(f"📊 Parsed script: {len(parsed_script.get('actions', []))} actions found")
        
        # Use LLM to extract structured test case
        test_case = await self._extract_test_case_structure(
            playwright_script=playwright_script,
            parsed_script=parsed_script,
            recording_data=recording_data,
            tenant_id=tenant_id
        )
        
        # Enrich test case with action graph data if available
        if recording_data and recording_data.get("action_graph"):
            test_case = self._enrich_test_case_with_action_graph(
                test_case=test_case,
                parsed_script=parsed_script,
                action_graph_data=recording_data.get("action_graph")
            )
        
        # Ensure test_case is valid (not None)
        if test_case is None:
            logger.warning("_extract_test_case_structure returned None - creating fallback test case")
            # Try to use action graph for fallback if available
            if recording_data and recording_data.get("action_graph"):
                test_case = self._create_test_case_from_action_graph(
                    parsed_script=parsed_script,
                    action_graph_data=recording_data.get("action_graph")
                )
            else:
                test_case = {
                    "title": parsed_script.get("test_name", "Flowstral Recorded Test"),
                    "description": "Test case generated from Playwright script",
                    "test_type": "automated",
                    "priority": "medium",
                    "tags": ["recorded", "automated"],
                    "steps": [
                        {
                            "step_number": i + 1,
                            "action": action.get("type", ""),
                            "expected_result": f"Action {action.get('type', '')} completes successfully"
                        }
                        for i, action in enumerate(parsed_script.get("actions", []))
                    ],
                    "source": "script",
                    "playwright_script": playwright_script
                }
        
        # Ensure test_case is a dict
        if not isinstance(test_case, dict):
            logger.warning(f"test_case is not a dict: {type(test_case)} - creating fallback")
            test_case = {
                "title": "Flowstral Recorded Test",
                "description": "Test case generated from Playwright script",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [],
                "source": "script",
                "playwright_script": playwright_script
            }
        
        # Store test case
        test_case_id = await self._store_test_case(
            test_case=test_case,
            playwright_script=playwright_script,
            requirement_id=requirement_id,
            project_id=project_id,
            tenant_id=tenant_id
        )
        
        return {
            "status": "success",
            "test_case_id": test_case_id,
            "test_case": test_case,
            "created_at": datetime.utcnow().isoformat()
        }
    
    def _parse_playwright_script(self, script: str) -> Dict[str, Any]:
        """Parse Playwright script to extract basic structure"""
        # Extract test name
        test_name_match = re.search(r"test\(['\"]([^'\"]+)['\"]", script)
        test_name = test_name_match.group(1) if test_name_match else "Recorded Test"
        
        # Extract navigation
        goto_match = re.search(r"page\.goto\(['\"]([^'\"]+)['\"]", script)
        url = goto_match.group(1) if goto_match else None
        
        # Extract actions (click, fill, select, etc.)
        actions = []
        
        # Find all click actions
        click_matches = re.finditer(r"page\.click\(['\"]([^'\"]+)['\"]", script)
        for match in click_matches:
            actions.append({
                "type": "click",
                "selector": match.group(1),
                "line": script[:match.start()].count("\n") + 1
            })
        
        # Find all fill actions
        fill_matches = re.finditer(r"page\.fill\(['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]", script)
        for match in fill_matches:
            actions.append({
                "type": "fill",
                "selector": match.group(1),
                "value": match.group(2),
                "line": script[:match.start()].count("\n") + 1
            })
        
        # Find all assertions
        expect_matches = re.finditer(r"expect\(([^)]+)\)", script)
        assertions = []
        for match in expect_matches:
            assertions.append({
                "assertion": match.group(1),
                "line": script[:match.start()].count("\n") + 1
            })
        
        return {
            "test_name": test_name,
            "url": url,
            "actions": actions,
            "assertions": assertions,
            "total_lines": script.count("\n") + 1
        }
    
    async def _extract_test_case_structure(
        self,
        playwright_script: str,
        parsed_script: Dict[str, Any],
        recording_data: Optional[Dict[str, Any]],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Extract structured test case using LLM"""
        actions_summary = "\n".join([
            f"- {action.get('type', '')}: {action.get('selector', '')}" + (f" (value: {action.get('value', '')})" if action.get('value') else "")
            for action in parsed_script.get("actions", [])
        ])
        
        assertions_summary = "\n".join([
            f"- {assertion.get('assertion', '')}"
            for assertion in parsed_script.get("assertions", [])
        ])
        
        recording_context = ""
        if recording_data:
            recording_context = f"""
Recording Context:
- URL: {recording_data.get('url', '')}
- Title: {recording_data.get('title', '')}
- Snapshots: {len(recording_data.get('snapshots', []))}
"""
        
        # Build detailed action descriptions with selectors and values
        detailed_actions = []
        for i, action in enumerate(parsed_script.get("actions", []), 1):
            action_desc = f"Step {i}: {action.get('type', 'unknown').upper()}"
            if action.get('selector'):
                action_desc += f" on element '{action.get('selector')}'"
            if action.get('value'):
                action_desc += f" with value '{action.get('value')}'"
            if action.get('line'):
                action_desc += f" (line {action.get('line')})"
            detailed_actions.append(action_desc)
        
        prompt = f"""Convert this Playwright test script into a DETAILED and SPECIFIC structured test case.

IMPORTANT: Use the EXACT details from the script below. Do NOT use generic descriptions.

Test Name: {parsed_script.get('test_name', '')}
Initial URL: {parsed_script.get('url', 'N/A')}

DETAILED ACTIONS:
{chr(10).join(detailed_actions) if detailed_actions else "No actions found"}

ASSERTIONS:
{assertions_summary if assertions_summary else "No assertions found"}

{recording_context}

FULL PLAYWRIGHT SCRIPT:
```javascript
{playwright_script}
```

INSTRUCTIONS:
1. Analyze the script to understand the EXACT flow
2. Use SPECIFIC selectors, URLs, and values from the script
3. Create detailed step descriptions that reference actual elements and actions
4. Include specific expected results based on navigation URLs and assertions
5. Extract test data (inputs) from fill/type actions
6. Use page titles or URLs for expected results

Extract and provide a SPECIFIC structured test case in JSON format:
{{
  "title": "[SPECIFIC title based on actual flow - e.g., 'SauceDemo: Complete checkout flow with standard_user']",
  "description": "[DETAILED description using actual URLs, selectors, and actions from the script]",
  "test_type": "automated",
  "priority": "high|medium|low",
  "tags": ["[Based on URLs and actions - e.g., 'checkout', 'saucedemo', 'ecommerce']"],
  "preconditions": ["[Based on initial URL - e.g., 'User navigates to {parsed_script.get('url', 'N/A')}']"],
  "steps": [
    {{
      "step_number": 1,
      "action": "[SPECIFIC action using actual selector and value from script]",
      "expected_result": "[SPECIFIC expected outcome - use next action's URL or assertion]"
    }},
    ...
  ],
  "postconditions": ["[Based on final state - use last URL or assertion]"],
  "test_data": {{
    "inputs": {{"[field from script]": "[value from script]", ...}},
    "expected_outputs": {{"[Based on assertions or final URL]": "[value]"}}
  }}
}}

Respond with ONLY valid JSON, no explanations."""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="quick",  # OPTIMIZATION: Use quick mode for faster inference
            validate_json=True,
            task_type="test_design",
            max_tokens=1500,  # Limit tokens for faster generation
            use_fast_model=True  # OPTIMIZATION: Use 7B model for test case generation (5-10x faster)
        )
        
        logger.info(f"🤖 Calling LLM for test case generation (use_fast_model=True, should use qwen2.5-coder:7b)")
        logger.info(f"   Prompt length: {len(prompt)} chars, Actions: {len(parsed_script.get('actions', []))}")
        print(f"[INFO] TEST_DESIGN_AGENT - Calling LLM with use_fast_model=True")
        
        try:
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        except Exception as e:
            logger.error(f"❌ Exception calling model gateway: {e}", exc_info=True)
            print(f"[ERROR] TEST_DESIGN_AGENT - Exception calling model gateway: {e}")
            result = None
        
        if result:
            logger.info(f"✅ LLM response received - model: {result.model}, response length: {len(result.response) if result.response else 0} chars")
            print(f"[INFO] TEST_DESIGN_AGENT - LLM response received - model: {result.model}, response_length: {len(result.response) if result.response else 0}")
            if "7b" in result.model.lower() or "qwen2.5-coder" in result.model.lower():
                logger.info(f"✅ Confirmed: Using 7B model ({result.model})")
                print(f"[OK] TEST_DESIGN_AGENT - Confirmed: Using 7B model ({result.model})")
            else:
                logger.warning(f"⚠️  Not using 7B model - got: {result.model}")
                print(f"[WARN] TEST_DESIGN_AGENT - Not using 7B model - got: {result.model}")
        else:
            logger.error("❌ LLM returned None result - model gateway returned None")
            print(f"[ERROR] TEST_DESIGN_AGENT - LLM returned None result - model gateway returned None")
        
        # Check if result is valid
        if not result or not result.response or not result.response.strip():
            logger.warning("LLM returned empty response for test case structure extraction, using fallback")
            parsed_script = self._parse_playwright_script(playwright_script)
            actions = parsed_script.get("actions", [])
            return {
                "title": parsed_script.get("test_name", "Recorded Test"),
                "description": f"Test case generated from Playwright script with {len(actions)} actions",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [
                    {
                        "step_number": i + 1,
                        "action": self._format_action_description(action),
                        "expected_result": self._infer_expected_result(action, actions, i)
                    }
                    for i, action in enumerate(actions)
                ],
                "source": "script",
                "playwright_script": playwright_script
            }
        
        try:
            parsed = json.loads(result.response)
            # Handle both dict and list responses from LLM
            if isinstance(parsed, list):
                # If LLM returned a list, take the first item
                if len(parsed) > 0:
                    test_case = parsed[0]
                    # Ensure it's a dict
                    if not isinstance(test_case, dict):
                        logger.warning(f"LLM returned list with non-dict item: {type(test_case)}, creating default test case")
                        test_case = {}
                else:
                    test_case = {}
            elif isinstance(parsed, dict):
                test_case = parsed
            else:
                logger.warning(f"LLM returned unexpected type: {type(parsed)}, creating default test case")
                test_case = {}
            
            # Ensure test_case is a dict before accessing keys
            if not isinstance(test_case, dict):
                logger.warning(f"test_case is not a dict after parsing: {type(test_case)}, creating default")
                test_case = {}
            
            # Add metadata
            test_case["source"] = "recording" if recording_data else "script"
            test_case["playwright_script"] = playwright_script
            return test_case
        except json.JSONDecodeError as je:
            logger.warning(f"Failed to parse LLM response as JSON: {je}. Response preview: {result.response[:200] if result.response else 'None'}")
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
            # Return fallback instead of None
            actions = parsed_script.get("actions", [])
            return {
                "title": parsed_script.get("test_name", "Recorded Test"),
                "description": f"Test case generated from Playwright script with {len(actions)} actions",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [
                    {
                        "step_number": i + 1,
                        "action": self._format_action_description(action) if hasattr(self, '_format_action_description') else f"{action.get('type', 'unknown')}: {action.get('selector', '')}",
                        "expected_result": self._infer_expected_result(action, actions, i) if hasattr(self, '_infer_expected_result') else "Action completes successfully"
                    }
                    for i, action in enumerate(actions)
                ],
                "source": "script",
                "playwright_script": playwright_script
            }
        except (KeyError, TypeError, AttributeError) as e:
            logger.warning(f"Failed to parse test case structure (type error): {e}. This usually means the LLM returned an unexpected format. Using fallback.")
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
            # Return fallback instead of None
            actions = parsed_script.get("actions", [])
            return {
                "title": parsed_script.get("test_name", "Recorded Test"),
                "description": f"Test case generated from Playwright script with {len(actions)} actions",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [
                    {
                        "step_number": i + 1,
                        "action": self._format_action_description(action) if hasattr(self, '_format_action_description') else f"{action.get('type', 'unknown')}: {action.get('selector', '')}",
                        "expected_result": self._infer_expected_result(action, actions, i) if hasattr(self, '_infer_expected_result') else "Action completes successfully"
                    }
                    for i, action in enumerate(actions)
                ],
                "source": "script",
                "playwright_script": playwright_script
            }
        except Exception as e:
            logger.warning(f"Failed to parse test case structure: {e}")
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
            # Fallback: create basic structure with improved descriptions
            actions = parsed_script.get("actions", [])
            return {
                "title": parsed_script.get("test_name", "Recorded Test"),
                "description": f"Test case generated from Playwright script with {len(actions)} actions",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [
                    {
                        "step_number": i + 1,
                        "action": self._format_action_description(action) if hasattr(self, '_format_action_description') else f"{action.get('type', 'unknown')}: {action.get('selector', '')}",
                        "expected_result": self._infer_expected_result(action, actions, i) if hasattr(self, '_infer_expected_result') else "Action completes successfully"
                    }
                    for i, action in enumerate(actions)
                ],
                "source": "script",
                "playwright_script": playwright_script
            }
        
        # Final fallback - ensure we never return None
        if test_case is None:
            logger.warning("test_case is None after all processing - creating final fallback")
            return {
                "title": parsed_script.get("test_name", "Recorded Test"),
                "description": "Test case generated from Playwright script",
                "test_type": "automated",
                "priority": "medium",
                "tags": ["recorded", "automated"],
                "steps": [],
                "source": "script",
                "playwright_script": playwright_script
            }
        
        return test_case
    
    def _format_action_description(self, action: Dict[str, Any]) -> str:
        """Format action description with selector and value details"""
        action_type = action.get("type", "unknown")
        selector = action.get("selector", "")
        value = action.get("value", "")
        
        if action_type == "click":
            return f"Click on element '{selector}'" if selector else "Click action"
        elif action_type == "fill":
            return f"Fill '{selector}' with '{value}'" if selector and value else f"Fill field '{selector}'" if selector else "Fill action"
        elif action_type == "type":
            return f"Type '{value}' into '{selector}'" if selector and value else f"Type into '{selector}'" if selector else "Type action"
        elif action_type == "select":
            return f"Select '{value}' from '{selector}'" if selector and value else f"Select from '{selector}'" if selector else "Select action"
        elif action_type == "navigate":
            return f"Navigate to '{selector}'" if selector else "Navigate action"
        else:
            return f"{action_type} on '{selector}'" if selector else f"{action_type} action"
    
    def _infer_expected_result(self, action: Dict[str, Any], all_actions: List[Dict[str, Any]], current_index: int) -> str:
        """Infer expected result from action context"""
        action_type = action.get("type", "")
        
        # If there's a next action, use its context
        if current_index + 1 < len(all_actions):
            next_action = all_actions[current_index + 1]
            if next_action.get("type") == "navigate" and next_action.get("selector"):
                return f"Page navigates to '{next_action.get('selector')}'"
            elif next_action.get("selector"):
                return f"Next action '{next_action.get('type')}' becomes available on '{next_action.get('selector')}'"
        
        # Default expected results based on action type
        if action_type == "click":
            return "Element is clicked and action is triggered"
        elif action_type == "fill":
            return f"Value '{action.get('value', '')}' is entered into the field"
        elif action_type == "type":
            return f"Text '{action.get('value', '')}' is entered"
        elif action_type == "select":
            return f"Option '{action.get('value', '')}' is selected"
        elif action_type == "navigate":
            return f"Page loads at '{action.get('selector', '')}'"
        else:
            return f"{action_type} action completes successfully"
    
    async def _store_test_case(
        self,
        test_case: Dict[str, Any],
        playwright_script: str,
        requirement_id: Optional[str],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ) -> Optional[str]:
        """
        Store test case in database
        Returns None if project_id is not a valid UUID (skips database storage)
        """
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        from uuid import uuid4
        
        # Validate project_id is a valid UUID before querying database
        if project_id:
            try:
                import uuid
                # Try to validate as UUID
                uuid.UUID(project_id)
            except (ValueError, TypeError) as e:
                # project_id is not a valid UUID - skip database storage
                logger.warning(f"project_id '{project_id}' is not a valid UUID format (error: {e}). Skipping database storage. Test case will be generated in-memory only.")
                return None
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        test_case_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_test_case_sync,
                pool,
                test_case_id,
                test_case,
                playwright_script,
                requirement_id,
                project_id,
                tenant_id
            )
        
        # Link to requirement if provided and test case was stored
        if requirement_id and test_case_id:
            try:
                await self._link_test_case_to_requirement(
                    test_case_id,
                    requirement_id,
                    tenant_id
                )
            except Exception as e:
                logger.warning(f"Failed to link test case to requirement: {e}")
        
        return test_case_id
    
    def _store_test_case_sync(
        self,
        pool,
        test_case_id: str,
        test_case: Dict[str, Any],
        playwright_script: str,
        requirement_id: Optional[str],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous test case insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Get or create test plan
                plan_id = self._get_or_create_test_plan(
                    cur, project_id, tenant_id, "Recorded Tests"
                )
                
                # If plan_id is None, project_id was invalid - skip insert
                if not plan_id:
                    logger.warning("Cannot insert test case: invalid project_id (not a UUID)")
                    return
                
                # Insert test case (schema: id, plan_id, project_id, title, description, test_type, priority, tags, steps, preconditions, test_data, estimated_time, created_by, created_at, updated_at)
                # Note: No code, postconditions, or tenant_id columns in schema
                from app.utils.endpoint_helpers import DEFAULT_USER_ID
                
                # Map test_type to valid enum values (database enum: 'manual', 'automated', 'api', 'ui', 'e2e', 'performance')
                test_type_raw = test_case.get("test_type", "automated")
                test_type_mapping = {
                    "UI": "ui",
                    "ui": "ui",
                    "functional": "automated",
                    "automated": "automated",
                    "manual": "manual",
                    "api": "api",
                    "e2e": "e2e",
                    "performance": "performance",
                    "accessibility": "ui",  # Map accessibility to ui
                    "a11y": "ui"
                }
                test_type = test_type_mapping.get(test_type_raw.lower() if isinstance(test_type_raw, str) else str(test_type_raw).lower(), "automated")
                
                # Map priority to valid enum values (database enum: 'P0', 'P1', 'P2', 'P3')
                priority_raw = test_case.get("priority", "medium")
                priority_mapping = {
                    "critical": "P0",
                    "high": "P1",
                    "medium": "P2",
                    "low": "P3",
                    "p0": "P0",
                    "p1": "P1",
                    "p2": "P2",
                    "p3": "P3"
                }
                priority = priority_mapping.get(priority_raw.lower() if isinstance(priority_raw, str) else str(priority_raw).lower(), "P2")
                
                # Prepare test_data - include playwright script if provided
                test_data = test_case.get("test_data", {})
                if playwright_script and isinstance(test_data, dict):
                    test_data["playwright"] = playwright_script
                elif playwright_script:
                    test_data = {"playwright": playwright_script}
                
                # Prepare tags and preconditions as PostgreSQL arrays (TEXT[], not JSON)
                tags = test_case.get("tags", [])
                if isinstance(tags, str):
                    try:
                        tags = json.loads(tags)
                    except:
                        tags = [tags] if tags else []
                if not isinstance(tags, list):
                    tags = []
                
                preconditions = test_case.get("preconditions", [])
                if isinstance(preconditions, str):
                    try:
                        preconditions = json.loads(preconditions)
                    except:
                        preconditions = [preconditions] if preconditions else []
                if not isinstance(preconditions, list):
                    preconditions = []
                
                cur.execute(
                    """
                    INSERT INTO test_cases
                    (id, plan_id, project_id, title, description, test_type,
                     priority, tags, preconditions, steps, test_data, estimated_time, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    """,
                    (
                        test_case_id,
                        plan_id,
                        project_id,
                        test_case.get("title"),
                        test_case.get("description"),
                        test_type,  # Use mapped test_type
                        priority,  # Use mapped priority
                        tags if tags else [],  # PostgreSQL accepts Python lists for TEXT[] columns
                        preconditions if preconditions else [],  # PostgreSQL accepts Python lists for TEXT[] columns
                        json.dumps(test_case.get("steps", [])),  # steps is JSONB
                        json.dumps(test_data),  # test_data is JSONB
                        test_case.get("estimated_time", 15),
                        DEFAULT_USER_ID
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    def _get_or_create_test_plan(
        self,
        cur,
        project_id: Optional[str],
        tenant_id: Optional[str],
        plan_name: str
    ) -> Optional[str]:
        """Get or create test plan"""
        from uuid import uuid4
        
        # Validate project_id is UUID before querying
        if project_id:
            try:
                import uuid
                uuid.UUID(project_id)
            except (ValueError, TypeError) as e:
                logger.warning(f"project_id '{project_id}' is not a valid UUID (error: {e}), cannot create test plan")
                return None
        
        # Try to get existing plan
        cur.execute(
            """
            SELECT id FROM test_plans
            WHERE project_id = %s AND name = %s AND (tenant_id = %s OR tenant_id IS NULL)
            LIMIT 1
            """,
            (project_id, plan_name, tenant_id)
        )
        row = cur.fetchone()
        if row:
            return str(row[0])
        
        # Create new plan
        from app.utils.endpoint_helpers import DEFAULT_USER_ID
        plan_id = str(uuid4())
        cur.execute(
            """
            INSERT INTO test_plans
            (id, project_id, tenant_id, name, description, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
            """,
            (plan_id, project_id, tenant_id, plan_name, f"Test plan for {plan_name}", DEFAULT_USER_ID)
        )
        return plan_id
    
    async def _link_test_case_to_requirement(
        self,
        test_case_id: str,
        requirement_id: str,
        tenant_id: Optional[str]
    ):
        """Link test case to requirement"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._link_test_case_to_requirement_sync,
                pool,
                test_case_id,
                requirement_id,
                tenant_id
            )
    
    def _link_test_case_to_requirement_sync(
        self,
        pool,
        test_case_id: str,
        requirement_id: str,
        tenant_id: Optional[str]
    ):
        """Synchronous requirement link"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO test_case_requirements
                    (test_case_id, requirement_id, tenant_id, created_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (test_case_id, requirement_id) DO NOTHING
                    """,
                    (test_case_id, requirement_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    def _enrich_test_case_with_action_graph(
        self,
        test_case: Dict[str, Any],
        parsed_script: Dict[str, Any],
        action_graph_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Enrich test case steps with semantic names from action graph.
        Maps CSS selectors from Playwright script to action graph nodes/edges.
        """
        if not test_case or not action_graph_data:
            logger.debug("Skipping enrichment: test_case or action_graph_data is None")
            return test_case
        
        logger.info(f"Enriching test case with action graph data (nodes: {len(action_graph_data.get('nodes', []))}, edges: {len(action_graph_data.get('edges', []))})")
        
        from app.services.flowstral.flowstral_action_graph import ActionGraph
        
        # Reconstruct action graph from data
        try:
            action_graph = ActionGraph(action_graph_data.get("session_id", "enrichment"))
            nodes_data = action_graph_data.get("nodes", [])
            edges_data = action_graph_data.get("edges", [])
            action_graph.load_from_session_data(nodes_data=nodes_data, edges_data=edges_data)
            logger.info(f"Reconstructed action graph: {len(action_graph.nodes)} nodes, {len(action_graph.edges)} edges")
        except Exception as e:
            logger.warning(f"Failed to reconstruct action graph for enrichment: {e}", exc_info=True)
            return test_case
        
        # Create selector-to-node mapping
        selector_to_node = {}
        for node in action_graph.nodes:
            if node.target_selector:
                # Normalize selector (remove quotes, handle different formats)
                normalized = node.target_selector.strip().strip('"').strip("'")
                selector_to_node[normalized] = node
                # Also map with quotes
                selector_to_node[f'"{normalized}"'] = node
                selector_to_node[f"'{normalized}'"] = node
                # Also map ID selectors (e.g., #vehicleYear -> vehicleYear)
                if normalized.startswith('#'):
                    selector_to_node[normalized[1:]] = node  # Map "vehicleYear" to node
        
        logger.info(f"Created selector mapping with {len(selector_to_node)} entries")
        
        # Enrich steps with semantic names
        enriched_steps = []
        playwright_actions = parsed_script.get("actions", [])
        
        for i, step in enumerate(test_case.get("steps", [])):
            step_number = step.get("step_number", i + 1)
            action = step.get("action", "")
            
            # Try to find matching Playwright action
            playwright_action = None
            if i < len(playwright_actions):
                playwright_action = playwright_actions[i]
            
            # Extract selector from action or Playwright script
            selector = None
            if playwright_action:
                selector = playwright_action.get("selector", "")
            elif "element" in action.lower():
                # Try to extract selector from action text
                import re
                selector_match = re.search(r"element\s+['\"]([^'\"]+)['\"]", action, re.I)
                if selector_match:
                    selector = selector_match.group(1)
            
            # Find matching node in action graph
            element_name = None
            expected_result = step.get("expected_result", "")
            
            if selector:
                # Try exact match first
                node = selector_to_node.get(selector)
                if not node:
                    # Try normalized match (remove leading/trailing quotes)
                    normalized_selector = selector.strip().strip('"').strip("'")
                    node = selector_to_node.get(normalized_selector)
                    if not node:
                        # Try ID selector match (e.g., "#vehicleYear" -> "vehicleYear")
                        if normalized_selector.startswith('#'):
                            node = selector_to_node.get(normalized_selector[1:])
                        if not node:
                            # Try partial match (for complex selectors) - check if selector contains key or vice versa
                            for key, value in selector_to_node.items():
                                # Remove quotes and special chars for comparison
                                key_clean = key.strip().strip('"').strip("'")
                                selector_clean = normalized_selector.strip().strip('"').strip("'")
                                if selector_clean in key_clean or key_clean in selector_clean:
                                    node = value
                                    logger.debug(f"Partial match: '{selector_clean}' matched '{key_clean}'")
                                    break
                
                if node:
                    # Extract semantic name from node
                    if node.target_text:
                        element_name = node.target_text.strip()
                        logger.debug(f"Found element name from target_text: '{element_name}' for selector '{selector}'")
                    elif node.action_description:
                        # Extract from action description (e.g., "CLICK_BUTTON: BUTTON - Vision & Optical" -> "Vision & Optical")
                        desc = node.action_description
                        if ":" in desc and "-" in desc:
                            parts = desc.split("-", 1)
                            if len(parts) > 1:
                                element_name = parts[-1].strip()
                        elif ":" in desc:
                            parts = desc.split(":", 1)
                            if len(parts) > 1:
                                element_name = parts[-1].strip()
                        logger.debug(f"Found element name from action_description: '{element_name}' for selector '{selector}'")
                    elif node.title:
                        element_name = node.title.strip()
                        logger.debug(f"Found element name from title: '{element_name}' for selector '{selector}'")
                    
                    # Clean element name
                    if element_name:
                        element_name = element_name.replace("CLICK_BUTTON:", "").replace("CLICK:", "").replace("BUTTON", "").strip()
                        element_name = element_name.strip("-").strip()
                        # Also clean common prefixes
                        element_name = element_name.replace("SELECT:", "").replace("FILL_INPUT:", "").replace("INPUT:", "").strip()
                        logger.debug(f"Cleaned element name: '{element_name}'")
                    
                    # Improve expected result based on node transition
                    if not expected_result or "Next action" in expected_result or "becomes available" in expected_result:
                        # Find edge that leads to this node
                        for edge in action_graph.edges:
                            if edge.to_node_id == node.id:
                                to_node = action_graph.node_map.get(edge.to_node_id)
                                if to_node and to_node.url_pattern:
                                    page_name = self._extract_clean_page_name(to_node.url_pattern)
                                    expected_result = f"Page navigates to {page_name}" if page_name else f"Page navigates to {to_node.url_pattern}"
                                elif to_node and to_node.title:
                                    expected_result = f"Page displays {to_node.title}"
                                break
            
            # Build enriched action description
            if element_name and element_name != selector:
                # Replace selector with semantic name
                action_type = playwright_action.get("type", "click") if playwright_action else "click"
                if action_type == "click":
                    enriched_action = f"Click on {element_name}"
                elif action_type in ["fill", "type"]:
                    value = playwright_action.get("value", "") if playwright_action else ""
                    enriched_action = f"Enter '{value}' in {element_name}" if value else f"Enter text in {element_name}"
                else:
                    enriched_action = f"{action_type.title()} on {element_name}"
            else:
                # Keep original action but try to improve it
                enriched_action = action
                if "element" in enriched_action.lower() and selector:
                    # Try to extract a better name from selector
                    if "#" in selector:
                        id_part = selector.split("#")[-1].split(".")[0].split("[")[0]
                        if id_part and len(id_part) > 2:
                            element_name = id_part.replace("-", " ").replace("_", " ").title()
                            enriched_action = enriched_action.replace(selector, element_name)
            
            enriched_steps.append({
                "step_number": step_number,
                "action": enriched_action,
                "test_data": step.get("test_data"),
                "expected_result": expected_result if expected_result else step.get("expected_result", "Action completes successfully"),
                "element_name": element_name,
                "selector": selector,
                "page": step.get("page")
            })
        
        # Update test case with enriched steps
        test_case["steps"] = enriched_steps
        
        # Improve title and description using action graph flow
        if action_graph.nodes:
            first_node = action_graph.nodes[0]
            last_node = action_graph.nodes[-1]
            
            # Extract flow context
            flow_keywords = []
            for edge in action_graph.edges[:10]:  # First 10 edges
                if edge.description:
                    desc = edge.description
                    # Extract meaningful keywords
                    if "CLICK" in desc and "-" in desc:
                        keyword = desc.split("-")[-1].strip()
                        if keyword and len(keyword) < 50:
                            flow_keywords.append(keyword)
            
            # Build better title
            if not test_case.get("title") or test_case.get("title") == "Flowstral Recorded Test":
                if flow_keywords:
                    title = f"User flow: {' → '.join(flow_keywords[:3])}"
                else:
                    first_page = self._extract_clean_page_name(first_node.url_pattern or first_node.url or "Home")
                    last_page = self._extract_clean_page_name(last_node.url_pattern or last_node.url or "Page")
                    title = f"Navigate from {first_page} to {last_page}"
                test_case["title"] = title
            
            # Build better description
            if not test_case.get("description") or "generated from Playwright script" in test_case.get("description", ""):
                first_page = self._extract_clean_page_name(first_node.url_pattern or first_node.url or "Home")
                last_page = self._extract_clean_page_name(last_node.url_pattern or last_node.url or "Page")
                test_case["description"] = f"User flow starting from {first_page}, performing {len(action_graph.edges)} actions, ending at {last_page}"
        
        return test_case


# Agent handler function
async def test_design_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Test Design Agent tasks"""
    start_time = time.time()
    
    agent = TestDesignAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "convert_script":
            result = await agent.convert_script_to_test_case(
                playwright_script=request.input_data.get("playwright_script"),
                recording_data=request.input_data.get("recording_data"),
                requirement_id=request.input_data.get("requirement_id"),
                project_id=request.project_id,
                tenant_id=request.tenant_id
            )
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.COMPLETED,
            output_data=result,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )
    
    except Exception as e:
        logger.error(f"Test Design agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

