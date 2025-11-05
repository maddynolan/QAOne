# 🔄 CRITICAL: Restart Backend to Use DGX Spark

## ⚠️ Current Problem

**Backend is NOT using DGX Spark!**

- ✅ `.env` file is configured: `OLLAMA_URL=http://localhost:31143`
- ✅ Tunnel is working (port 31143 accessible)
- ✅ DGX Spark has models ready
- ❌ **Backend is still using old default** (`localhost:11434`)

**Result:** No GPU usage because backend wasn't restarted!

---

## ✅ Solution: Restart Backend

### Step 1: Stop Current Backend

**In the terminal where backend is running:**
- Press `Ctrl+C` to stop

### Step 2: Start Backend Again

```bash
cd backend
python -m app.main
```

**Or if using uvicorn:**
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Step 3: Verify It's Using DGX

**Check backend logs for:**
```
Ollama service initialized with URL: http://localhost:31143
```

**If you see:**
```
Ollama service initialized with URL: http://localhost:11434
```

**Then `.env` isn't being loaded. Check:**
1. `.env` file is in `backend/` directory
2. File has: `OLLAMA_URL=http://localhost:31143`
3. Backend is reading from that directory

---

## 🎯 After Restart

**Test with data collection:**
```bash
python scripts/automated_data_collection.py --count 3 --delay 2.0
```

**On DGX Spark, check GPU:**
```bash
nvidia-smi
```

**You should see:**
- ✅ GPU memory usage increase
- ✅ GPU utilization spike
- ✅ Models loading into GPU memory

---

## ✅ Verification

**Run this to verify:**
```bash
python scripts/verify_dgx_connection.py
```

**Expected output:**
```
✅ Loaded .env from: C:\QAAI\backend\.env
📊 OLLAMA_URL: http://localhost:31143
✅ Connected! Found 3 models:
   - qwen2.5:7b-instruct (4.36 GB)
   - qwen2.5-coder:14b (8.37 GB)
   - nomic-embed-text:latest (0.26 GB)
✅ DGX Spark is accessible!
```

**Then restart backend and check logs!**

