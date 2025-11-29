"""
Test Cases CRUD API Router
Handles all test case CRUD operations
"""
import logging
import json
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    map_priority_from_db,
    map_priority_to_db,
    DEFAULT_USER_ID
)
from app.services.storage.database import get_database_client
from app.services.storage.postgres_direct import execute_query, execute_insert, get_postgres_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.get("")
async def get_test_cases(
    project_id: Optional[str] = None,
    plan_id: Optional[str] = None
):
    """Get all test cases, optionally filtered by plan_id"""
    try:
        logger.info(f"Getting test cases - project_id: {project_id}, plan_id: {plan_id}")
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        logger.info(f"Using project_id: {project_id}")
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            logger.warning("No database pool available, returning empty list")
            return []
        
        # Build query with optional plan_id filter
        # Only show active test cases (exclude archived and deprecated)
        if plan_id:
            query = """
                SELECT id, project_id, plan_id, title, description, priority, test_type, 
                       status, tags, steps, preconditions, test_data, estimated_time,
                       created_by, created_at, updated_at
                FROM test_cases 
                WHERE project_id = %s AND plan_id = %s 
                  AND status IN ('draft', 'active')
                ORDER BY created_at DESC
            """
            results = await execute_query(query, (project_id, plan_id))
        else:
            query = """
                SELECT id, project_id, plan_id, title, description, priority, test_type, 
                       status, tags, steps, preconditions, test_data, estimated_time,
                       created_by, created_at, updated_at
                FROM test_cases 
                WHERE project_id = %s 
                  AND status IN ('draft', 'active')
                ORDER BY created_at DESC
            """
            results = await execute_query(query, (project_id,))
        
        logger.info(f"Found {len(results or [])} test cases in database")
        
        test_cases = []
        for row in results or []:
            # Parse steps JSON if needed
            steps = row.get("steps") or []
            if isinstance(steps, str):
                try:
                    steps = json.loads(steps)
                except:
                    steps = []
            
            test_cases.append({
                "id": str(row.get("id", "")),
                "name": row.get("title", ""),
                "description": row.get("description", ""),
                "steps": steps,
                "priority": map_priority_from_db(row.get("priority", "P2")),
                "tags": row.get("tags") or [],
                "testType": row.get("test_type", "manual"),
                "complexity": "medium",
                "estimatedTime": row.get("estimated_time", 15),
                "preconditions": row.get("preconditions") or [],
                "testData": row.get("test_data") or {},
                "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
                "updatedAt": row.get("updated_at", "").isoformat() if hasattr(row.get("updated_at"), 'isoformat') else str(row.get("updated_at", ""))
            })
        
        logger.info(f"Returning {len(test_cases)} test cases")
        return test_cases
    except Exception as e:
        logger.error(f"Error getting test cases: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting test cases: {str(e)}")


@router.get("/{case_id}")
async def get_test_case(case_id: str):
    """Get a specific test case"""
    try:
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Test case not found")
        
        query = """
            SELECT id, project_id, plan_id, title, description, priority, test_type, 
                   status, tags, steps, preconditions, test_data, estimated_time,
                   created_by, created_at, updated_at
            FROM test_cases 
            WHERE id = %s
        """
        results = await execute_query(query, (case_id,))
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        row = results[0]
        # Parse steps JSON if needed (consistent with get_test_cases)
        steps = row.get("steps") or []
        if isinstance(steps, str):
            try:
                steps = json.loads(steps)
            except:
                steps = []
        
        return {
            "id": str(row.get("id", "")),
            "name": row.get("title", ""),
            "description": row.get("description", ""),
            "steps": steps,
            "priority": map_priority_from_db(row.get("priority", "P2")),
            "tags": row.get("tags") or [],
            "testType": row.get("test_type", "manual"),
            "complexity": "medium",
            "estimatedTime": row.get("estimated_time", 15),
            "preconditions": row.get("preconditions") or [],
            "testData": row.get("test_data") or {}
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_test_case(request: Request):
    """Create a new test case"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        priority = map_priority_to_db(data.get("priority", "medium"))
        
        # Convert steps if needed (for all test types that might have different structures)
        steps = data.get("steps", [])
        if not steps or len(steps) == 0:
            # Try to convert test structures to steps based on test type
            test_type = data.get("testType", "manual")
            if test_type == "performance":
                steps = [
                    {
                        "action": f"Configure load test: {data.get('virtual_users', 'N/A')} virtual users, {data.get('duration', 'N/A')}s duration, {data.get('ramp_up', 'N/A')}s ramp-up",
                        "expectedResult": f"Test configured successfully"
                    },
                    {
                        "action": f"Execute load test and monitor: throughput >= {data.get('expected_throughput', 'N/A')} req/s, p95 latency <= {data.get('expected_latency_p95', 'N/A')}ms",
                        "expectedResult": f"Performance metrics meet expectations, error rate <= {data.get('expected_error_rate', 0.01) * 100}%"
                    }
                ]
            elif test_type in ["accessibility", "a11y"]:
                steps = [
                    {
                        "action": data.get("test_method", "Execute accessibility test"),
                        "expectedResult": data.get("expected_result", "Test passes WCAG compliance")
                    }
                ]
                if data.get("wcag_guideline"):
                    steps[0]["action"] = f"Test {data.get('wcag_guideline')}: {steps[0]['action']}"
            elif test_type == "api":
                http_method = data.get("method", "GET")
                endpoint = data.get("endpoint", data.get("url", "N/A"))
                expected_status = data.get("expected_status", "200")
                request_body = data.get("request_body", "")
                expected_response = data.get("expected_response", "")
                
                steps = [
                    {
                        "action": f"Send {http_method} request to {endpoint}" + (f" with body: {request_body}" if request_body else ""),
                        "expectedResult": f"Response status is {expected_status}" + (f" and response matches: {expected_response}" if expected_response else "")
                    }
                ]
                if data.get("headers"):
                    steps[0]["action"] = f"Set headers: {data.get('headers')}, then {steps[0]['action']}"
            elif test_type == "security":
                vulnerability = data.get("vulnerability", "Security vulnerability")
                attack_vector = data.get("attack_vector", "Test security controls")
                expected_result = data.get("expected_result", "Security controls prevent vulnerability")
                
                steps = [
                    {
                        "action": f"Test for {vulnerability}: {attack_vector}",
                        "expectedResult": expected_result
                    }
                ]
            elif test_type == "manual":
                if data.get("description"):
                    steps = [
                        {
                            "action": f"Execute test: {data.get('description', '')[:100]}",
                            "expectedResult": data.get("expected", "Test completes successfully")
                        }
                    ]
                else:
                    steps = [
                        {
                            "action": "Execute manual test case",
                            "expectedResult": "Test case completes successfully"
                        }
                    ]
        
        case_data = {
            "project_id": project_id,
            "title": data.get("name", ""),
            "description": data.get("description", ""),
            "priority": priority,
            "test_type": data.get("testType", "manual"),
            "status": "draft",
            "tags": data.get("tags", []),
            "steps": steps,
            "preconditions": data.get("preconditions", []),
            "test_data": data.get("testData", {}),
            "estimated_time": data.get("estimatedTime", 15),
            "created_by": DEFAULT_USER_ID
        }
        
        logger.info(f"Creating test case: title={case_data['title']}, test_type={case_data['test_type']}, steps_count={len(steps)}")
        
        try:
            case_id = await execute_insert("test_cases", case_data)
            if not case_id:
                error_msg = "execute_insert returned None - database insert failed"
                logger.error(error_msg)
                raise HTTPException(status_code=500, detail=error_msg)
            
            logger.info(f"Successfully created test case: {case_id}")
            return {"id": case_id}
        except HTTPException:
            raise
        except Exception as db_error:
            error_msg = f"Database error creating test case: {str(db_error)}"
            logger.error(error_msg)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}. Check server logs for full details.")
    except Exception as e:
        logger.error(f"Error in create_test_case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{case_id}")
async def update_test_case(case_id: str, request: Request):
    """Update a test case"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        priority = map_priority_to_db(data.get("priority", "medium"))
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_cases 
                    SET title = %s, description = %s, priority = %s, test_type = %s,
                        tags = %s, steps = %s, preconditions = %s, test_data = %s,
                        estimated_time = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    data.get("description", ""),
                    priority,
                    data.get("testType", "manual"),
                    data.get("tags", []),
                    json.dumps(data.get("steps", [])),
                    data.get("preconditions", []),
                    json.dumps(data.get("testData", {})),
                    data.get("estimatedTime", 15),
                    case_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test case not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{case_id}")
async def delete_test_case(case_id: str):
    """Delete a test case by setting status to 'archived' (soft delete)"""
    try:
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Soft delete: set status to 'archived' instead of hard delete
                cur.execute(
                    "UPDATE test_cases SET status = 'archived', updated_at = NOW() WHERE id = %s RETURNING id",
                    (case_id,)
                )
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test case not found")
                
                logger.info(f"Test case {case_id} archived (soft deleted)")
                return {"status": "archived", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{case_id}/link-requirement")
async def link_test_case_to_requirement(case_id: str, request: Request):
    """Link a test case to a requirement"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        requirement_id = data.get("requirement_id")
        
        if not requirement_id:
            raise HTTPException(status_code=400, detail="requirement_id is required")
        
        from app.services.storage.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Check if link already exists
                cur.execute(
                    "SELECT id FROM test_case_requirements WHERE test_case_id = %s AND requirement_id = %s",
                    (case_id, requirement_id)
                )
                if cur.fetchone():
                    return {"status": "already_linked", "case_id": case_id, "requirement_id": requirement_id}
                
                # Create link
                cur.execute(
                    """
                    INSERT INTO test_case_requirements (test_case_id, requirement_id, tenant_id, created_at)
                    VALUES (%s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (case_id, requirement_id, None)  # tenant_id can be None for now
                )
                link_id = cur.fetchone()[0]
                conn.commit()
                
                return {"status": "linked", "link_id": str(link_id), "case_id": case_id, "requirement_id": requirement_id}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking test case to requirement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


