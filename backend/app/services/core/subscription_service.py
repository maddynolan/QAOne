"""
Subscription Service — Trial and plan management for Flowstral SaaS.

Manages organization subscriptions, auto-provisions 14-day trials on signup,
checks trial status, sends warning emails, and enforces plan limits.

Usage:
    from app.services.core.subscription_service import subscription_service

    sub = await subscription_service.create_trial(org_id)
    status = await subscription_service.get_subscription(org_id)
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


# Plan tier definitions
PLAN_LIMITS = {
    "trial": {"max_users": 10, "max_test_runs_per_month": 5000, "max_projects": 5},
    "free": {"max_users": 3, "max_test_runs_per_month": 1000, "max_projects": 1},
    "pro": {"max_users": 25, "max_test_runs_per_month": 50000, "max_projects": 20},
    "enterprise": {"max_users": 999999, "max_test_runs_per_month": 999999, "max_projects": 999999},
}


def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available."""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SubscriptionService:
    """
    Manages organization subscriptions and trial periods.
    PostgreSQL-backed with in-memory fallback for development.
    """

    def __init__(self):
        self._memory_store: Dict[str, Dict[str, Any]] = {}

    # ==================== Create Trial ====================

    async def create_trial(self, org_id: str) -> Dict[str, Any]:
        """
        Auto-create a 14-day trial for a new organization.
        Called from auth_service.register() after creating the org.
        """
        now = _now()
        trial_end = now + timedelta(days=14)
        limits = PLAN_LIMITS["trial"]

        sub = {
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "plan": "trial",
            "status": "active",
            "trial_start": now.isoformat(),
            "trial_end": trial_end.isoformat(),
            "max_users": limits["max_users"],
            "max_test_runs_per_month": limits["max_test_runs_per_month"],
            "max_projects": limits["max_projects"],
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

        if _is_postgres_available():
            try:
                await self._create_trial_pg(sub)
            except Exception as e:
                logger.error(f"[Subscription] Failed to create trial in DB: {e}")
                self._memory_store[org_id] = sub
        else:
            self._memory_store[org_id] = sub

        logger.info(f"[Subscription] Created 14-day trial for org {org_id}, expires {trial_end.isoformat()}")
        return sub

    async def _create_trial_pg(self, sub: Dict) -> None:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        conn = pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO subscriptions (id, org_id, plan, status, trial_start, trial_end,
                    max_users, max_test_runs_per_month, max_projects, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (org_id) DO UPDATE SET
                    plan = EXCLUDED.plan, status = EXCLUDED.status,
                    trial_start = EXCLUDED.trial_start, trial_end = EXCLUDED.trial_end,
                    max_users = EXCLUDED.max_users,
                    max_test_runs_per_month = EXCLUDED.max_test_runs_per_month,
                    max_projects = EXCLUDED.max_projects,
                    updated_at = EXCLUDED.updated_at
            """, (
                sub["id"], sub["org_id"], sub["plan"], sub["status"],
                sub["trial_start"], sub["trial_end"],
                sub["max_users"], sub["max_test_runs_per_month"], sub["max_projects"],
                sub["created_at"], sub["updated_at"],
            ))
            conn.commit()
        finally:
            pool.putconn(conn)

    # ==================== Get Subscription ====================

    async def get_subscription(self, org_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the current subscription for an org, with computed days_remaining.
        Returns None if no subscription exists.
        """
        sub = None

        if _is_postgres_available():
            try:
                sub = await self._get_subscription_pg(org_id)
            except Exception as e:
                logger.error(f"[Subscription] DB query failed: {e}")

        if not sub:
            sub = self._memory_store.get(org_id)

        if not sub:
            return None

        # Compute days remaining
        now = _now()
        trial_end = sub.get("trial_end")
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
        if trial_end and trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)

        days_remaining = -1  # -1 = unlimited (paid plans)
        if sub["plan"] == "trial" and trial_end:
            delta = (trial_end - now).total_seconds()
            days_remaining = max(0, int(delta / 86400))

            # Auto-expire if trial has ended
            if days_remaining == 0 and sub["status"] == "active":
                await self.expire_trial(org_id)
                sub["status"] = "expired"
                sub["plan"] = "free"

        sub["days_remaining"] = days_remaining
        return sub

    async def _get_subscription_pg(self, org_id: str) -> Optional[Dict]:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        conn = pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT id, org_id, plan, status, trial_start, trial_end,
                       paid_start, paid_end, stripe_customer_id, stripe_subscription_id,
                       max_users, max_test_runs_per_month, max_projects,
                       warning_7d_sent, warning_3d_sent, warning_1d_sent, expired_email_sent,
                       created_at, updated_at
                FROM subscriptions WHERE org_id = %s
            """, (org_id,))
            row = cur.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cur.description]
            result = dict(zip(cols, row))
            # Convert datetimes to ISO strings for consistency
            for k in ("trial_start", "trial_end", "paid_start", "paid_end", "created_at", "updated_at"):
                if result.get(k) and isinstance(result[k], datetime):
                    result[k] = result[k].isoformat()
            return result
        finally:
            pool.putconn(conn)

    # ==================== Expire Trial ====================

    async def expire_trial(self, org_id: str) -> None:
        """Mark trial as expired and downgrade to free tier."""
        now = _now()
        free_limits = PLAN_LIMITS["free"]

        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                        UPDATE subscriptions SET
                            status = 'expired', plan = 'free',
                            max_users = %s, max_test_runs_per_month = %s, max_projects = %s,
                            updated_at = %s
                        WHERE org_id = %s
                    """, (free_limits["max_users"], free_limits["max_test_runs_per_month"],
                          free_limits["max_projects"], now.isoformat(), org_id))
                    conn.commit()
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"[Subscription] Failed to expire trial: {e}")

        # Update in-memory
        if org_id in self._memory_store:
            self._memory_store[org_id]["status"] = "expired"
            self._memory_store[org_id]["plan"] = "free"
            self._memory_store[org_id].update(free_limits)

        logger.info(f"[Subscription] Trial expired for org {org_id}, downgraded to free")

    # ==================== Upgrade Plan ====================

    async def upgrade_plan(
        self,
        org_id: str,
        plan: str,
        paid_start: Optional[str] = None,
        paid_end: Optional[str] = None,
        stripe_customer_id: Optional[str] = None,
        stripe_subscription_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Upgrade or change plan for an org. Admin action."""
        now = _now()
        limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                        UPDATE subscriptions SET
                            plan = %s, status = 'active',
                            paid_start = %s, paid_end = %s,
                            stripe_customer_id = %s, stripe_subscription_id = %s,
                            max_users = %s, max_test_runs_per_month = %s, max_projects = %s,
                            updated_at = %s
                        WHERE org_id = %s
                    """, (plan, paid_start, paid_end, stripe_customer_id, stripe_subscription_id,
                          limits["max_users"], limits["max_test_runs_per_month"],
                          limits["max_projects"], now.isoformat(), org_id))
                    conn.commit()
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"[Subscription] Failed to upgrade plan: {e}")

        # Update in-memory
        if org_id in self._memory_store:
            self._memory_store[org_id].update({
                "plan": plan, "status": "active",
                **limits, "updated_at": now.isoformat(),
            })

        logger.info(f"[Subscription] Org {org_id} upgraded to {plan}")
        return await self.get_subscription(org_id) or {}

    # ==================== Extend Trial ====================

    async def extend_trial(self, org_id: str, extra_days: int = 14) -> Dict[str, Any]:
        """Extend a trial by additional days. Admin action."""
        now = _now()

        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    cur = conn.cursor()
                    cur.execute("""
                        UPDATE subscriptions SET
                            trial_end = trial_end + INTERVAL '%s days',
                            status = 'active', plan = 'trial',
                            warning_7d_sent = false, warning_3d_sent = false,
                            warning_1d_sent = false, expired_email_sent = false,
                            updated_at = %s
                        WHERE org_id = %s
                    """, (extra_days, now.isoformat(), org_id))
                    conn.commit()
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"[Subscription] Failed to extend trial: {e}")

        logger.info(f"[Subscription] Extended trial for org {org_id} by {extra_days} days")
        return await self.get_subscription(org_id) or {}

    # ==================== Check & Send Warnings ====================

    async def check_and_send_warnings(self) -> int:
        """
        Check all active trials and send warning emails for 7d/3d/1d remaining.
        Also send expired notification. Returns count of emails sent.
        """
        if not _is_postgres_available():
            return 0

        from app.services.core.email_service import email_service
        sent_count = 0

        try:
            from app.services.storage.database import get_database_client
            pool = get_database_client()
            conn = pool.getconn()
            try:
                cur = conn.cursor()

                # Find trials ending within 7 days
                cur.execute("""
                    SELECT s.id, s.org_id, s.trial_end, s.status,
                           s.warning_7d_sent, s.warning_3d_sent, s.warning_1d_sent, s.expired_email_sent,
                           u.email, u.name
                    FROM subscriptions s
                    JOIN org_memberships om ON om.org_id = s.org_id AND om.role = 'owner'
                    JOIN users u ON u.id = om.user_id
                    WHERE s.plan = 'trial' AND s.status = 'active'
                      AND s.trial_end <= NOW() + INTERVAL '8 days'
                """)
                rows = cur.fetchall()

                now = _now()
                for row in rows:
                    sub_id, org_id, trial_end, status, w7, w3, w1, expired_sent, email, name = row
                    if trial_end.tzinfo is None:
                        trial_end = trial_end.replace(tzinfo=timezone.utc)
                    days = max(0, int((trial_end - now).total_seconds() / 86400))

                    if days == 0 and not expired_sent:
                        # Trial expired
                        await email_service.send_trial_expired_email(email, name)
                        cur.execute("UPDATE subscriptions SET expired_email_sent = true WHERE id = %s", (sub_id,))
                        await self.expire_trial(org_id)
                        sent_count += 1
                    elif days <= 1 and not w1:
                        await email_service.send_trial_warning_email(email, name, 1)
                        cur.execute("UPDATE subscriptions SET warning_1d_sent = true WHERE id = %s", (sub_id,))
                        sent_count += 1
                    elif days <= 3 and not w3:
                        await email_service.send_trial_warning_email(email, name, 3)
                        cur.execute("UPDATE subscriptions SET warning_3d_sent = true WHERE id = %s", (sub_id,))
                        sent_count += 1
                    elif days <= 7 and not w7:
                        await email_service.send_trial_warning_email(email, name, 7)
                        cur.execute("UPDATE subscriptions SET warning_7d_sent = true WHERE id = %s", (sub_id,))
                        sent_count += 1

                conn.commit()
            finally:
                pool.putconn(conn)

        except Exception as e:
            logger.error(f"[Subscription] Warning check failed: {e}")

        if sent_count:
            logger.info(f"[Subscription] Sent {sent_count} trial warning email(s)")
        return sent_count

    # ==================== Enforce Limits ====================

    async def enforce_limits(self, org_id: str, resource: str, current_count: int = 0) -> bool:
        """
        Check if org is within plan limits.
        resource: 'users', 'test_runs', 'projects'
        Returns True if within limits, False if exceeded.
        """
        sub = await self.get_subscription(org_id)
        if not sub:
            return True  # No subscription = no limits (backward compat)

        limit_map = {
            "users": sub.get("max_users", 999999),
            "test_runs": sub.get("max_test_runs_per_month", 999999),
            "projects": sub.get("max_projects", 999999),
        }

        limit = limit_map.get(resource, 999999)
        return current_count < limit


# Singleton
subscription_service = SubscriptionService()
