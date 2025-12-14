#!/usr/bin/env python3
"""
Script to ensure default organization and project exist in database.
Run this if you get foreign key constraint errors.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.utils.endpoint_helpers import DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
from app.services.storage.postgres_direct import execute_query, execute_insert, get_postgres_pool

async def ensure_default_project():
    """Ensure default org and project exist"""
    pool = get_postgres_pool()
    if not pool:
        print("ERROR: No database connection available")
        return False
    
    try:
        # Check org
        orgs = await execute_query("SELECT id, name FROM organizations WHERE id = %s", (DEFAULT_ORG_ID,))
        if orgs:
            print(f"✓ Organization exists: {DEFAULT_ORG_ID}")
        else:
            print(f"Creating organization: {DEFAULT_ORG_ID}")
            org_id = await execute_insert("organizations", {
                "id": DEFAULT_ORG_ID,
                "name": "Demo Organization",
                "slug": "demo"
            })
            if org_id:
                print(f"✓ Created organization: {org_id}")
            else:
                print(f"✗ Failed to create organization")
                return False
        
        # Check project
        projects = await execute_query("SELECT id, name FROM projects WHERE id = %s", (DEFAULT_PROJECT_ID,))
        if projects:
            print(f"✓ Project exists: {DEFAULT_PROJECT_ID}")
        else:
            print(f"Creating project: {DEFAULT_PROJECT_ID}")
            project_id = await execute_insert("projects", {
                "id": DEFAULT_PROJECT_ID,
                "org_id": DEFAULT_ORG_ID,
                "name": "Demo Project",
                "slug": "demo"
            })
            if project_id:
                print(f"✓ Created project: {project_id}")
            else:
                print(f"✗ Failed to create project")
                return False
        
        # Verify
        projects = await execute_query("SELECT id, name FROM projects WHERE id = %s", (DEFAULT_PROJECT_ID,))
        if projects:
            print(f"\n✓ SUCCESS: Default project is ready")
            print(f"  Organization ID: {DEFAULT_ORG_ID}")
            print(f"  Project ID: {DEFAULT_PROJECT_ID}")
            return True
        else:
            print(f"\n✗ ERROR: Project was not created successfully")
            return False
            
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(ensure_default_project())
    sys.exit(0 if success else 1)







