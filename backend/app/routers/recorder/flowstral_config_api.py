"""
Flowstral Project Configuration API
Manages project-level Flowstral configuration
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.flowstral.flowstral_project_config import get_project_config_service
from app.services.core.plugin_service import PluginService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flowstral/projects", tags=["flowstral-config"])

config_service = get_project_config_service()
plugin_service = PluginService()


# Request/Response Models
class ProjectConfigUpdate(BaseModel):
    """Update project configuration"""
    pipelines: Optional[Dict[str, Any]] = None
    event_coalescing: Optional[Dict[str, Any]] = None
    storage: Optional[Dict[str, Any]] = None
    llm: Optional[Dict[str, Any]] = None
    selectors: Optional[Dict[str, Any]] = None
    security: Optional[Dict[str, Any]] = None


class ProjectConfigResponse(BaseModel):
    """Project configuration response"""
    project_id: str
    tenant_id: Optional[str] = None
    pipelines: Dict[str, Any]
    event_coalescing: Dict[str, Any]
    storage: Dict[str, Any]
    llm: Dict[str, Any]
    selectors: Dict[str, Any]
    security: Dict[str, Any]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# Authentication
async def verify_api_key_optional(authorization: Optional[str] = None) -> Dict[str, Any]:
    """Verify API key (optional)"""
    return {
        "key_id": None,
        "tenant_id": None,
        "permissions": []
    }


@router.get("/{project_id}/config", response_model=ProjectConfigResponse)
async def get_project_config(
    project_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Get project configuration
    
    Returns the current Flowstral configuration for a project.
    If no configuration exists, returns default configuration.
    """
    try:
        config = await config_service.get_config(project_id)
        return config.to_dict()
    except Exception as e:
        logger.error(f"Failed to get project config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get configuration")


@router.put("/{project_id}/config", response_model=ProjectConfigResponse)
async def update_project_config(
    project_id: str,
    updates: ProjectConfigUpdate,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Update project configuration
    
    Updates the Flowstral configuration for a project.
    Only provided fields are updated; others remain unchanged.
    """
    try:
        updates_dict = updates.dict(exclude_unset=True)
        config = await config_service.update_config(project_id, updates_dict)
        return config.to_dict()
    except ValueError as e:
        logger.warning(f"Invalid configuration update: {e}")
        raise HTTPException(status_code=400, detail="Invalid configuration values")
    except Exception as e:
        logger.error(f"Failed to update project config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update configuration")


@router.post("/{project_id}/config/reset")
async def reset_project_config(
    project_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Reset project configuration to defaults
    
    Resets all configuration to default values.
    """
    try:
        # Delete existing config and create new default
        from app.services.flowstral.flowstral_project_config import ProjectConfig
        from datetime import datetime
        
        default_config = ProjectConfig(project_id=project_id, created_at=datetime.utcnow())
        config = await config_service.update_config(project_id, default_config.to_dict())
        return config.to_dict()
    except Exception as e:
        logger.error(f"Failed to reset project config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset configuration")


@router.get("/{project_id}/config/validate")
async def validate_project_config(
    project_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Validate project configuration
    
    Validates the current configuration and returns any issues.
    """
    try:
        config = await config_service.get_config(project_id)
        
        # Validate configuration
        issues = []
        
        # Check pipeline modes
        for name, pipeline in config.pipelines.items():
            if pipeline.mode not in ["full", "light", "off"]:
                issues.append(f"Pipeline {name} has invalid mode: {pipeline.mode}")
        
        # Check LLM mode
        if config.llm.mode not in ["none", "summary_only", "full"]:
            issues.append(f"Invalid LLM mode: {config.llm.mode}")
        
        # Check retention policy
        if config.storage.retention_policy not in ["full", "standard", "minimal"]:
            issues.append(f"Invalid retention policy: {config.storage.retention_policy}")
        
        # Check compression algorithm
        if config.storage.compression_algorithm not in ["brotli", "gzip", "none"]:
            issues.append(f"Invalid compression algorithm: {config.storage.compression_algorithm}")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "config": config.to_dict()
        }
    except Exception as e:
        logger.error(f"Failed to validate project config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to validate configuration")




