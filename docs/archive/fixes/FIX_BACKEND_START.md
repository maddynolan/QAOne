# Fix Backend Startup Issues

## Problem: Port 8000 Already in Use

If you see this error:
```
ERROR: [Errno 10048] error while attempting to bind on address ('0.0.0.0', 8000): 
only one usage of each socket address (protocol/network address/port) is normally permitted
```

## Solution 1: Kill Existing Process (Recommended)

**PowerShell:**
```powershell
# Find process using port 8000
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# Kill it (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or use the helper script
.\tools\start_backend.ps1
```

**Command Prompt:**
```cmd
# Find and kill process
for /f "tokens=5" %a in ('netstat -ano ^| findstr :8000') do taskkill /F /PID %a

# Or use the batch file
tools\start_backend.bat
```

## Solution 2: Use Different Port

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Then update Flowstral recorder API endpoint to: `http://localhost:8001/api/flowstral/start`

## Solution 3: Check for Import Errors

If backend fails to start due to import errors:

```bash
cd backend
python -c "import app.main"
```

This will show any import errors. Common fixes:
- Missing dependencies: `pip install -r requirements.txt`
- Import errors: Check file paths and imports

## Quick Start Scripts

I've created helper scripts:
- **Windows:** `tools\start_backend.bat` (double-click to run)
- **PowerShell:** `tools\start_backend.ps1` (run: `.\tools\start_backend.ps1`)

These scripts automatically:
1. Check if port 8000 is in use
2. Kill the existing process
3. Start the backend

## Verify Backend is Running

Once started, check:
- API Docs: http://localhost:8000/docs
- Flowstral API: http://localhost:8000/api/flowstral
- Health check: http://localhost:8000/docs (should show Swagger UI)

## Common Issues

### Issue: "Module not found"
**Fix:** Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Issue: "Import error"
**Fix:** Check Python path
```bash
cd backend
python -c "import sys; print(sys.path)"
```

### Issue: "Database connection error"
**Fix:** Check database is running and connection string in `.env`

## Next Steps

Once backend is running:
1. Open `tools/flowstral_recorder.html` in browser
2. Start Flowstral session
3. Record your flow!



