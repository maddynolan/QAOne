#!/usr/bin/env python3
"""Run migration file directly using psycopg2"""

import sys
import asyncio
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def run_migration_direct(migration_file: Path):
    """Run migration file directly"""
    print(f"Running migration: {migration_file.name}")
    
    from app.services.storage.postgres_direct import get_postgres_pool
    
    pool = get_postgres_pool()
    if not pool:
        print("❌ Database connection pool not available")
        return False
    
    # Read migration file
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Execute entire SQL file
                cur.execute(sql)
                conn.commit()
                print("✅ Migration completed successfully")
                return True
        finally:
            pool.putconn(conn)
    except Exception as e:
        error_str = str(e).lower()
        # Some errors are OK (like "already exists")
        if 'already exists' in error_str or 'duplicate' in error_str:
            print(f"⚠️  Migration already applied (OK): {str(e)[:100]}")
            return True
        else:
            print(f"❌ Migration failed: {e}")
            import traceback
            print(traceback.format_exc())
            return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_migration_direct.py <migration_file.sql>")
        sys.exit(1)
    
    migration_path = Path(sys.argv[1])
    if not migration_path.exists():
        print(f"Error: Migration file not found: {migration_path}")
        sys.exit(1)
    
    # Run in async context
    import asyncio
    success = asyncio.run(run_migration_direct(migration_path))
    sys.exit(0 if success else 1)


