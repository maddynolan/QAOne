-- Migration 032: API Collections Server Persistence
-- Moves API test collections from browser localStorage to PostgreSQL for team sharing

CREATE TABLE IF NOT EXISTS api_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_url TEXT,
  auth_config JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_collection_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES api_collections(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES api_collection_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_collection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES api_collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES api_collection_folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  url TEXT NOT NULL,
  path TEXT,
  headers JSONB DEFAULT '[]',
  params JSONB DEFAULT '[]',
  body TEXT,
  body_type VARCHAR(20) DEFAULT 'none',
  auth_type VARCHAR(20),
  auth_config JSONB DEFAULT '{}',
  assertions JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_request_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES api_collections(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  variables JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_collections_project ON api_collections(project_id);
CREATE INDEX IF NOT EXISTS idx_api_folders_collection ON api_collection_folders(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_collection ON api_collection_requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_folder ON api_collection_requests(folder_id);
CREATE INDEX IF NOT EXISTS idx_api_environments_project ON api_environments(project_id);
CREATE INDEX IF NOT EXISTS idx_api_chains_project ON api_request_chains(project_id);

-- RLS policies
ALTER TABLE api_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_collection_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_collection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_chains ENABLE ROW LEVEL SECURITY;

-- Simplified RLS: project membership check
CREATE POLICY "api_collections_project_access" ON api_collections
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));

CREATE POLICY "api_folders_collection_access" ON api_collection_folders
  FOR ALL USING (collection_id IN (SELECT id FROM api_collections WHERE project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid())));

CREATE POLICY "api_requests_collection_access" ON api_collection_requests
  FOR ALL USING (collection_id IN (SELECT id FROM api_collections WHERE project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid())));

CREATE POLICY "api_environments_project_access" ON api_environments
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));

CREATE POLICY "api_chains_project_access" ON api_request_chains
  FOR ALL USING (project_id IN (SELECT project_id FROM project_memberships WHERE user_id = auth.uid()));
