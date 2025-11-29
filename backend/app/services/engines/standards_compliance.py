"""
Standards Compliance Layer - Phase 3
Enforces ISTQB structure and generates Gherkin output.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json
import re

logger = logging.getLogger(__name__)


class StandardsCompliance:
    """
    Ensures test cases comply with ISTQB and Gherkin standards.
    """
    
    def __init__(self):
        self.test_case_counter = 0
    
    def format_istqb(self, test_case: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format test case to ISTQB structure.
        
        Structure:
        {
          "test_case_id": "TC_[AUTO_INCREMENT]",
          "title": "[Generated description]",
          "preconditions": [...],
          "test_steps": [
            {
              "step_number": 1,
              "action": "[Gherkin When/And]",
              "test_data": "[Captured input values]",
              "expected_result": "[Inferred from DOM changes]"
            }
          ],
          "postconditions": "[Final state description]",
          "priority": "[Based on path frequency]",
          "test_type": "[Functional/UI/E2E]",
          "traceability": "[Linked user story if available]"
        }
        """
        self.test_case_counter += 1
        
        istqb_case = {
            "test_case_id": f"TC_{self.test_case_counter:06d}",
            "title": test_case.get("title", "Untitled Test Case"),
            "description": test_case.get("description", ""),
            "preconditions": test_case.get("preconditions", []),
            "test_steps": [],
            "postconditions": test_case.get("postconditions", []),
            "priority": test_case.get("priority", "medium"),
            "test_type": self._determine_test_type(test_case),
            "traceability": test_case.get("traceability"),
            "tags": test_case.get("tags", []),
            "created_at": datetime.utcnow().isoformat(),
            "source": test_case.get("source", "unknown")
        }
        
        # Format steps - ensure we preserve all steps
        steps = test_case.get("steps", [])
        logger.debug(f"Formatting {len(steps)} steps for test case {istqb_case['test_case_id']}")
        
        for step in steps:
            istqb_step = {
                "step_number": step.get("step_number", 0),
                "action": step.get("action", ""),
                "test_data": step.get("test_data"),
                "expected_result": step.get("expected_result", ""),
                "element_name": step.get("element_name"),
                "selector": step.get("selector"),
                "page": step.get("page")
            }
            istqb_case["test_steps"].append(istqb_step)
        
        logger.debug(f"Formatted {len(istqb_case['test_steps'])} test_steps")
        
        return istqb_case
    
    def format_gherkin(self, test_case: Dict[str, Any], feature_name: Optional[str] = None) -> str:
        """
        Format test case to Gherkin .feature format.
        
        Format:
        Feature: [Detected feature from page context]
        
          @automated @priority-high
          Scenario: [Generated title]
            Given [Initial preconditions]
            And [Additional context]
            When [User action sequence]
            And [Intermediate steps]
            Then [Expected outcomes]
            And [Visual verification]
            
            # Auto-linked screenshot
            # Screenshot ID: [uuid]
            # DOM Snapshot ID: [uuid]
        """
        # Extract feature name
        if not feature_name:
            feature_name = self._extract_feature_name(test_case)
        
        # Build Gherkin
        lines = [f"Feature: {feature_name}", ""]
        
        # Tags
        tags = test_case.get("tags", [])
        if tags:
            tag_line = "  @" + " @".join(tags[:5])  # Limit to 5 tags
            lines.append(tag_line)
        
        # Scenario
        lines.append(f"  Scenario: {test_case.get('title', 'Untitled')}")
        
        # Preconditions (Given/And)
        preconditions = test_case.get("preconditions", [])
        for i, precond in enumerate(preconditions):
            keyword = "Given" if i == 0 else "And"
            lines.append(f"    {keyword} {precond}")
        
        # Steps (When/And/Then)
        steps = test_case.get("steps", [])
        when_found = False
        
        for step in steps:
            action = step.get("action", "")
            expected = step.get("expected_result", "")
            
            # Determine keyword
            if not when_found and any(kw in action.lower() for kw in ["click", "enter", "select", "navigate"]):
                keyword = "When"
                when_found = True
            elif expected or "should" in action.lower() or "then" in action.lower():
                keyword = "Then"
            else:
                keyword = "And"
            
            # Clean action (remove Gherkin keyword if present)
            clean_action = re.sub(r'^(Given|When|And|Then)\s+', '', action, flags=re.I)
            
            lines.append(f"    {keyword} {clean_action}")
            
            # Add expected result if separate
            if expected and expected != clean_action:
                lines.append(f"    And {expected}")
        
        # Postconditions
        postconditions = test_case.get("postconditions", [])
        for postcond in postconditions:
            lines.append(f"    And {postcond}")
        
        # Add metadata comments
        lines.append("")
        lines.append(f"    # Test Case ID: {test_case.get('test_case_id', 'N/A')}")
        lines.append(f"    # Priority: {test_case.get('priority', 'medium')}")
        lines.append(f"    # Source: {test_case.get('source', 'unknown')}")
        
        return "\n".join(lines)
    
    def _extract_feature_name(self, test_case: Dict[str, Any]) -> str:
        """Extract feature name from test case"""
        # Try to extract from first step's page
        steps = test_case.get("steps", [])
        if steps:
            first_page = steps[0].get("page")
            if first_page:
                # Extract feature from page name
                feature = first_page.split()[0] if first_page else "Application"
                return feature
        
        # Try to extract from title
        title = test_case.get("title", "")
        if title:
            # Extract first meaningful word
            words = title.split()
            if len(words) > 2:
                return " ".join(words[:2])
        
        return "Application Feature"
    
    def _determine_test_type(self, test_case: Dict[str, Any]) -> str:
        """Determine test type"""
        tags = test_case.get("tags", [])
        source = test_case.get("source", "")
        
        if "api" in tags or "api" in source.lower():
            return "API"
        elif "e2e" in tags or "end-to-end" in tags:
            return "E2E"
        elif "ui" in tags:
            return "UI"
        else:
            return "Functional"
    
    def format_multiple(
        self,
        test_cases: List[Dict[str, Any]],
        output_format: str = "istqb"
    ) -> List[Dict[str, Any]]:
        """Format multiple test cases"""
        formatted = []
        
        for test_case in test_cases:
            if output_format == "istqb":
                formatted.append(self.format_istqb(test_case))
            elif output_format == "gherkin":
                # Return as string for Gherkin
                formatted.append({
                    "test_case_id": test_case.get("test_case_id"),
                    "gherkin": self.format_gherkin(test_case)
                })
            else:
                formatted.append(test_case)
        
        return formatted

