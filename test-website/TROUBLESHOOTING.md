# Test Website Troubleshooting Guide

## Issue: Login Failing & No Products Displayed

### Root Cause
The **backend server is not running** on port 8001. The frontend (port 3000) is trying to connect to the backend but can't reach it.

### Solution: Start the Backend

#### Option 1: Quick Start (Recommended)
Open a **new PowerShell terminal** and run:

```powershell
cd C:\QAAI\test-website\backend
.\venv\Scripts\Activate.ps1
python main.py
```

You should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001
```

#### Option 2: Use the Start Script
```powershell
cd C:\QAAI\test-website\backend
.\start_backend.ps1
```

### Verify Backend is Running

1. **Check Health Endpoint:**
   ```powershell
   Invoke-WebRequest http://localhost:8001/health
   ```
   Should return: `{"status": "healthy", ...}`

2. **Check API Docs:**
   Open browser: http://localhost:8001/docs
   Should show Swagger UI

3. **Check Products:**
   ```powershell
   Invoke-WebRequest http://localhost:8001/api/products
   ```
   Should return a list of products

### Test Login

Once backend is running, test login:

```powershell
$body = @{
    username = 'testuser'
    password = 'TestUser@2024!Secure#Pass'
}
$response = Invoke-WebRequest -Uri 'http://localhost:8001/api/auth/login' -Method POST -Body $body -ContentType 'application/x-www-form-urlencoded'
$response.Content
```

Should return a token:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Common Issues

#### 1. Port 8001 Already in Use
```powershell
# Find process using port 8001
Get-NetTCPConnection -LocalPort 8001 | Select-Object OwningProcess

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force
```

#### 2. Virtual Environment Not Found
```powershell
cd C:\QAAI\test-website\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### 3. Dependencies Missing
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### 4. Database Issues
The database (`test_website.db`) is created automatically on first run. If you need to reset:
```powershell
# Delete the database file
Remove-Item test_website.db
# Restart backend (it will recreate)
```

#### 5. Python Not Found
Make sure Python 3.9+ is installed:
```powershell
python --version
```

### Frontend Configuration

The frontend is configured to connect to `http://localhost:8001` by default.

If you need to change it, create a `.env` file in `test-website/frontend/`:
```
VITE_API_URL=http://localhost:8001
```

Then restart the frontend.

### Complete Startup Sequence

**Terminal 1: Backend**
```powershell
cd C:\QAAI\test-website\backend
.\venv\Scripts\Activate.ps1
python main.py
```

**Terminal 2: Frontend** (if not already running)
```powershell
cd C:\QAAI\test-website\frontend
npm run dev
```

### Verify Everything Works

1. ✅ Backend: http://localhost:8001/health
2. ✅ Frontend: http://localhost:3000
3. ✅ Login: Use `testuser` / `TestUser@2024!Secure#Pass`
4. ✅ Products: Should display on Products page

### Still Having Issues?

1. Check browser console (F12) for errors
2. Check backend terminal for error messages
3. Verify both services are running:
   ```powershell
   netstat -ano | findstr ":8001 :3000" | findstr "LISTENING"
   ```

---

**Quick Fix Summary:**
1. Open new terminal
2. `cd C:\QAAI\test-website\backend`
3. `.\venv\Scripts\Activate.ps1`
4. `python main.py`
5. Wait for "Uvicorn running on http://0.0.0.0:8001"
6. Refresh browser at http://localhost:3000


