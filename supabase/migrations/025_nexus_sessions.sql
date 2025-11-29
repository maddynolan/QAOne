-- Migration: Nexus Autonomous Exploratory Testing Sessions
-- Creates tables for storing Nexus session state, queue, and history

-- Nexus Sessions Table
CREATE TABLE IF NOT EXISTS nexus_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    app_url TEXT NOT NULL,
    project_id UUID REFERENCES projects(id),
    status VARCHAR(50) NOT NULL DEFAULT 'running', -- running, complete, paused, failed
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    max_duration_seconds INTEGER NOT NULL DEFAULT 1800, -- 30 minutes default
    red_team_mode BOOLEAN NOT NULL DEFAULT FALSE,
    proof TEXT, -- Completion proof text
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus Session Queue (for priority queue persistence)
CREATE TABLE IF NOT EXISTS nexus_session_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES nexus_sessions(session_id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 99, -- Lower = higher priority (0 = P0, 1 = P1, 2 = P2)
    capability VARCHAR(255),
    url TEXT,
    flow_steps JSONB, -- Array of step names
    metadata JSONB, -- Additional target metadata
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Nexus Risk Heatmap
CREATE TABLE IF NOT EXISTS nexus_risk_heatmap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES nexus_sessions(session_id) ON DELETE CASCADE,
    capability VARCHAR(255) NOT NULL,
    risk_level VARCHAR(50) NOT NULL, -- Critical, High, Medium, Low
    reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, capability)
);

-- Nexus Session History (for conversation history)
CREATE TABLE IF NOT EXISTS nexus_session_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES nexus_sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- system, user, assistant, tool
    content TEXT,
    tool_calls JSONB, -- For assistant messages with tool calls
    tool_results JSONB, -- For tool messages
    sequence_number INTEGER NOT NULL, -- Order of messages
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus Detected Defects (links to main defects table)
CREATE TABLE IF NOT EXISTS nexus_defects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES nexus_sessions(session_id) ON DELETE CASCADE,
    defect_id UUID REFERENCES defects(id), -- Link to main defects table
    defect_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    page_url TEXT,
    evidence JSONB, -- Screenshots, logs, etc.
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Nexus E2E Flow Results
CREATE TABLE IF NOT EXISTS nexus_e2e_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL REFERENCES nexus_sessions(session_id) ON DELETE CASCADE,
    flow_name VARCHAR(255) NOT NULL,
    steps JSONB NOT NULL, -- Array of step names
    negative BOOLEAN NOT NULL DEFAULT FALSE,
    success BOOLEAN NOT NULL,
    execution_time_seconds FLOAT,
    evidence JSONB, -- Screenshots, logs
    error_message TEXT,
    defect_id UUID REFERENCES defects(id), -- If flow failed and created a defect
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_session_id ON nexus_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_status ON nexus_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nexus_sessions_project_id ON nexus_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_nexus_queue_session_id ON nexus_session_queue(session_id, processed);
CREATE INDEX IF NOT EXISTS idx_nexus_queue_priority ON nexus_session_queue(priority, processed);
CREATE INDEX IF NOT EXISTS idx_nexus_heatmap_session_id ON nexus_risk_heatmap(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_history_session_id ON nexus_session_history(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_nexus_defects_session_id ON nexus_defects(session_id);
CREATE INDEX IF NOT EXISTS idx_nexus_e2e_session_id ON nexus_e2e_results(session_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_nexus_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nexus_sessions_updated_at_trigger
    BEFORE UPDATE ON nexus_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_nexus_sessions_updated_at();
