-- Migration: Add multi-tenant support (Phase 1.3)
-- Adds tenant_id to all tables and creates tenant_config table

-- ============================================================================
-- 1. Create tenant_config table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_config (
    tenant_id VARCHAR(255) PRIMARY KEY,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- Link to existing org
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    llm_provider VARCHAR(50) DEFAULT 'local_qwen', -- Default LLM provider
    max_llm_requests_per_day INTEGER DEFAULT 1000,
    max_storage_gb INTEGER DEFAULT 10,
    features JSONB DEFAULT '{}', -- Feature flags per tenant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_org_id ON tenant_config(org_id);

COMMENT ON TABLE tenant_config IS 'Tenant configuration and limits';
COMMENT ON COLUMN tenant_config.tenant_id IS 'Unique tenant identifier (can be same as org_id)';
COMMENT ON COLUMN tenant_config.org_id IS 'Link to organizations table';

-- ============================================================================
-- 2. Add tenant_id to tables that don't have org_id/project_id
-- Note: Some tables use organization_id (UUID), some use org_id (VARCHAR)
-- ============================================================================

-- ai_generations (already has project_id, but add tenant_id for direct access)
ALTER TABLE ai_generations 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ai_generations_tenant_id ON ai_generations(tenant_id) WHERE tenant_id IS NOT NULL;

-- ai_templates
ALTER TABLE ai_templates 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ai_templates_tenant_id ON ai_templates(tenant_id) WHERE tenant_id IS NOT NULL;

-- requirements
ALTER TABLE requirements 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_requirements_tenant_id ON requirements(tenant_id) WHERE tenant_id IS NOT NULL;

-- requirement_embeddings (uses organization_id, not org_id)
ALTER TABLE requirement_embeddings 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_requirement_embeddings_tenant_id ON requirement_embeddings(tenant_id) WHERE tenant_id IS NOT NULL;

-- cached_responses (uses organization_id, not org_id)
ALTER TABLE cached_responses 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_cached_responses_tenant_id ON cached_responses(tenant_id) WHERE tenant_id IS NOT NULL;

-- test_case_requirements
ALTER TABLE test_case_requirements 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_test_case_requirements_tenant_id ON test_case_requirements(tenant_id) WHERE tenant_id IS NOT NULL;

-- test_comments
ALTER TABLE test_comments 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_test_comments_tenant_id ON test_comments(tenant_id) WHERE tenant_id IS NOT NULL;

-- model_registry
ALTER TABLE model_registry 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_model_registry_tenant_id ON model_registry(tenant_id) WHERE tenant_id IS NOT NULL;

-- ab_tests
ALTER TABLE ab_tests 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ab_tests_tenant_id ON ab_tests(tenant_id) WHERE tenant_id IS NOT NULL;

-- model_usage
ALTER TABLE model_usage 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_model_usage_tenant_id ON model_usage(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- 3. Add tenant_id to tables that have project_id (derive from project)
-- ============================================================================

-- For tables with project_id, we'll derive tenant_id from org_id via project
-- But add tenant_id column for direct filtering

-- test_plans (has project_id)
ALTER TABLE test_plans 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_test_plans_tenant_id ON test_plans(tenant_id) WHERE tenant_id IS NOT NULL;

-- test_cases (has project_id)
ALTER TABLE test_cases 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_test_cases_tenant_id ON test_cases(tenant_id) WHERE tenant_id IS NOT NULL;

-- test_runs (has project_id)
ALTER TABLE test_runs 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_test_runs_tenant_id ON test_runs(tenant_id) WHERE tenant_id IS NOT NULL;

-- defects (has project_id)
ALTER TABLE defects 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_defects_tenant_id ON defects(tenant_id) WHERE tenant_id IS NOT NULL;

-- ai_generation_audit (has project_id)
ALTER TABLE ai_generation_audit 
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ai_generation_audit_tenant_id ON ai_generation_audit(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- 4. Helper function to get tenant_id from org_id
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tenant_id_from_org(org_uuid UUID)
RETURNS VARCHAR(255) AS $$
BEGIN
    -- First try to get from tenant_config
    RETURN (
        SELECT tenant_id 
        FROM tenant_config 
        WHERE org_id = org_uuid 
        LIMIT 1
    );
    -- If not found, use org_id as tenant_id
    IF NOT FOUND THEN
        RETURN org_uuid::VARCHAR;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Helper function to get tenant_id from project_id
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tenant_id_from_project(project_uuid UUID)
RETURNS VARCHAR(255) AS $$
DECLARE
    org_uuid UUID;
BEGIN
    -- Get org_id from project
    SELECT org_id INTO org_uuid
    FROM projects
    WHERE id = project_uuid;
    
    -- Return tenant_id from org
    RETURN get_tenant_id_from_org(org_uuid);
END;
$$ LANGUAGE plpgsql;

-- Helper function for organization_id (used by requirement_embeddings, cached_responses)
CREATE OR REPLACE FUNCTION get_tenant_id_from_organization(org_uuid UUID)
RETURNS VARCHAR(255) AS $$
BEGIN
    -- Same as get_tenant_id_from_org, just different name for clarity
    RETURN get_tenant_id_from_org(org_uuid);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Update RLS policies to include tenant_id filtering
-- ============================================================================

-- Helper function for tenant-based RLS
CREATE OR REPLACE FUNCTION get_user_tenant_ids(user_uuid UUID)
RETURNS VARCHAR(255)[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT COALESCE(
            (SELECT tenant_id FROM tenant_config WHERE org_id = om.org_id LIMIT 1),
            om.org_id::VARCHAR
        )
        FROM org_memberships om
        WHERE om.user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Add RLS policies for tenant isolation (where applicable)
-- ============================================================================

-- Note: Most tables already have RLS via org_id/project_id
-- These additional policies ensure tenant_id filtering works

-- ai_generations
DROP POLICY IF EXISTS "Users can view ai_generations by tenant" ON ai_generations;
CREATE POLICY "Users can view ai_generations by tenant" ON ai_generations
    FOR SELECT USING (
        tenant_id = ANY(get_user_tenant_ids(auth.uid())) OR
        project_id = ANY(get_user_project_ids(auth.uid()))
    );

-- ai_templates
DROP POLICY IF EXISTS "Users can view ai_templates by tenant" ON ai_templates;
CREATE POLICY "Users can view ai_templates by tenant" ON ai_templates
    FOR SELECT USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- requirements (has project_id, derive tenant from project)
DROP POLICY IF EXISTS "Users can view requirements by tenant" ON requirements;
CREATE POLICY "Users can view requirements by tenant" ON requirements
    FOR SELECT USING (
        tenant_id = ANY(get_user_tenant_ids(auth.uid())) OR
        project_id = ANY(get_user_project_ids(auth.uid()))
    );

-- requirement_embeddings (has organization_id)
DROP POLICY IF EXISTS "Users can view requirement_embeddings by tenant" ON requirement_embeddings;
CREATE POLICY "Users can view requirement_embeddings by tenant" ON requirement_embeddings
    FOR SELECT USING (
        tenant_id = ANY(get_user_tenant_ids(auth.uid())) OR
        organization_id = ANY(get_user_org_ids(auth.uid()))
    );

-- cached_responses (has organization_id)
DROP POLICY IF EXISTS "Users can view cached_responses by tenant" ON cached_responses;
CREATE POLICY "Users can view cached_responses by tenant" ON cached_responses
    FOR SELECT USING (
        tenant_id = ANY(get_user_tenant_ids(auth.uid())) OR
        organization_id = ANY(get_user_org_ids(auth.uid()))
    );

-- tenant_config
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant config" ON tenant_config
    FOR SELECT USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- ============================================================================
-- 8. Create trigger to auto-populate tenant_id from org_id/project_id
-- ============================================================================

-- Function to update tenant_id from project_id
CREATE OR REPLACE FUNCTION update_tenant_id_from_project()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.project_id IS NOT NULL AND NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_tenant_id_from_project(NEW.project_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with project_id
CREATE TRIGGER update_test_plans_tenant_id
    BEFORE INSERT OR UPDATE ON test_plans
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

CREATE TRIGGER update_test_cases_tenant_id
    BEFORE INSERT OR UPDATE ON test_cases
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

CREATE TRIGGER update_test_runs_tenant_id
    BEFORE INSERT OR UPDATE ON test_runs
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

CREATE TRIGGER update_defects_tenant_id
    BEFORE INSERT OR UPDATE ON defects
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

CREATE TRIGGER update_ai_generation_audit_tenant_id
    BEFORE INSERT OR UPDATE ON ai_generation_audit
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

CREATE TRIGGER update_ai_generations_tenant_id
    BEFORE INSERT OR UPDATE ON ai_generations
    FOR EACH ROW
    WHEN (NEW.tenant_id IS NULL AND NEW.project_id IS NOT NULL)
    EXECUTE FUNCTION update_tenant_id_from_project();

COMMENT ON TABLE tenant_config IS 'Multi-tenant configuration and feature flags';
COMMENT ON COLUMN tenant_config.tenant_id IS 'Unique tenant identifier (typically matches org_id)';

