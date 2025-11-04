"""
Prompt Template Service - Manages prompt templates with semantic versioning
Tracks template versions (v1.0, v1.1, v2.0) and retrieves templates by version
"""

import logging
import os
import re
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Task mapping: test_type -> ai_templates task name
TASK_MAPPING = {
    "manual": "jira-to-tests",
    "automation": "testcase-to-playwright",
    "api": "api-tests",
    "performance": "perf-tests",
    "security": "security-tests",
    "accessibility": "a11y-tests",
    "database": "db-tests"
}

class PromptTemplateService:
    """Service for managing prompt templates with versioning"""
    
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL")
        
        # Fallback to hardcoded templates if DB unavailable
        from app.services.prompt_templates import (
            PROMPT_REQ_TO_MANUAL_TESTS,
            PROMPT_MANUAL_TO_PLAYWRIGHT,
            PROMPT_REQ_TO_API_TESTS,
            PROMPT_REQ_TO_PERFORMANCE_TESTS,
            PROMPT_REQ_TO_SECURITY_TESTS,
            PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
            PROMPT_REQ_TO_DATABASE_TESTS
        )
        
        self.default_templates = {
            "jira-to-tests": PROMPT_REQ_TO_MANUAL_TESTS,
            "testcase-to-playwright": PROMPT_MANUAL_TO_PLAYWRIGHT,
            "api-tests": PROMPT_REQ_TO_API_TESTS,
            "perf-tests": PROMPT_REQ_TO_PERFORMANCE_TESTS,
            "security-tests": PROMPT_REQ_TO_SECURITY_TESTS,
            "a11y-tests": PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
            "db-tests": PROMPT_REQ_TO_DATABASE_TESTS
        }
    
    def _parse_version(self, version_str: str) -> tuple:
        """
        Parse semantic version string (e.g., "v1.0", "v1.2.3") to tuple
        Returns (major, minor, patch) or (1, 0, 0) for default
        """
        if not version_str or not version_str.startswith('v'):
            return (1, 0, 0)
        
        try:
            # Remove 'v' prefix and split
            parts = version_str[1:].split('.')
            major = int(parts[0]) if len(parts) > 0 else 1
            minor = int(parts[1]) if len(parts) > 1 else 0
            patch = int(parts[2]) if len(parts) > 2 else 0
            return (major, minor, patch)
        except (ValueError, IndexError):
            return (1, 0, 0)
    
    def _format_version(self, major: int, minor: int, patch: int = 0) -> str:
        """Format version tuple to string (e.g., "v1.0", "v1.2.3")"""
        return f"v{major}.{minor}" if patch == 0 else f"v{major}.{minor}.{patch}"
    
    def _increment_version(self, current_version: str, version_type: str = "minor") -> str:
        """
        Increment version based on type
        - "major": v1.0 -> v2.0 (breaking changes)
        - "minor": v1.0 -> v1.1 (new features)
        - "patch": v1.0.0 -> v1.0.1 (bug fixes)
        """
        major, minor, patch = self._parse_version(current_version)
        
        if version_type == "major":
            return self._format_version(major + 1, 0, 0)
        elif version_type == "minor":
            return self._format_version(major, minor + 1, 0)
        else:  # patch
            return self._format_version(major, minor, patch + 1)
    
    async def get_template(
        self,
        task: str,
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None,
        version: Optional[str] = None
    ) -> tuple[str, str]:
        """
        Get prompt template and its version
        
        Args:
            task: Template task name (e.g., "jira-to-tests")
            organization_id: Optional organization ID
            project_id: Optional project ID
            version: Optional version (e.g., "v1.0"). If None, gets latest
            
        Returns:
            Tuple of (template_string, version_string)
        """
        if not self.database_url:
            # Use default templates
            template = self.default_templates.get(task, "")
            return (template, "v1.0")
        
        try:
            import asyncpg
            conn = await asyncpg.connect(self.database_url)
            
            try:
                # Build query
                query = """
                    SELECT template, version, is_default
                    FROM ai_templates
                    WHERE task = $1
                """
                params = [task]
                param_idx = 2
                
                # Add filters
                if organization_id:
                    query += f" AND (org_id = ${param_idx} OR org_id = 'default' OR org_id IS NULL)"
                    params.append(organization_id)
                    param_idx += 1
                
                if project_id:
                    query += f" AND (project_id = ${param_idx} OR project_id = 'default')"
                    params.append(project_id)
                    param_idx += 1
                
                # Order by: project-specific > org-specific > default, then by version desc
                query += """
                    ORDER BY 
                        CASE WHEN project_id = $1 THEN 1 ELSE 2 END,
                        CASE WHEN org_id = $2 THEN 1 ELSE 2 END,
                        is_default DESC,
                        version DESC
                    LIMIT 1
                """
                
                row = await conn.fetchrow(query, task, *params[1:])
                
                if row:
                    # Convert integer version to semantic version
                    version_int = row['version'] or 1
                    version_str = f"v{version_int}.0"
                    return (row['template'], version_str)
                
            finally:
                await conn.close()
        except Exception as e:
            logger.warning(f"Failed to get template from DB, using default: {e}")
        
        # Fallback to default
        template = self.default_templates.get(task, "")
        return (template, "v1.0")
    
    async def save_template(
        self,
        task: str,
        template: str,
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None,
        version_type: str = "minor"
    ) -> str:
        """
        Save or update a template with automatic versioning
        
        Args:
            task: Template task name
            template: Template content
            organization_id: Optional organization ID
            project_id: Optional project ID
            version_type: "major", "minor", or "patch" (default: "minor")
            
        Returns:
            New version string (e.g., "v1.1")
        """
        if not self.database_url:
            logger.warning("DATABASE_URL not set, cannot save template")
            return "v1.0"
        
        try:
            import asyncpg
            conn = await asyncpg.connect(self.database_url)
            
            try:
                # Get current template to determine new version
                current_template, current_version = await self.get_template(
                    task, organization_id, project_id
                )
                
                # Check if template content changed
                if current_template == template:
                    # No change, return current version
                    return current_version
                
                # Increment version
                new_version_str = self._increment_version(current_version, version_type)
                new_version_int = self._parse_version(new_version_str)[0]  # Use major as integer
                
                # Insert new version
                await conn.execute("""
                    INSERT INTO ai_templates 
                        (project_id, org_id, task, template, version, is_default, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())
                """, 
                    project_id or "default",
                    organization_id or "default",
                    task,
                    template,
                    new_version_int,
                    False  # Not default, user-customized
                )
                
                logger.info(f"Saved template {task} with version {new_version_str}")
                return new_version_str
                
            finally:
                await conn.close()
        except Exception as e:
            logger.error(f"Failed to save template: {e}")
            return "v1.0"
    
    async def get_template_version_history(
        self,
        task: str,
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get version history for a template"""
        if not self.database_url:
            return []
        
        try:
            import asyncpg
            conn = await asyncpg.connect(self.database_url)
            
            try:
                query = """
                    SELECT id, version, template, is_default, created_at, updated_at
                    FROM ai_templates
                    WHERE task = $1
                """
                params = [task]
                
                if organization_id:
                    query += " AND (org_id = $2 OR org_id = 'default' OR org_id IS NULL)"
                    params.append(organization_id)
                
                if project_id:
                    query += f" AND (project_id = ${len(params) + 1} OR project_id = 'default')"
                    params.append(project_id)
                
                query += " ORDER BY version DESC, created_at DESC"
                
                rows = await conn.fetch(query, *params)
                
                history = []
                for row in rows:
                    version_str = f"v{row['version'] or 1}.0"
                    history.append({
                        "id": str(row['id']),
                        "version": version_str,
                        "template": row['template'],
                        "is_default": row['is_default'],
                        "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                        "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
                    })
                
                return history
                
            finally:
                await conn.close()
        except Exception as e:
            logger.error(f"Failed to get template history: {e}")
            return []
    
    def get_task_for_test_type(self, test_type: str) -> str:
        """Map test_type to ai_templates task name"""
        return TASK_MAPPING.get(test_type.lower(), "jira-to-tests")


# Global instance
prompt_template_service = PromptTemplateService()

