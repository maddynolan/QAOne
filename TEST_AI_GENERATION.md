# 🧪 How to Test AI Generation - Complete Guide

## ✅ Setup Summary

- **Frontend**: `http://localhost:8080` (Vite dev server)
- **Backend**: `http://localhost:8000` (FastAPI)
- **Tunnel**: `http://localhost:31143` (DGX connection)
- **CORS**: Backend allows `localhost:8080` ✅

## 📊 Seeded Data Status

You should have:
- **50 Requirements** (from demo websites like SauceDemo, QA-Practice, etc.)
- **50 Test Cases** (manual, automation, API types)

**To check/seed data:**
```bash
# Check if data exists (via backend)
curl http://localhost:8000/requirements
curl http://localhost:8000/test-cases

# Re-seed if needed (updates port to 8000)
python scripts/seed_realistic_data.py
```

## 🚀 Testing AI Generation - Methods

### Method 1: Via Frontend UI (Recommended)

1. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend will be at `http://localhost:8080`

2. **Generate Test Cases:**
   - Navigate to "Test Cases" page
   - Click "Generate with AI" or "Create Test Case"
   - Enter a requirement (e.g., "User login functionality")
   - Select test type: Manual, Automation, or API
   - Click Generate
   - Wait ~75 seconds for 14B model response

3. **Test Plan Expansion:**
   - Go to "Test Plans" page
   - Select an existing test plan
   - Click "Expand with AI"
   - AI will generate additional test scenarios

### Method 2: Via Backend API (Direct Testing)

#### Example 1: Generate Manual Test Cases

```powershell
$body = @{
    requirement = "User login functionality - As a user, I should be able to log in with valid credentials to access my account"
    test_type = "manual"
    mode = "ui"
    project_id = "11111111-1111-1111-1111-111111111111"
    org_id = "00000000-0000-0000-0000-000000000000"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120

Write-Host "Model: $($response.model)"
Write-Host "Test Cases Generated: $($response.count)"
Write-Host "Latency: $($response.latency_ms)ms"
$response.test_cases | ConvertTo-Json -Depth 10
```

#### Example 2: Generate Automation Test Cases (Playwright)

```powershell
$body = @{
    requirement = "Product search functionality - As a user, I should be able to search for products by name"
    test_type = "automation"
    mode = "ui"
    project_id = "11111111-1111-1111-1111-111111111111"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120

$response.test_cases | ConvertTo-Json -Depth 10
```

#### Example 3: Generate API Test Cases

```powershell
$body = @{
    requirement = "User authentication API - As a system, I should be able to authenticate users via POST /api/login endpoint"
    test_type = "api"
    mode = "quick"  # Use 7B model for faster response
    project_id = "11111111-1111-1111-1111-111111111111"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 90
```

#### Example 4: Generate Performance Tests

```powershell
$body = @{
    requirement = "Load testing for product catalog API - Verify API can handle 1000 concurrent users"
    test_type = "performance"
    mode = "ui"
    project_id = "11111111-1111-1111-1111-111111111111"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120
```

#### Example 5: Generate Security Tests

```powershell
$body = @{
    requirement = "Authentication security - Verify system prevents SQL injection and XSS attacks on login form"
    test_type = "security"
    mode = "ui"
    project_id = "11111111-1111-1111-1111-111111111111"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 120
```

### Method 3: Using cURL (Alternative)

```bash
# Manual test cases
curl -X POST http://localhost:8000/ai/generate-tests-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "User login functionality",
    "test_type": "manual",
    "mode": "ui",
    "project_id": "11111111-1111-1111-1111-111111111111"
  }'
```

## 📝 Test Requirements Examples

### E-commerce Examples
- "User login functionality - As a user, I should be able to log in with valid credentials"
- "Shopping cart management - As a user, I should be able to add, update, and remove items from cart"
- "Checkout process - As a user, I should be able to complete purchase with payment information"
- "Product search - As a user, I should be able to search products by name or category"

### API Examples
- "User authentication API - POST /api/login should authenticate users and return JWT token"
- "Product catalog API - GET /api/products should return paginated list of products"
- "Order management API - POST /api/orders should create new order with validation"

### Performance Examples
- "Load testing for login API - Verify system handles 500 concurrent login requests"
- "Stress testing for product catalog - Verify API performance under 1000 req/s"

### Security Examples
- "Authentication security - Verify protection against SQL injection and XSS"
- "Authorization checks - Verify users can only access their own data"

## 🎯 Model Selection Guide

| Mode | Model | Size | Speed | Use Case |
|------|-------|------|-------|----------|
| `quick` | qwen2.5:7b-instruct | 7B | ~30-40s | Simple test cases, fast iteration |
| `ui` | qwen2.5-coder:14b | 14B | ~75s | ✅ Recommended for most cases |
| `heavy` | qwen2.5-coder:32b | 32B | ~150s+ | Complex test scenarios, best quality |

## 🔍 Verify Your Setup

### 1. Check Backend is Running
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
# Should return: {"status": "ok"}
```

### 2. Check Tunnel Connection
```powershell
Invoke-RestMethod -Uri "http://localhost:31143/api/tags"
# Should return list of available models
```

### 3. Check Seeded Data
```powershell
# Requirements
Invoke-RestMethod -Uri "http://localhost:8000/requirements"

# Test Cases
Invoke-RestMethod -Uri "http://localhost:8000/test-cases"
```

### 4. Run Full Test Suite
```powershell
.\test_tunnel_setup.ps1
```

## 🐛 Troubleshooting

### AI Generation Fails
1. Check backend logs for errors
2. Verify tunnel is still active
3. Check `backend/.env` has `OLLAMA_URL=http://localhost:31143`
4. Restart backend if needed

### Frontend Can't Connect
1. Verify backend CORS allows `localhost:8080`
2. Check frontend is using `http://localhost:8000` (not 8001)
3. Check browser console for errors

### Slow Response Times
- 14B model: ~75 seconds is normal
- Use `mode: "quick"` for 7B model (~30-40s)
- Consider using smaller requirements for faster generation

## 📊 Expected Response Format

```json
{
  "status": "success",
  "test_type": "manual",
  "test_cases": [
    {
      "title": "Successful Login with Valid Credentials",
      "description": "Verify user can log in with valid credentials",
      "preconditions": ["User account exists", "User is on login page"],
      "steps": [
        {"action": "Enter username", "expectedResult": "Username field populated"},
        {"action": "Enter password", "expectedResult": "Password field populated"},
        {"action": "Click login", "expectedResult": "User redirected to dashboard"}
      ],
      "expected": "User successfully logs in and accesses account",
      "priority": "high",
      "tags": ["login", "authentication"]
    }
  ],
  "count": 6,
  "model": "qwen2.5-coder:14b",
  "latency_ms": 75408,
  "coverage_hints_applied": [],
  "optimizations": {
    "deduplicated": true,
    "validated": true,
    "retries": 0
  }
}
```

## 🎉 You're Ready!

Your setup is complete. Start generating test cases via:
1. **Frontend UI** at `http://localhost:8080` (easiest)
2. **Backend API** using PowerShell examples above
3. **cURL** for command-line testing

All AI requests will route through DGX tunnel to use powerful models! 🚀

