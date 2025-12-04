"""
Persona-Based Agent System
Enterprise-grade agent personas with specialized expertise and zero-tolerance standards.

Each persona represents a world-class expert with decades of experience and proven track records.
"""

import logging
import json
from typing import Dict, Any, List, Optional, TypeVar, Generic
from abc import ABC, abstractmethod
from pydantic import BaseModel, ValidationError

from app.services.llm.model_gateway import ModelGateway, get_model_gateway

# Import ValidationError for subclasses
from pydantic import ValidationError

logger = logging.getLogger(__name__)

T = TypeVar('T')


class AgentPersona(ABC, Generic[T]):
    """
    Base class for all agent personas.
    Each persona represents a world-class expert with specialized knowledge.
    """
    
    def __init__(self, model_gateway: Optional[ModelGateway] = None):
        self.model_gateway = model_gateway or get_model_gateway()
        self.system_prompt = self._get_system_prompt()
        self.persona_name = self._get_persona_name()
        self.expertise_years = self._get_expertise_years()
        self.track_record = self._get_track_record()
    
    @abstractmethod
    def _get_system_prompt(self) -> str:
        """Get the system prompt for this persona. Must be overridden."""
        raise NotImplementedError
    
    @abstractmethod
    def _get_persona_name(self) -> str:
        """Get the persona name. Must be overridden."""
        raise NotImplementedError
    
    @abstractmethod
    def _get_expertise_years(self) -> int:
        """Get years of expertise. Must be overridden."""
        raise NotImplementedError
    
    @abstractmethod
    def _get_track_record(self) -> str:
        """Get track record description. Must be overridden."""
        raise NotImplementedError
    
    def get_tools(self) -> List[Dict[str, Any]]:
        """
        Optional tools for the agent (e.g., for validation, execution).
        Override in subclasses if needed.
        """
        return []
    
    async def generate(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
        temperature: float = 0.3,
        max_tokens: Optional[int] = None,
        tenant_id: Optional[str] = None
    ) -> T:
        """
        Base method: Calls LLM with persona prompt + input.
        
        Args:
            input_data: Input data for generation
            context: Additional context (project info, tenant, etc.)
            temperature: LLM temperature (lower = more deterministic)
            max_tokens: Maximum tokens in response
            tenant_id: Tenant ID for usage tracking
            
        Returns:
            Parsed response of type T
        """
        try:
            # Build full prompt with persona context
            user_prompt = self._build_prompt(input_data, context)
            
            # Combine system prompt and user prompt (ModelGateway doesn't have separate system_prompt)
            full_prompt = f"""{self.system_prompt}

Output Requirements:
- Return ONLY valid JSON matching the specified schema
- No markdown code blocks, no explanations
- Ensure all required fields are present
- Use proper JSON escaping for strings

{user_prompt}"""
            
            # Call model gateway
            from app.services.llm.model_gateway import GenerationRequest
            request = GenerationRequest(
                prompt=full_prompt,
                max_tokens=max_tokens or 4000,
                temperature=temperature,
                validate_json=True
            )
            
            # Use model gateway's generate method
            response_obj = await self.model_gateway.generate(
                request=request,
                tenant_id=tenant_id
            )
            
            response_text = response_obj.response
            
            # Parse and validate response
            parsed = self.parse_response(response_text)
            
            # Log success
            logger.info(
                f"[{self.persona_name}] Generated output successfully "
                f"({self.expertise_years} years expertise, {self.track_record}, "
                f"model={response_obj.model}, latency={response_obj.latency_ms:.0f}ms)"
            )
            
            return parsed
            
        except ValidationError as e:
            logger.error(f"[{self.persona_name}] Response validation failed: {e}")
            raise ValueError(f"Invalid response format from {self.persona_name}: {e}")
        except Exception as e:
            logger.error(f"[{self.persona_name}] Generation failed: {e}", exc_info=True)
            raise
    
    def _build_prompt(
        self,
        input_data: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Build the full prompt with input data and context."""
        prompt_parts = []
        
        # Add context if provided
        if context:
            prompt_parts.append(f"Context:\n{json.dumps(context, indent=2)}\n")
        
        # Add input data
        prompt_parts.append(f"Input Data:\n{json.dumps(input_data, indent=2)}")
        
        # Add generation instruction
        prompt_parts.append("\nGenerate output following your persona's rules and expertise.")
        
        return "\n".join(prompt_parts)
    
    @abstractmethod
    def parse_response(self, response: str) -> T:
        """
        Parse LLM output (override per subclass).
        Should handle JSON parsing and validation.
        """
        raise NotImplementedError
    
    def get_persona_info(self) -> Dict[str, Any]:
        """Get persona metadata."""
        return {
            "name": self.persona_name,
            "expertise_years": self.expertise_years,
            "track_record": self.track_record,
            "tools": [tool.get("name") for tool in self.get_tools()]
        }

