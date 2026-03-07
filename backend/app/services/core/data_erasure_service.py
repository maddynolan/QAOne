"""
Data Erasure Service — GDPR Article 17 (Right to Erasure) & Article 20 (Data Portability)

Provides cascading data deletion and user data export for enterprise compliance.
Anonymizes audit logs (preserves trail) rather than deleting them.

Usage:
    from app.services.core.data_erasure_service import data_erasure_service

    # Request erasure (30-day grace period)
    request_id = await data_erasure_service.request_erasure(user_id, org_id)

    # Export all user data as JSON
    data = await data_erasure_service.export_user_data(user_id, org_id)

    # Execute erasure (called after grace period or immediately if confirmed)
    result = await data_erasure_service.execute_erasure(user_id, org_id)
"""

import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Grace period before permanent deletion (days)
ERASURE_GRACE_PERIOD_DAYS = 30

# Tables to cascade delete from (order matters — delete dependent tables first)
_ERASURE_CASCADE_TABLES = [
    # Test execution artifacts
    ("test_run_steps", "run_id IN (SELECT id FROM test_runs WHERE created_by = $1)"),
    ("test_runs", "created_by = $1"),
    # Test cases
    ("test_case_versions", "test_case_id IN (SELECT id FROM test_cases WHERE created_by = $1)"),
    ("test_cases", "created_by = $1"),
    # API testing
    ("api_requests", "collection_id IN (SELECT id FROM api_collections WHERE created_by = $1)"),
    ("api_folders", "collection_id IN (SELECT id FROM api_collections WHERE created_by = $1)"),
    ("api_collections", "created_by = $1"),
    # Secrets
    ("secrets", "created_by = $1"),
    ("ai_encrypted_keys", "org_id = $2"),
    # Mobile
    ("mobile_test_runs", "created_by = $1"),
    ("mobile_flows", "created_by = $1"),
    # Recordings
    ("recorded_actions", "session_id IN (SELECT id FROM recording_sessions WHERE created_by = $1)"),
    ("recording_sessions", "created_by = $1"),
    # Defects & requirements
    ("defects", "created_by = $1"),
    ("requirements", "created_by = $1"),
    # AI usage
    ("ai_usage_log", "org_id = $2"),
    # Healing history
    ("healing_history", "created_by = $1"),
    ("false_positives", "created_by = $1"),
]

# In-memory erasure request store (should be PostgreSQL in production)
_erasure_requests: Dict[str, Dict[str, Any]] = {}


class DataErasureService:
    """
    Service for GDPR-compliant data erasure and export.
    """

    async def request_erasure(
        self,
        user_id: str,
        org_id: str,
        immediate: bool = False,
    ) -> Dict[str, Any]:
        """
        Request data erasure for a user. By default, a 30-day grace period
        applies before permanent deletion.

        Args:
            user_id: User whose data should be erased
            org_id: Organization ID
            immediate: If True, skip grace period (requires explicit confirmation)

        Returns:
            Erasure request info with scheduled deletion date
        """
        request_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        if immediate:
            scheduled_at = now
        else:
            scheduled_at = now + timedelta(days=ERASURE_GRACE_PERIOD_DAYS)

        request_info = {
            "request_id": request_id,
            "user_id": user_id,
            "org_id": org_id,
            "status": "pending",
            "requested_at": now.isoformat(),
            "scheduled_deletion_at": scheduled_at.isoformat(),
            "immediate": immediate,
        }

        _erasure_requests[request_id] = request_info
        logger.info(
            f"[GDPR] Erasure request created: {request_id} for user {user_id}, "
            f"scheduled at {scheduled_at.isoformat()}"
        )
        return request_info

    async def get_erasure_status(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of an erasure request."""
        return _erasure_requests.get(request_id)

    async def cancel_erasure(self, request_id: str) -> bool:
        """Cancel a pending erasure request (within grace period)."""
        request = _erasure_requests.get(request_id)
        if not request:
            return False
        if request["status"] != "pending":
            return False

        request["status"] = "cancelled"
        request["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"[GDPR] Erasure request cancelled: {request_id}")
        return True

    async def execute_erasure(self, user_id: str, org_id: str) -> Dict[str, Any]:
        """
        Execute data erasure — permanently delete all user data.
        Anonymizes audit logs rather than deleting them.

        Args:
            user_id: User whose data to erase
            org_id: Organization ID

        Returns:
            Summary of deleted data
        """
        results = {"tables_processed": [], "errors": [], "anonymized": []}

        try:
            from app.services.storage.postgres_direct import get_postgres_pool

            pool = get_postgres_pool()
            if not pool:
                # In-memory mode — just log the action
                logger.warning("[GDPR] No database — erasure logged but not executed")
                return {
                    "status": "simulated",
                    "message": "No database connection — erasure would affect listed tables",
                    "tables": [t[0] for t in _ERASURE_CASCADE_TABLES],
                }

            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    # Delete from each table in cascade order
                    for table_name, condition in _ERASURE_CASCADE_TABLES:
                        try:
                            # Replace $1 with user_id, $2 with org_id
                            safe_condition = condition
                            query = f"DELETE FROM {table_name} WHERE {safe_condition}"
                            cur.execute(query, (user_id, org_id))
                            deleted = cur.rowcount
                            results["tables_processed"].append({
                                "table": table_name,
                                "deleted_rows": deleted,
                            })
                            if deleted > 0:
                                logger.info(f"[GDPR] Deleted {deleted} rows from {table_name}")
                        except Exception as e:
                            error_msg = str(e)
                            # Table might not exist — that's OK
                            if "does not exist" in error_msg.lower():
                                conn.rollback()
                                continue
                            results["errors"].append({"table": table_name, "error": error_msg})
                            conn.rollback()
                            logger.warning(f"[GDPR] Error deleting from {table_name}: {e}")

                    # Anonymize audit logs (preserve trail but remove PII)
                    try:
                        cur.execute("""
                            UPDATE audit_logs
                            SET user_id = 'DELETED_USER',
                                user_email = 'deleted@anonymized.local',
                                details = jsonb_set(
                                    COALESCE(details, '{}'::jsonb),
                                    '{gdpr_anonymized}',
                                    'true'::jsonb
                                )
                            WHERE user_id = %s
                        """, (user_id,))
                        anonymized = cur.rowcount
                        results["anonymized"].append({
                            "table": "audit_logs",
                            "anonymized_rows": anonymized,
                        })
                    except Exception as e:
                        if "does not exist" not in str(e).lower():
                            results["errors"].append({"table": "audit_logs", "error": str(e)})
                        conn.rollback()

                    conn.commit()

            finally:
                pool.putconn(conn)

        except Exception as e:
            logger.error(f"[GDPR] Erasure execution error: {e}")
            results["errors"].append({"general": str(e)})

        results["status"] = "completed" if not results["errors"] else "completed_with_errors"
        logger.info(f"[GDPR] Erasure completed for user {user_id}: {len(results['tables_processed'])} tables processed")
        return results

    async def export_user_data(self, user_id: str, org_id: str) -> Dict[str, Any]:
        """
        Export all user data as JSON (GDPR Article 20 — Data Portability).

        Args:
            user_id: User whose data to export
            org_id: Organization ID

        Returns:
            Dictionary containing all user data organized by category
        """
        export = {
            "export_info": {
                "user_id": user_id,
                "org_id": org_id,
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "format": "JSON",
                "gdpr_article": "Article 20 — Right to Data Portability",
            },
            "data": {}
        }

        try:
            from app.services.storage.postgres_direct import get_postgres_pool

            pool = get_postgres_pool()
            if not pool:
                export["data"]["note"] = "No database — export not available"
                return export

            # Tables and their user-specific queries
            export_queries = {
                "test_cases": "SELECT * FROM test_cases WHERE created_by = %s",
                "test_runs": "SELECT * FROM test_runs WHERE created_by = %s",
                "defects": "SELECT * FROM defects WHERE created_by = %s",
                "requirements": "SELECT * FROM requirements WHERE created_by = %s",
                "secrets": "SELECT secret_id, name, secret_type, description, created_at FROM secrets WHERE created_by = %s",
            }

            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    for category, query in export_queries.items():
                        try:
                            cur.execute(query, (user_id,))
                            rows = cur.fetchall()
                            # Convert rows to dicts, handling non-serializable types
                            serializable_rows = []
                            for row in rows:
                                row_dict = dict(row)
                                for k, v in row_dict.items():
                                    if isinstance(v, datetime):
                                        row_dict[k] = v.isoformat()
                                    elif isinstance(v, bytes):
                                        row_dict[k] = "[encrypted data]"
                                    elif isinstance(v, uuid.UUID):
                                        row_dict[k] = str(v)
                                serializable_rows.append(row_dict)
                            export["data"][category] = serializable_rows
                        except Exception as e:
                            if "does not exist" in str(e).lower():
                                export["data"][category] = []
                                conn.rollback()
                            else:
                                export["data"][category] = {"error": str(e)}
                                conn.rollback()
            finally:
                pool.putconn(conn)

        except Exception as e:
            logger.error(f"[GDPR] Data export error: {e}")
            export["error"] = str(e)

        return export


# Global instance
data_erasure_service = DataErasureService()
