# 🔄 Backend Restart Required
## Load New Model Registry Endpoints

**Issue:** `/ai/models` returns "Not Found"  
**Cause:** Backend needs restart to load new endpoints  
**Solution:** Restart backend server

---

## Quick Fix

### Option 1: Restart Backend (Recommended)

**Stop current backend:**
- Press `Ctrl+C` in the terminal running the backend

**Start backend:**
```bash
cd backend
python -m app.main
```

Or if using uvicorn directly:
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

---

### Option 2: Use PowerShell Script

```powershell
.\restart_backend.ps1
```

---

## Verify Endpoints

After restart, test:

```bash
# Should return list of models (empty initially)
curl http://localhost:8001/ai/models

# Should return model info (404 if no models registered yet)
curl http://localhost:8001/ai/models/qa-expert
```

**Expected Response:**
```json
{
  "status": "success",
  "models": []
}
```

(Empty because no models registered yet - that's normal!)

---

## New Endpoints Available After Restart

- ✅ `GET /ai/models` - List all models
- ✅ `GET /ai/models/{model_id}` - Get model info
- ✅ `POST /ai/models/register` - Register model
- ✅ `POST /ai/models/{model_id}/deploy` - Deploy model
- ✅ `POST /ai/models/{model_id}/ab-test` - Start A/B test
- ✅ `POST /ai/models/{model_id}/rollback` - Rollback model

---

**Restart your backend and the endpoints will work!** 🚀

