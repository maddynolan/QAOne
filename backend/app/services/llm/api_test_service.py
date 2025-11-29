"""
API Test Service
Uses OpenAI to enhance API test case generation and automation code from OpenAPI specs.
Supports both OpenAI (cloud) and Ollama (local) providers with fallback.
"""

import logging
import json
import os
import time
import asyncio
import re
from typing import Dict, List, Any, Optional

from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service

logger = logging.getLogger(__name__)


class APITestService:
    """
    Service for generating and enhancing API test cases and automation code using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("API_TEST_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"APITestService initialized with provider: {self.provider}")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models) for API test generation")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini) for API test generation")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback) for API test generation")
    
    async def enhance_test_cases(
        self,
        test_suite: Dict[str, Any],
        api_spec: Dict[str, Any],
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Enhance API test cases with better descriptions, expected results, and edge cases.
        
        Args:
            test_suite: Test suite from APITestEngine
            api_spec: Original API specification
            timeout: Timeout in seconds
            
        Returns:
            Enhanced test suite with improved test cases
        """
        start_time = time.time()
        
        try:
            # Summarize test suite for prompt (limit size)
            test_summary = self._summarize_test_suite(test_suite)
            spec_summary = self._summarize_api_spec(api_spec)
            
            system_prompt = """You are an expert API testing engineer.

Your job:
- Enhance API test cases with better descriptions and expected results
- Add missing edge cases and error scenarios
- Improve test case titles to be more descriptive
- Ensure every test case has clear expected results
- Add realistic test data based on the API specification
- Identify additional test scenarios that should be covered

Return ONLY valid JSON with this exact shape:

{
  "enhanced_test_cases": [
    {
      "test_case_id": "string (keep original)",
      "title": "string (improved)",
      "description": "string (detailed)",
      "test_type": "api",
      "method": "GET|POST|PUT|PATCH|DELETE",
      "path": "string",
      "request": {
        "method": "string",
        "url": "string",
        "headers": {},
        "body": {}
      },
      "expected_status": 200,
      "expected_result": "string (REQUIRED - what should happen)",
      "expected_response": {},
      "tags": ["string"],
      "priority": "high|medium|low"
    }
  ],
  "additional_test_cases": [
    {
      "title": "string",
      "description": "string",
      "test_type": "api",
      "method": "string",
      "path": "string",
      "request": {},
      "expected_status": 200,
      "expected_result": "string (REQUIRED)",
      "tags": ["string"],
      "priority": "string"
    }
  ]
}

CRITICAL: Every test case MUST have a non-empty "expected_result" field describing what should happen."""

            user_message = f"""API Specification Summary:
{json.dumps(spec_summary, indent=2)}

Current Test Suite:
{json.dumps(test_summary, indent=2)}

Enhance the test cases by:
1. Improving descriptions and titles
2. Adding missing expected_result fields
3. Suggesting additional edge cases
4. Improving test data to be more realistic"""

            # Try OpenAI first
            provider_used = self.provider
            openai_available = self.openai_service.is_available()
            
            if provider_used == "auto" and openai_available:
                logger.info("[AUTO] OpenAI is available, using OpenAI for API test enhancement")
                provider_used = "openai"
            elif provider_used == "auto":
                logger.info("[AUTO] OpenAI not available, using Ollama for API test enhancement")
                provider_used = "ollama"
            
            if provider_used == "openai" and openai_available:
                try:
                    result = await self._call_openai_for_json(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=timeout
                    )
                    
                    enhanced_data = result.get("response", {})
                    if isinstance(enhanced_data, str):
                        enhanced_data = json.loads(enhanced_data)
                    
                    # Merge enhanced test cases with original
                    enhanced_test_cases = enhanced_data.get("enhanced_test_cases", [])
                    additional_test_cases = enhanced_data.get("additional_test_cases", [])
                    
                    # Update test suite
                    test_suite["test_cases"] = enhanced_test_cases
                    if additional_test_cases:
                        test_suite["test_cases"].extend(additional_test_cases)
                        test_suite["total_tests"] = len(test_suite["test_cases"])
                    
                    logger.info(
                        f"✅ Enhanced API test cases "
                        f"(OpenAI, {result.get('latency_ms', 0):.0f}ms, "
                        f"{result.get('tokens_used', 'N/A')} tokens)"
                    )
                    
                    return {
                        "test_suite": test_suite,
                        "metrics": {
                            "provider": "openai",
                            "model": "gpt-4o-mini",
                            "latency_ms": result.get("latency_ms", 0),
                            "tokens_used": result.get("tokens_used"),
                            "cost_usd": result.get("cost_usd"),
                            "enhanced_count": len(enhanced_test_cases),
                            "additional_count": len(additional_test_cases)
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"OpenAI enhancement failed: {e}, falling back to Ollama")
                    provider_used = "ollama"
            
            # Fallback to Ollama
            if provider_used == "ollama":
                full_prompt = f"{system_prompt}\n\n{user_message}"
                
                try:
                    result = await asyncio.wait_for(
                        self.ollama_service.generate(
                            prompt=full_prompt,
                            mode="quick",
                            validate_json=True,
                            use_fast_model=True,
                            task_type="test_design"
                        ),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    logger.error(f"Ollama enhancement timed out after {timeout}s")
                    # Return original test suite if timeout
                    return {"test_suite": test_suite, "metrics": {"provider": "ollama", "error": "timeout"}}
                
                response_text = result.get("response", "")
                if response_text:
                    try:
                        enhanced_data = json.loads(response_text)
                        enhanced_test_cases = enhanced_data.get("enhanced_test_cases", [])
                        additional_test_cases = enhanced_data.get("additional_test_cases", [])
                        
                        test_suite["test_cases"] = enhanced_test_cases
                        if additional_test_cases:
                            test_suite["test_cases"].extend(additional_test_cases)
                            test_suite["total_tests"] = len(test_suite["test_cases"])
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse Ollama response, using original test suite")
                
                return {
                    "test_suite": test_suite,
                    "metrics": {
                        "provider": "ollama",
                        "model": result.get("model", "qwen2.5-coder:7b"),
                        "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000)
                    }
                }
            
            # If no provider worked, return original
            return {"test_suite": test_suite, "metrics": {"provider": "none", "error": "no provider available"}}
            
        except Exception as e:
            logger.error(f"Failed to enhance API test cases: {e}", exc_info=True)
            return {"test_suite": test_suite, "metrics": {"error": str(e)}}
    
    async def generate_automation_code(
        self,
        test_suite: Dict[str, Any],
        framework: str = "playwright",
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Generate high-quality automation code from test suite using LLM.
        
        Args:
            test_suite: Test suite with test cases
            framework: Test framework (playwright, pytest, k6, etc.)
            timeout: Timeout in seconds
            
        Returns:
            Dict with generated code and metrics
        """
        start_time = time.time()
        
        try:
            # Build prompts based on framework
            system_prompt, user_message = self._build_automation_prompts(test_suite, framework)
            
            # Try OpenAI first
            provider_used = self.provider
            openai_available = self.openai_service.is_available()
            
            if provider_used == "auto" and openai_available:
                logger.info(f"[AUTO] OpenAI is available, using OpenAI for {framework} code generation")
                provider_used = "openai"
            elif provider_used == "auto":
                logger.info(f"[AUTO] OpenAI not available, using Ollama for {framework} code generation")
                provider_used = "ollama"
            
            if provider_used == "openai" and openai_available:
                try:
                    result = await self._call_openai_for_code(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=timeout
                    )
                    
                    code = self._extract_code_from_response(result.get("response", ""))
                    
                    logger.info(
                        f"✅ Generated {framework} code "
                        f"(OpenAI, {result.get('latency_ms', 0):.0f}ms, "
                        f"{result.get('tokens_used', 'N/A')} tokens)"
                    )
                    
                    return {
                        "code": code,
                        "framework": framework,
                        "metrics": {
                            "provider": "openai",
                            "model": "gpt-4o-mini",
                            "latency_ms": result.get("latency_ms", 0),
                            "tokens_used": result.get("tokens_used"),
                            "cost_usd": result.get("cost_usd")
                        }
                    }
                    
                except Exception as e:
                    logger.warning(f"OpenAI code generation failed: {e}, falling back to Ollama")
                    provider_used = "ollama"
            
            # Fallback to Ollama
            if provider_used == "ollama":
                full_prompt = f"{system_prompt}\n\n{user_message}"
                
                try:
                    result = await asyncio.wait_for(
                        self.ollama_service.generate(
                            prompt=full_prompt,
                            mode="quick",
                            validate_json=False,
                            use_fast_model=True,
                            task_type="automation"
                        ),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    logger.error(f"Ollama code generation timed out after {timeout}s")
                    raise TimeoutError(f"Ollama API call timed out after {timeout}s")
                
                code = self._extract_code_from_response(result.get("response", ""))
                
                return {
                    "code": code,
                    "framework": framework,
                    "metrics": {
                        "provider": "ollama",
                        "model": result.get("model", "qwen2.5-coder:7b"),
                        "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000)
                    }
                }
            
            raise ValueError("No LLM provider available")
            
        except Exception as e:
            logger.error(f"Failed to generate automation code: {e}", exc_info=True)
            raise
    
    def _summarize_test_suite(self, test_suite: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize test suite to reduce token usage."""
        test_cases = test_suite.get("test_cases", [])[:30]  # Limit to 30 test cases
        
        summarized_tests = []
        for tc in test_cases:
            summarized_tests.append({
                "test_case_id": tc.get("test_case_id"),
                "title": tc.get("title"),
                "description": tc.get("description"),
                "method": tc.get("method"),
                "path": tc.get("path"),
                "expected_status": tc.get("expected_status"),
                "tags": tc.get("tags", [])
            })
        
        return {
            "total_tests": len(test_suite.get("test_cases", [])),
            "total_endpoints": test_suite.get("total_endpoints", 0),
            "test_cases": summarized_tests
        }
    
    def _summarize_api_spec(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize API spec to reduce token usage."""
        paths = api_spec.get("paths", {})
        summarized_paths = {}
        
        for path, methods in list(paths.items())[:20]:  # Limit to 20 paths
            summarized_methods = {}
            for method, operation in methods.items():
                if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
                    summarized_methods[method] = {
                        "operationId": operation.get("operationId"),
                        "summary": operation.get("summary"),
                        "description": operation.get("description", "")[:200],  # Truncate
                        "tags": operation.get("tags", [])
                    }
            if summarized_methods:
                summarized_paths[path] = summarized_methods
        
        return {
            "openapi": api_spec.get("openapi") or api_spec.get("swagger", "unknown"),
            "base_url": api_spec.get("servers", [{}])[0].get("url", "") if api_spec.get("servers") else "",
            "paths": summarized_paths
        }
    
    def _build_automation_prompts(self, test_suite: Dict[str, Any], framework: str) -> tuple[str, str]:
        """Build prompts for automation code generation."""
        base_url = test_suite.get("base_url", "")
        test_cases = test_suite.get("test_cases", [])[:20]  # Limit to 20 for code generation
        
        if framework == "playwright":
            system_prompt = """You are an expert Playwright API testing engineer.

Generate executable Playwright TypeScript code for API testing.

Requirements:
- Use @playwright/test framework
- Use request context for API calls (not page)
- Include proper imports
- Add assertions for status codes and response bodies
- Use proper error handling
- Include setup/teardown if needed
- Add comments for clarity

Return ONLY valid TypeScript code (no markdown, no code blocks, no explanations)."""
            
            user_message = f"""Base URL: {base_url}

Test Cases:
{json.dumps(test_cases, indent=2)}

Generate complete Playwright API test code."""
            
        elif framework == "pytest":
            system_prompt = """You are an expert pytest API testing engineer.

Generate executable pytest Python code for API testing.

Requirements:
- Use pytest and requests libraries
- Include proper imports
- Add assertions for status codes and response bodies
- Use pytest fixtures for setup
- Include proper error handling
- Add docstrings for test functions

Return ONLY valid Python code (no markdown, no code blocks, no explanations)."""
            
            user_message = f"""Base URL: {base_url}

Test Cases:
{json.dumps(test_cases, indent=2)}

Generate complete pytest API test code."""
            
        elif framework == "k6":
            system_prompt = """You are an expert k6 performance testing engineer.

Generate executable k6 JavaScript code for API load testing.

Requirements:
- Use k6/http module
- Include proper imports
- Add checks for status codes
- Define VUs and duration
- Include proper metrics
- Add scenarios for different load patterns

Return ONLY valid JavaScript code (no markdown, no code blocks, no explanations)."""
            
            user_message = f"""Base URL: {base_url}

Test Cases:
{json.dumps(test_cases, indent=2)}

Generate complete k6 performance test code."""
            
        else:
            # Default to Playwright
            system_prompt = """You are an expert API testing engineer. Generate executable test code."""
            user_message = f"Generate {framework} test code for: {json.dumps(test_cases[:5], indent=2)}"
        
        return system_prompt, user_message
    
    async def _call_openai_for_json(
        self,
        system_prompt: str,
        user_message: str,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """Call OpenAI API for JSON response."""
        if not self.openai_service.is_available():
            raise ValueError("OpenAI service not available")
        
        start_time = time.time()
        
        try:
            response = await asyncio.wait_for(
                self.openai_service._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.2,
                    max_tokens=4000,
                    response_format={"type": "json_object"}  # Force JSON
                ),
                timeout=timeout
            )
            
            latency_ms = (time.time() - start_time) * 1000
            content = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            cost_usd = (
                (input_tokens / 1_000_000) * 0.15 +
                (output_tokens / 1_000_000) * 0.60
            )
            
            return {
                "response": json.loads(content),
                "model": "gpt-4o-mini",
                "latency_ms": latency_ms,
                "tokens_used": total_tokens,
                "cost_usd": cost_usd
            }
            
        except asyncio.TimeoutError:
            raise TimeoutError(f"OpenAI API call timed out after {timeout}s")
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}", exc_info=True)
            raise
    
    async def _call_openai_for_code(
        self,
        system_prompt: str,
        user_message: str,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """Call OpenAI API for code generation (text output)."""
        if not self.openai_service.is_available():
            raise ValueError("OpenAI service not available")
        
        start_time = time.time()
        
        try:
            response = await asyncio.wait_for(
                self.openai_service._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.2,
                    max_tokens=4000
                ),
                timeout=timeout
            )
            
            latency_ms = (time.time() - start_time) * 1000
            content = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            cost_usd = (
                (input_tokens / 1_000_000) * 0.15 +
                (output_tokens / 1_000_000) * 0.60
            )
            
            return {
                "response": content,
                "model": "gpt-4o-mini",
                "latency_ms": latency_ms,
                "tokens_used": total_tokens,
                "cost_usd": cost_usd
            }
            
        except asyncio.TimeoutError:
            raise TimeoutError(f"OpenAI API call timed out after {timeout}s")
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}", exc_info=True)
            raise
    
    def _extract_code_from_response(self, response: str) -> str:
        """Extract code from LLM response (remove markdown code blocks if present)."""
        # Try to extract code from markdown code blocks
        code_match = re.search(
            r'```(?:typescript|ts|javascript|js|python|java)?\s*(.*?)\s*```',
            response,
            re.DOTALL
        )
        if code_match:
            return code_match.group(1).strip()
        
        # If no code block, return as-is
        return response.strip()


# Global instance
_api_test_service = None

def get_api_test_service() -> APITestService:
    """Get or create global APITestService instance"""
    global _api_test_service
    if _api_test_service is None:
        _api_test_service = APITestService()
    return _api_test_service

