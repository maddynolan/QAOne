-- Migration: Recordings Table
-- Phase 2.2: Automation Agent Enhancement

CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(500),
    data JSONB NOT NULL, -- Full recording data (snapshots, interactions, etc.)
    project_id UUID,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_project ON recordings(project_id);
CREATE INDEX IF NOT EXISTS idx_recordings_tenant ON recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created ON recordings(created_at DESC);



