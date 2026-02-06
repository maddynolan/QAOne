"""
Direct PostgreSQL connection service (alternative to Supabase)
Uses psycopg2 for direct database connections

Auto-enables when DATABASE_URL is set (e.g. on Railway/Heroku).
Can also be explicitly enabled via ENABLE_POSTGRES=true.
"""

import os
import logging
from typing import Optional, Dict, Any, TYPE_CHECKING
import json

logger = logging.getLogger(__name__)

# Type hint only - doesn't require actual import at runtime
if TYPE_CHECKING:
    from psycopg2.pool import ThreadedConnectionPool

# Auto-enable PostgreSQL when DATABASE_URL is present (Railway, Heroku, etc.)
# Can also be explicitly enabled/disabled via ENABLE_POSTGRES env var.
_explicit_setting = os.getenv("ENABLE_POSTGRES", "").lower()
if _explicit_setting in ("true", "false"):
    POSTGRES_ENABLED = _explicit_setting == "true"
else:
    # Auto-detect: enable if DATABASE_URL is set
    POSTGRES_ENABLED = bool(os.getenv("DATABASE_URL"))
    if POSTGRES_ENABLED:
        logger.info("PostgreSQL auto-enabled (DATABASE_URL detected)")

# Placeholder for when psycopg2 is not available
ThreadedConnectionPool = None  # type: ignore

if POSTGRES_ENABLED:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        from psycopg2.pool import ThreadedConnectionPool
        
        PSYCOPG2_AVAILABLE = True
    except ImportError:
        PSYCOPG2_AVAILABLE = False
        logger.warning("psycopg2 not installed. Install with: pip install psycopg2-binary")
else:
    PSYCOPG2_AVAILABLE = False
    # Silently disabled - no log spam

# Connection pool (will be initialized)
_pool: Optional[Any] = None
_pool_initialized: bool = False
_db_unavailable_logged: bool = False  # Track if we've already logged database unavailable error

def reset_connection_pool():
    """Reset the connection pool - useful after schema changes"""
    global _pool, _pool_initialized, _db_unavailable_logged
    _db_unavailable_logged = False  # Reset flag when pool is reset
    if _pool:
        try:
            _pool.closeall()
            logger.info("Connection pool closed")
        except:
            pass
    _pool = None
    _pool_initialized = False
    logger.info("Connection pool reset - will be recreated on next use")


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


def get_postgres_pool() -> Optional["ThreadedConnectionPool"]:
    """Get or create PostgreSQL connection pool"""
    global _pool, _pool_initialized, _db_unavailable_logged
    
    # Silently return None if PostgreSQL is disabled
    if not POSTGRES_ENABLED or not PSYCOPG2_AVAILABLE:
        return None
    
    if _pool is None or not _pool_initialized:
        logger.info("Creating new PostgreSQL connection pool...")
        conn_string = get_postgres_connection_string()
        if not conn_string:
            error_msg = "No PostgreSQL connection string configured. Set DATABASE_URL or POSTGRES_* environment variables."
            logger.warning(error_msg)
            print(f"[WARN] POSTGRES_POOL - {error_msg}")
            return None
        
        try:
            # Parse connection string
            if conn_string.startswith("postgresql://"):
                from urllib.parse import urlparse
                parsed = urlparse(conn_string)
                
                print(f"[INFO] POSTGRES_POOL - Connecting to: {parsed.hostname}:{parsed.port or 5432}/{parsed.path[1:] if parsed.path else 'qaai'}")
                logger.info(f"Connecting to PostgreSQL: {parsed.hostname}:{parsed.port or 5432}")
                
                # Retry logic for "database system is starting up"
                max_retries = 10
                retry_delay = 2  # seconds
                last_error = None
                
                for attempt in range(max_retries):
                    try:
                        # Detect Supabase/cloud PostgreSQL that requires SSL
                        _needs_ssl = parsed.hostname and ('.supabase.' in parsed.hostname or '.neon.' in parsed.hostname or '.railway.' in parsed.hostname)
                        _pool = ThreadedConnectionPool(
                            minconn=1,
                            maxconn=5,
                            host=parsed.hostname,
                            port=parsed.port or 5432,
                            database=parsed.path[1:] if parsed.path else "qaai",
                            user=parsed.username,
                            password=parsed.password,
                            sslmode='require' if _needs_ssl else 'prefer',
                            options="-c search_path=public"  # Explicitly set search path
                        )
                        logger.info("PostgreSQL connection pool created successfully")
                        print(f"[OK] POSTGRES_POOL - Connection pool created")
                        _pool_initialized = True
                        break  # Success!
                    except Exception as e:
                        last_error = e
                        error_str = str(e).lower()
                        
                        # Check if it's a "starting up" error
                        if "database system is starting up" in error_str or "starting up" in error_str:
                            if attempt < max_retries - 1:
                                print(f"[INFO] POSTGRES_POOL - Database is starting up, waiting {retry_delay}s (attempt {attempt + 1}/{max_retries})...")
                                logger.info(f"PostgreSQL is starting up, retrying in {retry_delay}s...")
                                import time
                                time.sleep(retry_delay)
                                continue
                        # For other errors, break immediately
                        raise
                
                if not _pool_initialized:
                    raise last_error
            else:
                # Direct connection string format
                print(f"[INFO] POSTGRES_POOL - Using DSN connection string")
                _pool = ThreadedConnectionPool(
                    minconn=1,
                    maxconn=5,
                    dsn=conn_string
                )
                logger.info("PostgreSQL connection pool created successfully")
                print(f"[OK] POSTGRES_POOL - Connection pool created")
                _pool_initialized = True
        except Exception as e:
            # Only log full traceback once to avoid log spam
            error_msg = f"Failed to create PostgreSQL connection pool: {str(e)}"
            if not _db_unavailable_logged:
                logger.error(error_msg, exc_info=True)
                print(f"[ERROR] POSTGRES_POOL - {error_msg}")
                import traceback
                print(f"[ERROR] POSTGRES_POOL - Traceback:\n{traceback.format_exc()}")
                _db_unavailable_logged = True
            else:
                # Subsequent failures: just log a simple debug message
                logger.debug(f"PostgreSQL connection still unavailable: {str(e)}")
            return None
    else:
        if _pool:
            logger.debug("Using existing PostgreSQL connection pool")
            return _pool
        else:
            # Pool was attempted but failed - don't retry immediately
            if not _db_unavailable_logged:
                logger.warning("PostgreSQL connection pool unavailable. Database may not be running.")
                _db_unavailable_logged = True
            return None
    
    return _pool


async def execute_query(query: str, params: Optional[tuple] = None) -> Optional[list]:
    """Execute a query and return results. Handles DDL (CREATE, ALTER, DROP) and DML (SELECT, INSERT, UPDATE, DELETE)."""
    pool = get_postgres_pool()
    if not pool:
        return None
    
    # Check if this is DDL (CREATE, ALTER, DROP) - needed for error handling
    query_upper = query.strip().upper()
    query_is_ddl = query_upper.startswith(('CREATE', 'ALTER', 'DROP'))
    
    try:
        conn = pool.getconn()
        try:
            # Ensure we're using the right schema
            with conn.cursor() as schema_cur:
                schema_cur.execute("SET search_path TO public")
            conn.commit()
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if "test_run_steps" in query.lower():
                    print(f"[INFO] EXECUTE_QUERY - Query: {query[:100]}..., Params: {params}")
                
                # Check if this is DDL (CREATE, ALTER, DROP) - these don't return results
                is_ddl = query_is_ddl
                
                # Check if this is DML (INSERT, UPDATE, DELETE)
                is_modifying = query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE'))
                
                cur.execute(query, params)
                
                if is_ddl:
                    # For DDL queries, commit and return empty list (no results expected)
                    conn.commit()
                    return []
                elif is_modifying:
                    # For modifying queries, commit the transaction
                    conn.commit()
                    # Try to fetch results if RETURNING clause exists
                    if 'RETURNING' in query.upper():
                        results = cur.fetchall()
                        result_list = [dict(row) for row in results]
                        return result_list
                    else:
                        # No RETURNING clause, return empty list
                        return []
                else:
                    # For SELECT queries, fetch results
                    results = cur.fetchall()
                    result_list = [dict(row) for row in results]
                    if "test_run_steps" in query.lower():
                        print(f"[INFO] EXECUTE_QUERY - Results: {result_list}")
                    return result_list
        finally:
            pool.putconn(conn)
    except Exception as e:
        # For DDL errors like "already exists", that's OK - return empty list
        error_str = str(e).lower()
        
        # For CREATE TABLE statements, "does not exist" errors are expected and should be ignored
        # (they happen when checking if table exists before creating)
        if "already exists" in error_str:
            logger.warning(f"DDL query note (not an error): {str(e)}")
            return []
        
        # For CREATE TABLE IF NOT EXISTS, ignore "already exists" errors
        if "create" in query_upper and "if not exists" in query_upper:
            if "already exists" in error_str:
                logger.info(f"Table already exists (expected): {str(e)}")
                return []
        
        # For DROP TABLE IF EXISTS, "does not exist" is OK
        if "drop" in query_upper and "if exists" in query_upper:
            if "does not exist" in error_str:
                logger.info(f"Table does not exist (expected for DROP IF EXISTS): {str(e)}")
                return []
        
        print(f"[ERROR] EXECUTE_QUERY - Error: {str(e)}")
        logger.error(f"Query execution error: {str(e)}")
        
        # For "relation does not exist" errors on SELECT/INSERT/UPDATE/DELETE (not CREATE)
        # Don't reset pool for CREATE statements - they're creating the table!
        if "relation" in error_str and "does not exist" in error_str:
            # Only reset pool for non-DDL queries (SELECT, INSERT, UPDATE, DELETE)
            if not query_is_ddl:
                logger.warning("Table does not exist error detected. Resetting connection pool...")
                reset_connection_pool()
                # Re-raise with more context
                raise Exception(f"Table not found after pool reset. Error: {str(e)}. Please verify table exists and restart backend.")
            else:
                # For CREATE statements, this might be a dependency issue, but let it through
                logger.warning(f"DDL query error (may be dependency issue): {str(e)}")
                raise  # Re-raise so caller can handle it
        
        raise  # Re-raise so caller can handle it


async def execute_insert(table: str, data: Dict[str, Any]) -> Optional[str]:
    """Execute an INSERT and return the ID"""
    pool = get_postgres_pool()
    if not pool:
        error_msg = "PostgreSQL connection pool not available. Check DATABASE_URL or POSTGRES_* environment variables."
        logger.error(f"execute_insert: {error_msg}")
        print(f"[ERROR] EXECUTE_INSERT - {error_msg}")
        raise Exception(error_msg)
    
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
                
                print(f"[INFO] EXECUTE_INSERT - Table: {table}, Columns: {columns[:3]}..., Values count: {len(processed_values)}")
                if table == "test_run_steps":
                    print(f"[INFO] EXECUTE_INSERT - test_run_steps data: run_id={processed_values[columns.index('run_id')] if 'run_id' in columns else 'N/A'}, case_id={processed_values[columns.index('case_id')] if 'case_id' in columns else 'N/A'}")
                elif table == "test_cases":
                    case_id_idx = columns.index('id') if 'id' in columns else -1
                    case_id_val = processed_values[case_id_idx] if case_id_idx >= 0 else 'N/A'
                    print(f"[INFO] EXECUTE_INSERT - test_cases data: id={case_id_val}, project_id={processed_values[columns.index('project_id')] if 'project_id' in columns else 'N/A'}, title={processed_values[columns.index('title')] if 'title' in columns else 'N/A'}")
                
                logger.info(f"Executing INSERT into {table}: {query[:200]}... with {len(processed_values)} values")
                logger.info(f"Values: {processed_values[:5]}...")  # Log first 5 values
                cur.execute(query, tuple(processed_values))
                result = cur.fetchone()
                print(f"[INFO] EXECUTE_INSERT - Query executed, result: {result}")
                conn.commit()
                print(f"[INFO] EXECUTE_INSERT - Transaction committed")
                
                if result:
                    inserted_id = str(result[0])
                    print(f"[OK] EXECUTE_INSERT - Successfully inserted into {table} with ID: {inserted_id}")
                    logger.info(f"Successfully inserted into {table} with ID: {inserted_id}")
                    return inserted_id
                print(f"[ERROR] EXECUTE_INSERT - INSERT executed but no ID returned for {table}")
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

