# Enhanced Flowstral Recording Log Checker
# Usage: .\scripts\check_flowstral_logs.ps1
# Checks logs after Flowstral recording stops

$logFile = "backend\logs\app.log"

if (-not (Test-Path $logFile)) {
    Write-Host "`n❌ Log file not found: $logFile" -ForegroundColor Red
    Write-Host "   Make sure the backend is running and has generated logs." -ForegroundColor Yellow
    exit
}

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Flowstral Recording Log Analysis                        ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Session Management Logs
Write-Host "`n=== Session Start/Stop Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "Session created|Session.*started|stop_session|Session.*stopped|Session.*not found|is_active" -Context 1 | Select-Object -Last 15

# Event Capture Logs
Write-Host "`n=== Event Capture Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "\[CAPTURE\]|Capturing event|Added node|Total nodes|event_type=" -Context 1 | Select-Object -Last 20

# Selector Generation Logs (THE KEY FIX!)
Write-Host "`n=== Selector Generation Logs (Capture Time) ===" -ForegroundColor Green
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "\[SELECTOR\]|playwright_locator|LocatorEngine|Generated selector|getByTestId|getByRole|page\.locator" -Context 2 | Select-Object -Last 25

# Flux Agent Logs (High-Fidelity Generation)
Write-Host "`n=== Flux Agent Logs (Script Generation) ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "\[FLUX\]|Using captured Playwright locator|No captured selector|REJECTED generic|Extracted ID|Extracted name" -Context 1 | Select-Object -Last 20

# Action Graph Logs
Write-Host "`n=== Action Graph Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "Action graph|nodes.*edges|node event types|target_selector|NO NODES" -Context 1 | Select-Object -Last 15

# Artifact Generation Logs
Write-Host "`n=== Artifact Generation Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "Starting artifact generation|Artifact generation completed|generate_all_artifacts|test_cases|playwright_script" -Context 1 | Select-Object -Last 15

# Warnings and Issues
Write-Host "`n=== Warnings and Issues ===" -ForegroundColor Yellow
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "\[WARNING\]|WARNING|fallback|generic role selector|No usable selector" -Context 1 | Select-Object -Last 15

# Errors
Write-Host "`n=== Errors ===" -ForegroundColor Red
Get-Content $logFile -Tail 500 -ErrorAction SilentlyContinue | Select-String -Pattern "Error|Failed|Exception|Traceback|CRITICAL|❌" -Context 1 | Select-Object -Last 10

# Test Case Generation Logs
Write-Host "`n=== Test Case Generation Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "test case|test_design|convert_script|generate_structured|stored_count" -Context 2 | Select-Object -Last 15

# Model Selection Logs (if using LLM)
Write-Host "`n=== Model Selection Logs ===" -ForegroundColor Cyan
Get-Content $logFile -Tail 300 -ErrorAction SilentlyContinue | Select-String -Pattern "_SELECT_MODEL|Using fast|7B|qwen2.5-coder:7b|use_fast_model" -Context 1 | Select-Object -Last 10

# Log File Info
Write-Host "`n=== Log File Info ===" -ForegroundColor Green
$logInfo = Get-Item $logFile
Write-Host "   File: $($logInfo.FullName)"
Write-Host "   Size: $([math]::Round($logInfo.Length / 1KB, 2)) KB"
Write-Host "   Last Modified: $($logInfo.LastWriteTime)"
Write-Host "`nTip: Look for '[SELECTOR]' and '[FLUX]' logs to verify selector generation fix!" -ForegroundColor Yellow

