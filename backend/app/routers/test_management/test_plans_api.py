"""
Test Plans CRUD API Router
Handles all test plan operations
"""
import logging
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    DEFAULT_USER_ID
)
from app.services.storage.database import get_database_client
from app.services.storage.postgres_direct import execute_query, execute_insert, get_postgres_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-plans", tags=["test-plans"])


@router.get("")
async def get_test_plans(project_id: Optional[str] = None):
    """Get all test plans"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"testPlans": []}
        
        query = """
            SELECT id, project_id, name, description, status, settings, created_at, updated_at
            FROM test_plans 
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        test_plans = []
        for row in results or []:
            test_plans.append({
                "id": str(row.get("id", "")),
                "name": row.get("name", ""),
                "description": row.get("description", ""),
                "status": row.get("status", "draft"),
                "testCases": [],
                "createdAt": str(row.get("created_at", "")),
                "updatedAt": str(row.get("updated_at", ""))
            })
        
        return {"testPlans": test_plans}
    except Exception as e:
        logger.error(f"Error getting test plans: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving test plans")


@router.post("")
async def create_test_plan(request: Request):
    """Create a new test plan"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"id": f"plan_{int(time.time())}"}
        
        plan_data = {
            "project_id": project_id,
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "status": "draft",
            "created_by": DEFAULT_USER_ID
        }
        
        plan_id = await execute_insert("test_plans", plan_data)
        
        return {"id": plan_id or f"plan_{int(time.time())}"}
    except Exception as e:
        logger.error(f"Error creating test plan: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while creating test plan")


@router.put("/{plan_id}")
async def update_test_plan(plan_id: str, request: Request):
    """Update a test plan"""
    try:
        data = await request.json()
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_plans 
                    SET name = %s, description = %s, status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    data.get("description", ""),
                    data.get("status", "draft"),
                    plan_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test plan not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test plan: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating test plan")


@router.delete("/{plan_id}")
async def delete_test_plan(plan_id: str):
    """Delete a test plan"""
    try:
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_plans WHERE id = %s RETURNING id", (plan_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test plan not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test plan: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while deleting test plan")


