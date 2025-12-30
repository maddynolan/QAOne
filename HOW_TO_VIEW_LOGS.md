# How to View Backend Logs

## Log File Location
Backend logs are stored in: `backend/logs/app.log`

The logs rotate automatically (keeps 5 backup files: `app.log.1`, `app.log.2`, etc.)

## Methods to View Logs

### Method 1: View Recent Logs (Last 100 lines)
```powershell
Get-Content backend\logs\app.log -Tail 100
```

### Method 2: View Logs with Filter for ENHANCED messages
```powershell
Get-Content backend\logs\app.log -Tail 500 | Select-String -Pattern "ENHANCED" -Context 3
```

### Method 3: View All Logs Related to Playwright Generation
```powershell
Get-Content backend\logs\app.log | Select-String -Pattern "ENHANCED|generate_script|playwright" -Context 2
```

### Method 4: View Logs in Real-Time (Watch Mode)
```powershell
Get-Content backend\logs\app.log -Wait -Tail 50
```
Press `Ctrl+C` to stop watching.

### Method 5: View Logs from a Specific Time
```powershell
# View logs from last 10 minutes (adjust time as needed)
Get-Content backend\logs\app.log | Select-String -Pattern "2025-01-.*" | Select-Object -Last 200
```

### Method 6: View Logs for a Specific Session
```powershell
# Replace SESSION_ID with your actual session ID
Get-Content backend\logs\app.log | Select-String -Pattern "SESSION_ID" -Context 5
```

## What to Look For

When debugging the Playwright generator, look for these log patterns:

1. **Node Processing:**
   ```
   [ENHANCED] Node X: event_type=click, target_selector=...
   [ENHANCED] ✅ Processing node X: ...
   ```

2. **Locator Generation:**
   ```
   [ENHANCED] Using target_selector as CSS selector: ...
   [ENHANCED] No semantic locators, using fallback - ...
   ```

3. **Code Generation:**
   ```
   [ENHANCED] ✅ Generated X lines for node Y (click)
   [ENHANCED] ❌ No code generated for node Y (click)
   ```

4. **Summary:**
   ```
   [ENHANCED] Summary: X processed, Y skipped, Z total
   ```

## Quick Debug Command

Run this to see all Playwright generation activity:
```powershell
Get-Content backend\logs\app.log -Tail 1000 | Select-String -Pattern "\[ENHANCED\]" | Select-Object -Last 50
```

## Alternative: View in Text Editor

You can also open `backend\logs\app.log` directly in any text editor (VS Code, Notepad++, etc.) and search for `[ENHANCED]` to see all generator logs.



