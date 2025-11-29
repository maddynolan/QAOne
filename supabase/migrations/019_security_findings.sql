-- Migration: Security Findings Table
-- Phase 3.3: Security Agent

CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_url VARCHAR(2048) NOT NULL,
    scan_type VARCHAR(50) NOT NULL, -- 'spider', 'active', 'passive'
    project_id UUID,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    risk VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low', 'Informational'
    confidence VARCHAR(20) NOT NULL, -- 'High', 'Medium', 'Low'
    url VARCHAR(2048),
    parameter VARCHAR(500),
    solution TEXT,
    reference TEXT,
    cwe_id VARCHAR(20), -- CWE identifier
    wasc_id VARCHAR(20), -- WASC identifier
    group_id VARCHAR(255), -- For grouping related findings
    project_id UUID,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_project ON security_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_tenant ON security_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_scan ON security_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_risk ON security_findings(risk);
CREATE INDEX IF NOT EXISTS idx_security_findings_group ON security_findings(group_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_project ON security_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_tenant ON security_findings(tenant_id);



