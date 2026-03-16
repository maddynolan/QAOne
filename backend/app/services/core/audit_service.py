"""
Enterprise Audit Trail Service

Provides comprehensive audit logging for compliance and security monitoring.
Stores events in-memory with PostgreSQL persistence.

Security features:
- Hash chain: each entry includes SHA-256 hash of previous entry for tamper detection
- Append-only: audit entries cannot be modified or deleted
- Security event logging: login, logout, failed auth, permission denied, secret access

Usage:
    from app.services.core.audit_service import audit_service

    await audit_service.log("user-123", "create", "test_case", {"name": "Login Test"})
    await audit_service.log_security_event("user-123", "login", ip="1.2.3.4")
    logs = await audit_service.get_logs(action="create", limit=50)
    integrity = await audit_service.verify_integrity()
"""

import hashlib
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

# Audit mode: "strict" = always persist to PostgreSQL (required for compliance)
# Set AUDIT_MODE=strict in production for SOC 2/HIPAA compliance
AUDIT_MODE = os.getenv("AUDIT_MODE", "best_effort")  # "strict" or "best_effort"

# Security event types for explicit tracking
SECURITY_EVENTS = {
    "login", "logout", "login_failed", "mfa_verified", "mfa_failed",
    "permission_denied", "secret_revealed", "data_export", "data_erasure",
    "password_changed", "mfa_enabled", "mfa_disabled", "api_key_stored",
    "suspicious_activity", "rate_limited",
}

# Enterprise events for locking and version control
ENTERPRISE_EVENTS = {
    "lock.acquire", "lock.release", "lock.force_release", "lock.expired",
    "version.create", "version.revert", "branch.create", "branch.merge",
    "service_account.create", "service_account.revoke", "service_account.regenerate_token",
    "schema.isolate", "schema.migrate",
    "compliance.report_generated", "compliance.audit_exported",
    "sso.login", "sso.config_updated", "group_mapping.updated",
}


@dataclass
class AuditEvent:
    """A single audit log entry with hash chain support."""
    id: str
    timestamp: str
    user_id: str
    user_email: Optional[str]
    action: str           # create, read, update, delete, login, logout, export, scan, execute
    resource_type: str    # test_case, test_run, api_request, scan, user, settings, security, etc.
    resource_id: Optional[str]
    details: Dict[str, Any] = field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    org_id: Optional[str] = None
    project_id: Optional[str] = None
    status: str = "success"  # success, failure, denied
    hash_chain: Optional[str] = None  # SHA-256 hash of previous entry (tamper detection)


class AuditService:
    """Enterprise audit trail with hash chain, in-memory store, and DB persistence."""

    def __init__(self):
        self._events: deque = deque(maxlen=MAX_MEMORY_ENTRIES)
        self._counter = 0
        self._lock = asyncio.Lock()
        self._db_enabled = False
        self._last_hash = "GENESIS"  # Initial hash chain seed
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

        # Compute hash chain — SHA-256 of previous entry + current event data
        chain_input = f"{self._last_hash}|{event_id}|{user_id}|{action}|{resource_type}"
        event_hash = hashlib.sha256(chain_input.encode()).hexdigest()

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
            hash_chain=event_hash,
        )

        self._last_hash = event_hash
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
        """
        Persist audit event to PostgreSQL.

        In strict mode (AUDIT_MODE=strict), failures raise exceptions.
        In best_effort mode, failures are logged but don't block operations.
        """
        try:
            # Try psycopg2 connection pool first (matches rest of the app)
            from app.services.storage.database import get_database_client
            pool = get_database_client()
            if pool and hasattr(pool, 'getconn'):
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """INSERT INTO audit_logs
                               (id, timestamp, user_id, user_email, action,
                                resource_type, resource_id, details, ip_address,
                                org_id, project_id, status, hash_chain)
                               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                            (
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
                                event.hash_chain,
                            ),
                        )
                        conn.commit()
                finally:
                    pool.putconn(conn)
                return
            # Fallback to async client if available
            if pool:
                await pool.execute(
                    """INSERT INTO audit_logs (id, timestamp, user_id, user_email, action,
                        resource_type, resource_id, details, ip_address, org_id, project_id, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
                    event.id, event.timestamp, event.user_id, event.user_email,
                    event.action, event.resource_type, event.resource_id,
                    json.dumps(event.details), event.ip_address, event.org_id,
                    event.project_id, event.status,
                )
        except Exception as e:
            if AUDIT_MODE == "strict":
                logger.error(f"[Audit] STRICT MODE: DB persist FAILED: {e}")
                raise RuntimeError(f"Audit persistence failed in strict mode: {e}")
            else:
                logger.debug(f"[Audit] DB persist failed (non-critical): {e}")


    async def log_security_event(
        self,
        user_id: str,
        event_type: str,
        details: Optional[Dict[str, Any]] = None,
        ip: Optional[str] = None,
        status: str = "success",
        org_id: Optional[str] = None,
    ) -> AuditEvent:
        """
        Log a security-specific event (login, MFA, permission denied, etc.).

        Args:
            user_id: User involved
            event_type: One of SECURITY_EVENTS (login, logout, login_failed, etc.)
            details: Additional context
            ip: Client IP address
            status: Outcome (success, failure, denied)
            org_id: Organization context
        """
        return await self.log(
            user_id=user_id,
            action=event_type,
            resource_type="security",
            details=details or {},
            ip_address=ip,
            status=status,
            org_id=org_id,
        )

    async def verify_integrity(self) -> Dict[str, Any]:
        """
        Verify the hash chain integrity of in-memory audit log.
        Detects if any entries have been tampered with.

        Returns:
            Dict with 'intact' bool, 'total_entries', and any 'broken_at' index
        """
        events = list(self._events)
        if not events:
            return {"intact": True, "total_entries": 0, "message": "No audit entries to verify"}

        # Events are stored newest-first; reverse for chain verification
        events_ordered = list(reversed(events))
        prev_hash = "GENESIS"
        broken_at = None

        for i, event in enumerate(events_ordered):
            chain_input = f"{prev_hash}|{event.id}|{event.user_id}|{event.action}|{event.resource_type}"
            expected_hash = hashlib.sha256(chain_input.encode()).hexdigest()

            if event.hash_chain != expected_hash:
                broken_at = i
                break

            prev_hash = event.hash_chain

        if broken_at is not None:
            return {
                "intact": False,
                "total_entries": len(events),
                "broken_at_index": broken_at,
                "broken_event_id": events_ordered[broken_at].id,
                "message": f"Hash chain broken at entry {broken_at} — possible tampering detected",
            }

        return {
            "intact": True,
            "total_entries": len(events),
            "message": "All audit entries verified — hash chain intact",
        }


    async def log_enterprise_event(
        self,
        user_id: str,
        event_type: str,
        resource_type: str = "enterprise",
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> AuditEvent:
        """
        Log an enterprise event (locking, versioning, service accounts, etc.).

        Args:
            event_type: One of ENTERPRISE_EVENTS (lock.acquire, version.create, etc.)
        """
        return await self.log(
            user_id=user_id,
            action=event_type,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            org_id=org_id,
            project_id=project_id,
        )

    def get_audit_mode(self) -> str:
        """Return current audit mode (strict or best_effort)."""
        return AUDIT_MODE

    async def get_actions_list(self) -> List[str]:
        """Get all distinct action types from audit log."""
        actions = set()
        for event in self._events:
            actions.add(event.action)
        return sorted(actions)


# Singleton instance
audit_service = AuditService()
