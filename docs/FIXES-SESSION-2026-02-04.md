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

## 3. Health Diagnostic Improvements

### Changes
- `health/db-test` now shows license count and key previews (up to 5 keys)
- All three database connection paths are tested: raw psycopg2, license module, CRUD pool

---

## Architecture Reference

See Cursor rules for detailed architecture:
- `.cursor/rules/lock-locators.mdc` — Lock Locators / element finding pipeline
- `.cursor/rules/deployment-database.mdc` — Railway + Supabase deployment
