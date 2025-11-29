"""
Script to run migration 022: Add acceptance_criteria column to requirements table
"""
import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

async def run_migration():
    """Run the migration to add acceptance_criteria column"""
    try:
        from app.services.storage.postgres_direct import get_postgres_pool, execute_query
        
        pool = get_postgres_pool()
        if not pool:
            print("❌ Failed to get database connection")
            return False
        
        print("✅ Connected to database")
        
        # Read migration SQL (migrations are in root supabase/migrations, not backend/supabase/migrations)
        migration_file = Path(__file__).parent.parent.parent / "supabase" / "migrations" / "022_add_acceptance_criteria_to_requirements.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print(f"📄 Read migration file: {migration_file.name}")
        
        # Execute migration (ALTER TABLE doesn't return rows, so we need to use raw connection)
        print("🔄 Running migration...")
        
        # Use raw connection for DDL statements
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Split SQL by semicolons and execute each statement
                statements = [s.strip() for s in migration_sql.split(';') if s.strip() and not s.strip().startswith('--')]
                for stmt in statements:
                    if stmt:
                        cur.execute(stmt)
                conn.commit()
            print("✅ Migration completed successfully!")
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            pool.putconn(conn)
        print("\nMigration SQL executed:")
        print("-" * 50)
        print(migration_sql)
        print("-" * 50)
        
        # Verify column exists
        verify_query = """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'requirements' 
            AND column_name = 'acceptance_criteria'
        """
        verify_result = await execute_query(verify_query, ())
        
        if verify_result and len(verify_result) > 0:
            print("\n✅ Verification: acceptance_criteria column exists!")
            print(f"   Column type: {verify_result[0].get('data_type', 'unknown')}")
        else:
            print("\n⚠️  Warning: Column verification failed, but migration may have succeeded")
        
        return True
        
    except Exception as e:
        print(f"❌ Error running migration: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration 022: Add acceptance_criteria column")
    print("=" * 60)
    print()
    
    success = asyncio.run(run_migration())
    
    if success:
        print("\n✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)

