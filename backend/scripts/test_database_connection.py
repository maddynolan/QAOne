#!/usr/bin/env python3
"""
Test PostgreSQL database connection
Diagnoses connection issues and provides solutions
"""

import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def test_connection():
    """Test database connection and diagnose issues"""
    print("=" * 60)
    print("PostgreSQL Connection Diagnostic Tool")
    print("=" * 60)
    
    # Check psycopg2
    print("\n1. Checking psycopg2 installation...")
    try:
        import psycopg2
        print(f"   ✅ psycopg2 version: {psycopg2.__version__}")
    except ImportError:
        print("   ❌ psycopg2 not installed!")
        print("   Solution: pip install psycopg2-binary")
        return False
    
    # Check environment variables
    print("\n2. Checking environment variables...")
    database_url = os.getenv("DATABASE_URL")
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB", "qaai")
    postgres_user = os.getenv("POSTGRES_USER", "qaai")
    postgres_password = os.getenv("POSTGRES_PASSWORD", "qaai123")
    
    if database_url:
        print(f"   ✅ DATABASE_URL is set: {database_url[:50]}...")
    else:
        print("   ⚠️  DATABASE_URL not set, using individual variables:")
        print(f"      POSTGRES_HOST: {postgres_host}")
        print(f"      POSTGRES_PORT: {postgres_port}")
        print(f"      POSTGRES_DB: {postgres_db}")
        print(f"      POSTGRES_USER: {postgres_user}")
        print(f"      POSTGRES_PASSWORD: {'*' * len(postgres_password)}")
    
    # Try to get connection string
    print("\n3. Testing connection string generation...")
    from app.services.storage.postgres_direct import get_postgres_connection_string
    conn_string = get_postgres_connection_string()
    if conn_string:
        # Mask password in output
        masked = conn_string.split('@')[0].split(':')
        if len(masked) == 2:
            masked[1] = '***'
        masked_conn = ':'.join(masked) + '@' + '@'.join(conn_string.split('@')[1:])
        print(f"   ✅ Connection string: {masked_conn}")
    else:
        print("   ❌ No connection string available!")
        print("   Solution: Set DATABASE_URL or POSTGRES_* environment variables")
        return False
    
    # Try to create pool
    print("\n4. Testing connection pool creation...")
    from app.services.storage.postgres_direct import get_postgres_pool
    try:
        pool = get_postgres_pool()
        if pool:
            print("   ✅ Connection pool created successfully!")
        else:
            print("   ❌ Connection pool creation failed (returned None)")
            print("   Check logs above for error details")
            return False
    except Exception as e:
        print(f"   ❌ Connection pool creation failed: {e}")
        import traceback
        print(f"   Traceback:\n{traceback.format_exc()}")
        return False
    
    # Test actual connection
    print("\n5. Testing actual database connection...")
    try:
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                print(f"   ✅ Connected successfully!")
                print(f"   PostgreSQL version: {version[:50]}...")
                
                # Test if database exists and has tables
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    LIMIT 5;
                """)
                tables = cur.fetchall()
                if tables:
                    print(f"   ✅ Found {len(tables)} tables in database")
                    print(f"   Sample tables: {[t[0] for t in tables[:3]]}")
                else:
                    print("   ⚠️  No tables found in database (may need to run migrations)")
        finally:
            pool.putconn(conn)
    except Exception as e:
        print(f"   ❌ Connection test failed: {e}")
        import traceback
        print(f"   Traceback:\n{traceback.format_exc()}")
        
        # Provide specific solutions
        error_str = str(e).lower()
        if "connection refused" in error_str or "could not connect" in error_str:
            print("\n   💡 Solution: PostgreSQL server is not running or not accessible")
            print("      - Check if PostgreSQL is running: docker ps (if using Docker)")
            print("      - Check if port 5432 is accessible")
            print("      - Verify host/port in connection string")
        elif "authentication failed" in error_str or "password" in error_str:
            print("\n   💡 Solution: Authentication failed")
            print("      - Verify POSTGRES_USER and POSTGRES_PASSWORD")
            print("      - Check if user exists in PostgreSQL")
        elif "database" in error_str and "does not exist" in error_str:
            print("\n   💡 Solution: Database does not exist")
            print("      - Create database: CREATE DATABASE qaai;")
            print("      - Or update POSTGRES_DB environment variable")
        elif "relation" in error_str and "does not exist" in error_str:
            print("\n   💡 Solution: Tables don't exist (need to run migrations)")
            print("      - Run migrations from supabase/migrations/")
        
        return False
    
    print("\n" + "=" * 60)
    print("✅ All connection tests passed!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)


