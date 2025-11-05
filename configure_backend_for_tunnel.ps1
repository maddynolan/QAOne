# Configure Backend for Tunnel
# This script helps set up the backend to use the tunnel

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "Configuring Backend for DGX Tunnel" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

# Check if backend/.env exists
$envFile = "backend\.env"
$envContent = "OLLAMA_URL=http://localhost:31143`n"

if (Test-Path $envFile) {
    Write-Host "`n[1/2] Backend .env file exists" -ForegroundColor Cyan
    $current = Get-Content $envFile -Raw
    
    if ($current -match "OLLAMA_URL") {
        Write-Host "  Found OLLAMA_URL in .env" -ForegroundColor Yellow
        # Update it
        $updated = $current -replace "OLLAMA_URL=.*", "OLLAMA_URL=http://localhost:31143"
        Set-Content -Path $envFile -Value $updated
        Write-Host "  ✅ Updated OLLAMA_URL to http://localhost:31143" -ForegroundColor Green
    } else {
        Write-Host "  Adding OLLAMA_URL..." -ForegroundColor Yellow
        Add-Content -Path $envFile -Value "`n$envContent"
        Write-Host "  ✅ Added OLLAMA_URL to .env" -ForegroundColor Green
    }
} else {
    Write-Host "`n[1/2] Creating backend/.env file..." -ForegroundColor Cyan
    New-Item -Path $envFile -ItemType File -Force | Out-Null
    Set-Content -Path $envFile -Value $envContent
    Write-Host "  ✅ Created backend/.env with OLLAMA_URL=http://localhost:31143" -ForegroundColor Green
}

# Check if python-dotenv is available
Write-Host "`n[2/2] Checking backend dependencies..." -ForegroundColor Cyan
try {
    $check = python -c "import dotenv; print('dotenv available')" 2>&1
    if ($check -match "dotenv available") {
        Write-Host "  ✅ python-dotenv is installed" -ForegroundColor Green
        Write-Host "  Backend will load .env automatically" -ForegroundColor White
    } else {
        Write-Host "  ⚠️  python-dotenv not found" -ForegroundColor Yellow
        Write-Host "  Installing python-dotenv..." -ForegroundColor White
        pip install python-dotenv
    }
} catch {
    Write-Host "  ⚠️  Could not check python-dotenv" -ForegroundColor Yellow
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "Configuration Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "`n⚠️  IMPORTANT: Restart your backend server!" -ForegroundColor Yellow
Write-Host "`nTo restart:" -ForegroundColor Cyan
Write-Host "  1. Stop current backend (Ctrl+C)" -ForegroundColor White
Write-Host "  2. Start backend:" -ForegroundColor White
Write-Host "     cd backend" -ForegroundColor Gray
Write-Host "     python -m app.main" -ForegroundColor Gray
Write-Host "`nOr set environment variable before starting:" -ForegroundColor Cyan
Write-Host "  `$env:OLLAMA_URL = 'http://localhost:31143'" -ForegroundColor White
Write-Host "  cd backend" -ForegroundColor White
Write-Host "  python -m app.main" -ForegroundColor White
Write-Host "`nThen test again:" -ForegroundColor Cyan
Write-Host "  .\test_tunnel_setup.ps1" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green


