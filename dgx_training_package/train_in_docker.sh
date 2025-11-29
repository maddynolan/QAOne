#!/bin/bash
# Train using Docker container with CUDA support
# This avoids PyTorch ARM CUDA installation issues

set -e

echo "============================================================"
echo "🚀 TRAINING WITH DOCKER (CUDA Support Included)"
echo "============================================================"
echo ""

WORK_DIR="$HOME/qa_finetuning"
CONTAINER_NAME="qa-training"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi
echo "✅ Docker found"

# Pull NVIDIA PyTorch container
echo ""
echo "[1/4] Pulling NVIDIA PyTorch container..."
echo "  This may take 10-20 minutes (one-time download)..."
docker pull nvcr.io/nvidia/pytorch:24.06-py3 || {
    echo "  ⚠️  Failed to pull, trying alternative..."
    docker pull nvcr.io/nvidia/pytorch:24.01-py3 || {
        echo "  ⚠️  Trying latest..."
        docker pull nvcr.io/nvidia/pytorch:latest
    }
}
echo "  ✅ Container ready"

# Create directories
echo ""
echo "[2/4] Setting up directories..."
mkdir -p "$WORK_DIR/outputs"
mkdir -p "$WORK_DIR/data"
mkdir -p "$WORK_DIR/configs"
mkdir -p "$WORK_DIR/scripts"
echo "  ✅ Directories ready"

# Copy files if needed
if [ -d "$WORK_DIR/dgx_training_package" ]; then
    echo ""
    echo "[3/4] Copying training files..."
    cp -r "$WORK_DIR/dgx_training_package/data"/* "$WORK_DIR/data/" 2>/dev/null || true
    cp -r "$WORK_DIR/dgx_training_package/configs"/* "$WORK_DIR/configs/" 2>/dev/null || true
    cp -r "$WORK_DIR/dgx_training_package/scripts"/* "$WORK_DIR/scripts/" 2>/dev/null || true
    echo "  ✅ Files ready"
fi

# Run training in container
echo ""
echo "[4/4] Starting training in Docker container..."
echo "  Container will have CUDA support automatically"
echo ""

docker run --rm \
    --gpus all \
    --shm-size=8g \
    -v "$WORK_DIR:/workspace/qa_finetuning" \
    -w /workspace/qa_finetuning \
    nvcr.io/nvidia/pytorch:24.06-py3 \
    bash -c "
        echo 'Installing dependencies...'
        pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet
        pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml --quiet
        
        echo 'Verifying CUDA...'
        python -c 'import torch; print(f\"CUDA Available: {torch.cuda.is_available()}\"); print(f\"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}\")'
        
        echo ''
        echo 'Starting training...'
        python scripts/train_lora_fixed.py --config configs/lora_qwen7b_dgx.yaml
    "

echo ""
echo "============================================================"
echo "✅ Training complete!"
echo "============================================================"
echo ""
echo "Model saved to: $WORK_DIR/outputs/qa-expert-7b-v1"


