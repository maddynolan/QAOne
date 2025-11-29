"""
Tenants API Router
Handles tenant management operations
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from app.services.core.tenant_service import tenant_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("")
async def create_tenant(request: Request, body: dict):
    """Create a new tenant"""
    try:
        tenant_id = body.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id is required")
        
        tenant = await tenant_service.create_tenant(
            tenant_id=tenant_id,
            org_id=body.get("org_id"),
            name=body.get("name"),
            settings=body.get("settings", {})
        )
        
        return {
            "status": "success",
            "tenant": tenant
        }
    except Exception as e:
        logger.error(f"Failed to create tenant: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{tenant_id}")
async def get_tenant(tenant_id: str):
    """Get tenant configuration"""
    try:
        tenant = await tenant_service.get_tenant(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return {
            "status": "success",
            "tenant": tenant
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tenant: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_tenants(limit: int = 100):
    """List all tenants"""
    try:
        tenants = await tenant_service.list_tenants(limit=limit)
        
        return {
            "status": "success",
            "count": len(tenants),
            "tenants": tenants
        }
    except Exception as e:
        logger.error(f"Failed to list tenants: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{tenant_id}/settings")
async def update_tenant_settings(tenant_id: str, body: dict):
    """Update tenant settings"""
    try:
        settings = body.get("settings", {})
        success = await tenant_service.update_tenant_settings(tenant_id, settings)
        
        if not success:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        return {
            "status": "success",
            "message": "Settings updated"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update tenant settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


