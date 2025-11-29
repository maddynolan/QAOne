#!/bin/bash
# Setup script using venv instead of conda
# Works on DGX without conda

set -e

echo "============================================================"
echo "Setting up Python Environment (venv)"
echo "============================================================"
echo ""

WORK_DIR="${1:-$HOME/qa_finetuning}"
VENV_DIR="$WORK_DIR/venv"

echo "Work directory: $WORK_DIR"
echo "Venv directory: $VENV_DIR"
echo ""

# Check Python
echo "[1/5] Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "  ERROR: python3 not found!"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "  OK: $PYTHON_VERSION"
echo ""

# Create venv
echo "[2/5] Creating virtual environment..."
if [ -d "$VENV_DIR" ]; then
    echo "  WARN: Venv already exists at $VENV_DIR"
    echo "  Using existing venv"
else
    python3 -m venv "$VENV_DIR"
    echo "  OK: Virtual environment created"
fi
echo ""

# Activate venv
echo "[3/5] Activating virtual environment..."
source "$VENV_DIR/bin/activate"
echo "  OK: Activated"
echo ""

# Upgrade pip
echo "[4/5] Upgrading pip..."
pip install --upgrade pip --quiet
echo "  OK: Pip upgraded"
echo ""

# Install dependencies
echo "[5/5] Installing dependencies..."
echo "  Installing PyTorch with CUDA support..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet

echo "  Installing transformers and related packages..."
pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet

echo "  Installing datasets and utilities..."
pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml --quiet

echo "  Installing training dependencies..."
pip install trl>=0.7.0 --quiet

echo "  OK: Dependencies installed"
echo ""

# Verify GPU
echo "Verifying GPU access..."
python3 -c "
import torch
print(f'  PyTorch: {torch.__version__}')
print(f'  CUDA Available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'  CUDA Version: {torch.version.cuda}')
    print(f'  GPU Name: {torch.cuda.get_device_name(0)}')
    print(f'  GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
else:
    print('  WARN: CUDA not available!')
    exit(1)
"

if [ $? -eq 0 ]; then
    echo "  OK: GPU verified"
else
    echo "  ERROR: GPU verification failed!"
    exit 1
fi

echo ""
echo "============================================================"
echo "Setup Complete!"
echo "============================================================"
echo ""
echo "To activate the environment:"
echo "  source $VENV_DIR/bin/activate"
echo ""
echo "To run training:"
echo "  source $VENV_DIR/bin/activate"
echo "  python3 scripts/finetune_qwen3_30b_dgx_optimized.py --dataset data/qa_training_data.jsonl"
echo ""




