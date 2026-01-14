# 🔍 How to Verify if qa-expert Model is Being Used

## Method 1: Check Backend Logs (Easiest)

When you generate test cases, look for these log messages in your backend console:

### ✅ Using Trained Model:
```
🔍 MODEL USAGE - Mode: quick, Selected: qa-expert:7b, Actual: qa-expert:7b
✅ Using trained model: qa-expert:7b
```

### ⚠️ Using Base Model:
```
🔍 MODEL USAGE - Mode: ui, Selected: qwen2.5-coder:14b, Actual: qwen2.5-coder:14b
⚠️  Using base model: qwen2.5-coder:14b
```

### Where to Find Logs:
- **Terminal/Console**: If running backend with `python -m uvicorn app.main:app --reload`
- **Log File**: Check `backend/logs/app.log` (if logging to file)

## Method 2: Check API Response

The API response includes which model was used:

### Example API Call:
```bash
curl -X POST http://localhost:8000/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login",
    "context": {"mode": "quick"}
  }'
```

### Response Includes:
```json
{
  "status": "success",
  "test_cases": [...],
  "model": "qa-expert:7b",  ← This shows which model was used
  "latency_ms": 1234
}
```

### In Frontend:
Check browser DevTools → Network tab → Response:
```json
{
  "model": "qa-expert:7b"  ← Look for this field
}
```

## Method 3: Run Verification Script

I've created a script to test model selection:

```bash
cd backend
python verify_model_usage.py
```

This will:
- ✅ Show which model is selected for each mode
- ✅ Test actual generation and show which model was used
- ✅ Verify if trained model is being used

### Expected Output:
```
============================================================
Model Selection Verification
============================================================

1. Testing Model Selection:
----------------------------------------------------------------------
   Mode 'quick' → qa-expert:7b                    ✅ TRAINED MODEL
   Mode 'ui'    → qwen2.5-coder:14b               ⚠️  BASE MODEL
   Mode 'heavy' → qwen2.5-coder:32b               ⚠️  BASE MODEL

2. Testing Actual Generation:
----------------------------------------------------------------------

   Generating test case with 'quick' mode...

   ✅ Generation completed!
   Model used: qa-expert:7b
   Is trained model: ✅ YES
```

## Method 4: Add Debug Endpoint

I can add a debug endpoint to check current model configuration:

```python
@app.get("/debug/model-info")
async def get_model_info():
    """Get current model configuration"""
    return {
        "ollama_url": os.getenv("OLLAMA_URL", "http://localhost:11434"),
        "finetuned_model": os.getenv("FINETUNED_MODEL_NAME", "qa-expert:7b"),
        "use_finetuned": os.getenv("USE_FINETUNED_MODEL", "true"),
        "model_selection": {
            "quick": ollama_service._select_model("quick"),
            "ui": ollama_service._select_model("ui"),
            "heavy": ollama_service._select_model("heavy")
        }
    }
```

Then call: `GET http://localhost:8000/debug/model-info`

## Method 5: Monitor Real-Time Usage

### Add to Backend Logging:
The backend now logs model usage for every generation:
- Look for `🔍 MODEL USAGE` messages
- Look for `✅ Using trained model` or `⚠️ Using base model`

### Filter Logs:
```bash
# On Linux/Mac
tail -f backend/logs/app.log | grep "MODEL USAGE"

# On Windows PowerShell
Get-Content backend/logs/app.log -Wait | Select-String "MODEL USAGE"
```

## Quick Test

### Test 1: Generate a Test Case
1. Go to frontend → Create Test Case
2. Click "Generate Test Case with AI"
3. Check backend console for log messages
4. Look for: `✅ Using trained model: qa-expert:7b`

### Test 2: Check API Response
1. Open browser DevTools (F12)
2. Go to Network tab
3. Generate a test case
4. Find the API request (e.g., `/ai/generate-tests`)
5. Check Response → Look for `"model": "qa-expert:7b"`

### Test 3: Run Verification Script
```bash
cd backend
python verify_model_usage.py
```

## What to Look For

### ✅ Signs You're Using Trained Model:
- Log shows: `qa-expert:7b`
- API response includes: `"model": "qa-expert:7b"`
- Mode is `"quick"` (default now)
- Log message: `✅ Using trained model`

### ⚠️ Signs You're Using Base Model:
- Log shows: `qwen2.5:7b-instruct` or `qwen2.5-coder:14b`
- API response includes: `"model": "qwen2.5-coder:14b"`
- Mode is `"ui"` or `"heavy"`
- Log message: `⚠️ Using base model`

## Troubleshooting

### If Not Using Trained Model:

1. **Check Environment Variables:**
   ```bash
   # In .env file
   USE_FINETUNED_MODEL=true
   FINETUNED_MODEL_NAME=qa-expert:7b
   ```

2. **Check Ollama Connection:**
   ```bash
   python backend/check_model_connection.py
   ```

3. **Verify Model is Available:**
   ```bash
   curl http://localhost:31143/api/tags
   # Should list qa-expert:7b
   ```

4. **Check Mode Being Used:**
   - Most endpoints now default to `"quick"` mode
   - If explicitly passing `mode: "ui"`, it will use base model

## Summary

**Easiest Method**: Check backend console logs when generating test cases
- Look for: `✅ Using trained model: qa-expert:7b`

**Most Reliable**: Check API response JSON
- Look for: `"model": "qa-expert:7b"`

**Quick Test**: Run verification script
- `python backend/verify_model_usage.py`






