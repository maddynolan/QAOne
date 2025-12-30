-- Migration: Element Model System (Tosca-Style)
-- Stores multiple identifiers per element for robust test automation
-- Works across all app types: Salesforce, React, Angular, Vue, Generic

-- 1. Create element_models table
CREATE TABLE IF NOT EXISTS element_models (
    element_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_name VARCHAR(255) NOT NULL,
    element_type VARCHAR(50) NOT NULL,  -- button, input, link, text, container, etc.
    page_id UUID,  -- REFERENCES page_objects(page_object_id) ON DELETE SET NULL,  -- Commented out if page_objects doesn't exist
    application_type VARCHAR(50) NOT NULL DEFAULT 'generic',  -- salesforce, react, angular, vue, generic
    
    -- Identifiers stored as JSONB for flexibility
    -- Structure: [{type, value, priority, confidence, app_specific, playwright_locator, ...}]
    identifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    visual_fingerprint TEXT,  -- Optional: base64 hash for visual matching
    
    -- Tracking
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 1.0,  -- 0.0000 to 1.0000
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Multi-tenancy
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(user_id),
    
    -- Constraints
    UNIQUE(tenant_id, page_id, element_name)
);

-- 2. Create element_model_usage table (for analytics and self-healing)
CREATE TABLE IF NOT EXISTS element_model_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id UUID REFERENCES element_models(element_id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(test_case_id) ON DELETE SET NULL,
    identifier_used VARCHAR(50),  -- Which identifier type was used (testid, title_attribute, etc.)
    identifier_index INTEGER,  -- Which identifier in the array (0-based)
    success BOOLEAN DEFAULT true,
    execution_time_ms INTEGER,
    error_message TEXT,  -- If failed, what was the error
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_element_models_page ON element_models(page_id);
CREATE INDEX IF NOT EXISTS idx_element_models_app_type ON element_models(application_type);
CREATE INDEX IF NOT EXISTS idx_element_models_tenant ON element_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_element_models_identifiers ON element_models USING GIN(identifiers);  -- GIN for JSONB queries
CREATE INDEX IF NOT EXISTS idx_element_models_name ON element_models(element_name);
CREATE INDEX IF NOT EXISTS idx_element_models_tenant_page ON element_models(tenant_id, page_id);

CREATE INDEX IF NOT EXISTS idx_element_usage_element ON element_model_usage(element_id);
CREATE INDEX IF NOT EXISTS idx_element_usage_test_case ON element_model_usage(test_case_id);
CREATE INDEX IF NOT EXISTS idx_element_usage_tenant ON element_model_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_element_usage_used_at ON element_model_usage(used_at);

-- 4. Enable Row-Level Security
ALTER TABLE element_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE element_model_usage ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
CREATE POLICY element_models_tenant_isolation ON element_models
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

CREATE POLICY element_usage_tenant_isolation ON element_model_usage
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

-- 6. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_element_model_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_seen = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER element_models_updated_at
    BEFORE UPDATE ON element_models
    FOR EACH ROW
    EXECUTE FUNCTION update_element_model_updated_at();

-- 7. Create function to update success rate based on usage
CREATE OR REPLACE FUNCTION update_element_success_rate()
RETURNS TRIGGER AS $$
DECLARE
    total_uses INTEGER;
    successful_uses INTEGER;
    new_success_rate DECIMAL(5,4);
BEGIN
    -- Calculate success rate from recent usage (last 100 uses)
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE success = true)
    INTO total_uses, successful_uses
    FROM element_model_usage
    WHERE element_id = NEW.element_id
      AND used_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    ORDER BY used_at DESC
    LIMIT 100;
    
    IF total_uses > 0 THEN
        new_success_rate := successful_uses::DECIMAL / total_uses::DECIMAL;
        
        UPDATE element_models
        SET success_rate = new_success_rate,
            usage_count = usage_count + 1
        WHERE element_id = NEW.element_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER element_usage_success_rate_update
    AFTER INSERT ON element_model_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_element_success_rate();

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON element_models TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON element_model_usage TO authenticated;

-- 9. Comments
COMMENT ON TABLE element_models IS 'Element Model System - Stores multiple identifiers per element for robust test automation (Tosca-style)';
COMMENT ON TABLE element_model_usage IS 'Tracks element identifier usage for analytics and self-healing';
COMMENT ON COLUMN element_models.identifiers IS 'JSONB array of identifier objects: [{type, value, priority, confidence, app_specific, playwright_locator}]';
COMMENT ON COLUMN element_models.success_rate IS 'Success rate (0.0000 to 1.0000) based on recent usage';


