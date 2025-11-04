# How to Restart Backend with Tunnel Configuration

## Quick Steps

### Step 1: Stop Current Backend

In the terminal where backend is running, press:
```
Ctrl + C
```

### Step 2: Start Backend Again

```bash
cd backend
python -m app.main
```

The backend will now automatically load `backend/.env` which has:
```
OLLAMA_URL=http://localhost:31143
```

### Step 3: Verify It's Working

In a new terminal, run:

```powershell
.\test_tunnel_setup.ps1
```

Or test manually:

```powershell
$body = @{
    requirement = "User login functionality"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model: $($response.model)"
Write-Host "Test Cases: $($response.count)"
```

## What Was Done

✅ Created `backend/.env` with `OLLAMA_URL=http://localhost:31143`  
✅ Updated `backend/app/main.py` to load `.env` file automatically  
✅ Backend will now use tunnel when restarted

## Check Backend Logs

When you start the backend, you should see:
```
INFO: Loaded environment from: C:\QAAI\backend\.env
```

This confirms it loaded the .env file with the tunnel URL.

