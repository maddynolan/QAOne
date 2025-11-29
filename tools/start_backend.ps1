# PowerShell script to start Flowstral backend
# Checks if port 8000 is in use and offers to kill it

Write-Host "⭐ Flowstral Backend Startup" -ForegroundColor Green
Write-Host ""

# Check if port 8000 is in use
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

if ($portInUse) {
    Write-Host "⚠️  Port 8000 is already in use!" -ForegroundColor Yellow
    $processId = $portInUse.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "Process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Yellow
        $response = Read-Host "Kill this process and start backend? (y/n)"
        
        if ($response -eq 'y' -or $response -eq 'Y') {
            Stop-Process -Id $processId -Force
            Write-Host "✅ Process killed" -ForegroundColor Green
            Start-Sleep -Seconds 2
        } else {
            Write-Host "Using alternative port 8001..." -ForegroundColor Yellow
            $port = 8001
        }
    }
} else {
    $port = 8000
}

if (-not $port) {
    $port = 8000
}

Write-Host ""
Write-Host "Starting backend on port $port..." -ForegroundColor Cyan
Write-Host ""

cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port $port --reload



