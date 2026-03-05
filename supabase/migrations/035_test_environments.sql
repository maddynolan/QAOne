-- ============================================================================
-- 035: Test Environments
-- ============================================================================
-- Project-level test environments for switching between QA/Staging/Preprod
-- without duplicating test cases. At execution time, navigate step URLs are
-- rewritten by swapping the domain from test_base_url to env_base_url.
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    base_url TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
);

-- Index for fast lookup by project
CREATE INDEX IF NOT EXISTS idx_test_environments_project_id ON test_environments(project_id);

-- Ensure only one default per project (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_environments_default
    ON test_environments(project_id) WHERE is_default = true;
