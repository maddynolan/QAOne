# 📍 Model Location Explained

## Quick Answer

**Qwen Coder 3 30B is NOT pre-installed** - it downloads automatically during training from HuggingFace.

---

## Where Model Lives

### For Training (Direct on DGX - NOT Docker)

**Location**: HuggingFace cache on DGX
- **Path**: `~/.cache/huggingface/hub/`
- **Download**: Automatic during first training run
- **Size**: ~60GB
- **Time**: 10-30 minutes (one-time)

**How it works:**
```python
# Training script does this automatically:
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen3-Coder-30B-Instruct"  # Downloads from HuggingFace
)
```

**Impact on Training:**
- ✅ **First run**: Downloads model (~10-30 min delay)
- ✅ **Future runs**: Uses cache (instant)
- ✅ **No Docker needed** for training
- ✅ **Works directly** on DGX

---

### For Inference (Docker vLLM)

**Location**: Finetuned model directory (created during training)
- **Path**: `~/qa_finetuning/outputs/qa-expert-30b-coder/`
- **Size**: ~200-500 MB (LoRA adapters) or ~60GB (merged)
- **Created**: After training completes

**How it works:**
```yaml
# Docker vLLM mounts the finetuned model:
volumes:
  - ~/qa_finetuning/outputs/qa-expert-30b-coder:/models/qa-expert-30b-coder
```

**Impact on Inference:**
- ✅ Uses **finetuned model** (not base model)
- ✅ Docker just serves the finetuned model
- ✅ Base model not needed in Docker

---

## Impact on Training

### ✅ No Impact - Works Perfectly

1. **First Training Run**:
   - Downloads base model from HuggingFace (~60GB)
   - Takes 10-30 minutes
   - Cached for future use

2. **Subsequent Runs**:
   - Uses cached model
   - No download needed
   - Instant start

3. **Training Process**:
   - Model loaded into GPU memory
   - LoRA adapters trained
   - Finetuned model saved

**No changes needed!** ✅

---

## Impact on Model Weight Transfer

### What Gets Created

1. **LoRA Adapters** (small, ~200-500 MB)
   - Location: `~/qa_finetuning/outputs/qa-expert-30b-coder/`
   - Files: `adapter_model.bin`, `adapter_config.json`
   - **Recommended for transfer** ✅

2. **Merged Full Model** (large, ~60GB)
   - Location: `~/qa_finetuning/outputs/qa-expert-30b-coder-weights/`
   - Created by export script
   - Includes base model + adapters

### Transfer Options

#### Option A: Transfer LoRA Adapters Only ✅ Recommended

```bash
# Download only adapters (~500MB)
scp -r madhujanu@spark-d435.local:~/qa_finetuning/outputs/qa-expert-30b-coder ./models/
```

**Pros:**
- ✅ Small size (~500MB)
- ✅ Fast transfer
- ✅ Can merge with base model anywhere
- ✅ Base model downloads automatically

**How to use:**
```python
# Load base model
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen3-Coder-30B-Instruct")

# Load LoRA adapters
model = PeftModel.from_pretrained(model, "./models/qa-expert-30b-coder")
```

#### Option B: Transfer Merged Model

```bash
# Download full model (~60GB)
scp -r madhujanu@spark-d435.local:~/qa_finetuning/outputs/qa-expert-30b-coder-weights ./models/
```

**Pros:**
- ✅ Ready to use (no merging needed)
- ✅ Self-contained

**Cons:**
- ⚠️ Large size (~60GB)
- ⚠️ Slow transfer

---

## Summary

### Training
- ✅ Model downloads automatically from HuggingFace
- ✅ Stored in `~/.cache/huggingface/hub/`
- ✅ No Docker needed
- ✅ Works directly on DGX
- ✅ First run: downloads (~10-30 min)
- ✅ Future runs: uses cache (instant)

### Inference (Docker vLLM)
- ✅ Uses finetuned model (created during training)
- ✅ Base model not needed in Docker
- ✅ Docker just serves the finetuned model

### Transfer
- ✅ **Recommended**: Transfer LoRA adapters only (~500MB)
- ✅ Base model can be downloaded anywhere
- ✅ Or transfer merged model (~60GB) if needed

---

## Check Model Status

Run this to check if model is already cached:

```bash
python scripts/check_model_installation.py
```

---

## Recommendation

**Keep current setup** - it works perfectly:

1. ✅ Training downloads model automatically (one-time)
2. ✅ Model cached for future runs
3. ✅ Transfer LoRA adapters (small, fast)
4. ✅ Docker vLLM uses finetuned model

**No changes needed!** ✅




