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
   - 4.5 [Reliability Layer](#45-reliability-layer)
   - 4.6 [Key Playback Files](#46-key-playback-files)
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
3. **Graceful Fallback**: Multiple layers of fallback when primary strategy fails
4. **Smart Repair**: Non-technical users can fix broken steps without DOM knowledge

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

### 4.5 Reliability Layer

**File:** `flowstral-desktop/src/main/lib/reliability-layer.js`

**Pre-Action Verification:**
- Element is visible
- Element is enabled
- Element is not obscured (no overlay blocking)
- Element is stable (not moving)

**Overlay Dismissal:**
- Automatically closes cookie banners
- Handles modal dialogs
- Dismisses notification popups

**Post-Action Verification:**
- Confirms click was on intended target
- Validates form input values

### 4.6 Key Playback Files

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

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-31 | Claude | Initial comprehensive documentation |

---

**END OF DOCUMENT**

> Remember: This document is the source of truth for Record & Playback.
> If the code doesn't match this document, either the code or the document is wrong.
> Fix whichever is incorrect.
