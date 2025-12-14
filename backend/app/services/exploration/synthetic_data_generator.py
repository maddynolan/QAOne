"""
Synthetic Test Data Generator
Generates realistic test data for form filling and E2E testing.
"""

import random
import string
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class SyntheticDataGenerator:
    """Generate realistic synthetic test data for forms and testing."""
    
    # Common first names
    FIRST_NAMES = [
        'John', 'Jane', 'Bob', 'Alice', 'Charlie', 'Diana', 'Edward', 'Fiona',
        'George', 'Helen', 'Ivan', 'Julia', 'Kevin', 'Laura', 'Michael', 'Nancy',
        'Oliver', 'Patricia', 'Quinn', 'Rachel', 'Steven', 'Tina', 'Victor', 'Wendy'
    ]
    
    # Common last names
    LAST_NAMES = [
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
        'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas', 'Taylor'
    ]
    
    # Common street names
    STREET_NAMES = [
        'Main', 'Oak', 'Elm', 'Park', 'First', 'Second', 'Third', 'Maple',
        'Cedar', 'Pine', 'Washington', 'Lincoln', 'Jefferson', 'Madison', 'Adams'
    ]
    
    # Common cities
    CITIES = [
        'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
        'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
        'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle'
    ]
    
    # Common states
    STATES = [
        'NY', 'CA', 'IL', 'TX', 'FL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA'
    ]
    
    def __init__(self, context: Optional[Dict[str, Any]] = None):
        """Initialize with optional context for context-aware generation."""
        self.context = context or {}
    
    def generate(self, field_type: str, field_name: str = "", required: bool = True) -> str:
        """
        Generate test data based on field type and name.
        
        Args:
            field_type: Type of field (email, text, number, date, etc.)
            field_name: Name of the field (for context-aware generation)
            required: Whether field is required
        
        Returns:
            Generated test data as string
        """
        field_name_lower = field_name.lower()
        
        # Context-aware generation based on field name
        if 'email' in field_name_lower or field_type == 'email':
            return self._generate_email()
        
        if 'phone' in field_name_lower or 'tel' in field_name_lower:
            return self._generate_phone()
        
        if 'name' in field_name_lower:
            if 'first' in field_name_lower:
                return self._generate_first_name()
            elif 'last' in field_name_lower:
                return self._generate_last_name()
            else:
                return self._generate_full_name()
        
        if 'address' in field_name_lower or 'street' in field_name_lower:
            return self._generate_address()
        
        if 'city' in field_name_lower:
            return self._generate_city()
        
        if 'state' in field_name_lower:
            return self._generate_state()
        
        if 'zip' in field_name_lower or 'postal' in field_name_lower:
            return self._generate_zip()
        
        if 'date' in field_name_lower or field_type == 'date':
            return self._generate_date()
        
        if 'number' in field_type or 'integer' in field_type:
            return self._generate_number(field_name_lower)
        
        if 'password' in field_name_lower:
            return self._generate_password()
        
        if 'url' in field_name_lower or field_type == 'url':
            return self._generate_url()
        
        # Context-aware for specific domains
        if self.context.get('product_type'):
            product_type = self.context['product_type'].lower()
            if 'tire' in product_type:
                if 'size' in field_name_lower:
                    return self._generate_tire_size()
                if 'brand' in field_name_lower:
                    return random.choice(['Michelin', 'Goodyear', 'Bridgestone', 'Continental'])
        
        # Default: generate text
        return self._generate_text(field_name)
    
    def _generate_email(self) -> str:
        """Generate a unique email address."""
        username = random.choice(self.FIRST_NAMES).lower() + str(random.randint(100, 999))
        domains = ['example.com', 'test.com', 'demo.com', 'sample.org']
        return f"{username}@{random.choice(domains)}"
    
    def _generate_phone(self) -> str:
        """Generate a phone number."""
        return f"{random.randint(200, 999)}-{random.randint(200, 999)}-{random.randint(1000, 9999)}"
    
    def _generate_first_name(self) -> str:
        """Generate a first name."""
        return random.choice(self.FIRST_NAMES)
    
    def _generate_last_name(self) -> str:
        """Generate a last name."""
        return random.choice(self.LAST_NAMES)
    
    def _generate_full_name(self) -> str:
        """Generate a full name."""
        return f"{self._generate_first_name()} {self._generate_last_name()}"
    
    def _generate_address(self) -> str:
        """Generate a street address."""
        number = random.randint(1, 9999)
        street = random.choice(self.STREET_NAMES)
        suffix = random.choice(['St', 'Ave', 'Rd', 'Blvd', 'Dr'])
        return f"{number} {street} {suffix}"
    
    def _generate_city(self) -> str:
        """Generate a city name."""
        return random.choice(self.CITIES)
    
    def _generate_state(self) -> str:
        """Generate a state abbreviation."""
        return random.choice(self.STATES)
    
    def _generate_zip(self) -> str:
        """Generate a ZIP code."""
        return f"{random.randint(10000, 99999)}"
    
    def _generate_date(self, days_offset: Optional[int] = None) -> str:
        """Generate a date."""
        if days_offset is None:
            days_offset = random.randint(-365, 365)
        date = datetime.now() + timedelta(days=days_offset)
        return date.strftime('%Y-%m-%d')
    
    def _generate_number(self, field_name: str = "") -> str:
        """Generate a number based on context."""
        if 'quantity' in field_name or 'qty' in field_name:
            return str(random.randint(1, 10))
        elif 'price' in field_name or 'cost' in field_name:
            return f"{random.randint(10, 1000)}.{random.randint(10, 99)}"
        elif 'age' in field_name:
            return str(random.randint(18, 80))
        else:
            return str(random.randint(1, 1000))
    
    def _generate_password(self, length: int = 12) -> str:
        """Generate a password."""
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(random.choice(chars) for _ in range(length))
    
    def _generate_url(self) -> str:
        """Generate a URL."""
        domains = ['example.com', 'test.com', 'demo.com']
        paths = ['page', 'item', 'product', 'article']
        return f"https://{random.choice(domains)}/{random.choice(paths)}/{random.randint(1, 100)}"
    
    def _generate_text(self, field_name: str = "") -> str:
        """Generate generic text."""
        prefixes = ['Test', 'Sample', 'Demo', 'Example']
        suffixes = ['Item', 'Product', 'Description', 'Content', 'Data']
        return f"{random.choice(prefixes)} {random.choice(suffixes)} {random.randint(1, 100)}"
    
    def _generate_tire_size(self) -> str:
        """Generate a tire size (context-aware for tire websites)."""
        width = random.choice(['205', '215', '225', '235', '245'])
        aspect = random.choice(['55', '60', '65', '70'])
        diameter = random.choice(['15', '16', '17', '18', '19'])
        return f"{width}/{aspect}R{diameter}"
    
    def generate_form_data(self, form_fields: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Generate test data for all fields in a form.
        
        Args:
            form_fields: List of field definitions with 'name', 'type', 'required', etc.
        
        Returns:
            Dictionary mapping field names to generated values
        """
        form_data = {}
        for field in form_fields:
            field_name = field.get('name', '')
            field_type = field.get('type', 'text')
            required = field.get('required', True)
            
            if required or random.random() > 0.3:  # Fill 70% of optional fields
                form_data[field_name] = self.generate(field_type, field_name, required)
        
        return form_data







