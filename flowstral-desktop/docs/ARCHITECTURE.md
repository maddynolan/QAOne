# Flowstral Desktop Architecture

## Overview

Flowstral Desktop is the Electron-based desktop application for QAAI. It provides recording, playback, and test execution capabilities using Playwright.

## Directory Structure

```
flowstral-desktop/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.js             # Main entry point (2,920 lines)
│   │   ├── playwright-recorder.js # Recording engine (11,124 lines)
│   │   ├── test-executor.js     # Test execution (3,588 lines)
│   │   ├── embedded-browser.js  # Embedded browser view
│   │   ├── browser-controller.js
│   │   ├── local-storage.js
│   │   ├── sqlite-storage.js
│   │   ├── license.js
│   │   ├── cloud-connector.js
│   │   ├── recorder.js          # Legacy recorder
│   │   ├── preload.js           # Preload scripts
│   │   ├── webapp-preload.js
│   │   ├── ipc/                 # IPC handlers (extracted from index.js)
│   │   │   ├── index.js             # Handler registration
│   │   │   ├── recorder-handlers.js # Playwright recorder IPC
│   │   │   └── mobile-handlers.js   # Mobile testing IPC
│   │   └── lib/                 # Shared modules
│   │       ├── action-handlers.js    # UNIFIED execution (1,130 lines)
│   │       ├── smart-finder.js       # Element finding (1,181 lines)
│   │       ├── element-recipe.js     # Recipe model (696 lines)
│   │       ├── salesforce-handlers.js# SF-specific actions (676 lines)
│   │       ├── recipe-recorder-integration.js
│   │       ├── action-coalescer.js
│   │       ├── assertion-handlers.js # Assertions (365 lines)
│   │       ├── ai-fallback.js        # AI vision (217 lines)
│   │       ├── recording-utils.js    # Text utilities (214 lines)
│   │       ├── mobile-config.js      # Mobile emulation (150 lines)
│   │       ├── mobile-devices.js     # Device presets
│   │       └── ai-*.js               # AI agents
│   └── renderer/                # React web app (loaded in BrowserView)
└── docs/
    └── ARCHITECTURE.md          # This file
```

## Core Components

### 1. Main Entry (`index.js`)
- Electron app lifecycle management
- Window/BrowserView creation
- IPC handler registration
- Module instantiation

### 2. PlaywrightRecorder (`playwright-recorder.js`)
- Recording user interactions
- Script injection for event capture
- Multi-tab/cross-origin support
- Test playback coordination

### 3. TestExecutor (`test-executor.js`)
- Test execution from builder/tests tab
- Salesforce-specific actions
- API integration
- Result reporting

### 4. ActionHandlers (`lib/action-handlers.js`) - UNIFIED
- **THE** single entry point for all action execution
- Both PlaywrightRecorder and TestExecutor use this
- Ensures identical behavior across all execution paths

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                              │
│  (Recording Page / Builder / Tests Tab)                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     IPC HANDLERS (index.js)                          │
│  playwright-recorder-run-test, test-executor-run, etc.              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   PlaywrightRecorder    │     │     TestExecutor        │
│   executeAction()       │     │     executeStep()       │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            └───────────────┬───────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              UNIFIED: lib/action-handlers.js                         │
│                                                                      │
│   executeAction(ctx, action, options)                                │
│     │                                                                │
│     ├── handleClick()  → SmartFinder → AI Fallback                  │
│     ├── handleFill()   → SmartFinder → AI Fallback                  │
│     ├── handleHover()  → SmartFinder → AI Fallback                  │
│     ├── handleSelect() → Radix/Native dropdown support              │
│     └── handle*()      → All other actions                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ELEMENT FINDING                                   │
│                                                                      │
│   1. SmartFinder (lib/smart-finder.js)                              │
│      └── 10-phase strategy with recipe-based identification          │
│                                                                      │
│   2. AI Vision Fallback (lib/ai-fallback.js)                        │
│      └── Screenshot → GPT-4o → Coordinates                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### action-handlers.js
**Purpose**: Unified action execution point

```javascript
// Usage in both executors:
const ActionHandlers = require('./lib/action-handlers');
const result = await ActionHandlers.executeAction(ctx, action, { timeout });
```

**Exports**:
- `executeAction()` - THE unified entry point
- `handleClick()`, `handleFill()`, `handleHover()`, etc.
- `findElementWithAI()` - AI vision fallback
- `normalizeTextForMatching()` - Text utilities

### smart-finder.js
**Purpose**: Robust element finding with 10-phase fallback

**Strategies** (in order):
1. data-testid (highest priority)
2. name attribute
3. id (if not dynamic)
4. aria-label
5. role + text
6. getByLabel (for forms)
7. getByText (exact)
8. getByText (partial)
9. CSS selector
10. AI Vision (last resort)

### ai-fallback.js
**Purpose**: AI-powered element location when deterministic fails

```javascript
const { findElementWithAI } = require('./lib/ai-fallback');
const coords = await findElementWithAI(ctx, 'Submit button', 'click');
// Returns { x: 100, y: 200, confidence: 0.95 } or null
```

### recording-utils.js
**Purpose**: Text normalization and utilities

```javascript
const { normalizeTextForMatching, getActionLabel } = require('./lib/recording-utils');
const label = normalizeTextForMatching("Submit's Form"); // "Submit's Form"
```

### assertion-handlers.js
**Purpose**: Unified assertion execution

```javascript
const { executeAssertion } = require('./lib/assertion-handlers');
const result = await executeAssertion(ctx, assertion, stepSelector);
// Returns { success: true } or { success: false, error: 'message' }
```

**Assertion Types Supported**:
- `text_contains`, `text_equals`, `text_not_contains`
- `element_visible`, `element_hidden`, `element_exists`
- `value_equals`, `value_contains`
- `url_contains`, `url_equals`
- `page_loaded`, `network_idle`
- Toast/notification assertions
- Salesforce/API assertions (auto-pass in UI context)

### mobile-config.js
**Purpose**: Mobile device emulation configuration

```javascript
const { MobileConfig } = require('./lib/mobile-config');
const mobile = new MobileConfig();
mobile.setDevice('iPhone 15 Pro');
const options = mobile.getContextOptions();
```

## Recording Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RECORDING (PlaywrightRecorder)                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Script Injection (recipe-recorder-integration.js)       │
│                                                                      │
│   - Click handler with ElementRecipe capture                         │
│   - Input handler for form fields                                    │
│   - Hover handler for flyout menus                                   │
│   - Change handler for checkboxes/selects                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Console Listener (_setupConsoleListenerForPage)         │
│                                                                      │
│   Captures: __FLOWSTRAL_CLICK__, __FLOWSTRAL_FILL__, etc.           │
│   Deduplicates: 50ms time window, tabIndex tracking                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Action Processing & Deduplication                       │
│                                                                      │
│   - Recipe action conversion                                         │
│   - SwitchTab deduplication                                          │
│   - Click normalization                                              │
│   - Final dedupe pass                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Playback Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PLAYBACK (runTest/executeTest)                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              For each step in test:                                  │
│                                                                      │
│   1. Check tabIndex → Switch to correct tab if needed               │
│   2. Call ActionHandlers.executeAction()                             │
│   3. Wait for stability (300ms)                                      │
│   4. Capture screenshot if configured                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ActionHandlers.executeAction()                          │
│                                                                      │
│   Tries in order:                                                    │
│   1. SmartFinder with recipe                                         │
│   2. Legacy selector strategies                                      │
│   3. iFrame search                                                   │
│   4. AI Vision fallback                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Unified Execution Point
All action execution goes through `ActionHandlers.executeAction()`. This ensures:
- Consistent behavior across recording/builder/tests
- Single place to fix bugs
- Easier maintenance

### 2. Recipe-Based Element Identification
Elements are captured with rich metadata (what/where/which):
```javascript
{
  what: { role: 'button', text: 'Submit' },
  where: { landmark: 'main', region: 'form' },
  which: { position: 2, testId: 'submit-btn' }
}
```

### 3. AI Vision as Last Resort
When deterministic strategies fail, AI vision provides a safety net:
- Budget-limited (max 5 calls per run)
- 70%+ confidence threshold
- Logs for debugging

### 4. Implicit Tab Switching
Actions include `tabIndex` property. During playback, the executor automatically switches to the correct tab without explicit SwitchTab actions.

## Line Counts (Post-Refactor - Jan 2026)

| File | Lines | Status |
|------|-------|--------|
| `playwright-recorder.js` | 10,729 | Core (uses shared modules) |
| `test-executor.js` | 3,590 | Core (uses shared modules) |
| `index.js` | 2,920 | Entry point |
| `smart-finder.js` | 1,181 | Element finding |
| `action-handlers.js` | 1,130 | **UNIFIED** execution |
| `salesforce-handlers.js` | 649 | SF-specific actions |
| `assertion-handlers.js` | 365 | Assertions (~416 lines extracted) |
| `ai-fallback.js` | 217 | AI vision |
| `recording-utils.js` | 214 | Text utilities |
| `mobile-config.js` | 150 | Mobile emulation |

### Shared Code Extraction

Previously duplicated code now in shared modules:
- **Action Handlers**: ~1000 lines → `action-handlers.js` (unified)
- **Salesforce Handlers**: ~650 lines → `salesforce-handlers.js` (shared)
- **Assertion Handlers**: ~416 lines → `assertion-handlers.js` (shared)
- **AI Fallback**: ~140 lines → `ai-fallback.js` (shared by both executors)
- **Text Utilities**: ~100 lines → `recording-utils.js` (shared)
- **Mobile Config**: ~150 lines → `mobile-config.js` (shared)

## Refactoring Status (Jan 2026)

### ✅ Phase 1: Action Handlers (COMPLETE)
Unified action execution in `action-handlers.js`:
- Click, Fill, Hover, Select, Navigate, etc.
- SmartFinder + AI fallback integration
- Used by both PlaywrightRecorder and TestExecutor

### ✅ Phase 2: Salesforce Handlers (COMPLETE)
SF-specific actions in `salesforce-handlers.js`:
- sf_connect, sf_query, sf_assert
- sf_create_record, sf_update_record
- sf_metadata_assert, sf_navigate

### ✅ Phase 3: Assertion Handlers (COMPLETE)
Assertion execution in `assertion-handlers.js`:
- ~416 lines extracted from playwright-recorder.js
- 50+ assertion types supported
- Shared by both executors

### ⏸️ Future Phases (Not Started - Lower Priority)

**Phase 4: IPC Handler Extraction**
Split index.js IPC handlers (optional, 2,920 lines is manageable):
- `ipc/recorder-handlers.js` - playwright-recorder-* handlers
- `ipc/browser-handlers.js` - embedded-browser-* handlers
- `ipc/mobile-handlers.js` - mobile-* handlers

**Phase 5: Page Analyzer**
Extract `analyzePage()` from playwright-recorder.js (optional):
- ~1800 lines of DOM analysis
- Could be a standalone module for reuse

**Phase 6: Injected Scripts**
Extract injected scripts to `lib/injected-scripts.js` (optional):
- ~400 lines of embedded JavaScript
- Would improve maintainability

## Testing

### Unit Tests
```bash
cd flowstral-desktop
npm test
```

### Syntax Validation
```bash
node --check src/main/lib/action-handlers.js
node --check src/main/lib/ai-fallback.js
node --check src/main/lib/recording-utils.js
```

## Contributing

When adding new action types:
1. Add handler in `action-handlers.js`
2. Add case in `executeAction()` switch
3. Export the handler
4. Document in this file
