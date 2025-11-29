"""
Test Case Beautifier - Thin AI Layer
Converts structured test cases to human-readable format.
Only uses LLM for beautification, not for logic generation.
"""

import logging
import json
from typing import Dict, List, Any, Optional
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class TestCaseBeautifier:
    """
    Beautifies structured test cases using LLM.
    Input: Structured test case from deterministic engine
    Output: Human-readable, natural language test case
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def beautify_test_case(
        self,
        test_case: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Beautify a structured test case.
        
        Args:
            test_case: Structured test case from TestDesignEngine
            tenant_id: Tenant ID for LLM calls
            
        Returns:
            Beautified test case with natural language descriptions
        """
        # Extract structured data
        title = test_case.get("title", "")
        description = test_case.get("description", "")
        steps = test_case.get("steps", [])
        tags = test_case.get("tags", [])
        priority = test_case.get("priority", "medium")
        
        # Build prompt for beautification
        prompt = f"""Convert this structured test case into a beautiful, human-readable format.

STRUCTURED TEST CASE:
Title: {title}
Description: {description}
Priority: {priority}
Tags: {', '.join(tags)}

Steps:
{self._format_steps_for_prompt(steps)}

INSTRUCTIONS:
1. Create a clear, concise title that describes what the test verifies
2. Write a detailed description that explains the test scenario
3. Convert each step into natural language (e.g., "User navigates to login page" instead of "action: navigate")
4. Make expected results clear and specific
5. Keep all technical details (selectors, pages) but make them readable

Respond with JSON:
{{
  "title": "Beautiful, clear title",
  "description": "Detailed description in natural language",
  "steps": [
    {{
      "step_number": 1,
      "action": "Natural language action description",
      "expected_result": "Clear expected outcome"
    }}
  ],
  "priority": "{priority}",
  "tags": {json.dumps(tags)}
}}"""
        
        gen_request = GenerationRequest(
            prompt=prompt,
            mode="quick",
            validate_json=True,
            task_type="test_design",
            max_tokens=1000,
            use_fast_model=True  # Use 7B for beautification (fast, good enough)
        )
        
        try:
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            if result and result.response:
                import json
                beautified = json.loads(result.response)
                
                # Merge with original (keep technical details)
                beautified["test_case_id"] = test_case.get("test_case_id")
                beautified["test_type"] = test_case.get("test_type")
                beautified["source"] = test_case.get("source", "beautified")
                beautified["original_steps"] = steps  # Keep original for reference
                
                logger.info(f"Beautified test case: {title}")
                return beautified
            else:
                logger.warning("LLM returned empty response for beautification, using original")
                return test_case
                
        except Exception as e:
            logger.warning(f"Beautification failed: {e}, using original test case")
            return test_case
    
    async def beautify_test_cases_batch(
        self,
        test_cases: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Beautify multiple test cases"""
        beautified = []
        
        for test_case in test_cases:
            beautified_case = await self.beautify_test_case(test_case, tenant_id)
            beautified.append(beautified_case)
        
        return beautified
    
    def _format_steps_for_prompt(self, steps: List[Dict[str, Any]]) -> str:
        """Format steps for LLM prompt"""
        formatted = []
        for step in steps:
            formatted.append(
                f"Step {step.get('step_number', '?')}: {step.get('action', '')} -> {step.get('expected_result', '')}"
            )
        return "\n".join(formatted)

