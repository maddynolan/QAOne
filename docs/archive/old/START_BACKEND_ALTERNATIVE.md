# 🚀 Start Backend - Alternative Solutions

## Port 8001 Issue

The port appears to be in use, but processes were killed. Here are options:

### Option 1: Use Different Port (Easiest)

**Start backend on port 8002:**

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002
```

**Then update frontend to use port 8002, or keep using 8001 if it's actually free.**

### Option 2: Force Kill All Python Processes

**Kill all Python processes (be careful!):**

```powershell
Get-Process python* | Stop-Process -Force
```

**Then restart backend:**
```bash
cd backend
python test_simple.py
```

### Option 3: Check What's Actually Running

**See what processes are using the port:**

```powershell
Get-NetTCPConnection -LocalPort 8001 | Select-Object OwningProcess,State | ForEach-Object {
    $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
        [PSCustomObject]@{
            PID = $_.OwningProcess
            Process = $proc.ProcessName
            State = $_.State
        }
    }
}
```

### Option 4: Restart Computer

**If nothing else works, restart your computer to clear all ports.**

---

## Recommended: Use Port 8002

**Just start on a different port:**

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8002 --host 0.0.0.0
```

**The backend will work the same, just on port 8002 instead of 8001.**

---

## Verify Backend Started

```bash
# Test health endpoint
curl http://localhost:8002/health

# Should return: {"status":"ok",...}
```






