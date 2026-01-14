# 🚀 Deploy Fine-Tuned Model to Ollama & Integrate with Website

## Overview

This guide will help you:
1. Convert the trained LoRA model to Ollama format
2. Deploy it to Ollama on DGX Spark
3. Integrate it with your backend
4. Test the integration

---

## Prerequisites

- ✅ Training complete (model saved to `outputs/qa-expert-7b-v1`)
- ✅ Ollama installed on DGX Spark
- ✅ Access to DGX Spark via SSH

---

## Step 1: Deploy Model to Ollama (on DGX Spark)

### Option A: Automated Script (Recommended)

```bash
# SSH to DGX Spark
ssh <user>@<dgx-ip>

# Navigate to model directory
cd ~/qa_finetuning

# Make script executable
chmod +x scripts/deploy_to_ollama_simple.sh

# Run deployment (takes 10-15 minutes)
bash scripts/deploy_to_ollama_simple.sh outputs/qa-expert-7b-v1 qa-expert:7b
```

### Option B: Manual Steps

```bash
# 1. Merge LoRA weights with base model
python3 << EOF
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

base_model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-7B-Instruct",
    torch_dtype=torch.float16,
    device_map="auto"
)

model = PeftModel.from_pretrained(base_model, "outputs/qa-expert-7b-v1")
model = model.merge_and_unload()
model.save_pretrained("outputs/qa-expert-7b-v1_merged")
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct")
tokenizer.save_pretrained("outputs/qa-expert-7b-v1_merged")
EOF

# 2. Create Modelfile
cat > outputs/qa-expert-7b-v1_merged/Modelfile << 'EOF'
FROM ./qa-expert-7b-v1_merged

TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
{{ .Response }}<|im_end|>
"""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096

SYSTEM """You are a senior QA engineer specializing in comprehensive test case generation. 
You understand QA best practices, testing methodologies, and can generate high-quality test cases 
for manual testing, automation, API testing, performance testing, security testing, and accessibility testing.
Always output valid JSON format as requested. Be thorough, accurate, and follow QA industry standards."""
EOF

# 3. Create Ollama model
cd outputs/qa-expert-7b-v1_merged
ollama create qa-expert:7b -f Modelfile

# 4. Verify
ollama list | grep qa-expert
```

### Expected Output

```
✅ Model deployed successfully!
📦 Model Name: qa-expert:7b
📁 Merged Model: ~/qa_finetuning/outputs/qa-expert-7b-v1_merged
```

---

## Step 2: Test Model on DGX Spark

```bash
# Test the model
ollama run qa-expert:7b "Generate test cases for user login functionality"

# Should return valid JSON with test cases
```

---

## Step 3: Update Backend Configuration

### Option A: Environment Variables (Recommended)

Create or update `.env` file in `backend/`:

```bash
# Ollama URL (DGX Spark)
OLLAMA_URL=http://<dgx-ip>:11434

# Enable fine-tuned model
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert:7b
```

### Option B: Direct Code Update

The backend is already configured to use the fine-tuned model when:
- `USE_FINETUNED_MODEL=true` (default)
- `FINETUNED_MODEL_NAME=qa-expert:7b` (default)

The model will be used automatically for:
- `mode="quick"` requests (7B equivalent)
- All test generation requests

---

## Step 4: Restart Backend

```bash
# Stop current backend
# (Ctrl+C if running in terminal)

# Start backend with new configuration
cd backend
python test_simple.py
# or
uvicorn app.main:app --reload --port 8001
```

---

## Step 5: Test Integration

### Test 1: Generate Test Cases via API

```bash
curl -X POST http://localhost:8001/ai/generate-tests \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "Test user login on saucedemo.com",
    "test_type": "automated",
    "context": {
      "app_url": "https://www.saucedemo.com",
      "mode": "quick"
    }
  }'
```

### Test 2: Check Backend Logs

Look for:
```
Using fine-tuned model: qa-expert:7b
```

### Test 3: Test via Frontend

1. Open `http://localhost:8080`
2. Go to "Test Cases" → "Create Test Case"
3. Enter requirements and click "Generate with AI"
4. Check that test cases are generated (should be higher quality)

---

## Step 6: Verify Model is Working

### Check Model Selection

The backend will automatically use the fine-tuned model when:
- `mode="quick"` is specified (or not specified, defaults to quick for test generation)
- `USE_FINETUNED_MODEL=true` (default)

### Monitor Logs

```bash
# Watch backend logs for model selection
# Should see: "Using fine-tuned model: qa-expert:7b"
```

### Compare Quality

Compare outputs:
- **Before:** Base model (`qwen2.5:7b-instruct`)
- **After:** Fine-tuned model (`qa-expert:7b`)

Expected improvements:
- ✅ Higher JSON validity rate (85% → 95%+)
- ✅ Better test case structure
- ✅ More comprehensive coverage
- ✅ Better QA terminology

---

## Troubleshooting

### Issue: Model not found in Ollama

```bash
# Check if model exists
ollama list

# If not found, recreate:
cd ~/qa_finetuning/outputs/qa-expert-7b-v1_merged
ollama create qa-expert:7b -f Modelfile
```

### Issue: Backend can't connect to Ollama

```bash
# Check Ollama is running on DGX Spark
ssh <user>@<dgx-ip> "ollama list"

# Check OLLAMA_URL in backend .env
# Should be: OLLAMA_URL=http://<dgx-ip>:11434
```

### Issue: Model selection not working

```bash
# Check environment variables
echo $USE_FINETUNED_MODEL
echo $FINETUNED_MODEL_NAME

# Check backend logs for model selection messages
```

### Issue: Model too slow

The fine-tuned model should have similar latency to base 7B model. If it's slower:
- Check GPU utilization on DGX Spark
- Verify model is loaded correctly
- Check network latency to DGX Spark

---

## Advanced: A/B Testing

To compare fine-tuned vs base model:

1. **Register models in Model Registry:**
```python
# In backend Python console or script
from app.services.model_registry import model_registry

# Register fine-tuned model
await model_registry.register_model(
    model_id="qa-expert",
    version="v1",
    base_model="Qwen/Qwen2.5-7B-Instruct",
    model_path="qa-expert:7b",
    metrics={"json_validity": 0.95, "approval_rate": 0.85}
)

# Start A/B test
await model_registry.start_ab_test(
    model_id="qa-expert",
    control_version="base",  # Base model
    treatment_version="v1",  # Fine-tuned
    percentage=10  # 10% traffic to fine-tuned
)
```

2. **Monitor results:**
- Check metrics in Model Registry
- Compare JSON validity rates
- Compare user approval rates

---

## Next Steps

1. ✅ **Monitor Performance**
   - Track JSON validity rate
   - Track user approval rate
   - Track generation latency

2. ✅ **Collect Feedback**
   - Rate generated test cases
   - Use "Edit & Improve" for corrections
   - Export new training data

3. ✅ **Iterate**
   - Retrain with new data
   - Deploy improved version
   - A/B test new version

---

## Summary

✅ **Model Deployed:** `qa-expert:7b` in Ollama  
✅ **Backend Updated:** Uses fine-tuned model automatically  
✅ **Ready to Test:** Generate test cases and see improvements!

**Expected Improvements:**
- JSON validity: 85% → 95%+
- Approval rate: 60% → 80%+
- Test quality: More comprehensive, better structure

---

**Questions?** Check backend logs or test the model directly with `ollama run qa-expert:7b`






