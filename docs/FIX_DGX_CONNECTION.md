# 🔧 Fix: Connect to DGX Spark for GPU Usage

## ⚠️ Problem

**No GPU spike because:** Backend is using `localhost:11434` (your laptop), not DGX Spark!

**Current Status:**
- `OLLAMA_URL` is **NOT SET**
- Defaulting to `http://localhost:11434`
- This means it's trying to use Ollama on your laptop (which doesn't have the models)

---

## ✅ Solution: Configure to Use DGX Spark

### Option 1: Using SSH Tunnel (Recommended)

If you have a tunnel set up to `localhost:31143`:

**Step 1: Create/Update `.env` file**

```bash
cd C:\QAAI\backend
```

Create/edit `.env` file:
```env
# Ollama Configuration - Via Tunnel to DGX Spark
OLLAMA_URL=http://localhost:31143
```

**Step 2: Verify Tunnel is Active**

```bash
# Test tunnel connection
curl http://localhost:31143/api/tags
```

You should see your Qwen models listed.

**Step 3: Restart Backend**

The backend needs to be restarted to pick up the new environment variable.

---

### Option 2: Direct Connection to DGX

If you know the DGX Spark IP address:

**Step 1: Get DGX IP**

On DGX Spark:
```bash
hostname -I
# Or
ip addr show
```

**Step 2: Create/Update `.env` file**

```env
# Ollama Configuration - Direct to DGX Spark
OLLAMA_URL=http://<DGX_IP>:11434
```

For example:
```env
OLLAMA_URL=http://10.0.0.50:11434
```

**Step 3: Test Connection**

```bash
curl http://<DGX_IP>:11434/api/tags
```

**Step 4: Restart Backend**

---

## 🔍 Verify It's Working

### Check Backend Logs

When you start the backend, you should see:
```
Ollama service initialized with URL: http://localhost:31143
```

Or:
```
Ollama service initialized with URL: http://10.0.0.50:11434
```

### Test with a Request

Run the automated collection again:
```bash
python scripts/automated_data_collection.py --count 3 --delay 2.0
```

**Check DGX Spark:**
- GPU usage should spike (nvidia-smi)
- Models should load into GPU memory
- You should see inference happening

---

## 🎯 Quick Fix

**If you have tunnel on port 31143:**

```powershell
# Set environment variable (temporary)
$env:OLLAMA_URL = "http://localhost:31143"

# Or create .env file in backend directory
cd backend
echo "OLLAMA_URL=http://localhost:31143" > .env
```

**Then restart backend!**

---

## 📊 After Fix

Once configured correctly:
- ✅ GPU usage will spike on DGX Spark
- ✅ Models will load into GPU memory
- ✅ You'll see actual inference happening
- ✅ Data collection will use DGX Spark GPUs

**Status:** Currently NOT using DGX Spark - needs configuration!

