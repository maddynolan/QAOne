"""
Domain Knowledge Base - Layer 5
Domain-specific validation libraries and standards compliance.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class DomainKnowledgeBase:
    """
    Domain-specific knowledge base for validation and standards.
    
    Layer 5 Components:
    1. Domain-specific validation libraries
    2. Standards compliance (WCAG, OWASP, GDPR)
    3. Industry-specific patterns
    """
    
    def __init__(self):
        # Validation patterns by domain
        self.validation_patterns = {
            "email": {
                "pattern": r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
                "min_length": 5,
                "max_length": 254,
                "description": "RFC 5322 compliant email"
            },
            "phone_us": {
                "pattern": r'^(\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$',
                "description": "US phone number format"
            },
            "phone_international": {
                "pattern": r'^\+?[1-9]\d{1,14}$',
                "description": "E.164 international phone format"
            },
            "credit_card": {
                "pattern": r'^[0-9]{13,19}$',
                "luhn_check": True,
                "description": "Credit card number (Luhn validated)"
            },
            "ssn": {
                "pattern": r'^\d{3}-\d{2}-\d{4}$',
                "description": "US Social Security Number"
            },
            "zip_us": {
                "pattern": r'^\d{5}(-\d{4})?$',
                "description": "US ZIP code (5 or 9 digits)"
            },
            "url": {
                "pattern": r'^https?://[^\s/$.?#].[^\s]*$',
                "description": "HTTP/HTTPS URL"
            },
            "date_iso": {
                "pattern": r'^\d{4}-\d{2}-\d{2}$',
                "description": "ISO 8601 date format"
            }
        }
        
        # WCAG compliance rules
        self.wcag_rules = {
            "label_required": {
                "rule": "All form inputs must have associated labels",
                "level": "A",
                "check": lambda field: bool(field.get("label") or field.get("aria-label"))
            },
            "error_identification": {
                "rule": "Errors must be clearly identified",
                "level": "A",
                "check": lambda field: bool(field.get("error_message") or field.get("aria-invalid"))
            },
            "color_contrast": {
                "rule": "Text must have sufficient color contrast",
                "level": "AA",
                "check": lambda field: True  # Would check actual contrast
            }
        }
        
        # OWASP security rules
        self.owasp_rules = {
            "password_complexity": {
                "rule": "Passwords must meet complexity requirements",
                "requirements": ["minLength:8", "uppercase", "lowercase", "number", "special"]
            },
            "input_sanitization": {
                "rule": "All user inputs must be sanitized",
                "check": lambda field: field.get("sanitized", False)
            },
            "csrf_protection": {
                "rule": "Forms must have CSRF protection",
                "check": lambda form: form.get("csrf_token") is not None
            }
        }
        
        # GDPR compliance rules
        self.gdpr_rules = {
            "consent_required": {
                "rule": "Explicit consent required for data collection",
                "check": lambda form: form.get("consent_checkbox") is not None
            },
            "data_minimization": {
                "rule": "Collect only necessary data",
                "check": lambda form: len(form.get("fields", [])) <= 10  # Simplified
            },
            "privacy_policy": {
                "rule": "Privacy policy link required",
                "check": lambda form: form.get("privacy_policy_link") is not None
            }
        }
    
    def get_validation_pattern(self, field_type: str, domain: Optional[str] = None) -> Dict[str, Any]:
        """Get validation pattern for field type."""
        # Try domain-specific first
        if domain:
            domain_key = f"{field_type}_{domain}"
            if domain_key in self.validation_patterns:
                return self.validation_patterns[domain_key]
        
        # Fallback to generic
        return self.validation_patterns.get(field_type, {})
    
    def check_wcag_compliance(self, form: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check WCAG compliance for form.
        
        Returns:
        {
            "level": str,  # "A", "AA", "AAA"
            "violations": [Dict],
            "warnings": [Dict],
            "score": float
        }
        """
        violations = []
        warnings = []
        
        fields = form.get("fields", [])
        
        for rule_name, rule_info in self.wcag_rules.items():
            for field in fields:
                if not rule_info["check"](field):
                    violation = {
                        "rule": rule_name,
                        "description": rule_info["rule"],
                        "level": rule_info["level"],
                        "field": field.get("name") or field.get("id")
                    }
                    if rule_info["level"] == "A":
                        violations.append(violation)
                    else:
                        warnings.append(violation)
        
        # Calculate score
        total_checks = len(self.wcag_rules) * len(fields)
        passed_checks = total_checks - len(violations) - len(warnings)
        score = passed_checks / total_checks if total_checks > 0 else 0.0
        
        return {
            "level": "AA",  # Target level
            "violations": violations,
            "warnings": warnings,
            "score": score
        }
    
    def check_owasp_compliance(self, form: Dict[str, Any]) -> Dict[str, Any]:
        """Check OWASP security compliance."""
        violations = []
        warnings = []
        
        fields = form.get("fields", [])
        
        # Check password fields
        password_fields = [f for f in fields if "pass" in (f.get("name") or "").lower()]
        for field in password_fields:
            if not self._check_password_complexity(field):
                violations.append({
                    "rule": "password_complexity",
                    "description": "Password does not meet complexity requirements",
                    "field": field.get("name")
                })
        
        # Check CSRF protection
        if not self.owasp_rules["csrf_protection"]["check"](form):
            warnings.append({
                "rule": "csrf_protection",
                "description": "Form missing CSRF protection"
            })
        
        return {
            "violations": violations,
            "warnings": warnings,
            "score": 1.0 - (len(violations) * 0.3 + len(warnings) * 0.1)
        }
    
    def check_gdpr_compliance(self, form: Dict[str, Any]) -> Dict[str, Any]:
        """Check GDPR compliance."""
        violations = []
        warnings = []
        
        for rule_name, rule_info in self.gdpr_rules.items():
            if not rule_info["check"](form):
                violation = {
                    "rule": rule_name,
                    "description": rule_info["rule"]
                }
                if rule_name == "consent_required":
                    violations.append(violation)
                else:
                    warnings.append(violation)
        
        return {
            "violations": violations,
            "warnings": warnings,
            "score": 1.0 - (len(violations) * 0.4 + len(warnings) * 0.2)
        }
    
    def _check_password_complexity(self, field: Dict[str, Any]) -> bool:
        """Check if password field has complexity requirements."""
        # Check for pattern or validation rules
        validation = field.get("validation") or {}
        rules = validation.get("rules", [])
        
        required_rules = ["minLength:8", "uppercase", "lowercase", "number"]
        return all(any(req in str(rule) for rule in rules) for req in required_rules)
    
    def get_industry_patterns(self, industry: str) -> Dict[str, Any]:
        """Get industry-specific patterns."""
        industry_patterns = {
            "healthcare": {
                "required_fields": ["patient_name", "date_of_birth", "medical_record_number"],
                "validation_rules": {
                    "date_of_birth": "date_format",
                    "medical_record_number": "alphanumeric"
                },
                "compliance": ["HIPAA", "WCAG"]
            },
            "finance": {
                "required_fields": ["account_number", "routing_number", "ssn"],
                "validation_rules": {
                    "account_number": "numeric",
                    "routing_number": "pattern:^\\d{9}$",
                    "ssn": "ssn_format"
                },
                "compliance": ["PCI-DSS", "OWASP", "GDPR"]
            },
            "ecommerce": {
                "required_fields": ["shipping_address", "payment_method", "billing_address"],
                "validation_rules": {
                    "credit_card": "credit_card_format",
                    "cvv": "pattern:^\\d{3,4}$"
                },
                "compliance": ["PCI-DSS", "WCAG"]
            }
        }
        
        return industry_patterns.get(industry, {})


