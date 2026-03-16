"""
SAML 2.0 Service
Handles SAML authentication flow: AuthnRequest generation, Response validation,
and attribute extraction for SSO integration with enterprise IdPs (AD FS, Okta, etc.)

Dependencies: python3-saml (optional — graceful fallback if not installed)

Usage:
    from app.services.auth.saml_service import saml_service

    # Get redirect URL for IdP login
    redirect_url = await saml_service.get_login_redirect(org_id, request_url)

    # Process SAML response from IdP
    user_attrs = await saml_service.process_response(org_id, saml_response, request_data)
"""

import logging
import os
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

# Try to import python3-saml
try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    from onelogin.saml2.utils import OneLogin_Saml2_Utils
    SAML_AVAILABLE = True
except ImportError:
    SAML_AVAILABLE = False
    logger.info("python3-saml not installed — SAML SSO disabled. Install with: pip install python3-saml")


def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


# In-memory fallback for SSO configs
_sso_configs: Dict[str, Dict[str, Any]] = {}


class SAMLService:
    """
    SAML 2.0 SSO Service.
    Manages AuthnRequest generation, Response validation, and user attribute extraction.
    """

    def __init__(self):
        self.base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")

    async def get_sso_config(self, org_id: str) -> Optional[Dict[str, Any]]:
        """Get SAML SSO configuration for an organization."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT id, org_id, protocol, is_enabled, idp_entity_id, idp_sso_url,
                                   idp_slo_url, idp_certificate, sp_entity_id, auto_provision_users,
                                   default_role, group_attribute_name, group_mapping, enforce_sso
                            FROM sso_configurations
                            WHERE org_id = %s AND protocol = 'saml' AND is_enabled = true
                        """, (org_id,))
                        row = cur.fetchone()
                        if row:
                            return {
                                "id": str(row[0]),
                                "org_id": str(row[1]),
                                "protocol": row[2],
                                "is_enabled": row[3],
                                "idp_entity_id": row[4],
                                "idp_sso_url": row[5],
                                "idp_slo_url": row[6],
                                "idp_certificate": row[7],
                                "sp_entity_id": row[8],
                                "auto_provision_users": row[9],
                                "default_role": row[10],
                                "group_attribute_name": row[11],
                                "group_mapping": row[12] or {},
                                "enforce_sso": row[13],
                            }
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error fetching SAML config: {e}")

        # In-memory fallback
        key = f"{org_id}:saml"
        return _sso_configs.get(key)

    async def save_sso_config(self, org_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Save or update SAML SSO configuration."""
        if _is_postgres_available():
            try:
                import json
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO sso_configurations (
                                org_id, protocol, is_enabled, idp_entity_id, idp_sso_url,
                                idp_slo_url, idp_certificate, sp_entity_id, auto_provision_users,
                                default_role, group_attribute_name, group_mapping, enforce_sso,
                                updated_at
                            ) VALUES (%s, 'saml', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                            ON CONFLICT (org_id, protocol) DO UPDATE SET
                                is_enabled = EXCLUDED.is_enabled,
                                idp_entity_id = EXCLUDED.idp_entity_id,
                                idp_sso_url = EXCLUDED.idp_sso_url,
                                idp_slo_url = EXCLUDED.idp_slo_url,
                                idp_certificate = EXCLUDED.idp_certificate,
                                sp_entity_id = EXCLUDED.sp_entity_id,
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
                            config.get("idp_entity_id"),
                            config.get("idp_sso_url"),
                            config.get("idp_slo_url"),
                            config.get("idp_certificate"),
                            config.get("sp_entity_id", f"{self.base_url}/api/auth/sso/saml/{org_id}/metadata"),
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
                logger.error(f"Error saving SAML config: {e}")

        # In-memory fallback
        key = f"{org_id}:saml"
        _sso_configs[key] = {**config, "org_id": org_id, "protocol": "saml"}
        return config

    def _build_saml_settings(self, config: Dict[str, Any], org_id: str) -> Dict[str, Any]:
        """Build python3-saml settings dict from our SSO config."""
        sp_entity_id = config.get("sp_entity_id") or f"{self.base_url}/api/auth/sso/saml/{org_id}/metadata"
        acs_url = f"{self.base_url}/api/auth/sso/saml/{org_id}/acs"
        sls_url = f"{self.base_url}/api/auth/sso/saml/{org_id}/sls"

        return {
            "strict": True,
            "debug": os.getenv("APP_ENV", "development") != "production",
            "sp": {
                "entityId": sp_entity_id,
                "assertionConsumerService": {
                    "url": acs_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
                "singleLogoutService": {
                    "url": sls_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            },
            "idp": {
                "entityId": config.get("idp_entity_id", ""),
                "singleSignOnService": {
                    "url": config.get("idp_sso_url", ""),
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "singleLogoutService": {
                    "url": config.get("idp_slo_url", ""),
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "x509cert": config.get("idp_certificate", ""),
            },
            "security": {
                "nameIdEncrypted": False,
                "authnRequestsSigned": False,
                "logoutRequestSigned": False,
                "logoutResponseSigned": False,
                "signMetadata": False,
                "wantMessagesSigned": True,
                "wantAssertionsSigned": True,
                "wantNameIdEncrypted": False,
                "requestedAuthnContext": False,
            },
        }

    def _prepare_request_data(self, request_url: str, form_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Prepare flask-like request data for python3-saml."""
        from urllib.parse import urlparse
        parsed = urlparse(request_url)
        return {
            "https": "on" if parsed.scheme == "https" else "off",
            "http_host": parsed.netloc,
            "script_name": parsed.path,
            "get_data": {},
            "post_data": form_data or {},
        }

    async def get_login_redirect(self, org_id: str, request_url: str) -> Optional[str]:
        """
        Generate SAML AuthnRequest and return redirect URL to IdP.
        Returns None if SAML is not available or not configured.
        """
        if not SAML_AVAILABLE:
            logger.error("SAML not available — python3-saml not installed")
            return None

        config = await self.get_sso_config(org_id)
        if not config:
            logger.error(f"No SAML config for org {org_id}")
            return None

        try:
            settings = self._build_saml_settings(config, org_id)
            request_data = self._prepare_request_data(request_url)
            auth = OneLogin_Saml2_Auth(request_data, settings)
            redirect_url = auth.login()
            return redirect_url
        except Exception as e:
            logger.error(f"SAML login redirect error: {e}", exc_info=True)
            return None

    async def process_response(
        self, org_id: str, saml_response: str, request_url: str
    ) -> Optional[Dict[str, Any]]:
        """
        Process SAML Response from IdP.
        Validates signature, extracts user attributes.

        Returns:
            Dict with: email, name, idp_subject_id, groups, raw_attributes
            None if validation fails
        """
        if not SAML_AVAILABLE:
            logger.error("SAML not available — python3-saml not installed")
            return None

        config = await self.get_sso_config(org_id)
        if not config:
            logger.error(f"No SAML config for org {org_id}")
            return None

        try:
            settings = self._build_saml_settings(config, org_id)
            request_data = self._prepare_request_data(request_url, {"SAMLResponse": saml_response})
            auth = OneLogin_Saml2_Auth(request_data, settings)
            auth.process_response()

            errors = auth.get_errors()
            if errors:
                logger.error(f"SAML response errors: {errors}")
                logger.error(f"SAML last error reason: {auth.get_last_error_reason()}")
                return None

            if not auth.is_authenticated():
                logger.error("SAML response: not authenticated")
                return None

            # Extract attributes
            attributes = auth.get_attributes()
            name_id = auth.get_nameid()
            session_index = auth.get_session_index()

            # Extract common attributes
            email = (
                self._get_attribute(attributes, "email") or
                self._get_attribute(attributes, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress") or
                name_id
            )

            name = (
                self._get_attribute(attributes, "displayName") or
                self._get_attribute(attributes, "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name") or
                self._get_attribute(attributes, "cn") or
                email.split("@")[0] if email else "Unknown"
            )

            # Extract groups using configured attribute name
            group_attr = config.get("group_attribute_name", "groups")
            groups = (
                attributes.get(group_attr, []) or
                attributes.get("http://schemas.xmlsoap.org/claims/Group", []) or
                attributes.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/groups", []) or
                []
            )

            return {
                "email": email,
                "name": name,
                "idp_subject_id": name_id,
                "groups": groups if isinstance(groups, list) else [groups],
                "session_index": session_index,
                "raw_attributes": dict(attributes),
            }

        except Exception as e:
            logger.error(f"SAML response processing error: {e}", exc_info=True)
            return None

    async def get_metadata(self, org_id: str) -> Optional[str]:
        """Generate SP metadata XML for IdP configuration."""
        if not SAML_AVAILABLE:
            return None

        config = await self.get_sso_config(org_id)
        if not config:
            # Return basic metadata even without full config
            config = {}

        try:
            settings = self._build_saml_settings(config, org_id)
            from onelogin.saml2.settings import OneLogin_Saml2_Settings
            saml_settings = OneLogin_Saml2_Settings(settings, sp_validation_only=True)
            metadata = saml_settings.get_sp_metadata()
            errors = saml_settings.validate_metadata(metadata)
            if errors:
                logger.warning(f"SP metadata validation warnings: {errors}")
            return metadata.decode("utf-8") if isinstance(metadata, bytes) else metadata
        except Exception as e:
            logger.error(f"Error generating SP metadata: {e}", exc_info=True)
            return None

    def _get_attribute(self, attributes: Dict, key: str) -> Optional[str]:
        """Get first value from SAML attribute list."""
        values = attributes.get(key, [])
        if isinstance(values, list) and len(values) > 0:
            return values[0]
        if isinstance(values, str):
            return values
        return None


# Global instance
saml_service = SAMLService()
