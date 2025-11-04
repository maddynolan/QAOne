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
        logger.error("psycopg2 not available - cannot create PostgreSQL pool")
        return None
    
    if _pool is None:
        logger.info("Creating new PostgreSQL connection pool...")
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
            
            logger.info("PostgreSQL connection pool created successfully")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL connection pool: {str(e)}", exc_info=True)
            return None
    else:
        logger.debug("Using existing PostgreSQL connection pool")
    
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
        logger.error("execute_insert: get_postgres_pool() returned None")
        raise Exception("PostgreSQL connection pool not available. Cannot execute insert.")
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Define which columns are JSONB vs arrays
                # JSONB columns: steps, test_data, settings, metadata, etc.
                jsonb_columns = {'steps', 'test_data', 'settings', 'metadata', 'raw_payload', 'preferences', 'output_jsonb', 'request_data', 'response_data'}
                # Array columns: tags, preconditions, suggested_fixes, selector_suggestions, related_cases
                array_columns = {'tags', 'preconditions', 'suggested_fixes', 'selector_suggestions', 'related_cases'}
                
                # Filter out None values and handle different data types
                filtered_data = {}
                for key, value in data.items():
                    if value is not None:
                        if key in jsonb_columns:
                            # JSONB columns - encode as JSON string
                            import json
                            filtered_data[key] = json.dumps(value)
                        elif key in array_columns:
                            # Array columns - keep as Python list, psycopg2 handles it
                            if isinstance(value, list):
                                filtered_data[key] = value
                            else:
                                # If not a list, convert to empty list or single-item list
                                filtered_data[key] = [value] if value else []
                        elif isinstance(value, (dict, list)):
                            # Default: encode other complex types as JSON
                            import json
                            filtered_data[key] = json.dumps(value)
                        else:
                            filtered_data[key] = value
                
                columns = list(filtered_data.keys())
                placeholders = ["%s"] * len(columns)
                values = [filtered_data[col] for col in columns]
                
                # For UUID fields, convert string UUIDs
                processed_values = []
                for i, col in enumerate(columns):
                    val = values[i]
                    # Try to identify UUID columns by checking if value looks like UUID
                    if isinstance(val, str) and len(val) == 36 and val.count('-') == 4:
                        # Check if this column is likely a UUID (id, project_id, org_id, etc.)
                        if '_id' in col.lower() or col.lower() == 'id' or 'uuid' in col.lower():
                            try:
                                import uuid
                                uuid.UUID(val)  # Validate it's a valid UUID
                                processed_values.append(val)  # Keep as string, PostgreSQL will cast
                            except ValueError:
                                processed_values.append(val)
                        else:
                            processed_values.append(val)
                    else:
                        processed_values.append(val)
                
                query = f"""
                    INSERT INTO {table} ({", ".join(columns)})
                    VALUES ({", ".join(placeholders)})
                    RETURNING id
                """
                
                logger.info(f"Executing INSERT into {table}: {query[:200]}... with {len(processed_values)} values")
                logger.info(f"Values: {processed_values[:5]}...")  # Log first 5 values
                cur.execute(query, tuple(processed_values))
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    inserted_id = str(result[0])
                    logger.info(f"Successfully inserted into {table} with ID: {inserted_id}")
                    return inserted_id
                logger.error(f"INSERT executed but no ID returned for {table} - this should not happen!")
                raise Exception(f"INSERT into {table} succeeded but RETURNING id returned no result")
        finally:
            pool.putconn(conn)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Insert error in {table}: {error_msg}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Re-raise so caller can handle it
        raise


async def execute_update(query: str, params: Optional[tuple] = None) -> Optional[list]:
    """Execute an UPDATE/DELETE query and return affected rows"""
    pool = get_postgres_pool()
    if not pool:
        return None
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                conn.commit()
                # For UPDATE with RETURNING, fetch results
                if "RETURNING" in query.upper():
                    results = cur.fetchall()
                    return [dict(row) for row in results]
                # Otherwise return rowcount
                return [{"rows_affected": cur.rowcount}]
        finally:
            pool.putconn(conn)
    except Exception as e:
        logger.error(f"Update execution error: {str(e)}")
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

