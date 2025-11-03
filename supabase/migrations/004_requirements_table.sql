-- Migration: Add requirements table for Jira/story intake
-- Tracks original requirements that test cases are generated from

CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'jira', 'manual', 'github', 'api'
    source_ref TEXT, -- 'jira key', 'issue id', 'PR number', etc.
    title TEXT NOT NULL,
    description TEXT,
    raw_payload JSONB, -- Full Jira JSON or other source data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_requirements_project_id ON requirements(project_id);
CREATE INDEX idx_requirements_source ON requirements(source);
CREATE INDEX idx_requirements_source_ref ON requirements(source_ref) WHERE source_ref IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON requirements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

