-- Migration: Exploration Defects Enhancement
-- Adds fields to defects table for exploration-driven defect detection

-- Add new columns to defects table if they don't exist
DO $$ 
BEGIN
    -- Add exploration_run_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'exploration_run_id'
    ) THEN
        ALTER TABLE defects ADD COLUMN exploration_run_id UUID REFERENCES exploration_runs(id);
    END IF;

    -- Add capability_map_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'capability_map_id'
    ) THEN
        ALTER TABLE defects ADD COLUMN capability_map_id UUID REFERENCES capability_maps(id);
    END IF;

    -- Add defect_type if it doesn't exist (functional, performance, security, ui_consistency)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'defect_type'
    ) THEN
        ALTER TABLE defects ADD COLUMN defect_type VARCHAR(50);
    END IF;

    -- Add page_url if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'page_url'
    ) THEN
        ALTER TABLE defects ADD COLUMN page_url VARCHAR(1000);
    END IF;

    -- Add page_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'page_id'
    ) THEN
        ALTER TABLE defects ADD COLUMN page_id VARCHAR(255);
    END IF;

    -- Add element_selector if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'element_selector'
    ) THEN
        ALTER TABLE defects ADD COLUMN element_selector TEXT;
    END IF;

    -- Add console_errors if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'console_errors'
    ) THEN
        ALTER TABLE defects ADD COLUMN console_errors JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Add network_errors if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'network_errors'
    ) THEN
        ALTER TABLE defects ADD COLUMN network_errors JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Add evidence if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'evidence'
    ) THEN
        ALTER TABLE defects ADD COLUMN evidence JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add steps_to_reproduce if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'steps_to_reproduce'
    ) THEN
        ALTER TABLE defects ADD COLUMN steps_to_reproduce TEXT[];
    END IF;

    -- Add expected_behavior if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'expected_behavior'
    ) THEN
        ALTER TABLE defects ADD COLUMN expected_behavior TEXT;
    END IF;

    -- Add actual_behavior if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'actual_behavior'
    ) THEN
        ALTER TABLE defects ADD COLUMN actual_behavior TEXT;
    END IF;

    -- Add detected_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'detected_at'
    ) THEN
        ALTER TABLE defects ADD COLUMN detected_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Add affected_pages if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'affected_pages'
    ) THEN
        ALTER TABLE defects ADD COLUMN affected_pages TEXT[];
    END IF;

    -- Add priority_score if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'defects' AND column_name = 'priority_score'
    ) THEN
        ALTER TABLE defects ADD COLUMN priority_score INTEGER;
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_defects_exploration_run_id ON defects(exploration_run_id);
CREATE INDEX IF NOT EXISTS idx_defects_capability_map_id ON defects(capability_map_id);
CREATE INDEX IF NOT EXISTS idx_defects_defect_type ON defects(defect_type);
CREATE INDEX IF NOT EXISTS idx_defects_page_url ON defects(page_url);
CREATE INDEX IF NOT EXISTS idx_defects_detected_at ON defects(detected_at);

-- Create table for test execution results if it doesn't exist
CREATE TABLE IF NOT EXISTS test_execution_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exploration_run_id UUID REFERENCES exploration_runs(id),
    test_case_id UUID REFERENCES test_cases(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'error')),
    execution_time_ms INTEGER,
    screenshot_path VARCHAR(500),
    video_path VARCHAR(500),
    console_log TEXT,
    network_log JSONB,
    error_message TEXT,
    defect_id UUID REFERENCES defects(id),
    executed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_execution_results_exploration_run ON test_execution_results(exploration_run_id);
CREATE INDEX IF NOT EXISTS idx_test_execution_results_test_case ON test_execution_results(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_execution_results_status ON test_execution_results(status);
CREATE INDEX IF NOT EXISTS idx_test_execution_results_defect ON test_execution_results(defect_id);

COMMENT ON TABLE test_execution_results IS 'Test execution results from exploration-driven test runs';
COMMENT ON COLUMN defects.exploration_run_id IS 'Exploration run that detected this defect';
COMMENT ON COLUMN defects.defect_type IS 'Type of defect: functional, performance, security, ui_consistency';
COMMENT ON COLUMN defects.evidence IS 'Additional evidence (screenshots, logs, metrics)';




