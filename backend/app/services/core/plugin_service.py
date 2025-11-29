"""
Plugin Service - Manages API keys and plugin integrations
Phase 4.1: Plugin API
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import secrets
import hashlib

logger = logging.getLogger(__name__)


class PluginService:
    """
    Service for managing plugins and API keys:
    - API key generation and validation
    - Plugin registration
    - Event streaming (WebSocket/SSE)
    """
    
    def __init__(self):
        pass
    
    async def create_api_key(
        self,
        name: str,
        tenant_id: Optional[str] = None,
        permissions: Optional[List[str]] = None,
        expires_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Create a new API key"""
        # Generate API key
        api_key = self._generate_api_key()
        key_hash = self._hash_api_key(api_key)
        
        # Store in database
        key_id = await self._store_api_key(
            name=name,
            key_hash=key_hash,
            tenant_id=tenant_id,
            permissions=permissions or [],
            expires_at=expires_at
        )
        
        return {
            "status": "success",
            "key_id": key_id,
            "api_key": api_key,  # Only returned once
            "name": name,
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def validate_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Validate an API key"""
        key_hash = self._hash_api_key(api_key)
        
        key_data = await self._get_api_key_by_hash(key_hash)
        if not key_data:
            return None
        
        # Check expiration
        if key_data.get("expires_at"):
            expires_at = datetime.fromisoformat(key_data["expires_at"])
            if datetime.utcnow() > expires_at:
                return None
        
        # Check if revoked
        if key_data.get("revoked"):
            return None
        
        return {
            "key_id": key_data.get("id"),
            "tenant_id": key_data.get("tenant_id"),
            "permissions": key_data.get("permissions", [])
        }
    
    async def revoke_api_key(self, key_id: str) -> Dict[str, Any]:
        """Revoke an API key"""
        await self._revoke_api_key(key_id)
        return {
            "status": "success",
            "key_id": key_id
        }
    
    async def list_api_keys(
        self,
        tenant_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List API keys"""
        return await self._list_api_keys(tenant_id, limit)
    
    # ==================== Helper Methods ====================
    
    def _generate_api_key(self) -> str:
        """Generate a secure API key"""
        # Generate 32-byte random key, encode as hex
        random_bytes = secrets.token_bytes(32)
        return f"qaai_{random_bytes.hex()}"
    
    def _hash_api_key(self, api_key: str) -> str:
        """Hash an API key for storage"""
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    async def _store_api_key(
        self,
        name: str,
        key_hash: str,
        tenant_id: Optional[str],
        permissions: List[str],
        expires_at: Optional[datetime]
    ) -> str:
        """Store API key in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        key_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_api_key_sync,
                pool,
                key_id,
                name,
                key_hash,
                tenant_id,
                permissions,
                expires_at
            )
        
        return key_id
    
    def _store_api_key_sync(
        self,
        pool,
        key_id: str,
        name: str,
        key_hash: str,
        tenant_id: Optional[str],
        permissions: List[str],
        expires_at: Optional[datetime]
    ):
        """Synchronous API key insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO api_keys
                    (id, name, key_hash, tenant_id, permissions, expires_at, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        key_id,
                        name,
                        key_hash,
                        tenant_id,
                        json.dumps(permissions),
                        expires_at.isoformat() if expires_at else None
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_api_key_by_hash(self, key_hash: str) -> Optional[Dict[str, Any]]:
        """Get API key by hash"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_api_key_by_hash_sync,
                pool,
                key_hash
            )
        return result
    
    def _get_api_key_by_hash_sync(self, pool, key_hash: str) -> Optional[Dict[str, Any]]:
        """Synchronous API key query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM api_keys WHERE key_hash = %s",
                    (key_hash,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("permissions"):
                    result["permissions"] = json.loads(result["permissions"]) if isinstance(result["permissions"], str) else result["permissions"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _revoke_api_key(self, key_id: str):
        """Revoke API key"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._revoke_api_key_sync,
                pool,
                key_id
            )
    
    def _revoke_api_key_sync(self, pool, key_id: str):
        """Synchronous API key revocation"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE api_keys SET revoked = true, revoked_at = NOW() WHERE id = %s",
                    (key_id,)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _list_api_keys(
        self,
        tenant_id: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """List API keys"""
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
                self._list_api_keys_sync,
                pool,
                tenant_id,
                limit
            )
        return results
    
    def _list_api_keys_sync(
        self,
        pool,
        tenant_id: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Synchronous API keys list query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT id, name, tenant_id, permissions, created_at, expires_at, revoked FROM api_keys WHERE 1=1"
                params = []
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                query += " ORDER BY created_at DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                results = []
                
                for row in cur.fetchall():
                    result = dict(zip(columns, row))
                    if result.get("permissions"):
                        result["permissions"] = json.loads(result["permissions"]) if isinstance(result["permissions"], str) else result["permissions"]
                    results.append(result)
                
                return results
        finally:
            pool.putconn(conn)

