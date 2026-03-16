"""
Universal Artifact Locking Service — Check-out / Check-in (Tosca-style)

Provides exclusive edit locks on any artifact type (test_case, api_collection,
perf_scenario, mobile_flow, etc.) to prevent concurrent editing conflicts.

Features:
- Acquire / release / force-release locks
- Configurable expiration (default 4 hours)
- Admin force-release capability
- Lock history / audit trail
- PostgreSQL primary + in-memory fallback
- Background cleanup of expired locks

Usage:
    from app.services.core.locking_service import locking_service

    # Check out a test case for editing
    result = await locking_service.acquire_lock("test_case", tc_id, user_id)

    # Check lock status before saving
    lock = await locking_service.check_lock("test_case", tc_id)
    if lock["locked"] and lock["locked_by"] != user_id:
        raise HTTPException(409, "Artifact locked by another user")

    # Check in when done editing
    await locking_service.release_lock("test_case", tc_id, user_id)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

# Valid artifact types that can be locked
LOCKABLE_ARTIFACT_TYPES = {
    "test_case",
    "api_collection",
    "perf_scenario",
    "mobile_flow",
    "visual_baseline",
    "a11y_config",
    "test_plan",
    "defect",
    "requirement",
    "test_suite",
}

# Default lock duration in hours
DEFAULT_LOCK_DURATION_HOURS = 4
MAX_LOCK_DURATION_HOURS = 24


class LockingService:
    """
    Universal artifact locking service.
    PostgreSQL primary storage with in-memory fallback.
    """

    def __init__(self):
        self._pool = None
        # In-memory fallback: {(artifact_type, artifact_id): lock_dict}
        self._memory_locks: Dict[tuple, Dict[str, Any]] = {}
        # In-memory lock history
        self._memory_history: List[Dict[str, Any]] = []

    def _get_pool(self):
        """Get connection pool, lazy-loading if needed."""
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    # ==================== Acquire Lock ====================

    async def acquire_lock(
        self,
        artifact_type: str,
        artifact_id: str,
        user_id: str,
        user_name: str = "",
        project_id: Optional[str] = None,
        duration_hours: float = DEFAULT_LOCK_DURATION_HOURS,
        reason: str = "",
    ) -> Dict[str, Any]:
        """
        Acquire an exclusive lock on an artifact (check-out).

        Args:
            artifact_type: Type of artifact (test_case, api_collection, etc.)
            artifact_id: UUID of the artifact
            user_id: UUID of the user acquiring the lock
            user_name: Display name (for UI)
            project_id: Project context (for scoping)
            duration_hours: Lock expiration (default 4h, max 24h)
            reason: Optional reason for checking out

        Returns:
            {"success": True/False, "lock": {...}, "message": "..."}
        """
        if artifact_type not in LOCKABLE_ARTIFACT_TYPES:
            return {
                "success": False,
                "message": f"Invalid artifact type: {artifact_type}. Valid: {', '.join(sorted(LOCKABLE_ARTIFACT_TYPES))}",
            }

        duration_hours = min(duration_hours, MAX_LOCK_DURATION_HOURS)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=duration_hours)

        pool = self._get_pool()
        if pool:
            return await self._acquire_lock_pg(
                pool, artifact_type, artifact_id, user_id, user_name,
                project_id, expires_at, reason
            )
        else:
            return self._acquire_lock_memory(
                artifact_type, artifact_id, user_id, user_name,
                project_id, expires_at, reason
            )

    async def _acquire_lock_pg(
        self, pool, artifact_type, artifact_id, user_id, user_name,
        project_id, expires_at, reason
    ):
        """Acquire lock in PostgreSQL with atomic upsert."""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Check for existing non-expired lock by another user
                cur.execute(
                    """SELECT id, locked_by, locked_by_name, locked_at, lock_expires_at
                       FROM artifact_locks
                       WHERE artifact_type = %s AND artifact_id = %s""",
                    (artifact_type, artifact_id),
                )
                existing = cur.fetchone()

                if existing:
                    lock_id, locked_by, locked_by_name, locked_at, lock_expires = existing

                    # Check if lock expired
                    now = datetime.now(timezone.utc)
                    if lock_expires and lock_expires.replace(tzinfo=timezone.utc) < now:
                        # Expired — remove and allow re-lock
                        cur.execute(
                            "DELETE FROM artifact_locks WHERE id = %s", (lock_id,)
                        )
                        self._record_history_pg(
                            cur, artifact_type, artifact_id, project_id,
                            "expired", user_id, user_name, locked_by, ""
                        )
                    elif str(locked_by) == str(user_id):
                        # Already locked by same user — extend
                        cur.execute(
                            """UPDATE artifact_locks
                               SET lock_expires_at = %s, lock_reason = %s, lock_version = lock_version + 1
                               WHERE id = %s""",
                            (expires_at, reason, lock_id),
                        )
                        conn.commit()
                        return {
                            "success": True,
                            "message": "Lock extended",
                            "lock": {
                                "id": str(lock_id),
                                "artifact_type": artifact_type,
                                "artifact_id": str(artifact_id),
                                "locked_by": str(user_id),
                                "locked_by_name": user_name or locked_by_name,
                                "locked_at": locked_at.isoformat() if locked_at else None,
                                "lock_expires_at": expires_at.isoformat(),
                                "lock_reason": reason,
                            },
                        }
                    else:
                        # Locked by another user — conflict
                        return {
                            "success": False,
                            "message": f"Artifact is locked by {locked_by_name or locked_by}",
                            "lock": {
                                "locked_by": str(locked_by),
                                "locked_by_name": locked_by_name or "",
                                "locked_at": locked_at.isoformat() if locked_at else None,
                                "lock_expires_at": lock_expires.isoformat() if lock_expires else None,
                            },
                        }

                # Insert new lock
                lock_id = str(uuid4())
                cur.execute(
                    """INSERT INTO artifact_locks
                       (id, artifact_type, artifact_id, project_id, locked_by, locked_by_name,
                        locked_at, lock_expires_at, lock_reason)
                       VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, %s)""",
                    (lock_id, artifact_type, artifact_id, project_id,
                     user_id, user_name, expires_at, reason),
                )

                # Record history
                self._record_history_pg(
                    cur, artifact_type, artifact_id, project_id,
                    "acquired", user_id, user_name, None, reason
                )

                conn.commit()
                return {
                    "success": True,
                    "message": "Lock acquired",
                    "lock": {
                        "id": lock_id,
                        "artifact_type": artifact_type,
                        "artifact_id": str(artifact_id),
                        "locked_by": str(user_id),
                        "locked_by_name": user_name,
                        "locked_at": datetime.now(timezone.utc).isoformat(),
                        "lock_expires_at": expires_at.isoformat(),
                        "lock_reason": reason,
                    },
                }
        except Exception as e:
            conn.rollback()
            logger.error(f"Acquire lock error: {e}")
            # Fallback to memory
            return self._acquire_lock_memory(
                artifact_type, artifact_id, user_id, user_name,
                project_id, expires_at, reason
            )
        finally:
            pool.putconn(conn)

    def _acquire_lock_memory(
        self, artifact_type, artifact_id, user_id, user_name,
        project_id, expires_at, reason
    ):
        """In-memory fallback for lock acquisition."""
        key = (artifact_type, str(artifact_id))
        now = datetime.now(timezone.utc)

        if key in self._memory_locks:
            lock = self._memory_locks[key]
            # Check expiry
            exp = lock.get("lock_expires_at")
            if exp and isinstance(exp, datetime) and exp < now:
                del self._memory_locks[key]
            elif lock["locked_by"] == str(user_id):
                # Extend
                lock["lock_expires_at"] = expires_at
                lock["lock_reason"] = reason
                return {"success": True, "message": "Lock extended", "lock": lock}
            else:
                return {
                    "success": False,
                    "message": f"Artifact is locked by {lock.get('locked_by_name', lock['locked_by'])}",
                    "lock": lock,
                }

        lock = {
            "id": str(uuid4()),
            "artifact_type": artifact_type,
            "artifact_id": str(artifact_id),
            "project_id": project_id,
            "locked_by": str(user_id),
            "locked_by_name": user_name,
            "locked_at": now.isoformat(),
            "lock_expires_at": expires_at,
            "lock_reason": reason,
        }
        self._memory_locks[key] = lock
        self._memory_history.append({
            "artifact_type": artifact_type,
            "artifact_id": str(artifact_id),
            "action": "acquired",
            "performed_by": str(user_id),
            "performed_by_name": user_name,
            "created_at": now.isoformat(),
        })

        return {"success": True, "message": "Lock acquired", "lock": lock}

    # ==================== Release Lock ====================

    async def release_lock(
        self,
        artifact_type: str,
        artifact_id: str,
        user_id: str,
        user_name: str = "",
    ) -> Dict[str, Any]:
        """
        Release a lock on an artifact (check-in).
        Only the lock owner can release their own lock.
        """
        pool = self._get_pool()
        if pool:
            return await self._release_lock_pg(
                pool, artifact_type, artifact_id, user_id, user_name
            )
        else:
            return self._release_lock_memory(
                artifact_type, artifact_id, user_id, user_name
            )

    async def _release_lock_pg(self, pool, artifact_type, artifact_id, user_id, user_name):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, locked_by, project_id
                       FROM artifact_locks
                       WHERE artifact_type = %s AND artifact_id = %s""",
                    (artifact_type, artifact_id),
                )
                existing = cur.fetchone()

                if not existing:
                    return {"success": True, "message": "No lock found (already released)"}

                lock_id, locked_by, project_id = existing

                if str(locked_by) != str(user_id):
                    return {
                        "success": False,
                        "message": "Cannot release lock owned by another user. Use force-release with admin privileges.",
                    }

                cur.execute(
                    "DELETE FROM artifact_locks WHERE id = %s", (lock_id,)
                )
                self._record_history_pg(
                    cur, artifact_type, artifact_id, project_id,
                    "released", user_id, user_name, None, ""
                )
                conn.commit()
                return {"success": True, "message": "Lock released"}
        except Exception as e:
            conn.rollback()
            logger.error(f"Release lock error: {e}")
            return self._release_lock_memory(artifact_type, artifact_id, user_id, user_name)
        finally:
            pool.putconn(conn)

    def _release_lock_memory(self, artifact_type, artifact_id, user_id, user_name):
        key = (artifact_type, str(artifact_id))
        lock = self._memory_locks.get(key)
        if not lock:
            return {"success": True, "message": "No lock found (already released)"}
        if lock["locked_by"] != str(user_id):
            return {"success": False, "message": "Cannot release lock owned by another user"}
        del self._memory_locks[key]
        self._memory_history.append({
            "artifact_type": artifact_type,
            "artifact_id": str(artifact_id),
            "action": "released",
            "performed_by": str(user_id),
            "performed_by_name": user_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "message": "Lock released"}

    # ==================== Force Release (Admin) ====================

    async def force_release(
        self,
        artifact_type: str,
        artifact_id: str,
        admin_user_id: str,
        admin_user_name: str = "",
        reason: str = "",
    ) -> Dict[str, Any]:
        """
        Force-release a lock (admin action). Removes any lock regardless of owner.
        """
        pool = self._get_pool()
        if pool:
            return await self._force_release_pg(
                pool, artifact_type, artifact_id, admin_user_id, admin_user_name, reason
            )
        else:
            return self._force_release_memory(
                artifact_type, artifact_id, admin_user_id, admin_user_name, reason
            )

    async def _force_release_pg(self, pool, artifact_type, artifact_id, admin_user_id, admin_name, reason):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, locked_by, project_id
                       FROM artifact_locks
                       WHERE artifact_type = %s AND artifact_id = %s""",
                    (artifact_type, artifact_id),
                )
                existing = cur.fetchone()
                if not existing:
                    return {"success": True, "message": "No lock found"}

                lock_id, previous_owner, project_id = existing
                cur.execute("DELETE FROM artifact_locks WHERE id = %s", (lock_id,))
                self._record_history_pg(
                    cur, artifact_type, artifact_id, project_id,
                    "force_released", admin_user_id, admin_name,
                    previous_owner, reason
                )
                conn.commit()
                return {"success": True, "message": "Lock force-released by admin"}
        except Exception as e:
            conn.rollback()
            logger.error(f"Force release error: {e}")
            return self._force_release_memory(
                artifact_type, artifact_id, admin_user_id, admin_name, reason
            )
        finally:
            pool.putconn(conn)

    def _force_release_memory(self, artifact_type, artifact_id, admin_user_id, admin_name, reason):
        key = (artifact_type, str(artifact_id))
        lock = self._memory_locks.pop(key, None)
        self._memory_history.append({
            "artifact_type": artifact_type,
            "artifact_id": str(artifact_id),
            "action": "force_released",
            "performed_by": str(admin_user_id),
            "performed_by_name": admin_name,
            "previous_owner": lock["locked_by"] if lock else None,
            "reason": reason,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"success": True, "message": "Lock force-released by admin"}

    # ==================== Check Lock ====================

    async def check_lock(
        self,
        artifact_type: str,
        artifact_id: str,
    ) -> Dict[str, Any]:
        """
        Check if an artifact is locked.

        Returns:
            {"locked": bool, "locked_by": str, "locked_by_name": str, ...}
        """
        pool = self._get_pool()
        if pool:
            return await self._check_lock_pg(pool, artifact_type, artifact_id)
        else:
            return self._check_lock_memory(artifact_type, artifact_id)

    async def _check_lock_pg(self, pool, artifact_type, artifact_id):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, locked_by, locked_by_name, locked_at, lock_expires_at, lock_reason
                       FROM artifact_locks
                       WHERE artifact_type = %s AND artifact_id = %s""",
                    (artifact_type, artifact_id),
                )
                row = cur.fetchone()
                if not row:
                    return {"locked": False}

                lock_id, locked_by, locked_by_name, locked_at, lock_expires, lock_reason = row
                now = datetime.now(timezone.utc)

                if lock_expires and lock_expires.replace(tzinfo=timezone.utc) < now:
                    # Expired — clean up
                    cur.execute("DELETE FROM artifact_locks WHERE id = %s", (lock_id,))
                    conn.commit()
                    return {"locked": False}

                return {
                    "locked": True,
                    "lock_id": str(lock_id),
                    "locked_by": str(locked_by),
                    "locked_by_name": locked_by_name or "",
                    "locked_at": locked_at.isoformat() if locked_at else None,
                    "lock_expires_at": lock_expires.isoformat() if lock_expires else None,
                    "lock_reason": lock_reason or "",
                }
        except Exception as e:
            logger.error(f"Check lock error: {e}")
            return self._check_lock_memory(artifact_type, artifact_id)
        finally:
            pool.putconn(conn)

    def _check_lock_memory(self, artifact_type, artifact_id):
        key = (artifact_type, str(artifact_id))
        lock = self._memory_locks.get(key)
        if not lock:
            return {"locked": False}
        # Check expiry
        exp = lock.get("lock_expires_at")
        if exp and isinstance(exp, datetime) and exp < datetime.now(timezone.utc):
            del self._memory_locks[key]
            return {"locked": False}
        return {
            "locked": True,
            "lock_id": lock.get("id", ""),
            "locked_by": lock.get("locked_by", ""),
            "locked_by_name": lock.get("locked_by_name", ""),
            "locked_at": lock.get("locked_at"),
            "lock_expires_at": lock["lock_expires_at"].isoformat() if isinstance(lock.get("lock_expires_at"), datetime) else lock.get("lock_expires_at"),
            "lock_reason": lock.get("lock_reason", ""),
        }

    # ==================== Batch Check ====================

    async def check_locks_batch(
        self,
        artifact_type: str,
        artifact_ids: List[str],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Check lock status for multiple artifacts at once.
        Returns: {artifact_id: {"locked": bool, ...}}
        """
        pool = self._get_pool()
        if pool:
            return await self._check_locks_batch_pg(pool, artifact_type, artifact_ids)
        else:
            result = {}
            for aid in artifact_ids:
                result[aid] = self._check_lock_memory(artifact_type, aid)
            return result

    async def _check_locks_batch_pg(self, pool, artifact_type, artifact_ids):
        if not artifact_ids:
            return {}

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                placeholders = ", ".join(["%s"] * len(artifact_ids))
                cur.execute(
                    f"""SELECT artifact_id, locked_by, locked_by_name, locked_at, lock_expires_at
                        FROM artifact_locks
                        WHERE artifact_type = %s AND artifact_id IN ({placeholders})""",
                    (artifact_type, *artifact_ids),
                )
                rows = cur.fetchall()

                result = {aid: {"locked": False} for aid in artifact_ids}
                now = datetime.now(timezone.utc)

                for row in rows:
                    aid, locked_by, locked_by_name, locked_at, lock_expires = row
                    if lock_expires and lock_expires.replace(tzinfo=timezone.utc) < now:
                        continue  # expired
                    result[str(aid)] = {
                        "locked": True,
                        "locked_by": str(locked_by),
                        "locked_by_name": locked_by_name or "",
                        "locked_at": locked_at.isoformat() if locked_at else None,
                        "lock_expires_at": lock_expires.isoformat() if lock_expires else None,
                    }
                return result
        except Exception as e:
            logger.error(f"Batch check lock error: {e}")
            result = {}
            for aid in artifact_ids:
                result[aid] = self._check_lock_memory(artifact_type, aid)
            return result
        finally:
            pool.putconn(conn)

    # ==================== Guard Check (for write endpoints) ====================

    async def is_locked_by_other(
        self,
        artifact_type: str,
        artifact_id: str,
        user_id: str,
    ) -> bool:
        """
        Quick check: is this artifact locked by someone OTHER than user_id?
        Use this in PUT/DELETE endpoints before allowing writes.
        """
        lock = await self.check_lock(artifact_type, artifact_id)
        if not lock.get("locked"):
            return False
        return lock.get("locked_by") != str(user_id)

    # ==================== List My Locks ====================

    async def list_user_locks(
        self,
        user_id: str,
        project_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List all locks held by a user (optionally within a project)."""
        pool = self._get_pool()
        if pool:
            return await self._list_user_locks_pg(pool, user_id, project_id)
        else:
            return self._list_user_locks_memory(user_id, project_id)

    async def _list_user_locks_pg(self, pool, user_id, project_id):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                if project_id:
                    cur.execute(
                        """SELECT id, artifact_type, artifact_id, locked_at, lock_expires_at, lock_reason
                           FROM artifact_locks
                           WHERE locked_by = %s AND project_id = %s
                           ORDER BY locked_at DESC""",
                        (user_id, project_id),
                    )
                else:
                    cur.execute(
                        """SELECT id, artifact_type, artifact_id, locked_at, lock_expires_at, lock_reason
                           FROM artifact_locks
                           WHERE locked_by = %s
                           ORDER BY locked_at DESC""",
                        (user_id,),
                    )
                rows = cur.fetchall()
                return [
                    {
                        "id": str(r[0]),
                        "artifact_type": r[1],
                        "artifact_id": str(r[2]),
                        "locked_at": r[3].isoformat() if r[3] else None,
                        "lock_expires_at": r[4].isoformat() if r[4] else None,
                        "lock_reason": r[5] or "",
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"List user locks error: {e}")
            return self._list_user_locks_memory(user_id, project_id)
        finally:
            pool.putconn(conn)

    def _list_user_locks_memory(self, user_id, project_id):
        locks = []
        for key, lock in self._memory_locks.items():
            if lock["locked_by"] == str(user_id):
                if project_id and lock.get("project_id") != project_id:
                    continue
                locks.append(lock)
        return locks

    # ==================== List All Locks (project scope) ====================

    async def list_project_locks(
        self,
        project_id: str,
    ) -> List[Dict[str, Any]]:
        """List all active locks in a project."""
        pool = self._get_pool()
        if pool:
            return await self._list_project_locks_pg(pool, project_id)
        else:
            return [
                lock for lock in self._memory_locks.values()
                if lock.get("project_id") == project_id
            ]

    async def _list_project_locks_pg(self, pool, project_id):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, artifact_type, artifact_id, locked_by, locked_by_name,
                              locked_at, lock_expires_at, lock_reason
                       FROM artifact_locks
                       WHERE project_id = %s
                       ORDER BY locked_at DESC""",
                    (project_id,),
                )
                rows = cur.fetchall()
                return [
                    {
                        "id": str(r[0]),
                        "artifact_type": r[1],
                        "artifact_id": str(r[2]),
                        "locked_by": str(r[3]),
                        "locked_by_name": r[4] or "",
                        "locked_at": r[5].isoformat() if r[5] else None,
                        "lock_expires_at": r[6].isoformat() if r[6] else None,
                        "lock_reason": r[7] or "",
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"List project locks error: {e}")
            return [
                lock for lock in self._memory_locks.values()
                if lock.get("project_id") == project_id
            ]
        finally:
            pool.putconn(conn)

    # ==================== Lock History ====================

    async def get_lock_history(
        self,
        artifact_type: str,
        artifact_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get lock history for an artifact."""
        pool = self._get_pool()
        if pool:
            return await self._get_lock_history_pg(pool, artifact_type, artifact_id, limit)
        else:
            history = [
                h for h in self._memory_history
                if h.get("artifact_type") == artifact_type
                and h.get("artifact_id") == str(artifact_id)
            ]
            return history[-limit:]

    async def _get_lock_history_pg(self, pool, artifact_type, artifact_id, limit):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, action, performed_by, performed_by_name,
                              previous_owner, reason, created_at
                       FROM artifact_lock_history
                       WHERE artifact_type = %s AND artifact_id = %s
                       ORDER BY created_at DESC
                       LIMIT %s""",
                    (artifact_type, artifact_id, limit),
                )
                rows = cur.fetchall()
                return [
                    {
                        "id": str(r[0]),
                        "action": r[1],
                        "performed_by": str(r[2]) if r[2] else None,
                        "performed_by_name": r[3] or "",
                        "previous_owner": str(r[4]) if r[4] else None,
                        "reason": r[5] or "",
                        "created_at": r[6].isoformat() if r[6] else None,
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"Get lock history error: {e}")
            return []
        finally:
            pool.putconn(conn)

    # ==================== Cleanup Expired Locks ====================

    async def cleanup_expired_locks(self) -> int:
        """Remove expired locks. Call periodically (e.g., every 5 minutes)."""
        pool = self._get_pool()
        if pool:
            return await self._cleanup_expired_pg(pool)
        else:
            return self._cleanup_expired_memory()

    async def _cleanup_expired_pg(self, pool):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """DELETE FROM artifact_locks
                       WHERE lock_expires_at IS NOT NULL
                       AND lock_expires_at < NOW()
                       RETURNING artifact_type, artifact_id, locked_by, project_id""",
                )
                deleted = cur.fetchall()
                for row in deleted:
                    self._record_history_pg(
                        cur, row[0], row[1], row[3],
                        "expired", None, "system", row[2], "Auto-expired"
                    )
                conn.commit()
                if deleted:
                    logger.info(f"Cleaned up {len(deleted)} expired locks")
                return len(deleted)
        except Exception as e:
            conn.rollback()
            logger.error(f"Cleanup expired locks error: {e}")
            return 0
        finally:
            pool.putconn(conn)

    def _cleanup_expired_memory(self):
        now = datetime.now(timezone.utc)
        expired_keys = []
        for key, lock in self._memory_locks.items():
            exp = lock.get("lock_expires_at")
            if exp and isinstance(exp, datetime) and exp < now:
                expired_keys.append(key)
        for key in expired_keys:
            del self._memory_locks[key]
        return len(expired_keys)

    # ==================== Helper: Record History ====================

    def _record_history_pg(
        self, cur, artifact_type, artifact_id, project_id,
        action, performed_by, performed_by_name, previous_owner, reason
    ):
        """Insert a lock history record (call within existing transaction)."""
        try:
            cur.execute(
                """INSERT INTO artifact_lock_history
                   (artifact_type, artifact_id, project_id, action,
                    performed_by, performed_by_name, previous_owner, reason)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (artifact_type, str(artifact_id), project_id, action,
                 performed_by, performed_by_name, previous_owner, reason),
            )
        except Exception as e:
            logger.warning(f"Failed to record lock history: {e}")


# ==================== Global Instance ====================

locking_service = LockingService()
