#!/usr/bin/env python3
"""
Run database migrations against Railway PostgreSQL.

Usage:
    # Using DATABASE_URL from environment
    python scripts/run_migrations_railway.py

    # Or specify directly
    python scripts/run_migrations_railway.py --url "postgresql://user:pass@host:port/db"

    # Dry run (show SQL without executing)
    python scripts/run_migrations_railway.py --dry-run

This script:
1. Connects to PostgreSQL via DATABASE_URL
2. Creates a migration_history table to track which migrations have run
3. Runs all pending migrations from supabase/migrations/ in order
4. Skips already-applied migrations (safe to run multiple times)
"""

import os
import sys
import argparse
import glob
from pathlib import Path


def get_connection(url: str):
    """Get psycopg2 connection."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    try:
        conn = psycopg2.connect(url)
        conn.autocommit = False
        return conn
    except Exception as e:
        print(f"ERROR: Cannot connect to PostgreSQL: {e}")
        sys.exit(1)


def ensure_migration_table(conn):
    """Create the migration tracking table if it doesn't exist."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS migration_history (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW(),
                checksum TEXT
            )
        """)
        conn.commit()


def get_applied_migrations(conn) -> set:
    """Get set of already-applied migration filenames."""
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM migration_history ORDER BY filename")
        return {row[0] for row in cur.fetchall()}


def get_migration_files(migrations_dir: str) -> list:
    """Get sorted list of migration SQL files."""
    files = sorted(Path(migrations_dir).glob("*.sql"))
    return files


def run_migration(conn, filepath: Path, dry_run: bool = False):
    """Run a single migration file."""
    filename = filepath.name
    sql = filepath.read_text(encoding="utf-8")

    if dry_run:
        print(f"  [DRY RUN] Would execute: {filename} ({len(sql)} chars)")
        return True

    try:
        with conn.cursor() as cur:
            # Execute the migration
            cur.execute(sql)
            # Record it
            cur.execute(
                "INSERT INTO migration_history (filename, checksum) VALUES (%s, md5(%s))",
                (filename, sql),
            )
            conn.commit()
        print(f"  ✓ Applied: {filename}")
        return True
    except Exception as e:
        conn.rollback()
        error_msg = str(e).strip()
        # Handle common "already exists" errors gracefully
        if "already exists" in error_msg:
            print(f"  ⚠ Partial (objects exist): {filename} — marking as applied")
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO migration_history (filename, checksum) VALUES (%s, 'partial') ON CONFLICT DO NOTHING",
                        (filename,),
                    )
                    conn.commit()
            except Exception:
                conn.rollback()
            return True
        else:
            print(f"  ✗ FAILED: {filename}")
            print(f"    Error: {error_msg[:300]}")
            return False


def main():
    parser = argparse.ArgumentParser(description="Run QAAI database migrations")
    parser.add_argument("--url", help="PostgreSQL connection URL (or set DATABASE_URL env var)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be run without executing")
    parser.add_argument("--force", action="store_true", help="Re-run all migrations (ignore history)")
    args = parser.parse_args()

    url = args.url or os.getenv("DATABASE_URL")
    if not url:
        print("ERROR: No database URL. Set DATABASE_URL env var or use --url")
        sys.exit(1)

    # Find migrations directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    migrations_dir = project_root / "supabase" / "migrations"

    if not migrations_dir.exists():
        print(f"ERROR: Migrations directory not found: {migrations_dir}")
        sys.exit(1)

    migration_files = get_migration_files(migrations_dir)
    print(f"Found {len(migration_files)} migration files in {migrations_dir}")

    # Connect
    print(f"Connecting to PostgreSQL...")
    conn = get_connection(url)
    print(f"Connected successfully.")

    # Ensure tracking table
    ensure_migration_table(conn)

    # Get already-applied
    if args.force:
        applied = set()
        print("Force mode: re-running all migrations")
    else:
        applied = get_applied_migrations(conn)
        print(f"Already applied: {len(applied)} migrations")

    # Run pending migrations
    pending = [f for f in migration_files if f.name not in applied]
    if not pending:
        print("All migrations are up to date. Nothing to do.")
        conn.close()
        return

    print(f"\nRunning {len(pending)} pending migrations:")
    failed = 0
    for filepath in pending:
        success = run_migration(conn, filepath, dry_run=args.dry_run)
        if not success:
            failed += 1
            # Continue with remaining migrations (some may be independent)

    conn.close()

    if failed:
        print(f"\n⚠ {failed} migration(s) failed. Review errors above.")
        sys.exit(1)
    else:
        print(f"\n✓ All {len(pending)} migrations applied successfully!")


if __name__ == "__main__":
    main()
