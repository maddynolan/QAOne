"""
Test Environments API
=====================
CRUD endpoints for project-level test environments.
Prefix: /api/test-environments
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/test-environments", tags=["Test Environments"])


# ============================================================================
# Pydantic Models
# ============================================================================

class EnvironmentVariable(BaseModel):
    key: str
    value: str
    type: str = "default"  # "default" or "secret"
    enabled: bool = True


class CreateEnvironmentRequest(BaseModel):
    project_id: str
    name: str = Field(..., min_length=1, max_length=100)
    base_url: str = Field(..., min_length=1)
    variables: List[EnvironmentVariable] = []
    is_default: bool = False


class UpdateEnvironmentRequest(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    variables: Optional[List[EnvironmentVariable]] = None
    is_default: Optional[bool] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.get("")
async def list_environments(project_id: str = Query(..., description="Project ID")):
    """List all environments for a project."""
    from app.services.core.test_environment_service import get_environments
    envs = await get_environments(project_id)
    return {"environments": envs, "count": len(envs)}


@router.get("/{env_id}")
async def get_environment(env_id: str):
    """Get a single environment by ID."""
    from app.services.core.test_environment_service import get_environment as get_env
    env = await get_env(env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    return env


@router.post("")
async def create_environment(req: CreateEnvironmentRequest):
    """Create a new environment."""
    from app.services.core.test_environment_service import create_environment as create_env
    env = await create_env(req.model_dump())
    return env


@router.put("/{env_id}")
async def update_environment(env_id: str, req: UpdateEnvironmentRequest):
    """Update an existing environment."""
    from app.services.core.test_environment_service import update_environment as update_env
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    env = await update_env(env_id, updates)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    return env


@router.delete("/{env_id}")
async def delete_environment(env_id: str):
    """Delete an environment."""
    from app.services.core.test_environment_service import delete_environment as del_env
    success = await del_env(env_id)
    if not success:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"status": "deleted", "id": env_id}


@router.post("/{env_id}/set-default")
async def set_default_environment(env_id: str):
    """Mark an environment as the project default."""
    from app.services.core.test_environment_service import set_default
    env = await set_default(env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    return env
