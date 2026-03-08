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


def _validate_json_fields(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    SEC-JSON-001: Validate and sanitize JSON fields in test case data.
    Ensures steps, tags, preconditions, and testData are well-formed.
    Prevents malformed JSON from corrupting the database.
    """
    # Validate steps: must be a list of dicts with action/expectedResult
    steps = data.get("steps", [])
    if isinstance(steps, str):
        try:
            steps = json.loads(steps)
        except (json.JSONDecodeError, ValueError):
            logger.warning("[SEC-JSON-001] Malformed steps JSON string, defaulting to empty list")
            steps = []
    if not isinstance(steps, list):
        steps = []
    # Ensure each step has required fields
    validated_steps = []
    for step in steps:
        if isinstance(step, dict):
            validated_steps.append({
                "action": str(step.get("action", ""))[:5000],  # Cap at 5000 chars
                "expectedResult": str(step.get("expectedResult", ""))[:5000],
                **{k: v for k, v in step.items() if k not in ("action", "expectedResult")}
            })
    data["steps"] = validated_steps

    # Validate tags: must be a list of strings
    tags = data.get("tags", [])
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except (json.JSONDecodeError, ValueError):
            tags = []
    if not isinstance(tags, list):
        tags = []
    data["tags"] = [str(t)[:100] for t in tags if isinstance(t, (str, int, float))][:50]  # Max 50 tags, 100 chars each

    # Validate preconditions: must be a list
    preconditions = data.get("preconditions", [])
    if isinstance(preconditions, str):
        try:
            preconditions = json.loads(preconditions)
        except (json.JSONDecodeError, ValueError):
            preconditions = []
    if not isinstance(preconditions, list):
        preconditions = []
    data["preconditions"] = preconditions

    # Validate testData: must be a dict
    test_data = data.get("testData", data.get("test_data", {}))
    if isinstance(test_data, str):
        try:
            test_data = json.loads(test_data)
        except (json.JSONDecodeError, ValueError):
            test_data = {}
    if not isinstance(test_data, dict):
        test_data = {}
    data["testData"] = test_data
    data["test_data"] = test_data

    return data

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
        raise HTTPException(status_code=500, detail="Internal server error while retrieving test cases")


@router.post("/bulk-import")
async def bulk_import_test_cases(request: Request):
    """Bulk import test cases for scale testing - stores in SQLite for persistence"""
    try:
        data = await request.json()
        test_cases = data.get("testCases", [])
        suites = data.get("suites", [])
        plans = data.get("plans", [])
        releases = data.get("releases", [])
        
        logger.info(f"Bulk import: {len(test_cases)} test cases, {len(suites)} suites, {len(plans)} plans, {len(releases)} releases")
        
        # Use SQLite for persistent storage
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create tables if not exist
        cursor.execute('''CREATE TABLE IF NOT EXISTS scale_test_cases (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            folder_id TEXT,
            folder_name TEXT,
            priority TEXT,
            status TEXT,
            tags TEXT,
            steps TEXT,
            automation_status TEXT,
            automation_script_path TEXT,
            created_at TEXT,
            updated_at TEXT
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS scale_test_suites (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            test_case_ids TEXT,
            created_at TEXT
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS scale_test_plans (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            status TEXT,
            suite_ids TEXT,
            test_case_ids TEXT,
            start_date TEXT,
            end_date TEXT,
            created_at TEXT
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS scale_releases (
            id TEXT PRIMARY KEY,
            name TEXT,
            description TEXT,
            status TEXT,
            suite_ids TEXT,
            version TEXT,
            release_date TEXT,
            created_at TEXT
        )''')
        
        # Clear existing data
        cursor.execute("DELETE FROM scale_test_cases")
        cursor.execute("DELETE FROM scale_test_suites")
        cursor.execute("DELETE FROM scale_test_plans")
        cursor.execute("DELETE FROM scale_releases")
        
        # Insert test cases in batches
        for tc in test_cases:
            cursor.execute('''INSERT OR REPLACE INTO scale_test_cases 
                (id, name, description, folder_id, folder_name, priority, status, tags, steps, 
                 automation_status, automation_script_path, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (tc.get('id'), tc.get('name'), tc.get('description'), 
                 tc.get('folderId'), tc.get('folderName'), tc.get('priority', 'Medium'),
                 tc.get('status', 'Active'), json.dumps(tc.get('tags', [])),
                 json.dumps(tc.get('steps', [])), tc.get('automationStatus', 'manual'),
                 tc.get('automationScriptPath'), tc.get('createdAt'), tc.get('updatedAt')))
        
        # Insert suites
        for suite in suites:
            cursor.execute('''INSERT OR REPLACE INTO scale_test_suites 
                (id, name, description, test_case_ids, created_at)
                VALUES (?, ?, ?, ?, ?)''',
                (suite.get('id'), suite.get('name'), suite.get('description'),
                 json.dumps(suite.get('testCaseIds', [])), suite.get('createdAt')))
        
        # Insert plans
        for plan in plans:
            cursor.execute('''INSERT OR REPLACE INTO scale_test_plans 
                (id, name, description, status, suite_ids, test_case_ids, start_date, end_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (plan.get('id'), plan.get('name'), plan.get('description'),
                 plan.get('status', 'draft'), json.dumps(plan.get('suiteIds', [])),
                 json.dumps(plan.get('testCaseIds', [])), plan.get('startDate'),
                 plan.get('endDate'), plan.get('createdAt')))
        
        # Insert releases
        for release in releases:
            cursor.execute('''INSERT OR REPLACE INTO scale_releases 
                (id, name, description, status, suite_ids, version, release_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (release.get('id'), release.get('name'), release.get('description'),
                 release.get('status', 'planning'), json.dumps(release.get('suiteIds', [])),
                 release.get('version'), release.get('releaseDate'), release.get('createdAt')))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Bulk import complete: {len(test_cases)} TCs, {len(suites)} suites, {len(plans)} plans, {len(releases)} releases saved to {db_path}")
        
        return {
            "status": "success",
            "imported": {
                "testCases": len(test_cases),
                "suites": len(suites),
                "plans": len(plans),
                "releases": len(releases)
            },
            "database": db_path
        }
    except Exception as e:
        logger.error(f"Bulk import error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Bulk import failed")


@router.get("/scale-data/summary")
async def get_scale_data_summary():
    """Get summary counts - FAST endpoint for UI stats"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"testCases": 0, "suites": 0, "plans": 0, "releases": 0}
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_cases")
        tc_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_suites")
        suite_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_plans")
        plan_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_releases")
        release_count = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "testCases": tc_count,
            "suites": suite_count,
            "plans": plan_count,
            "releases": release_count
        }
    except Exception as e:
        return {"testCases": 0, "suites": 0, "plans": 0, "releases": 0}


@router.get("/scale-data/paginated")
async def get_paginated_test_cases(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc"
):
    """Paginated test cases endpoint - Enterprise scale ready"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"testCases": [], "total": 0, "page": page, "limit": limit, "totalPages": 0}
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Build WHERE clause
        where_clauses = []
        params = []
        
        if search:
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        
        if priority and priority != 'all':
            where_clauses.append("priority = ?")
            params.append(priority)
        
        if status and status != 'all':
            where_clauses.append("automation_status = ?")
            params.append(status)
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # Get total count
        cursor.execute(f"SELECT COUNT(*) FROM scale_test_cases WHERE {where_sql}", params)
        total = cursor.fetchone()[0]
        
        # Get paginated results
        offset = (page - 1) * limit
        # Whitelist allowed sort columns to prevent SQL injection
        ALLOWED_SORT_COLUMNS = {
            "updated_at", "created_at", "name", "priority", "status",
            "automation_status", "folder_name", "updated", "id", "description"
        }
        if sort_by not in ALLOWED_SORT_COLUMNS:
            sort_by = "updated_at"
        order_col = "updated_at" if sort_by == "updated" else sort_by
        order_dir = "DESC" if sort_order == "desc" else "ASC"
        
        cursor.execute(f"""
            SELECT id, name, description, folder_id, folder_name, priority, status, 
                   tags, automation_status, automation_script_path, created_at, updated_at
            FROM scale_test_cases 
            WHERE {where_sql}
            ORDER BY {order_col} {order_dir}
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        test_cases = []
        for row in cursor.fetchall():
            tc = dict(row)
            tc['tags'] = json.loads(tc.get('tags') or '[]')
            # Don't include steps in list view - load on demand
            test_cases.append(tc)
        
        conn.close()
        
        total_pages = (total + limit - 1) // limit
        
        logger.info(f"Paginated query: page={page}, limit={limit}, total={total}, returned={len(test_cases)}")
        
        return {
            "testCases": test_cases,
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": total_pages
        }
    except Exception as e:
        logger.error(f"Error in paginated query: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during paginated query")


@router.get("/scale-data/test-case/{test_case_id}")
async def get_single_test_case(test_case_id: str):
    """Get single test case with full details including steps - for builder"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="Test case not found")
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM scale_test_cases WHERE id = ?", (test_case_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Test case not found")
        
        tc = dict(row)
        tc['tags'] = json.loads(tc.get('tags') or '[]')
        tc['steps'] = json.loads(tc.get('steps') or '[]')
        
        conn.close()
        
        logger.info(f"Loaded test case {test_case_id} with {len(tc['steps'])} steps")
        
        return tc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading test case: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while loading test case")


@router.get("/scale-data/suites")
async def get_suites_paginated(page: int = 1, limit: int = 50):
    """Get paginated suites"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"suites": [], "total": 0, "page": page, "limit": limit}
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_suites")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_test_suites LIMIT ? OFFSET ?", (limit, offset))
        
        suites = []
        for row in cursor.fetchall():
            suite = dict(row)
            suite['testCaseIds'] = json.loads(suite.get('test_case_ids') or '[]')
            suites.append(suite)
        
        conn.close()
        return {"suites": suites, "total": total, "page": page, "limit": limit}
    except Exception as e:
        return {"suites": [], "total": 0, "page": page, "limit": limit}


@router.get("/scale-data/plans")
async def get_plans_paginated(page: int = 1, limit: int = 50):
    """Get paginated plans"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"plans": [], "total": 0, "page": page, "limit": limit}
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_plans")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_test_plans LIMIT ? OFFSET ?", (limit, offset))
        
        plans = []
        for row in cursor.fetchall():
            plan = dict(row)
            plan['suiteIds'] = json.loads(plan.get('suite_ids') or '[]')
            plan['testCaseIds'] = json.loads(plan.get('test_case_ids') or '[]')
            plans.append(plan)
        
        conn.close()
        return {"plans": plans, "total": total, "page": page, "limit": limit}
    except Exception as e:
        return {"plans": [], "total": 0, "page": page, "limit": limit}


@router.get("/scale-data/releases")
async def get_releases_paginated(page: int = 1, limit: int = 50):
    """Get paginated releases"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"releases": [], "total": 0, "page": page, "limit": limit}
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_releases")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_releases LIMIT ? OFFSET ?", (limit, offset))
        
        releases = []
        for row in cursor.fetchall():
            release = dict(row)
            release['suiteIds'] = json.loads(release.get('suite_ids') or '[]')
            releases.append(release)
        
        conn.close()
        return {"releases": releases, "total": total, "page": page, "limit": limit}
    except Exception as e:
        return {"releases": [], "total": 0, "page": page, "limit": limit}


@router.put("/scale-data/update/{case_id}")
async def update_scale_test_case(case_id: str, request: Request):
    """Update a test case in SQLite scale database"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"status": "not_found", "id": case_id}
        
        data = await request.json()
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Update automation_status and updated_at
        cursor.execute("""
            UPDATE scale_test_cases 
            SET automation_status = ?, steps = ?, updated_at = ?
            WHERE id = ?
        """, (
            data.get('automation_status', 'none'),
            json.dumps(data.get('steps', [])),
            data.get('updated_at', datetime.utcnow().isoformat()),
            case_id
        ))
        updated_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        if updated_count > 0:
            logger.info(f"Updated test case {case_id} in SQLite scale database: status={data.get('automation_status')}")
            return {"status": "updated", "id": case_id}
        else:
            return {"status": "not_found", "id": case_id}
    except Exception as e:
        logger.error(f"Error updating scale database: {str(e)}")
        return {"status": "error", "error": str(e)}


@router.delete("/scale-data/{case_id}")
async def delete_scale_test_case(case_id: str):
    """Delete a test case from SQLite scale database"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"status": "not_found", "id": case_id}
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Actually delete the record (hard delete)
        cursor.execute("DELETE FROM scale_test_cases WHERE id = ?", (case_id,))
        deleted_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        if deleted_count > 0:
            logger.info(f"Deleted test case {case_id} from SQLite scale database")
            return {"status": "deleted", "id": case_id}
        else:
            return {"status": "not_found", "id": case_id}
    except Exception as e:
        logger.error(f"Error deleting from scale database: {str(e)}")
        return {"status": "error", "error": str(e)}


@router.get("/scale-data")
async def get_scale_test_data():
    """Get all scale test data from SQLite database - WARNING: Use paginated endpoints for production"""
    try:
        import sqlite3
        import os
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "scale_test.db")
        
        if not os.path.exists(db_path):
            return {"testCases": [], "suites": [], "plans": [], "releases": []}
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get test cases - filter out archived/deleted status, sort newest first
        cursor.execute("SELECT * FROM scale_test_cases WHERE status IS NULL OR status NOT IN ('archived', 'deleted') ORDER BY created_at DESC")
        test_cases = []
        for row in cursor.fetchall():
            tc = dict(row)
            tc['tags'] = json.loads(tc.get('tags') or '[]')
            tc['steps'] = json.loads(tc.get('steps') or '[]')
            test_cases.append(tc)
        
        # Get suites
        cursor.execute("SELECT * FROM scale_test_suites")
        suites = []
        for row in cursor.fetchall():
            suite = dict(row)
            suite['testCaseIds'] = json.loads(suite.get('test_case_ids') or '[]')
            suites.append(suite)
        
        # Get plans
        cursor.execute("SELECT * FROM scale_test_plans")
        plans = []
        for row in cursor.fetchall():
            plan = dict(row)
            plan['suiteIds'] = json.loads(plan.get('suite_ids') or '[]')
            plan['testCaseIds'] = json.loads(plan.get('test_case_ids') or '[]')
            plans.append(plan)
        
        # Get releases
        cursor.execute("SELECT * FROM scale_releases")
        releases = []
        for row in cursor.fetchall():
            release = dict(row)
            release['suiteIds'] = json.loads(release.get('suite_ids') or '[]')
            releases.append(release)
        
        conn.close()
        
        logger.info(f"Scale data loaded: {len(test_cases)} TCs, {len(suites)} suites, {len(plans)} plans, {len(releases)} releases")
        
        return {
            "testCases": test_cases,
            "suites": suites,
            "plans": plans,
            "releases": releases
        }
    except Exception as e:
        logger.error(f"Error loading scale data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load scale data")


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
        raise HTTPException(status_code=500, detail="Internal server error while retrieving test case")


@router.post("")
async def create_test_case(request: Request):
    """Create a new test case"""
    try:
        org_id, project_id = await ensure_default_org_project()
        data = await request.json()
        # SEC-JSON-001: Validate all JSON fields before processing
        data = _validate_json_fields(data)
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
                    # Auto-create initial version snapshot
                    try:
                        from app.services.core.version_control_service import version_service
                        await version_service.create_version(
                            test_case_id=pg_case_id,
                            snapshot=db_data,
                            changed_by=DEFAULT_USER_ID,
                            change_type="created",
                            metadata={"source": "api"}
                        )
                    except Exception as ver_err:
                        logger.warning(f"Version creation failed (non-blocking): {ver_err}")
                    return {"id": pg_case_id}
            except Exception as pg_error:
                logger.warning(f"PostgreSQL insert failed, using in-memory: {pg_error}")
        
        # Fallback to in-memory storage
        _test_cases_store[case_id] = case_data
        logger.info(f"Successfully created test case in memory: {case_id}")
        return {"id": case_id}
        
    except Exception as e:
        logger.error(f"Error in create_test_case: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error while creating test case")


@router.put("/{case_id}")
async def update_test_case(case_id: str, request: Request):
    """Update a test case"""
    try:
        data = await request.json()
        # SEC-JSON-001: Validate all JSON fields before processing
        data = _validate_json_fields(data)
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
                                # Auto-create version snapshot on update
                                try:
                                    from app.services.core.version_control_service import version_service
                                    snapshot = {
                                        "title": data.get("name", ""),
                                        "description": data.get("description", ""),
                                        "priority": priority,
                                        "test_type": data.get("testType", "manual"),
                                        "tags": data.get("tags", []),
                                        "steps": data.get("steps", []),
                                        "preconditions": data.get("preconditions", []),
                                        "test_data": data.get("testData", {}),
                                        "estimated_time": data.get("estimatedTime", 15)
                                    }
                                    await version_service.create_version(
                                        test_case_id=case_id,
                                        snapshot=snapshot,
                                        changed_by=DEFAULT_USER_ID,
                                        change_type="modified",
                                        metadata={"source": "api"}
                                    )
                                except Exception as ver_err:
                                    logger.warning(f"Version creation on update failed (non-blocking): {ver_err}")
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
        raise HTTPException(status_code=500, detail="Internal server error while updating test case")


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
        raise HTTPException(status_code=500, detail="Internal server error while deleting test case")


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
        raise HTTPException(status_code=500, detail="Internal server error while linking test case to requirement")


# ─── Version Control Endpoints ───────────────────────────────────────────────

@router.get("/{case_id}/versions")
async def get_test_case_versions(
    case_id: str,
    limit: int = 50,
    offset: int = 0
):
    """Get version history for a test case (newest first)"""
    try:
        from app.services.core.version_control_service import version_service
        versions = await version_service.get_versions(case_id, limit=limit, offset=offset)
        total = await version_service.get_version_count(case_id)
        return {
            "test_case_id": case_id,
            "versions": versions,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Error getting versions for {case_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving version history")


@router.get("/{case_id}/versions/{version_id}")
async def get_test_case_version_snapshot(case_id: str, version_id: str):
    """Get full snapshot for a specific version"""
    try:
        from app.services.core.version_control_service import version_service
        snapshot = await version_service.get_version_snapshot(version_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Version not found")
        return snapshot
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting version snapshot: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while retrieving version snapshot")


@router.post("/{case_id}/versions/compare")
async def compare_test_case_versions(case_id: str, request: Request):
    """Compare two versions of a test case"""
    try:
        data = await request.json()
        version_a = data.get("version_a")
        version_b = data.get("version_b")

        if not version_a or not version_b:
            raise HTTPException(status_code=400, detail="version_a and version_b are required")

        from app.services.core.version_control_service import version_service
        diff = await version_service.compare_versions(version_a, version_b)
        if not diff:
            raise HTTPException(status_code=404, detail="One or both versions not found")
        return diff
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while comparing versions")


@router.post("/{case_id}/versions/{version_id}/revert")
async def revert_test_case_to_version(case_id: str, version_id: str, request: Request):
    """Revert a test case to a previous version. Creates a new version (non-destructive)."""
    try:
        data = await request.json() if request.headers.get("content-type") == "application/json" else {}
        reverted_by = data.get("user_id", "system")

        from app.services.core.version_control_service import version_service
        result = await version_service.revert_to_version(case_id, version_id, reverted_by)

        if not result:
            raise HTTPException(status_code=404, detail="Version not found or revert failed")

        # Also update the actual test case in the database with the restored snapshot
        snapshot = result["snapshot"]
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                UPDATE test_cases
                                SET title = %s, description = %s, priority = %s, test_type = %s,
                                    tags = %s, steps = %s, preconditions = %s, test_data = %s,
                                    estimated_time = %s, updated_at = NOW()
                                WHERE id = %s
                                """,
                                (
                                    snapshot.get("title", ""),
                                    snapshot.get("description", ""),
                                    snapshot.get("priority", "P2"),
                                    snapshot.get("test_type", "manual"),
                                    snapshot.get("tags", []),
                                    json.dumps(snapshot.get("steps", [])),
                                    snapshot.get("preconditions", []),
                                    json.dumps(snapshot.get("test_data", {})),
                                    snapshot.get("estimated_time", 15),
                                    case_id
                                )
                            )
                            conn.commit()
                    finally:
                        pool.putconn(conn)
            except Exception as pg_error:
                logger.warning(f"PostgreSQL revert update failed: {pg_error}")

        return {
            "status": "reverted",
            "test_case_id": case_id,
            "restored_from_version": result["restored_from_version"],
            "new_version_id": result["new_version_id"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reverting test case: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while reverting test case")
