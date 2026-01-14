# Flowstral Desktop Launcher
# Run this script to start the desktop app

Write-Host "=========================================="
Write-Host "   Starting Flowstral Desktop App"
Write-Host "=========================================="
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Check if web server is running
$webRunning = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue

if (-not $webRunning) {
    Write-Host "[!] Web server not running. Starting it first..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; npm run dev" -WindowStyle Normal
    Write-Host "[*] Waiting for web server to start..."
    Start-Sleep -Seconds 5
} else {
    Write-Host "[OK] Web server already running on port 8080" -ForegroundColor Green
}

Write-Host ""
Write-Host "[*] Starting Desktop App..." -ForegroundColor Cyan

Set-Location "$scriptDir\flowstral-desktop"
npm run dev

