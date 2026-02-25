# CLAUDE.md — QAAI/Flowstral Platform Reference

> **This file is the starting reference for all Claude sessions working on this codebase.**
> It must be kept up-to-date whenever changes are made to components, APIs, or architecture.
> Last updated: 2026-02-24

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
| Deployment | Hetzner + Coolify (recommended) / Railway + Vercel + Supabase (SaaS) / Docker + K8s + Helm (on-prem) / GitHub Actions CI/CD |

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
│   │       ├── pages/            # Settings, Integrations, Defects, Requirements, AuditLog, etc. (24 pages)
│   │       └── components/       # PluginManagement, WorkspaceSwitcher
│   ├── pages/                    # Landing page + marketing pages only
│   │   ├── LandingPage.tsx
│   │   └── marketing/            # SmartRecorder, Pricing, About, Compare, CostCalculator, Blog, Privacy, etc.
│   ├── components/               # Shared layout & UI components
│   │   ├── ui/                   # 49 shadcn/ui primitives
│   │   ├── enterprise/           # Enterprise UI components
│   │   ├── StreamlinedLayout.tsx  # Main app layout
│   │   ├── AppSidebar.tsx        # Navigation sidebar
│   │   ├── GlobalErrorBoundary.tsx # App-level error boundary
│   │   ├── LicenseGate.tsx       # License enforcement wrapper
│   │   └── ProtectedRoute.tsx    # Auth + RBAC route guard
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
│       ├── scripts/              # CLI scripts (seed_demo_data.py)
│       ├── services/             # 295+ services across 26 subdirectories
│       ├── schemas/              # Pydantic models
│       └── middleware/           # RBAC, tenant, trace logging, rate limiting
├── flowstral-engine/             # TypeScript recording/execution engine
│   └── src/                      # FlowstralEngine, ElementCollector, PlaywrightScriptGenerator
├── flowstral-extension/          # Chrome extension (MV3)
│   └── src/                      # background, content, sidepanel, lib
├── flowstral-desktop/            # Electron desktop app
│   └── src/main/                 # Main process, embedded browser, test executor
├── nginx/                        # Nginx security configuration
│   └── default.conf              # OWASP headers, gzip, rate limiting, API proxy
├── helm/qaai/                    # Kubernetes Helm chart
│   ├── values.yaml               # Chart values (replicas, resources, ingress)
│   └── templates/                # 8 K8s templates (deployments, services, ingress)
├── prometheus/                   # Prometheus scrape config
├── grafana/                      # Grafana datasources + dashboards
├── deploy/                       # Deployment configurations
│   ├── coolify/                  # Coolify setup guide + env template
│   └── pgbouncer/                # PgBouncer connection pooling config
├── .github/workflows/            # CI/CD pipelines (ci, staging, prod, security, deploy-coolify)
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
| `src/modules/mobile-testing/` | `routers/test_management/` | Mobile testing via Maestro CLI + server persistence |
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
| `nginx/default.conf` | Nginx security headers + reverse proxy config |
| `helm/qaai/values.yaml` | Kubernetes Helm chart values |
| `.github/workflows/ci.yml` | CI pipeline (build + test + Docker) |
| `.github/workflows/deploy-coolify.yml` | Coolify CD pipeline (build + push GHCR + webhook deploy) |
| `deploy/coolify/.env.example` | Coolify environment template (DATABASE_URL, Redis, S3, AI keys) |
| `deploy/pgbouncer/pgbouncer.ini` | PgBouncer connection pooling (transaction mode, 200 max clients) |
| `prometheus/prometheus.yml` | Prometheus scrape configuration |

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

### Cross-Browser Recording (v3.11.6+)

The Recorder supports Chromium, Firefox, and WebKit (Safari) via a browser selection dropdown in the toolbar.

**Frontend:**
- `PlaywrightRecorderPage.tsx` — `selectedBrowser` state (`'chromium' | 'firefox' | 'webkit'`), passed as `browserType` in IPC/backend calls
- `RecordingControlsPanel.tsx` — `<Select>` dropdown with Globe icon for browser engine selection (after network selector)

**Electron:**
- `playwright-recorder.js` — imports `chromium`, `firefox`, `webkit` from `playwright`; `launchBrowserWithFallback()` accepts `browserType` parameter and selects the matching engine; channel fallback variants (chrome, msedge) only used for Chromium
- `index.js` — `playwright-recorder-start` handler extracts `browserType` from args and passes to `playwrightRecorder.start(url, { browserType })`

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/recorder/pages/PlaywrightRecorderPage.tsx` | ~520KB | Main recorder page — step list, suggestions, playback, AI auto-fix, cross-browser selection |

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
| `manifest.json` | MV3 manifest — permissions: activeTab, storage, tabs, scripting, sidePanel; optional: webRequest |
| `src/background/background.js` | Service worker — centralized URLs, HTTPS enforcement for non-localhost backends |
| `src/content/content.js` | Content script — DOM event capture, auto-generates action IDs, password masking |
| `src/lib/api-config.js` | Centralized URL config — reads serverUrl/frontendUrl from chrome.storage.local |
| `src/lib/ai-enhancements.js` | AI API client — autoFixStep, saveFalsePositive, manualAssist (mirrors aiEnhancements.ts) |
| `src/lib/recorder-engine.js` | Core recording logic |
| `src/lib/network-capture.js` | Network traffic capture — sensitive header masking (Authorization, Cookie, etc.) |
| `src/lib/action-coalescer-browser.js` | Event coalescing in browser |
| `src/sidepanel/sidepanel.html` | Side panel UI — 5 visible tabs: Record, Suggest, SF, Script, Run |
| `src/sidepanel/sidepanel.js` | SidebarController — recording, AI fix/flag/manual buttons per step, Open in Desktop |
| `PRIVACY_POLICY.md` | Extension privacy policy (required for Chrome Web Store) |

**Chrome Web Store Compliance (v3.13.3+):**
- `optional_host_permissions` restricted from `<all_urls>` to `["https://*/*", "http://localhost/*", "http://127.0.0.1/*"]`
- Sensitive headers masked in network captures: Authorization, Cookie, Set-Cookie, X-API-Key, X-Auth-Token, X-CSRF-Token → `[MASKED]`
- Correlation patterns (auto-detection of API keys/tokens) disabled in extension, kept in Desktop app
- Password fields and sensitive inputs masked as `[MASKED]` in recorded actions
- Auto-dropdown scanning disabled (was auto-triggering clicks on page elements)
- Backend URL validation enforces HTTPS for non-localhost URLs
- Privacy policy linked from manifest.json `homepage_url` and web-hosted at `/privacy` (section 8)
- Full unmasked HAR/network capture only available in Desktop app

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
| `backend/app/routers/test_management/test_cases_crud_api.py` | `/test-cases` | Test case CRUD (20 endpoints), PostgreSQL with in-memory fallback, version control |
| `backend/app/routers/test_management/test_plans_api.py` | `/test-plans` | Test plan management (4 endpoints) |
| `backend/app/routers/test_management/gherkin_api.py` | `/api/gherkin` | BDD/Gherkin support (3 endpoints) |
| `backend/app/routers/ai/ai_generation_api.py` | `/ai` | AI test generation (28 endpoints) |
| `backend/app/routers/test_management/requirement_to_testcase_api.py` | `/api/req2tc` | Requirement-to-test-case conversion |
| `backend/app/routers/test_management/mobile_flows_api.py` | `/api/mobile` | Mobile test flow server persistence (8 endpoints) |

### Version Control (v3.13.2+)

No-code test cases now have full version history with JSONB snapshots, diff computation, and non-destructive revert.

**Frontend:** `src/modules/test-management/components/VersionHistoryPanel.tsx` — timeline view, color-coded change types, diff rendering, snapshot preview, revert confirmation dialog.

**Key API Endpoints:**
- `GET /test-cases/{id}/versions` — Paginated version history (newest first)
- `GET /test-cases/{id}/versions/{version_id}` — Full JSONB snapshot for a version
- `POST /test-cases/{id}/versions/compare` — Diff between any two versions
- `POST /test-cases/{id}/versions/{version_id}/revert` — Non-destructive revert (creates new version of type 'restored')

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
| `backend/app/services/core/version_control_service.py` | Test case version control — JSONB snapshots, diff computation, non-destructive revert |

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

> Native mobile app testing via Maestro CLI with device lab management, test flows, execution, inspector, and advanced tools. Fully wired to real device IPC as of v3.11.6.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/mobile-testing/pages/MobileTestingPage.tsx` | 186 lines | Hub with 6 tabs: studio, flows, device-lab, runs, inspector, tools |
| `src/modules/mobile-testing/components/MobileDeviceSelector.tsx` | 532 lines | Device emulation selection (50+ profiles, network throttling) |

**Sub-Components** (`src/modules/mobile-testing/components/`):

| File | Purpose |
|------|---------|
| `MobileTestStudio.tsx` | Maestro Studio recording — start/stop, YAML flow editor, real-time console output via `mobile-studio-output` IPC events |
| `MobileTestFlows.tsx` | Saved flow management — CRUD, folders, import/export YAML, templates, run via `mobile.runNativeTest()` |
| `MobileDeviceLab.tsx` | Device management — real screenshots (adb/xcrun), live log streaming (logcat/syslog), app install/uninstall via IPC, file browser for APK/IPA |
| `MobileTestRuns.tsx` | Execution history — stats, filtering, detailed reports, re-run button (finds flow → re-executes via IPC) |
| `MobileInspector.tsx` | Element hierarchy viewer — real device hierarchy via `uiautomator dump` XML with `parseXmlHierarchy()` parser, fallback to sample data |
| `MobileAdvancedTools.tsx` | Deep links, push notifications, biometrics, geolocation, network conditioning, orientation/appearance/locale/font scale — all wired to real IPC |

### IPC Architecture (v3.11.6+)

All mobile operations flow through 4 layers: **MaestroRunner → IPC handler → preload → electron-bridge → React component**.

**MaestroRunner** (`flowstral-desktop/src/main/lib/maestro-integration.js`):

| Method | Android CLI | iOS CLI |
|--------|-------------|---------|
| `takeScreenshot(deviceId)` | `adb shell screencap` + `adb pull` | `xcrun simctl io screenshot` |
| `startLogCapture(deviceId, filter)` | `adb logcat` (spawned) | `xcrun simctl spawn log stream` (spawned) |
| `installApp(appPath, deviceId)` | `adb install -r` | `xcrun simctl install` |
| `uninstallApp(bundleId, deviceId)` | `adb uninstall` | `xcrun simctl uninstall` |
| `getElementHierarchy(deviceId)` | `adb shell uiautomator dump` → XML | `xcrun simctl ui describe-all` → text |
| `openDeepLink(url, deviceId)` | `adb shell am start -a VIEW -d` | `xcrun simctl openurl` |
| `sendPushNotification(payload, bundleId, deviceId)` | `adb shell am broadcast` | `xcrun simctl push` (temp JSON file) |
| `simulateBiometric(result, deviceId)` | `adb shell am broadcast FINGERPRINT_AUTH` | `xcrun simctl spawn notifyutil` |
| `setGeoLocation(lat, lng, deviceId)` | `adb emu geo fix` | `xcrun simctl location set` |
| `setNetworkCondition(profile, deviceId)` | `adb shell svc wifi/data enable/disable` | Network Link Conditioner note |
| `setOrientation(orientation, deviceId)` | `adb shell settings put user_rotation` | N/A (Simulator.app) |
| `setAppearance(mode, deviceId)` | `adb shell cmd uimode night` | `xcrun simctl ui appearance` |
| `setLocale(locale, deviceId)` | `adb shell setprop persist.sys.locale` | `xcrun simctl spawn defaults write` |
| `setFontScale(scale, deviceId)` | `adb shell settings put font_scale` | `xcrun simctl spawn defaults write` |

**IPC Handlers** (`flowstral-desktop/src/main/index.js`):

| Channel | Purpose |
|---------|---------|
| `mobile-check-maestro` | Validate Maestro CLI installation |
| `mobile-run-native-test` | Execute test flow with step/progress/error callbacks |
| `mobile-get-native-devices` | List connected devices/emulators |
| `mobile-start-studio` / `mobile-stop-studio` / `mobile-studio-status` | Maestro Studio lifecycle |
| `mobile-screenshot` | Take screenshot, return base64 |
| `mobile-start-logs` / `mobile-stop-logs` | Stream device logs via `mobile-log-line` events |
| `mobile-install-app` / `mobile-uninstall-app` | App management |
| `mobile-browse-app` | File dialog for APK/IPA selection |
| `mobile-get-hierarchy` | Element tree from device |
| `mobile-open-deep-link` | Open deep link / URL scheme |
| `mobile-send-push` | Send push notification |
| `mobile-simulate-biometric` | Simulate biometric result |
| `mobile-set-geolocation` | Set GPS coordinates |
| `mobile-set-network` | Set network conditions |
| `mobile-set-orientation` | Set portrait/landscape |
| `mobile-set-appearance` | Set dark/light mode |
| `mobile-set-locale` | Set device locale |
| `mobile-set-font-scale` | Set accessibility font scale |

**Preload** (`flowstral-desktop/src/main/webapp-preload.js`): `mobile` object exposes all methods via `ipcRenderer.invoke()`. Event channels `mobile-log-line` and `mobile-studio-output` are in both `electronAPI.on` and `flowstral.on` validChannels arrays.

**Electron Bridge** (`src/lib/electron-bridge.ts`): `mobile` export matches all preload methods with browser fallback (`{ success: false, error: 'Not available in browser' }`). Event listeners via `onLogLine()` and `onStudioOutput()` use `api.on()`.

### State Management

**Zustand Store:** `src/modules/mobile-testing/store/mobileTestingStore.ts` (with `persist` middleware → localStorage)

Key state: `activeTab`, `isStudioRunning`, `maestroInstalled`, `nativeDevices`, `selectedPlatform`, `selectedDevice`, `appBundleId`, `flows`, `folders`, `testRuns`, `studioOutput`, `deepLinks`, `savedLocations`, `networkProfiles`, `activeNetworkProfile`, `currentLocation`, `pushNotificationPayload`

### Key Types

```typescript
type MobilePlatform = 'ios' | 'android'
type FlowPriority = 'critical' | 'high' | 'medium' | 'low'
type TestRunStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'error'
interface MobileTestFlow { id, name, description, yaml, app_bundle_id, platform, tags, priority, folder_id }
interface MobileTestRun { id, flow_id, flow_name, platform, device, status, duration_ms, steps_total/passed/failed }
interface DeepLinkConfig { id, name, url, platform, description }
interface GeoLocation { id, name, latitude, longitude, altitude }
interface NetworkProfile { id, name, download_kbps, upload_kbps, latency_ms, packet_loss }
```

### Integration

- Uses `electron-bridge` → Electron IPC → `MaestroRunner` for all native device communication
- Maestro CLI for iOS/Android test execution
- YAML-based test flow definitions
- Device logs via logcat (Android) / syslog (iOS) streamed in real-time
- Element hierarchy via `uiautomator dump` XML parsed with `DOMParser` into `ElementNode` tree
- Deep links via `adb am start` / `xcrun simctl openurl`
- Push notifications via `adb broadcast` / `xcrun simctl push`
- All Advanced Tools (biometrics, geo, network, orientation, appearance, locale, font scale) wired to real device commands
- **Server persistence** (v3.13.2+): Flows, folders, and runs sync to PostgreSQL via `/api/mobile/*` endpoints; localStorage remains offline fallback

### Mobile Flow API Endpoints (v3.13.2+)

- `GET /api/mobile/flows` — List all flows for a project
- `POST /api/mobile/flows` — Create/update a flow
- `DELETE /api/mobile/flows/{id}` — Delete a flow
- `POST /api/mobile/sync` — Bulk sync flows/folders/runs from localStorage to PostgreSQL
- `GET /api/mobile/folders` — List folders
- `POST /api/mobile/folders` — Create/update a folder
- `GET /api/mobile/runs` — List test runs
- `POST /api/mobile/runs` — Record a test run

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
| `AssertionsPanel.tsx` | Assertion editor — 12 types (incl. database), multiple operators, pass/fail display, `dbConnections` prop for DB assertions |
| `ResponseTreeExplorer.tsx` | JSON response tree viewer with copy-path |
| `ChainResultsView.tsx` | Chain execution results with per-step detail |
| `ChainStepCard.tsx` | Individual chain step result card |
| `constants.ts` | ASSERTION_TYPES, ASSERTION_OPERATORS, DB_ASSERTION_OPERATORS, AssertionConfig type (incl. `db_connection_id`, `db_query`, `db_comparison`) |
| `DataDrivenPanel.tsx` | Data-driven test sources — 4 tabs: CSV, JSON, Excel, Database Query; `dbConnections` prop for DB source |
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
- 12 assertion types: status_code, response_time, jsonpath, schema, contains, not_contains, regex, header, equals, xpath, matches_baseline, database
- **Database assertions**: connection selector, SQL query input, comparison mode; `DB_ASSERTION_OPERATORS`: equals, contains, count, greater_than, less_than, not_empty, is_empty; `AssertionConfig` extended with `db_connection_id`, `db_query`, `db_comparison` fields

**Database Workbench (v3.12.18+):**
- `EnhancedAPITesting.tsx` replaces the old DB card with a full Database Workbench featuring `DbSchemaBrowser` and `DbQueryEditor` inline components
- `DbSchemaBrowser` — browse tables and columns via `GET /api/v2/testing/database/{connection_id}/tables` and `GET .../tables/{table_name}/columns`
- `DbQueryEditor` — execute SQL queries with query history
- Disconnect button per connection via `DELETE /api/v2/testing/database/{connection_id}`
- `DataDrivenPanel` — "Database Query" tab as 4th data source option (alongside CSV, JSON, Excel); uses `dbConnections` prop; backend `POST /api/v2/testing/data-driven/source` accepts `source_type: "database_query"` with `connection_id`, `query`, `row_limit`

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
- `syncToServer()` — bulk sync all collections/environments from localStorage to PostgreSQL
- `loadFromServer()` — load collections from PostgreSQL for team sharing

### Backend

| File | Prefix | Endpoints | Purpose |
|------|--------|-----------|---------|
| `backend/app/routers/api_testing/enhanced_api_testing_api.py` | `/api/v2/testing` | 46 | Multi-protocol API testing (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, AMQP) |
| `backend/app/routers/api_testing/api_import_api.py` | `/api/import` | 9 | OpenAPI/HAR/Postman import, export, test generation |
| `backend/app/routers/api_testing/request_chaining_api.py` | `/api/chain` | 9 | Request chaining for API testing |
| `backend/app/routers/api_testing/collection_persistence_api.py` | `/api/v2/testing/collections` | 11 | Collection, request, folder, environment, chain server persistence + bulk sync |

### Key Backend Services

**Directory:** `backend/app/services/api_testing/`

| Service | Purpose |
|---------|---------|
| `EnhancedAPITestEngine` | Core multi-protocol test execution |
| `APISpecParser` | Parses OpenAPI/Swagger/Postman/HAR specs; `_extract_base_url()` for base URL |
| `DatabaseConnector` | Database connectivity for API tests; `list_tables()` and `get_table_columns()` for schema browsing |
| `TestExecutionEngine` | Test execution orchestration |
| `ServiceVirtualization` | Mock service responses |
| `ReportingEngine` | Test result reporting |
| `EnvironmentManager` | Environment variable management |
| `OpenAPIValidator` | OpenAPI spec validation |
| `SchemaInferenceEngine` | Auto-infer JSON schemas from responses |
| `DataDrivenEngine` | Data-driven test execution; `create_database_source()` for DB query data sources |
| `CollectionPersistenceService` | Server-side persistence for API collections, folders, requests, environments, chains; bulk sync from localStorage |

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
- `GET /api/v2/testing/database/{connection_id}/tables` — List tables for a database connection
- `GET /api/v2/testing/database/{connection_id}/tables/{table_name}/columns` — Get columns for a table
- `DELETE /api/v2/testing/database/{connection_id}` — Disconnect/remove a database connection
- `POST /api/v2/testing/data-driven/source` — Create data-driven source (supports `source_type: "database_query"` with `connection_id`, `query`, `row_limit`)
- `POST /api/v2/testing/collections/sync` — Bulk sync collections/environments/requests from localStorage to PostgreSQL
- `GET /api/v2/testing/collections` — List all collections for a project
- `POST /api/v2/testing/collections` — Create/update a collection
- `DELETE /api/v2/testing/collections/{id}` — Delete a collection

---

## Component 6: Performance Testing

> Load testing with virtual user simulation, protocol recording, multiple load patterns, and server-side execution for high VU counts.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/performance/pages/Performance.tsx` | ~95KB | Performance testing UI — scenarios, execution, results, charts, server runner, HAR import |

### Server-Side Execution (v3.11.6+)

The Performance page has two execution modes:

| Mode | VU Limit | How |
|------|----------|-----|
| **In-browser** (default) | 20 VUs | `fetch()` calls from the browser, concurrent virtual users simulated in JS |
| **Server-side** ("Run on Server" toggle) | 10,000 VUs | Backend `PerformanceEngine` via REST API |

**Server-side flow:**
1. `POST /api/performance/scenarios` — Create scenario
2. `POST /api/performance/scenarios/{id}/steps` — Add HTTP request steps
3. `POST /api/performance/tests/run` — Start server-side test
4. Poll `GET /api/performance/tests/{id}/status` every 2 seconds (cleanup on unmount via `useRef`)
5. On completion, results added to test history

**State:**
- `useServerRunner` — toggle for server vs browser execution
- `serverTestId` — active server test ID for polling
- `serverPollRef` — `useRef` for interval cleanup on unmount
- `testHistory` — persisted to `localStorage` key `flowstral-perf-history` (survives page refresh, max 50 entries)

### HAR Import (v3.11.6+)

HAR file import card in the Custom Config tab. Uploads via `POST /api/import/har` (FormData), extracts requests, and auto-sets the base URL from the first entry.

### Backend

| File | Prefix | Endpoints | Purpose |
|------|--------|-----------|---------|
| `backend/app/routers/performance/performance_api.py` | `/api/performance` | 80 | Load testing engine, scenarios, runs, transaction analysis, metrics |
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

- `POST /api/performance/scenarios` — Create load test scenario
- `POST /api/performance/scenarios/{id}/steps` — Add HTTP request steps to scenario
- `POST /api/performance/tests/run` — Start server-side load test (unlimited VUs)
- `GET /api/performance/tests/{id}/status` — Poll test status
- `GET /api/performance/tests/{id}/report` — Get test report
- `POST /performance/start` — Start in-browser load test
- `GET /performance/results/{id}` — Get test results
- `POST /api/protocol-recording/start` — Start traffic capture
- `POST /api/protocol-recording/stop` — Stop and export HAR
- `POST /api/import/har` — Import HAR file
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

## Component 9: AI Testing & Flowpilot

> AI-powered testing agents — natural language test generation, autonomous exploration, application mapping, and self-healing test execution via real Playwright browser automation.

### Frontend

| File | Size | Purpose |
|------|------|---------|
| `src/modules/ai-testing/pages/FlowpilotPage.tsx` | ~1,044 lines | Goal-based agentic testing hub with 4 real agents |
| `src/modules/ai-testing/pages/AITestingPage.tsx` | ~78 lines | Landing page with 4-step intro cards |
| `src/modules/ai-testing/components/AIChatTesting.tsx` | ~729 lines | NLP input → real SSE test execution |
| `src/modules/ai-testing/components/AIExplorerAgent.tsx` | ~693 lines | Autonomous element discovery (Electron IPC) |
| `src/modules/ai-testing/components/AIFlowExplorer.tsx` | ~960 lines | 5-tab app mapping + goal execution (Electron IPC) |

### 4 Flowpilot Agents (v3.12.18+)

| Agent | Backend Endpoint | Protocol | Purpose |
|-------|-----------------|----------|---------|
| **Generator** | `POST /api/ai-testing/start` → AgenticOrchestrator v2.0 | SSE streaming | NLP → real browser test with auto-heal |
| **Self-Healer** | `POST /api/ai-testing/rerun-with-fix` | SSE streaming | Re-run failed tests with AI selector fixes |
| **Explorer** | `POST /api/blaze/start` + `GET /api/blaze/status/{id}` | REST + polling (2s) | Autonomous crawling, defect detection, NO AI dependency |
| **Flowmap** | `POST /api/exploration/start` | REST | BFS site crawling, capability mapping, LLM analysis |

**SSE Event Types:** `phase`, `intent`, `step`, `screenshot`, `test_complete`, `plan`, `complete`, `error`

**Features:**
- Live browser screenshots during test execution
- Expandable test results with per-step pass/fail, selector method, confidence %, healing status
- Explorer defect cards with severity badges (critical/high/medium)
- Flowmap application map with pages, buttons, forms, entities
- **Save as Test Case** → persists to `/test-cases` endpoint
- **Re-run with Healer** button on failed tests → auto-switches agent
- Stop button with AbortController (SSE) and clearInterval (polling)

### Backend — AI Testing

**Routers** (`backend/app/routers/ai/`):

| File | Lines | Prefix | Purpose |
|------|-------|--------|---------|
| `ai_testing.py` | 358 | `/api/ai-testing` | SSE streaming test execution (4 endpoints) |
| `ai_generation_api.py` | 2,858 | `/ai` | Test generation, triage, ingest (28 endpoints) |
| `ai_automation_api.py` | 474 | `/ai-automation` | Element resolution, failure analysis |
| `ai_enhancements_api.py` | 867 | `/api/ai/enhancements` | Auto-fix, false positives, flaky detection, manual assist |
| `agents_api.py` | 95 | `/agents` | Agent registry & health |
| `vision_healing_api.py` | — | `/api/vision` | Vision-based selector healing |
| `llm_api.py` | — | `/api/llm` | LLM gateway |

**Exploration Routers** (`backend/app/routers/exploration/`):

| File | Prefix | Purpose |
|------|--------|---------|
| `blaze_api.py` | `/api/blaze` | Autonomous crawling: start, start-sync, status, stop, sessions, health |
| `exploration_api.py` | `/api/exploration` | App mapping: start, status, compare-requirements, runs, health |

### Backend — AI Services

| File | Purpose |
|------|---------|
| `backend/app/services/ai_testing/agentic_orchestrator.py` | AgenticOrchestrator v2.0 — 6-phase execution (understand → launch → navigate → plan → execute → cleanup) |
| `backend/app/services/ai_testing/ai_testing_orchestrator.py` | v1.0 legacy (kept for backward compat) |
| `backend/app/services/ai_testing/human_element_finder.py` | Playwright getByRole/getByText/getByLabel strategies |
| `backend/app/services/ai_testing/page_scanner.py` | DOM analysis — element extraction, accessibility tree |
| `backend/app/services/exploration/blaze_explorer.py` | BlazeExplorer — autonomous crawling, no AI dependency |
| `backend/app/services/llm/model_gateway.py` | Routes to correct LLM provider |
| `backend/app/services/llm/openai_service.py` | OpenAI gpt-4o-mini (primary) |
| `backend/app/services/llm/cached_claude_service.py` | Anthropic Claude with prompt caching |

### Key API Endpoints

- `POST /api/ai-testing/start` — Start AI testing with SSE streaming (AgenticOrchestrator v2.0)
- `GET /api/ai-testing/status` — Check service readiness
- `POST /api/ai-testing/explain` — Analyze test failure with AI
- `POST /api/ai-testing/rerun-with-fix` — Re-run with AI selector fixes (SSE)
- `POST /api/blaze/start` — Start autonomous exploration session
- `GET /api/blaze/status/{session_id}` — Poll exploration progress
- `POST /api/blaze/stop/{session_id}` — Stop exploration
- `POST /api/exploration/start` — Start app capability mapping
- `GET /api/exploration/status/{run_id}` — Get mapping progress
- `POST /api/exploration/compare-requirements` — Compare app vs requirements

---

## Cross-Cutting Concerns

### Authentication & Authorization

- **JWT Tokens** via python-jose
- **RBAC Middleware** — decorator-based permission checks: `@require_permission("test_cases:create")`
- **Frontend RBAC** — `ProtectedRoute` with role hierarchy enforcement (owner > admin > member > viewer), `getUserRoleInOrg()`, `hasRequiredRole()`, inline UnauthorizedPage redirect
- **Multi-Tenancy** — tenant isolation via TenantContextMiddleware
- **OAuth2** — Salesforce and external integrations
- **Rate Limiting** — `RateLimitMiddleware` with sliding window (100/min default, 10/min auth, 20/min AI endpoints), X-RateLimit headers, X-Forwarded-For support
- **Middleware Stack** (outermost to innermost): CORS → RateLimit → RBAC → Tenant → TraceLogging

### Audit Trail

- **Backend Service**: `backend/app/services/core/audit_service.py` — in-memory deque (10K max) with optional PostgreSQL persistence
- **API Router**: `backend/app/routers/platform/audit_api.py` — 4 endpoints (`GET/POST /api/audit/logs`, `GET /api/audit/summary`, `GET /api/audit/actions`)
- **Frontend UI**: `src/modules/platform/pages/AuditLogPage.tsx` — filterable table, summary cards, CSV export, pagination
- **Navigation**: Available via sidebar under Configure → "Audit Log"
- **Route**: `/audit-log`

### Error Handling

- **Global Error Boundary**: `src/components/GlobalErrorBoundary.tsx` — React class component wrapping entire `<App />`, catches unhandled rendering errors, shows friendly recovery UI with "Reload App" / "Try Again" buttons, optional error reporting to backend `/api/errors`
- **Tab Error Boundary**: `TabErrorBoundary` pattern for isolated tab failures (API Testing, etc.)

### Container Security

- **Docker**: All containers run as non-root user `appuser` (UID 1001) per CIS Benchmark 4.1
- **Nginx**: OWASP security headers (X-Frame-Options DENY, CSP, HSTS, X-Content-Type-Options nosniff, Referrer-Policy), rate limiting zones, blocked sensitive paths
- **Frontend Dockerfile**: Multi-stage build (Node 20 → nginx:alpine), COPY `nginx/default.conf`, non-root user

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

### Web Analytics, UTM Tracking & Live Chat

Marketing site analytics via Google Analytics 4, Microsoft Clarity, Crisp live chat, and UTM attribution tracking. All disabled in Electron desktop app.

**Key File:** `src/lib/web-analytics.ts` — unified analytics + chat service

**Setup (`.env`):**
- `VITE_GA4_MEASUREMENT_ID` — GA4 measurement ID (e.g., `G-XXXXXXXXXX`)
- `VITE_CLARITY_PROJECT_ID` — Clarity project ID (e.g., `abc123xyz`)
- `VITE_CRISP_WEBSITE_ID` — Crisp website ID (from app.crisp.chat → Settings)
- All scripts are injected dynamically on `initAnalytics()` — no `index.html` changes needed

**Architecture:**
- `initAnalytics()` — called once in `App.tsx` useEffect; injects GA4 + Clarity + Crisp + captures UTM params; skips in Electron
- `RouteTracker` component in `App.tsx` — fires `page_view` on every route change via `useLocation`
- CTA tracking via `trackCTAClick(ctaName, page)` on all marketing page buttons
- `captureUTMParams()` — reads `utm_source/medium/campaign/term/content` from URL, stores in `sessionStorage` key `flowstral_utm`, fires `campaign_hit` GA4 event
- `getUTMParams()` — retrieves stored UTM params for CRM/lead capture form pre-fill
- `openCrispChat()` — programmatically opens Crisp chat widget (for "Chat with us" buttons)

**Tracked Events:**

| Event | Function | Where Fired |
|-------|----------|-------------|
| `page_view` | `trackPageView()` | `RouteTracker` (App.tsx) — every route change |
| `cta_click` | `trackCTAClick(name, page)` | All marketing pages — headers + CTAs |
| `sign_up` | `trackSignup(method)` | SignUpPage on successful registration |
| `login` | `trackEvent('login')` | SignInPage on successful sign-in |
| `pricing_view` | `trackPricingView()` | PricingPage on mount |
| `enterprise_inquiry` | `trackEnterpriseInquiry()` | ContactPage on form submit |
| `campaign_hit` | `captureUTMParams()` | Auto on init when URL has `utm_*` params |
| `cost_calculator_used` | `trackEvent()` | CostCalculatorPage when ≥2 tools selected |
| `feature_engaged` | `trackFeatureEngaged(feature)` | Available for in-app feature tracking |
| `app_download` | `trackDownload(platform)` | Available for download tracking |

**CTA Names Used:**
- `start_free`, `sign_in`, `get_started_free`, `watch_demo`, `explore_flowpilot`
- `talk_to_sales`, `contact_sales`, `request_demo`, `schedule_demo`, `schedule_live_demo`
- `chat_with_us`, `start_free_trial`, `create_account_download`
- `get_started_free_bottom`, `talk_to_sales_bottom` (pricing page bottom CTA)

**Pages with tracking:**
- `LandingPage.tsx` — hero CTAs, header, final CTA section, social proof
- `PricingPage.tsx` — all tier CTAs, FAQ CTAs, header, pricing_view event
- `SignUpPage.tsx` — sign_up event on successful registration
- `SignInPage.tsx` — login event on successful sign-in
- `DemoPage.tsx` — header, final CTA section
- `ContactPage.tsx` — header, enterprise_inquiry on form submit
- `DownloadPage.tsx` — header, create account CTA
- `ComparePage.tsx` — header CTAs, comparison page CTAs
- `CostCalculatorPage.tsx` — header CTAs, calculator CTAs, cost_calculator_used event
- `BlogPage.tsx` — header CTAs, blog CTA section

### Marketing Pages & SEO Infrastructure

Marketing pages live in `src/pages/marketing/` and are public (no auth required).

**Comparison Pages** (`ComparePage.tsx`, route: `/compare/:competitor`):
- Data-driven dynamic page with 5 competitor configs: `katalon`, `selenium`, `postman`, `cypress`, `tricentis`
- Each config has: SEO title/description, feature comparison table (14-16 rows), limitations list, switch reasons, and CTAs
- StatusIcon component (✅ yes / ⚠️ partial / ❌ no) for visual comparison
- Links from pricing page, cost calculator, and footer

**QA Tool Cost Calculator** (`CostCalculatorPage.tsx`, route: `/tools/cost-calculator`):
- Interactive savings estimator: users check which of 8 tool categories they use
- Tool categories: Browser ($15-40K), API ($10-25K), Performance ($15-50K), Visual ($12-30K), Accessibility ($8-20K), Mobile ($20-60K), Salesforce ($25-80K), Test Management ($10-30K)
- Shows: current annual spend, Flowstral cost, annual savings, per-tool breakdown, hidden savings
- Tracks `cost_calculator_used` event when ≥2 tools selected
- Links to comparison pages for detailed competitor analysis

**Blog** (`BlogPage.tsx`, route: `/blog` and `/blog/:slug`):
- Blog hub with 8 seed posts defined as data (can later be backed by CMS/MDX)
- Category filtering (All, Best Practices, Migration Guides, Industry Trends, Tutorials, Salesforce, ROI & Strategy)
- Search across titles and excerpts
- Featured posts section for posts with `featured: true`
- Exported `BlogPost` interface and `blogPosts` array for reuse

**Privacy Policy** (`PrivacyPage.tsx`, route: `/privacy`):
- 8-section privacy policy covering: data collection, usage, sharing, security, GDPR/CCPA rights, retention, cookies, Chrome Extension
- Section 8 covers Chrome Extension & Browser Recorder: what data is collected, sensitive data masking, network traffic capture (optional), screenshots (optional), data storage, permissions, deletion
- Sidebar navigation with sticky positioning and scroll-to-section
- Trust badges: GDPR Compliant, CCPA Compliant, AES-256 Encrypted, SOC 2 (In Progress)
- Required for Chrome Web Store submission (linked from `manifest.json` `homepage_url`)

**SEO Infrastructure:**
- `index.html` — Enhanced meta tags (title, description, keywords, canonical URL), Open Graph, Twitter Card, Schema.org structured data (`SoftwareApplication` + `Organization`)
- `public/sitemap.xml` — 28 URLs covering marketing, product, comparison, tools, and legal pages
- `public/robots.txt` — Allows marketing pages, disallows app routes (/app, /recorder, /test-cases, /dashboard, /api, /performance, /admin), references sitemap

**Social Proof** (in `LandingPage.tsx` `SocialProofSection`):
- 3 testimonial cards with names, titles, star ratings, and quotes
- 4 trust indicator badges (SOC 2 Ready, On-Prem Available, 30+ Countries, Growing Community)
- Metrics: teams using platform, tests run, uptime percentage

### WebSocket Real-Time

- **Test Execution**: `wss://API_BASE_URL/test-runs/ws/{executionId}` — step progress, screenshots, self-healing events
- **Agent Control**: `ws://localhost:8000/ws/agent` — desktop agent registration, commands
- **Flowstral Session**: Recording session streaming

### Database Pattern

PostgreSQL (primary) with **in-memory fallback**:
- `backend/app/services/storage/database.py` — Unified client
- `backend/app/services/storage/postgres_direct.py` — Direct PostgreSQL
- Auto-migration on startup via `auto_migrate.py` (core tables + file-based migrations)
- Demo data seeding via `SEED_DEMO_DATA=true` env var (auto-triggered in `auto_migrate.py`)
- `backend/app/scripts/seed_demo_data.py` — Idempotent seed script (fixed UUIDs + ON CONFLICT DO UPDATE): 1 org, 3 projects, 3 users, 50 test cases, 20 runs, 10 defects, 8 requirements, 5 API collections, 3 environments, 2 a11y scans, 3 perf runs
- Supabase for auth and file storage
- 33 migrations (`supabase/migrations/001_initial_schema.sql` through `033_mobile_test_flows.sql`)
- PgBouncer for connection pooling at scale (`deploy/pgbouncer/pgbouncer.ini`)

### Electron Desktop

- `flowstral-desktop/src/main/index.js` — Main process (~2100 lines), 20+ mobile IPC handlers, cross-browser recording support
- `flowstral-desktop/src/main/lib/maestro-integration.js` — `MaestroRunner` class with 14 device methods (screenshots, logs, install, hierarchy, deep links, push, biometrics, geo, network, orientation, appearance, locale, font scale)
- `flowstral-desktop/src/main/playwright-recorder.js` — Cross-browser recording (Chromium/Firefox/WebKit), `launchBrowserWithFallback()` with engine selection
- `flowstral-desktop/src/main/webapp-preload.js` — `electronAPI` + `flowstral` context bridges; `mobile` object with 20+ methods; `validChannels` includes mobile streaming events
- `embedded-browser.js` — BrowserView recorder
- `test-executor.js` — Playwright test runner
- `cloud-connector.js` — Cloud API sync
- `src/lib/electron-bridge.ts` — Frontend API wrapper over Electron IPC; `mobile` export with 20+ methods matching preload; browser fallback for all methods
- HashRouter for file:// protocol, BrowserRouter for web
- Auto-detection: `window.electron || navigator.userAgent.includes('electron')`

---

## Conventions & Patterns

1. **Frontend**: Organized into `src/modules/{domain}/` with pages/, components/, lib/, store/ subdirectories. Shared utilities in `src/lib/`, `src/contexts/`, `src/hooks/`, `src/components/ui/`. Path alias `@/` = `src/`
2. **Backend**: Routers in `backend/app/routers/{domain}/`, services in `backend/app/services/`, Pydantic schemas in `backend/app/schemas/`
3. **State**: Zustand stores co-located with their modules (e.g., `src/modules/api-testing/store/`), middleware: `devtools` + `persist` + `immer`
4. **Styling**: Tailwind CSS utility classes, CSS variables for theming, dark mode via `dark:` prefix
5. **API calls**: Axios with centralized base URL from `api-config.ts`
6. **Error boundaries**: GlobalErrorBoundary wraps entire app; TabErrorBoundary for isolated tab failures
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
| **test_management/** | test_cases_crud_api | `/test-cases` | Test case CRUD + version control (20 endpoints) |
| | test_runs_api | `/test-runs` | Test execution (14 endpoints) |
| | test_plans_api | `/test-plans` | Test plans |
| | automation_api | `/automation` | Script conversion, execution |
| | gherkin_api | `/api/gherkin` | BDD/Gherkin support |
| | requirement_to_testcase_api | `/api/req2tc` | Req-to-test conversion |
| | complex_verifications | `/api/complex-verify` | Email/PDF/file checks |
| | mobile_flows_api | `/api/mobile` | Mobile test flow server persistence (8 endpoints) |
| **api_testing/** | enhanced_api_testing_api | `/api/v2/testing` | Multi-protocol API testing (46 endpoints) |
| | api_import_api | `/api/import` | OpenAPI/HAR/Postman import |
| | request_chaining_api | `/api/chain` | Request chaining |
| | collection_persistence_api | `/api/v2/testing/collections` | Collection server persistence + bulk sync (11 endpoints) |
| **performance/** | performance_api | `/performance` | Load testing (80 endpoints) |
| | protocol_recording_api | `/api/protocol-recording` | HTTP traffic capture |
| | scale_api | `/api/v2` | Paginated queries |
| **ai/** | ai_generation_api | `/ai` | Test generation, triage (28 endpoints) |
| | ai_automation_api | `/ai-automation` | Element resolution, failure analysis |
| | ai_enhancements_api | `/api/ai/enhancements` | False positives, flaky detection |
| | vision_healing_api | `/api/vision` | Vision-based healing |
| | ai_testing | `/api/ai-testing` | SSE streaming test execution (4 endpoints) |
| | llm_api | `/api/llm` | LLM gateway |
| | agents_api | `/agents` | Agent registry & health |
| **accessibility/** | accessibility_api | `/api/accessibility` | A11y scans (10 endpoints) |
| | accessibility_scan_api | `/api/a11y` | A11y v2 with reports |
| | compliance_api | `/api/compliance` | Compliance checking |
| **visual_testing/** | visual_testing_api | `/api/visual-testing` | Visual regression (15 endpoints) |
| **salesforce/** | salesforce_api | `/api/salesforce` | Salesforce integration |
| | salesforce_auth | `/api/salesforce/auth` | Salesforce OAuth2 |
| **exploration/** | exploration_api | `/api/exploration` | App capability mapping |
| | nexus_exploratory_api | `/api/nexus` | Nexus testing |
| | blaze_api | `/api/blaze` | Autonomous crawling, defect detection |
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
| | audit_api | `/api/audit` | Audit trail logging & queries (4 endpoints) |

---

## Documentation Update Procedure

**When the user mentions a feature name, update the corresponding FEATURE-*.md doc** (just like "push" triggers the release pipeline). Feature docs live in `docs/`:

| Feature | Document |
|---------|----------|
| Recording / Recorder | `docs/FEATURE-RECORDING.md` |
| Test Builder / Build | `docs/FEATURE-TEST-BUILDING.md` |
| Test Execution / Runs | `docs/FEATURE-TEST-EXECUTION.md` |
| API Testing | `docs/FEATURE-API-TESTING.md` |
| Performance Testing | `docs/FEATURE-PERFORMANCE-TESTING.md` |
| Mobile Testing | `docs/FEATURE-MOBILE-TESTING.md` |
| Accessibility / Visual | `docs/FEATURE-ACCESSIBILITY-VISUAL.md` |
| AI Testing / Flowpilot | `docs/FEATURE-AI-TESTING.md` |
| Salesforce | `docs/FEATURE-SALESFORCE.md` |
| Marketing / Analytics / SEO | `docs/FEATURE-MARKETING-ANALYTICS.md` |
| Platform Master | `docs/PLATFORM_MASTER_DOCUMENT.md` |
| Enterprise Security | `docs/ENTERPRISE-SECURITY-GUIDE.md` |
| On-Prem Deployment | `docs/ON-PREM-DEPLOYMENT-RUNBOOK.md` |
| SaaS Deployment | `docs/SAAS-DEPLOYMENT-GUIDE.md` |
| Deployment / Data Architecture | `docs/DEPLOYMENT-AND-DATA-ARCHITECTURE.md` |

**When updating feature docs:**
1. Update the relevant `FEATURE-*.md` with new/changed functionality
2. Update `PLATFORM_MASTER_DOCUMENT.md` if architecture changes
3. Update this `CLAUDE.md` file with new endpoints, files, or patterns

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
