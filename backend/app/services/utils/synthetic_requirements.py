"""
Synthetic Requirements Generator
Generates realistic, non-sensitive requirements for pre-approval mode.
Matches style codes and demonstrates coverage & flows.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging
import random

logger = logging.getLogger(__name__)


@dataclass
class SyntheticRequirement:
    """A synthetic requirement"""
    id: str
    title: str
    description: str
    acceptance_criteria: List[str]
    priority: str
    tags: List[str]
    category: str
    style_codex_id: Optional[str] = None


class SyntheticRequirementsGenerator:
    """
    Generates synthetic requirements that match style codes.
    Used in pre-approval mode before client requirements are available.
    """

    def __init__(self):
        self.templates = self._load_templates()

    def generate_requirements(
        self,
        count: int,
        style_codex: Optional[Dict[str, Any]] = None,
        categories: Optional[List[str]] = None
    ) -> List[SyntheticRequirement]:
        """
        Generate synthetic requirements.
        
        Args:
            count: Number of requirements to generate
            style_codex: Style codex to match
            categories: Categories to focus on
            
        Returns:
            List of synthetic requirements
        """
        categories = categories or ["authentication", "data_management", "ui_interaction", "api_operations"]
        
        requirements = []
        for i in range(count):
            category = random.choice(categories)
            template = self._get_template(category)
            
            req = self._generate_from_template(template, category, style_codex)
            requirements.append(req)
        
        return requirements

    def _load_templates(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load requirement templates"""
        return {
            "authentication": [
                {
                    "title": "User Login",
                    "description": "As a user, I want to log in with my credentials so that I can access my account.",
                    "criteria": [
                        "User can enter email and password",
                        "System validates credentials",
                        "User is redirected to dashboard on success",
                        "Error message shown on invalid credentials"
                    ]
                },
                {
                    "title": "Password Reset",
                    "description": "As a user, I want to reset my password so that I can regain access if I forget it.",
                    "criteria": [
                        "User can request password reset",
                        "Reset email is sent",
                        "User can set new password",
                        "Old password is invalidated"
                    ]
                }
            ],
            "data_management": [
                {
                    "title": "Create Record",
                    "description": "As a user, I want to create a new record so that I can add data to the system.",
                    "criteria": [
                        "User can fill in required fields",
                        "System validates input",
                        "Record is saved to database",
                        "Success message is displayed"
                    ]
                },
                {
                    "title": "Search Records",
                    "description": "As a user, I want to search for records so that I can find specific information.",
                    "criteria": [
                        "User can enter search query",
                        "Results are filtered in real-time",
                        "Empty state shown when no results",
                        "Results are sortable"
                    ]
                }
            ],
            "ui_interaction": [
                {
                    "title": "Form Validation",
                    "description": "As a user, I want to see validation errors so that I can correct my input.",
                    "criteria": [
                        "Errors shown for invalid fields",
                        "Inline validation on blur",
                        "Submit button disabled until valid",
                        "Clear error messages"
                    ]
                },
                {
                    "title": "Pagination",
                    "description": "As a user, I want to navigate through pages of results so that I can view all data.",
                    "criteria": [
                        "Page numbers are clickable",
                        "Previous/Next buttons work",
                        "Current page is highlighted",
                        "Total pages displayed"
                    ]
                }
            ],
            "api_operations": [
                {
                    "title": "API Rate Limiting",
                    "description": "As a system, I want to limit API requests so that I can prevent abuse.",
                    "criteria": [
                        "Rate limit enforced per IP",
                        "429 status code returned when exceeded",
                        "Retry-After header included",
                        "Rate limit reset after window"
                    ]
                },
                {
                    "title": "API Error Handling",
                    "description": "As a developer, I want clear error responses so that I can debug issues.",
                    "criteria": [
                        "Error messages include error code",
                        "Stack traces in development mode only",
                        "Consistent error format",
                        "HTTP status codes are correct"
                    ]
                }
            ]
        }

    def _get_template(self, category: str) -> Dict[str, Any]:
        """Get a random template for a category"""
        templates = self.templates.get(category, [])
        if not templates:
            # Fallback to first available category
            templates = list(self.templates.values())[0] if self.templates else []
        
        return random.choice(templates) if templates else {
            "title": "Generic Requirement",
            "description": "A generic requirement",
            "criteria": ["Criterion 1", "Criterion 2"]
        }

    def _generate_from_template(
        self,
        template: Dict[str, Any],
        category: str,
        style_codex: Optional[Dict[str, Any]]
    ) -> SyntheticRequirement:
        """Generate requirement from template"""
        import uuid
        
        # Apply variations based on style codex
        title = template["title"]
        if style_codex:
            # Adjust based on style preferences
            pass
        
        # Generate tags based on category and style
        tags = [category, "synthetic"]
        if style_codex and style_codex.get("tag_patterns"):
            tags.extend(style_codex["tag_patterns"][:2])
        
        priority = random.choice(["critical", "high", "medium", "low"])
        
        return SyntheticRequirement(
            id=str(uuid.uuid4()),
            title=title,
            description=template["description"],
            acceptance_criteria=template["criteria"],
            priority=priority,
            tags=tags,
            category=category
        )


# Global instance
synthetic_requirements_generator = SyntheticRequirementsGenerator()




