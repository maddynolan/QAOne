#!/bin/bash
# ============================================================
# COPY AND PASTE THIS ENTIRE SCRIPT ON DGX SPARK
# ============================================================
# This script does EVERYTHING automatically:
# 1. Checks prerequisites
# 2. Merges LoRA weights (if needed)
# 3. Creates Modelfile
# 4. Deploys to Ollama
# 5. Tests the model
# ============================================================

set -e

MODEL_DIR="outputs/qa-expert-7b-v1"
MODEL_NAME="qa-expert:7b"
MERGED_DIR="${MODEL_DIR}_merged"

echo "============================================================"
echo "🚀 Complete Fine-Tuned Model Deployment to Ollama"
echo "============================================================"
echo ""

# Change to qa_finetuning directory
cd ~/qa_finetuning 2>/dev/null || (echo "❌ Not in qa_finetuning directory" && exit 1)

# Check if model exists
if [ ! -d "$MODEL_DIR" ]; then
    echo "❌ Model directory not found: $MODEL_DIR"
    echo "💡 Make sure training completed. Check: ls -la outputs/"
    exit 1
fi

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not found. Install: curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

# Check and activate Python environment
echo "Checking Python environment..."

# First, check if packages are already available
PYTHON_CMD="python3"
HAS_PACKAGES=false

python3 << 'CHECK_PYEOF' 2>/dev/null && HAS_PACKAGES=true || true
import torch
import transformers
from peft import PeftModel
CHECK_PYEOF

if [ "$HAS_PACKAGES" = true ]; then
    echo "✅ Required packages are available in current Python"
else
    # Try to find and activate venv
    if [ -d ~/qa_finetuning/venv ]; then
        echo "Found venv at ~/qa_finetuning/venv"
        source ~/qa_finetuning/venv/bin/activate
        PYTHON_CMD="python"
        echo "✅ Activated venv"
    elif [ -d ~/qa_finetuning/.venv ]; then
        echo "Found venv at ~/qa_finetuning/.venv"
        source ~/qa_finetuning/.venv/bin/activate
        PYTHON_CMD="python"
        echo "✅ Activated venv"
    elif [ -d ~/qa_finetuning/dgx_training_package/venv ]; then
        echo "Found venv at ~/qa_finetuning/dgx_training_package/venv"
        source ~/qa_finetuning/dgx_training_package/venv/bin/activate
        PYTHON_CMD="python"
        echo "✅ Activated venv"
    else
        echo "⚠️  No venv found, checking if packages are installed globally..."
    fi
    
    # Check again after venv activation
    $PYTHON_CMD << 'CHECK_PYEOF' 2>/dev/null && HAS_PACKAGES=true || true
import torch
import transformers
from peft import PeftModel
CHECK_PYEOF
    
    if [ "$HAS_PACKAGES" != true ]; then
        echo ""
        echo "❌ Required Python packages not found"
        echo ""
        echo "💡 Solutions:"
        echo "   1. Install packages:"
        echo "      pip3 install torch transformers peft accelerate"
        echo ""
        echo "   2. Or create venv and install:"
        echo "      python3 -m venv ~/qa_finetuning/venv"
        echo "      source ~/qa_finetuning/venv/bin/activate"
        echo "      pip install torch transformers peft accelerate"
        echo ""
        echo "   3. If training was done in Docker, use Docker for merging too"
        exit 1
    fi
fi

echo "✅ Python environment ready"

echo "✅ Prerequisites OK"
echo ""

# Step 1: Merge LoRA weights
if [ ! -d "$MERGED_DIR" ]; then
    echo "============================================================"
    echo "Step 1: Merging LoRA weights (10-15 minutes)"
    echo "============================================================"
    
    $PYTHON_CMD << 'PYEOF'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import sys
import os

MODEL_DIR = "outputs/qa-expert-7b-v1"
MERGED_DIR = "outputs/qa-expert-7b-v1_merged"
BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"

try:
    print("Loading base model: " + BASE_MODEL)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    print("Loading LoRA weights from: " + MODEL_DIR)
    model = PeftModel.from_pretrained(base_model, MODEL_DIR)
    
    print("Merging LoRA weights...")
    model = model.merge_and_unload()
    
    print("Saving merged model to: " + MERGED_DIR)
    os.makedirs(MERGED_DIR, exist_ok=True)
    model.save_pretrained(MERGED_DIR)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    tokenizer.save_pretrained(MERGED_DIR)
    
    print("✅ Merge complete!")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYEOF

    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Merge failed. Check GPU and disk space."
        exit 1
    fi
    echo ""
    echo "✅ Merged model ready: $MERGED_DIR"
else
    echo "============================================================"
    echo "Step 1: Using existing merged model"
    echo "============================================================"
    echo "✅ Found: $MERGED_DIR"
fi

echo ""

# Step 2: Create Modelfile
echo "============================================================"
echo "Step 2: Creating Modelfile"
echo "============================================================"

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
PARAMETER top_k 40
PARAMETER num_ctx 4096

SYSTEM """You are a senior QA engineer specializing in comprehensive test case generation. 
You understand QA best practices, testing methodologies, and can generate high-quality test cases 
for manual testing, automation, API testing, performance testing, security testing, and accessibility testing.
Always output valid JSON format as requested. Be thorough, accurate, and follow QA industry standards."""
EOF

echo "✅ Modelfile created: $MERGED_DIR/Modelfile"
echo "   FROM path: $ABS_PATH"
echo ""

# Step 3: Remove old model if exists
echo "============================================================"
echo "Step 3: Preparing Ollama"
echo "============================================================"

if ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    echo "Removing existing model..."
    ollama rm "$MODEL_NAME" 2>/dev/null || true
    echo "✅ Old model removed"
else
    echo "No existing model found"
fi

echo ""

# Step 4: Create Ollama model
echo "============================================================"
echo "Step 4: Creating Ollama model"
echo "============================================================"
echo "Model name: $MODEL_NAME"
echo ""

cd "$MERGED_DIR"

if ollama create "$MODEL_NAME" -f Modelfile; then
    echo ""
    echo "✅ Ollama model created!"
else
    echo ""
    echo "❌ Failed to create model"
    echo ""
    echo "Debug info:"
    echo "  Modelfile exists: $([ -f Modelfile ] && echo 'Yes' || echo 'No')"
    echo "  Files in directory: $(ls -1 | head -5 | tr '\n' ' ')"
    echo ""
    echo "Try manually:"
    echo "  cd $MERGED_DIR"
    echo "  cat Modelfile"
    echo "  ollama create $MODEL_NAME -f Modelfile"
    exit 1
fi

echo ""

# Step 5: Verify
echo "============================================================"
echo "Step 5: Verifying deployment"
echo "============================================================"

if ollama list | grep -q "$MODEL_NAME"; then
    echo "✅ Model found in Ollama!"
    echo ""
    echo "Model details:"
    ollama show "$MODEL_NAME" 2>/dev/null | head -5 || echo "  (Details not available)"
else
    echo "⚠️  Model not in list, but creation succeeded"
    echo "   Try: ollama list"
fi

echo ""

# Step 6: Test
echo "============================================================"
echo "Step 6: Testing model"
echo "============================================================"
echo "Running test prompt..."
echo ""

TEST_CMD="ollama run $MODEL_NAME 'Generate 1 test case for user login'"
echo "Command: $TEST_CMD"
echo ""

if $TEST_CMD 2>&1 | head -25; then
    echo ""
    echo "✅ Test successful!"
else
    echo ""
    echo "⚠️  Test had issues, but model was created"
    echo "   Try manually: ollama run $MODEL_NAME 'test'"
fi

echo ""
echo "============================================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "============================================================"
echo ""
echo "📦 Model Name: $MODEL_NAME"
echo "📁 Location: $MERGED_DIR"
echo ""
echo "🧪 Test it:"
echo "   ollama run $MODEL_NAME 'Generate test cases for login'"
echo ""
echo "🔧 Next: Update backend .env with:"
echo "   OLLAMA_URL=http://<dgx-ip>:11434"
echo "   USE_FINETUNED_MODEL=true"
echo "   FINETUNED_MODEL_NAME=qa-expert:7b"
echo ""

