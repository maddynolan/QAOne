# Custom LLM Service for QA AI Platform Backend
# This integrates with your custom LLM infrastructure

import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class CustomLLMConfig(BaseModel):
    model_endpoint: str
    api_key: str
    model_name: str
    temperature: float = 0.7
    max_tokens: int = 2000
    timeout: int = 30

class CustomLLMService:
    def __init__(self, config: Optional[CustomLLMConfig] = None):
        self.config = config or self._get_default_config()
        self.session: Optional[aiohttp.ClientSession] = None
    
    def _get_default_config(self) -> CustomLLMConfig:
        """Get default configuration from environment variables"""
        return CustomLLMConfig(
            model_endpoint=os.getenv("LLM_ENDPOINT", "http://localhost:8001/api/v1/generate"),
            api_key=os.getenv("LLM_API_KEY", ""),
            model_name=os.getenv("LLM_MODEL", "qa-ai-model"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "2000")),
            timeout=int(os.getenv("LLM_TIMEOUT", "30"))
        )
    
    async def initialize(self):
        """Initialize the HTTP session"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def cleanup(self):
        """Cleanup the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def generate_test_case(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a test case using custom LLM"""
        prompt = self._build_test_case_prompt(request)
        
        try:
            response = await self._call_llm(prompt)
            return self._parse_test_case_response(response)
        except Exception as e:
            logger.error(f"Error generating test case: {str(e)}")
            raise
    
    async def analyze_defect(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a defect using custom LLM"""
        prompt = self._build_defect_analysis_prompt(request)
        
        try:
            response = await self._call_llm(prompt)
            return self._parse_defect_analysis_response(response)
        except Exception as e:
            logger.error(f"Error analyzing defect: {str(e)}")
            raise
    
    async def generate_test_plan(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a test plan using custom LLM"""
        prompt = self._build_test_plan_prompt(request)
        
        try:
            response = await self._call_llm(prompt)
            return self._parse_test_plan_response(response)
        except Exception as e:
            logger.error(f"Error generating test plan: {str(e)}")
            raise
    
    async def optimize_test_suite(self, test_results: List[Dict[str, Any]]) -> List[str]:
        """Get optimization suggestions using custom LLM"""
        prompt = self._build_optimization_prompt(test_results)
        
        try:
            response = await self._call_llm(prompt)
            return self._parse_optimization_response(response)
        except Exception as e:
            logger.error(f"Error optimizing test suite: {str(e)}")
            raise
    
    async def _call_llm(self, prompt: str) -> str:
        """Call the custom LLM API"""
        if not self.session:
            await self.initialize()
        
        payload = {
            "model": self.config.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert QA engineer with deep knowledge of testing methodologies, automation frameworks, and quality assurance best practices. Always respond with valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        try:
            async with self.session.post(
                self.config.model_endpoint,
                json=payload,
                headers=headers
            ) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"LLM API error: {response.status} - {error_text}")
                
                data = await response.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        except asyncio.TimeoutError:
            raise Exception("LLM API timeout")
        except Exception as e:
            logger.error(f"Error calling LLM API: {str(e)}")
            raise
    
    def _build_test_case_prompt(self, request: Dict[str, Any]) -> str:
        """Build prompt for test case generation"""
        return f"""
Generate a comprehensive test case for the following feature:

**Feature**: {request.get('feature', 'Unknown')}
**Description**: {request.get('description', 'Not specified')}
**Requirements**: {request.get('requirements', 'Not specified')}
**Test Type**: {request.get('test_type', 'manual')}
**Complexity**: {request.get('complexity', 'medium')}
**Context**: {request.get('context', 'Not specified')}

Please provide a detailed test case including:
1. Clear test case name and description
2. Step-by-step test execution steps with expected results
3. Preconditions and test data requirements
4. Priority level based on risk assessment
5. Relevant tags for categorization
6. Estimated execution time
7. Optional automation script suggestions
8. Additional suggestions for edge cases

Respond in JSON format with this exact structure:
{{
  "testCase": {{
    "name": "string",
    "description": "string",
    "steps": [{{"action": "string", "expectedResult": "string"}}],
    "preconditions": ["string"],
    "testData": ["string"],
    "priority": "low|medium|high|critical",
    "tags": ["string"],
    "automationScript": "string (optional)"
  }},
  "suggestions": ["string"],
  "estimatedTime": number,
  "confidence": number
}}
"""
    
    def _build_defect_analysis_prompt(self, request: Dict[str, Any]) -> str:
        """Build prompt for defect analysis"""
        return f"""
Analyze the following test failure and provide comprehensive defect analysis:

**Error Message**: {request.get('error_message', 'Unknown error')}
**Test Context**: {request.get('test_context', 'Not specified')}
**Stack Trace**: {request.get('stack_trace', 'Not available')}
**Environment**: {request.get('environment', 'Unknown')}
**Test Type**: {request.get('test_type', 'Unknown')}

Please provide:
1. Severity assessment (low/medium/high/critical)
2. Priority recommendation (low/medium/high/critical)
3. Category classification
4. Root cause analysis
5. Suggested fix or investigation steps
6. Similar known issues
7. Confidence level (0-100)
8. Step-by-step investigation plan

Respond in JSON format:
{{
  "severity": "low|medium|high|critical",
  "priority": "low|medium|high|critical",
  "category": "string",
  "rootCause": "string",
  "suggestedFix": "string",
  "similarIssues": ["string"],
  "confidence": number,
  "investigationSteps": ["string"]
}}
"""
    
    def _build_test_plan_prompt(self, request: Dict[str, Any]) -> str:
        """Build prompt for test plan generation"""
        return f"""
Create a comprehensive test plan for the following project:

**Project**: {request.get('project_description', 'Unknown project')}
**Features**: {', '.join(request.get('features', []))}
**Test Types**: {', '.join(request.get('test_types', []))}
**Coverage Level**: {request.get('coverage', 'comprehensive')}
**Timeline**: {request.get('timeline', 'Not specified')}
**Resources**: {', '.join(request.get('resources', []))}

Please provide:
1. Test plan name and description
2. List of test cases with priorities, types, and time estimates
3. Estimated total duration
4. Coverage assessment
5. Risk assessment
6. Recommendations for test strategy
7. Resource requirements

Respond in JSON format:
{{
  "testPlan": {{
    "name": "string",
    "description": "string",
    "testCases": [{{"name": "string", "description": "string", "priority": "string", "type": "string", "estimatedTime": number}}],
    "estimatedDuration": number,
    "coverage": "string",
    "riskAssessment": "string"
  }},
  "recommendations": ["string"],
  "resourceRequirements": ["string"]
}}
"""
    
    def _build_optimization_prompt(self, test_results: List[Dict[str, Any]]) -> str:
        """Build prompt for test optimization"""
        return f"""
Analyze these test results and provide optimization recommendations:

**Test Results**: {json.dumps(test_results, indent=2)}

Please provide actionable suggestions for:
1. Performance optimization
2. Test coverage improvements
3. Flaky test identification and fixes
4. Resource optimization
5. Test maintenance best practices
6. Automation opportunities
7. Risk mitigation strategies

Respond as an array of specific, actionable recommendations.
"""
    
    def _parse_test_case_response(self, response: str) -> Dict[str, Any]:
        """Parse test case response from LLM"""
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse test case response: {str(e)}")
            raise Exception("Invalid JSON response from LLM")
    
    def _parse_defect_analysis_response(self, response: str) -> Dict[str, Any]:
        """Parse defect analysis response from LLM"""
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse defect analysis response: {str(e)}")
            raise Exception("Invalid JSON response from LLM")
    
    def _parse_test_plan_response(self, response: str) -> Dict[str, Any]:
        """Parse test plan response from LLM"""
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse test plan response: {str(e)}")
            raise Exception("Invalid JSON response from LLM")
    
    def _parse_optimization_response(self, response: str) -> List[str]:
        """Parse optimization response from LLM"""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            # Fallback to splitting by lines if JSON parsing fails
            return [line.strip() for line in response.split('\n') if line.strip()]
