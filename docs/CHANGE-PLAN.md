# Change Plan: Two Critical Issues

## Issue 1: Fills Filtered Out in New Tabs
## Issue 2: Playback Timing Unchanged (SimplePlayback Never Activated)

---

# Issue 1: Fills Filtered Out in New Tabs

## Problem
Fill actions (text input recordings) are being lost/filtered out when recording in new tabs. The user types values into fields on a new tab but the fill actions don't appear in the recorded steps.

### How to Reproduce
1. Start recording
2. Click something that opens a new tab
3. On the new tab, fill in text fields (e.g., "dollar value", "name")
4. Expected: Fill actions appear in recorded steps
5. Actual: Fill actions are missing

## Root Cause Analysis

### The Recording Pipeline for Fills

Two parallel capture systems BOTH capture fills:

1. **Recipe Recorder** (injected via `context.addInitScript`):
   - Listens to `document.addEventListener('input')` in `recipe-recorder-integration.js` line 826
   - Has a **1500ms debounce** before flushing fills to `window.__flowstralRecipeActions`
   - Also flushes on `blur` (line 848) and `change` events (line 857)
   - Only captures `<input>` and `<textarea>` elements (line 828)

2. **CDP Console Capture** (also injected via `context.addInitScript`):
   - `_getClickCaptureScript()` tracks inputs in `window.__flowstralCDPInputs`
   - Reports via `console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(inp))` on focusout/submit
   - Parsed by `_setupConsoleListenerForPage()` → stored in `this.pendingInputs[]`
   - Polling loop also reads `data.inputs` from `page.evaluate()` (300ms stale threshold)

### The Bug: Premature Clearing of pendingInputs

**`playwright-recorder.js` lines 2798-2808:**
```javascript
if (this.useRecipeRecorder && data.recipeActions && data.recipeActions.length > 0) {
  for (const recipeAction of data.recipeActions) {
    await this._processRecipeAction(recipeAction, pageIndex);
  }
  // BUG: Clears ALL pendingInputs for this tab, even when recipe only had CLICKS
  this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
  this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
}
```

**Timeline of the bug:**
1. User opens new tab, clicks on a text field, types "500"
2. Recipe captures the **click** on a button/link immediately (no debounce for clicks)
3. Recipe fill is still **debouncing** (1500ms hasn't elapsed)
4. Polling loop fires (100ms interval):
   - `data.recipeActions = [clickAction]` (has the click, NOT the fill yet)
   - Enters the recipe block: `data.recipeActions.length > 0` → TRUE
   - Processes the click action ✓
   - **Clears `pendingInputs` for this tab** (line 2808) ← DESTROYS CDP safety net
5. The fill is still debouncing in recipe — BUT the CDP fallback was just cleared
6. If page navigates before debounce fires, or timing aligns badly → **Fill is LOST**

### Additional Risk: data.inputs Ignored in Recipe Mode

In recipe mode, `data.inputs` from the page's `window.__flowstralCDPInputs` is completely ignored:
- Line 2818: `if (!this.useRecipeRecorder)` → FALSE → skipped
- Line 2828: Only processes `this.pendingInputs` (main-process level), not `data.inputs` (page-level)

## Proposed Fix for Issue 1

### Change 1: Only clear pendingInputs when recipe captured fills

**File:** `playwright-recorder.js` lines 2803-2808

**Before:**
```javascript
// Clear pendingClicks/pendingInputs for this page since recipe handled them
this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
```

**After:**
```javascript
// Always clear pendingClicks - recipe click capture is reliable
this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);

// ONLY clear pendingInputs if recipe actually captured FILL actions for this tab.
// If recipe only had clicks (fills still debouncing), keep pendingInputs as safety net.
const recipeHadFills = data.recipeActions.some(a => a.type === 'fill');
if (recipeHadFills) {
  this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
}
```

### Change 2: Process page-level data.inputs as additional safety net

When recipe mode is ON but recipe had NO actions this cycle, also process `data.inputs` 
(page-level CDP inputs) alongside the stale `this.pendingInputs` check.

**File:** `playwright-recorder.js` lines 2828-2845

**After (updated else-if block):**
```javascript
} else if (!data.recipeActions || data.recipeActions.length === 0) {
  // Recipe mode but no recipe actions this cycle.
  // Safety net 1: Process page-level CDP inputs (data.inputs) that were flushed.
  // _processInputs deduplicates against existing Fill actions by field key.
  if (data.inputs && data.inputs.length > 0) {
    const inputsWithTabIndex = data.inputs.map(inp => ({
      ...inp,
      tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
    }));
    await this._processInputs(inputsWithTabIndex);
  }
  
  // Safety net 2: Process stale main-process pendingInputs (>2s old)
  const now = Date.now();
  const staleInputs = (this.pendingInputs || []).filter(
    i => i.tabIndex === pageIndex && (now - (i.timestamp || 0)) > 2000
  );
  if (staleInputs.length > 0) {
    await this._processInputs(staleInputs);
    this.pendingInputs = (this.pendingInputs || []).filter(
      i => i.tabIndex !== pageIndex || (now - (i.timestamp || 0)) <= 2000
    );
  }
}
```

### Invariants Preserved
- [x] Fills in new tabs captured (recipe + CDP fallback preserved)
- [x] Cross-origin pages capture inputs via CDP pendingInputs
- [x] Tab indices consistent after tab close/open
- [x] Timestamp ordering preserved via _insertByTimestamp
- [x] Recipe debounce (1500ms) doesn't lose fills
- [x] pendingInputs cleared per-tab, not globally
- [x] No duplicate fills (_processInputs deduplicates by field key)
- [x] Complex elements work: shadow DOM, iframes, new tabs, drag-drop

### Risk Assessment
- **Duplicate fills**: LOW — `_processInputs` deduplicates by field key (name/id/placeholder)
- **Ordering**: LOW — All actions use `_insertByTimestamp()` with correct timestamps
- **pendingInputs accumulation**: LOW — Stale safety net (>2s) still clears old items

---

# Issue 2: Playback Timing Unchanged

## Problem
Despite building `SimpleStepExecutor` and `SimpleElementFinder` for 3-10x faster playback,
timing has NOT changed at all. The user sees the same slow execution as before.

## Root Cause: useSimplePlayback is NEVER activated

**Finding: `useSimplePlayback` is set to `false` by default and NOTHING ever sets it to `true`.**

```javascript
// playwright-recorder.js line 211
this.useSimplePlayback = options.useSimplePlayback || false; // Default: OFF (opt-in)

// playwright-recorder.js line 3571  
useSimplePlayback = this.useSimplePlayback || false; // Falls back to false
```

The `SimpleStepExecutor` and `SimpleElementFinder` are fully implemented but **dead code** —
the `if (useSimplePlayback)` branch at line 3926 is never taken. Every test run goes through
the legacy `this.executeAction(action)` path.

### Current Legacy Playback Timing Per Step

| Phase | Time | Notes |
|-------|------|-------|
| DOM hydration wait | 50-300ms | 50ms locked, 300ms otherwise |
| Locked selector race | 0-150ms | 150ms timeout |
| Quick Scan (8 strategies, SEQUENTIAL) | 0-2000ms | Each 250ms, one after another |
| SmartFinder (SEQUENTIAL) | 0-8000ms | 8s budget, strategies tried sequentially |
| Legacy `_findElement` | 0-?ms | 50+ strategies |
| Retry backoff (up to 3x) | 0-2600ms | 200+400+800ms |
| Post-click highlight | 100ms | |
| Post-click settle | 250-1000ms | 250ms normal, 1000ms for links |
| Inter-step delay (slowMo) | 200ms default | `max(minDelay, slowMo)` |
| **Happy path** | ~500-800ms per step | Locked selector hit |
| **Worst case** | ~30-40s+ per step | All strategies fail, 3 retries |

### SimplePlayback Timing Per Step (if activated)

| Phase | Time | Notes |
|-------|------|-------|
| Tier 1: High-confidence PARALLEL | 0-3000ms | 5-6 strategies raced via Promise.any() |
| Tier 2: Medium-confidence PARALLEL | 0-5000ms | Only if Tier 1 fails |
| Post-action settle | 100-200ms | Minimal delays |
| Inter-step delay | 30ms | Uses simple playback flag for min delay |
| **Happy path** | ~100-300ms per step | 3-10x faster |
| **Worst case** | ~8-10s per step | Both tiers fail → SmartFinder healing |

## Proposed Fix for Issue 2

### Change 3: Enable SimplePlayback by default

**File:** `playwright-recorder.js` line 211

**Before:**
```javascript
this.useSimplePlayback = options.useSimplePlayback || false; // Default: OFF (opt-in)
```

**After:**
```javascript
this.useSimplePlayback = options.useSimplePlayback !== false; // Default: ON (opt-out)
```

This mirrors the pattern used by `useRecipeRecorder` (line 198) which is also ON by default.

### Change 4: Set slowMo default to 0 for maximum speed

**File:** `playwright-recorder.js` line 3560

**Before:**
```javascript
slowMo = 200; // default
```

**After:**
```javascript
slowMo = 0; // default: fastest playback, user can increase via UI
```

With `slowMo=0`, the inter-step delay becomes `max(30, 0) = 30ms` for simple playback steps.

### Change 5: Reduce post-action delays in executeAction

Several fixed delays in `executeAction` are unnecessarily high:

| Current | Proposed | Location | Reason |
|---------|----------|----------|--------|
| 100ms highlight | 50ms | line 8568 | Highlight is visual only |
| 500ms new tab settle | 300ms | line 8666 | domcontentloaded already waited |
| 1000ms link navigation | 500ms | line 8731 | Excessive for most sites |
| 250ms non-link click | 100ms | line 8735 | CSS transitions are fast |
| 200ms before fill | 100ms | line 8760 | DOM is already ready |
| 1000ms search field | 500ms | line 8942 | Was overestimated |
| 200ms regular fill | 100ms | line 8946 | Input event is synchronous |

### Change 6: Reduce SmartFinder page stability wait

**File:** `smart-finder.js` `waitForPageStability`

Current: Up to 5100ms (domcontentloaded 5s + animations 2s + networkidle 3s + hydration 100ms)

**Proposed:** Skip `waitForPageStability` entirely when called from simple playback path.
Playwright's auto-wait handles actionability checks already.

### Invariants Preserved
- [x] All complex elements still work (shadow DOM, iframes, new tabs, etc.)
- [x] Fallback chain intact: Simple → SmartFinder healing → legacy
- [x] Locked locators still used (SimpleElementFinder checks them in Tier 1)
- [x] Self-healing still works (SmartFinder is the healing fallback)
- [x] User can opt-out by setting `useSimplePlayback: false`

### Risk Assessment
- **Breaking existing tests**: MEDIUM — Simple playback might not find elements that legacy does.
  Mitigation: Falls back to SmartFinder healing if simple fails, preserving robustness.
- **Too fast for slow sites**: LOW — Playwright auto-wait handles this. Sites that need more
  time will naturally wait longer (actionability checks block until element is ready).
- **Salesforce Lightning**: MEDIUM — The 1000ms post-navigation delay was specifically for SF.
  Mitigation: Keep the 1000ms only for link clicks that trigger full navigation.

---

# Implementation Order

1. **Issue 1 Fix** (recording): Changes 1-2 (fill safety net)
2. **Issue 2 Fix** (playback): Changes 3-6 (activate simple playback, reduce delays)
3. **Test**: Record a flow in a new tab, verify fills captured, verify faster playback
4. **Build & Release**: Commit, rebuild Electron, push to GitHub release
