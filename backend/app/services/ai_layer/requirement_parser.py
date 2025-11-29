"""
Requirement Parser - Thin AI Layer (Optional)
Parses unstructured requirement text into structured format.
Only used when requirements are in free text, not structured format.
"""

import logging
from typing import Dict, List, Any, Optional
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class RequirementParser:
    """
    Parses unstructured requirement text into structured format.
    Only uses LLM when requirements are not already structured.
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def parse_requirement(
        self,
        requirement_text: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Parse unstructured requirement text.
        
        Args:
            requirement_text: Raw requirement text (e.g., from Jira description)
            tenant_id: Tenant ID for LLM calls
            
        Returns:
            Structured requirement object
        """
        prompt = f"""Parse this requirement text into a structured format.

REQUIREMENT TEXT:
{requirement_text}

INSTRUCTIONS:
1. Extract actors (who performs the action)
2. Extract preconditions (what must be true before)
3. Extract main flow (primary user journey)
4. Extract alternate flows (alternative paths)
5. Extract acceptance criteria
6. Extract test scenarios

Respond with JSON:
{{
  "title": "Clear requirement title",
  "description": "Detailed description",
  "actors": ["actor1", "actor2"],
  "preconditions": ["precondition1", "precondition2"],
  "main_flow": [
    {{"step": 1, "action": "User action", "expected": "Expected result"}}
  ],
  "alternate_flows": [
    {{"name": "Alternate flow name", "steps": [...]}}
  ],
  "acceptance_criteria": ["criterion1", "criterion2"],
  "test_scenarios": ["scenario1", "scenario2"]
}}"""
        
        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True,
            task_type="requirements",
            max_tokens=1500,
            use_fast_model=False  # Use better model for parsing
        )
        
        try:
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            if result and result.response:
                import json
                parsed = json.loads(result.response)
                
                logger.info(f"Parsed requirement: {parsed.get('title', 'Unknown')}")
                return parsed
            else:
                logger.warning("LLM returned empty response for requirement parsing")
                return {
                    "title": "Unparsed Requirement",
                    "description": requirement_text,
                    "actors": [],
                    "preconditions": [],
                    "main_flow": [],
                    "alternate_flows": [],
                    "acceptance_criteria": [],
                    "test_scenarios": []
                }
                
        except Exception as e:
            logger.warning(f"Requirement parsing failed: {e}")
            return {
                "title": "Unparsed Requirement",
                "description": requirement_text,
                "actors": [],
                "preconditions": [],
                "main_flow": [],
                "alternate_flows": [],
                "acceptance_criteria": [],
                "test_scenarios": []
            }



