"""
Mobile Test Flow Persistence Service

Server-side storage for mobile test flows, folders, and run history.
Previously these were localStorage-only in the browser Zustand store.

Usage:
    from app.services.mobile.flow_persistence_service import mobile_flow_service

    flow = await mobile_flow_service.save_flow(project_id, data)
    flows = await mobile_flow_service.get_flows(project_id)
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback
_flows_store: Dict[str, Dict[str, Any]] = {}
_folders_store: Dict[str, Dict[str, Any]] = {}
_runs_store: Dict[str, Dict[str, Any]] = {}


def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


class MobileFlowPersistenceService:
    """Server-side persistence for mobile test flows."""

    # ─── Flows ───────────────────────────────────────────────────────────

    async def save_flow(self, project_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create or update a mobile test flow."""
        try:
            flow_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO mobile_test_flows
                                    (id, project_id, folder_id, name, description, yaml_content,
                                     app_bundle_id, platform, tags, priority, status, created_by)
                                VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    description = EXCLUDED.description,
                                    yaml_content = EXCLUDED.yaml_content,
                                    app_bundle_id = EXCLUDED.app_bundle_id,
                                    platform = EXCLUDED.platform,
                                    tags = EXCLUDED.tags,
                                    priority = EXCLUDED.priority,
                                    status = EXCLUDED.status,
                                    folder_id = EXCLUDED.folder_id,
                                    updated_at = NOW()
                                RETURNING id
                                """,
                                (
                                    flow_id, project_id,
                                    data.get("folder_id"),
                                    data.get("name", "Untitled Flow"),
                                    data.get("description", ""),
                                    data.get("yaml_content", data.get("yaml", "")),
                                    data.get("app_bundle_id", ""),
                                    data.get("platform", "android"),
                                    data.get("tags", []),
                                    data.get("priority", "medium"),
                                    data.get("status", "draft"),
                                    data.get("created_by")
                                )
                            )
                            result = cur.fetchone()
                            conn.commit()
                            logger.info(f"Saved mobile flow {flow_id} to PostgreSQL")
                            return {"id": str(result[0]) if result else flow_id, "status": "saved"}
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"PostgreSQL save flow failed: {e}")
                    finally:
                        pool.putconn(conn)

            # In-memory fallback
            _flows_store[flow_id] = {
                "id": flow_id, "project_id": project_id,
                "name": data.get("name", "Untitled Flow"),
                "description": data.get("description", ""),
                "yaml_content": data.get("yaml_content", data.get("yaml", "")),
                "app_bundle_id": data.get("app_bundle_id", ""),
                "platform": data.get("platform", "android"),
                "tags": data.get("tags", []),
                "priority": data.get("priority", "medium"),
                "status": data.get("status", "draft"),
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            return {"id": flow_id, "status": "saved_memory"}
        except Exception as e:
            logger.error(f"Error saving flow: {e}")
            return None

    async def get_flows(self, project_id: str, platform: str = None) -> List[Dict[str, Any]]:
        """Get all mobile test flows for a project, optionally filtered by platform."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query

                if platform:
                    results = await execute_query(
                        "SELECT * FROM mobile_test_flows WHERE project_id = %s AND platform = %s ORDER BY updated_at DESC",
                        (project_id, platform)
                    )
                else:
                    results = await execute_query(
                        "SELECT * FROM mobile_test_flows WHERE project_id = %s ORDER BY updated_at DESC",
                        (project_id,)
                    )

                return [
                    {
                        "id": str(r.get("id")),
                        "name": r.get("name"),
                        "description": r.get("description", ""),
                        "yaml": r.get("yaml_content", ""),
                        "app_bundle_id": r.get("app_bundle_id", ""),
                        "platform": r.get("platform", "android"),
                        "tags": r.get("tags") or [],
                        "priority": r.get("priority", "medium"),
                        "status": r.get("status", "draft"),
                        "folder_id": str(r.get("folder_id", "")) if r.get("folder_id") else None,
                        "created_at": r.get("created_at").isoformat() if hasattr(r.get("created_at"), 'isoformat') else str(r.get("created_at", "")),
                        "updated_at": r.get("updated_at").isoformat() if hasattr(r.get("updated_at"), 'isoformat') else str(r.get("updated_at", ""))
                    }
                    for r in (results or [])
                ]

            flows = [f for f in _flows_store.values() if f.get("project_id") == project_id]
            if platform:
                flows = [f for f in flows if f.get("platform") == platform]
            return flows
        except Exception as e:
            logger.error(f"Error getting flows: {e}")
            return []

    async def delete_flow(self, flow_id: str) -> bool:
        """Delete a mobile test flow."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM mobile_test_flows WHERE id = %s RETURNING id", (flow_id,))
                            result = cur.fetchone()
                            conn.commit()
                            return result is not None
                    except Exception as e:
                        conn.rollback()
                    finally:
                        pool.putconn(conn)

            if flow_id in _flows_store:
                del _flows_store[flow_id]
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting flow: {e}")
            return False

    # ─── Folders ─────────────────────────────────────────────────────────

    async def save_folder(self, project_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Create or update a mobile test folder."""
        try:
            folder_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO mobile_test_folders (id, project_id, name, parent_folder_id, sort_order)
                                VALUES (%s, %s::uuid, %s, %s, %s)
                                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
                                RETURNING id
                                """,
                                (folder_id, project_id, data.get("name", "New Folder"), data.get("parent_folder_id"), data.get("sort_order", 0))
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else folder_id
                    except Exception as e:
                        conn.rollback()
                    finally:
                        pool.putconn(conn)

            _folders_store[folder_id] = {"id": folder_id, "project_id": project_id, **data}
            return folder_id
        except Exception as e:
            logger.error(f"Error saving folder: {e}")
            return None

    async def get_folders(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all folders for a project."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    "SELECT * FROM mobile_test_folders WHERE project_id = %s ORDER BY sort_order", (project_id,)
                )
                return [
                    {"id": str(r.get("id")), "name": r.get("name"), "parent_folder_id": str(r.get("parent_folder_id", "")) if r.get("parent_folder_id") else None, "sort_order": r.get("sort_order", 0)}
                    for r in (results or [])
                ]
            return [f for f in _folders_store.values() if f.get("project_id") == project_id]
        except Exception as e:
            logger.error(f"Error getting folders: {e}")
            return []

    # ─── Runs ────────────────────────────────────────────────────────────

    async def save_run(self, project_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Record a mobile test run."""
        try:
            run_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO mobile_test_runs
                                    (id, project_id, flow_id, flow_name, platform, device, status,
                                     duration_ms, steps_total, steps_passed, steps_failed, error_message, logs, created_by)
                                VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                RETURNING id
                                """,
                                (
                                    run_id, project_id,
                                    data.get("flow_id"), data.get("flow_name", ""),
                                    data.get("platform", "android"), data.get("device", ""),
                                    data.get("status", "running"),
                                    data.get("duration_ms"), data.get("steps_total", 0),
                                    data.get("steps_passed", 0), data.get("steps_failed", 0),
                                    data.get("error_message"), data.get("logs"),
                                    data.get("created_by")
                                )
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else run_id
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error saving run: {e}")
                    finally:
                        pool.putconn(conn)

            _runs_store[run_id] = {"id": run_id, "project_id": project_id, **data, "created_at": datetime.utcnow().isoformat()}
            return run_id
        except Exception as e:
            logger.error(f"Error saving run: {e}")
            return None

    async def get_runs(self, project_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent test runs for a project."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    "SELECT * FROM mobile_test_runs WHERE project_id = %s ORDER BY created_at DESC LIMIT %s",
                    (project_id, limit)
                )
                return [
                    {
                        "id": str(r.get("id")),
                        "flow_id": str(r.get("flow_id", "")) if r.get("flow_id") else None,
                        "flow_name": r.get("flow_name", ""),
                        "platform": r.get("platform"),
                        "device": r.get("device", ""),
                        "status": r.get("status"),
                        "duration_ms": r.get("duration_ms"),
                        "steps_total": r.get("steps_total", 0),
                        "steps_passed": r.get("steps_passed", 0),
                        "steps_failed": r.get("steps_failed", 0),
                        "error_message": r.get("error_message"),
                        "created_at": r.get("created_at").isoformat() if hasattr(r.get("created_at"), 'isoformat') else str(r.get("created_at", ""))
                    }
                    for r in (results or [])
                ]
            runs = sorted(_runs_store.values(), key=lambda r: r.get("created_at", ""), reverse=True)
            return [r for r in runs if r.get("project_id") == project_id][:limit]
        except Exception as e:
            logger.error(f"Error getting runs: {e}")
            return []

    # ─── Bulk Sync ───────────────────────────────────────────────────────

    async def sync_from_client(self, project_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Bulk sync from client localStorage to server."""
        try:
            saved = {"flows": 0, "folders": 0, "runs": 0}

            for folder in payload.get("folders", []):
                if await self.save_folder(project_id, folder):
                    saved["folders"] += 1

            for flow in payload.get("flows", []):
                if await self.save_flow(project_id, flow):
                    saved["flows"] += 1

            for run in payload.get("runs", []):
                if await self.save_run(project_id, run):
                    saved["runs"] += 1

            logger.info(f"Mobile bulk sync for project {project_id}: {saved}")
            return {"status": "synced", "saved": saved}
        except Exception as e:
            logger.error(f"Error in mobile bulk sync: {e}")
            return {"status": "error", "error": str(e)}


# Singleton instance
mobile_flow_service = MobileFlowPersistenceService()
