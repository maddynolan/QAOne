-- QAOne Database Schema with Multi-Tenancy Support
-- This schema implements Row Level Security (RLS) for multi-tenant isolation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE test_status AS ENUM ('draft', 'active', 'archived', 'deprecated');
CREATE TYPE test_priority AS ENUM ('P0', 'P1', 'P2', 'P3');
CREATE TYPE test_type AS ENUM ('manual', 'automated', 'api', 'ui', 'e2e', 'performance');
CREATE TYPE run_status AS ENUM ('pending', 'running', 'passed', 'failed', 'partial', 'error', 'cancelled');
CREATE TYPE step_status AS ENUM ('pending', 'passed', 'failed', 'skipped', 'error');
CREATE TYPE artifact_type AS ENUM ('screenshot', 'video', 'trace', 'har', 'log', 'other');
CREATE TYPE triage_category AS ENUM ('locator', 'timing', 'network', 'data', 'enviro');

-- Organizations table (top-level tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table (within organizations)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, slug)
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization memberships (many-to-many with roles)
CREATE TABLE org_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- Project memberships (inherits from org membership but can be overridden)
CREATE TABLE project_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    UNIQUE(project_id, user_id)
);

-- Test plans table
CREATE TABLE test_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status test_status DEFAULT 'draft',
    settings JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test cases table
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    test_type test_type DEFAULT 'manual',
    status test_status DEFAULT 'draft',
    tags TEXT[] DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    preconditions TEXT[] DEFAULT '{}',
    test_data JSONB DEFAULT '{}',
    estimated_time INTEGER DEFAULT 15, -- minutes
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test runs table
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    status run_status DEFAULT 'pending',
    environment VARCHAR(50) DEFAULT 'local',
    branch VARCHAR(255),
    commit VARCHAR(255),
    runner_version VARCHAR(100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test run steps (individual test case executions)
CREATE TABLE test_run_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    status step_status DEFAULT 'pending',
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    stdout TEXT,
    stderr TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Artifacts table (screenshots, videos, logs, etc.)
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    type artifact_type NOT NULL,
    url TEXT NOT NULL,
    size_bytes INTEGER,
    checksum VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triage analysis table
CREATE TABLE triage_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    category triage_category,
    suggested_fixes TEXT[] DEFAULT '{}',
    selector_suggestions TEXT[] DEFAULT '{}',
    likelihood_flaky DECIMAL(3,2) DEFAULT 0.0,
    related_cases UUID[] DEFAULT '{}',
    ai_model VARCHAR(100),
    confidence DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Defects table
CREATE TABLE defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID REFERENCES test_runs(id) ON DELETE SET NULL,
    step_id UUID REFERENCES test_run_steps(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority test_priority DEFAULT 'P2',
    status VARCHAR(50) DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    jira_id VARCHAR(100),
    triage_analysis_id UUID REFERENCES triage_analysis(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI generation audit table
CREATE TABLE ai_generation_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    operation VARCHAR(50) NOT NULL, -- 'generate_tests', 'triage', etc.
    model VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10,4) NOT NULL,
    latency_ms INTEGER NOT NULL,
    request_data JSONB DEFAULT '{}',
    response_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_plan_id ON test_cases(plan_id);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_runs_plan_id ON test_runs(plan_id);
CREATE INDEX idx_test_run_steps_run_id ON test_run_steps(run_id);
CREATE INDEX idx_test_run_steps_case_id ON test_run_steps(case_id);
CREATE INDEX idx_artifacts_run_id ON artifacts(run_id);
CREATE INDEX idx_artifacts_step_id ON artifacts(step_id);
CREATE INDEX idx_triage_analysis_run_id ON triage_analysis(run_id);
CREATE INDEX idx_defects_project_id ON defects(project_id);
CREATE INDEX idx_ai_audit_project_id ON ai_generation_audit(project_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_audit ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's org memberships
CREATE OR REPLACE FUNCTION get_user_org_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT org_id 
        FROM org_memberships 
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's project memberships
CREATE OR REPLACE FUNCTION get_user_project_ids(user_uuid UUID)
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT DISTINCT p.id
        FROM projects p
        JOIN org_memberships om ON p.org_id = om.org_id
        WHERE om.user_id = user_uuid
        UNION
        SELECT project_id
        FROM project_memberships
        WHERE user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (id = ANY(get_user_org_ids(auth.uid())));

CREATE POLICY "Users can update organizations they belong to" ON organizations
    FOR UPDATE USING (id = ANY(get_user_org_ids(auth.uid())));

-- Projects policies
CREATE POLICY "Users can view projects in their organizations" ON projects
    FOR SELECT USING (org_id = ANY(get_user_org_ids(auth.uid())));

CREATE POLICY "Users can create projects in their organizations" ON projects
    FOR INSERT WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())));

CREATE POLICY "Users can update projects in their organizations" ON projects
    FOR UPDATE USING (org_id = ANY(get_user_org_ids(auth.uid())));

-- Users policies (users can see themselves and org members)
CREATE POLICY "Users can view themselves" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view org members" ON users
    FOR SELECT USING (
        id IN (
            SELECT user_id 
            FROM org_memberships 
            WHERE org_id = ANY(get_user_org_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can update themselves" ON users
    FOR UPDATE USING (id = auth.uid());

-- Org memberships policies
CREATE POLICY "Users can view org memberships in their orgs" ON org_memberships
    FOR SELECT USING (org_id = ANY(get_user_org_ids(auth.uid())));

CREATE POLICY "Users can create org memberships in their orgs" ON org_memberships
    FOR INSERT WITH CHECK (org_id = ANY(get_user_org_ids(auth.uid())));

-- Project memberships policies
CREATE POLICY "Users can view project memberships in their projects" ON project_memberships
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create project memberships in their projects" ON project_memberships
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

-- Test plans policies
CREATE POLICY "Users can view test plans in their projects" ON test_plans
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create test plans in their projects" ON test_plans
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can update test plans in their projects" ON test_plans
    FOR UPDATE USING (project_id = ANY(get_user_project_ids(auth.uid())));

-- Test cases policies
CREATE POLICY "Users can view test cases in their projects" ON test_cases
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create test cases in their projects" ON test_cases
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can update test cases in their projects" ON test_cases
    FOR UPDATE USING (project_id = ANY(get_user_project_ids(auth.uid())));

-- Test runs policies
CREATE POLICY "Users can view test runs in their projects" ON test_runs
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create test runs in their projects" ON test_runs
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can update test runs in their projects" ON test_runs
    FOR UPDATE USING (project_id = ANY(get_user_project_ids(auth.uid())));

-- Test run steps policies
CREATE POLICY "Users can view test run steps in their projects" ON test_run_steps
    FOR SELECT USING (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can create test run steps in their projects" ON test_run_steps
    FOR INSERT WITH CHECK (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can update test run steps in their projects" ON test_run_steps
    FOR UPDATE USING (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

-- Artifacts policies
CREATE POLICY "Users can view artifacts in their projects" ON artifacts
    FOR SELECT USING (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can create artifacts in their projects" ON artifacts
    FOR INSERT WITH CHECK (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

-- Triage analysis policies
CREATE POLICY "Users can view triage analysis in their projects" ON triage_analysis
    FOR SELECT USING (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

CREATE POLICY "Users can create triage analysis in their projects" ON triage_analysis
    FOR INSERT WITH CHECK (
        run_id IN (
            SELECT id FROM test_runs 
            WHERE project_id = ANY(get_user_project_ids(auth.uid()))
        )
    );

-- Defects policies
CREATE POLICY "Users can view defects in their projects" ON defects
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create defects in their projects" ON defects
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can update defects in their projects" ON defects
    FOR UPDATE USING (project_id = ANY(get_user_project_ids(auth.uid())));

-- AI generation audit policies
CREATE POLICY "Users can view AI audit in their projects" ON ai_generation_audit
    FOR SELECT USING (project_id = ANY(get_user_project_ids(auth.uid())));

CREATE POLICY "Users can create AI audit in their projects" ON ai_generation_audit
    FOR INSERT WITH CHECK (project_id = ANY(get_user_project_ids(auth.uid())));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON test_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE ON test_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_defects_updated_at BEFORE UPDATE ON defects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Migration: Add ai_generations table to store LLM generations for fine-tuning
-- This table stores all AI/LLM calls for later use in fine-tuning custom models

CREATE TABLE IF NOT EXISTS ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    prompt TEXT NOT NULL,
    model VARCHAR(100) NOT NULL,
    output TEXT NOT NULL,
    mode VARCHAR(50), -- 'quick', 'ui', 'heavy'
    endpoint VARCHAR(255), -- Which endpoint was called
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_ai_generations_project_id ON ai_generations(project_id);
CREATE INDEX idx_ai_generations_created_at ON ai_generations(created_at);
CREATE INDEX idx_ai_generations_model ON ai_generations(model);
CREATE INDEX idx_ai_generations_endpoint ON ai_generations(endpoint);

-- Migration: Add ai_templates table for storing prompt templates
-- Users can edit prompt templates for different AI tasks in Settings

CREATE TABLE IF NOT EXISTS ai_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(255),
    task VARCHAR(100) NOT NULL, -- 'jira-to-tests', 'testcase-to-playwright', 'api-tests', 'perf-tests', 'a11y-tests', 'triage'
    template TEXT NOT NULL, -- The prompt template
    version INTEGER DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_ai_templates_project_id ON ai_templates(project_id);
CREATE INDEX idx_ai_templates_task ON ai_templates(task);
CREATE INDEX idx_ai_templates_org_id ON ai_templates(org_id);

-- Insert default templates
INSERT INTO ai_templates (project_id, org_id, task, template, is_default, version) VALUES
('default', 'default', 'jira-to-tests', 'You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

Jira Story/Requirements:
{requirements}

Generate an array of manual test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array of test cases.', true, 1),

('default', 'default', 'testcase-to-playwright', 'You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

Test Case:
{test_case}

Generate complete, runnable Playwright test code in TypeScript. Include proper imports, test structure, step-by-step automation, assertions, and proper selectors.', true, 1),

('default', 'default', 'triage', 'You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

Test Run ID: {run_id}
Logs:
{logs}

Provide a comprehensive analysis in JSON format with summary, root_cause, category, suggested_fixes, selector_suggestions, likelihood_flaky, and related_cases.', true, 1);


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


