-- Migration: Accessibility Issues Table
-- Phase 3.2: Accessibility Agent

CREATE TABLE IF NOT EXISTS accessibility_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(2048) NOT NULL,
    project_id UUID,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accessibility_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES accessibility_scans(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- 'missing_alt_text', 'heading_hierarchy', etc.
    severity VARCHAR(20) NOT NULL, -- 'critical', 'high', 'medium', 'low'
    description TEXT NOT NULL,
    element TEXT, -- CSS selector or element description
    wcag_reference VARCHAR(50), -- WCAG guideline reference (e.g., '1.1.1')
    code_snippet TEXT, -- HTML code snippet
    project_id UUID,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_scans_project ON accessibility_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_scans_tenant ON accessibility_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_issues_scan ON accessibility_issues(scan_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_issues_severity ON accessibility_issues(severity);
CREATE INDEX IF NOT EXISTS idx_accessibility_issues_project ON accessibility_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_issues_tenant ON accessibility_issues(tenant_id);



