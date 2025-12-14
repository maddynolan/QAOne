# Restart Test Website Frontend
Write-Host "=== Restarting Test Website Frontend ===" -ForegroundColor Cyan
Write-Host ""

# Stop existing frontend
Write-Host "Stopping existing frontend..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $connections = Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue
    $connections | Where-Object LocalPort -eq 3000
} | ForEach-Object {
    Write-Host "  Stopping process $($_.Id)..." -ForegroundColor Gray
    Stop-Process -Id $_.Id -Force
}

Start-Sleep -Seconds 2
Write-Host "✅ Frontend stopped" -ForegroundColor Green
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Start frontend
Write-Host "Starting frontend on http://localhost:3000..." -ForegroundColor Cyan
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$PWD'
Write-Host '=== Test Website Frontend ===' -ForegroundColor Cyan
Write-Host 'Starting on http://localhost:3000...' -ForegroundColor Green
Write-Host 'Backend should be on http://localhost:8001' -ForegroundColor Gray
Write-Host ''
npm run dev
"@

Write-Host "✅ Frontend starting in new window..." -ForegroundColor Green
Write-Host ""
Write-Host "Wait 10-15 seconds for frontend to compile, then:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "  2. Check browser console (F12) for any errors" -ForegroundColor White
Write-Host "  3. Verify backend is running on port 8001" -ForegroundColor White
Write-Host ""


