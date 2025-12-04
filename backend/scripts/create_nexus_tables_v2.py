"""
Script to create Nexus database tables
Executes the migration file directly
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage.postgres_direct import get_postgres_pool
import psycopg2
from psycopg2.extras import RealDictCursor


async def create_nexus_tables():
    """Create all Nexus-related tables by executing the migration file"""
    
    # Read the migration file
    migration_file = Path(__file__).parent.parent.parent / "supabase" / "migrations" / "025_nexus_sessions.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return
    
    print(f"Reading migration file: {migration_file}")
    sql_content = migration_file.read_text()
    
    # Set environment to use port 5433 (matching backend config)
    import os
    if not os.getenv("POSTGRES_PORT"):
        os.environ["POSTGRES_PORT"] = "5433"
    if not os.getenv("POSTGRES_HOST"):
        os.environ["POSTGRES_HOST"] = "localhost"
    
    # Reset pool to use new settings
    from app.services.storage.postgres_direct import reset_connection_pool
    reset_connection_pool()
    
    # Get connection pool
    pool = get_postgres_pool()
    if not pool:
        print("❌ Could not get database connection pool")
        return
    
    print("Creating Nexus database tables...")
    
    try:
        conn = pool.getconn()
        try:
            # Set search path
            with conn.cursor() as schema_cur:
                schema_cur.execute("SET search_path TO public")
            conn.commit()
            
            # Execute the entire migration file
            with conn.cursor() as cur:
                # Execute all statements in the file
                cur.execute(sql_content)
                conn.commit()
                print("✅ All Nexus tables created successfully!")
                
        finally:
            pool.putconn(conn)
    except Exception as e:
        error_msg = str(e)
        # Check if it's just "already exists" errors
        if "already exists" in error_msg.lower():
            print("⚠️  Some tables may already exist (this is OK)")
            print("✅ Migration completed (with warnings)")
        else:
            print(f"❌ Error creating tables: {error_msg}")
            raise


if __name__ == "__main__":
    asyncio.run(create_nexus_tables())

