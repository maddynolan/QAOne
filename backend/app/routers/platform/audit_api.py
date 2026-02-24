"""
Audit Trail API — Enterprise compliance logging

Endpoints:
  GET  /api/audit/logs     — Query audit logs with filtering & pagination
  GET  /api/audit/summary  — Get audit summary statistics
  POST /api/audit/logs     — Record an audit event (internal/service use)
"""

import logging
from typing import Optional
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.services.core.audit_service import audit_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audit", tags=["audit"])


class AuditLogRequest(BaseModel):
    """Request body for creating an audit event."""
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    user_email: Optional[str] = None
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "success"


@router.get("/logs")
async def get_audit_logs(
    request: Request,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action (create, update, delete, login, etc.)"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    status: Optional[str] = Query(None, description="Filter by status (success, failure, denied)"),
    org_id: Optional[str] = Query(None, description="Filter by organization"),
    start_date: Optional[str] = Query(None, description="ISO date start filter"),
    end_date: Optional[str] = Query(None, description="ISO date end filter"),
    search: Optional[str] = Query(None, description="Full-text search across fields"),
    limit: int = Query(100, ge=1, le=1000, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
):
    """Query audit logs with filtering and pagination.

    Returns paginated list of audit events matching the filters.
    Supports filtering by user, action, resource type, status, date range, and full-text search.
    """
    result = await audit_service.get_logs(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        status=status,
        org_id=org_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
        limit=limit,
        offset=offset,
    )
    return result


@router.get("/summary")
async def get_audit_summary(
    hours: int = Query(24, ge=1, le=720, description="Summary period in hours"),
):
    """Get audit activity summary for the last N hours.

    Returns aggregated statistics: total events, failures, action/resource breakdowns,
    active users count, and top users by activity.
    """
    return await audit_service.get_summary(hours=hours)


@router.post("/logs")
async def create_audit_log(
    body: AuditLogRequest,
    request: Request,
):
    """Record an audit event (for internal/service use).

    Typically called by backend services or middleware to log significant actions.
    Frontend audit events are auto-logged via middleware.
    """
    # Extract IP from request
    ip_address = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not ip_address:
        ip_address = request.headers.get("x-real-ip", request.client.host if request.client else "unknown")

    user_agent = request.headers.get("user-agent", "")

    event = await audit_service.log(
        user_id=body.user_id,
        action=body.action,
        resource_type=body.resource_type,
        resource_id=body.resource_id,
        details=body.details,
        user_email=body.user_email,
        ip_address=ip_address,
        user_agent=user_agent,
        org_id=body.org_id,
        project_id=body.project_id,
        status=body.status,
    )

    return {"status": "recorded", "event_id": event.id}


@router.get("/actions")
async def get_audit_actions():
    """Get list of available audit action types for filtering."""
    return {
        "actions": [
            "create", "read", "update", "delete",
            "login", "logout", "signup",
            "execute", "scan", "export", "import",
            "invite", "remove", "permission_change",
            "settings_change", "api_key_create", "api_key_revoke",
        ],
        "resource_types": [
            "test_case", "test_run", "test_plan", "test_suite",
            "api_request", "api_collection",
            "accessibility_scan", "visual_test", "performance_test",
            "user", "organization", "project",
            "settings", "integration", "secret",
            "defect", "requirement",
        ],
        "statuses": ["success", "failure", "denied"],
    }
