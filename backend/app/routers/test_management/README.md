# Test Management Routers

Backend API routers for the full test case lifecycle -- CRUD operations, test plans, test runs, execution, automation, Gherkin/BDD support, complex verifications, and requirement-to-test-case conversion.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `test_runs_api.py` | 1,122 | `/test-runs` | 15 | Test run execution, WebSocket progress, result reporting |
| `test_cases_crud_api.py` | 998 | `/test-cases` | 16 | Test case CRUD with PostgreSQL and in-memory fallback |
| `complex_verifications.py` | 649 | `/api/complex-verify` | 10 | Email (MS 365, Gmail), PDF content, and file download verification |
| `requirement_to_testcase_api.py` | 394 | `/requirements` | 2 | Convert requirements to test cases via AI/NLP pipeline |
| `sample_data_api.py` | 271 | `/api/sample-data` | 4 | Sample data generation for test cases |
| `gherkin_api.py` | 223 | `/api/gherkin` | 3 | BDD/Gherkin conversion (to/from structured test cases) |
| `automation_api.py` | 216 | `/automation` | 5 | Script conversion, test execution, locator analysis |
| `test_case_api.py` | 185 | `/api/test-cases` | 3 | Test case API (legacy/v2 endpoints) |
| `test_plans_api.py` | 153 | `/test-plans` | 4 | Test plan CRUD and test case linking |
| `workflows_api.py` | 104 | `/workflows` | 4 | Workflow step management |
| `test_case_rewrite_api.py` | 93 | `/rewrite-test-case` | 1 | AI-powered test case rewriting and formatting |

**Total: 67 endpoints across 11 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/test-cases` | GET/POST | test_cases_crud_api | List and create test cases |
| `/test-cases/{id}` | GET/PUT/DELETE | test_cases_crud_api | Individual test case CRUD |
| `/test-runs` | GET/POST | test_runs_api | List and create test runs |
| `/test-runs/ws/{executionId}` | WebSocket | test_runs_api | Real-time execution progress |
| `/test-plans` | GET/POST | test_plans_api | Test plan management |
| `/api/gherkin/convert` | POST | gherkin_api | Convert to/from Gherkin format |
| `/api/complex-verify/email` | POST | complex_verifications | Verify email content (MS 365/Gmail) |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/executors/` | Playwright runner, executor queue, unified runner |
| `backend/app/services/core/` | Test plan service, test data service |
| `backend/app/services/ai/` | Test case generation and rewriting |

## Related Frontend Module

- `src/modules/test-management/` -- 18 pages, FlowstralWorkflowEditor, test execution UI
