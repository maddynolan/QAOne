-- Migration: Capability Maps and Exploration Results
-- Stores autonomous exploration results and capability maps

CREATE TABLE IF NOT EXISTS exploration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
    config JSONB, -- ExplorationConfig as JSON
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_pages_discovered INTEGER DEFAULT 0,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exploration_runs_project ON exploration_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_exploration_runs_status ON exploration_runs(status);
CREATE INDEX IF NOT EXISTS idx_exploration_runs_created_at ON exploration_runs(created_at DESC);

-- Capability maps derived from exploration
CREATE TABLE IF NOT EXISTS capability_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exploration_run_id UUID REFERENCES exploration_runs(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL,
    capability_data JSONB NOT NULL, -- Full capability map structure
    total_entities INTEGER DEFAULT 0,
    total_capabilities INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1, -- For tracking changes over time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_maps_project ON capability_maps(project_id);
CREATE INDEX IF NOT EXISTS idx_capability_maps_exploration ON capability_maps(exploration_run_id);
CREATE INDEX IF NOT EXISTS idx_capability_maps_base_url ON capability_maps(base_url);

-- Requirement comparisons (results of comparing requirements against capability maps)
CREATE TABLE IF NOT EXISTS requirement_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_map_id UUID REFERENCES capability_maps(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES requirements(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- fully_supported, partially_supported, not_supported, conflicting
    confidence FLOAT DEFAULT 0.0, -- 0.0 to 1.0
    gaps JSONB, -- Array of gap descriptions
    conflicts JSONB, -- Array of conflict descriptions
    impacted_pages JSONB, -- Array of page IDs
    impact_type TEXT, -- ui_only, backend_rules, new_flow, data_model
    suggested_tests JSONB, -- Array of suggested test cases
    comparison_data JSONB, -- Full comparison result
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirement_comparisons_map ON requirement_comparisons(capability_map_id);
CREATE INDEX IF NOT EXISTS idx_requirement_comparisons_req ON requirement_comparisons(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_comparisons_status ON requirement_comparisons(status);
CREATE INDEX IF NOT EXISTS idx_requirement_comparisons_project ON requirement_comparisons(project_id);

-- Track capability map changes over time (for change detection)
CREATE TABLE IF NOT EXISTS capability_map_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_map_id UUID REFERENCES capability_maps(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL, -- entity_added, entity_removed, field_added, field_removed, etc.
    entity_name TEXT,
    operation_name TEXT,
    change_details JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_map_changes_map ON capability_map_changes(capability_map_id);
CREATE INDEX IF NOT EXISTS idx_capability_map_changes_detected ON capability_map_changes(detected_at DESC);







