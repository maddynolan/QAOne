# Record & Playback Architecture

Complete architecture reference for the QAAI Record & Playback system. Covers recording flow, playback execution, element finding, performance optimizations, and all timeout configurations.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [File Map](#2-file-map)
3. [Recording Flow](#3-recording-flow)
4. [Playback Flow](#4-playback-flow)
5. [Element Finding Architecture](#5-element-finding-architecture)
6. [Lock Locators & Self-Healing](#6-lock-locators--self-healing)
7. [Performance Optimizations & Timeout Reference](#7-performance-optimizations--timeout-reference)
8. [Normalization Pipeline](#8-normalization-pipeline)
9. [SmartFinder Phases](#9-smartfinder-phases)
10. [Known Constraints & Edge Cases](#10-known-constraints--edge-cases)

---

## 1. System Overview

```
 ┌──────────────────────────────────────────────────────────────┐
 │                    FRONTEND (React)                          │
 │  PlaywrightRecorderPage.tsx                                  │
 │  - Recording UI / Step Editor / Test Results Modal           │
 │  - normalizeStepsForPlayback() before execution              │
 │  - handleLockLocators() after successful run                 │
 │  - Auto-heal locked selectors on step-complete events        │
 └─────────────────────┬────────────────────────────────────────┘
                       │ IPC (flowstral.playwrightRecorder.runTest)
                       ▼
 ┌──────────────────────────────────────────────────────────────┐
 │               ELECTRON MAIN PROCESS                          │
 │  playwright-recorder.js (primary executor)                   │
 │  ├── runTest()          - Main playback loop                 │
 │  ├── _executeStepInternal() - Per-step dispatch              │
 │  ├── findElementWithRetry() - 4-layer element finding        │
 │  ├── _findElement()     - 50+ legacy strategies              │
 │  └── Recording scripts  - Injected into browser              │
 │                                                              │
 │  lib/smart-finder.js    - SmartFinder (10-phase search)      │
 │  lib/action-coalescer.js - Recording action coalescing       │
 │  lib/recipe-recorder-integration.js - Recipe ↔ Legacy        │
 │  lib/shared-element-finder.js - Shared legacy find           │
 │  lib/override-and-locked.js - Selector priority helpers      │
 │  lib/action-handlers.js - Unified action dispatch            │
 └──────────────────────────────────────────────────────────────┘
                       │
                       ▼
 ┌──────────────────────────────────────────────────────────────┐
 │               PLAYWRIGHT BROWSER                             │
 │  Chromium instance (persistent or fresh context)             │
 │  - Recording: Injected scripts capture user actions          │
 │  - Playback: Playwright APIs execute steps                   │
 └──────────────────────────────────────────────────────────────┘
```

---

## 2. File Map

| File | Purpose | Lines |
|------|---------|-------|
| `src/pages/PlaywrightRecorderPage.tsx` | Frontend UI, normalization, lock locators, test execution orchestration | ~10,000 |
| `flowstral-desktop/src/main/playwright-recorder.js` | Primary recorder + executor. Recording injection, playback loop, element finding, all action handlers | ~12,500 |
| `flowstral-desktop/src/main/lib/smart-finder.js` | SmartFinder class. 10-phase element search with Strategy Memory, role matching, shadow DOM, coordinates | ~3,200 |
| `flowstral-desktop/src/main/lib/action-coalescer.js` | Merges rapid keystrokes into fill actions, handles dropdown trigger+select coalescing | ~500 |
| `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` | Converts between legacy action format and ElementRecipe format for SmartFinder | ~1,400 |
| `flowstral-desktop/src/main/lib/shared-element-finder.js` | Shared legacy element finder (7 strategies, used by TestExecutor) | ~72 |
| `flowstral-desktop/src/main/lib/override-and-locked.js` | `getManualOverrideSelector()` and `getLockedSelector()` helpers | ~36 |
| `flowstral-desktop/src/main/lib/action-handlers.js` | Unified action handler dispatch (navigate, wait, assert, etc.) | ~300 |
| `flowstral-desktop/src/main/test-executor.js` | Legacy test executor (secondary path, less comprehensive) | ~4,100 |

---

## 3. Recording Flow

### 3.1 How Recording Works

```
User clicks "Record" in UI
        │
        ▼
PlaywrightRecorder.startRecording()
        │
        ├── Launch Chromium browser (persistent or fresh context)
        ├── Navigate to target URL
        ├── Inject recording scripts into page:
        │   ├── Recipe Recorder v2 (recipe-recorder-integration.js)
        │   │   Captures: click, fill, select, navigation, hover
        │   │   Format: ElementRecipe { what, where, which, confirm }
        │   │
        │   └── Action Coalescer (action-coalescer.js)
        │       Merges: rapid keystrokes → single fill action
        │       Detects: dropdown trigger → option select pairs
        │
        ├── Listen for page events:
        │   ├── 'console' messages from injected scripts
        │   ├── 'framenavigated' for navigation tracking
        │   └── 'popup' for new tab/window detection
        │
        └── Process captured actions:
            ├── recipeActionToLegacy() converts to unified format
            ├── Deduplicate rapid-fire events
            ├── Emit 'action-recorded' to frontend
            └── Frontend appends to actions[] state
```

### 3.2 Recorded Action Format

```typescript
interface RecordedAction {
  id: string;               // Unique step ID
  type: string;             // 'click', 'fill', 'navigate', 'select', etc.
  qword: string;            // Normalized action verb
  description: string;      // Human-readable description
  args: [string, ...any];   // [label/text, elementIndex?, value?]
  selector: string;         // Primary CSS selector
  selectorObj: {
    selector: string;       // CSS selector
    playwright: string;     // Playwright-optimized selector
    text: string;           // Element text content
    testId: string;         // data-testid attribute
    ariaLabel: string;      // aria-label attribute
    name: string;           // name attribute
    id: string;             // Element ID
    role: string;           // ARIA role
    placeholder: string;    // Placeholder text
    title: string;          // Title attribute
    className: string;      // CSS classes
    tagName: string;        // HTML tag
    href: string;           // Link href
    // Lock Locators fields:
    optimizedSelector?: string;  // Locked working selector
    optimizedAt?: string;        // When it was locked
    optimizedSource?: string;    // What strategy found it
    // Manual Override:
    manualOverride?: string;     // User-specified selector
    // Text Override:
    textOverride?: string;       // User-specified search text
  };
  element: object;          // Raw element data from recording
  recipe: object;           // ElementRecipe (v2 format)
  frameContext?: object;    // Iframe context if in iframe
  tabIndex?: number;        // Tab index for multi-tab
  value?: string;           // Fill value
}
```

### 3.3 Action Coalescing

The `ActionCoalescer` handles two patterns:

1. **Input Coalescing**: Rapid keystrokes within 1500ms are merged into a single `fill` action
2. **Dropdown Coalescing**: A trigger click followed by an option click within 2000ms (Node) / 3000ms (injected script) are merged into a single `select` action

---

## 4. Playback Flow

### 4.1 Step Execution Pipeline

```
Frontend: handleRunTest()
        │
        ├── normalizeStepsForPlayback(actions)
        │   ├── Filter garbage actions (React internals, webpack, etc.)
        │   ├── Normalize text (remove dynamic numbers, emojis, badges)
        │   ├── Create robust fallback selectors
        │   └── Preserve: optimizedSelector, manualOverride, selectorObj
        │
        ├── IPC → PlaywrightRecorder.runTest({ steps, url, ... })
        │
        └── For each step:
            │
            ├── 1. Action type dispatch (_executeStepInternal)
            │   ├── navigate → page.goto()
            │   ├── click    → findElementWithRetry() → click
            │   ├── fill     → findElementWithRetry() → fill/type
            │   ├── select   → combobox handling
            │   ├── hover    → findElementWithRetry() → hover
            │   ├── press    → keyboard.press()
            │   ├── assert   → text/element/value assertion
            │   └── scroll   → scrollIntoView
            │
            ├── 2. Post-step delay (configurable slowMo)
            │   ├── Locked selector: min 20ms
            │   └── Other: min 100ms (or slowMo value)
            │
            ├── 3. Emit step-complete event with:
            │   ├── workingSelector (for Lock Locators)
            │   ├── strategyType (what found the element)
            │   ├── healed (if self-healing occurred)
            │   └── screenshot (on failure)
            │
            └── 4. Frontend updates test result modal
```

### 4.2 Click Execution Detail

```
_executeStepInternal('click')
        │
        ├── findElementWithRetry(action)
        │   └── (see Section 5 for full element finding flow)
        │
        ├── If element found:
        │   ├── scrollIntoViewIfNeeded()
        │   ├── Highlight element (skip for LockedSelector)
        │   ├── Click with force:true fallback
        │   │   ├── Primary: locator.click({ timeout: 3000 })
        │   │   └── Fallback: locator.click({ force: true })
        │   │   └── Fallback: dispatchEvent click
        │   │   └── Fallback: page.mouse.click(coordinates)
        │   │
        │   ├── New tab detection (event-driven, 200ms)
        │   ├── Link navigation check (waitForURL, 3s timeout)
        │   └── Post-click settle (100ms normal, 300ms after nav)
        │
        └── If not found after all layers:
            ├── Layer 3: iframe search
            ├── Layer 4: AI Vision fallback (GPT-4o)
            └── Report failure with screenshot
```

### 4.3 Fill Execution Detail

```
_executeStepInternal('fill')
        │
        ├── findElementWithRetry(action)  [handles stability waits]
        │
        ├── If found:
        │   ├── Click to focus
        │   ├── Clear existing value (triple-click + Delete)
        │   ├── Primary: locator.fill(value)
        │   ├── Fallback: locator.type(value) [char by char]
        │   ├── Fallback: page.keyboard.type(value)
        │   └── Verify value was set correctly
        │
        ├── If not found: try direct ID/name/getByLabel fallbacks
        │
        └── If search field detected:
            └── Wait for search results (domcontentloaded + 200ms)
```

---

## 5. Element Finding Architecture

### 5.1 The 4-Layer Waterfall

```
findElementWithRetry(action)
│
│  retryWithBackoff(fn, { maxRetries: 2 })
│  │
│  └── Per attempt:
│      │
│      ├── LAYER 0: Locked Selector (optimizedSelector)
│      │   ├── Parse role=xxx[name="yyy"] format
│      │   ├── 150ms race timeout
│      │   └── If visible → return instantly (LockedSelector)
│      │
│      ├── LAYER 0.5: Quick Scan (NEW - text/role/aria fast checks)
│      │   ├── For clicks: getByRole(button/link/menuitem/tab),
│      │   │   getByTitle, aria-label, title attr, getByText (last)
│      │   ├── For fills: getByLabel, getByPlaceholder,
│      │   │   getByRole(textbox), aria-label-input, name-input
│      │   ├── 250ms race timeout per strategy
│      │   ├── getByText has interactivity guard (skips non-interactive matches)
│      │   ├── Self-healing: reports healed selector to frontend
│      │   └── If visible → return (QuickScan-{strategy})
│      │
│      ├── LAYER 1: SmartFinder (recipe-based, 10-phase search)
│      │   ├── Convert action to ElementRecipe
│      │   ├── 8s timeout (was 15s, then 5s, now balanced at 8s)
│      │   ├── Re-scoped when switching to/from iframes
│      │   ├── Handles: shadow DOM, Salesforce Lightning,
│      │   │   role disambiguation, text normalization
│      │   └── If found → return (SmartFinder)
│      │
│      └── LAYER 2: Legacy _findElement (50+ strategies)
│          ├── Manual override (highest priority)
│          ├── data-testid, name, id, aria-label, title
│          ├── role+name combinations
│          ├── Playwright getBy* methods (shadow DOM piercing)
│          ├── Salesforce-specific selectors
│          ├── Text/partial text matching
│          ├── Keyword extraction
│          └── If found → return (legacy-{type})
│
├── LAYER 3: iframe search (if not found on main page)
│   ├── Search all iframes by testId, button text, text content
│   └── If found → return (iframe[n])
│
└── LAYER 4: AI Vision Fallback (last resort)
    ├── Screenshot page
    ├── Send to GPT-4o with element description
    ├── Get coordinates
    └── clickAtCoordinates(x, y)
```

### 5.2 Selector Priority Order

Within `_findElement`, strategies are tried in this priority:

| Priority | Strategy | Reliability |
|----------|----------|-------------|
| 1 | Manual Override (`selectorObj.manualOverride`) | Highest - user specified |
| 2 | `data-testid` (exact, getByTestId, data-test-id, data-cy, data-qa) | Very High |
| 3 | `name` attribute (input, button) | High |
| 4 | `id` attribute (if not dynamic) | High |
| 5 | `aria-label` (exact, getByLabel) | High |
| 6 | `title` attribute | Medium-High |
| 7 | `role + name` (getByRole) | Medium-High |
| 8 | `href` (for links) | Medium |
| 9 | Recorded CSS selector | Medium |
| 10 | Salesforce-specific (Lightning, SLDS) | Medium |
| 11 | Playwright getBy* (button, link, tab, menuitem, text) | Medium |
| 12 | Text matching (exact, partial, has-text) | Lower |
| 13 | Keyword extraction | Lowest |

### 5.3 SmartFinder vs Legacy `_findElement`

| Feature | SmartFinder | Legacy `_findElement` |
|---------|-------------|----------------------|
| Input format | ElementRecipe | Action object |
| Shadow DOM | Full support (evaluate) | Via Playwright getBy* |
| Disambiguation | resolveMultiple (position, testId, visibility) | elementIndex |
| Learning | Strategy Memory | None |
| Phases | 10 phases | Single pass |
| Salesforce | Lightning components, ListView, "New" button | SF-specific selectors |
| Coordinates | BBox fallback | None |
| Timeout | 8s | 5s |

---

## 6. Lock Locators & Self-Healing

### 6.1 Lock Locators Flow

```
1. User runs test → all steps pass
2. Each step reports: workingSelector + strategyType
3. User clicks "Lock Locators" button
4. handleLockLocators():
   ├── For each step with workingSelector:
   │   └── Set action.selectorObj.optimizedSelector = workingSelector
   ├── Persist to localStorage (3 locations):
   │   ├── test_cases
   │   ├── flowstral_test_cases
   │   └── unified_test_case_{id}
   └── Toast: "Locked N selectors! Re-runs will be faster."

5. Next run: findElementWithRetry checks optimizedSelector FIRST
   ├── 150ms race timeout (instant for cached elements)
   └── Skip SmartFinder + legacy entirely if found
```

### 6.2 Self-Healing Flow

```
1. Locked selector fails (element changed since lock)
2. Quick Scan or SmartFinder finds the element with a NEW selector
3. Backend flags: healed=true, newSelector="..."
4. Frontend receives step-complete event:
   ├── Auto-updates action.selectorObj.optimizedSelector
   ├── Sets optimizedSource = 'auto-healed'
   └── Toast: "Auto-healed step N with new selector"
5. Next run: uses the healed selector (no performance loss)
```

### 6.3 Selector Storage

```
action.selectorObj = {
  // Original recording data:
  selector: "...",
  playwright: "...",
  text: "...",
  testId: "...",
  // ...other attributes...

  // Lock Locators (added after successful run):
  optimizedSelector: "role=button[name=\"Show Navigation Menu\"]",
  optimizedAt: "2026-02-04T...",
  optimizedSource: "QuickScan-getByRole-button",

  // Manual Override (user-specified):
  manualOverride: "#custom-selector",

  // Text Override:
  textOverride: "Custom search text"
}
```

**Priority**: Manual Override > Locked Selector > Quick Scan > SmartFinder > Legacy

---

## 7. Performance Optimizations & Timeout Reference

### 7.1 All Timeout Changes (Before → After)

| Location | Component | Before | After (Balanced) | Impact | File:Line |
|----------|-----------|--------|-------------------|--------|-----------|
| SmartFinder constructor | `timeout` | 15,000ms | **8,000ms** | -7s per SmartFinder invocation (balanced for deep shadow DOM) | `playwright-recorder.js:7797` |
| SmartFinder (new tab) | `timeout` | 15,000ms | **8,000ms** | -7s on tab switch | `playwright-recorder.js:8469` |
| SmartFinder re-scoping | iframe switch | Never re-created | **Re-created on iframe scope change** | Fixes iframe element finding | `playwright-recorder.js:7795` |
| Element find retries | `maxRetries` | 3 | **3** (restored) | Restored from 2 for reliability | `playwright-recorder.js:8044` |
| Quick Scan race | per-strategy | N/A (new) | **250ms** | New layer, finds most elements in <300ms | `playwright-recorder.js:7898` |
| Quick Scan getByText | order | N/A (new) | **Last + interactivity guard** | Prevents matching non-interactive spans/divs | `playwright-recorder.js:7890` |
| Locked selector race | per-check | 150ms | 150ms | (unchanged) | `playwright-recorder.js:7835` |
| New tab detection | polling wait | **500ms** fixed | **200ms** event-driven | -300ms per click | `playwright-recorder.js:8449` |
| New tab stabilize | post-switch | 1,000ms | **500ms** | -500ms per tab switch | `playwright-recorder.js:8473` |
| Link navigation check | polling wait | **2,000ms** fixed | **waitForURL 3s** (event) | -2s per link click, instant when URL changes | `playwright-recorder.js:8494` |
| Post-navigation settle | after nav load | 2,000ms | **1,000ms** | -1s per navigation (sufficient for Salesforce) | `playwright-recorder.js:8538` |
| Post-click settle | regular clicks | 500ms | **250ms** | -250ms per click (covers CSS transitions) | `playwright-recorder.js:8542` |
| Fill pre-wait | before fill | 500ms (domcontent + 500ms) | **domcontent + 200ms** (restored) | -300ms but still ensures DOM ready for fills | `playwright-recorder.js:8566` |
| Fill post-input | after typing | 200ms | **200ms** | (unchanged - needed for validation/re-render) | `playwright-recorder.js:8753` |
| `_findElement` isVisible | per-strategy | `{ timeout: 5000 }` | **No timeout** (instant check) | -5s per non-visible match | `playwright-recorder.js:7388` |
| DOM stability wait | before find (non-locked) | domcontent + 300ms | domcontent + 300ms | (unchanged - necessary for fresh pages) | `playwright-recorder.js:7806` |
| DOM stability wait | before find (locked) | 50ms | 50ms | (unchanged) | `playwright-recorder.js:7809` |
| `resolveMultiple` isVisible | per-candidate | `{ timeout: 500 }` × 10 | **No timeout** × 5 | -4.5s worst case per disambiguation | `smart-finder.js:3015` |
| Step delay (locked/quick) | between steps | 50ms min | 50ms min | (unchanged) | `playwright-recorder.js:3844` |
| Step delay (non-locked) | between steps | 100ms min | 100ms min | (unchanged) | `playwright-recorder.js:3844` |
| Resume step delay | between resume steps | 300ms | **300ms** | (unchanged - conservative for resume recovery) | `playwright-recorder.js:4482` |
| Initial page settle | one-time before loop | 500ms | **500ms** | (unchanged - one-time cost for initial load) | `playwright-recorder.js:3587` |

### 7.2 Net Performance Impact

**Typical 20-step Salesforce test (before optimization):**

| Component | Time |
|-----------|------|
| Step delays (200ms × 20) | 4.0s |
| DOM stability (300ms × 20) | 6.0s |
| New tab checks (500ms × 15 clicks) | 7.5s |
| Fill pre-waits (500ms × 5 fills) | 2.5s |
| Link clicks (2000ms × 1) | 2.0s |
| Highlight delays (100ms × 15) | 1.5s |
| SmartFinder failures (15s × 3 retries × per step) | 45-60s |
| **Total dead time** | **~70-85s** |

**After optimization (balanced for robustness):**

| Component | Time |
|-----------|------|
| Step delays (200ms × 20) | 4.0s |
| DOM stability (300ms × 20) | 6.0s |
| New tab checks (200ms event × 15 clicks) | 0.2s* |
| Fill pre-waits (200ms × 5 fills) | 1.0s |
| Link clicks (waitForURL, instant) | 0.1s |
| Highlight delays (100ms × 15) | 1.5s |
| Quick Scan finds (250ms × per step) | 0.8s |
| Post-click settle (250ms × 15 clicks) | 3.75s |
| Post-nav settle (1000ms × 1 nav) | 1.0s |
| **Total dead time** | **~18s** |

*Event-driven: returns immediately when no tab opens (200ms timeout only hit if tab might open)

**Estimated speedup: 4-5x for Salesforce tests** (balanced for robustness, still major improvement)

### 7.3 Retry Backoff Configuration

```javascript
retryWithBackoff(fn, {
  maxRetries: 3,      // Restored to 3 for robustness (was briefly 2, caused failures)
  baseDelay: 200,     // 200ms initial delay between retries
  maxDelay: 5000,     // Cap at 5s
  description: '...'
})
// Retry 1: 200ms wait → re-find
// Retry 2: 400ms wait → re-find (exponential backoff)
// Retry 3: 800ms wait → re-find
// Total retry overhead: ~1.4s + 3 × find attempt
// With Quick Scan: most elements found on first attempt (<250ms)
```

### 7.4 Playback Speed Settings

| Speed | `slowMo` | Step Delay (Locked) | Step Delay (Other) |
|-------|----------|--------------------|--------------------|
| 2x (fastest) | 0ms | 20ms | 100ms |
| 1x (normal) | 200ms | 20ms | 200ms |
| 0.5x (slow) | 500ms | 500ms | 500ms |
| 0.25x (very slow) | 1000ms | 1000ms | 1000ms |

---

## 8. Normalization Pipeline

### 8.1 Frontend Normalization (before playback)

```
normalizeStepsForPlayback(actions)
├── Filter garbage actions:
│   ├── ES6 imports/exports
│   ├── React/Webpack internals
│   ├── HMR updates
│   └── Source maps
│
├── For each action needing normalization (click/fill/type/select/check/hover):
│   ├── normalizeText(): 
│   │   ├── Remove badge numbers: "Messages 3" → "Messages"
│   │   ├── Remove emojis: "🏠 Home" → "Home"
│   │   ├── Collapse whitespace
│   │   └── Trim
│   │
│   ├── createRobustSelectors():
│   │   ├── text="normalized text" (exact)
│   │   ├── getByText fallback
│   │   └── Partial text fallback
│   │
│   └── enhancedSelectorObj:
│       ├── ...original selectorObj (preserves optimizedSelector!)
│       ├── text: normalized
│       ├── selector: best robust selector
│       ├── playwright: best robust selector
│       ├── fallbacks: [all robust selectors]
│       └── _normalized: true (prevents re-normalization)
```

### 8.2 Backend Text Normalization (SmartFinder)

```
SmartFinder.normalizeText():
├── Replace smart quotes/apostrophes with ASCII: ' ' → '
├── Normalize dashes: — – → -
├── Collapse whitespace
└── Trim

SmartFinder._fixMissingSCharacter():
├── "Li t" → "List"
├── "Pa word" → "Password"
├── "Ca e" → "Case"
├── "Acc ount" → "Account"
└── (15+ Salesforce-specific fixes)
```

---

## 9. SmartFinder Phases

| Phase | Name | What It Does | Strategies |
|-------|------|-------------|------------|
| Fast Path | Strategy Memory | Remembers what worked last time | 1 |
| Context | Product context | E-commerce: finds button within product card | 30 containers × 38 buttons |
| 0 | testId | `data-testid` exact match | 1-2 |
| 0.5 | SF testId from CSS | Extract testId from `confirm.cssSelector` | 1-2 |
| 1 | Scope | Narrow search to landmark/section | variable |
| 1.5 | SF ListView | Salesforce list view buttons (not search inputs) | ~13 |
| 2 | role+text | `getByRole(role, { name: text })` with fallbacks | ~6 |
| 2.5 | SF "New" button | Disambiguate multiple "New" buttons by object type | 1 |
| 2.6 | near-text | Find checkbox/radio near label text | 5×5 |
| 3 | text-based | `getByText()` with exact, apostrophe, regex variations | ~5 |
| 4 | aria-label | `[aria-label="..."]` exact and partial | ~3 |
| 5 | name attribute | `[name="..."]` | 1 |
| 6 | ID | `#id` (if not dynamic) | 1 |
| 7 | href | `a[href="..."]` for links | 1 |
| 8 | CSS fallback | Recorded CSS selector from `confirm.cssSelector` | 1-2 |
| 8.5 | SF Lightning | Lightning Web Component selectors | ~25 |
| 9 | Text variations | Stripped/partial text as last resort | ~3 |
| 9 | Shadow DOM | `evaluate()` search inside shadow roots | 4 |
| 10 | Coordinates | BBox-based click at recorded position | 1-2 |

---

## 10. Known Constraints & Edge Cases

### 10.1 Salesforce Lightning

- Shadow DOM: Playwright's `getBy*` methods auto-pierce, but CSS selectors don't
- Dynamic IDs: Salesforce generates IDs like `aura-id-123` that change every session
- Navigation Menu: "Show Navigation Menu" button triggers Lightning navigation which updates URL via `history.pushState` (handled by `waitForURL`)
- List View buttons vs search inputs: Phase 1.5 specifically handles this disambiguation

### 10.2 Multi-Tab Support

- New tabs detected via `context.waitForEvent('page', { timeout: 200 })`
- SmartFinder is reinitialized when switching tabs
- `_playbackPages` array tracks all open tabs
- Tab switching via `action.tabIndex` or automatic detection

### 10.3 iframe Support

- `_getFrameScope()` resolves the correct frame for each action
- `searchScope` parameter passed through `findElementWithRetry` → `_findElement`
- SmartFinder initialized with frame scope when in iframe
- Layer 3 fallback searches all iframes if main page search fails

### 10.4 Two Executor Paths

- **PlaywrightRecorder** (`playwright-recorder.js`): Primary path, 50+ strategies, SmartFinder, Quick Scan
- **TestExecutor** (`test-executor.js`): Legacy path, 7 strategies via `shared-element-finder.js`
- Both are active; PlaywrightRecorder is used by `flowstral.playwrightRecorder.runTest()`, TestExecutor by `electronAPI.testRunner.executeTest()`
- PlaywrightRecorder is significantly more robust

### 10.5 Recording Edge Cases

- **Action Coalescer timeout mismatch**: Node-side uses 2000ms, injected script uses 3000ms for dropdown detection
- **Input debounce**: 1500ms in recipe-recorder-integration.js; `blur` event flushes immediately
- **Recipe round-trip**: `legacyActionToRecipe` → `recipeActionToLegacy` may lose `className`; `what.tag` stored uppercase
- **nearText**: Falls back to element's own text when no `ariaLabel` is available

---

## Appendix: Quick Reference — Element Finding Execution Time

| Layer | Typical Time | Max Time | When Hit |
|-------|-------------|----------|----------|
| Locked Selector | 1-5ms | 150ms | After Lock Locators |
| Quick Scan (hit) | 10-100ms | 250ms per strategy | Most elements with text/role |
| Quick Scan (miss) | 250ms × 8 = 2.0s | 2.0s | Complex elements, no text match |
| SmartFinder (hit) | 100-500ms | 8s | Shadow DOM, complex disambiguation |
| SmartFinder (miss) | 8s | 8s | Element truly not present |
| Legacy `_findElement` (hit) | 50-200ms | 5s | Rare — SmartFinder usually finds first |
| Legacy `_findElement` (miss) | 2-5s | 5s | Element not present |
| iframe search | 100-500ms | 2s | Element in iframe |
| AI Vision fallback | 3-10s | 15s | All other methods failed |
| **Full waterfall (worst, 3 attempts)** | | **~46s** | Was ~65s before optimization |
