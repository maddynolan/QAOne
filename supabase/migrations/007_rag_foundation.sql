-- Migration: RAG Foundation - pgvector and embeddings
-- Enables vector similarity search for RAG (Retrieval Augmented Generation)

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create requirement_embeddings table for RAG
-- Stores vector embeddings of requirements for semantic search
CREATE TABLE IF NOT EXISTS requirement_embeddings (
    requirement_id UUID PRIMARY KEY REFERENCES requirements(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Vector embedding (384 dim for all-MiniLM-L6-v2, 768 for nomic-embed-text)
    -- Start with 384, can migrate to 768/1536 later if needed
    embedding vector(384) NOT NULL,
    
    -- Metadata
    embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2', -- Model used to generate embedding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_org_id ON requirement_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_project_id ON requirement_embeddings(project_id);

-- Vector similarity index using IVFFlat (Inverted File with Flat compression)
-- This enables fast approximate nearest neighbor search
-- lists = 100 is a good default (rule of thumb: sqrt(rows) for <1M rows)
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_vector ON requirement_embeddings 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_requirement_embeddings_updated_at ON requirement_embeddings;
CREATE TRIGGER update_requirement_embeddings_updated_at 
    BEFORE UPDATE ON requirement_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create cached_responses table for L2 semantic cache
-- Stores request/response pairs with semantic similarity matching
CREATE TABLE IF NOT EXISTS cached_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Cache key (hash of normalized prompt + org + model + policy)
    request_key TEXT NOT NULL,
    
    -- Request embedding for semantic similarity search
    request_embedding vector(384) NOT NULL,
    
    -- Response JSON (test cases, etc.)
    response_json JSONB NOT NULL,
    
    -- Metadata
    model_version TEXT NOT NULL, -- Model used (qwen2.5:7b, qwen2.5-coder:14b, etc.)
    prompt_template_version TEXT, -- Version of prompt template used
    test_type TEXT, -- 'manual', 'automated', 'api', etc.
    
    -- TTL and lifecycle
    ttl_days INTEGER DEFAULT 7, -- Time to live in days
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    hit_count INTEGER DEFAULT 0, -- How many times this cache was used
    last_hit_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for cached_responses
CREATE INDEX IF NOT EXISTS idx_cached_responses_org_id ON cached_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_cached_responses_request_key ON cached_responses(request_key);
CREATE INDEX IF NOT EXISTS idx_cached_responses_expires_at ON cached_responses(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_responses_project_id ON cached_responses(project_id) WHERE project_id IS NOT NULL;

-- Vector similarity index for semantic cache lookups
CREATE INDEX IF NOT EXISTS idx_cached_responses_vector ON cached_responses 
    USING ivfflat (request_embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Composite index for common queries (org + project + type)
CREATE INDEX IF NOT EXISTS idx_cached_responses_org_project_type 
    ON cached_responses(organization_id, project_id, test_type) 
    WHERE project_id IS NOT NULL AND test_type IS NOT NULL;

-- Function to set expires_at on insert
CREATE OR REPLACE FUNCTION set_cache_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.created_at + (NEW.ttl_days * interval '1 day');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set expires_at
DROP TRIGGER IF EXISTS set_cached_responses_expires_at ON cached_responses;
CREATE TRIGGER set_cached_responses_expires_at
    BEFORE INSERT ON cached_responses
    FOR EACH ROW
    EXECUTE FUNCTION set_cache_expires_at();

-- Function to update hit tracking
CREATE OR REPLACE FUNCTION update_cache_hit(p_cache_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE cached_responses
    SET hit_count = hit_count + 1,
        last_hit_at = NOW()
    WHERE id = p_cache_id;
END;
$$ LANGUAGE plpgsql;

-- Add normalized text fields to requirements for better RAG
-- body_clean is normalized text (no IDs, dates normalized, etc.)
ALTER TABLE requirements 
    ADD COLUMN IF NOT EXISTS body_clean TEXT,
    ADD COLUMN IF NOT EXISTS checksum TEXT; -- For change detection

-- Index for checksum lookups (for change detection)
CREATE INDEX IF NOT EXISTS idx_requirements_checksum ON requirements(checksum) WHERE checksum IS NOT NULL;

COMMENT ON TABLE requirement_embeddings IS 'Vector embeddings for requirements, used for RAG semantic search';
COMMENT ON TABLE cached_responses IS 'L2 semantic cache for LLM responses. Supports exact match (request_key) and semantic similarity (request_embedding)';
COMMENT ON COLUMN requirement_embeddings.embedding IS '384-dimensional vector embedding (can be changed to 768/1536 if using different model)';
COMMENT ON COLUMN cached_responses.request_embedding IS 'Embedding of the request prompt for semantic similarity matching (threshold >= 0.92)';

