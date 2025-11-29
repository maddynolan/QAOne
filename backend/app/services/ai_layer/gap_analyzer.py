"""
Gap Analyzer - Thin AI Layer
Analyzes test coverage and suggests gaps.
Uses LLM for high-level analysis, not for test generation.
"""

import logging
from typing import Dict, List, Any, Optional
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class GapAnalyzer:
    """
    Analyzes test coverage gaps using LLM.
    Input: Current coverage, action graph, requirements
    Output: Gap analysis and suggestions
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def analyze_gaps(
        self,
        current_tests: List[Dict[str, Any]],
        action_graph: Any,  # ActionGraph
        requirements: Optional[List[Dict[str, Any]]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze test coverage gaps.
        
        Args:
            current_tests: List of existing test cases
            action_graph: Action graph from recording
            requirements: Optional requirements
            tenant_id: Tenant ID for LLM calls
            
        Returns:
            Gap analysis with suggestions
        """
        # Extract coverage summary
        test_types = {}
        for test in current_tests:
            test_type = test.get("test_type", "unknown")
            test_types[test_type] = test_types.get(test_type, 0) + 1
        
        # Extract flows from action graph
        flows = self._extract_flows_summary(action_graph)
        
        # Build prompt
        prompt = f"""Analyze test coverage gaps for this application.

CURRENT TEST COVERAGE:
- Total tests: {len(current_tests)}
- Test types: {test_types}
- Test tags: {self._extract_tags_summary(current_tests)}

AVAILABLE FLOWS (from action graph):
{flows}

REQUIREMENTS:
{self._format_requirements(requirements) if requirements else 'None provided'}

INSTRUCTIONS:
1. Identify missing test scenarios (negative, boundary, edge cases)
2. Suggest additional test cases that would improve coverage
3. Highlight critical flows that lack test coverage
4. Recommend priority areas for testing

Respond with JSON:
{{
  "gaps": [
    {{
      "type": "missing_scenario|missing_flow|missing_negative|missing_boundary",
      "description": "Description of the gap",
      "priority": "high|medium|low",
      "suggestion": "Suggested test case or scenario"
    }}
  ],
  "coverage_score": 0.0-1.0,
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}}"""
        
        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",  # Use better model for analysis
            validate_json=True,
            task_type="test_design",
            max_tokens=1500,
            use_fast_model=False  # Use better model for analysis
        )
        
        try:
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            if result and result.response:
                import json
                analysis = json.loads(result.response)
                
                logger.info(f"Gap analysis completed: {len(analysis.get('gaps', []))} gaps identified")
                return analysis
            else:
                logger.warning("LLM returned empty response for gap analysis")
                return {
                    "gaps": [],
                    "coverage_score": 0.5,
                    "recommendations": ["Unable to analyze gaps - LLM response empty"]
                }
                
        except Exception as e:
            logger.warning(f"Gap analysis failed: {e}")
            return {
                "gaps": [],
                "coverage_score": 0.5,
                "recommendations": [f"Gap analysis failed: {str(e)}"]
            }
    
    def _extract_flows_summary(self, action_graph: Any) -> str:
        """Extract flows summary from action graph"""
        if not action_graph or not action_graph.nodes:
            return "No flows available"
        
        flows = []
        for node in action_graph.nodes[:10]:  # Limit to 10 nodes
            flows.append(f"- {node.title or node.url_pattern}")
        
        return "\n".join(flows)
    
    def _extract_tags_summary(self, tests: List[Dict[str, Any]]) -> Dict[str, int]:
        """Extract tags summary"""
        tag_counts = {}
        for test in tests:
            for tag in test.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        return tag_counts
    
    def _format_requirements(self, requirements: List[Dict[str, Any]]) -> str:
        """Format requirements for prompt"""
        formatted = []
        for req in requirements[:10]:  # Limit to 10
            formatted.append(f"- {req.get('title', '')}: {req.get('description', '')[:100]}")
        return "\n".join(formatted)



