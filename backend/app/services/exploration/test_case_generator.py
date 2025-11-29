"""
Test Case Generator from Capability Map
Automatically generates comprehensive test cases from discovered capabilities.
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
import random
import string

logger = logging.getLogger(__name__)


@dataclass
class GeneratedTestCase:
    """Represents a generated test case."""
    title: str
    description: str
    test_type: str  # functional, integration, edge_case
    priority: str  # high, medium, low
    steps: List[Dict[str, str]]
    expected_result: str
    entity: str
    operation: str
    test_data: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


class ExplorationTestCaseGenerator:
    """
    Generates test cases automatically from capability map.
    Creates positive, negative, edge cases, and integration tests.
    """
    
    def __init__(self):
        self.test_data_generator = TestDataGenerator()
    
    async def generate_from_capability_map(
        self,
        capability_map: Dict[str, Any]
    ) -> List[GeneratedTestCase]:
        """
        Generate test cases from capability map.
        
        Args:
            capability_map: Output from CapabilityMapBuilder
        
        Returns:
            List of generated test cases
        """
        logger.info("Generating test cases from capability map")
        
        test_cases = []
        entities = capability_map.get('entities', [])
        pages = capability_map.get('pages', [])
        
        # Group capabilities by entity
        entity_capabilities = {}
        for entity_cap in entities:
            entity = entity_cap.get('entity', '')
            if entity not in entity_capabilities:
                entity_capabilities[entity] = []
            entity_capabilities[entity].append(entity_cap)
        
        # Generate tests for each entity/operation combination
        for entity, capabilities in entity_capabilities.items():
            for cap in capabilities:
                operation = cap.get('operation', '')
                fields = cap.get('fields', [])
                validations = cap.get('validations', [])
                source_pages = cap.get('source_pages', [])
                
                # 1. Positive test cases (happy paths)
                positive_tests = self._generate_positive_tests(
                    entity, operation, fields, source_pages
                )
                test_cases.extend(positive_tests)
                
                # 2. Negative test cases (validation errors)
                negative_tests = self._generate_negative_tests(
                    entity, operation, fields, validations, source_pages
                )
                test_cases.extend(negative_tests)
                
                # 3. Edge cases
                edge_tests = self._generate_edge_cases(
                    entity, operation, fields, source_pages
                )
                test_cases.extend(edge_tests)
        
        # 4. Integration tests (flows between entities)
        integration_tests = self._generate_integration_tests(
            entity_capabilities, pages
        )
        test_cases.extend(integration_tests)
        
        logger.info(f"Generated {len(test_cases)} test cases from capability map")
        return test_cases
    
    def _generate_positive_tests(
        self,
        entity: str,
        operation: str,
        fields: List[Dict],
        source_pages: List[str]
    ) -> List[GeneratedTestCase]:
        """Generate positive test cases (happy paths)."""
        tests = []
        
        # Basic positive test
        test_data = {}
        steps = []
        
        # Generate test data for all fields
        for field in fields:
            field_name = field.get('name', '')
            if field_name:
                test_data[field_name] = self.test_data_generator.generate_for_field(field)
        
        # Build steps
        if operation.lower() in ['create', 'browse', 'read']:
            steps.append({
                'step_number': 1,
                'action': f"Navigate to {entity} {operation} page",
                'expected_result': f"{entity} {operation} page loads successfully"
            })
            
            if operation.lower() == 'create' and fields:
                steps.append({
                    'step_number': 2,
                    'action': f"Fill all required fields with valid data",
                    'expected_result': "All fields are filled correctly"
                })
                steps.append({
                    'step_number': 3,
                    'action': "Click submit/save button",
                    'expected_result': f"{entity} is {operation.lower()}d successfully"
                })
        
        if steps:
            tests.append(GeneratedTestCase(
                title=f"Verify {entity} {operation} with valid data",
                description=f"Test that {entity} can be {operation.lower()}d successfully with all valid inputs",
                test_type='functional',
                priority='high',
                steps=steps,
                expected_result=f"{entity} is {operation.lower()}d successfully with valid data",
                entity=entity,
                operation=operation,
                test_data=test_data,
                tags=[entity.lower(), operation.lower(), 'positive']
            ))
        
        return tests
    
    def _generate_negative_tests(
        self,
        entity: str,
        operation: str,
        fields: List[Dict],
        validations: List[Dict],
        source_pages: List[str]
    ) -> List[GeneratedTestCase]:
        """Generate negative test cases (validation errors)."""
        tests = []
        
        required_fields = [f for f in fields if f.get('required', False)]
        
        # Test missing required fields
        for field in required_fields:
            field_name = field.get('name', '')
            field_label = field.get('label', field_name)
            
            steps = [
                {
                    'step_number': 1,
                    'action': f"Navigate to {entity} {operation} page",
                    'expected_result': f"{entity} {operation} page loads"
                },
                {
                    'step_number': 2,
                    'action': f"Leave {field_label} field empty",
                    'expected_result': f"{field_label} field is empty"
                },
                {
                    'step_number': 3,
                    'action': "Attempt to submit form",
                    'expected_result': f"Validation error shown for {field_label}"
                }
            ]
            
            tests.append(GeneratedTestCase(
                title=f"Verify {entity} {operation} fails with missing {field_label}",
                description=f"Test that {entity} {operation} fails when required field {field_label} is missing",
                test_type='functional',
                priority='medium',
                steps=steps,
                expected_result=f"Validation error displayed for missing {field_label}",
                entity=entity,
                operation=operation,
                tags=[entity.lower(), operation.lower(), 'negative', 'validation']
            ))
        
        # Test invalid field formats
        for validation in validations:
            field_name = validation.get('field', '')
            validation_type = validation.get('type', '')
            
            if validation_type == 'email_format':
                steps = [
                    {
                        'step_number': 1,
                        'action': f"Navigate to {entity} {operation} page",
                        'expected_result': f"{entity} {operation} page loads"
                    },
                    {
                        'step_number': 2,
                        'action': f"Enter invalid email format in {field_name} field",
                        'expected_result': f"Invalid email entered"
                    },
                    {
                        'step_number': 3,
                        'action': "Attempt to submit form",
                        'expected_result': "Email validation error shown"
                    }
                ]
                
                tests.append(GeneratedTestCase(
                    title=f"Verify {entity} {operation} fails with invalid email format",
                    description=f"Test that {entity} {operation} fails when {field_name} has invalid email format",
                    test_type='functional',
                    priority='medium',
                    steps=steps,
                    expected_result="Email validation error displayed",
                    entity=entity,
                    operation=operation,
                    tags=[entity.lower(), operation.lower(), 'negative', 'validation', 'email']
                ))
        
        return tests
    
    def _generate_edge_cases(
        self,
        entity: str,
        operation: str,
        fields: List[Dict],
        source_pages: List[str]
    ) -> List[GeneratedTestCase]:
        """Generate edge case test cases."""
        tests = []
        
        # Test with maximum field length
        for field in fields:
            field_name = field.get('name', '')
            field_type = field.get('type', 'text')
            
            if field_type == 'text':
                steps = [
                    {
                        'step_number': 1,
                        'action': f"Navigate to {entity} {operation} page",
                        'expected_result': f"{entity} {operation} page loads"
                    },
                    {
                        'step_number': 2,
                        'action': f"Enter maximum length text in {field_name} field",
                        'expected_result': f"Maximum length text entered"
                    },
                    {
                        'step_number': 3,
                        'action': "Submit form",
                        'expected_result': f"{entity} {operation.lower()}d successfully or appropriate error shown"
                    }
                ]
                
                tests.append(GeneratedTestCase(
                    title=f"Verify {entity} {operation} with maximum {field_name} length",
                    description=f"Test {entity} {operation} with maximum length input for {field_name}",
                    test_type='edge_case',
                    priority='low',
                    steps=steps,
                    expected_result=f"Form handles maximum length input correctly",
                    entity=entity,
                    operation=operation,
                    tags=[entity.lower(), operation.lower(), 'edge_case', 'max_length']
                ))
        
        return tests
    
    def _generate_integration_tests(
        self,
        entity_capabilities: Dict[str, List[Dict]],
        pages: List[Dict]
    ) -> List[GeneratedTestCase]:
        """Generate integration test cases (flows between entities)."""
        tests = []
        
        # Common e-commerce flows
        if 'Product' in entity_capabilities and 'Cart' in entity_capabilities:
            steps = [
                {
                    'step_number': 1,
                    'action': "Navigate to Product browse page",
                    'expected_result': "Product browse page loads"
                },
                {
                    'step_number': 2,
                    'action': "Select a product",
                    'expected_result': "Product is selected"
                },
                {
                    'step_number': 3,
                    'action': "Click 'Add to Cart' button",
                    'expected_result': "Product is added to cart"
                },
                {
                    'step_number': 4,
                    'action': "Navigate to Cart page",
                    'expected_result': "Cart page loads with added product"
                },
                {
                    'step_number': 5,
                    'action': "Click 'Checkout' button",
                    'expected_result': "Checkout page loads or redirects to login"
                }
            ]
            
            tests.append(GeneratedTestCase(
                title="Verify complete flow: Browse Product → Add to Cart → Checkout",
                description="Test the complete e-commerce flow from product browsing to checkout",
                test_type='integration',
                priority='high',
                steps=steps,
                expected_result="Complete flow executes successfully",
                entity='Product',
                operation='Flow',
                tags=['integration', 'e-commerce', 'product', 'cart', 'checkout']
            ))
        
        return tests


class TestDataGenerator:
    """Generates test data for fields based on their types."""
    
    def generate_for_field(self, field: Dict[str, Any]) -> Any:
        """Generate test data for a field."""
        field_type = field.get('type', 'text').lower()
        field_name = field.get('name', '')
        
        generators = {
            'email': lambda: f"test_{random.randint(1000, 9999)}@example.com",
            'text': lambda: f"Test {field_name} {random.randint(1, 100)}",
            'number': lambda: random.randint(1, 1000),
            'date': lambda: datetime.now().strftime('%Y-%m-%d'),
            'password': lambda: f"TestPass{random.randint(100, 999)}!",
            'tel': lambda: f"+1-{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}",
            'url': lambda: f"https://example.com/test{random.randint(1, 100)}",
        }
        
        # Handle select fields
        if field_type == 'select' or field.get('options'):
            options = field.get('options', [])
            if options:
                if isinstance(options[0], dict):
                    return random.choice([opt.get('value', opt.get('text', '')) for opt in options])
                else:
                    return random.choice(options)
        
        generator = generators.get(field_type, lambda: f"Test {field_name}")
        return generator()
    
    def generate_invalid_data(self, field: Dict[str, Any], validation_type: str) -> Any:
        """Generate invalid test data for validation testing."""
        field_type = field.get('type', 'text').lower()
        
        invalid_generators = {
            'email_format': lambda: 'invalid-email',
            'min_length': lambda: 'a',  # Too short
            'max_length': lambda: 'a' * 1000,  # Too long
            'required': lambda: '',  # Empty
        }
        
        generator = invalid_generators.get(validation_type, lambda: 'invalid')
        return generator()

