# 🔧 Fix: Model 'qa-expert:7b' Not Found

## ❌ Problem

**Error:** `model 'qa-expert:7b' not found`

**Cause:** 
- Backend is configured to use fine-tuned model `qa-expert:7b`
- That model was deleted when you removed old models
- Only `qwen3-coder:30b` is available now

---

## ✅ Solution Applied

**Updated `backend/.env` file:**
```env
OLLAMA_URL=http://localhost:31143
USE_FINETUNED_MODEL=false
FINETUNED_MODEL_NAME=qwen3-coder:30b
```

**What changed:**
- `USE_FINETUNED_MODEL=false` - Disables trying to use deleted fine-tuned model
- `FINETUNED_MODEL_NAME=qwen3-coder:30b` - Sets to available model
- Backend will now use `qwen3-coder:30b` for all modes

---

## 🔄 Backend Auto-Reload

**The backend should auto-reload** (if running with `--reload` flag).

**If it doesn't reload automatically:**
1. Stop backend (Ctrl+C)
2. Restart:
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## ✅ Verify Configuration

**Check backend logs for:**
```
Using qwen3-coder:30b for all modes (7B/14B models deleted)
```

**Or:**
```
[INFO] _SELECT_MODEL - NOT using fine-tuned model
```

---

## 🎯 Try Generating Again

1. **Backend reloaded** (or restarted)
2. **Go to:** http://localhost:8080/cases/create
3. **Fill form and generate** - should work now!

---

## 📋 Summary

- ✅ **.env updated** - Now uses qwen3-coder:30b
- ✅ **Fine-tuned disabled** - Won't try to use deleted model
- ✅ **Backend reloading** - Should pick up new config
- ✅ **Ready to test** - Try generating again!

**The configuration is fixed - try generating a test case now!** 🚀




