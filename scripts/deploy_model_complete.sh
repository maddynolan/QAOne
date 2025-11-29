#!/bin/bash
# Complete Deployment Script - Run this on DGX Spark
# Handles everything: merge, Modelfile creation, Ollama deployment

set -e  # Exit on error

echo "============================================================"
echo "🚀 Complete Fine-Tuned Model Deployment to Ollama"
echo "============================================================"
echo ""

# Configuration
MODEL_DIR="${1:-~/qa_finetuning/outputs/qa-expert-7b-v1}"
MODEL_NAME="${2:-qa-expert:7b}"
WORK_DIR="$(dirname "$MODEL_DIR")"
MERGED_DIR="${MODEL_DIR}_merged"

# Expand tilde
MODEL_DIR="${MODEL_DIR/#\~/$HOME}"
WORK_DIR="${WORK_DIR/#\~/$HOME}"
MERGED_DIR="${MERGED_DIR/#\~/$HOME}"

echo "📋 Configuration:"
echo "  Model Directory: $MODEL_DIR"
echo "  Merged Directory: $MERGED_DIR"
echo "  Ollama Model Name: $MODEL_NAME"
echo "  Work Directory: $WORK_DIR"
echo ""

# Check if model directory exists
if [ ! -d "$MODEL_DIR" ]; then
    echo "❌ Model directory not found: $MODEL_DIR"
    echo "💡 Make sure training completed successfully"
    exit 1
fi

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not found. Please install Ollama first."
    echo "💡 Install: curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Merge LoRA weights
if [ ! -d "$MERGED_DIR" ]; then
    echo "============================================================"
    echo "Step 1: Merging LoRA weights with base model"
    echo "============================================================"
    echo "  This will take 10-15 minutes..."
    echo ""
    
    # Get base model from training info if available
    BASE_MODEL="Qwen/Qwen2.5-7B-Instruct"
    if [ -f "$MODEL_DIR/training_info.json" ]; then
        BASE_MODEL=$(python3 -c "import json; f=open('$MODEL_DIR/training_info.json'); d=json.load(f); print(d.get('base_model', '$BASE_MODEL'))" 2>/dev/null || echo "$BASE_MODEL")
    fi
    
    echo "  Base Model: $BASE_MODEL"
    echo "  LoRA Path: $MODEL_DIR"
    echo "  Output: $MERGED_DIR"
    echo ""
    
    python3 << PYEOF
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import sys
import os

try:
    print("Loading base model: $BASE_MODEL")
    base_model = AutoModelForCausalLM.from_pretrained(
        "$BASE_MODEL",
        torch_dtype=torch.float16,
        device_map="auto"
    )
    
    print("Loading LoRA weights from: $MODEL_DIR")
    model = PeftModel.from_pretrained(base_model, "$MODEL_DIR")
    
    print("Merging LoRA weights...")
    model = model.merge_and_unload()
    
    print("Saving merged model to: $MERGED_DIR")
    os.makedirs("$MERGED_DIR", exist_ok=True)
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
        echo ""
        echo "❌ Failed to merge LoRA weights"
        echo "💡 Check GPU availability and disk space"
        exit 1
    fi
    
    echo ""
    echo "✅ Merged model saved to: $MERGED_DIR"
else
    echo "============================================================"
    echo "Step 1: Using existing merged model"
    echo "============================================================"
    echo "  Found: $MERGED_DIR"
    echo "  Skipping merge step"
fi

echo ""

# Step 2: Create Modelfile
echo "============================================================"
echo "Step 2: Creating Modelfile"
echo "============================================================"

# Use absolute path for FROM
ABS_MERGED_DIR=$(cd "$MERGED_DIR" && pwd)

cat > "$MERGED_DIR/Modelfile" << EOF
FROM $ABS_MERGED_DIR

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

echo "✅ Modelfile created at: $MERGED_DIR/Modelfile"
echo "  FROM path: $ABS_MERGED_DIR"
echo ""

# Step 3: Remove old model if exists
echo "============================================================"
echo "Step 3: Preparing Ollama"
echo "============================================================"

if ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    echo "  Removing existing model: $MODEL_NAME"
    ollama rm "$MODEL_NAME" 2>/dev/null || true
    echo "  ✅ Old model removed"
else
    echo "  No existing model found"
fi

echo ""

# Step 4: Create Ollama model
echo "============================================================"
echo "Step 4: Creating Ollama model"
echo "============================================================"
echo "  Model name: $MODEL_NAME"
echo "  Modelfile: $MERGED_DIR/Modelfile"
echo ""

cd "$MERGED_DIR"

if ollama create "$MODEL_NAME" -f Modelfile; then
    echo ""
    echo "✅ Ollama model created successfully!"
else
    echo ""
    echo "❌ Failed to create Ollama model"
    echo ""
    echo "💡 Troubleshooting:"
    echo "  1. Check Modelfile: cat $MERGED_DIR/Modelfile"
    echo "  2. Check files exist: ls -la $MERGED_DIR | head -10"
    echo "  3. Check Ollama: ollama list"
    echo "  4. Try manual: cd $MERGED_DIR && ollama create $MODEL_NAME -f Modelfile"
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
    echo "Model info:"
    ollama show "$MODEL_NAME" 2>/dev/null | head -10 || echo "  (Could not show details)"
else
    echo "⚠️  Model not found in Ollama list"
    echo "  But creation reported success. Try: ollama list"
fi

echo ""

# Step 6: Quick test
echo "============================================================"
echo "Step 6: Quick test"
echo "============================================================"
echo "Testing model with simple prompt..."
echo ""

TEST_OUTPUT=$(ollama run "$MODEL_NAME" "Generate 1 test case for login" 2>&1 | head -30)

if echo "$TEST_OUTPUT" | grep -qi "error\|failed"; then
    echo "⚠️  Test had issues:"
    echo "$TEST_OUTPUT"
else
    echo "✅ Test successful! Model is working."
    echo ""
    echo "Sample output:"
    echo "$TEST_OUTPUT" | head -15
fi

echo ""
echo "============================================================"
echo "✅ Deployment Complete!"
echo "============================================================"
echo ""
echo "📦 Model Name: $MODEL_NAME"
echo "📁 Merged Model: $MERGED_DIR"
echo "📄 Modelfile: $MERGED_DIR/Modelfile"
echo ""
echo "🧪 Test the model:"
echo "   ollama run $MODEL_NAME 'Generate test cases for user login'"
echo ""
echo "🔧 Next Steps:"
echo "   1. Update backend .env: OLLAMA_URL=http://<dgx-ip>:11434"
echo "   2. Set USE_FINETUNED_MODEL=true"
echo "   3. Restart backend"
echo "   4. Test via API or frontend"
echo ""






