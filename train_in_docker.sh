#!/bin/bash
# Train using Docker container with CUDA support
# This avoids PyTorch ARM CUDA installation issues
# Updated to use qa_training_data.jsonl

set -e

echo "============================================================"
echo "TRAINING WITH DOCKER (CUDA Support Included)"
echo "============================================================"
echo ""

WORK_DIR="$HOME/qa_finetuning"
CONTAINER_NAME="qa-training"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker not found. Please install Docker first."
    exit 1
fi
echo "[OK] Docker found"

# Check if data file exists
DATA_FILE="$WORK_DIR/data/qa_training_data.jsonl"
if [ ! -f "$DATA_FILE" ]; then
    echo "[ERROR] Data file not found: $DATA_FILE"
    exit 1
fi

# Count examples
EXAMPLE_COUNT=$(wc -l < "$DATA_FILE")
echo "[INFO] Found $EXAMPLE_COUNT training examples"
echo ""

# Pull NVIDIA PyTorch container
echo "[1/5] Pulling NVIDIA PyTorch container..."
echo "  This may take 10-20 minutes (one-time download)..."
docker pull nvcr.io/nvidia/pytorch:24.06-py3 || {
    echo "  [WARNING] Failed to pull 24.06, trying alternative..."
    docker pull nvcr.io/nvidia/pytorch:24.01-py3 || {
        echo "  [WARNING] Trying latest..."
        docker pull nvcr.io/nvidia/pytorch:latest
    }
}
echo "  [OK] Container ready"

# Create directories
echo ""
echo "[2/5] Setting up directories..."
mkdir -p "$WORK_DIR/outputs"
mkdir -p "$WORK_DIR/data"
mkdir -p "$WORK_DIR/configs"
mkdir -p "$WORK_DIR/scripts"
echo "  [OK] Directories ready"

# Split data into train/val if needed
echo ""
echo "[3/5] Preparing train/val split..."
TRAIN_FILE="$WORK_DIR/data/train.jsonl"
VAL_FILE="$WORK_DIR/data/val.jsonl"

if [ ! -f "$TRAIN_FILE" ] || [ ! -f "$VAL_FILE" ]; then
    echo "  Splitting data into train/val (80/20)..."
    docker run --rm \
        -v "$WORK_DIR:/workspace" \
        -w /workspace \
        python:3.12-slim \
        bash -c "
            pip install --quiet --no-cache-dir numpy > /dev/null 2>&1
            python3 << 'PYEOF'
import json
import random
import sys

random.seed(42)

# Load data
data = []
with open('data/qa_training_data.jsonl', 'r') as f:
    for line in f:
        if line.strip():
            data.append(json.loads(line))

# Shuffle
random.shuffle(data)

# Split 80/20
split_idx = int(len(data) * 0.8)
train_data = data[:split_idx]
val_data = data[split_idx:]

# Save
with open('data/train.jsonl', 'w') as f:
    for item in train_data:
        f.write(json.dumps(item, ensure_ascii=False) + '\n')

with open('data/val.jsonl', 'w') as f:
    for item in val_data:
        f.write(json.dumps(item, ensure_ascii=False) + '\n')

print(f'Split complete: {len(train_data)} train, {len(val_data)} val')
PYEOF
        "
    echo "  [OK] Train/val split created"
else
    echo "  [OK] Train/val files already exist"
fi

# Check if config exists, use 30B config
CONFIG_FILE="$WORK_DIR/configs/lora_qwen3_30b_coder.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo ""
    echo "[4/5] Creating 30B training config..."
    mkdir -p "$WORK_DIR/configs"
    cat > "$CONFIG_FILE" << 'EOF'
base_model: "Qwen/Qwen3-Coder-30B-Instruct"
model_name: "qa-expert-30b-coder"

# LoRA Configuration
lora_r: 32
lora_alpha: 32
lora_dropout: 0.05
target_modules:
  - "q_proj"
  - "v_proj"
  - "k_proj"
  - "o_proj"
  - "gate_proj"
  - "up_proj"

# Data Paths
train_file: "data/train.jsonl"
val_file: "data/val.jsonl"

# Training Configuration
output_dir: "outputs/qa-expert-30b-coder-v1"
per_device_train_batch_size: 1  # Must be 1 for 30B
gradient_accumulation_steps: 16  # High accumulation
learning_rate: 5e-6  # Lower LR for larger model
num_train_epochs: 3
warmup_steps: 200
logging_steps: 10
save_steps: 50
eval_steps: 50
evaluation_strategy: "steps"

# Optimization
fp16: true
gradient_checkpointing: true
optim: "adamw_torch"
lr_scheduler_type: "cosine"

# Memory Optimization
dataloader_num_workers: 2
max_length: 4096
EOF
    echo "  [OK] 30B config created"
else
    echo ""
    echo "[4/5] Using existing config: $CONFIG_FILE"
fi

# Run training in container
echo ""
echo "[5/5] Starting training in Docker container..."
echo "  Container will have CUDA support automatically"
echo "  Training will take 8-16 hours (30B model)..."
echo ""

docker run --rm \
    --gpus all \
    --shm-size=8g \
    -v "$WORK_DIR:/workspace/qa_finetuning" \
    -w /workspace/qa_finetuning \
    nvcr.io/nvidia/pytorch:24.06-py3 \
    bash -c "
        echo '[INFO] Installing dependencies...'
        pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet --no-cache-dir
        pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml trl>=0.7.0 --quiet --no-cache-dir
        
        echo '[INFO] Verifying CUDA...'
        python -c 'import torch; print(f\"CUDA Available: {torch.cuda.is_available()}\"); print(f\"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}\")'
        
        if [ ! -f scripts/train_lora.py ]; then
            echo '[ERROR] Training script not found: scripts/train_lora.py'
            exit 1
        fi
        
        echo ''
        echo '[INFO] Starting training...'
        python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml
    "

TRAIN_EXIT=$?

echo ""
echo "============================================================"
if [ $TRAIN_EXIT -eq 0 ]; then
    echo "[OK] Training complete!"
    echo "============================================================"
    echo ""
    echo "Model saved to: $WORK_DIR/outputs/qa-expert-30b-coder-v1"
else
    echo "[ERROR] Training failed with exit code: $TRAIN_EXIT"
    echo "============================================================"
    exit $TRAIN_EXIT
fi

