# Test Execution Evidence - Screenshots, Logs, and Results

## Overview
When you run a test, the system captures multiple types of evidence to verify if a test really passed:

1. **Screenshots** - Visual proof of what happened
2. **Execution Logs** - Detailed step-by-step logs
3. **Videos** - Full video recording (if enabled)
4. **Traces** - Playwright trace files for debugging
5. **Test Results** - Status, duration, errors

---

## Where to Find Test Evidence

### 1. **In the Flowstral UI (After Test Execution)**

When you execute a test from the Flowstral page:

1. Click **"Execute Test"** button on a generated Playwright script
2. After execution, you'll see an **"Execution Results"** section showing:
   - ✅ **Status**: "success" or "failed"
   - ⏱️ **Execution Time**: How long it took
   - 🌐 **Browser**: Which browser was used
   - 📸 **Screenshots**: Count of screenshots captured
   - 🎥 **Video**: If video recording is available
   - 📊 **Trace**: If trace file is available
   - 📝 **Logs**: Full stdout/stderr output

**Location**: Flowstral page → Execute Test → Execution Results dialog

### 2. **Test Run Details Page**

For more detailed evidence:

1. Go to **Test Runs** page (`/runs`)
2. Click on a specific test run
3. View:
   - **Test Steps** with individual screenshots
   - **Step-by-step logs** (stdout/stderr)
   - **Error messages** if any step failed
   - **Screenshots** linked to each step
   - **Defects** created from failures

**API Endpoint**: `GET /api/test-runs/{run_id}`

### 3. **Screenshots Storage**

Screenshots are stored in two places:

#### A. **In Database (artifacts table)**
- Linked to test runs and steps
- Stored as base64 data URLs
- Accessible via API: `GET /api/test-runs/{run_id}/steps/{step_id}/screenshot`

#### B. **In File System (test-results directory)**
- Location: `{temp_dir}/flowstral_test_results/{test_name}/test-results/`
- Files: `*.png` (screenshots), `*.webm` (videos), `*.zip` (traces)
- Example: `C:\Users\{username}\AppData\Local\Temp\flowstral_test_results\{test_name}\test-results\`

### 4. **Execution Logs**

Logs are available in multiple places:

#### A. **In Test Execution Response**
- `stdout`: Standard output (test execution logs)
- `stderr`: Error output (if test failed)
- Shown in Flowstral UI execution results

#### B. **In Backend Logs**
- Location: `backend/logs/app.log`
- Search for: `Test execution`, `Playwright`, `screenshot`
- Command: `.\scripts\check_flowstral_logs.ps1`

#### C. **In Test Run Steps**
- Each step has `stdout` and `stderr` fields
- Accessible via: `GET /api/test-runs/{run_id}`

---

## How to Verify a Test Really Passed

### ✅ **Checklist for Test Pass Verification:**

1. **Status Check**
   - ✅ Status = "success" or "passed"
   - ❌ Status = "failed" or "error"

2. **Screenshots**
   - ✅ At least one screenshot captured
   - ✅ Screenshot shows expected page state
   - ✅ No error messages visible in screenshot

3. **Logs**
   - ✅ No errors in stdout/stderr
   - ✅ All steps completed successfully
   - ✅ Final log shows "Test completed successfully"

4. **Assertions**
   - ✅ All `expect()` assertions passed
   - ✅ URL validations passed
   - ✅ Element visibility checks passed

5. **Duration**
   - ✅ Test completed in reasonable time
   - ❌ Test timed out (indicates failure)

---

## Screenshot Capture Details

### When Screenshots Are Taken:

1. **Before each step** (in enhanced executor)
2. **On test failure** (automatic)
3. **On navigation** (major page changes)
4. **On critical actions** (submit, checkout, login)

### Screenshot Types:

- **Full Page**: Complete page screenshot
- **Viewport**: Visible area only
- **Element**: Specific element screenshot

---

## Accessing Evidence Programmatically

### Get Test Run with Screenshots:
```bash
GET http://localhost:8000/api/test-runs/{run_id}
```

Response includes:
```json
{
  "test_cases": [
    {
      "steps": [
        {
          "step_id": "...",
          "status": "passed",
          "screenshots": [
            {
              "url": "data:image/png;base64,...",
              "metadata": {...}
            }
          ],
          "stdout": "...",
          "stderr": "..."
        }
      ]
    }
  ],
  "global_screenshots": [...]
}
```

### Get Step Screenshot:
```bash
GET http://localhost:8000/api/test-runs/{run_id}/steps/{step_id}/screenshot
```

---

## Troubleshooting Missing Evidence

### If Screenshots Are Missing:

1. **Check Playwright Configuration**
   - Ensure `screenshot: 'only-on-failure'` or `screenshot: 'on'` is set
   - Check `test-results` directory exists

2. **Check Test Execution**
   - Verify test actually ran (check logs)
   - Check if test failed before screenshots were taken

3. **Check File Permissions**
   - Ensure temp directory is writable
   - Check disk space

4. **Check Backend Logs**
   - Look for screenshot capture errors
   - Check artifact storage errors

### If Logs Are Missing:

1. **Check stdout/stderr in response**
2. **Check backend logs** (`backend/logs/app.log`)
3. **Check test execution service** for log capture

---

## Best Practices

1. **Always Check Screenshots** - Visual proof is most reliable
2. **Review Logs** - Check for warnings or errors
3. **Verify Assertions** - Ensure all validations passed
4. **Check Duration** - Unusually long times may indicate issues
5. **Review Error Messages** - Even if status is "success", check for warnings

---

## Quick Commands

### Check Test Results Directory:
```powershell
Get-ChildItem -Path "$env:TEMP\flowstral_test_results" -Recurse -Filter "*.png"
```

### View Backend Logs:
```powershell
.\scripts\check_flowstral_logs.ps1
```

### Check Test Run via API:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/test-runs/{run_id}" -Method GET
```

