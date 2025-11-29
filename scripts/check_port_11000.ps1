# Check what's using port 11000 on Windows
Write-Host "Checking port 11000..." -ForegroundColor Yellow

# Check if port 11000 is in use
$connections = Get-NetTCPConnection -LocalPort 11000 -ErrorAction SilentlyContinue

if ($connections) {
    Write-Host "`nPort 11000 is in use by:" -ForegroundColor Red
    foreach ($conn in $connections) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  PID: $($conn.OwningProcess)" -ForegroundColor Yellow
            Write-Host "  Process: $($proc.ProcessName)" -ForegroundColor Yellow
            Write-Host "  Path: $($proc.Path)" -ForegroundColor Yellow
            Write-Host "  State: $($conn.State)" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nTo kill the process(es):" -ForegroundColor Cyan
    Write-Host "  Get-NetTCPConnection -LocalPort 11000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }" -ForegroundColor White
} else {
    Write-Host "`nPort 11000 is NOT in use" -ForegroundColor Green
}

# Check SSH connections to DGX
Write-Host "`nChecking SSH connections to DGX Spark..." -ForegroundColor Yellow
$sshProcesses = Get-Process ssh -ErrorAction SilentlyContinue
if ($sshProcesses) {
    Write-Host "Found SSH processes:" -ForegroundColor Yellow
    foreach ($proc in $sshProcesses) {
        Write-Host "  PID: $($proc.Id) | Path: $($proc.Path)" -ForegroundColor Yellow
    }
} else {
    Write-Host "No SSH processes found" -ForegroundColor Red
    Write-Host "You may need to start SSH tunnel:" -ForegroundColor Cyan
    Write-Host "  ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local" -ForegroundColor White
}



