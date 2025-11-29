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


