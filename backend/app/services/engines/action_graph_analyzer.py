"""
Action Graph Analyzer - Phase 1
Analyzes action graphs to extract test scenarios using clustering, intent recognition, and critical path identification.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

logger = logging.getLogger(__name__)


class ActionGraphAnalyzer:
    """
    Analyzes action graphs to extract test scenarios.
    
    Phase 1 Components:
    1. Action Clustering & Segmentation
    2. Intent Recognition (Rule-Based)
    3. Critical Path Identification
    """
    
    def __init__(self):
        # Known workflow patterns
        self.workflow_patterns = {
            "login": {
                "keywords": ["login", "sign in", "authenticate", "username", "password"],
                "sequence": ["input", "input", "submit"],
                "min_actions": 2
            },
            "search": {
                "keywords": ["search", "find", "query", "filter"],
                "sequence": ["input", "click", "navigate"],
                "min_actions": 1
            },
            "crud": {
                "keywords": ["create", "add", "edit", "update", "delete", "remove"],
                "sequence": ["navigate", "input", "submit"],
                "min_actions": 2
            },
            "checkout": {
                "keywords": ["cart", "checkout", "purchase", "buy", "payment"],
                "sequence": ["click", "navigate", "input", "submit"],
                "min_actions": 3
            },
            "navigation": {
                "keywords": ["navigate", "go to", "visit", "page"],
                "sequence": ["navigate"],
                "min_actions": 1
            }
        }
    
    def analyze(self, action_graph: ActionGraph) -> Dict[str, Any]:
        """
        Analyze action graph and extract test scenarios.
        
        Returns:
            Analysis result with scenarios, intents, and critical paths
        """
        # Step 1: Action Clustering & Segmentation
        scenarios = self._cluster_and_segment(action_graph)
        
        # Step 2: Intent Recognition
        intents = self._recognize_intents(scenarios, action_graph)
        
        # Step 3: Critical Path Identification
        critical_paths = self._identify_critical_paths(action_graph)
        
        return {
            "scenarios": scenarios,
            "intents": intents,
            "critical_paths": critical_paths,
            "total_scenarios": len(scenarios),
            "total_intents": len(intents),
            "critical_path_count": len(critical_paths)
        }
    
    def _cluster_and_segment(self, graph: ActionGraph) -> List[Dict[str, Any]]:
        """
        Group actions into logical test scenarios.
        
        Segmentation rules:
        - Time gaps (>5 sec pause = scenario boundary)
        - Navigation changes (page transitions)
        - Goal completion (form submit, purchase complete)
        """
        scenarios = []
        current_scenario = {
            "scenario_id": f"SCENARIO_{len(scenarios) + 1}",
            "nodes": [],
            "edges": [],
            "start_time": None,
            "end_time": None,
            "boundary_type": None
        }
        
        if not graph.nodes:
            return scenarios
        
        # Sort nodes by timestamp
        sorted_nodes = sorted(graph.nodes, key=lambda n: n.timestamp)
        
        for i, node in enumerate(sorted_nodes):
            if i == 0:
                current_scenario["start_time"] = node.timestamp
                current_scenario["nodes"].append(node.id)
            else:
                prev_node = sorted_nodes[i - 1]
                time_gap = (node.timestamp - prev_node.timestamp).total_seconds()
                
                # Check for scenario boundaries
                is_boundary = False
                boundary_type = None
                
                # Rule 1: Time gap > 5 seconds
                if time_gap > 5:
                    is_boundary = True
                    boundary_type = "time_gap"
                
                # Rule 2: Navigation change
                if node.url_pattern and prev_node.url_pattern:
                    if node.url_pattern != prev_node.url_pattern:
                        is_boundary = True
                        boundary_type = "navigation"
                
                # Rule 3: Goal completion (form submit, etc.)
                edges_from_prev = [e for e in graph.edges if e.from_node_id == prev_node.id]
                for edge in edges_from_prev:
                    if edge.action in ["submit", "complete", "finish"]:
                        is_boundary = True
                        boundary_type = "goal_completion"
                
                if is_boundary and len(current_scenario["nodes"]) > 0:
                    # Finalize current scenario
                    current_scenario["end_time"] = prev_node.timestamp
                    current_scenario["boundary_type"] = boundary_type
                    scenarios.append(current_scenario)
                    
                    # Start new scenario
                    current_scenario = {
                        "scenario_id": f"SCENARIO_{len(scenarios) + 1}",
                        "nodes": [node.id],
                        "edges": [],
                        "start_time": node.timestamp,
                        "end_time": None,
                        "boundary_type": None
                    }
                else:
                    current_scenario["nodes"].append(node.id)
            
            # Add edges for this node
            node_edges = [e for e in graph.edges if e.from_node_id == node.id or e.to_node_id == node.id]
            current_scenario["edges"].extend([e.id for e in node_edges])
        
        # Finalize last scenario
        if current_scenario["nodes"]:
            if sorted_nodes:
                current_scenario["end_time"] = sorted_nodes[-1].timestamp
            scenarios.append(current_scenario)
        
        # Use graph algorithms to detect connected components
        scenarios = self._detect_connected_components(scenarios, graph)
        
        return scenarios
    
    def _detect_connected_components(self, scenarios: List[Dict[str, Any]], graph: ActionGraph) -> List[Dict[str, Any]]:
        """Detect connected components using graph algorithms"""
        # Simple BFS to find connected components
        visited_nodes = set()
        components = []
        
        for scenario in scenarios:
            component_nodes = []
            queue = scenario["nodes"][:]
            
            while queue:
                node_id = queue.pop(0)
                if node_id in visited_nodes:
                    continue
                
                visited_nodes.add(node_id)
                component_nodes.append(node_id)
                
                # Find connected nodes
                for edge in graph.edges:
                    if edge.from_node_id == node_id and edge.to_node_id not in visited_nodes:
                        queue.append(edge.to_node_id)
                    elif edge.to_node_id == node_id and edge.from_node_id not in visited_nodes:
                        queue.append(edge.from_node_id)
            
            if component_nodes:
                scenario["nodes"] = component_nodes
                components.append(scenario)
        
        return components
    
    def _recognize_intents(self, scenarios: List[Dict[str, Any]], graph: ActionGraph) -> List[Dict[str, Any]]:
        """
        Recognize user intents using rule-based pattern matching.
        
        Uses pattern matching against known workflows:
        - Login: username input → password input → submit
        - Search: search box → type → enter/click → results
        - CRUD: navigate → fill form → submit → verify
        """
        intents = []
        
        for scenario in scenarios:
            scenario_nodes = [graph.node_map.get(nid) for nid in scenario["nodes"] if graph.node_map.get(nid)]
            scenario_edges = [e for e in graph.edges if e.id in scenario["edges"]]
            
            # Extract text from nodes and edges
            text_content = []
            for node in scenario_nodes:
                if node:
                    text_content.append(node.title or "")
                    text_content.append(node.action_description or "")
                    text_content.extend(node.key_elements or [])
            
            for edge in scenario_edges:
                text_content.append(edge.description or "")
                text_content.append(edge.action or "")
            
            text_lower = " ".join(text_content).lower()
            
            # Pattern matching
            matched_intents = []
            for intent_name, pattern in self.workflow_patterns.items():
                # Check keywords
                keyword_matches = sum(1 for kw in pattern["keywords"] if kw in text_lower)
                
                # Check sequence
                action_sequence = [e.action for e in scenario_edges]
                sequence_match = self._check_sequence_match(action_sequence, pattern["sequence"])
                
                # Check minimum actions
                min_actions_met = len(scenario_edges) >= pattern["min_actions"]
                
                # Score intent match
                score = (keyword_matches * 0.5) + (sequence_match * 0.3) + (min_actions_met * 0.2)
                
                if score > 0.3:  # Threshold
                    matched_intents.append({
                        "intent": intent_name,
                        "confidence": min(score, 1.0),
                        "keywords_found": keyword_matches,
                        "sequence_match": sequence_match
                    })
            
            # Sort by confidence
            matched_intents.sort(key=lambda x: x["confidence"], reverse=True)
            
            if matched_intents:
                intents.append({
                    "scenario_id": scenario["scenario_id"],
                    "primary_intent": matched_intents[0]["intent"],
                    "confidence": matched_intents[0]["confidence"],
                    "all_intents": matched_intents
                })
        
        return intents
    
    def _check_sequence_match(self, actual_sequence: List[str], expected_sequence: List[str]) -> float:
        """Check if actual sequence matches expected pattern"""
        if not actual_sequence or not expected_sequence:
            return 0.0
        
        # Simple subsequence matching
        matches = 0
        expected_idx = 0
        
        for action in actual_sequence:
            if expected_idx < len(expected_sequence):
                if action == expected_sequence[expected_idx] or action in expected_sequence:
                    matches += 1
                    expected_idx += 1
        
        return matches / len(expected_sequence) if expected_sequence else 0.0
    
    def _identify_critical_paths(self, graph: ActionGraph) -> List[Dict[str, Any]]:
        """
        Identify critical paths using graph centrality algorithms.
        
        Uses:
        - Path frequency (how often path is taken)
        - Business value (based on URL patterns and intents)
        - Code coverage (if available)
        """
        if not graph.nodes or not graph.edges:
            return []
        
        # Calculate path frequencies
        path_frequencies = self._calculate_path_frequencies(graph)
        
        # Calculate business value scores
        business_values = self._calculate_business_values(graph)
        
        # Identify main flow vs edge cases
        critical_paths = []
        
        for path_id, frequency in path_frequencies.items():
            # Extract path
            path_nodes = path_id.split("->")
            path_edges = []
            
            for i in range(len(path_nodes) - 1):
                from_id = path_nodes[i]
                to_id = path_nodes[i + 1]
                edge = next((e for e in graph.edges if e.from_node_id == from_id and e.to_node_id == to_id), None)
                if edge:
                    path_edges.append(edge)
            
            if not path_edges:
                continue
            
            # Calculate path importance score
            business_value = business_values.get(path_nodes[0], 0.5)
            path_score = (frequency * 0.4) + (business_value * 0.3) + (len(path_edges) * 0.2 * 0.1)
            
            critical_paths.append({
                "path_id": path_id,
                "nodes": path_nodes,
                "edges": [e.id for e in path_edges],
                "frequency": frequency,
                "business_value": business_value,
                "score": path_score,
                "is_main_flow": path_score > 0.6,
                "is_edge_case": path_score < 0.3
            })
        
        # Sort by score
        critical_paths.sort(key=lambda x: x["score"], reverse=True)
        
        return critical_paths[:20]  # Top 20 paths
    
    def _calculate_path_frequencies(self, graph: ActionGraph) -> Dict[str, float]:
        """Calculate how often each path is taken"""
        path_counts = defaultdict(int)
        
        # Find all paths using DFS
        def dfs(node_id: str, path: List[str], visited: set):
            if node_id in visited:
                path_key = "->".join(path)
                if len(path) > 1:
                    path_counts[path_key] += 1
                return
            
            visited.add(node_id)
            path.append(node_id)
            
            # Find outgoing edges
            outgoing = [e for e in graph.edges if e.from_node_id == node_id]
            
            if not outgoing:
                # End of path
                path_key = "->".join(path)
                if len(path) > 1:
                    path_counts[path_key] += 1
            else:
                for edge in outgoing:
                    dfs(edge.to_node_id, path[:], visited.copy())
        
        # Start from entry nodes
        entry_nodes = [n for n in graph.nodes if not any(e.to_node_id == n.id for e in graph.edges)]
        if not entry_nodes:
            entry_nodes = graph.nodes[:1] if graph.nodes else []
        
        for entry in entry_nodes:
            dfs(entry.id, [], set())
        
        # Normalize frequencies
        if path_counts:
            max_count = max(path_counts.values())
            return {path: count / max_count for path, count in path_counts.items()}
        
        return {}
    
    def _calculate_business_values(self, graph: ActionGraph) -> Dict[str, float]:
        """Calculate business value based on URL patterns and intents"""
        business_keywords = {
            "critical": ["login", "checkout", "payment", "purchase", "auth", "signup"],
            "high": ["search", "filter", "add_to_cart", "profile", "settings"],
            "medium": ["view", "list", "browse", "navigation"],
            "low": ["help", "about", "footer", "legal"]
        }
        
        values = {}
        
        for node in graph.nodes:
            url_lower = (node.url_pattern or "").lower()
            title_lower = (node.title or "").lower()
            text = f"{url_lower} {title_lower}"
            
            value = 0.5  # Default medium
            
            for keyword in business_keywords["critical"]:
                if keyword in text:
                    value = 1.0
                    break
            
            if value < 1.0:
                for keyword in business_keywords["high"]:
                    if keyword in text:
                        value = 0.8
                        break
            
            if value < 0.8:
                for keyword in business_keywords["low"]:
                    if keyword in text:
                        value = 0.3
                        break
            
            values[node.id] = value
        
        return values



