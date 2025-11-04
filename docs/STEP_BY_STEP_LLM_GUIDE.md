# Step-by-Step Guide: Using Qwen 2.5 LLM for Test Generation

This guide walks you through using the LLM integration system step by step.

## Prerequisites

1. **Backend server running**: Ensure your backend is running on `http://localhost:8001`
2. **Database connected**: PostgreSQL/Supabase connection working
3. **Ollama running**: Qwen 2.5 models available via Ollama
4. **Requirements in database**: You should have some requirements and test cases already

---

## Step 1: Verify Your Setup

### 1.1 Check Backend is Running

Open a terminal and check:

```bash
curl http://localhost:8001/health
```

You should see a response like:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### 1.2 Check Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

You should see your Qwen models listed. If not, install them:

```bash
ollama pull qwen2.5:7b-instruct
ollama pull qwen2.5-coder:14b
ollama pull qwen2.5-coder:32b
```

### 1.3 Verify Database Connection

```bash
curl http://localhost:8001/health
```

Check that it shows database tables are available.

---

## Step 2: Generate Golden Set (Evaluation Data)

This creates a file with your requirements and human-written test cases for evaluation.

### 2.1 Run the Script

```bash
cd C:\QAAI
python scripts/generate_golden_set.py
```

### 2.2 Expected Output

```
============================================================
Generating Golden Set for LLM Evaluation
============================================================

[1/3] Fetching requirements from database...
Found 50 requirements

[2/3] Fetching test cases from database...
Found 50 test cases

[3/3] Generating golden set...
  [1/50] User Login Functionality: 3 human test(s)
  [2/50] Product Catalog Display: 2 human test(s)
  ...

Writing golden set to golden.jsonl...

============================================================
Golden Set Generation Complete
============================================================
Total requirements: 50
Requirements with human tests: 45
Total human test cases: 120
Output file: golden.jsonl

[OK] Golden set ready for LLM evaluation!
```

### 2.3 Verify Output

Check that `golden.jsonl` was created:

```bash
dir golden.jsonl
```

You can peek at the content:

```bash
type golden.jsonl | more
```

Each line should be a JSON object with a requirement and associated human tests.

---

## Step 3: Evaluate Your LLM Models

This tests how well your Qwen models generate test cases.

### 3.1 Test 7B Model (Quick)

```bash
python scripts/evaluate_llm.py manual qwen2.5:7b-instruct
```

Or use the environment variable:

```bash
set MODEL=qwen2.5:7b-instruct
python scripts/evaluate_llm.py manual
```

### 3.2 Test 14B Model (Balanced)

```bash
python scripts/evaluate_llm.py manual qwen2.5-coder:14b
```

### 3.3 Test 32B Model (High Quality)

```bash
python scripts/evaluate_llm.py manual qwen2.5-coder:32b
```

### 3.4 Expected Output

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

Results saved to: outputs/summary_manual_qwen2.5-coder_14b.json

Pass/Fail Gates:
  [PASS] Valid JSON > 95%
  [PASS] Structure Score > 85
  [PASS] Diversity Score > 80
  [PASS] Overlap Score 30-70

Overall: [PASS]
```

### 3.5 Check Results

View the detailed results:

```bash
type outputs\summary_manual_qwen2.5-coder_14b.json
```

---

## Step 4: Generate Tests via API (Production Use)

Now let's use the LLM to generate tests in your application.

### 4.1 Test the Enhanced Endpoint

Open PowerShell or Command Prompt and run:

```powershell
$body = @{
    requirement = "User login functionality with email and password"
    test_type = "manual"
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

Or using curl (if available):

```bash
curl -X POST http://localhost:8001/ai/generate-tests-enhanced ^
  -H "Content-Type: application/json" ^
  -d "{\"requirement\": \"User login functionality\", \"test_type\": \"manual\", \"mode\": \"ui\"}"
```

### 4.2 Expected Response

```json
{
  "status": "success",
  "test_type": "manual",
  "test_cases": [
    {
      "title": "Valid user login with correct credentials",
      "description": "Verify user can log in with valid email and password",
      "preconditions": ["User account exists", "User is not logged in"],
      "steps": [
        {"action": "Navigate to login page", "expectedResult": "Login page is displayed"},
        {"action": "Enter valid email address", "expectedResult": "Email field is populated"},
        {"action": "Enter valid password", "expectedResult": "Password field is populated"},
        {"action": "Click login button", "expectedResult": "User is redirected to dashboard"}
      ],
      "expected": "User successfully logs in and is redirected to dashboard",
      "priority": "high",
      "tags": ["login", "authentication", "positive"]
    },
    ...
  ],
  "count": 5,
  "model": "qwen2.5-coder:14b",
  "latency_ms": 2345,
  "coverage_hints_applied": [],
  "optimizations": {
    "deduplicated": true,
    "validated": true,
    "retries": 0
  }
}
```

### 4.3 Test Different Test Types

**API Tests:**
```powershell
$body = @{
    requirement = "REST API for user management - create, read, update, delete users"
    test_type = "api"
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Automation Tests:**
```powershell
$body = @{
    requirement = "E-commerce checkout flow"
    test_type = "automation"
    mode = "heavy"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Performance Tests:**
```powershell
$body = @{
    requirement = "API endpoint for user search - handle 1000 concurrent requests"
    test_type = "performance"
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Security Tests:**
```powershell
$body = @{
    requirement = "User authentication system"
    test_type = "security"
    mode = "heavy"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Accessibility Tests:**
```powershell
$body = @{
    requirement = "Login form with email and password fields"
    test_type = "accessibility"
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## Step 5: Integrate into Frontend (Optional)

If you want to add a "Generate with AI" button in your UI:

### 5.1 Example Frontend Code

Add this to your test case creation page:

```typescript
// In your React component
const generateTestsWithAI = async (requirement: string, testType: string) => {
  try {
    const response = await fetch('http://localhost:8001/ai/generate-tests-enhanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requirement: requirement,
        test_type: testType, // 'manual', 'api', 'automation', etc.
        mode: 'ui', // 'quick' (7B), 'ui' (14B), 'heavy' (32B)
        project_id: 'your-project-id',
        org_id: 'your-org-id'
      }),
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      // Use the generated test cases
      console.log(`Generated ${data.count} test cases`);
      console.log(data.test_cases);
      
      // Add to your test cases list
      setTestCases(data.test_cases);
    }
  } catch (error) {
    console.error('Error generating tests:', error);
  }
};
```

### 5.2 Add Button to UI

```tsx
<Button onClick={() => generateTestsWithAI(requirement, 'manual')}>
  Generate Tests with AI (14B)
</Button>

<Button onClick={() => generateTestsWithAI(requirement, 'manual', 'quick')}>
  Quick Generate (7B)
</Button>

<Button onClick={() => generateTestsWithAI(requirement, 'manual', 'heavy')}>
  High Quality (32B)
</Button>
```

---

## Step 6: Collect Training Data

After using the system, collect data for fine-tuning.

### 6.1 Export All AI Generations

```bash
python scripts/export_finetuning_data.py
```

This creates `training_data.jsonl` with all prompts and responses.

### 6.2 Export Specific Model

```bash
python scripts/export_finetuning_data.py --model 14b
```

### 6.3 Review the Data

```bash
type training_data.jsonl | more
```

Each line contains:
```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "prompt..."},
    {"role": "assistant", "content": "generated tests..."}
  ],
  "metadata": {
    "model": "qwen2.5-coder:14b",
    "endpoint": "/ai/generate-tests-enhanced"
  }
}
```

---

## Step 7: Fine-tune Your Models (Advanced)

### 7.1 Prepare Training Data

1. Review `training_data.jsonl`
2. Remove low-quality examples
3. Keep only high-quality, manually reviewed test cases

### 7.2 Fine-tune with Ollama (Easiest)

Create a Modelfile:

```bash
cat > Modelfile << EOF
FROM qwen2.5-coder:14b
PARAMETER temperature 0.7
PARAMETER top_p 0.9
SYSTEM "You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only."
EOF

ollama create qwen2.5-coder:14b-qa-custom -f Modelfile
```

### 7.3 Update Backend to Use Custom Model

Edit `backend/app/services/ollama_service.py`:

```python
self.model_map = {
    ModelMode.QUICK: "qwen2.5-7b-qa-custom",
    ModelMode.UI: "qwen2.5-14b-qa-custom",  # Your fine-tuned model
    ModelMode.HEAVY: "qwen2.5-32b-qa-custom"
}
```

### 7.4 Test Fine-tuned Model

```bash
python scripts/evaluate_llm.py manual qwen2.5-14b-qa-custom
```

Compare with baseline to see improvement.

---

## Step 8: Monitor Performance

### 8.1 Check Evaluation Summary

```bash
curl http://localhost:8001/ai/evaluation-summary
```

Returns statistics:
- Total generations
- Average latency by model
- Calls per endpoint
- Performance metrics

### 8.2 View in Browser

Open: `http://localhost:8001/ai/evaluation-summary`

---

## Common Use Cases

### Use Case 1: Quick Test Generation (7B)

When you need fast results for simple test cases:

```powershell
$body = @{
    requirement = "Simple login form validation"
    test_type = "manual"
    mode = "quick"  # Uses 7B model
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Use Case 2: High Quality Generation (32B)

For complex scenarios requiring best quality:

```powershell
$body = @{
    requirement = "Complex multi-step workflow with error handling"
    test_type = "manual"
    mode = "heavy"  # Uses 32B model
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/generate-tests-enhanced" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Use Case 3: Convert Manual to Automation

```powershell
$testCase = @{
    title = "User login test"
    steps = @(
        @{action = "Navigate to login page"; expectedResult = "Page loads"}
        @{action = "Enter credentials"; expectedResult = "Fields populated"}
        @{action = "Click login"; expectedResult = "User logged in"}
    )
} | ConvertTo-Json

$body = @{
    test_case = $testCase
    mode = "ui"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8001/ai/convert-to-playwright" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## Troubleshooting

### Issue: "Backend server is not running"

**Solution:**
```bash
cd backend
python -m app.main
# Or
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Issue: "Ollama connection failed"

**Solution:**
1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Check OLLAMA_URL environment variable
3. Verify models are pulled: `ollama list`

### Issue: "Invalid JSON response"

**Solution:**
- The system has automatic retry logic
- If it still fails, check the prompt template
- Try a different model (14B or 32B for better JSON)

### Issue: "No test cases generated"

**Solution:**
- Check requirement text is clear and detailed
- Try different test_type
- Use "heavy" mode for better results
- Check backend logs for errors

---

## Next Steps

1. ✅ Generate golden set
2. ✅ Evaluate baseline models
3. ✅ Start generating tests in production
4. ✅ Collect training data
5. ✅ Fine-tune models
6. ✅ Monitor and iterate

---

## Quick Reference

**Endpoints:**
- `POST /ai/generate-tests-enhanced` - Generate tests (all types)
- `POST /ai/convert-to-playwright` - Convert manual to automation
- `GET /ai/evaluation-summary` - Performance metrics

**Test Types:**
- `manual` - Manual test cases
- `automation` - Playwright automation
- `api` - API/REST tests
- `performance` - Load/stress tests
- `security` - Security tests
- `accessibility` - A11y tests
- `database` - Database tests

**Modes:**
- `quick` - 7B model (fast)
- `ui` - 14B model (balanced)
- `heavy` - 32B model (high quality)

---

## Support

If you encounter issues:
1. Check backend logs: `backend/logs/`
2. Check Ollama logs: `ollama logs`
3. Review evaluation results: `outputs/`
4. Check database: `ai_generations` table

