"""
Test Data Management Service
Manages test data payloads generated alongside test cases.
Implements semantic test data generation from LLM.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

from app.services.storage.postgres_direct import get_postgres_pool
from app.middleware.tenant_middleware import get_current_tenant_id
from app.middleware.rbac_middleware import get_current_auth_user_id
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class TestDataService:
    """
    Service for managing test data.
    Generates test data payloads when test cases are created.
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def generate_test_data_for_test_case(
        self,
        test_case: Dict[str, Any],
        requirement_text: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generate test data payload for a test case using LLM.
        
        This is called automatically when a test case is generated.
        The LLM analyzes the test case steps and generates appropriate test data.
        
        Args:
            test_case: Test case dictionary with steps
            requirement_text: Optional requirement text for context
            tenant_id: Tenant ID
            
        Returns:
            Generated test data dictionary or None
        """
        # Extract test case information
        test_name = test_case.get("name", "")
        test_description = test_case.get("description", "")
        test_steps = test_case.get("steps", [])
        
        # Build prompt for test data generation
        steps_text = "\n".join([
            f"Step {i+1}: {step.get('action', '')} - Expected: {step.get('expectedResult', '')}"
            for i, step in enumerate(test_steps)
        ])
        
        prompt = f"""You are a test data generation expert. Generate test data payloads for the following test case.

Test Case: {test_name}
Description: {test_description}

Test Steps:
{steps_text}

{f'Requirement Context: {requirement_text[:500]}' if requirement_text else ''}

Analyze the test case and generate appropriate test data. Consider:
1. Input fields mentioned in steps (email, password, username, etc.)
2. Data types and formats required
3. Valid and invalid test data scenarios
4. Edge cases and boundary values

Generate a JSON object with test data. For example:
- If testing login: {{"email": "test@example.com", "password": "SecurePass123!"}}
- If testing registration: {{"email": "newuser@example.com", "password": "SecurePass123!", "name": "John Doe"}}
- If testing API: {{"endpoint": "/api/users", "method": "POST", "body": {{"name": "Test User"}}}}

Respond ONLY with valid JSON. Do not include markdown formatting."""

        try:
            # Generate test data using LLM
            gen_request = GenerationRequest(
                prompt=prompt,
                mode="quick",  # Use smaller model for test data generation
                validate_json=True,
                task_type="test_data_generation"
            )
            
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            # Parse JSON response
            try:
                test_data_payload = json.loads(result.strip())
                if not isinstance(test_data_payload, dict):
                    # If it's a list, take first item
                    if isinstance(test_data_payload, list) and len(test_data_payload) > 0:
                        test_data_payload = test_data_payload[0]
                    else:
                        logger.warning("LLM returned non-dict test data, creating default")
                        test_data_payload = self._extract_test_data_from_steps(test_steps)
            except json.JSONDecodeError:
                logger.warning("Failed to parse LLM test data response, extracting from steps")
                test_data_payload = self._extract_test_data_from_steps(test_steps)
            
            return {
                "payload": test_data_payload,
                "data_type": "json",
                "is_synthetic": True,
                "generated_by_llm": True
            }
        
        except Exception as e:
            logger.error(f"Failed to generate test data via LLM: {e}")
            # Fallback: extract test data from test steps
            return {
                "payload": self._extract_test_data_from_steps(test_steps),
                "data_type": "json",
                "is_synthetic": True,
                "generated_by_llm": False
            }
    
    def _extract_test_data_from_steps(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extract test data from test case steps as fallback.
        Looks for data values mentioned in step actions.
        """
        test_data = {}
        
        for step in steps:
            action = step.get("action", "").lower()
            expected = step.get("expectedResult", "")
            
            # Extract email
            if "email" in action or "email" in expected:
                if "invalid" in action or "invalid" in expected:
                    test_data["email"] = "invalid@format"
                else:
                    test_data["email"] = "test@example.com"
            
            # Extract password
            if "password" in action or "password" in expected:
                if "invalid" in action or "invalid" in expected:
                    test_data["password"] = "weak"
                else:
                    test_data["password"] = "SecurePass123!"
            
            # Extract username
            if "username" in action or "username" in expected:
                test_data["username"] = "testuser"
            
            # Extract name
            if "name" in action and "username" not in action:
                test_data["name"] = "Test User"
        
        return test_data if test_data else {"test_data": "generated"}
    
    async def create_test_data(
        self,
        test_case_id: str,
        name: str,
        payload: Dict[str, Any],
        data_type: str = "json",
        description: Optional[str] = None,
        is_synthetic: bool = True,
        generated_by_llm: bool = False,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create test data record.
        
        Args:
            test_case_id: Test case ID
            name: Test data name
            payload: Test data payload (dict)
            data_type: Data type (json, csv, xml, etc.)
            description: Optional description
            is_synthetic: Whether data is synthetic
            generated_by_llm: Whether generated by LLM
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Created test data dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO test_data (
                    test_case_id, name, description, data_type, payload,
                    is_synthetic, generated_by_llm, created_by,
                    org_id, project_id, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING test_data_id, created_at
            """,
                test_case_id, name, description, data_type,
                json.dumps(payload), is_synthetic, generated_by_llm,
                user_id, org_id, project_id, tenant_id
            )
        
        return {
            "test_data_id": str(result["test_data_id"]),
            "test_case_id": test_case_id,
            "name": name,
            "payload": payload,
            "data_type": data_type,
            "description": description,
            "is_synthetic": is_synthetic,
            "generated_by_llm": generated_by_llm,
            "created_at": result["created_at"].isoformat()
        }
    
    async def get_test_data_for_test_case(
        self,
        test_case_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get test data for a test case"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT test_data_id, name, description, data_type, payload,
                       is_synthetic, generated_by_llm, created_at
                FROM test_data
                WHERE test_case_id = $1
                  AND (tenant_id = $2 OR tenant_id IS NULL)
                ORDER BY created_at DESC
                LIMIT 1
            """, test_case_id, tenant_id)
        
        if not result:
            return None
        
        return {
            "test_data_id": str(result["test_data_id"]),
            "name": result["name"],
            "description": result["description"],
            "data_type": result["data_type"],
            "payload": result["payload"],
            "is_synthetic": result["is_synthetic"],
            "generated_by_llm": result["generated_by_llm"],
            "created_at": result["created_at"].isoformat()
        }
    
    async def list_test_data(
        self,
        test_case_id: Optional[str] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List test data records"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        query = """
            SELECT test_data_id, test_case_id, name, description, data_type,
                   payload, is_synthetic, generated_by_llm, created_at
            FROM test_data
            WHERE (tenant_id = $1 OR tenant_id IS NULL)
        """
        params = [tenant_id]
        param_idx = 2
        
        if test_case_id:
            query += f" AND test_case_id = ${param_idx}"
            params.append(test_case_id)
            param_idx += 1
        
        if org_id:
            query += f" AND (org_id = ${param_idx} OR org_id IS NULL)"
            params.append(org_id)
            param_idx += 1
        
        if project_id:
            query += f" AND (project_id = ${param_idx} OR project_id IS NULL)"
            params.append(project_id)
            param_idx += 1
        
        query += " ORDER BY created_at DESC"
        
        async with pool.acquire() as conn:
            results = await conn.fetch(query, *params)
        
        return [dict(row) for row in results]


# Global instance
_test_data_service = None

def get_test_data_service() -> TestDataService:
    """Get or create global TestDataService instance"""
    global _test_data_service
    if _test_data_service is None:
        _test_data_service = TestDataService()
    return _test_data_service

