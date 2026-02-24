-- Migration 031: Test Case Version Control
-- Enables full version history, diff tracking, branching, and revert for no-code test cases

CREATE TABLE IF NOT EXISTS test_case_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_type VARCHAR(20) NOT NULL DEFAULT 'modified',  -- created, modified, status_change, restored, branched
  changed_by UUID REFERENCES users(id),
  snapshot JSONB NOT NULL,                    -- Full test case state at this version
  diff_summary TEXT,                          -- Human-readable: "Changed step 3 selector, added step 5"
  diff_details JSONB,                         -- Structured diff: {added: [], removed: [], modified: []}
  parent_version_id UUID REFERENCES test_case_versions(id),  -- For branching: forked from which version
  metadata JSONB DEFAULT '{}',                -- Extra context: source (manual, ai, import), session_id, etc.
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(test_case_id, version)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tcv_test_case_id ON test_case_versions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_tcv_changed_by ON test_case_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_tcv_created_at ON test_case_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcv_change_type ON test_case_versions(change_type);

-- RLS policies
ALTER TABLE test_case_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions in their projects" ON test_case_versions
  FOR SELECT USING (
    test_case_id IN (
      SELECT tc.id FROM test_cases tc
      JOIN projects p ON tc.project_id = p.id
      JOIN project_memberships pm ON p.id = pm.project_id
      WHERE pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create versions for their project test cases" ON test_case_versions
  FOR INSERT WITH CHECK (
    test_case_id IN (
      SELECT tc.id FROM test_cases tc
      JOIN projects p ON tc.project_id = p.id
      JOIN project_memberships pm ON p.id = pm.project_id
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin', 'member')
    )
  );
