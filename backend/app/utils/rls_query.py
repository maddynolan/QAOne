"""
RLS Query Utilities
Helper functions to enforce Row-Level Security in database queries.
Automatically adds tenant_id and user_id filters to ensure data isolation.
"""

import logging
from typing import Optional, List, Dict, Any, Tuple
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


def with_rls(
    query: str,
    tenant_id: Optional[str] = None,
    user_id: Optional[str] = None,
    table_alias: str = ""
) -> Tuple[str, List[Any]]:
    """
    Add RLS filters to a SQL query.
    
    Args:
        query: Base SQL query
        tenant_id: Tenant ID to filter by
        user_id: User ID to filter by (for user-specific data)
        table_alias: Table alias if using JOINs (e.g., "tc" for test_cases tc)
    
    Returns:
        Tuple of (modified_query, params_list)
    
    Example:
        query, params = with_rls(
            "SELECT * FROM test_cases WHERE status = %s",
            tenant_id="tenant-123",
            params=["active"]
        )
    """
    if not tenant_id and not user_id:
        logger.warning("with_rls called without tenant_id or user_id - RLS not enforced!")
        return query, []
    
    # Determine table name from query
    table_name = _extract_table_name(query, table_alias)
    if not table_name:
        logger.warning(f"Could not determine table name from query: {query[:100]}")
        return query, []
    
    # Build WHERE clause additions
    where_additions = []
    params = []
    
    # Add tenant_id filter if table has tenant_id column
    if tenant_id and _table_has_column(table_name, "tenant_id"):
        prefix = f"{table_alias}." if table_alias else ""
        where_additions.append(f"{prefix}tenant_id = %s")
        params.append(tenant_id)
    
    # Add org_id filter if table has org_id column (alternative to tenant_id)
    if tenant_id and _table_has_column(table_name, "org_id"):
        prefix = f"{table_alias}." if table_alias else ""
        # If tenant_id filter already added, use OR
        if not where_additions:
            where_additions.append(f"{prefix}org_id = %s")
            params.append(tenant_id)
        else:
            # Add OR condition for org_id
            where_additions[-1] = f"({where_additions[-1]} OR {prefix}org_id = %s)"
            params.append(tenant_id)
    
    # Add project_id filter via org_id lookup if needed
    if tenant_id and _table_has_column(table_name, "project_id"):
        prefix = f"{table_alias}." if table_alias else ""
        # This requires a subquery or JOIN - simplified for now
        # Full implementation would JOIN with projects table
        pass
    
    # Add user_id filter for user-specific data
    if user_id and _table_has_column(table_name, "user_id"):
        prefix = f"{table_alias}." if table_alias else ""
        where_additions.append(f"{prefix}user_id = %s")
        params.append(user_id)
    
    # Add WHERE or AND clause
    if where_additions:
        if "WHERE" in query.upper():
            # Add to existing WHERE clause
            query += " AND " + " AND ".join(where_additions)
        else:
            # Add new WHERE clause
            query += " WHERE " + " AND ".join(where_additions)
    
    return query, params


def enforce_rls_on_select(
    query: str,
    tenant_id: Optional[str],
    user_id: Optional[str] = None,
    params: Optional[List] = None
) -> Tuple[str, List[Any]]:
    """
    Enforce RLS on SELECT queries.
    Automatically adds tenant_id/user_id filters.
    """
    if not tenant_id:
        logger.warning("enforce_rls_on_select called without tenant_id")
        return query, params or []
    
    return with_rls(query, tenant_id=tenant_id, user_id=user_id, params=params or [])


def enforce_rls_on_insert(
    table_name: str,
    data: Dict[str, Any],
    tenant_id: Optional[str],
    user_id: Optional[str] = None
) -> Tuple[str, List[Any], Dict[str, Any]]:
    """
    Enforce RLS on INSERT queries.
    Automatically adds tenant_id/user_id to data.
    """
    if not tenant_id:
        logger.warning("enforce_rls_on_insert called without tenant_id")
        return table_name, [], data
    
    # Add tenant_id if column exists
    if _table_has_column(table_name, "tenant_id") and "tenant_id" not in data:
        data["tenant_id"] = tenant_id
    
    # Add org_id if column exists and tenant_id not present
    if _table_has_column(table_name, "org_id") and "org_id" not in data and "tenant_id" not in data:
        # Try to convert tenant_id to org_id if it's a UUID
        data["org_id"] = tenant_id
    
    # Add user_id if column exists
    if user_id and _table_has_column(table_name, "user_id") and "user_id" not in data:
        data["user_id"] = user_id
    
    return table_name, [], data


def enforce_rls_on_update(
    query: str,
    tenant_id: Optional[str],
    user_id: Optional[str] = None,
    params: Optional[List] = None
) -> Tuple[str, List[Any]]:
    """
    Enforce RLS on UPDATE queries.
    Adds tenant_id/user_id to WHERE clause.
    """
    if not tenant_id:
        logger.warning("enforce_rls_on_update called without tenant_id")
        return query, params or []
    
    return with_rls(query, tenant_id=tenant_id, user_id=user_id, params=params or [])


def enforce_rls_on_delete(
    query: str,
    tenant_id: Optional[str],
    user_id: Optional[str] = None,
    params: Optional[List] = None
) -> Tuple[str, List[Any]]:
    """
    Enforce RLS on DELETE queries.
    Adds tenant_id/user_id to WHERE clause.
    """
    if not tenant_id:
        logger.warning("enforce_rls_on_delete called without tenant_id")
        return query, params or []
    
    return with_rls(query, tenant_id=tenant_id, user_id=user_id, params=params or [])


def _extract_table_name(query: str, table_alias: str = "") -> Optional[str]:
    """Extract table name from SQL query"""
    query_upper = query.upper()
    
    # Common patterns
    if "FROM" in query_upper:
        # Extract table after FROM
        from_idx = query_upper.index("FROM")
        after_from = query[from_idx + 4:].strip()
        # Get first word (table name or alias)
        table_part = after_from.split()[0] if after_from.split() else None
        if table_part:
            # Remove quotes
            return table_part.strip('"\'`')
    
    # If table_alias provided, try to find it in query
    if table_alias:
        # Look for pattern like "table_name alias" or "table_name AS alias"
        import re
        pattern = rf'\b(\w+)\s+(?:AS\s+)?{table_alias}\b'
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            return match.group(1)
    
    return None


def _table_has_column(table_name: str, column_name: str) -> bool:
    """
    Check if table has a column.
    This is a simplified check - in production, query information_schema.
    """
    # Common tables and their columns (can be expanded)
    table_columns = {
        "test_cases": ["tenant_id", "org_id", "project_id", "user_id"],
        "test_runs": ["tenant_id", "org_id", "project_id", "user_id"],
        "test_plans": ["tenant_id", "org_id", "project_id"],
        "requirements": ["tenant_id", "org_id", "project_id"],
        "defects": ["tenant_id", "org_id", "project_id", "user_id"],
        "ai_generations": ["tenant_id", "project_id"],
        "ai_templates": ["tenant_id"],
        "organizations": ["id"],  # org_id is the primary key
        "projects": ["org_id"],
        "audit_logs": ["tenant_id", "user_id"],
    }
    
    columns = table_columns.get(table_name.lower(), [])
    return column_name.lower() in columns


def validate_tenant_access(
    tenant_id: str,
    resource_tenant_id: Optional[str],
    resource_org_id: Optional[str] = None
) -> bool:
    """
    Validate that the requesting tenant has access to a resource.
    
    Args:
        tenant_id: Tenant ID from request
        resource_tenant_id: Tenant ID of the resource
        resource_org_id: Org ID of the resource (alternative)
    
    Returns:
        True if access allowed, False otherwise
    """
    if not tenant_id:
        return False
    
    # Direct tenant match
    if resource_tenant_id and resource_tenant_id == tenant_id:
        return True
    
    # Org ID match (tenant_id might be org_id)
    if resource_org_id and resource_org_id == tenant_id:
        return True
    
    # If resource has no tenant_id, deny access (shouldn't happen with RLS)
    if not resource_tenant_id and not resource_org_id:
        logger.warning("Resource has no tenant_id or org_id - denying access")
        return False
    
    return False

