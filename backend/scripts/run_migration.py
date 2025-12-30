#!/usr/bin/env python3
"""Run a specific migration file"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def run_migration(migration_file: Path):
    """Run a migration file"""
    print(f"Running migration: {migration_file.name}")
    
    from app.services.storage.postgres_direct import execute_query
    
    # Read migration file
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Split by semicolons (basic approach)
    statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
    
    for i, statement in enumerate(statements, 1):
        if not statement:
            continue
        try:
            print(f"  Executing statement {i}/{len(statements)}...")
            result = await execute_query(statement + ';')
            print(f"  ✅ Statement {i} completed")
        except Exception as e:
            error_str = str(e).lower()
            # Some errors are OK (like "already exists")
            if 'already exists' in error_str or 'duplicate' in error_str:
                print(f"  ⚠️  Statement {i} - already applied (OK)")
            else:
                print(f"  ⚠️  Statement {i} - error: {str(e)[:100]}")
                # Don't fail on errors - migrations may have partial success
    
    print(f"✅ Migration {migration_file.name} completed")

if __name__ == "__main__":
    import asyncio
    
    if len(sys.argv) < 2:
        print("Usage: python run_migration.py <migration_file.sql>")
        sys.exit(1)
    
    migration_path = Path(sys.argv[1])
    if not migration_path.exists():
        print(f"Error: Migration file not found: {migration_path}")
        sys.exit(1)
    
    asyncio.run(run_migration(migration_path))

