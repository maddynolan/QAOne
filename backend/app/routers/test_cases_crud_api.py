"""
Test Cases CRUD API Router
Handles all test case CRUD operations
Falls back to in-memory storage when PostgreSQL is not available
"""
import logging
import json
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    map_priority_from_db,
    map_priority_to_db,
    DEFAULT_USER_ID
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])

# In-memory storage fallback when PostgreSQL is not available
_test_cases_store: Dict[str, Dict[str, Any]] = {}

def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available"""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


@router.get("")
async def get_test_cases(
    project_id: Optional[str] = None,
    plan_id: Optional[str] = None
):
    """Get all test cases, optionally filtered by plan_id"""
    try:
        logger.info(f"Getting test cases - project_id: {project_id}, plan_id: {plan_id}")
        
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_query
                org_id, proj_id = await ensure_default_org_project()
                project_id = project_id or proj_id
                
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
                
                test_cases = []
                for row in results or []:
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
                
                logger.info(f"Returning {len(test_cases)} test cases from PostgreSQL")
                return test_cases
            except Exception as pg_error:
                logger.warning(f"PostgreSQL query failed, using in-memory store: {pg_error}")
        
        # Fallback to in-memory storage
        logger.info("Using in-memory storage for test cases")
        test_cases = list(_test_cases_store.values())
        logger.info(f"Returning {len(test_cases)} test cases from in-memory store")
        return test_cases
        
    except Exception as e:
        logger.error(f"Error getting test cases: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error getting test cases: {str(e)}")


@router.get("/{case_id}")
async def get_test_case(case_id: str):
    """Get a specific test case"""
    try:
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_query
                query = """
                    SELECT id, project_id, plan_id, title, description, priority, test_type, 
                           status, tags, steps, preconditions, test_data, estimated_time,
                           created_by, created_at, updated_at
                    FROM test_cases 
                    WHERE id = %s
                """
                results = await execute_query(query, (case_id,))
                
                if results and len(results) > 0:
                    row = results[0]
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
            except Exception as pg_error:
                logger.warning(f"PostgreSQL query failed: {pg_error}")
        
        # Fallback: check in-memory store
        if case_id in _test_cases_store:
            return _test_cases_store[case_id]
        
        raise HTTPException(status_code=404, detail="Test case not found")
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
        
        # Generate UUID for test case
        case_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()
        
        case_data = {
            "id": case_id,
            "project_id": project_id,
            "name": data.get("name", ""),
            "title": data.get("name", ""),
            "description": data.get("description", ""),
            "priority": map_priority_from_db(priority),
            "testType": data.get("testType", "manual"),
            "test_type": data.get("testType", "manual"),
            "status": "draft",
            "tags": data.get("tags", []),
            "steps": steps,
            "preconditions": data.get("preconditions", []),
            "testData": data.get("testData", {}),
            "test_data": data.get("testData", {}),
            "estimatedTime": data.get("estimatedTime", 15),
            "estimated_time": data.get("estimatedTime", 15),
            "createdAt": now,
            "updatedAt": now
        }
        
        logger.info(f"Creating test case: title={case_data['name']}, test_type={case_data['testType']}, steps_count={len(steps)}")
        
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_insert
                db_data = {
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
                pg_case_id = await execute_insert("test_cases", db_data)
                if pg_case_id:
                    logger.info(f"Successfully created test case in PostgreSQL: {pg_case_id}")
                    return {"id": pg_case_id}
            except Exception as pg_error:
                logger.warning(f"PostgreSQL insert failed, using in-memory: {pg_error}")
        
        # Fallback to in-memory storage
        _test_cases_store[case_id] = case_data
        logger.info(f"Successfully created test case in memory: {case_id}")
        return {"id": case_id}
        
    except Exception as e:
        logger.error(f"Error in create_test_case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{case_id}")
async def update_test_case(case_id: str, request: Request):
    """Update a test case"""
    try:
        data = await request.json()
        priority = map_priority_to_db(data.get("priority", "medium"))
        now = datetime.now().isoformat()
        
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
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
                            
                            if result:
                                return {"id": case_id}
                    finally:
                        pool.putconn(conn)
            except Exception as pg_error:
                logger.warning(f"PostgreSQL update failed: {pg_error}")
        
        # Fallback: update in-memory
        if case_id in _test_cases_store:
            _test_cases_store[case_id].update({
                "name": data.get("name", ""),
                "title": data.get("name", ""),
                "description": data.get("description", ""),
                "priority": map_priority_from_db(priority),
                "testType": data.get("testType", "manual"),
                "tags": data.get("tags", []),
                "steps": data.get("steps", []),
                "preconditions": data.get("preconditions", []),
                "testData": data.get("testData", {}),
                "estimatedTime": data.get("estimatedTime", 15),
                "updatedAt": now
            })
            return {"id": case_id}
        
        # Not found in either store
        raise HTTPException(status_code=404, detail="Test case not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{case_id}")
async def delete_test_case(case_id: str):
    """Delete a test case by setting status to 'archived' (soft delete)"""
    try:
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE test_cases SET status = 'archived', updated_at = NOW() WHERE id = %s RETURNING id",
                                (case_id,)
                            )
                            result = cur.fetchone()
                            conn.commit()
                            
                            if result:
                                logger.info(f"Test case {case_id} archived in PostgreSQL")
                                return {"status": "archived", "id": str(result[0])}
                    finally:
                        pool.putconn(conn)
            except Exception as pg_error:
                logger.warning(f"PostgreSQL delete failed: {pg_error}")
        
        # Fallback: delete from in-memory store
        if case_id in _test_cases_store:
            del _test_cases_store[case_id]
            logger.info(f"Test case {case_id} deleted from in-memory store")
            return {"status": "deleted", "id": case_id}
        
        raise HTTPException(status_code=404, detail="Test case not found")
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


