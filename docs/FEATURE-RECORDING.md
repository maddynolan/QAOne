# Feature: Record & Playback
> The foundational feature of Flowstral — capture user interactions in a real browser and produce automated Playwright test scripts, structured test cases, and Action Graphs with zero code.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Recording Pipeline Deep Dive](#7-recording-pipeline-deep-dive)
8. [Selector Engine & Confidence System](#8-selector-engine--confidence-system)
9. [Playback & Self-Healing](#9-playback--self-healing)
10. [Configuration](#10-configuration)
11. [Known Gaps & TODOs](#11-known-gaps--todos)

---

## 1. Overview

Record & Playback is Flowstral's core value proposition. Users open a real browser, interact with their application, and Flowstral captures every click, fill, navigation, and assertion — then generates:

- **Playwright test scripts** (Python and TypeScript)
- **Structured test cases** (ISTQB, Gherkin, Markdown formats)
- **Action Graphs** (DAG of user actions with edges for flow)
- **WCAG accessibility snapshots** (captured during recording)
- **Performance metrics** (page load, interaction timing)
- **Visual checkpoints** (baseline screenshots for regression)

**Who it's for:** QA testers who need automated tests without writing code, and developers who want to bootstrap test suites from manual walkthroughs.

**Three recording systems exist:**

| System | Trigger | Use Case |
|--------|---------|----------|
| **CDP Recorder** | Backend launches browser via Chrome DevTools Protocol | No extension needed, web-only recording |
| **Playwright Recorder** | Browser extension sends actions to backend | Extension-based, richest Salesforce support |
| **Flowstral Pipeline** | Full-stack: extension + Action Graph + multi-modal analysis | Enterprise recording with artifacts |

---

## 2. Architecture

### Data Flow

```
User Browser (with extension)
    │
    ├── Click / Fill / Navigate events
    │       │
    │       ▼
    │   Extension injects RECORDER_SCRIPT (JS)
    │       │
    │       ├── Captures: selector, value, element metadata
    │       ├── Shadow DOM traversal (MutationObserver)
    │       └── App-type detection (Salesforce, ServiceNow, etc.)
    │               │
    │               ▼
    ├──────── IPC (Electron preload bridge) ────────┐
    │                                                │
    │   PlaywrightRecorderPage.tsx                   │
    │   (10,354 lines — main UI)                     │
    │       │                                        │
    │       ├── Step list, selector editing           │
    │       ├── Playback controls                     │
    │       ├── Lock Locators                         │
    │       └── Merge with existing tests             │
    │               │                                │
    │               ▼                                │
    │   Backend (FastAPI)                            │
    │       │                                        │
    │       ├── flowstral_api.py (Action Graph)      │
    │       ├── playwright_recorder_api.py (Scripts)  │
    │       ├── cdp_recorder_api.py (CDP sessions)   │
    │       └── protocol_recording_api.py (HTTP)     │
    │               │                                │
    │               ▼                                │
    │   Services Layer                               │
    │       ├── DOMSnapshotPipeline (13 selectors)   │
    │       ├── EventCoalescer (semantic actions)     │
    │       ├── FlowstralSession (Action Graph)      │
    │       ├── PlaywrightScriptGenerator (code gen)  │
    │       ├── RecordingEnhancer (AI/GPT-4o-mini)   │
    │       └── WebSocketManager (live progress)     │
    │               │
    │               ▼
    │   Outputs: .py/.ts scripts, test cases, 
    │            Action Graph, WCAG report, 
    │            perf metrics, visual baselines
```

### Frontend-Backend Communication

| Channel | When | Direction |
|---------|------|-----------|
| **Electron IPC** (`window.flowstral.playwrightRecorder.*`) | Recording start/stop, action polling, playback | Frontend ↔ Electron main process |
| **Electron IPC** (`window.flowstral.elementPicker.*`) | Element picker, selector testing | Frontend ↔ Electron main process |
| **Electron IPC** (`window.flowstral.mobile.*`) | Device emulation, Maestro | Frontend ↔ Electron main process |
| **REST API** (`localhost:8000/api/flowstral/*`) | Script generation, test case CRUD, sessions | Frontend → Backend |
| **WebSocket** (`/api/flowstral/ws/{id}`) | Live artifact generation progress | Backend → Frontend |
| **WebSocket** (`/cdp-recorder/live/{id}`) | Live screenshot stream (1 FPS) | Backend → Frontend |
| **localStorage** | Action persistence, test case cache, selector locks | Frontend local |

---

## 3. Frontend Code Audit

### Pages

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/recorder/pages/PlaywrightRecorderPage.tsx` | ~10,354 | **Fully implemented** | Main recording/playback page — ~80 useState hooks, recording flow, playback with step-by-step debug, step editing, merge with existing tests, Salesforce tools, AI features, false positive workflow |

**Key state groups in PlaywrightRecorderPage:**
- **Recording:** `url`, `isRecording`, `isPaused`, `actions[]`, `recordingTime`
- **Playback:** `testExecutionResult`, `isTestPaused`, `pausedAtStep`, `stepByStepMode`, `playbackSpeed`
- **Step editing:** `editSelectorModalOpen`, `manualSelectorInput`, `selectorType`, `selectedActionIndices`
- **Network capture:** `captureForLoadTest`, `captureForApiTest`, `capturedNetworkRequests`
- **Mobile:** `selectedMobileDevice`, `selectedNetwork` (50+ device profiles inline)
- **Merge:** `stepLinks`, `showMergePreview`, `mergedSteps`, `defaultLinkMode`
- **False positive:** `falsePositiveSteps` (Map), `stoppedAtFalsePositive`
- **AI:** `aiExplanation`, `flakyStepIds`
- **Salesforce:** `sfToolType`, `soqlQuery`, `soqlResults`

### Components

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/modules/recorder/components/confidence/ConfidenceBadge.tsx` | 79 | **Fully implemented** | Color-coded badge (green/amber/red) with shield icon and % score |
| `src/modules/recorder/components/confidence/MatchCountBadge.tsx` | 89 | **Fully implemented** | Shows "N matches found, position #M used" with risk warnings |
| `src/modules/recorder/components/confidence/StepConfidenceIndicator.tsx` | 67 | **Fully implemented** | Composite — renders MatchCount + Confidence, hides when HIGH |
| `src/modules/recorder/components/QuickRerecordModal.tsx` | 450 | **Fully implemented** | 3-step wizard: enter URL → pick element → review & save |
| `src/modules/recorder/components/BlackboxLocatorStrategies.tsx` | 834 | **Mostly implemented** | 7 fallback locator types (OCR, image, coords, relative, AI, region, color). **Image Capture/Upload buttons are stubs** (no onClick handlers) |
| `src/modules/recorder/components/ElementRepairWizard.tsx` | 1,445 | **Fully implemented** | 4-tab repair: Manual / Pick / Debug / AI. Full fix-retry-resume cycle |
| `src/modules/mobile-testing/components/MobileDeviceSelector.tsx` | 532 | **Fully implemented** | Device dropdown, network throttling, Maestro status |

### Libraries

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/lib/electron-bridge.ts` | 512 | **Fully implemented** | IPC proxy with browser fallback. Namespaces: `recorder`, `testRunner`, `testExport`, `mobile`, `config`, `localData` |
| `src/lib/application-detector.ts` | 325 | **Fully implemented** | Static utility: detect app type (Salesforce/React/Angular/Vue) from URL or HTML, generate prioritized selectors |

---

## 4. Backend Code Audit

### Routers

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/recorder/cdp_recorder_api.py` | ~445 | `/cdp-recorder` | 13 (REST) + 1 (WS) | **Fully implemented** |
| `backend/app/routers/recorder/playwright_recorder_api.py` | ~3,517 | `/api/flowstral` | 42 | **Fully implemented** |
| `backend/app/routers/performance/protocol_recording_api.py` | ~523 | `/api/protocol-recording` | 13 (REST) + 1 (WS) | **Fully implemented** |
| `backend/app/routers/recorder/flowstral_api.py` | ~840 | `/api/flowstral` | 10 (REST) + 1 (WS) | **Fully implemented** |
| `backend/app/routers/recorder/flowstral_config_api.py` | ~168 | `/api/flowstral/projects` | 4 | **Fully implemented** |
| `backend/app/routers/recorder/flowstral_engine_api.py` | ~550 | `/flowstral` | 11 | **Fully implemented** |

**Warning — Route prefix collision:** Both `playwright_recorder_api.py` and `flowstral_api.py` share the `/api/flowstral` prefix with overlapping paths (`/start`, `/stop`, `/sessions`, `/session/{id}/status`, `/session/{id}/artifacts`). Whichever router is registered last in `main.py` shadows the other.

### Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/cdp_recorder/__init__.py` | ~10 | Complete | Exports CDPRecorderService, CDPSessionManager |
| `backend/app/services/cdp_recorder/session_manager.py` | ~216 | **Fully implemented** | Singleton session manager, session recovery from state files |
| `backend/app/services/cdp_recorder/recorder_service.py` | ~359 | **Fully implemented** | Launches subprocess, JSON file-based IPC, static fallback analysis |
| `backend/app/services/cdp_recorder/recorder_subprocess.py` | ~895 | **Fully implemented** | Standalone process: injects 365-line RECORDER_SCRIPT JS, Shadow DOM support, Salesforce LWC detection |
| `backend/app/services/flowstral/flowstral_session.py` | ~381 | **Fully implemented** | Session state + Action Graph (nodes/edges), raw events buffer, artifact storage |
| `backend/app/services/flowstral/flowstral_dom_pipeline.py` | ~486 | **Fully implemented** | Pipeline A: DOM snapshots, 13-strategy selector engine, framework detection. **Bug:** line 326 references `element_name` (undefined) — should be `name` |
| `backend/app/services/flowstral/flowstral_event_coalescer.py` | ~364 | **Fully implemented** | Coalesces low-level events → semantic actions (focus+input+blur → "fill_field") |
| `backend/app/services/flowstral/flowstral_websocket_manager.py` | ~143 | **Fully implemented** | Broadcasts artifact generation progress over WebSocket |
| `backend/app/services/ai_layer/recording_enhancer.py` | ~284 | **Fully implemented** | AI enhancement via GPT-4o-mini with deterministic fallback |
| `backend/app/services/utils/dom_recorder.py` | ~242 | **Fully implemented** | Deterministic Playwright TypeScript generation (no LLM) |

---

## 5. API Endpoints

### CDP Recorder (`/cdp-recorder`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/cdp-recorder/start` | Start CDP recording session. Launches visible browser. |
| POST | `/cdp-recorder/stop/{session_id}` | Stop recording, return recorded actions. |
| GET | `/cdp-recorder/sessions` | List all active sessions. |
| GET | `/cdp-recorder/session/{session_id}` | Get session details (status, URL, app type, action count). |
| GET | `/cdp-recorder/session/{session_id}/actions` | Get recorded actions + live screenshot. |
| GET | `/cdp-recorder/session/{session_id}/screenshot` | Get current screenshot (base64). |
| GET | `/cdp-recorder/session/{session_id}/analyze` | Deep page analysis for suggested test actions. |
| DELETE | `/cdp-recorder/session/{session_id}` | Clean up and remove session. |
| POST | `/cdp-recorder/session/{session_id}/click` | Send click at (x, y) to browser from preview. |
| POST | `/cdp-recorder/session/{session_id}/type` | Send keyboard input from preview. |
| POST | `/cdp-recorder/session/{session_id}/key` | Send key press (Enter, Tab, etc.). |
| POST | `/cdp-recorder/generate-test` | Generate Playwright test code from recorded actions. |
| WS | `/cdp-recorder/live/{session_id}` | Live screenshot streaming at 1 FPS. |

### Playwright Recorder (`/api/flowstral`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/flowstral/generate` | Generate Playwright script (Python/TS) from recorded actions. |
| POST | `/api/flowstral/execute` | Execute generated test immediately. |
| POST | `/api/flowstral/generate-test-cases` | Generate structured test cases (ISTQB/Gherkin/Markdown). |
| GET | `/api/flowstral/sessions` | List all recording sessions. |
| POST | `/api/flowstral/save-session` | Save recording session with metadata. |
| POST | `/api/flowstral/start` | Start a Flowstral recording session. |
| POST | `/api/flowstral/stop` | Stop session and generate artifacts. |
| GET | `/api/flowstral/session/{id}/status` | Get session status. |
| PATCH | `/api/flowstral/session/{id}/status` | Update session status. |
| DELETE | `/api/flowstral/session/{id}` | Delete session. |
| GET | `/api/flowstral/session/{id}/artifacts` | Get session artifacts. |
| GET | `/api/flowstral/health` | Health check. |
| POST | `/api/flowstral/test-cases` | Create test case from recording. |
| GET | `/api/flowstral/test-cases` | List test cases. |
| GET | `/api/flowstral/test-cases/stats` | Test case statistics. |
| GET | `/api/flowstral/test-cases/{id}` | Get single test case. |
| PUT | `/api/flowstral/test-cases/{id}` | Update test case. |
| POST | `/api/flowstral/test-cases/{id}/approve` | Approve test case. |
| POST | `/api/flowstral/test-cases/{id}/reject` | Reject test case. |
| DELETE | `/api/flowstral/test-cases/{id}` | Delete test case. |
| POST | `/api/flowstral/test-cases/{id}/run` | Run a test case. |
| GET | `/api/flowstral/test-cases/{id}/workflow` | Get approval workflow. |
| POST | `/api/flowstral/generate-enhanced` | AI-enhanced script generation. |
| POST | `/api/flowstral/enhance-recording` | AI-enhance a raw recording. |
| POST | `/api/flowstral/workflow/import-recording` | Import recording into unified workflow. |
| POST | `/api/flowstral/workflow/generate` | Generate test from workflow. |
| POST | `/api/flowstral/visual-regression/generate` | Generate visual regression test. |
| GET | `/api/flowstral/visual-regression/baselines` | List visual regression baselines. |
| DELETE | `/api/flowstral/visual-regression/baselines/{name}` | Delete baseline. |
| POST | `/api/flowstral/debug/run` | Start interactive debug session. |
| POST | `/api/flowstral/debug/pause` | Pause debug session. |
| POST | `/api/flowstral/debug/resume` | Resume debug session. |
| POST | `/api/flowstral/debug/skip` | Skip step in debug. |
| POST | `/api/flowstral/debug/retry` | Retry step in debug. |
| POST | `/api/flowstral/debug/stop` | Stop debug session. |
| GET | `/api/flowstral/debug/status/{id}` | Get debug session status. |
| POST | `/api/flowstral/debug/execute-step` | Execute single debug step. |
| DELETE | `/api/flowstral/debug/session/{id}` | Delete debug session. |
| GET | `/api/flowstral/debug/sessions` | List debug sessions. |
| GET | `/api/flowstral/frameworks` | List supported test frameworks. |
| POST | `/api/flowstral/convert` | Convert script between frameworks. |

### Protocol Recording (`/api/protocol-recording`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/protocol-recording/start` | Start protocol (HTTP traffic) recording. |
| POST | `/api/protocol-recording/stop/{id}` | Stop recording, get summary. |
| POST | `/api/protocol-recording/request/{id}` | Record an HTTP request (from extension). |
| POST | `/api/protocol-recording/websocket/{id}` | Record a WebSocket message. |
| POST | `/api/protocol-recording/action/{id}` | Link user action to protocol recording. |
| GET | `/api/protocol-recording/recording/{id}` | Get recording details. |
| GET | `/api/protocol-recording/recordings` | List all recordings. |
| POST | `/api/protocol-recording/generate-script/{id}` | Generate load test script (k6/JMeter/qaai). |
| POST | `/api/protocol-recording/export-har/{id}` | Export as HAR file. |
| POST | `/api/protocol-recording/import-har` | Import from HAR file. |
| POST | `/api/protocol-recording/execute-headless` | Execute headless load test. |
| POST | `/api/protocol-recording/execute-headless/stop` | Stop headless execution. |
| WS | `/api/protocol-recording/metrics-stream` | Real-time metrics WebSocket (1s intervals). |
| POST | `/api/protocol-recording/import-test-case` | Convert test case to load test scenario. |

### Flowstral Engine (`/flowstral`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/flowstral/generate` | Generate test code from steps using engine. |
| GET | `/flowstral/plugins` | List available app plugins. |
| POST | `/flowstral/detect-app` | Detect app type from URL. |
| GET | `/flowstral/component-library/{type}` | Get component library for app type. |
| GET | `/flowstral/salesforce/selectors` | Salesforce component selectors. |
| POST | `/flowstral/convert-steps` | Convert recorded steps to engine format. |
| POST | `/flowstral/build-from-recording` | Build test from raw recording. |
| POST | `/flowstral/build-from-testcase` | Build test from test case definition. |
| POST | `/flowstral/process-analysis` | Process page analysis from extension. |
| POST | `/flowstral/generate-from-analysis` | Generate test from page analysis. |
| POST | `/flowstral/suggest-actions` | Get suggested actions from page state. |

### Flowstral Config (`/api/flowstral/projects`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{project_id}/config` | Get project configuration. |
| PUT | `/{project_id}/config` | Update configuration (partial). |
| POST | `/{project_id}/config/reset` | Reset to defaults. |
| GET | `/{project_id}/config/validate` | Validate config and return issues. |

---

## 6. UI Walkthrough

### Starting a Recording

1. Navigate to **Recorder** page from the sidebar.
2. Enter the target URL in the URL bar (e.g., `https://myapp.com/login`).
3. Optionally select a **mobile device** (iPhone 15, Galaxy S24, etc.) and **network condition** (4G, 3G, Slow 3G).
4. Optionally toggle **Capture for Load Test** or **Capture for API Test** to also record HTTP traffic.
5. Click **Start Recording** — Electron opens a Playwright-controlled browser.
6. Interact with the application — every click, fill, select, and navigation is captured.
7. The left panel shows real-time recorded steps with selectors and values.
8. Click **Stop Recording** when done.

### Editing Recorded Steps

1. Click any step in the left panel to select it.
2. **Edit selector:** Click the pencil icon to open the selector editor. Choose CSS, XPath, text, or aria mode. Type a new selector and click **Test** to validate.
3. **Edit value:** Click the value text to edit inline (for fill/type steps).
4. **Reorder:** Drag and drop steps to change execution order.
5. **Multi-select:** Hold Ctrl and click to select multiple steps. Use Ctrl+C/V to copy/paste, Delete to remove.
6. **Element Picker:** Click the crosshair icon to visually pick an element from the open browser.

### Running a Test (Playback)

1. Click the **Play** button (or the dropdown for options: Run, Debug Step-by-Step, Fresh Browser).
2. Steps execute sequentially — each step highlights green (pass) or red (fail) in real time.
3. **Step-by-step mode:** Execution pauses after each step. Click **Next** to continue, **Skip** to bypass, **Retry** to re-attempt.
4. **On failure:** The `ElementRepairWizard` opens with 4 tabs:
   - **Manual** — edit selector directly
   - **Pick** — visually pick the correct element
   - **Debug** — view failure details, page state, suggested fixes
   - **AI** — describe the element in natural language for AI-based location
5. After repair, click **Retry Step** → **Continue Test** to resume execution.

### Lock Locators

After a successful test run:
1. A banner appears: "Test passed! Lock working selectors?"
2. Click **Lock Locators** — this saves the `workingSelector` from the passing run into `selectorObj.optimizedSelector` for each step.
3. Locked selectors are persisted to localStorage and used for all future runs.
4. This ensures stable tests even if the original selector was fragile.

### Merge with Existing Tests

1. Switch to **Existing Test** mode at the top of the page.
2. Use the test picker to select a manual test case.
3. Record new automation steps.
4. In the **Merge** view, link each recorded action to a manual test step (many-to-one).
5. Preview the merge, then **Save** to update the test case with automation.

---

## 7. Recording Pipeline Deep Dive

### CDP Recorder Pipeline

```
User clicks "Start" in web UI
    │
    ▼
cdp_recorder_api.py POST /start
    │
    ▼
CDPSessionManager.create_session()
    │
    ▼
CDPRecorderService.start_recording()
    │
    ▼
recorder_subprocess.py (separate process)
    │
    ├── Launches Playwright browser (persistent profile)
    ├── Injects RECORDER_SCRIPT (365 lines JS)
    │       ├── mouseup → click recording (debounced)
    │       ├── blur → input recording
    │       ├── change → select/checkbox/radio
    │       └── MutationObserver → Shadow DOM scanning
    ├── Writes state to /tmp/cdp_recorder_{id}.json
    └── Main process reads state via _read_state()
```

**IPC mechanism:** JSON state file at `{tmp}/cdp_recorder_{session_id}.json`, read by the parent process. This avoids Playwright greenlet/threading issues on Windows.

### Flowstral Pipeline (Action Graph)

```
Extension sends events
    │
    ▼
flowstral_api.py POST /capture-event
    │
    ▼
4 parallel pipelines:
    │
    ├── Pipeline A: DOMSnapshotPipeline
    │       ├── HTML parsing (element counts, forms, links)
    │       ├── 13-strategy selector generation
    │       └── Framework detection (React/Vue/Angular)
    │
    ├── Pipeline B: WCAG Pipeline
    │       └── Accessibility checks during recording
    │
    ├── Pipeline C: Performance Pipeline
    │       └── Page load timing, interaction metrics
    │
    └── Pipeline D: Action Graph
            ├── EventCoalescer (semantic grouping)
            └── FlowstralSession (node/edge construction)
    │
    ▼
flowstral_api.py POST /stop
    │
    ▼
Generate 6 artifacts:
    ├── Playwright test script
    ├── Structured test cases
    ├── Action Graph (JSON)
    ├── WCAG report
    ├── Performance metrics
    └── Session summary
```

### Event Coalescing

The `EventCoalescer` converts raw browser events into semantic actions:

| Raw Events | Coalesced Action |
|------------|-----------------|
| focus → input → input → blur | `fill_field` with final value |
| focus → change (select) | `select_option` |
| click (submit button) | `submit_form` |
| click → click → click (same element) | `click_button (3 times)` |
| single click | `click_button` |
| page navigation | `navigate` |

**Config:** `coalescing_window_ms=500`, `max_click_count=5`, `input_debounce_ms=300`

---

## 8. Selector Engine & Confidence System

### 13-Strategy Selector Engine (DOMSnapshotPipeline)

The DOM pipeline generates multiple selector candidates per element, ranked by stability:

| Priority | Strategy | Stability | Example |
|----------|----------|-----------|---------|
| 1 | `data-testid` | 99% | `[data-testid="login-btn"]` |
| 2 | Stable ID | 95% | `#submit-form` |
| 3 | ARIA label | 90% | `getByLabel("Email")` |
| 4 | ARIA labelledby | 90% | `aria-labelledby="heading-1"` |
| 5 | Role + name | 85% | `getByRole("button", {name: "Save"})` |
| 6 | Name attribute | 80% | `[name="email"]` |
| 7 | Context-aware | 85% | Parent → child path |
| 8 | Semantic text | 75% | `getByText("Submit")` |
| 9 | Text content | 70% | `:has-text("Login")` |
| 10 | Visual anchor | 80% | Nearby label + element |
| 11-13 | CSS / XPath fallbacks | 50-60% | `.btn-primary`, `//div[@class="x"]` |

### Confidence Badges

Three UI components visualize selector reliability:

- **ConfidenceBadge:** Green (HIGH ≥80%), Amber (MEDIUM 50-79%), Red (LOW <50%)
- **MatchCountBadge:** Shows "N elements matched, position #M used" — warns if >3 matches
- **StepConfidenceIndicator:** Composite — only shown when confidence is not HIGH or multiple matches exist

### Salesforce-Specific Selectors

The recorder has deep Salesforce awareness:

- **Shadow DOM:** MutationObserver scans for new shadow roots, injects listeners inside them
- **LWC Components:** Special handling for `lightning-combobox`, `lightning-radio-group`, `lightning-datepicker`
- **SLDS:** Detects `.slds-faux` elements (rendered spans that look like links)
- **Selector priority for SF:** `title` → `href` → `data-*` attributes (differs from generic apps)

---

## 9. Playback & Self-Healing

### Execution Flow

```
User clicks Play
    │
    ▼
IPC: playwrightRecorder.runTest(steps, options)
    │
    ▼
Electron main process:
    ├── Opens Playwright browser (new or reuse)
    ├── Navigates to start URL
    └── For each step:
            ├── Emit "test-step-start" → UI highlights step
            ├── Try primary selector
            ├── If fails: try optimizedSelector (locked)
            ├── If fails: try alternative selectors
            ├── If fails: emit failure → UI opens repair wizard
            ├── If passes: emit "test-step-complete"
            └── Record workingSelector for Lock Locators
    │
    ▼
Emit "test-complete" with full results
```

### Lock Locators Mechanism

After a successful run, the `workingSelector` from each step is stored as `selectorObj.optimizedSelector`. On subsequent runs:

1. The primary selector is tried first.
2. If it fails, `optimizedSelector` (the locked/proven selector) is used.
3. This creates a self-improving test — selectors get more stable over time.

### Failure Recovery

When a step fails, the `ElementRepairWizard` provides:

1. **Manual fix:** Edit the selector directly, test it against the live page.
2. **Visual pick:** Click the element in the browser, get selector candidates ranked by reliability.
3. **Debug info:** See the actual error, page URL, detected loaders/modals, similar elements.
4. **AI search:** Describe the element in English (e.g., "the blue submit button"), AI finds matching elements.
5. **Retry:** After fixing, retry the step in place. If it passes, continue the test from there.

### False Positive Workflow

1. Mark a failed step as "false positive" (the test reported failure but the step actually worked).
2. Persisted to backend via `saveFalsePositive()`.
3. On next run, if the same step fails again, execution auto-stops and highlights it.
4. The element picker opens for the user to fix the selector.

### Blackbox Fallback Strategies

When standard selectors fail, 7 fallback strategies are available:

| Strategy | How it Works |
|----------|-------------|
| **OCR Text** | Use Tesseract OCR to find text on screen, click at its coordinates |
| **Image Template** | Match a screenshot template on the page |
| **Fixed Coordinates** | Click at absolute (x, y) — last resort |
| **Relative Position** | Find anchor element, then offset by direction/distance |
| **AI Detection** | Describe element in natural language, use GPT vision |
| **Region Click** | Click within a defined bounding box |
| **Color Match** | Find element by color with tolerance |

---

## 10. Configuration

### Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `OPENAI_API_KEY` | RecordingEnhancer | None | Required for AI-enhanced recordings. Falls back to deterministic mode. |

### Flowstral Project Config (via `/api/flowstral/projects/{id}/config`)

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| `pipelines.dom` | `full` / `light` / `off` | `full` | DOM snapshot pipeline mode |
| `pipelines.wcag` | `full` / `light` / `off` | `full` | WCAG accessibility pipeline |
| `pipelines.performance` | `full` / `light` / `off` | `full` | Performance metrics pipeline |
| `event_coalescing.window_ms` | Integer | 500 | Event grouping time window |
| `event_coalescing.input_debounce_ms` | Integer | 300 | Input debounce time |
| `llm.mode` | `none` / `summary_only` / `full` | `none` | LLM usage during recording |
| `selectors.priority` | Array | `[testid, aria, role, text, css]` | Selector priority order |
| `storage.compression` | `brotli` / `gzip` / `none` | `brotli` | Snapshot compression |
| `storage.retention_days` | Integer | 30 | How long to keep sessions |

### CDP Recorder Config

| Setting | Default | Description |
|---------|---------|-------------|
| User data directory | `~/.qaai/cdp_browser_data` | Persistent browser profile |
| State file location | `{tmp}/cdp_recorder_{id}.json` | IPC state file |
| Screenshot interval | 1 FPS | WebSocket live stream rate |

### Recording Enhancer Levels

| Level | LLM Used | What it Does |
|-------|----------|-------------|
| `quick` | No | Basic rules: infer test name, convert actions to steps, infer tags |
| `standard` | Yes (GPT-4o-mini) | AI descriptions, assertions, smart step naming |
| `comprehensive` | Yes (GPT-4o-mini) | + edge cases, data-driven scenarios, a11y/perf concerns |

**LLM settings:** `temperature=0.3`, `max_tokens=2500`, `timeout=45s`

---

## 11. Cross-Browser Recording (v3.11.6+)

The Recorder supports Chromium, Firefox, and WebKit (Safari) via a browser selection dropdown in the toolbar.

**Frontend:**
- `PlaywrightRecorderPage.tsx` — `selectedBrowser` state (`'chromium' | 'firefox' | 'webkit'`), passed as `browserType` in IPC/backend calls
- `RecordingControlsPanel.tsx` — `<Select>` dropdown with Globe icon for browser engine selection

**Electron:**
- `playwright-recorder.js` — imports `chromium`, `firefox`, `webkit` from `playwright`; `launchBrowserWithFallback()` accepts `browserType` parameter
- `index.js` — `playwright-recorder-start` handler extracts `browserType` from args

### Extension-Desktop Sync (v3.10.5+)

- All URLs centralized via `api-config.js` (no more hardcoded localhost)
- Actions have unique `id` field for AI healing chain compatibility
- 5 visible tabs: Record, Suggest, SF, Script, Run
- Per-step AI buttons: Fix, Flag, Manual (same as desktop)
- Inline Manual Assist card: Paste Element + Enter Selector modes
- "Open in Desktop" button saves session and opens `PlaywrightRecorderPage?sessionId=...`

---

## 12. Known Gaps & TODOs

### Critical Issues

1. **Route prefix collision:** `playwright_recorder_api.py` and `flowstral_api.py` both use `/api/flowstral`. Overlapping endpoints: `/start`, `/stop`, `/sessions`, `/session/{id}/status`, `/session/{id}/artifacts`. Whichever router is registered last in `main.py` shadows the other.

2. **Bug in `flowstral_dom_pipeline.py` line 326:** References `element_name` which is undefined in that scope (should be `name` from line 293). Only triggered if both SimpleSelector engine AND LocatorEngine fail.

### Missing Files

| Expected File | Status |
|--------------|--------|
| `flowstral_artifact_generator.py` | **Not found** in repository |
| `flowstral_self_healer.py` | **Not found** in repository |

### Stubs / Incomplete

| Component | Issue |
|-----------|-------|
| `BlackboxLocatorStrategies.tsx` | Image Capture and Image Upload buttons render but have **no onClick handlers** |

### Architecture Observations

- **PlaywrightRecorderPage.tsx (10K lines)** is extremely large and should be refactored into sub-components for maintainability.
- **Two parallel IPC APIs** exist: `window.flowstral.*` (preload bridge) and `window.electronAPI.*` (legacy). Code tries both.
- **Two test generation engines** coexist: `PlaywrightScriptGenerator` in the router (~1,500 lines of inline selector logic) and `FlowstralTestBuilder` from the engine service. They generate Playwright code with different approaches.
- **State management** is entirely `useState` (~80+ hooks in the main page) — no Redux/Zustand. This makes the component difficult to maintain.
- **Data persistence** is triple-written: localStorage, PostgreSQL backend, and SQLite scale DB.

---

*Last updated: 2026-02-20*
*Generated by code audit of the Flowstral recording feature.*
