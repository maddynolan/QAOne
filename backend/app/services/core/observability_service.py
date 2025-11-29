"""
Observability Service - Centralized logging, metrics, and tracing
Phase 4.3: Observability & RBAC
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class ObservabilityService:
    """
    Service for observability:
    - Centralized logging
    - Prometheus metrics
    - OpenTelemetry tracing
    - Audit logging
    """
    
    def __init__(self):
        pass
    
    async def log_audit_event(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log an audit event"""
        await self._store_audit_log(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            tenant_id=tenant_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    async def get_audit_logs(
        self,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get audit logs"""
        return await self._get_audit_logs(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )
    
    # ==================== Helper Methods ====================
    
    async def _store_audit_log(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str],
        user_id: Optional[str],
        tenant_id: Optional[str],
        details: Dict[str, Any],
        ip_address: Optional[str],
        user_agent: Optional[str]
    ):
        """Store audit log in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_audit_log_sync,
                pool,
                action,
                resource_type,
                resource_id,
                user_id,
                tenant_id,
                details,
                ip_address,
                user_agent
            )
    
    def _store_audit_log_sync(
        self,
        pool,
        action: str,
        resource_type: str,
        resource_id: Optional[str],
        user_id: Optional[str],
        tenant_id: Optional[str],
        details: Dict[str, Any],
        ip_address: Optional[str],
        user_agent: Optional[str]
    ):
        """Synchronous audit log insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs
                    (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        tenant_id,
                        user_id,
                        action,
                        resource_type,
                        resource_id,
                        json.dumps(details),
                        ip_address,
                        user_agent
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_audit_logs(
        self,
        tenant_id: Optional[str],
        user_id: Optional[str],
        action: Optional[str],
        resource_type: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get audit logs from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_audit_logs_sync,
                pool,
                tenant_id,
                user_id,
                action,
                resource_type,
                start_date,
                end_date,
                limit
            )
        return results
    
    def _get_audit_logs_sync(
        self,
        pool,
        tenant_id: Optional[str],
        user_id: Optional[str],
        action: Optional[str],
        resource_type: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Synchronous audit logs query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT * FROM audit_logs WHERE 1=1"
                params = []
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                if user_id:
                    query += " AND user_id = %s"
                    params.append(user_id)
                
                if action:
                    query += " AND action = %s"
                    params.append(action)
                
                if resource_type:
                    query += " AND resource_type = %s"
                    params.append(resource_type)
                
                if start_date:
                    query += " AND created_at >= %s"
                    params.append(start_date)
                
                if end_date:
                    query += " AND created_at <= %s"
                    params.append(end_date)
                
                query += " ORDER BY created_at DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                results = []
                
                for row in cur.fetchall():
                    result = dict(zip(columns, row))
                    if result.get("details"):
                        result["details"] = json.loads(result["details"]) if isinstance(result["details"], str) else result["details"]
                    results.append(result)
                
                return results
        finally:
            pool.putconn(conn)


observability_service = ObservabilityService()

