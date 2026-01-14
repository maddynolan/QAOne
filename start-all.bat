@echo off
title Flowstral - Start All Services
echo ==========================================
echo    Starting All Flowstral Services
echo ==========================================
echo.

REM Start Backend Server
echo [1/3] Starting Backend Server...
start "Flowstral Backend" cmd /c "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

REM Start Web Frontend
echo [2/3] Starting Web Frontend...
start "Flowstral Web Frontend" cmd /c "cd /d %~dp0 && npm run dev"
timeout /t 5 /nobreak >nul

REM Start Desktop App
echo [3/3] Starting Desktop App...
cd /d %~dp0flowstral-desktop
npm run dev

pause

