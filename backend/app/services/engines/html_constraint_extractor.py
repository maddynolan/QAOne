"""
HTML Constraint Extractor - Layer 1 Enhancement
Extracts validation constraints, form structure, and field relationships from HTML.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from html.parser import HTMLParser
from collections import defaultdict

logger = logging.getLogger(__name__)


class HTMLConstraintExtractor:
    """
    Extracts validation constraints and form structure from HTML.
    
    Layer 1 Components:
    1. Required, min/max, patterns, types
    2. Form structure analysis
    3. ARIA attributes
    4. Field relationships (dependencies, conditional fields)
    """
    
    def __init__(self):
        self.constraints = {}
        self.form_structure = {}
        self.field_relationships = defaultdict(list)
    
    def extract_constraints(self, html: str, element_selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract all validation constraints from HTML.
        
        Returns:
        {
            "required": bool,
            "min": Optional[number],
            "max": Optional[number],
            "minLength": Optional[int],
            "maxLength": Optional[int],
            "pattern": Optional[str],
            "step": Optional[number],
            "type": Optional[str],
            "aria_required": Optional[bool],
            "aria_invalid": Optional[bool],
            "custom_validation": Optional[str]
        }
        """
        constraints = {}
        
        # Parse HTML to find the element
        if element_selector:
            element_html = self._extract_element_html(html, element_selector)
        else:
            element_html = html
        
        if not element_html:
            return constraints
        
        # Extract HTML5 validation attributes
        constraints["required"] = "required" in element_html.lower() or 'required=""' in element_html
        constraints["min"] = self._extract_attribute(element_html, "min")
        constraints["max"] = self._extract_attribute(element_html, "max")
        constraints["minLength"] = self._extract_attribute(element_html, "minlength")
        constraints["maxLength"] = self._extract_attribute(element_html, "maxlength")
        constraints["pattern"] = self._extract_attribute(element_html, "pattern")
        constraints["step"] = self._extract_attribute(element_html, "step")
        constraints["type"] = self._extract_attribute(element_html, "type") or "text"
        
        # Extract ARIA validation attributes
        constraints["aria_required"] = self._extract_attribute(element_html, "aria-required") == "true"
        constraints["aria_invalid"] = self._extract_attribute(element_html, "aria-invalid")
        
        # Extract custom validation (data-* attributes)
        constraints["custom_validation"] = self._extract_custom_validation(element_html)
        
        # Infer constraints from type
        if constraints["type"]:
            constraints.update(self._infer_constraints_from_type(constraints["type"]))
        
        return constraints
    
    def analyze_form_structure(self, html: str) -> Dict[str, Any]:
        """
        Analyze form structure and relationships.
        
        Returns:
        {
            "forms": [{
                "id": str,
                "fields": [{
                    "name": str,
                    "type": str,
                    "required": bool,
                    "dependencies": [str],
                    "conditional": Optional[Dict]
                }],
                "submit_buttons": [str],
                "validation_rules": [str]
            }],
            "field_relationships": {
                "field_name": ["depends_on_field1", "depends_on_field2"]
            }
        }
        """
        forms = []
        field_relationships = defaultdict(list)
        
        # Extract all forms
        form_pattern = r'<form[^>]*>(.*?)</form>'
        form_matches = re.finditer(form_pattern, html, re.DOTALL | re.IGNORECASE)
        
        for form_match in form_matches:
            form_html = form_match.group(0)
            form_id = self._extract_attribute(form_html, "id") or self._extract_attribute(form_html, "name")
            
            # Extract form fields
            fields = self._extract_form_fields(form_html)
            
            # Extract submit buttons
            submit_buttons = self._extract_submit_buttons(form_html)
            
            # Analyze field relationships
            for field in fields:
                field_name = field.get("name") or field.get("id")
                if field_name:
                    # Check for conditional fields (e.g., "if country == 'US', show state field")
                    conditional = self._detect_conditional_fields(form_html, field_name)
                    if conditional:
                        field["conditional"] = conditional
                    
                    # Check for dependencies (e.g., "confirm_password depends on password")
                    dependencies = self._detect_field_dependencies(form_html, field_name)
                    if dependencies:
                        field["dependencies"] = dependencies
                        field_relationships[field_name] = dependencies
            
            forms.append({
                "id": form_id,
                "fields": fields,
                "submit_buttons": submit_buttons,
                "validation_rules": self._extract_validation_rules(form_html)
            })
        
        return {
            "forms": forms,
            "field_relationships": dict(field_relationships)
        }
    
    def extract_aria_attributes(self, html: str, element_selector: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract comprehensive ARIA attributes.
        
        Returns:
        {
            "role": Optional[str],
            "aria_label": Optional[str],
            "aria_labelledby": Optional[str],
            "aria_describedby": Optional[str],
            "aria_required": Optional[bool],
            "aria_invalid": Optional[str],
            "aria_live": Optional[str],
            "aria_hidden": Optional[bool],
            "aria_disabled": Optional[bool],
            "aria_readonly": Optional[bool]
        }
        """
        if element_selector:
            element_html = self._extract_element_html(html, element_selector)
        else:
            element_html = html
        
        if not element_html:
            return {}
        
        aria_attrs = {}
        aria_patterns = {
            "role": r'role=["\']([^"\']+)["\']',
            "aria_label": r'aria-label=["\']([^"\']+)["\']',
            "aria_labelledby": r'aria-labelledby=["\']([^"\']+)["\']',
            "aria_describedby": r'aria-describedby=["\']([^"\']+)["\']',
            "aria_required": r'aria-required=["\']([^"\']+)["\']',
            "aria_invalid": r'aria-invalid=["\']([^"\']+)["\']',
            "aria_live": r'aria-live=["\']([^"\']+)["\']',
            "aria_hidden": r'aria-hidden=["\']([^"\']+)["\']',
            "aria_disabled": r'aria-disabled=["\']([^"\']+)["\']',
            "aria_readonly": r'aria-readonly=["\']([^"\']+)["\']'
        }
        
        for attr_name, pattern in aria_patterns.items():
            match = re.search(pattern, element_html, re.IGNORECASE)
            if match:
                value = match.group(1)
                # Convert boolean strings
                if value.lower() in ["true", "false"]:
                    aria_attrs[attr_name] = value.lower() == "true"
                else:
                    aria_attrs[attr_name] = value
        
        return aria_attrs
    
    def _extract_element_html(self, html: str, selector: str) -> Optional[str]:
        """Extract HTML for a specific element by selector."""
        # Simple selector matching (can be enhanced)
        if selector.startswith("#"):
            # ID selector
            id_value = selector[1:]
            pattern = rf'<[^>]+\s+id=["\']{re.escape(id_value)}["\'][^>]*>'
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(0)
        elif selector.startswith("."):
            # Class selector
            class_value = selector[1:]
            pattern = rf'<[^>]+\s+class=["\'][^"\']*{re.escape(class_value)}[^"\']*["\'][^>]*>'
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(0)
        else:
            # Try as name attribute
            pattern = rf'<[^>]+\s+name=["\']{re.escape(selector)}["\'][^>]*>'
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(0)
        
        return None
    
    def _extract_attribute(self, html: str, attr_name: str) -> Optional[Any]:
        """Extract attribute value from HTML."""
        pattern = rf'{re.escape(attr_name)}=["\']([^"\']+)["\']'
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            value = match.group(1)
            # Try to convert to number if possible
            try:
                if "." in value:
                    return float(value)
                return int(value)
            except ValueError:
                return value
        return None
    
    def _extract_custom_validation(self, html: str) -> Optional[str]:
        """Extract custom validation from data-* attributes."""
        # Look for data-validation, data-rule, etc.
        patterns = [
            r'data-validation=["\']([^"\']+)["\']',
            r'data-rule=["\']([^"\']+)["\']',
            r'data-validate=["\']([^"\']+)["\']'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _infer_constraints_from_type(self, input_type: str) -> Dict[str, Any]:
        """Infer constraints based on input type."""
        constraints = {}
        
        type_constraints = {
            "email": {"pattern": r"^[^\s@]+@[^\s@]+\.[^\s@]+$"},
            "url": {"pattern": r"^https?://.+"},
            "tel": {"pattern": r"^[\d\s\-\+\(\)]+$"},
            "number": {"min": 0, "step": 1},
            "date": {"min": "1900-01-01", "max": "2100-12-31"},
            "time": {},
            "datetime-local": {},
            "month": {},
            "week": {},
            "password": {"minLength": 8}  # Common default
        }
        
        if input_type.lower() in type_constraints:
            constraints.update(type_constraints[input_type.lower()])
        
        return constraints
    
    def _extract_form_fields(self, form_html: str) -> List[Dict[str, Any]]:
        """Extract all form fields from form HTML."""
        fields = []
        
        # Extract inputs
        input_pattern = r'<input[^>]*>'
        for match in re.finditer(input_pattern, form_html, re.IGNORECASE):
            input_html = match.group(0)
            field = {
                "name": self._extract_attribute(input_html, "name"),
                "id": self._extract_attribute(input_html, "id"),
                "type": self._extract_attribute(input_html, "type") or "text",
                "required": "required" in input_html.lower(),
                "placeholder": self._extract_attribute(input_html, "placeholder"),
                "label": self._find_associated_label(form_html, input_html)
            }
            fields.append(field)
        
        # Extract textareas
        textarea_pattern = r'<textarea[^>]*>.*?</textarea>'
        for match in re.finditer(textarea_pattern, form_html, re.DOTALL | re.IGNORECASE):
            textarea_html = match.group(0)
            field = {
                "name": self._extract_attribute(textarea_html, "name"),
                "id": self._extract_attribute(textarea_html, "id"),
                "type": "textarea",
                "required": "required" in textarea_html.lower(),
                "placeholder": self._extract_attribute(textarea_html, "placeholder"),
                "label": self._find_associated_label(form_html, textarea_html)
            }
            fields.append(field)
        
        # Extract selects
        select_pattern = r'<select[^>]*>.*?</select>'
        for match in re.finditer(select_pattern, form_html, re.DOTALL | re.IGNORECASE):
            select_html = match.group(0)
            field = {
                "name": self._extract_attribute(select_html, "name"),
                "id": self._extract_attribute(select_html, "id"),
                "type": "select",
                "required": "required" in select_html.lower(),
                "options": self._extract_select_options(select_html),
                "label": self._find_associated_label(form_html, select_html)
            }
            fields.append(field)
        
        return fields
    
    def _extract_submit_buttons(self, form_html: str) -> List[str]:
        """Extract submit buttons from form."""
        buttons = []
        
        # Find buttons with type="submit"
        button_pattern = r'<button[^>]*type=["\']submit["\'][^>]*>.*?</button>'
        for match in re.finditer(button_pattern, form_html, re.DOTALL | re.IGNORECASE):
            button_html = match.group(0)
            button_text = re.search(r'>([^<]+)<', button_html)
            if button_text:
                buttons.append(button_text.group(1).strip())
        
        # Find inputs with type="submit"
        input_pattern = r'<input[^>]*type=["\']submit["\'][^>]*>'
        for match in re.finditer(input_pattern, form_html, re.IGNORECASE):
            input_html = match.group(0)
            value = self._extract_attribute(input_html, "value")
            if value:
                buttons.append(value)
        
        return buttons
    
    def _find_associated_label(self, form_html: str, element_html: str) -> Optional[str]:
        """Find associated label for form field."""
        # Try to find id first
        element_id = self._extract_attribute(element_html, "id")
        if element_id:
            label_pattern = rf'<label[^>]*for=["\']{re.escape(element_id)}["\'][^>]*>(.*?)</label>'
            match = re.search(label_pattern, form_html, re.DOTALL | re.IGNORECASE)
            if match:
                return re.sub(r'<[^>]+>', '', match.group(1)).strip()
        
        # Try to find name
        element_name = self._extract_attribute(element_html, "name")
        if element_name:
            # Look for label containing input with this name
            label_pattern = rf'<label[^>]*>.*?<[^>]+name=["\']{re.escape(element_name)}["\'][^>]*>.*?</label>'
            match = re.search(label_pattern, form_html, re.DOTALL | re.IGNORECASE)
            if match:
                label_html = match.group(0)
                label_text = re.search(r'<label[^>]*>(.*?)<[^>]+name', label_html, re.DOTALL | re.IGNORECASE)
                if label_text:
                    return re.sub(r'<[^>]+>', '', label_text.group(1)).strip()
        
        return None
    
    def _extract_select_options(self, select_html: str) -> List[Dict[str, str]]:
        """Extract options from select element."""
        options = []
        option_pattern = r'<option[^>]*value=["\']([^"\']+)["\'][^>]*>(.*?)</option>'
        for match in re.finditer(option_pattern, select_html, re.DOTALL | re.IGNORECASE):
            options.append({
                "value": match.group(1),
                "text": re.sub(r'<[^>]+>', '', match.group(2)).strip()
            })
        return options
    
    def _detect_conditional_fields(self, form_html: str, field_name: str) -> Optional[Dict[str, Any]]:
        """Detect conditional field logic (e.g., show field X if field Y has value Z)."""
        # Look for data-conditional, data-show-if, etc.
        patterns = [
            rf'data-conditional[^>]*field=["\']{re.escape(field_name)}["\']',
            rf'data-show-if[^>]*field=["\']{re.escape(field_name)}["\']'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, form_html, re.IGNORECASE)
            if match:
                # Extract condition
                condition_value = self._extract_attribute(match.group(0), "value")
                depends_on = self._extract_attribute(match.group(0), "depends-on")
                return {
                    "depends_on": depends_on,
                    "value": condition_value,
                    "type": "conditional"
                }
        
        return None
    
    def _detect_field_dependencies(self, form_html: str, field_name: str) -> List[str]:
        """Detect field dependencies (e.g., confirm_password depends on password)."""
        dependencies = []
        
        # Common patterns: confirm_* depends on *
        if field_name and "confirm" in field_name.lower():
            base_field = field_name.replace("confirm", "").replace("_", "").strip()
            if base_field:
                # Check if base field exists
                if re.search(rf'name=["\']{re.escape(base_field)}["\']', form_html, re.IGNORECASE):
                    dependencies.append(base_field)
        
        # Look for data-depends-on attribute
        pattern = rf'name=["\']{re.escape(field_name)}["\'][^>]*data-depends-on=["\']([^"\']+)["\']'
        match = re.search(pattern, form_html, re.IGNORECASE)
        if match:
            dependencies.append(match.group(1))
        
        return dependencies
    
    def _extract_validation_rules(self, form_html: str) -> List[str]:
        """Extract validation rules from form (data-* attributes, classes, etc.)."""
        rules = []
        
        # Look for validation classes
        validation_classes = ["validate", "required", "email", "number", "url"]
        for vclass in validation_classes:
            if re.search(rf'class=["\'][^"\']*{vclass}[^"\']*["\']', form_html, re.IGNORECASE):
                rules.append(vclass)
        
        # Look for data-validation attributes
        validation_pattern = r'data-validation=["\']([^"\']+)["\']'
        for match in re.finditer(validation_pattern, form_html, re.IGNORECASE):
            rules.append(match.group(1))
        
        return rules


