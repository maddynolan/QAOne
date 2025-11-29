# Main.py Refactoring - Complete Status

## Summary
The main.py file is 6,632 lines with 106 endpoints. This refactoring extracts all endpoints into domain-specific routers.

## Completed ✅

### 1. Helper Functions (`app/utils/endpoint_helpers.py`)
- `map_priority_from_db()` - Map DB priority to frontend format
- `map_priority_to_db()` - Map frontend priority to DB format  
- `ensure_default_org_project()` - Ensure default org/project exist
- Constants: `DEFAULT_USER_ID`, `DEFAULT_ORG_ID`, `DEFAULT_PROJECT_ID`

### 2. Routers Created
- ✅ `routers/health_api.py` - Health and metrics (3 endpoints)
- ✅ `routers/test_cases_crud_api.py` - Test cases CRUD (6 endpoints)

## Remaining Work

### Routers to Create (in priority order):

1. **Test Runs Router** (`routers/test_runs_api.py`) - 14 endpoints
   - GET /test-runs
   - GET /test-runs/{run_id}
   - POST /test-runs
   - PUT /test-runs/{run_id}
   - POST /test-runs/{run_id}/start
   - POST /test-runs/{run_id}/execute-selected
   - POST /test-runs/{run_id}/steps/{step_id}/mark
   - POST /test-runs/{run_id}/steps/{step_id}/screenshot
   - POST /test-runs/{run_id}/screenshot
   - POST /test-runs/{run_id}/steps/{step_id}/link-defect
   - POST /test-runs/{run_id}/link-defect
   - DELETE /test-runs/{run_id}
   - POST /test-runs/{run_id}/comments
   - GET /test-runs/{run_id}/comments

2. **Requirements Router** (`routers/requirements_api.py`) - 5 endpoints
   - GET /requirements
   - POST /requirements
   - POST /requirements/convert-to-gherkin/{requirement_id}
   - GET /requirements/{requirement_id}
   - PUT /requirements/{requirement_id}

3. **Defects Router** (`routers/defects_api.py`) - 5 endpoints
   - GET /defects
   - GET /defects/{defect_id}
   - POST /defects
   - PUT /defects/{defect_id}
   - DELETE /defects/{defect_id}

4. **Test Plans Router** (`routers/test_plans_api.py`) - 4 endpoints
   - GET /test-plans
   - POST /test-plans
   - PUT /test-plans/{plan_id}
   - DELETE /test-plans/{plan_id}

5. **AI Generation Router** (`routers/ai_generation_api.py`) - 31 endpoints
   - All /ai/* endpoints

6. **Agents Router** (`routers/agents_api.py`) - 4 endpoints
   - POST /agents/execute
   - GET /agents
   - GET /agents/{agent_type}/health
   - GET /agents/health

7. **Workflows Router** (`routers/workflows_api.py`) - 4 endpoints
   - POST /workflows/multi-agent
   - POST /workflows/create
   - POST /workflows/{workflow_id}/execute
   - GET /workflows/{workflow_id}

8. **Models Router** (`routers/models_api.py`) - 5 endpoints
   - GET /ai/models
   - GET /ai/models/{model_id}
   - POST /ai/models/register
   - POST /ai/models/{model_id}/deploy
   - POST /ai/models/{model_id}/ab-test
   - POST /ai/models/{model_id}/rollback

9. **Tenants Router** (`routers/tenants_api.py`) - 4 endpoints
   - POST /tenants
   - GET /tenants/{tenant_id}
   - GET /tenants
   - PATCH /tenants/{tenant_id}/settings

10. **Other Routers** - Various smaller groups
    - Integrations (Jira webhook)
    - Traceability
    - Tests execution
    - Runners
    - Executors
    - And others

## Final Steps

1. Create all remaining routers
2. Remove old endpoint code from main.py (keep only router imports)
3. Move Pydantic models to `app/schemas/endpoint_models.py`
4. Update main.py to only include:
   - App initialization
   - Lifespan management
   - CORS middleware
   - Router imports and registration

## Target Main.py Size
- Current: 6,632 lines
- Target: ~200-300 lines (just setup and router includes)


