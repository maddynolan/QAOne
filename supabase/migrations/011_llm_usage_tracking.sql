-- Migration: Create llm_usage table for tracking LLM API usage, costs, and performance
-- Part of Phase 1.1: Model Gateway Service implementation

CREATE TABLE IF NOT EXISTS llm_usage (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255), -- For multi-tenant support (will be added in Phase 1.3)
    provider VARCHAR(50) NOT NULL, -- 'local_qwen', 'openai', 'anthropic', etc.
    model VARCHAR(100) NOT NULL, -- Model name used
    operation VARCHAR(50) NOT NULL, -- 'generate', 'chat', 'embedding'
    tokens_used INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0.0,
    latency_ms DECIMAL(10, 2), -- Response latency in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional metadata
    request_id VARCHAR(255), -- For correlating with requests
    user_id VARCHAR(255), -- User who made the request
    endpoint VARCHAR(255), -- API endpoint called
    error_message TEXT -- If request failed
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_id ON llm_usage(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON llm_usage(provider);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON llm_usage(model);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_operation ON llm_usage(operation);

-- Composite index for cost analysis
CREATE INDEX IF NOT EXISTS idx_llm_usage_cost_analysis 
    ON llm_usage(tenant_id, provider, created_at) 
    WHERE cost_usd > 0;

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_llm_usage_performance 
    ON llm_usage(provider, model, latency_ms) 
    WHERE latency_ms IS NOT NULL;

COMMENT ON TABLE llm_usage IS 'Tracks LLM API usage, costs, and performance metrics across all providers';
COMMENT ON COLUMN llm_usage.tenant_id IS 'Tenant identifier (for multi-tenant isolation)';
COMMENT ON COLUMN llm_usage.provider IS 'LLM provider: local_qwen, openai, anthropic, etc.';
COMMENT ON COLUMN llm_usage.model IS 'Specific model name used';
COMMENT ON COLUMN llm_usage.operation IS 'Operation type: generate, chat, embedding';
COMMENT ON COLUMN llm_usage.tokens_used IS 'Number of tokens consumed';
COMMENT ON COLUMN llm_usage.cost_usd IS 'Cost in USD (0.0 for local models)';
COMMENT ON COLUMN llm_usage.latency_ms IS 'Response latency in milliseconds';



