"""
Tenant Service - Multi-tenant management and provisioning
Phase 1.3: Multi-Tenant Data Model
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class TenantService:
    """
    Service for managing tenants, configuration, and provisioning
    """
    
    def __init__(self):
        self._db_pool = None
        logger.info("TenantService initialized")
    
    def _get_db_pool(self):
        """Get database connection pool"""
        if self._db_pool is None:
            from app.services.storage.postgres_direct import get_postgres_pool
            self._db_pool = get_postgres_pool()
        return self._db_pool
    
    async def create_tenant(
        self,
        tenant_id: str,
        org_id: Optional[str] = None,
        name: Optional[str] = None,
        settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new tenant
        
        Args:
            tenant_id: Unique tenant identifier
            org_id: Optional organization UUID (links to existing org)
            name: Tenant name
            settings: Tenant-specific settings
            
        Returns:
            Tenant configuration dict
        """
        import concurrent.futures
        
        pool = self._get_db_pool()
        if not pool:
            raise ValueError("Database not available")
        
        name = name or tenant_id
        settings = settings or {}
        
        # Default tenant config
        tenant_config = {
            "tenant_id": tenant_id,
            "org_id": org_id,
            "name": name,
            "settings": settings,
            "llm_provider": "local_qwen",
            "max_llm_requests_per_day": 1000,
            "max_storage_gb": 10,
            "features": {}
        }
        
        # Insert into database
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._insert_tenant_sync,
                pool,
                tenant_config
            )
        
        logger.info(f"Created tenant: {tenant_id}")
        return tenant_config
    
    def _insert_tenant_sync(self, pool, config: Dict[str, Any]):
        """Synchronous tenant insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tenant_config 
                    (tenant_id, org_id, name, settings, llm_provider, max_llm_requests_per_day, max_storage_gb, features)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id) DO UPDATE
                    SET name = EXCLUDED.name,
                        settings = EXCLUDED.settings,
                        updated_at = NOW()
                    """,
                    (
                        config["tenant_id"],
                        config.get("org_id"),
                        config["name"],
                        json.dumps(config["settings"]),
                        config["llm_provider"],
                        config["max_llm_requests_per_day"],
                        config["max_storage_gb"],
                        json.dumps(config["features"])
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def get_tenant(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get tenant configuration"""
        import concurrent.futures
        import json
        
        pool = self._get_db_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_tenant_sync,
                pool,
                tenant_id
            )
        
        return result
    
    def _get_tenant_sync(self, pool, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous tenant query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM tenant_config WHERE tenant_id = %s",
                    (tenant_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                # Parse JSONB fields
                if result.get("settings"):
                    result["settings"] = json.loads(result["settings"]) if isinstance(result["settings"], str) else result["settings"]
                if result.get("features"):
                    result["features"] = json.loads(result["features"]) if isinstance(result["features"], str) else result["features"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def update_tenant_settings(
        self,
        tenant_id: str,
        settings: Dict[str, Any]
    ) -> bool:
        """Update tenant settings"""
        import concurrent.futures
        import json
        
        pool = self._get_db_pool()
        if not pool:
            return False
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            success = await loop.run_in_executor(
                executor,
                self._update_tenant_sync,
                pool,
                tenant_id,
                settings
            )
        
        return success
    
    def _update_tenant_sync(self, pool, tenant_id: str, settings: Dict[str, Any]) -> bool:
        """Synchronous tenant update"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE tenant_config 
                    SET settings = %s, updated_at = NOW()
                    WHERE tenant_id = %s
                    """,
                    (json.dumps(settings), tenant_id)
                )
                conn.commit()
                return cur.rowcount > 0
        finally:
            pool.putconn(conn)
    
    async def list_tenants(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List all tenants"""
        import concurrent.futures
        
        pool = self._get_db_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._list_tenants_sync,
                pool,
                limit
            )
        
        return results
    
    def _list_tenants_sync(self, pool, limit: int) -> List[Dict[str, Any]]:
        """Synchronous tenant list"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM tenant_config ORDER BY created_at DESC LIMIT %s",
                    (limit,)
                )
                columns = [desc[0] for desc in cur.description]
                results = []
                for row in cur.fetchall():
                    result = dict(zip(columns, row))
                    if result.get("settings"):
                        result["settings"] = json.loads(result["settings"]) if isinstance(result["settings"], str) else result["settings"]
                    if result.get("features"):
                        result["features"] = json.loads(result["features"]) if isinstance(result["features"], str) else result["features"]
                    results.append(result)
                return results
        finally:
            pool.putconn(conn)


# Global instance
tenant_service = TenantService()

