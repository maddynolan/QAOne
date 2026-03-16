"""
Git Sync API — Export/Import Project Artifacts + CI/CD Pipeline Generation

Endpoints for Git-based version control of project artifacts, webhook
handling, and CI/CD pipeline configuration.

Prefix: /api/git
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.core.git_export_service import git_export_service

logger = logging.getLogger(__name__)

git_sync_router = APIRouter(prefix="/api/git", tags=["Git Sync"])


# ==================== Request/Response Models ====================

class ExportRequest(BaseModel):
    project_id: str
    include_types: Optional[List[str]] = None


class ImportRequest(BaseModel):
    project_id: str
    file_tree: Dict[str, Any]
    mode: str = Field(default="merge", description="merge or replace")


class CIPipelineRequest(BaseModel):
    project_id: str
    format: str = Field(default="github_actions",
                        description="github_actions, gitlab_ci, jenkins, azure_pipelines")
    options: Optional[Dict[str, Any]] = None


class GitConfigUpdate(BaseModel):
    repo_url: Optional[str] = None
    branch: Optional[str] = None
    sync_enabled: Optional[bool] = None
    auto_export: Optional[bool] = None
    webhook_secret: Optional[str] = None
    provider: Optional[str] = None


class WebhookPayload(BaseModel):
    """Flexible webhook payload from Git providers."""
    event_type: Optional[str] = None
    action: Optional[str] = None
    ref: Optional[str] = None
    after: Optional[str] = None
    commit: Optional[Dict[str, Any]] = None
    repository: Optional[Dict[str, Any]] = None
    sender: Optional[Dict[str, Any]] = None


# ==================== Helpers ====================

def _get_auth(request: Request):
    """Extract org_id and user_id from request state."""
    org_id = getattr(request.state, "org_id", None) or getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)
    return org_id, user_id


# ==================== Export ====================

@git_sync_router.post("/export")
async def export_project(body: ExportRequest, request: Request):
    """Export all project artifacts to a structured file tree."""
    org_id, user_id = _get_auth(request)
    if not org_id:
        # Dev mode fallback
        org_id = "default"

    try:
        result = await git_export_service.export_project(
            project_id=body.project_id,
            org_id=org_id,
            include_types=body.include_types,
        )
        return result
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(500, "Export failed")


# ==================== Import ====================

@git_sync_router.post("/import")
async def import_project(body: ImportRequest, request: Request):
    """Import artifacts from a file tree into a project."""
    org_id, user_id = _get_auth(request)
    if not org_id:
        org_id = "default"
    if not user_id:
        user_id = "system"

    try:
        result = await git_export_service.import_project(
            project_id=body.project_id,
            org_id=org_id,
            file_tree=body.file_tree,
            user_id=user_id,
            mode=body.mode,
        )
        return result
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(500, "Import failed")


# ==================== CI Pipeline Generation ====================

@git_sync_router.post("/pipeline")
async def generate_pipeline(body: CIPipelineRequest, request: Request):
    """Generate CI/CD pipeline config for a project."""
    try:
        result = await git_export_service.generate_ci_pipeline(
            project_id=body.project_id,
            format=body.format,
            options=body.options,
        )
        if not result.get("success"):
            raise HTTPException(400, result.get("error", "Generation failed"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline generation error: {e}")
        raise HTTPException(500, "Pipeline generation failed")


# ==================== Webhook ====================

@git_sync_router.post("/webhook/{project_id}")
async def receive_webhook(project_id: str, body: WebhookPayload, request: Request):
    """
    Receive Git webhook (push, PR, etc.) and optionally trigger actions.
    Configure webhook URL in your Git provider:
        https://your-domain/api/git/webhook/{project_id}
    """
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    source = request.headers.get("X-GitHub-Event", "")
    if not source:
        source = request.headers.get("X-Gitlab-Event", "")
    if not source:
        source = "unknown"

    try:
        result = await git_export_service.handle_webhook(
            org_id=org_id,
            project_id=project_id,
            payload=body.dict(),
            source=source,
        )
        return result
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(500, "Webhook processing failed")


# ==================== Git Config ====================

@git_sync_router.get("/config/{project_id}")
async def get_git_config(project_id: str, request: Request):
    """Get Git sync configuration for a project."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    config = await git_export_service.get_git_config(project_id, org_id)
    return config


@git_sync_router.put("/config/{project_id}")
async def update_git_config(project_id: str, body: GitConfigUpdate, request: Request):
    """Update Git sync configuration for a project."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    result = await git_export_service.update_git_config(
        project_id=project_id,
        org_id=org_id,
        config=body.dict(exclude_none=True),
    )
    if not result.get("success"):
        raise HTTPException(400, result.get("message", "Update failed"))
    return result


# ==================== Health ====================

@git_sync_router.get("/health")
async def git_sync_health():
    """Git sync service health check."""
    return {"status": "ok", "service": "git_sync"}
