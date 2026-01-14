# 🚀 Start Flowstral Backend

## Quick Fix for Port 8000 Issue

The backend can't start because port 8000 is already in use. Here's how to fix it:

### Option 1: Kill Existing Process (Easiest)

**PowerShell:**
```powershell
# Kill all Python processes on port 8000
Get-NetTCPConnection -LocalPort 8000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Or use the helper script:**
```powershell
.\tools\start_backend.ps1
```

**Command Prompt:**
```cmd
tools\start_backend.bat
```

### Option 2: Manual Start

1. **Kill existing process:**
   ```powershell
   # Find PID
   netstat -ano | findstr :8000
   
   # Kill it (replace <PID> with actual number)
   taskkill /F /PID <PID>
   ```

2. **Start backend:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Option 3: Use Different Port

If you want to keep the existing process running:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Then update Flowstral recorder API endpoint to: `http://localhost:8001/api/flowstral/start`

---

## Verify Backend is Running

Once started, check these URLs:

- **API Documentation:** http://localhost:8000/docs
- **Flowstral API:** http://localhost:8000/api/flowstral
- **Health Check:** http://localhost:8000/docs (should show Swagger UI)

---

## Test Flowstral

1. **Open Recorder:**
   - Open `tools/flowstral_recorder.html` in your browser

2. **Configure:**
   - API Endpoint: `http://localhost:8000/api/flowstral/start`
   - Project ID: Enter any project ID
   - API Key: (leave empty for now, or configure if needed)

3. **Start Recording:**
   - Click "Start Flowstral"
   - Navigate to any website
   - Interact with the page
   - Watch real-time outputs!

4. **Stop and View Artifacts:**
   - Click "Stop Flowstral"
   - All 6 artifacts will be shown in a new window

---

## Troubleshooting

**If backend still won't start:**

1. Check for import errors:
   ```bash
   cd backend
   python -c "import app.main"
   ```

2. Check dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Check database connection (if using):
   - Verify `.env` file has correct database URL
   - Ensure database is running

**If you see import errors:**
- All Flowstral services should import correctly
- If not, check file paths in `backend/app/services/`

---

## Helper Scripts Created

I've created helper scripts to make this easier:

- **`tools/start_backend.bat`** - Windows batch file (double-click)
- **`tools/start_backend.ps1`** - PowerShell script

These automatically handle port conflicts and start the backend.



