# QAAI Master Reference

> **PURPOSE**: Complete reference for the QAAI enterprise test automation platform.
> Share this with AI assistants at the start of any conversation.
> Last Updated: January 2026

---

## Quick Context for AI Assistants

```
QAAI is a full-suite enterprise QA platform with:
- Recording (Playwright + Browser Extension)
- Playback (4-layer fallback: SmartFinder → Legacy → AI Vision → Error)
- Test Building (Visual + Code)
- API Testing (Postman-like + Chaining)
- Performance Testing (JMeter-like + Real browser)
- Accessibility Testing (WCAG 2.1 + Axe-core)
- Visual Testing (Screenshot diff)
- Salesforce Testing (Lightning Web Components)
- Mobile Testing (50+ devices + Maestro for native apps)
- Flowpilot (Goal-based agentic testing - Flowmap, Explorer, Self-Healer, Generator)
- AI Features (Self-healing, Exploration, Generation)
```

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Recording System](#2-recording-system)
3. [Playback System](#3-playback-system)
4. [Test Building](#4-test-building)
5. [API Testing](#5-api-testing)
6. [Performance Testing](#6-performance-testing)
7. [Accessibility Testing](#7-accessibility-testing)
8. [Visual Testing](#8-visual-testing)
9. [Salesforce Testing](#9-salesforce-testing)
10. [Mobile Testing](#10-mobile-testing)
11. [Flowpilot & AI Features](#11-ai-features) ⭐ NEW
12. [Complex Verifications](#12-complex-verifications)
13. [Test Management](#13-test-management)
14. [Key Files Reference](#14-key-files-reference)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

### Project Structure
```
C:\QAAI\
├── backend/                    # Python FastAPI backend (port 8000)
│   ├── app/
│   │   ├── routers/           # 60+ API endpoints
│   │   └── services/          # Business logic
│   │       ├── accessibility/ # WCAG scanning
│   │       ├── agents/        # AI agents (6 personas)
│   │       ├── ai_layer/      # AI enhancements
│   │       ├── api_testing/   # API test execution
│   │       ├── automation/    # Element resolvers
│   │       ├── code_alchemy/  # Code conversion
│   │       ├── executors/     # Test runners
│   │       ├── exploration/   # AI exploration
│   │       ├── flowstral/     # Recording engine
│   │       ├── llm/           # LLM integrations
│   │       ├── performance/   # Perf testing
│   │       ├── salesforce/    # SF automation
│   │       └── storage/       # Data persistence
│   └── data/
│       └── test_cases/        # Stored test cases (JSON)
│
├── flowstral-desktop/         # Electron desktop app
│   └── src/main/
│       ├── index.js           # Main entry, IPC handlers
│       ├── playwright-recorder.js  # Recording & playback
│       ├── test-executor.js   # Test execution
│       └── lib/
│           ├── smart-finder.js      # Element finding
│           ├── element-recipe.js    # Recipe model
│           ├── ai-explorer-agent.js # AI exploration
│           └── ai-goal-agent.js     # Goal-based AI
│
├── flowstral-extension/       # Browser extension
│   └── src/lib/
│       └── recorder-engine.js # Shared recorder
│
└── docs/                      # Documentation
```

### Technology Stack
| Layer | Technology |
|-------|------------|
| Backend | Python 3.10+, FastAPI, SQLAlchemy |
| Desktop App | Electron, Playwright |
| Browser Extension | Chrome Extension API |
| Database | SQLite (dev), PostgreSQL (prod) |
| AI/LLM | OpenAI GPT-4o, Claude, Local models |
| Test Frameworks | Playwright, Selenium, Cypress |

---

## 2. Recording System

### Entry Points
- **Desktop App**: `PlaywrightRecorder.start()` → Opens Playwright browser
- **Browser Extension**: Click extension → Injects `recorder-engine.js`

### Key Files
| File | Purpose |
|------|---------|
| `flowstral-desktop/src/main/playwright-recorder.js` | Main recorder (~8500 lines) |
| `flowstral-extension/src/lib/recorder-engine.js` | Shared engine |
| `flowstral-desktop/src/main/lib/element-recipe.js` | Recipe model |
| `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` | Legacy ↔ Recipe |

### Recording Flow
```
User Action → composedPath() → Element Analysis → Recipe Creation → Action Object
                   ↓
          Pierces Shadow DOM
          Gets actual element
          Captures: what, where, which (position for duplicates)
```

### Recipe Format
```javascript
{
  what: { role: 'button', text: 'Add to Cart', tag: 'button' },
  where: { landmark: 'main', nearText: 'MacBook Pro' },
  which: { position: 3, testId: 'add-cart-btn' },  // 1-based position
  confirm: { cssSelector: '.product-card button' }
}
```

---

## 3. Playback System

### 4-Layer Fallback Architecture
```
Layer 1: SmartFinder (8-phase, with retry) → 95% success
Layer 2: Legacy _findElement (50+ strategies) → 4% additional
Layer 3: AI Vision Fallback (GPT-4o) → 1% additional
Layer 4: Report failure with details
```

### SmartFinder 8 Phases
1. `testId` → `[data-testid="xyz"]`
2. `scope` → Narrow by landmark/container
3. `role` → `getByRole('button', { name })`
4. `text` → `getByText('Submit')`
5. `aria` → `getByLabel('Email')`
6. `name/id` → `[name="email"]`
7. `css-fallback` → Recorded CSS
8. `position` → `nth(position - 1)` for duplicates

### Retry with Exponential Backoff
```
Attempt 1 → fail → wait 500ms
Attempt 2 → fail → wait 1000ms
Attempt 3 → fail → AI fallback
```

### Key Files
| File | Purpose |
|------|---------|
| `playwright-recorder.js` | `executeAction()`, `runTest()` |
| `smart-finder.js` | 8-phase element finding |
| `test-executor.js` | Alternative executor |

---

## 4. Test Building

### Visual Builder Features
- Drag-drop step creation
- Selector picker/editor
- Variable store
- Data-driven testing (CSV/JSON)
- Step grouping/reordering

### Step Types
| Type | Description |
|------|-------------|
| Navigate | Go to URL |
| Click | Click element |
| Input/Fill | Enter text |
| Select | Dropdown selection |
| Wait | Time/element wait |
| Assert | Verify condition |
| API | Make HTTP request |
| Database | Execute SQL |
| If/Else | Conditional logic |
| Loop | Iteration |

### Assertion Types
- `element_visible`, `element_hidden`
- `text_equals`, `text_contains`
- `url_equals`, `url_contains`
- `value_equals`, `checked`
- `element_count`

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/test_cases_crud_api.py` | CRUD operations |
| `backend/app/routers/workflows_api.py` | Workflow management |
| `backend/app/services/automation/` | Step execution |

---

## 5. API Testing

### Features
- Postman-like request builder
- Request chaining (use response in next request)
- Environment variables
- Authentication (OAuth2, API Key, JWT)
- Response validation (JSON Schema)
- Parameterized tests

### Supported Auth Types
- Basic Auth
- Bearer Token
- OAuth 2.0 (all grant types)
- API Key (header/query)
- AWS Signature V4

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/api_import_api.py` | Postman/OpenAPI import |
| `backend/app/routers/enhanced_api_testing_api.py` | API test execution |
| `backend/app/routers/request_chaining_api.py` | Request chaining |
| `backend/app/services/api_testing/` | API test services |

### Documentation
- `docs/API_TESTING_ARCHITECTURE.md`
- `docs/API_TESTING_USAGE.md`
- `docs/API_AND_PERFORMANCE_TESTING_GUIDE.md`

---

## 6. Performance Testing

### Features
- Real browser performance (Playwright)
- Protocol-level testing (HTTP/HTTPS)
- Virtual user simulation
- Load patterns (ramp-up, steady, spike)
- Core Web Vitals metrics
- Real-time monitoring

### Metrics Captured
| Metric | Description |
|--------|-------------|
| Response Time | Time to first byte |
| Throughput | Requests/second |
| Error Rate | Failed requests % |
| LCP | Largest Contentful Paint |
| FID | First Input Delay |
| CLS | Cumulative Layout Shift |
| TTFB | Time to First Byte |

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/performance_api.py` | Perf test API |
| `backend/app/services/performance/` | 28 files for perf testing |
| `backend/app/routers/protocol_recording_api.py` | Protocol recording |

### Documentation
- `docs/PERFORMANCE_TESTING_ARCHITECTURE.md`
- `docs/PERFORMANCE_TESTING_USAGE.md`

---

## 7. Accessibility Testing

### Standards Supported
- WCAG 2.1 (A, AA, AAA)
- Section 508
- EN 301 549

### Features
- Axe-core integration
- Full page scan
- Component-level scan
- Issue categorization (Critical, Serious, Moderate, Minor)
- Remediation suggestions
- VPAT report generation

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/accessibility_api.py` | Accessibility API |
| `backend/app/routers/accessibility_scan_api.py` | Scan endpoints |
| `backend/app/services/accessibility/` | Axe scanner, reports |

---

## 8. Visual Testing

### Features
- Screenshot comparison (baseline vs current)
- Pixel-diff highlighting
- Ignore regions (dynamic content)
- Responsive testing (multiple viewports)
- Cross-browser comparison

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/visual_testing_api.py` | Visual test API |

---

## 9. Salesforce Testing

### Special Support
- Lightning Web Components (Shadow DOM)
- Lightning Experience navigation
- Salesforce-specific selectors
- OAuth 2.0 authentication
- Auto-connect feature

### Shadow DOM Handling
```javascript
// Recording: composedPath() pierces Shadow DOM
const path = event.composedPath();
const actualElement = path[0];

// Playback: Playwright >> syntax
page.locator('lightning-button >> button');
```

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/salesforce_api.py` | SF test API |
| `backend/app/routers/salesforce_auth.py` | SF authentication |
| `backend/app/services/salesforce/` | SF services |

### Documentation
- `docs/SALESFORCE_TESTING_GUIDE.md`
- `docs/SALESFORCE_AUTH_SETUP.md`
- `docs/SF_TOOLS_USAGE_GUIDE.md`

---

## 10. Mobile Testing

### Overview
QAAI's Mobile Testing Pack provides comprehensive mobile testing without a device cloud:

1. **Mobile Web Emulation** - Test responsive web apps with 50+ real device profiles
2. **Native App Testing** - Test iOS/Android apps via Maestro integration

### Key Features

| Feature | Description |
|---------|-------------|
| Device Profiles | 50+ real devices (iPhone, iPad, Pixel, Galaxy, etc.) |
| Network Throttling | 5G, 4G, 3G, 2G, Slow 3G, Offline |
| Touch Events | Accurate touch simulation |
| Device Scale | Retina/high-DPI support |
| Maestro Integration | Native iOS/Android app testing |

### Quick Start

```javascript
// Mobile web testing
playwrightRecorder.setMobileDevice('iPhone 15 Pro');
playwrightRecorder.setMobileNetwork('4G');
await playwrightRecorder.start('https://your-app.com');

// Native app testing (requires Maestro)
const runner = new MaestroRunner({ appId: 'com.example.app', platform: 'android' });
await runner.runTest(steps);
```

### Key Files
- `flowstral-desktop/src/main/lib/mobile-devices.js` - 50+ device profiles
- `flowstral-desktop/src/main/lib/maestro-integration.js` - Native app testing
- `flowstral-desktop/src/main/lib/mobile-test-runner.js` - Unified interface
- `src/components/MobileDeviceSelector.tsx` - UI component

### Documentation
- `docs/MOBILE_TESTING_GUIDE.md` - Complete guide

---

## 10b. PWA Testing ⭐ NEW

### Overview
QAAI now includes comprehensive Progressive Web App (PWA) testing capabilities.

### Features

| Feature | Description |
|---------|-------------|
| Manifest Validation | Validate manifest.json for PWA compliance |
| Service Worker Testing | Detect and verify SW registration/activation |
| Offline Testing | Test app behavior when offline |
| Cache Verification | Verify cached resources for offline use |
| Installability Check | Verify all PWA installability criteria |

### PWA Test Actions

| Action Type | Description |
|-------------|-------------|
| `pwaAudit` | Comprehensive PWA check (score 0-100) |
| `checkManifest` | Validate web app manifest |
| `checkServiceWorker` | Verify SW registration |
| `waitForServiceWorker` | Wait for SW activation |
| `testOffline` | Test offline functionality |
| `checkCache` | Verify cache storage |
| `checkInstallability` | Check all installability criteria |

### Quick Example

```javascript
// In test steps
const pwaSteps = [
  { type: 'goto', url: 'https://your-pwa.com' },
  { type: 'waitForServiceWorker', state: 'activated' },
  { 
    type: 'pwaAudit',
    expectedElements: ['body', '#app'],
    expectedText: ['Welcome']
  }
];
```

### Key Files
- `flowstral-desktop/src/main/lib/pwa-testing/` - PWA testing module
- `flowstral-desktop/src/main/ipc/pwa-handlers.js` - IPC handlers

### Documentation
- `docs/PWA_TESTING_GUIDE.md` - Complete guide

---

## 11. AI Features

### 🚀 Flowpilot - Goal-Based Agentic Testing

Flowpilot is QAAI's breakthrough AI capability - the first goal-based agentic testing platform. It consists of four autonomous agents:

| Agent | Purpose | Key Features |
|-------|---------|--------------|
| **Flowmap** | Journey Discovery | Visualize all user paths, find coverage gaps automatically |
| **Explorer** | Autonomous Testing | AI crawls your app finding bugs while you sleep |
| **Self-Healer** | Smart Locators | Auto-repair broken selectors, zero flaky tests |
| **Generator** | Test Creation | Describe goals in plain English, get working tests |

**How Flowpilot Works:**
```
User Goal: "Test checkout with invalid coupon"
     ↓
[Explorer] Scans page → Finds cart, coupon field, checkout button
     ↓  
[Generator] Creates steps → Navigate, add items, enter coupon, verify error
     ↓
[Self-Healer] Optimizes → Creates resilient locators with fallbacks
     ↓
Working Test: Ready for playback and CI/CD integration
```

### AI Goal Agent (v3.0) - Plan-First Architecture

The AI Goal Agent allows natural language test generation:

```
Goal: "Add iPhone 15 Pro and MacBook Pro to cart, remove AirPods, select Express shipping"
```

**Architecture:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Natural Goal   │ ──► │  Deep Analysis   │ ──► │  Smart Planning │
│  (User Input)   │     │  (Page Scan)     │     │  (1 API Call)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│  Test Case      │ ◄── │  Local Execution │ ◄────────────┘
│  (Playback OK)  │     │  (No API Calls)  │
└─────────────────┘     └──────────────────┘
```

**Key Features:**
- **Plan First**: Single GPT-4o call creates full action plan
- **Execute Locally**: Playwright executes plan without further API calls  
- **Product-Specific**: Records actual product names (not generic "Add to Cart")
- **Smart Selectors**: Handles Radix dropdowns, Shadow DOM, tabs, modals
- **Element Indexing**: Tracks Nth element for duplicate buttons
- **Memory State**: Tracks cart items, visited pages, filled fields

**Usage (Flow Map → Goal Agent):**
1. Enter natural language goal
2. Optionally provide test data (email, username, etc.)
3. Click "Execute Goal"
4. Save generated test for playback

### AI Agents (6 Personas)
| Agent | Purpose |
|-------|---------|
| Test Design Agent | Suggests test scenarios |
| Requirements Agent | Parses requirements to tests |
| Defect Agent | Analyzes failures |
| Performance Agent | Performance recommendations |
| Security Agent | Security vulnerability detection |
| Accessibility Agent | A11y recommendations |

### AI Capabilities
| Feature | Description |
|---------|-------------|
| Self-Healing | AI Vision finds moved elements |
| AI Exploration | Autonomous page exploration |
| Goal-Based Testing | Generate tests from natural language |
| Gap Analysis | Find missing test coverage |
| Recording Enhancement | Improve recorded selectors |

### Key Files
| File | Purpose |
|------|---------|
| `flowstral-desktop/src/main/lib/ai-goal-agent.js` | Goal-based agent (v3.0) |
| `flowstral-desktop/src/main/lib/ai-explorer-agent.js` | Autonomous exploration |
| `flowstral-desktop/src/main/lib/ai-test-generator.js` | Test generation |
| `backend/app/services/agents/` | AI personas (6) |
| `backend/app/services/ai/vision_self_healing.py` | Self-healing |

### AI Fallback (Playback)
```javascript
// When all locators fail:
1. Take screenshot
2. Send to GPT-4o: "Find 'Add to Cart' button"
3. Get pixel coordinates (x, y)
4. Click at coordinates
5. Budget: 5 calls per test run
```

---

## 11. Complex Verifications

### Supported Verifications
| Type | Description |
|------|-------------|
| Email | Verify emails (Microsoft 365, Gmail) |
| PDF | Extract and verify PDF content |
| File | Verify downloaded files |
| Database | Execute and verify SQL queries |
| API Response | Complex JSON assertions |

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/complex_verifications.py` | Verification API |
| `backend/app/services/complex_verifications/` | Verification logic |

### Documentation
- `docs/FEATURES_USAGE_GUIDE.md` (Email, PDF, File)
- `docs/COMPLEX_VERIFICATIONS.md`

---

## 12. Test Management

### Features
- Test Cases (CRUD, tagging, priority)
- Test Plans (group tests)
- Test Runs (execute, track)
- Requirements traceability
- Defect tracking
- Dashboard & metrics
- CI/CD integration

### Key Files
| File | Purpose |
|------|---------|
| `backend/app/routers/test_cases_crud_api.py` | Test cases |
| `backend/app/routers/test_plans_api.py` | Test plans |
| `backend/app/routers/test_runs_api.py` | Test runs |
| `backend/app/routers/requirements_api.py` | Requirements |
| `backend/app/routers/defects_api.py` | Defects |
| `backend/app/routers/dashboard_api.py` | Dashboard |
| `backend/app/routers/traceability_api.py` | Traceability |

---

## 13. Key Files Reference

### Desktop App (flowstral-desktop)
| File | Lines | Purpose |
|------|-------|---------|
| `src/main/index.js` | ~2900 | Main entry, IPC handlers |
| `src/main/playwright-recorder.js` | ~8700 | Recording & playback |
| `src/main/test-executor.js` | ~3500 | Test execution |
| `src/main/lib/smart-finder.js` | ~600 | Element finding (8 phases) |
| `src/main/lib/element-recipe.js` | ~400 | Recipe model (what/where/which) |
| `src/main/lib/ai-goal-agent.js` | ~1200 | Goal-based AI agent (v3.0) |
| `src/main/lib/ai-explorer-agent.js` | ~1000 | AI exploration |
| `src/main/lib/action-handlers.js` | ~400 | Modular action handlers |
| `src/main/lib/tab-manager.js` | ~300 | Multi-tab/window handlers |
| `src/main/lib/salesforce-handlers.js` | ~200 | Salesforce-specific handlers |
| `src/main/lib/recipe-recorder-integration.js` | ~600 | Browser injection script |
| `src/main/lib/action-coalescer.js` | ~300 | Dropdown sequence detection |

### Backend (backend/app)
| Directory | Files | Purpose |
|-----------|-------|---------|
| `routers/` | 60+ | API endpoints |
| `services/accessibility/` | 3 | WCAG scanning |
| `services/agents/` | 12 | AI agents |
| `services/api_testing/` | 11 | API tests |
| `services/automation/` | 18 | Element resolvers |
| `services/performance/` | 28 | Perf testing |
| `services/llm/` | 23 | LLM integrations |

---

## 14. Troubleshooting

### Recording Issues
| Problem | Solution |
|---------|----------|
| Element not captured | Check Shadow DOM, use composedPath() |
| Duplicate elements | Verify elementIndex is captured |
| Dynamic IDs | Recipe uses role/text, not ID |

### Playback Issues
| Problem | Solution |
|---------|----------|
| Element not found | Check SmartFinder logs, increase timeout |
| Wrong element clicked | Verify elementIndex/position |
| Custom dropdown fails | Uses click-then-select for Radix/Headless |
| Slow page | Retry with backoff handles this |

### AI Fallback Issues
| Problem | Solution |
|---------|----------|
| AI not triggered | Check `enableAIFallback: true` |
| Budget exhausted | Check `maxAICallsPerRun` (default: 5) |
| No API key | Set `OPENAI_API_KEY` env var |

---

## Configuration

### PlaywrightRecorder Options
```javascript
new PlaywrightRecorder({
  useRecipeRecorder: true,        // Recipe-based recording
  useSmartFinderForPlayback: true, // SmartFinder for playback
  enableAIFallback: true,         // AI vision fallback
  maxAICallsPerRun: 5,            // AI budget per test
});
```

### Environment Variables
```env
# Backend
OPENAI_API_KEY=sk-xxx           # For AI features
BACKEND_URL=http://localhost:8000
DATABASE_URL=sqlite:///./qaai.db

# Salesforce
SF_CLIENT_ID=xxx
SF_CLIENT_SECRET=xxx

# Email Verification
MS_CLIENT_ID=xxx
MS_CLIENT_SECRET=xxx
MS_TENANT_ID=xxx
```

---

## How to Use This Document

### For AI Assistants
At the start of any conversation, the user should say:
```
Read C:\QAAI\docs\QAAI-MASTER-REFERENCE.md
```

Or for specific features:
```
Read C:\QAAI\docs\QAAI-MASTER-REFERENCE.md section on [feature]
```

### Feature-Specific Deep Dives
| Feature | Additional Doc |
|---------|---------------|
| Recording/Playback | `QAAI-CAPABILITIES-REFERENCE.md` |
| API Testing | `API_TESTING_USAGE.md` |
| Performance | `PERFORMANCE_TESTING_USAGE.md` |
| Salesforce | `SALESFORCE_TESTING_GUIDE.md` |
| Complex Verifications | `FEATURES_USAGE_GUIDE.md` |

---

## Version History

| Date | Changes |
|------|---------|
| Jan 2026 | Initial master reference created |
| Jan 2026 | Added AI fallback to PlaywrightRecorder |
| Jan 2026 | Added retry with exponential backoff |
| Jan 2026 | Fixed elementIndex for duplicates |
| Jan 2026 | Added custom dropdown support |
