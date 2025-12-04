# Quick script to check if test runs are being created from Flowstral execution
# Usage: .\check_test_run_creation.ps1

$logFile = "backend\logs\app.log"

if (-not (Test-Path $logFile)) {
    Write-Host "`n❌ Log file not found: $logFile" -ForegroundColor Red
    exit
}

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Flowstral Test Run Creation Check                       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`n=== Flowstral Execute Endpoint Calls ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "\[FLOWSTRAL EXECUTE\]" -Context 1 | Select-Object -Last 30

Write-Host "`n=== Test Run Creation Attempts ===" -ForegroundColor Green
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "Created test run|Failed to create test run|test_run_id|execute_insert.*test_runs" -Context 2 | Select-Object -Last 20

Write-Host "`n=== Test Execution Results ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "Test execution completed|Test execution finished|status=success|status=error" -Context 1 | Select-Object -Last 15

Write-Host "`n=== Errors Related to Test Runs ===" -ForegroundColor Yellow
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "Error.*test run|Failed.*test run|Exception.*test_run" -Context 1 | Select-Object -Last 10

Write-Host "`nTip: If you don't see FLOWSTRAL EXECUTE logs, the endpoint may not be called" -ForegroundColor Yellow
Write-Host "Tip: If you see Failed to create test run, check the error message above" -ForegroundColor Yellow

