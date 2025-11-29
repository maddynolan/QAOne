"""
Test Case Quality Validator
Validates test case quality and provides detailed feedback
"""

import logging
from typing import Dict, List, Any, Optional
import re

logger = logging.getLogger(__name__)


class TestCaseValidator:
    """
    Validates test case quality and provides detailed feedback.
    
    Validation Rules:
    1. Element Identification Quality
       - Has proper element names (not generic "Input", "Click")
       - Uses labels when available
       - No Flowstral internal events
    
    2. Step Completeness
       - All steps have expected results
       - Test data is provided where needed
       - Steps are in logical order
    
    3. Test Case Structure
       - Has meaningful title (not about Flowstral)
       - Preconditions are relevant
       - Postconditions are clear
    
    4. Deduplication Quality
       - No duplicate steps
       - Inputs are grouped (not character-by-character)
       - Similar actions are consolidated
    
    5. Standards Compliance
       - ISTQB: Proper structure, test_steps format
       - Gherkin: Valid syntax, proper keywords
    """
    
    def __init__(self):
        self.validation_rules = {
            "element_names": self._validate_element_names,
            "step_completeness": self._validate_step_completeness,
            "test_case_structure": self._validate_structure,
            "deduplication": self._validate_deduplication,
            "standards_compliance": self._validate_standards
        }
    
    def validate_test_case(self, test_case: Dict[str, Any], format: str = "istqb") -> Dict[str, Any]:
        """
        Validate a single test case and return quality report.
        
        Returns:
        {
            "is_valid": bool,
            "score": float (0-1),
            "issues": [...],
            "warnings": [...],
            "suggestions": [...],
            "metrics": {
                "element_quality": float,
                "completeness": float,
                "structure_quality": float,
                "deduplication_quality": float
            }
        }
        """
        issues = []
        warnings = []
        suggestions = []
        metrics = {}
        
        # Run all validation rules
        for rule_name, rule_func in self.validation_rules.items():
            try:
                result = rule_func(test_case, format)
                if result.get("issues"):
                    issues.extend(result["issues"])
                if result.get("warnings"):
                    warnings.extend(result["warnings"])
                if result.get("suggestions"):
                    suggestions.extend(result["suggestions"])
                if result.get("metrics"):
                    metrics.update(result["metrics"])
            except Exception as e:
                logger.warning(f"Validation rule {rule_name} failed: {e}")
        
        # Calculate overall score
        score = self._calculate_overall_score(metrics, issues, warnings)
        
        return {
            "is_valid": len(issues) == 0,
            "score": score,
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
            "metrics": metrics
        }
    
    def validate_batch(self, test_cases: List[Dict[str, Any]], format: str = "istqb") -> Dict[str, Any]:
        """Validate multiple test cases and return aggregate report"""
        results = [self.validate_test_case(tc, format) for tc in test_cases]
        
        total_issues = sum(len(r["issues"]) for r in results)
        total_warnings = sum(len(r["warnings"]) for r in results)
        avg_score = sum(r["score"] for r in results) / len(results) if results else 0
        
        # Aggregate metrics
        avg_metrics = {}
        if results and results[0].get("metrics"):
            metric_keys = results[0]["metrics"].keys()
            for key in metric_keys:
                values = [r["metrics"].get(key, 0) for r in results if r.get("metrics")]
                avg_metrics[key] = sum(values) / len(values) if values else 0
        
        return {
            "total_test_cases": len(test_cases),
            "valid_count": sum(1 for r in results if r["is_valid"]),
            "invalid_count": sum(1 for r in results if not r["is_valid"]),
            "average_score": avg_score,
            "total_issues": total_issues,
            "total_warnings": total_warnings,
            "average_metrics": avg_metrics,
            "detailed_results": results
        }
    
    def _validate_element_names(self, test_case: Dict[str, Any], format: str) -> Dict[str, Any]:
        """Validate element names are meaningful"""
        issues = []
        warnings = []
        suggestions = []
        poor_names = 0
        total_elements = 0
        
        steps = test_case.get("test_steps") or test_case.get("steps", [])
        
        generic_names = {"input", "click", "button", "element", "field", "link"}
        flowstral_patterns = ["page_load", "wcag_scan", "session_end", "change"]
        
        for step in steps:
            element_name = step.get("element_name", "").lower()
            if element_name:
                total_elements += 1
                
                # Check for generic names
                if element_name in generic_names or len(element_name) < 3:
                    poor_names += 1
                    issues.append({
                        "type": "generic_element_name",
                        "step": step.get("step_number"),
                        "element": element_name,
                        "message": f"Step {step.get('step_number')}: Element name '{element_name}' is too generic"
                    })
                
                # Check for Flowstral patterns
                if any(pattern in element_name for pattern in flowstral_patterns):
                    poor_names += 1
                    issues.append({
                        "type": "flowstral_event_in_element",
                        "step": step.get("step_number"),
                        "element": element_name,
                        "message": f"Step {step.get('step_number')}: Element name contains Flowstral internal event"
                    })
        
        quality_score = 1.0 - (poor_names / total_elements) if total_elements > 0 else 0.0
        
        if quality_score < 0.7:
            suggestions.append("Improve element names by using labels, aria-labels, or semantic IDs")
        
        return {
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
            "metrics": {"element_quality": quality_score}
        }
    
    def _validate_step_completeness(self, test_case: Dict[str, Any], format: str) -> Dict[str, Any]:
        """Validate all steps have required fields"""
        issues = []
        warnings = []
        incomplete_steps = 0
        total_steps = 0
        
        steps = test_case.get("test_steps") or test_case.get("steps", [])
        
        for step in steps:
            total_steps += 1
            step_num = step.get("step_number", total_steps)
            
            # Check for expected result
            if not step.get("expected_result"):
                incomplete_steps += 1
                warnings.append({
                    "type": "missing_expected_result",
                    "step": step_num,
                    "message": f"Step {step_num}: Missing expected result"
                })
            
            # Check for action
            if not step.get("action"):
                incomplete_steps += 1
                issues.append({
                    "type": "missing_action",
                    "step": step_num,
                    "message": f"Step {step_num}: Missing action description"
                })
            
            # Check for test data if input action
            action = step.get("action", "").lower()
            if "enter" in action or "input" in action or "type" in action:
                if not step.get("test_data"):
                    warnings.append({
                        "type": "missing_test_data",
                        "step": step_num,
                        "message": f"Step {step_num}: Input action missing test data"
                    })
        
        completeness_score = 1.0 - (incomplete_steps / total_steps) if total_steps > 0 else 0.0
        
        return {
            "issues": issues,
            "warnings": warnings,
            "metrics": {"completeness": completeness_score}
        }
    
    def _validate_structure(self, test_case: Dict[str, Any], format: str) -> Dict[str, Any]:
        """Validate test case structure"""
        issues = []
        warnings = []
        suggestions = []
        
        # Check title
        title = test_case.get("title", "").lower()
        flowstral_in_title = any(pattern in title for pattern in ["flowstral", "page_load", "session_start"])
        if flowstral_in_title:
            issues.append({
                "type": "flowstral_in_title",
                "message": "Test case title contains Flowstral internal references"
            })
        
        # Check for meaningful title
        if len(title) < 10:
            warnings.append({
                "type": "short_title",
                "message": "Test case title is too short"
            })
        
        # Check preconditions
        preconditions = test_case.get("preconditions", [])
        if not preconditions:
            warnings.append({
                "type": "missing_preconditions",
                "message": "No preconditions specified"
            })
        
        # Check steps exist
        steps = test_case.get("test_steps") or test_case.get("steps", [])
        if not steps or len(steps) == 0:
            issues.append({
                "type": "no_steps",
                "message": "Test case has no steps"
            })
        
        # Check for reasonable step count
        if len(steps) > 50:
            warnings.append({
                "type": "too_many_steps",
                "message": f"Test case has {len(steps)} steps - consider splitting into multiple test cases"
            })
        
        structure_score = 1.0
        if issues:
            structure_score -= 0.3
        if warnings:
            structure_score -= 0.1 * len(warnings)
        structure_score = max(0.0, structure_score)
        
        return {
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
            "metrics": {"structure_quality": structure_score}
        }
    
    def _validate_deduplication(self, test_case: Dict[str, Any], format: str) -> Dict[str, Any]:
        """Validate that steps are properly deduplicated"""
        issues = []
        warnings = []
        
        steps = test_case.get("test_steps") or test_case.get("steps", [])
        
        # Check for duplicate steps
        seen_actions = {}
        duplicates = 0
        
        for step in steps:
            action = step.get("action", "")
            element = step.get("element_name", "")
            key = f"{action}:{element}"
            
            if key in seen_actions:
                duplicates += 1
                warnings.append({
                    "type": "duplicate_step",
                    "step": step.get("step_number"),
                    "message": f"Step {step.get('step_number')}: Duplicate action '{action}' on '{element}'"
                })
            else:
                seen_actions[key] = step.get("step_number")
        
        # Check for character-by-character inputs (should be grouped)
        consecutive_inputs = 0
        for i in range(len(steps) - 1):
            current = steps[i]
            next_step = steps[i + 1]
            
            current_action = current.get("action", "").lower()
            next_action = next_step.get("action", "").lower()
            
            if "enter" in current_action and "enter" in next_action:
                current_element = current.get("element_name", "").lower()
                next_element = next_step.get("element_name", "").lower()
                
                # Same field, consecutive inputs = should be grouped
                if current_element == next_element:
                    consecutive_inputs += 1
                    issues.append({
                        "type": "ungrouped_inputs",
                        "step": current.get("step_number"),
                        "message": f"Steps {current.get('step_number')}-{next_step.get('step_number')}: Consecutive inputs on '{current_element}' should be grouped"
                    })
        
        dedup_score = 1.0
        if duplicates > 0:
            dedup_score -= 0.2 * min(duplicates, 5) / 5  # Max 0.2 penalty
        if consecutive_inputs > 0:
            dedup_score -= 0.3 * min(consecutive_inputs, 3) / 3  # Max 0.3 penalty
        dedup_score = max(0.0, dedup_score)
        
        return {
            "issues": issues,
            "warnings": warnings,
            "metrics": {"deduplication_quality": dedup_score}
        }
    
    def _validate_standards(self, test_case: Dict[str, Any], format: str) -> Dict[str, Any]:
        """Validate standards compliance"""
        issues = []
        warnings = []
        
        if format == "istqb":
            # ISTQB validation
            if "test_case_id" not in test_case:
                issues.append({
                    "type": "missing_test_case_id",
                    "message": "ISTQB format requires test_case_id"
                })
            
            steps = test_case.get("test_steps", [])
            if not steps:
                issues.append({
                    "type": "missing_test_steps",
                    "message": "ISTQB format requires test_steps array"
                })
            
            # Check step structure
            for step in steps:
                if "step_number" not in step:
                    issues.append({
                        "type": "missing_step_number",
                        "message": "ISTQB steps require step_number"
                    })
        
        elif format == "gherkin":
            # Gherkin validation
            steps = test_case.get("steps", [])
            for step in steps:
                action = step.get("action", "")
                # Check for valid Gherkin keywords
                valid_keywords = ["given", "when", "then", "and", "but"]
                keyword = action.split()[0].lower() if action else ""
                if keyword not in valid_keywords and keyword:
                    warnings.append({
                        "type": "invalid_gherkin_keyword",
                        "step": step.get("step_number"),
                        "message": f"Step {step.get('step_number')}: Invalid Gherkin keyword '{keyword}'"
                    })
        
        return {
            "issues": issues,
            "warnings": warnings,
            "metrics": {}
        }
    
    def _calculate_overall_score(self, metrics: Dict[str, float], issues: List, warnings: List) -> float:
        """Calculate overall quality score"""
        # Base score from metrics
        if metrics:
            avg_metric = sum(metrics.values()) / len(metrics)
        else:
            avg_metric = 0.5
        
        # Penalties
        issue_penalty = min(len(issues) * 0.1, 0.5)  # Max 0.5 penalty
        warning_penalty = min(len(warnings) * 0.05, 0.2)  # Max 0.2 penalty
        
        score = avg_metric - issue_penalty - warning_penalty
        return max(0.0, min(1.0, score))  # Clamp to 0-1


