#!/bin/bash
# Simple deployment - handles venv/conda/pip automatically
# Run this on DGX Spark

cd ~/qa_finetuning

echo "============================================================"
echo "🚀 Quick Deployment Fix"
echo "============================================================"
echo ""

# Find Python with packages
PYTHON_CMD=""
for py in python3 python; do
    if $py -c "import torch, transformers, peft" 2>/dev/null; then
        PYTHON_CMD="$py"
        echo "✅ Found Python with packages: $py"
        break
    fi
done

# If not found, try activating venv
if [ -z "$PYTHON_CMD" ]; then
    if [ -d venv ]; then
        source venv/bin/activate
        PYTHON_CMD="python"
        echo "✅ Activated venv"
    elif [ -d .venv ]; then
        source .venv/bin/activate
        PYTHON_CMD="python"
        echo "✅ Activated .venv"
    fi
fi

# Check again
if [ -z "$PYTHON_CMD" ] || ! $PYTHON_CMD -c "import torch, transformers, peft" 2>/dev/null; then
    echo ""
    echo "❌ Python packages not found"
    echo ""
    echo "Quick fix - install packages:"
    echo "  pip3 install torch transformers peft accelerate"
    echo ""
    echo "Or if you have venv:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install torch transformers peft accelerate"
    exit 1
fi

echo ""
echo "Using Python: $PYTHON_CMD"
echo ""

# Now do the merge
MODEL_DIR="outputs/qa-expert-7b-v1"
MERGED_DIR="${MODEL_DIR}_merged"

if [ ! -d "$MERGED_DIR" ]; then
    echo "Merging LoRA weights (10-15 min)..."
    $PYTHON_CMD << EOF
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import os

MODEL_DIR = "$MODEL_DIR"
MERGED_DIR = "$MERGED_DIR"
BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"

print("Loading base model...")
base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16, device_map="auto")
print("Loading LoRA...")
model = PeftModel.from_pretrained(base, MODEL_DIR)
print("Merging...")
model = model.merge_and_unload()
print("Saving...")
os.makedirs(MERGED_DIR, exist_ok=True)
model.save_pretrained(MERGED_DIR)
AutoTokenizer.from_pretrained(BASE_MODEL).save_pretrained(MERGED_DIR)
print("✅ Done!")
EOF
else
    echo "✅ Merged model already exists"
fi

# Create Modelfile
echo ""
echo "Creating Modelfile..."
ABS_PATH=$(cd "$MERGED_DIR" && pwd)
cat > "$MERGED_DIR/Modelfile" << EOF
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
SYSTEM """You are a senior QA engineer specializing in comprehensive test case generation."""
EOF

# Create Ollama model
echo ""
echo "Creating Ollama model..."
cd "$MERGED_DIR"
ollama rm qa-expert:7b 2>/dev/null || true
ollama create qa-expert:7b -f Modelfile

# Verify
echo ""
if ollama list | grep -q qa-expert:7b; then
    echo "✅ Success! Test with:"
    echo "   ollama run qa-expert:7b 'Generate test cases for login'"
else
    echo "❌ Model creation failed"
fi






