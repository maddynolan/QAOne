"""
Direct PostgreSQL connection service (alternative to Supabase)
Uses psycopg2 for direct database connections
"""

import os
import logging
from typing import Optional, Dict, Any
import json

logger = logging.getLogger(__name__)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import ThreadedConnectionPool
    
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    logger.warning("psycopg2 not installed. Install with: pip install psycopg2-binary")

# Connection pool (will be initialized)
_pool: Optional[ThreadedConnectionPool] = None


def get_postgres_connection_string() -> Optional[str]:
    """Get PostgreSQL connection string from environment"""
    # Check for DATABASE_URL first
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    
    # Build from individual components
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "qaai")
    user = os.getenv("POSTGRES_USER", "qaai")
    password = os.getenv("POSTGRES_PASSWORD", "qaai123")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def get_postgres_pool() -> Optional[ThreadedConnectionPool]:
    """Get or create PostgreSQL connection pool"""
    global _pool
    
    if not PSYCOPG2_AVAILABLE:
        return None
    
    if _pool is None:
        conn_string = get_postgres_connection_string()
        if not conn_string:
            logger.warning("No PostgreSQL connection string configured")
            return None
        
        try:
            # Parse connection string
            if conn_string.startswith("postgresql://"):
                from urllib.parse import urlparse
                parsed = urlparse(conn_string)
                
                _pool = ThreadedConnectionPool(
                    minconn=1,
                    maxconn=5,
                    host=parsed.hostname,
                    port=parsed.port or 5432,
                    database=parsed.path[1:] if parsed.path else "qaai",
                    user=parsed.username,
                    password=parsed.password
                )
            else:
                # Direct connection string format
                _pool = ThreadedConnectionPool(
                    minconn=1,
                    maxconn=5,
                    dsn=conn_string
                )
            
            logger.info("PostgreSQL connection pool created")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL connection pool: {str(e)}")
            return None
    
    return _pool


async def execute_query(query: str, params: Optional[tuple] = None) -> Optional[list]:
    """Execute a SELECT query and return results"""
    pool = get_postgres_pool()
    if not pool:
        return None
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                results = cur.fetchall()
                return [dict(row) for row in results]
        finally:
            pool.putconn(conn)
    except Exception as e:
        logger.error(f"Query execution error: {str(e)}")
        return None


async def execute_insert(table: str, data: Dict[str, Any]) -> Optional[str]:
    """Execute an INSERT and return the ID"""
    pool = get_postgres_pool()
    if not pool:
        return None
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                columns = list(data.keys())
                placeholders = ["%s"] * len(columns)
                values = [data[col] for col in columns]
                
                query = f"""
                    INSERT INTO {table} ({", ".join(columns)})
                    VALUES ({", ".join(placeholders)})
                    RETURNING id
                """
                
                cur.execute(query, values)
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    return str(result[0])
                return None
        finally:
            pool.putconn(conn)
    except Exception as e:
        logger.error(f"Insert error: {str(e)}")
        return None


async def test_connection() -> bool:
    """Test PostgreSQL connection"""
    pool = get_postgres_pool()
    if not pool:
        return False
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                result = cur.fetchone()
                logger.info(f"PostgreSQL connection successful: {result[0]}")
                return True
        finally:
            pool.putconn(conn)
    except Exception as e:
        logger.error(f"Connection test failed: {str(e)}")
        return False

