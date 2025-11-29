"""
Template Service
Manages standardized repo templates for test generation
"""

import os
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class TemplateService:
    """Manages test repository templates"""
    
    def __init__(self, templates_dir: str = "qa-templates"):
        self.templates_dir = Path(templates_dir)
        self.templates = {
            "playwright-ts": self.templates_dir / "playwright-ts",
            "pytest-api": self.templates_dir / "pytest-api",
            "k6-perf": self.templates_dir / "k6-perf"
        }
    
    def get_template_path(self, template_type: str) -> Optional[Path]:
        """Get path to template directory"""
        return self.templates.get(template_type)
    
    def validate_template_structure(self, template_type: str) -> bool:
        """Validate that template exists and has required structure"""
        template_path = self.get_template_path(template_type)
        if not template_path or not template_path.exists():
            return False
        
        # Check for required files based on template type
        if template_type == "playwright-ts":
            required = ["playwright.config.ts", "package.json", "tsconfig.json"]
        elif template_type == "pytest-api":
            required = ["pytest.ini", "requirements.txt", "conftest.py"]
        elif template_type == "k6-perf":
            required = ["k6.config.js"]
        else:
            return False
        
        for req_file in required:
            if not (template_path / req_file).exists():
                logger.warning(f"Template {template_type} missing {req_file}")
                return False
        
        return True
    
    def get_allowed_paths(self, template_type: str) -> list:
        """Get paths where model is allowed to write files"""
        if template_type == "playwright-ts":
            return ["tests/ui/"]
        elif template_type == "pytest-api":
            return ["tests/api/"]
        elif template_type == "k6-perf":
            return ["scripts/"]
        return []
    
    def validate_file_path(self, template_type: str, file_path: str) -> bool:
        """Validate that file path is in allowed directory"""
        allowed_paths = self.get_allowed_paths(template_type)
        return any(file_path.startswith(allowed) for allowed in allowed_paths)

# Singleton instance
_template_service = None

def get_template_service() -> TemplateService:
    """Get or create TemplateService instance"""
    global _template_service
    if _template_service is None:
        _template_service = TemplateService()
    return _template_service


