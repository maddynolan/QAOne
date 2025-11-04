# How to Run Tunnel Setup Test

## Quick Start

### Option 1: PowerShell (Recommended)

Open PowerShell and run:

```powershell
.\test_tunnel_setup.ps1
```

If you get an execution policy error, use:

```powershell
powershell -ExecutionPolicy Bypass -File test_tunnel_setup.ps1
```

### Option 2: From Any Directory

If you're not in the project root, navigate first:

```powershell
cd C:\QAAI
.\test_tunnel_setup.ps1
```

## What the Test Does

The script tests 4 things:

1. **Tunnel Connection** - Verifies connection to DGX Ollama via tunnel (port 31143)
2. **Backend Health** - Checks if backend is running on port 8000
3. **Test Generation** - Tests AI test generation via backend
4. **Configuration** - Verifies backend/.env file is set up correctly

## Expected Output

If everything is working, you'll see:

```
============================================================
Testing DGX Tunnel Setup
============================================================

[1/4] Testing tunnel connection...
  ✅ Tunnel connection successful!
  Found 2 model(s):
    - qwen2.5-coder:14b
    - qwen2.5:7b-instruct

[2/4] Testing backend health...
  ✅ Backend is running!
  Status: ok

[3/4] Testing test generation via backend...
  ✅ Test generation successful!
  Model used: qwen2.5-coder:14b
  Test cases generated: 4
  Latency: 5234ms

[4/4] Checking backend configuration...
  ✅ Backend .env configured correctly!

============================================================
Test Summary
============================================================
✅ Tunnel connection: Working
✅ Backend health: Working
✅ Test generation: Working

🎉 Everything is configured correctly!
```

## Troubleshooting

### Execution Policy Error

If you see:
```
cannot be loaded because running scripts is disabled on this system
```

Use:
```powershell
powershell -ExecutionPolicy Bypass -File test_tunnel_setup.ps1
```

### Backend Not Responding

If backend health check fails:
1. Make sure backend is running: `cd backend; python -m app.main`
2. Check backend is on port 8000 (not 8001)
3. Verify backend started without errors

### Tunnel Connection Failed

If tunnel test fails:
1. Check tunnel is active (should see connection in tunnel terminal)
2. Verify tunnel port is 31143
3. Test manually: `curl http://localhost:31143/api/tags`

### Test Generation Failed

If test generation returns 500 error:
1. Restart backend after creating/updating `.env` file
2. Check `backend/.env` has: `OLLAMA_URL=http://localhost:31143`
3. Look at backend logs for error details

## Manual Testing

You can also test individual components:

### Test Tunnel
```powershell
Invoke-RestMethod -Uri "http://localhost:31143/api/tags"
```

### Test Backend Health
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

### Test Test Generation
```powershell
$body = @{
    requirement = "User login functionality"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```
