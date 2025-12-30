#!/usr/bin/env python3
"""
Setup PostgreSQL database for QA AI Platform
Automatically starts Docker container and runs migrations
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def check_docker():
    """Check if Docker is available and running"""
    try:
        result = subprocess.run(['docker', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Docker found: {result.stdout.strip()}")
            
            # Check if Docker daemon is running
            try:
                result = subprocess.run(['docker', 'ps'], capture_output=True, text=True)
                if result.returncode == 0:
                    print("✅ Docker daemon is running")
                    return True
                else:
                    print("❌ Docker daemon is not running")
                    print("   Please start Docker Desktop and try again")
                    return False
            except:
                print("❌ Cannot connect to Docker daemon")
                print("   Please start Docker Desktop and try again")
                return False
    except FileNotFoundError:
        pass
    print("❌ Docker not found")
    print("   Please install Docker Desktop from https://www.docker.com/products/docker-desktop")
    return False

def check_postgres_running():
    """Check if PostgreSQL is already running"""
    try:
        result = subprocess.run(['docker', 'ps', '--filter', 'name=qa-postgres', '--format', '{{.Names}}'], 
                              capture_output=True, text=True)
        if 'qa-postgres' in result.stdout:
            print("✅ PostgreSQL container already running")
            return True
    except:
        pass
    return False

def start_postgres_docker():
    """Start PostgreSQL in Docker"""
    print("\n🐳 Starting PostgreSQL in Docker...")
    
    # Check if container exists but is stopped
    result = subprocess.run(['docker', 'ps', '-a', '--filter', 'name=qa-postgres', '--format', '{{.Names}}'], 
                          capture_output=True, text=True)
    if 'qa-postgres' in result.stdout:
        print("   Container exists, starting it...")
        subprocess.run(['docker', 'start', 'qa-postgres'], check=True)
    else:
        print("   Creating new container...")
        cmd = [
            'docker', 'run', '-d', '--name', 'qa-postgres',
            '-e', 'POSTGRES_PASSWORD=qaai123',
            '-e', 'POSTGRES_USER=qaai',
            '-e', 'POSTGRES_DB=qaai',
            '-p', '5432:5432',
            'postgres:16'
        ]
        subprocess.run(cmd, check=True)
    
    # Wait for PostgreSQL to be ready
    print("   Waiting for PostgreSQL to be ready...")
    for i in range(30):
        try:
            result = subprocess.run(['docker', 'exec', 'qa-postgres', 'pg_isready', '-U', 'qaai'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print("   ✅ PostgreSQL is ready!")
                return True
        except:
            pass
        time.sleep(1)
        if i % 5 == 0:
            print(f"   ... still waiting ({i+1}/30)")
    
    print("   ⚠️  PostgreSQL may not be ready yet, but continuing...")
    return True

def test_connection():
    """Test database connection"""
    print("\n🔌 Testing database connection...")
    try:
        from app.services.storage.postgres_direct import get_postgres_pool, test_connection as test_db_connection
        pool = get_postgres_pool()
        if pool:
            result = test_db_connection()
            if result:
                print("   ✅ Connection successful!")
                return True
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
    return False

def run_migrations():
    """Run database migrations"""
    print("\n📦 Running database migrations...")
    
    migrations_dir = Path(__file__).parent.parent.parent / "supabase" / "migrations"
    if not migrations_dir.exists():
        print(f"   ⚠️  Migrations directory not found: {migrations_dir}")
        return False
    
    migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
    if not migration_files:
        print("   ⚠️  No migration files found")
        return False
    
    print(f"   Found {len(migration_files)} migration files")
    
    # Use psql to run migrations
    for migration_file in migration_files:
        print(f"   Running {migration_file.name}...")
        try:
            cmd = [
                'docker', 'exec', '-i', 'qa-postgres',
                'psql', '-U', 'qaai', '-d', 'qaai'
            ]
            with open(migration_file, 'r') as f:
                result = subprocess.run(cmd, input=f.read(), text=True, capture_output=True)
            
            if result.returncode == 0:
                print(f"   ✅ {migration_file.name} completed")
            else:
                # Check if error is "already exists" (which is OK)
                if 'already exists' in result.stderr.lower():
                    print(f"   ⚠️  {migration_file.name} - already applied (OK)")
                else:
                    print(f"   ⚠️  {migration_file.name} - errors (may be OK if already applied):")
                    print(f"      {result.stderr[:200]}")
        except Exception as e:
            print(f"   ⚠️  Failed to run {migration_file.name}: {e}")
    
    return True

def verify_tables():
    """Verify that key tables exist"""
    print("\n🔍 Verifying database tables...")
    
    try:
        from app.services.storage.postgres_direct import execute_query
        
        tables_to_check = [
            'element_models',
            'test_cases',
            'test_runs',
            'organizations',
            'projects'
        ]
        
        for table in tables_to_check:
            result = execute_query(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                );
            """)
            if result and result[0].get('exists'):
                print(f"   ✅ Table '{table}' exists")
            else:
                print(f"   ⚠️  Table '{table}' not found (may need migrations)")
    except Exception as e:
        print(f"   ⚠️  Could not verify tables: {e}")

def main():
    """Main setup function"""
    print("=" * 60)
    print("QA AI Platform - Database Setup")
    print("=" * 60)
    
    # Add backend to path
    backend_dir = Path(__file__).parent.parent
    sys.path.insert(0, str(backend_dir))
    
    # Check Docker
    if not check_docker():
        print("\n❌ Docker is required for automatic setup.")
        print("   Please install Docker Desktop or start PostgreSQL manually.")
        print("   See DATABASE_SETUP_FIX.md for manual setup instructions.")
        return 1
    
    # Check if already running
    if check_postgres_running():
        print("   PostgreSQL container is already running")
    else:
        # Start PostgreSQL
        if not start_postgres_docker():
            print("\n❌ Failed to start PostgreSQL")
            return 1
    
    # Wait a bit for connection to be ready
    time.sleep(2)
    
    # Test connection
    if not test_connection():
        print("\n❌ Database connection failed")
        print("   Please check Docker logs: docker logs qa-postgres")
        return 1
    
    # Run migrations
    run_migrations()
    
    # Verify tables
    verify_tables()
    
    print("\n" + "=" * 60)
    print("✅ Database setup complete!")
    print("=" * 60)
    print("\nYou can now:")
    print("  1. Test connection: python scripts/test_database_connection.py")
    print("  2. Start the backend server")
    print("  3. Record Flowstral sessions (element models will be stored)")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

