#!/bin/bash
# Fully Automated Setup and Training Script (Using venv instead of conda)
# This script does EVERYTHING - setup, training, and evaluation
# Run this ONCE on DGX Spark and it will handle everything

set -e  # Exit on error

echo "============================================================"
echo "🚀 FULLY AUTOMATED QA EXPERT TRAINING (Using venv)"
echo "============================================================"
echo "This script will:"
echo "  1. Setup Python venv environment"
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

# Step 3: Check Python
echo "[3/6] Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "  ❌ Python3 not found. Please install Python 3.8+ first."
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "  ✅ Python found: $PYTHON_VERSION"
echo ""

# Step 4: Create venv environment
echo "[4/6] Setting up venv environment..."
if [ -d "$WORK_DIR/venv" ]; then
    echo "  ⚠️  venv already exists at $WORK_DIR/venv"
    read -p "  Do you want to remove it and recreate? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$WORK_DIR/venv"
        python3 -m venv "$WORK_DIR/venv"
        echo "  ✅ Environment recreated"
    else
        echo "  Using existing environment"
    fi
else
    echo "  Creating new venv environment..."
    python3 -m venv "$WORK_DIR/venv"
    echo "  ✅ Environment created"
fi

# Activate venv
source "$WORK_DIR/venv/bin/activate"
echo "  ✅ venv activated"
echo ""

# Step 5: Install dependencies
echo "[5/6] Installing dependencies..."
echo "  ⏳ This may take 10-15 minutes..."

echo "  Installing PyTorch..."
pip install --upgrade pip --quiet
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
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml

echo ""
echo "============================================================"
echo "✅ TRAINING COMPLETE!"
echo "============================================================"
echo ""
echo "Model saved to: $WORK_DIR/outputs/qa-expert-7b-v1"
echo ""
echo "To evaluate the model:"
echo "  source $WORK_DIR/venv/bin/activate"
echo "  python scripts/evaluate_model.py --model outputs/qa-expert-7b-v1 --val_file data/val.jsonl"
echo ""


