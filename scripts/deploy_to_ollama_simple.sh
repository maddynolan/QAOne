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
    
    python3 << EOF
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
    sys.exit(1)
EOF

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
cat > "$MERGED_DIR/Modelfile" << EOF
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
EOF

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






