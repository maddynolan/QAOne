-- Migration 033: Mobile Test Flows Server Persistence
-- Moves mobile test YAML flows from browser localStorage to PostgreSQL for team sharing

-- Create mobile_test_folders FIRST (referenced by mobile_test_flows FK)
CREATE TABLE IF NOT EXISTS mobile_test_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  parent_folder_id UUID REFERENCES mobile_test_folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_test_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES mobile_test_folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  yaml_content TEXT NOT NULL,
  app_bundle_id VARCHAR(255),
  platform VARCHAR(10) NOT NULL DEFAULT 'android',  -- 'ios' | 'android'
  tags TEXT[] DEFAULT '{}',
  priority VARCHAR(10) DEFAULT 'medium',  -- critical, high, medium, low
  status VARCHAR(20) DEFAULT 'draft',  -- draft, active, archived
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES mobile_test_flows(id) ON DELETE SET NULL,
  flow_name VARCHAR(255),
  platform VARCHAR(10) NOT NULL,
  device VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'running',  -- passed, failed, running, skipped, error
  duration_ms INTEGER,
  steps_total INTEGER DEFAULT 0,
  steps_passed INTEGER DEFAULT 0,
  steps_failed INTEGER DEFAULT 0,
  error_message TEXT,
  logs TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mobile_flows_project ON mobile_test_flows(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_flows_platform ON mobile_test_flows(platform);
CREATE INDEX IF NOT EXISTS idx_mobile_folders_project ON mobile_test_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_runs_project ON mobile_test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_mobile_runs_flow ON mobile_test_runs(flow_id);

-- RLS policies
ALTER TABLE mobile_test_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_test_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobile_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mobile_flows_project_access" ON mobile_test_flows
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));

CREATE POLICY "mobile_folders_project_access" ON mobile_test_folders
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));

CREATE POLICY "mobile_runs_project_access" ON mobile_test_runs
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));
