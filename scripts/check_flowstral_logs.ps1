# Quick script to check Flowstral logs
# Usage: .\scripts\check_flowstral_logs.ps1

$logFile = "backend\logs\app.log"

if (-not (Test-Path $logFile)) {
    Write-Host "`n❌ Log file not found: $logFile" -ForegroundColor Red
    Write-Host "   Make sure the backend is running and has generated logs." -ForegroundColor Yellow
    exit
}

Write-Host "`n=== Flowstral Test Case Generation Logs (Last 50 lines) ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 200 -ErrorAction SilentlyContinue | Select-String -Pattern "flowstral|test case|test_design|convert_script|generate_structured" -Context 2 | Select-Object -Last 20

Write-Host "`n=== Model Selection Logs (7B Model) ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "_SELECT_MODEL|Using fast|7B|qwen2.5-coder:7b|use_fast_model" -Context 1 | Select-Object -Last 15

Write-Host "`n=== Ollama API Response Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "Ollama API Response|Requested.*Actual|MODEL_GATEWAY|TEST_DESIGN_AGENT" -Context 1 | Select-Object -Last 15

Write-Host "`n=== Recent Errors ===" -ForegroundColor Yellow
Get-Content $logFile -Tail 200 -ErrorAction SilentlyContinue | Select-String -Pattern "Error|Failed|Exception|Traceback|not found|fallback" -Context 1 | Select-Object -Last 10

Write-Host "`n=== Log File Info ===" -ForegroundColor Green
$logInfo = Get-Item $logFile
Write-Host "   File: $($logInfo.FullName)"
Write-Host "   Size: $([math]::Round($logInfo.Length / 1KB, 2)) KB"
Write-Host "   Last Modified: $($logInfo.LastWriteTime)"

