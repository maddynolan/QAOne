# Database Schema Documentation

> **PostgreSQL/SQLite Database Reference**  
> Tables, Types, Migrations, and Row Level Security

## Table of Contents

1. [Overview](#overview)
2. [Database Configuration](#database-configuration)
3. [Custom Types](#custom-types)
4. [Core Tables](#core-tables)
5. [Test Management Tables](#test-management-tables)
6. [Execution Tables](#execution-tables)
7. [AI & Analysis Tables](#ai--analysis-tables)
8. [Flowstral Tables](#flowstral-tables)
9. [Security Tables](#security-tables)
10. [Row Level Security](#row-level-security)
11. [Migrations](#migrations)
12. [SQLite Fallback](#sqlite-fallback)

---

## Overview

QAAI uses PostgreSQL as its primary database with SQLite as a development/fallback option.

### Key Features

| Feature | Implementation |
|---------|----------------|
| Multi-tenancy | Organization → Project hierarchy |
| Row Level Security | Enforced at database level |
| UUID Primary Keys | Distributed-safe identifiers |
| JSONB Columns | Flexible schema for steps, settings |
| Automatic Timestamps | created_at, updated_at triggers |

---

## Database Configuration

### PostgreSQL (Production)

```bash
# Environment variable
DATABASE_URL=postgresql://user:password@host:5432/qaai

# Connection pooling
MAX_CONNECTIONS=20
POOL_TIMEOUT=30
```

### SQLite (Development)

```bash
# Fallback database file
SQLITE_PATH=./backend/qa_platform.db
```

---

## Custom Types

### Enum Types

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Test status
CREATE TYPE test_status AS ENUM ('draft', 'active', 'archived', 'deprecated');

-- Test priority
CREATE TYPE test_priority AS ENUM ('P0', 'P1', 'P2', 'P3');

-- Test type
CREATE TYPE test_type AS ENUM ('manual', 'automated', 'api', 'ui', 'e2e', 'performance');

-- Run status
CREATE TYPE run_status AS ENUM ('pending', 'running', 'passed', 'failed', 'partial', 'error', 'cancelled');

-- Step status
CREATE TYPE step_status AS ENUM ('pending', 'passed', 'failed', 'skipped', 'error');

-- Artifact type
CREATE TYPE artifact_type AS ENUM ('screenshot', 'video', 'trace', 'har', 'log', 'other');

-- Triage category
CREATE TYPE triage_category AS ENUM ('locator', 'timing', 'network', 'data', 'enviro');
```

---

## Core Tables

### Organizations

Top-level tenant container.

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Projects

Projects within an organization.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, slug)
);
```

### Users

User accounts.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Organization Memberships

User-organization relationship with roles.

```sql
CREATE TABLE org_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);
```

### Project Memberships

User-project relationship (can override org role).

```sql
CREATE TABLE project_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    UNIQUE(project_id, user_id)
);
```

---

## Test Management Tables

### Test Plans

Collection of test cases for organized execution.

```sql
CREATE TABLE test_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status test_status DEFAULT 'draft',
    settings JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Test Cases

Individual test case definitions.

```sql
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    test_type test_type DEFAULT 'manual',
    status test_status DEFAULT 'draft',
    tags TEXT[] DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',       -- Array of step objects
    preconditions TEXT[] DEFAULT '{}',
    test_data JSONB DEFAULT '{}',
    estimated_time INTEGER DEFAULT 15,        -- minutes
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Steps JSONB Structure:**

```json
[
    {
        "step_number": 1,
        "action": "Navigate to login page",
        "expected_result": "Login form displayed",
        "test_data": "URL: https://example.com/login",
        "selector": "page.goto('https://example.com/login')"
    },
    {
        "step_number": 2,
        "action": "Enter username",
        "expected_result": "Username accepted",
        "test_data": "user@example.com",
        "selector": "page.get_by_label('Email').fill('user@example.com')"
    }
]
```

### Requirements

Business requirements linked to test cases.

```sql
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    status VARCHAR(50) DEFAULT 'draft',
    acceptance_criteria JSONB DEFAULT '[]',
    source VARCHAR(100),                      -- Jira, Confluence, etc.
    external_id VARCHAR(255),                 -- External system ID
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Test Case Requirements (Junction)

Links test cases to requirements for traceability.

```sql
CREATE TABLE test_case_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_case_id, requirement_id)
);
```

---

## Execution Tables

### Test Runs

Individual test execution sessions.

```sql
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    status run_status DEFAULT 'pending',
    environment VARCHAR(50) DEFAULT 'local',
    browser VARCHAR(50) DEFAULT 'chromium',
    branch VARCHAR(255),                      -- Git branch
    commit VARCHAR(255),                      -- Git commit SHA
    runner_version VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Test Run Steps

Individual step executions within a run.

```sql
CREATE TABLE test_run_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    status step_status DEFAULT 'pending',
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    stdout TEXT,
    stderr TEXT,
    healed_selector TEXT,                     -- If self-healing applied
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Artifacts

Screenshots, videos, logs from test runs.

```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    type artifact_type NOT NULL,
    url TEXT NOT NULL,                        -- Storage path/URL
    size_bytes INTEGER,
    checksum VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## AI & Analysis Tables

### AI Generation Audit

Tracks all AI/LLM API calls.

```sql
CREATE TABLE ai_generation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    operation VARCHAR(50) NOT NULL,           -- generate_tests, triage, etc.
    model VARCHAR(100) NOT NULL,              -- claude-3-sonnet, qwen2.5
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10,4) NOT NULL,
    latency_ms INTEGER NOT NULL,
    request_data JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Triage Analysis

AI-generated analysis of test failures.

```sql
CREATE TABLE triage_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    category triage_category,
    suggested_fixes TEXT[] DEFAULT '{}',
    selector_suggestions TEXT[] DEFAULT '{}',
    likelihood_flaky DECIMAL(3,2) DEFAULT 0.0,
    related_cases UUID[] DEFAULT '{}',
    ai_model VARCHAR(100),
    confidence DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Cached Responses

LLM response caching for cost optimization.

```sql
CREATE TABLE cached_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    prompt_hash VARCHAR(64) NOT NULL,         -- SHA256 of normalized prompt
    model VARCHAR(100) NOT NULL,
    response TEXT NOT NULL,
    tokens_used INTEGER,
    hits INTEGER DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, prompt_hash, model)
);
```

---

## Flowstral Tables

### Recording Sessions

Browser recording sessions.

```sql
CREATE TABLE flowstral_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255),
    start_url TEXT NOT NULL,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'recording',
    events JSONB DEFAULT '[]',
    generated_script TEXT,
    framework VARCHAR(50) DEFAULT 'playwright-python',
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Element Models

Stored element patterns for self-healing.

```sql
CREATE TABLE element_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url_pattern VARCHAR(500) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    primary_selector TEXT NOT NULL,
    backup_selectors JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    visual_fingerprint BYTEA,
    context_hash VARCHAR(64),
    last_verified_at TIMESTAMP WITH TIME ZONE,
    heal_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Security Tables

### Defects

Bug/defect tracking.

```sql
CREATE TABLE defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    status VARCHAR(50) DEFAULT 'open',
    severity VARCHAR(50) DEFAULT 'medium',
    assigned_to UUID REFERENCES users(id),
    jira_id VARCHAR(100),                     -- External Jira issue ID
    triage_analysis_id UUID REFERENCES triage_analysis(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Audit Log

Immutable audit trail.

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Row Level Security

### Enable RLS

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
-- ... all tables
```

### Helper Functions

```sql
-- Get user's org memberships
CREATE OR REPLACE FUNCTION get_user_org_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT org_id 
        FROM org_memberships 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's project access
CREATE OR REPLACE FUNCTION get_user_project_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT DISTINCT p.id
        FROM projects p
        JOIN org_memberships om ON p.org_id = om.org_id
        WHERE om.user_id = user_uuid
        UNION
        SELECT project_id
        FROM project_memberships
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Policy Examples

```sql
-- Test cases: Users can only see cases in their projects
CREATE POLICY "Users can view test cases in their projects" ON test_cases
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create test cases in their projects" ON test_cases
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can update test cases in their projects" ON test_cases
    FOR UPDATE USING (project_id = ANY(get_user_project_ids(auth.uid())));
```

---

## Migrations

### Migration Files

Located in `supabase/migrations/`:

| Migration | Description |
|-----------|-------------|
| 001_initial_schema.sql | Core tables, types, RLS |
| 002_ai_generations.sql | AI generation tracking |
| 003_ai_templates.sql | Prompt templates |
| 004_requirements_table.sql | Requirements management |
| 005_fix_ai_generations.sql | Schema fixes |
| 006_enhance_test_lifecycle.sql | Test lifecycle improvements |
| 007_rag_foundation.sql | RAG embeddings |
| 008_ai_generations_quality_tracking.sql | AI quality metrics |
| 009_model_registry.sql | LLM model registry |
| 010_add_test_types.sql | Additional test types |
| 011_llm_usage_tracking.sql | LLM usage metrics |
| 012_multi_tenant_support.sql | Tenant configuration |
| 014_recordings.sql | Recording sessions |
| 021_flowstral_tables.sql | Flowstral specifics |
| 029_element_model_system.sql | Self-healing models |

### Running Migrations

```bash
# Using Supabase CLI
supabase db push

# Manual execution
psql $DATABASE_URL -f supabase/migrations/001_initial_schema.sql
```

---

## SQLite Fallback

When PostgreSQL is unavailable, the system falls back to SQLite.

### Schema (database_service.py)

```python
SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    project_id TEXT DEFAULT '00000000-0000-0000-0000-000000000000',
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'draft',
    test_type TEXT DEFAULT 'manual',
    steps TEXT DEFAULT '[]',  -- JSON string
    tags TEXT DEFAULT '[]',   -- JSON string
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    name TEXT,
    status TEXT DEFAULT 'pending',
    environment TEXT DEFAULT 'local',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_run_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES test_runs(id),
    step_number INTEGER,
    status TEXT DEFAULT 'pending',
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    screenshot_path TEXT,
    healed_selector TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'draft',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS defects (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    test_case_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""
```

### In-Memory Fallback

If both PostgreSQL and SQLite fail:

```python
# In routers (e.g., test_cases_crud_api.py)
_test_cases_store: Dict[str, Dict[str, Any]] = {}
_test_runs_store: Dict[str, Dict[str, Any]] = {}

def _is_postgres_available() -> bool:
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None and hasattr(pool, 'getconn')
    except Exception:
        return False
```

---

## Indexes

### Performance Indexes

```sql
CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_plan_id ON test_cases(plan_id);
CREATE INDEX idx_test_cases_status ON test_cases(status);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_run_steps_run_id ON test_run_steps(run_id);
CREATE INDEX idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX idx_defects_project_id ON defects(project_id);
CREATE INDEX idx_defects_status ON defects(status);
```

### Full-Text Search

```sql
CREATE INDEX idx_test_cases_title_search ON test_cases USING gin(to_tsvector('english', title));
CREATE INDEX idx_requirements_title_search ON requirements USING gin(to_tsvector('english', title));
```

---

*Last updated: December 2024*
