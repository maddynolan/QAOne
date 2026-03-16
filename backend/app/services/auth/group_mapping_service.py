"""
AD Group Mapping Service
Maps Active Directory / IdP groups to application roles and project memberships.
Called by both SAML and OIDC response handlers during JIT provisioning.

Usage:
    from app.services.auth.group_mapping_service import group_mapping_service

    # Map AD groups to roles and project memberships
    result = await group_mapping_service.map_groups_to_roles(org_id, ad_groups)
    # result = { "roles": ["admin"], "project_roles": { "proj-id": "lead" } }

    # Full JIT provisioning
    user = await group_mapping_service.provision_or_update_user(
        org_id, user_attrs, ad_groups
    )
"""

import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False


class GroupMappingService:
    """
    Maps IdP groups (AD, Azure AD, Okta, etc.) to application roles.

    Group mapping format (stored in sso_configurations.group_mapping JSONB):
    {
        "QA-Admins": { "role": "admin", "project_ids": ["*"] },
        "QA-Leads": { "role": "lead", "project_ids": ["proj-1-uuid"] },
        "QA-Testers": { "role": "tester", "project_ids": ["proj-1-uuid", "proj-2-uuid"] },
        "QA-Viewers": { "role": "viewer", "project_ids": ["*"] }
    }

    Wildcard "*" in project_ids means all projects in the org.
    """

    async def get_group_mapping(self, org_id: str, protocol: str = "saml") -> Dict[str, Any]:
        """Get group mapping configuration for an organization."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT group_mapping, default_role
                            FROM sso_configurations
                            WHERE org_id = %s AND protocol = %s AND is_enabled = true
                        """, (org_id, protocol))
                        row = cur.fetchone()
                        if row:
                            return {
                                "mapping": row[0] or {},
                                "default_role": row[1] or "member",
                            }
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error fetching group mapping: {e}")

        return {"mapping": {}, "default_role": "member"}

    async def map_groups_to_roles(
        self, org_id: str, ad_groups: List[str], protocol: str = "saml"
    ) -> Dict[str, Any]:
        """
        Map AD groups to application roles and project memberships.

        Args:
            org_id: Organization ID
            ad_groups: List of AD group names from IdP assertion
            protocol: SSO protocol ('saml' or 'oidc')

        Returns:
            {
                "roles": ["admin", "lead"],
                "project_roles": { "project_id": "role" },
                "accessible_project_ids": ["proj-1", "proj-2"],
                "highest_role": "admin"
            }
        """
        config = await self.get_group_mapping(org_id, protocol)
        mapping = config.get("mapping", {})
        default_role = config.get("default_role", "member")

        roles = set()
        project_roles: Dict[str, str] = {}
        accessible_project_ids = set()

        ROLE_PRIORITY = {"owner": 5, "admin": 4, "lead": 3, "member": 2, "tester": 2, "viewer": 1}

        for group in ad_groups:
            group_config = mapping.get(group)
            if not group_config:
                # Try case-insensitive match
                for key, val in mapping.items():
                    if key.lower() == group.lower():
                        group_config = val
                        break

            if group_config:
                role = group_config.get("role", default_role)
                roles.add(role)

                project_ids = group_config.get("project_ids", [])
                for pid in project_ids:
                    if pid == "*":
                        # All projects — resolve actual project IDs
                        all_projects = await self._get_org_project_ids(org_id)
                        for p in all_projects:
                            # Only upgrade role, never downgrade
                            existing = project_roles.get(p, "viewer")
                            if ROLE_PRIORITY.get(role, 0) > ROLE_PRIORITY.get(existing, 0):
                                project_roles[p] = role
                            accessible_project_ids.add(p)
                    else:
                        existing = project_roles.get(pid, "viewer")
                        if ROLE_PRIORITY.get(role, 0) > ROLE_PRIORITY.get(existing, 0):
                            project_roles[pid] = role
                        accessible_project_ids.add(pid)

        # If no groups matched, use default role
        if not roles:
            roles.add(default_role)

        # Determine highest role
        highest_role = default_role
        highest_priority = 0
        for role in roles:
            priority = ROLE_PRIORITY.get(role, 0)
            if priority > highest_priority:
                highest_priority = priority
                highest_role = role

        return {
            "roles": list(roles),
            "project_roles": project_roles,
            "accessible_project_ids": list(accessible_project_ids),
            "highest_role": highest_role,
        }

    async def provision_or_update_user(
        self,
        org_id: str,
        user_attrs: Dict[str, Any],
        ad_groups: List[str],
        protocol: str = "saml",
    ) -> Dict[str, Any]:
        """
        JIT (Just-In-Time) Provisioning:
        - Create user if not exists
        - Update org_memberships from group mapping
        - Update project_memberships from group mapping
        - Generate JWT with correct roles/permissions

        Args:
            org_id: Organization ID
            user_attrs: { email, name, idp_subject_id, groups }
            ad_groups: List of AD groups from IdP
            protocol: SSO protocol

        Returns:
            Auth session dict { token, user, org, project, roles, permissions }
        """
        email = user_attrs.get("email")
        name = user_attrs.get("name", email.split("@")[0] if email else "Unknown")
        idp_subject_id = user_attrs.get("idp_subject_id")

        if not email:
            raise ValueError("Email is required for SSO provisioning")

        # Map groups to roles
        role_mapping = await self.map_groups_to_roles(org_id, ad_groups, protocol)

        # Provision user via auth_service
        from app.services.auth.auth_service import auth_service

        result = await auth_service.provision_sso_user(
            email=email,
            name=name,
            auth_provider=protocol,
            idp_subject_id=idp_subject_id,
            org_id=org_id,
            roles=role_mapping.get("roles", []),
            project_roles=role_mapping.get("project_roles", {}),
        )

        # Log SSO event
        await self._log_sso_event(
            org_id=org_id,
            user_id=result.get("user", {}).get("id"),
            protocol=protocol,
            email=email,
            idp_subject_id=idp_subject_id,
            groups=ad_groups,
            roles=role_mapping.get("roles", []),
            was_provisioned=result.get("was_provisioned", False),
        )

        return result

    async def _get_org_project_ids(self, org_id: str) -> List[str]:
        """Get all project IDs for an organization."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT id FROM projects WHERE org_id = %s",
                            (org_id,)
                        )
                        return [str(row[0]) for row in cur.fetchall()]
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error fetching org projects: {e}")

        return []

    async def _log_sso_event(
        self,
        org_id: str,
        user_id: Optional[str],
        protocol: str,
        email: str,
        idp_subject_id: Optional[str],
        groups: List[str],
        roles: List[str],
        was_provisioned: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """Log SSO login event for audit trail."""
        if _is_postgres_available():
            try:
                from app.services.storage.database import get_database_client
                pool = get_database_client()
                conn = pool.getconn()
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO sso_login_events (
                                org_id, user_id, protocol, idp_subject_id, email,
                                groups_received, roles_assigned, was_provisioned,
                                ip_address, user_agent
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            org_id, user_id, protocol, idp_subject_id, email,
                            groups, roles, was_provisioned,
                            ip_address, user_agent,
                        ))
                        conn.commit()
                finally:
                    pool.putconn(conn)
            except Exception as e:
                logger.error(f"Error logging SSO event: {e}")

        logger.info(
            f"SSO login: protocol={protocol}, email={email}, "
            f"groups={len(groups)}, roles={roles}, provisioned={was_provisioned}"
        )


# Global instance
group_mapping_service = GroupMappingService()
