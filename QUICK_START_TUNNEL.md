# Quick Start: Testing with DGX Tunnel

Your tunnel is active at `http://localhost:31143`. Follow these steps to test everything.

## ✅ Step 1: Verify Tunnel Works

```bash
curl http://localhost:31143/api/tags
```

You should see your Qwen models listed. If this works, continue!

## ✅ Step 2: Configure Backend

Create/edit `backend/.env` file:

```env
OLLAMA_URL=http://localhost:31143
```

Then restart your backend.

## ✅ Step 3: Run Quick Test Script

```powershell
.\test_tunnel_setup.ps1
```

Or manually:

```powershell
powershell -ExecutionPolicy Bypass -File test_tunnel_setup.ps1
```

This will test:
- ✅ Tunnel connection
- ✅ Backend health
- ✅ Test generation
- ✅ Configuration check

## ✅ Step 4: Test Test Generation

```powershell
$body = @{
    requirement = "User login functionality"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model: $($response.model)"
Write-Host "Test cases: $($response.count)"
```

## ✅ Step 5: Run Evaluation

```powershell
# Set environment variable
$env:OLLAMA_URL = "http://localhost:31143"

# Generate golden set first
python scripts/generate_golden_set.py

# Run evaluation
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

## ✅ All Test Types Available

```powershell
# Manual tests
$body = @{requirement="..."; test_type="manual"; mode="ui"} | ConvertTo-Json

# API tests
$body = @{requirement="..."; test_type="api"; mode="ui"} | ConvertTo-Json

# Automation tests
$body = @{requirement="..."; test_type="automation"; mode="heavy"} | ConvertTo-Json

# Performance tests
$body = @{requirement="..."; test_type="performance"; mode="ui"} | ConvertTo-Json

# Security tests
$body = @{requirement="..."; test_type="security"; mode="heavy"} | ConvertTo-Json

# Accessibility tests
$body = @{requirement="..."; test_type="accessibility"; mode="ui"} | ConvertTo-Json

# Database tests
$body = @{requirement="..."; test_type="database"; mode="ui"} | ConvertTo-Json

# Then call:
Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## 📖 Full Documentation

- **Quick Start:** This file
- **Detailed Steps:** `docs/TESTING_WITH_TUNNEL.md`
- **Tunnel Setup:** `docs/DGX_REMOTE_SETUP.md`
- **Complete Guide:** `docs/STEP_BY_STEP_LLM_GUIDE.md`

## 🎯 Quick Reference

**Tunnel URL:** `http://localhost:31143`

**Backend Config:**
```env
OLLAMA_URL=http://localhost:31143
```

**Environment Variable:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
```

**Test Connection:**
```bash
curl http://localhost:31143/api/tags
```

**Test Script:**
```powershell
.\test_tunnel_setup.ps1
```

---

**Remember:** Keep your tunnel active while using the system!

