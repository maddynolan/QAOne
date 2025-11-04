# Quick Test Script for Tunnel Setup
# Tests connection to DGX Ollama via tunnel

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "Testing DGX Tunnel Setup" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

$tunnelUrl = "http://localhost:31143"

# Test 1: Tunnel Connection
Write-Host "`n[1/4] Testing tunnel connection..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$tunnelUrl/api/tags" -TimeoutSec 10
    Write-Host "  ✅ Tunnel connection successful!" -ForegroundColor Green
    Write-Host "  Found $($response.models.Count) model(s):" -ForegroundColor White
    foreach ($model in $response.models) {
        Write-Host "    - $($model.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ Tunnel connection failed!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check tunnel is active" -ForegroundColor White
    Write-Host "  2. Verify tunnel port is 31143" -ForegroundColor White
    Write-Host "  3. Test manually: curl http://localhost:31143/api/tags" -ForegroundColor White
    exit 1
}

# Test 2: Backend Health
Write-Host "`n[2/4] Testing backend health..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5
    Write-Host "  ✅ Backend is running!" -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor White
} catch {
    Write-Host "  ❌ Backend not responding!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Start backend: cd backend; python -m app.main" -ForegroundColor White
    Write-Host "  2. Check backend is on port 8000" -ForegroundColor White
    exit 1
}

# Test 3: Test Generation
Write-Host "`n[3/4] Testing test generation via backend..." -ForegroundColor Cyan
try {
    $body = @{
        requirement = "User login functionality"
        test_type = "manual"
        mode = "ui"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 120

    Write-Host "  ✅ Test generation successful!" -ForegroundColor Green
    Write-Host "  Model used: $($response.model)" -ForegroundColor White
    Write-Host "  Test cases generated: $($response.count)" -ForegroundColor White
    Write-Host "  Latency: $($response.latency_ms)ms" -ForegroundColor White
    
    if ($response.test_cases.Count -gt 0) {
        Write-Host "`n  Sample test cases:" -ForegroundColor Yellow
        foreach ($tc in $response.test_cases[0..2]) {
            Write-Host "    - $($tc.title)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❌ Test generation failed!" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`n  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check backend/.env has: OLLAMA_URL=http://localhost:31143" -ForegroundColor White
    Write-Host "  2. Restart backend after updating .env" -ForegroundColor White
    Write-Host "  3. Check backend logs for errors" -ForegroundColor White
    exit 1
}

# Test 4: Check Backend Configuration
Write-Host "`n[4/4] Checking backend configuration..." -ForegroundColor Cyan
$envFile = "backend\.env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match "OLLAMA_URL=http://localhost:31143") {
        Write-Host "  ✅ Backend .env configured correctly!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Backend .env may not be configured" -ForegroundColor Yellow
        Write-Host "  Please add: OLLAMA_URL=http://localhost:31143" -ForegroundColor White
    }
} else {
    Write-Host "  ⚠️  Backend .env file not found" -ForegroundColor Yellow
    Write-Host "  Create backend/.env with: OLLAMA_URL=http://localhost:31143" -ForegroundColor White
}

# Summary
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "Test Summary" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "✅ Tunnel connection: Working" -ForegroundColor Green
Write-Host "✅ Backend health: Working" -ForegroundColor Green
Write-Host "✅ Test generation: Working" -ForegroundColor Green
Write-Host "`n🎉 Everything is configured correctly!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Run evaluation: `$env:OLLAMA_URL='http://localhost:31143'; python scripts/evaluate_llm.py manual qwen2.5-coder:14b" -ForegroundColor White
Write-Host "  2. Generate golden set: python scripts/generate_golden_set.py" -ForegroundColor White
Write-Host "  3. Start generating tests in production!" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green

