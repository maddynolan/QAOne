# 🚀 Start SSH Tunnel from Windows (Correct Way)

## ❌ What You Did Wrong

**You tried to run the tunnel command ON the DGX:**
```bash
# DON'T run this on DGX!
ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
```

**This doesn't work because:**
- You're already ON the DGX
- You can't create a tunnel from DGX to itself
- The tunnel needs to be created from Windows TO DGX

---

## ✅ Correct Way: Start from Windows

### Step 1: On Your Windows Machine

**Open PowerShell on Windows (not on DGX!)**

### Step 2: Run Tunnel Command

```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
```

**What this does:**
- Creates SSH connection from Windows → DGX
- Forwards Windows `localhost:31143` → DGX `localhost:11434`
- Allows your backend (on Windows) to connect to Ollama (on DGX)

### Step 3: Keep Terminal Open

**The tunnel runs in foreground - keep that PowerShell window open!**

**You'll see:**
- No output (that's normal)
- Terminal stays active
- Tunnel is working

**To stop tunnel:** Press Ctrl+C in that terminal

---

## ✅ Verify Tunnel Works

**In another PowerShell window (on Windows), test:**
```powershell
Invoke-WebRequest http://localhost:31143/api/tags
```

**Should return:**
```json
{
  "models": [
    {
      "name": "qwen3-coder:30b",
      "size": 18556700761,
      ...
    }
  ]
}
```

---

## ✅ Then Try Generating Test Case

1. **Tunnel running** (keep terminal open)
2. **Go to:** http://localhost:8080/cases/create
3. **Fill form and generate** - should work!

---

## 🔍 If Port Already in Use

**If you get "Address already in use":**

**Check what's using port 31143:**
```powershell
Get-NetTCPConnection -LocalPort 31143
```

**Kill the process if needed:**
```powershell
# Find process ID
$conn = Get-NetTCPConnection -LocalPort 31143
Stop-Process -Id $conn.OwningProcess -Force
```

**Then start tunnel again.**

---

## 📋 Summary

- ❌ **Don't run on DGX** - you're already there
- ✅ **Run on Windows** - creates connection Windows → DGX
- ✅ **Keep terminal open** - tunnel runs in foreground
- ✅ **Test connection** - verify it works
- ✅ **Then generate** - should work!

**Start the tunnel from Windows PowerShell, not from DGX!** 🚀




