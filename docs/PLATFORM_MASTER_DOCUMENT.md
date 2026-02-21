# QAAI / Flowstral - Master Platform Document

## Platform Identity

**Product Name:** QAAI (QA + AI) / Flowstral
**Tagline:** AI-Powered Quality Assurance & Test Automation Platform
**Version:** v3.12.18 | Last Updated: 2026-02-20
**Repository:** github.com/maddynolan/QAOne
**Production API:** qaone-production.up.railway.app
**Frontend:** Deployed via Vercel

---

## 1. Executive Summary

QAAI/Flowstral is a comprehensive, AI-driven quality assurance and test automation platform that competes with enterprise tools like Selenium, Playwright (standalone), TestRail, qTest, Postman, k6, and Applitools. The platform provides an end-to-end QA lifecycle solution spanning:

- **Test Case Management** (requirements, test plans, test runs, defects, traceability)
- **AI-Powered Test Generation** (from requirements, Jira tickets, URLs, natural language)
- **Record & Playback** (browser extension + Electron desktop app with self-healing locators)
- **API Testing** (Postman-level with collections, chaining, assertions, OpenAPI/HAR import)
- **Performance Testing** (load testing with in-browser + server-side execution up to 10K VUs, 8 load patterns, HAR import)
- **Accessibility Testing** (WCAG 2.1 AA/AAA scanning via axe-core v4.8.4, AI-powered analysis)
- **Visual Testing** (6 comparison modes: pixel-perfect, anti-aliased, perceptual hash, SSIM, layout, AI semantic)
- **Mobile Testing** (Maestro CLI, 20+ IPC handlers for device control, deep links, push, biometrics, geolocation)
- **Salesforce-Specific Testing** (multi-org, SOQL, Apex, metadata validation, test data factory, 20 components, 39 API endpoints)
- **AI Testing & Flowpilot** (4 agents: Generator, Explorer, Flowmap, Self-Healer — real Playwright browser automation with SSE streaming)
- **CI/CD Integration** (GitHub Actions, Azure DevOps, Jenkins, GitLab, Azure Pipelines)
- **Flowstral Engine** (action graph intelligence, cross-browser recording: Chromium/Firefox/WebKit)
- **Marketing & Analytics** (GA4, Clarity, Crisp live chat, UTM tracking, 18 marketing pages, SEO infrastructure)

The platform supports both **SaaS** (hosted) and **on-premises** deployment models, with multi-tenant architecture and enterprise-grade features (RBAC, secrets vault, license management).

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
+------------------+     +-------------------+     +------------------+
|   Frontend SPA   |     | Chrome Extension  |     | Electron Desktop |
|  (React + Vite)  |     | (Flowstral        |     | (Full On-Prem)   |
|  60+ pages       |     |  Recorder)        |     |  Embedded        |
|  262+ components |     |  MV3 Manifest     |     |  Playwright +    |
|  Radix UI +      |     |  Side Panel       |     |  SQLite +        |
|  Tailwind CSS    |     |  Content Scripts)  |     |  WebSocket)      |
+--------+---------+     +---------+---------+     +--------+---------+
         |                         |                         |
         +----------+--------------+------------+------------+
                    |                            |
            +-------v--------+          +--------v--------+
            | Backend API    |          | Flowstral Engine |
            | (FastAPI/Python|          | (TypeScript/Node)|
            | 67 routers     |          | Record + Heal +  |
            | 30+ services)  |          | Generate Scripts)|
            +-------+--------+          +-----------------+
                    |
         +----------+----------+
         |          |          |
    +----v----+ +---v----+ +---v-----+
    |Supabase | |Postgres| | Ollama  |
    |(Auth +  | |(Direct)| | (Local  |
    | Storage)| |        | |  LLM)   |
    +---------+ +--------+ +---------+
```

### 2.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Zustand, TanStack Query, Monaco Editor, React Router v6 |
| **Backend** | Python, FastAPI, Pydantic, asyncio, WebSockets |
| **Database** | PostgreSQL 16 (primary), Supabase (auth + cloud storage), SQLite (desktop/offline) |
| **AI/LLM** | OpenAI gpt-4o-mini (active), Anthropic Claude (prompt caching, dev), Ollama (disabled), ModelGateway routing |
| **Test Engine** | Playwright 1.48 (core automation, cross-browser: Chromium/Firefox/WebKit), Flowstral Engine (TypeScript recording + healing) |
| **Desktop** | Electron 28, electron-builder (Win/Mac/Linux), electron-store, better-sqlite3, 20+ mobile IPC handlers |
| **Extension** | Chrome Manifest V3, side panel (5 tabs), content scripts, service worker, centralized api-config.js |
| **Performance** | Python VUs (in-browser, 20 max) + Server-side PerformanceEngine (10K VUs), 8 load patterns, HAR import |
| **Mobile** | Maestro CLI, MaestroRunner (14 device methods), adb/xcrun integration |
| **Analytics** | Google Analytics 4, Microsoft Clarity, Crisp Live Chat, UTM tracking |
| **Infrastructure** | Railway (API hosting), Vercel (frontend), Docker, Kubernetes/Helm, Grafana + Prometheus |
| **CI/CD** | GitHub Actions, support for Jenkins/Azure DevOps/GitLab |

### 2.3 Repository Structure

```
QAAI/
  backend/              # FastAPI Python backend
    app/
      config/           # LLM configuration
      middleware/        # RBAC, tenant, trace logging
      routers/          # Domain-grouped subdirectories (10 groups)
        recorder/       # CDP, Playwright, Flowstral recording
        test_management/# Test cases, runs, plans, automation
        api_testing/    # Multi-protocol API testing
        performance/    # Load testing, protocol recording
        ai/             # AI generation, automation, enhancements, testing
        accessibility/  # WCAG scanning, compliance
        visual_testing/ # Visual regression
        salesforce/     # Salesforce integration, auth
        exploration/    # Autonomous exploration, Blaze
        platform/       # Health, dashboard, license, settings
      schemas/          # Pydantic models
      services/         # 295+ services across 26 subdirectories
  src/                  # React frontend (Vite SPA)
    modules/            # 11 domain-separated feature modules
      recorder/         # Browser recording, self-healing
      test-management/  # Test cases, builder, execution, runs
      api-testing/      # Multi-protocol API testing
      performance/      # Load testing, virtual users
      mobile-testing/   # Mobile testing via Maestro
      accessibility/    # WCAG compliance scanning
      visual-testing/   # Visual regression testing
      salesforce/       # Salesforce-specific tools (20 components)
      ai-testing/       # AI testing, Flowpilot (4 agents)
      dashboard/        # Dashboard & analytics
      platform/         # Settings, integrations, cross-cutting
    pages/              # Landing page + 17 marketing pages
    components/         # Shared layout & UI (49 shadcn/ui primitives)
    lib/                # Shared utilities (api-config, electron-bridge, web-analytics)
    stores/             # Zustand state management
    types/              # TypeScript type definitions
  flowstral-engine/     # TypeScript test recording engine
    src/
      collector/        # Element collection
      core/             # Core engine logic
      detection/        # App detection (Salesforce, Workday, etc.)
      generator/        # Playwright script generation
      handlers/         # Event handlers
      healing/          # Locator self-healing
      locators/         # Smart locator strategies
      runner/           # Test runner
      types/            # Type definitions
      utils/            # Utilities
    bridge/             # Desktop-engine bridge
  flowstral-extension/  # Chrome browser extension
    src/
      background/       # Service worker
      content/          # Content scripts + CSS
      lib/              # Recorder engine, action coalescer
      popup/            # Extension popup
      sidepanel/        # Chrome side panel UI
  flowstral-desktop/    # Electron desktop application
    src/
      main/             # Electron main process
      preload/          # Preload scripts
  api/                  # API specification files
  configs/              # Configuration templates
  data/                 # Training data, collection results
  dgx_training_package/ # NVIDIA DGX fine-tuning package
  docs/                 # 270+ documentation files
  executors/            # Test execution backends
  grafana/              # Monitoring dashboards
  helm/                 # Kubernetes Helm charts
  prometheus/           # Metrics collection
  proto/                # Protocol buffer definitions
  qaai-cli/             # CLI tool
  qa-templates/         # Test case templates
  runner/               # Go-based performance runner
  scripts/              # Utility scripts
  supabase/             # Supabase migrations + config
  tests/                # Test suite
  test-data/            # Sample test data
  test-website/         # Sample app for testing
  tools/                # Build and dev tools
```

---

## 3. Core Platform Capabilities

### 3.1 Test Case Management

The platform provides a full test management system comparable to TestRail/qTest:

- **Test Cases** - Create, edit, clone, bulk operations, custom fields, step-by-step definitions with expected results, attachments, tagging, priority, and status tracking
- **Test Plans** - Group test cases into plans, assign environments, schedule runs, milestone tracking
- **Test Runs** - Execute test plans, real-time step-by-step execution with WebSocket progress updates, screenshot capture at each step, pass/fail/skip/blocked status, duration tracking
- **Test Suites** - Organize tests into hierarchical suites
- **Requirements** - Import from Jira/Azure DevOps, link to test cases, track coverage
- **Defects** - Log defects with severity/priority, link to failed test steps, integrate with Jira/Azure DevOps
- **Traceability Matrix** - Requirements to test cases to defects to test runs, full bidirectional traceability

**Key Pages:** Dashboard, TestCases, TestPlans, TestRuns, Requirements, Defects, Traceability, CreateTestCase, CreateTestPlan, CreateTestRun, EditTestCase, EditTestPlan, TestPlanDetail, TestRunDetail, TestResultsDashboard, Results

### 3.2 AI-Powered Test Generation

The platform's flagship AI capability generates test cases from multiple input sources:

- **From Requirements** - Parse structured requirement context (RequirementContext schema) into test cases with steps, expected results, priority, tags, automation metadata
- **From Jira Tickets** - Direct Jira integration to convert user stories/bugs into test cases
- **From URLs** - Crawl and discover application pages, generate tests based on page analysis
- **From Natural Language** - Chat-based test generation where users describe scenarios
- **Enhanced Generation** - Multi-model pipeline with deterministic scenario skeletons + LLM rewrite
- **Negative Test Generation** - Automatically generate negative/boundary/edge case tests
- **Test Plan Expansion** - AI adds complementary test cases to existing plans

**AI Models:**
- OpenAI GPT-4o-mini (cloud, default)
- Ollama with custom fine-tuned `qa-expert:7b` model (local/on-prem)
- Configurable provider switching (`auto`, `openai`, `ollama`)
- AI Gateway with usage tracking, rate limiting, cost accounting

**AI Services:**
- Test generation (legacy + enhanced pipelines)
- Failure triage and root cause analysis
- False positive detection and flaky test identification
- Failure explanation with suggested fixes
- AI-powered element resolution during automation
- Quality scoring for test steps
- Code generation (test case to Playwright script)

**Key Backend Routers:** `ai_generation_api.py` (122KB, largest file), `ai_automation_api.py`, `ai_enhancements_api.py`, `ai_testing.py`, `requirement_to_testcase_api.py`

### 3.3 Record & Playback (Flowstral Engine)

The Flowstral Engine is the core recording and automation engine, available as both a Chrome extension and embedded in the Electron desktop app:

**Recording Capabilities:**
- Captures clicks, inputs, selects, navigations, scrolls, hovers, file uploads, drag & drop
- Real-time DOM snapshot pipeline - full DOM tree, unique selectors (CSS, XPath, ARIA, text fallback)
- Action coalescing - merges rapid events into meaningful actions
- HAR capture - records network requests for API/load test generation
- Screenshot capture at each action step
- Component hierarchy detection (React, Vue, Angular)

**Smart Locator Strategies:**
- Multi-strategy locator generation (CSS, XPath, ARIA roles, data-testid, text content)
- Application-specific locator strategies for 25+ enterprise apps:
  - **Salesforce** (Lightning Web Components, Aura, shadow DOM, dynamic IDs)
  - **Workday** (data-automation-id, WPA widgets)
  - **ServiceNow** (sys_id, glide forms)
  - **SAP** (Fiori, UI5 controls)
  - **Pega** (data-test-id, harness forms)
  - **Oracle** (OJet components)
  - **Microsoft Dynamics** (Power Apps, model-driven)
  - **NetSuite** (SuiteScript, internalid)
  - And 17+ more enterprise apps

**AI Self-Healing (v3.10.1+):**
- When a test step fails, **Fix/Flag/Wrong buttons auto-fix using the 4-layer AI healing chain**:
  1. **Knowledge lookup** — check if this selector was healed before (0ms)
  2. **Deterministic alternatives** — string transforms and fallback selectors (0ms)
  3. **Vision AI** — screenshot + OpenAI to find the element visually (2-5s)
  4. **OCR** — Tesseract text recognition as last resort (500ms)
- If AI succeeds: selector auto-applied, green badge shown, no manual intervention
- If AI fails: **ManualAssistCard appears inline** below the failed step (stays on test results modal)
- **"Auto-Fix All" button** — fixes all failed steps in a test run at once
- Budget-controlled: max 3 AI calls per run
- Healed selectors recorded for future runs (knowledge reuse)
- False positive persistence — flags survive page refresh via backend API
- Flaky step detection — identifies intermittently failing steps

**Manual Assist Card (v3.10.4+):**
- When AI auto-fix fails, a **Manual Assist card** appears inline below the failed step with 3 modes:
  1. **Paste Element** — user copies outerHTML from DevTools → backend `DOMElementParser` parses it → `EnhancedSelectorEngine` generates 13 ranked selectors
  2. **Enter Selector** — user types CSS/XPath/text selector directly → validated and formatted as Playwright locator
  3. **Paste Screenshot** — user uploads screenshot of element area → Vision AI analyzes → suggests selectors
- Per-step **Manual** button available alongside Fix/Flag/Wrong for direct access
- Backend endpoint: `POST /api/ai/enhancements/manual-assist` (3 modes via `mode` field)
- Key files: `ManualAssistCard.tsx`, `dom_element_parser.py`, `aiEnhancements.ts`

**Script Generation:**
- Generates Playwright test scripts in real-time as user records
- Page Object Model (POM) generation
- Supports assertions, waits, and verification steps
- Export to multiple formats (Playwright, Selenium, Cypress)

**Key Files:** `FlowstralEngine.ts` (18KB), `ElementCollector.ts` (19KB), `PlaywrightScriptGenerator.ts` (22KB), `LocatorHealingRuntime.ts` (18KB), `SessionManager.ts` (17KB), `TestUtilities.ts` (18KB)
**AI Healing Files:** `src/lib/aiEnhancements.ts`, `src/components/ManualAssistCard.tsx`, `backend/app/services/automation/healing_orchestrator.py`, `backend/app/services/automation/dom_element_parser.py`, `backend/app/routers/ai_enhancements_api.py`

### 3.4 API Testing

A Postman-equivalent built into the platform with Monaco code editor, automatic base URL detection, and bulk management:

- **Request Builder** - Full HTTP client (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD) with headers, query params, body (Monaco editor with JSON/XML/GraphQL syntax highlighting)
- **Monaco Code Editor** - Syntax-highlighted body editor with auto-format (Ctrl+L), send shortcut (Ctrl+Enter), response viewer with language auto-detection
- **Collections & Folders** - Organize API requests into collections, nested folders, and workspaces with drag-drop reorder
- **Inline Rename** - Folder rename via inline input (replaces name in-place); request rename via context menu or double-click
- **Bulk Delete** - Visible trash icon on collection header, multi-select mode with checkboxes, Select All / Delete Selected / Delete All
- **Environment Variables** - Multiple environments with variable substitution ({{variable}} syntax)
- **Request Chaining** - Multi-step API workflows with data extraction between steps (JSONPath, regex, header extraction), conditions, retry logic
- **Assertions Panel** - 11 assertion types (status_code, contains, response_time, header, jsonpath, schema, not_contains, regex, equals, xpath, matches_baseline)
- **Response Explorer** - Tree view of JSON responses, syntax highlighting, copy paths
- **Import/Export** - OpenAPI 3.x / Swagger 2.0 / Postman / HAR import with **automatic base URL detection** (6-layer resolution: user input → parsed_spec → servers → host+basePath → raw spec content → fetch URL origin); export to Postman/OpenAPI/HAR formats
- **Code Snippets** - Generate code in 10+ languages (cURL, Python, JavaScript, Go, etc.)
- **Snapshot/Diff Testing** - Save API response baselines and compare against future runs
- **Schema Validation** - JSON Schema assertion against responses (auto-parses schema from JSON string)
- **Schema Inference** - AI-powered JSON schema generation from API responses via `SchemaInferenceEngine`
- **AI Test Generation** - Generate API test suites from OpenAPI specs with negative/edge cases
- **API Coverage Map** - Visualize which endpoints have test coverage
- **Negative Test Auto-Generation** - Automatically generate 405/401/400 variant tests (unique differentiator)

**Key Pages:** EnhancedAPITesting (~200KB), APIImport, APICoverageMap, DataDependencyGraph
**Key Backend:** `enhanced_api_testing_api.py` (41KB), `api_import_api.py` (31KB), `request_chaining_api.py`, `api_spec_parser.py` (base URL extraction)
**Key Store:** `src/stores/apiTestingStore.ts` (Zustand with immer+persist, debounced DB save)

### 3.5 Performance Testing

Load and performance testing rivaling k6/JMeter:

- **Protocol-Level Recording** - Convert HAR recordings to performance test scripts
- **Go-Based Load Runner** - High-performance concurrent user simulation
- **Virtual User Generator** - Configure ramp-up, steady state, ramp-down patterns
- **Metrics Collection** - Response time, throughput, error rate, percentiles (p50, p95, p99)
- **Real-Time Dashboard** - Live metrics visualization during test execution
- **Performance Baselines** - Set and compare against performance thresholds
- **Cloud Distributed Testing** - Scale across multiple nodes (AWS integration)
- **PWA Performance Testing** - Service worker, cache strategy, offline capability testing
- **APM Integration** - Connect to Datadog, New Relic, Dynatrace for correlated metrics

**Key Pages:** Performance (89KB), VirtualUserGenerator, APMConfig
**Key Backend:** `performance_api.py`, `protocol_recording_api.py`, `scale_api.py`
**Key Docs:** PERFORMANCE_PLATFORM_SINGLE_DOC, PERFORMANCE-GO-RUNNER-VS-K6, PERFORMANCE-BETTER-THAN-K6-IMPLEMENTATION

### 3.6 Accessibility Testing

WCAG compliance testing and reporting:

- **Automated Scanning** - axe-core based WCAG 2.1 AA/AAA scanning
- **Site-Wide Scans** - Crawl entire site and scan all pages
- **Issue Management** - Track accessibility violations with severity, impact, suggested fixes
- **VPAT Generation** - AI-generated Voluntary Product Accessibility Template documents
- **Compliance Dashboard** - Track accessibility debt and compliance metrics over time
- **Accessibility Debt Tracking** - Monitor remediation progress per project
- **Real-Time A11y Panel** - During Flowstral recording, accessibility issues surface in real time

**Key Pages:** Accessibility
**Key Backend:** `accessibility_api.py` (17KB), `accessibility_scan_api.py` (10KB)

### 3.7 Visual Testing

Screenshot-based visual regression testing:

- **Baseline Capture** - Save screenshots as visual baselines
- **Pixel Diff Comparison** - Compare current screenshots against baselines
- **Threshold Configuration** - Set acceptable diff percentages
- **Visual Test Reports** - Side-by-side comparison views with highlighted differences
- **Integration with Test Runs** - Screenshots captured during test execution can be compared

**Key Pages:** VisualTestingPage
**Key Backend:** `visual_testing_api.py`

### 3.8 Mobile Testing

Mobile app and mobile web testing:

- **Device Lab** - Configure and manage mobile device inventory
- **Mobile Inspector** - Inspect elements on mobile apps
- **Mobile Test Studio** - Visual test builder for mobile apps
- **Mobile Test Flows** - Define multi-step mobile test scenarios
- **Mobile Test Runs** - Execute tests on real/emulated devices
- **Appium Integration** - Native mobile app testing via Appium
- **Responsive Testing** - Test web apps across different screen sizes

**Key Pages:** MobileTestingPage
**Key Components:** MobileDeviceLab, MobileInspector, MobileTestStudio, MobileTestFlows, MobileTestRuns, MobileAdvancedTools

### 3.9 Salesforce-Specific Testing

Deep Salesforce testing capabilities (one of the platform's differentiators):

- **Lightning Component Testing** - Handle shadow DOM, dynamic IDs, Lightning Web Components
- **SOQL Query Validation** - Test Salesforce queries
- **Apex Test Integration** - Run and monitor Apex test classes
- **Salesforce-Specific Locators** - Smart locator strategies for Lightning, Classic, and Aura
- **Test Data Factory** - Generate Salesforce-specific test data (Accounts, Contacts, Opportunities, etc.)
- **Salesforce Templates** - Pre-built test templates for common Salesforce workflows
- **OAuth Integration** - Salesforce Connected App authentication

**Key Pages:** SalesforceToolsPage (124KB)
**Key Backend:** `salesforce_api.py`, `salesforce_auth.py`
**Key Frontend Services:** `salesforce-api.ts` (41KB), `salesforce-service.ts`, `salesforce-templates.ts` (61KB), `salesforce-test-data-factory.ts` (44KB)

---

## 4. Flowstral Engine - The Action Graph Intelligence Engine

Flowstral is the platform's flagship technology - a real-time capture and analysis engine that builds an Action Graph from user interactions:

### 4.1 Core Pipeline

```
User Action --> Event Capture --> 4 Parallel Micro-Pipelines:
  1. DOM Snapshot Pipeline (full DOM tree, selectors, component hierarchy)
  2. WCAG Scan Pipeline (axe-core accessibility checks)
  3. Performance Probe Pipeline (TTFB, FCP, LCP, CLS, API latency)
  4. Action Graph Update Pipeline (node/edge construction)
```

### 4.2 Action Graph

Each user action becomes a node in a directed graph:
- **Node** = event type + target selector + state before/after + WCAG snapshot + performance snapshot + description
- **Edge** = action + transition time + latency + warnings
- Graph enables path analysis, coverage calculation, and intelligent test generation

### 4.3 Real-Time Outputs

During a Flowstral session, the platform generates in real time:
1. **Playwright Code** - Executable test script growing with each action
2. **Test Steps** - Human-readable test steps with expected results
3. **Accessibility Panel** - Live WCAG violations
4. **Performance Panel** - Live metrics per action
5. **Requirements Coverage** - Map actions to requirements

### 4.4 Session Management

- Sessions are created per project/user with unique IDs
- WebSocket connection for real-time bidirectional communication
- Session artifacts (DOM snapshots, screenshots, HAR files) stored and retrievable
- Session summary with complete action graph, test cases, and insights

---

## 5. Integration Ecosystem

### 5.1 Project Management / Issue Tracking
- **Jira** - Import requirements, create defects, sync test results, bi-directional linking
- **Azure DevOps** - Work items, test plans, pipeline integration
- **Confluence** - Documentation sync, test report publishing

### 5.2 CI/CD Pipelines
- **GitHub Actions** - Workflow templates, status checks, artifact upload
- **Jenkins** - Plugin support, pipeline scripts
- **Azure Pipelines** - YAML templates, service connections
- **GitLab CI** - .gitlab-ci.yml templates

### 5.3 Communication
- Webhook support for Slack/Teams/Discord notifications

### 5.4 Monitoring / APM
- Grafana dashboards (pre-built)
- Prometheus metrics endpoint
- Datadog, New Relic, Dynatrace integration for performance correlation

---

## 6. AI & Machine Learning

### 6.1 AI Architecture

```
                    +------------------+
                    |   AI Gateway     |
                    | (Rate Limit,     |
                    |  Usage Track,    |
                    |  Cost Account)   |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +--------v--------+
     |   OpenAI API    |          |   Ollama (Local)|
     |   GPT-4o-mini   |          |   qa-expert:7b  |
     |   (Cloud)       |          |   (Fine-tuned)  |
     +-----------------+          +-----------------+
```

### 6.2 Fine-Tuned QA Expert Model

- Custom model trained on QA domain data (`dgx_training_package/`)
- Trained on NVIDIA DGX infrastructure
- Specialized in: test case generation, failure analysis, requirement parsing
- Available via Ollama for on-premises/air-gapped deployments

### 6.3 AI Capabilities Matrix

| Capability | Description |
|-----------|-------------|
| Test Generation | Requirements/Jira/URL to structured test cases |
| Enhanced Generation | Multi-model pipeline with deterministic skeleton + LLM rewrite |
| Failure Triage | Analyze test failures, classify root cause, suggest fixes |
| False Positive Detection | Flag likely false positives in test results |
| Flaky Test Detection | Track step reliability history, identify flaky patterns |
| Failure Explanation | Human-readable explanation of why a test failed |
| Element Resolution | AI-powered locator healing when DOM changes |
| Quality Scoring | Score test step quality and suggest improvements |
| Code Generation | Test case to Playwright/Selenium/Cypress script |
| Plan Expansion | Add complementary test cases to existing plans |
| API Test Generation | OpenAPI spec to API test suite with edge cases |
| Accessibility Fix Suggestion | Suggest code fixes for WCAG violations |
| VPAT Generation | Generate compliance documentation |
| Negative Test Generation | Automatically create negative/boundary test cases |

### 6.4 Training Data Pipeline

- Data collection scripts capture real usage patterns
- Training data export endpoint for model improvement
- Feedback loop: user ratings and corrections feed back into training data

---

## 7. Enterprise Features

### 7.1 Multi-Tenancy
- Organization and project isolation
- Tenant-level configuration and branding
- `tenant_service.py`, `tenants_api.py`

### 7.2 Authentication & Authorization
- **Supabase Auth** - Email/password, OAuth (Google, GitHub, Microsoft)
- **RBAC** - Role-based access control with Admin, Manager, Tester, Viewer roles
- `rbac_service.py`, `oauth2_api.py`

### 7.3 Secrets Management
- Encrypted secrets vault for API keys, credentials, tokens
- Project-scoped and organization-scoped secrets
- `vault_service.py`, `secrets_service.py`, `secrets_api.py`

### 7.4 License Management
- License key validation and enforcement
- Feature gating based on license tier (Community, Professional, Enterprise)
- Usage metering and quota management
- License admin page for self-service management
- `license_api.py`, `LicenseAdminPage.tsx`, `LicenseGate.tsx`

### 7.5 Observability & Monitoring
- Metrics collection (Prometheus-compatible)
- System monitoring (CPU, memory, disk, active connections)
- Server monitoring dashboard
- Grafana pre-built dashboards
- `observability_service.py`, `metrics_service.py`, `server_monitoring_api.py`, `system_monitoring_api.py`

### 7.6 Plugin Architecture
- Extensible plugin system for custom integrations
- Plugin management UI
- `plugin_service.py`, `plugin_api.py`, `PluginManagement.tsx`

---

## 8. Deployment Models

### 8.1 SaaS (Hosted)
- **Frontend:** Vercel (vercel.json configured)
- **Backend API:** Railway (qaone-production.up.railway.app)
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** OpenAI API (cloud)

### 8.2 On-Premises / Self-Hosted
- **Docker Compose** - Full stack in containers (PostgreSQL, backend, frontend)
- **Docker Compose Full** - Includes monitoring stack (Grafana, Prometheus)
- **Air-Gapped** - Complete offline deployment with local AI (Ollama)
- **Kubernetes/Helm** - Production-grade K8s deployment with Helm charts

### 8.3 Electron Desktop (Hybrid)
- Embedded webapp + local Playwright + SQLite
- Can operate offline or connected to cloud backend
- Auto-updater via GitHub releases
- Cross-platform: Windows (NSIS installer + portable), macOS (DMG), Linux (AppImage, DEB)

---

## 9. Backend API Surface

The backend exposes **67 router modules** with hundreds of endpoints across these domain areas:

| Router | Prefix | Description |
|--------|--------|-------------|
| `accessibility_api` | `/accessibility` | WCAG scanning, issue tracking, VPAT |
| `accessibility_scan_api` | `/accessibility-scan` | Batch scanning, reports |
| `agent_websocket` | `/ws` | AI agent WebSocket communication |
| `agents_api` | `/agents` | AI agent management |
| `ai_automation_api` | `/ai-automation` | Element resolution, failure analysis |
| `ai_enhancements_api` | `/ai-enhancements` | False positives, flaky detection |
| `ai_generation_api` | `/ai` | Test generation, triage, training data |
| `ai_testing` | `/ai-testing` | AI-powered test execution |
| `api_import_api` | `/api-import` | OpenAPI/Postman/HAR import/export |
| `app_first_flow` | `/app-first-flow` | Record-and-generate workflow |
| `automation_api` | `/automation` | Script conversion, execution |
| `blaze_api` | `/blaze` | High-speed test execution |
| `cdp_recorder_api` | `/cdp-recorder` | Chrome DevTools Protocol recording |
| `code_alchemy_api` | `/code-alchemy` | Code transformation engine |
| `complex_verifications` | `/verifications` | Email, PDF, file, database verifications |
| `compliance_api` | `/compliance` | Regulatory compliance checks |
| `dashboard_api` | `/dashboard` | Stats, activity, metrics |
| `database_api` | `/database` | Direct database operations |
| `defects_api` | `/defects` | Defect CRUD |
| `download_api` | `/download` | File/report downloads |
| `enhanced_api_testing_api` | `/api-testing` | Full API testing engine |
| `exploration_api` | `/exploration` | Exploratory testing |
| `exploration_reporting_api` | `/exploration-reporting` | Exploration session reports |
| `exploration_test_generation_api` | `/exploration-tests` | Generate tests from exploration |
| `exploration_workflow_api` | `/exploration-workflow` | Exploration workflows |
| `flowstral_api` | `/api/flowstral` | Flowstral session management |
| `flowstral_config_api` | `/flowstral-config` | Engine configuration |
| `flowstral_engine_api` | `/flowstral-engine` | Engine operations |
| `framework_analyzer_api` | `/framework-analyzer` | Detect app framework |
| `gherkin_api` | `/gherkin` | BDD Gherkin generation |
| `health_api` | `/health` | Health checks |
| `leads_api` | `/leads` | Marketing leads capture |
| `license_api` | `/license` | License management |
| `llm_api` | `/llm` | LLM provider management |
| `metrics_api` | `/metrics` | Prometheus metrics |
| `models_api` | `/models` | AI model management |
| `nexus_exploratory_api` | `/nexus` | AI-guided exploratory testing |
| `oauth2_api` | `/oauth` | OAuth2 authentication flows |
| `ocr_fallback_api` | `/ocr` | OCR for visual element fallback |
| `owasp_security_api` | `/security` | OWASP security scanning |
| `performance_api` | `/performance` | Load/perf test execution |
| `playwright_recorder_api` | `/playwright-recorder` | Playwright recording integration |
| `plugin_api` | `/plugins` | Plugin management |
| `project_management_api` | `/project-management` | Project/sprint management |
| `protocol_recording_api` | `/protocol-recording` | Network protocol capture |
| `request_chaining_api` | `/request-chaining` | API request chains |
| `requirement_to_testcase_api` | `/req-to-test` | Requirements to test cases |
| `requirements_api` | `/requirements` | Requirements CRUD |
| `salesforce_api` | `/salesforce` | Salesforce testing tools |
| `salesforce_auth` | `/salesforce-auth` | Salesforce OAuth |
| `sample_data_api` | `/sample-data` | Sample/seed data |
| `scale_api` | `/scale` | Distributed testing scale |
| `secrets_api` | `/secrets` | Secrets vault |
| `server_monitoring_api` | `/server-monitoring` | Server health |
| `system_monitoring_api` | `/system-monitoring` | System metrics |
| `tenants_api` | `/tenants` | Multi-tenant management |
| `test_case_api` | `/test-cases` | Test case operations |
| `test_case_rewrite_api` | `/test-case-rewrite` | AI test case improvement |
| `test_cases_crud_api` | `/test-cases-crud` | Test case CRUD |
| `test_plans_api` | `/plans` | Test plan management |
| `test_runs_api` | `/test-runs` | Test run execution |
| `traceability_api` | `/traceability` | Requirements traceability |
| `vision_healing_api` | `/vision-healing` | Visual AI healing |
| `visual_testing_api` | `/visual-testing` | Visual regression testing |
| `workflows_api` | `/workflows` | Workflow orchestration |

---

## 10. Frontend Pages & Features

The frontend consists of **60+ page components** and **150+ shared components**:

### 10.1 Core Testing Pages
| Page | Purpose |
|------|---------|
| Dashboard | Central hub with stats, activity feed, metrics |
| TestCases | List/filter/search test cases |
| CreateTestCase | Multi-step test case builder |
| EditTestCase | Edit existing test cases |
| TestPlans | Test plan management |
| TestRuns | Test run listing and management |
| TestRunDetail | Detailed test run with step-by-step results |
| TestCaseExecution | Live test execution with WebSocket progress |
| TestResultsDashboard | Results analytics and trends |
| TestSuites | Test suite organization |
| TestPlayground | Interactive test experimentation |
| TestRepository | Enterprise test repository browser |
| Results | Test results viewer |

### 10.2 Recording & Automation Pages
| Page | Purpose |
|------|---------|
| PlaywrightRecorderPage | Record & playback (504KB - largest page) |
| UnifiedWorkflowEditor | Visual workflow builder |
| FlowpilotPage | AI-guided flow recorder |
| SelfHealing | Self-healing locator dashboard |
| ElementRepository | Element locator repository |
| CodeAlchemy | Code transformation tool |
| FrameworkAnalyzer | Detect/analyze app frameworks |

### 10.3 API, Performance & Specialized Testing
| Page | Purpose |
|------|---------|
| EnhancedAPITesting | Full API testing workbench (187KB) |
| APIImport | Import OpenAPI/Postman/HAR |
| APICoverageMap | API endpoint coverage visualization |
| Performance | Load/performance test builder and runner |
| VirtualUserGenerator | Configure virtual user profiles |
| Accessibility | WCAG scanning and compliance |
| VisualTestingPage | Visual regression testing |
| MobileTestingPage | Mobile device testing |
| SalesforceToolsPage | Salesforce-specific testing tools |

### 10.4 Management & Integration Pages
| Page | Purpose |
|------|---------|
| Requirements | Requirements management |
| Defects | Defect tracking |
| Traceability | Requirements traceability matrix |
| ProjectManagement | Project/sprint/milestone management |
| ScheduledRuns | Scheduled test execution |
| Analytics | Test analytics and reporting |
| CICD / CICDWizard | CI/CD pipeline configuration |
| Integrations | Third-party integration hub |
| JiraIntegration | Jira connection setup |
| GitHubIntegration | GitHub connection setup |
| AzureDevOpsIntegration | Azure DevOps connection |
| ConfluenceIntegration | Confluence connection |
| DataDependencyGraph | API data flow visualization |
| Settings | Platform settings |
| SecretsVault | Encrypted secrets management |
| LicenseAdminPage | License management |
| AuthPage | Login/signup |
| LandingPage | Public marketing landing page |

---

## 11. Complex Verifications

The platform supports advanced verification steps within test cases:

- **Email Verification** - Check inbox (IMAP/Graph API), verify subject/body/attachments, extract data with regex
- **PDF Verification** - Parse PDFs, verify text content, page count, extract data
- **File Verification** - CSV/Excel/JSON/XML parsing, column validation, row count checks
- **Database Verification** - Execute SQL queries, verify results against expected data
- **API Response Verification** - JSONPath assertions, schema validation, status code checks
- **Visual Verification** - Screenshot comparison with configurable thresholds

---

## 12. Code Alchemy

A code transformation engine that converts between testing frameworks:

- Playwright to Selenium (and vice versa)
- Playwright to Cypress
- Manual test cases to automation scripts
- Gherkin/BDD to Playwright
- Natural language to test code

**Key Backend:** `code_alchemy_api.py`
**Key Page:** CodeAlchemy (57KB)

---

## 13. Exploratory Testing (Nexus)

AI-guided exploratory testing:

- **Exploration Sessions** - Record exploratory testing sessions
- **AI Guidance** - AI suggests areas to explore based on risk/coverage analysis
- **Finding Capture** - Log bugs, observations, and questions during exploration
- **Auto-Test Generation** - Convert exploration findings into formal test cases
- **Exploration Reports** - Session summaries with findings, screenshots, and recommendations

**Key Backend:** `exploration_api.py`, `exploration_workflow_api.py`, `exploration_reporting_api.py`, `exploration_test_generation_api.py`, `nexus_exploratory_api.py`

---

## 14. Security Testing

Basic OWASP security scanning capabilities:

- Common vulnerability detection
- Security-focused test generation
- OWASP Top 10 checks

**Key Backend:** `owasp_security_api.py`

---

## 15. Data Layer

### 15.1 PostgreSQL Schema (via Supabase + Direct)

Core tables include:
- `organizations`, `projects` - Multi-tenant structure
- `test_cases`, `test_case_steps` - Test case definitions
- `test_plans`, `test_plan_cases` - Test plan management
- `test_runs`, `test_run_steps` - Execution results
- `requirements`, `requirement_links` - Requirements traceability
- `defects`, `defect_links` - Defect tracking
- `api_collections`, `api_requests` - API testing data
- `accessibility_scans`, `accessibility_issues` - A11y data
- `performance_runs`, `performance_metrics` - Perf data
- `flowstral_sessions`, `flowstral_events` - Recording sessions
- `ai_generations`, `ai_feedback` - AI generation tracking
- `licenses`, `tenants`, `user_roles` - Enterprise features

### 15.2 In-Memory Fallback
All CRUD operations fall back to in-memory dictionaries when PostgreSQL is unavailable, enabling offline/demo mode.

### 15.3 Supabase Integration
- Authentication (JWT, OAuth)
- Cloud storage for screenshots, artifacts, reports
- Real-time subscriptions for live updates

---

## 16. Competitive Positioning

| Competitor | QAAI Advantage |
|-----------|---------------|
| **TestRail/qTest** | QAAI adds AI test generation, built-in automation, recording, API/perf/a11y testing |
| **Selenium/Playwright** (standalone) | QAAI wraps Playwright with no-code recording, self-healing, enterprise app support |
| **Postman** | QAAI integrates API testing into the full QA lifecycle with AI test generation |
| **k6/JMeter** | QAAI offers protocol-level recording, Go runner, and integrated with test management |
| **Applitools** | QAAI includes visual testing plus full test management and automation |
| **Cypress** | QAAI supports enterprise apps, Salesforce, multi-browser, and is framework-agnostic |
| **Sauce Labs/BrowserStack** | QAAI is self-hostable with embedded Playwright, no external cloud dependency |

---

## 17. Documentation Index

The repository contains **270+ documentation files** in `/docs/`, covering:

- **Architecture:** ARCHITECTURE.md, PLATFORM_ARCHITECTURE.md, ENTERPRISE_ARCHITECTURE.md, FINAL_ARCHITECTURE.md
- **Flowstral:** FLOWSTRAL_MASTER_SPEC.md, FLOWSTRAL_ENGINE_ARCHITECTURE.md, FLOWSTRAL_EXTENSION.md, FLOWSTRAL_WORKFLOW_EDITOR.md
- **API Testing:** API_TESTING_ARCHITECTURE.md, API-TESTING-COMPREHENSIVE-PLAN.md, API-TESTING-USER-GUIDE.md
- **Performance:** PERFORMANCE_PLATFORM_SINGLE_DOC.md, PERFORMANCE-GO-RUNNER-VS-K6.md, PERF-CAPABILITIES-REFERENCE.md
- **Recording:** RECORD-PLAYBACK-ARCHITECTURE.md, RECORD-PLAYBACK-CORE-ARCHITECTURE.md, CDP_RECORDER_ARCHITECTURE.md
- **AI:** AI-FEATURES.md, AI-INTEGRATION-IMPLEMENTATION.md, AI-WORLD-CLASS-STRATEGY.md, QA_EXPERT_FINETUNING_GUIDE.md
- **Deployment:** DEPLOYMENT-AND-PACKAGING-REFERENCE.md, ON-PREM-AND-SAAS-ARCHITECTURE.md, CUSTOMER-DEPLOYMENT-OPTIONS.md
- **Features:** FEATURE-API-TESTING.md, FEATURE-PERFORMANCE-TESTING.md, FEATURE-RECORDING.md, FEATURE-ACCESSIBILITY-VISUAL.md
- **Mobile:** MOBILE-TESTING-COMPLETE-GUIDE.md, MOBILE_TESTING_GUIDE.md
- **Quick Start:** QUICK_START.md, README.md
- **Strategy:** ACQUISITION-TARGETS-AND-PLATFORM-ROADMAP.md, COMPETITOR-PAIN-POINTS-ANALYSIS.md, AI-HIGH-IMPACT-OPPORTUNITIES.md

---

## 18. Key Metrics & Scale

| Metric | Value |
|--------|-------|
| Backend router files | 67 |
| Backend service directories | 30+ |
| Frontend TypeScript/TSX files | 262 |
| Frontend pages | 60+ |
| Frontend components | 150+ |
| Frontend service files | 35+ |
| Documentation files | 270+ (in /docs alone), 319 total .md files |
| Supported enterprise apps | 25+ (Salesforce, Workday, SAP, etc.) |
| API endpoints | 300+ |
| Largest single file | PlaywrightRecorderPage.tsx (504KB) |

---

*This document was auto-generated from codebase analysis on 2026-02-11.*
