-- ============================================================
-- Migration 040: Universal Artifact Version Control + Branching
-- Extends version history to ALL artifact types with branch support
-- ============================================================

-- Universal artifact versions table
CREATE TABLE IF NOT EXISTS artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type VARCHAR(50) NOT NULL,
    artifact_id UUID NOT NULL,
    version INTEGER NOT NULL,
    change_type VARCHAR(20) DEFAULT 'modified'
        CHECK (change_type IN ('created', 'modified', 'deleted', 'restored', 'merged', 'branched')),
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_by_name VARCHAR(255),
    snapshot JSONB NOT NULL,
    diff_summary TEXT,
    diff_details JSONB,
    parent_version_id UUID REFERENCES artifact_versions(id),
    branch_name VARCHAR(100) DEFAULT 'main',
    metadata JSONB DEFAULT '{}',
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(artifact_type, artifact_id, version, branch_name)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_artifact_versions_lookup
    ON artifact_versions(artifact_type, artifact_id, branch_name, version DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_project
    ON artifact_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_user
    ON artifact_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_created
    ON artifact_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_parent
    ON artifact_versions(parent_version_id) WHERE parent_version_id IS NOT NULL;

-- Artifact branches table (tracks active branches per artifact)
CREATE TABLE IF NOT EXISTS artifact_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type VARCHAR(50) NOT NULL,
    artifact_id UUID NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    created_from_version_id UUID REFERENCES artifact_versions(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    merged_at TIMESTAMPTZ,
    merged_by UUID REFERENCES users(id),
    merge_target_branch VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(artifact_type, artifact_id, branch_name)
);

CREATE INDEX IF NOT EXISTS idx_artifact_branches_lookup
    ON artifact_branches(artifact_type, artifact_id, is_active);

-- RLS
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY artifact_versions_read ON artifact_versions FOR SELECT USING (true);
CREATE POLICY artifact_versions_write ON artifact_versions FOR ALL USING (true);
CREATE POLICY artifact_branches_read ON artifact_branches FOR SELECT USING (true);
CREATE POLICY artifact_branches_write ON artifact_branches FOR ALL USING (true);

-- Comment
COMMENT ON TABLE artifact_versions IS 'Universal version control for all artifact types. Supports branching (main, feature branches) with JSONB snapshots and diff tracking.';
COMMENT ON TABLE artifact_branches IS 'Tracks active branches per artifact for branch-and-merge workflows.';
