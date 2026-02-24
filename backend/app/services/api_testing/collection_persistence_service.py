"""
API Collection Persistence Service

Server-side storage for API test collections, folders, requests, environments, and chains.
Previously these were localStorage-only in the browser Zustand store.

This service enables:
- Team sharing of API collections across users in the same project
- Server-side backup of collections (survives browser clear)
- Cross-device sync for API test data

Usage:
    from app.services.api_testing.collection_persistence_service import collection_service

    collection = await collection_service.save_collection(project_id, data)
    collections = await collection_service.get_collections(project_id)
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback
_collections_store: Dict[str, Dict[str, Any]] = {}
_folders_store: Dict[str, Dict[str, Any]] = {}
_requests_store: Dict[str, Dict[str, Any]] = {}
_environments_store: Dict[str, Dict[str, Any]] = {}
_chains_store: Dict[str, Dict[str, Any]] = {}


def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


class CollectionPersistenceService:
    """Server-side persistence for API test collections."""

    # ─── Collections ─────────────────────────────────────────────────────

    async def save_collection(self, project_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create or update an API collection."""
        try:
            collection_id = data.get("id") or str(uuid.uuid4())
            now = datetime.utcnow().isoformat()

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO api_collections (id, project_id, name, description, base_url, auth_config, variables, settings, created_by)
                                VALUES (%s, %s::uuid, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s)
                                ON CONFLICT (id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    description = EXCLUDED.description,
                                    base_url = EXCLUDED.base_url,
                                    auth_config = EXCLUDED.auth_config,
                                    variables = EXCLUDED.variables,
                                    settings = EXCLUDED.settings,
                                    updated_at = NOW()
                                RETURNING id
                                """,
                                (
                                    collection_id,
                                    project_id,
                                    data.get("name", "Untitled Collection"),
                                    data.get("description", ""),
                                    data.get("base_url", ""),
                                    json.dumps(data.get("auth_config", {})),
                                    json.dumps(data.get("variables", {})),
                                    json.dumps(data.get("settings", {})),
                                    data.get("created_by")
                                )
                            )
                            result = cur.fetchone()
                            conn.commit()

                            # Also save folders and requests if provided
                            if data.get("folders"):
                                for folder in data["folders"]:
                                    await self.save_folder(collection_id, folder)
                            if data.get("requests"):
                                for req in data["requests"]:
                                    await self.save_request(collection_id, req)

                            logger.info(f"Saved collection {collection_id} to PostgreSQL")
                            return {"id": str(result[0]) if result else collection_id, "status": "saved"}
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"PostgreSQL save collection failed: {e}")
                    finally:
                        pool.putconn(conn)

            # In-memory fallback
            _collections_store[collection_id] = {
                "id": collection_id,
                "project_id": project_id,
                "name": data.get("name", "Untitled Collection"),
                "description": data.get("description", ""),
                "base_url": data.get("base_url", ""),
                "auth_config": data.get("auth_config", {}),
                "variables": data.get("variables", {}),
                "settings": data.get("settings", {}),
                "created_at": now,
                "updated_at": now
            }
            return {"id": collection_id, "status": "saved_memory"}
        except Exception as e:
            logger.error(f"Error saving collection: {e}")
            return None

    async def get_collections(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all collections for a project."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    """
                    SELECT id, project_id, name, description, base_url, auth_config,
                           variables, settings, created_by, created_at, updated_at
                    FROM api_collections
                    WHERE project_id = %s
                    ORDER BY updated_at DESC
                    """,
                    (project_id,)
                )
                collections = []
                for row in results or []:
                    collections.append({
                        "id": str(row.get("id", "")),
                        "project_id": str(row.get("project_id", "")),
                        "name": row.get("name", ""),
                        "description": row.get("description", ""),
                        "base_url": row.get("base_url", ""),
                        "auth_config": row.get("auth_config") or {},
                        "variables": row.get("variables") or {},
                        "settings": row.get("settings") or {},
                        "created_at": row.get("created_at").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
                        "updated_at": row.get("updated_at").isoformat() if hasattr(row.get("updated_at"), 'isoformat') else str(row.get("updated_at", ""))
                    })
                return collections

            # In-memory fallback
            return [c for c in _collections_store.values() if c.get("project_id") == project_id]
        except Exception as e:
            logger.error(f"Error getting collections: {e}")
            return []

    async def get_collection(self, collection_id: str) -> Optional[Dict[str, Any]]:
        """Get a collection with its folders and requests."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query

                # Get collection
                results = await execute_query(
                    "SELECT * FROM api_collections WHERE id = %s", (collection_id,)
                )
                if not results:
                    return None

                row = results[0]
                collection = {
                    "id": str(row.get("id", "")),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "base_url": row.get("base_url", ""),
                    "auth_config": row.get("auth_config") or {},
                    "variables": row.get("variables") or {},
                    "settings": row.get("settings") or {},
                }

                # Get folders
                folders = await execute_query(
                    "SELECT * FROM api_collection_folders WHERE collection_id = %s ORDER BY sort_order",
                    (collection_id,)
                )
                collection["folders"] = [
                    {"id": str(f.get("id")), "name": f.get("name"), "parent_folder_id": str(f.get("parent_folder_id", "")) if f.get("parent_folder_id") else None, "sort_order": f.get("sort_order", 0)}
                    for f in (folders or [])
                ]

                # Get requests
                requests = await execute_query(
                    "SELECT * FROM api_collection_requests WHERE collection_id = %s ORDER BY sort_order",
                    (collection_id,)
                )
                collection["requests"] = [
                    {
                        "id": str(r.get("id")),
                        "folder_id": str(r.get("folder_id", "")) if r.get("folder_id") else None,
                        "name": r.get("name", ""),
                        "method": r.get("method", "GET"),
                        "url": r.get("url", ""),
                        "path": r.get("path", ""),
                        "headers": r.get("headers") or [],
                        "params": r.get("params") or [],
                        "body": r.get("body", ""),
                        "body_type": r.get("body_type", "none"),
                        "auth_type": r.get("auth_type"),
                        "auth_config": r.get("auth_config") or {},
                        "assertions": r.get("assertions") or [],
                        "sort_order": r.get("sort_order", 0)
                    }
                    for r in (requests or [])
                ]

                return collection

            # In-memory fallback
            return _collections_store.get(collection_id)
        except Exception as e:
            logger.error(f"Error getting collection {collection_id}: {e}")
            return None

    async def delete_collection(self, collection_id: str) -> bool:
        """Delete a collection and all its folders/requests (CASCADE)."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM api_collections WHERE id = %s RETURNING id", (collection_id,))
                            result = cur.fetchone()
                            conn.commit()
                            return result is not None
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error deleting collection: {e}")
                    finally:
                        pool.putconn(conn)

            if collection_id in _collections_store:
                del _collections_store[collection_id]
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
            return False

    # ─── Folders ─────────────────────────────────────────────────────────

    async def save_folder(self, collection_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Create or update a folder within a collection."""
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
                                INSERT INTO api_collection_folders (id, collection_id, parent_folder_id, name, sort_order)
                                VALUES (%s, %s::uuid, %s, %s, %s)
                                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
                                RETURNING id
                                """,
                                (folder_id, collection_id, data.get("parent_folder_id"), data.get("name", "New Folder"), data.get("sort_order", 0))
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else folder_id
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error saving folder: {e}")
                    finally:
                        pool.putconn(conn)

            _folders_store[folder_id] = {"id": folder_id, "collection_id": collection_id, **data}
            return folder_id
        except Exception as e:
            logger.error(f"Error saving folder: {e}")
            return None

    # ─── Requests ────────────────────────────────────────────────────────

    async def save_request(self, collection_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Create or update a request within a collection."""
        try:
            request_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO api_collection_requests
                                    (id, collection_id, folder_id, name, method, url, path, headers, params, body, body_type, auth_type, auth_config, assertions, sort_order)
                                VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                                ON CONFLICT (id) DO UPDATE SET
                                    folder_id = EXCLUDED.folder_id,
                                    name = EXCLUDED.name,
                                    method = EXCLUDED.method,
                                    url = EXCLUDED.url,
                                    path = EXCLUDED.path,
                                    headers = EXCLUDED.headers,
                                    params = EXCLUDED.params,
                                    body = EXCLUDED.body,
                                    body_type = EXCLUDED.body_type,
                                    auth_type = EXCLUDED.auth_type,
                                    auth_config = EXCLUDED.auth_config,
                                    assertions = EXCLUDED.assertions,
                                    sort_order = EXCLUDED.sort_order,
                                    updated_at = NOW()
                                RETURNING id
                                """,
                                (
                                    request_id, collection_id,
                                    data.get("folder_id"), data.get("name", "New Request"),
                                    data.get("method", "GET"), data.get("url", ""),
                                    data.get("path", ""),
                                    json.dumps(data.get("headers", [])),
                                    json.dumps(data.get("params", [])),
                                    data.get("body", ""), data.get("body_type", "none"),
                                    data.get("auth_type"), json.dumps(data.get("auth_config", {})),
                                    json.dumps(data.get("assertions", [])),
                                    data.get("sort_order", 0)
                                )
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else request_id
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error saving request: {e}")
                    finally:
                        pool.putconn(conn)

            _requests_store[request_id] = {"id": request_id, "collection_id": collection_id, **data}
            return request_id
        except Exception as e:
            logger.error(f"Error saving request: {e}")
            return None

    async def delete_request(self, request_id: str) -> bool:
        """Delete a request."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM api_collection_requests WHERE id = %s RETURNING id", (request_id,))
                            result = cur.fetchone()
                            conn.commit()
                            return result is not None
                    except Exception as e:
                        conn.rollback()
                    finally:
                        pool.putconn(conn)

            if request_id in _requests_store:
                del _requests_store[request_id]
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting request: {e}")
            return False

    # ─── Environments ────────────────────────────────────────────────────

    async def save_environment(self, project_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Create or update an API environment."""
        try:
            env_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO api_environments (id, project_id, name, variables, is_active, created_by)
                                VALUES (%s, %s::uuid, %s, %s::jsonb, %s, %s)
                                ON CONFLICT (id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    variables = EXCLUDED.variables,
                                    is_active = EXCLUDED.is_active,
                                    updated_at = NOW()
                                RETURNING id
                                """,
                                (env_id, project_id, data.get("name", "Default"), json.dumps(data.get("variables", [])), data.get("is_active", False), data.get("created_by"))
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else env_id
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error saving environment: {e}")
                    finally:
                        pool.putconn(conn)

            _environments_store[env_id] = {"id": env_id, "project_id": project_id, **data}
            return env_id
        except Exception as e:
            logger.error(f"Error saving environment: {e}")
            return None

    async def get_environments(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all environments for a project."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    "SELECT * FROM api_environments WHERE project_id = %s ORDER BY name",
                    (project_id,)
                )
                return [
                    {
                        "id": str(r.get("id")),
                        "name": r.get("name"),
                        "variables": r.get("variables") or [],
                        "is_active": r.get("is_active", False)
                    }
                    for r in (results or [])
                ]
            return [e for e in _environments_store.values() if e.get("project_id") == project_id]
        except Exception as e:
            logger.error(f"Error getting environments: {e}")
            return []

    # ─── Chains ──────────────────────────────────────────────────────────

    async def save_chain(self, project_id: str, data: Dict[str, Any]) -> Optional[str]:
        """Create or update a request chain."""
        try:
            chain_id = data.get("id") or str(uuid.uuid4())

            if _is_postgres_available():
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO api_request_chains (id, collection_id, project_id, name, description, steps, variables, created_by)
                                VALUES (%s, %s, %s::uuid, %s, %s, %s::jsonb, %s::jsonb, %s)
                                ON CONFLICT (id) DO UPDATE SET
                                    name = EXCLUDED.name,
                                    description = EXCLUDED.description,
                                    steps = EXCLUDED.steps,
                                    variables = EXCLUDED.variables,
                                    updated_at = NOW()
                                RETURNING id
                                """,
                                (chain_id, data.get("collection_id"), project_id, data.get("name", "New Chain"), data.get("description", ""), json.dumps(data.get("steps", [])), json.dumps(data.get("variables", {})), data.get("created_by"))
                            )
                            result = cur.fetchone()
                            conn.commit()
                            return str(result[0]) if result else chain_id
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error saving chain: {e}")
                    finally:
                        pool.putconn(conn)

            _chains_store[chain_id] = {"id": chain_id, "project_id": project_id, **data}
            return chain_id
        except Exception as e:
            logger.error(f"Error saving chain: {e}")
            return None

    async def get_chains(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all chains for a project."""
        try:
            if _is_postgres_available():
                from app.services.storage.postgres_direct import execute_query
                results = await execute_query(
                    "SELECT * FROM api_request_chains WHERE project_id = %s ORDER BY updated_at DESC",
                    (project_id,)
                )
                return [
                    {
                        "id": str(r.get("id")),
                        "collection_id": str(r.get("collection_id", "")) if r.get("collection_id") else None,
                        "name": r.get("name"),
                        "description": r.get("description", ""),
                        "steps": r.get("steps") or [],
                        "variables": r.get("variables") or {}
                    }
                    for r in (results or [])
                ]
            return [c for c in _chains_store.values() if c.get("project_id") == project_id]
        except Exception as e:
            logger.error(f"Error getting chains: {e}")
            return []

    # ─── Bulk Sync ───────────────────────────────────────────────────────

    async def sync_from_client(self, project_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Bulk sync: receive full collection data from the client and persist to server.
        Used for initial migration from localStorage to server-side storage.
        """
        try:
            saved = {"collections": 0, "requests": 0, "environments": 0, "chains": 0}

            for collection in payload.get("collections", []):
                result = await self.save_collection(project_id, collection)
                if result:
                    saved["collections"] += 1
                    for req in collection.get("requests", []):
                        req_result = await self.save_request(result["id"], req)
                        if req_result:
                            saved["requests"] += 1

            for env in payload.get("environments", []):
                result = await self.save_environment(project_id, env)
                if result:
                    saved["environments"] += 1

            for chain in payload.get("chains", []):
                result = await self.save_chain(project_id, chain)
                if result:
                    saved["chains"] += 1

            logger.info(f"Bulk sync for project {project_id}: {saved}")
            return {"status": "synced", "saved": saved}
        except Exception as e:
            logger.error(f"Error in bulk sync: {e}")
            return {"status": "error", "error": str(e)}


# Singleton instance
collection_service = CollectionPersistenceService()
