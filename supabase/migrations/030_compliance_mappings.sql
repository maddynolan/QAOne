-- Migration: Compliance Framework Mappings
-- Stores compliance mappings for security tests

-- 1. Create compliance_mappings table
CREATE TABLE IF NOT EXISTS compliance_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id UUID REFERENCES test_cases(test_case_id) ON DELETE CASCADE,
    test_run_id UUID REFERENCES test_runs(test_run_id) ON DELETE CASCADE,
    security_finding_id UUID, -- References security_findings if applicable
    framework VARCHAR(50) NOT NULL, -- 'PCI_DSS', 'HIPAA', 'SOC2', 'GDPR', 'ISO27001'
    requirement_id VARCHAR(100) NOT NULL, -- e.g., 'PCI_DSS.6.5', 'HIPAA.164.312(a)(1)'
    requirement_title VARCHAR(255),
    requirement_description TEXT,
    validation_statement TEXT, -- "Test XYZ validates PCI DSS Requirement 6.5"
    test_status VARCHAR(50), -- 'passed', 'failed', 'not_run'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 2. Create compliance_reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'framework', 'test_run', 'project', 'organization'
    frameworks JSONB NOT NULL, -- Array of frameworks included
    report_data JSONB NOT NULL, -- Full compliance report data
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generated_by UUID REFERENCES users(user_id),
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_test_case ON compliance_mappings(test_case_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_test_run ON compliance_mappings(test_run_id);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_framework ON compliance_mappings(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_mappings_tenant ON compliance_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_tenant ON compliance_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_org_project ON compliance_reports(org_id, project_id);

-- 4. Enable Row-Level Security
ALTER TABLE compliance_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY compliance_mappings_tenant_isolation ON compliance_mappings
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

CREATE POLICY compliance_reports_tenant_isolation ON compliance_reports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_reports TO authenticated;

COMMENT ON TABLE compliance_mappings IS 'Maps security tests to compliance framework requirements';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for frameworks';
COMMENT ON COLUMN compliance_mappings.validation_statement IS 'Human-readable statement: "Test XYZ validates PCI DSS Requirement 6.5"';

