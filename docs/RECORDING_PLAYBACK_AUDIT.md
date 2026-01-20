# Recording & Playback System Audit

**Date**: January 19, 2026  
**Auditor**: AI Code Review  
**Scope**: Full trace of recording and playback code paths

---

## Executive Summary

This audit identifies **18 potential issues** in the recording and playback system, categorized by severity. The most critical issue is the **complete absence of hover event recording**, which causes flyout navigation menus to fail during playback.

---

## 📍 Execution Paths Overview

There are **3 main execution paths** for running tests. These MUST be kept in sync!

### Path 1: PlaywrightRecorder (During Recording)
- **File**: `flowstral-desktop/src/main/playwright-recorder.js`
- **Method**: `runTest()`, `executeAction()`
- **Called From**: `PlaywrightRecorderPage.tsx` → `electronAPI.runTest()`
- **Status**: ✅ **FULLY UPDATED** - Uses SmartFinder, hover support, landmark scoping

### Path 2: TestExecutor (From Builder & Tests Tab)
- **File**: `flowstral-desktop/src/main/test-executor.js`
- **Method**: `executeTest()`, action switch cases
- **Called From**: 
  - `UnifiedWorkflowEditor.tsx` → `api.testRunner.executeTest()`
  - `TestRepository.tsx` → `electronAPI.testRunner.executeTest()`
  - `TestCases.tsx` → `electronAPI.runTest()`
- **Status**: ✅ **UPDATED** - Uses SmartFinder for ClickText/Hover, has AI fallback

### Path 3: Backend TestExecutionService (API-based)
- **File**: `backend/app/services/automation/test_execution_service.py`
- **Method**: `execute_test()` - generates Playwright code, runs via subprocess
- **Called From**: Backend API endpoints (`/run-test-case`, `/automation/execute-test`)
- **Status**: ⚠️ **LIMITED** - Generates standalone scripts, no SmartFinder
- **Note**: This path generates portable Playwright scripts that can run independently. It uses enhanced selectors with fallbacks but not SmartFinder.

### Synchronization Status

| Feature | PlaywrightRecorder | TestExecutor | Backend |
|---------|-------------------|--------------|---------|
| SmartFinder | ✅ | ✅ | ❌ (generates code) |
| Hover support | ✅ | ✅ (via ActionHandlers) | ⚠️ (basic) |
| AI Fallback | ✅ | ✅ | ❌ |
| Landmark scoping | ✅ | ✅ | ❌ |
| Multi-selector fallback | ✅ | ✅ | ✅ |
| Tab switching | ✅ | ✅ | ⚠️ |
| **Shared ActionHandlers** | ✅ | ✅ (Jan 2026) | ❌ |

### Unified Execution via ActionHandlers

As of January 2026, `test-executor.js` now uses the shared `lib/action-handlers.js` module for critical actions like Hover. This ensures:

1. **Same element finding logic** - SmartFinder with recipe-based identification
2. **Same fallback strategies** - Selector fallbacks → AI Vision fallback
3. **Same timing** - Wait after hover for flyout menus (300ms)

```javascript
// test-executor.js now uses:
const ActionHandlers = require('./lib/action-handlers');

// Hover action delegates to shared handler:
case 'Hover':
  const result = await ActionHandlers.handleHover(this, action, { timeout });
  break;
```

The shared `action-handlers.js` module implements the `findElementWithRetry` interface that both executors provide.

---

## 🔴 CRITICAL ISSUES (Blocking)

### Issue #1: NO HOVER EVENT RECORDING

**Location**: `recipe-recorder-integration.js`  
**Impact**: Flyout menus never open during playback  
**Status**: ✅ FIXED (Jan 19, 2026)

**Problem**: The recorder has NO event listener for `mouseenter`, `mouseover`, or hover events. When a user hovers over a navigation item to reveal a flyout menu, then clicks a menu item, only the click is recorded. During playback, the hover never happens, the menu never opens, and the click fails.

**Evidence**: 
```bash
grep -i "mouseenter\|mouseover\|hover" recipe-recorder-integration.js
# No matches found
```

**Fix Required**:
```javascript
// Add to recipe-recorder-integration.js
document.addEventListener('mouseenter', function(e) {
  var el = e.target;
  
  // Only record hovers that reveal hidden elements
  if (el.hasAttribute('aria-haspopup') || 
      el.matches('[class*="flyout"], [class*="dropdown"], [class*="menu"]')) {
    var recipe = analyzer.analyze(el);
    recordAction({
      type: 'hover',
      target: recipe,
      description: 'Hover over "' + (recipe.what.text || el.tagName) + '"'
    });
  }
}, true);
```

---

### Issue #2: Action Ordering - Navigate Appears Before Click

**Location**: `playwright-recorder.js` line 1235  
**Impact**: Recorded steps appear jumbled  
**Status**: 🟡 PARTIALLY FIXED

**Problem**: The `framenavigated` event fires asynchronously AFTER the click that caused navigation. Since actions are pushed in event order (not timestamp order), the Navigate action can appear before the click that caused it in the recorded list.

**Root Cause**:
- Click event → timestamp T1
- Browser starts navigation
- framenavigated event → timestamp T2 (T2 > T1)
- But Navigate action is processed and shown to user AFTER click in UI

**Current Mitigation**: `_shouldRecordNavigation` suppresses navigations if a recent link click exists, but doesn't fix ordering.

**Fix Required**: Post-process actions array to sort by timestamp before displaying/saving.

---

### Issue #3: SmartFinder text-contains Fallback Too Loose

**Location**: `smart-finder.js` line 493-500  
**Impact**: Clicks wrong element during playback  
**Status**: ✅ FIXED (Jan 19, 2026) - Now uses `scope` and validates role

**Problem**: Phase 8's text-contains strategy uses:
```javascript
const locator = this.page.getByText(what.text).first();
```

This searches the ENTIRE page for the first text match, ignoring any landmark or region context. If recorded "Click Residential Customers" with landmark="main", this will find "Residential Customers" in the nav instead.

**Fix Required**:
```javascript
// Should scope to landmark if available
if (what?.text) {
  let searchScope = scope; // scope may already be narrowed by landmark
  const result = await this.tryStrategy('text-contains-scoped', async () => {
    const locator = searchScope.getByText(what.text).first();
    return await this.validateLocator(locator, 'text-contains-scoped');
  }, attempts);
  
  if (result.success) return result.locator;
}
```

---

### Issue #4: No Wait for Dropdown Options During Playback

**Location**: `playwright-recorder.js` Select action handler  
**Impact**: Select actions fail intermittently  
**Status**: 🔴 UNFIXED

**Problem**: When playing back a Select action:
1. Click dropdown trigger
2. Immediately try to click option

The dropdown menu may not have rendered yet (React/Vue transition). The option click fails with "element not found".

**Fix Required**:
```javascript
// After clicking trigger, wait for dropdown to appear
await this.page.waitForSelector('[role="listbox"], [role="menu"]', { 
  state: 'visible', 
  timeout: 3000 
}).catch(() => {});
```

---

## 🟠 HIGH PRIORITY ISSUES

### Issue #5: getByLabel Can Match Non-Input Elements

**Location**: `smart-finder.js` line 404-410  
**Impact**: Fill actions target wrong elements  
**Status**: ✅ FIXED (Jan 19, 2026) - Validates element is actually a form input

**Problem**:
```javascript
if (where?.nearText) {
  const locator = scope.getByLabel(where.nearText);
  // ...
}
```

`getByLabel('account')` can match a `<nav>` element that contains "Account" text, not just actual form labels. This caused the Fill "account" to try to fill a navigation element.

**Fix Required**: Add validation that matched element is actually an input/textarea:
```javascript
const labelResult = await this.tryStrategy('label', async () => {
  const locator = scope.getByLabel(where.nearText);
  const result = await this.validateLocator(locator, 'label');
  
  // Extra validation: must be fillable
  if (result.success) {
    const isFillable = await result.locator.evaluate(el => {
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }).catch(() => false);
    
    if (!isFillable) return { success: false, count: 0 };
  }
  return result;
}, attempts);
```

---

### Issue #6: Recipe → Legacy Conversion Loses Landmark

**Location**: `recipe-recorder-integration.js` `recipeActionToLegacy()`  
**Impact**: Playback loses WHERE context  
**Status**: ✅ FIXED (Jan 19, 2026) - Preserves `landmark` and `region`

**Problem**: The conversion function doesn't preserve `where.landmark`:
```javascript
// Current code
return {
  // ... missing:
  // landmark: target?.where?.landmark,
};
```

Without landmark, SmartFinder can't scope searches to "main" vs "nav" vs "aside".

**Fix Required**:
```javascript
return {
  // ... existing fields ...
  landmark: target?.where?.landmark || null,
  region: target?.where?.region || null,
};
```

---

### Issue #7: ActionCoalescer Can Swallow Actions

**Location**: `action-coalescer.js` line 106-112  
**Impact**: Click not recorded  
**Status**: 🟡 PARTIALLY MITIGATED

**Problem**: When `isDropdownTrigger()` returns true:
```javascript
if (this.isDropdownTrigger(action)) {
  this.startPending(action, 'dropdown');
  return null; // Wait for option click - BUT WHAT IF IT NEVER COMES?
}
```

If user clicks a button that looks like a dropdown trigger but then navigates away without selecting an option, the click may be held pending indefinitely or flushed very late.

**Current Mitigation**: 5-second timeout, but action arrives late in recording.

**Fix Required**: Don't return null immediately; use a shorter timeout (1-2s) and if no option comes, record the original click.

---

### Issue #8: Timestamp-Based Deduplication Window Too Wide

**Location**: `playwright-recorder.js` line 2710-2717  
**Impact**: Legitimate repeated clicks may be deduplicated  
**Status**: 🟡 MONITOR

**Problem**:
```javascript
const roundedTimestamp = Math.floor(click.timestamp / 50) * 50;
const clickId = `cdp_${roundedTimestamp}_${normalizedDesc}`;
```

50ms window + normalized description means two intentional clicks 40ms apart on the same button get deduplicated.

**Recommendation**: Keep 50ms but add coordinate check - same element at same position is duplicate, different position is intentional.

---

### Issue #9: Cross-Origin Tab Detection Loses Element Info

**Location**: `playwright-recorder.js` line 2396-2400  
**Impact**: Actions recorded without proper selectors  
**Status**: 🟡 DESIGN LIMITATION

**Problem**: For cross-origin pages, `page.evaluate()` fails. Fallback uses `pendingClicks` from main process, but these may lack the rich element recipe data.

**Current Mitigation**: CDP-level capture provides basic element info.

**Recommendation**: Document this limitation; recommend same-origin testing when possible.

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue #10: Input Label Extraction Inconsistent

**Location**: `playwright-recorder.js` `_processInputs()`  
**Impact**: Fill actions may have wrong labels  
**Status**: 🟢 FIXED in recent session

**Problem**: `associatedLabel` is captured in DOM but wasn't being used.

**Current Status**: Fixed to use `inp.associatedLabel` as label fallback.

---

### Issue #11: No Re-injection After Cross-Origin Redirect

**Location**: `playwright-recorder.js` framenavigated handler  
**Impact**: Actions not recorded after redirect  
**Status**: 🟡 NEEDS VERIFICATION

**Problem**: If page A redirects to cross-origin page B, script re-injection may fail silently, and no actions are captured on page B.

**Current Mitigation**: Main process CDP capture as fallback.

---

### Issue #12: Frame Context Not Used in Playback

**Location**: `playwright-recorder.js` `executeAction()`  
**Impact**: Elements in iframes not found  
**Status**: 🟡 PARTIAL

**Problem**: `frameContext` is recorded but not consistently used to scope element finding to the correct iframe first.

**Recommendation**: Before searching main page, check if `action.frameContext` exists and search that frame first.

---

### Issue #13: Dropdown Option Click Timing

**Location**: Playback Select handler  
**Impact**: Intermittent failures  
**Status**: 🔴 UNFIXED (same as Issue #4)

During playback of dropdown selections, need to:
1. Click trigger
2. WAIT for dropdown to appear
3. Click option

Currently step 2 is missing or insufficient.

---

### Issue #14: Autocomplete Interference

**Location**: Fill action handler  
**Impact**: Wrong value submitted  
**Status**: 🟡 DESIGN LIMITATION

**Problem**: Browser autocomplete can fill a different value than recorded. The fill action types the value, but autocomplete overwrites it.

**Recommendation**: Before fill, set `autocomplete="off"` or clear the field twice.

---

### Issue #15: Element Visibility Single Check

**Location**: `smart-finder.js` `validateLocator()`  
**Impact**: Click blocked by overlay  
**Status**: 🟡 EDGE CASE

**Problem**: Visibility is checked once, but an overlay (cookie banner, tooltip) may appear between check and click.

**Recommendation**: Add retry with overlay dismissal if click fails.

---

## 🟢 LOW PRIORITY ISSUES

### Issue #16: Password Manager Interference

Similar to autocomplete - password managers can fill credentials differently.

### Issue #17: JavaScript Animation Wait

`waitForPageStability` checks CSS animations but not JS-driven animations.

### Issue #18: Limited Keyboard Shortcut Capture

Only Enter and Escape are captured. Ctrl+S, Ctrl+Z etc. are not recorded.

---

## Recommended Fix Priority

1. **Issue #1** (CRITICAL): Add hover recording - THIS IS WHY FLYOUT MENUS FAIL
2. **Issue #4**: Add wait for dropdown options
3. **Issue #5**: Validate getByLabel matches actual inputs
4. **Issue #3**: Scope text-contains to landmark
5. **Issue #6**: Preserve landmark in recipe conversion
6. **Issue #2**: Sort actions by timestamp before save
7. **Issue #7**: Shorter coalescer timeout with immediate fallback

---

## Test Cases to Add

1. **Flyout Menu Test**: Hover over nav item → click submenu item
2. **Same Text Different Areas Test**: Button "Submit" in main vs. link "Submit" in footer
3. **Rapid Dropdown Test**: Click dropdown → immediately click option
4. **Cross-Origin Redirect Test**: Login flow that redirects to different domain
5. **Overlay Interference Test**: Cookie banner appearing mid-recording

---

## Architecture Recommendations

1. **Action Queue with Timestamp Sorting**: Don't push directly to array; use priority queue sorted by timestamp
2. **Strategy Telemetry**: Log which SmartFinder strategy succeeded/failed for each action
3. **Retry Budget**: Implement per-action retry budget instead of global retry
4. **Visual Diff on Failure**: Screenshot before/after failed action for debugging
