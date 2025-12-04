# Autonomous App Exploration System

## Overview

The Autonomous App Exploration System provides an **agentic experience** that automatically navigates through applications, builds a comprehensive "capability map", and compares new requirements against discovered capabilities to identify gaps, impact, and suggest test cases.

## Architecture

### 1. Autonomous Explorer (`autonomous_explorer.py`)
- **Purpose**: Systematically navigates through an application using BFS/DFS strategies
- **Features**:
  - Starts at base URL and explores pages systematically
  - Handles login flows automatically
  - Extracts page metadata (headings, buttons, links, forms, tables)
  - Discovers entities and operations
  - Takes screenshots for documentation
  - Builds a graph of pages and transitions

### 2. Capability Map Builder (`capability_map_builder.py`)
- **Purpose**: Converts exploration results into structured requirement-like capabilities
- **Features**:
  - Extracts entities and operations from discovered pages
  - Uses LLM to normalize and enrich capabilities
  - Infers preconditions, postconditions, validations, and business rules
  - Groups capabilities by entity and operation

### 3. Requirement Comparator (`requirement_comparator.py`)
- **Purpose**: Compares new requirements against discovered capability map
- **Features**:
  - Semantic matching to find closest capabilities
  - Identifies gaps (missing fields, validations, features)
  - Detects conflicts (role mismatches, type conflicts)
  - Determines impact type (UI only, backend rules, new flow, data model)
  - Suggests test cases based on gaps and requirements

## Usage

### 1. Start Autonomous Exploration

```python
POST /api/exploration/start

{
  "base_url": "https://example.com",
  "max_depth": 5,
  "max_pages": 100,
  "allowed_domains": ["example.com"],
  "excluded_paths": ["/logout", "/api/"],
  "login_flow": {
    "url": "https://example.com/login",
    "username_selector": "#username",
    "password_selector": "#password",
    "submit_selector": "button[type='submit']",
    "username": "admin",
    "password": "password"
  },
  "headless": true,
  "screenshot": true
}
```

**Response:**
```json
{
  "status": "success",
  "exploration_result": {
    "base_url": "https://example.com",
    "total_pages": 25,
    "pages": [
      {
        "id": "example_com_users",
        "url": "https://example.com/users",
        "title": "Users",
        "headings": ["Users", "User Management"],
        "entities": ["User"],
        "actions": ["Create", "Edit", "Delete"],
        "forms": [...],
        "buttons": [...],
        "links": [...]
      }
    ]
  },
  "capability_map": {
    "entities": [
      {
        "entity": "User",
        "operation": "Create",
        "preconditions": ["Admin is logged in"],
        "postconditions": ["New user record exists"],
        "fields": [
          {"name": "first_name", "required": true, "type": "text"},
          {"name": "role", "required": true, "type": "select", "options": ["Admin", "Viewer"]}
        ],
        "validations": [...],
        "source_pages": ["example_com_users_create"]
      }
    ]
  }
}
```

### 2. Compare Requirements Against Capability Map

```python
POST /api/exploration/compare-requirements

{
  "requirements": [
    {
      "id": "REQ-001",
      "entity": "User",
      "operation": "Create",
      "fields": [
        {"name": "first_name", "required": true},
        {"name": "email", "required": true, "type": "email"},
        {"name": "role", "required": true, "options": ["Admin", "Viewer", "Manager"]}
      ],
      "validations": [
        {"field": "email", "type": "email_format"},
        {"field": "password", "type": "min_length", "value": 8}
      ],
      "roles": ["Admin"]
    }
  ],
  "capability_map": { ... }  // From exploration result
}
```

**Response:**
```json
{
  "status": "success",
  "summary": {
    "fully_supported": 5,
    "partially_supported": 2,
    "not_supported": 1,
    "conflicting": 0
  },
  "matches": [
    {
      "requirement_id": "REQ-001",
      "status": "partially_supported",
      "confidence": 0.85,
      "gaps": [
        "Missing field: email",
        "Field role missing options: Manager"
      ],
      "conflicts": [],
      "impacted_pages": ["example_com_users_create"],
      "impact_type": "ui_only",
      "suggested_tests": [
        {
          "title": "Test new field: email",
          "type": "functional",
          "priority": "medium",
          "steps": [...]
        }
      ]
    }
  ]
}
```

## Integration with Flowstral

### Current Flow
1. **User Records Flow** → Action Graph → Test Cases

### Enhanced Flow with Exploration
1. **Autonomous Exploration** → Capability Map
2. **User Records Flow** → Action Graph → Test Cases
3. **New Requirements** → Compare Against Capability Map → Gap Analysis → Suggested Tests

### Benefits
- **Automatic Discovery**: No need to manually record every page
- **Comprehensive Coverage**: Discovers pages users might not visit
- **Gap Analysis**: Identifies what's missing when new requirements come in
- **Impact Assessment**: Shows which pages/flows are affected
- **Test Suggestions**: Auto-generates test cases for gaps

## Configuration

### ExplorationConfig

```python
ExplorationConfig(
    base_url="https://example.com",
    max_depth=5,              # Maximum navigation depth
    max_pages=100,            # Maximum pages to explore
    allowed_domains=[],       # Restrict to specific domains
    excluded_paths=[          # Paths to skip
        "/logout",
        "/api/",
        "/static/"
    ],
    excluded_patterns=[       # Regex patterns to skip
        r'\.(pdf|zip)$',
        r'#'
    ],
    login_flow={              # Optional login configuration
        "url": "...",
        "username_selector": "...",
        "password_selector": "...",
        "submit_selector": "..."
    },
    wait_timeout=5000,        # Page load timeout
    screenshot=True,           # Take screenshots
    headless=True             # Run in headless mode
)
```

## Limitations & Considerations

### What It Can Do
✅ Navigate pages systematically  
✅ Extract page structure (forms, buttons, links)  
✅ Infer entities and operations  
✅ Identify CRUD operations  
✅ Compare requirements against capabilities  
✅ Suggest test cases  

### What It Cannot Do
❌ Infer deep business rules (backend logic)  
❌ Discover hidden features (feature flags, role-based screens)  
❌ Understand complex workflows without seeding  
❌ Handle dynamic content that requires specific user actions  

### Recommendations
- **Seed Scenarios**: Provide initial scenarios for complex flows
- **Role-Based Exploration**: Run exploration with different user roles
- **Feature Flags**: Configure feature flags before exploration
- **Manual Review**: Review and refine discovered capabilities

## Future Enhancements

1. **Storage**: Persist capability maps in database
2. **Incremental Updates**: Update capability map as app changes
3. **Visualization**: UI to visualize capability map and gaps
4. **Embeddings**: Use semantic embeddings for better matching
5. **Multi-Role Exploration**: Explore with different user roles
6. **API Discovery**: Integrate with API spec parsing
7. **Change Detection**: Compare capability maps over time

## Example Workflow

1. **Initial Setup**: Run autonomous exploration on your app
   ```
   POST /api/exploration/start
   → Capability Map created
   ```

2. **New Requirement Arrives**: Jira story for "Add email field to user creation"
   ```
   POST /api/exploration/compare-requirements
   → Status: Partially Supported
   → Gap: Missing email field
   → Impact: UI only (add field to form)
   → Suggested Tests: Test email field validation
   ```

3. **Generate Tests**: Use suggested tests to create test cases
   ```
   → Test: "Verify email field in user creation form"
   → Test: "Test email validation"
   ```

4. **Track Changes**: Re-run exploration after implementation
   ```
   → Compare new capability map with old
   → Verify email field is now present
   ```

## Files Created

- `backend/app/services/exploration/autonomous_explorer.py` - Core exploration agent
- `backend/app/services/exploration/capability_map_builder.py` - Capability map builder
- `backend/app/services/exploration/requirement_comparator.py` - Requirement comparison engine
- `backend/app/services/exploration/__init__.py` - Package exports
- `backend/app/routers/exploration_api.py` - API endpoints
- `backend/AUTONOMOUS_EXPLORATION_SYSTEM.md` - This documentation

## Next Steps

1. ✅ Core exploration agent implemented
2. ✅ Capability map builder implemented
3. ✅ Requirement comparator implemented
4. ✅ API endpoints created
5. ⏳ Add UI for exploration and visualization
6. ⏳ Integrate with Flowstral recorder
7. ⏳ Add database storage for capability maps
8. ⏳ Enhance semantic matching with embeddings




