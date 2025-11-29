"""
Page Object Repository Service
Manages shared page objects and elements for reusable test selectors.
Implements Page Object Model (POM) pattern.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from app.services.storage.postgres_direct import get_postgres_pool
from app.middleware.tenant_middleware import get_current_tenant_id
from app.middleware.rbac_middleware import get_current_auth_user_id

logger = logging.getLogger(__name__)


class PageObjectService:
    """
    Service for managing Page Object Repository.
    Allows centralized management of element selectors.
    """
    
    async def create_page_object(
        self,
        name: str,
        description: Optional[str] = None,
        url_pattern: Optional[str] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new page object.
        
        Args:
            name: Page object name
            description: Optional description
            url_pattern: URL pattern to match this page
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Created page object dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO page_objects (
                    org_id, project_id, name, description, url_pattern,
                    created_by, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING page_object_id, created_at
            """, org_id, project_id, name, description, url_pattern, user_id, tenant_id)
        
        return {
            "page_object_id": str(result["page_object_id"]),
            "name": name,
            "description": description,
            "url_pattern": url_pattern,
            "org_id": org_id,
            "project_id": project_id,
            "created_at": result["created_at"].isoformat()
        }
    
    async def create_page_element(
        self,
        page_object_id: str,
        name: str,
        element_type: str,
        selectors: Dict[str, Any],
        description: Optional[str] = None,
        is_required: bool = False,
        wait_strategy: str = "visible"
    ) -> Dict[str, Any]:
        """
        Create a new page element with multi-layer selectors.
        
        Args:
            page_object_id: Page object ID
            name: Element name
            element_type: Element type (button, input, link, etc.)
            selectors: Dictionary with selector layers:
                - layer1_gold: data-testid or id
                - layer2_silver: role + name/aria-label
                - layer3_bronze: text content
                - layer4_iron: CSS attributes
                - layer5_clay: XPath/CSS path
                - selector: Legacy selector (for backward compatibility)
            description: Optional description
            is_required: Whether element is required
            wait_strategy: Wait strategy (visible, attached, networkidle)
            
        Returns:
            Created page element dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO page_elements (
                    page_object_id, name, description, element_type,
                    selector_layer1_gold, selector_layer2_silver,
                    selector_layer3_bronze, selector_layer4_iron,
                    selector_layer5_clay, selector,
                    is_required, wait_strategy, created_by, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING element_id, created_at
            """,
                page_object_id, name, description, element_type,
                selectors.get("layer1_gold"),
                selectors.get("layer2_silver"),
                selectors.get("layer3_bronze"),
                selectors.get("layer4_iron"),
                selectors.get("layer5_clay"),
                selectors.get("selector"),  # Legacy
                is_required, wait_strategy, user_id, tenant_id
            )
        
        return {
            "element_id": str(result["element_id"]),
            "page_object_id": page_object_id,
            "name": name,
            "element_type": element_type,
            "selectors": selectors,
            "description": description,
            "is_required": is_required,
            "wait_strategy": wait_strategy,
            "created_at": result["created_at"].isoformat()
        }
    
    async def update_element_selectors(
        self,
        element_id: str,
        selectors: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update element selectors.
        When selectors are updated, all test cases using this element
        will automatically use the new selectors.
        
        Args:
            element_id: Element ID
            selectors: Updated selectors dictionary
            
        Returns:
            Updated element dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                UPDATE page_elements
                SET selector_layer1_gold = $1,
                    selector_layer2_silver = $2,
                    selector_layer3_bronze = $3,
                    selector_layer4_iron = $4,
                    selector_layer5_clay = $5,
                    selector = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE element_id = $7
                  AND (tenant_id = $8 OR tenant_id IS NULL)
                RETURNING element_id, name, element_type, selector_layer1_gold,
                          selector_layer2_silver, selector_layer3_bronze,
                          selector_layer4_iron, selector_layer5_clay, selector
            """,
                selectors.get("layer1_gold"),
                selectors.get("layer2_silver"),
                selectors.get("layer3_bronze"),
                selectors.get("layer4_iron"),
                selectors.get("layer5_clay"),
                selectors.get("selector"),
                element_id, tenant_id
            )
        
        if not result:
            raise Exception(f"Element {element_id} not found")
        
        return {
            "element_id": str(result["element_id"]),
            "name": result["name"],
            "element_type": result["element_type"],
            "selectors": {
                "layer1_gold": result["selector_layer1_gold"],
                "layer2_silver": result["selector_layer2_silver"],
                "layer3_bronze": result["selector_layer3_bronze"],
                "layer4_iron": result["selector_layer4_iron"],
                "layer5_clay": result["selector_layer5_clay"],
                "selector": result["selector"]
            }
        }
    
    async def get_element_selectors(
        self,
        element_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get element selectors for use in test execution.
        
        Args:
            element_id: Element ID
            
        Returns:
            Selectors dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT element_id, name, element_type,
                       selector_layer1_gold, selector_layer2_silver,
                       selector_layer3_bronze, selector_layer4_iron,
                       selector_layer5_clay, selector, wait_strategy
                FROM page_elements
                WHERE element_id = $1
                  AND (tenant_id = $2 OR tenant_id IS NULL)
            """, element_id, tenant_id)
        
        if not result:
            return None
        
        return {
            "element_id": str(result["element_id"]),
            "name": result["name"],
            "element_type": result["element_type"],
            "selectors": {
                "layer1_gold": result["selector_layer1_gold"],
                "layer2_silver": result["selector_layer2_silver"],
                "layer3_bronze": result["selector_layer3_bronze"],
                "layer4_iron": result["selector_layer4_iron"],
                "layer5_clay": result["selector_layer5_clay"],
                "selector": result["selector"]
            },
            "wait_strategy": result["wait_strategy"]
        }
    
    async def list_page_objects(
        self,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List page objects"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        query = """
            SELECT page_object_id, org_id, project_id, name, description,
                   url_pattern, created_at, updated_at
            FROM page_objects
            WHERE (tenant_id = $1 OR tenant_id IS NULL)
        """
        params = [tenant_id]
        param_idx = 2
        
        if org_id:
            query += f" AND (org_id = ${param_idx} OR org_id IS NULL)"
            params.append(org_id)
            param_idx += 1
        
        if project_id:
            query += f" AND (project_id = ${param_idx} OR project_id IS NULL)"
            params.append(project_id)
            param_idx += 1
        
        query += " ORDER BY name"
        
        async with pool.acquire() as conn:
            results = await conn.fetch(query, *params)
        
        return [dict(row) for row in results]
    
    async def list_page_elements(
        self,
        page_object_id: str
    ) -> List[Dict[str, Any]]:
        """List elements for a page object"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            results = await conn.fetch("""
                SELECT element_id, name, element_type, description,
                       selector_layer1_gold, selector_layer2_silver,
                       selector_layer3_bronze, selector_layer4_iron,
                       selector_layer5_clay, selector,
                       is_required, wait_strategy, created_at, updated_at
                FROM page_elements
                WHERE page_object_id = $1
                  AND (tenant_id = $2 OR tenant_id IS NULL)
                ORDER BY name
            """, page_object_id, tenant_id)
        
        elements = []
        for row in results:
            elements.append({
                "element_id": str(row["element_id"]),
                "name": row["name"],
                "element_type": row["element_type"],
                "description": row["description"],
                "selectors": {
                    "layer1_gold": row["selector_layer1_gold"],
                    "layer2_silver": row["selector_layer2_silver"],
                    "layer3_bronze": row["selector_layer3_bronze"],
                    "layer4_iron": row["selector_layer4_iron"],
                    "layer5_clay": row["selector_layer5_clay"],
                    "selector": row["selector"]
                },
                "is_required": row["is_required"],
                "wait_strategy": row["wait_strategy"],
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat()
            })
        
        return elements


# Global instance
_page_object_service = None

def get_page_object_service() -> PageObjectService:
    """Get or create global PageObjectService instance"""
    global _page_object_service
    if _page_object_service is None:
        _page_object_service = PageObjectService()
    return _page_object_service

