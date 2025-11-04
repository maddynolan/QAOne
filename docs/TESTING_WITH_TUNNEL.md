# Step-by-Step: Testing LLM with DGX Tunnel

This guide walks you through testing the LLM integration using your tunnel to DGX Sparx.

## Prerequisites

✅ **Tunnel is active** - Your tunnel should be running and mapping DGX Ollama to `localhost:31143`  
✅ **Backend is running** - Backend server should be running on `http://localhost:8001`  
✅ **Database is connected** - PostgreSQL/Supabase connection working

---

## Step 1: Verify Tunnel Connection

### 1.1 Test Tunnel Directly

Open a terminal and test the tunnel:

```bash
curl http://localhost:31143/api/tags
```

**Expected Output:**
```json
{
  "models": [
    {
      "name": "qwen2.5:7b-instruct",
      "size": 4765811712,
      ...
    },
    {
      "name": "qwen2.5-coder:14b",
      "size": 7891234567,
      ...
    },
    {
      "name": "qwen2.5-coder:32b",
      "size": 18456789012,
      ...
    }
  ]
}
```

**If this fails:**
- Check your tunnel is still active
- Verify the tunnel port is correct (31143)
- Make sure Ollama is running on DGX

### 1.2 Use Test Script

```bash
python test_dgx_connection.py
```

Or specify the URL:
```bash
python test_dgx_connection.py http://localhost:31143
```

**Expected Output:**
```
============================================================
Testing DGX Ollama Connection
============================================================
Target URL: http://localhost:31143

[1/3] Testing basic connectivity...
  ✅ Connected successfully!

[2/3] Listing available models...
  ✅ Found 3 model(s):
     - qwen2.5:7b-instruct (4.44 GB)
     - qwen2.5-coder:14b (7.35 GB)
     - qwen2.5-coder:32b (17.19 GB)

[3/3] Testing model generation...
  Using model: qwen2.5:7b-instruct
  ✅ Generation successful!
  Response: {"message": "Hello from DGX"}...

============================================================
Connection Test Complete
============================================================
```

---

## Step 2: Configure Backend

### 2.1 Create/Update Backend .env File

Navigate to backend directory:

```bash
cd C:\QAAI\backend
```

Create or edit `.env` file:

```env
OLLAMA_URL=http://localhost:31143
```

### 2.2 Restart Backend

Stop your current backend (Ctrl+C) and restart:

```bash
# If using Python directly
python -m app.main

# Or if using uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### 2.3 Verify Backend Configuration

Check backend health:

```powershell
Invoke-RestMethod -Uri "http://localhost:8001/health"
```

You should see database connection status.

---

## Step 3: Test Test Generation via API

### 3.1 Test Manual Test Generation

Open PowerShell and run:

```powershell
$body = @{
    requirement = "User login functionality with email and password"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "`n=== GENERATION RESULTS ===" -ForegroundColor Green
Write-Host "Status: $($response.status)" -ForegroundColor Cyan
Write-Host "Model Used: $($response.model)" -ForegroundColor Cyan
Write-Host "Test Type: $($response.test_type)" -ForegroundColor Cyan
Write-Host "Test Cases Generated: $($response.count)" -ForegroundColor Cyan
Write-Host "Latency: $($response.latency_ms)ms" -ForegroundColor Cyan
Write-Host "`nTest Cases:" -ForegroundColor Yellow
$response.test_cases | ForEach-Object {
    Write-Host "  - $($_.title)" -ForegroundColor White
}
```

**Expected Output:**
```
=== GENERATION RESULTS ===
Status: success
Model Used: qwen2.5-coder:14b
Test Type: manual
Test Cases Generated: 5
Latency: 2345ms

Test Cases:
  - Valid user login with correct credentials
  - Login fails with incorrect password
  - Login fails with non-existent email
  - Login with empty fields validation
  - Login session timeout handling
```

### 3.2 Test Different Test Types

**API Tests:**
```powershell
$body = @{
    requirement = "REST API for user management - create, read, update, delete users"
    test_type = "api"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated $($response.count) API test cases using model $($response.model)"
```

**Automation Tests:**
```powershell
$body = @{
    requirement = "E-commerce checkout flow"
    test_type = "automation"
    mode = "heavy"  # Use 32B for better quality
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated $($response.count) automation test cases"
```

**Performance Tests:**
```powershell
$body = @{
    requirement = "API endpoint for user search - handle 1000 concurrent requests"
    test_type = "performance"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated $($response.count) performance test cases"
```

**Security Tests:**
```powershell
$body = @{
    requirement = "User authentication system"
    test_type = "security"
    mode = "heavy"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated $($response.count) security test cases"
```

**Accessibility Tests:**
```powershell
$body = @{
    requirement = "Login form with email and password fields"
    test_type = "accessibility"
    mode = "ui"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated $($response.count) accessibility test cases"
```

---

## Step 4: Test Different Models

### 4.1 Test 7B Model (Quick)

```powershell
$body = @{
    requirement = "Simple form validation"
    test_type = "manual"
    mode = "quick"  # Uses 7B model
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model: $($response.model) (should be qwen2.5:7b-instruct)"
Write-Host "Latency: $($response.latency_ms)ms (should be faster)"
```

### 4.2 Test 14B Model (Balanced)

```powershell
$body = @{
    requirement = "User login functionality"
    test_type = "manual"
    mode = "ui"  # Uses 14B model
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model: $($response.model) (should be qwen2.5-coder:14b)"
```

### 4.3 Test 32B Model (High Quality)

```powershell
$body = @{
    requirement = "Complex multi-step workflow with error handling"
    test_type = "manual"
    mode = "heavy"  # Uses 32B model
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Model: $($response.model) (should be qwen2.5-coder:32b)"
Write-Host "Latency: $($response.latency_ms)ms (may be slower but higher quality)"
```

---

## Step 5: Run Evaluation

### 5.1 Generate Golden Set First

```bash
python scripts/generate_golden_set.py
```

This creates `golden.jsonl` with your requirements and test cases.

### 5.2 Run Evaluation on 14B Model

**PowerShell:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

**Command Prompt:**
```cmd
set OLLAMA_URL=http://localhost:31143
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

**Expected Output:**
```
============================================================
LLM Evaluation Harness
============================================================
Model: qwen2.5-coder:14b
Test Type: manual
Golden Set: golden.jsonl
============================================================

Evaluating 50 requirements for manual test generation...
Using model: qwen2.5-coder:14b

[1/50] Evaluating requirement: 001
  [OK] Structure: 92.5%, Diversity: 85.3%, Overlap: 45.2%
[2/50] Evaluating requirement: 002
  [OK] Structure: 88.7%, Diversity: 82.1%, Overlap: 52.3%
...

============================================================
Evaluation Summary
============================================================
Model: qwen2.5-coder:14b
Test Type: manual
Valid JSON: 96.00%
Avg Structure Score: 89.45%
Avg Diversity Score: 83.20%
Avg Overlap Score: 48.75%
Avg Latency: 2345.67ms
```

### 5.3 Compare Models (A/B Test)

**Test 7B:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
python scripts/evaluate_llm.py manual qwen2.5:7b-instruct
```

**Test 14B:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

**Test 32B:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
python scripts/evaluate_llm.py manual qwen2.5-coder:32b
```

Compare the results in `outputs/` directory.

---

## Step 6: Test Convert to Playwright

### 6.1 Convert Manual Test to Automation

```powershell
$testCase = @{
    title = "User login test"
    steps = @(
        @{action = "Navigate to login page"; expectedResult = "Login page loads"}
        @{action = "Enter valid email"; expectedResult = "Email field populated"}
        @{action = "Enter valid password"; expectedResult = "Password field populated"}
        @{action = "Click login button"; expectedResult = "User logged in and redirected"}
    )
} | ConvertTo-Json -Depth 10

$body = @{
    test_case = $testCase
    mode = "ui"
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod -Uri "http://localhost:8001/ai/convert-to-playwright" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Generated Playwright code:" -ForegroundColor Green
Write-Host $response.code
```

---

## Step 7: Monitor Performance

### 7.1 Check Evaluation Summary

```powershell
$summary = Invoke-RestMethod -Uri "http://localhost:8001/ai/evaluation-summary"

Write-Host "Total Generations: $($summary.total_generations)" -ForegroundColor Cyan
Write-Host "`nModels:" -ForegroundColor Yellow
$summary.models.PSObject.Properties | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Value.total_calls) calls, avg latency: $([math]::Round($_.Value.avg_latency_ms, 2))ms"
}
```

---

## Troubleshooting

### Issue: "Connection refused" to localhost:31143

**Solution:**
1. Check your tunnel is still active
2. Verify tunnel is mapping to correct port
3. Test tunnel directly: `curl http://localhost:31143/api/tags`

### Issue: "Timeout" errors

**Solution:**
1. Tunnel may be slow - increase timeout in backend
2. Check network connection to DGX
3. Try smaller model first (7B) to test

### Issue: "Model not found"

**Solution:**
1. Verify models are on DGX: `curl http://localhost:31143/api/tags`
2. Check model names match exactly

### Issue: Backend not using tunnel

**Solution:**
1. Verify `.env` file has `OLLAMA_URL=http://localhost:31143`
2. Restart backend after updating `.env`
3. Check backend logs for Ollama URL being used

---

## Quick Reference

**Tunnel Endpoint:** `http://localhost:31143`

**Backend Config:**
```env
# backend/.env
OLLAMA_URL=http://localhost:31143
```

**Environment Variable:**
```powershell
$env:OLLAMA_URL = "http://localhost:31143"
```

**Test Tunnel:**
```bash
curl http://localhost:31143/api/tags
```

**Test Generation:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{requirement="Test"; test_type="manual"; mode="ui"} | ConvertTo-Json)
```

---

## Next Steps

1. ✅ Test tunnel connection
2. ✅ Configure backend
3. ✅ Test test generation
4. ✅ Run evaluation
5. ✅ Collect training data
6. ✅ Fine-tune models

