"""
Auto-migration for PostgreSQL on startup.

Two-phase approach:
1. ALWAYS ensure core tables exist (essential for the app to work)
2. If supabase/migrations/ SQL files are found, run them for full schema

This ensures Railway deploys always have a working database, even if the
migration SQL files aren't in the Docker image.
"""

import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Core tables that MUST exist for the app to function ──────────────────
# These use CREATE TABLE IF NOT EXISTS so they're safe to run every time.
CORE_TABLES_SQL = """
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums (create only if they don't exist)
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('owner','admin','member','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE test_status AS ENUM ('draft','active','archived','deprecated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE test_priority AS ENUM ('P0','P1','P2','P3'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE test_type AS ENUM ('manual','automated','api','ui','e2e','performance'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE run_status AS ENUM ('pending','running','passed','failed','partial','error','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE step_status AS ENUM ('pending','passed','failed','skipped','error'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE artifact_type AS ENUM ('screenshot','video','trace','har','log','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE triage_category AS ENUM ('locator','timing','network','data','enviro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, slug)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Plans
CREATE TABLE IF NOT EXISTS test_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status test_status DEFAULT 'draft',
    settings JSONB DEFAULT '{}',
    milestone VARCHAR(255),
    sprint VARCHAR(100),
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    test_type test_type DEFAULT 'manual',
    status test_status DEFAULT 'draft',
    tags TEXT[] DEFAULT '{}',
    steps JSONB DEFAULT '[]',
    preconditions TEXT[] DEFAULT '{}',
    test_data JSONB DEFAULT '{}',
    estimated_time INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Runs
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    status run_status DEFAULT 'pending',
    environment VARCHAR(100),
    branch VARCHAR(255),
    commit VARCHAR(100),
    runner_version VARCHAR(50),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Run Steps
CREATE TABLE IF NOT EXISTS test_run_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    step_index INTEGER NOT NULL,
    action VARCHAR(100),
    target TEXT,
    value TEXT,
    status step_status DEFAULT 'pending',
    error_message TEXT,
    duration_ms INTEGER,
    selector_used TEXT,
    strategy_used VARCHAR(100),
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    type artifact_type NOT NULL,
    name VARCHAR(255),
    path TEXT NOT NULL,
    size_bytes BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defects
CREATE TABLE IF NOT EXISTS defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    status VARCHAR(50) DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    jira_id VARCHAR(100),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Requirements
CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source VARCHAR(50) DEFAULT 'manual',
    source_ref VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    raw_payload JSONB,
    acceptance_criteria TEXT,
    body_clean TEXT,
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Case Requirements (many-to-many)
CREATE TABLE IF NOT EXISTS test_case_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    UNIQUE(test_case_id, requirement_id)
);

-- Test Comments
CREATE TABLE IF NOT EXISTS test_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- License Store (for persistent license storage)
CREATE TABLE IF NOT EXISTS license_store (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    licenses JSONB NOT NULL DEFAULT '{}'::jsonb,
    activations JSONB NOT NULL DEFAULT '{}'::jsonb,
    saved_at TIMESTAMPTZ DEFAULT NOW()
);

-- License Audit Log
CREATE TABLE IF NOT EXISTS license_audit_log (
    id SERIAL PRIMARY KEY,
    entry JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration tracking
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    checksum TEXT
);

-- AI Settings (BYOK key management, per-org/project AI configuration)
CREATE TABLE IF NOT EXISTS ai_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL,
    project_id UUID,
    enabled BOOLEAN DEFAULT false,
    provider TEXT DEFAULT 'openai',
    model TEXT DEFAULT 'gpt-4o-mini',
    api_key_secret_id UUID,
    anthropic_key_secret_id UUID,
    custom_endpoint TEXT,
    max_requests_per_day INT DEFAULT 1000,
    max_cost_per_day_cents INT DEFAULT 1000,
    requests_today INT DEFAULT 0,
    cost_today_cents INT DEFAULT 0,
    budget_reset_at TIMESTAMPTZ DEFAULT NOW(),
    budget_tracking BOOLEAN DEFAULT true,
    enabled_features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Log (daily AI usage tracking per org)
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id BIGSERIAL PRIMARY KEY,
    org_id UUID NOT NULL,
    project_id UUID,
    provider TEXT NOT NULL,
    model TEXT,
    endpoint TEXT,
    tokens_in INT DEFAULT 0,
    tokens_out INT DEFAULT 0,
    cost_cents INT DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_plan ON test_cases(plan_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_run_steps_run ON test_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_defects_project ON defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_run ON defects(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_org ON ai_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_org_date ON ai_usage_log(org_id, created_at);
"""


def _ensure_core_tables(conn):
    """Create core tables if they don't exist. Safe to run every time."""
    try:
        with conn.cursor() as cur:
            cur.execute(CORE_TABLES_SQL)
            conn.commit()
        logger.info("[AutoMigrate] Core tables verified/created")
        return True
    except Exception as e:
        conn.rollback()
        logger.warning(f"[AutoMigrate] Core tables creation error: {e}")
        return False


def _find_migrations_dir() -> Path | None:
    """Search for supabase/migrations/ in multiple possible locations."""
    candidates = [
        # Local dev: backend/app/services/storage/ -> ../../.. -> supabase/migrations
        Path(__file__).parent.parent.parent.parent.parent / "supabase" / "migrations",
        # Docker with root context
        Path("/app/supabase/migrations"),
        # Docker with backend context (if copied)
        Path("/app/../supabase/migrations"),
    ]
    for p in candidates:
        if p.exists() and any(p.glob("*.sql")):
            return p
    return None


def _run_file_migrations(conn, migrations_dir: Path):
    """Run SQL migration files that haven't been applied yet."""
    migration_files = sorted(migrations_dir.glob("*.sql"))
    if not migration_files:
        return

    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM migration_history")
        applied = {row[0] for row in cur.fetchall()}

    pending = [f for f in migration_files if f.name not in applied]
    if not pending:
        logger.info(f"[AutoMigrate] All {len(applied)} file migrations up to date")
        return

    logger.info(f"[AutoMigrate] Running {len(pending)} pending file migrations...")
    for filepath in pending:
        filename = filepath.name
        sql = filepath.read_text(encoding="utf-8")
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO migration_history (filename, checksum) VALUES (%s, md5(%s))",
                    (filename, sql),
                )
                conn.commit()
            logger.info(f"[AutoMigrate] ✓ {filename}")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e):
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO migration_history (filename, checksum) VALUES (%s, 'partial') ON CONFLICT DO NOTHING",
                            (filename,),
                        )
                        conn.commit()
                except Exception:
                    conn.rollback()
            else:
                logger.warning(f"[AutoMigrate] ✗ {filename}: {str(e)[:200]}")


def run_auto_migrations(database_url: str):
    """Run pending migrations against PostgreSQL. Called from app startup."""
    try:
        import psycopg2
    except ImportError:
        logger.warning("[AutoMigrate] psycopg2 not installed, skipping")
        return

    # Try multiple SSL modes to handle Supabase/Railway/local PostgreSQL
    conn = None
    base = database_url
    sep = "&" if "?" in base else "?"
    attempts = [
        ("sslmode=require", base + sep + "sslmode=require"),
        ("sslmode=prefer", base + sep + "sslmode=prefer"),
        ("sslmode=disable", base + sep + "sslmode=disable"),
        ("as-is", base),
    ]
    
    for label, conn_str in attempts:
        try:
            conn = psycopg2.connect(conn_str, connect_timeout=5)
            conn.autocommit = False
            logger.info(f"[AutoMigrate] Connected to PostgreSQL ({label})")
            break
        except Exception as e:
            logger.info(f"[AutoMigrate] Connection ({label}) failed: {str(e)[:100]}")
            continue
    
    if not conn:
        logger.warning(f"[AutoMigrate] All connection methods failed")
        return

    try:
        # Phase 1: Always ensure core tables exist (embedded SQL, no files needed)
        _ensure_core_tables(conn)

        # Phase 2: Run file-based migrations if available (for full schema)
        migrations_dir = _find_migrations_dir()
        if migrations_dir:
            _run_file_migrations(conn, migrations_dir)
        else:
            logger.info("[AutoMigrate] No migration files found (core tables only)")

        # Insert default org + project if none exist (needed for CRUD routers)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM organizations")
                count = cur.fetchone()[0]
                if count == 0:
                    cur.execute("""
                        INSERT INTO organizations (id, name, slug) 
                        VALUES (uuid_generate_v4(), 'Default Organization', 'default')
                        RETURNING id
                    """)
                    org_id = cur.fetchone()[0]
                    cur.execute("""
                        INSERT INTO projects (id, org_id, name, slug)
                        VALUES (uuid_generate_v4(), %s, 'Default Project', 'default')
                    """, (org_id,))
                    conn.commit()
                    logger.info("[AutoMigrate] Created default organization and project")
        except Exception as e:
            conn.rollback()
            logger.warning(f"[AutoMigrate] Default org/project creation skipped: {e}")

        # Seed demo data if SEED_DEMO_DATA=true
        if os.getenv("SEED_DEMO_DATA", "").lower() == "true":
            try:
                from backend.app.scripts.seed_demo_data import main as seed_demo
                logger.info("[AutoMigrate] SEED_DEMO_DATA=true, seeding demo data...")
                seed_demo()
                logger.info("[AutoMigrate] Demo data seeded successfully")
            except Exception as e:
                logger.warning(f"[AutoMigrate] Demo data seeding skipped: {e}")

    finally:
        conn.close()
