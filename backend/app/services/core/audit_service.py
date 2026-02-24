"""
Enterprise Audit Trail Service

Provides comprehensive audit logging for compliance and security monitoring.
Stores events in-memory with optional PostgreSQL persistence.

Usage:
    from app.services.core.audit_service import audit_service

    await audit_service.log("user-123", "create", "test_case", {"name": "Login Test"})
    logs = await audit_service.get_logs(action="create", limit=50)
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict, field
from collections import deque

logger = logging.getLogger(__name__)

# Maximum in-memory audit log entries (circular buffer)
MAX_MEMORY_ENTRIES = 10_000


@dataclass
class AuditEvent:
    """A single audit log entry."""
    id: str
    timestamp: str
    user_id: str
    user_email: Optional[str]
    action: str           # create, read, update, delete, login, logout, export, scan, execute
    resource_type: str    # test_case, test_run, api_request, scan, user, settings, etc.
    resource_id: Optional[str]
    details: Dict[str, Any] = field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "success"  # success, failure, denied


class AuditService:
    """Enterprise audit trail with in-memory store and optional DB persistence."""

    def __init__(self):
        self._events: deque = deque(maxlen=MAX_MEMORY_ENTRIES)
        self._counter = 0
        self._lock = asyncio.Lock()
        self._db_enabled = False
        self._init_db()

    def _init_db(self):
        """Try to initialize PostgreSQL persistence."""
        db_url = os.getenv("DATABASE_URL")
        if db_url:
            self._db_enabled = True
            logger.info("[Audit] PostgreSQL persistence enabled")
        else:
            logger.info("[Audit] Running in-memory mode (set DATABASE_URL for persistence)")

    async def log(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        details: Optional[Dict[str, Any]] = None,
        resource_id: Optional[str] = None,
        user_email: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        status: str = "success",
    ) -> AuditEvent:
        """Log an audit event.

        Args:
            user_id: ID of the user performing the action
            action: Action type (create, read, update, delete, login, logout, export, scan, execute)
            resource_type: Type of resource being acted upon
            details: Additional context (will be stored as JSON)
            resource_id: Optional ID of the specific resource
            user_email: Optional email for display
            ip_address: Client IP address
            user_agent: Client user agent string
            org_id: Organization context
            project_id: Project context
            status: Outcome (success, failure, denied)
        """
        async with self._lock:
            self._counter += 1
            event_id = f"audit-{self._counter}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        event = AuditEvent(
            id=event_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            org_id=org_id,
            project_id=project_id,
            status=status,
        )

        self._events.appendleft(event)

        # Persist to PostgreSQL if available
        if self._db_enabled:
            await self._persist_to_db(event)

        logger.info(
            f"[Audit] {action} {resource_type}"
            f" user={user_id}"
            f" resource={resource_id or 'N/A'}"
            f" status={status}"
        )

        return event

    async def get_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        status: Optional[str] = None,
        org_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Query audit logs with filtering and pagination.

        Returns:
            Dict with 'events' list, 'total' count, 'limit', 'offset'
        """
        filtered = list(self._events)

        # Apply filters
        if user_id:
            filtered = [e for e in filtered if e.user_id == user_id]
        if action:
            filtered = [e for e in filtered if e.action == action]
        if resource_type:
            filtered = [e for e in filtered if e.resource_type == resource_type]
        if status:
            filtered = [e for e in filtered if e.status == status]
        if org_id:
            filtered = [e for e in filtered if e.org_id == org_id]
        if start_date:
            filtered = [e for e in filtered if e.timestamp >= start_date]
        if end_date:
            filtered = [e for e in filtered if e.timestamp <= end_date]
        if search:
            search_lower = search.lower()
            filtered = [
                e for e in filtered
                if search_lower in (e.user_email or "").lower()
                or search_lower in e.action.lower()
                or search_lower in e.resource_type.lower()
                or search_lower in json.dumps(e.details).lower()
            ]

        total = len(filtered)
        paginated = filtered[offset : offset + limit]

        return {
            "events": [asdict(e) for e in paginated],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get audit summary statistics for the last N hours."""
        cutoff = (datetime.utcnow() - timedelta(hours=hours)).isoformat() + "Z"
        recent = [e for e in self._events if e.timestamp >= cutoff]

        action_counts: Dict[str, int] = {}
        resource_counts: Dict[str, int] = {}
        user_counts: Dict[str, int] = {}
        failures = 0

        for event in recent:
            action_counts[event.action] = action_counts.get(event.action, 0) + 1
            resource_counts[event.resource_type] = resource_counts.get(event.resource_type, 0) + 1
            user_counts[event.user_id] = user_counts.get(event.user_id, 0) + 1
            if event.status == "failure" or event.status == "denied":
                failures += 1

        return {
            "period_hours": hours,
            "total_events": len(recent),
            "failures": failures,
            "actions": action_counts,
            "resources": resource_counts,
            "active_users": len(user_counts),
            "top_users": sorted(user_counts.items(), key=lambda x: -x[1])[:10],
        }

    async def _persist_to_db(self, event: AuditEvent):
        """Persist audit event to PostgreSQL (best-effort)."""
        try:
            from app.services.storage.database import get_database_client

            db = await get_database_client()
            if db:
                await db.execute(
                    """
                    INSERT INTO audit_logs (id, timestamp, user_id, user_email, action,
                        resource_type, resource_id, details, ip_address, org_id, project_id, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    """,
                    event.id,
                    event.timestamp,
                    event.user_id,
                    event.user_email,
                    event.action,
                    event.resource_type,
                    event.resource_id,
                    json.dumps(event.details),
                    event.ip_address,
                    event.org_id,
                    event.project_id,
                    event.status,
                )
        except Exception as e:
            # DB persistence is best-effort; don't fail the operation
            logger.debug(f"[Audit] DB persist failed (non-critical): {e}")


# Singleton instance
audit_service = AuditService()
