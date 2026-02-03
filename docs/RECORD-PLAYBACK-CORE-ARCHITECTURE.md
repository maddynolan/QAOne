# Record & Playback - Core Architecture Document

> **CRITICAL: This is the living document for QAAI's core Record & Playback system.**
> 
> **Before making ANY changes to recording or playback code, read this document.**
> 
> **After making changes, update this document.**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Recording System](#3-recording-system)
   - 3.1 [Recording Entry Points](#31-recording-entry-points)
   - 3.2 [Event Capture](#32-event-capture)
   - 3.3 [Selector Generation (SmartSelector)](#33-selector-generation-smartselector)
   - 3.4 [Action Object Structure](#34-action-object-structure)
   - 3.5 [Action Coalescing](#35-action-coalescing)
   - 3.6 [Key Recording Files](#36-key-recording-files)
4. [Playback System](#4-playback-system)
   - 4.1 [Playback Entry Points](#41-playback-entry-points)
   - 4.2 [Element Finding Strategy (SmartFinder)](#42-element-finding-strategy-smartfinder)
   - 4.3 [Manual Override System](#43-manual-override-system)
   - 4.4 [Fallback Layers](#44-fallback-layers)
   - 4.5 [Lock Locators](#45-lock-locators-user-controlled-optimization)
   - 4.6 [Reliability Layer](#46-reliability-layer)
   - 4.7 [Key Playback Files](#47-key-playback-files)
5. [Step Editor & Repair System](#5-step-editor--repair-system)
   - 5.1 [SimpleStepEditor Component](#51-simplestepeditor-component)
   - 5.2 [Element Picker](#52-element-picker)
   - 5.3 [Manual Override Flow](#53-manual-override-flow)
   - 5.4 [Key Editor Files](#54-key-editor-files)
6. [False Positive & Screenshot System](#6-false-positive--screenshot-system)
   - 6.1 [Current State](#61-current-state)
   - 6.2 [Desired Workflow](#62-desired-workflow)
   - 6.3 [Implementation Requirements](#63-implementation-requirements)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Critical Code Paths](#8-critical-code-paths)
9. [Regression Prevention Checklist](#9-regression-prevention-checklist)
10. [Common Failure Modes](#10-common-failure-modes)
11. [Testing Requirements](#11-testing-requirements)
12. [**Industry Comparison & Best Practices**](#12-industry-comparison--best-practices)
13. [**Proposed Enhancements (2026)**](#13-proposed-enhancements-2026)
14. [**Cross-Device Testing: Record Anywhere, Play Everywhere**](#14-cross-device-testing-record-anywhere-play-everywhere)

---

## 1. System Overview

The Record & Playback system is QAAI's core functionality that enables:
- **Recording** user interactions in a browser
- **Playing back** those interactions reliably
- **Repairing** failed steps when elements change
- **Flagging** false positives for investigation

### Key Principles

1. **Selector Robustness**: Generate multiple selector strategies, ordered by reliability
2. **Manual Override Priority**: User-specified selectors ALWAYS take precedence
3. **Lock Locators**: After successful run, lock working selectors for instant playback anywhere
4. **Graceful Fallback**: Multiple layers of fallback when primary strategy fails
5. **Smart Repair**: Non-technical users can fix broken steps without DOM knowledge

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ PlaywrightRecorder│  │   TestRunner     │  │  SimpleStepEditor│          │
│  │     Page.tsx     │  │   (Run Test)     │  │    (Repair)      │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
└───────────┼─────────────────────┼─────────────────────┼─────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON MAIN PROCESS                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ PlaywrightRecorder│  │   TestExecutor   │  │  ElementPicker   │          │
│  │      .js         │  │       .js        │  │                  │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           ▼                     ▼                     ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    SHARED LIBRARIES                           │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │          │
│  │  │SmartSelector│  │ SmartFinder │  │Reliability  │          │          │
│  │  │ (Recording) │  │ (Playback)  │  │   Layer     │          │          │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │          │
│  │  │ActionCoalesce│ │ActionHandlers│ │  AI Fallback│          │          │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │          │
│  └──────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLAYWRIGHT BROWSER                                 │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │                    Browser Page                               │          │
│  │  - Event listeners injected during recording                  │          │
│  │  - Locators used during playback                             │          │
│  └──────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Recording System

### 3.1 Recording Entry Points

| Entry Point | File | Description |
|------------|------|-------------|
| UI "Start Recording" button | `src/pages/PlaywrightRecorderPage.tsx` | User clicks to start |
| IPC handler | `flowstral-desktop/src/main/index.js` | `start-recording` handler |
| Recorder class | `flowstral-desktop/src/main/playwright-recorder.js` | `startRecording()` method |

**Flow:**
```
User clicks "Start Recording"
    ↓
PlaywrightRecorderPage.tsx → handleStartRecording()
    ↓
window.electronAPI.testRunner.startRecording({ url })
    ↓
IPC: 'start-recording' → index.js
    ↓
PlaywrightRecorder.startRecording(url)
    ↓
Injects recorder-engine.js into browser page
    ↓
Attaches event listeners (click, input, etc.)
```

### 3.2 Event Capture

**File:** `flowstral-extension/src/lib/recorder-engine.js`

**Events Captured:**
| Event | Handler | Line (approx) |
|-------|---------|---------------|
| click | `handleClick()` | 4129-4284 |
| dblclick | `handleDblClick()` | 4286+ |
| input | `handleInput()` | 4350+ |
| change | `handleChange()` | 4450+ |
| keydown | `handleKeyDown()` | 4500+ |
| submit | `handleSubmit()` | 4600+ |
| mouseenter | `handleHover()` | 4650+ |

**Click Handler Flow:**
```javascript
// Simplified flow from recorder-engine.js
function handleClick(event) {
  // 1. Find the actual interactive element (not nested span/div)
  const element = findInteractiveElement(event.target);
  
  // 2. Generate selectors using SmartSelector
  const selectorInfo = smartSelector.getBestSelector(element);
  
  // 3. Extract element info (text, attributes, etc.)
  const elementInfo = extractElementInfo(element);
  
  // 4. Create action object
  const action = {
    type: 'click',
    selector: selectorInfo,
    selectorObj: selectorInfo,
    element: elementInfo,
    timestamp: Date.now(),
    description: `Click "${elementInfo.text}"`,
    // ... more fields
  };
  
  // 5. Send to parent (Electron main process)
  recordAction(action);
}
```

### 3.3 Selector Generation (SmartSelector)

**File:** `flowstral-extension/src/lib/recorder-engine.js` (lines 792-1238)
**Also:** `flowstral-extension/src/lib/smart-selector.js` (standalone copy)

**Selector Priority Table:**

| Priority | Selector Type | Confidence | Example |
|----------|--------------|------------|---------|
| 100 | data-testid | 100 | `[data-testid="submit-btn"]` |
| 95 | data-test, data-cy | 95 | `[data-test="login"]` |
| 90 | data-qa | 90 | `[data-qa="search"]` |
| 85 | aria-label | 85 | `[aria-label="Close"]` |
| 80 | aria-labelledby | 80 | `[aria-labelledby="title"]` |
| 75 | role + text | 75 | `button:has-text("Submit")` |
| 70 | placeholder | 70 | `[placeholder="Email"]` |
| 65 | name | 65 | `[name="username"]` |
| 60 | id (non-dynamic) | 60 | `#login-form` |
| 55 | text-content | 55 | `text="Click here"` |
| 50 | css-stable | 50 | `.btn-primary` |
| 30 | css-nth | 30 | `.item:nth-child(3)` |
| 20 | xpath | 20 | `//button[text()="OK"]` |

**Dynamic ID Detection:**
```javascript
// IDs matching these patterns are considered dynamic and NOT used
const dynamicPatterns = [
  /^[a-f0-9]{8,}/,           // UUID-like
  /^\d{6,}/,                 // Long numbers
  /^:r[a-z0-9]+:/,           // React IDs
  /^ember\d+/,               // Ember IDs
  /^ng-/,                    // Angular IDs
  /^vue-/,                   // Vue IDs
  /^aura_/,                  // Salesforce Aura
  /^lwc-/,                   // Salesforce LWC
];
```

**App-Specific Selector Strategies:**

The `AppSelectorConfig` object (lines 31-232) defines custom strategies for 30+ apps:
- Salesforce LWC/Aura
- ServiceNow
- Workday
- SAP UI5
- Dynamics 365
- Jira/Atlassian
- And many more

### 3.4 Action Object Structure

**Complete Action Object:**
```typescript
interface RecordedAction {
  // === IDENTIFIERS ===
  id: string;                    // Unique ID: `action_${timestamp}`
  type: string;                  // 'click', 'fill', 'select', etc.
  qword: string;                 // Action keyword: 'Click', 'Fill', etc.
  
  // === SELECTORS (CRITICAL) ===
  selector: string;              // Primary CSS selector
  selectorObj: {
    primary: string;             // Best CSS selector
    selector: string;            // Same as primary
    playwright: string;          // Playwright locator expression
    confidence: number;          // 0-100 confidence score
    strategies: Strategy[];      // All selector strategies
    fallbacks: string[];         // Backup selectors
    
    // === MANUAL OVERRIDE (HIGHEST PRIORITY) ===
    manualOverride?: string;     // User-specified selector (ALWAYS used first)
    
    // === ELEMENT ATTRIBUTES ===
    text: string;                // Visible text
    testId: string;              // data-testid
    id: string;                  // Element ID
    name: string;                // Form name
    ariaLabel: string;           // aria-label
    placeholder: string;         // Placeholder text
    title: string;               // Title attribute
    role: string;                // ARIA role
    href: string;                // Link href
    className: string;           // CSS classes
    tag: string;                 // Tag name (button, a, input, etc.)
    
    // === APP DETECTION ===
    app: string;                 // Detected app ID
    appName: string;             // Human-readable app name
  };
  
  // === ELEMENT INFO ===
  element: {
    tagName: string;
    text: string;
    id: string;
    name: string;
    ariaLabel: string;
    // ... all attributes
  };
  
  // === RECIPE (V2 FORMAT) ===
  recipe: {
    what: { tag, type, role, text };
    where: { nearText, within, sectionHeading };
    which: { testId, id, name, ariaLabel, placeholder, title, cssSelector, href, elementIndex };
  };
  
  // === ACTION DATA ===
  args: string[];                // Action arguments [text, elementIndex]
  value: string;                 // Input value (for fill actions)
  timestamp: number;             // When recorded
  description: string;           // Human-readable: 'Click "Submit"'
  label: string;                 // Extracted label for display
  
  // === FLAGS ===
  skip?: boolean;                // Skip this step during playback
  manualSelector?: string;       // Backup of manual override
  manualText?: string;           // Backup of manual text
}
```

### 3.5 Action Coalescing

**File:** `flowstral-desktop/src/main/lib/action-coalescer.js`

Combines related actions into single logical actions:

| Input Actions | Output Action |
|--------------|---------------|
| Click dropdown trigger + Click option | Select from dropdown |
| Multiple keystrokes | Single fill action |
| Click + Wait + Click (same element) | Single click |

**IMPORTANT:** Navigation menus are explicitly excluded from coalescing (lines 148-186).

### 3.6 Key Recording Files

| File | Purpose | Critical Functions |
|------|---------|-------------------|
| `flowstral-extension/src/lib/recorder-engine.js` | **SINGLE SOURCE OF TRUTH** - SmartSelector, event handlers | `getBestSelector()`, `handleClick()`, `extractElementInfo()` |
| `flowstral-extension/src/lib/smart-selector.js` | Standalone selector generation | `generate()`, `_addDataAttributeSelectors()` |
| `flowstral-desktop/src/main/playwright-recorder.js` | Desktop recorder orchestration | `startRecording()`, `stopRecording()`, `_buildSelectorObject()` |
| `flowstral-desktop/src/main/lib/action-coalescer.js` | Combines click sequences | `coalesce()`, `_isDropdownSequence()` |
| `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` | V2 recipe format | `buildRecipe()`, `legacyToRecipe()` |
| `flowstral-desktop/src/main/embedded-browser.js` | Browser management | `_buildSelectorObject()` (lines 480-575) |

---

## 4. Playback System

### 4.1 Playback Entry Points

| Entry Point | File | Description |
|------------|------|-------------|
| UI "Run Test" button | `src/pages/PlaywrightRecorderPage.tsx` | User clicks to run |
| IPC handler | `flowstral-desktop/src/main/index.js` | `execute-test` handler |
| Executor class | `flowstral-desktop/src/main/test-executor.js` | `executeTest()` method |
| Alt: PlaywrightRecorder | `flowstral-desktop/src/main/playwright-recorder.js` | `executeTest()` method |

**Flow:**
```
User clicks "Run Test"
    ↓
PlaywrightRecorderPage.tsx → handleRunTest()
    ↓
Build steps array with selectorObj, recipe, manualOverride
    ↓
window.electronAPI.testRunner.executeTest({ steps })
    ↓
IPC: 'execute-test' → index.js
    ↓
TestExecutor.executeTest(steps) OR PlaywrightRecorder.executeTest(steps)
    ↓
For each step:
    ↓
findElementWithRetry(action)
    ↓
Execute action (click, fill, etc.)
```

### 4.2 Element Finding Strategy (SmartFinder)

**File:** `flowstral-desktop/src/main/lib/smart-finder.js`

**10+ Phase Element Finding:**

| Phase | Strategy | Description |
|-------|----------|-------------|
| FAST | strategy-memory | Try remembered successful strategy |
| 0 | testId | `page.getByTestId(testId)` - most reliable |
| 0.5 | sf-testid-extracted | Extract data-testid from CSS selector |
| 1 | sf-component-scope | Salesforce component scoping |
| 2 | role+text | `page.getByRole(role, { name: text })` |
| 2 | role+text variations | Apostrophe flex, singular, regex |
| 3 | text-exact | `page.getByText(text, { exact: true })` |
| 3 | text variations | Apostrophe flex, partial |
| 4 | aria-label | `[aria-label="..."]` selector |
| 5 | name-attribute | `[name="..."]` for form elements |
| 6 | id | `#id` (if stable, not dynamic) |
| 7 | href | Link href matching |
| 8 | css-fallback | Full CSS selector from recording |
| 9 | text-relaxed | Relaxed text, keyword extraction |
| 10 | coordinates | Use stored coordinates (last resort) |

### 4.3 Manual Override System

**CRITICAL: Manual overrides MUST be checked FIRST in ALL element finding functions.**

**Files that MUST check manualOverride:**

| File | Function | Status |
|------|----------|--------|
| `playwright-recorder.js` | `_findElement()` | ✅ Line 6619 |
| `test-executor.js` | `findElementWithRetry()` | ✅ Fixed |
| `test-executor.js` | `_findElement()` | ✅ Fixed |
| `smart-finder.js` | `find()` | ⚠️ Check if needed |

**Manual Override Check Pattern:**
```javascript
async _findElement(action) {
  // ============================================================
  // MANUAL OVERRIDE - User-specified selector takes HIGHEST priority
  // ============================================================
  const manualOverride = action.manualOverride || action.selectorObj?.manualOverride;
  if (manualOverride) {
    console.log(`🎯 MANUAL OVERRIDE: Using "${manualOverride}"`);
    try {
      const locator = this.page.locator(manualOverride);
      const count = await locator.count();
      if (count > 0) {
        console.log(`✅ Manual override found ${count} element(s)`);
        return { locator: locator.first(), strategy: { type: 'manualOverride' } };
      }
    } catch (e) {
      console.log(`⚠️ Manual override failed: ${e.message}`);
    }
  }
  
  // ... continue with automatic strategies
}
```

### 4.4 Fallback Layers

**4-Layer Fallback System:**

```
Layer 1: SmartFinder V2 (recipe-based)
    ↓ (if fails)
Layer 2: Legacy _findElement (50+ strategies)
    ↓ (if fails)
Layer 3: iFrame search (elements inside iframes)
    ↓ (if fails)
Layer 4: AI Vision Fallback (screenshot + GPT-4o)
```

**Retry Logic:**
- 3 retries with exponential backoff (500ms, 1000ms, 1500ms)
- Between retries, waits for potential page updates

### 4.5 Lock Locators (User-Controlled Optimization)

**Problem:** Tests take a long time because SmartFinder tries multiple strategies.

**Solution:** After a successful test run, users can "Lock" the ACTUAL selectors that worked.

**How It Works (SIMPLE):**

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Test runs → SmartFinder finds elements                       │
│  2. For each step, backend returns workingSelector in results   │
│  3. Test passes → User clicks "🔒 Lock Locators"                │
│  4. Frontend saves the ACTUAL working selector to each step     │
│  5. On next run, locked selector tried FIRST (150ms timeout)    │
│  6. If locked fails → falls back to normal SmartFinder          │
└─────────────────────────────────────────────────────────────────┘
```

**Why This Is Simple:**
- We save the EXACT selector that actually worked (not guessing)
- Backend tracks `_lastWorkingSelector` and `_lastStrategyType`
- stepResults include `{ workingSelector, strategyType }` for each step
- Frontend just uses what the backend reports

**Files Involved:**
- `flowstral-desktop/src/main/playwright-recorder.js`:
  - `_lastWorkingSelector`, `_lastStrategyType` class properties
  - `stepResults[i].workingSelector` in runTest results
- `flowstral-desktop/src/main/lib/smart-finder.js`:
  - `lastSuccessfulStrategy`, `lastSuccessfulSelector` exposed properties
- `src/pages/PlaywrightRecorderPage.tsx`:
  - `handleLockLocators()` uses `stepResult.workingSelector`

**Speed Impact:**
```
Without locked selectors: 30-45 seconds (full search each step)
With locked selectors:    5-10 seconds (150ms check per step)
```

### 4.6 Reliability Layer

**File:** `flowstral-desktop/src/main/lib/reliability-layer.js`

**Pre-Action Verification:**
- Element is visible
- Element is enabled
- Element is not obscured (no overlay blocking)
- Element is stable (not moving)

---

## 4.6 COMPLETE CLICK FLOW AUDIT (Updated Feb 2026)

### Click "Categories" Example - Full Trace

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CLICK "CATEGORIES" - COMPLETE EXECUTION FLOW                                    │
│ Input: { type: 'click', text: 'Categories', recipe: { role: 'link', tag: 'a' } }│
└─────────────────────────────────────────────────────────────────────────────────┘

User clicks "Run Test"
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: TestExecutor.executeStep()                                              │
│ File: test-executor.js line 766                                                 │
│ - Normalize action type: "click" or "ClickText"                                 │
│ - Check if click action for fallback handling                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: ActionHandlers.executeAction()                                          │
│ File: action-handlers.js line 2630                                              │
│ - Routes to handleClick() for click/clicktext/clickelement                      │
│ - If fails, NOW falls through to legacy (REGRESSION FIX)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: handleClick() - 4 Layer System                                          │
│ File: action-handlers.js line 339                                               │
│                                                                                  │
│ Layer 1: Check manual selectors (xpath=, coords:, ocr:, text=)                  │
│ Layer 2: ctx.findElementWithRetry(action) → SmartFinder                         │
│ Layer 3: searchIframesForClick() if not found                                   │
│ Layer 4: AI Vision Fallback (screenshot + GPT-4o)                               │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: findElementWithRetry()                                                  │
│ File: test-executor.js line 251                                                 │
│                                                                                  │
│ Priority Order:                                                                  │
│ 1. manualOverride (selectorObj.manualOverride) ← HIGHEST PRIORITY              │
│ 2. SmartFinder V2 (findElementV2)                                               │
│ 3. Legacy _findElement (50+ strategies)                                         │
│ 4. Retry up to 3x with exponential backoff                                      │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: SmartFinder.find()                                                      │
│ File: smart-finder.js                                                           │
│                                                                                  │
│ Phases (in order):                                                               │
│ • FAST PATH: StrategyMemory lookup (if remembered strategy exists)              │
│ • Phase 0: testId → [data-testid="@web/Header/MainMenuLink"]                    │
│ • Phase 1: Salesforce scoping (if SF detected)                                  │
│ • Phase 2: role+text → getByRole('link', { name: 'Categories' })                │
│ • Phase 3: text-exact → getByText('Categories', { exact: true })                │
│ • Phase 4-9: aria, name, id, href, css fallbacks                                │
│ • Phase 10: coordinates (last resort)                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: ReliabilityLayer.verifyElementActionable()                              │
│ File: reliability-layer.js line 84                                              │
│                                                                                  │
│ Pre-Click Checks:                                                                │
│ ✓ exists: locator.count() > 0                                                   │
│ ✓ visible: locator.isVisible()                                                  │
│ ✓ enabled: not disabled                                                         │
│ ✓ notObscured: elementFromPoint matches                                         │
│ ✓ stable: boundingBox stable over 100ms                                         │
│ ✓ inViewport: within viewport bounds (NULL SAFE now)                            │
└─────────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ STEP 7: locator.click()                                                         │
│ - Execute Playwright click action                                               │
│ - Wait for navigation/response if applicable                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Strategy Confidence Percentages

| Strategy | Confidence | Description | Example |
|----------|------------|-------------|---------|
| **manualOverride** | **100%** | User-specified selector | `[aria-label="Categories"]` |
| **testId** | **95%** | data-testid attribute | `[data-testid="nav-categories"]` |
| **role+text (fast path)** | **98%** | From StrategyMemory | `getByRole('link', { name: 'Categories' })` |
| **role+text** | **90%** | Semantic matching | `getByRole('link', { name: 'Categories' })` |
| **aria-label** | **85%** | Accessibility selector | `[aria-label="Categories"]` |
| **text-exact** | **80%** | Exact text match | `getByText('Categories', { exact: true })` |
| **text-partial** | **70%** | Partial text match | `getByText('Categories', { exact: false })` |
| **name** | **75%** | Form name attribute | `[name="category-link"]` |
| **id** | **65%** | Element ID (if stable) | `#categories-link` |
| **css-selector** | **60%** | CSS selector | `.nav-link.categories` |
| **href** | **55%** | Link href matching | `a[href*="/categories"]` |
| **coordinates** | **30%** | Stored x,y position | `page.mouse.click(164, 68)` |
| **ai-vision** | **50%** | AI screenshot analysis | GPT-4o coordinate detection |

### Legacy ClickText Fallback Strategies (11 strategies)

When unified handler fails, legacy ClickText case is tried:

```javascript
const textStrategies = [
  { name: 'getByText(exact:false)', confidence: 70 },
  { name: 'getByRole(button)',      confidence: 80 },
  { name: 'getByRole(link)',        confidence: 85 },  // ← Would find Categories
  { name: 'getByRole(checkbox)',    confidence: 80 },
  { name: 'getByRole(radio)',       confidence: 80 },
  { name: 'getByLabel',             confidence: 65 },
  { name: 'label:has-text',         confidence: 60 },
  { name: 'getByRole(menuitem)',    confidence: 75 },
  { name: 'aria-label/title',       confidence: 75 },
  { name: 'slds-checkbox',          confidence: 70 },  // Salesforce-specific
  { name: 'text-sibling-input',     confidence: 55 },
];
```

### Known Regressions Fixed (Feb 2026)

| Issue | Root Cause | Fix | Commit |
|-------|-----------|-----|--------|
| **Unified handler blocking legacy fallbacks** | `ActionHandlers.executeAction` threw error instead of falling through | Allow click failures to try legacy 11 strategies | `37ceac49` |
| **Viewport null crash** | `page.viewportSize()` returns null during transitions | Added null safety check | `34e57437` |
| **tagName vs tag mismatch** | Recording stores `tagName`, playback looked for `tag` | Check both properties | `1a1eee84` |

### Unit Tests

**File:** `flowstral-desktop/src/main/lib/__tests__/click-flow.test.js`

Tests cover:
- Strategy priority order
- SmartFinder phases
- ReliabilityLayer null safety
- Legacy fallback activation
- Confidence scoring

**Overlay Dismissal:**
- Automatically closes cookie banners
- Handles modal dialogs
- Dismisses notification popups

**Post-Action Verification:**
- Confirms click was on intended target
- Validates form input values

### 4.7 Key Playback Files

| File | Purpose | Critical Functions |
|------|---------|-------------------|
| `flowstral-desktop/src/main/test-executor.js` | Main test execution | `executeTest()`, `findElementWithRetry()`, `_findElement()` |
| `flowstral-desktop/src/main/playwright-recorder.js` | Alt execution path | `executeTest()`, `_findElement()` |
| `flowstral-desktop/src/main/lib/smart-finder.js` | 10-phase element finding | `find()`, `_tryPhase()` |
| `flowstral-desktop/src/main/lib/reliability-layer.js` | Pre/post verification | `verifyElement()`, `dismissOverlays()` |
| `flowstral-desktop/src/main/lib/action-handlers.js` | Unified action execution | `handleClick()`, `handleFill()` |
| `flowstral-desktop/src/main/lib/ai-fallback.js` | AI vision fallback | `findElementWithAI()` |

---

## 5. Step Editor & Repair System

### 5.1 SimpleStepEditor Component

**File:** `src/components/SimpleStepEditor.tsx`

**Purpose:** Allow users to fix failed steps without DOM knowledge.

**Features:**
- Pick Element button (click in browser)
- Manual text entry
- Selector type selection (text, CSS, XPath, ARIA)
- Similar element suggestions
- Overlay suggestions from browser

### 5.2 Element Picker

**Flow:**
```
User clicks "Pick Element"
    ↓
SimpleStepEditor → handleStartPicker()
    ↓
flowstral.elementPicker.start()
    ↓
Browser highlights elements on hover
    ↓
User clicks desired element
    ↓
Returns { text, selector } to SimpleStepEditor
    ↓
Calls onElementPicked({ text, selector })
```

### 5.3 Manual Override Flow

**CRITICAL: This flow must save to selectorObj.manualOverride**

**File:** `src/pages/PlaywrightRecorderPage.tsx`

```javascript
// In PlaywrightRecorderPage.tsx - onElementPicked handler
onElementPicked={(element) => {
  setActions(prev => prev.map((action, idx) => {
    if (idx !== editingActionIndex) return action;
    return {
      ...action,
      // CRITICAL: Update selectorObj.manualOverride for playback engine
      selectorObj: {
        ...action.selectorObj,
        manualOverride: element.selector,  // ← THIS IS CRITICAL
        text: element.text,
        selector: element.selector,
      },
      args: element.text ? [element.text] : action.args,
    };
  }));
}}
```

**DO NOT just save to action.manualSelector - playback ignores it!**

### 5.4 Key Editor Files

| File | Purpose | Critical Functions |
|------|---------|-------------------|
| `src/components/SimpleStepEditor.tsx` | Step repair UI | `handleSaveManualFix()`, `handleStartPicker()` |
| `src/components/ElementRepairWizard.tsx` | Advanced repair UI | `onSave()` |
| `src/pages/PlaywrightRecorderPage.tsx` | Main page | `onElementPicked()`, `openEditSelectorModal()` |

---

## 6. False Positive & Screenshot System

### 6.1 Current State

| Feature | Status |
|---------|--------|
| Confidence display (badges) | ✅ Implemented |
| Security finding false positive | ✅ Implemented |
| Reliability layer auto-prevention | ✅ Implemented |
| **User flag step as false positive** | ❌ NOT IMPLEMENTED |
| **Screenshot on false positive** | ❌ NOT IMPLEMENTED |
| **Rerun stops at false positive** | ❌ NOT IMPLEMENTED |
| **Easy element picker for non-technical users** | ⚠️ Partial |

### 6.2 Desired Workflow

```
1. User runs test
    ↓
2. Step fails (element not found)
    ↓
3. User marks step as "False Positive" (NOT a real failure)
    ↓
4. System captures screenshot at failure point
    ↓
5. On next run:
   - Test stops at the false positive step
   - Screenshot is shown for context
   - Element picker is automatically activated
   - User clicks correct element in browser
   - Fix is saved to manualOverride
    ↓
6. Test continues from that step
```

### 6.3 Implementation Requirements

**Database Changes:**
```sql
-- Add to test_run_steps table
ALTER TABLE test_run_steps ADD COLUMN is_false_positive BOOLEAN DEFAULT false;
ALTER TABLE test_run_steps ADD COLUMN false_positive_screenshot TEXT;
ALTER TABLE test_run_steps ADD COLUMN false_positive_reason TEXT;
ALTER TABLE test_run_steps ADD COLUMN false_positive_marked_by UUID REFERENCES users(id);
ALTER TABLE test_run_steps ADD COLUMN false_positive_marked_at TIMESTAMPTZ;
```

**Backend API:**
```python
# POST /runs/{run_id}/steps/{step_id}/flag-false-positive
@router.post("/runs/{run_id}/steps/{step_id}/flag-false-positive")
async def flag_false_positive(
    run_id: str,
    step_id: str,
    screenshot: Optional[str] = None,
    reason: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    # Update step with false positive flag
    # Store screenshot
    # Return updated step
```

**Frontend Components:**
```typescript
// FalsePositiveButton component
// - Shows on failed steps
// - Captures screenshot
// - Calls API to flag

// FalsePositiveRepairModal component
// - Shows on rerun at false positive step
// - Displays screenshot
// - Activates element picker
// - Saves fix to manualOverride
```

**Playback Changes:**
```javascript
// In test-executor.js - executeStep()
if (step.is_false_positive) {
  // Pause execution
  // Emit 'false-positive-step' event with screenshot
  // Wait for user to pick new element
  // Use new selector for this run
  // Continue
}
```

---

## 7. Data Flow Diagrams

### 7.1 Recording Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  recorder-  │────▶│ Playwright  │
│   Events    │     │  engine.js  │     │  Recorder   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ SmartSelector│     │   Action    │
                    │  generates  │     │  Coalescer  │
                    │  selectors  │     │  combines   │
                    └─────────────┘     └─────────────┘
                           │                    │
                           └─────────┬──────────┘
                                     ▼
                              ┌─────────────┐
                              │   actions   │
                              │    array    │
                              └─────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  React UI   │
                              │  (state)    │
                              └─────────────┘
```

### 7.2 Playback Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   actions   │────▶│ Normalize   │────▶│Test Executor│
│    array    │     │   Steps     │     │ or Recorder │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┤
                    ▼                          ▼
             ┌─────────────┐           ┌─────────────┐
             │ Manual      │           │ SmartFinder │
             │ Override?   │           │  V2        │
             └─────────────┘           └─────────────┘
                    │                          │
                    │ (if yes, use it)         │ (if fails)
                    │                          ▼
                    │                  ┌─────────────┐
                    │                  │  Legacy     │
                    │                  │ _findElement│
                    │                  └─────────────┘
                    │                          │
                    │                          │ (if fails)
                    │                          ▼
                    │                  ┌─────────────┐
                    │                  │  iFrame     │
                    │                  │  Search     │
                    │                  └─────────────┘
                    │                          │
                    │                          │ (if fails)
                    │                          ▼
                    │                  ┌─────────────┐
                    │                  │  AI Vision  │
                    │                  │  Fallback   │
                    │                  └─────────────┘
                    │                          │
                    └──────────┬───────────────┘
                               ▼
                        ┌─────────────┐
                        │  Execute    │
                        │  Action     │
                        └─────────────┘
```

---

## 8. Critical Code Paths

### 8.1 Recording: Click Event to Action

```
recorder-engine.js: handleClick(event)
    ↓
recorder-engine.js: findInteractiveElement(event.target)
    ↓
recorder-engine.js: smartSelector.getBestSelector(element)
    ↓
recorder-engine.js: extractElementInfo(element)
    ↓
recorder-engine.js: recordAction(action)
    ↓
playwright-recorder.js: handleRecordedAction(action)
    ↓
(IPC) → PlaywrightRecorderPage.tsx: setActions([...actions, action])
```

### 8.2 Playback: Action to Click

```
PlaywrightRecorderPage.tsx: handleRunTest()
    ↓
(IPC: execute-test) → test-executor.js: executeTest(steps)
    ↓
test-executor.js: executeStep(step)
    ↓
test-executor.js: findElementWithRetry(action)
    ↓
  [CHECK MANUAL OVERRIDE FIRST]
    ↓
  smart-finder.js: find(recipe) OR test-executor.js: _findElement(action)
    ↓
test-executor.js: element.click()
```

### 8.3 Repair: User Fix to Saved Override

```
User clicks "Edit" on step
    ↓
PlaywrightRecorderPage.tsx: openEditSelectorModal(index)
    ↓
SimpleStepEditor.tsx: opens
    ↓
User enters fix (text/selector) → handleSaveManualFix()
    ↓
SimpleStepEditor.tsx: onElementPicked({ text, selector })
    ↓
PlaywrightRecorderPage.tsx: setActions(prev => prev.map(...))
    ↓
MUST SET: action.selectorObj.manualOverride = newSelector
```

---

## 9. Regression Prevention Checklist

### Before Making Changes

- [ ] Read this document completely
- [ ] Identify which files will be affected
- [ ] Check if changes affect manual override flow
- [ ] Check if changes affect selector generation
- [ ] Check if changes affect element finding

### After Making Changes

- [ ] Verify manual override still works:
  1. Record a test
  2. Edit a step with custom selector
  3. Run test - step should use manual override
- [ ] Verify selector generation still works:
  1. Record click on element with data-testid
  2. Check selectorObj has correct priority
- [ ] Verify fallback layers still work:
  1. Record test
  2. Modify page to break primary selector
  3. Run test - should use fallback
- [ ] Update this document with any changes

### Critical Invariants

**NEVER BREAK THESE:**

1. **Manual override is ALWAYS checked FIRST** in all element finding functions
2. **selectorObj.manualOverride** is the field used for manual overrides (not action.manualSelector)
3. **Selector confidence order** is preserved (testId > aria > text > css)
4. **Fallback layers** are tried in order (SmartFinder → Legacy → iFrame → AI)

---

## 10. Common Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Manual override ignored | Saved to wrong field | Save to `selectorObj.manualOverride` |
| Element not found | Selector too specific | Use text-based or testId selector |
| Wrong element clicked | Multiple matches | Add disambiguation (text, index) |
| Click does nothing | Element not interactable | Check visibility, enabled state |
| iFrame element not found | Wrong scope | Check `frameContext` field |

---

## 11. Testing Requirements

### Unit Tests Needed

```typescript
// test-executor.test.js
describe('findElementWithRetry', () => {
  it('should check manualOverride FIRST', async () => {
    const action = {
      selectorObj: {
        manualOverride: '[data-test="custom"]',
        selector: '.broken-selector'
      }
    };
    const result = await executor.findElementWithRetry(action);
    expect(result.strategy.type).toBe('manualOverride');
  });
  
  it('should fallback when manualOverride fails', async () => {
    const action = {
      selectorObj: {
        manualOverride: '.nonexistent',
        testId: 'real-element'
      }
    };
    const result = await executor.findElementWithRetry(action);
    expect(result.strategy.type).not.toBe('manualOverride');
  });
});
```

### E2E Tests Needed

1. **Record and playback simple flow**
2. **Edit step with manual selector, verify it's used**
3. **Test fallback when primary selector breaks**
4. **Test false positive flag flow (when implemented)**

---

---

## 12. Industry Comparison & Best Practices

### 12.1 Competitive Analysis (2026)

| Feature | QAAI (Current) | Playwright | Cypress | Katalon | Ranorex |
|---------|---------------|------------|---------|---------|---------|
| **Recording** | ✅ SmartSelector | ✅ Codegen | ✅ Studio | ✅ Recorder | ✅ Recorder |
| **Self-Healing** | ⚠️ Strategy Memory | ❌ Manual | ❌ Manual | ✅ AI + Classic | ✅ AI-based |
| **Multi-Browser** | ✅ Chromium/FF/WK | ✅ All | ⚠️ Chrome/FF | ✅ All | ✅ All |
| **AI Vision Fallback** | ✅ GPT-4o | ❌ | ❌ | ✅ LLM-based | ⚠️ Limited |
| **Visual Testing** | ❌ | ✅ pixelmatch | ⚠️ Plugin | ✅ Built-in | ✅ Built-in |
| **Network Mocking** | ⚠️ Capture only | ✅ Full | ✅ Full | ⚠️ Basic | ⚠️ Basic |
| **Parallel Execution** | ❌ | ✅ Native | ⚠️ Limited | ✅ | ✅ |
| **App-Specific Logic** | ✅ 30+ Apps | ❌ | ❌ | ⚠️ SF only | ⚠️ SAP only |
| **Step Repair UI** | ✅ SimpleStepEditor | ❌ | ❌ | ✅ | ✅ |
| **Test Data Gen** | ❌ | ❌ | ❌ | ⚠️ Basic | ✅ |
| **Mobile Testing** | ⚠️ Maestro | ⚠️ Emulation | ❌ | ✅ Native | ✅ Native |

### 12.2 QAAI Current Strengths

1. **Best-in-Class Selector Generation (SmartSelector)**
   - 12+ priority levels with confidence scoring
   - 30+ app-specific configurations (Salesforce, ServiceNow, Workday, etc.)
   - Dynamic ID detection and rejection
   - Automatic test-id preference

2. **Robust Element Finding (SmartFinder)**
   - 10+ phase strategy with learning (Strategy Memory)
   - Role equivalences for flexible matching
   - Contextual position tracking
   - Memory persistence across sessions

3. **Comprehensive Reliability Layer**
   - Pre-action verification (visible, enabled, not obscured, stable)
   - Auto overlay dismissal (cookie banners, modals)
   - Post-action verification (state change detection)
   - Smart disambiguation for multiple matches

4. **AI-Powered Fallback**
   - GPT-4o vision for coordinate-based element finding
   - Budget-limited calls per test run
   - Works when all deterministic strategies fail

5. **User-Friendly Repair System**
   - SimpleStepEditor with visual element picker
   - Multiple selector type support (Text, CSS, XPath, ARIA)
   - Similar element suggestions
   - False positive flagging with screenshot capture

### 12.3 Current Gaps vs Industry Leaders

| Gap | Impact | Priority |
|-----|--------|----------|
| No true self-healing (auto-update selectors) | Medium - Requires manual fixes | HIGH |
| No visual regression testing | High - Can't detect visual bugs | HIGH |
| No network request mocking | Medium - Can't test edge cases | MEDIUM |
| No parallel test execution | High - Slow test suites | HIGH |
| No slow-mo/debug playback | Medium - Hard to debug | MEDIUM |
| No test data generation | Low - Manual data setup | LOW |
| Limited mobile testing | Medium - Partial Maestro | MEDIUM |

---

## 13. Proposed Enhancements (2026)

### 13.1 Self-Healing 2.0 (Katalon-style)

**Current:** Strategy Memory remembers successful strategies.
**Enhancement:** Automatically UPDATE the saved test with better selectors.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-HEALING 2.0 FLOW                        │
│                                                                 │
│  1. Playback starts with original selector                      │
│                     ↓                                          │
│  2. Original selector FAILS                                     │
│                     ↓                                          │
│  3. SmartFinder tries alternative strategies (10+ phases)       │
│                     ↓                                          │
│  4. Alternative strategy SUCCEEDS                               │
│                     ↓                                          │
│  5. AUTOMATIC HEALING:                                          │
│     - Update action.selectorObj with new selector               │
│     - Add originalSelector to fallbacks array                   │
│     - Update Strategy Memory                                    │
│     - Mark step as "healed"                                     │
│                     ↓                                          │
│  6. Show user notification: "Step auto-healed"                  │
│                     ↓                                          │
│  7. Option to "Accept Healing" or "Revert"                      │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
// In test-executor.js - executeStep()
async executeStep(step, index) {
  const result = await this.findElementWithRetry(step);
  
  if (result.healedSelector && result.healedSelector !== step.selectorObj?.primary) {
    // SELF-HEALING: Auto-update the step
    const healedStep = {
      ...step,
      selectorObj: {
        ...step.selectorObj,
        primary: result.healedSelector,
        selector: result.healedSelector,
        healedAt: Date.now(),
        healedFrom: step.selectorObj?.primary,
        fallbacks: [
          step.selectorObj?.primary,
          ...(step.selectorObj?.fallbacks || [])
        ]
      },
      _healed: true
    };
    
    // Emit event for UI to update
    this.emit('step-healed', { index, originalStep: step, healedStep });
    
    return healedStep;
  }
}
```

### 13.2 Visual Regression Testing

**Purpose:** Detect unintended visual changes between test runs.

```
┌─────────────────────────────────────────────────────────────────┐
│                  VISUAL TESTING WORKFLOW                        │
│                                                                 │
│  DURING RECORDING:                                              │
│  ├─ Capture baseline screenshot after each action               │
│  ├─ Store with action ID as reference                           │
│  └─ Annotate regions to ignore (dynamic content)                │
│                                                                 │
│  DURING PLAYBACK:                                               │
│  ├─ After each action, capture comparison screenshot            │
│  ├─ Compare using pixelmatch or SSIM algorithm                  │
│  ├─ If diff > threshold (default 5%):                           │
│  │   ├─ Mark step as "Visual Change Detected"                   │
│  │   ├─ Generate diff image highlighting changes                │
│  │   └─ User decides: Approve | Reject | Ignore Region          │
│  └─ Store comparison history for trends                         │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files to Create:**
- `flowstral-desktop/src/main/lib/visual-testing.js`
- `src/components/VisualDiffViewer.tsx`

**API:**
```javascript
class VisualTester {
  async captureBaseline(page, stepId, options = {}) {
    // Capture full page or element screenshot
    // Store as baseline with step ID
  }
  
  async compare(page, stepId, options = {}) {
    // Capture current screenshot
    // Load baseline
    // Compare using pixelmatch
    // Return { match: true/false, diffPercent, diffImage }
  }
  
  async approveAsNewBaseline(stepId) {
    // Replace baseline with current
  }
  
  async addIgnoreRegion(stepId, region) {
    // Mark region to exclude from comparison
  }
}
```

### 13.3 Network Mocking (Stubbing)

**Current:** Network capture only.
**Enhancement:** Full request interception and mocking.

```javascript
// API for network mocking
class NetworkMocker {
  // Mock a specific endpoint
  async mockRoute(pattern, response) {
    await this.page.route(pattern, async (route) => {
      await route.fulfill({
        status: response.status || 200,
        contentType: response.contentType || 'application/json',
        body: JSON.stringify(response.body)
      });
    });
  }
  
  // Record real responses for later mocking (HAR-based)
  async recordMocks(patterns) {
    // Intercept matching requests
    // Save responses for replay
  }
  
  // Replay recorded mocks
  async replayMocks(harFile) {
    // Load HAR file
    // Set up routes for each recorded request
  }
  
  // Simulate network conditions
  async setNetworkConditions(profile) {
    // offline, slow3G, fast3G, custom
  }
  
  // Inject errors
  async mockError(pattern, errorType) {
    // timeout, 500, network-error
  }
}
```

**Use Cases:**
1. Test error handling by mocking 500 responses
2. Test offline mode by blocking all network
3. Speed up tests by mocking slow APIs
4. Test with consistent data by mocking responses

### 13.4 Parallel Test Execution

**Current:** Sequential execution only.
**Enhancement:** Run multiple tests in parallel.

```
┌─────────────────────────────────────────────────────────────────┐
│                  PARALLEL EXECUTION MODES                       │
│                                                                 │
│  MODE 1: SAME MACHINE (Workers)                                 │
│  ├─ Spawn N browser contexts (default: CPU cores)               │
│  ├─ Each context runs independent tests                         │
│  ├─ Shared storage state (optional: isolated)                   │
│  └─ Merge results at end                                        │
│                                                                 │
│  MODE 2: DISTRIBUTED (Sharding)                                 │
│  ├─ Split test suite: --shard=1/4, --shard=2/4, etc.           │
│  ├─ Run shards on different machines                            │
│  ├─ Collect results from all shards                             │
│  └─ Generate unified report                                     │
│                                                                 │
│  CONFIGURATION:                                                 │
│  {                                                              │
│    "parallel": {                                                │
│      "workers": 4,           // Number of parallel workers      │
│      "fullyParallel": true,  // Run ALL tests in parallel       │
│      "retries": 2,           // Retry failed tests              │
│      "reporter": ["html", "json"]                               │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
class ParallelExecutor {
  constructor(options = {}) {
    this.workers = options.workers || require('os').cpus().length;
    this.results = [];
  }
  
  async runParallel(tests, options = {}) {
    // Split tests into chunks
    const chunks = this.chunkTests(tests, this.workers);
    
    // Create worker contexts
    const workers = await Promise.all(
      chunks.map((chunk, i) => this.createWorker(i, chunk))
    );
    
    // Wait for all workers to complete
    const results = await Promise.all(
      workers.map(w => w.run())
    );
    
    // Merge and return results
    return this.mergeResults(results);
  }
}
```

### 13.5 Debug Playback Mode (Slow-Mo)

**Purpose:** Help users understand and debug test execution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEBUG PLAYBACK FEATURES                      │
│                                                                 │
│  SLOW MOTION:                                                   │
│  ├─ 0.25x, 0.5x, 1x, 2x speed options                          │
│  ├─ Configurable delay between steps (0-5s)                     │
│  └─ Visual highlight on target element before action            │
│                                                                 │
│  STEP-BY-STEP:                                                  │
│  ├─ Pause before/after each step                                │
│  ├─ "Next Step" button to advance                               │
│  ├─ Inspect page state at any point                             │
│  └─ Modify step data and retry                                  │
│                                                                 │
│  EXECUTION TIMELINE:                                            │
│  ├─ Waterfall view of all steps                                 │
│  ├─ Duration bar for each step                                  │
│  ├─ Screenshots at each step                                    │
│  ├─ Network requests aligned to steps                           │
│  └─ Click any step to see details/screenshot                    │
│                                                                 │
│  ELEMENT HIGHLIGHTING:                                          │
│  ├─ Draw box around target element                              │
│  ├─ Show element info tooltip (selector, text)                  │
│  ├─ Flash animation on click/fill                               │
│  └─ Arrow pointing to target for off-screen elements            │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation in TestExecutor:**
```javascript
async executeStep(step, index, options = {}) {
  const { slowMo = 0, highlight = true, beforeStepDelay = 0 } = options;
  
  // Pre-step delay (for slow-mo)
  if (beforeStepDelay > 0) {
    await this.page.waitForTimeout(beforeStepDelay);
  }
  
  // Find element
  const result = await this.findElementWithRetry(step);
  
  // Highlight element before action
  if (highlight && result.locator) {
    await this.highlightElement(result.locator, {
      color: 'blue',
      duration: slowMo > 0 ? 1000 : 300,
      label: step.description
    });
  }
  
  // Execute with slow-mo
  await result.locator.click({ delay: slowMo });
  
  // Post-step delay
  if (slowMo > 0) {
    await this.page.waitForTimeout(slowMo);
  }
}

async highlightElement(locator, options = {}) {
  await locator.evaluate((el, opts) => {
    // Create highlight overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      border: 3px solid ${opts.color || 'blue'};
      border-radius: 4px;
      background: ${opts.color || 'blue'}22;
      pointer-events: none;
      z-index: 99999;
      transition: all 0.2s;
    `;
    
    const rect = el.getBoundingClientRect();
    overlay.style.top = `${rect.top + window.scrollY - 3}px`;
    overlay.style.left = `${rect.left + window.scrollX - 3}px`;
    overlay.style.width = `${rect.width + 6}px`;
    overlay.style.height = `${rect.height + 6}px`;
    
    // Add label
    if (opts.label) {
      const label = document.createElement('div');
      label.textContent = opts.label;
      label.style.cssText = `
        position: absolute; top: -24px; left: 0;
        background: ${opts.color || 'blue'}; color: white;
        padding: 2px 8px; border-radius: 4px; font-size: 12px;
      `;
      overlay.appendChild(label);
    }
    
    document.body.appendChild(overlay);
    
    // Remove after duration
    setTimeout(() => overlay.remove(), opts.duration || 1000);
  }, options);
}
```

### 13.6 Smart Recording Hints

**Purpose:** Guide users during recording with real-time suggestions.

```
┌─────────────────────────────────────────────────────────────────┐
│                   SMART RECORDING HINTS                         │
│                                                                 │
│  WHILE RECORDING, SHOW:                                         │
│                                                                 │
│  1. SELECTOR QUALITY INDICATOR                                  │
│     ├─ Green: data-testid found (best)                         │
│     ├─ Yellow: using aria-label or text (good)                  │
│     ├─ Orange: using CSS class (fragile)                        │
│     └─ Red: using position/index (very fragile)                 │
│                                                                 │
│  2. SUGGESTIONS PANEL                                           │
│     ├─ "Add data-testid for more reliable tests"                │
│     ├─ "Multiple matches found - click is ambiguous"            │
│     ├─ "Dynamic ID detected - may fail on re-run"               │
│     └─ "Consider adding assertion after this step"              │
│                                                                 │
│  3. HOVER PREVIEW                                               │
│     ├─ Show selector that will be used                          │
│     ├─ Show confidence score (0-100)                            │
│     ├─ Show alternative selectors available                     │
│     └─ Highlight all matching elements (see ambiguity)          │
│                                                                 │
│  4. AUTO-ASSERTION SUGGESTIONS                                  │
│     After click: "Assert page title changed?"                   │
│     After fill: "Assert value is set?"                          │
│     After nav: "Assert URL contains X?"                         │
└─────────────────────────────────────────────────────────────────┘
```

### 13.7 Test Data Generation

**Purpose:** Auto-generate test data for forms.

```javascript
class TestDataGenerator {
  // Generate realistic fake data
  generate(fieldType, options = {}) {
    switch (fieldType) {
      case 'email': return `test_${Date.now()}@example.com`;
      case 'name': return this.faker.name();
      case 'phone': return this.faker.phone();
      case 'address': return this.faker.address();
      case 'date': return this.randomDate(options.min, options.max);
      case 'number': return this.randomNumber(options.min, options.max);
      case 'ssn': return this.faker.ssn();
      case 'creditCard': return this.faker.creditCard();
      // ... more types
    }
  }
  
  // Auto-detect field type from element
  detectFieldType(element) {
    const { name, placeholder, label, type, autocomplete } = element;
    // Use ML model or rules to detect type
  }
  
  // Fill form automatically with generated data
  async autoFillForm(page, formSelector) {
    const fields = await this.detectFormFields(page, formSelector);
    for (const field of fields) {
      const type = this.detectFieldType(field);
      const value = this.generate(type);
      await page.fill(field.selector, value);
    }
    return fields.map(f => ({ field: f.name, value: f.generatedValue }));
  }
}
```

### 13.8 Enhanced Mobile Testing

**Current:** Basic Maestro integration.
**Enhancement:** Full mobile recording and playback.

```
┌─────────────────────────────────────────────────────────────────┐
│                   MOBILE TESTING ROADMAP                        │
│                                                                 │
│  PHASE 1 (Current):                                             │
│  ├─ Maestro integration for iOS/Android                         │
│  └─ Device emulation in Playwright                              │
│                                                                 │
│  PHASE 2 (Proposed):                                            │
│  ├─ Native iOS recording via XCTest                             │
│  ├─ Native Android recording via Espresso                       │
│  ├─ Real device cloud integration (BrowserStack, Sauce)         │
│  └─ Touch gesture recording (swipe, pinch, long-press)          │
│                                                                 │
│  PHASE 3 (Future):                                              │
│  ├─ Visual testing on mobile                                    │
│  ├─ Performance testing on mobile                               │
│  └─ Cross-device test execution                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Implementation Priority Matrix

| Enhancement | Impact | Effort | Priority | Timeline |
|------------|--------|--------|----------|----------|
| Self-Healing 2.0 | HIGH | MEDIUM | P0 | 2 weeks |
| Debug Playback Mode | HIGH | LOW | P0 | 1 week |
| Visual Regression Testing | HIGH | HIGH | P1 | 3 weeks |
| Parallel Execution | HIGH | MEDIUM | P1 | 2 weeks |
| Smart Recording Hints | MEDIUM | LOW | P2 | 1 week |
| Network Mocking | MEDIUM | MEDIUM | P2 | 2 weeks |
| Test Data Generation | LOW | MEDIUM | P3 | 2 weeks |
| Enhanced Mobile | MEDIUM | HIGH | P3 | 4 weeks |

---

## 15. Quick Wins (Implement This Week)

### 15.1 Add Execution Speed Control

```typescript
// In PlaywrightRecorderPage.tsx
const [playbackSpeed, setPlaybackSpeed] = useState<'0.5x' | '1x' | '2x'>('1x');

// Pass to test executor
await electronAPI.testRunner.executeTest({
  steps: normalizedActions,
  settings: {
    slowMo: playbackSpeed === '0.5x' ? 500 : playbackSpeed === '2x' ? 0 : 200,
    highlight: true
  }
});
```

### 15.2 Add Step Duration Display

```typescript
// In execution result modal, show duration for each step
{stepResult?.duration && (
  <span className="text-xs text-muted-foreground ml-auto">
    {stepResult.duration}ms
  </span>
)}
```

### 15.3 Add "Copy Selector" Button

```typescript
// In step list, add copy button for selector
<Button
  variant="ghost"
  size="icon"
  onClick={() => {
    navigator.clipboard.writeText(action.selectorObj?.primary || '');
    toast.success('Selector copied!');
  }}
>
  <Copy className="h-3 w-3" />
</Button>
```

### 15.4 Add Confidence Badge to Steps

```typescript
// Show confidence indicator on each step
{action.selectorObj?.confidence && (
  <Badge className={cn(
    action.selectorObj.confidence >= 90 ? 'bg-green-500/20 text-green-400' :
    action.selectorObj.confidence >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-red-500/20 text-red-400'
  )}>
    {action.selectorObj.confidence}%
  </Badge>
)}
```

---

## 14. Cross-Device Testing: Record Anywhere, Play Everywhere

### 14.1 Current State Analysis

**What We Have:**
| Feature | Status | Details |
|---------|--------|---------|
| Mobile device emulation | ✅ 50+ devices | iPhone, Android, tablets in `mobile-devices.js` |
| Device selection in UI | ✅ Working | Desktop dropdown with device categories |
| Viewport configuration | ✅ Working | Sets viewport, userAgent, touch, scale factor |
| Network throttling | ✅ Working | 4G, 3G, Slow 3G, 2G presets |
| Semantic selectors | ✅ Primary | testId, role+text, aria-label (device-agnostic) |
| Coordinate fallback | ⚠️ Device-dependent | boundingBox stored, won't work cross-device |
| Device context in recipe | ❌ Missing | No "recorded on device X" metadata |
| Responsive element handling | ❌ Missing | No hamburger menu ↔ nav bar mapping |

### 14.2 Why Current System MOSTLY Works Cross-Device

**SmartFinder uses semantic selectors that are device-agnostic:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SELECTORS THAT WORK CROSS-DEVICE (confidence order)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. manualOverride     [aria-label="Categories"]     ✅ Works everywhere     │
│ 2. testId             [data-testid="nav-menu"]      ✅ Same on all devices  │
│ 3. role+text          getByRole('link', 'Home')     ✅ Semantic, works      │
│ 4. aria-label         [aria-label="Menu"]           ✅ Accessibility works  │
│ 5. text-exact         getByText('Submit')           ✅ Text same on mobile  │
│ 6. name               [name="email"]                ✅ Form fields work     │
├─────────────────────────────────────────────────────────────────────────────┤
│ SELECTORS THAT BREAK CROSS-DEVICE                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 7. coordinates        click(x:500, y:200)           ❌ BREAKS on resize     │
│ 8. css with position  .nav > li:nth-child(3)       ⚠️ May break responsive │
│ 9. boundingBox        {x:164, y:68, w:125}         ❌ BREAKS on resize     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Insight:** If recording uses high-confidence selectors (testId, role+text), playback should work on any device. Problems occur when:
1. Fallback to coordinates is needed
2. Site has completely different DOM on mobile (responsive breakpoints)
3. Mobile-only elements (hamburger menu) don't exist on desktop

### 14.3 Challenges: Responsive Web Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RESPONSIVE BREAKPOINT CHALLENGE                                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│         DESKTOP (1920px)             │         MOBILE (390px)               │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ <nav class="desktop-nav">            │ <button class="hamburger">           │
│   <a href="/home">Home</a>           │   ☰                                  │
│   <a href="/categories">Categories</a>│ </button>                            │
│   <a href="/cart">Cart</a>           │ <div class="mobile-menu" hidden>     │
│ </nav>                               │   <a href="/home">Home</a>           │
│                                      │   <a href="/categories">Categories</a>│
│                                      │   <a href="/cart">Cart</a>           │
│                                      │ </div>                               │
├──────────────────────────────────────┴──────────────────────────────────────┤
│ PROBLEM: getByRole('link', 'Categories') finds DIFFERENT elements!          │
│ - Desktop: .desktop-nav a (visible)                                         │
│ - Mobile: .mobile-menu a (hidden until hamburger clicked)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 14.4 Proposed Implementation: Device-Aware Playback

**Phase 1: Store Device Context in Recording (LOW RISK)**

```javascript
// In playwright-recorder.js - buildAction()
const action = {
  // ... existing fields ...
  
  // NEW: Device context for cross-device playback
  deviceContext: {
    recordedOn: this.mobileDevice?.name || 'desktop',
    viewport: this.page.viewportSize(),
    isMobile: this.isMobileMode,
    userAgent: await this.page.evaluate(() => navigator.userAgent),
  },
  
  // NEW: Element visibility at record time
  elementVisibility: {
    wasVisible: true,
    wasInViewport: true,
    viewportAtRecord: { width: 1920, height: 1080 },
  },
};
```

**Phase 2: Device-Aware SmartFinder (MEDIUM RISK)**

```javascript
// In smart-finder.js - find()
async find(recipe, options = {}) {
  const targetDevice = options.targetDevice || 'desktop';
  const sourceDevice = recipe.deviceContext?.recordedOn || 'desktop';
  
  // If playing on different device, adjust strategy
  if (sourceDevice !== targetDevice) {
    console.log(`[SmartFinder] Cross-device: ${sourceDevice} → ${targetDevice}`);
    
    // SKIP coordinate-based strategies
    this.skipStrategies.push('coordinates', 'boundingBox');
    
    // PREFER semantic strategies
    this.boostStrategies(['role+text', 'testId', 'aria-label']);
  }
  
  // ... existing find logic ...
}
```

**Phase 3: Responsive Element Mapping (HIGHER RISK - OPTIONAL)**

```javascript
// In smart-finder.js - handleResponsiveElement()
async handleResponsiveElement(recipe, sourceDevice, targetDevice) {
  // Detect if we're looking for a nav element
  const isNavElement = recipe.where?.landmark === 'navigation' || 
                       recipe.what?.role === 'link' ||
                       recipe.what?.text?.match(/menu|nav|home|cart/i);
  
  if (isNavElement && sourceDevice !== targetDevice) {
    // Try mobile-specific patterns first
    if (targetDevice !== 'desktop') {
      // Check if hamburger menu needs to be opened first
      const hamburger = await this.page.locator('[aria-label*="menu"], .hamburger, [data-testid*="menu-toggle"]').first();
      if (await hamburger.isVisible()) {
        console.log('[SmartFinder] Opening mobile menu before finding element');
        await hamburger.click();
        await this.page.waitForTimeout(300); // Let menu animate
      }
    }
  }
}
```

### 14.5 Implementation Priority Matrix

| Feature | Impact | Risk | Priority | Effort |
|---------|--------|------|----------|--------|
| Store deviceContext in action | Medium | Low | P1 | 2 hours |
| Skip coordinates on cross-device | High | Low | P1 | 1 hour |
| Log warning on cross-device play | Medium | None | P1 | 30 min |
| Boost semantic selectors | Medium | Low | P2 | 2 hours |
| Auto-open mobile menu | High | Medium | P3 | 4 hours |
| Responsive element mapping | High | High | P4 | 8+ hours |

### 14.6 Safe Implementation Plan

**DO FIRST (No Regression Risk):**

1. **Add deviceContext to recorded actions** - Pure addition, no existing code changes
2. **Log cross-device playback** - Just logging, no behavior change
3. **Skip coordinate strategies on cross-device** - If sourceDevice ≠ targetDevice, disable coordinate fallback

```javascript
// Safe change in test-executor.js
const isCrossDevicePlay = (action.deviceContext?.recordedOn || 'desktop') !== 
                          (this.mobileDevice?.name || 'desktop');

if (isCrossDevicePlay) {
  console.log(`[Executor] Cross-device playback: ${action.deviceContext?.recordedOn} → ${this.mobileDevice?.name || 'desktop'}`);
  // Don't use coordinate fallback
  this.skipCoordinateFallback = true;
}
```

**DO LATER (With Careful Testing):**

1. Mobile menu auto-open
2. Responsive element remapping
3. Touch vs click event conversion

### 14.7 What Already Works (No Changes Needed)

**Target.com "Categories" Example:**

```
Recorded on Desktop:
  recipe: { what: { role: 'link', text: 'Categories' }, which: { testId: '@web/Header/MainMenuLink' } }

Played on iPhone 15 Pro:
  SmartFinder tries:
  1. testId: [data-testid="@web/Header/MainMenuLink"] → ✅ FOUND (same testId on mobile!)
  2. role+text: getByRole('link', 'Categories') → ✅ FOUND (link exists)
  
  Result: WORKS WITHOUT CHANGES
```

**When it breaks:**

```
Recorded on Desktop:
  Click "Navigation Menu" → Uses .desktop-nav selector
  
Played on iPhone:
  .desktop-nav doesn't exist → Falls back to coordinates → FAILS
  
  FIX: Skip coordinate fallback, rely on semantic selectors
```

### 14.8 Testing Checklist for Cross-Device

```
□ Record on Desktop, play on Desktop → Should work (baseline)
□ Record on Desktop, play on iPhone 15 → Test semantic selectors
□ Record on iPhone 15, play on Desktop → Test reverse direction
□ Record on iPhone, play on Galaxy → Test mobile-to-mobile
□ Test site with responsive menu (hamburger on mobile)
□ Test form submission (same fields on all devices)
□ Test element with coordinates fallback (should skip on cross-device)
```

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-31 | Claude | Initial comprehensive documentation |
| 2026-01-31 | Claude | Added industry comparison, proposed enhancements, quick wins |
| 2026-02-01 | Claude | Added click flow audit, unit tests, confidence percentages |
| 2026-02-01 | Claude | Added Cross-Device Testing analysis and implementation plan |
| 2026-02-01 | Claude | Added Lock Locators feature (Section 4.5) - user-controlled optimization |

---

**END OF DOCUMENT**

> Remember: This document is the source of truth for Record & Playback.
> If the code doesn't match this document, either the code or the document is wrong.
> Fix whichever is incorrect.
