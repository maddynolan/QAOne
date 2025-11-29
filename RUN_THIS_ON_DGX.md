# 🚀 Run This on DGX Spark - Complete Deployment

## Single Command Deployment

**Copy and paste this entire block on DGX Spark:**

```bash
cd ~/qa_finetuning && \
cat > deploy_complete.sh << 'DEPLOY_EOF'
#!/bin/bash
set -e
MODEL_DIR="${1:-outputs/qa-expert-7b-v1}"
MODEL_NAME="${2:-qa-expert:7b}"
MERGED_DIR="${MODEL_DIR}_merged"

echo "============================================================"
echo "🚀 Complete Fine-Tuned Model Deployment"
echo "============================================================"
echo "Model: $MODEL_DIR → $MODEL_NAME"
echo ""

# Check prerequisites
[ ! -d "$MODEL_DIR" ] && echo "❌ Model not found: $MODEL_DIR" && exit 1
command -v ollama >/dev/null || (echo "❌ Ollama not found" && exit 1)

# Step 1: Merge LoRA
if [ ! -d "$MERGED_DIR" ]; then
    echo "Step 1: Merging LoRA (10-15 min)..."
    python3 << PYEOF
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import sys
try:
    print("Loading base model...")
    base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B-Instruct", torch_dtype=torch.float16, device_map="auto")
    print("Loading LoRA...")
    model = PeftModel.from_pretrained(base, "$MODEL_DIR")
    print("Merging...")
    model = model.merge_and_unload()
    print("Saving...")
    model.save_pretrained("$MERGED_DIR")
    AutoTokenizer.from_pretrained("Qwen/Qwen2.5-7B-Instruct").save_pretrained("$MERGED_DIR")
    print("✅ Done!")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYEOF
    [ $? -ne 0 ] && exit 1
else
    echo "Step 1: Using existing merged model"
fi

# Step 2: Create Modelfile
echo ""
echo "Step 2: Creating Modelfile..."
ABS_PATH=$(cd "$MERGED_DIR" && pwd)
cat > "$MERGED_DIR/Modelfile" << MODFILE
FROM $ABS_PATH
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
SYSTEM """You are a senior QA engineer specializing in comprehensive test case generation."""
MODFILE

# Step 3: Create Ollama model
echo ""
echo "Step 3: Creating Ollama model..."
ollama rm "$MODEL_NAME" 2>/dev/null || true
cd "$MERGED_DIR"
ollama create "$MODEL_NAME" -f Modelfile || exit 1

# Step 4: Verify
echo ""
echo "Step 4: Verifying..."
if ollama list | grep -q "$MODEL_NAME"; then
    echo "✅ Success! Testing..."
    ollama run "$MODEL_NAME" "Generate 1 test case for login" | head -20
    echo ""
    echo "✅ Deployment complete! Model: $MODEL_NAME"
else
    echo "❌ Model not found"
    exit 1
fi
DEPLOY_EOF

chmod +x deploy_complete.sh
bash deploy_complete.sh
```

---

## What This Does

1. ✅ Checks if model exists
2. ✅ Merges LoRA weights (if needed, 10-15 min)
3. ✅ Creates Modelfile with absolute path
4. ✅ Creates Ollama model
5. ✅ Verifies and tests

---

## After Running

Test it:
```bash
ollama run qa-expert:7b "Generate test cases for login"
```

Then update your backend `.env`:
```bash
OLLAMA_URL=http://<dgx-ip>:11434
USE_FINETUNED_MODEL=true
FINETUNED_MODEL_NAME=qa-expert:7b
```

---

**That's it!** Just copy-paste the first code block and it will handle everything automatically.






