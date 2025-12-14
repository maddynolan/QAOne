"""
Element Model Service
Manages element models with multiple identifiers (Tosca-style)
Works across all app types: Salesforce, React, Angular, Vue, Generic
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4

from app.services.storage.postgres_direct import get_postgres_pool
from app.middleware.tenant_middleware import get_current_tenant_id
from app.middleware.rbac_middleware import get_current_auth_user_id

logger = logging.getLogger(__name__)


class ElementModelService:
    """
    Service for managing element models with multiple identifiers.
    
    Key Features:
    - Store multiple identifiers per element
    - App-specific identifier priorities
    - Track usage and success rates
    - Self-healing capabilities
    """
    
    async def create_element_model(
        self,
        element_name: str,
        element_type: str,
        application_type: str,
        identifiers: List[Dict[str, Any]],
        page_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        visual_fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new element model with multiple identifiers.
        
        Args:
            element_name: Human-readable name (e.g., "login_submit_button")
            element_type: Element type (button, input, link, etc.)
            application_type: App type (salesforce, react, angular, vue, generic)
            identifiers: List of identifier dictionaries
            page_id: Optional page object ID
            metadata: Optional metadata dictionary
            visual_fingerprint: Optional visual hash for visual matching
            
        Returns:
            Created element model dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        # Validate identifiers
        if not identifiers:
            raise ValueError("At least one identifier is required")
        
        # Sort identifiers by priority
        identifiers = sorted(identifiers, key=lambda x: x.get('priority', 999))
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO element_models (
                    element_name, element_type, page_id, application_type,
                    identifiers, metadata, visual_fingerprint,
                    tenant_id, created_by
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
                RETURNING element_id, created_at, first_seen, last_seen
            """,
                element_name, element_type, page_id, application_type,
                identifiers, metadata or {}, visual_fingerprint,
                tenant_id, user_id
            )
        
        return {
            "element_id": str(result["element_id"]),
            "element_name": element_name,
            "element_type": element_type,
            "application_type": application_type,
            "identifiers": identifiers,
            "metadata": metadata or {},
            "page_id": page_id,
            "created_at": result["created_at"].isoformat(),
            "first_seen": result["first_seen"].isoformat(),
            "last_seen": result["last_seen"].isoformat()
        }
    
    async def find_or_create_element_model(
        self,
        element_name: str,
        element_type: str,
        application_type: str,
        identifiers: List[Dict[str, Any]],
        page_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Find existing element model or create new one.
        
        Uses (tenant_id, page_id, element_name) as unique key.
        If found, updates identifiers if new ones are provided.
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            # Try to find existing
            existing = await conn.fetchrow("""
                SELECT element_id, identifiers, metadata
                FROM element_models
                WHERE tenant_id = $1
                  AND page_id = $2
                  AND element_name = $3
            """, tenant_id, page_id, element_name)
            
            if existing:
                # Update identifiers if new ones provided
                existing_identifiers = existing["identifiers"]
                
                # Merge new identifiers (avoid duplicates)
                merged_identifiers = list(existing_identifiers)
                for new_id in identifiers:
                    # Check if identifier already exists
                    exists = any(
                        id.get('type') == new_id.get('type') and
                        id.get('value') == new_id.get('value')
                        for id in merged_identifiers
                    )
                    if not exists:
                        merged_identifiers.append(new_id)
                
                # Sort by priority
                merged_identifiers = sorted(merged_identifiers, key=lambda x: x.get('priority', 999))
                
                # Update metadata
                existing_metadata = existing["metadata"] or {}
                if metadata:
                    existing_metadata.update(metadata)
                
                # Update record
                await conn.execute("""
                    UPDATE element_models
                    SET identifiers = $1::jsonb,
                        metadata = $2::jsonb,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE element_id = $3
                """, merged_identifiers, existing_metadata, existing["element_id"])
                
                # Return updated model
                return await self.get_element_model(str(existing["element_id"]))
            else:
                # Create new
                return await self.create_element_model(
                    element_name, element_type, application_type,
                    identifiers, page_id, metadata
                )
    
    async def get_element_model(self, element_id: str) -> Optional[Dict[str, Any]]:
        """Get element model by ID"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT element_id, element_name, element_type, page_id, application_type,
                       identifiers, metadata, visual_fingerprint,
                       first_seen, last_seen, usage_count, success_rate,
                       created_at, updated_at
                FROM element_models
                WHERE element_id = $1
                  AND (tenant_id = $2 OR tenant_id IS NULL)
            """, element_id, tenant_id)
            
            if not result:
                return None
            
            return {
                "element_id": str(result["element_id"]),
                "element_name": result["element_name"],
                "element_type": result["element_type"],
                "page_id": str(result["page_id"]) if result["page_id"] else None,
                "application_type": result["application_type"],
                "identifiers": result["identifiers"],
                "metadata": result["metadata"],
                "visual_fingerprint": result["visual_fingerprint"],
                "first_seen": result["first_seen"].isoformat() if result["first_seen"] else None,
                "last_seen": result["last_seen"].isoformat() if result["last_seen"] else None,
                "usage_count": result["usage_count"],
                "success_rate": float(result["success_rate"]) if result["success_rate"] else 1.0,
                "created_at": result["created_at"].isoformat(),
                "updated_at": result["updated_at"].isoformat()
            }
    
    async def get_best_identifier(
        self,
        element_id: str,
        application_type: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the best identifier for an element based on app type and success rates.
        
        Returns the identifier with highest priority and confidence for the app type.
        """
        element_model = await self.get_element_model(element_id)
        if not element_model:
            return None
        
        identifiers = element_model.get("identifiers", [])
        if not identifiers:
            return None
        
        app_type = application_type or element_model.get("application_type", "generic")
        
        # Filter identifiers by app type
        # If identifier is app_specific, it must match the app type
        # Otherwise, it's generic and can be used
        app_identifiers = [
            id for id in identifiers
            if not id.get("app_specific", False) or id.get("app_type") == app_type
        ]
        
        if not app_identifiers:
            # Fallback to all identifiers if no app-specific ones found
            app_identifiers = identifiers
        
        # Sort by priority (lower = higher priority), then by confidence
        app_identifiers.sort(key=lambda x: (
            x.get("priority", 999),
            -x.get("confidence", 0.0)  # Negative for descending
        ))
        
        return app_identifiers[0] if app_identifiers else None
    
    async def record_usage(
        self,
        element_id: str,
        identifier_used: str,
        identifier_index: int,
        success: bool = True,
        execution_time_ms: Optional[int] = None,
        error_message: Optional[str] = None,
        test_case_id: Optional[str] = None
    ) -> None:
        """
        Record element identifier usage for analytics and self-healing.
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO element_model_usage (
                    element_id, test_case_id, identifier_used, identifier_index,
                    success, execution_time_ms, error_message, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
                element_id, test_case_id, identifier_used, identifier_index,
                success, execution_time_ms, error_message, tenant_id
            )
    
    async def list_element_models(
        self,
        page_id: Optional[str] = None,
        application_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List element models with optional filters"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        query = """
            SELECT element_id, element_name, element_type, page_id, application_type,
                   identifiers, metadata, usage_count, success_rate,
                   created_at, updated_at
            FROM element_models
            WHERE (tenant_id = $1 OR tenant_id IS NULL)
        """
        params = [tenant_id]
        param_idx = 2
        
        if page_id:
            query += f" AND page_id = ${param_idx}"
            params.append(page_id)
            param_idx += 1
        
        if application_type:
            query += f" AND application_type = ${param_idx}"
            params.append(application_type)
            param_idx += 1
        
        query += f" ORDER BY element_name LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params.extend([limit, offset])
        
        async with pool.acquire() as conn:
            results = await conn.fetch(query, *params)
        
        return [dict(row) for row in results]


# Global instance
_element_model_service = None

def get_element_model_service() -> ElementModelService:
    """Get or create global ElementModelService instance"""
    global _element_model_service
    if _element_model_service is None:
        _element_model_service = ElementModelService()
    return _element_model_service



