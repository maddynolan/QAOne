"""
Requirement Scenario Skeleton Generator
Generates deterministic scenario skeletons from RequirementContext and SyntheticAppModel
This is Step 4 - before LLM rewrite
"""

import logging
from typing import List, Dict, Any, Optional
from app.schemas.requirement_schemas import (
    RequirementContext,
    SyntheticAppModel,
    ScenarioSkeleton
)
from app.services.engines.variation_generator import VariationGenerator

logger = logging.getLogger(__name__)


class RequirementScenarioGenerator:
    """
    Generates scenario skeletons deterministically from requirement context and app model.
    No LLM needed - pure rule-based generation.
    """
    
    def __init__(self):
        self.variation_generator = VariationGenerator()
        logger.info("RequirementScenarioGenerator initialized")
    
    def generate_scenarios(
        self,
        requirement_context: RequirementContext,
        app_model: SyntheticAppModel
    ) -> List[ScenarioSkeleton]:
        """
        Generate scenario skeletons from requirement context and app model.
        
        Args:
            requirement_context: Structured requirement context
            app_model: Synthetic app model with screens and APIs
            
        Returns:
            List of scenario skeletons
        """
        scenarios = []
        
        # Generate happy path scenario
        happy_path = self._generate_happy_path(requirement_context, app_model)
        if happy_path:
            scenarios.append(happy_path)
        
        # Generate variations from acceptance criteria using VariationGenerator
        if requirement_context.acceptance_criteria:
            variations = self.variation_generator.detect_variations(requirement_context.acceptance_criteria)
            ac_variations = self.variation_generator.generate_variation_scenarios(
                context=requirement_context,
                app_model=app_model,
                variations=variations,
                base_scenario_id=len(scenarios) + 1
            )
            logger.info(f"Generated {len(ac_variations)} acceptance criteria variations")
            scenarios.extend(ac_variations)
        
        # Generate validation scenarios from business rules
        validation_scenarios = self._generate_validation_scenarios(requirement_context, app_model)
        scenarios.extend(validation_scenarios)
        
        # Generate negative scenarios from risks
        negative_scenarios = self._generate_negative_scenarios(requirement_context, app_model)
        scenarios.extend(negative_scenarios)
        
        # Generate management scenarios (edit, cancel, etc.)
        management_scenarios = self._generate_management_scenarios(requirement_context, app_model)
        scenarios.extend(management_scenarios)
        
        logger.info(f"Generated {len(scenarios)} scenario skeletons for requirement {requirement_context.requirement_id}")
        return scenarios
    
    # Variation generation methods removed - now handled by VariationGenerator service
    
    def _generate_happy_path(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel
    ) -> ScenarioSkeleton:
        """Generate happy path scenario"""
        
        steps = []
        
        # Find list screen
        list_screen = next((s for s in app_model.screens if s.type == "list"), None)
        if list_screen:
            add_action = next((a for a in (list_screen.actions or []) if a.get("id") == "action_add"), None)
            if add_action:
                steps.append(f"Navigate to {list_screen.name} ({list_screen.id})")
                steps.append(f"Click '{add_action.get('label', 'Add')}' ({add_action.get('id')})")
        
        # Find form screen
        form_screen = next((s for s in app_model.screens if s.type == "form"), None)
        if form_screen:
            steps.append(f"On {form_screen.name} ({form_screen.id}), populate all required fields")
            
            # Add field-specific steps
            for field in form_screen.fields or []:
                field_id = field.get("id", "")
                field_label = field.get("label", "")
                field_type = field.get("type", "")
                
                if field_type == "select":
                    steps.append(f"Select a value in {field_label} ({field_id})")
                elif field_type == "date":
                    steps.append(f"Set a valid {field_label} in the future ({field_id})")
                elif field_type == "currency":
                    steps.append(f"Enter a valid amount in {field_label} ({field_id})")
                else:
                    steps.append(f"Enter a value in {field_label} ({field_id})")
            
            # Save action
            save_action = next((a for a in (form_screen.actions or []) if a.get("kind") == "primary"), None)
            if save_action:
                steps.append(f"Click '{save_action.get('label', 'Save')}' ({save_action.get('id')})")
        
        # Add execution step if workflow feature
        if context.type.value == "workflow_feature":
            execute_api = next((a for a in app_model.apis if "execute" in a.name.lower()), None)
            if execute_api:
                steps.append(f"On scheduled date, system invokes {execute_api.name} ({execute_api.id})")
        
        expected_results = []
        for outcome in context.main_outcomes or []:
            expected_results.append(outcome)
        
        return ScenarioSkeleton(
            id=f"{context.requirement_id}-TC1",
            requirement_id=context.requirement_id,
            kind="happy_path",
            title=f"Create and execute {context.title.lower()} successfully",
            preconditions=context.preconditions or [],
            steps=steps,
            expected_result=expected_results,
            priority="high",
            tags=["happy_path", context.type.value]
        )
    
    def _generate_validation_scenarios(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel
    ) -> List[ScenarioSkeleton]:
        """Generate validation scenarios from business rules"""
        scenarios = []
        
        for i, rule in enumerate(context.business_rules or [], 1):
            if "cannot" in rule.lower() or "must not" in rule.lower() or "invalid" in rule.lower():
                # Create negative validation scenario
                form_screen = next((s for s in app_model.screens if s.type == "form"), None)
                if not form_screen:
                    continue
                
                steps = [
                    f"Navigate to {form_screen.name}",
                    "Populate all required fields with valid values",
                    f"Set a value that violates: {rule}",
                    "Click 'Save'"
                ]
                
                scenarios.append(ScenarioSkeleton(
                    id=f"{context.requirement_id}-TC{len(scenarios) + 2}",
                    requirement_id=context.requirement_id,
                    kind="validation",
                    title=f"Prevent {rule.lower()}",
                    preconditions=context.preconditions or [],
                    steps=steps,
                    expected_result=[
                        f"System rejects the request and shows a validation error indicating {rule.lower()}",
                        "Request is not processed"
                    ],
                    priority="high",
                    tags=["validation", "negative"]
                ))
        
        return scenarios
    
    def _generate_negative_scenarios(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel
    ) -> List[ScenarioSkeleton]:
        """Generate negative scenarios from risks"""
        scenarios = []
        
        for i, risk in enumerate(context.risks or [], 1):
            if "insufficient" in risk.lower() or "fail" in risk.lower():
                # Create failure scenario
                execute_api = next((a for a in app_model.apis if "execute" in a.name.lower()), None)
                if execute_api:
                    scenarios.append(ScenarioSkeleton(
                        id=f"{context.requirement_id}-TC{len(scenarios) + 2}",
                        requirement_id=context.requirement_id,
                        kind="negative",
                        title=f"Handle {risk.lower()}",
                        preconditions=[
                            "A scheduled instruction exists",
                            "Condition for failure is met (e.g., insufficient funds)"
                        ],
                        steps=[
                            f"Allow scheduler to trigger execution on scheduled date",
                            f"System calls {execute_api.name} for the instruction"
                        ],
                        expected_result=[
                            "Execution fails due to the risk condition",
                            "Failure is recorded",
                            "User receives notification about the failure"
                        ],
                        priority="high",
                        tags=["negative", "failure"]
                    ))
        
        return scenarios
    
    def _generate_management_scenarios(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel
    ) -> List[ScenarioSkeleton]:
        """Generate management scenarios (edit, cancel, etc.)"""
        scenarios = []
        
        list_screen = next((s for s in app_model.screens if s.type == "list"), None)
        if not list_screen:
            return scenarios
        
        # Edit scenario
        edit_action = next((a for a in (list_screen.actions or []) if "edit" in a.get("id", "").lower()), None)
        if edit_action:
            scenarios.append(ScenarioSkeleton(
                id=f"{context.requirement_id}-TC{len(scenarios) + 2}",
                requirement_id=context.requirement_id,
                kind="management",
                title=f"Edit and then cancel an existing {context.title.lower()}",
                preconditions=[
                    "User is authenticated",
                    f"At least one active {context.title.lower()} exists"
                ],
                steps=[
                    f"Navigate to {list_screen.name}",
                    f"Locate an active {context.title.lower()}",
                    f"Click '{edit_action.get('label', 'Edit')}'",
                    "Change a field value and save",
                    f"Verify the updated value in {list_screen.name}",
                    "Click 'Cancel' on the same item",
                    "Confirm cancellation if prompted"
                ],
                expected_result=[
                    f"{context.title} is updated with the new value for future executions",
                    "Cancelled item is clearly marked as cancelled or removed from active list",
                    "No further executions occur for the cancelled item"
                ],
                priority="medium",
                tags=["edit", "cancel", "management"]
            ))
        
        return scenarios

