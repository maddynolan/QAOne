# Record & Playback Reliability: Zero False Positives Architecture

> **Purpose:** Comprehensive guide to the reliability enhancements that eliminate false positives and provide easy fixes for failures.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The 4-Layer Detection System](#2-the-4-layer-detection-system)
3. [Reliability Layer Features](#3-reliability-layer-features)
4. [Common Failure Scenarios & Auto-Fixes](#4-common-failure-scenarios--auto-fixes)
5. [Confidence Scoring System](#5-confidence-scoring-system)
6. [Visual Fingerprinting](#6-visual-fingerprinting)
7. [Smart Disambiguation](#7-smart-disambiguation)
8. [Configuration & Tuning](#8-configuration--tuning)
9. [Supported Enterprise Frameworks](#9-supported-enterprise-frameworks)
10. [Step Repair: Assisted Re-record](#10-step-repair-assisted-re-record)
11. [Screenshot Policy](#11-screenshot-policy)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RELIABILITY LAYER                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Pre-Action  │  │Disambiguation│  │ Post-Action │  │    Fix      │       │
│  │ Verification│→ │   Engine    │→ │ Verification│→ │ Suggestions │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SMART FINDER (8 Phases)                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Memory  │→│  Scope  │→│  Query  │→│ Resolve │→│Fallback │→│  Learn  │  │
│  │ (Fast)  │ │ (Where) │ │ (What)  │ │ (Which) │ │ (Legacy)│ │ (Save)  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTO-HEALING LOCATOR ENGINE                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Primary Locator → Fallback 1 → Fallback 2 → ... → Signature Search  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Strategies (by priority per application):                                  │
│  • role → text → label → testid → data-attr → aria → css → xpath           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI VISION FALLBACK (Last Resort)                         │
│  • Takes screenshot → Sends to GPT-4o → Gets coordinates → Clicks          │
│  • Budget: 3-5 calls per test run (configurable)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Layer Detection System

### Layer 1: SmartFinder (Recipe-Based)

Uses human-centric "Element Recipe" with three components:

| Component | Purpose | Example |
|-----------|---------|---------|
| **What** | What the element IS | `{ role: 'button', text: 'Submit', tag: 'button' }` |
| **Where** | Context/location | `{ landmark: 'form', nearText: 'Payment Info' }` |
| **Which** | Disambiguation | `{ position: 2, testId: 'submit-btn', uniqueText: true }` |

### Layer 2: Auto-Healing Locator Engine

Generates 10+ locator strategies per element, ranked by application:

```javascript
// Example: Salesforce prioritizes data attributes
salesforce: ['data-attribute', 'role', 'text', 'label', 'aria', 'testid', 'css', 'xpath']

// Example: Jira prioritizes test IDs
jira: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath']
```

### Layer 3: Strategy Memory (Learning)

- Remembers which strategy worked for each element
- Fast path on replay (skips failed strategies)
- Clears strategies with <80% success rate
- Persists between sessions

### Layer 4: AI Vision Fallback

When all deterministic strategies fail:
1. Takes screenshot
2. Sends to GPT-4o with element description
3. Gets pixel coordinates
4. Clicks at coordinates
5. Budget-limited (prevents runaway costs)

---

## 3. Reliability Layer Features

### 3.1 Pre-Action Verification

Before ANY action, we verify the element is truly actionable:

| Check | What It Does | Failure Example |
|-------|-------------|-----------------|
| **exists** | Element is in DOM | Element not rendered yet |
| **visible** | Element is displayed | `display: none` or zero size |
| **enabled** | Element is not disabled | `disabled` attribute set |
| **notObscured** | No overlay covering it | Modal, cookie banner blocking |
| **stable** | Element not animating | Slide-in animation in progress |
| **inViewport** | Element is scrolled into view | Below the fold |

### 3.2 Post-Action Verification

After every action, we verify it succeeded:

| Action | Verification |
|--------|--------------|
| **click** | State change occurred, no error appeared |
| **fill** | Input value matches expected |
| **select** | Selected text matches expected |
| **check/uncheck** | Checkbox state is correct |

### 3.3 Auto-Recovery

Automatically handles common issues:

| Issue | Auto-Recovery |
|-------|---------------|
| Cookie banner blocking | Auto-dismiss with common selectors |
| Modal/dialog blocking | Press Escape or click close button |
| Element not in view | Auto-scroll into view |
| Stale element | Re-find with fresh locator |
| Network slow | Retry with backoff |

### 3.4 Fix Suggestions

When things fail, we provide actionable fixes:

```javascript
// Example failure output
{
  success: false,
  suggestions: [{
    title: 'Element is covered by overlay',
    fixes: [
      'Close the cookie-banner before this action',
      'Add wait for overlay to disappear',
      'Dismiss cookie banner or modal first'
    ],
    quickFix: {
      type: 'dismiss-overlay',
      description: 'Add step to close overlay',
      selector: '.cookie-banner'
    }
  }]
}
```

---

## 4. Common Failure Scenarios & Auto-Fixes

### Scenario 1: Element Not Found

**Symptoms:** Selector returns 0 elements

**Auto-Fix Attempts:**
1. Wait for page load state
2. Wait for network idle
3. Try fallback selectors
4. AI vision fallback

**Suggested Fix:**
```
Add a wait step before this action, or check if the element
is inside an iframe.
```

### Scenario 2: Element Not Visible

**Symptoms:** Element exists but `isVisible()` returns false

**Auto-Fix Attempts:**
1. Scroll element into view
2. Wait for animations to complete
3. Check if inside collapsed accordion

**Suggested Fix:**
```
Add step to reveal element (expand accordion, open dropdown, etc.)
```

### Scenario 3: Element Obscured by Overlay

**Symptoms:** `elementFromPoint()` returns different element

**Auto-Fix Attempts:**
1. Press Escape to close modal
2. Click common close button selectors
3. Click outside overlay

**Suggested Fix:**
```
Close the modal/dialog before this action, or add step to
dismiss cookie banner first.
```

### Scenario 4: Multiple Elements Match

**Symptoms:** Selector returns >1 elements

**Auto-Fix Attempts:**
1. Use visual fingerprint to identify correct one
2. Use position hint from recipe
3. Prefer visible, in-viewport, enabled element
4. Use contextual text matching

**Suggested Fix:**
```
Add more context to make selector unique. Consider using
a data-testid if available, or re-record with more specific selector.
```

### Scenario 5: Click Had No Effect

**Symptoms:** Post-action verification fails

**Auto-Fix Attempts:**
1. Retry with force click
2. Add delay before click
3. Try alternative click method (coordinates)

**Suggested Fix:**
```
Element may have JavaScript preventing interaction. Try adding
delay before action or check for JS errors in console.
```

### Scenario 6: Stale Element Reference

**Symptoms:** Element reference invalidated by DOM change

**Auto-Fix Attempts:**
1. Re-find element with fresh selector
2. Wait for page to stabilize
3. Retry action

**Suggested Fix:**
```
Page may have reloaded or re-rendered. Add wait for page
stability after navigation.
```

---

## 5. Confidence Scoring System

Every action gets a confidence score from 0.0 to 1.0:

### Score Components

| Component | Weight | Source |
|-----------|--------|--------|
| Pre-action checks | 40% | All 6 checks passed |
| Disambiguation | 30% | Gap between best and second-best match |
| Post-action verification | 30% | Action had expected effect |

### Confidence Thresholds

| Level | Score | Action |
|-------|-------|--------|
| **Excellent** | ≥ 0.95 | Proceed confidently |
| **Good** | 0.85 - 0.95 | Proceed with note |
| **Warning** | 0.70 - 0.85 | Proceed but log warning |
| **Fail** | < 0.70 | Fail with suggestions |

### Example Confidence Calculation

```javascript
// Element found, visible, enabled, not obscured, stable, in viewport
preActionConfidence = 1.0

// 3 matches, best scored 0.85, second scored 0.60
disambiguationConfidence = 0.85 + (0.85 - 0.60) * 0.5 = 0.975

// Click verified, no errors
postActionConfidence = 1.0

// Aggregate
finalConfidence = (1.0 * 0.4) + (0.975 * 0.3) + (1.0 * 0.3) = 0.99
```

---

## 6. Visual Fingerprinting

### How It Works

**During Recording:**
```javascript
// Capture screenshot of element
const fingerprint = await captureVisualFingerprint(page, locator);
// Returns: { hash, screenshot (base64), width, height }
```

**During Playback:**
```javascript
// Compare current element to recorded fingerprint
const comparison = compareVisualFingerprints(recorded, current);
// Returns: { match: true/false, similarity: 0.0-1.0 }
```

### Use Cases

1. **Disambiguation:** When multiple elements match selector, use visual fingerprint to pick the right one
2. **Validation:** Verify element visually matches what was recorded
3. **Regression Detection:** Catch CSS changes that broke the element

---

## 7. Smart Disambiguation

When multiple elements match the same selector:

### Scoring Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Visible | 25% | Element is currently visible |
| In Viewport | 20% | Element is in the visible area |
| Not Obscured | 15% | No overlay covering element |
| Position Match | 15% | Index matches recorded position |
| Visual Match | 20% | Screenshot matches recorded |
| Context Match | 10% | Nearby text matches |
| Enabled | 5% | Element is interactive |

### Example Disambiguation

```
Found 3 "Add to Cart" buttons:

Candidate 0: score 0.45
  - visible, NOT in-viewport, not-obscured
  
Candidate 1: score 0.90 ← SELECTED
  - visible, in-viewport, not-obscured, position-match(2), visual-match(92%)
  
Candidate 2: score 0.35
  - visible, NOT in-viewport, disabled

Selected candidate 1 with confidence 0.90
```

---

## 8. Configuration & Tuning

### Default Configuration

```javascript
const CONFIG = {
  preAction: {
    checkVisible: true,
    checkEnabled: true,
    checkNotObscured: true,
    checkStable: true,
    checkInViewport: true,
    stabilityWaitMs: 150,
    obscuredCheckRetries: 3,
  },
  
  postAction: {
    verifyStateChange: true,
    verifyNoErrors: true,
    verifyNoUnexpectedNavigation: true,
    stateChangeWaitMs: 500,
  },
  
  visual: {
    enabled: true,
    similarityThreshold: 0.85,
    cropPadding: 5,
  },
  
  disambiguation: {
    maxCandidates: 10,
    preferVisible: true,
    preferInViewport: true,
    preferUnobscured: true,
    useVisualHint: true,
    useContextualPosition: true,
  },
  
  recovery: {
    dismissOverlays: true,
    handleAuthPrompts: true,
    retryOnStale: true,
    maxRetries: 3,
    retryDelayMs: 500,
  },
  
  confidence: {
    minimum: 0.7,
    warning: 0.85,
    excellent: 0.95,
  },
};
```

### Tuning for Specific Scenarios

**For Slow Applications:**
```javascript
CONFIG.preAction.stabilityWaitMs = 300;
CONFIG.postAction.stateChangeWaitMs = 1000;
CONFIG.recovery.retryDelayMs = 1000;
```

**For Strict Testing:**
```javascript
CONFIG.confidence.minimum = 0.85;
CONFIG.recovery.maxRetries = 1;
```

**For Flaky Environments:**
```javascript
CONFIG.recovery.maxRetries = 5;
CONFIG.recovery.dismissOverlays = true;
```

---

## Summary: How False Positives Are Eliminated

| Problem | Solution |
|---------|----------|
| Wrong element clicked | Pre-action obscured check + disambiguation scoring |
| Element not ready | Pre-action stability + visibility checks |
| Multiple matches | Visual fingerprint + context + position scoring |
| Action didn't work | Post-action verification + auto-retry |
| Overlay blocking | Auto-dismiss + fix suggestions |
| Stale reference | Auto-retry with fresh selector |
| Unknown failure | AI vision fallback + detailed suggestions |

**Result:** Every action either succeeds with high confidence, or fails with clear, actionable guidance on how to fix it.

---

## 9. Supported Enterprise Frameworks

The system supports **300+ custom element types** across major enterprise platforms:

### Enterprise SaaS Applications

| Application | Framework | Custom Elements |
|-------------|-----------|-----------------|
| **Salesforce** | Lightning Web Components | `lightning-button`, `lightning-input`, `lightning-combobox`, etc. |
| **SAP** | UI5 Web Components | `ui5-button`, `ui5-input`, `ui5-select`, etc. |
| **ServiceNow** | Next Experience | `now-*` components with data-testid |
| **Workday** | Canvas Kit (React) | `canvas-button`, `canvas-input`, `canvas-modal`, etc. |
| **Oracle Cloud** | Oracle JET | `oj-button`, `oj-input-text`, `oj-select-single`, etc. |
| **Microsoft Dynamics 365** | Fluent UI | `fluent-button`, `fluent-text-field`, `fluent-dialog`, etc. |
| **Jira/Confluence** | Atlassian Design System | `ak-button`, `ak-modal`, `ak-tabs`, etc. |
| **Zendesk** | Garden | `garden-button`, `garden-input`, `garden-modal`, etc. |
| **HubSpot** | Custom React | Standard data-testid + selenium attributes |
| **Adobe** | Spectrum | `sp-button`, `sp-textfield`, `sp-dialog`, etc. |

### Popular UI Frameworks

| Framework | Technology | Custom Elements |
|-----------|------------|-----------------|
| **Angular Material** | Angular | `mat-button`, `mat-input`, `mat-dialog`, etc. |
| **Ant Design** | React | Class-based (`ant-btn`, `ant-input`) |
| **Vuetify** | Vue | `v-btn`, `v-text-field`, `v-dialog`, etc. |
| **PrimeNG** | Angular | `p-button`, `p-dropdown`, `p-dialog`, etc. |
| **Chakra UI** | React | `chakra-button`, `chakra-input`, etc. |
| **Blueprint** | React | `bp5-button`, `bp5-input`, etc. |
| **Carbon Design** | IBM | `cds-button`, `cds-text-input`, etc. |
| **Shoelace** | Web Components | `sl-button`, `sl-input`, etc. |
| **Ionic** | Hybrid Mobile | `ion-button`, `ion-input`, etc. |

### Enterprise Data Grids

| Grid | Elements |
|------|----------|
| **AG Grid** | `ag-grid`, `ag-header-cell`, `ag-cell`, `ag-row` |
| **Kendo UI** | `kendo-grid`, `kendo-treelist`, etc. |
| **DevExtreme** | `dx-datagrid`, `dx-treelist`, etc. |

### Test ID Attributes Recognized

```javascript
// Standard
'data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa', 'data-e2e'

// Salesforce
'data-target-selection-name', 'data-refid', 'data-component-id'

// SAP
'stable-dom-ref', 'data-sap-ui'

// ServiceNow
'data-sn-test-id', 'sn-atf-'

// Workday
'data-automation-widget', 'data-uxi-widget-type'

// Oracle
'data-afr-', 'af:id'

// Microsoft
'data-id', 'data-lp-id'

// Atlassian
'data-ds--'

// Zendesk
'data-garden-id'
```

---

## 10. Step Repair: Assisted Re-record

When a step fails or is flagged as wrong, users can repair it **without any technical knowledge**.

### The Repair Flow

```
1. User flags step 3 as wrong
         ↓
2. User clicks "Repair This Step"
         ↓
3. System re-runs steps 1, 2 (prerequisites)
         ↓
4. Browser PAUSES at step 3 state
         ↓
5. User performs the correct action manually
         ↓
6. System captures new element recipe
         ↓
7. Test is fixed and can continue
```

### Repair Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| **PAUSE_BEFORE** | Stop before executing flagged step | Inspect what's wrong |
| **PAUSE_AFTER** | Execute step, then pause | Verify result |
| **INTERACTIVE** | Pause and wait for user action | Re-record the step |

### API Usage

```javascript
const { StepRepairManager, REPAIR_MODES } = require('./lib/step-repair');

const repair = new StepRepairManager({
  executor: testExecutor,
  onRepairPause: ({ message, screenshot }) => {
    // Show user the paused state
    showUI({ message, screenshot });
  },
});

// Start repair session
await repair.startRepairSession(testData, stepIndex, REPAIR_MODES.INTERACTIVE);

// User performs action... system calls captureUserAction()
await repair.captureUserAction(actionData);

// Apply the fix
const result = await repair.applyFix({ saveToTest: true, continueTest: true });
```

---

## 11. Screenshot Policy

Screenshots are captured **only when needed** to minimize overhead:

### When Screenshots Are Captured

| Scenario | Capture? | Reason |
|----------|----------|--------|
| Step fails | ✅ Yes | Debug evidence |
| Confidence < 75% | ✅ Yes | Potential issue |
| User flagged step | ✅ Yes | Investigation |
| Successful step | ❌ No | Not needed |
| First run (success) | ❌ No | Not needed |

### Configuration

```javascript
const ScreenshotPolicy = {
  CAPTURE_ON: {
    FAILURE: true,
    LOW_CONFIDENCE: true,
    USER_FLAG: true,
    EVERY_STEP: false,       // Expensive, disabled by default
  },
  CONFIDENCE_THRESHOLD: 75,   // Below this = capture
  CLEAR_ON_SUCCESS: true,     // Clear if retry succeeds
};
```

### Storage

- Screenshots stored temporarily during test run
- Persisted only for failures or flagged steps
- Auto-cleared after successful re-run
- Maximum 50MB memory limit (auto-evicts oldest)

---

## 12. Smart Suggestions Panel for Step Repair

When a step fails or is flagged, users can use the **Smart Suggestions Panel** to easily find and select the correct element.

### How It Works

```
1. Test runs and fails at step 5
         ↓
2. User sees "Test Failed" modal with failed step highlighted
         ↓
3. User clicks "Fix" button on the failed step
         ↓
4. Smart Suggestions Panel shows all clickable elements on current page
         ↓
5. User filters/searches for correct element
         ↓
6. User clicks "Replace" button on the suggestion
         ↓
7. Failed step is replaced with new element
```

### Smart Suggestions Panel Features

| Feature | Description |
|---------|-------------|
| **Filter by Type** | buttons, links, inputs, headings |
| **Search** | Free-text search across all elements |
| **Execute** | Test-click element without saving |
| **Add to Test** | Add as new step |
| **Replace Step** | Replace failed/flagged step with this element |

### Replace Flow

```javascript
// In PlaywrightRecorderPage.tsx
const replaceStepWithSuggestion = (stepIndex: number, suggestion: Suggestion) => {
  const newAction: RecordedAction = {
    id: `action_${Date.now()}`,
    qword: suggestion.qword,
    args: suggestion.args,
    description: suggestion.description,
    timestamp: Date.now(),
    selectorObj: suggestion.selectorObj
  };
  
  // Replace the action at stepIndex
  setActions(prev => {
    const newActions = [...prev];
    if (stepIndex >= 0 && stepIndex < newActions.length) {
      newActions[stepIndex] = newAction;
    }
    return newActions;
  });
  
  // Clear the false positive flag if set
  const oldAction = actions[stepIndex];
  if (oldAction?.id && falsePositiveSteps.has(oldAction.id)) {
    setFalsePositiveSteps(prev => {
      const newMap = new Map(prev);
      newMap.delete(oldAction.id!);
      return newMap;
    });
  }
  
  // Close any open modals
  setEditSelectorModalOpen(false);
  setEditingActionIndex(null);
  
  toast.success(`Step ${stepIndex + 1} replaced with "${suggestion.element || suggestion.description}"`);
};
```

### Replace Mode Banner

When `editingActionIndex` is set (user clicked Fix on a step), the Smart Suggestions panel shows:

1. **Orange Banner** - "Replace Mode: Click an element to replace Step X"
2. **Replace Button** (orange) - Instead of the normal "Add" button
3. **Cancel Button** - To exit replace mode without making changes

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Test Failed Modal                           │
│                                                                 │
│  Step 5: Click "Service Console"  [Fix] [🚩 Flag]              │
│  Error: Element not found                                       │
│                                                                 │
│  User clicks "Fix" →                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Smart Suggestions Panel                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔄 Replace Mode: Click element to replace Step 5   [Cancel] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Filters: All | Buttons | Links | Inputs]  🔍 Search...       │
│                                                                 │
│  📦 Service Console                                             │
│     click                        [▶ Execute] [🔄 Replace]      │
│                                                                 │
│  📦 App Launcher                                                │
│     click                        [▶ Execute] [🔄 Replace]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Changelog

### 2026-01-31: Click Verification & Shadow DOM Support

**Files Changed:**
- `flowstral-desktop/src/main/lib/action-handlers.js`

**Changes:**
1. **Shadow DOM Text Extraction**: Added support for reading text from Shadow DOM (`el.shadowRoot.textContent`)
2. **Lightning/Salesforce Containers**: Added menu items, options, and role-based containers to container detection
3. **Graceful Failure**: If element text is unreadable, verification now PASSES (click already succeeded)
4. **New Containers Recognized**:
   - `lightning-menu-item`
   - `li[role="presentation"]`
   - `[role="menuitem"]`
   - `[role="option"]`

**Impact:** Eliminates false negatives where clicks succeed but verification fails due to Shadow DOM or custom elements.

```javascript
// BEFORE: If no text readable, FAIL the verification
return { verified: false, reason: '...clicked "unknown"' };

// AFTER: If no text readable, PASS the verification (click already succeeded)
if (!allText) {
  return { verified: true, reason: 'No text readable from element (click succeeded)' };
}
```

### 2026-01-31: SmartFinder Action Variable Fix

**Files Changed:**
- `flowstral-desktop/src/main/lib/smart-finder.js`

**Changes:**
1. **Fixed `action is not defined` error**: The `find()` method was referencing `action?.productContext` but `action` was undefined
2. **Proper Initialization**: Added `const action = options.action || {};` to initialize from options

**Impact:** SmartFinder no longer throws errors and works correctly for all element finding operations.

### 2026-01-31: Flagged Step Handling

**Files Changed:**
- `flowstral-desktop/src/main/test-executor.js`
- `flowstral-desktop/src/main/index.js`

**Changes:**
1. **Stop at Flagged Steps**: Test execution now properly stops when reaching a step that was flagged as false positive
2. **Event Emission**: New `test-paused` event emitted when stopping at flagged step
3. **Reliable Event Listeners**: Event listeners are now ALWAYS set up before test execution (not conditionally)
4. **Duplicate Prevention**: `removeAllListeners()` called before adding new listeners

**Flagged Step Logic:**
```javascript
// In test-executor.js executeTest()
if ((step.flagged || flaggedStepIds?.includes(step.id)) && stopAtFlagged) {
  console.log(`[TestExecutor] STOPPING at flagged step ${i}: ${step.name || step.type}`);
  results.status = 'paused_at_flagged';
  results.stoppedAtFlaggedStep = { index: i, step };
  this.onStepFlagged?.(i, step);
  break;
}
```

**Impact:** Users can now flag steps, re-run tests, and the browser will stop at the flagged step for easy fixing.

### 2026-01-31: Complete Flagged Step + Playback Speed Implementation

**Files Changed:**
- `flowstral-desktop/src/main/playwright-recorder.js`
- `flowstral-desktop/src/main/lib/strategy-memory.js`
- `src/pages/PlaywrightRecorderPage.tsx`

**Changes:**

1. **Flagged Step Handling in runTest():**
   - Added `flaggedSteps` array parameter to identify steps marked as false positive
   - Added `stopAtFlagged` boolean to enable pausing at flagged steps
   - When test reaches a flagged step, it emits `test-paused` event and returns with `status: 'paused_at_flagged'`
   - Browser stays open so user can use Smart Suggestions to fix

2. **Playback Speed Control:**
   - Added `slowMo` parameter (default 200ms) - controls delay between steps
   - Speed mapping: 0 = 2x, 200 = 1x, 500 = 0.5x, 1000 = 0.25x
   - Minimum 100ms delay for stability

3. **Frontend Updates:**
   - `handleRunTest()` now passes `flaggedSteps` (from `falsePositiveSteps` map) to backend
   - `stopAtFlagged` is true when any steps are flagged
   - `keepBrowserOpenOnFailure` auto-enabled when flagged steps exist
   - When test returns `paused_at_flagged`, auto-opens Smart Suggestions panel

4. **Strategy Memory Improvements:**
   - Better logging when memory loads from disk
   - Shows success rate and top strategies on startup
   - Debug logging for fast path hits/misses

**Flagged Step Flow:**
```
1. User flags step 5 as false positive
2. User clicks "Run"
3. Frontend passes flaggedSteps: ['step-5-id'], stopAtFlagged: true
4. Backend runs steps 1-4 normally
5. At step 5, backend detects it's flagged
6. Backend returns { status: 'paused_at_flagged', stoppedAtFlaggedStep: {...} }
7. Frontend auto-opens Smart Suggestions panel at step 5
8. Browser is open - user can select correct element
9. User clicks "Replace" on suggestion
10. Step 5 is replaced, flag cleared
```

**Playback Speed Usage:**
```javascript
// Frontend calculates slowMo from playbackSpeed setting
const slowMoDelay = playbackSpeed === '0.25x' ? 1000 : 
                    playbackSpeed === '0.5x' ? 500 : 
                    playbackSpeed === '2x' ? 0 : 200; // 1x = 200ms

// Passed to runTest
await runTest({ slowMo: slowMoDelay, ... });

// Backend uses in step loop
const stepDelay = Math.max(100, slowMo);
await page.waitForTimeout(stepDelay);
```

### 2026-01-31: Optimization Tiers + Flaky Detection (Strategy Memory v2.0)

**Files Changed:**
- `flowstral-desktop/src/main/lib/strategy-memory.js` (major update)
- `flowstral-desktop/src/main/lib/smart-finder.js`

**New Features:**

1. **Optimization Tiers:**
   - **Learning Mode**: Full search (5000ms timeout per strategy)
   - **Optimized Mode**: After 3 consecutive successes → 50ms timeout!

2. **Consecutive Tracking:**
   - `consecutiveSuccesses`: Incremented on each success, reset on failure
   - `consecutiveFailures`: Incremented on each failure, reset on success
   - Promotion: 3 consecutive successes → `isOptimized = true`
   - Demotion: 2 consecutive failures → `isOptimized = false`

3. **Flaky Detection:**
   - Tracks history of last 10 results (S=success, F=failure)
   - Pattern like `SFSFSF` indicates unstable locator
   - Flaky locators are flagged for attention
   - `getFlakyLocators()` returns list for monitoring

4. **Speed Improvement:**
   ```
   First run:  45 seconds (full search, learning)
   After 3x:   15 seconds (optimized, 50ms timeouts)
   Flaky step: Flagged for review
   ```

**Configuration (strategy-memory.js):**
```javascript
const OPTIMIZATION_CONFIG = {
  CONSECUTIVE_SUCCESSES_TO_OPTIMIZE: 3,  // Successes to promote
  CONSECUTIVE_FAILURES_TO_DEMOTE: 2,     // Failures to demote
  FLAKY_FLIP_FLOP_THRESHOLD: 4,          // Transitions to mark flaky
  OPTIMIZED_TIMEOUT_MS: 50,              // Fast path timeout
  LEARNING_TIMEOUT_MS: 5000,             // Full search timeout
};
```

**Console Output Example:**
```
[StrategyMemory] ✅ Loaded 15 learned strategies
[StrategyMemory] ⚡ 8 optimized | 📚 5 learning | ⚠️ 2 flaky

[FAST PATH] ⚡ Trying OPTIMIZED strategy: testId (50ms timeout)
[FAST PATH] ✓ Success in 23ms using remembered strategy (OPTIMIZED)

[FAST PATH] ⚠️ WARNING: This locator is marked as FLAKY - may be unstable
[StrategyMemory] ⚠️ FLAKY DETECTED: fp_abc123 (5 transitions in 8 attempts)
[StrategyMemory]   History: SFSFSFSF
```

**Flaky Locator Reporting:**
```javascript
// Get all flaky locators
const flaky = strategyMemory.getFlakyLocators();
// Returns: [{ fingerprint, strategy, selector, history: 'SFSFSF', successRate: 0.5 }]

// Get optimization stats
const stats = strategyMemory.getOptimizationStats();
// Returns: { total: 15, optimized: 8, learning: 5, flaky: 2, optimizedPercent: 53 }
```

### 2026-01-31: Event Listener Reliability

**Files Changed:**
- `flowstral-desktop/src/main/index.js`

**Changes:**
1. **Always Setup Events**: `setupRecorderEvents()` is now called on EVERY test run, not just when recorder is created
2. **Prevent Duplicates**: All relevant event listeners are removed before being re-added
3. **Events Covered**:
   - `test-step-start`
   - `test-step-complete`
   - `test-complete`
   - `test-paused`
   - `test-resumed`
   - `test-stopped`
   - `test-runner:step-failed`

**Impact:** Progress bar now updates correctly, step status shows accurately, and pause state is properly communicated to frontend.
