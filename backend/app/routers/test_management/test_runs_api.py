"""
Test Runs CRUD API Router
Handles all test run operations including execution, steps, screenshots, defects, and comments
Falls back to in-memory storage when PostgreSQL is not available
"""
import logging
import json
import uuid
import time
import base64
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
import asyncio
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    map_priority_from_db,
    DEFAULT_USER_ID
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-runs", tags=["test-runs"])

# In-memory storage fallback
_test_runs_store: Dict[str, Dict[str, Any]] = {}

def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available"""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


@router.get("")
async def get_test_runs(project_id: Optional[str] = None):
    """Get all test runs"""
    try:
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_query
                org_id, proj_id = await ensure_default_org_project()
                project_id = project_id or proj_id
                
                query = """
                    SELECT tr.id, tr.project_id, tr.name, tr.status, tr.environment,
                           tr.started_at, tr.completed_at, tr.created_at,
                           COUNT(trs.id) as step_count
                    FROM test_runs tr
                    LEFT JOIN test_run_steps trs ON tr.id = trs.run_id
                    WHERE tr.project_id = %s
                    GROUP BY tr.id
                    ORDER BY tr.created_at DESC
                """
                results = await execute_query(query, (project_id,))
                
                test_runs = []
                for row in results or []:
                    status_map = {
                        "pending": "pending", "running": "running", "passed": "completed",
                        "failed": "failed", "partial": "completed", "error": "failed", "cancelled": "failed"
                    }
                    
                    test_runs.append({
                        "id": str(row.get("id", "")),
                        "name": row.get("name", ""),
                        "status": status_map.get(row.get("status", "pending"), "pending"),
                        "testCases": [],
                        "results": [],
                        "summary": {"passed": 0, "failed": 0, "skipped": 0, "duration": 0},
                        "startTime": row.get("started_at"),
                        "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
                        "completedAt": row.get("completed_at")
                    })
                
                return {"testRuns": test_runs}
            except Exception as pg_error:
                logger.warning(f"PostgreSQL query failed: {pg_error}")
        
        # Fallback to in-memory storage
        return {"testRuns": list(_test_runs_store.values())}
    except Exception as e:
        logger.error(f"Error getting test runs: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving test runs")


@router.get("/{run_id}")
async def get_test_run(run_id: str):
    """Get a specific test run with details including test cases and steps"""
    try:
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Get run details
        run_query = """
            SELECT id, project_id, plan_id, name, status, environment, branch, commit, started_at, completed_at, created_at
            FROM test_runs 
            WHERE id = %s
        """
        run_results = await execute_query(run_query, (run_id,))
        
        if not run_results or len(run_results) == 0:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        run = run_results[0]
        
        # Get ALL steps for this run first - this is the source of truth
        all_steps_query = """
            SELECT id, case_id, title, status, duration_ms, error_message,
                   stdout, stderr, started_at, completed_at, created_at
            FROM test_run_steps
            WHERE run_id = %s OR run_id::text = %s
            ORDER BY case_id, created_at
        """
        all_steps_results = await execute_query(all_steps_query, (run_id, str(run_id)))
        logger.debug(f"GET TEST RUN - Found {len(all_steps_results) if all_steps_results else 0} steps for run {run_id}")
        
        # Group steps by case_id
        steps_by_case: Dict[str, List[Any]] = {}
        if all_steps_results:
            for step in all_steps_results:
                case_id = str(step.get("case_id", ""))
                if case_id:
                    if case_id not in steps_by_case:
                        steps_by_case[case_id] = []
                    steps_by_case[case_id].append(step)
        
        logger.debug(f"GET TEST RUN - Grouped into {len(steps_by_case)} test cases")
        
        # Get unique case_ids
        case_ids = list(steps_by_case.keys())
        test_cases = []
        
        # Process each case_id
        for case_id in case_ids:
            tc_query = """
                SELECT id, title, description, priority, tags, steps, test_type
                FROM test_cases 
                WHERE id = %s
            """
            tc_results = await execute_query(tc_query, (case_id,))
            
            # Get steps for this case_id from our grouped steps
            case_steps = steps_by_case.get(case_id, [])
            case_steps.sort(key=lambda x: x.get("created_at") or "")
            
            steps = []
            if tc_results:
                tc = tc_results[0]
                # Parse steps JSON if it's stored as JSONB
                steps = tc.get("steps", [])
                if isinstance(steps, str):
                    try:
                        steps = json.loads(steps)
                    except:
                        steps = []
            
            # If no steps from test_cases, create steps from test_run_steps
            if not steps or len(steps) == 0:
                if case_steps:
                    for idx, run_step in enumerate(case_steps):
                        # Extract action from title (format: "Test Name - Step N: {action}")
                        title = run_step.get("title", "")
                        if ": " in title:
                            action = title.split(": ", 1)[1]
                        elif " - Step" in title:
                            parts = title.split(" - Step")
                            if len(parts) > 1:
                                step_part = parts[1]
                                if step_part.strip().startswith(tuple("0123456789")):
                                    action = parts[0]
                                else:
                                    action = step_part.strip()
                            else:
                                action = title
                        else:
                            action = title
                        
                        steps.append({
                            "action": action,
                            "expectedResult": f"Step {idx + 1} should complete successfully",
                            "expected": f"Step {idx + 1} should complete successfully"
                        })
            
            # If still no steps, create placeholder
            if not steps or len(steps) == 0:
                steps = [{
                    "action": "Test step not defined",
                    "expectedResult": "Step should be executed",
                    "expected": "Step should be executed"
                }]
            
            if tc_results:
                tc = tc_results[0]
                # Map priority from database format
                priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
                db_priority = tc.get("priority", "P2")
                priority = priority_map.get(db_priority, "medium")
                
                test_cases.append({
                    "id": str(tc.get("id", "")),
                    "name": tc.get("title", ""),
                    "description": tc.get("description", ""),
                    "priority": priority,
                    "tags": tc.get("tags", []) or [],
                    "steps": steps,
                    "testType": tc.get("test_type", "manual"),
                    "complexity": "medium"
                })
            else:
                # Test case doesn't exist in test_cases table, create from test_run_steps
                if case_steps:
                    first_step = case_steps[0]
                    test_name = first_step.get("title", "").split(" - Step")[0] if " - Step" in first_step.get("title", "") else "Test Case"
                    
                    test_cases.append({
                        "id": case_id,
                        "name": test_name,
                        "description": f"Test case from run {run_id}",
                        "priority": "medium",
                        "tags": [],
                        "steps": steps,
                        "testType": "manual",
                        "complexity": "medium"
                    })
        
        # Organize step results by case_id and step_index for execution tracking
        step_results: Dict[str, Dict[int, Any]] = {}
        
        # Process each case's steps in order
        for case_id, steps_list in steps_by_case.items():
            if case_id not in step_results:
                step_results[case_id] = {}
            
            # Sort steps by created_at to maintain order
            steps_list.sort(key=lambda x: x.get("created_at") or "")
            
            # Assign step_index based on order (0-based)
            for step_index, step in enumerate(steps_list):
                # Get artifacts (screenshots) for this step
                artifacts_query = """
                    SELECT id, url, type, metadata
                    FROM artifacts
                    WHERE step_id = %s
                    ORDER BY created_at
                """
                artifacts_results = await execute_query(artifacts_query, (step.get("id"),))
                screenshots = []
                for artifact in artifacts_results or []:
                    screenshots.append({
                        "url": artifact.get("url", ""),
                        "metadata": artifact.get("metadata", {})
                    })
                
                # Get defects linked to this step
                defects_query = """
                    SELECT id, title, priority, status, description
                    FROM defects
                    WHERE step_id = %s
                """
                defects_results = await execute_query(defects_query, (step.get("id"),))
                defects = []
                for defect in defects_results or []:
                    priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
                    db_priority = defect.get("priority", "P2")
                    priority = priority_map.get(db_priority, "medium")
                    defects.append({
                        "id": str(defect.get("id", "")),
                        "title": defect.get("title", ""),
                        "priority": priority,
                        "status": defect.get("status", "open"),
                        "description": defect.get("description", "")
                    })
                
                step_id = str(step.get("id", ""))
                step_results[case_id][step_index] = {
                    "step_id": step_id,
                    "status": step.get("status", "pending"),
                    "duration_ms": step.get("duration_ms", 0) or 0,
                    "error_message": step.get("error_message", ""),
                    "screenshots": screenshots,
                    "defects": defects
                }
        
        # Get global artifacts (screenshots not linked to a specific step)
        global_artifacts_query = """
            SELECT id, url, type, metadata
            FROM artifacts
            WHERE run_id = %s AND step_id IS NULL
            ORDER BY created_at
        """
        global_artifacts_results = await execute_query(global_artifacts_query, (run_id,))
        global_screenshots = []
        for artifact in global_artifacts_results or []:
            global_screenshots.append({
                "url": artifact.get("url", ""),
                "metadata": artifact.get("metadata", {})
            })
        
        # Get global defects (linked to run but not a specific step)
        global_defects_query = """
            SELECT id, title, priority, status, description
            FROM defects
            WHERE run_id = %s AND step_id IS NULL
        """
        global_defects_results = await execute_query(global_defects_query, (run_id,))
        global_defects = []
        for defect in global_defects_results or []:
            priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
            db_priority = defect.get("priority", "P2")
            priority = priority_map.get(db_priority, "medium")
            global_defects.append({
                "id": str(defect.get("id", "")),
                "title": defect.get("title", ""),
                "priority": priority,
                "status": defect.get("status", "open"),
                "description": defect.get("description", "")
            })
        
        # Calculate test case statuses based on step results
        test_case_statuses: Dict[str, str] = {}
        for case_id, steps_dict in step_results.items():
            all_pending = True
            any_failed = False
            all_passed = True
            
            for step_index, step_data in steps_dict.items():
                step_status = step_data.get("status", "pending")
                if step_status != "pending":
                    all_pending = False
                if step_status == "failed":
                    any_failed = True
                    all_passed = False
                elif step_status == "passed":
                    all_passed = all_passed and True
            
            if all_pending:
                test_case_statuses[case_id] = "pending"
            elif any_failed:
                test_case_statuses[case_id] = "failed"
            elif all_passed:
                test_case_statuses[case_id] = "passed"
            else:
                test_case_statuses[case_id] = "executing"
        
        # Calculate summary
        summary = {"passed": 0, "failed": 0, "skipped": 0, "duration": 0, "total": 0}
        for case_id, steps in step_results.items():
            for step_index, step_data in steps.items():
                summary["total"] += 1
                status = step_data.get("status", "pending")
                if status == "passed":
                    summary["passed"] += 1
                elif status == "failed":
                    summary["failed"] += 1
                elif status == "skipped":
                    summary["skipped"] += 1
                summary["duration"] += step_data.get("duration_ms", 0) or 0
        
        # Map database status to frontend status
        db_status = run.get("status", "pending")
        if db_status == "running":
            frontend_status = "executing"
        elif db_status == "passed":
            frontend_status = "completed"
        elif db_status in ["failed", "error", "cancelled"]:
            frontend_status = "failed"
        else:
            frontend_status = db_status
        
        return {
            "id": str(run.get("id", "")),
            "name": run.get("name", ""),
            "status": frontend_status,
            "planId": str(run.get("plan_id", "")) if run.get("plan_id") else None,
            "environment": run.get("environment", "local"),
            "branch": run.get("branch"),
            "commit": run.get("commit"),
            "testCases": test_cases,
            "stepResults": step_results,
            "testCaseStatuses": test_case_statuses,
            "summary": summary,
            "globalScreenshots": global_screenshots,
            "globalDefects": global_defects,
            "started_at": run.get("started_at"),
            "completed_at": run.get("completed_at"),
            "startTime": run.get("started_at"),
            "createdAt": str(run.get("created_at", "")),
            "completedAt": run.get("completed_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving test run")


@router.post("")
async def create_test_run(request: Request):
    """Create a new test run with test cases"""
    try:
        data = await request.json()
        now = datetime.now()
        run_id = f"run_{int(time.time())}"
        
        logger.info(f"CREATE TEST RUN - Received data keys: {list(data.keys())}")
        
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                from app.services.storage.postgres_direct import execute_insert, execute_query
                pool = get_database_client()
                if pool and hasattr(pool, 'getconn'):
                    org_id, project_id = await ensure_default_org_project()
                    # ... continue with PostgreSQL logic
                    pass
            except Exception as pg_error:
                logger.warning(f"PostgreSQL create failed: {pg_error}")
        
        # Fallback: Create test run in memory
        test_cases = data.get("testCases", [])
        test_run = {
            "id": run_id,
            "name": data.get("name", f"Test Run {now.strftime('%Y-%m-%d %H:%M')}"),
            "status": "pending",
            "testCases": [tc.get("id") or tc.get("title") for tc in test_cases] if test_cases else [],
            "results": [],
            "summary": {"passed": 0, "failed": 0, "skipped": 0, "duration": 0},
            "startTime": now.isoformat(),
            "createdAt": now.isoformat()
        }
        _test_runs_store[run_id] = test_run
        logger.info(f"Created test run in memory: {run_id}")
        return {"id": run_id, "testRun": test_run}
        
        # Verify project exists before trying to create test run
        from app.services.storage.postgres_direct import execute_query
        projects = await execute_query("SELECT id FROM projects WHERE id = %s", (project_id,))
        if not projects:
            logger.error(f"Project {project_id} does not exist in database. Cannot create test run.")
            raise HTTPException(
                status_code=400, 
                detail=f"Project {project_id} does not exist. Please ensure default project is created."
            )
        
        run_data = {
            "project_id": project_id,
            "name": data.get("name", f"Test Run {datetime.utcnow().isoformat()}"),
            "status": "pending",
            "environment": data.get("environment", "local"),
            "plan_id": data.get("planId"),
            "created_by": DEFAULT_USER_ID
        }
        
        run_id = await execute_insert("test_runs", run_data)
        logger.info(f"Created test run with ID: {run_id}")
        if not run_id:
            raise HTTPException(status_code=500, detail="Failed to create test run")
        
        # Support both old format (testCases array) and new format (test_case_ids array)
        test_case_ids = data.get("test_case_ids", [])
        test_cases = data.get("testCases", [])
        
        # If test_case_ids provided, fetch test cases from database
        if test_case_ids and len(test_case_ids) > 0:
            logger.info(f"CREATE TEST RUN - Using test_case_ids: {len(test_case_ids)} IDs provided")
            test_cases = []
            for case_id in test_case_ids:
                tc_query = """
                    SELECT id, title, description, priority, tags, steps, test_type
                    FROM test_cases 
                    WHERE id = %s
                """
                tc_results = await execute_query(tc_query, (case_id,))
                if tc_results:
                    tc = tc_results[0]
                    steps = tc.get("steps", [])
                    if isinstance(steps, str):
                        try:
                            steps = json.loads(steps)
                        except:
                            steps = []
                    
                    test_cases.append({
                        "id": str(tc.get("id", "")),
                        "title": tc.get("title", ""),
                        "name": tc.get("title", ""),
                        "description": tc.get("description", ""),
                        "priority": tc.get("priority", "P2"),
                        "tags": tc.get("tags", []) or [],
                        "steps": steps or []
                    })
                else:
                    logger.warning(f"Test case {case_id} not found in database, skipping")
        
        logger.info(f"CREATE TEST RUN - Processing {len(test_cases)} test cases")
        
        if test_cases:
            for idx, test_case in enumerate(test_cases):
                case_id = test_case.get("id") or test_case.get("case_id")
                steps = test_case.get("steps", [])
                
                logger.debug(f"Processing test case {case_id} with {len(steps)} steps")
                
                # If no case_id, generate one (must be valid UUID)
                if not case_id:
                    case_id = str(uuid.uuid4())
                    logger.warning(f"Test case missing ID, generated: {case_id}")
                else:
                    # Ensure case_id is a valid UUID format
                    try:
                        uuid.UUID(case_id)
                    except ValueError:
                        logger.warning(f"Test case ID '{case_id}' is not a valid UUID, generating new one")
                        case_id = str(uuid.uuid4())
                
                # If no steps provided, create a placeholder step
                if not steps or len(steps) == 0:
                    logger.warning(f"No steps found for test case {case_id}, creating placeholder")
                    steps = [{
                        "action": "Execute test case",
                        "expectedResult": "Test case should complete successfully",
                        "expected": "Test case should complete successfully"
                    }]
                
                # Always create test_run_steps entries
                for step_idx, step in enumerate(steps):
                    step_action = step.get("action") or "Execute step"
                    step_expected = step.get("expectedResult") or step.get("expected") or "Step should complete"
                    
                    test_case_name = test_case.get('title') or test_case.get('name') or 'Test'
                    step_title = f"{test_case_name} - Step {step_idx + 1}: {step_action}"
                    
                    try:
                        step_id = await store_test_run_step(
                            run_id=run_id,
                            case_id=case_id,
                            title=step_title,
                            status="pending",
                            duration_ms=0,
                            error_message=None,
                            stdout=None,
                            stderr=None,
                            started_at=None,
                            completed_at=None
                        )
                        if step_id:
                            logger.debug(f"Created test_run_step for case {case_id}, step {step_idx + 1}: {step_title}")
                        else:
                            logger.warning(f"store_test_run_step returned None for case {case_id}, step {step_idx + 1}")
                    except Exception as e:
                        logger.error(f"Failed to create test_run_step for case {case_id}, step {step_idx + 1}: {str(e)}")
                        raise
        else:
            logger.warning(f"No test cases provided when creating test run {run_id}")
        
        # Verify steps were actually inserted
        verify_query = """
            SELECT COUNT(*) as count FROM test_run_steps WHERE run_id = %s
        """
        verify_result = await execute_query(verify_query, (run_id,))
        if verify_result:
            count = verify_result[0].get("count", 0)
            logger.debug(f"VERIFY - Found {count} steps in database for run_id: {run_id}")
        
        return {"id": run_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating test run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while creating test run")


@router.put("/{run_id}")
async def update_test_run(run_id: str, request: Request):
    """Update a test run"""
    try:
        data = await request.json()
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Map frontend status to database status
        status_map = {
            "pending": "pending",
            "running": "running",
            "completed": "passed",
            "failed": "failed"
        }
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_runs 
                    SET name = %s, status = %s, updated_at = NOW(),
                        started_at = %s, completed_at = %s
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    status_map.get(data.get("status", "pending"), "pending"),
                    data.get("startTime"),
                    data.get("completedAt"),
                    run_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test run not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while updating test run")


@router.post("/{run_id}/start")
async def start_test_run(run_id: str):
    """Start a test run execution - change status from pending to running"""
    try:
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_runs 
                    SET status = 'running', started_at = NOW(), updated_at = NOW()
                    WHERE id = %s AND status = 'pending'
                    RETURNING id, status, started_at
                """
                cur.execute(update_query, (run_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test run not found or already started")
                
                return {
                    "id": str(result[0]),
                    "status": result[1],
                    "started_at": str(result[2])
                }
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting test run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while starting test run")


@router.post("/{run_id}/execute-selected")
async def execute_selected_test_cases(run_id: str, request: Request):
    """Execute selected test cases within a test run"""
    try:
        data = await request.json()
        case_ids = data.get("case_ids", [])
        
        if not case_ids or len(case_ids) == 0:
            raise HTTPException(status_code=400, detail="No test case IDs provided")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Check if run exists and start it if pending
        run_query = "SELECT id, status FROM test_runs WHERE id = %s"
        run_result = await execute_query(run_query, (run_id,))
        if not run_result:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        run_status = run_result[0].get("status")
        if run_status == "pending":
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    update_query = """
                        UPDATE test_runs 
                        SET status = 'running', started_at = NOW(), updated_at = NOW()
                        WHERE id = %s
                    """
                    cur.execute(update_query, (run_id,))
                    conn.commit()
            finally:
                pool.putconn(conn)
        
        return {
            "message": f"Selected {len(case_ids)} test case(s) ready for execution",
            "case_ids": case_ids
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing selected test cases: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while executing test cases")


@router.post("/{run_id}/steps/{step_id}/mark")
async def mark_test_step(run_id: str, step_id: str, request: Request):
    """Mark a test step as passed or failed"""
    try:
        data = await request.json()
        status = data.get("status")
        error = data.get("error", "")
        
        if status not in ["passed", "failed"]:
            raise HTTPException(status_code=400, detail="Status must be 'passed' or 'failed'")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Update step status
                update_query = """
                    UPDATE test_run_steps 
                    SET status = %s, error_message = %s, completed_at = NOW()
                    WHERE id = %s AND run_id = %s
                    RETURNING id
                """
                cur.execute(update_query, (status, error, step_id, run_id))
                result = cur.fetchone()
                
                if not result:
                    logger.error(f"Step not found: step_id={step_id}, run_id={run_id}")
                    raise HTTPException(status_code=404, detail=f"Test step not found: step_id={step_id}, run_id={run_id}")
                
                # Check if all steps are completed and update run status
                all_steps_query = """
                    SELECT COUNT(*) as total, 
                           SUM(CASE WHEN status IN ('passed', 'failed') THEN 1 ELSE 0 END) as completed
                    FROM test_run_steps
                    WHERE run_id = %s
                """
                cur.execute(all_steps_query, (run_id,))
                stats = cur.fetchone()
                
                if stats and stats[0] > 0 and stats[1] == stats[0]:
                    # All steps completed, determine run status
                    failed_count_query = """
                        SELECT COUNT(*) FROM test_run_steps 
                        WHERE run_id = %s AND status = 'failed'
                    """
                    cur.execute(failed_count_query, (run_id,))
                    failed_count = cur.fetchone()[0]
                    
                    run_status = "failed" if failed_count > 0 else "passed"
                    update_run_query = """
                        UPDATE test_runs 
                        SET status = %s, completed_at = NOW()
                        WHERE id = %s
                    """
                    cur.execute(update_run_query, (run_status, run_id))
                
                conn.commit()
                return {"id": str(result[0]), "status": status}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking test step: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while marking test step")


@router.post("/{run_id}/steps/{step_id}/screenshot")
async def upload_step_screenshot(run_id: str, step_id: str, request: Request):
    """Upload a screenshot for a specific test step"""
    try:
        data = await request.json()
        image_base64 = data.get("image")
        image_type = data.get("type", "image/png")
        
        if not image_base64:
            raise HTTPException(status_code=400, detail="Missing image data")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
        # Store as data URL (base64)
        image_url = f"data:{image_type};base64,{image_base64}"
        
        artifact_id = await store_artifact(
            run_id=run_id,
            step_id=step_id,
            artifact_type="screenshot",
            url=image_url,
            size_bytes=len(image_bytes),
            metadata={"type": image_type}
        )
        
        if not artifact_id:
            raise HTTPException(status_code=500, detail="Failed to store screenshot")
        
        return {"id": artifact_id, "url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading step screenshot: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while uploading screenshot")


@router.post("/{run_id}/screenshot")
async def upload_run_screenshot(run_id: str, request: Request):
    """Upload a global screenshot for a test run"""
    try:
        data = await request.json()
        image_base64 = data.get("image")
        image_type = data.get("type", "image/png")
        
        if not image_base64:
            raise HTTPException(status_code=400, detail="Missing image data")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Decode base64 image
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
        # Store as data URL (base64)
        image_url = f"data:{image_type};base64,{image_base64}"
        
        artifact_id = await store_artifact(
            run_id=run_id,
            step_id=None,
            artifact_type="screenshot",
            url=image_url,
            size_bytes=len(image_bytes),
            metadata={"type": image_type, "global": True}
        )
        
        if not artifact_id:
            raise HTTPException(status_code=500, detail="Failed to store screenshot")
        
        return {"id": artifact_id, "url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading run screenshot: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while uploading screenshot")


@router.post("/{run_id}/steps/{step_id}/link-defect")
async def link_defect_to_step(run_id: str, step_id: str, request: Request):
    """Link an existing defect to a test step"""
    try:
        data = await request.json()
        defect_id = data.get("defect_id")
        
        if not defect_id:
            raise HTTPException(status_code=400, detail="Missing defect_id")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE defects 
                    SET step_id = %s, run_id = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (step_id, run_id, defect_id))
                result = cur.fetchone()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Defect not found")
                
                conn.commit()
                return {"id": str(result[0]), "step_id": step_id, "run_id": run_id}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking defect to step: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while linking defect")


@router.post("/{run_id}/link-defect")
async def link_defect_to_run(run_id: str, request: Request):
    """Link an existing defect to a test run (global)"""
    try:
        data = await request.json()
        defect_id = data.get("defect_id")
        
        if not defect_id:
            raise HTTPException(status_code=400, detail="Missing defect_id")
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE defects 
                    SET run_id = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (run_id, defect_id))
                result = cur.fetchone()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Defect not found")
                
                conn.commit()
                return {"id": str(result[0]), "run_id": run_id}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error linking defect to run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while linking defect")


@router.delete("/{run_id}")
async def delete_test_run(run_id: str):
    """Delete a test run"""
    try:
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_runs WHERE id = %s RETURNING id", (run_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test run not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test run: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while deleting test run")


@router.post("/{run_id}/comments")
async def add_test_run_comment(run_id: str, request: Request):
    """Add a comment to a test run, test case, or step"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        
        comment_text = data.get("comment", "")
        case_id = data.get("case_id")
        step_id = data.get("step_id")
        
        if not comment_text:
            raise HTTPException(status_code=400, detail="Comment text is required")
        
        comment_data = {
            "project_id": project_id,
            "run_id": run_id,
            "case_id": case_id,
            "step_id": step_id,
            "comment": comment_text,
            "created_by": DEFAULT_USER_ID
        }
        
        comment_id = await execute_insert("test_comments", comment_data)
        if not comment_id:
            raise HTTPException(status_code=500, detail="Failed to create comment")
        
        return {"id": comment_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding comment: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while adding comment")


@router.get("/{run_id}/comments")
async def get_test_run_comments(run_id: str, case_id: Optional[str] = None, step_id: Optional[str] = None):
    """Get comments for a test run, optionally filtered by case or step"""
    try:
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"comments": []}
        
        if step_id:
            query = """
                SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
                FROM test_comments
                WHERE run_id = %s AND step_id = %s
                ORDER BY created_at ASC
            """
            params = (run_id, step_id)
        elif case_id:
            query = """
                SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
                FROM test_comments
                WHERE run_id = %s AND case_id = %s
                ORDER BY created_at ASC
            """
            params = (run_id, case_id)
        else:
            query = """
                SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
                FROM test_comments
                WHERE run_id = %s
                ORDER BY created_at ASC
            """
            params = (run_id,)
        
        results = await execute_query(query, params)
        
        comments = []
        for row in results or []:
            comments.append({
                "id": str(row.get("id", "")),
                "case_id": str(row.get("case_id", "")) if row.get("case_id") else None,
                "step_id": str(row.get("step_id", "")) if row.get("step_id") else None,
                "comment": row.get("comment", ""),
                "created_by": str(row.get("created_by", "")),
                "created_at": str(row.get("created_at", "")),
                "updated_at": str(row.get("updated_at", ""))
            })
        
        return {"comments": comments}
    except Exception as e:
        logger.error(f"Error getting comments: {str(e)}")
        return {"comments": []}


@router.get("/{run_id}/export")
async def export_test_run(run_id: str, format: str = "junit"):
    """Export test run results in JUnit XML or HTML format"""
    try:
        # Try to get test run from storage
        test_run = None

        # Check in-memory storage first
        if run_id in _test_runs_store:
            test_run = _test_runs_store[run_id]

        # Try database
        if not test_run:
            try:
                from app.services.storage.postgres_direct import execute_query
                run_results = await execute_query(
                    "SELECT * FROM test_runs WHERE id = %s", (run_id,)
                )
                if run_results:
                    run = run_results[0]
                    test_run = {
                        "id": str(run.get("id", "")),
                        "test_case_name": run.get("name", "Test Run"),
                        "name": run.get("name", "Test Run"),
                        "status": run.get("status", "unknown"),
                        "duration_ms": run.get("duration_ms", 0),
                        "started_at": str(run.get("started_at", "")),
                        "environment": run.get("environment", "Default"),
                        "steps": []
                    }

                    # Fetch steps
                    step_results = await execute_query(
                        """SELECT id, step_number, action, selector, value, status,
                                  error_message, duration_ms, healed, working_selector
                           FROM test_run_steps WHERE run_id = %s ORDER BY step_number""",
                        (run_id,)
                    )
                    if step_results:
                        for s in step_results:
                            test_run["steps"].append({
                                "name": s.get("action", f"Step {s.get('step_number', 0)}"),
                                "description": s.get("action", ""),
                                "status": s.get("status", "passed"),
                                "duration_ms": s.get("duration_ms", 0),
                                "error": s.get("error_message", ""),
                                "healed": bool(s.get("healed", False)),
                                "working_selector": s.get("working_selector", "")
                            })
            except Exception as db_err:
                logger.warning(f"Database lookup for export failed: {db_err}")

        if not test_run:
            # Return a sample/empty report if run not found
            test_run = {
                "id": run_id,
                "test_case_name": "Test Run " + run_id[:8],
                "status": "unknown",
                "duration_ms": 0,
                "started_at": datetime.utcnow().isoformat(),
                "steps": []
            }

        if format == "html":
            from app.services.executors.html_report_generator import HTMLReportGenerator
            content = HTMLReportGenerator.generate(test_run)
            return Response(
                content=content,
                media_type="text/html",
                headers={"Content-Disposition": f'attachment; filename="test-report-{run_id[:8]}.html"'}
            )
        else:
            from app.services.executors.junit_report_generator import JUnitReportGenerator
            content = JUnitReportGenerator.generate(test_run)
            return Response(
                content=content,
                media_type="application/xml",
                headers={"Content-Disposition": f'attachment; filename="test-report-{run_id[:8]}.xml"'}
            )

    except Exception as e:
        logger.error(f"Failed to export test run {run_id}: {e}")
        return {"error": str(e)}


@router.websocket("/ws/{execution_id}")
async def execution_websocket(websocket: WebSocket, execution_id: str):
    """
    WebSocket endpoint for real-time test execution progress updates.
    
    Streams:
    - step_start: When a step begins
    - step_complete: When a step finishes (passed/failed/healed)
    - self_healing: When a selector is auto-healed
    - screenshot: When a screenshot is captured
    - log: Debug/info messages
    - execution_complete: Final results
    """
    from app.services.execution_websocket_manager import execution_ws_manager
    
    await execution_ws_manager.connect(websocket, execution_id)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "execution_id": execution_id,
            "message": "Connected to execution progress stream",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and handle client messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "execution_id": execution_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({
                    "type": "heartbeat",
                    "execution_id": execution_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for execution {execution_id}")
        execution_ws_manager.disconnect(websocket, execution_id)
    except Exception as e:
        logger.error(f"Execution WebSocket error: {e}", exc_info=True)
        execution_ws_manager.disconnect(websocket, execution_id)


