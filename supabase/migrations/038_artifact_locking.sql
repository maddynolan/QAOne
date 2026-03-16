-- ============================================================
-- Migration 038: Universal Artifact Locking (Check-out / Check-in)
-- Enterprise feature: Tosca-style exclusive edit locking
-- ============================================================

-- Artifact locks table — one active lock per artifact
CREATE TABLE IF NOT EXISTS artifact_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type VARCHAR(50) NOT NULL,
    artifact_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_by_name VARCHAR(255),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    lock_expires_at TIMESTAMPTZ,
    lock_reason TEXT,
    lock_version INTEGER DEFAULT 1,
    UNIQUE(artifact_type, artifact_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_artifact_locks_type_id ON artifact_locks(artifact_type, artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_locks_user ON artifact_locks(locked_by);
CREATE INDEX IF NOT EXISTS idx_artifact_locks_project ON artifact_locks(project_id);
CREATE INDEX IF NOT EXISTS idx_artifact_locks_expires ON artifact_locks(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

-- Lock history / audit trail
CREATE TABLE IF NOT EXISTS artifact_lock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_type VARCHAR(50) NOT NULL,
    artifact_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('acquired', 'released', 'force_released', 'expired', 'stolen')),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255),
    previous_owner UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lock_history_artifact ON artifact_lock_history(artifact_type, artifact_id);
CREATE INDEX IF NOT EXISTS idx_lock_history_user ON artifact_lock_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_lock_history_created ON artifact_lock_history(created_at);

-- RLS policies (for when RLS is enabled)
ALTER TABLE artifact_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_lock_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see all locks in their project
CREATE POLICY artifact_locks_project_read ON artifact_locks
    FOR SELECT USING (true);

CREATE POLICY artifact_locks_project_write ON artifact_locks
    FOR ALL USING (true);

CREATE POLICY artifact_lock_history_read ON artifact_lock_history
    FOR SELECT USING (true);

CREATE POLICY artifact_lock_history_write ON artifact_lock_history
    FOR INSERT WITH CHECK (true);

-- Comment on supported artifact types
COMMENT ON TABLE artifact_locks IS 'Universal artifact locking for check-out/check-in. Supported artifact_type values: test_case, api_collection, perf_scenario, mobile_flow, visual_baseline, a11y_config, test_plan, defect, requirement, test_suite';
