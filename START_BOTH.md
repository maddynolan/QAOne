# 🚀 Start Both Backend & Frontend

## Quick Start (Both Services)

### Terminal 1: Backend
```powershell
cd C:\QAAI\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Backend runs on:** http://localhost:8000

### Terminal 2: Frontend
```powershell
cd C:\QAAI
npm run dev
```

**Frontend runs on:** http://localhost:8080

---

## ✅ Verify Both Are Running

### Backend
- API Docs: http://localhost:8000/docs
- Flowstral API: http://localhost:8000/api/flowstral
- Health: http://localhost:8000/docs (Swagger UI)

### Frontend
- Main App: http://localhost:8080
- Test Cases: http://localhost:8080/cases/create
- Dashboard: http://localhost:8080

---

## 🎯 What You Can Do Now

### Option 1: Use Frontend UI
1. Open http://localhost:8080
2. Navigate to Test Cases or Dashboard
3. Use the full React UI

### Option 2: Use Flowstral Recorder
1. Open `tools/flowstral_recorder.html` in browser
2. Start Flowstral session
3. Record any website
4. Get all 6 artifacts

---

## 🔧 Troubleshooting

### Backend Not Starting?
- Check port 8000 is free: `netstat -ano | findstr :8000`
- Kill existing process: `Get-NetTCPConnection -LocalPort 8000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Or use: `tools\start_backend.ps1`

### Frontend Not Starting?
- Check port 8080 is free: `netstat -ano | findstr :8080`
- Install dependencies: `npm install`
- Check for errors in terminal

### Connection Issues?
- Backend must be on port 8000
- Frontend must be on port 8080
- Check CORS is enabled (already configured)

---

## 📊 Current Status

✅ **Backend:** Running on port 8000  
✅ **Frontend:** Running on port 8080  
✅ **Flowstral:** Ready to use  
✅ **All APIs:** Available

---

## 🎉 You're All Set!

Both services are running. You can now:
- Use the full React frontend at http://localhost:8080
- Use Flowstral recorder for real-time capture
- Access all APIs at http://localhost:8000/docs



