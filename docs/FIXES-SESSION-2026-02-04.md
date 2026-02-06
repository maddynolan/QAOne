# Fixes Applied — Session 2026-02-04

## Overview

This document records all fixes applied during the Feb 4, 2026 session, covering:
1. Database persistence (licenses surviving redeploys)
2. Lock Locators (7 of 9 selectors failing to lock)
3. Health diagnostic endpoint fixes

---

## 1. Database / License Persistence

### Problem
Licenses were being stored in-memory and lost on every Railway redeploy.

### Root Cause
The license module (`backend/app/routers/license_api.py`) had a PostgreSQL connection path, but:
- `DATABASE_URL` wasn't set in Railway environment variables
- The variable `_pg_conn_string` was renamed to `_pg_conn_string_raw` but the health diagnostic (`backend/app/routers/health_api.py`) still imported the old name, causing an import error

### Fixes Applied
1. Set `DATABASE_URL` in Railway env vars pointing to Supabase pooler
2. Fixed NameError: renamed import from `_pg_conn_string` to `_pg_conn_string_raw` in `health_api.py`
3. Added license count display to `health/db-test` diagnostic endpoint
4. Verified: 3 licenses survive redeploy (keys: FLOWSTRAL-U8776-*, FLOWSTRAL-UD4FA-*, FLOWSTRAL-UE189-*)

### Files Changed
- `backend/app/routers/health_api.py` — fixed import, added license count

### Commits
- `400c5b4d` — Fix NameError: _pg_conn_string -> _pg_conn_string_raw
- `8461c02d` — Fix diagnostic import: _pg_conn_string -> _pg_conn_string_raw
- `590fdc07` — Add license count to db-test diagnostic for persistence verification

---

## 2. Lock Locators — 7 of 9 Selectors Failing to Lock

### Problem
After a successful 10-step test on OrgFarm (Salesforce), clicking "Lock Locators" showed:
"Locked 2 selectors (7 could not be locked). Auto-saved."

### Root Cause (Multi-layered)
The Lock Locators feature saves `workingSelector` — the CSS/text selector used to find each element. For 7 steps, `workingSelector` was `null` even though elements were found and clicked successfully.

**Why null?** The selector generation chain has 4 layers, ALL of which failed:

1. **SmartFinder `_buildSelectorFromRecipe()`** — returned null because:
   - Salesforce Lightning elements lack `data-testid`, stable `id`, `aria-label`
   - It only used `text=` for text-based strategies (not others)

2. **SmartFinder `_extractSelectorFromLocator()`** — returned null because:
   - Text content limit was 40 chars (too short for many element descriptions)
   - Shadow DOM elements have limited accessible attributes

3. **`enrichResult()` selectorObj fallback** — returned null because:
   - `selectorObj.text` was empty for these steps
   - The actual text label lived in `action.label`, `action.args[0]`, or `action.description` — NOT in `selectorObj.text`

4. **Test executor final fallback** — same issue as enrichResult

### Fixes Applied

#### `flowstral-desktop/src/main/lib/action-handlers.js`
- Added **last-resort fallback** in `enrichResult()`: uses `getActionLabel(action)` to build `text="label"` selector
- This pulls from action.label, action.text, selectorObj.text, recipe.what.text, args[0], description

#### `flowstral-desktop/src/main/lib/smart-finder.js`
- `_extractSelectorFromLocator()`: Raised text length limit from 40 → 80 chars
- `_buildSelectorFromRecipe()`: Added `text=` fallback for ALL strategies (was only for text-based strategies)

#### `flowstral-desktop/src/main/test-executor.js`
- Added description/label-based `text=` fallback in the final fallback chain (line ~2917)
- Extracts quoted text from descriptions (e.g., 'Click "Accounts"' → 'Accounts')

#### `flowstral-desktop/src/main/playwright-recorder.js`
- Added same last-resort `text=` fallback when building step results after executeAction

### Commit
- `a2fe7424` — Fix Lock Locators: add label-based last-resort fallback for all steps

### Expected Result
Steps like "Click Show Navigation Menu", "Click Change Requests", "Hover Navigation Menu", "Click Accounts" should now lock with `text="Show Navigation Menu"`, `text="Change Requests"`, etc.

---

## 2b. Lock Locators — Inconsistent Counts (Sometimes 2, Sometimes 6)

### Problem
Running the same test multiple times and clicking Lock Locators gave different counts each time — sometimes 2 locked, sometimes 6.

### Root Cause: TWO Stale-State Bugs

**Bug 1: `_lastWorkingSelector` never reset in `playwright-recorder.js`**

In `test-executor.js`, `_lastWorkingSelector` is explicitly reset to `null` after each step (line 2947). But `playwright-recorder.js` had NO such reset. Result: if step 4 set `_lastWorkingSelector = 'text="Log In"'` and step 5's SmartFinder was slow, step 5 would inherit step 4's stale selector:

```javascript
// Line 3782 — this._lastWorkingSelector is STALE from step 4!
let workingSelector = result.workingSelector || this._lastWorkingSelector || null;
```

**Bug 2: SmartFinder `_resetTrackingState()` didn't reset `_lastSuccessfulSelector`**

`SmartFinder.find()` calls `_resetTrackingState()` at the start, but that function only reset matchCount, fallbacksUsed, etc. — NOT `_lastSuccessfulSelector` or `_lastSuccessfulStrategy`. A selector from a previous `find()` call could leak into the current one.

### Why Inconsistent?
SmartFinder uses strategy memory and the DOM load timing varies between runs. On faster runs, more strategies succeed and produce selectors (6 locked). On slower runs, fewer strategies succeed, stale selectors leak through (2 locked with potentially WRONG selectors).

### Fixes Applied

#### `flowstral-desktop/src/main/playwright-recorder.js`
- Added `_lastWorkingSelector = null` and `_lastStrategyType = null` reset at the START of each step in the test loop
- Added diagnostic log file: writes Lock Locators summary to `<userData>/lock-locators-log.txt`

#### `flowstral-desktop/src/main/lib/smart-finder.js`
- Added `_lastSuccessfulStrategy = null` and `_lastSuccessfulSelector = null` to `_resetTrackingState()`

#### `src/pages/PlaywrightRecorderPage.tsx`
- Added console.log diagnostic in handleLockLocators showing all stepResults before locking

### Diagnostic Log Location
After each test run, a log is written to: `<Electron userData>/lock-locators-log.txt`
- Shows each step's workingSelector and strategyType
- Append mode — accumulates across runs for comparison
- Check Electron console for exact path

---

## 3. Health Diagnostic Improvements

### Changes
- `health/db-test` now shows license count and key previews (up to 5 keys)
- All three database connection paths are tested: raw psycopg2, license module, CRUD pool

---

## Architecture Reference

See Cursor rules for detailed architecture:
- `.cursor/rules/lock-locators.mdc` — Lock Locators / element finding pipeline
- `.cursor/rules/deployment-database.mdc` — Railway + Supabase deployment
