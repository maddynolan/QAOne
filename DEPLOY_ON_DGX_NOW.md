# 🚀 Deploy Model on DGX Spark - Quick Fix

## The Problem
The deployment script doesn't exist on DGX Spark yet. Here's how to create it directly there.

---

## Solution: Create Script on DGX Spark

**Run this command on DGX Spark:**

```bash
cat > ~/qa_finetuning/deploy_to_ollama.sh << 'EOF'
#!/bin/bash
# Simple deployment script for DGX Spark
# Converts fine-tuned model to Ollama format

set -e

MODEL_DIR="${1:-~/qa_finetuning/outputs/qa-expert-7b-v1}"
MODEL_NAME="${2:-qa-expert:7b}"

echo "============================================================"
echo "🚀 Deploy Fine-Tuned Model to Ollama"
echo "============================================================"
echo ""
echo "Model Directory: $MODEL_DIR"
echo "Ollama Model Name: $MODEL_NAME"
echo ""

# Check if model directory exists
if [ ! -d "$MODEL_DIR" ]; then
    echo "❌ Model directory not found: $MODEL_DIR"
    exit 1
fi

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not found. Please install Ollama first."
    exit 1
fi

# Load training info to get base model
BASE_MODEL="Qwen/Qwen2.5-7B-Instruct"
if [ -f "$MODEL_DIR/training_info.json" ]; then
    BASE_MODEL=$(python3 -c "import json; print(json.load(open('$MODEL_DIR/training_info.json'))['base_model'])" 2>/dev/null || echo "$BASE_MODEL")
fi

echo "📋 Configuration:"
echo "  Base Model: $BASE_MODEL"
echo "  Model Dir: $MODEL_DIR"
echo "  Ollama Name: $MODEL_NAME"
echo ""

# Step 1: Merge LoRA weights (if needed)
MERGED_DIR="${MODEL_DIR}_merged"
if [ ! -d "$MERGED_DIR" ]; then
    echo "Step 1: Merging LoRA weights with base model..."
    echo "  This may take 10-15 minutes..."
    
    python3 << PYEOF
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import sys

try:
    print("Loading base model: $BASE_MODEL")
    base_model = AutoModelForCausalLM.from_pretrained(
        "$BASE_MODEL",
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    print("Loading LoRA weights: $MODEL_DIR")
    model = PeftModel.from_pretrained(base_model, "$MODEL_DIR")
    
    print("Merging LoRA weights...")
    model = model.merge_and_unload()
    
    print("Saving merged model: $MERGED_DIR")
    model.save_pretrained("$MERGED_DIR")
    tokenizer = AutoTokenizer.from_pretrained("$BASE_MODEL")
    tokenizer.save_pretrained("$MERGED_DIR")
    
    print("✅ Merge complete!")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYEOF

    if [ $? -ne 0 ]; then
        echo "❌ Failed to merge LoRA weights"
        exit 1
    fi
else
    echo "Step 1: Using existing merged model: $MERGED_DIR"
fi

echo ""

# Step 2: Create Modelfile
echo "Step 2: Creating Modelfile..."
cat > "$MERGED_DIR/Modelfile" << MODFILE
FROM $MERGED_DIR

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
MODFILE

echo "✅ Modelfile created"
echo ""

# Step 3: Create Ollama model
echo "Step 3: Creating Ollama model..."
cd "$MERGED_DIR"
ollama create "$MODEL_NAME" -f Modelfile

if [ $? -ne 0 ]; then
    echo "❌ Failed to create Ollama model"
    exit 1
fi

echo ""

# Step 4: Verify
echo "Step 4: Verifying model..."
if ollama list | grep -q "$MODEL_NAME"; then
    echo "✅ Model deployed successfully!"
    echo ""
    echo "============================================================"
    echo "✅ Deployment Complete!"
    echo "============================================================"
    echo ""
    echo "📦 Model Name: $MODEL_NAME"
    echo "📁 Merged Model: $MERGED_DIR"
    echo ""
    echo "🧪 Test the model:"
    echo "   ollama run $MODEL_NAME 'Generate test cases for user login'"
    echo ""
    echo "🔧 Next Steps:"
    echo "   1. Update backend OLLAMA_URL if needed"
    echo "   2. Model will be used automatically"
else
    echo "⚠️  Model created but not found in list. Check Ollama status."
fi
EOF

chmod +x ~/qa_finetuning/deploy_to_ollama.sh
```

---

## Then Run the Deployment

```bash
cd ~/qa_finetuning
bash deploy_to_ollama.sh outputs/qa-expert-7b-v1 qa-expert:7b
```

---

## Alternative: One-Line Creation

If the above doesn't work, try this simpler approach - create the script in one command:

```bash
cd ~/qa_finetuning && cat > deploy_to_ollama.sh << 'SCRIPT_END'
#!/bin/bash
MODEL_DIR="${1:-outputs/qa-expert-7b-v1}"
MODEL_NAME="${2:-qa-expert:7b}"
MERGED_DIR="${MODEL_DIR}_merged"

echo "🚀 Deploying $MODEL_NAME from $MODEL_DIR"

# Merge LoRA
python3 -c "
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
base = AutoModelForCausalLM.from_pretrained('Qwen/Qwen2.5-7B-Instruct', torch_dtype=torch.float16, device_map='auto')
model = PeftModel.from_pretrained(base, '$MODEL_DIR')
model = model.merge_and_unload()
model.save_pretrained('$MERGED_DIR')
AutoTokenizer.from_pretrained('Qwen/Qwen2.5-7B-Instruct').save_pretrained('$MERGED_DIR')
print('✅ Merged')
"

# Create Modelfile
cat > "$MERGED_DIR/Modelfile" << 'MODFILE'
FROM .
TEMPLATE """<|im_start|>system
{{ .System }}<|im_end|>
<|im_start|>user
{{ .Prompt }}<|im_end|>
<|im_start|>assistant
{{ .Response }}<|im_end|>
"""
PARAMETER temperature 0.7
PARAMETER top_p 0.9
SYSTEM """You are a senior QA engineer specializing in comprehensive test case generation."""
MODFILE

# Create Ollama model
cd "$MERGED_DIR" && ollama create "$MODEL_NAME" -f Modelfile
ollama list | grep "$MODEL_NAME" && echo "✅ Deployed!" || echo "❌ Failed"
SCRIPT_END

chmod +x deploy_to_ollama.sh
bash deploy_to_ollama.sh
```

---

## Quick Check

After running, verify:

```bash
ollama list | grep qa-expert
ollama run qa-expert:7b "Generate test cases for login"
```

---

**That's it!** The script will be created and ready to use.






