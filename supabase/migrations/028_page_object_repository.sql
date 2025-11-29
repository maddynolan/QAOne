-- Migration: Page Object Repository (POM)
-- Shared elements library for reusable test selectors

-- 1. Create page_objects table (represents a page/screen)
CREATE TABLE IF NOT EXISTS page_objects (
    page_object_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url_pattern VARCHAR(500), -- URL pattern to match this page
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(org_id, project_id, name)
);

-- 2. Create page_elements table (represents elements on a page)
CREATE TABLE IF NOT EXISTS page_elements (
    element_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_object_id UUID REFERENCES page_objects(page_object_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    element_type VARCHAR(50) NOT NULL, -- 'button', 'input', 'link', 'text', 'container', etc.
    
    -- Multi-layer selectors (5-layer strategy)
    selector_layer1_gold VARCHAR(500),      -- data-testid, id
    selector_layer2_silver VARCHAR(500),    -- role + name/aria-label
    selector_layer3_bronze VARCHAR(500),    -- text content
    selector_layer4_iron VARCHAR(500),      -- CSS attributes
    selector_layer5_clay VARCHAR(500),      -- XPath/CSS path
    
    -- Legacy selector (for backward compatibility)
    selector VARCHAR(500),
    
    -- Metadata
    is_required BOOLEAN DEFAULT false,
    wait_strategy VARCHAR(50) DEFAULT 'visible', -- 'visible', 'attached', 'networkidle'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(page_object_id, name)
);

-- 3. Create test_case_element_mappings table (links test cases to page elements)
CREATE TABLE IF NOT EXISTS test_case_element_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_case_id UUID REFERENCES test_cases(test_case_id) ON DELETE CASCADE,
    element_id UUID REFERENCES page_elements(element_id) ON DELETE CASCADE,
    step_index INTEGER, -- Which step in the test case uses this element
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_case_id, element_id, step_index)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_page_objects_org_project ON page_objects(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_page_objects_tenant ON page_objects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_elements_page_object ON page_elements(page_object_id);
CREATE INDEX IF NOT EXISTS idx_page_elements_tenant ON page_elements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mappings_test_case ON test_case_element_mappings(test_case_id);
CREATE INDEX IF NOT EXISTS idx_mappings_element ON test_case_element_mappings(element_id);

-- 5. Enable Row-Level Security
ALTER TABLE page_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_case_element_mappings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
CREATE POLICY page_objects_tenant_isolation ON page_objects
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

CREATE POLICY page_elements_tenant_isolation ON page_elements
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID OR tenant_id IS NULL);

CREATE POLICY mappings_tenant_isolation ON test_case_element_mappings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM test_cases tc
            JOIN page_elements pe ON pe.element_id = test_case_element_mappings.element_id
            WHERE tc.test_case_id = test_case_element_mappings.test_case_id
              AND (tc.tenant_id = current_setting('app.current_tenant_id', true)::UUID
                   OR pe.tenant_id = current_setting('app.current_tenant_id', true)::UUID)
        )
    );

-- 7. Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_page_object_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER page_objects_updated_at
    BEFORE UPDATE ON page_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_page_object_updated_at();

CREATE TRIGGER page_elements_updated_at
    BEFORE UPDATE ON page_elements
    FOR EACH ROW
    EXECUTE FUNCTION update_page_object_updated_at();

-- 8. Create function to update all test cases when element selector changes
CREATE OR REPLACE FUNCTION update_test_cases_on_element_change()
RETURNS TRIGGER AS $$
BEGIN
    -- When an element's selector is updated, mark all linked test cases as needing review
    -- This is a notification mechanism - actual updates would be handled by the application
    IF OLD.selector != NEW.selector OR
       OLD.selector_layer1_gold != NEW.selector_layer1_gold OR
       OLD.selector_layer2_silver != NEW.selector_layer2_silver THEN
        -- Log the change (actual test case updates handled by application)
        RAISE NOTICE 'Element % selector changed - test cases may need updating', NEW.element_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER element_selector_change_notification
    AFTER UPDATE ON page_elements
    FOR EACH ROW
    WHEN (OLD.selector IS DISTINCT FROM NEW.selector OR
          OLD.selector_layer1_gold IS DISTINCT FROM NEW.selector_layer1_gold)
    EXECUTE FUNCTION update_test_cases_on_element_change();

-- 9. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON page_objects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON page_elements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON test_case_element_mappings TO authenticated;

COMMENT ON TABLE page_objects IS 'Page Object Model - represents a page/screen in the application';
COMMENT ON TABLE page_elements IS 'Elements on a page with multi-layer selectors for self-healing tests';
COMMENT ON TABLE test_case_element_mappings IS 'Maps test cases to page elements for centralized selector management';

