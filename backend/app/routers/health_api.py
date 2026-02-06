"""
Health and Metrics API Router
"""
import logging
from fastapi import APIRouter, HTTPException
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {"status": "ok"}


@router.get("/health/database")
async def health_check_database():
    """Check database connection and schema"""
    try:
        from app.services.storage.postgres_direct import test_connection as test_postgres_connection, get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return {
                "status": "error",
                "message": "Database pool not initialized"
            }
        
        # Test connection
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                result = cur.fetchone()
                if result:
                    # Check schema
                    cur.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        LIMIT 5
                    """)
                    tables = cur.fetchall()
                    return {
                        "status": "ok",
                        "message": "Database connection successful",
                        "tables_found": len(tables) > 0
                    }
        finally:
            pool.putconn(conn)
            
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/health/diagnostic")
async def diagnostic_check():
    """Comprehensive diagnostic check"""
    diagnostics = {
        "status": "ok",
        "checks": {}
    }
    
    # Database check
    try:
        from app.services.storage.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    diagnostics["checks"]["database"] = "ok"
            finally:
                pool.putconn(conn)
        else:
            diagnostics["checks"]["database"] = "error: pool not initialized"
    except Exception as e:
        diagnostics["checks"]["database"] = f"error: {str(e)}"
    
    # Ollama check
    try:
        from app.services.llm.ollama_service import get_ollama_service
        ollama_service = get_ollama_service()
        # Try a simple check
        diagnostics["checks"]["ollama"] = "ok"
    except Exception as e:
        diagnostics["checks"]["ollama"] = f"error: {str(e)}"
    
    # Overall status
    if any("error" in str(v) for v in diagnostics["checks"].values()):
        diagnostics["status"] = "degraded"
    
    return diagnostics


@router.get("/health/db-test")
async def db_connection_test():
    """Quick test: verify PostgreSQL connection with detailed error reporting."""
    import os
    import json as _json
    
    db_url = os.getenv("DATABASE_URL", "")
    # Mask password for display
    display_url = db_url
    if "@" in db_url and "://" in db_url:
        prefix = db_url.split("://")[0] + "://"
        after_proto = db_url.split("://")[1]
        if "@" in after_proto:
            user_pass = after_proto.split("@")[0]
            host_part = after_proto.split("@")[1]
            user = user_pass.split(":")[0] if ":" in user_pass else user_pass
            display_url = f"{prefix}{user}:****@{host_part}"
    
    results = {
        "database_url_set": bool(db_url),
        "database_url_display": display_url,
        "tests": {}
    }
    
    # Test 1: Raw psycopg2 connection (most basic test)
    try:
        import psycopg2
        conn_str = db_url
        if conn_str and "sslmode" not in conn_str:
            conn_str += ("&" if "?" in conn_str else "?") + "sslmode=require"
        results["tests"]["1_conn_string_used"] = conn_str.split("@")[-1] if "@" in conn_str else "no-url"
        
        conn = psycopg2.connect(conn_str, connect_timeout=5)
        cur = conn.cursor()
        cur.execute("SELECT version()")
        version = cur.fetchone()[0]
        results["tests"]["2_raw_connection"] = f"OK: {version[:60]}"
        
        # Test table creation
        cur.execute("""
            CREATE TABLE IF NOT EXISTS license_store (
                id TEXT PRIMARY KEY DEFAULT 'singleton',
                licenses JSONB NOT NULL DEFAULT '{}'::jsonb,
                activations JSONB NOT NULL DEFAULT '{}'::jsonb,
                saved_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        conn.commit()
        results["tests"]["3_create_table"] = "OK"
        
        # Test read
        cur.execute("SELECT licenses FROM license_store WHERE id = 'singleton'")
        row = cur.fetchone()
        results["tests"]["4_read"] = f"OK: {'has data' if row else 'empty (no row yet)'}"
        
        # List tables
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        tables = [r[0] for r in cur.fetchall()]
        results["tests"]["5_tables"] = tables
        
        conn.close()
    except Exception as e:
        results["tests"]["FAILED"] = f"{type(e).__name__}: {str(e)[:300]}"
    
    # Test 2: License module connection
    try:
        from app.routers.license_api import _is_postgres_available, _pg_conn_string
        results["tests"]["6_license_conn_string"] = (_pg_conn_string or "NONE").split("@")[-1] if _pg_conn_string else "NONE"
        results["tests"]["7_license_pg_available"] = _is_postgres_available()
    except Exception as e:
        results["tests"]["6_license_error"] = str(e)
    
    # Test 3: CRUD pool
    try:
        from app.services.storage.postgres_direct import get_postgres_pool, POSTGRES_ENABLED
        results["tests"]["8_postgres_enabled"] = POSTGRES_ENABLED
        pool = get_postgres_pool()
        results["tests"]["9_crud_pool"] = "OK" if pool else "pool is None"
    except Exception as e:
        results["tests"]["8_crud_pool_error"] = str(e)
    
    return results


@router.get("/metrics/{organization_id}")
async def get_metrics(organization_id: str, days: int = 7):
    """
    Get observability metrics for an organization
    
    Returns:
        - Cache hit rates (L1, L2, combined)
        - Latency statistics (mean, p50, p95)
        - Token usage by model
        - RAG quality metrics
    """
    try:
        from app.services.core.metrics_service import metrics_service
        await metrics_service.initialize()
        
        metrics = await metrics_service.get_metrics(organization_id, days)
        return metrics
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


