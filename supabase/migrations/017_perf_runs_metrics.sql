-- Migration: Performance Runs and Metrics Tables
-- Phase 3.1: Performance Testing Agent

CREATE TABLE IF NOT EXISTS perf_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID,
    requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL,
    test_script TEXT NOT NULL,
    options JSONB,
    result JSONB,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS perf_metrics (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES perf_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL, -- 'http_req_duration', 'http_req_failed', etc.
    value DECIMAL(15, 4),
    unit VARCHAR(50), -- 'ms', 'rps', 'percent', etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_runs_project ON perf_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_perf_runs_tenant ON perf_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_run ON perf_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_name ON perf_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp ON perf_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_perf_metrics_tenant ON perf_metrics(tenant_id);



