-- Migration: Enhance Test Lifecycle Management
-- Adds missing fields and relationships for full test management lifecycle

-- Add requirement_id to test_cases for direct requirement linkage
ALTER TABLE test_cases 
ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES requirements(id) ON DELETE SET NULL;

-- Create junction table for many-to-many: test_cases <-> requirements
CREATE TABLE IF NOT EXISTS test_case_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_case_id, requirement_id)
);

-- Add comments table for test runs and test cases
CREATE TABLE IF NOT EXISTS test_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add execution time tracking
ALTER TABLE test_run_steps 
ADD COLUMN IF NOT EXISTS execution_time INTEGER DEFAULT 0; -- seconds

ALTER TABLE test_runs 
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER, -- minutes
ADD COLUMN IF NOT EXISTS actual_duration INTEGER; -- minutes

-- Add assignee to test runs (who is executing)
ALTER TABLE test_runs 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

-- Add milestone/sprint fields to test plans
ALTER TABLE test_plans 
ADD COLUMN IF NOT EXISTS milestone VARCHAR(255),
ADD COLUMN IF NOT EXISTS sprint VARCHAR(255),
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_test_cases_requirement_id ON test_cases(requirement_id);
CREATE INDEX IF NOT EXISTS idx_test_case_requirements_case_id ON test_case_requirements(test_case_id);
CREATE INDEX IF NOT EXISTS idx_test_case_requirements_req_id ON test_case_requirements(requirement_id);
CREATE INDEX IF NOT EXISTS idx_test_comments_run_id ON test_comments(run_id);
CREATE INDEX IF NOT EXISTS idx_test_comments_case_id ON test_comments(case_id);
CREATE INDEX IF NOT EXISTS idx_test_comments_step_id ON test_comments(step_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_assigned_to ON test_runs(assigned_to);

-- Add updated_at trigger for test_comments
CREATE TRIGGER update_test_comments_updated_at BEFORE UPDATE ON test_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


