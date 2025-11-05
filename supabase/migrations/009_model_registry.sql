-- Migration: Model Registry for fine-tuned model management
-- Supports versioning, A/B testing, and deployments

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL,  -- e.g., 'qa-expert', 'qa-automation'
    version VARCHAR(50) NOT NULL,  -- e.g., 'v1.0', 'v1.1'
    base_model VARCHAR(100) NOT NULL,  -- e.g., 'qwen2.5:7b-instruct'
    model_path TEXT NOT NULL,  -- Path to model weights
    status VARCHAR(20) NOT NULL DEFAULT 'staged',  -- training, staged, active, deprecated, archived
    metrics JSONB,  -- Training metrics, evaluation scores
    metadata JSONB,  -- Additional metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    
    UNIQUE(model_id, version)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_model_registry_model_id ON model_registry(model_id);
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_active ON model_registry(model_id, status) WHERE status = 'active';

-- A/B Test tracking
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id VARCHAR(100) NOT NULL UNIQUE,
    model_id VARCHAR(100) NOT NULL,
    control_version VARCHAR(50) NOT NULL,
    treatment_version VARCHAR(50) NOT NULL,
    percentage INTEGER NOT NULL DEFAULT 10,  -- Percentage of traffic for treatment
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, completed, cancelled
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    metrics JSONB,  -- A/B test results
    created_by VARCHAR(100),
    
    FOREIGN KEY (model_id, control_version) REFERENCES model_registry(model_id, version),
    FOREIGN KEY (model_id, treatment_version) REFERENCES model_registry(model_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_model_id ON ab_tests(model_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status) WHERE status = 'active';

-- Model usage tracking
CREATE TABLE IF NOT EXISTS model_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    user_id VARCHAR(100),
    organization_id UUID,
    endpoint VARCHAR(200),
    request_hash VARCHAR(64),  -- For deduplication
    latency_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    FOREIGN KEY (model_id, version) REFERENCES model_registry(model_id, version)
);

CREATE INDEX IF NOT EXISTS idx_model_usage_model_version ON model_usage(model_id, version);
CREATE INDEX IF NOT EXISTS idx_model_usage_created_at ON model_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_request_hash ON model_usage(request_hash);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_model_registry_updated_at ON model_registry;
CREATE TRIGGER update_model_registry_updated_at 
    BEFORE UPDATE ON model_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE model_registry IS 'Stores fine-tuned model versions and deployment status';
COMMENT ON TABLE ab_tests IS 'Tracks A/B tests between model versions';
COMMENT ON TABLE model_usage IS 'Tracks model usage for analytics and A/B testing';


