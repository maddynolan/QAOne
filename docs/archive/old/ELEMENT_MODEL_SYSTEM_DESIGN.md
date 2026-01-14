# Element Model System - Design Document

## Executive Summary

Building a **Tosca-style element model system** that stores multiple identifiers per element, works across all application types (Salesforce, React, Angular, Vue, Generic), and scales to handle thousands of elements efficiently.

## Industry Standards Research

### Tosca Approach
- **Model-based**: Elements stored separately from test steps
- **Multiple identifiers**: Each element has 3-5 identification strategies
- **Priority-based**: Try identifiers in order until one works
- **Centralized**: Update model once → all tests benefit
- **Scalable**: Handles enterprise apps with 1000+ elements

### Mabl/Testim Approach
- **AI-assisted**: Learn which selectors work best
- **Self-healing**: Auto-update selectors when they break
- **Visual matching**: Screenshots as fallback
- **Context-aware**: Consider page/component context

### Our Approach (Better)
- **Multi-app support**: Works for Salesforce, React, Angular, Vue, Generic
- **App-specific priorities**: Different selector priorities per app type
- **Performance optimized**: Efficient storage and retrieval
- **Real-time building**: Build model during recording
- **Intelligent fallback**: ML-assisted selector selection

## Architecture

### 1. Element Model Structure

```python
{
  "element_id": "uuid",
  "element_name": "login_submit_button",  # Human-readable name
  "element_type": "button",  # button, input, link, etc.
  "page_context": {
    "page_id": "login_page",
    "url_pattern": "/login",
    "application_type": "salesforce"  # salesforce, react, angular, vue, generic
  },
  "identifiers": [
    {
      "type": "testid",
      "value": "submit-btn",
      "priority": 1,
      "confidence": 0.99,
      "app_specific": false,
      "playwright_locator": "page.getByTestId('submit-btn')"
    },
    {
      "type": "title_attribute",  # Salesforce-specific
      "value": "Submit Login",
      "priority": 1,
      "confidence": 0.95,
      "app_specific": true,
      "app_type": "salesforce",
      "playwright_locator": "page.locator('button[title=\"Submit Login\"]')"
    },
    {
      "type": "role_name",
      "role": "button",
      "name": "Submit",
      "priority": 2,
      "confidence": 0.90,
      "app_specific": false,
      "playwright_locator": "page.getByRole('button', { name: 'Submit' })"
    },
    {
      "type": "text",
      "value": "Submit",
      "priority": 3,
      "confidence": 0.85,
      "app_specific": false,
      "playwright_locator": "page.getByText('Submit')"
    },
    {
      "type": "id",
      "value": "submit-button",
      "priority": 4,
      "confidence": 0.80,
      "app_specific": false,
      "playwright_locator": "page.locator('#submit-button')"
    },
    {
      "type": "css",
      "value": "button.primary",
      "priority": 5,
      "confidence": 0.70,
      "app_specific": false,
      "playwright_locator": "page.locator('button.primary')"
    }
  ],
  "metadata": {
    "first_seen": "2025-01-05T10:00:00Z",
    "last_seen": "2025-01-05T15:30:00Z",
    "usage_count": 42,  # How many times used in tests
    "success_rate": 0.98,  # How often selectors work
    "last_updated": "2025-01-05T15:30:00Z"
  },
  "visual_fingerprint": "base64_hash",  # Optional: for visual matching
  "created_at": "2025-01-05T10:00:00Z",
  "updated_at": "2025-01-05T15:30:00Z"
}
```

### 2. Identifier Priority by App Type

#### Salesforce
1. **title attribute** (highest priority - most stable)
2. **href attribute** (for links)
3. **data-* attributes** (data-menubar-item, etc.)
4. **role + name** (semantic)
5. **text content** (fallback)
6. **CSS/XPath** (last resort)

#### React/Angular/Vue
1. **data-testid** (highest priority - most stable)
2. **stable ID** (non-dynamic)
3. **role + name** (semantic)
4. **aria-label** (accessibility)
5. **text content** (fallback)
6. **CSS** (last resort)

#### Generic Web
1. **stable ID** (non-dynamic)
2. **role + name** (semantic)
3. **aria-label** (accessibility)
4. **text content** (fallback)
5. **CSS** (last resort)

### 3. Database Schema

```sql
-- Element Model Table
CREATE TABLE element_models (
    element_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_name VARCHAR(255) NOT NULL,
    element_type VARCHAR(50) NOT NULL,  -- button, input, link, etc.
    page_id UUID REFERENCES page_objects(page_object_id),
    application_type VARCHAR(50) NOT NULL,  -- salesforce, react, angular, vue, generic
    
    -- Identifiers stored as JSONB for flexibility
    identifiers JSONB NOT NULL,  -- Array of identifier objects
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
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

-- Indexes for performance
CREATE INDEX idx_element_models_page ON element_models(page_id);
CREATE INDEX idx_element_models_app_type ON element_models(application_type);
CREATE INDEX idx_element_models_tenant ON element_models(tenant_id);
CREATE INDEX idx_element_models_identifiers ON element_models USING GIN(identifiers);  -- GIN for JSONB queries
CREATE INDEX idx_element_models_name ON element_models(element_name);

-- Element Usage Tracking (for analytics)
CREATE TABLE element_model_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id UUID REFERENCES element_models(element_id) ON DELETE CASCADE,
    test_case_id UUID REFERENCES test_cases(test_case_id) ON DELETE CASCADE,
    identifier_used VARCHAR(50),  -- Which identifier was used
    success BOOLEAN DEFAULT true,
    execution_time_ms INTEGER,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_element_usage_element ON element_model_usage(element_id);
CREATE INDEX idx_element_usage_test_case ON element_model_usage(test_case_id);
CREATE INDEX idx_element_usage_tenant ON element_model_usage(tenant_id);
```

### 4. Element Model Builder

**Responsibilities:**
1. Extract element data from Flowstral recording
2. Analyze element using ApplicationDetector
3. Generate multiple identifiers based on app type
4. Store in element_models table
5. Track usage and success rates

**Key Methods:**
- `build_element_model(element_data, app_type, page_context)` → ElementModel
- `find_or_create_element(element_data, app_type, page_context)` → ElementModel
- `update_element_identifiers(element_id, new_identifiers)` → ElementModel
- `get_best_identifier(element_id, app_type)` → Identifier

### 5. Integration with Flowstral

**During Recording:**
1. User interacts with element
2. Flowstral captures element data
3. ElementModelBuilder analyzes element
4. Creates/updates element model
5. Action graph node references element_id (not raw selector)

**During Test Generation:**
1. Playwright generator gets element_id from action graph node
2. ElementModelService retrieves element model
3. Gets best identifier for app type
4. Generates Playwright locator code
5. Falls back to next identifier if primary fails

### 6. Scalability Considerations

**Storage:**
- JSONB for identifiers (flexible, queryable)
- GIN indexes for fast JSONB queries
- Partitioning by tenant_id (if needed for large scale)

**Performance:**
- Cache frequently used elements (Redis)
- Batch element lookups
- Lazy loading of identifiers

**Query Optimization:**
- Index on (tenant_id, page_id, element_name) for fast lookups
- Index on application_type for app-specific queries
- GIN index on identifiers JSONB for identifier searches

## Implementation Plan

### Phase 1: Core Element Model (Week 1)
1. Database migration for element_models table
2. ElementModelService class
3. ElementModelBuilder class
4. Basic CRUD operations

### Phase 2: Integration (Week 2)
1. Integrate with Flowstral recording
2. Build models during recording
3. Update Playwright generator to use models
4. Test with different app types

### Phase 3: Intelligence (Week 3)
1. Track identifier success rates
2. Auto-update priorities based on success
3. Self-healing when selectors break
4. Analytics and reporting

## Success Metrics

- **Coverage**: 100% of recorded elements have models
- **Identifiers**: Average 4-6 identifiers per element
- **Success Rate**: 95%+ of tests use working identifiers
- **Performance**: <50ms to retrieve element model
- **Scalability**: Handle 10,000+ elements per tenant

## Next Steps

1. Create database migration
2. Implement ElementModelService
3. Implement ElementModelBuilder
4. Integrate with Flowstral recording
5. Update Playwright generator
6. Test with real recordings



