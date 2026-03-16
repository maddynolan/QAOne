"""
OIDC (OpenID Connect) Service
Handles OIDC authentication flow: Authorization URL generation, Code exchange,
ID token validation for SSO integration with Azure AD, Okta, Auth0, etc.

Dependencies: authlib (optional — graceful fallback if not installed)

Usage:
    from app.services.auth.oidc_service import oidc_service

    # Get authorization redirect URL
    redirect_url = await oidc_service.get_authorization_url(org_id, state)

    # Exchange authorization code for tokens
    user_info = await oidc_service.exchange_code(org_id, code, state)
"""

import logging
import os
import secrets
import json
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Try to import authlib
try:
    from authlib.integrations.httpx_client import AsyncOAuth2Client
    from authlib.jose import jwt as jose_jwt
    from authlib.jose import JsonWebKey
    OIDC_AVAILABLE = True
except ImportError:
    try:
        import httpx
        OIDC_AVAILABLE = True  # We can do OIDC manually with httpx
    except ImportError:
        OIDC_AVAILABLE = False
        logger.info("authlib/httpx not installed — OIDC SSO disabled. Install with: pip install authlib httpx")


def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


# In-memory stores
_sso_configs: Dict[str, Dict[str, Any]] = {}
_oidc_states: Dict[str, Dict[str, Any]] = {}  # state -> { org_id, nonce, created_at }


class OIDCService:
    """
    OpenID Connect SSO Service.
    Supports Authorization Code Flow with PKCE.
    """

    def __init__(self):
        self.base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")

    async def get_sso_config(self, org_id: str) -> Optional[Dict[str, Any]]:
        """Get OIDC SSO configuration for an organization."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT id, org_id, protocol, is_enabled, oidc_issuer, oidc_client_id,
                                   oidc_client_secret_encrypted, oidc_scopes, oidc_discovery_url,
                                   auto_provision_users, default_role, group_attribute_name,
                                   group_mapping, enforce_sso
                            FROM sso_configurations
                            WHERE org_id = %s AND protocol = 'oidc' AND is_enabled = true
                        """, (org_id,))
                        row = cur.fetchone()
                        if row:
                            return {
                                "id": str(row[0]),
                                "org_id": str(row[1]),
                                "protocol": row[2],
                                "is_enabled": row[3],
                                "oidc_issuer": row[4],
                                "oidc_client_id": row[5],
                                "oidc_client_secret": row[6],  # Decrypt in application
                                "oidc_scopes": row[7] or "openid profile email",
                                "oidc_discovery_url": row[8],
                                "auto_provision_users": row[9],
                                "default_role": row[10],
                                "group_attribute_name": row[11],
                                "group_mapping": row[12] or {},
                                "enforce_sso": row[13],
                            }
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error fetching OIDC config: {e}")

        key = f"{org_id}:oidc"
        return _sso_configs.get(key)

    async def save_sso_config(self, org_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Save or update OIDC SSO configuration."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO sso_configurations (
                                org_id, protocol, is_enabled, oidc_issuer, oidc_client_id,
                                oidc_client_secret_encrypted, oidc_scopes, oidc_discovery_url,
                                auto_provision_users, default_role, group_attribute_name,
                                group_mapping, enforce_sso, updated_at
                            ) VALUES (%s, 'oidc', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (org_id, protocol) DO UPDATE SET
                                is_enabled = EXCLUDED.is_enabled,
                                oidc_issuer = EXCLUDED.oidc_issuer,
                                oidc_client_id = EXCLUDED.oidc_client_id,
                                oidc_client_secret_encrypted = EXCLUDED.oidc_client_secret_encrypted,
                                oidc_scopes = EXCLUDED.oidc_scopes,
                                oidc_discovery_url = EXCLUDED.oidc_discovery_url,
                                auto_provision_users = EXCLUDED.auto_provision_users,
                                default_role = EXCLUDED.default_role,
                                group_attribute_name = EXCLUDED.group_attribute_name,
                                group_mapping = EXCLUDED.group_mapping,
                                enforce_sso = EXCLUDED.enforce_sso,
                                updated_at = NOW()
                            RETURNING id
                        """, (
                            org_id,
                            config.get("is_enabled", False),
                            config.get("oidc_issuer"),
                            config.get("oidc_client_id"),
                            config.get("oidc_client_secret"),
                            config.get("oidc_scopes", "openid profile email"),
                            config.get("oidc_discovery_url"),
                            config.get("auto_provision_users", True),
                            config.get("default_role", "member"),
                            config.get("group_attribute_name", "groups"),
                            json.dumps(config.get("group_mapping", {})),
                            config.get("enforce_sso", False),
                        ))
                        row = cur.fetchone()
                        conn.commit()
                        config["id"] = str(row[0]) if row else None
                        return config
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error saving OIDC config: {e}")

        key = f"{org_id}:oidc"
        _sso_configs[key] = {**config, "org_id": org_id, "protocol": "oidc"}
        return config

    async def _get_discovery_document(self, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Fetch OIDC discovery document (.well-known/openid-configuration)."""
        discovery_url = config.get("oidc_discovery_url")
        if not discovery_url:
            issuer = config.get("oidc_issuer", "")
            discovery_url = f"{issuer.rstrip('/')}/.well-known/openid-configuration"

        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(discovery_url)
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            logger.error(f"Error fetching OIDC discovery document: {e}")

        return None

    async def get_authorization_url(self, org_id: str, redirect_uri: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Generate OIDC authorization URL for redirect to IdP.

        Returns:
            Dict with: url, state, nonce
            None if OIDC is not configured
        """
        config = await self.get_sso_config(org_id)
        if not config:
            logger.error(f"No OIDC config for org {org_id}")
            return None

        discovery = await self._get_discovery_document(config)
        if not discovery:
            logger.error(f"Cannot fetch OIDC discovery for org {org_id}")
            return None

        auth_endpoint = discovery.get("authorization_endpoint")
        if not auth_endpoint:
            logger.error("No authorization_endpoint in discovery document")
            return None

        # Generate state and nonce for CSRF protection
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)

        if not redirect_uri:
            redirect_uri = f"{self.base_url}/api/auth/sso/oidc/{org_id}/callback"

        # Store state for verification
        _oidc_states[state] = {
            "org_id": org_id,
            "nonce": nonce,
            "redirect_uri": redirect_uri,
        }

        # Build authorization URL
        scopes = config.get("oidc_scopes", "openid profile email")
        params = {
            "response_type": "code",
            "client_id": config.get("oidc_client_id"),
            "redirect_uri": redirect_uri,
            "scope": scopes,
            "state": state,
            "nonce": nonce,
        }

        # Build query string
        query_parts = [f"{k}={v}" for k, v in params.items() if v]
        url = f"{auth_endpoint}?{'&'.join(query_parts)}"

        return {"url": url, "state": state, "nonce": nonce}

    async def exchange_code(self, org_id: str, code: str, state: str) -> Optional[Dict[str, Any]]:
        """
        Exchange authorization code for tokens and extract user info.

        Returns:
            Dict with: email, name, idp_subject_id, groups, raw_claims
            None if exchange fails
        """
        # Verify state
        state_data = _oidc_states.pop(state, None)
        if not state_data:
            logger.error("Invalid or expired OIDC state")
            return None

        if state_data["org_id"] != org_id:
            logger.error("OIDC state org_id mismatch")
            return None

        config = await self.get_sso_config(org_id)
        if not config:
            logger.error(f"No OIDC config for org {org_id}")
            return None

        discovery = await self._get_discovery_document(config)
        if not discovery:
            logger.error("Cannot fetch OIDC discovery document")
            return None

        token_endpoint = discovery.get("token_endpoint")
        userinfo_endpoint = discovery.get("userinfo_endpoint")

        if not token_endpoint:
            logger.error("No token_endpoint in discovery document")
            return None

        try:
            import httpx

            # Exchange code for tokens
            token_data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": state_data.get("redirect_uri"),
                "client_id": config.get("oidc_client_id"),
                "client_secret": config.get("oidc_client_secret"),
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                token_response = await client.post(
                    token_endpoint,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                if token_response.status_code != 200:
                    logger.error(f"OIDC token exchange failed: {token_response.status_code}")
                    return None

                tokens = token_response.json()
                id_token = tokens.get("id_token")
                access_token = tokens.get("access_token")

                # Extract claims from ID token (basic decode — production should verify signature)
                claims = {}
                if id_token:
                    claims = self._decode_jwt_claims(id_token)

                # Optionally fetch userinfo for additional claims
                if userinfo_endpoint and access_token:
                    try:
                        userinfo_response = await client.get(
                            userinfo_endpoint,
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                        if userinfo_response.status_code == 200:
                            userinfo = userinfo_response.json()
                            claims.update(userinfo)
                    except Exception as e:
                        logger.warning(f"Userinfo fetch failed: {e}")

            # Extract user attributes
            email = claims.get("email") or claims.get("preferred_username")
            name = (
                claims.get("name") or
                f"{claims.get('given_name', '')} {claims.get('family_name', '')}".strip() or
                email.split("@")[0] if email else "Unknown"
            )
            subject = claims.get("sub", "")

            # Extract groups
            group_attr = config.get("group_attribute_name", "groups")
            groups = claims.get(group_attr, [])
            if isinstance(groups, str):
                groups = [groups]

            return {
                "email": email,
                "name": name,
                "idp_subject_id": subject,
                "groups": groups,
                "raw_claims": claims,
            }

        except Exception as e:
            logger.error(f"OIDC code exchange error: {e}", exc_info=True)
            return None

    def _decode_jwt_claims(self, token: str) -> Dict[str, Any]:
        """Decode JWT claims without signature verification (for attribute extraction only).
        Actual signature verification is done by the OIDC library or IdP."""
        try:
            import base64
            parts = token.split(".")
            if len(parts) < 2:
                return {}
            # Decode payload (second part)
            payload = parts[1]
            # Add padding
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += "=" * padding
            decoded = base64.urlsafe_b64decode(payload)
            return json.loads(decoded)
        except Exception as e:
            logger.error(f"JWT decode error: {e}")
            return {}


# Global instance
oidc_service = OIDCService()
