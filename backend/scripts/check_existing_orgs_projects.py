#!/usr/bin/env python3
"""Check what orgs and projects actually exist in the database"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage.postgres_direct import execute_query, get_postgres_pool

async def check_existing():
    pool = get_postgres_pool()
    if not pool:
        print("No database connection")
        return
    
    # Check all orgs
    orgs = await execute_query("SELECT id, name, slug FROM organizations ORDER BY created_at LIMIT 10", ())
    print("\n=== Organizations ===")
    if orgs:
        for org in orgs:
            if isinstance(org, tuple):
                print(f"ID: {org[0]}, Name: {org[1]}, Slug: {org[2]}")
            else:
                print(f"ID: {org.get('id')}, Name: {org.get('name')}, Slug: {org.get('slug')}")
    else:
        print("No organizations found")
    
    # Check all projects
    projects = await execute_query("SELECT id, org_id, name, slug FROM projects ORDER BY created_at LIMIT 10", ())
    print("\n=== Projects ===")
    if projects:
        for proj in projects:
            if isinstance(proj, tuple):
                print(f"ID: {proj[0]}, Org ID: {proj[1]}, Name: {proj[2]}, Slug: {proj[3]}")
            else:
                print(f"ID: {proj.get('id')}, Org ID: {proj.get('org_id')}, Name: {proj.get('name')}, Slug: {proj.get('slug')}")
    else:
        print("No projects found")

if __name__ == "__main__":
    asyncio.run(check_existing())




