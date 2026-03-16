"""
Service Account Service — CI/CD and Programmatic API Tokens

Provides long-lived API tokens for CI/CD pipelines, automation scripts,
and external integrations. Tokens are scoped to specific permissions and
projects within an organization.

Token format: qaai_<random_32_chars>
Only the hash is stored; the raw token is returned once on creation.

Usage:
    from app.services.auth.service_account_service import service_account_service

    # Create a service account
    result = await service_account_service.create(
        org_id=org_id,
        name="CI Pipeline",
        permissions=["test_cases:read", "test_runs:create"],
        project_ids=[project_id],
        created_by=admin_user_id
    )
    raw_token = result["token"]  # Show once, never stored

    # Validate a token from X-API-Key header
    account = await service_account_service.validate_token(raw_token)
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)

TOKEN_PREFIX = "qaai_"
TOKEN_LENGTH = 32  # chars of random data


class ServiceAccountService:
    """Service account management with PostgreSQL + in-memory fallback."""

    def __init__(self):
        self._pool = None
        # In-memory fallback
        self._memory_accounts: Dict[str, Dict[str, Any]] = {}  # id -> account
        self._memory_tokens: Dict[str, str] = {}  # token_hash -> account_id

    def _get_pool(self):
        if self._pool:
            return self._pool
        try:
            from app.services.storage.database import get_database_client
            self._pool = get_database_client()
            return self._pool
        except Exception:
            return None

    def _generate_token(self) -> tuple:
        """Generate a new API token. Returns (raw_token, token_hash, token_prefix)."""
        raw = TOKEN_PREFIX + secrets.token_urlsafe(TOKEN_LENGTH)
        token_hash = hashlib.sha256(raw.encode()).hexdigest()
        prefix = raw[:len(TOKEN_PREFIX) + 8]
        return raw, token_hash, prefix

    def _hash_token(self, raw_token: str) -> str:
        """Hash a raw token for lookup."""
        return hashlib.sha256(raw_token.encode()).hexdigest()

    # ==================== Create ====================

    async def create(
        self,
        org_id: str,
        name: str,
        permissions: List[str] = None,
        project_ids: List[str] = None,
        description: str = "",
        expires_days: Optional[int] = None,
        created_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new service account and generate an API token.
        The raw token is returned ONCE and never stored.
        """
        raw_token, token_hash, token_prefix = self._generate_token()
        permissions = permissions or []
        project_ids = project_ids or []

        expires_at = None
        if expires_days and expires_days > 0:
            from datetime import timedelta
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

        account_id = str(uuid4())

        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """INSERT INTO service_accounts
                           (id, org_id, name, description, token_hash, token_prefix,
                            permissions, project_ids, expires_at, created_by)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                        (account_id, org_id, name, description, token_hash, token_prefix,
                         permissions, project_ids, expires_at, created_by),
                    )
                    conn.commit()
            except Exception as e:
                conn.rollback()
                if "unique" in str(e).lower():
                    return {"success": False, "message": f"Service account '{name}' already exists in this org"}
                logger.error(f"Create service account error: {e}")
                raise
            finally:
                pool.putconn(conn)
        else:
            # Memory fallback
            self._memory_accounts[account_id] = {
                "id": account_id,
                "org_id": org_id,
                "name": name,
                "description": description,
                "token_hash": token_hash,
                "token_prefix": token_prefix,
                "permissions": permissions,
                "project_ids": project_ids,
                "expires_at": expires_at,
                "is_active": True,
                "created_by": created_by,
                "created_at": datetime.now(timezone.utc),
                "usage_count": 0,
            }
            self._memory_tokens[token_hash] = account_id

        return {
            "success": True,
            "id": account_id,
            "name": name,
            "token": raw_token,  # ONLY returned here, never again
            "token_prefix": token_prefix,
            "permissions": permissions,
            "project_ids": project_ids,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "message": "Service account created. Save the token — it cannot be retrieved later.",
        }

    # ==================== Validate Token ====================

    async def validate_token(
        self,
        raw_token: str,
        ip_address: str = "",
        user_agent: str = "",
        endpoint: str = "",
    ) -> Optional[Dict[str, Any]]:
        """
        Validate an API token and return the service account info.
        Returns None if invalid/expired/inactive.
        Also logs usage and updates last_used_at.
        """
        if not raw_token or not raw_token.startswith(TOKEN_PREFIX):
            return None

        token_hash = self._hash_token(raw_token)

        pool = self._get_pool()
        if pool:
            return await self._validate_token_pg(pool, token_hash, ip_address, user_agent, endpoint)
        else:
            return self._validate_token_memory(token_hash)

    async def _validate_token_pg(self, pool, token_hash, ip_address, user_agent, endpoint):
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, org_id, name, permissions, project_ids, expires_at, is_active
                       FROM service_accounts
                       WHERE token_hash = %s""",
                    (token_hash,),
                )
                row = cur.fetchone()
                if not row:
                    return None

                sa_id, org_id, name, permissions, project_ids, expires_at, is_active = row

                if not is_active:
                    return None

                if expires_at and expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                    return None

                # Update usage
                cur.execute(
                    """UPDATE service_accounts
                       SET last_used_at = NOW(), last_used_ip = %s, usage_count = usage_count + 1
                       WHERE id = %s""",
                    (ip_address, sa_id),
                )

                # Log activity
                try:
                    cur.execute(
                        """INSERT INTO service_account_activity
                           (service_account_id, action, endpoint, ip_address, user_agent, status_code)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (sa_id, "api_call", endpoint, ip_address, user_agent[:500] if user_agent else None, 200),
                    )
                except Exception:
                    pass

                conn.commit()

                return {
                    "id": str(sa_id),
                    "org_id": str(org_id),
                    "name": name,
                    "permissions": permissions or [],
                    "project_ids": [str(p) for p in (project_ids or [])],
                    "type": "service_account",
                }
        except Exception as e:
            conn.rollback()
            logger.error(f"Validate token error: {e}")
            return None
        finally:
            pool.putconn(conn)

    def _validate_token_memory(self, token_hash):
        account_id = self._memory_tokens.get(token_hash)
        if not account_id:
            return None
        account = self._memory_accounts.get(account_id)
        if not account or not account.get("is_active"):
            return None
        if account.get("expires_at") and account["expires_at"] < datetime.now(timezone.utc):
            return None
        account["usage_count"] = account.get("usage_count", 0) + 1
        return {
            "id": account["id"],
            "org_id": account["org_id"],
            "name": account["name"],
            "permissions": account.get("permissions", []),
            "project_ids": account.get("project_ids", []),
            "type": "service_account",
        }

    # ==================== List ====================

    async def list_accounts(self, org_id: str) -> List[Dict[str, Any]]:
        """List all service accounts for an organization (no tokens shown)."""
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """SELECT id, name, description, token_prefix, permissions, project_ids,
                                  last_used_at, usage_count, expires_at, is_active, created_at
                           FROM service_accounts
                           WHERE org_id = %s
                           ORDER BY created_at DESC""",
                        (org_id,),
                    )
                    rows = cur.fetchall()
                    return [
                        {
                            "id": str(r[0]),
                            "name": r[1],
                            "description": r[2] or "",
                            "token_prefix": r[3],
                            "permissions": r[4] or [],
                            "project_ids": [str(p) for p in (r[5] or [])],
                            "last_used_at": r[6].isoformat() if r[6] else None,
                            "usage_count": r[7] or 0,
                            "expires_at": r[8].isoformat() if r[8] else None,
                            "is_active": r[9],
                            "created_at": r[10].isoformat() if r[10] else None,
                        }
                        for r in rows
                    ]
            except Exception as e:
                logger.error(f"List service accounts error: {e}")
                return []
            finally:
                pool.putconn(conn)
        else:
            return [
                {k: v for k, v in acct.items() if k != "token_hash"}
                for acct in self._memory_accounts.values()
                if acct.get("org_id") == org_id
            ]

    # ==================== Revoke ====================

    async def revoke(self, account_id: str, org_id: str) -> bool:
        """Revoke (deactivate) a service account."""
        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE service_accounts SET is_active = false, updated_at = NOW()
                           WHERE id = %s AND org_id = %s""",
                        (account_id, org_id),
                    )
                    updated = cur.rowcount > 0
                    conn.commit()
                    return updated
            except Exception as e:
                conn.rollback()
                logger.error(f"Revoke service account error: {e}")
                return False
            finally:
                pool.putconn(conn)
        else:
            acct = self._memory_accounts.get(account_id)
            if acct and acct.get("org_id") == org_id:
                acct["is_active"] = False
                return True
            return False

    # ==================== Regenerate Token ====================

    async def regenerate_token(self, account_id: str, org_id: str) -> Optional[Dict[str, Any]]:
        """Regenerate the API token for a service account. Old token is invalidated."""
        raw_token, token_hash, token_prefix = self._generate_token()

        pool = self._get_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """UPDATE service_accounts
                           SET token_hash = %s, token_prefix = %s, updated_at = NOW()
                           WHERE id = %s AND org_id = %s
                           RETURNING name""",
                        (token_hash, token_prefix, account_id, org_id),
                    )
                    row = cur.fetchone()
                    if not row:
                        return None
                    conn.commit()
                    return {
                        "id": account_id,
                        "name": row[0],
                        "token": raw_token,
                        "token_prefix": token_prefix,
                        "message": "Token regenerated. Save the new token — it cannot be retrieved later.",
                    }
            except Exception as e:
                conn.rollback()
                logger.error(f"Regenerate token error: {e}")
                return None
            finally:
                pool.putconn(conn)
        else:
            acct = self._memory_accounts.get(account_id)
            if acct and acct.get("org_id") == org_id:
                # Remove old hash
                old_hash = acct.get("token_hash")
                if old_hash in self._memory_tokens:
                    del self._memory_tokens[old_hash]
                acct["token_hash"] = token_hash
                acct["token_prefix"] = token_prefix
                self._memory_tokens[token_hash] = account_id
                return {"id": account_id, "name": acct["name"], "token": raw_token, "token_prefix": token_prefix}
            return None


# ==================== Global Instance ====================

service_account_service = ServiceAccountService()
