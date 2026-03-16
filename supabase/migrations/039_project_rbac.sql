-- ============================================================
-- Migration 039: Project-Level RBAC
-- Fine-grained permissions per project membership
-- ============================================================

-- Project role enum (if not exists)
DO $$ BEGIN
    CREATE TYPE project_role AS ENUM ('admin', 'lead', 'tester', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add project_role column to project_memberships
ALTER TABLE project_memberships
    ADD COLUMN IF NOT EXISTS project_role VARCHAR(20) DEFAULT 'tester';

-- Default permission sets per project role
CREATE TABLE IF NOT EXISTS project_role_permissions (
    role VARCHAR(20) PRIMARY KEY,
    permissions TEXT[] NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default permission sets
INSERT INTO project_role_permissions (role, permissions, description) VALUES
    ('admin', ARRAY[
        'test_cases:create', 'test_cases:read', 'test_cases:update', 'test_cases:delete',
        'test_runs:create', 'test_runs:read', 'test_runs:update', 'test_runs:delete',
        'test_plans:create', 'test_plans:read', 'test_plans:update', 'test_plans:delete',
        'api_collections:create', 'api_collections:read', 'api_collections:update', 'api_collections:delete',
        'perf_scenarios:create', 'perf_scenarios:read', 'perf_scenarios:update', 'perf_scenarios:delete',
        'mobile_flows:create', 'mobile_flows:read', 'mobile_flows:update', 'mobile_flows:delete',
        'visual_baselines:create', 'visual_baselines:read', 'visual_baselines:update', 'visual_baselines:delete',
        'a11y_configs:create', 'a11y_configs:read', 'a11y_configs:update', 'a11y_configs:delete',
        'defects:create', 'defects:read', 'defects:update', 'defects:delete',
        'requirements:create', 'requirements:read', 'requirements:update', 'requirements:delete',
        'locks:admin',
        'members:manage',
        'settings:manage'
    ], 'Full project access including member and settings management'),

    ('lead', ARRAY[
        'test_cases:create', 'test_cases:read', 'test_cases:update', 'test_cases:delete',
        'test_runs:create', 'test_runs:read', 'test_runs:update', 'test_runs:delete',
        'test_plans:create', 'test_plans:read', 'test_plans:update', 'test_plans:delete',
        'api_collections:create', 'api_collections:read', 'api_collections:update', 'api_collections:delete',
        'perf_scenarios:create', 'perf_scenarios:read', 'perf_scenarios:update', 'perf_scenarios:delete',
        'mobile_flows:create', 'mobile_flows:read', 'mobile_flows:update', 'mobile_flows:delete',
        'visual_baselines:create', 'visual_baselines:read', 'visual_baselines:update', 'visual_baselines:delete',
        'a11y_configs:create', 'a11y_configs:read', 'a11y_configs:update', 'a11y_configs:delete',
        'defects:create', 'defects:read', 'defects:update', 'defects:delete',
        'requirements:create', 'requirements:read', 'requirements:update', 'requirements:delete',
        'locks:admin'
    ], 'Full CRUD access plus lock management, no member/settings management'),

    ('tester', ARRAY[
        'test_cases:create', 'test_cases:read', 'test_cases:update',
        'test_runs:create', 'test_runs:read', 'test_runs:update',
        'test_plans:read',
        'api_collections:create', 'api_collections:read', 'api_collections:update',
        'perf_scenarios:create', 'perf_scenarios:read', 'perf_scenarios:update',
        'mobile_flows:create', 'mobile_flows:read', 'mobile_flows:update',
        'visual_baselines:create', 'visual_baselines:read', 'visual_baselines:update',
        'a11y_configs:read', 'a11y_configs:update',
        'defects:create', 'defects:read', 'defects:update',
        'requirements:read'
    ], 'Create and update artifacts, cannot delete or manage members'),

    ('viewer', ARRAY[
        'test_cases:read',
        'test_runs:read',
        'test_plans:read',
        'api_collections:read',
        'perf_scenarios:read',
        'mobile_flows:read',
        'visual_baselines:read',
        'a11y_configs:read',
        'defects:read',
        'requirements:read'
    ], 'Read-only access to all artifacts')
ON CONFLICT (role) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- Index for project membership queries
CREATE INDEX IF NOT EXISTS idx_project_memberships_user_project
    ON project_memberships(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_project_role
    ON project_memberships(project_id, project_role);

-- RLS
ALTER TABLE project_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_role_permissions_read ON project_role_permissions
    FOR SELECT USING (true);
