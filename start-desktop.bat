@echo off
title Flowstral Desktop App
echo ==========================================
echo    Starting Flowstral Desktop App
echo ==========================================
echo.

REM Check if web server is running on port 8080
netstat -an | findstr ":8080.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Web server not running. Starting it first...
    start "Flowstral Web Server" cmd /c "cd /d %~dp0 && npm run dev"
    echo [*] Waiting for web server to start...
    timeout /t 5 /nobreak >nul
) else (
    echo [OK] Web server already running on port 8080
)

echo.
echo [*] Starting Desktop App...
cd /d %~dp0flowstral-desktop
npm run dev

pause

