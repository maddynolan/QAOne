"""
Compliance Report Service — SOC 2, HIPAA, GDPR, ISO 27001 Evidence Reports

Generates compliance evidence reports by aggregating audit logs, access records,
change history, and security configurations.

Usage:
    from app.services.core.compliance_report_service import compliance_report_service

    report = await compliance_report_service.generate_soc2_report(
        org_id=org_id,
        start_date="2026-01-01",
        end_date="2026-03-31",
        generated_by=admin_user_id
    )
"""

import csv
import io
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class ComplianceReportService:
    """Generates compliance evidence reports from audit trails and system state."""

    def __init__(self):
        self._pool = None

    def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    # ==================== SOC 2 Type II ====================

    async def generate_soc2_report(
        self,
        org_id: str,
        start_date: str,
        end_date: str,
        generated_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate SOC 2 Type II evidence report.
        Covers: Access Controls, Change Management, System Availability,
        Confidentiality, Processing Integrity.
        """
        report_id = str(uuid4())
        start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)

        pool = self._get_pool()
        sections = {}

        # CC6.1 — Logical Access Controls
        sections["CC6.1_access_controls"] = {
            "title": "Logical Access Controls",
            "users": await self._get_user_access_summary(pool, org_id),
            "service_accounts": await self._get_service_account_summary(pool, org_id),
            "sso_enabled": await self._check_sso_status(pool, org_id),
            "mfa_status": await self._get_mfa_status(pool, org_id),
        }

        # CC6.2 — User Provisioning
        sections["CC6.2_provisioning"] = {
            "title": "User Provisioning & Deprovisioning",
            "new_users": await self._count_events(pool, org_id, "user.create", start, end),
            "deactivated_users": await self._count_events(pool, org_id, "user.deactivate", start, end),
            "role_changes": await self._count_events(pool, org_id, "role.change", start, end),
        }

        # CC8.1 — Change Management
        sections["CC8.1_change_management"] = {
            "title": "Change Management",
            "total_changes": await self._count_artifact_versions(pool, org_id, start, end),
            "change_types": await self._get_change_type_breakdown(pool, org_id, start, end),
            "lock_events": await self._count_events(pool, org_id, "lock.", start, end),
        }

        # A1.1 — System Availability
        sections["A1.1_availability"] = {
            "title": "System Availability",
            "period": f"{start_date} to {end_date}",
            "note": "Uptime metrics from monitoring system. Check Grafana/Prometheus.",
        }

        # C1.1 — Confidentiality
        sections["C1.1_confidentiality"] = {
            "title": "Confidentiality Controls",
            "encryption_at_rest": "AES-256 (PostgreSQL TDE or volume encryption)",
            "encryption_in_transit": "TLS 1.2/1.3 enforced",
            "api_key_storage": "SHA-256 hashed, prefix only stored",
            "secrets_encryption": "Fernet symmetric encryption (FERNET_KEY env)",
        }

        # Audit trail summary
        sections["audit_trail"] = {
            "title": "Audit Trail Summary",
            "total_events": await self._count_all_audit_events(pool, org_id, start, end),
            "event_categories": await self._get_audit_event_categories(pool, org_id, start, end),
        }

        report = {
            "id": report_id,
            "type": "soc2",
            "title": f"SOC 2 Type II Evidence Report — {start_date} to {end_date}",
            "org_id": org_id,
            "date_range": {"start": start_date, "end": end_date},
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": generated_by,
            "sections": sections,
        }

        # Persist report
        await self._save_report(pool, report)

        return report

    # ==================== HIPAA ====================

    async def generate_hipaa_report(
        self,
        org_id: str,
        start_date: str,
        end_date: str,
        generated_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate HIPAA audit trail report.
        Covers: Access logs, PHI access patterns, authentication events.
        """
        report_id = str(uuid4())
        start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)

        pool = self._get_pool()

        sections = {
            "access_controls": {
                "title": "Access Control (164.312(a))",
                "unique_users": await self._count_unique_users(pool, org_id, start, end),
                "failed_logins": await self._count_events(pool, org_id, "auth.login_failed", start, end),
                "successful_logins": await self._count_events(pool, org_id, "auth.login", start, end),
            },
            "audit_controls": {
                "title": "Audit Controls (164.312(b))",
                "total_events": await self._count_all_audit_events(pool, org_id, start, end),
                "data_access_events": await self._count_events(pool, org_id, "data.", start, end),
            },
            "integrity_controls": {
                "title": "Integrity Controls (164.312(c))",
                "total_modifications": await self._count_artifact_versions(pool, org_id, start, end),
                "version_control_enabled": True,
            },
            "transmission_security": {
                "title": "Transmission Security (164.312(e))",
                "tls_enforced": True,
                "api_authentication": "JWT + API Key",
            },
        }

        report = {
            "id": report_id,
            "type": "hipaa",
            "title": f"HIPAA Audit Report — {start_date} to {end_date}",
            "org_id": org_id,
            "date_range": {"start": start_date, "end": end_date},
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": generated_by,
            "sections": sections,
        }

        await self._save_report(pool, report)
        return report

    # ==================== GDPR ====================

    async def generate_gdpr_report(
        self,
        org_id: str,
        user_id: Optional[str] = None,
        generated_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate GDPR data subject access report.
        If user_id is provided, generates per-user report (DSAR).
        Otherwise generates organizational privacy report.
        """
        report_id = str(uuid4())
        pool = self._get_pool()

        sections = {}

        if user_id:
            # Data Subject Access Request (DSAR)
            sections["personal_data"] = {
                "title": "Personal Data Held",
                "user_record": await self._get_user_data(pool, user_id),
                "activity_count": await self._count_user_activities(pool, user_id),
            }
            sections["data_processing"] = {
                "title": "Data Processing Activities",
                "purposes": [
                    "Test case management and execution",
                    "User authentication and authorization",
                    "Audit trail and compliance logging",
                ],
            }
            sections["data_retention"] = {
                "title": "Data Retention",
                "policy": "User data retained while account is active. "
                          "Deleted within 30 days of account closure per GDPR Art. 17.",
            }
        else:
            # Organizational privacy report
            sections["data_inventory"] = {
                "title": "Data Inventory",
                "total_users": await self._count_org_users(pool, org_id),
                "data_categories": [
                    "User profiles (name, email)",
                    "Authentication logs",
                    "Test artifacts",
                    "Audit trail events",
                ],
            }
            sections["processing_basis"] = {
                "title": "Legal Basis for Processing",
                "basis": "Legitimate interest (service delivery) + Consent (account creation)",
            }
            sections["technical_measures"] = {
                "title": "Technical & Organizational Measures (Art. 32)",
                "encryption": "AES-256 at rest, TLS 1.2+ in transit",
                "access_control": "RBAC with project-level permissions",
                "pseudonymization": "Service account tokens hashed with SHA-256",
                "audit_logging": "All data access and modifications logged",
            }

        report = {
            "id": report_id,
            "type": "gdpr",
            "title": f"GDPR {'DSAR' if user_id else 'Privacy'} Report",
            "org_id": org_id,
            "user_id": user_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": generated_by,
            "sections": sections,
        }

        await self._save_report(pool, report)
        return report

    # ==================== Access Review ====================

    async def generate_access_review(
        self,
        org_id: str,
        generated_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate user access review report for quarterly/annual reviews.
        Lists all users, their roles, last activity, and access patterns.
        """
        report_id = str(uuid4())
        pool = self._get_pool()

        users = await self._get_all_user_access(pool, org_id)
        service_accounts = await self._get_service_account_summary(pool, org_id)

        # Flag potential issues
        issues = []
        for user in users:
            if user.get("last_login_at"):
                last = datetime.fromisoformat(user["last_login_at"].replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - last).days > 90:
                    issues.append({
                        "type": "inactive_user",
                        "user_id": user["id"],
                        "user_name": user.get("name", ""),
                        "last_login": user["last_login_at"],
                        "recommendation": "Review and consider deactivating",
                    })

        report = {
            "id": report_id,
            "type": "access_review",
            "title": "User Access Review",
            "org_id": org_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": generated_by,
            "summary": {
                "total_users": len(users),
                "total_service_accounts": len(service_accounts),
                "issues_found": len(issues),
            },
            "users": users,
            "service_accounts": service_accounts,
            "issues": issues,
        }

        await self._save_report(pool, report)
        return report

    # ==================== List Reports ====================

    async def list_reports(
        self,
        org_id: str,
        report_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """List generated compliance reports."""
        pool = self._get_pool()
        if not pool:
            return []

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                if report_type:
                    cur.execute(
                        """SELECT id, report_type, title, date_range_start, date_range_end,
                                  summary, status, generated_by, created_at
                           FROM compliance_reports
                           WHERE org_id = %s AND report_type = %s
                           ORDER BY created_at DESC LIMIT %s""",
                        (org_id, report_type, limit),
                    )
                else:
                    cur.execute(
                        """SELECT id, report_type, title, date_range_start, date_range_end,
                                  summary, status, generated_by, created_at
                           FROM compliance_reports
                           WHERE org_id = %s
                           ORDER BY created_at DESC LIMIT %s""",
                        (org_id, limit),
                    )
                return [
                    {
                        "id": str(r[0]),
                        "report_type": r[1],
                        "title": r[2],
                        "date_range_start": r[3].isoformat() if r[3] else None,
                        "date_range_end": r[4].isoformat() if r[4] else None,
                        "summary": r[5] or {},
                        "status": r[6],
                        "generated_by": str(r[7]) if r[7] else None,
                        "created_at": r[8].isoformat() if r[8] else None,
                    }
                    for r in cur.fetchall()
                ]
        except Exception as e:
            logger.error(f"List reports error: {e}")
            return []
        finally:
            pool.putconn(conn)

    async def get_report(self, report_id: str, org_id: str) -> Optional[Dict[str, Any]]:
        """Get a full compliance report by ID."""
        pool = self._get_pool()
        if not pool:
            return None

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT report_data FROM compliance_reports
                       WHERE id = %s AND org_id = %s""",
                    (report_id, org_id),
                )
                row = cur.fetchone()
                if row:
                    return row[0]
        except Exception as e:
            logger.error(f"Get report error: {e}")
        finally:
            pool.putconn(conn)
        return None

    # ==================== Export Audit Trail ====================

    async def export_audit_trail(
        self,
        org_id: str,
        start_date: str,
        end_date: str,
        format: str = "csv",
    ) -> Dict[str, Any]:
        """Export audit trail as CSV or JSON for compliance evidence."""
        pool = self._get_pool()
        if not pool:
            return {"success": False, "message": "Database not available"}

        start = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT action, user_id, resource_type, resource_id,
                              details, ip_address, created_at
                       FROM audit_logs
                       WHERE org_id = %s AND created_at BETWEEN %s AND %s
                       ORDER BY created_at ASC""",
                    (org_id, start, end),
                )
                rows = cur.fetchall()

                records = [
                    {
                        "action": r[0],
                        "user_id": str(r[1]) if r[1] else "",
                        "resource_type": r[2] or "",
                        "resource_id": str(r[3]) if r[3] else "",
                        "details": json.dumps(r[4]) if r[4] else "",
                        "ip_address": r[5] or "",
                        "timestamp": r[6].isoformat() if r[6] else "",
                    }
                    for r in rows
                ]

                if format == "csv":
                    output = io.StringIO()
                    writer = csv.DictWriter(output, fieldnames=[
                        "action", "user_id", "resource_type", "resource_id",
                        "details", "ip_address", "timestamp"
                    ])
                    writer.writeheader()
                    writer.writerows(records)
                    content = output.getvalue()
                else:
                    content = json.dumps(records, indent=2)

                return {
                    "success": True,
                    "format": format,
                    "records": len(records),
                    "content": content,
                }
        except Exception as e:
            logger.error(f"Export audit trail error: {e}")
            return {"success": False, "message": "Export failed"}
        finally:
            pool.putconn(conn)

    # ==================== Private Helpers ====================

    async def _save_report(self, pool, report: Dict):
        """Persist a compliance report to the database."""
        if not pool:
            return

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO compliance_reports
                       (id, org_id, report_type, title, date_range_start, date_range_end,
                        report_data, summary, generated_by)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        report["id"],
                        report["org_id"],
                        report["type"],
                        report["title"],
                        report.get("date_range", {}).get("start"),
                        report.get("date_range", {}).get("end"),
                        json.dumps(report),
                        json.dumps(report.get("summary", {})),
                        report.get("generated_by"),
                    ),
                )
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Save report error: {e}")
        finally:
            pool.putconn(conn)

    async def _get_user_access_summary(self, pool, org_id: str) -> List[Dict]:
        if not pool:
            return []
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT u.id, u.name, u.email, u.is_active, u.last_login_at,
                              om.role
                       FROM users u
                       JOIN org_memberships om ON om.user_id = u.id
                       WHERE om.org_id = %s
                       ORDER BY u.name""",
                    (org_id,),
                )
                return [
                    {
                        "id": str(r[0]),
                        "name": r[1],
                        "email": r[2],
                        "is_active": r[3],
                        "last_login_at": r[4].isoformat() if r[4] else None,
                        "role": r[5],
                    }
                    for r in cur.fetchall()
                ]
        except Exception:
            return []
        finally:
            pool.putconn(conn)

    async def _get_all_user_access(self, pool, org_id: str) -> List[Dict]:
        return await self._get_user_access_summary(pool, org_id)

    async def _get_service_account_summary(self, pool, org_id: str) -> List[Dict]:
        if not pool:
            return []
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, name, is_active, permissions, last_used_at, usage_count
                       FROM service_accounts
                       WHERE org_id = %s
                       ORDER BY name""",
                    (org_id,),
                )
                return [
                    {
                        "id": str(r[0]),
                        "name": r[1],
                        "is_active": r[2],
                        "permissions": r[3] or [],
                        "last_used_at": r[4].isoformat() if r[4] else None,
                        "usage_count": r[5] or 0,
                    }
                    for r in cur.fetchall()
                ]
        except Exception:
            return []
        finally:
            pool.putconn(conn)

    async def _check_sso_status(self, pool, org_id: str) -> bool:
        if not pool:
            return False
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT is_enabled FROM sso_configurations WHERE org_id = %s AND is_enabled = true",
                    (org_id,),
                )
                return bool(cur.fetchone())
        except Exception:
            return False
        finally:
            pool.putconn(conn)

    async def _get_mfa_status(self, pool, org_id: str) -> Dict:
        # Check users with MFA enabled
        return {"note": "MFA status tracked per-user via mfa_service"}

    async def _count_events(self, pool, org_id, action_prefix, start, end) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(*) FROM audit_logs
                       WHERE org_id = %s AND action LIKE %s
                       AND created_at BETWEEN %s AND %s""",
                    (org_id, f"{action_prefix}%", start, end),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)

    async def _count_all_audit_events(self, pool, org_id, start, end) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(*) FROM audit_logs
                       WHERE org_id = %s AND created_at BETWEEN %s AND %s""",
                    (org_id, start, end),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)

    async def _get_audit_event_categories(self, pool, org_id, start, end) -> Dict:
        if not pool:
            return {}
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT
                         SPLIT_PART(action, '.', 1) as category,
                         COUNT(*) as count
                       FROM audit_logs
                       WHERE org_id = %s AND created_at BETWEEN %s AND %s
                       GROUP BY category
                       ORDER BY count DESC""",
                    (org_id, start, end),
                )
                return {r[0]: r[1] for r in cur.fetchall()}
        except Exception:
            return {}
        finally:
            pool.putconn(conn)

    async def _count_artifact_versions(self, pool, org_id, start, end) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(*) FROM artifact_versions av
                       JOIN projects p ON av.project_id = p.id
                       WHERE p.org_id = %s AND av.created_at BETWEEN %s AND %s""",
                    (org_id, start, end),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)

    async def _get_change_type_breakdown(self, pool, org_id, start, end) -> Dict:
        if not pool:
            return {}
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT change_type, COUNT(*) FROM artifact_versions av
                       JOIN projects p ON av.project_id = p.id
                       WHERE p.org_id = %s AND av.created_at BETWEEN %s AND %s
                       GROUP BY change_type""",
                    (org_id, start, end),
                )
                return {r[0]: r[1] for r in cur.fetchall()}
        except Exception:
            return {}
        finally:
            pool.putconn(conn)

    async def _count_unique_users(self, pool, org_id, start, end) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT COUNT(DISTINCT user_id) FROM audit_logs
                       WHERE org_id = %s AND created_at BETWEEN %s AND %s""",
                    (org_id, start, end),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)

    async def _get_user_data(self, pool, user_id: str) -> Optional[Dict]:
        if not pool:
            return None
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, name, email, created_at, last_login_at, is_active FROM users WHERE id = %s",
                    (user_id,),
                )
                r = cur.fetchone()
                if r:
                    return {
                        "id": str(r[0]),
                        "name": r[1],
                        "email": r[2],
                        "created_at": r[3].isoformat() if r[3] else None,
                        "last_login_at": r[4].isoformat() if r[4] else None,
                        "is_active": r[5],
                    }
        except Exception:
            pass
        finally:
            pool.putconn(conn)
        return None

    async def _count_user_activities(self, pool, user_id: str) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM audit_logs WHERE user_id = %s",
                    (user_id,),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)

    async def _count_org_users(self, pool, org_id: str) -> int:
        if not pool:
            return 0
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM org_memberships WHERE org_id = %s",
                    (org_id,),
                )
                return cur.fetchone()[0]
        except Exception:
            return 0
        finally:
            pool.putconn(conn)


# ==================== Global Instance ====================

compliance_report_service = ComplianceReportService()
