"""
Quality Enhancer - Phase 3
Adds confidence scores and quality metrics to test cases.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class QualityEnhancer:
    """
    Enhances test cases with quality metrics and confidence scores.
    """
    
    def __init__(self):
        pass
    
    def enhance_test_case(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add quality metrics to test case.
        
        Adds:
        - confidence_score: 0.0-1.0
        - quality_metrics: assertion_coverage, element_identification_quality, completeness
        - requires_manual_review: boolean
        """
        # Calculate metrics
        assertion_coverage = self._calculate_assertion_coverage(test_case)
        element_quality = self._calculate_element_identification_quality(test_case)
        completeness = self._calculate_completeness(test_case)
        
        # Calculate overall confidence
        confidence_score = (
            (assertion_coverage * 0.4) +
            (element_quality * 0.3) +
            (completeness * 0.3)
        )
        
        # Determine if manual review needed
        requires_review = confidence_score < 0.7 or completeness < 0.6
        
        # Add to test case
        test_case["confidence_score"] = round(confidence_score, 2)
        test_case["quality_metrics"] = {
            "assertion_coverage": round(assertion_coverage, 2),
            "element_identification_quality": round(element_quality, 2),
            "completeness": round(completeness, 2)
        }
        test_case["requires_manual_review"] = requires_review
        
        return test_case
    
    def _calculate_assertion_coverage(self, test_case: Dict[str, Any]) -> float:
        """
        Calculate assertion coverage.
        
        Coverage = steps with expected results / total steps
        """
        steps = test_case.get("steps", [])
        if not steps:
            return 0.0
        
        steps_with_assertions = sum(
            1 for step in steps
            if step.get("expected_result") and step.get("expected_result") != "Action completes successfully"
        )
        
        return steps_with_assertions / len(steps) if steps else 0.0
    
    def _calculate_element_identification_quality(self, test_case: Dict[str, Any]) -> float:
        """
        Calculate element identification quality.
        
        Quality based on:
        - Has semantic selectors (data-test-id, aria-label)
        - Has readable element names
        - Has fallback selectors
        """
        steps = test_case.get("steps", [])
        if not steps:
            return 0.0
        
        quality_scores = []
        
        for step in steps:
            score = 0.0
            
            # Check selector quality
            selector = step.get("selector", "")
            if selector:
                if "data-test-id" in selector.lower():
                    score += 0.4
                elif "aria-label" in selector.lower() or "aria-labelledby" in selector.lower():
                    score += 0.3
                elif selector.startswith("#") or selector.startswith("."):
                    score += 0.2
                else:
                    score += 0.1
            
            # Check element name quality
            element_name = step.get("element_name", "")
            if element_name:
                # Check if it's semantic (not generic)
                if element_name.lower() not in ["element", "field", "button", "link"]:
                    score += 0.3
                else:
                    score += 0.1
            
            # Check for fallback
            if step.get("selector") and len(selector) > 5:
                score += 0.3
            
            quality_scores.append(min(score, 1.0))
        
        return sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
    
    def _calculate_completeness(self, test_case: Dict[str, Any]) -> float:
        """
        Calculate test case completeness.
        
        Completeness based on:
        - Has title and description
        - Has preconditions
        - Has steps (at least 2)
        - Has expected results
        - Has postconditions
        """
        score = 0.0
        
        # Title and description (20%)
        if test_case.get("title"):
            score += 0.1
        if test_case.get("description"):
            score += 0.1
        
        # Preconditions (20%)
        if test_case.get("preconditions"):
            score += 0.2
        
        # Steps (30%)
        steps = test_case.get("steps", [])
        if len(steps) >= 2:
            score += 0.3
        elif len(steps) == 1:
            score += 0.15
        
        # Expected results (20%)
        has_expected = any(
            step.get("expected_result") for step in steps
        )
        if has_expected:
            score += 0.2
        
        # Postconditions (10%)
        if test_case.get("postconditions"):
            score += 0.1
        
        return min(score, 1.0)
    
    def enhance_batch(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enhance multiple test cases"""
        enhanced = []
        
        for test_case in test_cases:
            enhanced_case = self.enhance_test_case(test_case)
            enhanced.append(enhanced_case)
        
        return enhanced



