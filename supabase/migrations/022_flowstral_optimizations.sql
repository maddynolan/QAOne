-- Migration: Flowstral Optimizations
-- Adds tables for event coalescing, snapshot deduplication, selector registry, and project configuration

-- Event Queue for Resilient Event Delivery
CREATE TABLE IF NOT EXISTS event_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES flowstral_sessions(id) ON DELETE CASCADE,
    sequence_id INTEGER NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    UNIQUE(session_id, sequence_id),
    UNIQUE(session_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_queue_session_status ON event_queue(session_id, status);
CREATE INDEX IF NOT EXISTS idx_event_queue_sequence ON event_queue(session_id, sequence_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON event_queue(status) WHERE status = 'pending';

-- Event Processing Checkpoints
CREATE TABLE IF NOT EXISTS event_checkpoints (
    session_id UUID PRIMARY KEY REFERENCES flowstral_sessions(id) ON DELETE CASCADE,
    last_sequence_id INTEGER NOT NULL,
    checkpoint_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_checkpoints_session ON event_checkpoints(session_id);

-- Snapshot Content Registry for Deduplication
CREATE TABLE IF NOT EXISTS snapshot_content_registry (
    content_hash VARCHAR(64) PRIMARY KEY,
    snapshot_id UUID NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('dom', 'wcag', 'performance')),
    original_size BIGINT,
    compressed_size BIGINT,
    compression_ratio DECIMAL(5,2),
    compression_algorithm VARCHAR(20) DEFAULT 'brotli',
    reference_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_registry_type ON snapshot_content_registry(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshot_registry_snapshot_id ON snapshot_content_registry(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_registry_last_seen ON snapshot_content_registry(last_seen_at);

-- Event to Snapshot Links (with deduplication)
CREATE TABLE IF NOT EXISTS event_snapshot_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    node_id UUID REFERENCES action_graph_nodes(id) ON DELETE CASCADE,
    snapshot_id UUID NOT NULL,
    content_hash VARCHAR(64) REFERENCES snapshot_content_registry(content_hash),
    snapshot_type VARCHAR(20) NOT NULL,
    is_reference BOOLEAN DEFAULT FALSE,
    diff_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_snapshot_links_event ON event_snapshot_links(event_id);
CREATE INDEX IF NOT EXISTS idx_event_snapshot_links_node ON event_snapshot_links(node_id);
CREATE INDEX IF NOT EXISTS idx_event_snapshot_links_hash ON event_snapshot_links(content_hash);
CREATE INDEX IF NOT EXISTS idx_event_snapshot_links_type ON event_snapshot_links(snapshot_type);

-- Selector Registry for Cross-Session Learning
CREATE TABLE IF NOT EXISTS selector_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    element_fingerprint VARCHAR(255) NOT NULL,
    selector TEXT NOT NULL,
    selector_type VARCHAR(50) NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    match_count INTEGER,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_errors TEXT[],
    stability_score DECIMAL(5,2),
    first_used_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, element_fingerprint, selector)
);

CREATE INDEX IF NOT EXISTS idx_selector_registry_project_fingerprint ON selector_registry(project_id, element_fingerprint);
CREATE INDEX IF NOT EXISTS idx_selector_registry_stability ON selector_registry(project_id, stability_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_selector_registry_type ON selector_registry(selector_type);
CREATE INDEX IF NOT EXISTS idx_selector_registry_validated ON selector_registry(project_id, is_validated) WHERE is_validated = TRUE;

-- Selector Usage History
CREATE TABLE IF NOT EXISTS selector_usage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    selector_id UUID REFERENCES selector_registry(id) ON DELETE CASCADE,
    session_id UUID REFERENCES flowstral_sessions(id) ON DELETE CASCADE,
    node_id UUID REFERENCES action_graph_nodes(id) ON DELETE CASCADE,
    success BOOLEAN,
    match_count INTEGER,
    validation_errors TEXT[],
    used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selector_usage_selector ON selector_usage_history(selector_id);
CREATE INDEX IF NOT EXISTS idx_selector_usage_session ON selector_usage_history(session_id);
CREATE INDEX IF NOT EXISTS idx_selector_usage_node ON selector_usage_history(node_id);
CREATE INDEX IF NOT EXISTS idx_selector_usage_success ON selector_usage_history(success);

-- Project Configuration
CREATE TABLE IF NOT EXISTS flowstral_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE,
    tenant_id UUID,
    
    -- Pipeline configuration
    pipelines_enabled JSONB DEFAULT '{"dom": true, "wcag": true, "perf": true, "defects": true}',
    wcag_mode VARCHAR(20) DEFAULT 'full' CHECK (wcag_mode IN ('full', 'light', 'off')),
    wcag_run_on TEXT[] DEFAULT ARRAY['navigate', 'page_load', 'submit'],
    performance_mode VARCHAR(20) DEFAULT 'full' CHECK (performance_mode IN ('full', 'light', 'off')),
    performance_max_events_per_page INTEGER DEFAULT 5,
    
    -- Event coalescing
    coalescing_enabled BOOLEAN DEFAULT TRUE,
    coalescing_window_ms INTEGER DEFAULT 500,
    input_debounce_ms INTEGER DEFAULT 300,
    max_click_count INTEGER DEFAULT 5,
    
    -- Storage
    retention_policy VARCHAR(20) DEFAULT 'standard' CHECK (retention_policy IN ('full', 'standard', 'minimal')),
    retention_days INTEGER DEFAULT 90,
    deduplication_enabled BOOLEAN DEFAULT TRUE,
    compression_algorithm VARCHAR(20) DEFAULT 'brotli' CHECK (compression_algorithm IN ('brotli', 'gzip', 'none')),
    
    -- LLM usage
    llm_mode VARCHAR(20) DEFAULT 'full' CHECK (llm_mode IN ('none', 'summary_only', 'full')),
    llm_provider VARCHAR(50) DEFAULT 'openai',
    llm_model VARCHAR(100) DEFAULT 'gpt-4',
    
    -- Selector settings
    selector_validation_enabled BOOLEAN DEFAULT TRUE,
    selector_registry_enabled BOOLEAN DEFAULT TRUE,
    cross_session_learning BOOLEAN DEFAULT TRUE,
    
    -- Security
    pii_masking_enabled BOOLEAN DEFAULT TRUE,
    network_redaction_enabled BOOLEAN DEFAULT TRUE,
    sensitive_domains TEXT[],
    strip_headers TEXT[] DEFAULT ARRAY['Authorization', 'Cookie', 'X-Auth-Token'],
    
    -- Full config as JSONB for flexibility
    config_data JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flowstral_projects_project ON flowstral_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_flowstral_projects_tenant ON flowstral_projects(tenant_id);

-- Canonical Graphs (for future use)
CREATE TABLE IF NOT EXISTS canonical_graphs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    version INTEGER NOT NULL,
    graph_data JSONB NOT NULL,
    node_count INTEGER,
    edge_count INTEGER,
    coverage_metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, version)
);

CREATE INDEX IF NOT EXISTS idx_canonical_graphs_project ON canonical_graphs(project_id);
CREATE INDEX IF NOT EXISTS idx_canonical_graphs_version ON canonical_graphs(project_id, version DESC);

-- Canonical Graph Nodes
CREATE TABLE IF NOT EXISTS canonical_graph_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_graph_id UUID REFERENCES canonical_graphs(id) ON DELETE CASCADE,
    url_pattern VARCHAR(500) NOT NULL,
    title VARCHAR(255),
    key_elements TEXT[],
    hit_count INTEGER DEFAULT 0,
    unique_sessions INTEGER DEFAULT 0,
    avg_time_spent_ms INTEGER,
    first_seen_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    UNIQUE(canonical_graph_id, url_pattern)
);

CREATE INDEX IF NOT EXISTS idx_canonical_nodes_graph ON canonical_graph_nodes(canonical_graph_id);
CREATE INDEX IF NOT EXISTS idx_canonical_nodes_hit_count ON canonical_graph_nodes(canonical_graph_id, hit_count DESC);

-- Canonical Graph Edges
CREATE TABLE IF NOT EXISTS canonical_graph_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_graph_id UUID REFERENCES canonical_graphs(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES canonical_graph_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES canonical_graph_nodes(id) ON DELETE CASCADE,
    action_type VARCHAR(50),
    hit_count INTEGER DEFAULT 0,
    avg_transition_time_ms DECIMAL(10,2),
    avg_latency_ms DECIMAL(10,2),
    failure_rate DECIMAL(5,2),
    UNIQUE(canonical_graph_id, from_node_id, to_node_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_canonical_edges_graph ON canonical_graph_edges(canonical_graph_id);
CREATE INDEX IF NOT EXISTS idx_canonical_edges_from_node ON canonical_graph_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_canonical_edges_to_node ON canonical_graph_edges(to_node_id);

-- Object Storage References (for heavy objects like screenshots)
CREATE TABLE IF NOT EXISTS object_storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('screenshot', 'dom_snapshot', 'video', 'trace', 'other')),
    object_key VARCHAR(500) NOT NULL UNIQUE,
    storage_provider VARCHAR(50) DEFAULT 's3' CHECK (storage_provider IN ('s3', 'azure_blob', 'gcs', 'local')),
    bucket_name VARCHAR(255),
    file_size BIGINT,
    content_type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_object_storage_type ON object_storage_references(object_type);
CREATE INDEX IF NOT EXISTS idx_object_storage_expires ON object_storage_references(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_object_storage_key ON object_storage_references(object_key);

-- Comments
COMMENT ON TABLE event_queue IS 'Event queue for resilient event delivery with retry and ordering';
COMMENT ON TABLE event_checkpoints IS 'Checkpoints for resuming event processing after failures';
COMMENT ON TABLE snapshot_content_registry IS 'Content hash registry for snapshot deduplication';
COMMENT ON TABLE event_snapshot_links IS 'Links between events and snapshots with deduplication metadata';
COMMENT ON TABLE selector_registry IS 'Cross-session selector stability tracking and learning';
COMMENT ON TABLE selector_usage_history IS 'History of selector usage for empirical scoring';
COMMENT ON TABLE flowstral_projects IS 'Project-level Flowstral configuration';
COMMENT ON TABLE canonical_graphs IS 'Application-level canonical graphs merged from sessions';
COMMENT ON TABLE canonical_graph_nodes IS 'Nodes in canonical application graphs';
COMMENT ON TABLE canonical_graph_edges IS 'Edges in canonical application graphs';
COMMENT ON TABLE object_storage_references IS 'References to heavy objects stored in object storage';

-- Update existing dom_snapshots table to support content_hash
ALTER TABLE dom_snapshots 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS is_reference BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS compressed_size BIGINT,
ADD COLUMN IF NOT EXISTS compression_algorithm VARCHAR(20) DEFAULT 'brotli';

CREATE INDEX IF NOT EXISTS idx_dom_snapshots_content_hash ON dom_snapshots(content_hash) WHERE content_hash IS NOT NULL;

