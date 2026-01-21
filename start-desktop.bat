@echo off
title Flowstral Desktop App
echo ==========================================
echo    Starting Flowstral Desktop App
echo ==========================================
echo.

REM Configuration
set FRONTEND_PORT=8080

REM Check if web server is running
echo [*] Checking for web server on port %FRONTEND_PORT%...
netstat -ano | findstr ":%FRONTEND_PORT%.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Web server not running. Starting it first...
    start "Flowstral Web Server" cmd /c "cd /d %~dp0 && npm run dev -- --port %FRONTEND_PORT%"
    echo [*] Waiting for web server to start...
    timeout /t 5 /nobreak >nul
) else (
    echo [OK] Web server already running on port %FRONTEND_PORT%
)

echo.
echo [*] Starting Desktop App...
echo [*] Connecting to frontend on port %FRONTEND_PORT%

cd /d %~dp0flowstral-desktop

REM Set the dev port so Electron knows where to connect
set FLOWSTRAL_DEV_PORT=%FRONTEND_PORT%

npm run dev

pause
