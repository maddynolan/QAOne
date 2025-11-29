-- Migration: Requirements Embeddings Table
-- Phase 2.1: Requirements Intelligence Agent

CREATE TABLE IF NOT EXISTS requirement_embeddings (
    id BIGSERIAL PRIMARY KEY,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    project_id UUID,
    embedding vector(384), -- Using 384-dim embeddings (MiniLM)
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_org ON requirement_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_project ON requirement_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_tenant ON requirement_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_vector ON requirement_embeddings USING ivfflat (embedding vector_cosine_ops);



