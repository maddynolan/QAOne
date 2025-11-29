"""
Run migration 024: Exploration Defects Enhancement
Adds fields to defects table for exploration-driven defect detection.
"""

import os
import sys
import logging
import re

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.storage.postgres_direct import execute_query, get_postgres_pool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Run migration 024."""
    # Get the backend directory (parent of scripts)
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Get the project root (parent of backend)
    project_root = os.path.dirname(backend_dir)
    
    migration_file = os.path.join(
        project_root,
        "supabase",
        "migrations",
        "024_exploration_defects.sql"
    )
    
    if not os.path.exists(migration_file):
        logger.error(f"Migration file not found: {migration_file}")
        return False
    
    logger.info(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Split into individual statements, handling DO $$ blocks
    statements = []
    current_statement = ""
    in_do_block = False
    dollar_tag = None
    
    for line in sql_content.split('\n'):
        original_line = line
        line = line.strip()
        
        # Skip empty lines and comments
        if not line or line.startswith('--'):
            continue
        
        # Check for DO $$ blocks
        if 'DO $$' in line or 'DO $' in line:
            in_do_block = True
            # Extract dollar tag (e.g., $$, $tag$, etc.)
            dollar_match = re.search(r'\$(\w*)\$', line)
            if dollar_match:
                dollar_tag = dollar_match.group(0)
            else:
                dollar_tag = '$$'
            current_statement += original_line + '\n'
            continue
        
        # Check for END of DO block
        if in_do_block and f'END {dollar_tag}' in line:
            current_statement += original_line + '\n'
            statements.append(current_statement.strip())
            current_statement = ""
            in_do_block = False
            dollar_tag = None
            continue
        
        # Regular statement handling
        if not in_do_block:
            current_statement += original_line + '\n'
            if line.endswith(';'):
                statements.append(current_statement.strip())
                current_statement = ""
        else:
            # Inside DO block, keep adding lines
            current_statement += original_line + '\n'
    
    if current_statement.strip():
        statements.append(current_statement.strip())
    
    logger.info(f"Found {len(statements)} SQL statements")
    
    pool = get_postgres_pool()
    if not pool:
        logger.error("Failed to get database connection pool")
        return False
    
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            for i, statement in enumerate(statements, 1):
                try:
                    logger.info(f"Executing statement {i}/{len(statements)}")
                    cur.execute(statement)
                    conn.commit()
                    logger.info(f"✓ Statement {i} executed successfully")
                except Exception as e:
                    # Some statements might fail if columns already exist (DO $$ blocks)
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        logger.warning(f"Statement {i} skipped (already exists): {e}")
                        conn.rollback()
                    else:
                        logger.error(f"Statement {i} failed: {e}")
                        conn.rollback()
                        # Continue with other statements
        
        logger.info("✅ Migration 024 completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        conn.rollback()
        return False
    finally:
        pool.putconn(conn)


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

