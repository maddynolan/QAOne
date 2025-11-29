# 🔧 Setup Backend Environment Variables

## Quick Setup

### Step 1: Find Your DGX Spark IP

**On DGX Spark, run:**
```bash
hostname -I
```

You'll get something like: `192.168.39.185`

### Step 2: Create/Update .env File

**On your local machine, in the `backend/` directory:**

```bash
cd backend

# Create .env file (or edit if exists)
cat > .env << EOF
# Ollama Configuration (DGX Spark)
OLLAMA_URL=http://192.168.39.185:11434

# Fine-Tuned Model Configuration
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert:7b
EOF
```

**Replace `192.168.39.185` with your actual DGX Spark IP!**

### Step 3: Verify .env File

```bash
cat backend/.env
```

Should show:
```
OLLAMA_URL=http://<your-dgx-ip>:11434
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert:7b
```

### Step 4: Restart Backend

```bash
# Stop current backend (Ctrl+C)

# Start backend
cd backend
python test_simple.py
```

**Look for these log messages:**
```
Fine-tuned model enabled: qa-expert:7b (for quick mode)
Using Ollama at: http://<dgx-ip>:11434
```

---

## Test the Integration

### Quick API Test

```bash
curl -X POST http://localhost:8001/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login",
    "test_type": "automated",
    "context": {"mode": "quick", "app_url": "https://www.saucedemo.com"}
  }'
```

### Frontend Test

1. Open `http://localhost:8080`
2. Go to "Test Cases" → "Create Test Case"
3. Enter requirements
4. Click "Generate with AI"
5. Check that test cases are generated (should be higher quality now!)

---

## Troubleshooting

### Can't Connect to Ollama

```bash
# Test connection
curl http://<dgx-ip>:11434/api/tags

# If fails, check:
# 1. Ollama is running on DGX: ssh to DGX and run "ollama list"
# 2. Firewall allows port 11434
# 3. OLLAMA_URL in .env is correct
```

### Wrong Model Being Used

Check backend logs for:
```
Using fine-tuned model: qa-expert:7b
```

If you see base model instead, verify:
- `.env` file exists and has correct values
- Backend was restarted after creating .env
- `USE_FINETUNED_MODEL=true` (not "True" or "1")

---

## Success!

Once you see "Using fine-tuned model: qa-expert:7b" in logs, you're all set! 🎉






