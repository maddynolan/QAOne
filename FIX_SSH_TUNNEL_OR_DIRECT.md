# 🔧 Fix: Ollama Connection - SSH Tunnel or Direct Connection

## ❌ Problem

**Error:** `Cannot connect to host localhost:31143`

**Cause:** SSH tunnel to DGX is not running, or need to connect directly.

---

## ✅ Solution Options

### Option 1: Start SSH Tunnel (If DGX not directly accessible)

**Start SSH tunnel:**
```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
```

**Or if using IP:**
```powershell
ssh -N -L 31143:127.0.0.1:11434 madhujanu@192.168.1.233
```

**Keep this terminal open** - tunnel runs in foreground.

**Then test:**
```powershell
Invoke-WebRequest http://localhost:31143/api/tags
```

---

### Option 2: Connect Directly to DGX (If accessible)

**Update `backend/.env`:**
```env
# Direct connection to DGX (no tunnel needed)
OLLAMA_URL=http://spark-d435.local:11434

# Or if using IP:
# OLLAMA_URL=http://192.168.1.233:11434

# Model configuration
USE_FINETUNED_MODEL=false
FINETUNED_MODEL_NAME=qwen3-coder:30b
```

**Then restart backend.**

---

### Option 3: Use Local Ollama (If installed locally)

**Update `backend/.env`:**
```env
OLLAMA_URL=http://localhost:11434
USE_FINETUNED_MODEL=false
FINETUNED_MODEL_NAME=qwen3-coder:30b
```

**Make sure Ollama is running locally:**
```powershell
# Check if Ollama is running
Get-Process ollama -ErrorAction SilentlyContinue

# If not, start Ollama service
```

---

## 🎯 Quick Fix Steps

### Step 1: Check What's Available

**Test SSH tunnel:**
```powershell
Invoke-WebRequest http://localhost:31143/api/tags
```

**Test direct DGX:**
```powershell
Invoke-WebRequest http://spark-d435.local:11434/api/tags
```

**Test local Ollama:**
```powershell
Invoke-WebRequest http://localhost:11434/api/tags
```

### Step 2: Update .env Based on What Works

**If SSH tunnel works:**
- Keep `OLLAMA_URL=http://localhost:31143`
- Make sure tunnel is running

**If direct DGX works:**
- Change to `OLLAMA_URL=http://spark-d435.local:11434`

**If local Ollama works:**
- Change to `OLLAMA_URL=http://localhost:11434`

### Step 3: Update Model Name

**In `backend/.env`, set:**
```env
FINETUNED_MODEL_NAME=qwen3-coder:30b
USE_FINETUNED_MODEL=false
```

**Or if you want to use fine-tuned version:**
```env
FINETUNED_MODEL_NAME=qwen3-coder:30b
USE_FINETUNED_MODEL=true
```

### Step 4: Restart Backend

**Backend should auto-reload, but if not:**
1. Stop backend (Ctrl+C)
2. Restart:
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## ✅ Verify It Works

**Test Ollama connection:**
```powershell
# Should return list of models including qwen3-coder:30b
Invoke-WebRequest http://localhost:31143/api/tags
# OR
Invoke-WebRequest http://spark-d435.local:11434/api/tags
```

**Then try generating a test case again!**

---

## 📋 Summary

1. ✅ **Model config updated** - Now uses `qwen3-coder:30b`
2. ⚠️ **SSH tunnel** - Start it OR use direct connection
3. ⚠️ **Update .env** - Set correct OLLAMA_URL
4. ⚠️ **Restart backend** - If needed

**Choose the connection method that works for you!** 🚀




