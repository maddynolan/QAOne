"""
Database connection service for PostgreSQL/Supabase
Handles connections and basic queries
Supports both direct Postgres and Supabase
"""

import os
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Try direct Postgres first (for hybrid approach)
try:
    from app.services.postgres_direct import get_postgres_pool, test_connection as test_postgres_connection
    POSTGRES_DIRECT_AVAILABLE = True
except ImportError:
    POSTGRES_DIRECT_AVAILABLE = False
    logger.warning("psycopg2 not installed. Install with: pip install psycopg2-binary")

# Fallback to Supabase if needed
try:
    from supabase import create_client, Client
    
    def get_supabase_client() -> Optional[Client]:
        """Get Supabase client if configured"""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if supabase_url and supabase_key:
            try:
                return create_client(supabase_url, supabase_key)
            except Exception as e:
                logger.error(f"Failed to create Supabase client: {str(e)}")
                return None
        return None
except ImportError:
    def get_supabase_client():
        return None


def get_database_client() -> Optional[Any]:
    """
    Get database client - prefers direct Postgres, falls back to Supabase
    Returns: Postgres pool or Supabase client or None
    """
    # Prefer direct Postgres connection (for hybrid approach)
    if POSTGRES_DIRECT_AVAILABLE:
        pool = get_postgres_pool()
        if pool:
            logger.info("Using direct PostgreSQL connection")
            return pool
    
    # Fallback to Supabase
    client = get_supabase_client()
    if client:
        logger.info("Using Supabase client")
        return client
    
    logger.warning("No database connection configured")
    return None


async def execute_migration(migration_sql: str) -> bool:
    """Execute a SQL migration"""
    try:
        client = get_database_client()
        if not client:
            logger.warning("No database client available. Skipping migration.")
            return False
        
        # Supabase doesn't support direct SQL execution via Python client
        # Migrations should be run via Supabase CLI or dashboard
        logger.info("Migrations should be run via Supabase CLI or dashboard")
        logger.info(f"Migration SQL: {migration_sql[:200]}...")
        return False  # Indicate manual execution needed
    except Exception as e:
        logger.error(f"Error executing migration: {str(e)}")
        return False


async def create_requirement(
    project_id: str,
    source: str,
    title: str,
    description: Optional[str] = None,
    source_ref: Optional[str] = None,
    raw_payload: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Create a requirement record"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        # Try direct Postgres first
        if POSTGRES_DIRECT_AVAILABLE and hasattr(client, 'getconn'):
            from app.services.postgres_direct import execute_insert
            data = {
                "project_id": project_id,
                "source": source,
                "title": title,
                "description": description,
                "source_ref": source_ref,
                "raw_payload": raw_payload
            }
            return await execute_insert("requirements", data)
        
        # Fallback to Supabase
        data = {
            "project_id": project_id,
            "source": source,
            "title": title,
            "description": description,
            "source_ref": source_ref,
            "raw_payload": raw_payload
        }
        
        result = client.table("requirements").insert(data).execute()
        if result.data:
            return result.data[0].get("id")
        return None
    except Exception as e:
        logger.error(f"Error creating requirement: {str(e)}")
        return None


async def get_requirement(requirement_id: str) -> Optional[Dict[str, Any]]:
    """Get a requirement by ID"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        result = client.table("requirements").select("*").eq("id", requirement_id).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error(f"Error getting requirement: {str(e)}")
        return None

