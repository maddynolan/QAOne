#!/bin/bash
# Fully Automated Setup and Training Script
# This script does EVERYTHING - setup, training, and evaluation
# Run this ONCE on DGX Spark and it will handle everything

set -e  # Exit on error

echo "============================================================"
echo "🚀 FULLY AUTOMATED QA EXPERT TRAINING"
echo "============================================================"
echo "This script will:"
echo "  1. Setup conda environment"
echo "  2. Install all dependencies"
echo "  3. Verify GPU access"
echo "  4. Run training"
echo "  5. Evaluate model"
echo "============================================================"
echo ""

# Configuration
ENV_NAME="qafn"
WORK_DIR="$HOME/qa_finetuning"
PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 Package directory: $PACKAGE_DIR"
echo "🖥️  Work directory: $WORK_DIR"
echo ""

# Step 1: Create working directory
echo "[1/6] Creating working directory..."
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"
echo "  ✅ Working directory ready"
echo ""

# Step 2: Copy package files
echo "[2/6] Copying package files..."
if [ -d "$PACKAGE_DIR/data" ]; then
    cp -r "$PACKAGE_DIR/data" "$WORK_DIR/"
    cp -r "$PACKAGE_DIR/configs" "$WORK_DIR/"
    cp -r "$PACKAGE_DIR/scripts" "$WORK_DIR/"
    mkdir -p "$WORK_DIR/outputs"
    echo "  ✅ Files copied"
else
    echo "  ⚠️  Package files not found, using current directory"
fi
echo ""

# Step 3: Check if conda exists
echo "[3/6] Checking conda installation..."
if ! command -v conda &> /dev/null; then
    echo "  ❌ Conda not found. Please install conda first."
    echo "  💡 Install: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi
echo "  ✅ Conda found: $(conda --version)"
echo ""

# Step 4: Create conda environment
echo "[4/6] Setting up conda environment..."
if conda env list | grep -q "^${ENV_NAME} "; then
    echo "  ⚠️  Environment '$ENV_NAME' already exists"
    read -p "  Do you want to remove it and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        conda env remove -n "$ENV_NAME" -y
        conda create -n "$ENV_NAME" python=3.10 -y
    else
        echo "  Using existing environment"
    fi
else
    echo "  Creating new environment '$ENV_NAME'..."
    conda create -n "$ENV_NAME" python=3.10 -y
    echo "  ✅ Environment created"
fi
echo ""

# Step 5: Install dependencies
echo "[5/6] Installing dependencies..."
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate "$ENV_NAME"

echo "  Installing PyTorch..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet

echo "  Installing transformers and related packages..."
pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet

echo "  Installing datasets and utilities..."
pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml --quiet

echo "  ✅ Dependencies installed"
echo ""

# Step 6: Verify GPU
echo "[6/6] Verifying GPU access..."
if command -v nvidia-smi &> /dev/null; then
    echo "  GPU Information:"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    echo ""
    
    python -c "
import torch
print(f'  PyTorch Version: {torch.__version__}')
print(f'  CUDA Available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'  CUDA Version: {torch.version.cuda}')
    print(f'  GPU Name: {torch.cuda.get_device_name(0)}')
    print(f'  GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
else:
    print('  ❌ CUDA not available!')
    exit(1)
"
    if [ $? -ne 0 ]; then
        echo "  ❌ GPU verification failed!"
        exit 1
    fi
    echo "  ✅ GPU verified"
else
    echo "  ⚠️  nvidia-smi not found, but continuing..."
fi
echo ""

# Training
echo "============================================================"
echo "🎓 STARTING TRAINING"
echo "============================================================"
echo ""

cd "$WORK_DIR"

# Check if config exists
CONFIG_FILE="$WORK_DIR/configs/lora_qwen7b_dgx.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "  ❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

# Check if training data exists
TRAIN_FILE="$WORK_DIR/data/train.jsonl"
VAL_FILE="$WORK_DIR/data/val.jsonl"
if [ ! -f "$TRAIN_FILE" ]; then
    echo "  ❌ Training file not found: $TRAIN_FILE"
    exit 1
fi
if [ ! -f "$VAL_FILE" ]; then
    echo "  ❌ Validation file not found: $VAL_FILE"
    exit 1
fi

echo "📋 Configuration:"
echo "  Config: $CONFIG_FILE"
echo "  Train File: $TRAIN_FILE"
echo "  Val File: $VAL_FILE"
echo ""

# Count examples
TRAIN_COUNT=$(wc -l < "$TRAIN_FILE")
VAL_COUNT=$(wc -l < "$VAL_FILE")
echo "📊 Data:"
echo "  Training examples: $TRAIN_COUNT"
echo "  Validation examples: $VAL_COUNT"
echo ""

# Run training
echo "🚀 Starting training..."
echo "  This will take 2-4 hours..."
echo "  Press Ctrl+C to stop (will save checkpoint)"
echo ""

python "$WORK_DIR/scripts/train_lora.py" --config "$CONFIG_FILE"

TRAIN_EXIT_CODE=$?

if [ $TRAIN_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "============================================================"
    echo "✅ TRAINING COMPLETE!"
    echo "============================================================"
    echo ""
    
    # Check if model was saved
    MODEL_DIR="$WORK_DIR/outputs/qa-expert-7b-v1"
    if [ -d "$MODEL_DIR" ]; then
        echo "📦 Model saved to: $MODEL_DIR"
        echo ""
        
        # Run evaluation
        echo "============================================================"
        echo "📊 EVALUATING MODEL"
        echo "============================================================"
        echo ""
        
        if [ -f "$WORK_DIR/scripts/evaluate_model.py" ]; then
            python "$WORK_DIR/scripts/evaluate_model.py" \
                --model "$MODEL_DIR" \
                --val_file "$VAL_FILE" \
                --baseline "Qwen/Qwen2.5-7B-Instruct" || true
        else
            echo "  ⚠️  Evaluation script not found, skipping..."
        fi
        
        echo ""
        echo "============================================================"
        echo "🎉 ALL DONE!"
        echo "============================================================"
        echo ""
        echo "✅ Model Location: $MODEL_DIR"
        echo "✅ Next Steps:"
        echo "  1. Review evaluation results above"
        echo "  2. Convert to Ollama format (if needed)"
        echo "  3. Deploy to production"
        echo ""
    else
        echo "  ⚠️  Model directory not found: $MODEL_DIR"
    fi
else
    echo ""
    echo "============================================================"
    echo "❌ TRAINING FAILED"
    echo "============================================================"
    echo "  Exit code: $TRAIN_EXIT_CODE"
    echo "  Check logs above for errors"
    echo ""
    exit $TRAIN_EXIT_CODE
fi

