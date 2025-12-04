#!/usr/bin/env python
"""
Script to run Flowstral optimization migration
"""

import os
import sys
import asyncio
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.services.storage.postgres_direct import get_postgres_pool

async def run_migration():
    """Run the migrations in order"""
    migrations_dir = Path(__file__).parent / "supabase" / "migrations"
    
    # Run 021 first (creates flowstral_sessions), then 022
    migration_files = [
        migrations_dir / "021_flowstral_tables.sql",
        migrations_dir / "022_flowstral_optimizations.sql"
    ]
    
    for migration_file in migration_files:
        if not migration_file.exists():
            print(f"WARNING: Migration file not found: {migration_file}, skipping...")
            continue
        
        print(f"\n{'='*60}")
        print(f"Running migration: {migration_file.name}")
        print(f"{'='*60}")
        
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
    
    print("Connecting to database...")
    pool = get_postgres_pool()
    if not pool:
        print("ERROR: Could not connect to database. Check your DATABASE_URL or POSTGRES_* environment variables.")
        return False
    
        try:
            conn = pool.getconn()
            try:
                cursor = conn.cursor()
                print("Executing migration...")
                cursor.execute(migration_sql)
                conn.commit()
                print(f"✅ {migration_file.name} completed successfully!")
            except Exception as e:
                conn.rollback()
                # Check if error is because table already exists (OK to skip)
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"⚠️  {migration_file.name} - Tables may already exist, skipping...")
                else:
                    print(f"❌ {migration_file.name} failed: {e}")
                    return False
            finally:
                pool.putconn(conn)
        except Exception as e:
            print(f"❌ Database error for {migration_file.name}: {e}")
            return False
    
    print(f"\n{'='*60}")
    print("✅ All migrations completed!")
    print(f"{'='*60}")
    return True

if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)

