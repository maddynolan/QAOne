# Feature: Test Building & Design
> Create, edit, and manage test cases through a visual no-code builder, AI-powered generation from requirements, Gherkin conversion, and a 5-layer enhancement pipeline — all producing runnable Playwright scripts.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Test Case Generation Pipeline](#7-test-case-generation-pipeline)
8. [Step Types Reference](#8-step-types-reference)
9. [Configuration](#9-configuration)
10. [Known Gaps & TODOs](#10-known-gaps--todos)

---

## 1. Overview

Test Building is the design-time counterpart to Recording. While Recording captures interactions from a live browser, Test Building lets users:

- **Visually compose tests** using a no-code step editor with 60+ step types
- **Generate tests from requirements** via a 4-step pipeline (Jira story → context → skeletons → LLM rewrite)
- **Convert to Gherkin** for BDD workflows
- **Import recordings** and merge them with manual test steps
- **Organize tests** in a repository with folders, suites, releases, and plans
- **Export to CI/CD** (GitHub Actions, GitLab CI, Jenkins, Azure Pipelines, Bitbucket)
- **Generate Playwright code** from visual test definitions

**Who it's for:** QA leads designing test strategies, testers building test cases without code, and automation engineers bootstrapping test suites.

**Key pages:**

| Page | Lines | Role |
|------|-------|------|
| `UnifiedWorkflowEditor.tsx` | ~11,694 | Primary no-code/code test builder |
| `TestRepository.tsx` | ~7,027 | Test management hub (folders, suites, releases) |
| `FlowstralWorkflowEditor.tsx` | ~2,242 | Visual canvas-based workflow editor |
| `TestPlayground.tsx` | ~1,858 | 10-tab interactive testing playground |

---

## 2. Architecture

### Data Flow

```
Inputs:
    ├── Manual step creation (No-code editor)
    ├── Recording import (Flowstral sessions)
    ├── Requirement import (Jira stories)
    ├── File import (JSON/CSV)
    └── AI generation (natural language)
        │
        ▼
    UnifiedWorkflowEditor (11.6K lines)
        ├── 60+ step types with selector, value, assertions
        ├── Variables & data sources (CSV/JSON)
        ├── Conditions, loops, modules (reusable)
        ├── Recording integration (re-record steps)
        └── Playwright code generation
        │
        ▼
    Storage (triple-write):
        ├── localStorage (autosave)
        ├── PostgreSQL backend (test-cases CRUD API)
        └── SQLite scale DB (bulk/enterprise)
        │
        ▼
    Backend Generation Pipeline:
        ├── TestCaseEngine (5-layer enhancement)
        ├── TestCaseSynthesizer (action graph → steps)
        ├── GherkinConverter (BDD format)
        ├── FlowstralTestBuilder (Playwright code)
        └── AI Layer (beautifier, gap analyzer, rewriter)
        │
        ▼
    Outputs:
        ├── Structured test cases (ISTQB/Gherkin/Markdown)
        ├── Playwright Python/TypeScript scripts
        ├── CI/CD pipeline configs
        └── Quality validation reports
```

### Frontend-Backend Communication

| Channel | Used By | Purpose |
|---------|---------|---------|
| `GET/POST/PUT/DELETE /test-cases/*` | Editor, Repository, TestCases | CRUD test cases (PostgreSQL + in-memory) |
| `GET/DELETE /test-cases/scale-data/*` | Repository, Editor | Enterprise SQLite bulk storage |
| `GET /api/flowstral/session/*/artifacts` | Editor, FlowstralWorkflowEditor, TestCaseGenerator | Load recording sessions |
| `POST /api/flowstral/execute` | Editor | Execute test directly |
| `POST /automation/execute-test` | FlowstralWorkflowEditor TestRunner | Execute Playwright scripts |
| `POST /api/test-cases/generate-from-action-graph` | TestCaseGenerator | Generate test cases from Action Graph |
| `POST /rewrite-test-case` | Requirement pipeline | LLM rewrite of scenario skeletons |
| `POST /api/gherkin/convert` | Gherkin tab | Convert to BDD format |
| **localStorage** (35+ keys) | All pages | Autosave, cache, session persistence |
| **Electron IPC** | Editor, SimpleStepEditor | Re-record, element picker, test run |

---

## 3. Frontend Code Audit

### Pages

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/test-management/pages/UnifiedWorkflowEditor.tsx` | ~11,694 | **Fully implemented** | Primary builder: 60+ step types, no-code/code modes, recording integration, variables, modules, assertions, Playwright codegen |
| `src/modules/test-management/pages/TestRepository.tsx` | ~7,027 | **Fully implemented** | Folder tree, test case list (grid/list), suites, releases, plans, runs, defects, import/export, bulk ops, drag-and-drop |
| `src/modules/test-management/pages/TestCases.tsx` | 858 | **Fully implemented** | Test case list/dashboard with stats, search, filter, quick-run, execution history |
| `src/modules/test-management/pages/CreateTestCase.tsx` | 908 | **Fully implemented** | Templates (Login, CRUD, API, E2E, Blank), Flowstral import, step import, metadata sidebar |
| `src/modules/test-management/pages/EditTestCase.tsx` | 498 | **Fully implemented** | Edit test case by ID, load from API or Flowstral fallback |
| `src/modules/test-management/pages/TestPlayground.tsx` | 1,858 | **Fully implemented** | 10-tab demo page (Products, Cart, Tables, Forms, Login, Interactions, Frames, Downloads, Alerts, Advanced) |
| `src/modules/test-management/pages/EnterpriseTestRepository.tsx` | 328 | **Partial** | Enterprise wrapper using Zustand + React Query. Runs tab is placeholder. |

### Components

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/test-management/components/FlowstralWorkflowEditor/FlowstralWorkflowEditor.tsx` | 2,242 | **Fully implemented** | Visual canvas editor with zoom/pan, node drag, import/export, Playwright code gen |
| `src/modules/test-management/components/FlowstralWorkflowEditor/WorkflowNodes.tsx` | 660 | **Fully implemented** | 19 node types with editors: API Request, DB Query, Variable, Loop, Condition, Screenshot, Wait, Import Element, Call Workflow |
| `src/modules/test-management/components/FlowstralWorkflowEditor/LocatorBuilder.tsx` | 690 | **Fully implemented** | Strategy-based locator generation: auto, role, text, label, testid, css. Salesforce-aware. |
| `src/modules/test-management/components/FlowstralWorkflowEditor/VariableStore.tsx` | 676 | **Fully implemented** | Manage variables (string/number/boolean/object/array/secret) and data sources (CSV/JSON/Excel/API) |
| `src/modules/test-management/components/FlowstralWorkflowEditor/TestRunner.tsx` | 347 | **Fully implemented** | Execute Playwright scripts via backend, show results with logs/screenshots/video |
| `src/modules/test-management/components/FlowstralWorkflowEditor/TestSuiteManager.tsx` | 660 | **Fully implemented** | Suite CRUD, workflow enable/disable, environment management. Runs are simulated. |
| `src/modules/test-management/components/FlowstralWorkflowEditor/ScheduleManager.tsx` | 570 | **Fully implemented** | Cron/interval/one-time scheduling. Client-side only (no backend scheduler). |
| `src/modules/test-management/components/FlowstralWorkflowEditor/CICDExporter.tsx` | 706 | **Fully implemented** | Generate GitHub Actions, GitLab CI, Jenkins, Azure Pipelines, Bitbucket configs |
| `src/modules/test-management/components/SimpleStepEditor.tsx` | 868 | **Fully implemented** | Failed-step repair modal with browser picker, visual selector cards, manual fallback |
| `src/modules/test-management/components/ReusableModulesManager.tsx` | 559 | **Fully implemented** | Save/load reusable step modules (login, navigation, data_entry, verification, cleanup) |
| `src/modules/test-management/components/TestCaseGenerator/TestCaseGenerator.tsx` | 555 | **Fully implemented** | Generate test cases from Flowstral action graphs with quality validation |
| `src/modules/test-management/components/StepAutomationLinker.tsx` | 922 | **Fully implemented** | Link manual steps ↔ recorded actions. 3 link modes (document/replace/hybrid), auto-advance. |

### Libraries

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/test-management/lib/test-management-service.ts` | 589 | **Fully implemented** | Singleton with 30s cache. Combines PostgreSQL + Flowstral + localStorage. Default backend: `qaone-production.up.railway.app` |
| `src/modules/test-management/lib/hardening-service.ts` | 543 | **Fully implemented** | In-memory bug reports, test executions, bug bash sessions. Simulated 90% pass rate. No persistence. |
| `src/modules/recorder/lib/automation-linking.ts` | 637 | **Fully implemented** | Core linking system: 30+ description templates, step matching heuristics, coverage calculation |

---

## 4. Backend Code Audit

### Routers

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/test_management/test_case_api.py` | 186 | `/api/test-cases` | 3 | **Fully implemented** |
| `backend/app/routers/test_management/test_cases_crud_api.py` | 999 | `/test-cases` | 16 | **Fully implemented** |
| `backend/app/routers/test_management/test_case_rewrite_api.py` | 94 | `/rewrite-test-case` | 1 | **Fully implemented** |
| `backend/app/routers/test_management/gherkin_api.py` | 224 | `/api/gherkin` | 3 | **Fully implemented** |
| `backend/app/routers/ai/ai_generation_api.py` | ~2,934 | `/ai` | 28 | **Mostly real** (2 stubs) |
| `backend/app/routers/test_management/requirement_to_testcase_api.py` | 395 | `/requirements` | 2 | **Fully implemented** (170 lines dead code) |

### Services — Engine Layer (deterministic)

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/engines/test_case_engine.py` | 281 | **Fully implemented** | Main orchestrator: 5-layer progressive enhancement (HTML, JS/Network/CSS, NLP/Patterns, ML Clustering, Knowledge Base) |
| `backend/app/services/engines/test_case_synthesizer.py` | 2,377 | **Fully implemented** | Phase 2: action graph → structured test cases. 8-strategy element naming, context-aware expected results |
| `backend/app/services/engines/test_case_enhancements.py` | 478 | **Fully implemented** | Post-processing: adds navigation, cleans element names, improves expected results and descriptions |
| `backend/app/services/engines/test_case_validator.py` | 414 | **Fully implemented** | 5-dimension validation: element names, step completeness, structure, deduplication, standards (ISTQB/Gherkin) |
| `backend/app/services/engines/test_case_deduplication_service.py` | 220 | **Implemented** | Jaccard similarity dedup. **Domain-specific** to banking/payments (payee/frequency patterns). |
| `backend/app/services/engines/gherkin_converter.py` | 305 | **Fully implemented** | Requirement → Gherkin `.feature` format. Handles acceptance criteria, user stories, default scenarios. |
| `backend/app/services/engines/variation_generator.py` | 260 | **Implemented** | **Domain-specific** to banking/payments (payee, frequency, end date variations only). |
| `backend/app/services/engines/expected_results_generator.py` | 416 | **Fully implemented** | 5-strategy expected result generation. Detects 15+ bad patterns. Context-aware for click/input/select/submit/navigate. |
| `backend/app/services/engines/scenario_skeleton_generator.py` | 347 | **Fully implemented** | Action graph → scenario skeletons with boundary detection (URL changes, milestones) and intent inference. |

### Services — Flowstral Engine (code generation)

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/flowstral_engine/test_builder.py` | 950 | **Fully implemented** | Recording/test case → Playwright Python files. Two styles: "keywords" (readable) or "engine" (embedded FlowstralEngine). Detects SF/ServiceNow/Workday/SAP/Dynamics. |
| `backend/app/services/flowstral_engine/code_generator.py` | 694 | **Fully implemented** | Intent-based Playwright code with 7-strategy embedded FlowstralEngine (text, label, role, placeholder, testid, name, css). |

### Services — AI Layer (LLM-powered)

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/ai_layer/test_case_beautifier.py` | 136 | **Fully implemented** | LLM-powered conversion to natural language. Falls back to original on failure. |
| `backend/app/services/ai_layer/gap_analyzer.py` | 148 | **Fully implemented** | LLM-powered coverage gap analysis. Identifies missing scenarios, boundary tests, negative tests. |

---

## 5. API Endpoints

### Test Case CRUD (`/test-cases`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/test-cases` | List test cases (filterable by project_id, plan_id) |
| POST | `/test-cases` | Create new test case |
| GET | `/test-cases/{case_id}` | Get single test case |
| PUT | `/test-cases/{case_id}` | Update test case |
| DELETE | `/test-cases/{case_id}` | Soft-delete (archive) |
| POST | `/test-cases/{case_id}/link-requirement` | Link to requirement (PostgreSQL only) |
| POST | `/test-cases/bulk-import` | Bulk import into SQLite |
| GET | `/test-cases/scale-data/summary` | Summary counts from SQLite |
| GET | `/test-cases/scale-data/paginated` | Paginated with search/filter/sort |
| GET | `/test-cases/scale-data/test-case/{id}` | Single test case with full steps |
| GET | `/test-cases/scale-data/suites` | Paginated suites |
| GET | `/test-cases/scale-data/plans` | Paginated plans |
| GET | `/test-cases/scale-data/releases` | Paginated releases |
| PUT | `/test-cases/scale-data/update/{id}` | Update in SQLite |
| DELETE | `/test-cases/scale-data/{id}` | Hard-delete from SQLite |
| GET | `/test-cases/scale-data` | Get ALL scale data (non-paginated) |

### Test Case Generation (`/api/test-cases`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/test-cases/generate-from-action-graph` | Generate from Action Graph via TestCaseEngine |
| POST | `/api/test-cases/convert-format` | Convert between ISTQB and Gherkin |
| POST | `/api/test-cases/validate` | Validate quality (returns score, issues, suggestions) |

### Gherkin (`/api/gherkin`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/gherkin/convert` | Convert single requirement to Gherkin |
| POST | `/api/gherkin/convert-batch` | Batch convert (by IDs, project, or inline) |
| GET | `/api/gherkin/formats` | Gherkin keyword/format metadata |

### Requirement Pipeline (`/requirements`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/requirements/jira-to-testcases` | Full 4-step pipeline: Jira → context → skeletons → LLM rewrite + dedup |
| POST | `/requirements/generate-skeletons` | Generate scenario skeletons only (no LLM) |

### LLM Rewrite (`/rewrite-test-case`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rewrite-test-case` | Rewrite scenario skeleton via LLM. Returns metrics (provider, latency, tokens, cost). |

### AI Generation (`/ai`) — Test Building Subset

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/generate-tests` | Requirement → test cases |
| POST | `/ai/generate-test-plan` | Requirement → test plan |
| POST | `/ai/generate-tests-enhanced` | Enhanced test generation |
| POST | `/ai/jira-to-testcases` | Jira story → test cases |
| POST | `/ai/testcase-to-playwright` | Test case → Playwright code |
| POST | `/ai/convert-to-playwright` | Convert test case format |
| POST | `/ai/generate-and-execute-automated` | Generate + execute Playwright test |
| POST | `/ai/tests/validate-code` | Validate test code syntax |
| GET | `/ai/templates` | List templates (**stub — TODO: query database**) |
| POST | `/ai/url-discover` | URL discovery (**placeholder — returns hardcoded data**) |

---

## 6. UI Walkthrough

### Creating a Test Case (No-Code Builder)

1. Navigate to **Test Builder** from the sidebar (opens `UnifiedWorkflowEditor`).
2. Enter a **test name** and optional description.
3. Set **base URL** in settings (e.g., `https://myapp.com`).
4. Click **Add Step** to open the step palette — 9 categories with 60+ step types.
5. Select a step type (e.g., **Navigate**, **Click**, **Fill**, **Assert**).
6. Configure the step:
   - **Selector:** CSS, XPath, text, aria, or data-testid
   - **Value:** Static text, variable reference (`{{username}}`), or runtime random
   - **Assertions:** Add one or more (text visible, element exists, attribute equals, etc.)
7. Drag steps to reorder. Use **Condition** and **Loop** steps for control flow.
8. Click **Save** — autosaves to localStorage and backend.

### Importing from a Recording

1. In the builder, click **Import Recording**.
2. Select a Flowstral session from the list.
3. The recorded actions are converted to builder steps with selectors and values.
4. Edit, reorder, or add assertions to the imported steps.
5. Use **StepAutomationLinker** to merge recorded actions with existing manual steps.

### Generating from Requirements

1. POST to `/requirements/jira-to-testcases` with a Jira story.
2. The pipeline runs 4 stages:
   - **Stage 1:** Parse requirement context (acceptance criteria, user story)
   - **Stage 2:** Build synthetic app model (fields, controls, validations)
   - **Stage 3:** Generate scenario skeletons with boundary detection
   - **Stage 4:** LLM rewrite + deduplication
3. Returns polished test cases ready for the builder.

### Test Repository Management

1. Navigate to **Test Repository** from the sidebar.
2. **Folders:** Create folders, drag-and-drop test cases between them.
3. **Suites:** Group test cases into suites for batch execution.
4. **Releases:** Create releases with linked suites and risk levels.
5. **Plans:** Create test plans with assigned test cases and track execution progress.
6. **Search & Filter:** Filter by name, tags, priority, status, folder, automation status.
7. **Bulk operations:** Select multiple test cases for move, delete, or export.

---

## 7. Test Case Generation Pipeline

### 5-Layer Enhancement (TestCaseEngine)

```
Action Graph + DOM Snapshots
        │
        ▼
Layer 1: HTML Constraint Extraction
    ├── Form field types, validation rules
    ├── Required fields, max lengths
    └── Input patterns, date formats
        │
        ▼
Layer 2: JavaScript / Network / CSS Analysis
    ├── Dynamic behavior detection
    ├── API call patterns
    └── State-dependent styling
        │
        ▼
Layer 3: NLP & Pattern Recognition
    ├── Natural language analysis of labels/text
    ├── Advanced pattern recognition
    └── Interaction pattern detection
        │
        ▼
Layer 4: ML Clustering
    ├── Similar test case grouping
    ├── Field type classification
    └── Domain knowledge base
        │
        ▼
Layer 5: Knowledge Base & Historical
    ├── Domain-specific rules
    ├── Historical test data mining
    └── Best practice injection
        │
        ▼
Test Case Synthesis
    ├── Precondition extraction
    ├── 8-strategy element naming
    ├── Context-aware expected results
    ├── Tag generation
    └── Postcondition extraction
        │
        ▼
Post-Processing
    ├── Entry-point navigation added
    ├── Technical names cleaned
    ├── Expected results improved
    └── Action descriptions improved
        │
        ▼
Quality Validation
    ├── Element name quality
    ├── Step completeness
    ├── Structure validation
    ├── Deduplication check
    └── Standards compliance (ISTQB/Gherkin)
```

### Requirement-to-Test Pipeline

```
Jira Story Input
    │
    ▼
Stage 1: RequirementContextBuilder
    ├── Parse acceptance criteria
    ├── Extract user story (As a/I want/So that)
    └── Build RequirementContext
    │
    ▼
Stage 2: SyntheticAppModel
    ├── Field/control inference from ACs
    ├── Validation rule extraction
    └── App model with pages/forms/fields
    │
    ▼
Stage 3: ScenarioSkeletonGenerator
    ├── Segment into logical scenarios
    ├── Detect variations (payee, frequency, etc.)
    ├── Build raw_steps for each scenario
    └── Infer intent (checkout, auth, search, etc.)
    │
    ▼
Stage 4: LLM Rewrite + Dedup
    ├── TestCaseRewriteService (OpenAI/Ollama)
    ├── Convert skeleton → polished test case
    ├── TestCaseDeduplicationService
    └── Jaccard similarity dedup (0.6 threshold)
    │
    ▼
Output: Polished, deduplicated test cases
```

---

## 8. Step Types Reference

### UI Actions

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `navigate` | Go to URL | `value` (URL) |
| `click` | Click element | `selector` |
| `input` | Type text | `selector`, `value` |
| `select` | Select dropdown option | `selector`, `value` |
| `hover` | Hover over element | `selector` |
| `scroll` | Scroll page/element | `value` (direction/amount) |
| `drag_drop` | Drag and drop | `selector` (source), `value` (target) |
| `slider` | Move slider | `selector`, `value` |
| `date_picker` | Pick date | `selector`, `value` |
| `keyboard` | Key press | `value` (key combo) |
| `frame_switch` | Switch iframe | `selector` (frame) |
| `new_tab` | Handle new tab | `value` (URL pattern) |
| `alert_handle` | Handle JS alert | `value` (accept/dismiss/text) |
| `multi_select` | Select multiple options | `selector`, `value` (array) |
| `smart_select` | AI-powered selection | `selector`, `value` |

### Verification

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `assert` | Assert condition | `selector`, `assertions[]` |
| `verify` | Soft verify | `selector`, `assertions[]` |
| `visual_compare` | Visual regression check | `value` (baseline name) |
| `computed_assert` | Computed value assertion | Expression, expected |
| `table_find` | Find row in table | `selector`, criteria |
| `table_extract` | Extract table data | `selector`, columns |
| `table_assert` | Assert table contents | `selector`, expected |

### Wait

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `wait` | Wait fixed time | `value` (ms) |
| `wait_for_element` | Wait for element | `selector`, timeout |
| `wait_for_text` | Wait for text | `value` (text), timeout |

### Data & Variables

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `extract` | Extract value from page | `selector`, `variable` |
| `extract_variable` | Extract to variable | `selector`, expression |
| `store_variable` | Set variable | `variable`, `value` |

### Logic & Control Flow

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `condition` | If/else branch | `expression`, nested steps |
| `loop` | Repeat N times | `count`, nested steps |
| `foreach` | Iterate data source | `dataSource`, nested steps |
| `module` | Call reusable module | `moduleId` |
| `custom` | Custom code | `value` (code) |

### Backend

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `api` | HTTP request | method, URL, headers, body |
| `graphql` | GraphQL query | query, variables |
| `db_query` | Database query | connection, SQL |
| `db_assert` | Assert DB result | connection, SQL, expected |

### Evidence

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `screenshot` | Capture screenshot | `value` (filename) |
| `note` | Add note | `value` (text) |
| `manual_step` | Manual instruction | `value` (instruction) |
| `checkpoint` | Named checkpoint | `value` (name) |
| `email_verify` | Verify email received | config object |
| `pdf_verify` | Verify PDF content | config object |
| `file_verify` | Verify file download | config object |

### Salesforce (Plugin)

| Step Type | Description | Key Fields |
|-----------|-------------|------------|
| `sf_connect` | Connect to Salesforce org | credentials |
| `sf_query` | Run SOQL query | `value` (SOQL) |
| `sf_assert` | Assert SF data | object, field, expected |
| `sf_navigate` | Navigate SF app | app, tab, record |
| `sf_metadata_assert` | Assert SF metadata | object, field config |
| `sf_login_as` | Login as user | username |
| `sf_create_record` | Create SF record | object, fields |

---

## 9. Configuration

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | AI generation, LLM rewrite, beautifier, gap analyzer | Required for AI-powered features |
| `OLLAMA_BASE_URL` | LLM rewrite fallback | Ollama server URL for local LLM |

### Test Management Service

| Setting | Default | Description |
|---------|---------|-------------|
| `baseUrl` | `https://qaone-production.up.railway.app` | Backend API base URL |
| Cache TTL | 30 seconds | In-memory cache duration |

### Test Builder Settings (per test case)

| Setting | Default | Description |
|---------|---------|-------------|
| `baseUrl` | Empty | Target application URL |
| `timeout` | 30000 | Default step timeout (ms) |
| `retries` | 0 | Retry count on failure |
| `parallelizable` | false | Can run in parallel suite |

### localStorage Keys Used (35+)

| Key Pattern | Purpose |
|-------------|---------|
| `unified_test_case` | Current test case autosave |
| `unified_test_case_${id}` | Individual test case storage |
| `test_cases` | All test cases array |
| `flowstral_test_cases` | Flowstral-generated test cases |
| `test_repository_folders` | Folder tree structure |
| `test_suites` | Suite definitions |
| `test_plans` | Test plans |
| `test_releases` | Release definitions |
| `test_defects` | Defect records |
| `reusable_modules` | Saved reusable modules |
| `test_schedules` | Schedule definitions |
| `automation_session` | Automation linking session |
| `recordForStep` | Re-record context for builder |
| `workflow_import_session` | Recording import context |
| `tm_*` | Test management service cache |

---

## 10. Known Gaps & TODOs

### Stubs / Placeholder Code

| Location | Issue |
|----------|-------|
| `ai_generation_api.py` `/ai/url-discover` | **Full placeholder** — returns hardcoded data with "coming soon" message |
| `ai_generation_api.py` `GET /ai/templates` | **TODO:** "Query database for templates" — currently returns empty/static data |
| `ai_generation_api.py` `/generate-tests-legacy` | **TODO:** "Fetch existing test cases from plan and use them as context" |
| `ai_generation_api.py` lines 368 & 951 | **Duplicate route:** `/ai/triage` defined twice |

### Dead Code

| Location | Issue |
|----------|-------|
| `requirement_to_testcase_api.py` lines 222-393 | `_deduplicate_test_cases_OLD` and helpers — superseded by `TestCaseDeduplicationService` but still in file (~170 lines) |

### Domain-Specific Limitations

| Component | Issue |
|-----------|-------|
| `variation_generator.py` | Hardcoded for banking/payments domain only (payee, frequency, end date variations). Needs generalization. |
| `test_case_deduplication_service.py` | Signature logic hardcoded for payee/frequency/end-date patterns. Needs generic domain support. |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **UnifiedWorkflowEditor (11.6K lines)** | Extremely large single component — should be refactored into sub-components |
| **TestRepository (7K lines)** | Same concern — monolithic page with inline tab implementations |
| **Triple-write storage** | Data is written to localStorage, PostgreSQL, and SQLite — can get out of sync |
| **ScheduleManager** | Client-side only scheduling (localStorage) — no backend scheduler to actually trigger runs |
| **TestSuiteManager** | Suite runs are simulated — no real backend execution orchestration |
| **HardeningService** | Entirely in-memory with simulated 90% pass rate — no real test execution |
| **EnterpriseTestRepository** | Runs tab is a placeholder. Limited functionality compared to TestRepository. |

---

*Last updated: 2026-02-20*
*Generated by code audit of the Flowstral test building feature.*
