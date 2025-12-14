# PowerShell script to start Test Website (Backend + Frontend)
# Backend: http://localhost:8001
# Frontend: http://localhost:3000

Write-Host "🚀 Starting Test Website..." -ForegroundColor Green
Write-Host ""

# Check if ports are in use
$port8001 = Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($port8001) {
    Write-Host "⚠️  Port 8001 is already in use!" -ForegroundColor Yellow
    $processId = $port8001.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
        $response = Read-Host "Kill this process and start backend? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Stop-Process -Id $processId -Force
            Write-Host "✅ Process killed" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
    }
}

if ($port3000) {
    Write-Host "⚠️  Port 3000 is already in use!" -ForegroundColor Yellow
    $processId = $port3000.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "Process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
        $response = Read-Host "Kill this process and start frontend? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Stop-Process -Id $processId -Force
            Write-Host "✅ Process killed" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
    }
}

Write-Host ""
Write-Host "Starting backend on port 8001..." -ForegroundColor Cyan
cd backend

# Check if venv exists, create if not
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate venv and install dependencies
& "venv\Scripts\Activate.ps1"
pip install -r requirements.txt --quiet

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; .\venv\Scripts\Activate.ps1; python main.py"

cd ..

Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Starting frontend on port 3000..." -ForegroundColor Cyan
cd frontend

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"

cd ..

Write-Host ""
Write-Host "✅ Test Website Starting!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:8001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Yellow
Write-Host "  Admin: admin / Admin@2024!Secure#Test" -ForegroundColor White
Write-Host "  User:  testuser / TestUser@2024!Secure#Pass" -ForegroundColor White
Write-Host ""
Write-Host "Close the PowerShell windows to stop the servers" -ForegroundColor Gray


