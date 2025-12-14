@echo off
echo Starting Test Website...

echo Starting backend server...
cd backend
python -m venv venv 2>nul
call venv\Scripts\activate.bat
pip install -r requirements.txt >nul 2>&1
start cmd /k "python main.py"
cd ..

timeout /t 3 /nobreak >nul

echo Starting frontend server...
cd frontend
call npm install >nul 2>&1
start cmd /k "npm run dev"
cd ..

echo.
echo Backend running on http://localhost:8001
echo Frontend running on http://localhost:3000
echo.
echo Close the command windows to stop the servers
pause



