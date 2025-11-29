# Fix port 11000 connection error to DGX Spark
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Port 11000 Connection Error Fix" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# The error is likely on the DGX side, not Windows
Write-Host "The error 'problem opening port 11000' is likely on DGX Spark, not Windows." -ForegroundColor Yellow
Write-Host ""

Write-Host "Solution 1: Check what's using port 11000 on DGX" -ForegroundColor Green
Write-Host "  SSH to DGX and run:" -ForegroundColor White
Write-Host "    ssh madhujanu@spark-d435.local" -ForegroundColor Gray
Write-Host "    sudo lsof -i :11000" -ForegroundColor Gray
Write-Host "    # Or" -ForegroundColor Gray
Write-Host "    sudo netstat -tlnp | grep 11000" -ForegroundColor Gray
Write-Host ""

Write-Host "Solution 2: Kill process using port 11000 on DGX" -ForegroundColor Green
Write-Host "  On DGX, run:" -ForegroundColor White
Write-Host "    sudo lsof -ti:11000 | xargs kill -9" -ForegroundColor Gray
Write-Host ""

Write-Host "Solution 3: Check if it's a Jupyter notebook" -ForegroundColor Green
Write-Host "  On DGX, check for Jupyter:" -ForegroundColor White
Write-Host "    ps aux | grep jupyter" -ForegroundColor Gray
Write-Host "    # If found, kill it:" -ForegroundColor Gray
Write-Host "    pkill -f jupyter" -ForegroundColor Gray
Write-Host ""

Write-Host "Solution 4: Use a different port" -ForegroundColor Green
Write-Host "  If you're trying to start a service on port 11000," -ForegroundColor White
Write-Host "  use a different port instead (e.g., 11001, 12000)" -ForegroundColor White
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Quick Fix: SSH to DGX and check" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run this command to check DGX:" -ForegroundColor White
Write-Host "  ssh madhujanu@spark-d435.local 'sudo lsof -i :11000 || echo Port 11000 is free'" -ForegroundColor Gray
Write-Host ""



