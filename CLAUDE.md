# CLAUDE.md — QAAI/Flowstral Platform Reference

> **This file is the starting reference for all Claude sessions working on this codebase.**
> It must be kept up-to-date whenever changes are made to components, APIs, or architecture.
> Last updated: 2026-02-14

---

## Platform Overview

QAAI (also branded as Flowstral/ArisTrace) is an enterprise QA automation platform. It combines browser recording, AI-powered test generation, multi-protocol API testing, performance/load testing, accessibility scanning, visual regression, and mobile testing into a unified product.

### Project Paths

| Path | Purpose |
|------|---------|
| `C:\QAAI` | **Main repository** — all code lives here, push from here |
| `C:\QAAI\flowstral-desktop` | Electron desktop app (separate package.json) |
| `C:\QAAI\flowstral-desktop\dist` | Built Electron installers (Setup.exe, Portable.exe) |
| GitHub | `maddynolan/QAOne` (origin), `maddynolan/code-whisperer-75` (upstream) |

### Push & Release Procedure

**When the user says "push", execute ALL of these steps in order:**

1. **Merge worktree → main:**
   ```
   cd C:\QAAI
   git merge claude/quizzical-feistel --no-edit
   ```

2. **Push to GitHub:**
   ```
   git push origin main
   ```

3. **Build Electron app:**
   ```
   cd C:\QAAI\flowstral-desktop
   taskkill /f /im Flowstral.exe 2>nul & taskkill /f /im electron.exe 2>nul
   npm run build:webapp
   npm run build:win
   ```

4. **Create GitHub release with assets:**
   ```
   "C:\Program Files\GitHub CLI\gh.exe" release create vX.Y.Z \
     --repo maddynolan/QAOne \
     --title "Flowstral vX.Y.Z - <description>" \
     --notes "<release notes>" \
     "C:\QAAI\flowstral-desktop\dist\Flowstral-Setup.exe" \
     "C:\QAAI\flowstral-desktop\dist\Flowstral-Portable.exe" \
     "C:\QAAI\flowstral-desktop\dist\latest.yml"
   ```

**Version bumping:** Check `flowstral-desktop/package.json` version and increment accordingly. Check latest release with `gh release list --repo maddynolan/QAOne --limit 1`.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS + Radix UI (shadcn/ui) |
| State | Zustand (local) + TanStack React Query (server) + React Context (global) |
| Backend | Python FastAPI + Uvicorn |
| Database | PostgreSQL 16 (primary) + Supabase (auth/storage) + SQLite (desktop/offline) |
| AI/LLM | OpenAI gpt-4o-mini (active) + Anthropic Claude (prompt caching) + Ollama (local, disabled) |
| Browser Automation | Playwright 1.48 |
| Desktop | Electron 28 (Win/Mac/Linux) |
| Extension | Chrome Extension Manifest V3 |
| Deployment | Railway + Vercel + Supabase (SaaS) / Docker + K8s + Helm (on-prem) |

### Repository Structure

```
/ (root)
├── src/                          # React frontend
│   ├── modules/                  # ★ Domain-separated feature modules (11 modules)
│   │   ├── recorder/             # Browser recording, playback, AI self-healing
│   │   │   ├── pages/            # PlaywrightRecorderPage (520KB), SelfHealing, ElementRepository
│   │   │   ├── components/       # ManualAssistCard, ElementRepairWizard, AITestGenerator, confidence/
│   │   │   └── lib/              # aiEnhancements, automation-linking, failureClassification
│   │   ├── test-management/      # Test cases, builder, execution, runs
│   │   │   ├── pages/            # UnifiedWorkflowEditor (538KB), TestRepository (340KB), +15 more
│   │   │   ├── components/       # FlowstralWorkflowEditor/, ReusableModulesManager, etc.
│   │   │   └── lib/              # test-management-service, results-ingestion-service
│   │   ├── api-testing/          # Multi-protocol API testing
│   │   │   ├── pages/            # EnhancedAPITesting (200KB), APICoverageMap, APIImport
│   │   │   ├── components/       # RequestBuilder, CollectionSidebar, etc. (16 files)
│   │   │   └── store/            # apiTestingStore (Zustand)
│   │   ├── performance/          # Load testing & virtual users
│   │   │   └── pages/            # VirtualUserGenerator, Performance
│   │   ├── mobile-testing/       # Mobile app testing via Maestro
│   │   │   ├── pages/            # MobileTestingPage
│   │   │   ├── components/       # MobileTestStudio, MobileDeviceLab, etc. (7 files)
│   │   │   └── store/            # mobileTestingStore (Zustand)
│   │   ├── accessibility/        # WCAG compliance scanning
│   │   │   └── pages/            # Accessibility
│   │   ├── visual-testing/       # Visual regression testing
│   │   │   └── pages/            # VisualTestingPage
│   │   ├── salesforce/           # Salesforce-specific tools
│   │   │   ├── pages/            # SalesforceToolsPage
│   │   │   ├── components/       # 19 Salesforce components + salesforce/ subfolder
│   │   │   └── lib/              # salesforce-api, salesforce-service, etc. (5 files)
│   │   ├── ai-testing/           # AI-powered testing
│   │   │   ├── pages/            # AITestingPage, FlowpilotPage
│   │   │   └── components/       # AIChatTesting, AIExplorerAgent, AIFlowExplorer
│   │   ├── dashboard/            # Dashboard & analytics
│   │   │   └── pages/            # Dashboard, Analytics, Results
│   │   └── platform/             # Cross-cutting (settings, integrations, defects, etc.)
│   │       ├── pages/            # Settings, Integrations, Defects, Requirements, etc. (23 pages)
│   │       └── components/       # PluginManagement, WorkspaceSwitcher
│   ├── pages/                    # Landing page + marketing pages only
│   │   ├── LandingPage.tsx
│   │   └── marketing/            # SmartRecorder, Pricing, About, etc.
│   ├── components/               # Shared layout & UI components
│   │   ├── ui/                   # 49 shadcn/ui primitives
│   │   ├── enterprise/           # Enterprise UI components
│   │   ├── StreamlinedLayout.tsx  # Main app layout
│   │   ├── AppSidebar.tsx        # Navigation sidebar
│   │   ├── LicenseGate.tsx       # License enforcement wrapper
│   │   └── ProtectedRoute.tsx    # Auth route guard
│   ├── stores/                   # Shared Zustand stores (testDataStore)
│   ├── contexts/                 # ThemeContext, AIContext, AuthContext
│   ├── hooks/                    # useExecutionWebSocket, custom hooks
│   ├── lib/                      # Shared utilities (api-config, electron-bridge, data-storage)
│   └── App.tsx                   # Root routing — imports from modules/*
├── backend/                      # FastAPI backend
│   └── app/
│       ├── main.py               # Entry point (313KB)
│       ├── routers/              # ★ Domain-grouped router subdirectories (10 groups)
│       │   ├── recorder/         # playwright_recorder_api, cdp_recorder_api, flowstral_*
│       │   ├── test_management/  # test_cases_crud_api, test_runs_api, test_plans_api, etc.
│       │   ├── api_testing/      # enhanced_api_testing_api, api_import_api, request_chaining_api
│       │   ├── performance/      # performance_api, protocol_recording_api, scale_api
│       │   ├── ai/               # ai_generation_api, ai_automation_api, vision_healing_api, etc.
│       │   ├── accessibility/    # accessibility_api, accessibility_scan_api, compliance_api
│       │   ├── visual_testing/   # visual_testing_api
│       │   ├── salesforce/       # salesforce_api, salesforce_auth
│       │   ├── exploration/      # exploration_api, nexus_exploratory_api, blaze_api, etc.
│       │   ├── platform/         # health_api, dashboard_api, secrets_api, license_api, etc.
│       │   └── integrations/     # jira_webhook
│       ├── services/             # 295+ services across 26 subdirectories
│       ├── schemas/              # Pydantic models
│       └── middleware/           # RBAC, tenant, trace logging
├── flowstral-engine/             # TypeScript recording/execution engine
│   └── src/                      # FlowstralEngine, ElementCollector, PlaywrightScriptGenerator
├── flowstral-extension/          # Chrome extension (MV3)
│   └── src/                      # background, content, sidepanel, lib
├── flowstral-desktop/            # Electron desktop app
│   └── src/main/                 # Main process, embedded browser, test executor
├── docs/                         # 270+ documentation files
└── supabase/                     # Database migrations
```

### Module Map

| Frontend Module | Backend Router Group | Key Concern |
|----------------|---------------------|-------------|
| `src/modules/recorder/` | `routers/recorder/` | Browser recording, AI self-healing |
| `src/modules/test-management/` | `routers/test_management/` | Test lifecycle (create → execute → report) |
| `src/modules/api-testing/` | `routers/api_testing/` | Multi-protocol API testing |
| `src/modules/performance/` | `routers/performance/` | Load testing, virtual users |
| `src/modules/mobile-testing/` | — | Mobile testing via Maestro CLI |
| `src/modules/accessibility/` | `routers/accessibility/` | WCAG compliance scanning |
| `src/modules/visual-testing/` | `routers/visual_testing/` | Visual regression testing |
| `src/modules/salesforce/` | `routers/salesforce/` | Salesforce-specific tools |
| `src/modules/ai-testing/` | `routers/ai/` | AI-powered test generation |
| `src/modules/dashboard/` | `routers/platform/` | Dashboard & analytics |
| `src/modules/platform/` | `routers/platform/` | Settings, integrations, cross-cutting |

Each module has its own `index.ts` barrel export and `README.md` documentation.

### Key Config Files

| File | Purpose |
|------|---------|
| `.env` | VITE_API_URL, Supabase keys, OpenAI key, LLM provider |
| `src/lib/api-config.ts` | Central API endpoint definitions, API_BASE_URL |
| `backend/app/config/llm_config.py` | LLM provider configuration |
| `package.json` | Frontend deps, build scripts, engine config |
| `backend/requirements.txt` | Python dependencies |
| `docker-compose.yml` | PostgreSQL dev setup |
| `docker-compose.full.yml` | Full production stack |

### Running Locally

```bash
docker-compose up          # PostgreSQL
npm run dev                # Frontend at localhost:8080
cd backend && uvicorn app.main:app --reload  # Backend at localhost:8000
```

---

## Component 1: Record & Playback

> Capture user interactions in a browser and produce Playwright scripts, structured test cases, and Action Graphs. Includes AI self-healing that auto-fixes broken selectors.

### Three Recording Systems

| System | How | Key Files |
|--------|-----|-----------|
| CDP Recorder | Backend launches browser via Chrome DevTools Protocol | `backend/app/routers/recorder/cdp_recorder_api.py`, `backend/app/services/cdp_recorder/` |
| Playwright Recorder | Extension sends actions to backend | `backend/app/routers/recorder/playwright_recorder_api.py` (44 endpoints, prefix `/api/playwright`) |
| Flowstral Pipeline | Full-stack: extension + Action Graph + multi-modal analysis | `backend/app/routers/recorder/flowstral_api.py` (prefix `/api/flowstral`) |

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/recorder/pages/PlaywrightRecorderPage.tsx` | ~520KB | Main recorder page — step list, suggestions, playback, AI auto-fix |

### AI Self-Healing Auto-Fix (v3.10.1+)

When a test step fails, the **Fix/Flag/Wrong** buttons on the test result card trigger the AI healing chain automatically — no manual element picking required.

**Flow:**
1. User clicks **🤖 Fix** (or **🚩 Flag** / **🚩 Wrong**) on a failed/incorrect step
2. Frontend calls `autoFixStepApi()` → `POST /api/ai/enhancements/auto-fix-step`
3. Backend runs **4-layer healing chain** (Knowledge → Deterministic → Vision AI → OCR)
4. If AI finds a fix → selector auto-applied in the step list, green ✅ badge shown
5. If AI fails → **ManualAssistCard appears inline** below the failed step (stays on test results modal)

**Key state variables** (PlaywrightRecorderPage.tsx):
- `autoFixingSteps: Set<number>` — tracks which steps are currently being auto-fixed (shows spinner)
- `autoFixResults: Map<number, { success, message }>` — stores fix results per step
- `manualAssistStep: number | null` — which step has the ManualAssistCard open (null = none)

**Buttons:**
- **"🤖 Auto-Fix All"** — appears in test result summary footer, fixes all failed steps at once
- Per-step **🤖 Fix** — auto-fixes individual failed steps
- Per-step **🚩 Flag** — flags as false positive + auto-fixes
- Per-step **🚩 Wrong** — flags wrong element + auto-fixes (for passed steps that clicked the wrong thing)
- Per-step **🔧 Manual** — opens ManualAssistCard inline for manual element fixing

### Manual Assist Card (v3.10.4+)

When AI auto-fix fails, the **ManualAssistCard** appears inline below the failed step with 3 modes:

1. **Paste Element**: User copies outerHTML from DevTools → backend parses it → generates 13 selector strategies ranked by reliability
2. **Enter Selector**: User types CSS/XPath/text selector directly → validated and formatted as Playwright locator
3. **Paste Screenshot**: User uploads screenshot of element area → Vision AI analyzes → suggests selectors

**Backend:**
- `POST /api/ai/enhancements/manual-assist` — single endpoint, 3 modes via `mode` field
- `backend/app/services/automation/dom_element_parser.py` — parses HTML into element dict for `EnhancedSelectorEngine`
- Reuses `EnhancedSelectorEngine.generate_robust_selectors()` for paste_element mode (13 strategies)
- Reuses `HealingOrchestrator` vision pipeline for paste_screenshot mode

**Frontend:**
- `src/modules/recorder/components/ManualAssistCard.tsx` — inline 3-tab card component
- `src/modules/recorder/lib/aiEnhancements.ts` — `manualAssistPasteElement()`, `manualAssistEnterSelector()`, `manualAssistScreenshot()` API helpers
- When user clicks "Use This" on a selector → step's selector is updated in-place via `setActions()`

**Key files:**
- `src/modules/recorder/lib/aiEnhancements.ts` — `autoFixStep()`, `detectFalsePositive()`, `explainFailure()`, `manualAssistPasteElement()`, `manualAssistEnterSelector()`, `manualAssistScreenshot()` API helpers
- `src/modules/recorder/components/ManualAssistCard.tsx` — inline 3-tab card for manual step fixing
- `src/modules/recorder/components/ElementRepairWizard.tsx` — 4-tab dialog (Manual, Pick, Debug, AI) for advanced repair
- `backend/app/routers/ai/ai_enhancements_api.py` — `/api/ai/enhancements/auto-fix-step` + `/api/ai/enhancements/manual-assist` endpoints
- `backend/app/services/automation/healing_orchestrator.py` — HealingOrchestrator backend service
- `backend/app/services/automation/dom_element_parser.py` — HTML → element dict parser

### False Positive Persistence

- `markStepAsFalsePositive()` → persists to backend via `saveFalsePositiveApi()`
- `unmarkFalsePositive()` → removes from backend via `removeFalsePositiveApi()`
- Flags survive page refresh (loaded on mount via `getFalsePositivesApi()`)
- Flaky step detection via `getFlakyStepsApi()` loaded after test runs

### Backend — Flowstral Services

**Directory:** `backend/app/services/flowstral/` (27 files)

| File | Purpose |
|------|---------|
| `flowstral_action_graph.py` | Action Graph representation (DAG of user actions) |
| `flowstral_action_graph_builder.py` | Builds Action Graph from recorded events |
| `flowstral_dom_pipeline.py` | DOM snapshot micro-pipeline |
| `flowstral_wcag_pipeline.py` | WCAG accessibility scan micro-pipeline |
| `flowstral_performance_pipeline.py` | Performance probe micro-pipeline |
| `flowstral_event_coalescer.py` | Coalesces rapid events (e.g., keystroke debouncing) |
| `flowstral_session.py` | Session management |
| `flowstral_websocket_manager.py` | WebSocket connection management |
| `flowstral_realtime_output.py` | Real-time output generation |
| `enhanced_playwright_generator.py` | Generates Playwright code from recordings |
| `salesforce_playwright_generator.py` | Salesforce-specific code generation |
| `robust_salesforce_generator.py` | Robust Salesforce generator with retry logic |
| `element_model_builder.py` | Element model construction |
| `element_model_service.py` | Element model persistence |
| `semantic_step_converter.py` | Converts actions to human-readable steps |
| `test_healer.py` | Self-healing test repair |
| `flowstral_agent_orchestrator.py` | Agent orchestration |
| `flowstral_artifacts.py` | Recording artifact management |
| `flowstral_gateway.py` | Gateway service |

### Backend — Flowstral Engine Services

**Directory:** `backend/app/services/flowstral_engine/` (9 files)

| File | Purpose |
|------|---------|
| `smart_finder.py` | SmartElementFinder — intent-based scoring (text:30, role:20, label:20, context:15, selector:10, visibility:5) |
| `code_generator.py` | FlowstralCodeGenerator — generates intent-based Playwright code |
| `engine.py` | Core engine orchestration |
| `self_healer.py` | Self-healing locator logic |
| `intelligent_waiter.py` | Smart waiting strategies |
| `page_intelligence.py` | Page analysis and understanding |
| `keywords.py` | Keyword definitions for NLP |
| `test_builder.py` | Builds tests from recorded actions |

### TypeScript Engine

**Directory:** `flowstral-engine/src/`

| File | Size | Purpose |
|------|------|---------|
| `FlowstralEngine.ts` | 18KB | Main engine orchestrating recording |
| `ElementCollector.ts` | 19KB | Collects element metadata from DOM |
| `PlaywrightScriptGenerator.ts` | 22KB | Generates Playwright scripts |
| `LocatorHealingRuntime.ts` | 18KB | Runtime locator healing |
| `SessionManager.ts` | 17KB | Recording session lifecycle |
| `TestUtilities.ts` | 18KB | Test utility functions |

Subdirectories: `collector/`, `core/`, `detection/`, `generator/`, `handlers/`, `healing/`, `locators/`, `runner/`, `types/`, `utils/`

### Chrome Extension (v1.1.0+)

**Directory:** `flowstral-extension/`

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest — permissions: activeTab, storage, tabs, scripting, sidePanel, webRequest |
| `src/background/background.js` | Service worker — uses centralized URLs from api-config.js |
| `src/content/content.js` | Content script — DOM event capture, auto-generates action IDs |
| `src/lib/api-config.js` | Centralized URL config — reads serverUrl/frontendUrl from chrome.storage.local |
| `src/lib/ai-enhancements.js` | AI API client — autoFixStep, saveFalsePositive, manualAssist (mirrors aiEnhancements.ts) |
| `src/lib/recorder-engine.js` | Core recording logic |
| `src/lib/action-coalescer-browser.js` | Event coalescing in browser |
| `src/sidepanel/sidepanel.html` | Side panel UI — 5 visible tabs: Record, Suggest, SF, Script, Run |
| `src/sidepanel/sidepanel.js` | SidebarController — recording, AI fix/flag/manual buttons per step, Open in Desktop |

**Extension-Desktop Sync (v3.10.5+):**
- All URLs centralized via `api-config.js` (no more hardcoded localhost)
- Actions have unique `id` field for AI healing chain compatibility
- 5 visible tabs: Record, Suggest, SF, Script, Run (previously Script/Run were hidden)
- Per-step AI buttons: 🤖 Fix, 🚩 Flag, 🔧 Manual (same as desktop)
- Inline Manual Assist card: Paste Element + Enter Selector modes
- "Open in Desktop" button saves session and opens `PlaywrightRecorderPage?sessionId=...`
- Settings sync to `chrome.storage.local` so background.js picks up URL changes

### Key Concepts

- **Action Graph**: DAG representing user actions with edges for flow dependencies
- **4 Parallel Micro-Pipelines**: During recording, DOM snapshot + WCAG scan + Performance probe + Action Graph update run concurrently
- **Selector Confidence**: 8+ selector strategies scored by reliability
- **Self-Healing**: 4-layer healing chain (Knowledge → Deterministic → Vision AI → OCR); supports 25+ enterprise apps (Salesforce, ServiceNow, SAP, Workday)
- **AI Auto-Fix**: Fix/Flag/Wrong buttons call `autoFixStepApi()` which runs the 4-layer healing chain and auto-applies the fix; falls back to Smart Suggestions only if AI fails

### API Endpoints

- `POST /api/flowstral/start-recording` — Start recording session
- `POST /api/flowstral/stop-recording` — Stop and finalize
- `GET /api/playwright/code` — Get generated Playwright code
- `POST /api/playwright/recorder/events` — Receive recorded events
- `POST /cdp-recorder/start` — Start CDP recording
- `POST /cdp-recorder/stop` — Stop CDP recording
- `POST /api/ai/enhancements/auto-fix-step` — AI auto-fix a broken step (4-layer healing chain)
- `POST /api/ai/enhancements/false-positive` — Save false positive flag
- `DELETE /api/ai/enhancements/false-positive/{test_id}/{step_id}` — Remove false positive flag
- `GET /api/ai/enhancements/false-positives/{test_id}` — Get all false positive flags for a test
- `GET /api/ai/enhancements/flaky-steps/{test_id}` — Get flaky step info
- `POST /api/ai/enhancements/explain-failure` — AI failure explanation with fix options
- `POST /api/ai/enhancements/detect-false-positive` — Vision-based false positive detection
- `POST /api/ai/enhancements/manual-assist` — Manual assist: parse HTML / validate selector / screenshot AI (3 modes)

---

## Component 2: Build (Test Builder)

> Visual no-code builder for composing test cases, AI generation from requirements, Gherkin conversion.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/test-management/pages/UnifiedWorkflowEditor.tsx` | ~538KB | Primary no-code/code test builder with 60+ step types |
| `src/modules/test-management/pages/TestRepository.tsx` | ~340KB | Test management hub (folders, suites, releases) |
| `src/modules/test-management/pages/TestPlayground.tsx` | ~1,858 lines | 10-tab interactive testing playground |
| `src/modules/test-management/components/FlowstralWorkflowEditor/` | Directory | Visual canvas-based workflow editor |

**FlowstralWorkflowEditor Sub-Components:**

| File | Purpose |
|------|---------|
| `CICDExporter.tsx` | Export to GitHub Actions, GitLab CI, Jenkins, Azure Pipelines |
| `LocatorBuilder.tsx` | Build and test element locators |
| `ScheduleManager.tsx` | Schedule test execution |
| `TestRunner.tsx` | Execute tests from builder |
| `TestSuiteManager.tsx` | Organize tests into suites |
| `VariableStore.tsx` | Manage test variables and data |
| `WorkflowNodes.tsx` | Visual workflow node definitions |

### Backend

| File | Prefix | Purpose |
|------|--------|---------|
| `backend/app/routers/test_management/test_cases_crud_api.py` | `/test-cases` | Test case CRUD (16 endpoints), PostgreSQL with in-memory fallback |
| `backend/app/routers/test_management/test_plans_api.py` | `/test-plans` | Test plan management (4 endpoints) |
| `backend/app/routers/test_management/gherkin_api.py` | `/api/gherkin` | BDD/Gherkin support (3 endpoints) |
| `backend/app/routers/ai/ai_generation_api.py` | `/ai` | AI test generation (28 endpoints) |
| `backend/app/routers/test_management/requirement_to_testcase_api.py` | `/api/req2tc` | Requirement-to-test-case conversion |

### Test Generation Pipeline

1. Parse requirement (JIRA story, text) with NLP
2. Build synthetic app model (screens, APIs, entities)
3. Generate scenario skeletons
4. LLM rewrite for natural language
5. Format as structured test cases (ISTQB, Gherkin, Markdown)

### Key Backend Services

| File | Purpose |
|------|---------|
| `backend/app/services/ai/enhanced_generation_service.py` | Enhanced test generation |
| `backend/app/services/ai/test_case_rewrite_service.py` | Test case rewriting and formatting |
| `backend/app/services/core/test_plan_service.py` | Test plan business logic |
| `backend/app/services/core/test_data_service.py` | Test data management |

---

## Component 3: Test Execution

> Execute test cases via Playwright automation, manual walkthrough, or CI/CD pipelines with real-time WebSocket progress.

### Three Execution Modes

| Mode | How | Where |
|------|-----|-------|
| Automated | Playwright browser automation via subprocess | Backend |
| Manual | Step-by-step human execution with evidence | Frontend (TestCaseExecution) |
| CI/CD | Headless execution with exit codes | Backend (TestRunnerService queue) |

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/test-management/pages/TestCaseExecution.tsx` | 54KB | Step-by-step execution UI with screenshots, evidence capture |
| `src/modules/test-management/pages/TestRuns.tsx` | — | Test run listing and management |
| `src/hooks/useExecutionWebSocket.ts` | — | WebSocket hook for real-time execution progress |

**WebSocket Message Types:**
- `step_start` / `step_complete` — Step lifecycle
- `self_healing` — Selector was healed
- `screenshot` — Screenshot captured
- `execution_complete` — Run finished
- `heartbeat` / `pong` — Keep-alive (25s interval)

### Backend

| File | Prefix | Purpose |
|------|--------|---------|
| `backend/app/routers/test_management/test_runs_api.py` | `/test-runs` | Test run execution and reporting (14 endpoints), WebSocket support |
| `backend/app/routers/test_management/automation_api.py` | `/automation` | Script conversion, test execution, locator analysis |
| `backend/app/routers/test_management/complex_verifications.py` | `/api/complex-verify` | Email/PDF/file verification (10 endpoints) |

### Key Backend Services

| File | Purpose |
|------|---------|
| `backend/app/services/executors/playwright_runner.py` | Browser automation with Playwright |
| `backend/app/services/executors/playwright_executor.py` | Windows subprocess-based execution |
| `backend/app/services/executors/test_executor_queue.py` | Queue-based async execution |
| `backend/app/services/executors/unified_runner_service.py` | Unified test execution interface |
| `backend/app/services/flowstral_engine/self_healer.py` | Self-healing locator logic |
| `backend/app/services/automation/healing_orchestrator.py` | **HealingOrchestrator** — chains all healing layers |

### Self-Healing Architecture (HealingOrchestrator)

**Coordinator:** `backend/app/services/automation/healing_orchestrator.py`
Chains all existing healing services with early-return-on-first-success:

| Layer | Service | Speed | Requires |
|-------|---------|-------|----------|
| 1 | `SelfHealingController.get_healing_suggestions()` | 0ms | Nothing (JSON lookup) |
| 2 | `_generate_alternative_selectors()` | 0ms | Nothing (string transforms) |
| 3 | `VisionSelfHealingService.heal_broken_selector()` | 2-5s | Screenshot + OPENAI_API_KEY |
| 4 | OCR `find_text_in_screenshot()` | 500ms | Screenshot + Tesseract |

- Budget-controlled: max 3 AI calls per run via `ai_automation_api._budget_state`
- Records successes to `SelfHealingController` for future runs (knowledge reuse)
- Wired into `TestExecutionService` for automatic healing during execution
- Also exposed via `POST /api/ai/enhancements/auto-fix-step` for frontend "Fix" button
- WebSocket events: `healing_chain_start`, `healing_layer_attempt`, `healing_chain_complete`

**Frontend integration (v3.10.1+):**
- `PlaywrightRecorderPage.tsx` — **Fix/Flag/Wrong buttons call `autoFixStepApi()` directly** for automatic healing; falls back to Smart Suggestions only if AI fails
- `PlaywrightRecorderPage.tsx` — "🤖 Auto-Fix All" button in test result summary fixes all failed steps at once
- `PlaywrightRecorderPage.tsx` — `autoFixingSteps` state (Set<number>) tracks in-progress fixes; `autoFixResults` (Map) stores outcomes
- `ElementRepairWizard.tsx` — Advanced 4-tab repair dialog (Manual, Pick, Debug, AI) for cases where auto-fix fails
- `src/modules/recorder/lib/aiEnhancements.ts` — `autoFixStep()`, `detectFalsePositive()`, `explainFailure()`, `saveFalsePositive()`, `removeFalsePositive()`, `getFalsePositives()`, `getFlakySteps()` API helpers

### Complex Verifications

- **Email**: MS 365 and Gmail verification
- **PDF**: Content extraction and validation
- **File**: Download verification and content checks

---

## Component 4: Mobile Testing

> Native mobile app testing via Maestro CLI with device lab management, test flows, and execution.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/mobile-testing/pages/MobileTestingPage.tsx` | 186 lines | Hub with 6 tabs: studio, flows, device-lab, runs, inspector, tools |
| `src/modules/mobile-testing/components/MobileDeviceSelector.tsx` | 532 lines | Device emulation selection (50+ profiles, network throttling) |

**Sub-Components** (`src/components/mobile-testing/`):

| File | Purpose |
|------|---------|
| `MobileTestStudio.tsx` | Maestro Studio recording — start/stop, YAML flow editor, real-time console |
| `MobileTestFlows.tsx` | Saved flow management — CRUD, folders, import/export YAML, templates |
| `MobileDeviceLab.tsx` | Device management — install/uninstall apps, screenshots, logs |
| `MobileTestRuns.tsx` | Execution history — stats, filtering, detailed reports |
| `MobileInspector.tsx` | Element hierarchy viewer — selector generation, property inspection |
| `MobileAdvancedTools.tsx` | Deep links, push notifications, biometrics, network/geo mocking |

### State Management

**Zustand Store:** `src/modules/mobile-testing/store/mobileTestingStore.ts`

Key state: `activeTab`, `isStudioRunning`, `maestroInstalled`, `nativeDevices`, `selectedPlatform`, `appBundleId`, `flows`, `folders`, `testRuns`, `studioOutput`

### Key Types

```typescript
type MobilePlatform = 'ios' | 'android'
type FlowPriority = 'critical' | 'high' | 'medium' | 'low'
type TestRunStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'error'
interface MobileTestFlow { id, name, description, yaml, app_bundle_id, platform, tags, priority, folder_id }
interface MobileTestRun { id, flow_id, flow_name, platform, device, status, duration_ms, steps_total/passed/failed }
```

### Integration

- Uses `electron-bridge` for native device communication
- Maestro CLI for iOS/Android test execution
- YAML-based test flow definitions
- Device logs via logcat (Android) / syslog (iOS)

---

## Component 5: API Testing

> Multi-protocol API testing with collections, environments, request chaining, assertions, Monaco code editor, and spec import with automatic base URL detection.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/api-testing/pages/EnhancedAPITesting.tsx` | ~200KB | Main API testing page — builder, import, execute, chains, environments |

**Sub-Components** (`src/modules/api-testing/components/`):

| File | Purpose |
|------|---------|
| `RequestBuilder.tsx` | Build API requests — URL, method, headers, body (Monaco editor), auth, assertions |
| `RequestChainBuilder.tsx` | Chain multiple API calls with variable extraction (JSONPath, regex, headers) |
| `CollectionSidebar.tsx` | Organize requests into collections/folders, drag-drop reorder, bulk delete, inline rename, run all |
| `EnvironmentManager.tsx` | Manage environments (dev, staging, prod) with variable substitution |
| `AssertionsPanel.tsx` | Assertion editor — 11 types, multiple operators, pass/fail display |
| `ResponseTreeExplorer.tsx` | JSON response tree viewer with copy-path |
| `ChainResultsView.tsx` | Chain execution results with per-step detail |
| `ChainStepCard.tsx` | Individual chain step result card |
| `constants.ts` | ASSERTION_TYPES, ASSERTION_OPERATORS, AssertionConfig type |
| `TabErrorBoundary.tsx` | Error boundary for API testing tab |

### Recent Enhancements (v3.7.0 — v3.10.1)

**Monaco Code Editor:**
- Body editor uses Monaco with JSON/XML/GraphQL syntax highlighting
- Response body displayed in read-only Monaco with auto-detected language
- Format button (Ctrl+L) for JSON/XML auto-prettify
- Ctrl+Enter sends request, Ctrl+S saves

**Spec Import with Base URL Detection (v3.10.1):**
- 5-layer base URL resolution chain:
  1. User-entered `importBaseUrl` (editable input field)
  2. Backend `parsedSpec.base_url` (from `APISpecParser._extract_base_url()`)
  3. OpenAPI 3.x `servers[0].url`
  4. Swagger 2.0 `host + basePath + schemes`
  5. Raw spec content extraction (client-side JSON/YAML parsing as last resort)
- Client-side spec parsing runs BEFORE backend call for immediate detection
- YAML specs: regex extraction of `servers:`, `host:`, `basePath:`
- Resolved base URL shown in "Parsed Endpoints" card description
- Console logging (`[API Import]`) for debugging import flow
- `resolveBaseUrl()` function defined inside parsed spec preview section

**Collection Sidebar (v3.10.0+):**
- Visible trash icon button on collection header for bulk delete
- Multi-select mode with checkboxes on each request
- Select All / Deselect All / Delete Selected controls
- Also available via dropdown: "Select & Delete..." and "Delete All"
- Drag-and-drop reorder between folders
- Run individual requests or entire collections

**Inline Rename (v3.10.2+):**
- **Folder rename**: inline input appears inside the folder row (replaces folder name) — no more floating input
- **Request rename**: via context menu "Rename" or double-click on request name
- Both use `onBlur` with 150ms delay to prevent accidental submission when dropdown closes
- Rename state managed at sidebar level, passed down through FolderNode/EndpointGroup/RequestItem

**Assertions & Schema Validation (v3.10.2+):**
- JSON Schema assertions: schema string is parsed from JSON before `jsonschema.validate()` call
- Inferred JSON Schema: backend `SchemaInferenceEngine.infer_schema()` auto-generates schema from response
- "Matches Baseline" (Snapshot): regression testing — stores "known-good" response and compares future responses
- 11 assertion types: status_code, response_time, jsonpath, schema, contains, not_contains, regex, header, equals, xpath, matches_baseline

**Request URL Handling:**
- `addRequest()` stores both `url` (full URL with base) and `path` (path only)
- `openRequestInBuilder()` resolves URL: environment base_url → collection base_url → stored URL
- `onAddToTestSuite` callback passes `fullUrl` from RequestBuilder to preserve complete URL on save-back
- `updateRequest()` uses `testCase.fullUrl || existingReq.url` to avoid stripping base URL

### State Management

**Zustand Store:** `src/modules/api-testing/store/apiTestingStore.ts` (with `devtools` + `persist` + `immer` middleware)

Key state: saved requests, request chains, collections, folders, environments, variables

Key actions:
- `addRequest(data, folderId?)` — creates request in active collection
- `updateRequest(id, updates)` — updates existing request via `Object.assign`
- `openRequestInBuilder(id)` — loads request into builder with URL resolution
- `updateCollection(id, updates)` — updates collection metadata (persists via `set()` + debounced save)
- `_saveCollectionNow(id)` — immediate (non-debounced) save to DB + localStorage

### Backend

| File | Prefix | Endpoints | Purpose |
|------|--------|-----------|---------|
| `backend/app/routers/api_testing/enhanced_api_testing_api.py` | `/api/v2/testing` | 46 | Multi-protocol API testing (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, AMQP) |
| `backend/app/routers/api_testing/api_import_api.py` | `/api/import` | 9 | OpenAPI/HAR/Postman import, export, test generation |
| `backend/app/routers/api_testing/request_chaining_api.py` | `/api/chain` | 9 | Request chaining for API testing |

### Key Backend Services

**Directory:** `backend/app/services/api_testing/`

| Service | Purpose |
|---------|---------|
| `EnhancedAPITestEngine` | Core multi-protocol test execution |
| `APISpecParser` | Parses OpenAPI/Swagger/Postman/HAR specs; `_extract_base_url()` for base URL |
| `DatabaseConnector` | Database connectivity for API tests |
| `TestExecutionEngine` | Test execution orchestration |
| `ServiceVirtualization` | Mock service responses |
| `ReportingEngine` | Test result reporting |
| `EnvironmentManager` | Environment variable management |
| `OpenAPIValidator` | OpenAPI spec validation |
| `SchemaInferenceEngine` | Auto-infer JSON schemas from responses |
| `DataDrivenEngine` | Data-driven test execution |

### Supported Protocols

REST, SOAP/WSDL, GraphQL, gRPC, Kafka, MQTT, WebSocket, AMQP (RabbitMQ)

### Key API Endpoints

- `POST /api/v2/testing/execute` — Execute API test
- `POST /api/import/spec` — Import OpenAPI/Swagger spec (returns `parsed_spec` with `base_url`, `servers`, `paths`)
- `POST /api/import/spec/file` — Import spec via file upload
- `GET /api/import/fetch-url?url=` — Fetch spec from URL (backend proxy for CORS)
- `POST /api/import/har` — Import HAR file
- `POST /api/import/generate-tests` — Generate tests from API specs
- `POST /api/chain/execute` — Execute request chain

---

## Component 6: Performance Testing

> Load testing with virtual user simulation, protocol recording, and multiple load patterns.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/performance/pages/Performance.tsx` | 89KB | Performance testing UI — scenarios, execution, results, charts |

### Backend

| File | Prefix | Endpoints | Purpose |
|------|--------|-----------|---------|
| `backend/app/routers/performance/performance_api.py` | `/performance` | 80 | Load testing engine, transaction analysis, metrics |
| `backend/app/routers/performance/protocol_recording_api.py` | `/api/protocol-recording` | 13 | HTTP traffic capture during browser sessions |
| `backend/app/routers/performance/scale_api.py` | `/api/v2` | 8 | Paginated queries for 100K+ test cases |

### Key Backend Services

**Directory:** `backend/app/services/performance/`

| Feature | Description |
|---------|-------------|
| Virtual User Simulation | Concurrent user generation with configurable behavior |
| Protocol Recording | Captures HTTP traffic during browser sessions |
| HAR Import/Export | Import/export HTTP Archive files |
| Script Generation | Generate scripts for QAAI, k6, JMeter formats |
| Headless Execution | Run performance tests without browser UI |
| Transaction Analysis | Response time percentiles, throughput, error rates |

### 8 Load Patterns

1. **Constant** — Fixed user count
2. **Ramp** — Gradual increase
3. **Spike** — Sudden burst
4. **Stress** — Beyond capacity
5. **Soak** — Extended duration
6. **Breakpoint** — Find failure threshold
7. **Wave** — Oscillating load
8. **Custom** — User-defined pattern

### Key API Endpoints

- `POST /performance/start` — Start load test
- `GET /performance/results/{id}` — Get test results
- `POST /api/protocol-recording/start` — Start traffic capture
- `POST /api/protocol-recording/stop` — Stop and export HAR
- `POST /performance/generate-script` — Generate load test script

---

## Component 7: Accessibility Testing

> WCAG compliance scanning with axe-core, report generation, and AI-powered analysis.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/accessibility/pages/Accessibility.tsx` | 347 lines | URL-based scanner — level selection (A/AA/AAA), component scans, issue filtering |

### Types

```typescript
interface AccessibilityIssue { id, rule, impact, description, element, suggested_fix, wcag_criterion }
// impact: 'critical' | 'serious' | 'moderate' | 'minor'
interface ScanResult { scan_id, url, summary: { total, critical, serious, moderate, minor }, issues, timestamp }
```

### Backend

| File | Prefix | Purpose |
|------|--------|---------|
| `backend/app/routers/accessibility/accessibility_api.py` | `/api/accessibility` | Main scan endpoint (10 endpoints) |
| `backend/app/routers/accessibility/accessibility_scan_api.py` | `/api/a11y` | V2 scanning with reports (6 endpoints) |

### Key Backend Services

**Directory:** `backend/app/services/accessibility/`

| File | Purpose |
|------|---------|
| `axe_scanner.py` | Standalone sync script — launches Playwright, injects axe-core v4.8.4 CDN, runs scan |
| `axe_core_scanner.py` | Async scanner wrapper |
| `accessibility_report_generator.py` | HTML/JSON/Markdown report generation |

**Related AI Services:**
- `backend/app/services/agents/accessibility_agent.py` — AI-powered analysis
- `backend/app/services/agents/accessibility_compliance.py` — WCAG compliance checking
- `backend/app/services/llm/accessibility_report_service.py` — LLM report generation

### Scanning Architecture

1. Subprocess-based execution (Windows asyncio safe)
2. Launch headless Chrome, navigate to URL
3. Inject axe-core v4.8.4 from CDN
4. Run with WCAG2A/AA/2.1A/2.1AA rules
5. Optional component-selector targeting
6. Return violations + HTML content as JSON
7. Generate reports in multiple formats

### Key API Endpoints

- `POST /api/accessibility/scan` — Run axe-core scan
- `POST /api/a11y/scan` — V2 scan with report generation
- `GET /api/a11y/report/{scan_id}` — Get report (HTML/JSON/Markdown)
- `POST /api/a11y/batch-scan` — Scan multiple URLs concurrently

---

## Component 8: Visual Testing

> Visual regression testing with 6 comparison modes, baseline management, and diff visualization.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/visual-testing/pages/VisualTestingPage.tsx` | 1324 lines | Dashboard, Compare, Baselines, Recent Diffs tabs |

### 6 Comparison Modes

| Mode | Description |
|------|-------------|
| `pixel_perfect` | Exact pixel-by-pixel comparison |
| `anti_aliased` | Tolerant of anti-aliasing differences (recommended) |
| `perceptual` | Perceptual hash (aHash) — robust against scaling/compression |
| `structural` | SSIM (Structural Similarity Index) |
| `layout` | Layout-only comparison (ignoring content) |
| `ai_semantic` | AI-powered semantic comparison using Claude Vision |

### Types

```typescript
interface Baseline { test_name, path, file_size, modified_at, dimensions, created_at }
interface IgnoreRegion { x, y, width, height, name, reason }
interface ComparisonResult { passed, diff_percentage, diff_pixel_count, total_pixels, mode, threshold, ssim_score, perceptual_hash_baseline, perceptual_hash_actual, mismatch_regions, diff_image_base64 }
```

### Backend

| File | Prefix | Purpose |
|------|--------|---------|
| `backend/app/routers/visual_testing/visual_testing_api.py` | `/api/visual-testing` | Compare, baselines, capture, diffs (15 endpoints) |

### Key Backend Service

**File:** `backend/app/services/automation/visual_testing_engine.py`

| Class | Purpose |
|-------|---------|
| `ComparisonMode` | Enum of 6 modes |
| `IgnoreRegion` | Dataclass for masked regions |
| `ComparisonOptions` | Threshold, mode, tolerance, ignore regions, viewport |
| `ComparisonResult` | Pass/fail, diff %, SSIM score, mismatch regions |
| `PerceptualHasher` | Average hash (16x16 grid aHash algorithm) |
| `VisualTestingEngine` | Main orchestrator — dispatches to algorithm by mode |

**Dependencies:** PIL/Pillow (image processing), NumPy (numerical computation)

### Key API Endpoints

- `POST /api/visual-testing/compare` — Compare two images
- `POST /api/visual-testing/compare-by-name` — Compare against stored baseline
- `POST /api/visual-testing/baselines` — Upload new baseline
- `GET /api/visual-testing/baselines` — List all baselines
- `POST /api/visual-testing/capture` — Screenshot from URL
- `POST /api/visual-testing/batch-compare` — Batch comparison
- `GET /api/visual-testing/diffs` — List diff images

---

## Cross-Cutting Concerns

### Authentication & Authorization

- **JWT Tokens** via python-jose
- **RBAC Middleware** — decorator-based permission checks: `@require_permission("test_cases:create")`
- **Multi-Tenancy** — tenant isolation via TenantContextMiddleware
- **OAuth2** — Salesforce and external integrations
- **Middleware Stack** (outermost to innermost): CORS → RBAC → Tenant → TraceLogging

### AI/LLM Integration

| Provider | Status | Use Case |
|----------|--------|----------|
| OpenAI gpt-4o-mini | Active | Test generation, rewrites, JSON formatting |
| Anthropic Claude | Active (dev) | Complex reasoning, prompt caching |
| Ollama/vLLM | Disabled | Local inference on DGX |

**Key Files:**
- `backend/app/services/llm/` — LLM services with prompt caching
- `backend/app/services/ai/` — AI generation, failure analysis
- `backend/app/config/llm_config.py` — Provider configuration
- `backend/app/routers/ai/ai_generation_api.py` — 28 AI endpoints (prefix `/ai`)

### WebSocket Real-Time

- **Test Execution**: `wss://API_BASE_URL/test-runs/ws/{executionId}` — step progress, screenshots, self-healing events
- **Agent Control**: `ws://localhost:8000/ws/agent` — desktop agent registration, commands
- **Flowstral Session**: Recording session streaming

### Database Pattern

PostgreSQL (primary) with **in-memory fallback**:
- `backend/app/services/storage/database.py` — Unified client
- `backend/app/services/storage/postgres_direct.py` — Direct PostgreSQL
- Auto-migration on startup via `auto_migrate.py`
- Supabase for auth and file storage

### Electron Desktop

- `flowstral-desktop/src/main/index.js` — Main process (1681 lines)
- `embedded-browser.js` — BrowserView recorder
- `test-executor.js` — Playwright test runner
- `cloud-connector.js` — Cloud API sync
- HashRouter for file:// protocol, BrowserRouter for web
- Auto-detection: `window.electron || navigator.userAgent.includes('electron')`

---

## Conventions & Patterns

1. **Frontend**: Organized into `src/modules/{domain}/` with pages/, components/, lib/, store/ subdirectories. Shared utilities in `src/lib/`, `src/contexts/`, `src/hooks/`, `src/components/ui/`. Path alias `@/` = `src/`
2. **Backend**: Routers in `backend/app/routers/{domain}/`, services in `backend/app/services/`, Pydantic schemas in `backend/app/schemas/`
3. **State**: Zustand stores co-located with their modules (e.g., `src/modules/api-testing/store/`), middleware: `devtools` + `persist` + `immer`
4. **Styling**: Tailwind CSS utility classes, CSS variables for theming, dark mode via `dark:` prefix
5. **API calls**: Axios with centralized base URL from `api-config.ts`
6. **Error boundaries**: TabErrorBoundary pattern for isolated failures
7. **License gating**: `LicenseGate` wrapper for enterprise features
8. **Lazy loading**: Heavy pages (API Testing) lazy-loaded to prevent crash propagation
9. **In-memory fallback**: All DB operations fall back to in-memory when PostgreSQL unavailable
10. **Subprocess execution**: Playwright runs in subprocess on Windows to avoid asyncio conflicts

---

## Quick Reference — All API Router Prefixes

| Group | Router | Prefix | Key Purpose |
|-------|--------|--------|-------------|
| **recorder/** | playwright_recorder_api | `/api/playwright` | Playwright recording (44 endpoints) |
| | cdp_recorder_api | `/cdp-recorder` | CDP recording |
| | flowstral_api | `/api/flowstral` | Recording sessions |
| | flowstral_engine_api | `/api/flowstral/engine` | Engine operations |
| **test_management/** | test_cases_crud_api | `/test-cases` | Test case CRUD (16 endpoints) |
| | test_runs_api | `/test-runs` | Test execution (14 endpoints) |
| | test_plans_api | `/test-plans` | Test plans |
| | automation_api | `/automation` | Script conversion, execution |
| | gherkin_api | `/api/gherkin` | BDD/Gherkin support |
| | requirement_to_testcase_api | `/api/req2tc` | Req-to-test conversion |
| | complex_verifications | `/api/complex-verify` | Email/PDF/file checks |
| **api_testing/** | enhanced_api_testing_api | `/api/v2/testing` | Multi-protocol API testing (46 endpoints) |
| | api_import_api | `/api/import` | OpenAPI/HAR/Postman import |
| | request_chaining_api | `/api/chain` | Request chaining |
| **performance/** | performance_api | `/performance` | Load testing (80 endpoints) |
| | protocol_recording_api | `/api/protocol-recording` | HTTP traffic capture |
| | scale_api | `/api/v2` | Paginated queries |
| **ai/** | ai_generation_api | `/ai` | Test generation, triage (28 endpoints) |
| | ai_automation_api | `/ai-automation` | Element resolution, failure analysis |
| | ai_enhancements_api | `/api/ai/enhancements` | False positives, flaky detection |
| | vision_healing_api | `/api/vision` | Vision-based healing |
| | ai_testing | `/api/ai-testing` | AI testing |
| | llm_api | `/api/llm` | LLM gateway |
| **accessibility/** | accessibility_api | `/api/accessibility` | A11y scans (10 endpoints) |
| | accessibility_scan_api | `/api/a11y` | A11y v2 with reports |
| | compliance_api | `/api/compliance` | Compliance checking |
| **visual_testing/** | visual_testing_api | `/api/visual-testing` | Visual regression (15 endpoints) |
| **salesforce/** | salesforce_api | `/api/salesforce` | Salesforce integration |
| | salesforce_auth | `/api/salesforce/auth` | Salesforce OAuth2 |
| **exploration/** | exploration_api | `/exploration` | Autonomous exploration |
| | nexus_exploratory_api | `/api/nexus` | Nexus testing |
| | blaze_api | `/api/blaze` | Blaze testing |
| **platform/** | health_api | `/health` | Health checks |
| | dashboard_api | `/dashboard` | Dashboard metrics |
| | license_api | `/api/license` | License management |
| | secrets_api | `/api/secrets` | Secrets vault |
| | database_api | `/api/db` | Database CRUD |
| | defects_api | `/defects` | Defect management |
| | requirements_api | `/api/requirements` | Requirements management |
| | project_management_api | `/api/projects` | Project management |
| | framework_analyzer_api | `/api/framework` | Framework detection |
| | code_alchemy_api | `/api/code-alchemy` | Repository import |

---

## Updating This File

**This CLAUDE.md must be updated whenever:**
- New components, pages, or API endpoints are added
- File paths change due to refactoring
- New services or stores are created
- Architecture patterns change
- New integrations are added

When making changes to the codebase, update the relevant section of this file to keep it accurate as the primary reference for all future planning and execution.

---

## Quick Reference: Common Commands

| Action | Command |
|--------|---------|
| Push + build + release | See "Push & Release Procedure" above — do ALL steps when user says "push" |
| Start backend (dev) | `cd C:\QAAI && python -m uvicorn backend.app.main:app --reload --port 8000` |
| Start frontend (dev) | `cd C:\QAAI && npm run dev` |
| Build webapp only | `cd C:\QAAI && npm run build` |
| Build Electron | `cd C:\QAAI\flowstral-desktop && npm run build:win` |
| List releases | `"C:\Program Files\GitHub CLI\gh.exe" release list --repo maddynolan/QAOne --limit 5` |
| gh CLI path | `"C:\Program Files\GitHub CLI\gh.exe"` (not on PATH, use full path) |
