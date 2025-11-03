#!/usr/bin/env python
"""
Script to run database migrations
Can be used to verify migrations are ready to execute
"""

import os
import sys

def read_migration(filepath):
    """Read a migration file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {str(e)}")
        return None

def main():
    """Main function to list migrations"""
    migrations_dir = os.path.join(os.path.dirname(__file__), '..', 'supabase', 'migrations')
    migrations_dir = os.path.abspath(migrations_dir)
    
    if not os.path.exists(migrations_dir):
        print(f"ERROR: Migrations directory not found: {migrations_dir}")
        return
    
    migration_files = sorted([f for f in os.listdir(migrations_dir) if f.endswith('.sql')])
    
    print("=" * 60)
    print("QA AI Platform - Database Migrations")
    print("=" * 60)
    print(f"\nFound {len(migration_files)} migration files:\n")
    
    for i, filename in enumerate(migration_files, 1):
        filepath = os.path.join(migrations_dir, filename)
        size = os.path.getsize(filepath)
        print(f"{i}. {filename} ({size:,} bytes)")
        
        # Show first few lines
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                first_lines = [f.readline().strip() for _ in range(3)]
                if first_lines[0]:
                    print(f"   -> {first_lines[0][:60]}...")
        except:
            print(f"   -> (migration file)")
    
    print("\n" + "=" * 60)
    print("To run migrations:")
    print("\nFor Supabase:")
    print("  1. Go to Supabase Dashboard → SQL Editor")
    print("  2. Copy and paste each migration file in order")
    print("  3. Execute each migration")
    print("\nFor Local PostgreSQL:")
    print("  psql -h localhost -U qaai -d qaai -f supabase/migrations/001_initial_schema.sql")
    print("  psql -h localhost -U qaai -d qaai -f supabase/migrations/002_ai_generations.sql")
    print("  ... (and so on for each file)")
    print("=" * 60)

if __name__ == "__main__":
    main()

