"""
Requirements to Gherkin Converter
Enhanced converter that translates requirements to proper Gherkin format
"""

import logging
from typing import Dict, List, Any, Optional
import re
from datetime import datetime

logger = logging.getLogger(__name__)


class GherkinConverter:
    """
    Enhanced converter for translating requirements to Gherkin format
    Supports various requirement formats and generates comprehensive Gherkin features
    """
    
    def __init__(self):
        self.given_keywords = ["given", "precondition", "setup", "assume", "navigate", "open", "access", "have", "am on", "exists"]
        self.when_keywords = ["when", "action", "perform", "execute", "click", "enter", "fill", "type", "select", "submit", "press", "tap"]
        self.then_keywords = ["then", "verify", "check", "validate", "confirm", "assert", "should see", "should be", "should display", "expect"]
        self.and_keywords = ["and", "also", "additionally"]
        self.but_keywords = ["but", "however", "except"]
    
    def convert_requirement_to_gherkin(
        self,
        requirement: Dict[str, Any],
        include_background: bool = True,
        include_scenarios: bool = True,
        max_scenarios: int = 5
    ) -> str:
        """
        Convert a requirement to Gherkin format
        
        Args:
            requirement: Requirement dictionary with title, description, etc.
            include_background: Whether to include Background section
            include_scenarios: Whether to generate scenarios
            max_scenarios: Maximum number of scenarios to generate
            
        Returns:
            Gherkin feature file content
        """
        title = requirement.get("title", "Feature")
        description = requirement.get("description", "")
        source = requirement.get("source", "application")
        acceptance_criteria = requirement.get("acceptance_criteria", [])
        test_cases = requirement.get("test_cases", [])
        
        # Build feature header
        feature_lines = []
        feature_lines.append(f"Feature: {title}")
        
        # Add user story format if description available
        if description:
            user_story = self._extract_user_story(description)
            if user_story:
                feature_lines.append(f"  {user_story}")
            else:
                feature_lines.append(f"  As a user")
                feature_lines.append(f"  I want to {description.lower()[:100]}")
                feature_lines.append(f"  So that I can accomplish my task")
        
        feature_lines.append("")
        
        # Add Background section
        if include_background:
            background = self._generate_background(source, requirement)
            if background:
                feature_lines.append(background)
                feature_lines.append("")
        
        # Generate scenarios
        if include_scenarios:
            scenarios = []
            
            # From acceptance criteria
            if acceptance_criteria:
                for ac in acceptance_criteria[:max_scenarios]:
                    scenario = self._convert_acceptance_criteria_to_scenario(ac, title)
                    if scenario:
                        scenarios.append(scenario)
            
            # From test cases
            if test_cases and len(scenarios) < max_scenarios:
                for tc in test_cases[:max_scenarios - len(scenarios)]:
                    scenario = self._convert_test_case_to_scenario(tc, title)
                    if scenario:
                        scenarios.append(scenario)
            
            # Generate default scenarios if none found
            if not scenarios:
                scenarios = self._generate_default_scenarios(title, description, source)
            
            # Add scenarios to feature
            for scenario in scenarios[:max_scenarios]:
                feature_lines.append(scenario)
                feature_lines.append("")
        
        return "\n".join(feature_lines)
    
    def _extract_user_story(self, description: str) -> Optional[str]:
        """Extract user story format from description"""
        # Look for "As a... I want to... So that..." pattern
        pattern = r'As\s+a\s+([^,]+),\s*I\s+want\s+to\s+([^,]+),\s*so\s+that\s+(.+)'
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            return f"As a {match.group(1).strip()}\n  I want to {match.group(2).strip()}\n  So that {match.group(3).strip()}"
        return None
    
    def _generate_background(self, source: str, requirement: Dict[str, Any]) -> str:
        """Generate Background section"""
        background_lines = ["  Background:"]
        
        # Add common preconditions
        if source:
            background_lines.append(f"    Given I am on the {source} application")
        
        # Check if requirement has authentication
        if requirement.get("requires_auth", True):
            background_lines.append("    And I have valid access credentials")
        
        # Add any specific preconditions from requirement
        preconditions = requirement.get("preconditions", [])
        for precondition in preconditions[:3]:  # Limit to 3
            if isinstance(precondition, str):
                step = self._normalize_step(precondition, "given")
                background_lines.append(f"    {step}")
        
        return "\n".join(background_lines)
    
    def _convert_acceptance_criteria_to_scenario(self, ac: Any, feature_title: str) -> str:
        """Convert acceptance criteria to Gherkin scenario"""
        if isinstance(ac, str):
            # Try to parse the AC
            scenario_name = f"Scenario: {ac[:50]}"
            steps = self._parse_steps_from_text(ac)
        elif isinstance(ac, dict):
            scenario_name = f"Scenario: {ac.get('title', ac.get('description', 'Acceptance Criteria'))}"
            steps = ac.get("steps", [])
            if not steps and ac.get("description"):
                steps = self._parse_steps_from_text(ac.get("description"))
        else:
            return ""
        
        if not steps:
            return ""
        
        scenario_lines = [f"  {scenario_name}"]
        for step in steps:
            normalized_step = self._normalize_step(step, None)
            scenario_lines.append(f"    {normalized_step}")
        
        return "\n".join(scenario_lines)
    
    def _convert_test_case_to_scenario(self, tc: Dict[str, Any], feature_title: str) -> str:
        """Convert test case to Gherkin scenario"""
        scenario_name = tc.get("title", tc.get("name", "Test Scenario"))
        scenario_lines = [f"  Scenario: {scenario_name}"]
        
        steps = tc.get("steps", tc.get("test_steps", []))
        if not steps:
            return ""
        
        for step in steps:
            if isinstance(step, dict):
                action = step.get("action", step.get("step", ""))
                expected = step.get("expected_result", step.get("expected", ""))
                
                if action:
                    normalized_action = self._normalize_step(action, None)
                    scenario_lines.append(f"    {normalized_action}")
                
                if expected and expected != action:
                    normalized_expected = self._normalize_step(expected, "then")
                    scenario_lines.append(f"    {normalized_expected}")
            elif isinstance(step, str):
                normalized_step = self._normalize_step(step, None)
                scenario_lines.append(f"    {normalized_step}")
        
        return "\n".join(scenario_lines)
    
    def _generate_default_scenarios(self, title: str, description: str, source: str) -> List[str]:
        """Generate default scenarios when none are provided"""
        scenarios = []
        
        # Happy path scenario
        happy_path = f"""  Scenario: Successful {title}
    Given I am on the {source} application
    When I perform the action: {description[:100]}
    Then I should see the expected result
    And the operation should complete successfully"""
        scenarios.append(happy_path)
        
        # Error handling scenario
        error_handling = f"""  Scenario: Error handling for {title}
    Given I am on the {source} application
    When I attempt to perform the action with invalid or missing data
    Then I should see an appropriate error message
    And the system should handle the error gracefully"""
        scenarios.append(error_handling)
        
        # Alternative flow scenario
        alternative = f"""  Scenario: Alternative flow for {title}
    Given I am on the {source} application
    When I perform an alternative action
    Then I should see the alternative result
    And I should be able to proceed with the workflow"""
        scenarios.append(alternative)
        
        return scenarios
    
    def _parse_steps_from_text(self, text: str) -> List[str]:
        """Parse steps from natural language text"""
        steps = []
        
        # Split by common separators
        sentences = re.split(r'[.!?]\s+', text)
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 10:  # Filter out very short sentences
                steps.append(sentence)
        
        return steps[:10]  # Limit to 10 steps
    
    def _normalize_step(self, step: str, default_keyword: Optional[str] = None) -> str:
        """Normalize a step to proper Gherkin format"""
        step_lower = step.lower().strip()
        
        # Determine keyword
        keyword = None
        
        if default_keyword:
            keyword = default_keyword.title()
        elif any(kw in step_lower for kw in self.given_keywords):
            keyword = "Given"
        elif any(kw in step_lower for kw in self.when_keywords):
            keyword = "When"
        elif any(kw in step_lower for kw in self.then_keywords):
            keyword = "Then"
        elif step_lower.startswith("and "):
            keyword = "And"
        elif step_lower.startswith("but "):
            keyword = "But"
        else:
            # Default to When if unclear
            keyword = "When"
        
        # Clean up the step text
        step_text = step.strip()
        
        # Remove existing keywords if present
        for kw in ["Given", "When", "Then", "And", "But"]:
            if step_text.startswith(kw + " "):
                step_text = step_text[len(kw) + 1:].strip()
        
        # Capitalize first letter
        if step_text:
            step_text = step_text[0].upper() + step_text[1:] if len(step_text) > 1 else step_text.upper()
        
        return f"{keyword} {step_text}"
    
    def convert_batch_requirements(
        self,
        requirements: List[Dict[str, Any]],
        output_format: str = "feature_files"
    ) -> Dict[str, Any]:
        """
        Convert multiple requirements to Gherkin
        
        Args:
            requirements: List of requirement dictionaries
            output_format: "feature_files" (separate files) or "single_file" (combined)
            
        Returns:
            Dictionary with converted Gherkin features
        """
        results = {}
        
        if output_format == "single_file":
            # Combine all into one feature file
            combined_lines = ["Feature: Combined Requirements\n"]
            for req in requirements:
                gherkin = self.convert_requirement_to_gherkin(req, include_background=False)
                combined_lines.append(gherkin)
                combined_lines.append("")
            results["combined"] = "\n".join(combined_lines)
        else:
            # Separate feature files
            for req in requirements:
                req_id = req.get("id", req.get("title", "unknown"))
                gherkin = self.convert_requirement_to_gherkin(req)
                results[req_id] = gherkin
        
        return {
            "format": output_format,
            "total_requirements": len(requirements),
            "features": results
        }


