# QAAI Debugging Session Findings

## Session Date: January 19, 2026

## Problem Statement
Test playback was failing at "Go To Saver's Switch" step despite having a robust 4-layer fallback system (SmartFinder → Legacy → iFrame → AI). Recording in new tabs was also not capturing actions.

---

## All Bugs Found & Fixed

### Bug #1: Incomplete Label Extraction (CRITICAL)
**Location**: `playwright-recorder.js` (8 places), `action-handlers.js` (4 places), `salesforce-handlers.js` (1 place)

**Problem**:
```javascript
// BROKEN - missing fallbacks
const label = action.label || action.text;
```

**Fix**: Created `getActionLabel()` function that checks ALL sources:
```javascript
const getActionLabel = (action) => {
  let label = action.label || 
              action.text || 
              action.selectorObj?.text ||
              action.recipe?.what?.text ||
              action.args?.[0];
  if (!label && action.description) {
    label = extractTextFromDescription(action.description);
  }
  return normalizeTextForMatching(label || '');
};
```

---

### Bug #2: Apostrophe Character Mismatch (CRITICAL)
**Problem**: Recorded `"Saver's"` (straight `'`) didn't match page `"Saver's"` (curly `'`)

**Fix**: Added text normalization at multiple levels:
```javascript
const normalizeTextForMatching = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};
```

---

### Bug #3: Double Space in Recorded Text (HIGH)
**Problem**: Text captured as `"Go To Saver'  Switch"` (TWO spaces)

**Fix**: Added normalization at START of SmartFinder.find():
```javascript
if (what?.text) {
  what.text = this.normalizeText(what.text);  // Collapses double spaces
}
```

---

### Bug #4: Missing Role Inference (HIGH)
**Location**: `recipe-recorder-integration.js`

**Problem**: Recipe had `role: null` when element role wasn't explicitly captured

**Fix**: Infer role from action type and tag:
```javascript
if (!inferredRole && actionType.includes('click')) {
  const tag = element.tagName?.toLowerCase();
  if (tag === 'a') inferredRole = 'link';
  else if (tag === 'button') inferredRole = 'button';
  else inferredRole = 'link'; // Default for click failures
}
```

---

### Bug #5: aria-label Strategy Too Strict (HIGH)
**Location**: `smart-finder.js`

**Problem**: Exact match failed despite having correct ariaLabel in recipe

**Fix**: Added 3 aria-label strategies:
```javascript
// 1. Exact match
scope.locator(`[aria-label="${which.ariaLabel}"]`)

// 2. Partial match (contains)
scope.locator(`[aria-label*="${normalizedSearch}"]`)

// 3. Flexible regex (handles apostrophe variants)
scope.getByRole('link', { name: flexRegex })
```

---

### Bug #6: AI Viewport Null Error (MEDIUM)
**Problem**: `Cannot read properties of null (reading 'width')` - viewport was null

**Fix**: Added fallback:
```javascript
let viewport = await this.page.viewportSize();
if (!viewport) {
  viewport = await this.page.evaluate(() => ({
    width: window.innerWidth || 1920,
    height: window.innerHeight || 1080
  })).catch(() => ({ width: 1920, height: 1080 }));
}
```

---

### Bug #7: Bounding Box Not Used as Fallback (MEDIUM)
**Location**: `smart-finder.js`

**Problem**: Recipe had `confirm.boundingBox` but wasn't used as fallback

**Fix**: Added `boundingBox-center` strategy:
```javascript
if (confirm?.boundingBox) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const element = await this.page.evaluateHandle(
    ([cx, cy]) => document.elementFromPoint(cx, cy),
    [centerX, centerY]
  );
}
```

---

### Bug #8: text.replace is not a function (MEDIUM)
**Problem**: normalizeText received non-string (null, object, array)

**Fix**: Added type checking:
```javascript
if (!text || typeof text !== 'string') return '';
```

---

### Bug #9: New Tabs Not Auto-Switched During Playback (HIGH)
**Problem**: After click opens new tab, `this.page` still pointed to original tab

**Fix**: Added auto-detection after every click:
```javascript
const pagesBefore = this.context.pages().length;
await this.page.waitForTimeout(500);
const pagesAfter = this.context.pages();

if (pagesAfter.length > pagesBefore) {
  console.log('✨ NEW TAB DETECTED! Switching...');
  this.page = pagesAfter[pagesAfter.length - 1];
  this.smartFinder = new SmartFinder(this.page, { debug: true });
}
```

---

### Bug #10: Actions in New Tabs Not Recorded (CRITICAL)
**Problem**: Console listener only attached to main page, not new tabs

**Fix**: Created `_setupConsoleListenerForPage()` method and call it for each new tab:
```javascript
_setupConsoleListenerForPage(page, pageIndex) {
  page.on('console', (msg) => {
    if (msg.text().startsWith('__FLOWSTRAL_CLICK__:')) {
      // Parse and capture click
      clickData.tabIndex = pageIndex;
      this.pendingClicks.push(clickData);
    }
  });
}

// In context.on('page') handler:
this._setupConsoleListenerForPage(newPage, newPageIndex);
```

---

### Bug #11: Cross-Origin Tabs Not Recording (CRITICAL)
**Problem**: When new tab opens on a different subdomain (e.g., `tx.my.xcelenergy.com` → `www.xcelenergy.com`), recording fails because:
1. Scripts were injected at `page` level, not `context` level
2. Only submit button clicks were reported via console

**Fix**: Three-part solution:

**Part 1 - Context-level script injection (auto-applies to ALL pages):**
```javascript
// Changed from page.addInitScript to context.addInitScript
await this.context.addInitScript(this._getRecorderScript());
await this.context.addInitScript(this._getClickCaptureScript());
if (this.useRecipeRecorder) {
  await this.context.addInitScript(getRecipeClickCaptureScript());
}
```

**Part 2 - Report ALL clicks via console (not just submit buttons):**
```javascript
// Before: if (isSubmitButton) { console.log('__FLOWSTRAL_CLICK__:...') }
// After: ALWAYS report via console
console.log('__FLOWSTRAL_CLICK__:' + JSON.stringify(clickData));
```

**Part 3 - Always set up console listener for cross-origin tabs:**
```javascript
// Even when JS injection fails, context-level scripts might work
this._setupConsoleListenerForPage(newPage, newPageIndex);
```

**Why this works:**
- `context.addInitScript` runs BEFORE each page navigates, even cross-subdomain
- Console messages CAN be captured even when `page.evaluate()` fails
- The console listener captures `__FLOWSTRAL_CLICK__` from any origin

---

## Files Modified

| File | Changes |
|------|---------|
| `playwright-recorder.js` | Added normalization utils, fixed label extraction (8 places), added debug logging, auto new tab detection, console listener for new tabs |
| `action-handlers.js` | Added normalization utils, fixed label extraction (4 places) |
| `salesforce-handlers.js` | Added normalization utils, fixed label extraction (1 place) |
| `recipe-recorder-integration.js` | Added role inference, text normalization |
| `smart-finder.js` | Added flexible regex, multi-role fallback, aria-label strategies, bounding box fallback, text normalization at find() start |
| `PlaywrightRecorderPage.tsx` | Fixed field passing, added manual override UI |

---

## Architecture Understanding

### Recording Flow
```
User Click → CDP/Recipe Capture → console.log('__FLOWSTRAL_CLICK__:...') 
           → page.on('console') listener → pendingClicks array 
           → _addAction() → actions array → UI display
```

### Playback Flow (4-Layer Fallback)
```
1. SmartFinder.find(recipe)     - 10-phase element finding
2. _findElement(action)          - 50+ legacy strategies  
3. iFrame search                 - Search inside iframes
4. AI Vision Fallback            - Screenshot + GPT-4o coordinates
```

### New Tab Handling
```
Recording:
  context.on('page') → inject scripts → _setupConsoleListenerForPage()

Playback:
  After click → check pages().length → auto-switch if new tab detected
```

---

## Key Lessons Learned

1. **Text normalization must happen EVERYWHERE** - at recording AND playback
2. **Console listeners must be attached to EACH page** - not just main page
3. **New tabs require explicit context switching** - Playwright doesn't auto-follow
4. **Type checking is essential** - always check `typeof text === 'string'`
5. **Multiple fallback strategies** - role+text, aria-label, bounding box, AI
6. **Use context.addInitScript for multi-tab** - page.addInitScript only affects one page
7. **Report via console for cross-domain** - page.evaluate() fails but console works
8. **Subdomain = cross-origin** - `tx.my.site.com` and `www.site.com` are different origins!

---

## Session 2 Fixes - Duplicate Steps & Tab Switching (Jan 19, 2026)

### Bug #12: SwitchTab Deduplication Used Wrong Property (HIGH)
**Problem**: Focus detection checked `a.type === 'switchTab'` but after `_toQWord()` conversion, actions have `qword: 'SwitchTab'`

**Fix**: Check both properties:
```javascript
const alreadyHasActionFromTab = recentActions.some(a => 
  (a.qword === 'SwitchTab' && a.tabIndex === i) ||
  (a.type === 'switchTab' && a.tabIndex === i) ||  // Before conversion
  (a.tabIndex === i)
);
```

---

### Bug #13: Polling Loop Didn't Prevent Focus Detection Duplicates (HIGH)
**Problem**: When polling loop added switchTab, it didn't update `_lastDetectedFocusTab` or `_focusDetectedAt`, so focus detection could add duplicates

**Fix**: Update focus tracking after polling-added switchTab:
```javascript
this._currentPageIndex = pageIndex;
this.page = targetPage;
// CRITICAL: Update focus tracking to prevent duplicate switchTab
this._lastDetectedFocusTab = pageIndex;
this._focusDetectedAt = Date.now();
```

---

### Bug #14: No SwitchTab-Specific Deduplication in Final Pass (MEDIUM)
**Problem**: Final dedupe pass didn't specifically handle consecutive SwitchTab to same tab

**Fix**: Added SwitchTab-specific deduplication:
```javascript
if (action.qword === 'SwitchTab') {
  const prevAction = uniqueActions[uniqueActions.length - 1];
  const actionTabIndex = action.tabIndex ?? action.args?.[0];
  
  // Skip if previous was SwitchTab to same tab (within 3s)
  if (prevAction?.qword === 'SwitchTab' && actionTabIndex === prevTabIndex) {
    if (timeDiff < 3000) continue;
  }
  
  // Skip if previous action already from this tab
  if (prevAction?.tabIndex === actionTabIndex) continue;
}
```

---

### Bug #15: Click Deduplication Used Exact Timestamp (MEDIUM)
**Problem**: Same click captured by multiple mechanisms could have 1ms timestamp difference, bypassing deduplication

**Fix**: Use 50ms time windows for deduplication:
```javascript
const roundedTimestamp = Math.floor(click.timestamp / 50) * 50;
const clickId = `cdp_${roundedTimestamp}_${click.description}`;
```

---

## Summary of Architecture Fixes

| Issue | Before | After |
|-------|--------|-------|
| Script injection | `page.addInitScript` | `context.addInitScript` |
| Click reporting | Only submit buttons | ALL clicks |
| Console listener | Main page only | All pages including cross-origin |
| Label extraction | 2 sources | 6+ sources with normalization |
| Text matching | Exact | Flexible with apostrophe normalization |
| New tab handling | Manual | Auto-detect and switch |
| SwitchTab dedup check | `a.type` only | `a.type` OR `a.qword` |
| Polling switchTab | No focus tracking update | Updates `_lastDetectedFocusTab` |
| Click dedup timestamp | Exact match | 50ms time window |
| SwitchTab final dedupe | Generic only | SwitchTab-specific logic |

---

---

## Session 3 - Unified Execution Architecture (Jan 19, 2026)

### Problem: Multiple Execution Paths Out of Sync

The recording/playback system had THREE separate execution paths that could behave differently:

1. **PlaywrightRecorder** (`playwright-recorder.js`) - Used during recording
2. **TestExecutor** (`test-executor.js`) - Used from builder and tests tab
3. **Backend** (`test_execution_service.py`) - API-based execution

Each had its own switch statement for action handling. When a fix was made to one, the others wouldn't get it.

### Solution: Single Entry Point via ActionHandlers.executeAction()

Created a **unified execution function** in `lib/action-handlers.js`:

```javascript
// SINGLE ENTRY POINT FOR ALL ACTION EXECUTION
async function executeAction(ctx, action, options = {}) {
  const actionType = normalizeActionType(action.type || action.qword || '');
  
  switch (actionType) {
    case 'click':
    case 'clicktext':
    case 'clickelement':
      return await handleClick(ctx, action, { timeout });
    
    case 'fill':
    case 'type':
    case 'input':
      return await handleFill(ctx, action, { timeout });
    
    case 'hover':
      return await handleHover(ctx, action, { timeout });
    
    // ... all other common actions
    
    default:
      return { success: false, error: `Unknown action: ${actionType}` };
  }
}
```

### Changes Made

1. **action-handlers.js**: Added `executeAction()` as the unified entry point
2. **playwright-recorder.js**: Now calls `ActionHandlers.executeAction()` first, falls back to legacy switch
3. **test-executor.js**: Now calls `ActionHandlers.executeAction()` first, falls back to legacy switch

### Benefits

- **Single source of truth** - Fix once, applies everywhere
- **Guaranteed consistency** - Recording and playback use identical logic
- **Easier maintenance** - No more sync issues between executors
- **Cleaner architecture** - Legacy handlers only for Salesforce-specific actions

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│       UNIFIED EXECUTION: lib/action-handlers.js             │
│                                                              │
│   executeAction(ctx, action) ← SINGLE ENTRY POINT           │
│     ├── handleClick()                                        │
│     ├── handleFill()                                         │
│     ├── handleHover()                                        │
│     └── handle*()                                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
 PlaywrightRecorder           TestExecutor
 (recording page)           (builder/tests)
         ↓                           ↓
    SAME BEHAVIOR              SAME BEHAVIOR
```

*Last Updated: January 19, 2026 (Session 3)*
