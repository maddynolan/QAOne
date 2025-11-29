-- Migration: Test Jobs Table
-- Phase 2.3: Test Runner Service

CREATE TABLE IF NOT EXISTS test_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID,
    test_case_ids JSONB NOT NULL, -- Array of test case IDs
    browser VARCHAR(50) NOT NULL DEFAULT 'chromium', -- 'chromium', 'firefox', 'webkit'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    worker_id VARCHAR(255),
    metadata JSONB,
    results JSONB, -- Test execution results
    summary JSONB, -- Summary statistics
    error TEXT,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_jobs_project ON test_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_test_jobs_status ON test_jobs(status);
CREATE INDEX IF NOT EXISTS idx_test_jobs_tenant ON test_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_jobs_created ON test_jobs(created_at DESC);



