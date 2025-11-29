-- Migration: App-First Flow Tables
-- Creates tables for App-First Flow feature: defects, findings, and flow metadata

-- Defects table (enhanced)
CREATE TABLE IF NOT EXISTS defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID REFERENCES test_runs(id),
    test_case_id UUID REFERENCES test_cases(id),
    project_id UUID,
    requirement_id UUID REFERENCES requirements(id),
    tenant_id UUID,
    
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(50) CHECK (category IN ('functional', 'performance', 'accessibility', 'security', 'ui', 'api')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'rejected')),
    
    failure_message TEXT,
    failure_step INTEGER,
    root_cause TEXT,
    reproduction_steps JSONB,
    
    screenshot_path TEXT,
    logs TEXT,
    test_steps JSONB,
    
    jira_issue_key VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_test_run_id ON defects(test_run_id);
CREATE INDEX IF NOT EXISTS idx_defects_test_case_id ON defects(test_case_id);
CREATE INDEX IF NOT EXISTS idx_defects_project_id ON defects(project_id);
CREATE INDEX IF NOT EXISTS idx_defects_tenant_id ON defects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_severity ON defects(severity);

-- App-First Flows table
CREATE TABLE IF NOT EXISTS app_first_flows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID,
    test_case_id UUID REFERENCES test_cases(id),
    project_id UUID,
    tenant_id UUID,
    
    status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'generated', 'executed', 'failed')),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_first_flows_recording_id ON app_first_flows(recording_id);
CREATE INDEX IF NOT EXISTS idx_app_first_flows_test_case_id ON app_first_flows(test_case_id);
CREATE INDEX IF NOT EXISTS idx_app_first_flows_project_id ON app_first_flows(project_id);
CREATE INDEX IF NOT EXISTS idx_app_first_flows_tenant_id ON app_first_flows(tenant_id);

-- Enhance recordings table if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'recordings' AND column_name = 'data') THEN
        ALTER TABLE recordings ADD COLUMN data JSONB;
    END IF;
END $$;

-- Performance findings (if not exists)
CREATE TABLE IF NOT EXISTS perf_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    perf_run_id UUID REFERENCES perf_runs(id),
    flow_id UUID REFERENCES app_first_flows(id),
    project_id UUID,
    tenant_id UUID,
    
    finding_type VARCHAR(50),
    metric_name VARCHAR(100),
    value DECIMAL(10,2),
    threshold DECIMAL(10,2),
    severity VARCHAR(20),
    description TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_findings_flow_id ON perf_findings(flow_id);
CREATE INDEX IF NOT EXISTS idx_perf_findings_tenant_id ON perf_findings(tenant_id);

-- Accessibility findings (if not exists)
CREATE TABLE IF NOT EXISTS a11y_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID,
    flow_id UUID REFERENCES app_first_flows(id),
    project_id UUID,
    tenant_id UUID,
    
    issue_type VARCHAR(100),
    severity VARCHAR(20),
    description TEXT,
    element TEXT,
    wcag_reference VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a11y_findings_flow_id ON a11y_findings(flow_id);
CREATE INDEX IF NOT EXISTS idx_a11y_findings_tenant_id ON a11y_findings(tenant_id);

-- Comments
COMMENT ON TABLE defects IS 'Defects captured automatically from test failures';
COMMENT ON TABLE app_first_flows IS 'Metadata for App-First Flow executions';
COMMENT ON TABLE perf_findings IS 'Performance findings from App-First Flow';
COMMENT ON TABLE a11y_findings IS 'Accessibility findings from App-First Flow';



