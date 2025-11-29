-- Migration: Flowstral Tables
-- Creates tables for Flowstral Action Graph Intelligence Engine

-- Flowstral Sessions
CREATE TABLE IF NOT EXISTS flowstral_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID,
    user_id UUID,
    tenant_id UUID,
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'stopped', 'completed')),
    start_timestamp TIMESTAMP DEFAULT NOW(),
    stop_timestamp TIMESTAMP,
    duration_seconds INTEGER,
    
    initial_url TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flowstral_sessions_project_id ON flowstral_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_sessions_user_id ON flowstral_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_sessions_tenant_id ON flowstral_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_sessions_status ON flowstral_sessions(status);

-- Action Graph Nodes
CREATE TABLE IF NOT EXISTS action_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    tenant_id UUID,
    
    event_type VARCHAR(50),
    target_selector TEXT,
    target_text TEXT,
    url TEXT,
    
    state_before UUID REFERENCES action_graph_nodes(id),
    state_after UUID REFERENCES action_graph_nodes(id),
    
    dom_snapshot_id UUID,
    wcag_snapshot_id UUID,
    performance_snapshot_id UUID,
    
    action_description TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_graph_nodes_session_id ON action_graph_nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_action_graph_nodes_tenant_id ON action_graph_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_graph_nodes_event_type ON action_graph_nodes(event_type);

-- Action Graph Edges
CREATE TABLE IF NOT EXISTS action_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    tenant_id UUID,
    
    from_node_id UUID REFERENCES action_graph_nodes(id),
    to_node_id UUID REFERENCES action_graph_nodes(id),
    
    action VARCHAR(50),
    transition_time_ms DECIMAL(10,2),
    latency_ms DECIMAL(10,2),
    warnings TEXT[],
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_graph_edges_session_id ON action_graph_edges(session_id);
CREATE INDEX IF NOT EXISTS idx_action_graph_edges_from_node ON action_graph_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_action_graph_edges_to_node ON action_graph_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_action_graph_edges_tenant_id ON action_graph_edges(tenant_id);

-- DOM Snapshots
CREATE TABLE IF NOT EXISTS dom_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    node_id UUID REFERENCES action_graph_nodes(id),
    tenant_id UUID,
    
    url TEXT,
    html_structure JSONB,
    css_state JSONB,
    component_tree JSONB,
    selector_set JSONB,
    screenshot_path TEXT,
    
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dom_snapshots_session_id ON dom_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_dom_snapshots_node_id ON dom_snapshots(node_id);
CREATE INDEX IF NOT EXISTS idx_dom_snapshots_tenant_id ON dom_snapshots(tenant_id);

-- WCAG Snapshots
CREATE TABLE IF NOT EXISTS wcag_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    node_id UUID REFERENCES action_graph_nodes(id),
    tenant_id UUID,
    
    url TEXT,
    component_selector TEXT,
    violations JSONB,
    summary JSONB,
    
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcag_snapshots_session_id ON wcag_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_wcag_snapshots_node_id ON wcag_snapshots(node_id);
CREATE INDEX IF NOT EXISTS idx_wcag_snapshots_tenant_id ON wcag_snapshots(tenant_id);

-- Performance Snapshots
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    node_id UUID REFERENCES action_graph_nodes(id),
    tenant_id UUID,
    
    url TEXT,
    page_level JSONB,
    component_timing JSONB,
    network_calls JSONB,
    bottlenecks JSONB,
    summary JSONB,
    
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_snapshots_session_id ON performance_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_node_id ON performance_snapshots(node_id);
CREATE INDEX IF NOT EXISTS idx_performance_snapshots_tenant_id ON performance_snapshots(tenant_id);

-- Flowstral Artifacts
CREATE TABLE IF NOT EXISTS flowstral_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES flowstral_sessions(id),
    tenant_id UUID,
    
    artifact_type VARCHAR(50),  -- action_graph, playwright_script, test_cases, accessibility_report, performance_report, defects
    artifact_data JSONB,
    export_format VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flowstral_artifacts_session_id ON flowstral_artifacts(session_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_artifacts_tenant_id ON flowstral_artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_artifacts_type ON flowstral_artifacts(artifact_type);

-- Comments
COMMENT ON TABLE flowstral_sessions IS 'Flowstral session management';
COMMENT ON TABLE action_graph_nodes IS 'Action Graph nodes (user interactions)';
COMMENT ON TABLE action_graph_edges IS 'Action Graph edges (transitions between nodes)';
COMMENT ON TABLE dom_snapshots IS 'DOM snapshots captured during Flowstral session';
COMMENT ON TABLE wcag_snapshots IS 'WCAG accessibility snapshots';
COMMENT ON TABLE performance_snapshots IS 'Performance metrics snapshots';
COMMENT ON TABLE flowstral_artifacts IS 'Generated Flowstral artifacts (6 types)';



