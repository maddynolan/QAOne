"""
Domain-Specific Flow Generator
Generates test flows specific to the application domain and context.
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

from app.services.exploration.application_analyzer import ApplicationContext
from app.services.exploration.synthetic_data_generator import SyntheticDataGenerator

logger = logging.getLogger(__name__)


@dataclass
class FlowStep:
    """A step in a test flow."""
    step_number: int
    action: str  # click, fill, verify, navigate, wait
    target: str  # Element selector or description
    data: Optional[Dict] = None
    expected_result: Optional[str] = None
    safe_to_execute: bool = True
    verification: Optional[str] = None


@dataclass
class TestFlow:
    """A complete test flow."""
    name: str
    description: str
    domain: str
    priority: str
    steps: List[FlowStep]
    test_data: Dict[str, Any]
    expected_outcome: str


class DomainSpecificFlowGenerator:
    """Generates domain-specific test flows."""
    
    def __init__(self, application_context: ApplicationContext, synthetic_data_generator: SyntheticDataGenerator):
        """Initialize with application context and data generator."""
        self.context = application_context
        self.data_generator = synthetic_data_generator
        # Update data generator context
        self.data_generator.context = {
            'domain': application_context.domain,
            'application_type': application_context.application_type,
            'entities': application_context.primary_entities
        }
    
    def generate_flows(self, pages: List[Dict], forms: List[Dict], buttons: List[str]) -> List[TestFlow]:
        """Generate test flows based on application context."""
        flows = []
        
        # Generate flows from critical flows identified
        for critical_flow in self.context.critical_flows:
            flow = self._generate_flow_from_critical(
                critical_flow, pages, forms, buttons
            )
            if flow:
                flows.append(flow)
        
        # Generate entity-specific flows
        for entity in self.context.primary_entities:
            entity_flows = self._generate_entity_flows(entity, pages, forms, buttons)
            flows.extend(entity_flows)
        
        # Generate operation-specific flows
        for operation in self.context.key_operations:
            operation_flows = self._generate_operation_flows(operation, pages, forms, buttons)
            flows.extend(operation_flows)
        
        return flows
    
    def _generate_flow_from_critical(
        self,
        critical_flow: Dict,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate detailed flow from critical flow definition."""
        flow_name = critical_flow['name']
        flow_steps = critical_flow.get('steps', [])
        
        steps = []
        test_data = {}
        
        for i, step_name in enumerate(flow_steps, 1):
            step = self._create_flow_step(
                step_number=i,
                step_name=step_name,
                flow_name=flow_name,
                pages=pages,
                forms=forms,
                buttons=buttons,
                test_data=test_data
            )
            if step:
                steps.append(step)
                # Update test_data if step generates data
                if step.data:
                    test_data.update(step.data)
        
        if not steps:
            return None
        
        return TestFlow(
            name=flow_name,
            description=critical_flow.get('description', ''),
            domain=self.context.domain,
            priority=critical_flow.get('priority', 'medium'),
            steps=steps,
            test_data=test_data,
            expected_outcome=critical_flow.get('expected_outcome', 'Flow completes successfully')
        )
    
    def _create_flow_step(
        self,
        step_number: int,
        step_name: str,
        flow_name: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str],
        test_data: Dict
    ) -> Optional[FlowStep]:
        """Create a flow step from step name."""
        step_name_lower = step_name.lower()
        
        # Navigation steps
        if 'navigate' in step_name_lower or 'go to' in step_name_lower:
            target_page = self._find_page_for_step(step_name, pages)
            return FlowStep(
                step_number=step_number,
                action='navigate',
                target=target_page or step_name,
                expected_result=f"Navigate to {step_name}"
            )
        
        # Form filling steps
        if 'fill' in step_name_lower or 'enter' in step_name_lower:
            form = self._find_form_for_step(step_name, forms)
            if form:
                form_data = self.data_generator.generate_form_data(form.get('fields', []))
                return FlowStep(
                    step_number=step_number,
                    action='fill',
                    target=form.get('name', 'form'),
                    data=form_data,
                    expected_result=f"Form filled with test data"
                )
        
        # Click/action steps
        if any(keyword in step_name_lower for keyword in ['click', 'select', 'choose', 'add', 'create', 'submit']):
            button = self._find_button_for_step(step_name, buttons)
            safe = self._is_safe_to_execute(step_name)
            return FlowStep(
                step_number=step_number,
                action='click',
                target=button or step_name,
                safe_to_execute=safe,
                expected_result=f"Action {step_name} executed" if safe else f"Navigate to {step_name} (not executed)"
            )
        
        # Verification steps
        if any(keyword in step_name_lower for keyword in ['verify', 'check', 'view', 'confirm']):
            return FlowStep(
                step_number=step_number,
                action='verify',
                target=step_name,
                expected_result=f"Verify {step_name}"
            )
        
        return None
    
    def _generate_entity_flows(
        self,
        entity: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> List[TestFlow]:
        """Generate CRUD flows for an entity."""
        flows = []
        
        # Create flow
        create_flow = self._generate_create_flow(entity, pages, forms, buttons)
        if create_flow:
            flows.append(create_flow)
        
        # Read/View flow
        view_flow = self._generate_view_flow(entity, pages, forms, buttons)
        if view_flow:
            flows.append(view_flow)
        
        # Update flow
        update_flow = self._generate_update_flow(entity, pages, forms, buttons)
        if update_flow:
            flows.append(update_flow)
        
        # Delete flow (safe - navigate but don't execute)
        delete_flow = self._generate_delete_flow(entity, pages, forms, buttons)
        if delete_flow:
            flows.append(delete_flow)
        
        return flows
    
    def _generate_create_flow(
        self,
        entity: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate create flow for entity."""
        # Find create button/form
        create_button = self._find_button_with_text(['create', 'add', 'new'], entity, buttons)
        create_form = self._find_form_for_entity(entity, forms)
        
        if not create_button and not create_form:
            return None
        
        steps = []
        test_data = {}
        
        # Step 1: Navigate to create page
        steps.append(FlowStep(
            step_number=1,
            action='navigate',
            target=f'Create {entity} page',
            expected_result=f"Navigate to create {entity.lower()} page"
        ))
        
        # Step 2: Fill form
        if create_form:
            form_data = self.data_generator.generate_form_data(create_form.get('fields', []))
            test_data.update(form_data)
            steps.append(FlowStep(
                step_number=2,
                action='fill',
                target=create_form.get('name', 'form'),
                data=form_data,
                expected_result=f"Form filled with test data"
            ))
        
        # Step 3: Submit (if safe)
        safe = self._is_safe_to_submit(create_form)
        steps.append(FlowStep(
            step_number=3,
            action='click',
            target='Submit',
            safe_to_execute=safe,
            expected_result=f"Form submitted" if safe else f"Navigate to submit (not executed)"
        ))
        
        # Step 4: Verify creation
        steps.append(FlowStep(
            step_number=4,
            action='verify',
            target=f'{entity} created',
            expected_result=f"Verify {entity.lower()} was created successfully"
        ))
        
        return TestFlow(
            name=f'Create {entity}',
            description=f'Create a new {entity.lower()}',
            domain=self.context.domain,
            priority='high',
            steps=steps,
            test_data=test_data,
            expected_outcome=f'{entity} created successfully'
        )
    
    def _generate_view_flow(
        self,
        entity: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate view/list flow for entity."""
        view_button = self._find_button_with_text(['view', 'list', 'browse', 'search'], entity, buttons)
        
        if not view_button:
            return None
        
        steps = [
            FlowStep(
                step_number=1,
                action='navigate',
                target=f'{entity} list page',
                expected_result=f"Navigate to {entity.lower()} list"
            ),
            FlowStep(
                step_number=2,
                action='verify',
                target=f'{entity} list displayed',
                expected_result=f"Verify {entity.lower()} list is displayed"
            )
        ]
        
        return TestFlow(
            name=f'View {entity} List',
            description=f'View list of {entity.lower()}s',
            domain=self.context.domain,
            priority='medium',
            steps=steps,
            test_data={},
            expected_outcome=f'{entity} list displayed'
        )
    
    def _generate_update_flow(
        self,
        entity: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate update flow for entity."""
        edit_button = self._find_button_with_text(['edit', 'update', 'modify'], entity, buttons)
        edit_form = self._find_form_for_entity(entity, forms, edit=True)
        
        if not edit_button:
            return None
        
        steps = [
            FlowStep(
                step_number=1,
                action='navigate',
                target=f'{entity} list',
                expected_result=f"Navigate to {entity.lower()} list"
            ),
            FlowStep(
                step_number=2,
                action='click',
                target='Edit',
                expected_result=f"Click edit on {entity.lower()}"
            ),
            FlowStep(
                step_number=3,
                action='fill',
                target='Edit form',
                data={},  # Will be filled with test data
                expected_result=f"Update form fields"
            ),
            FlowStep(
                step_number=4,
                action='click',
                target='Save',
                safe_to_execute=True,
                expected_result=f"Save changes"
            ),
            FlowStep(
                step_number=5,
                action='verify',
                target=f'{entity} updated',
                expected_result=f"Verify {entity.lower()} was updated"
            )
        ]
        
        return TestFlow(
            name=f'Update {entity}',
            description=f'Update an existing {entity.lower()}',
            domain=self.context.domain,
            priority='high',
            steps=steps,
            test_data={},
            expected_outcome=f'{entity} updated successfully'
        )
    
    def _generate_delete_flow(
        self,
        entity: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate delete flow (safe - navigate but don't execute)."""
        delete_button = self._find_button_with_text(['delete', 'remove'], entity, buttons)
        
        if not delete_button:
            return None
        
        steps = [
            FlowStep(
                step_number=1,
                action='navigate',
                target=f'{entity} list',
                expected_result=f"Navigate to {entity.lower()} list"
            ),
            FlowStep(
                step_number=2,
                action='click',
                target='Delete',
                expected_result=f"Click delete on {entity.lower()}"
            ),
            FlowStep(
                step_number=3,
                action='verify',
                target='Delete confirmation',
                expected_result=f"Verify delete confirmation dialog appears"
            ),
            FlowStep(
                step_number=4,
                action='click',
                target='Confirm Delete',
                safe_to_execute=False,  # Don't actually delete
                expected_result=f"Navigate to confirm delete (not executed)"
            )
        ]
        
        return TestFlow(
            name=f'Delete {entity} (Safe)',
            description=f'Navigate through delete flow without executing',
            domain=self.context.domain,
            priority='medium',
            steps=steps,
            test_data={},
            expected_outcome=f'Delete flow navigated safely'
        )
    
    def _generate_operation_flows(
        self,
        operation: str,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> List[TestFlow]:
        """Generate flows for specific operations."""
        flows = []
        
        # Operation-specific logic based on domain
        if self.context.domain == 'ecommerce' and operation.lower() == 'purchase':
            flows.append(self._generate_purchase_flow(pages, forms, buttons))
        elif self.context.domain == 'healthcare' and operation.lower() == 'schedule':
            flows.append(self._generate_schedule_flow(pages, forms, buttons))
        elif self.context.domain == 'crm' and operation.lower() == 'convert':
            flows.append(self._generate_convert_flow(pages, forms, buttons))
        
        return [f for f in flows if f]
    
    def _generate_purchase_flow(
        self,
        pages: List[Dict],
        forms: List[Dict],
        buttons: List[str]
    ) -> Optional[TestFlow]:
        """Generate purchase flow for e-commerce."""
        steps = [
            FlowStep(1, 'navigate', 'Product listing', expected_result='Navigate to products'),
            FlowStep(2, 'click', 'View product', expected_result='View product details'),
            FlowStep(3, 'click', 'Add to cart', expected_result='Add product to cart'),
            FlowStep(4, 'navigate', 'Cart', expected_result='View cart'),
            FlowStep(5, 'click', 'Checkout', expected_result='Proceed to checkout'),
            FlowStep(6, 'fill', 'Shipping form', data={}, expected_result='Fill shipping info'),
            FlowStep(7, 'fill', 'Payment form', data={}, expected_result='Fill payment info'),
            FlowStep(8, 'verify', 'Order review', expected_result='Review order'),
            FlowStep(9, 'click', 'Place order', safe_to_execute=False, expected_result='Navigate to place order (not executed)')
        ]
        
        return TestFlow(
            name='Purchase Flow (Safe)',
            description='Complete purchase flow without placing order',
            domain='ecommerce',
            priority='high',
            steps=steps,
            test_data={},
            expected_outcome='Purchase flow navigated safely'
        )
    
    # Helper methods
    def _find_page_for_step(self, step_name: str, pages: List[Dict]) -> Optional[str]:
        """Find page relevant to step."""
        step_lower = step_name.lower()
        for page in pages:
            title = page.get('title', '').lower()
            if any(word in title for word in step_lower.split()):
                return page.get('url')
        return None
    
    def _find_form_for_step(self, step_name: str, forms: List[Dict]) -> Optional[Dict]:
        """Find form relevant to step."""
        step_lower = step_name.lower()
        for form in forms:
            form_name = form.get('name', '').lower()
            if any(word in form_name for word in step_lower.split()):
                return form
        return None
    
    def _find_button_for_step(self, step_name: str, buttons: List[str]) -> Optional[str]:
        """Find button relevant to step."""
        step_lower = step_name.lower()
        for button in buttons:
            if any(word in button.lower() for word in step_lower.split()):
                return button
        return None
    
    def _find_button_with_text(self, keywords: List[str], entity: str, buttons: List[str]) -> Optional[str]:
        """Find button with specific keywords and entity."""
        entity_lower = entity.lower()
        for button in buttons:
            button_lower = button.lower()
            if any(kw in button_lower for kw in keywords) and entity_lower in button_lower:
                return button
        return None
    
    def _find_form_for_entity(self, entity: str, forms: List[Dict], edit: bool = False) -> Optional[Dict]:
        """Find form for entity."""
        entity_lower = entity.lower()
        for form in forms:
            form_name = form.get('name', '').lower()
            action = form.get('action', '').lower()
            if entity_lower in form_name or entity_lower in action:
                if not edit or 'edit' in form_name or 'update' in action:
                    return form
        return None
    
    def _is_safe_to_execute(self, step_name: str) -> bool:
        """Determine if step is safe to execute."""
        unsafe_keywords = ['delete', 'remove', 'cancel', 'place order', 'confirm payment', 'activate subscription']
        step_lower = step_name.lower()
        return not any(keyword in step_lower for keyword in unsafe_keywords)
    
    def _is_safe_to_submit(self, form: Optional[Dict]) -> bool:
        """Determine if form is safe to submit."""
        if not form:
            return True
        
        form_name = form.get('name', '').lower()
        action = form.get('action', '').lower()
        
        unsafe_patterns = ['payment', 'order', 'subscription', 'delete', 'cancel']
        return not any(pattern in form_name or pattern in action for pattern in unsafe_patterns)




