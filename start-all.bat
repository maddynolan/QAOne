@echo off
title Flowstral - Start All Services
echo ==========================================
echo    Starting All Flowstral Services
echo ==========================================
echo.

REM Configuration
set BACKEND_PORT=8000
set FRONTEND_PORT=8080

REM ==========================================
REM [1/3] Backend Server
REM ==========================================
echo [1/3] Checking Backend Server...

netstat -ano | findstr ":%BACKEND_PORT%.*LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Backend already running on port %BACKEND_PORT%
) else (
    echo [*] Starting Backend Server on port %BACKEND_PORT%...
    start "Flowstral Backend" cmd /c "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload"
    timeout /t 3 /nobreak >nul
)

REM ==========================================
REM [2/3] Web Frontend (Vite)
REM ==========================================
echo.
echo [2/3] Checking Web Frontend...

netstat -ano | findstr ":%FRONTEND_PORT%.*LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Frontend already running on port %FRONTEND_PORT%
) else (
    echo [*] Starting Web Frontend on port %FRONTEND_PORT%...
    start "Flowstral Web Frontend" cmd /c "cd /d %~dp0 && set VITE_PORT=%FRONTEND_PORT% && npm run dev -- --port %FRONTEND_PORT%"
    echo [*] Waiting for frontend to start...
    timeout /t 5 /nobreak >nul
)

REM ==========================================
REM [3/3] Desktop App (Electron)
REM ==========================================
echo.
echo [3/3] Starting Desktop App...
echo [*] Connecting to frontend on port %FRONTEND_PORT%

cd /d %~dp0flowstral-desktop

REM Set the dev port so Electron knows where to connect
set FLOWSTRAL_DEV_PORT=%FRONTEND_PORT%

npm run dev

pause
