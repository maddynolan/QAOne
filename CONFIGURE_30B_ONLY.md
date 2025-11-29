# ⚙️ Configure System to Use Only Qwen3-Coder-30B

## Overview

This guide shows how to configure the system to use **only** Qwen3-Coder-30B model and remove/disable the 7B and 14B models.

---

## Step 1: Update Backend Environment Variables

Edit `backend/.env`:

```bash
# ============================================
# Model Configuration - 30B Only
# ============================================

# Fine-tuned model (30B)
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert-30b

# Ollama Configuration
OLLAMA_URL=http://dgx-spark-gb10-ip:11434

# vLLM Configuration (Recommended for 30B)
USE_VLLM=true
VLLM_URL=http://dgx-spark-gb10-ip:8000
VLLM_TIMEOUT=180  # Longer timeout for 30B
VLLM_MAX_CONCURRENT=256

# Use 30B for ALL modes (quick/ui/heavy)
VLLM_MODEL_QUICK=qa-expert-30b
VLLM_MODEL_UI=qa-expert-30b
VLLM_MODEL_HEAVY=qa-expert-30b

# FP8 Quantization (for faster inference)
USE_FP8_QUANTIZATION=true
```

---

## Step 2: Update Service Configuration

### 2.1 Update OllamaService

The service will automatically use 30B when configured above. No code changes needed.

### 2.2 Update vLLMService

The service will use 30B for all modes when `VLLM_MODEL_QUICK`, `VLLM_MODEL_UI`, and `VLLM_MODEL_HEAVY` all point to the same model.

---

## Step 3: Remove Other Models from Ollama (Optional)

### 3.1 On DGX Spark GB10

```bash
# SSH to DGX
ssh your-username@dgx-spark-gb10-ip

# List current models
ollama list

# Remove 7B model
ollama rm qwen2.5:7b-instruct

# Remove 14B model
ollama rm qwen2.5-coder:14b

# Remove old fine-tuned 7B (if exists)
ollama rm qa-expert:7b

# Verify only 30B remains
ollama list
# Should show only: qa-expert-30b
```

### 3.2 Keep Models but Disable Usage

If you want to keep models but not use them, just don't reference them in configuration. The system will only use 30B.

---

## Step 4: Update Model Selection Logic

### 4.1 Current Behavior

With the configuration above:
- **All modes** (`quick`, `ui`, `heavy`) will use **30B model**
- Mode selection still works, but all point to the same model
- This ensures maximum quality for all requests

### 4.2 Verify Model Selection

Check backend logs when making requests:
```
✅ Using trained model: qa-expert-30b
🔍 Model used: qa-expert-30b
```

---

## Step 5: Update Frontend (Optional)

If your frontend has model selection UI, you can:

1. **Hide model selection** (since all use 30B)
2. **Show "Maximum Quality" mode** (all requests use 30B)
3. **Keep mode selection** (but all modes use 30B)

---

## Step 6: Test Configuration

### 6.1 Test API Endpoint

```bash
# Test with "quick" mode (will use 30B)
curl -X POST http://localhost:8001/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login",
    "mode": "quick",
    "context": {"app_url": "https://www.saucedemo.com"}
  }'

# Test with "ui" mode (will use 30B)
curl -X POST http://localhost:8001/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login",
    "mode": "ui",
    "context": {"app_url": "https://www.saucedemo.com"}
  }'

# Test with "heavy" mode (will use 30B)
curl -X POST http://localhost:8001/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login",
    "mode": "heavy",
    "context": {"app_url": "https://www.saucedemo.com"}
  }'
```

### 6.2 Verify All Use 30B

Check response:
```json
{
  "model": "qa-expert-30b",
  "response": "...",
  "latency_ms": 85000
}
```

All requests should show `"model": "qa-expert-30b"` regardless of mode.

---

## Step 7: Performance Considerations

### 7.1 Inference Speed

With 30B only:
- **Single request**: 60-120 seconds
- **With vLLM (parallel)**: 256 requests in 60-120 seconds
- **Throughput**: 5,800+ tokens/second (with parallel requests)

### 7.2 Memory Requirements

- **Inference**: 40GB+ GPU memory
- **vLLM**: Optimized for parallel processing
- **Ollama**: Sequential processing (slower)

### 7.3 Recommendation

**Use vLLM** for 30B model:
- Parallel processing = better throughput
- GPU saturation = efficient resource use
- Handles concurrent requests efficiently

---

## Step 8: Clean Up (Optional)

### 8.1 Remove Old Model Files

```bash
# On DGX, remove old model directories (if not needed)
rm -rf ~/qa_finetuning/outputs/qa-expert-7b-v1
rm -rf ~/qa_finetuning/outputs/qa-expert-14b-coder-v1
```

### 8.2 Update Documentation

Update any documentation that references 7B or 14B models to reflect 30B-only setup.

---

## ✅ Verification Checklist

- [ ] Backend `.env` configured for 30B only
- [ ] All model paths point to `qa-expert-30b`
- [ ] vLLM configured (if using)
- [ ] Other models removed from Ollama (optional)
- [ ] Test requests all use 30B
- [ ] Backend logs show 30B usage
- [ ] Performance acceptable (60-120s per request)
- [ ] vLLM parallel processing working (if enabled)

---

## 🎯 Expected Results

After configuration:
- ✅ All API requests use Qwen3-Coder-30B
- ✅ All modes (quick/ui/heavy) use 30B
- ✅ Maximum quality (98-99% JSON validity)
- ✅ Best code generation
- ✅ Consistent model across all requests
- ✅ vLLM parallel processing (if enabled)

---

## 📊 Model Comparison (Before vs After)

### Before (7B/14B/30B):
- Quick mode: 7B (20-40s)
- UI mode: 14B (40-60s)
- Heavy mode: 30B (60-120s)
- Quality varies by mode

### After (30B Only):
- All modes: 30B (60-120s)
- Consistent maximum quality
- All requests get best model
- Simpler configuration

---

## 🆘 Troubleshooting

### Model Not Found
```bash
# Check if model exists
ollama list | grep qa-expert-30b

# Or for vLLM
docker exec vllm-30b ls /models/
```

### Still Using Old Models
```bash
# Restart backend
cd backend
python -m uvicorn app.main:app --reload

# Check logs
# Should show: "Using trained model: qa-expert-30b"
```

### Performance Issues
```bash
# Use vLLM for parallel processing
USE_VLLM=true

# Enable FP8 quantization
USE_FP8_QUANTIZATION=true
```

---

**System now configured to use only Qwen3-Coder-30B! 🚀**




