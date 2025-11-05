# Restart Backend Server Script
Write-Host "Stopping any existing backend servers..."

# Kill any existing Python processes running uvicorn
Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
    $cmd -like "*uvicorn*" -and $cmd -like "*app.main*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

Write-Host "Clearing Python cache..."
Remove-Item -Path "backend\app\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "backend\app\services\__pycache__" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Starting backend server..."
Set-Location backend
Start-Process -NoNewWindow -FilePath "venv_new\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001" -WorkingDirectory "..\backend"

Start-Sleep -Seconds 3

Write-Host "Checking if server started..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -Method GET -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend server is running!" -ForegroundColor Green
        
        Write-Host "`nChecking routes..."
        $routesResponse = Invoke-WebRequest -Uri "http://localhost:8001/routes" -Method GET -TimeoutSec 5
        $routes = $routesResponse.Content | ConvertFrom-Json
        Write-Host "✓ Found $($routes.count) routes" -ForegroundColor Green
        
        $testRoutes = $routes.routes | Where-Object { $_ -like "*test-case*" -or $_ -like "*test-run*" -or $_ -like "*defect*" }
        if ($testRoutes) {
            Write-Host "`n✓ Test routes found:" -ForegroundColor Green
            $testRoutes | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Host "`n⚠ Warning: Test routes not found in server response" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "✗ Server health check failed: $_" -ForegroundColor Red
}

Set-Location ..


