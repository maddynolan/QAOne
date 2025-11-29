#!/usr/bin/env python
"""
Direct script to create exploration tables using psycopg2
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os

def get_connection_string():
    """Get PostgreSQL connection string"""
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5433")  # Match backend default
    database = os.getenv("POSTGRES_DB", "qaai")
    user = os.getenv("POSTGRES_USER", "qaai")
    password = os.getenv("POSTGRES_PASSWORD", "qaai123")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"

def main():
    """Create exploration tables"""
    conn_string = get_connection_string()
    print(f"Connecting to database...")
    
    try:
        conn = psycopg2.connect(conn_string)
        cur = conn.cursor()
        
        # Read migration file
        migration_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            'supabase', 'migrations', '023_capability_maps.sql'
        )
        
        print(f"Reading migration from: {migration_file}")
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        # Split into statements - handle multi-line CREATE TABLE statements
        statements = []
        current = []
        for line in sql.split('\n'):
            # Remove comments
            if '--' in line:
                line = line[:line.index('--')]
            line = line.strip()
            if not line:
                continue
            current.append(line)
            # Statement ends with semicolon
            if line.endswith(';'):
                stmt = ' '.join(current)
                # Remove trailing semicolon and clean up
                stmt = stmt.rstrip(';').strip()
                if stmt:
                    statements.append(stmt)
                current = []
        
        print(f"Executing {len(statements)} statements...")
        
        for i, stmt in enumerate(statements, 1):
            try:
                print(f"  [{i}/{len(statements)}] {stmt[:60]}...")
                cur.execute(stmt)
                conn.commit()
                print(f"  ✅ Statement {i} executed")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"  ⚠️  Statement {i} skipped (already exists)")
                    conn.rollback()
                else:
                    print(f"  ❌ Statement {i} failed: {e}")
                    conn.rollback()
        
        cur.close()
        conn.close()
        
        print("\n✅ Migration completed!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)

