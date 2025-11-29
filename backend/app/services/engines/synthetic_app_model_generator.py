"""
Synthetic App Model Generator
Generates synthetic screens and APIs from RequirementContext
Uses pattern matching and LLM to create app models before the app exists
"""

import logging
import json
import os
from typing import Dict, Any, Optional, List
from app.schemas.requirement_schemas import RequirementContext, RequirementType, SyntheticAppModel, SyntheticScreen, SyntheticAPI
from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service

logger = logging.getLogger(__name__)


class SyntheticAppModelGenerator:
    """
    Generates synthetic app models (screens, APIs) from RequirementContext.
    This allows test case generation before the app exists.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        
        # Provider selection
        self.provider = os.getenv("REQUIREMENT_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"SyntheticAppModelGenerator initialized with provider: {self.provider}")
    
    async def generate_app_model(
        self,
        requirement_context: RequirementContext
    ) -> SyntheticAppModel:
        """
        Generate synthetic app model from requirement context.
        
        Args:
            requirement_context: Structured requirement context
            
        Returns:
            SyntheticAppModel with screens and APIs
        """
        # Use pattern matching first, then LLM for refinement
        screens = self._generate_screens_from_pattern(requirement_context)
        apis = self._generate_apis_from_pattern(requirement_context)
        policies = self._extract_policies(requirement_context)
        
        # Use LLM to refine and add details
        try:
            refined_model = await self._refine_with_llm(
                requirement_context=requirement_context,
                screens=screens,
                apis=apis,
                policies=policies
            )
            return refined_model
        except Exception as e:
            logger.warning(f"LLM refinement failed, using pattern-based model: {e}")
            return SyntheticAppModel(
                requirement_id=requirement_context.requirement_id,
                screens=screens,
                apis=apis,
                policies=policies
            )
    
    def _generate_screens_from_pattern(
        self,
        context: RequirementContext
    ) -> List[SyntheticScreen]:
        """Generate screens based on requirement type patterns"""
        screens = []
        
        if context.type == RequirementType.WORKFLOW_FEATURE:
            # Workflow features typically need: list view + form view
            screens.append(SyntheticScreen(
                id=f"screen_{context.requirement_id.lower()}_list",
                name=f"{context.domain_area or 'Feature'} List",
                type="list",
                entities=context.entities or [],
                actions=[
                    {"id": "action_add", "label": "Add New", "kind": "primary"},
                    {"id": "action_edit", "label": "Edit", "kind": "row_action"},
                    {"id": "action_delete", "label": "Delete", "kind": "row_action"}
                ]
            ))
            
            screens.append(SyntheticScreen(
                id=f"screen_{context.requirement_id.lower()}_form",
                name=f"{context.domain_area or 'Feature'} Form",
                type="form",
                entities=context.entities or [],
                fields=self._infer_fields_from_entities(context),
                actions=[
                    {"id": "action_save", "label": "Save", "kind": "primary"},
                    {"id": "action_cancel", "label": "Cancel", "kind": "secondary"}
                ]
            ))
        
        elif context.type == RequirementType.CRUD:
            # CRUD operations need list + form + detail views
            screens.append(SyntheticScreen(
                id=f"screen_{context.requirement_id.lower()}_list",
                name=f"{context.domain_area or 'Entity'} List",
                type="list",
                entities=context.entities or []
            ))
            
            screens.append(SyntheticScreen(
                id=f"screen_{context.requirement_id.lower()}_form",
                name=f"{context.domain_area or 'Entity'} Form",
                type="form",
                entities=context.entities or []
            ))
        
        return screens
    
    def _generate_apis_from_pattern(
        self,
        context: RequirementContext
    ) -> List[SyntheticAPI]:
        """Generate APIs based on requirement patterns"""
        apis = []
        
        # Common CRUD APIs
        if context.type in [RequirementType.CRUD, RequirementType.WORKFLOW_FEATURE]:
            apis.append(SyntheticAPI(
                id=f"api_create_{context.requirement_id.lower()}",
                name=f"Create {context.domain_area or 'Entity'}",
                method="POST",
                path=f"/api/{context.domain_area.lower().replace(' ', '-') if context.domain_area else 'entities'}",
                request_schema={},
                response_scenarios=[
                    {"code": 201, "description": "Created successfully"},
                    {"code": 400, "description": "Validation error"}
                ]
            ))
            
            apis.append(SyntheticAPI(
                id=f"api_update_{context.requirement_id.lower()}",
                name=f"Update {context.domain_area or 'Entity'}",
                method="PUT",
                path=f"/api/{context.domain_area.lower().replace(' ', '-') if context.domain_area else 'entities'}/{{id}}",
                request_schema={},
                response_scenarios=[
                    {"code": 200, "description": "Updated successfully"},
                    {"code": 404, "description": "Not found"}
                ]
            ))
        
        return apis
    
    def _infer_fields_from_entities(
        self,
        context: RequirementContext
    ) -> List[Dict[str, Any]]:
        """Infer form fields from entities and business rules"""
        fields = []
        
        # Common fields based on entities
        if "Account" in str(context.entities):
            fields.append({"id": "field_account", "label": "Account", "type": "select"})
        
        if "Payment" in str(context.entities) or "Amount" in str(context.business_rules):
            fields.append({"id": "field_amount", "label": "Amount", "type": "currency"})
        
        if "Date" in str(context.business_rules) or "Schedule" in context.title:
            fields.append({"id": "field_start_date", "label": "Start Date", "type": "date"})
            fields.append({"id": "field_end_date", "label": "End Date", "type": "date_optional"})
        
        if "Frequency" in str(context.business_rules) or "recurring" in context.title.lower():
            fields.append({
                "id": "field_frequency",
                "label": "Frequency",
                "type": "select",
                "allowedValues": ["Monthly", "Quarterly", "Yearly"]
            })
        
        return fields
    
    def _extract_policies(
        self,
        context: RequirementContext
    ) -> Dict[str, Any]:
        """Extract policies from business rules"""
        policies = {}
        
        # Date validation policy
        if any("past" in rule.lower() or "date" in rule.lower() for rule in context.business_rules or []):
            policies["date_validation"] = {
                "startDateCannotBePast": True
            }
        
        # Frequency policy
        if "frequency" in str(context.business_rules).lower():
            policies["scheduling_policy"] = {
                "allowedFrequencies": ["Monthly", "Quarterly", "Yearly"]
            }
        
        return policies
    
    async def _refine_with_llm(
        self,
        requirement_context: RequirementContext,
        screens: List[SyntheticScreen],
        apis: List[SyntheticAPI],
        policies: Dict[str, Any]
    ) -> SyntheticAppModel:
        """Use LLM to refine and add details to synthetic model"""
        
        system_prompt = """You are an expert UX designer and API architect.
Given a requirement context and initial synthetic screens/APIs, refine and enhance them.

Add:
1. More detailed field definitions with proper types
2. Additional screens if needed
3. Complete API request/response schemas
4. Additional policies based on business rules

Return ONLY valid JSON matching this schema:
{
  "requirement_id": "string",
  "screens": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "entities": ["string"],
      "fields": [
        {
          "id": "string",
          "label": "string",
          "type": "string",
          "allowedValues": ["string"] (optional)
        }
      ],
      "actions": [
        {
          "id": "string",
          "label": "string",
          "kind": "string"
        }
      ]
    }
  ],
  "apis": [
    {
      "id": "string",
      "name": "string",
      "method": "string",
      "path": "string",
      "request_schema": {},
      "response_scenarios": [
        {
          "code": 200,
          "description": "string"
        }
      ]
    }
  ],
  "policies": {}
}

Do not include comments or explanations outside the JSON."""
        
        user_message = f"""Requirement Context:
{requirement_context.json(indent=2)}

Initial Screens:
{json.dumps([s.dict() for s in screens], indent=2)}

Initial APIs:
{json.dumps([a.dict() for a in apis], indent=2)}

Initial Policies:
{json.dumps(policies, indent=2)}

Refine and enhance this synthetic app model with complete details."""
        
        # Select provider
        use_openai = False
        if self.provider == "openai" or (self.provider == "auto" and self.openai_service.is_available()):
            use_openai = True
        
        if use_openai:
            response = await self.openai_service.generate_json(
                system_prompt=system_prompt,
                user_message=user_message,
                model="gpt-4o-mini"
            )
        else:
            response = await self.ollama_service.generate(
                prompt=f"{system_prompt}\n\n{user_message}",
                model="qwen2.5-coder:7b",
                use_fast_model=True,
                timeout=60
            )
        
        # Parse response
        if isinstance(response, str):
            import re
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                response = json_match.group(1)
            model_dict = json.loads(response)
        else:
            model_dict = response
        
        return SyntheticAppModel(**model_dict)

