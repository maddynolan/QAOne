"""
Test Case Rewrite Service
LLM microservice for rewriting scenario skeletons into high-quality test cases.
Supports both Ollama (local) and OpenAI (cloud) providers with timing metrics.
"""

import logging
import json
import re
import os
import time
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel

from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service
from app.utils.variation_marker import VariationMarker

logger = logging.getLogger(__name__)


class RawStep(BaseModel):
    """Raw step from scenario skeleton"""
    order: int
    event_type: str
    url: Optional[str] = None
    element_text: Optional[str] = None
    selector: Optional[str] = None
    field_role: Optional[str] = None


class ScenarioSkeleton(BaseModel):
    """Scenario skeleton for LLM rewriting"""
    scenario_id: str
    scenario_type: str = "functional"
    high_level_intent: Optional[str] = None
    raw_steps: List[RawStep]


class RewriteRequest(BaseModel):
    """Request to rewrite a scenario skeleton"""
    project_name: Optional[str] = None
    application_name: Optional[str] = None
    skeleton: ScenarioSkeleton


class StepOut(BaseModel):
    """Output step from LLM"""
    step_number: int
    action: str
    expected_result: str
    element_name: Optional[str] = None
    selector: Optional[str] = None


class TestCaseOut(BaseModel):
    """Output test case from LLM"""
    title: str
    description: str
    test_type: str
    priority: str
    steps: List[StepOut]
    # Metrics (optional, added after generation)
    generation_metrics: Optional[Dict[str, Any]] = None


class TestCaseRewriteService:
    """
    Service for rewriting scenario skeletons into high-quality test cases using LLM.
    Supports both Ollama (local) and OpenAI (cloud) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("TEST_CASE_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"TestCaseRewriteService initialized with provider: {self.provider}")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models)")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini)")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback)")
    
    def build_prompts(self, req: RewriteRequest, requirement_context: Optional[Dict[str, Any]] = None) -> Tuple[str, str]:
        """
        Build the prompts for LLM rewriting.
        
        Args:
            req: Rewrite request with skeleton
            requirement_context: Optional requirement context with acceptance criteria
        
        Returns:
            Tuple of (system_prompt, user_message)
        """
        system_message = """You are a senior QA engineer specializing in test case generation from requirements.

Your job:
- Take a raw scenario skeleton generated from a requirement.
- Convert it into ONE high-quality functional test case that DIRECTLY addresses the acceptance criteria.
- Use clear, natural language that a manual QA can follow.
- Focus on business intent and specific requirement features, not generic flows.
- Ensure test steps directly map to acceptance criteria items.
- Merge low-level steps where it makes sense (for example: multiple clicks configuring one form).
- Keep the number of steps reasonable (no more than 12–15).
- Preserve and map selectors into the appropriate `selector` fields.

CRITICAL REQUIREMENTS:
- EVERY step MUST have a non-empty "expected_result" field.
- Expected results should describe what the user should see or what should happen after the action.
- Use specific, observable outcomes (e.g., "Cart page displays with added item", "Login page loads", "Dropdown menu opens").
- Never leave expected_result as null, empty string, or undefined.
- Base expected results on the action type and context from the scenario skeleton.
- If acceptance criteria are provided, ensure test steps directly validate those criteria.
- Test case title and description should reflect the SPECIFIC requirement, not generic functionality.

IMPORTANT - PRESERVE VARIATIONS:
- If the scenario skeleton title mentions a specific variation (e.g., "Quarterly frequency", "Yearly frequency", "specific end date", "add new payee"), 
  the test case title MUST include that variation explicitly.
- Do NOT merge distinct variations into generic test cases.
- Each variation should have a unique, specific title that clearly indicates what makes it different.

Return ONLY valid JSON with this exact shape:

{
  "title": "string (specific to the requirement, e.g., 'Set up monthly recurring payment for utility bill')",
  "description": "string (explains what this test validates in context of the requirement)",
  "test_type": "functional",
  "priority": "high|medium|low",
  "steps": [
    {
      "step_number": 1,
      "action": "string (specific action related to requirement features)",
      "expected_result": "string (REQUIRED - must be non-empty and specific)",
      "element_name": "string or null",
      "selector": "string or null"
    }
  ]
}

Do not include comments or explanations outside the JSON."""

        # Format skeleton JSON
        skeleton_dict = req.skeleton.dict()
        skeleton_json = json.dumps(skeleton_dict, indent=2)
        
        # Extract variation hints using VariationMarker utility
        high_level_intent = req.skeleton.high_level_intent or ""
        variation_hints = VariationMarker.extract_variation_hints(high_level_intent)
        
        # Build user message with requirement context if available
        user_message_parts = [
            f"Project name: {req.project_name or 'Unknown'}",
            f"Application name: {req.application_name or 'Unknown'}",
            ""
        ]
        
        # Add variation hints prominently if present
        if variation_hints:
            user_message_parts.append("⚠️ CRITICAL VARIATION REQUIREMENTS:")
            for hint in variation_hints:
                user_message_parts.append(f"  - {hint}")
            user_message_parts.append("")
            user_message_parts.append("The test case title MUST explicitly reflect this variation!")
            user_message_parts.append("")
        
        user_message_parts.extend([
            "Here is the raw scenario skeleton:",
            "",
            skeleton_json
        ])
        
        # Add requirement context and acceptance criteria if available
        if requirement_context:
            user_message_parts.append("")
            user_message_parts.append("REQUIREMENT CONTEXT:")
            user_message_parts.append(f"Title: {requirement_context.get('title', 'N/A')}")
            user_message_parts.append(f"Type: {requirement_context.get('type', 'N/A')}")
            user_message_parts.append(f"Domain: {requirement_context.get('domain_area', 'N/A')}")
            
            if requirement_context.get('acceptance_criteria'):
                user_message_parts.append("")
                user_message_parts.append("ACCEPTANCE CRITERIA (these MUST be covered in test steps):")
                for i, ac in enumerate(requirement_context.get('acceptance_criteria', []), 1):
                    user_message_parts.append(f"{i}. {ac}")
            
            if requirement_context.get('business_rules'):
                user_message_parts.append("")
                user_message_parts.append("BUSINESS RULES:")
                for rule in requirement_context.get('business_rules', []):
                    user_message_parts.append(f"- {rule}")
            
            user_message_parts.append("")
            user_message_parts.append("IMPORTANT: Generate test steps that DIRECTLY validate the acceptance criteria above. Do not create generic test cases.")
        
        user_message = "\n".join(user_message_parts)
        
        return system_message, user_message
    
    async def rewrite_test_case(
        self,
        req: RewriteRequest,
        requirement_context: Optional[Dict[str, Any]] = None,
        mode: str = "quick",
        timeout: float = 30.0,
        provider: Optional[str] = None
    ) -> TestCaseOut:
        """
        Rewrite a scenario skeleton into a high-quality test case using LLM.
        
        Args:
            req: Rewrite request with scenario skeleton
            requirement_context: Optional requirement context with acceptance criteria
            mode: LLM mode ("quick", "ui", "heavy") - only used for Ollama
            timeout: Timeout in seconds
            provider: Override provider selection ("ollama", "openai", "auto")
            
        Returns:
            Rewritten test case with generation metrics
        """
        start_time = time.time()
        provider_used = provider or self.provider
        metrics = {
            "provider": None,
            "model": None,
            "latency_ms": 0.0,
            "tokens_used": None,
            "cost_usd": None,
            "success": False
        }
        
        try:
            # Build prompts with requirement context
            system_prompt, user_message = self.build_prompts(req, requirement_context=requirement_context)
            
            # Determine which provider to use (check availability dynamically)
            use_openai = False
            openai_available = self.openai_service.is_available()
            
            if provider_used == "openai":
                if not openai_available:
                    logger.warning(f"OpenAI provider requested but not available - falling back to Ollama")
                use_openai = openai_available
            elif provider_used == "auto":
                # Try OpenAI first if available, fallback to Ollama
                use_openai = openai_available
                if use_openai:
                    logger.info(f"[AUTO] OpenAI is available, using OpenAI for scenario {req.skeleton.scenario_id}")
                else:
                    logger.info(f"[AUTO] OpenAI not available, using Ollama for scenario {req.skeleton.scenario_id}")
            
            # Call appropriate provider
            if use_openai and openai_available:
                logger.info(f"Using OpenAI (gpt-4o-mini) to rewrite scenario {req.skeleton.scenario_id}")
                try:
                    result = await self.openai_service.rewrite_test_case(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=timeout
                    )
                    
                    response_text = result.get("response", "")
                    metrics.update({
                        "provider": "openai",
                        "model": result.get("model", "gpt-4o-mini"),
                        "latency_ms": result.get("latency_ms", 0.0),
                        "tokens_used": result.get("tokens_used"),
                        "cost_usd": result.get("cost_usd"),
                        "success": True
                    })
                    
                except Exception as e:
                    logger.warning(f"OpenAI rewrite failed: {e}, falling back to Ollama")
                    # Fallback to Ollama
                    use_openai = False
            
            if not use_openai:
                # Use Ollama
                logger.info(f"Using Ollama to rewrite scenario {req.skeleton.scenario_id} (mode: {mode})")
                full_prompt = f"{system_prompt}\n\n{user_message}"
                
                # Add explicit timeout to prevent hanging
                try:
                    result = await asyncio.wait_for(
                        self.ollama_service.generate(
                            prompt=full_prompt,
                            mode=mode,
                            validate_json=True,
                            use_fast_model=True,  # Use 7B model for speed
                            task_type="test_design"
                        ),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    logger.error(f"Ollama rewrite timed out after {timeout}s for scenario {req.skeleton.scenario_id}")
                    raise TimeoutError(f"Ollama API call timed out after {timeout}s")
                
                response_text = result.get("response", "")
                metrics.update({
                    "provider": "ollama",
                    "model": result.get("model", "qwen2.5-coder:7b"),
                    "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000),
                    "tokens_used": result.get("tokens_used"),
                    "success": True
                })
            
            if not response_text:
                raise ValueError("LLM returned empty response")
            
            # Parse JSON response
            # Try to extract JSON from markdown code blocks if present
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                response_text = json_match.group(1)
            
            # For OpenAI, response is already JSON (due to response_format)
            # For Ollama, we need to parse it
            try:
                test_case_dict = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM JSON response: {e}")
                logger.error(f"Response text: {response_text[:500]}")
                raise ValueError(f"Invalid JSON response from LLM: {e}")
            
            # Validate and convert to TestCaseOut
            test_case = self._parse_llm_response(test_case_dict)
            
            # Add metrics
            metrics["latency_ms"] = (time.time() - start_time) * 1000
            test_case.generation_metrics = metrics
            
            logger.info(
                f"✅ Successfully rewrote scenario {req.skeleton.scenario_id} into test case: '{test_case.title}' "
                f"({metrics['provider']}, {metrics['latency_ms']:.0f}ms, {metrics.get('tokens_used', 'N/A')} tokens)"
            )
            
            return test_case
            
        except Exception as e:
            metrics["success"] = False
            metrics["latency_ms"] = (time.time() - start_time) * 1000
            logger.error(f"Failed to rewrite test case: {e}", exc_info=True)
            raise
    
    def _infer_expected_result(self, action: str, step_data: Dict[str, Any]) -> str:
        """Infer expected result from action if LLM didn't provide one."""
        action_lower = action.lower()
        element_name = step_data.get("element_name", "")
        
        # Navigation actions
        if "navigate" in action_lower or "goto" in action_lower or "open" in action_lower:
            if "cart" in action_lower:
                return "Cart page loads successfully"
            elif "checkout" in action_lower:
                return "Checkout page loads successfully"
            elif "login" in action_lower:
                return "Login page loads successfully"
            else:
                return "Page loads successfully"
        
        # Click actions
        if "click" in action_lower:
            if "menu" in action_lower or "dropdown" in action_lower:
                return "Dropdown menu opens"
            elif "button" in action_lower:
                return "Button is clicked and action is triggered"
            elif "cart" in action_lower:
                return "Cart page is displayed"
            elif "checkout" in action_lower:
                return "Checkout page is displayed"
            elif element_name:
                return f"{element_name} is clicked successfully"
            else:
                return "Element is clicked successfully"
        
        # Input/Type actions
        if "type" in action_lower or "enter" in action_lower or "input" in action_lower or "fill" in action_lower:
            if element_name:
                return f"Value is entered in {element_name}"
            else:
                return "Value is entered successfully"
        
        # Select actions
        if "select" in action_lower or "choose" in action_lower:
            if element_name:
                return f"Option is selected from {element_name}"
            else:
                return "Option is selected successfully"
        
        # Add to cart
        if "add" in action_lower and "cart" in action_lower:
            return "Item is added to cart and cart count updates"
        
        # Remove from cart
        if "remove" in action_lower:
            return "Item is removed from cart and total updates"
        
        # Default fallback
        return "Action completes successfully"
    
    def _parse_llm_response(self, response_dict: Dict[str, Any]) -> TestCaseOut:
        """Parse LLM response into TestCaseOut model."""
        # Extract steps
        steps_data = response_dict.get("steps", [])
        steps = []
        
        for step_data in steps_data:
            expected_result = step_data.get("expected_result", "").strip()
            action = step_data.get("action", "").strip()
            
            # CRITICAL: Ensure expected_result is never empty
            if not expected_result or expected_result == "null" or expected_result.lower() == "none":
                # Generate a default expected result based on action
                expected_result = self._infer_expected_result(action, step_data)
                logger.warning(
                    f"Step {step_data.get('step_number', '?')} had empty expected_result, "
                    f"inferred: '{expected_result}'"
                )
            
            step = StepOut(
                step_number=step_data.get("step_number", 0),
                action=action,
                expected_result=expected_result,
                element_name=step_data.get("element_name"),
                selector=step_data.get("selector")
            )
            steps.append(step)
        
        # Build test case
        test_case = TestCaseOut(
            title=response_dict.get("title", "Generated Test Case"),
            description=response_dict.get("description", ""),
            test_type=response_dict.get("test_type", "functional"),
            priority=response_dict.get("priority", "medium"),
            steps=steps
        )
        
        return test_case

