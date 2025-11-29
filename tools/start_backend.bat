@echo off
echo ⭐ Flowstral Backend Startup
echo.

REM Check if port 8000 is in use
netstat -ano | findstr :8000 >nul
if %errorlevel% == 0 (
    echo ⚠️  Port 8000 is already in use!
    echo.
    echo Killing process on port 8000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

echo.
echo Starting backend on port 8000...
echo.

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause



