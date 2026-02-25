# Feature: Test Execution & Runs
> Execute test cases through Playwright automation, manual step-by-step walkthroughs, or headless CI/CD pipelines — with real-time WebSocket progress, self-healing selectors, complex verifications (email/PDF/file), and failure classification.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Execution Engines](#7-execution-engines)
8. [Self-Healing & Failure Recovery](#8-self-healing--failure-recovery)
9. [Complex Verifications](#9-complex-verifications)
10. [Configuration](#10-configuration)
11. [Known Gaps & TODOs](#11-known-gaps--todos)

---

## 1. Overview

Test Execution is the runtime layer of Flowstral — it takes test cases built in the builder or recorded from the browser and runs them against the target application. Three execution modes exist:

| Mode | How | Where |
|------|-----|-------|
| **Automated** | Playwright browser automation via subprocess | Backend (Python or Node.js) |
| **Manual** | Step-by-step human execution with evidence capture | Frontend (TestCaseExecution page) |
| **CI/CD** | Headless execution with exit codes | Backend (TestRunnerService queue) |

**Key capabilities:**
- Real-time step progress via WebSocket
- Self-healing selectors (5-layer fallback, OCR last resort)
- Complex verifications: email (MS 365/Gmail), PDF, file downloads
- Failure classification for no-code UX
- Test run lifecycle management (create → start → execute → mark → complete)
- Test plans, suites, and scheduled runs

---

## 2. Architecture

### Execution Flow

```
Test Case (from Builder or Recording)
    │
    ├── Automated Execution
    │       │
    │       ▼
    │   TestExecutionService (1,810 lines)
    │       ├── Create temp test file
    │       ├── Install dependencies (npm/pip/browsers)
    │       ├── Run: npx playwright test (TS) or pytest (Python)
    │       ├── Self-healing on selector failure
    │       ├── WebSocket progress events
    │       └── Auto-defect creation on failure
    │
    ├── Manual Execution
    │       │
    │       ▼
    │   TestCaseExecution.tsx (1,223 lines)
    │       ├── Step-by-step walkthrough
    │       ├── Pass/Fail marking per step
    │       ├── Screenshot upload
    │       ├── Defect linking
    │       └── Execution history
    │
    └── Queue-Based Execution
            │
            ▼
        TestRunnerService (647 lines)
            ├── In-memory job queue
            ├── Worker loop
            ├── Database persistence
            └── Job lifecycle (submit → run → complete)
```

### Three Playwright Executors

| Executor | Lines | Strategy |
|----------|-------|----------|
| `PlaywrightExecutor` | 505 | Basic: generates Python script, runs via subprocess |
| `EnhancedPlaywrightExecutor` | 440 | 5-layer selector strategy (testid → role → text → CSS → ID) |
| `PlaywrightRunner` | 418 | Platform-aware: subprocess on Windows, async Playwright on Linux/Mac |

### Communication

| Channel | Purpose |
|---------|---------|
| `POST /automation/execute-test` | Execute Playwright test code |
| `POST /test-runs/{id}/execute-selected` | Execute selected cases in a run |
| `WS /test-runs/ws/{execution_id}` | Real-time step progress |
| `POST /test-runs/{id}/steps/{id}/mark` | Manual pass/fail marking |
| `POST /api/complex-verify/*` | Email/PDF/file verification |
| Electron IPC `playwrightRecorder.runTest()` | Desktop quick-run |

---

## 3. Frontend Code Audit

### Pages

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/test-management/pages/TestCaseExecution.tsx` | 1,223 | **Fully implemented** | Manual step-by-step execution with evidence capture, defect filing, execution history |
| `src/modules/test-management/pages/TestRuns.tsx` | 366 | **Fully implemented** | Test run list, create, execute via backend |
| `src/modules/test-management/pages/TestRunDetail.tsx` | 1,081 | **Fully implemented** | Run detail: step marking, screenshots, defects, comments, traceability |
| `src/modules/test-management/pages/CreateTestRun.tsx` | 280 | **Fully implemented** | Wizard step 1: name, plan, environment, branch, tags |
| `src/modules/test-management/pages/TestSuites.tsx` | 587 | **Fully implemented** | Suite CRUD with backend + localStorage fallback |
| `src/modules/test-management/pages/TestPlans.tsx` | 147 | **Fully implemented** | Plan list with AI expansion |
| `src/modules/test-management/pages/CreateTestPlan.tsx` | ~200 | **Fully implemented** | Create test plans |
| `src/modules/test-management/pages/TestPlanDetail.tsx` | ~300 | **Fully implemented** | Plan detail with progress tracking |
| `src/modules/test-management/pages/EditTestPlan.tsx` | ~200 | **Fully implemented** | Edit test plans |
| `src/modules/test-management/pages/ScheduledRuns.tsx` | 848 | **Frontend-only stub** | CRUD for schedules, but "Run Now" is simulated (`Math.random()`). No backend integration. |

### Libraries & Hooks

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/hooks/useExecutionWebSocket.ts` | 274 | **Fully implemented** | WebSocket hook for real-time progress (step_start, step_complete, self_healing, screenshot, log, execution_complete) |
| `src/modules/test-management/lib/test-execution-service.ts` | 195 | **Partial** | `runGeneratedTest()` calls backend. `convertTestCaseToCode()` is **hardcoded stub** (SauceDemo-specific). |
| `src/modules/test-management/lib/self-healing-service.ts` | 366 | **Partial** | Rule engine for failure analysis and fix suggestions. `executeHealingAction()` is **random stub** (`Math.random() > 0.3`). In-memory only. |
| `src/modules/recorder/lib/failureClassification.ts` | 182 | **Fully implemented** | Classifies Playwright/backend errors into user-friendly types for no-code UX |
| `src/modules/test-management/lib/results-ingestion-service.ts` | 179 | **Fully implemented** | localStorage-based results storage (keeps last 100). Per-project and per-org analytics. |

### Verification Components

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/test-management/components/verifications/ComplexVerificationService.ts` | ~100 | **Fully implemented** | Calls backend `/api/complex-verify/*` endpoints |
| `src/modules/test-management/components/verifications/EmailVerifyStepConfig.tsx` | ~150 | **Fully implemented** | Email verification step config UI |
| `src/modules/test-management/components/verifications/PDFVerifyStepConfig.tsx` | ~150 | **Fully implemented** | PDF verification step config UI |
| `src/modules/test-management/components/verifications/FileVerifyStepConfig.tsx` | ~150 | **Fully implemented** | File verification step config UI |

---

## 4. Backend Code Audit

### Routers

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/test_management/test_runs_api.py` | 1,123 | `/test-runs` | 15 (REST) + 1 (WS) | **Fully implemented** (dead code in create) |
| `backend/app/routers/test_management/automation_api.py` | 217 | `/automation` | 5 | **Fully implemented** |
| `backend/app/routers/test_management/complex_verifications.py` | 650 | `/api/complex-verify` | 10 | **Fully implemented** |

### Executor Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/executors/playwright_executor.py` | 505 | **Fully implemented** | Basic Playwright execution via subprocess with auto-healing fallback selectors |
| `backend/app/services/executors/playwright_executor_enhanced.py` | 440 | **Fully implemented** | Enhanced 5-layer selector strategy |
| `backend/app/services/executors/playwright_runner.py` | 418 | **Fully implemented** | Platform-aware runner (subprocess on Windows, async on Linux/Mac) |
| `backend/app/services/executors/test_runner_service.py` | 647 | **Fully implemented** | Queue-based job execution with DB persistence. `_get_artifacts()` returns empty (S3/MinIO stub). |
| `backend/app/services/executors/unified_runner_service.py` | 423 | **Fully implemented** | Routes to Playwright/pytest/k6/axe-core/ZAP based on test type. Supports Vault secret injection. |
| `backend/app/services/executors/test_executor_queue.py` | 150 | **Fully implemented** | In-memory job queue with worker pattern |
| `backend/app/services/executors/remote_grid_service.py` | 163 | **Config only** | Connection strings for Selenium Grid, Moon, BrowserStack, SauceLabs. Not consumed by executors. |
| `backend/app/services/executors/k6_executor.py` | 254 | **Fully implemented** | k6 performance test execution via subprocess |

### Automation Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/automation/test_execution_service.py` | 1,810 | **Fully implemented** | Core engine: temp files, dependency install, `npx playwright test` / `pytest`, self-healing, WebSocket events, auto-defect creation, code sanitization |
| `backend/app/services/automation/auto_healing_service.py` | 268 | **Code-gen real, learning stub** | Generates Playwright code with healing fallback chains. `learn_from_success()` logs but never persists. |
| `backend/app/services/automation/intelligent_self_healing.py` | 387 | **Fully implemented** | 10-strategy healing including OCR coordinate click as last resort |

### Complex Verification Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/complex_verifications/email_service.py` | 627 | **Fully implemented** | MS 365 (MSAL) + Gmail API. Wait/poll, assertions, OTP/link extraction |
| `backend/app/services/complex_verifications/pdf_service.py` | 570 | **Fully implemented** | PyPDF2/pdfplumber/PyMuPDF fallback chain. Text, tables, metadata, assertions |
| `backend/app/services/complex_verifications/file_service.py` | 668 | **Fully implemented** | CSV, Excel, JSON, XML, image verification. JSONPath extraction. |

### Scheduler Service

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/core/scheduler_service.py` | 225 | **Partial** | Cron parsing works, but `trigger_scheduled_run` calls nonexistent methods. Schedules are in-memory only. |

---

## 5. API Endpoints

### Test Runs (`/test-runs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/test-runs` | List all test runs |
| GET | `/test-runs/{run_id}` | Get run detail with cases, steps, artifacts, defects |
| POST | `/test-runs` | Create test run with test cases and steps |
| PUT | `/test-runs/{run_id}` | Update run name/status/times |
| POST | `/test-runs/{run_id}/start` | Change status to running |
| POST | `/test-runs/{run_id}/execute-selected` | Execute selected test cases |
| POST | `/test-runs/{run_id}/steps/{step_id}/mark` | Mark step pass/fail (auto-completes run) |
| POST | `/test-runs/{run_id}/steps/{step_id}/screenshot` | Upload screenshot to step |
| POST | `/test-runs/{run_id}/screenshot` | Upload global screenshot |
| POST | `/test-runs/{run_id}/steps/{step_id}/link-defect` | Link defect to step |
| POST | `/test-runs/{run_id}/link-defect` | Link defect to run |
| DELETE | `/test-runs/{run_id}` | Delete test run |
| POST | `/test-runs/{run_id}/comments` | Add comment |
| GET | `/test-runs/{run_id}/comments` | Get comments (filterable) |
| WS | `/test-runs/ws/{execution_id}` | Real-time execution progress |

### Automation (`/automation`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/automation/convert-script` | Convert Selenium/Cypress/WebDriverIO to Playwright |
| POST | `/automation/execute-test` | Execute Playwright test code |
| POST | `/automation/analyze-locator` | Generate optimal locator with fallback chain |
| POST | `/automation/generate-auto-healing-code` | Generate Playwright code with auto-healing |
| GET | `/automation/health` | Health check |

### Complex Verifications (`/api/complex-verify`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/complex-verify/email/initialize` | Init email service (MS 365 or Gmail) |
| POST | `/api/complex-verify/email/verify` | Wait for and verify email |
| POST | `/api/complex-verify/email/check-latest` | Check latest N emails (debug) |
| POST | `/api/complex-verify/pdf/verify` | Verify PDF from path/URL/base64 |
| POST | `/api/complex-verify/pdf/verify-upload` | Verify uploaded PDF file |
| POST | `/api/complex-verify/pdf/parse` | Parse PDF and return content |
| POST | `/api/complex-verify/file/verify` | Verify downloaded file (CSV/Excel/JSON/XML/image) |
| POST | `/api/complex-verify/file/verify-upload` | Verify uploaded file |
| GET | `/api/complex-verify/file/parse-csv` | Parse CSV preview |
| GET | `/api/complex-verify/capabilities` | Get installed libraries and assertions |

---

## 6. UI Walkthrough

### Manual Test Execution

1. Navigate to **Test Execution** from the sidebar.
2. Select a test case from the list.
3. Click **Start Execution** — the first step is highlighted.
4. Read the step instruction, perform the action on the application.
5. Click **Pass** or **Fail** for the step.
6. Optionally upload a screenshot as evidence.
7. Optionally link a defect to the step.
8. The next step is auto-highlighted.
9. When all steps are marked, the run is auto-completed.

### Automated Test Run

1. Navigate to **Test Runs** → **Create Test Run**.
2. Enter name, select environment, choose test cases.
3. Click **Execute** — backend runs Playwright tests.
4. Watch real-time progress via WebSocket (steps highlight green/red).
5. View results in **Test Run Detail** — step-by-step with screenshots and logs.

### WebSocket Progress Messages

| Message Type | Fields | Meaning |
|-------------|--------|---------|
| `step_start` | `step_index`, `step_name` | Step execution starting |
| `step_complete` | `step_index`, `status`, `duration`, `screenshot` | Step finished |
| `self_healing` | `step_index`, `original_selector`, `healed_selector` | Selector was auto-healed |
| `screenshot` | `step_index`, `image` (base64) | Screenshot captured |
| `log` | `level`, `message` | Log message |
| `execution_complete` | `status`, `total`, `passed`, `failed`, `duration` | Run finished |

---

## 7. Execution Engines

### TestExecutionService (Core Engine — 1,810 lines)

The most substantial backend service. Handles the full lifecycle:

1. **Code sanitization:** Removes Visual Locator artifacts, duplicate `goto()` calls, fixes unclosed strings, validates syntax
2. **Language detection:** Auto-detects TypeScript vs Python from code patterns
3. **Dependency installation:** Runs `npm install` / `pip install` and `npx playwright install chromium`
4. **Execution:** `npx playwright test` (TS) or `pytest` (Python) via subprocess
5. **Self-healing:** On selector failure, extracts failed selector, attempts healing, retries
6. **WebSocket events:** Broadcasts step progress in real time
7. **Auto-defect:** Creates defect records on failure

### UnifiedRunnerService

Routes execution to the right engine:

| Test Type | Runner | Tool |
|-----------|--------|------|
| UI | PlaywrightExecutor | Playwright |
| API | APIRunner | pytest |
| Performance | K6Executor | k6 |
| Accessibility | AccessibilityRunner | axe-core |
| Security | (configured) | ZAP |

---

## 8. Self-Healing & Failure Recovery

### Backend Auto-Healing (5-layer strategy)

When a selector fails during execution:

1. **TestID:** Try `data-testid` attribute
2. **Role:** Try `getByRole()` with accessible name
3. **Text:** Try `getByText()` with visible text
4. **CSS:** Try CSS selector
5. **ID:** Try `#id` selector

### Intelligent Self-Healing (10 strategies)

The `IntelligentSelfHealing` service generates code with cascading fallbacks:

1. Original selector
2. ARIA label
3. Text content
4. Placeholder
5. Title attribute
6. Nearby label
7. Parent context
8. Similar attributes
9. Visual position
10. **OCR coordinate click** (last resort)

### Frontend Failure Classification

The `failureClassification.ts` module converts raw Playwright errors into user-friendly types:

| Error Pattern | Classification | User Message |
|--------------|---------------|--------------|
| `waiting for selector` | Element Not Found | The element wasn't found on the page |
| `timeout` | Timeout | The action took too long |
| `navigation` | Navigation Error | Page didn't load correctly |
| `strict mode violation` | Multiple Matches | Multiple elements matched |
| `detached from DOM` | Stale Element | Element was removed from the page |

---

## 9. Complex Verifications

### Email Verification

**Providers:** Microsoft 365 (MSAL) and Gmail API

**Flow:**
1. Initialize with credentials (`POST /email/initialize`)
2. Perform action that triggers email
3. Verify email arrived (`POST /email/verify`) — polls inbox with timeout
4. Run assertions: subject contains, body contains, from matches, attachment exists, OTP extraction, link extraction

### PDF Verification

**Libraries:** PyPDF2, pdfplumber, PyMuPDF (multi-library fallback)

**Capabilities:** Text extraction, table extraction, metadata (author, title, pages), assertions on content/structure

### File Verification

**Formats:** CSV, Excel (openpyxl), JSON, XML (xmltodict), images (Pillow)

**Capabilities:** File existence, size, format validation, content assertions, JSONPath extraction, CSV column/row validation

---

## 10. Configuration

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | test_runs_api | PostgreSQL connection for test run persistence |
| `OPENAI_API_KEY` | AI triage, self-healing (Vision layer) | Optional server-level fallback for AI features |
| `ANTHROPIC_API_KEY` | AI failure analysis (Claude provider) | Optional server-level fallback |
| `ENCRYPTION_KEY` | BYOK key encryption | Required for Fernet encryption of user-provided API keys |

### AI Configuration (v3.14.0 — BYOK)

AI-powered execution features (self-healing Vision layer, AI failure explanation, auto-fix) are **OFF by default**:

- **Self-Healing Layers 1-2** (Knowledge + Deterministic): Always available, no AI key required
- **Self-Healing Layer 3** (Vision AI): Requires OpenAI key (BYOK or server env var)
- **Self-Healing Layer 4** (OCR): Requires Tesseract, no AI key needed
- **AI Failure Explanation**: Requires configured AI key
- **TestResultsDialog gates (v3.14.0)**: Fix/Flag/Auto-Fix All buttons disabled when AI not configured; Manual button always available; "Why did this fail?" link hidden when no AI

Key resolution chain: BYOK key (Settings > AI tab) → server env var → disabled. Non-AI execution (Playwright automation, manual walkthrough, CI/CD) works fully without any API key.

### Test Runner Service

| Setting | Default | Description |
|---------|---------|-------------|
| Job queue | In-memory | No persistence across restarts |
| Artifact storage | Empty (stub) | Planned for S3/MinIO |

### Remote Grid Config

| Provider | Config |
|----------|--------|
| Selenium Grid | `grid_url`, browser, version |
| Moon (K8s) | `moon_url`, browser, version, namespace |
| BrowserStack | `username`, `access_key`, OS, browser |
| SauceLabs | `username`, `access_key`, platform, browser |

---

## 11. HealingOrchestrator (v3.10.1+)

**File:** `backend/app/services/automation/healing_orchestrator.py`

Chains all healing services with early-return-on-first-success:

| Layer | Service | Speed | Requires |
|-------|---------|-------|----------|
| 1 | `SelfHealingController.get_healing_suggestions()` | 0ms | Nothing (JSON lookup) |
| 2 | `_generate_alternative_selectors()` | 0ms | Nothing (string transforms) |
| 3 | `VisionSelfHealingService.heal_broken_selector()` | 2-5s | Screenshot + OPENAI_API_KEY |
| 4 | OCR `find_text_in_screenshot()` | 500ms | Screenshot + Tesseract |

- Budget-controlled: max 3 AI calls per run
- Records successes for future runs (knowledge reuse)
- WebSocket events: `healing_chain_start`, `healing_layer_attempt`, `healing_chain_complete`
- Heartbeat/pong keep-alive: 25s interval

---

## 12. Known Gaps & TODOs

### Stubs & Incomplete

| Location | Issue |
|----------|-------|
| `ScheduledRuns.tsx` | **Frontend-only simulation** — "Run Now" uses `Math.random()`. No backend scheduler integration. |
| `scheduler_service.py` | Calls `create_test_run()` and `execute_test_run()` which **don't exist** on TestExecutionService. Schedules are in-memory only. |
| `test-execution-service.ts` `convertTestCaseToCode()` | **Hardcoded stub** generating SauceDemo-specific Playwright code |
| `self-healing-service.ts` `executeHealingAction()` | **Random stub** (`Math.random() > 0.3`) |
| `auto_healing_service.py` `learn_from_success()` | Logs only, never persists — learning loop is not closed |
| `test_runner_service.py` `_get_artifacts()` | Returns empty — stub for S3/MinIO storage |
| `remote_grid_service.py` | Provides config but is **never consumed** by any executor |

### Dead Code

| Location | Issue |
|----------|-------|
| `test_runs_api.py` `create_test_run` | Lines 441-572 are **unreachable** — early return on line 440 before Postgres insert logic |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **3 Playwright executors** | `playwright_executor.py`, `playwright_executor_enhanced.py`, `playwright_runner.py` have overlapping functionality |
| **Mixed DB patterns** | `test_runs_api.py` uses both `get_postgres_pool()` and `get_database_client()` without consistent error handling |
| **Sync subprocess in async** | `k6_executor.py` uses `subprocess.run()` in an async method, blocking the event loop |

---

*Last updated: 2026-02-20*
*Generated by code audit of the Flowstral test execution feature.*
