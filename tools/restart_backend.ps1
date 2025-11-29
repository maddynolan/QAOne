# PowerShell script to restart Flowstral backend
Write-Host "🔄 Restarting Flowstral Backend..." -ForegroundColor Cyan
Write-Host ""

# Find and kill existing backend processes
Write-Host "Stopping existing backend processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
    $pid = $_.OwningProcess
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "python") {
        Write-Host "  Killing process $pid ($($process.ProcessName))" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

# Start backend
Write-Host ""
Write-Host "Starting backend..." -ForegroundColor Green
cd C:\QAAI\backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Start-Sleep -Seconds 3

# Test if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/docs" -UseBasicParsing -TimeoutSec 3
    Write-Host ""
    Write-Host "✅ Backend is running!" -ForegroundColor Green
    Write-Host "📚 API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "⭐ Flowstral: http://localhost:8000/api/flowstral" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "⚠️  Backend may still be starting. Check the new window." -ForegroundColor Yellow
}



