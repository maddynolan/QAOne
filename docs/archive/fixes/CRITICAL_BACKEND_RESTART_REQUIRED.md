# ⚠️ CRITICAL: Backend Server Must Be Restarted

## Issue
Artifacts are not generating because the backend server is still running **old cached Python bytecode** with the previous code.

## What Was Changed
1. **Created new `RobustSalesforceGenerator`** - completely new file
2. **Modified `flowstral_artifacts.py`** - uses new generator, disables test case generation
3. **Modified `flowstral_orchestrator.py`** - reduced timeout from 300s to 60s

## Why It's Not Working
Python caches compiled bytecode in `__pycache__` directories. When you fix code:
- The `.py` file is updated ✅
- But the running server still uses old `.pyc` files from `__pycache__` ❌
- **The server must be restarted** to load the new code

## Solution: Restart Backend Server

### Steps:
1. **Stop the backend server** (Ctrl+C in the terminal where it's running)
2. **Clear Python cache** (optional but recommended):
   ```powershell
   # In backend directory
   Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force
   Get-ChildItem -Recurse -Filter "*.pyc" | Remove-Item -Force
   ```
3. **Restart the backend server**:
   ```powershell
   # In backend directory
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   OR if using a different command:
   ```powershell
   npm run dev:backend
   # or whatever command you normally use
   ```

## What Will Happen After Restart

1. **Fast generation** - Test case generation is disabled (no LLM calls)
2. **Correct order** - Uses array order (as nodes appear), not timestamp sorting
3. **Proper selectors** - ID extraction, getByTitle(), href, getByRole().filter()
4. **60 second timeout** - Will fail fast if something goes wrong

## Verification After Restart

After restarting, test artifact generation:
1. Record a new Flowstral session
2. Stop the session
3. Check logs for:
   - `[ROBUST-SF] Using robust Salesforce generator`
   - `[ROBUST-SF] Generated script with X nodes in < 1 second`
   - `[TEST_CASES] Skipping test case generation for speed`
   - `[OK] Artifact generation completed successfully`

## If Still Not Working After Restart

Check logs for:
- `[ARTIFACTS] Starting artifact generation with timeout (60 seconds max)`
- Any import errors
- Any exceptions during generation


