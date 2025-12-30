# ⚠️ CRITICAL: Backend Server Must Be Restarted

## Issue
Artifacts are not generating because the backend server is still running **old cached Python bytecode** with bugs.

## Evidence
The logs show:
- **Line 3314**: `UnboundLocalError: local variable 'deduplicated_nodes' referenced before assignment`
- This error is from **OLD CODE** - the current code is correct (line 189 defines it before line 194 uses it)

## Solution: Restart Backend Server

### Steps:
1. **Stop the backend server** (Ctrl+C in the terminal where it's running)
2. **Clear Python cache** (already done, but verify):
   ```bash
   # In backend directory
   Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
   Get-ChildItem -Recurse -Filter "*.pyc" | Remove-Item -Force
   ```
3. **Restart the backend server**:
   ```bash
   # In backend directory
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   OR if using a different command:
   ```bash
   # Check how you normally start it
   npm run dev:backend
   # or
   python main.py
   # etc.
   ```

## What Was Fixed (But Not Active Until Restart)

1. ✅ **UnboundLocalError** - Fixed in `enhanced_playwright_generator.py`
2. ✅ **Forge agent 0 actions** - Added fallback selectors
3. ✅ **Scenario generator 0 scenarios** - Normalized action types
4. ✅ **AttributeError _infer_business_rules** - Code already correct
5. ✅ **LLM provider** - Added `local_qwen` to allowed providers

## Verification After Restart

After restarting, test artifact generation:
1. Record a new Flowstral session
2. Stop the session
3. Check logs for:
   - `[ENHANCED] Processing X nodes in recorded order` (no error)
   - `[FORGE] Generated script: X actions` (X > 0)
   - `Segmented X edges into Y scenarios` (Y > 0)
   - `[OK] Artifact generation completed successfully`

## Why This Happens

Python caches compiled bytecode in `__pycache__` directories. When you fix code:
- The `.py` file is updated ✅
- But Python may still use old `.pyc` files ❌
- Restarting forces Python to recompile from `.py` files ✅

## Quick Check

To verify the server restarted with new code, check the logs for:
- **Startup timestamp** should be recent
- **No UnboundLocalError** in new artifact generation attempts
- **Code changes are active** (check log messages match current code)


