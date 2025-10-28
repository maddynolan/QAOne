-- Initialize QA AI Platform Database
-- This script sets up the initial database schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS qaai;

-- Set search path
SET search_path TO qaai, public;

-- Plans table - stores test plans generated from specifications
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    source TEXT NOT NULL, -- Original specification content
    targets JSONB NOT NULL, -- Target endpoints/components
    api_ui JSONB NOT NULL, -- API vs UI test configuration
    path VARCHAR(1000),
    priority INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, archived
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Suites table - stores test suite definitions
CREATE TABLE IF NOT EXISTS suites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suite_id VARCHAR(255) UNIQUE NOT NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    test_type VARCHAR(50) NOT NULL, -- postman, playwright, k6, axe-core
    artifacts JSONB NOT NULL, -- Test artifact definitions
    path VARCHAR(1000),
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, running, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Runs table - stores test execution results
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(255) UNIQUE NOT NULL,
    suite_id UUID REFERENCES suites(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL, -- running, passed, failed, skipped, error
    pass_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    skip_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    reports JSONB DEFAULT '[]'::jsonb, -- JUnit reports and artifacts
    logs TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Triage results table - stores failure analysis
CREATE TABLE IF NOT EXISTS triage_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    clusters JSONB NOT NULL, -- Root cause clusters
    suggested_fix TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, applied
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Patches table - stores test update patches
CREATE TABLE IF NOT EXISTS patches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    triage_id UUID REFERENCES triage_results(id) ON DELETE CASCADE,
    file_path VARCHAR(1000) NOT NULL,
    unified_diff TEXT NOT NULL,
    open_pr BOOLEAN DEFAULT FALSE,
    pr_url VARCHAR(1000),
    state VARCHAR(50) DEFAULT 'pending', -- pending, applied, rejected
    branch VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Events table - stores audit trail and system events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- plan, suite, run, triage, patch
    entity_id UUID NOT NULL,
    user_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector embeddings table for memory and context
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- spec, log, run_result, triage
    entity_id UUID,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plans_plan_id ON plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at);

CREATE INDEX IF NOT EXISTS idx_suites_suite_id ON suites(suite_id);
CREATE INDEX IF NOT EXISTS idx_suites_plan_id ON suites(plan_id);
CREATE INDEX IF NOT EXISTS idx_suites_test_type ON suites(test_type);
CREATE INDEX IF NOT EXISTS idx_suites_status ON suites(status);

CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_suite_id ON runs(suite_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);

CREATE INDEX IF NOT EXISTS idx_triage_run_id ON triage_results(run_id);
CREATE INDEX IF NOT EXISTS idx_triage_status ON triage_results(status);

CREATE INDEX IF NOT EXISTS idx_patches_triage_id ON patches(triage_id);
CREATE INDEX IF NOT EXISTS idx_patches_state ON patches(state);

CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suites_updated_at BEFORE UPDATE ON suites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_triage_updated_at BEFORE UPDATE ON triage_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for development
INSERT INTO plans (plan_id, name, description, source, targets, api_ui, path, priority, created_by) VALUES
('plan-001', 'E-commerce API Tests', 'Comprehensive test plan for e-commerce API endpoints', 'OpenAPI spec for e-commerce API', '{"endpoints": ["/products", "/orders", "/users"]}', '{"api": true, "ui": false}', '/api/v1', 1, 'system'),
('plan-002', 'User Dashboard UI Tests', 'UI test plan for user dashboard functionality', 'User stories and acceptance criteria', '{"pages": ["/dashboard", "/profile", "/settings"]}', '{"api": false, "ui": true}', '/dashboard', 2, 'system')
ON CONFLICT (plan_id) DO NOTHING;
