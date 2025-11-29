"""
RBAC Service - Role-Based Access Control
Phase 4.3: Observability & RBAC
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json

logger = logging.getLogger(__name__)


class RBACService:
    """
    Service for role-based access control:
    - Role management
    - Permission checking
    - User-role assignments
    """
    
    def __init__(self):
        pass
    
    async def create_role(
        self,
        name: str,
        description: str,
        permissions: List[str],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new role"""
        role_id = await self._store_role(name, description, permissions, tenant_id)
        
        return {
            "status": "success",
            "role_id": role_id,
            "name": name,
            "permissions": permissions
        }
    
    async def assign_role(
        self,
        user_id: str,
        role_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Assign a role to a user"""
        await self._assign_user_role(user_id, role_id, tenant_id)
        
        return {
            "status": "success",
            "user_id": user_id,
            "role_id": role_id
        }
    
    async def check_permission(
        self,
        user_id: str,
        permission: str,
        tenant_id: Optional[str] = None
    ) -> bool:
        """Check if user has a specific permission"""
        user_roles = await self._get_user_roles(user_id, tenant_id)
        
        for role in user_roles:
            role_permissions = role.get("permissions", [])
            if permission in role_permissions or "*" in role_permissions:
                return True
        
        return False
    
    async def get_user_permissions(
        self,
        user_id: str,
        tenant_id: Optional[str] = None
    ) -> List[str]:
        """Get all permissions for a user"""
        user_roles = await self._get_user_roles(user_id, tenant_id)
        
        permissions = set()
        for role in user_roles:
            role_permissions = role.get("permissions", [])
            permissions.update(role_permissions)
        
        return list(permissions)
    
    # ==================== Helper Methods ====================
    
    async def _store_role(
        self,
        name: str,
        description: str,
        permissions: List[str],
        tenant_id: Optional[str]
    ) -> str:
        """Store role in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        role_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_role_sync,
                pool,
                role_id,
                name,
                description,
                permissions,
                tenant_id
            )
        
        return role_id
    
    def _store_role_sync(
        self,
        pool,
        role_id: str,
        name: str,
        description: str,
        permissions: List[str],
        tenant_id: Optional[str]
    ):
        """Synchronous role insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO roles
                    (id, name, description, permissions, tenant_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    """,
                    (
                        role_id,
                        name,
                        description,
                        json.dumps(permissions),
                        tenant_id
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _assign_user_role(
        self,
        user_id: str,
        role_id: str,
        tenant_id: Optional[str]
    ):
        """Assign role to user"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._assign_user_role_sync,
                pool,
                user_id,
                role_id,
                tenant_id
            )
    
    def _assign_user_role_sync(
        self,
        pool,
        user_id: str,
        role_id: str,
        tenant_id: Optional[str]
    ):
        """Synchronous user role assignment"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_roles (id, user_id, role_id, tenant_id, created_at)
                    VALUES (uuid_generate_v4(), %s, %s, %s, NOW())
                    ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING
                    """,
                    (user_id, role_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_user_roles(
        self,
        user_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get roles for a user"""
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
                self._get_user_roles_sync,
                pool,
                user_id,
                tenant_id
            )
        return results
    
    def _get_user_roles_sync(
        self,
        pool,
        user_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Synchronous user roles query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                    SELECT r.*
                    FROM roles r
                    JOIN user_roles ur ON r.id = ur.role_id
                    WHERE ur.user_id = %s
                """
                params = [user_id]
                
                if tenant_id:
                    query += " AND (ur.tenant_id = %s OR ur.tenant_id IS NULL)"
                    params.append(tenant_id)
                
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


rbac_service = RBACService()

