# Feature: AI Testing & Flowpilot
> AI-powered testing agents -- natural language test generation, autonomous exploration, application mapping, and self-healing test execution via real Playwright browser automation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Agent Deep Dive](#7-agent-deep-dive)
8. [LLM Integration](#8-llm-integration)
9. [Configuration](#9-configuration)
10. [BYOK AI Integration (v3.14.0)](#10-byok-ai-integration-v3140)
11. [Known Gaps & TODOs](#11-known-gaps--todos)

---

## 1. Overview

AI Testing is Flowstral's highest-level automation capability. Instead of recording interactions or building tests manually, users describe what they want to test in plain English and the platform handles everything -- browser launch, DOM scanning, element resolution, test execution, and self-healing when selectors break.

The module ships two user-facing pages:

| Page | Route | Purpose |
|------|-------|---------|
| **AI Testing** | `/ai-testing` | Single-input NLP testing -- type a description, get executed tests |
| **Flowpilot** | `/flowpilot` | 4-agent hub -- Generator, Explorer, Flowmap, Self-Healer |

Flowpilot sub-routes (`/flowpilot/explorer`, `/flowpilot/generator`, `/flowpilot/self-healer`) all render the same `FlowpilotPage` component with the corresponding agent pre-selected.

**Who it's for:** QA testers who want to generate and execute tests from natural language without recording or scripting, and teams who need autonomous exploration to discover defects across an entire application.

**What makes it different from competitors:**

| Competitor | Approach | Flowstral Advantage |
|-----------|----------|---------------------|
| TestRigor | Scans elements, generates their own locators | Scan real DOM, extract the SAME selectors the Recorder uses |
| Blinq.io | Records but no AI generation | NLP-to-test without any recording |
| Testers.ai | Crawls but no deep DOM extraction | Real DOM scan + 10+ fallback selector strategies + Vision AI |

**Version:** v3.14.0+
**Last updated:** 2026-02-25

---

## 2. Architecture

### Data Flow

```
User (plain English instruction)
    |
    v
FlowpilotPage.tsx / AIChatTesting.tsx
    |
    |--- Generator/Self-Healer: POST /api/ai-testing/start (SSE stream)
    |       |
    |       v
    |   AgenticOrchestrator v3.0
    |       |
    |       +-- Phase 1: _parse_instruction() -- NLP + AI extract URL, actions, creds
    |       +-- Phase 2: _launch_browser()    -- Playwright sync_playwright via ThreadPool
    |       +-- Phase 3: _navigate_and_scan() -- Inject PAGE_SCANNER_JS, extract all elements
    |       +-- Phase 4: _build_test_case()   -- Match user intent to scanned elements
    |       +-- Phase 5: _execute_test()      -- Execute with 3-layer auto-heal
    |       +-- Phase 6: _cleanup()           -- Close browser, emit complete event
    |       |
    |       v
    |   SSE events: phase, intent, step, screenshot, test_complete, complete, error
    |
    |--- Explorer: POST /api/blaze/start + GET /api/blaze/status/{id} (polling)
    |       |
    |       v
    |   BlazeExplorer (backend/app/services/exploration/blaze_explorer.py)
    |       +-- Autonomous crawling (Playwright headless)
    |       +-- Defect detection: broken links, JS errors, a11y, security, perf
    |       +-- No AI dependency -- purely deterministic crawl
    |       |
    |       v
    |   JSON: session_id, status, progress, pages_visited, defects_found, defects[]
    |
    |--- Flowmap: POST /api/exploration/start (REST, synchronous)
            |
            v
        AutonomousExplorer + CapabilityMapBuilder
            +-- BFS site crawl (configurable depth/max_pages)
            +-- Page element extraction (headings, buttons, forms, links, entities)
            +-- LLM-enhanced analysis via CapabilityMapBuilder
            +-- Defect detection via DefectDetector
            |
            v
        JSON: base_url, total_pages, pages[], llm_analysis, total_defects
```

### Frontend-Backend Communication

| Agent | Protocol | Direction | Cancellation |
|-------|----------|-----------|-------------|
| Generator | SSE (Server-Sent Events) | Frontend reads stream from `POST /api/ai-testing/start` | `AbortController.abort()` |
| Self-Healer | SSE | Frontend reads stream from `POST /api/ai-testing/rerun-with-fix` | `AbortController.abort()` |
| Explorer | REST + Polling | `POST /api/blaze/start` then `GET /api/blaze/status/{id}` every 2s | `clearInterval()` on poll ref |
| Flowmap | REST (synchronous) | `POST /api/exploration/start`, waits for full response | N/A (awaited fetch) |

### Module Boundary

| Layer | Path |
|-------|------|
| Frontend module | `src/modules/ai-testing/` |
| Backend routers | `backend/app/routers/ai/ai_testing.py`, `backend/app/routers/exploration/blaze_api.py`, `backend/app/routers/exploration/exploration_api.py` |
| Backend services | `backend/app/services/ai_testing/`, `backend/app/services/exploration/`, `backend/app/services/llm/` |

---

## 3. Frontend Code Audit

### Module Structure

```
src/modules/ai-testing/
  index.ts                     # Barrel exports (5 items)
  pages/
    AITestingPage.tsx           # ~78 lines  -- Landing page with 4-step intro cards + AIChatTesting
    FlowpilotPage.tsx           # ~1,044 lines -- 4-agent hub with real backend integration
  components/
    AIChatTesting.tsx           # ~729 lines -- NLP input, SSE stream reader, results, chat panel
    AIExplorerAgent.tsx         # ~693 lines -- Electron IPC-based autonomous exploration dialog
    AIFlowExplorer.tsx          # ~960 lines -- 5-tab Electron IPC-based app mapping + goal agent
```

### File: `index.ts` (5 exports)

```typescript
export { default as AITestingPage } from './pages/AITestingPage';
export { default as FlowpilotPage } from './pages/FlowpilotPage';
export { default as AIChatTesting } from './components/AIChatTesting';
export { default as AIExplorerAgent } from './components/AIExplorerAgent';
export { default as AIFlowExplorer } from './components/AIFlowExplorer';
```

### File: `AITestingPage.tsx` (~78 lines)

Simple landing page that renders:
- Header with Sparkles icon and "AI Testing" title
- 4-step horizontal card row: Describe, Explore, Test, Report
- Embeds `<AIChatTesting />` as the main interactive component
- Footer badge: "Powered by AI vision + intelligent test generation"

No state, no side effects -- pure presentation wrapper around `AIChatTesting`.

### File: `FlowpilotPage.tsx` (~1,044 lines)

The primary Flowpilot hub. Contains all agent logic inline (no sub-components).

**State:**

| Variable | Type | Purpose |
|----------|------|---------|
| `selectedAgent` | Agent config object | Currently selected agent (default: Generator) |
| `goal` | `string` | Natural language instruction text |
| `targetUrl` | `string` | Target URL for testing |
| `isProcessing` | `boolean` | Whether any agent is currently executing |
| `currentPhase` | `string` | Current execution phase label |
| `currentStep` | `string` | Current step description |
| `progress` | `number` | 0-100 progress value |
| `error` | `string \| null` | Error message |
| `testResults` | `TestResult[]` | Generator/Self-Healer results |
| `liveScreenshot` | `string \| null` | Base64 screenshot from SSE |
| `expandedTest` | `string \| null` | Which test result card is expanded |
| `explorationResult` | `ExplorationResult \| null` | Explorer agent results |
| `flowmapResult` | `FlowmapResult \| null` | Flowmap agent results |
| `abortControllerRef` | `Ref<AbortController>` | SSE cancellation |
| `pollIntervalRef` | `Ref<ReturnType<typeof setInterval>>` | Explorer polling cleanup |

**Agent definitions (hardcoded array):**

| `id` | `name` | `icon` | `color` | `endpoint` |
|------|--------|--------|---------|-----------|
| `generator` | Generator | Sparkles | amber | `ai-testing` |
| `explorer` | Explorer | Compass | violet | `blaze` |
| `flowmap` | Flowmap | Map | fuchsia | `exploration` |
| `self-healer` | Self-Healer | RefreshCw | emerald | `ai-testing` |

**Key functions:**

| Function | What it does |
|----------|-------------|
| `streamSSE(url, body)` | Generic SSE reader -- POSTs to URL, reads `data: {...}\n\n` chunks, calls `handleSSEEvent` |
| `handleSSEEvent(event)` | Dispatches on `event.type`: phase, intent, step, screenshot, test_complete, plan, complete, error |
| `executeGenerator()` | Builds instruction string, calls `streamSSE` to `/api/ai-testing/start` |
| `executeSelfHealer()` | If prior failed tests exist, calls `/api/ai-testing/rerun-with-fix`; otherwise falls back to `/start` |
| `executeExplorer()` | POSTs to `/api/blaze/start`, then polls `/api/blaze/status/{id}` every 2 seconds |
| `executeFlowmap()` | POSTs to `/api/exploration/start`, awaits full response |
| `handleStop()` | Aborts SSE controller and/or clears polling interval |
| `saveAsTestCase(test)` | POSTs test to `/test-cases` endpoint for persistence |
| `canExecute` | Computed: requires `goal` for Generator/Self-Healer, `targetUrl` for Explorer/Flowmap |

**UI sections:**
1. Agent selection sidebar (left, 1/4 width) -- 4 cards with icon, name, description, feature badges
2. Goal input area -- URL field always shown; Textarea for Generator/Self-Healer only
3. Processing status card -- animated phase indicator, progress bar, live screenshot
4. Error display -- red card with AlertCircle icon
5. Test results (Generator/Self-Healer) -- expandable cards with per-step detail, Save/Re-run buttons
6. Exploration results (Explorer) -- stats grid (pages/defects/duration), defect cards with severity badges
7. Flowmap results -- page list with button/form/entity badges, LLM analysis section

### File: `AIChatTesting.tsx` (~729 lines)

Standalone NLP testing component (used by AITestingPage, can be embedded anywhere).

**Key differences from FlowpilotPage:**
- Only supports Generator + Self-Healer (no Explorer/Flowmap)
- Has a chat panel for failure debugging (`askAboutFailure` calls `/api/ai-testing/explain`)
- "Download Report" button exports JSON report
- Example prompts shown when input is empty
- `rerunWithFix` replaces the failed test in-place in the results array

**State unique to this component:**
- `chatInput` / `chatMessages` -- chat panel for debugging
- `isRerunning` -- tracks which test is being re-run
- `examplePrompts` -- 5 hardcoded example instructions

**API calls:**
- `POST /api/ai-testing/start` -- SSE stream for initial test execution
- `POST /api/ai-testing/rerun-with-fix` -- SSE stream for re-run with AI fixes
- `POST /api/ai-testing/explain` -- REST call for failure analysis

### File: `AIExplorerAgent.tsx` (~693 lines)

Dialog component for Electron IPC-based autonomous exploration. **Requires Electron desktop app** -- gracefully degrades in browser with error messages.

**IPC channels used:**
- `ai-explorer-start` -- invoke to start exploration
- `ai-explorer-stop` -- invoke to stop
- `ai-explorer-progress` -- listen for progress events
- `ai-explorer-action` -- listen for individual action results
- `ai-explorer-test-discovered` -- listen for auto-generated test cases
- `ai-explorer-error` -- listen for errors

**Features:**
- Configurable start URL and max actions (10-100 slider)
- Test data configuration panel (username, email, password, first name, last name, phone, search, 2 custom fields)
- Split view: Live action log (left) + Discovered tests (right)
- Progress bar with action count
- Save discovered tests via `onSaveTests` callback
- API key from AIContext; supports `***env***` marker for backend-held keys in Electron

### File: `AIFlowExplorer.tsx` (~960 lines)

Dialog component for Electron IPC-based full app mapping. **Requires Electron desktop app.**

**5 tabs:**

| Tab | Purpose |
|-----|---------|
| Goal Agent | NLP goal input + step execution viewer |
| Navigation Graph | Discovered pages (PageNode) + navigation paths (GraphEdge) |
| Tests | Auto-generated test cases from exploration |
| Manual to Auto | Paste manual test description, convert to automated steps |
| Logs | Timestamped log viewer |

**IPC channels used:**
- `flow-explorer-start` / `flow-explorer-stop` -- exploration lifecycle
- `flow-explorer-progress` / `flow-explorer-page-discovered` / `flow-explorer-test-generated` / `flow-explorer-error` -- event listeners
- `goal-agent-execute` / `goal-agent-stop` -- goal execution lifecycle
- `goal-agent-step` -- step-by-step progress events
- `flow-explorer-automate-manual` -- manual-to-automation conversion

**Key types:**

```typescript
interface PageNode {
  id: string; url: string; title: string;
  elementCount: number; hiddenElementCount: number;
  navigationTriggerCount: number; screenshot?: string; fullyExplored: boolean;
}

interface GraphEdge {
  id: string; from: string; to: string;
  trigger: string; action: string; stepCount: number;
}

interface Coverage {
  pagesDiscovered: number; pagesFullyExplored: number;
  elementsDiscovered: number; hiddenElementsFound: number;
  navigationPathsFound: number; flowsGenerated: number;
  assertionsCreated: number;
}
```

---

## 4. Backend Code Audit

### AI Testing Services

**Directory:** `backend/app/services/ai_testing/` (5 files)

| File | Lines | Purpose |
|------|-------|---------|
| `__init__.py` | 35 | Module init -- exports `create_orchestrator` (v2.0 by default), keeps v1.0 as `create_legacy_orchestrator` |
| `agentic_orchestrator.py` | 729 | **AgenticOrchestrator v3.0** -- DOM-first, scanner-based test execution |
| `ai_testing_orchestrator.py` | 1,175 | **AITestingOrchestrator v1.0** (legacy) -- CSS-selector based, kept for backward compatibility |
| `human_element_finder.py` | 602 | **HumanElementFinder** -- TestRigor-style element resolution (label, role, text, placeholder, CSS, Vision AI) |
| `page_scanner.py` | 489 | **PageScanner** -- injects JS into browser to extract all interactive elements with full selector data |

### Exploration Services

**Directory:** `backend/app/services/exploration/` (22 files)

Key files for AI Testing integration:

| File | Purpose |
|------|---------|
| `blaze_explorer.py` (700 lines) | **BlazeExplorer** -- autonomous Playwright crawling, defect detection without AI dependency |
| `autonomous_explorer.py` | **AutonomousExplorer** -- BFS site crawling with configurable depth, page element extraction |
| `capability_map_builder.py` | **CapabilityMapBuilder** -- builds capability maps from exploration results, LLM-enhanced analysis |
| `defect_detector.py` | **DefectDetector** -- identifies broken links, JS errors, a11y issues, security problems |
| `defect_detector_sync.py` | Synchronous wrapper for defect detection |
| `defect_storage.py` | **DefectStorage** -- persists defects to PostgreSQL |
| `requirement_comparator.py` | **RequirementComparator** -- compares capability maps against requirements |
| `llm_application_analyzer.py` | LLM-based application analysis |
| `test_case_generator.py` | Auto-generates test cases from exploration results |
| `exploration_reporting.py` | Generates exploration reports |

### LLM Services

**Directory:** `backend/app/services/llm/` (19 files)

Key files for AI Testing:

| File | Purpose |
|------|---------|
| `model_gateway.py` | **ModelGateway** -- unified LLM access layer, routes to OpenAI/Anthropic/Ollama |
| `openai_service.py` | OpenAI gpt-4o-mini integration (primary active provider) |
| `cached_claude_service.py` | Anthropic Claude with prompt caching (active for dev) |
| `ollama_service.py` | Ollama/vLLM local inference (disabled) |
| `failure_analyzer.py` | AI-powered test failure analysis |
| `llm_service.py` | Base LLM service interface |

### AI Routers

**Directory:** `backend/app/routers/ai/` (7 files)

| File | Lines | Prefix | Purpose |
|------|-------|--------|---------|
| `ai_testing.py` | 358 | `/api/ai-testing` | 4 endpoints: start (SSE), status, explain, rerun-with-fix |
| `ai_generation_api.py` | 2,858 | `/ai` | 28 endpoints for test generation, triage, requirement ingestion |
| `ai_automation_api.py` | 474 | `/ai-automation` | Element resolution, failure analysis, selector suggestions |
| `ai_enhancements_api.py` | 867 | `/api/ai/enhancements` | Auto-fix, false positives, flaky detection, manual assist |
| `agents_api.py` | 95 | `/agents` | Agent registry and health checks |
| `vision_healing_api.py` | -- | `/api/vision` | Vision-based selector healing |
| `llm_api.py` | -- | `/api/llm` | LLM gateway endpoints |
| `ai_key_resolver.py` | -- | (shared helper) | `resolve_ai_key()` and `require_ai_key()` for all AI routers (v3.14.0+) |

### AI Settings Router (v3.14.0+)

**Directory:** `backend/app/routers/platform/`

| File | Lines | Prefix | Purpose |
|------|-------|--------|---------|
| `ai_settings_api.py` | -- | `/api/ai/settings` | 7 endpoints: settings CRUD, key management, connection testing, provider listing, usage stats |

### Exploration Routers

**Directory:** `backend/app/routers/exploration/` (4+ files)

| File | Lines | Prefix | Purpose |
|------|-------|--------|---------|
| `blaze_api.py` | 182 | `/api/blaze` | Autonomous crawling: start, start-sync, status, stop, sessions, health |
| `exploration_api.py` | 397 | `/api/exploration` | App mapping: start, status, compare-requirements, runs, health |
| `nexus_exploratory_api.py` | -- | `/api/nexus` | Nexus exploratory testing |

---

## 5. API Endpoints

### AI Testing Router (`/api/ai-testing`)

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| `POST` | `/api/ai-testing/start` | `{ instruction: string, project_id?: string }` | SSE stream | Start AI testing from NLP instruction |
| `GET` | `/api/ai-testing/status` | -- | `{ status, message }` | Health check |
| `POST` | `/api/ai-testing/explain` | `{ test_name, failed_step?, all_steps?, screenshot? }` | `{ explanation, possible_causes[], suggested_fixes[], ai_analysis? }` | AI failure explanation |
| `POST` | `/api/ai-testing/rerun-with-fix` | `{ original_instruction, failed_test: { name, steps, screenshot } }` | SSE stream | Re-run with AI-generated selector fixes |

### Blaze Router (`/api/blaze`)

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| `POST` | `/api/blaze/start` | `{ url, max_pages?, max_duration_minutes?, headless?, test_types? }` | `{ session_id, status, message }` | Start async exploration |
| `POST` | `/api/blaze/start-sync` | Same as above | Full result object | Start sync exploration (waits for completion) |
| `GET` | `/api/blaze/status/{session_id}` | -- | `{ session_id, status, progress, current_activity, pages_visited, defects_found, defects[], duration }` | Poll session status |
| `POST` | `/api/blaze/stop/{session_id}` | -- | `{ message, session_id }` | Stop running session |
| `GET` | `/api/blaze/sessions` | -- | `{ sessions[] }` | List all active sessions |
| `GET` | `/api/blaze/health` | -- | `{ status, service, active_sessions }` | Health check |

### Exploration Router (`/api/exploration`)

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| `POST` | `/api/exploration/start` | `{ base_url, max_depth?, max_pages?, allowed_domains?, excluded_paths?, login_flow?, headless?, screenshot? }` | `{ status, exploration_run_id, capability_map_id, exploration_result, capability_map, defects_detected, defects_saved }` | Start app mapping |
| `GET` | `/api/exploration/health` | -- | `{ status, table_exists, database_info, message }` | Health check with DB validation |

### AI Settings Router (`/api/ai/settings`) — v3.14.0+

| Method | Path | Request | Response | Purpose |
|--------|------|---------|----------|---------|
| `GET` | `/api/ai/settings` | -- | `{ enabled, provider, model, features, has_key, has_anthropic_key }` | Get org AI settings |
| `PUT` | `/api/ai/settings` | `{ enabled?, provider?, model?, features? }` | `{ status, settings }` | Update AI settings |
| `POST` | `/api/ai/settings/key` | `{ provider, api_key }` | `{ status, message }` | Store BYOK API key (Fernet-encrypted) |
| `DELETE` | `/api/ai/settings/key/{provider}` | -- | `{ status, message }` | Remove stored key |
| `POST` | `/api/ai/settings/test` | `{ provider?, api_key? }` | `{ status, provider, model, latency_ms }` | Test connection with stored/provided key |
| `GET` | `/api/ai/settings/providers` | -- | `{ providers[] }` | List providers with key configuration status |
| `GET` | `/api/ai/settings/usage` | -- | `{ period, total_calls, total_tokens, by_feature, budget }` | Get current period usage stats |

### SSE Event Types (Generator / Self-Healer)

| Event `type` | Fields | When emitted |
|-------------|--------|-------------|
| `phase` | `phase`, `message` | Phase transition (understanding, preparing, exploring, planning, executing, complete) |
| `intent` | `data: { url, actions, app_type }` | After instruction parsing |
| `step` | `message` | During execution, per-action updates |
| `screenshot` | `screenshot` (base64 PNG) | Live browser screenshot captured |
| `test_complete` | `result: TestResult` | Individual test finished |
| `plan` | `tests` (count) | After planning phase |
| `complete` | `data: { total, passed, failed, healed_steps }` | All testing done |
| `error` | `error` (string) | Fatal error |
| `fix_applied` | `message` | Self-Healer applied a selector fix (rerun-with-fix only) |

---

## 6. UI Walkthrough

### AITestingPage (`/ai-testing`)

1. User sees centered page with Sparkles header, 4-step explanation cards
2. Below cards: large textarea with placeholder examples
3. Quick example buttons appear when input is empty
4. User types instruction (e.g., "Test login on https://myapp.com with admin/password123")
5. Clicks "Start AI Testing" -- progress bar appears with live phase indicator
6. SSE events stream in: phase labels, step descriptions, live screenshot
7. When tests complete, result cards appear (green/red) -- click to expand and see per-step detail
8. Failed tests show "Why did this fail?" and "Re-run with AI fix" buttons
9. Chat panel appears below results for debugging conversation

### FlowpilotPage (`/flowpilot`)

1. Left sidebar shows 4 agent cards -- Generator (amber), Explorer (violet), Flowmap (fuchsia), Self-Healer (emerald)
2. Clicking an agent selects it and shows feature badges
3. Main area changes based on selected agent:
   - **Generator / Self-Healer:** URL input + NLP textarea + "Execute with {Agent}" button
   - **Explorer / Flowmap:** URL input only (required) + "Execute with {Agent}" button
4. During execution: progress bar with animated brain icon, live screenshot viewer
5. Results vary by agent:
   - **Generator:** Expandable test result cards with pass/fail per step, selector method badges, healed step indicators
   - **Self-Healer:** Same as Generator, but includes prior failed test info for enhanced healing
   - **Explorer:** Stats grid (Pages Visited, Defects Found, Duration) + defect cards with severity badges (critical/high/medium)
   - **Flowmap:** Page list with button/form/entity badges + LLM analysis section (blue card)
6. Save as Test Case button on each test result -- persists to `/test-cases` endpoint
7. "Re-run with Healer" button on failed tests -- switches to Self-Healer agent

---

## 7. Agent Deep Dive

### Generator Agent

**Purpose:** Take a plain English instruction and produce real, executed test results.

**Backend:** `AgenticOrchestrator` v3.0 (`backend/app/services/ai_testing/agentic_orchestrator.py`, 729 lines)

**6-Phase Execution:**

| Phase | Name | What Happens |
|-------|------|-------------|
| 1 | Understanding | `_parse_instruction()` -- regex extracts URL and credentials from text; AI (`gpt-4-turbo-preview`) parses complex instructions into action array; pattern-based fallback if no AI key |
| 2 | Preparing | `_launch_browser()` -- launches Playwright Chromium via `sync_playwright` in ThreadPoolExecutor |
| 3 | Exploring | `_navigate_and_scan()` -- navigates to URL, injects `PAGE_SCANNER_JS`, extracts all interactive elements with full selector objects (id, name, role, ariaLabel, testId, placeholder, CSS) |
| 4 | Planning | `_build_test_case()` -- matches parsed actions to scanned elements using `match_element()`, builds executable `TestCaseResult` with `StepResult` objects |
| 5 | Executing | `_execute_test()` -- executes each step using `HumanElementFinder` with 3-layer auto-heal (re-scan DOM, Vision AI, coordinate click) |
| 6 | Cleanup | `_cleanup()` -- closes browser, emits `complete` event with pass/fail/healed stats |

**Instruction Parsing (Phase 1):**

The orchestrator extracts:
- **URL:** regex `https?://[^\s"'<>]+` or domain pattern matching
- **App type:** salesforce, workday, servicenow, or generic (from URL keywords)
- **Credentials:** email regex + password extraction from patterns like "email/password" or "password: X"
- **Actions:** AI-parsed via `_ai_parse_actions()` or pattern-based via `_pattern_actions()`

**Element Resolution (Phase 5):**

`HumanElementFinder` (`backend/app/services/ai_testing/human_element_finder.py`, 602 lines) resolves elements in this order:

1. `getByLabel()` -- finds input by its associated label text
2. `getByRole()` -- finds by ARIA role (button, textbox, link, etc.)
3. `getByText()` -- finds by visible text content
4. `getByPlaceholder()` -- finds by placeholder attribute
5. Smart CSS fallback -- app-specific stable attributes (Salesforce `data-aura-class`, Workday `data-automation-id`, ServiceNow, SAP patterns)
6. Vision AI -- screenshot + GPT-4V to visually locate the element

**3-Layer Auto-Healing:**

| Layer | Strategy | Speed | Requires |
|-------|----------|-------|----------|
| 1 | Re-scan DOM | 200ms | Nothing -- re-injects PageScanner, tries fresh element match |
| 2 | Vision AI | 2-5s | Screenshot + OPENAI_API_KEY -- GPT-4V analyzes screenshot to find element |
| 3 | Coordinate click | 100ms | Screenshot -- falls back to pixel coordinates from Vision AI response |

### Self-Healer Agent

**Purpose:** Re-run a previously failed test with AI-generated selector improvements.

**Backend:** Same `AgenticOrchestrator` but invoked via `/api/ai-testing/rerun-with-fix` endpoint.

**Flow:**
1. Frontend sends `original_instruction` + `failed_test` (name, steps, screenshot)
2. Backend identifies first failed step
3. AI generates 5 alternative selectors via `gpt-4-turbo-preview` prompt
4. Fallback: pattern-based selector generation (username/password/login/generic variants)
5. Enhanced instruction appended with `IMPORTANT: For element "X", try these selectors: ...`
6. Standard `AgenticOrchestrator.run_testing()` executes with improved context
7. SSE includes `fix_applied` events showing what selectors were generated

### Explorer Agent

**Purpose:** Autonomously crawl a website and find real defects without AI dependency.

**Backend:** `BlazeExplorer` (`backend/app/services/exploration/blaze_explorer.py`, 700 lines)

**What it detects:**
- Broken links (HTTP 4xx/5xx responses)
- JavaScript console errors
- Accessibility issues (via lightweight heuristic checks)
- Security vulnerabilities (mixed content, exposed data, etc.)
- Performance problems (slow page loads)

**Execution model:**
- Background task via FastAPI `BackgroundTasks`
- Frontend polls `GET /api/blaze/status/{session_id}` every 2 seconds
- Session stored in `_active_sessions` dict (in-memory)
- Configurable: `max_pages`, `max_duration_minutes`, `headless`, `test_types`

**Defect structure:**

```python
{
    "type": "broken_link" | "js_error" | "accessibility" | "security" | "performance",
    "severity": "critical" | "high" | "medium" | "low",
    "url": "https://...",
    "description": "Broken link: /missing-page returned 404",
    "element": "a.nav-link",
    "screenshot": "base64..."
}
```

### Flowmap Agent

**Purpose:** Map all application capabilities -- pages, buttons, forms, entities, user journeys.

**Backend:** `AutonomousExplorer` + `CapabilityMapBuilder` (`backend/app/services/exploration/`)

**Flow:**
1. `AutonomousExplorer` performs BFS crawl starting from `base_url`
2. For each page: extract title, headings, buttons (text + selector), forms (id + fields), links, entities, actions
3. Respects `robots.txt`, adds 3-second delay between pages (ethical crawling)
4. 10-minute timeout via `asyncio.wait_for`
5. `CapabilityMapBuilder` enriches results with LLM analysis (entity categorization, capability gaps, user journey suggestions)
6. Results persisted to PostgreSQL via `CapabilityMapStorage`
7. Defects detected during crawl saved via `DefectStorage`

**Page capability structure:**

```python
{
    "id": "page_1",
    "url": "https://example.com/dashboard",
    "title": "Dashboard",
    "headings": ["Welcome", "Recent Activity"],
    "buttons": [{"text": "New Report", "selector": "button.btn-primary"}],
    "forms": [{"id": "search-form", "fields": [...]}],
    "links": ["https://example.com/settings", ...],
    "entities": ["User", "Report", "Dashboard"],
    "actions": ["create_report", "search", "filter"]
}
```

---

## 8. LLM Integration

### Provider Architecture

The `ModelGateway` (`backend/app/services/llm/model_gateway.py`) provides unified LLM access:

| Provider | Status | Model | Use Case |
|----------|--------|-------|----------|
| OpenAI | Active (primary) | `gpt-4o-mini` | Test case formatting, JSON generation |
| OpenAI | Active | `gpt-4-turbo-preview` | Instruction parsing, selector generation, failure analysis |
| Anthropic Claude | Active (dev) | Claude 3 | Complex reasoning, prompt caching |
| Ollama/vLLM | Disabled | Qwen2 variants | Local inference (enable via `ENABLE_OLLAMA_SERVICE=true`) |

### How LLM is Used in AI Testing

| Operation | Model | Where | Fallback |
|-----------|-------|-------|----------|
| Parse NLP instruction into actions | `gpt-4-turbo-preview` | `AgenticOrchestrator._ai_parse_actions()` | Pattern-based regex extraction |
| Generate alternative selectors for healing | `gpt-4-turbo-preview` | `rerun-with-fix` endpoint | Common selector patterns per element type |
| Explain test failure | `gpt-4-turbo-preview` | `/api/ai-testing/explain` | Error-type-based template responses |
| Vision AI element location | GPT-4V | `HumanElementFinder` layer 6 | Coordinate-based fallback |
| Capability map enrichment | Via `CapabilityMapBuilder` | Exploration pipeline | Raw page data without LLM enrichment |

### Prompt Patterns

**Instruction parsing prompt:**
```
Parse this test instruction into a sequence of browser actions.
Instruction: "{instruction}"
URL detected: {url}
Credentials detected: {creds}
Return ONLY a JSON array of actions. Each action:
- "action": "navigate" | "fill" | "click" | "assert" | "wait"
- "target": human-readable element description
- "value": value for fill actions
- "description": what this step does
```

**Selector generation prompt (rerun-with-fix):**
```
A Playwright test failed. Generate ALTERNATIVE selectors for this element.
Failed action: {action}
Failed selector: {target}
Error: {error}
Generate 5 alternative CSS/XPath selectors that might work better.
Return ONLY a JSON array of alternative selectors.
```

### Cost Considerations

- `gpt-4-turbo-preview` at ~$10/1M input tokens, ~$30/1M output tokens
- Each AI Testing run typically makes 1-2 LLM calls (parse + optional healing)
- Vision AI calls are more expensive but only triggered on healing layer 6
- Budget controlled: max 3 AI calls per test run via `ai_automation_api._budget_state`

---

## 9. Configuration

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | For AI features | OpenAI API key (starts with `sk-`) -- used by AgenticOrchestrator, failure analysis, selector generation |
| `ANTHROPIC_API_KEY` | For Claude | Anthropic Claude API key |
| `ENABLE_OLLAMA_SERVICE` | No (default: `false`) | Enable local Ollama/vLLM inference |
| `ENABLE_VLLM_SERVICE` | No (default: `false`) | Enable vLLM inference |
| `VITE_API_URL` | Yes | Frontend API base URL (used by `API_BASE_URL` in api-config.ts) |

### Frontend Configuration

- `API_BASE_URL` from `src/lib/api-config.ts` -- all backend calls use this base
- `AIContext` (`src/contexts/AIContext.tsx`) -- stores user's API key and model preference
- In Electron: API key can be `***env***` to signal backend should use its own env key

### Backend Configuration

- `backend/app/config/llm_config.py` -- LLM provider configuration
- AgenticOrchestrator auto-detects OpenAI key from environment
- PageScanner JS is embedded inline in `page_scanner.py` (no external files)
- Playwright browser launched in Chromium channel with `--no-sandbox` flag

### Routes in `App.tsx`

```typescript
<Route path="/flowpilot" element={<FlowpilotPage />} />
<Route path="/flowpilot/explorer" element={<FlowpilotPage />} />
<Route path="/flowpilot/generator" element={<FlowpilotPage />} />
<Route path="/flowpilot/self-healer" element={<FlowpilotPage />} />
<Route path="/ai-testing" element={<AITestingPage />} />
```

---

## 10. BYOK AI Integration (v3.14.0)

### Overview

As of v3.14.0, **AI is OFF by default** across the entire platform. Users must explicitly opt-in at the organization level, bring their own API keys (BYOK), and can toggle 20 individual AI feature areas on or off. This applies to all AI-dependent features in the AI Testing module, including the Generator agent, Self-Healer agent, and LLM-enhanced Flowmap analysis.

The Explorer agent is unaffected because it operates without any AI dependency (purely deterministic crawling).

### Toggle Hierarchy

```
Server env (OPENAI_API_KEY)       <-- Platform-provided key (fallback)
  +-- Org settings (ai_settings)  <-- Admin enables AI, stores BYOK key
       +-- Project override        <-- Optional per-project settings
            +-- Feature toggles     <-- 20 granular feature flags
```

**Key Resolution Chain (backend):**
1. Check `ai_settings` for org/project-specific BYOK key (Fernet-encrypted) -> use it
2. Else check server env var (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`) -> use it
3. Else -> AI unavailable, return 503 for AI endpoints

### Frontend AI Gates

#### FlowpilotPage Gates

When AI is not configured (no key stored, AI disabled at org level):

- **Generator and Self-Healer cards** are visually dimmed with an "AI Required" badge overlay
- **Explorer card** always remains fully active (no AI dependency)
- **Flowmap card** remains active but LLM analysis will be skipped if no AI key
- **Execute button** is disabled for AI-dependent agents when no AI is available
- **Amber setup banner** appears at the top of the page with a link to `/settings?tab=ai` for configuration

The `useAI()` hook from `AIContext` provides `isAvailable`, `isFeatureEnabled(feature)`, and `hasApiKey` checks used by the component to determine gate states.

#### AIChatTesting Gates

When AI is not available:

- **Textarea** is disabled (read-only) with placeholder text indicating AI is not configured
- **Quick example prompts** are hidden
- **"Start AI Testing" button** is disabled
- **Amber info card** is displayed with a "Configure AI in Settings" link pointing to `/settings?tab=ai`
- When AI is re-enabled, all controls become active immediately (reactive via context)

### Backend: AI Key Resolver

**File:** `backend/app/routers/ai/ai_key_resolver.py`

A shared helper module used by all AI routers to resolve API keys from the BYOK hierarchy:

| Function | Purpose |
|----------|---------|
| `resolve_ai_key(request, provider)` | Resolves API key using the 3-level chain (BYOK -> env -> None). Returns `(key, source)` tuple where source is `"byok"`, `"env"`, or `None` |
| `require_ai_key(request, provider)` | Same as `resolve_ai_key` but raises `HTTPException(503)` if no key is found. Used as a dependency in AI endpoints |

All AI routers (`ai_testing.py`, `ai_generation_api.py`, `ai_automation_api.py`, `ai_enhancements_api.py`, `vision_healing_api.py`, `llm_api.py`) use `require_ai_key()` as a FastAPI dependency to gate access when no AI key is available.

### Backend: AI Settings Service

**File:** `backend/app/services/core/ai_settings_service.py` (704 lines)

| Method | Purpose |
|--------|---------|
| `get_settings(org_id)` | Retrieve org-level AI settings (enabled, provider, model, feature toggles) |
| `update_settings(org_id, updates)` | Update settings (enabled, provider, model, features) |
| `store_key(org_id, provider, api_key)` | Encrypt key with Fernet, store in `ai_encrypted_keys` table |
| `delete_key(org_id, provider)` | Remove stored encrypted key |
| `resolve_key(org_id, provider)` | 3-level key resolution chain: BYOK -> env -> None |
| `test_connection(org_id, provider, api_key?)` | Test API connection with stored or provided key, returns latency |
| `get_providers(org_id)` | List all providers with `has_key` status |
| `get_usage(org_id)` | Get current billing period usage stats by feature |
| `track_usage(org_id, feature, tokens)` | Record AI usage for budget tracking |

**Database tables** (migration `034_ai_settings.sql`):
- `ai_settings` -- org-level settings (enabled, provider, model, feature toggles as JSONB)
- `ai_encrypted_keys` -- Fernet-encrypted API keys per org/provider
- `ai_usage_log` -- per-call usage tracking (feature, tokens, timestamp)

### Frontend: AIContext (Rewritten for v3.14.0)

**File:** `src/contexts/AIContext.tsx`

The `AIContext` was rewritten to sync with the backend AI settings API instead of using localStorage:

| Export | Type | Purpose |
|--------|------|---------|
| `AIProvider` | Component | Wraps app, fetches settings from `GET /api/ai/settings` on mount |
| `useAI()` | Hook | Returns `{ isEnabled, isAvailable, hasApiKey, hasAnthropicKey, provider, model, features, isFeatureEnabled(feature), refreshSettings() }` |
| `AIFeatureGate` | Component | Conditional render wrapper: `<AIFeatureGate feature="self_healing">...</AIFeatureGate>` -- renders children only if feature is enabled |

**Key behaviors:**
- Settings fetched from backend on mount and cached in context state
- `isAvailable` = `isEnabled && (hasApiKey || hasAnthropicKey)` -- true only when AI is both enabled and has a key
- `isFeatureEnabled(feature)` checks the 20-feature toggle map from backend settings
- `refreshSettings()` re-fetches from backend (called after settings page changes)
- API keys are NEVER stored in frontend state or localStorage -- only `hasApiKey: boolean` flags

### Frontend: AIConfiguration (Rewritten for v3.14.0)

**File:** `src/components/AIConfiguration.tsx`

The Settings > AI tab was rewritten as a multi-provider BYOK management UI:

**Sections:**
1. **Master Toggle** -- Enable/disable AI for the entire organization
2. **Provider Selection** -- Choose between OpenAI and Anthropic (with model selection per provider)
3. **API Key Management** -- Per-provider key input with "Store Key" button; keys sent to `POST /api/ai/settings/key`; after save, input clears and "Key stored securely" badge shown; "Test Connection" button validates the key
4. **Feature Toggles** -- 20 individual feature toggles organized in 7 categories
5. **Usage & Budget** -- Current period usage stats, per-feature breakdown, budget limits

**Key security:**
- API keys are NEVER displayed after storage (only `hasApiKey` boolean shown)
- Key input field clears immediately after successful save
- "Remove Key" button calls `DELETE /api/ai/settings/key/{provider}`
- Connection test uses `POST /api/ai/settings/test` (can test with stored key or newly entered key before saving)

### 20 AI Feature Toggles

| Category | Feature Flag | Description |
|----------|-------------|-------------|
| **Test Generation** | `test_case_generation` | AI-powered test case generation from requirements |
| | `test_step_suggestions` | Smart step suggestions during test building |
| **Self-Healing** | `self_healing` | Auto-fix broken selectors during execution |
| | `smart_locators` | AI-enhanced locator strategies |
| **API Testing** | `api_test_generation` | Generate API tests from specs |
| | `api_mock_generation` | Generate mock responses |
| **Performance** | `perf_analysis` | AI-powered performance analysis |
| | `load_pattern_suggestions` | Suggest optimal load patterns |
| **Visual & A11y** | `visual_analysis` | AI semantic visual comparison |
| | `a11y_suggestions` | AI accessibility fix suggestions |
| **Defects & Code** | `defect_analysis` | AI defect root cause analysis |
| | `defect_triage` | Automated defect triage and prioritization |
| | `code_generation` | Generate test code from descriptions |
| | `code_optimization` | Optimize existing test code |
| **Requirements** | `requirement_analysis` | AI requirement analysis and gap detection |
| | `gherkin_generation` | Generate Gherkin from requirements |
| **Salesforce** | `sf_test_generation` | Salesforce-specific test generation |
| | `sf_data_generation` | Salesforce test data generation |
| **Assistants** | `chat_assistant` | AI chat assistant for debugging |
| | `smart_fill` | Smart form fill suggestions |

### Impact on AI Testing Agents

| Agent | AI Required? | Behavior When AI Unavailable |
|-------|-------------|------------------------------|
| **Generator** | Yes | Card dimmed, execute button disabled, amber banner shown |
| **Self-Healer** | Yes | Card dimmed, execute button disabled, amber banner shown |
| **Explorer** | No | Always available -- purely deterministic crawling |
| **Flowmap** | Partial | Crawling works, LLM-enhanced analysis skipped |

### Key Files Summary

| File | Purpose |
|------|---------|
| `src/contexts/AIContext.tsx` | React context -- backend-synced, 20 feature areas, `useAI()`, `AIFeatureGate` |
| `src/components/AIConfiguration.tsx` | Settings > AI tab -- multi-provider BYOK UI, feature toggles, usage/budget |
| `backend/app/services/core/ai_settings_service.py` | AISettingsService -- CRUD, key encryption, resolution, budget tracking (704 lines) |
| `backend/app/routers/platform/ai_settings_api.py` | REST API for AI settings (7 endpoints) |
| `backend/app/routers/ai/ai_key_resolver.py` | Shared helper: `resolve_ai_key()` and `require_ai_key()` for all AI routers |
| `supabase/migrations/034_ai_settings.sql` | Database migration: `ai_settings`, `ai_encrypted_keys`, `ai_usage_log` tables |

---

## 11. Known Gaps & TODOs

### Frontend

- [ ] **Chat panel in AIChatTesting:** The "Send" button in the chat panel has a `// TODO: Call AI` comment -- free-form chat messages are captured but not sent to any backend endpoint
- [ ] **AIExplorerAgent and AIFlowExplorer require Electron:** These components depend entirely on Electron IPC (`window.electronAPI`). In the browser (SaaS mode), they show error messages. No web-based fallback exists
- [ ] **FlowpilotPage agent sub-routes not differentiated:** Routes like `/flowpilot/explorer` render the same component without auto-selecting the corresponding agent -- the `selectedAgent` defaults to Generator regardless of route
- [ ] **No persistence for FlowpilotPage state:** Test results, exploration results, and flowmap results are lost on page navigation. No localStorage or Zustand store backs this component
- [ ] **Explorer polling cleanup:** The `pollIntervalRef` is cleared on stop but there is no `useEffect` cleanup for unmount -- if the user navigates away while Explorer is running, the interval leaks
- [ ] **Self-Healer only uses first failed test:** When multiple tests fail, `executeSelfHealer()` only sends the first failed test to the re-run endpoint

### Backend

- [ ] **AgenticOrchestrator runs Playwright synchronously:** Uses `sync_playwright` in a `ThreadPoolExecutor(max_workers=1)` -- concurrent AI testing requests will serialize. Consider migrating to `async_playwright`
- [ ] **In-memory session storage for Blaze:** `_active_sessions` dict is lost on server restart. No persistence layer for exploration sessions
- [ ] **No authentication on AI Testing endpoints:** The `/api/ai-testing/*` and `/api/blaze/*` endpoints do not enforce RBAC or tenant isolation
- [ ] **Hardcoded model names:** `gpt-4-turbo-preview` is hardcoded in `ai_testing.py` and `agentic_orchestrator.py` rather than routed through `ModelGateway`
- [ ] **No test result persistence for AI Testing:** Results from `/api/ai-testing/start` are streamed to the client but not saved to the database. Only `saveAsTestCase()` (triggered manually by user) persists anything
- [ ] **Exploration run cleanup:** Completed exploration runs in `_active_sessions` are never cleaned up -- memory grows over time
- [ ] **PageScanner JS size:** The inline JavaScript in `page_scanner.py` is large and duplicates logic from `recorder-engine.js`. Consider extracting to a shared JS file

### Integration

- [ ] **Connect AIExplorerAgent to backend APIs:** Currently Electron-only via IPC. Could be wired to `/api/blaze/start` for web-based operation
- [ ] **Connect AIFlowExplorer to backend APIs:** Currently Electron-only via IPC. Could be wired to `/api/exploration/start` for web-based operation
- [ ] **Unify agent patterns:** FlowpilotPage handles 4 agents with different protocols (SSE vs polling vs REST). A unified agent execution interface would simplify the code
- [ ] **WebSocket support for Explorer:** Replace 2-second polling with WebSocket for real-time Explorer updates
- [ ] **Test suite integration:** Auto-discovered tests from Explorer/Flowmap should optionally auto-save to test suites rather than requiring manual "Save" clicks

---

## Key Types Reference

### Frontend Types (FlowpilotPage.tsx)

```typescript
interface TestStep {
  action: string;
  target: string;
  value?: string;
  success: boolean;
  error?: string;
  screenshot?: string;
  method?: string;           // How element was found (label, role, text, vision_ai, etc.)
  healed?: boolean;          // Was this step healed by AI?
  heal_method?: string;      // Which healing strategy succeeded
  confidence?: number;       // Confidence percentage
  selector_used?: string;    // Actual selector that worked
  description?: string;      // Human-readable step description
}

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'running';
  steps: TestStep[];
  duration: number;
  screenshot?: string;
}

interface ExplorationDefect {
  type: string;              // broken_link, js_error, accessibility, security, performance
  severity: string;          // critical, high, medium, low
  url: string;
  description: string;
  element?: string;
  screenshot?: string;
}

interface ExplorationResult {
  session_id: string;
  status: 'running' | 'completed' | 'error';
  progress: number;          // 0.0 to 1.0
  pages_visited: number;
  defects_found: number;
  defects: ExplorationDefect[];
  current_activity: string;
  duration: number;          // milliseconds
}

interface CapabilityPage {
  id: string;
  url: string;
  title: string;
  headings: string[];
  buttons: { text: string; selector: string }[];
  forms: { id: string; fields: any[] }[];
  links: string[];
  entities: string[];
  actions: string[];
}

interface FlowmapResult {
  base_url: string;
  total_pages: number;
  pages: CapabilityPage[];
  llm_analysis?: any;
  total_defects: number;
}

type AgentId = 'flowmap' | 'explorer' | 'self-healer' | 'generator';

interface SSEEvent {
  type: string;
  phase?: string;
  message?: string;
  screenshot?: string;
  result?: TestResult;
  data?: any;
  tests?: number;
  error?: string;
  intent?: any;
}
```

### Backend Types (agentic_orchestrator.py)

```python
@dataclass
class StepResult:
    success: bool
    action: str
    target: str
    value: str = ""
    description: str = ""
    error: Optional[str] = None
    method: str = ""            # How element was found
    selector_used: str = ""     # Actual selector that worked
    confidence: int = 0
    healed: bool = False
    heal_method: str = ""
    screenshot: Optional[str] = None

@dataclass
class TestCaseResult:
    id: str = ""
    name: str = ""
    description: str = ""
    status: str = "pending"     # pending, passed, failed
    steps: List[StepResult] = field(default_factory=list)
    duration: float = 0.0
    screenshot: Optional[str] = None

@dataclass
class FindResult:              # From HumanElementFinder
    found: bool
    method: str = "unknown"     # label, role, text, placeholder, css, vision
    selector_used: str = ""
    confidence: float = 0.0
    attempts: List[str] = field(default_factory=list)
    error: Optional[str] = None
    vision_used: bool = False
    healing_suggestion: Optional[str] = None
```
