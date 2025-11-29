-- Migration: Maintenance Suggestions Table
-- Phase 2.2: Automation Agent Enhancement

CREATE TABLE IF NOT EXISTS maintenance_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    test_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- 'high_failure_rate', 'selector_instability', etc.
    priority VARCHAR(20) NOT NULL, -- 'high', 'medium', 'low'
    message TEXT NOT NULL,
    recommendations JSONB, -- Array of recommendation strings
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, test_id)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_suggestions_project ON maintenance_suggestions(project_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_suggestions_test ON maintenance_suggestions(test_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_suggestions_tenant ON maintenance_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_suggestions_priority ON maintenance_suggestions(priority);



