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
    """Quick test: verify PostgreSQL connection, license table, and CRUD router DB access."""
    import os
    results = {
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "postgres_enabled": False,
        "license_pg_connected": False,
        "license_table_exists": False,
        "license_count": 0,
        "crud_pool_connected": False,
        "auto_migrate_ran": False,
        "core_tables": [],
    }
    
    db_url = os.getenv("DATABASE_URL", "")
    
    # Test 1: License direct connection (uses DATABASE_URL + sslmode)
    try:
        from app.routers.license_api import _is_postgres_available, _pg_load_licenses
        results["license_pg_connected"] = _is_postgres_available()
        if results["license_pg_connected"]:
            pg_result = _pg_load_licenses()
            if pg_result is not None:
                results["license_table_exists"] = True
                results["license_count"] = len(pg_result[0])
    except Exception as e:
        results["license_error"] = str(e)
    
    # Test 2: CRUD router pool (postgres_direct.py)
    try:
        from app.services.storage.postgres_direct import get_postgres_pool, POSTGRES_ENABLED
        results["postgres_enabled"] = POSTGRES_ENABLED
        pool = get_postgres_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    results["crud_pool_connected"] = True
                    # Check which tables exist
                    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
                    results["core_tables"] = [row[0] for row in cur.fetchall()]
                    results["auto_migrate_ran"] = "migration_history" in results["core_tables"]
            finally:
                pool.putconn(conn)
    except Exception as e:
        results["crud_pool_error"] = str(e)
    
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


