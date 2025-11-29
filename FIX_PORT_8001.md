# 🔧 Fix Port 8001 Already in Use

## Problem
Port 8001 is already in use by another process.

## Solutions

### Option 1: Kill the Existing Process (Recommended)

**Find and kill the process:**

```powershell
# Find process using port 8001
netstat -ano | findstr :8001

# You'll see something like:
# TCP    0.0.0.0:8001           0.0.0.0:0              LISTENING       10580
# The last number (10580) is the PID

# Kill the process
taskkill /PID 10580 /F
```

**Or use PowerShell:**
```powershell
# Find and kill in one command
Get-NetTCPConnection -LocalPort 8001 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Option 2: Use a Different Port

**Change the port in your backend startup:**

```bash
# Instead of default 8001, use 8002
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

**Or update test_simple.py to use a different port.**

### Option 3: Check if Backend is Already Running

**Maybe the backend is already running! Check:**

```powershell
# Check if Python process is running
Get-Process python* | Where-Object {$_.MainWindowTitle -like "*uvicorn*"}

# Or check all Python processes
Get-Process python*
```

If it's already running, you can:
- Use the existing instance
- Or stop it and restart

---

## Quick Fix Script

**Run this in PowerShell:**

```powershell
# Kill any process on port 8001
$port = 8001
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($process) {
    Write-Host "Killing process $process on port $port"
    Stop-Process -Id $process -Force
    Start-Sleep -Seconds 2
    Write-Host "✅ Port $port is now free"
} else {
    Write-Host "Port $port is already free"
}
```

---

## After Fixing

**Restart your backend:**

```bash
cd backend
python test_simple.py
```

**Or:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8001
```

---

## Verify Backend is Running

```bash
# Test health endpoint
curl http://localhost:8001/health

# Should return: {"status":"ok",...}
```






