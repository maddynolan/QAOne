"""
Tenant-Scoped Query Wrapper
Provides helper functions that automatically inject tenant_id/project_id WHERE clauses
into SQL queries for application-level multi-tenant data isolation.

Since we use psycopg2 (which bypasses PostgreSQL RLS), this wrapper ensures that
every query is scoped to the correct tenant/project at the application layer.

Usage:
    from app.services.storage.tenant_query_wrapper import TenantQueryWrapper

    wrapper = TenantQueryWrapper(pool)

    # Execute query scoped to a project
    rows = await wrapper.execute_project_query(
        "SELECT * FROM test_cases WHERE status = %s ORDER BY created_at DESC",
        ("active",),
        project_id="uuid-here"
    )

    # Execute query scoped to a tenant/org
    rows = await wrapper.execute_tenant_query(
        "SELECT * FROM defects ORDER BY created_at DESC",
        (),
        tenant_id="uuid-here"
    )
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class TenantQueryWrapper:
    """
    Wraps database queries with automatic tenant/project scoping.
    All queries go through this wrapper to enforce data isolation.
    """

    def __init__(self, pool=None):
        self._pool = pool

    def _get_pool(self):
        """Get connection pool, lazy-loading if needed."""
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    def execute_tenant_query(
        self,
        query: str,
        params: tuple = (),
        tenant_id: Optional[str] = None,
        tenant_column: str = "org_id",
        fetch_one: bool = False,
    ) -> Any:
        """
        Execute a SELECT query scoped to a tenant (organization).

        Automatically adds WHERE {tenant_column} = %s to the query.
        If the query already contains a WHERE clause, adds AND instead.

        Args:
            query: SQL query string (SELECT only)
            params: Query parameters (tuple)
            tenant_id: Tenant/organization ID to scope to
            tenant_column: Column name for tenant ID (default: org_id)
            fetch_one: If True, return single row; else return all rows

        Returns:
            Query results (list of tuples or single tuple)
        """
        if not tenant_id:
            logger.warning("execute_tenant_query called without tenant_id — returning empty")
            return None if fetch_one else []

        scoped_query, scoped_params = self._inject_scope(
            query, params, tenant_id, tenant_column
        )

        return self._execute(scoped_query, scoped_params, fetch_one)

    def execute_project_query(
        self,
        query: str,
        params: tuple = (),
        project_id: Optional[str] = None,
        project_column: str = "project_id",
        fetch_one: bool = False,
    ) -> Any:
        """
        Execute a SELECT query scoped to a project.

        Args:
            query: SQL query string
            params: Query parameters
            project_id: Project ID to scope to
            project_column: Column name for project ID (default: project_id)
            fetch_one: If True, return single row

        Returns:
            Query results
        """
        if not project_id:
            logger.warning("execute_project_query called without project_id — returning empty")
            return None if fetch_one else []

        scoped_query, scoped_params = self._inject_scope(
            query, params, project_id, project_column
        )

        return self._execute(scoped_query, scoped_params, fetch_one)

    def execute_scoped_query(
        self,
        query: str,
        params: tuple = (),
        tenant_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_column: str = "org_id",
        project_column: str = "project_id",
        fetch_one: bool = False,
    ) -> Any:
        """
        Execute a query scoped to both tenant AND project.

        Args:
            query: SQL query string
            params: Query parameters
            tenant_id: Organization ID
            project_id: Project ID
            fetch_one: If True, return single row
        """
        scoped_query = query
        scoped_params = list(params)

        if tenant_id:
            scoped_query, scoped_params_tuple = self._inject_scope(
                scoped_query, tuple(scoped_params), tenant_id, tenant_column
            )
            scoped_params = list(scoped_params_tuple)

        if project_id:
            scoped_query, scoped_params_tuple = self._inject_scope(
                scoped_query, tuple(scoped_params), project_id, project_column
            )
            scoped_params = list(scoped_params_tuple)

        return self._execute(scoped_query, tuple(scoped_params), fetch_one)

    def execute_insert(
        self,
        table: str,
        data: Dict[str, Any],
        tenant_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_column: str = "org_id",
        project_column: str = "project_id",
        returning: str = "id",
    ) -> Optional[Any]:
        """
        Execute an INSERT with automatic tenant/project injection.

        Args:
            table: Table name
            data: Column-value dict to insert
            tenant_id: Automatically added to data
            project_id: Automatically added to data
            returning: RETURNING clause column

        Returns:
            Value of RETURNING column, or None
        """
        # Inject scope columns
        if tenant_id:
            data[tenant_column] = tenant_id
        if project_id:
            data[project_column] = project_id

        columns = list(data.keys())
        placeholders = ["%s"] * len(columns)
        values = [data[col] for col in columns]

        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            RETURNING {returning}
        """

        pool = self._get_pool()
        if not pool:
            logger.error("No database pool available for insert")
            return None

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, tuple(values))
                row = cur.fetchone()
                conn.commit()
                return row[0] if row else None
        except Exception as e:
            conn.rollback()
            logger.error(f"Tenant insert error: {e}")
            raise
        finally:
            pool.putconn(conn)

    def execute_update(
        self,
        table: str,
        data: Dict[str, Any],
        where_id: str,
        id_column: str = "id",
        tenant_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_column: str = "org_id",
        project_column: str = "project_id",
    ) -> bool:
        """
        Execute an UPDATE scoped to tenant/project.

        Args:
            table: Table name
            data: Column-value dict to update
            where_id: ID of the row to update
            id_column: Primary key column name
            tenant_id: Added to WHERE clause for isolation
            project_id: Added to WHERE clause for isolation

        Returns:
            True if row was updated
        """
        set_parts = [f"{col} = %s" for col in data.keys()]
        values = list(data.values())

        where_parts = [f"{id_column} = %s"]
        values.append(where_id)

        if tenant_id:
            where_parts.append(f"{tenant_column} = %s")
            values.append(tenant_id)

        if project_id:
            where_parts.append(f"{project_column} = %s")
            values.append(project_id)

        query = f"""
            UPDATE {table}
            SET {', '.join(set_parts)}
            WHERE {' AND '.join(where_parts)}
        """

        pool = self._get_pool()
        if not pool:
            return False

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, tuple(values))
                updated = cur.rowcount > 0
                conn.commit()
                return updated
        except Exception as e:
            conn.rollback()
            logger.error(f"Tenant update error: {e}")
            raise
        finally:
            pool.putconn(conn)

    def execute_delete(
        self,
        table: str,
        where_id: str,
        id_column: str = "id",
        tenant_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_column: str = "org_id",
        project_column: str = "project_id",
    ) -> bool:
        """
        Execute a DELETE scoped to tenant/project.
        The tenant/project conditions prevent cross-tenant deletion.
        """
        where_parts = [f"{id_column} = %s"]
        values = [where_id]

        if tenant_id:
            where_parts.append(f"{tenant_column} = %s")
            values.append(tenant_id)

        if project_id:
            where_parts.append(f"{project_column} = %s")
            values.append(project_id)

        query = f"DELETE FROM {table} WHERE {' AND '.join(where_parts)}"

        pool = self._get_pool()
        if not pool:
            return False

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, tuple(values))
                deleted = cur.rowcount > 0
                conn.commit()
                return deleted
        except Exception as e:
            conn.rollback()
            logger.error(f"Tenant delete error: {e}")
            raise
        finally:
            pool.putconn(conn)

    # ==================== Internal Helpers ====================

    def _inject_scope(
        self,
        query: str,
        params: tuple,
        scope_id: str,
        scope_column: str,
    ) -> Tuple[str, tuple]:
        """
        Inject a scope condition (WHERE/AND) into a query.
        Handles queries with and without existing WHERE clauses.
        """
        query_upper = query.upper().strip()

        # Find insertion point
        # Look for WHERE clause — add AND if exists, otherwise add WHERE
        if " WHERE " in query_upper:
            # Insert scope condition after WHERE
            where_idx = query.upper().index(" WHERE ") + len(" WHERE ")
            scoped_query = (
                query[:where_idx] +
                f"{scope_column} = %s AND " +
                query[where_idx:]
            )
        else:
            # Find position before ORDER BY, GROUP BY, LIMIT, etc.
            insert_before = len(query)
            for keyword in [" ORDER BY", " GROUP BY", " HAVING", " LIMIT", " OFFSET", " FOR UPDATE"]:
                idx = query_upper.find(keyword)
                if idx != -1 and idx < insert_before:
                    insert_before = idx

            scoped_query = (
                query[:insert_before] +
                f" WHERE {scope_column} = %s" +
                query[insert_before:]
            )

        scoped_params = (scope_id,) + params if " WHERE " not in query_upper else params[:0] + (scope_id,) + params

        # For WHERE injection (AND prefix), scope_id goes first in the WHERE
        if " WHERE " in query_upper:
            scoped_params = params[:0] + (scope_id,) + params
        else:
            scoped_params = params + (scope_id,)

        return scoped_query, scoped_params

    def _execute(self, query: str, params: tuple, fetch_one: bool = False) -> Any:
        """Execute a query and return results."""
        pool = self._get_pool()
        if not pool:
            logger.error("No database pool available")
            return None if fetch_one else []

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                if fetch_one:
                    return cur.fetchone()
                return cur.fetchall()
        except Exception as e:
            logger.error(f"Tenant query error: {e}")
            raise
        finally:
            pool.putconn(conn)


# Global instance (lazy-loaded pool)
tenant_query_wrapper = TenantQueryWrapper()
