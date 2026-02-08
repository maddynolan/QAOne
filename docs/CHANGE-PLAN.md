# Change Plan: Fix Fills Filtered Out in New Tabs (IMPLEMENTED)

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

There are TWO parallel capture systems that BOTH capture fills:

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
   - Enters the recipe processing block (line 2798): `data.recipeActions.length > 0` → TRUE
   - Processes the click action ✓
   - **Clears `pendingInputs` for this tab** (line 2808) ← DESTROYS CDP safety net
5. The fill is still debouncing in recipe — BUT the CDP fallback was just cleared
6. Later: Recipe debounce fires → fill captured → **usually works fine IF debounce completes**
7. **BUT**: If page navigates, user switches tabs, or timing aligns badly:
   - Recipe debounce may not fire (page destroyed)
   - CDP safety net is already cleared
   - `data.inputs` from page-level `__flowstralCDPInputs` is NEVER processed when recipe mode is ON
   - **Fill is LOST**

### Additional Risk: page.evaluate() Returns data.inputs but They're Ignored

In recipe mode, `data.inputs` from the page's `window.__flowstralCDPInputs` is **completely ignored**:
- Line 2818: `if (!this.useRecipeRecorder)` → FALSE → skipped
- Line 2828: Only processes `this.pendingInputs` (main-process level), not `data.inputs` (page-level)

This means the page-level CDP inputs are thrown away every polling cycle when recipe mode is on.

## Affected Code Paths

1. **Polling loop** (`playwright-recorder.js` ~line 2748-2871): The per-page processing loop
2. **`pendingInputs` clearing** (line 2807-2808): Clears after recipe actions
3. **Tiered fallback** (line 2828-2844): Only processes `this.pendingInputs` >2s old
4. **`_processRecipeAction`** (line 3195+): Recipe action processing and deduplication
5. **`_processInputs`** (line 3084+): CDP input processing (has its own deduplication)

## Invariants That Must Be Preserved

- [x] Fills in new tabs must still be captured (recipe + CDP fallback)
- [x] Cross-origin pages must capture inputs via CDP pendingInputs  
- [x] Tab indices must stay consistent after tab close/open
- [x] Timestamp ordering must be preserved in this.actions
- [x] Recipe recorder debounce (1500ms) must not lose fills
- [x] CDP stale threshold (2000ms) must not aggressively filter
- [x] pendingInputs/pendingClicks must be cleared per-tab, not globally
- [x] _insertByTimestamp must be used for ALL action insertions
- [x] Complex elements must work: shadow DOM, iframes, new tabs, drag-drop
- [x] No duplicate fills (recipe + CDP recording same fill should deduplicate)

## Proposed Changes

### Change 1: Only clear pendingInputs when recipe captured fills for the tab

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
// The stale safety net (>2s) or recipe debounce will handle them later.
const recipeHadFills = data.recipeActions.some(a => a.type === 'fill');
if (recipeHadFills) {
  this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
}
```

### Change 2: Also process page-level data.inputs as safety net in recipe mode

When recipe mode is ON but recipe had NO fills this cycle, process `data.inputs` (page-level CDP inputs) via `_processInputs` as an additional safety net. The `_processInputs` method already deduplicates against existing Fill actions (line 3093-3120), so no risk of double recording.

**File:** `playwright-recorder.js` lines 2828-2845

**Before:**
```javascript
} else if (!data.recipeActions || data.recipeActions.length === 0) {
  // Recipe mode but no recipe actions this cycle: safety net for stale pendingInputs
  const now = Date.now();
  const staleInputs = (this.pendingInputs || []).filter(
    i => i.tabIndex === pageIndex && (now - (i.timestamp || 0)) > 2000
  );
  // ... process stale inputs
}
```

**After:**
```javascript
} else if (!data.recipeActions || data.recipeActions.length === 0) {
  // Recipe mode but no recipe actions this cycle.
  // TWO safety nets:
  
  // Safety net 1: Process page-level CDP inputs (data.inputs) that are flushed/stale.
  // These are inputs from window.__flowstralCDPInputs that page.evaluate() returned.
  // They have already been flushed from the page, so process them.
  // _processInputs deduplicates against existing Fill actions by field key.
  if (data.inputs && data.inputs.length > 0) {
    const inputsWithTabIndex = data.inputs.map(inp => ({
      ...inp,
      tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
    }));
    console.log(`[PlaywrightRecorder] Safety-net: processing ${inputsWithTabIndex.length} page-level inputs for tab ${pageIndex} (recipe had no actions)`);
    await this._processInputs(inputsWithTabIndex);
  }
  
  // Safety net 2: Process stale main-process pendingInputs (>2s old)
  const now = Date.now();
  const staleInputs = (this.pendingInputs || []).filter(
    i => i.tabIndex === pageIndex && (now - (i.timestamp || 0)) > 2000
  );
  if (staleInputs.length > 0) {
    console.log(`[PlaywrightRecorder] Safety-net: processing ${staleInputs.length} stale inputs for tab ${pageIndex} (recipe missed them)`);
    await this._processInputs(staleInputs);
    this.pendingInputs = (this.pendingInputs || []).filter(
      i => i.tabIndex !== pageIndex || (now - (i.timestamp || 0)) <= 2000
    );
  }
}
```

### Change 3: Also process page-level data.inputs when recipe had only clicks

Add a third branch: when recipe mode is ON and recipe had actions BUT none of them were fills, still process `data.inputs` as safety net.

**File:** `playwright-recorder.js` after the recipe processing block (line 2809)

**After recipe block, add:**
```javascript
// If recipe had actions but NO fills, process data.inputs as safety net
// (fills might still be debouncing in recipe, but CDP captured them)
if (this.useRecipeRecorder && data.recipeActions && data.recipeActions.length > 0) {
  const recipeHadFills = data.recipeActions.some(a => a.type === 'fill');
  if (!recipeHadFills && data.inputs && data.inputs.length > 0) {
    const inputsWithTabIndex = data.inputs.map(inp => ({
      ...inp,
      tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
    }));
    console.log(`[PlaywrightRecorder] Safety-net: processing ${inputsWithTabIndex.length} page-level inputs for tab ${pageIndex} (recipe had clicks but no fills)`);
    await this._processInputs(inputsWithTabIndex);
  }
}
```

Wait - this could cause ordering issues (CDP fills appearing before recipe clicks). Better approach: fold this into Change 1 by not clearing pendingInputs, and let the stale safety net handle it. The key fix is Change 1 (don't clear pendingInputs when recipe only had clicks).

**REVISED: Changes 2 and 3 are merged into a single approach:**

Instead of processing `data.inputs` explicitly (which could cause ordering issues), we:
1. **Change 1**: Only clear `pendingInputs` when recipe captured fills (not just clicks)
2. **Change 2**: In the stale safety net, also include `data.inputs` (page-level) alongside `this.pendingInputs` (main-process-level)

This way the fill capture is always preserved through the safety net, and ordering is maintained via `_insertByTimestamp`.

## Risk Assessment

### Risk 1: Duplicate fills (recipe + CDP both record same fill)
- **Mitigation**: `_processInputs` (line 3093-3120) deduplicates by field key (name/id/placeholder). If recipe already processed the fill, the CDP fill will match and be skipped or update the existing action.
- **Risk level**: LOW

### Risk 2: Ordering issues (CDP fill processed before recipe click)
- **Mitigation**: All actions use `_insertByTimestamp()` for chronological ordering. CDP fills have `timestamp` from when the input event fired. Recipe fills use `startedAt` (typing start time). Both are set at interaction time, so ordering will be correct.
- **Risk level**: LOW

### Risk 3: pendingInputs accumulation (never cleared if recipe never captures fills)
- **Mitigation**: The stale safety net (>2s) still processes and clears old pendingInputs. If recipe eventually captures the fill, the field-key dedup in `_processInputs` prevents duplicates.
- **Risk level**: LOW

### Risk 4: Memory leak from accumulating pendingInputs
- **Mitigation**: The stale safety net processes and removes items >2s old every polling cycle. Also, `_flushPendingActionsForTab()` clears pendingInputs on tab close.
- **Risk level**: NEGLIGIBLE
