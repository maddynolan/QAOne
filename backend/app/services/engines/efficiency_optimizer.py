"""
Efficiency Optimizer - Phase 3
Implements deduplication, smart assertions, context-aware naming, and path importance scoring.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
import difflib

logger = logging.getLogger(__name__)


class EfficiencyOptimizer:
    """
    Optimizes test cases for efficiency.
    
    Features:
    1. Deduplication Engine
    2. Smart Assertion Generation
    3. Context-Aware Naming
    4. Path Importance Scoring
    """
    
    def __init__(self):
        self.assertion_priority = {
            "high": [
                "page title changes",
                "success/error messages",
                "data submissions confirmed",
                "critical UI elements appear"
            ],
            "low": [
                "hover states",
                "tooltip appearances",
                "minor animations"
            ]
        }
    
    def optimize_test_cases(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Optimize test cases using deduplication and smart filtering.
        """
        # Step 1: Deduplication
        deduplicated = self._deduplicate_test_cases(test_cases)
        
        # Step 2: Smart assertion filtering
        optimized = []
        for test_case in deduplicated:
            optimized_case = self._optimize_assertions(test_case)
            optimized.append(optimized_case)
        
        # Step 3: Parameterize similar cases
        parameterized = self._parameterize_similar_cases(optimized)
        
        return parameterized
    
    def _deduplicate_test_cases(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicate test cases using fuzzy matching.
        
        Uses edit distance algorithms to detect similar action sequences.
        """
        if len(test_cases) <= 1:
            return test_cases
        
        # Group by similarity
        groups = []
        used_indices = set()
        
        for i, test_case in enumerate(test_cases):
            if i in used_indices:
                continue
            
            # Create signature for this test case
            signature = self._create_test_case_signature(test_case)
            
            # Find similar test cases
            similar_group = [test_case]
            used_indices.add(i)
            
            for j, other_case in enumerate(test_cases[i+1:], start=i+1):
                if j in used_indices:
                    continue
                
                other_signature = self._create_test_case_signature(other_case)
                similarity = self._calculate_similarity(signature, other_signature)
                
                if similarity > 0.8:  # 80% similarity threshold
                    similar_group.append(other_case)
                    used_indices.add(j)
            
            groups.append(similar_group)
        
        # Keep one from each group (prefer higher priority or more complete)
        deduplicated = []
        for group in groups:
            if len(group) == 1:
                deduplicated.append(group[0])
            else:
                # Choose best test case from group
                best = self._choose_best_from_group(group)
                deduplicated.append(best)
        
        logger.info(f"Deduplicated {len(test_cases)} test cases to {len(deduplicated)}")
        return deduplicated
    
    def _create_test_case_signature(self, test_case: Dict[str, Any]) -> str:
        """Create signature for similarity comparison"""
        # Extract key information
        steps = test_case.get("steps", [])
        step_signatures = []
        
        for step in steps:
            action = step.get("action", "")
            element = step.get("element_name", "")
            # Normalize
            action_normalized = re.sub(r'\d+', 'N', action.lower())
            element_normalized = re.sub(r'\d+', 'N', element.lower())
            step_signatures.append(f"{action_normalized}:{element_normalized}")
        
        return "|".join(step_signatures)
    
    def _calculate_similarity(self, sig1: str, sig2: str) -> float:
        """Calculate similarity between two signatures using edit distance"""
        if not sig1 or not sig2:
            return 0.0
        
        # Use SequenceMatcher for similarity
        similarity = difflib.SequenceMatcher(None, sig1, sig2).ratio()
        return similarity
    
    def _choose_best_from_group(self, group: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Choose best test case from similar group"""
        # Prefer:
        # 1. Higher priority
        # 2. More steps (more complete)
        # 3. Has test data
        
        priority_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        
        def score(test_case):
            priority_score = priority_order.get(test_case.get("priority", "medium"), 2)
            step_count = len(test_case.get("steps", []))
            has_test_data = any(step.get("test_data") for step in test_case.get("steps", []))
            
            return (priority_score * 10) + step_count + (1 if has_test_data else 0)
        
        return max(group, key=score)
    
    def _optimize_assertions(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize assertions using priority-based selection.
        
        High Priority:
        - Page title changes
        - Success/error messages
        - Data submissions confirmed
        - Critical UI elements appear
        
        Low Priority (filter out):
        - Hover states
        - Tooltip appearances
        - Minor animations
        """
        optimized_steps = []
        
        for step in test_case.get("steps", []):
            expected = step.get("expected_result", "")
            expected_lower = expected.lower()
            
            # Check if assertion is high priority
            is_high_priority = False
            
            for priority_item in self.assertion_priority["high"]:
                if priority_item in expected_lower:
                    is_high_priority = True
                    break
            
            # Check if assertion is low priority (should be filtered)
            is_low_priority = False
            for low_item in self.assertion_priority["low"]:
                if low_item in expected_lower:
                    is_low_priority = True
                    break
            
            # Keep step if high priority or not low priority
            if is_high_priority or not is_low_priority:
                optimized_steps.append(step)
            else:
                # Remove low-priority assertion but keep action
                step_copy = step.copy()
                step_copy["expected_result"] = "Action completes"
                optimized_steps.append(step_copy)
        
        test_case["steps"] = optimized_steps
        return test_case
    
    def _parameterize_similar_cases(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Parameterize similar test cases.
        
        Example:
        Test 1: Login with valid username "user1"
        Test 2: Login with valid username "user2"
        → Merge into: Login with valid username <username>
           Examples: | username |
                     | user1    |
                     | user2    |
        """
        # Group test cases by action pattern
        pattern_groups = defaultdict(list)
        
        for test_case in test_cases:
            # Extract action pattern (without specific values)
            pattern = self._extract_action_pattern(test_case)
            pattern_groups[pattern].append(test_case)
        
        parameterized = []
        
        for pattern, group in pattern_groups.items():
            if len(group) == 1:
                parameterized.append(group[0])
            else:
                # Check if we can parameterize
                parameterized_case = self._create_parameterized_case(group)
                if parameterized_case:
                    parameterized.append(parameterized_case)
                else:
                    # Can't parameterize, keep all
                    parameterized.extend(group)
        
        return parameterized
    
    def _extract_action_pattern(self, test_case: Dict[str, Any]) -> str:
        """Extract action pattern (without specific values)"""
        pattern_parts = []
        
        for step in test_case.get("steps", []):
            action = step.get("action", "")
            # Remove specific values
            action_clean = re.sub(r'"[^"]*"', '"<value>"', action)
            action_clean = re.sub(r'\d+', '<number>', action_clean)
            pattern_parts.append(action_clean)
        
        return "|".join(pattern_parts)
    
    def _create_parameterized_case(self, group: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Create parameterized test case from similar group"""
        if len(group) < 2:
            return None
        
        # Use first test case as template
        template = group[0].copy()
        
        # Extract parameterizable values
        parameters = {}
        examples = []
        
        for i, test_case in enumerate(group):
            example_row = {}
            
            for step in test_case.get("steps", []):
                test_data = step.get("test_data")
                if test_data and test_data.get("value"):
                    value = test_data["value"]
                    # Check if it's a parameterizable value (not already parameterized)
                    if not value.startswith("{{"):
                        # Find parameter name
                        element = step.get("element_name", "field")
                        param_name = element.lower().replace(" ", "_")
                        
                        if param_name not in parameters:
                            parameters[param_name] = []
                        
                        if value not in parameters[param_name]:
                            parameters[param_name].append(value)
                        
                        example_row[param_name] = value
            
            if example_row:
                examples.append(example_row)
        
        # If we found parameters, create parameterized case
        if parameters and examples:
            # Update template steps to use parameters
            for step in template["steps"]:
                test_data = step.get("test_data")
                if test_data and test_data.get("value"):
                    element = step.get("element_name", "field")
                    param_name = element.lower().replace(" ", "_")
                    if param_name in parameters:
                        step["test_data"]["parameterized"] = True
                        step["test_data"]["parameter"] = f"{{{{test_data.{param_name}}}}}"
                        step["action"] = step["action"].replace(
                            test_data["value"],
                            f"{{{{test_data.{param_name}}}}}"
                        )
            
            template["parameterized"] = True
            template["parameters"] = list(parameters.keys())
            template["examples"] = examples[:5]  # Limit to 5 examples
            template["title"] = f"{template['title']} (Parameterized)"
            
            return template
        
        return None
    
    def calculate_path_importance(
        self,
        path: Dict[str, Any],
        frequency: float,
        business_value: float,
        code_coverage: float = 0.5,
        defect_history: float = 0.5
    ) -> float:
        """
        Calculate path importance score.
        
        Score = (frequency * 0.4) + 
                (business_value * 0.3) + 
                (code_coverage * 0.2) + 
                (defect_history * 0.1)
        """
        score = (
            (frequency * 0.4) +
            (business_value * 0.3) +
            (code_coverage * 0.2) +
            (defect_history * 0.1)
        )
        return min(score, 1.0)  # Cap at 1.0
    
    def filter_top_paths(
        self,
        paths: List[Dict[str, Any]],
        top_percent: float = 0.2
    ) -> List[Dict[str, Any]]:
        """
        Filter to top N% highest-scoring paths.
        
        Generate test cases for top 20% highest-scoring paths first.
        """
        if not paths:
            return []
        
        # Sort by score
        sorted_paths = sorted(paths, key=lambda p: p.get("score", 0), reverse=True)
        
        # Take top N%
        top_count = max(1, int(len(sorted_paths) * top_percent))
        
        return sorted_paths[:top_count]



