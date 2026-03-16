"""
Defects CRUD API Router
Handles all defect operations
Falls back to in-memory storage when PostgreSQL is not available
"""
import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    map_priority_from_db,
    map_priority_to_db,
    DEFAULT_USER_ID
)
from app.dependencies import get_current_project, get_current_user, get_current_tenant
from app.services.core.locking_service import locking_service
from app.services.core.universal_version_service import universal_version_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/defects", tags=["defects"])

# In-memory storage fallback
_defects_store: Dict[str, Dict[str, Any]] = {}

def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available"""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False



@router.get("")
async def get_defects(project_id: Optional[str] = None):
    """Get all defects"""
    try:
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_query
                org_id, proj_id = await ensure_default_org_project()
                project_id = project_id or proj_id
                
                query = """
                    SELECT id, project_id, run_id, step_id, title, description, priority, status, 
                           assigned_to, jira_id, created_by, created_at, updated_at
                    FROM defects
                    WHERE project_id = %s
                    ORDER BY created_at DESC
                """
                results = await execute_query(query, (project_id,))
                
                defects = []
                for row in results or []:
                    priority = map_priority_from_db(row.get("priority", "P2"))
                    defects.append({
                        "id": str(row.get("id", "")),
                        "title": row.get("title", ""),
                        "description": row.get("description", ""),
                        "priority": priority,
                        "severity": priority,
                        "status": row.get("status", "open"),
                        "runId": str(row.get("run_id", "")) if row.get("run_id") else None,
                        "stepId": str(row.get("step_id", "")) if row.get("step_id") else None,
                        "assignedTo": str(row.get("assigned_to", "")) if row.get("assigned_to") else None,
                        "jiraId": row.get("jira_id"),
                        "createdAt": str(row.get("created_at", "")),
                        "updatedAt": str(row.get("updated_at", ""))
                    })
                
                return {"defects": defects}
            except Exception as pg_error:
                logger.warning(f"PostgreSQL query failed: {pg_error}")
        
        # Fallback: return from in-memory store
        return {"defects": list(_defects_store.values())}
    except Exception as e:
        logger.error(f"Error getting defects: {str(e)}")
        return {"defects": []}


@router.get("/{defect_id}")
async def get_defect(defect_id: str):
    """Get a specific defect"""
    try:
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Defect not found")
        
        query = """
            SELECT id, project_id, run_id, step_id, title, description, priority, status,
                   assigned_to, jira_id, created_by, created_at, updated_at
            FROM defects
            WHERE id = %s
        """
        results = await execute_query(query, (defect_id,))
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail="Defect not found")
        
        row = results[0]
        priority = map_priority_from_db(row.get("priority", "P2"))
        
        return {
            "id": str(row.get("id", "")),
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "priority": priority,
            "severity": priority,
            "status": row.get("status", "open"),
            "runId": str(row.get("run_id", "")) if row.get("run_id") else None,
            "stepId": str(row.get("step_id", "")) if row.get("step_id") else None,
            "assignedTo": str(row.get("assigned_to", "")) if row.get("assigned_to") else None,
            "jiraId": row.get("jira_id"),
            "createdAt": str(row.get("created_at", "")),
            "updatedAt": str(row.get("updated_at", ""))
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting defect: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve defect")


@router.post("")
async def create_defect(request: Request):
    """Create a new defect"""
    try:
        data = await request.json()
        now = datetime.now().isoformat()
        defect_id = f"def_{uuid.uuid4().hex[:8]}"
        
        # Try PostgreSQL first
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import execute_insert
                org_id, project_id = await ensure_default_org_project()
                priority = map_priority_to_db(data.get("priority", "medium"))
                
                defect_data = {
                    "project_id": project_id,
                    "title": data.get("title", ""),
                    "description": data.get("description", ""),
                    "priority": priority,
                    "status": data.get("status", "open"),
                    "run_id": data.get("runId"),
                    "step_id": data.get("stepId"),
                    "assigned_to": data.get("assignedTo"),
                    "jira_id": data.get("jiraId"),
                    "created_by": DEFAULT_USER_ID
                }
                
                pg_id = await execute_insert("defects", defect_data)
                if pg_id:
                    logger.info(f"Created defect in PostgreSQL: {pg_id}")
                    # Create version snapshot
                    try:
                        await universal_version_service.create_version(
                            artifact_type="defect",
                            artifact_id=str(pg_id),
                            snapshot=defect_data,
                            changed_by=DEFAULT_USER_ID,
                            change_type="created",
                            project_id=project_id,
                        )
                    except Exception:
                        pass  # Version creation is non-blocking
                    return {"id": pg_id}
            except Exception as pg_error:
                logger.warning(f"PostgreSQL insert failed: {pg_error}")
        
        # Fallback: save to in-memory store
        defect = {
            "id": defect_id,
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "severity": data.get("severity", data.get("priority", "medium")),
            "priority": data.get("priority", "medium"),
            "status": data.get("status", "open"),
            "category": data.get("category", "functional"),
            "stepsToReproduce": data.get("stepsToReproduce", []),
            "actualResult": data.get("actualResult", ""),
            "expectedResult": data.get("expectedResult", ""),
            "environment": data.get("environment", {}),
            "linkedTestCases": data.get("linkedTestCases", []),
            "linkedRequirements": data.get("linkedRequirements", []),
            "tags": data.get("tags", []),
            "created_at": now,
            "updated_at": now
        }
        _defects_store[defect_id] = defect
        logger.info(f"Created defect in memory: {defect_id}")
        # Create version snapshot (in-memory fallback path)
        try:
            await universal_version_service.create_version(
                artifact_type="defect",
                artifact_id=str(defect_id),
                snapshot=defect,
                changed_by=DEFAULT_USER_ID,
                change_type="created",
            )
        except Exception:
            pass  # Version creation is non-blocking
        return {"id": defect_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating defect: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create defect")


@router.put("/{defect_id}")
async def update_defect(defect_id: str, request: Request):
    """Update a defect"""
    try:
        # Check artifact lock
        user_id = getattr(request.state, "user_id", None) or "22222222-2222-2222-2222-222222222222"
        if await locking_service.is_locked_by_other("defect", str(defect_id), str(user_id)):
            raise HTTPException(status_code=409, detail="Artifact is checked out by another user")

        data = await request.json()
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Defect not found")
        
        priority = None
        if "priority" in data:
            priority = map_priority_to_db(data.get("priority", "medium"))
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_fields = []
                update_values = []
                
                if "title" in data:
                    update_fields.append("title = %s")
                    update_values.append(data.get("title"))
                
                if "description" in data:
                    update_fields.append("description = %s")
                    update_values.append(data.get("description"))
                
                if priority:
                    update_fields.append("priority = %s")
                    update_values.append(priority)
                
                if "status" in data:
                    update_fields.append("status = %s")
                    update_values.append(data.get("status"))
                
                if "assignedTo" in data:
                    update_fields.append("assigned_to = %s")
                    update_values.append(data.get("assignedTo") or None)
                
                if "jiraId" in data:
                    update_fields.append("jira_id = %s")
                    update_values.append(data.get("jiraId"))
                
                if not update_fields:
                    raise HTTPException(status_code=400, detail="No fields to update")
                
                update_fields.append("updated_at = NOW()")
                update_values.append(defect_id)
                
                update_query = f"""
                    UPDATE defects 
                    SET {", ".join(update_fields)}
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, tuple(update_values))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Defect not found")

                # Create version snapshot
                try:
                    await universal_version_service.create_version(
                        artifact_type="defect",
                        artifact_id=str(defect_id),
                        snapshot=data,
                        changed_by=user_id,
                        change_type="modified",
                        project_id=getattr(request.state, "project_id", None),
                    )
                except Exception:
                    pass  # Version creation is non-blocking

                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating defect: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update defect")


@router.delete("/{defect_id}")
async def delete_defect(defect_id: str, request: Request):
    """Delete a defect"""
    try:
        # Check artifact lock
        user_id = getattr(request.state, "user_id", None) or "22222222-2222-2222-2222-222222222222"
        if await locking_service.is_locked_by_other("defect", str(defect_id), str(user_id)):
            raise HTTPException(status_code=409, detail="Artifact is checked out by another user")

        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=404, detail="Defect not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM defects WHERE id = %s RETURNING id", (defect_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Defect not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting defect: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete defect")


