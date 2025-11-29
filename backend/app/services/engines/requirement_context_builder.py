"""
Requirement Context Builder
Builds structured RequirementContext from Jira stories or raw requirements
Uses LLM (OpenAI/Ollama) to extract structured information
"""

import logging
import json
import os
from typing import Dict, Any, Optional
from app.schemas.requirement_schemas import RequirementContext, RequirementType
from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service

logger = logging.getLogger(__name__)


class RequirementContextBuilder:
    """
    Builds RequirementContext from unstructured requirements.
    Uses LLM to extract structured information.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection: "auto", "openai", or "ollama"
        self.provider = os.getenv("REQUIREMENT_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"RequirementContextBuilder initialized with provider: {self.provider}")
    
    async def build_context(
        self,
        requirement_id: str,
        title: str,
        description: str,
        acceptance_criteria: Optional[list] = None,
        raw_payload: Optional[Dict[str, Any]] = None
    ) -> RequirementContext:
        """
        Build RequirementContext from Jira story or raw requirement.
        
        Args:
            requirement_id: Jira key or requirement ID
            title: Requirement title
            description: Requirement description
            acceptance_criteria: List of acceptance criteria strings
            raw_payload: Optional raw Jira payload for additional context
            
        Returns:
            RequirementContext object
        """
        # Combine all text for LLM analysis
        full_text = f"Title: {title}\n\nDescription: {description}\n\n"
        
        if acceptance_criteria:
            full_text += "Acceptance Criteria:\n"
            for ac in acceptance_criteria:
                full_text += f"- {ac}\n"
        
        if raw_payload:
            full_text += f"\nAdditional Context: {json.dumps(raw_payload, indent=2)}"
        
        # Use LLM to extract structured context
        try:
            context_dict = await self._extract_context_with_llm(
                requirement_id=requirement_id,
                title=title,
                full_text=full_text
            )
            
            # Build RequirementContext
            return RequirementContext(**context_dict)
            
        except Exception as e:
            logger.error(f"Failed to build requirement context with LLM: {e}", exc_info=True)
            # Fallback to basic context
            return self._build_basic_context(
                requirement_id=requirement_id,
                title=title,
                description=description,
                acceptance_criteria=acceptance_criteria or []
            )
    
    async def _extract_context_with_llm(
        self,
        requirement_id: str,
        title: str,
        full_text: str
    ) -> Dict[str, Any]:
        """Use LLM to extract structured context"""
        
        system_prompt = """You are an expert business analyst and QA engineer.
Your task is to analyze a requirement and extract structured context information.

Extract the following information:
1. requirement_type: One of: workflow_feature, crud, validation, calculation, integration, permission, reporting, non_functional
2. domain_area: The domain or module (e.g., "Retail Banking - Payments", "Authentication")
3. primary_actor: Main actor/user role
4. secondary_actors: Other systems or roles involved
5. entities: Domain entities affected (e.g., "CustomerAccount", "PaymentTransaction")
6. preconditions: Conditions that must be true before scenario begins
7. triggers: Events or actions that initiate the flow
8. main_outcomes: Key outcomes or goals
9. business_rules: Explicit business rules and constraints
10. risks: Known risk areas
11. acceptance_criteria: Already provided, but ensure all are captured

Return ONLY valid JSON matching this schema:
{
  "requirement_id": "string",
  "title": "string",
  "type": "workflow_feature|crud|validation|calculation|integration|permission|reporting|non_functional",
  "domain_area": "string",
  "primary_actor": "string",
  "secondary_actors": ["string"],
  "entities": ["string"],
  "preconditions": ["string"],
  "triggers": ["string"],
  "main_outcomes": ["string"],
  "business_rules": ["string"],
  "risks": ["string"],
  "acceptance_criteria": ["string"]
}

Do not include comments or explanations outside the JSON."""
        
        user_message = f"""Requirement ID: {requirement_id}
Title: {title}

Requirement Text:
{full_text}

Extract the structured context information as JSON."""
        
        # Select provider
        use_openai = False
        if self.provider == "openai" or (self.provider == "auto" and self.openai_service.is_available()):
            use_openai = True
        
        if use_openai:
            logger.info(f"Using OpenAI to extract context for requirement {requirement_id}")
            response = await self.openai_service.generate_json(
                system_prompt=system_prompt,
                user_message=user_message,
                model="gpt-4o-mini"
            )
        else:
            logger.info(f"Using Ollama to extract context for requirement {requirement_id}")
            response = await self.ollama_service.generate(
                prompt=f"{system_prompt}\n\n{user_message}",
                model="qwen2.5-coder:7b",
                use_fast_model=True,
                timeout=60
            )
        
        # Parse JSON response
        if isinstance(response, str):
            # Try to extract JSON from markdown code blocks
            import re
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                response = json_match.group(1)
            context_dict = json.loads(response)
        else:
            context_dict = response
        
        # Ensure required fields
        context_dict["requirement_id"] = requirement_id
        context_dict["title"] = title
        
        # Convert type string to RequirementType enum if needed
        if "type" in context_dict and isinstance(context_dict["type"], str):
            # Map string to enum value
            type_str = context_dict["type"].lower()
            type_map = {
                "workflow_feature": RequirementType.WORKFLOW_FEATURE,
                "crud": RequirementType.CRUD,
                "validation": RequirementType.VALIDATION,
                "calculation": RequirementType.CALCULATION,
                "integration": RequirementType.INTEGRATION,
                "permission": RequirementType.PERMISSION,
                "reporting": RequirementType.REPORTING,
                "non_functional": RequirementType.NON_FUNCTIONAL
            }
            context_dict["type"] = type_map.get(type_str, RequirementType.WORKFLOW_FEATURE)
        
        return context_dict
    
    def _build_basic_context(
        self,
        requirement_id: str,
        title: str,
        description: str,
        acceptance_criteria: list
    ) -> RequirementContext:
        """Build basic context without LLM (fallback)"""
        
        # Infer type from keywords
        req_type = RequirementType.WORKFLOW_FEATURE
        text_lower = (title + " " + description).lower()
        
        if any(kw in text_lower for kw in ["create", "add", "edit", "update", "delete", "remove"]):
            req_type = RequirementType.CRUD
        elif any(kw in text_lower for kw in ["validate", "check", "verify", "must", "cannot"]):
            req_type = RequirementType.VALIDATION
        elif any(kw in text_lower for kw in ["calculate", "compute", "formula"]):
            req_type = RequirementType.CALCULATION
        elif any(kw in text_lower for kw in ["integrate", "api", "webhook", "sync"]):
            req_type = RequirementType.INTEGRATION
        elif any(kw in text_lower for kw in ["permission", "access", "role", "authorize"]):
            req_type = RequirementType.PERMISSION
        
        return RequirementContext(
            requirement_id=requirement_id,
            title=title,
            type=req_type,
            domain_area=None,
            primary_actor=None,
            acceptance_criteria=acceptance_criteria,
            raw_requirements_text=description
        )

