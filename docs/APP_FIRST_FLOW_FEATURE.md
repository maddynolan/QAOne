# App-First Flow Feature - Complete Implementation

## Overview

The App-First Flow feature enables automatic generation of automation, performance, accessibility, API, and security tests for existing applications, primarily for client demos. This feature captures user flows, generates comprehensive tests, and automatically logs findings and bugs.

## Architecture

### Flow A – App-first (Recommended Default)

1. **User launches browser plugin/recorder** on an existing app
2. **User navigates through a flow** (e.g. login → search → checkout)
3. **Automation Agent**: Captures DOM + actions, generates Playwright script
4. **Test Design Agent**: Converts script + DOM into structured test cases
5. **Requirements Agent**: Infers implicit requirements from flows and existing Jira issues, suggests missing acceptance criteria
6. **Run automation**: Execute tests
7. **Defect Agent**: If any step fails, captures logs, screenshot, steps, and files defect automatically (in tool and/or Jira)
8. **Optional: Perf & A11y Agents**: Re-run recorded flow in perf/a11y mode, raise findings

## Components

### 1. Defect Agent (`backend/app/services/defect_agent.py`)

**Purpose**: Automatically captures and files defects from test failures

**Features**:
- Analyzes test failures using LLM to extract defect details
- Captures screenshots, logs, and test steps
- Files defects automatically (internal and/or Jira)
- Categorizes and prioritizes defects
- Links defects to requirements and test cases

**Operations**:
- `capture_and_file`: Capture test failure and file defect

### 2. Test Design Agent (`backend/app/services/test_design_agent.py`)

**Purpose**: Converts Playwright scripts to structured test cases

**Features**:
- Parses Playwright scripts to extract structure
- Uses LLM to convert to structured test cases with steps, assertions, and metadata
- Links test cases to requirements
- Creates test plans automatically

**Operations**:
- `convert_script`: Convert Playwright script to structured test case

### 3. Requirements Agent Enhancement

**New Method**: `infer_requirements_from_flow()`

**Features**:
- Infers implicit requirements from recorded flows
- Searches existing Jira issues for similar requirements
- Suggests missing acceptance criteria
- Stores inferred requirements in database

### 4. App-First Flow Orchestrator (`backend/app/services/app_first_flow_orchestrator.py`)

**Purpose**: Coordinates the complete flow from recording to execution

**Main Methods**:
- `execute_complete_flow()`: Complete flow from recording to test case generation
- `execute_recorded_flow()`: Execute a previously recorded flow
- `get_flow_status()`: Get status of a flow
- `get_flow_findings()`: Get all findings (defects, performance, accessibility)

### 5. API Router (`backend/app/routers/app_first_flow.py`)

**Endpoints**:
- `POST /api/app-first/record-and-generate`: Complete App-First Flow
- `POST /api/app-first/execute-flow`: Execute a recorded flow
- `GET /api/app-first/flow/{flow_id}`: Get flow status
- `GET /api/app-first/findings/{flow_id}`: Get all findings

## Database Schema

### New Tables

1. **defects**: Stores defects captured from test failures
   - Links to test runs, test cases, requirements
   - Stores failure details, screenshots, logs, steps
   - Supports Jira integration

2. **app_first_flows**: Metadata for App-First Flow executions
   - Links recordings to test cases
   - Tracks flow status

3. **perf_findings**: Performance findings from flows
   - Links to performance runs and flows
   - Stores metrics and violations

4. **a11y_findings**: Accessibility findings from flows
   - Links to scans and flows
   - Stores WCAG violations

### Migration

Run migration: `supabase/migrations/020_app_first_flow_tables.sql`

## Usage

### 1. Record and Generate

```bash
POST /api/app-first/record-and-generate
Authorization: Bearer <api_key>

{
  "url": "https://example.com",
  "title": "Login Flow",
  "snapshots": [...],
  "project_id": "...",
  "org_id": "...",
  "enable_performance": true,
  "enable_accessibility": true,
  "file_defects_to_jira": true,
  "jira_project_key": "PROJ"
}
```

**Response**:
```json
{
  "status": "success",
  "flow_id": "...",
  "recording_id": "...",
  "playwright_script": "...",
  "test_cases": [...],
  "requirements": [...],
  "suggested_acceptance_criteria": [...]
}
```

### 2. Execute Flow

```bash
POST /api/app-first/execute-flow
Authorization: Bearer <api_key>

{
  "recording_id": "...",
  "project_id": "...",
  "run_performance": true,
  "run_accessibility": true
}
```

**Response**:
```json
{
  "status": "success",
  "execution_id": "...",
  "test_run_id": "...",
  "test_results": {...},
  "defects": [...],
  "performance_findings": [...],
  "accessibility_findings": [...]
}
```

## Agent Registration

New agents are registered in `backend/app/services/agent_registration.py`:

- **Defect Agent**: `AgentType.DEFECT`
- **Test Design Agent**: `AgentType.TEST_DESIGN`

## Integration Points

### Browser Plugin/Recorder

The feature integrates with browser plugins through:
- `POST /api/plugins/recordings/upload`: Upload recordings
- `POST /api/plugins/tests/generate`: Generate tests from recordings

### Jira Integration

- Defects can be automatically filed to Jira
- Requirements are synced from Jira
- Similar requirements are searched in Jira

### Performance & Accessibility

- Optional performance analysis using k6
- Optional accessibility scanning using axe-core
- Findings are automatically logged

## Benefits

1. **Automated Test Generation**: From user flows to executable tests
2. **Requirements Discovery**: Infers implicit requirements
3. **Automatic Defect Filing**: Captures and files defects automatically
4. **Comprehensive Testing**: Performance and accessibility included
5. **Client Demo Ready**: Perfect for demonstrating testing capabilities

## Future Enhancements

1. **API Testing**: Generate API tests from recorded flows
2. **Security Testing**: Integrate security scanning into flow
3. **Visual Regression**: Add visual comparison testing
4. **Multi-browser Support**: Test across browsers automatically
5. **CI/CD Integration**: Auto-trigger flows on deployments

## Files Created/Modified

### New Files
- `backend/app/services/defect_agent.py`
- `backend/app/services/test_design_agent.py`
- `backend/app/services/app_first_flow_orchestrator.py`
- `backend/app/routers/app_first_flow.py`
- `supabase/migrations/020_app_first_flow_tables.sql`
- `docs/APP_FIRST_FLOW_FEATURE.md`

### Modified Files
- `backend/app/services/requirements_agent.py` (added `infer_requirements_from_flow()`)
- `backend/app/services/agent_registration.py` (registered new agents)
- `backend/app/schemas/agent_schemas.py` (added `DEFECT` and `TEST_DESIGN` types)
- `backend/app/main.py` (registered router)

## Testing

To test the feature:

1. **Start the backend**: `uvicorn app.main:app --reload`
2. **Run migration**: Apply `020_app_first_flow_tables.sql`
3. **Record a flow**: Use browser plugin to record a user flow
4. **Generate tests**: Call `/api/app-first/record-and-generate`
5. **Execute tests**: Call `/api/app-first/execute-flow`
6. **Check findings**: Call `/api/app-first/findings/{flow_id}`

## Notes

- All agents use the Model Gateway for LLM access
- Multi-tenant support is built-in
- Screenshots are stored in object store
- Logs and steps are stored in database
- Jira integration is optional



