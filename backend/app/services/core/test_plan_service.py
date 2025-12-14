"""
Test Plan Service
Provides test plan operations including search functionality
"""

import logging
from typing import Dict, List, Any, Optional
from app.services.storage.postgres_direct import execute_query

logger = logging.getLogger(__name__)


class TestPlanService:
    """Service for test plan operations"""
    
    async def search_test_plans(
        self,
        filters: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search test plans by filters"""
        try:
            filters = filters or {}
            conditions = []
            params = []
            
            if project_id:
                conditions.append("project_id = %s")
                params.append(project_id)
            
            if "jira_issue_key" in filters:
                # Search for test plans linked to a Jira issue
                # This assumes there's a jira_issue_key field or metadata field
                conditions.append("(settings::jsonb->>'jira_issue_key' = %s OR metadata::jsonb->>'jira_issue_key' = %s)")
                params.append(filters["jira_issue_key"])
                params.append(filters["jira_issue_key"])
            
            where_clause = " AND ".join(conditions) if conditions else "1=1"
            
            query = f"""
                SELECT id, project_id, name, description, status, settings, metadata, created_at, updated_at
                FROM test_plans
                WHERE {where_clause}
                ORDER BY created_at DESC
            """
            
            results = await execute_query(query, tuple(params))
            
            test_plans = []
            for row in results or []:
                test_plans.append({
                    "test_plan_id": str(row.get("id", "")),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "status": row.get("status", "draft"),
                    "project_id": str(row.get("project_id", "")),
                    "settings": row.get("settings", {}),
                    "metadata": row.get("metadata", {})
                })
            
            return test_plans
            
        except Exception as e:
            logger.error(f"Error searching test plans: {e}", exc_info=True)
            return []


# Global instance
_test_plan_service = None

def get_test_plan_service() -> TestPlanService:
    """Get or create global TestPlanService instance"""
    global _test_plan_service
    if _test_plan_service is None:
        _test_plan_service = TestPlanService()
    return _test_plan_service




