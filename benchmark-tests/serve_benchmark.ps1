# PowerShell script to serve benchmark app

Write-Host "Starting benchmark application server..." -ForegroundColor Cyan
Write-Host "Access at: http://localhost:8080/benchmark-app/index.html" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

Set-Location benchmark-app
python -m http.server 8080

