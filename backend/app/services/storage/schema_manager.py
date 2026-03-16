"""
Schema Manager — Per-Tenant Schema Isolation

Manages separate PostgreSQL schemas for tenants that require data isolation.
Supports three modes:
  - shared: All tenants share the public schema (default)
  - isolated: Tenant gets its own schema with full table set
  - hybrid: Hot data in shared, cold data in isolated

Usage:
    from app.services.storage.schema_manager import schema_manager

    # Create isolated schema for a tenant
    await schema_manager.create_tenant_schema(org_id)

    # Get connection with correct search_path
    conn = await schema_manager.get_connection_for_tenant(org_id)

    # Migrate shared → isolated
    await schema_manager.migrate_shared_to_isolated(org_id, performed_by=admin_id)
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Tables to replicate in isolated schemas
TENANT_TABLES = [
    "test_cases", "test_plans", "test_runs", "test_run_results",
    "api_collections", "api_requests", "api_folders", "api_environments",
    "defects", "requirements",
    "mobile_flows", "mobile_folders", "mobile_test_runs",
    "artifact_versions", "artifact_branches",
    "artifact_locks", "artifact_lock_history",
    "service_accounts", "service_account_activity",
]


class SchemaManager:
    """Manages per-tenant PostgreSQL schema isolation."""

    def __init__(self):
        self._pool = None
        # In-memory cache of schema modes
        self._schema_cache: Dict[str, str] = {}  # org_id -> schema_name

    def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    def _schema_name(self, org_id: str) -> str:
        """Generate schema name from org_id."""
        # Use first 8 chars of UUID for readability
        safe_id = org_id.replace("-", "")[:12]
        return f"tenant_{safe_id}"

    # ==================== Create Schema ====================

    async def create_tenant_schema(
        self,
        org_id: str,
        performed_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create an isolated PostgreSQL schema for a tenant.
        Replicates table structures from public schema.
        """
        schema_name = self._schema_name(org_id)
        pool = self._get_pool()
        if not pool:
            return {"success": False, "message": "Database not available"}

        start = time.time()
        tables_created = 0

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Create schema
                cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")

                # Replicate table structures from public schema
                for table in TENANT_TABLES:
                    try:
                        cur.execute(
                            f"""CREATE TABLE IF NOT EXISTS {schema_name}.{table}
                                (LIKE public.{table} INCLUDING ALL)"""
                        )
                        tables_created += 1
                    except Exception as e:
                        logger.warning(f"Could not create {schema_name}.{table}: {e}")
                        conn.rollback()
                        # Re-enter transaction for next table
                        continue

                # Update org record
                cur.execute(
                    """UPDATE organizations
                       SET schema_mode = 'isolated', isolated_schema_name = %s,
                           schema_migrated_at = NOW()
                       WHERE id = %s""",
                    (schema_name, org_id),
                )

                # Log the operation
                duration_ms = int((time.time() - start) * 1000)
                cur.execute(
                    """INSERT INTO schema_isolation_log
                       (org_id, action, schema_name, tables_migrated, duration_ms, performed_by)
                       VALUES (%s, 'created', %s, %s, %s, %s)""",
                    (org_id, schema_name, tables_created, duration_ms, performed_by),
                )

                conn.commit()

            self._schema_cache[org_id] = schema_name

            return {
                "success": True,
                "schema_name": schema_name,
                "tables_created": tables_created,
                "duration_ms": int((time.time() - start) * 1000),
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Create schema error: {e}")
            return {"success": False, "message": str(e)}
        finally:
            pool.putconn(conn)

    # ==================== Get Connection ====================

    async def get_connection_for_tenant(self, org_id: str):
        """
        Get a database connection with the correct search_path for a tenant.
        If tenant uses shared schema, returns normal connection.
        If tenant uses isolated schema, sets search_path.
        """
        pool = self._get_pool()
        if not pool:
            return None

        schema_name = await self._resolve_schema(org_id)
        conn = pool.getconn()

        if schema_name and schema_name != "public":
            with conn.cursor() as cur:
                cur.execute(f"SET search_path TO {schema_name}, public")

        return conn

    async def return_connection(self, conn):
        """Return a connection to the pool, resetting search_path."""
        pool = self._get_pool()
        if pool and conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("SET search_path TO public")
                conn.commit()
            except Exception:
                pass
            pool.putconn(conn)

    async def _resolve_schema(self, org_id: str) -> Optional[str]:
        """Resolve schema name for a tenant (with cache)."""
        if org_id in self._schema_cache:
            return self._schema_cache[org_id]

        pool = self._get_pool()
        if not pool:
            return None

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT schema_mode, isolated_schema_name FROM organizations WHERE id = %s",
                    (org_id,),
                )
                row = cur.fetchone()
                if row and row[0] == "isolated" and row[1]:
                    self._schema_cache[org_id] = row[1]
                    return row[1]
        except Exception as e:
            logger.error(f"Resolve schema error: {e}")
        finally:
            pool.putconn(conn)

        return None

    # ==================== Migrate Shared → Isolated ====================

    async def migrate_shared_to_isolated(
        self,
        org_id: str,
        performed_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Migrate a tenant's data from shared schema to isolated schema.
        This is a one-time operation. Data is COPIED, not moved.
        """
        # First ensure the schema exists
        create_result = await self.create_tenant_schema(org_id, performed_by)
        if not create_result.get("success"):
            return create_result

        schema_name = create_result["schema_name"]
        pool = self._get_pool()
        if not pool:
            return {"success": False, "message": "Database not available"}

        start = time.time()
        total_rows = 0

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                for table in TENANT_TABLES:
                    try:
                        # Check if table has org_id or project_id column
                        cur.execute(
                            """SELECT column_name FROM information_schema.columns
                               WHERE table_schema = 'public' AND table_name = %s
                               AND column_name IN ('org_id', 'project_id')""",
                            (table,),
                        )
                        filter_cols = [r[0] for r in cur.fetchall()]

                        if "org_id" in filter_cols:
                            cur.execute(
                                f"""INSERT INTO {schema_name}.{table}
                                    SELECT * FROM public.{table} WHERE org_id = %s
                                    ON CONFLICT DO NOTHING""",
                                (org_id,),
                            )
                        elif "project_id" in filter_cols:
                            # Get project IDs for this org
                            cur.execute(
                                "SELECT id FROM projects WHERE org_id = %s",
                                (org_id,),
                            )
                            project_ids = [r[0] for r in cur.fetchall()]
                            if project_ids:
                                placeholders = ",".join(["%s"] * len(project_ids))
                                cur.execute(
                                    f"""INSERT INTO {schema_name}.{table}
                                        SELECT * FROM public.{table}
                                        WHERE project_id IN ({placeholders})
                                        ON CONFLICT DO NOTHING""",
                                    project_ids,
                                )
                        else:
                            continue

                        total_rows += cur.rowcount
                    except Exception as e:
                        logger.warning(f"Migrate table {table} error: {e}")
                        conn.rollback()
                        continue

                # Log migration
                duration_ms = int((time.time() - start) * 1000)
                cur.execute(
                    """INSERT INTO schema_isolation_log
                       (org_id, action, schema_name, tables_migrated, rows_migrated,
                        duration_ms, performed_by)
                       VALUES (%s, 'migrated', %s, %s, %s, %s, %s)""",
                    (org_id, schema_name, len(TENANT_TABLES), total_rows,
                     duration_ms, performed_by),
                )

                conn.commit()

            return {
                "success": True,
                "schema_name": schema_name,
                "rows_migrated": total_rows,
                "duration_ms": int((time.time() - start) * 1000),
            }

        except Exception as e:
            conn.rollback()
            logger.error(f"Migration error: {e}")
            return {"success": False, "message": str(e)}
        finally:
            pool.putconn(conn)

    # ==================== Get Isolation Status ====================

    async def get_isolation_status(self, org_id: str) -> Dict[str, Any]:
        """Get schema isolation status for an org."""
        pool = self._get_pool()
        if not pool:
            return {"mode": "shared", "schema_name": None}

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT schema_mode, isolated_schema_name, schema_migrated_at
                       FROM organizations WHERE id = %s""",
                    (org_id,),
                )
                row = cur.fetchone()
                if row:
                    return {
                        "mode": row[0] or "shared",
                        "schema_name": row[1],
                        "migrated_at": row[2].isoformat() if row[2] else None,
                    }
        except Exception as e:
            logger.error(f"Get isolation status error: {e}")
        finally:
            pool.putconn(conn)

        return {"mode": "shared", "schema_name": None}

    # ==================== List Isolation Logs ====================

    async def list_isolation_logs(self, org_id: str) -> List[Dict[str, Any]]:
        """Get schema isolation operation history."""
        pool = self._get_pool()
        if not pool:
            return []

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT action, schema_name, tables_migrated, rows_migrated,
                              duration_ms, status, created_at
                       FROM schema_isolation_log
                       WHERE org_id = %s
                       ORDER BY created_at DESC
                       LIMIT 50""",
                    (org_id,),
                )
                return [
                    {
                        "action": r[0],
                        "schema_name": r[1],
                        "tables_migrated": r[2],
                        "rows_migrated": r[3],
                        "duration_ms": r[4],
                        "status": r[5],
                        "created_at": r[6].isoformat() if r[6] else None,
                    }
                    for r in cur.fetchall()
                ]
        except Exception as e:
            logger.error(f"List isolation logs error: {e}")
            return []
        finally:
            pool.putconn(conn)


# ==================== Global Instance ====================

schema_manager = SchemaManager()
