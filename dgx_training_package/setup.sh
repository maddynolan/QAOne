#!/bin/bash
# DGX Spark Training Setup Script
# Run this on DGX Spark after transferring the package

echo "=========================================="
echo "🚀 Setting up QA Expert Fine-Tuning"
echo "=========================================="

# Create conda environment
echo "Creating conda environment..."
conda create -n qafn python=3.10 -y
conda activate qafn

# Install dependencies
echo "Installing dependencies..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers>=4.35.0
pip install peft>=0.7.0
pip install accelerate>=0.24.0
pip install datasets>=2.14.0
pip install bitsandbytes>=0.41.0
pip install scipy
pip install pyyaml

# Verify GPU
echo "Checking GPU..."
nvidia-smi

# Verify installation
echo "Verifying installation..."
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else "None"}')"

echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. conda activate qafn"
echo "2. python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml"
