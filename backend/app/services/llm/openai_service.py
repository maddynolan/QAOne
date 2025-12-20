"""
OpenAI Service for Test Case Rewriting
Provides fast, cost-effective test case generation using gpt-4o-mini

=============================================================================
✅ ACTIVE SERVICE - This is the primary LLM service for the product
Uses OpenAI gpt-4o-mini for:
- Test case formatting
- Quick rewrites
- JSON structure generation

Cost: ~$0.15/1M input tokens, $0.60/1M output tokens (very cheap!)
=============================================================================
"""

import asyncio
import logging
import os
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class OpenAIService:
    """
    Service to interact with OpenAI API for test case rewriting.
    Uses gpt-4o-mini for fast, cost-effective generation.
    """
    
    def __init__(self):
        # Try to load .env file if not already loaded
        try:
            from dotenv import load_dotenv
            import os as os_module
            # Try multiple locations
            env_paths = [
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),  # Root .env
                os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),  # Backend .env
                '.env'  # Current directory
            ]
            for env_path in env_paths:
                if os.path.exists(env_path):
                    load_dotenv(env_path, override=True)
                    logger.debug(f"OpenAIService: Loaded .env from {env_path}")
                    break
        except ImportError:
            pass  # dotenv not available, skip
        except Exception as e:
            logger.debug(f"OpenAIService: Could not load .env: {e}")
        
        # Load API key from environment
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            logger.debug("OPENAI_API_KEY not set - OpenAI service will not be available")
            self._client = None
        else:
            try:
                from openai import AsyncOpenAI
                self._client = AsyncOpenAI(api_key=self.api_key)
                logger.debug("OpenAI service initialized (gpt-4o-mini)")
            except ImportError:
                logger.warning("openai package not installed - run: pip install openai")
                self._client = None
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {e}")
                self._client = None
        
        # Model configuration
        self.default_model = os.getenv("OPENAI_TEST_CASE_MODEL", "gpt-4o-mini")
        self.default_temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
        self.default_max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        
        # Pricing (as of 2024) - for cost tracking
        # gpt-4o-mini: $0.15 / 1M input tokens, $0.60 / 1M output tokens
        self.input_cost_per_1m = 0.15
        self.output_cost_per_1m = 0.60
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self._client is not None and self.api_key is not None
    
    async def rewrite_test_case(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Rewrite a test case using OpenAI API.
        
        Args:
            system_prompt: System prompt for the model
            user_message: User message with scenario skeleton
            model: Model to use (default: gpt-4o-mini)
            temperature: Temperature for generation (default: 0.2)
            max_tokens: Maximum tokens to generate (default: 2000)
            timeout: Timeout in seconds (default: 30.0)
            
        Returns:
            Dict with:
                - response: Generated text
                - model: Model used
                - provider: "openai"
                - tokens_used: Total tokens used
                - latency_ms: Generation time in milliseconds
                - cost_usd: Estimated cost in USD
                - input_tokens: Input tokens
                - output_tokens: Output tokens
        """
        if not self.is_available():
            raise ValueError("OpenAI service not available - check OPENAI_API_KEY")
        
        model = model or self.default_model
        temperature = temperature if temperature is not None else self.default_temperature
        max_tokens = max_tokens or self.default_max_tokens
        
        start_time = time.time()
        
        try:
            # Call OpenAI API with timeout
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"}  # Force JSON response
                ),
                timeout=timeout
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Extract response
            content = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            cost_usd = (
                (input_tokens / 1_000_000) * self.input_cost_per_1m +
                (output_tokens / 1_000_000) * self.output_cost_per_1m
            )
            
            logger.info(
                f"OpenAI rewrite completed: model={model}, "
                f"tokens={total_tokens} (in={input_tokens}, out={output_tokens}), "
                f"latency={latency_ms:.0f}ms, cost=${cost_usd:.6f}"
            )
            
            return {
                "response": content,
                "model": model,
                "provider": "openai",
                "tokens_used": total_tokens,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "latency_ms": latency_ms,
                "cost_usd": cost_usd
            }
            
        except asyncio.TimeoutError:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"OpenAI API call timed out after {timeout}s")
            raise TimeoutError(f"OpenAI API call timed out after {timeout}s")
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"OpenAI API call failed: {e}", exc_info=True)
            raise
    
    async def generate_json(
        self,
        system_prompt: str,
        user_message: str,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """
        Generate JSON response using OpenAI API.
        
        Args:
            system_prompt: System prompt for the model
            user_message: User message
            model: Model to use (default: gpt-4o-mini)
            temperature: Temperature for generation (default: 0.2)
            max_tokens: Maximum tokens to generate (default: 2000)
            timeout: Timeout in seconds (default: 60.0)
            
        Returns:
            Parsed JSON dict
        """
        result = await self.rewrite_test_case(
            system_prompt=system_prompt,
            user_message=user_message,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout
        )
        
        # Parse JSON response
        response_text = result.get("response", "{}")
        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code blocks
            import re
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            raise ValueError(f"Failed to parse JSON from OpenAI response: {response_text[:200]}")


# Global instance
_openai_service = None

def get_openai_service() -> OpenAIService:
    """Get or create global OpenAI service instance"""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service

