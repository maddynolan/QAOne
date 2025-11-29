"""
Variation Generator Service
Centralizes variation detection and generation from acceptance criteria
"""

import logging
from typing import List, Dict, Any, Optional, Set
from app.schemas.requirement_schemas import (
    RequirementContext,
    SyntheticAppModel,
    ScenarioSkeleton,
    SyntheticScreen
)

logger = logging.getLogger(__name__)


class VariationType:
    """Variation type constants"""
    ADD_NEW_PAYEE = "add_new_payee"
    QUARTERLY_FREQUENCY = "quarterly_frequency"
    YEARLY_FREQUENCY = "yearly_frequency"
    SPECIFIC_END_DATE = "specific_end_date"


class Variation:
    """Represents a detected variation"""
    def __init__(self, variation_type: str, value: Optional[str] = None, description: str = ""):
        self.variation_type = variation_type
        self.value = value
        self.description = description
    
    def __eq__(self, other):
        if not isinstance(other, Variation):
            return False
        return self.variation_type == other.variation_type and self.value == other.value
    
    def __hash__(self):
        return hash((self.variation_type, self.value))


class VariationGenerator:
    """
    Generates test case variations from acceptance criteria.
    Centralizes all variation detection and generation logic.
    """
    
    def __init__(self):
        logger.info("VariationGenerator initialized")
    
    def detect_variations(self, acceptance_criteria: List[str]) -> List[Variation]:
        """
        Detect variations from acceptance criteria.
        
        Args:
            acceptance_criteria: List of acceptance criteria strings
            
        Returns:
            List of detected variations
        """
        variations = []
        seen_variations: Set[Variation] = set()
        
        for ac in acceptance_criteria:
            ac_lower = ac.lower()
            
            # Detect "or" alternatives (e.g., "select saved payee OR add new payee")
            if (" or " in ac_lower or " or add " in ac_lower) and "add new" in ac_lower:
                variation = Variation(
                    variation_type=VariationType.ADD_NEW_PAYEE,
                    description="Add a new payee instead of selecting saved one"
                )
                if variation not in seen_variations:
                    variations.append(variation)
                    seen_variations.add(variation)
                    logger.debug(f"Detected variation: {variation.variation_type}")
            
            # Detect multiple frequency options (e.g., "Monthly, Quarterly, Yearly")
            if "frequency" in ac_lower or ("monthly" in ac_lower and ("quarterly" in ac_lower or "yearly" in ac_lower)):
                frequencies = []
                if "quarterly" in ac_lower:
                    frequencies.append("Quarterly")
                if "yearly" in ac_lower:
                    frequencies.append("Yearly")
                
                # Generate variations for each frequency (skip Monthly as it's in happy path)
                for freq in frequencies:
                    variation = Variation(
                        variation_type=VariationType.QUARTERLY_FREQUENCY if freq == "Quarterly" else VariationType.YEARLY_FREQUENCY,
                        value=freq,
                        description=f"Schedule recurring payment with {freq.lower()} frequency"
                    )
                    if variation not in seen_variations:
                        variations.append(variation)
                        seen_variations.add(variation)
                        logger.debug(f"Detected variation: {variation.variation_type} = {variation.value}")
            
            # Detect optional end date fields
            if "optional" in ac_lower and "end date" in ac_lower:
                variation = Variation(
                    variation_type=VariationType.SPECIFIC_END_DATE,
                    description="Schedule recurring payment with a specific end date"
                )
                if variation not in seen_variations:
                    variations.append(variation)
                    seen_variations.add(variation)
                    logger.debug(f"Detected variation: {variation.variation_type}")
        
        logger.info(f"Detected {len(variations)} variations from acceptance criteria")
        return variations
    
    def generate_variation_scenarios(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel,
        variations: List[Variation],
        base_scenario_id: int = 2
    ) -> List[ScenarioSkeleton]:
        """
        Generate scenario skeletons for detected variations.
        
        Args:
            context: Requirement context
            app_model: Synthetic app model
            variations: List of detected variations
            base_scenario_id: Starting ID for variation scenarios
            
        Returns:
            List of variation scenario skeletons
        """
        scenarios = []
        form_screen = next((s for s in app_model.screens if s.type == "form"), None)
        
        if not form_screen:
            logger.warning("No form screen found in app model, skipping variation generation")
            return scenarios
        
        for i, variation in enumerate(variations, 1):
            scenario = self._create_variation_scenario(
                context=context,
                app_model=app_model,
                form_screen=form_screen,
                variation=variation,
                base_scenario_id=base_scenario_id + i - 1
            )
            if scenario:
                scenarios.append(scenario)
                logger.debug(f"Generated variation scenario: {scenario.title}")
        
        return scenarios
    
    def _create_variation_scenario(
        self,
        context: RequirementContext,
        app_model: SyntheticAppModel,
        form_screen: SyntheticScreen,
        variation: Variation,
        base_scenario_id: int
    ) -> Optional[ScenarioSkeleton]:
        """Create a scenario skeleton for a specific variation"""
        
        # Start with base steps
        steps = []
        list_screen = next((s for s in app_model.screens if s.type == "list"), None)
        if list_screen:
            add_action = next((a for a in (list_screen.actions or []) if a.get("id") == "action_add"), None)
            if add_action:
                steps.append(f"Navigate to {list_screen.name} ({list_screen.id})")
                steps.append(f"Click '{add_action.get('label', 'Add')}' ({add_action.get('id')})")
        
        steps.append(f"On {form_screen.name} ({form_screen.id}), populate all required fields")
        
        # Add variation-specific steps
        if variation.variation_type == VariationType.ADD_NEW_PAYEE:
            steps.append("Click 'Add New Payee' button instead of selecting from saved list")
            steps.append("Enter new payee details (name, account number, routing number)")
            steps.append("Save the new payee")
            steps.append("Verify the new payee appears in the payee list")
        
        elif variation.variation_type == VariationType.QUARTERLY_FREQUENCY:
            steps.append("Set payment frequency to 'Quarterly' (NOT Monthly or Yearly)")
            steps.append("Verify frequency field displays 'Quarterly' as selected")
        
        elif variation.variation_type == VariationType.YEARLY_FREQUENCY:
            steps.append("Set payment frequency to 'Yearly' (NOT Monthly or Quarterly)")
            steps.append("Verify frequency field displays 'Yearly' as selected")
        
        elif variation.variation_type == VariationType.SPECIFIC_END_DATE:
            steps.append("Set a specific end date (e.g., 6 months from start date)")
            steps.append("Do NOT select 'Until Cancelled' option")
            steps.append("Verify end date field shows the specific date (not 'until cancelled')")
        
        # Add remaining form fields (skip fields we've already handled)
        for field in form_screen.fields or []:
            field_label = field.get("label", "")
            field_type = field.get("type", "")
            
            # Skip fields we've already handled
            if variation.variation_type in [VariationType.QUARTERLY_FREQUENCY, VariationType.YEARLY_FREQUENCY] and "frequency" in field_label.lower():
                continue
            if variation.variation_type == VariationType.SPECIFIC_END_DATE and "end date" in field_label.lower():
                continue
            
            if field_type == "select":
                steps.append(f"Select a value in {field_label}")
            elif field_type == "date":
                steps.append(f"Set a valid {field_label} in the future")
            elif field_type == "currency":
                steps.append(f"Enter a valid amount in {field_label}")
            else:
                steps.append(f"Enter a value in {field_label}")
        
        # Save action
        save_action = next((a for a in (form_screen.actions or []) if a.get("kind") == "primary"), None)
        if save_action:
            steps.append(f"Click '{save_action.get('label', 'Save')}' ({save_action.get('id')})")
        
        # Create title based on variation - make it VERY explicit
        title = self._create_variation_title(context, variation)
        
        return ScenarioSkeleton(
            id=f"{context.requirement_id}-TC{base_scenario_id}",
            requirement_id=context.requirement_id,
            kind="variation",
            title=title,
            preconditions=context.preconditions or [],
            steps=steps,
            expected_result=[
                f"Successfully {variation.description.lower()}",
                "Payment is scheduled with the specified configuration"
            ],
            priority="medium",
            tags=["variation", "acceptance_criteria", variation.variation_type]
        )
    
    def _create_variation_title(self, context: RequirementContext, variation: Variation) -> str:
        """Create a very explicit title for a variation"""
        base_title = context.title.lower()
        
        if variation.variation_type == VariationType.ADD_NEW_PAYEE:
            return f"Schedule {base_title} with a NEW payee (add new payee variation)"
        
        elif variation.variation_type == VariationType.QUARTERLY_FREQUENCY:
            return f"Schedule {base_title} with QUARTERLY frequency (not monthly or yearly)"
        
        elif variation.variation_type == VariationType.YEARLY_FREQUENCY:
            return f"Schedule {base_title} with YEARLY frequency (not monthly or quarterly)"
        
        elif variation.variation_type == VariationType.SPECIFIC_END_DATE:
            return f"Schedule {base_title} with SPECIFIC END DATE (not 'until cancelled' variation)"
        
        return f"{context.title} - {variation.description}"

