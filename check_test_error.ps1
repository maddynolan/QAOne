# Quick script to check latest test execution errors
Write-Host "Checking latest test execution errors..." -ForegroundColor Yellow
Write-Host ""

# Get last 200 lines of log
$logContent = Get-Content backend\logs\app.log -Tail 200

# Look for error patterns
$errors = $logContent | Select-String -Pattern "error|failed|timeout|not.*found|element.*not|Join.*donor|getByText" -Context 2

if ($errors) {
    Write-Host "Found errors:" -ForegroundColor Red
    $errors | ForEach-Object {
        Write-Host $_.Line -ForegroundColor Red
        if ($_.Context.PreContext) {
            Write-Host "  Context before: $($_.Context.PreContext[0])" -ForegroundColor Gray
        }
        if ($_.Context.PostContext) {
            Write-Host "  Context after: $($_.Context.PostContext[0])" -ForegroundColor Gray
        }
        Write-Host ""
    }
} else {
    Write-Host "No obvious errors found in last 200 lines" -ForegroundColor Green
    Write-Host ""
    Write-Host "Last 20 lines of log:" -ForegroundColor Yellow
    $logContent | Select-Object -Last 20
}
