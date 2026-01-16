# Recording & Playback Bug Fixes - Post-Mortem Analysis

**Date**: January 15, 2026  
**Scope**: Comprehensive review of recording/playback system against Test Playground  
**Status**: ✅ Fixed  
**Related**: See `TEST-PLAYGROUND-CAPABILITY-MATRIX.md` for full feature support

---

## Executive Summary

A systematic SDET-style review of the recording and playback code against the Test Playground revealed **6 critical bugs** that caused test failures. The root cause analysis shows that the "first principles" approach of the Recipe system was architecturally sound, but **implementation gaps** in data flow between recording → storage → playback created failures.

---

## Why First Principles Approach Failed

### The Original Design (Sound)

```
Recording Phase:
ElementAnalyzer.analyze() → Creates rich Recipe {what, where, which}
                          → Includes role, text, position, testId

Playback Phase:
SmartFinder.find() → Uses Recipe to locate elements
                  → 8-phase fallback strategy
```

### What Actually Happened (Broken Data Flow)

```
Recording Phase:
ElementAnalyzer.analyze() → Recipe created ✅
recipeActionToLegacy()    → Converts to legacy format ✅
                          → element.role saved ✅

Storage Phase:
Test saved to file        → Data preserved ✅

Playback Phase:
Test loaded from file     → Data available ✅
runTest() creates action  → ❌ MISSING: element, selectorObj, recipe
legacyActionToRecipe()    → ❌ Can't find role (wasn't passed)
SmartFinder.find()        → ❌ No role = wrong search strategy
```

### The Gap

The **action object construction** in `runTest()` only copied basic fields:
```javascript
// BEFORE (broken)
const action = {
  type, label, text, value, selector, args
  // MISSING: element, selectorObj, recipe, elementIndex!
};
```

The `legacyActionToRecipe()` function needed these fields to reconstruct the search recipe:
```javascript
// legacyActionToRecipe needs:
const element = legacyAction.element || {};  // Was always {}
const selectorObj = legacyAction.selectorObj || {};  // Was always {}
role = element.role;  // Was always undefined!
```

---

## All Bugs Found & Fixed

### Bug #1: Tab Accessibility Name Mismatch

| Property | Value |
|----------|-------|
| **Symptom** | "Click Tables" failed - element not found |
| **Root Cause** | Radix UI renders "Tables" visually but accessibility name is "Table" |
| **Fix** | Added `role+text-singular` strategy in SmartFinder that strips trailing 's' for tabs |
| **File** | `flowstral-desktop/src/main/lib/smart-finder.js` |

```javascript
// NEW: Try without trailing 's' for Radix tabs
if (what.role === 'tab' && what.text.endsWith('s')) {
  const singularText = what.text.slice(0, -1);
  const locator = scope.getByRole(what.role, { name: singularText });
  // ...
}
```

### Bug #2: Action Missing Element Data

| Property | Value |
|----------|-------|
| **Symptom** | SmartFinder couldn't find elements by role |
| **Root Cause** | `runTest()` didn't pass element/selectorObj/recipe to action |
| **Fix** | Added missing fields to action object |
| **File** | `flowstral-desktop/src/main/playwright-recorder.js` (2 locations) |

```javascript
// AFTER (fixed)
const action = {
  type, label, text, value, selector, args,
  element: step.element || {},
  selectorObj: step.selectorObj || step.selector || {},
  recipe: step.recipe || step.target || null,
  elementIndex: step.elementIndex ?? step.args?.[1] ?? null
};
```

### Bug #3: Label Text Not Extracted

| Property | Value |
|----------|-------|
| **Symptom** | SmartFinder searched for `"Click \"Tables\""` instead of `"Tables"` |
| **Root Cause** | `legacyActionToRecipe` used full description as search text |
| **Fix** | Added `extractTextFromLabel()` helper |
| **File** | `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` |

```javascript
function extractTextFromLabel(label) {
  // 'Click "Tables"' → 'Tables'
  const match = label.match(/(?:Click|Fill|Select|Check|Uncheck)\s*"([^"]+)"/i);
  return match ? match[1] : null;
}
```

### Bug #4: Page Stability Issues

| Property | Value |
|----------|-------|
| **Symptom** | "Target page, context or browser has been closed" errors |
| **Root Cause** | Tests started before page fully loaded |
| **Fix** | Added page stability wait and validity checks |
| **File** | `flowstral-desktop/src/main/playwright-recorder.js` |

```javascript
// Wait for page stability before executing steps
await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
await this.page.waitForTimeout(500);

// Check page validity before each step
if (!this.page || this.page.isClosed()) {
  // Stop execution
}
```

### Bug #5: Duplicate Element Position Detection

| Property | Value |
|----------|-------|
| **Symptom** | Wrong "Add to Cart" button clicked |
| **Root Cause** | `getPositionAmongSiblings()` only checked immediate siblings, not all matching elements |
| **Fix** | Added `getGlobalPosition()` for elements with same text across page |
| **File** | `flowstral-desktop/src/main/lib/element-recipe.js` |

```javascript
// NEW: Get position among ALL matching elements on page
getGlobalPosition: function(element) {
  var role = this.getRole(element);
  var text = this.getVisibleText(element);
  // Find all elements with same role+text...
  return { position: j + 1, total: allMatching.length };
}
```

### Bug #6: Radix Dropdown Recording

| Property | Value |
|----------|-------|
| **Symptom** | Shipping dropdown not recorded |
| **Root Cause** | Radix uses `pointerdown` for triggers, not `click` |
| **Fix** | Added `pointerdown` handler that sets `pendingTrigger` for Radix triggers |
| **File** | `flowstral-desktop/src/main/lib/recipe-recorder-integration.js` |

---

## Files Modified

| File | Changes |
|------|---------|
| `playwright-recorder.js` | Action object construction, page stability, validity checks |
| `smart-finder.js` | Tab text singular fallback, regex matching |
| `element-recipe.js` | Global position detection for duplicates |
| `recipe-recorder-integration.js` | Text extraction, pointerdown handling |

---

## Test Playground Element Coverage

| Element Type | Count | Status | Notes |
|--------------|-------|--------|-------|
| Tabs (Radix) | 10 | ✅ Fixed | Singular/plural name handling |
| Radix Select | 8 | ✅ Fixed | Pointerdown + option coalescing |
| "Add to Cart" buttons | 8 | ✅ Fixed | Global position detection |
| Text inputs | 15+ | ✅ Working | Label-based finding |
| Checkboxes | 10+ | ✅ Working | Change handler |
| Sliders | 4 | ⚠️ Limited | Use fill() with numeric value |
| iFrame content | 2 | ✅ Fixed | **NEW**: frameContext + _getFrameScope() |
| Modals | 1 | ✅ Working | Dynamic content handled |
| Alerts | 3 | ✅ Fixed | **NEW**: Auto-accept via dialog handler |
| Drag & Drop | 4 items | ✅ Fixed | **NEW**: dragDrop action type |
| Downloads | 4 | ✅ Fixed | **NEW**: download wait handler |
| New Tab/Popup | 3 | ✅ Fixed | **NEW**: newTab + switchTab handlers |
| File Upload | Code | ✅ Ready | **NEW**: upload action type |

---

## Lessons Learned

### 1. Data Flow Verification
Always trace data from recording → storage → loading → playback. A break anywhere causes failures.

### 2. Accessibility vs Visual Text
Modern UI frameworks (Radix, Shadcn) often have different accessibility names than visual text. Test both.

### 3. Event Types Matter
Radix uses `pointerdown`, not `click`. Custom components may use non-standard events.

### 4. Sibling vs Global Position
Elements with the same text may be in different DOM subtrees. Global matching is required.

### 5. Page State
Always wait for page stability and check if page is still valid before each action.

---

## Recommended Testing Workflow

1. **Record** on Test Playground with all tab types
2. **Verify** steps show correct element text and positions
3. **Run** test and check console for SmartFinder strategies
4. **Debug** by looking at `Recipe for SmartFinder:` logs

---

## Playwright Auto-Wait Behavior

### What Playwright Handles Automatically

Playwright has built-in "actionability checks" that wait automatically before performing actions:

| Action | Auto-Waits For |
|--------|----------------|
| `click()` | Visible, stable, enabled, not obscured |
| `fill()` | Visible, enabled, editable |
| `check()` | Visible, enabled, not already checked |
| `selectOption()` | Visible, enabled |

### What We Add On Top

| Wait Type | Purpose | Why Needed |
|-----------|---------|------------|
| `domcontentloaded` | Initial page load | SPA frameworks render after load |
| 300ms stability pause | Let animations settle | Radix transitions |
| Page closed check | Avoid stale locators | Browser may close unexpectedly |

### Why NOT `networkidle`?

```javascript
// ❌ BAD - Breaks Salesforce and SPAs with polling
await page.waitForLoadState('networkidle');

// ✅ GOOD - Fast and works everywhere
await page.waitForLoadState('domcontentloaded');
```

`networkidle` waits for network to be idle for 500ms, but:
- Salesforce has continuous heartbeat requests
- Analytics scripts poll periodically
- WebSocket connections stay active

---

## New Features Added (January 15, 2026)

### 1. iFrame Support

**Recording**: Detects iframe context and stores in action
```javascript
function getFrameContext() {
  if (window === window.top) return null;
  return {
    isIframe: true,
    id: frame.id,
    name: frame.name,
    testId: frame.getAttribute('data-testid')
  };
}
```

**Playback**: Switches to iframe before finding element
```javascript
async _getFrameScope(action) {
  const frameInfo = action.frameContext;
  if (!frameInfo) return this.page;
  return this.page.frameLocator(`#${frameInfo.id}`);
}
```

### 2. Drag and Drop Support

**Recording**: Captures drag source, drop target, and coordinates
```javascript
recordAction({
  type: 'dragDrop',
  target: sourceRecipe,
  dropTarget: targetRecipe,
  value: { startX, startY, endX, endY }
});
```

**Playback**: Uses Playwright's dragTo()
```javascript
await sourceLocator.dragTo(dropLocator);
```

### 3. Alert/Dialog Handling

**Recording**: Captures dialog type and message
```javascript
this.page.on('dialog', async (dialog) => {
  this._addAction({
    type: 'dialog',
    dialogType: dialog.type(),
    message: dialog.message()
  });
  await dialog.accept();
});
```

**Playback**: Auto-accepts dialogs (configurable per step later)

### 4. New Tab/Popup Handling

**Recording**: Logs new tabs opened via window.open
```javascript
this.context.on('page', (newPage) => {
  this._addAction({
    type: 'newTab',
    url: newPage.url()
  });
});
```

**Playback**: Can switch tabs by index or URL
```javascript
case 'switchTab':
  const pages = this.context.pages();
  this.page = pages[action.tabIndex];
  await this.page.bringToFront();
```

### 5. Download Verification

**Playback**: Waits for download to complete
```javascript
case 'download':
  const download = await this.page.waitForEvent('download');
  if (expectedFilename && !download.suggestedFilename().includes(expectedFilename)) {
    return { success: false, error: 'Filename mismatch' };
  }
```

### 6. File Upload Support

**Recording**: Captures file names selected
```javascript
recordAction({
  type: 'upload',
  target: recipe,
  value: { files: ['file1.pdf', 'file2.jpg'] }
});
```

**Playback**: Uses setInputFiles()
```javascript
await fileInput.setInputFiles(filePaths);
```

---

## Completed Improvements

- [x] ~~Add iframe context switching for playback~~ ✅ Done
- [x] ~~Improve drag & drop support~~ ✅ Done
- [x] ~~Add new tab/popup context switching~~ ✅ Done
- [x] ~~Add alert/dialog handling~~ ✅ Done
- [x] ~~Add download verification~~ ✅ Done
- [x] ~~Add file upload support~~ ✅ Done
- [ ] Enhance slider/range input recording (limited support)
- [ ] Multi-select dropdown (native HTML only)

---

## AI Goal Agent Fixes (January 16, 2026)

### Issue: Goal Agent Stopping Immediately

**Symptoms**: Clicking "Execute Goal" resulted in immediate stop with no visible action.

**Root Causes Found**:

1. **Missing IPC Event Channels in Preload**
   - The `webapp-preload.js` has a whitelist of valid event channels
   - `goal-agent-step`, `goal-agent-progress`, `goal-agent-complete`, `goal-agent-error` were NOT in the list
   - Frontend listeners silently failed to register

2. **Wrong Event Handler Signature**
   ```javascript
   // WRONG - preload strips the event object
   const handleGoalStep = (_: any, data: any) => { ... }
   
   // CORRECT - only data is passed
   const handleGoalStep = (data: any) => { ... }
   ```

3. **No Browser Available**
   - Goal Agent required an active recording session
   - If user stopped recording, browser was closed
   - No auto-launch mechanism existed

### Fixes Applied

| File | Fix |
|------|-----|
| `webapp-preload.js` | Added goal-agent-* to validChannels whitelist |
| `AIFlowExplorer.tsx` | Fixed handleGoalStep signature from `(_, data)` to `(data)` |
| `index.js` | Added auto-launch browser if no active session |
| `ai-goal-agent.js` | Added extensive console.log debugging |
| `AIFlowExplorer.tsx` | Added frontend logging for IPC calls |

### Goal Agent v3.0 Architecture

The Goal Agent was rewritten to a "plan first, execute fast" model:

```
1. Deep Page Analysis (local)
   └── Scans all products, buttons, dropdowns, cart state
   
2. Smart Planning (ONE API call)
   └── GPT-4o creates complete action plan based on analysis
   
3. Fast Local Execution (NO API calls)
   └── Playwright executes each planned action
   └── Uses smart locators for Radix, Shadow DOM, modals
   └── Tracks state (cart items, visited pages)
```

**Benefits**:
- Much faster (1 API call vs N calls)
- More reliable (full context in single planning call)
- Cheaper (minimal API usage)
- Better memory (tracks session state)
