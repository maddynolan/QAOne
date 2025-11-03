-- Migration: Add ai_generations table to store LLM generations for fine-tuning
-- This table stores all AI/LLM calls for later use in fine-tuning custom models

CREATE TABLE IF NOT EXISTS ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    prompt TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    output TEXT NOT NULL,
    mode VARCHAR(50), -- 'quick', 'ui', 'heavy'
    endpoint VARCHAR(255), -- Which endpoint was called
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_ai_generations_project_id ON ai_generations(project_id);
CREATE INDEX idx_ai_generations_created_at ON ai_generations(created_at);
CREATE INDEX idx_ai_generations_model ON ai_generations(model);
CREATE INDEX idx_ai_generations_endpoint ON ai_generations(endpoint);

