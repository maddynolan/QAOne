-- ============================================================
-- Migration 042: Schema Isolation + Git Sync Columns
-- Per-tenant schema isolation mode and Git sync configuration
-- ============================================================

-- Add schema isolation mode to tenant config
DO $$ BEGIN
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS schema_mode VARCHAR(20) DEFAULT 'shared';
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS isolated_schema_name VARCHAR(100);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS schema_migrated_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add Git sync configuration columns to projects
DO $$ BEGIN
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_repo_url TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_branch VARCHAR(100) DEFAULT 'main';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_sync_enabled BOOLEAN DEFAULT false;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_auto_export BOOLEAN DEFAULT false;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_webhook_secret TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_provider VARCHAR(20) DEFAULT 'github';
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS git_last_sync_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schema isolation tracking table
CREATE TABLE IF NOT EXISTS schema_isolation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'migrated', 'dropped'
    schema_name VARCHAR(100) NOT NULL,
    tables_migrated INTEGER DEFAULT 0,
    rows_migrated BIGINT DEFAULT 0,
    duration_ms INTEGER,
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    performed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_iso_log_org ON schema_isolation_log(org_id, created_at DESC);

-- Compliance report storage
CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL, -- 'soc2', 'hipaa', 'gdpr', 'iso27001', 'access_review'
    title VARCHAR(255) NOT NULL,
    date_range_start TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,
    report_data JSONB NOT NULL DEFAULT '{}',
    summary JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'generated',
    generated_by UUID REFERENCES users(id),
    file_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_org ON compliance_reports(org_id, report_type, created_at DESC);

-- RLS
ALTER TABLE schema_isolation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY schema_iso_log_read ON schema_isolation_log FOR SELECT USING (true);
CREATE POLICY schema_iso_log_write ON schema_isolation_log FOR INSERT WITH CHECK (true);
CREATE POLICY compliance_reports_read ON compliance_reports FOR SELECT USING (true);
CREATE POLICY compliance_reports_write ON compliance_reports FOR ALL USING (true);

COMMENT ON TABLE schema_isolation_log IS 'Tracks schema isolation operations for audit trail';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports (SOC2, HIPAA, GDPR, ISO27001)';
