# 🔧 Fix: "Failed to generate test case: Fetch error"

## ❌ Problem

The frontend is trying to call the backend API at `http://localhost:8000` but the backend is not responding.

**Error:** `Failed to generate test case: Fetch error`

---

## ✅ Solution

### Step 1: Start the Backend

The backend needs to be running on port 8000.

**Start Backend:**
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Or if you have a virtual environment:**
```powershell
cd backend
.\venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Step 2: Verify Backend is Running

**Test backend health:**
```powershell
Invoke-WebRequest http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "message": "Service is running"
}
```

---

### Step 3: Check Frontend Connection

**Frontend is calling:**
- `http://localhost:8000/ai/generate-tests-enhanced`

**Make sure:**
- ✅ Backend is running on port 8000
- ✅ No firewall blocking port 8000
- ✅ Backend terminal shows "Uvicorn running on http://0.0.0.0:8000"

---

## 🐛 Common Issues

### Issue 1: Port 8000 Already in Use

**Error:** `Address already in use`

**Solution:**
```powershell
# Find what's using port 8000
Get-NetTCPConnection -LocalPort 8000

# Kill the process (replace PID with actual process ID)
Stop-Process -Id <PID> -Force

# Or use a different port
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**Then update frontend:**
- Change `http://localhost:8000` to `http://localhost:8001` in `src/pages/CreateTestCase.tsx`

---

### Issue 2: Backend Dependencies Missing

**Error:** `ModuleNotFoundError`

**Solution:**
```powershell
cd backend
pip install -r requirements.txt
```

---

### Issue 3: CORS Error

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:**
The backend already has CORS configured. If you see this error:
1. Check backend is running
2. Check backend logs for CORS errors
3. Verify `backend/app/main.py` has CORS middleware

---

## ✅ Quick Fix Checklist

- [ ] Backend is running (check terminal)
- [ ] Backend responds to `http://localhost:8000/health`
- [ ] Frontend is calling `http://localhost:8000/ai/generate-tests-enhanced`
- [ ] No firewall blocking port 8000
- [ ] Backend dependencies installed

---

## 🚀 After Backend Starts

1. **Verify backend is running:**
   ```powershell
   Invoke-WebRequest http://localhost:8000/health
   ```

2. **Try generating test case again:**
   - Go to: http://localhost:8080/cases/create
   - Fill in form
   - Click "Generate Test Case with AI"
   - Should work now!

---

## 📋 Both Servers Should Be Running

**Terminal 1 - Backend:**
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
**URL:** http://localhost:8000

**Terminal 2 - Frontend:**
```powershell
npm run dev
```
**URL:** http://localhost:8080

---

## 🎯 Test It

1. **Backend health:**
   ```powershell
   Invoke-WebRequest http://localhost:8000/health
   ```

2. **Frontend:**
   - Open: http://localhost:8080/cases/create
   - Fill form
   - Generate test case
   - Should work!

---

**The backend is starting now. Wait a few seconds and try again!** 🚀




