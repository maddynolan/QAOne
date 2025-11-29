"""
Setup Default Roles
Creates default roles and permissions for the system.
Run this script after database migrations to initialize RBAC.
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.core.rbac_service import rbac_service
from app.services.core.tenant_service import tenant_service

# Default roles and their permissions
DEFAULT_ROLES = {
    "admin": {
        "description": "Full system access",
        "permissions": ["*"]  # All permissions
    },
    "qa_lead": {
        "description": "QA team lead with full test management access",
        "permissions": [
            "test_cases:*",
            "test_plans:*",
            "test_runs:*",
            "defects:*",
            "requirements:*",
            "agents:execute",
            "workflows:create",
            "workflows:execute",
            "reports:view",
            "reports:export"
        ]
    },
    "tester": {
        "description": "QA tester with execution and creation permissions",
        "permissions": [
            "test_cases:read",
            "test_cases:create",
            "test_cases:update",
            "test_plans:read",
            "test_runs:read",
            "test_runs:create",
            "test_runs:execute",
            "test_runs:update",
            "defects:read",
            "defects:create",
            "defects:update",
            "requirements:read",
            "reports:view"
        ]
    },
    "viewer": {
        "description": "Read-only access to test data",
        "permissions": [
            "test_cases:read",
            "test_plans:read",
            "test_runs:read",
            "defects:read",
            "requirements:read",
            "reports:view"
        ]
    },
    "auditor": {
        "description": "Audit and compliance access",
        "permissions": [
            "*:read",  # Read all resources
            "audit_logs:read",
            "audit_logs:export",
            "reports:view",
            "reports:export"
        ]
    }
}


async def setup_default_roles(tenant_id: Optional[str] = None):
    """
    Create default roles in the system.
    
    Args:
        tenant_id: Optional tenant ID (None for system-wide roles)
    """
    print(f"Setting up default roles (tenant_id: {tenant_id or 'system-wide'})...")
    
    created_roles = []
    for role_name, role_config in DEFAULT_ROLES.items():
        try:
            result = await rbac_service.create_role(
                name=role_name,
                description=role_config["description"],
                permissions=role_config["permissions"],
                tenant_id=tenant_id
            )
            created_roles.append(role_name)
            print(f"✅ Created role: {role_name}")
        except Exception as e:
            print(f"❌ Error creating role {role_name}: {e}")
    
    print(f"\n✅ Created {len(created_roles)} default roles")
    return created_roles


async def assign_default_role_to_user(
    user_id: str,
    role_name: str,
    tenant_id: Optional[str] = None
):
    """
    Assign a default role to a user.
    
    Args:
        user_id: User ID
        role_name: Name of role to assign
        tenant_id: Optional tenant ID
    """
    # Get role ID by name
    from app.services.storage.postgres_direct import get_postgres_pool
    import json
    
    pool = get_postgres_pool()
    if not pool:
        print("❌ Database not available")
        return False
    
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM roles WHERE name = %s AND (tenant_id = %s OR tenant_id IS NULL)",
                (role_name, tenant_id)
            )
            row = cur.fetchone()
            if not row:
                print(f"❌ Role {role_name} not found")
                return False
            
            role_id = row[0]
            
            # Assign role
            result = await rbac_service.assign_role(
                user_id=user_id,
                role_id=str(role_id),
                tenant_id=tenant_id
            )
            
            print(f"✅ Assigned role {role_name} to user {user_id}")
            return True
    finally:
        pool.putconn(conn)


async def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Setup default RBAC roles")
    parser.add_argument("--tenant-id", help="Tenant ID (optional, for tenant-specific roles)")
    parser.add_argument("--assign", help="Assign role to user: user_id:role_name")
    
    args = parser.parse_args()
    
    # Setup roles
    await setup_default_roles(tenant_id=args.tenant_id)
    
    # Assign role if requested
    if args.assign:
        user_id, role_name = args.assign.split(":")
        await assign_default_role_to_user(
            user_id=user_id,
            role_name=role_name,
            tenant_id=args.tenant_id
        )


if __name__ == "__main__":
    from typing import Optional
    asyncio.run(main())

