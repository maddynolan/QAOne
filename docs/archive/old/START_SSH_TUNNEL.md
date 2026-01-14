# 🚀 Start SSH Tunnel to DGX

## Problem

**Error:** `Cannot connect to host localhost:31143`

**Cause:** SSH tunnel to DGX is not running.

---

## ✅ Solution: Start SSH Tunnel

### Step 1: Open New Terminal/PowerShell

**Keep this terminal open** - the tunnel runs in the foreground.

### Step 2: Start SSH Tunnel

**Run this command:**
```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
```

**Or if using IP:**
```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@192.168.1.233
```

**The tunnel will:**
- Forward local port 31143 → DGX port 11434 (Ollama)
- Run in foreground (keep terminal open)
- Show no output if working correctly

### Step 3: Verify Tunnel is Working

**In another terminal, test:**
```powershell
Invoke-WebRequest http://localhost:31143/api/tags
```

**Should return list of models including `qwen3-coder:30b`**

### Step 4: Keep Tunnel Running

**Keep the SSH tunnel terminal open** while using the app.

**To stop tunnel:** Press Ctrl+C in the tunnel terminal.

---

## ✅ Alternative: Update .env to Use Direct Connection

**If you can access DGX directly (no tunnel needed):**

**Update `backend/.env`:**
```env
# Direct connection (no tunnel)
OLLAMA_URL=http://spark-d435.local:11434

# Model configuration
USE_FINETUNED_MODEL=false
FINETUNED_MODEL_NAME=qwen3-coder:30b
```

**Then restart backend.**

---

## 🎯 Quick Test

**After starting tunnel, test:**
```powershell
# Should return models list
Invoke-WebRequest http://localhost:31143/api/tags
```

**Then try generating test case again!**

---

## 📋 Summary

1. ✅ **Model config updated** - Uses `qwen3-coder:30b`
2. ⚠️ **Start SSH tunnel** - Run: `ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local`
3. ⚠️ **Keep tunnel running** - Don't close that terminal
4. ⚠️ **Test connection** - Verify it works
5. ⚠️ **Try generating** - Should work now!

**Start the SSH tunnel and try again!** 🚀




