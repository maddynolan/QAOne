"""
Authentication Service
Handles user registration, login, session management, and JWT token lifecycle.
Integrates with password_service for hashing and jwt_service for token generation.

Usage:
    from app.services.auth.auth_service import auth_service

    # Register new user
    user = await auth_service.register("email@example.com", "password123", "John Doe")

    # Login
    session = await auth_service.login("email@example.com", "password123")
    # session = { "token": "...", "user": {...}, "org": {...}, "project": {...} }

    # Get session from token
    session = await auth_service.get_session(token)
"""

import logging
import hashlib
import os
import secrets
import uuid
import json
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available"""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


# In-memory fallback stores
_users_store: Dict[str, Dict[str, Any]] = {}
_revoked_tokens: set = set()


class AuthService:
    """
    Core authentication service with PostgreSQL + in-memory fallback.
    """

    def __init__(self):
        self._jwt_service = None
        self._password_service = None

    @property
    def jwt_service(self):
        if not self._jwt_service:
            from app.services.auth.jwt_service import jwt_service
            self._jwt_service = jwt_service
        return self._jwt_service

    @property
    def password_service(self):
        if not self._password_service:
            from app.services.auth.password_service import PasswordService
            self._password_service = PasswordService()
        return self._password_service

    # ==================== Registration ====================

    async def register(
        self,
        email: str,
        password: str,
        name: str,
        org_name: Optional[str] = None,
        org_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Register a new user. Optionally creates a new organization or joins existing one.

        Returns:
            { "user": {...}, "org": {...}, "project": {...}, "token": "..." }
        """
        email = email.strip().lower()

        # Check if user already exists
        existing = await self._get_user_by_email(email)
        if existing:
            raise ValueError("User with this email already exists")

        # Hash password
        password_hash = self.password_service.hash_password(password)

        # Create user
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": email,
            "name": name,
            "password_hash": password_hash,
            "auth_provider": "local",
            "is_active": True,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        if _is_postgres_available():
            await self._create_user_pg(user)
        else:
            _users_store[email] = user

        # Find or create organization
        org = None
        project = None
        if org_id:
            org = await self._get_org(org_id)
        if not org and org_name:
            org = await self._create_org(org_name, user_id)
        if not org:
            org = await self._get_or_create_default_org()

        # Create org membership
        if org:
            await self._create_org_membership(user_id, org["id"], "admin" if not org_id else "member")

        # Find or create default project
        if org:
            project = await self._get_or_create_default_project(org["id"])
            if project:
                await self._create_project_membership(user_id, project["id"])

        # Auto-provision trial subscription for the org
        org_id_for_sub = org["id"] if org else None
        if org_id_for_sub:
            try:
                from app.services.core.subscription_service import subscription_service
                await subscription_service.create_trial(org_id_for_sub)
            except Exception as e:
                logger.warning(f"[Auth] Failed to create trial subscription: {e}")

        # Generate email verification token
        verification_token = secrets.token_urlsafe(32)
        await self._store_verification_token(user_id, verification_token)

        # Send verification email (non-blocking — don't fail registration if email fails)
        try:
            from app.services.core.email_service import email_service
            if email_service.is_configured:
                await email_service.send_verification_email(email, name, verification_token)
                logger.info(f"[Auth] Verification email sent to {email}")
            else:
                logger.warning(f"[Auth] SMTP not configured — skipping verification email for {email}")
        except Exception as e:
            logger.warning(f"[Auth] Failed to send verification email: {e}")

        # Return requires_verification instead of auto-login
        return {
            "requires_verification": True,
            "message": "Please check your email to verify your account",
            "user": {
                "id": user_id,
                "email": email,
                "name": name,
                "auth_provider": "local"
            },
            "org": org,
            "project": project
        }

    # ==================== Login ====================

    async def login(
        self,
        email: str,
        password: str,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate user with email and password.

        Returns:
            { "token": "...", "user": {...}, "org": {...}, "project": {...}, "roles": [...] }
        """
        email = email.strip().lower()

        # Find user
        user = await self._get_user_by_email(email)
        if not user:
            raise ValueError("Invalid email or password")

        if not user.get("is_active", True):
            raise ValueError("Account is deactivated")

        if user.get("auth_provider") and user.get("auth_provider") != "local":
            raise ValueError(f"This account uses {user.get('auth_provider')} SSO. Please use SSO to sign in.")

        # Verify password
        stored_hash = user.get("password_hash")
        if not stored_hash:
            raise ValueError("Invalid email or password")

        if not self.password_service.verify_password(password, stored_hash):
            raise ValueError("Invalid email or password")

        # Check email verification (skip for seed/legacy users who are pre-verified)
        if user.get("email_verified") is False:
            raise ValueError("Please verify your email before signing in. Check your inbox for a verification link.")

        # Get user's org and project
        org = await self._get_user_primary_org(user["id"])
        if not org:
            org = await self._get_or_create_default_org()
            if org:
                await self._create_org_membership(user["id"], org["id"], "member")

        project = None
        if project_id:
            project = await self._get_project(project_id)
        if not project and org:
            project = await self._get_user_primary_project(user["id"], org["id"])
        if not project and org:
            project = await self._get_or_create_default_project(org["id"])

        # Get roles
        roles = await self._get_user_roles(user["id"], org["id"] if org else None)

        # Get permissions
        permissions = await self._get_user_permissions(user["id"], org["id"] if org else None)

        # Generate JWT
        tenant_id = org["id"] if org else None
        proj_id = project["id"] if project else None
        token = self._generate_token(user, tenant_id, proj_id, roles, permissions)

        # Update last login
        await self._update_last_login(user["id"])

        # Load subscription data
        subscription = None
        if org:
            try:
                from app.services.core.subscription_service import subscription_service
                subscription = await subscription_service.get_subscription(org["id"])
            except Exception as e:
                logger.warning(f"[Auth] Failed to load subscription: {e}")

        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user.get("name", ""),
                "avatar_url": user.get("avatar_url"),
                "auth_provider": user.get("auth_provider", "local")
            },
            "org": org,
            "project": project,
            "roles": roles,
            "permissions": permissions,
            "subscription": subscription
        }

    # ==================== Session ====================

    async def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Restore a session from a JWT token.
        Returns full session data or None if token is invalid.
        """
        try:
            payload = self.jwt_service.validate_token(token)
        except Exception:
            return None

        # Check if token is revoked
        jti = payload.get("jti")
        if jti and await self._is_token_revoked(jti):
            return None

        user_id = payload.get("user_id") or payload.get("sub")
        if not user_id:
            return None

        user = await self._get_user_by_id(user_id)
        if not user or not user.get("is_active", True):
            return None

        tenant_id = payload.get("tenant_id")
        project_id = payload.get("project_id")

        org = await self._get_org(tenant_id) if tenant_id else None
        project = await self._get_project(project_id) if project_id else None

        roles = payload.get("roles", [])
        permissions = payload.get("permissions", [])

        # Load subscription data
        subscription = None
        if org:
            try:
                from app.services.core.subscription_service import subscription_service
                subscription = await subscription_service.get_subscription(org["id"])
            except Exception as e:
                logger.warning(f"[Auth] Failed to load subscription for session: {e}")

        return {
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user.get("name", ""),
                "avatar_url": user.get("avatar_url"),
                "auth_provider": user.get("auth_provider", "local")
            },
            "org": org,
            "project": project,
            "roles": roles,
            "permissions": permissions,
            "subscription": subscription
        }

    async def refresh_token(self, token: str) -> Optional[str]:
        """Refresh a JWT token. Returns new token or None if invalid."""
        try:
            return self.jwt_service.refresh_token(token)
        except Exception:
            return None

    async def logout(self, token: str) -> bool:
        """Revoke a JWT token (logout)."""
        try:
            payload = self.jwt_service.validate_token(token)
            jti = payload.get("jti")
            if jti:
                exp = payload.get("exp", 0)
                expires_at = datetime.utcfromtimestamp(exp)
                await self._revoke_token(jti, payload.get("user_id"), expires_at)
            return True
        except Exception:
            return False

    async def get_current_user(self, token: str) -> Optional[Dict[str, Any]]:
        """Get current user from token."""
        try:
            payload = self.jwt_service.validate_token(token)
            user_id = payload.get("user_id") or payload.get("sub")
            if user_id:
                return await self._get_user_by_id(user_id)
        except Exception:
            pass
        return None

    # ==================== SSO User Provisioning ====================

    async def provision_sso_user(
        self,
        email: str,
        name: str,
        auth_provider: str,
        idp_subject_id: str,
        org_id: str,
        roles: List[str] = None,
        project_roles: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Just-In-Time (JIT) provision or update a user from SSO login.
        Called by SAML/OIDC service after validating the assertion/token.

        Returns:
            { "token": "...", "user": {...}, "org": {...}, "project": {...} }
        """
        email = email.strip().lower()
        roles = roles or ["member"]

        # Check if user exists (by email or idp_subject_id)
        user = await self._get_user_by_email(email)
        if not user:
            user = await self._get_user_by_idp_subject(auth_provider, idp_subject_id)

        if user:
            # Update existing user
            await self._update_user_sso(user["id"], name, auth_provider, idp_subject_id)
        else:
            # Create new user (JIT provisioning)
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email,
                "name": name,
                "password_hash": None,
                "auth_provider": auth_provider,
                "idp_subject_id": idp_subject_id,
                "is_active": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            if _is_postgres_available():
                await self._create_user_pg(user)
            else:
                _users_store[email] = user

        # Ensure org membership with correct role
        org_role = roles[0] if roles else "member"
        await self._upsert_org_membership(user["id"], org_id, org_role)

        # Handle project role assignments
        if project_roles:
            for proj_id, proj_role in project_roles.items():
                await self._upsert_project_membership(user["id"], proj_id, proj_role)

        # Get org and project
        org = await self._get_org(org_id)
        project = await self._get_user_primary_project(user["id"], org_id)
        if not project:
            project = await self._get_or_create_default_project(org_id)

        # Get permissions
        permissions = await self._get_user_permissions(user["id"], org_id)

        # Generate JWT
        token = self._generate_token(
            user, org_id,
            project["id"] if project else None,
            roles, permissions
        )

        await self._update_last_login(user["id"])

        return {
            "token": token,
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user.get("name", name),
                "auth_provider": auth_provider
            },
            "org": org,
            "project": project,
            "roles": roles,
            "permissions": permissions
        }

    # ==================== Email Verification ====================

    async def _store_verification_token(self, user_id: str, token: str) -> None:
        """Store email verification token in database."""
        if _is_postgres_available():
            try:
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute(
                                """
                                INSERT INTO email_verification_tokens (user_id, token, expires_at)
                                VALUES (%s, %s, NOW() + INTERVAL '24 hours')
                                """,
                                (user_id, token)
                            )
                            conn.commit()
                    except Exception as e:
                        conn.rollback()
                        logger.error(f"Error storing verification token: {e}")
                    finally:
                        pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error storing verification token: {e}")

    async def verify_email(self, token: str) -> Dict[str, Any]:
        """
        Verify email using token. Returns user info on success.
        Marks user as verified and sends welcome email.
        """
        if not _is_postgres_available():
            raise ValueError("Email verification requires database")

        from app.services.storage.postgres_direct import execute_query, get_postgres_pool

        # Find the token
        results = await execute_query(
            """
            SELECT t.user_id, t.expires_at, t.used_at, u.email, u.name
            FROM email_verification_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = %s
            LIMIT 1
            """,
            (token,)
        )

        if not results:
            raise ValueError("Invalid verification token")

        row = results[0]
        user_id = row.get("user_id")
        email = row.get("email")
        name = row.get("name", "")

        if row.get("used_at"):
            raise ValueError("This verification link has already been used")

        expires_at = row.get("expires_at")
        if expires_at and isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
            raise ValueError("This verification link has expired. Please request a new one.")

        # Mark token as used and user as verified
        pool = get_postgres_pool()
        if pool:
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE email_verification_tokens SET used_at = NOW() WHERE token = %s",
                        (token,)
                    )
                    cur.execute(
                        "UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = %s",
                        (user_id,)
                    )
                    conn.commit()
            except Exception as e:
                conn.rollback()
                raise ValueError(f"Verification failed: {e}")
            finally:
                pool.putconn(conn)

        # Send welcome email with trial info
        try:
            from app.services.core.email_service import email_service
            from app.services.core.subscription_service import subscription_service

            # Get the user's org
            org = await self._get_user_primary_org(user_id)
            if org:
                sub = await subscription_service.get_subscription(org["id"])
                if sub and sub.get("trial_end"):
                    trial_end_str = sub["trial_end"]
                    trial_end = datetime.fromisoformat(trial_end_str.replace("Z", "+00:00"))
                    if email_service.is_configured:
                        await email_service.send_welcome_email(email, name, trial_end)
        except Exception as e:
            logger.warning(f"[Auth] Failed to send welcome email: {e}")

        return {"user_id": user_id, "email": email, "name": name, "verified": True}

    async def resend_verification(self, email: str) -> bool:
        """Generate a new verification token and resend the email."""
        user = await self._get_user_by_email(email)
        if not user:
            return False  # Don't reveal if email exists

        if user.get("email_verified"):
            return True  # Already verified

        # Generate new token
        new_token = secrets.token_urlsafe(32)
        await self._store_verification_token(user["id"], new_token)

        # Send email
        try:
            from app.services.core.email_service import email_service
            if email_service.is_configured:
                await email_service.send_verification_email(email, user.get("name", ""), new_token)
                return True
        except Exception as e:
            logger.error(f"[Auth] Failed to resend verification: {e}")

        return False

    # ==================== Token Helpers ====================

    def _generate_token(
        self,
        user: Dict[str, Any],
        tenant_id: Optional[str],
        project_id: Optional[str],
        roles: List[str] = None,
        permissions: List[str] = None
    ) -> str:
        """Generate JWT token with all context claims."""
        additional_claims = {}
        if project_id:
            additional_claims["project_id"] = project_id
        if user.get("name"):
            additional_claims["name"] = user["name"]

        return self.jwt_service.generate_token(
            user_id=user["id"],
            tenant_id=tenant_id or "",
            email=user.get("email"),
            roles=roles or [],
            permissions=permissions or [],
            additional_claims=additional_claims
        )

    # ==================== Database Helpers ====================

    async def _get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find user by email."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT id, email, name, password_hash, auth_provider, idp_subject_id, "
                "avatar_url, is_active, email_verified, email_verified_at, created_at "
                "FROM users WHERE email = %s LIMIT 1",
                (email,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        else:
            return _users_store.get(email)
        return None

    async def _get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Find user by ID."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT id, email, name, auth_provider, avatar_url, is_active, created_at "
                "FROM users WHERE id = %s LIMIT 1",
                (user_id,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        else:
            for u in _users_store.values():
                if u["id"] == user_id:
                    return u
        return None

    async def _get_user_by_idp_subject(self, auth_provider: str, idp_subject_id: str) -> Optional[Dict[str, Any]]:
        """Find user by IdP subject ID."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT id, email, name, password_hash, auth_provider, idp_subject_id, "
                "avatar_url, is_active FROM users WHERE auth_provider = %s AND idp_subject_id = %s LIMIT 1",
                (auth_provider, idp_subject_id)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        return None

    async def _create_user_pg(self, user: Dict[str, Any]) -> None:
        """Insert user into PostgreSQL."""
        from app.services.storage.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        if not pool:
            _users_store[user["email"]] = user
            return

        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (id, email, name, password_hash, auth_provider, idp_subject_id, is_active, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (email) DO NOTHING
                    """,
                    (
                        user["id"], user["email"], user.get("name", ""),
                        user.get("password_hash"), user.get("auth_provider", "local"),
                        user.get("idp_subject_id"), user.get("is_active", True)
                    )
                )
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Error creating user: {e}")
            raise
        finally:
            pool.putconn(conn)

    async def _update_user_sso(self, user_id: str, name: str, auth_provider: str, idp_subject_id: str) -> None:
        """Update user SSO fields."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE users SET name = %s, auth_provider = %s, idp_subject_id = %s, updated_at = NOW() WHERE id = %s",
                            (name, auth_provider, idp_subject_id, user_id)
                        )
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error updating user SSO: {e}")
                finally:
                    pool.putconn(conn)

    async def _update_last_login(self, user_id: str) -> None:
        """Update last_login_at timestamp."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE users SET last_login_at = NOW() WHERE id = %s",
                            (user_id,)
                        )
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error updating last login: {e}")
                finally:
                    pool.putconn(conn)

    # ==================== Org/Project Helpers ====================

    async def _get_org(self, org_id: str) -> Optional[Dict[str, Any]]:
        """Get organization by ID."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT id, name, slug, description, created_at FROM organizations WHERE id = %s LIMIT 1",
                (org_id,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        return None

    async def _get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project by ID."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT id, org_id, name, slug, description, created_at FROM projects WHERE id = %s LIMIT 1",
                (project_id,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        return None

    async def _get_user_primary_org(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's primary organization (first membership)."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                """
                SELECT o.id, o.name, o.slug, o.description, o.created_at
                FROM organizations o
                JOIN org_memberships om ON o.id = om.org_id
                WHERE om.user_id = %s
                ORDER BY om.created_at
                LIMIT 1
                """,
                (user_id,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        return None

    async def _get_user_primary_project(self, user_id: str, org_id: str) -> Optional[Dict[str, Any]]:
        """Get user's primary project in an org."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                """
                SELECT p.id, p.org_id, p.name, p.slug, p.description, p.created_at
                FROM projects p
                JOIN project_memberships pm ON p.id = pm.project_id
                WHERE pm.user_id = %s AND p.org_id = %s
                ORDER BY pm.created_at
                LIMIT 1
                """,
                (user_id, org_id)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
        return None

    async def _get_or_create_default_org(self) -> Optional[Dict[str, Any]]:
        """Get or create the default organization."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query, execute_insert
            results = await execute_query(
                "SELECT id, name, slug, description, created_at FROM organizations ORDER BY created_at LIMIT 1", ()
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
            # Create default
            org_id = str(uuid.uuid4())
            try:
                await execute_insert("organizations", {
                    "id": org_id, "name": "Default Organization", "slug": "default"
                })
                return {"id": org_id, "name": "Default Organization", "slug": "default"}
            except Exception as e:
                logger.error(f"Error creating default org: {e}")
        return None

    async def _get_or_create_default_project(self, org_id: str) -> Optional[Dict[str, Any]]:
        """Get or create default project for an org."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query, execute_insert
            results = await execute_query(
                "SELECT id, org_id, name, slug, description, created_at FROM projects WHERE org_id = %s ORDER BY created_at LIMIT 1",
                (org_id,)
            )
            if results:
                row = results[0]
                return row if isinstance(row, dict) else None
            # Create default
            project_id = str(uuid.uuid4())
            try:
                await execute_insert("projects", {
                    "id": project_id, "org_id": org_id, "name": "Default Project", "slug": "default"
                })
                return {"id": project_id, "org_id": org_id, "name": "Default Project", "slug": "default"}
            except Exception as e:
                logger.error(f"Error creating default project: {e}")
        return None

    async def _create_org(self, name: str, creator_id: str) -> Optional[Dict[str, Any]]:
        """Create a new organization."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_insert
            org_id = str(uuid.uuid4())
            slug = name.lower().replace(" ", "-").replace("_", "-")[:50]
            try:
                await execute_insert("organizations", {
                    "id": org_id, "name": name, "slug": slug
                })
                return {"id": org_id, "name": name, "slug": slug}
            except Exception as e:
                logger.error(f"Error creating org: {e}")
        return None

    async def _create_org_membership(self, user_id: str, org_id: str, role: str = "member") -> None:
        """Create org membership."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO org_memberships (user_id, org_id, role, created_at)
                            VALUES (%s, %s, %s, NOW())
                            ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role
                            """,
                            (user_id, org_id, role)
                        )
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error creating org membership: {e}")
                finally:
                    pool.putconn(conn)

    async def _upsert_org_membership(self, user_id: str, org_id: str, role: str = "member") -> None:
        """Create or update org membership."""
        await self._create_org_membership(user_id, org_id, role)

    async def _create_project_membership(self, user_id: str, project_id: str, role: str = "tester") -> None:
        """Create project membership."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO project_memberships (user_id, project_id, created_at)
                            VALUES (%s, %s, NOW())
                            ON CONFLICT (user_id, project_id) DO NOTHING
                            """,
                            (user_id, project_id)
                        )
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error creating project membership: {e}")
                finally:
                    pool.putconn(conn)

    async def _upsert_project_membership(self, user_id: str, project_id: str, role: str = "tester") -> None:
        """Create or update project membership with role."""
        await self._create_project_membership(user_id, project_id, role)

    async def _get_user_roles(self, user_id: str, org_id: Optional[str]) -> List[str]:
        """Get user's roles in an organization."""
        if _is_postgres_available() and org_id:
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT role FROM org_memberships WHERE user_id = %s AND org_id = %s",
                (user_id, org_id)
            )
            if results:
                row = results[0]
                role = row.get("role") if isinstance(row, dict) else (row[0] if isinstance(row, tuple) else None)
                return [role] if role else ["member"]
        return ["member"]

    async def _get_user_permissions(self, user_id: str, org_id: Optional[str]) -> List[str]:
        """Get user's permissions based on roles."""
        roles = await self._get_user_roles(user_id, org_id)
        # Map roles to permissions
        role_permissions = {
            "owner": ["*"],
            "admin": [
                "test_cases:create", "test_cases:read", "test_cases:update", "test_cases:delete",
                "test_runs:create", "test_runs:read", "test_runs:update", "test_runs:delete",
                "api_collections:create", "api_collections:read", "api_collections:update", "api_collections:delete",
                "perf_scenarios:create", "perf_scenarios:read", "perf_scenarios:update", "perf_scenarios:delete",
                "mobile_flows:create", "mobile_flows:read", "mobile_flows:update", "mobile_flows:delete",
                "visual_baselines:create", "visual_baselines:read", "visual_baselines:update", "visual_baselines:delete",
                "a11y_configs:create", "a11y_configs:read", "a11y_configs:update", "a11y_configs:delete",
                "locks:admin", "members:manage", "settings:manage"
            ],
            "member": [
                "test_cases:create", "test_cases:read", "test_cases:update",
                "test_runs:create", "test_runs:read", "test_runs:update",
                "api_collections:create", "api_collections:read", "api_collections:update",
                "perf_scenarios:read",
                "mobile_flows:create", "mobile_flows:read", "mobile_flows:update",
                "visual_baselines:read",
                "a11y_configs:read"
            ],
            "viewer": [
                "test_cases:read", "test_runs:read", "api_collections:read",
                "perf_scenarios:read", "mobile_flows:read", "visual_baselines:read", "a11y_configs:read"
            ]
        }
        permissions = set()
        for role in roles:
            perms = role_permissions.get(role, role_permissions["member"])
            permissions.update(perms)
        return list(permissions)

    # ==================== Token Revocation ====================

    async def _revoke_token(self, jti: str, user_id: Optional[str], expires_at: datetime) -> None:
        """Add token to revocation list."""
        _revoked_tokens.add(jti)
        if _is_postgres_available():
            from app.services.storage.postgres_direct import get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                            (jti, user_id, expires_at)
                        )
                        conn.commit()
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error revoking token: {e}")
                finally:
                    pool.putconn(conn)

    async def _is_token_revoked(self, jti: str) -> bool:
        """Check if a token has been revoked."""
        if jti in _revoked_tokens:
            return True
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                "SELECT jti FROM revoked_tokens WHERE jti = %s LIMIT 1", (jti,)
            )
            if results:
                _revoked_tokens.add(jti)
                return True
        return False

    # ==================== User Listing ====================

    async def list_org_members(self, org_id: str) -> List[Dict[str, Any]]:
        """List all members of an organization."""
        if _is_postgres_available():
            from app.services.storage.postgres_direct import execute_query
            results = await execute_query(
                """
                SELECT u.id, u.email, u.name, u.avatar_url, u.auth_provider,
                       u.last_login_at, u.is_active, om.role, om.created_at as joined_at
                FROM users u
                JOIN org_memberships om ON u.id = om.user_id
                WHERE om.org_id = %s
                ORDER BY om.created_at
                """,
                (org_id,)
            )
            return results or []
        return []


# Singleton instance
auth_service = AuthService()
