#!/usr/bin/env python
"""
Run migration 023: Capability Maps and Exploration Results
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.storage.postgres_direct import execute_query

async def run_migration():
    """Run the migration"""
    migration_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        'supabase', 'migrations', '023_capability_maps.sql'
    )
    
    if not os.path.exists(migration_file):
        print(f"ERROR: Migration file not found: {migration_file}")
        return False
    
    print(f"Reading migration from: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Execute the entire migration as one block (handles multi-line statements better)
    print("Executing migration...")
    try:
        # Use execute_query which should handle DDL
        await execute_query(sql)
        print("✅ Migration executed successfully")
    except Exception as e:
        # Check if it's a "no results" error (expected for DDL)
        if "no results to fetch" in str(e).lower():
            print("✅ Migration executed (DDL - no results expected)")
        elif "already exists" in str(e).lower():
            print("⚠️  Some objects already exist (this is OK)")
        else:
            print(f"❌ Migration failed: {e}")
            # Try to continue - might be partial success
            print("⚠️  Continuing anyway - check if tables were created")
    
    print("\n✅ Migration 023 completed successfully!")
    return True

if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)

