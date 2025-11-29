#!/bin/bash
# Script to run on DGX Spark GB10
# Copy this to DGX and run: bash run_on_dgx.sh
# Hostname: spark-d435.local (or use IP: 192.168.1.233)

set -e

echo "=========================================="
echo "DGX Spark GB10 Setup: Qwen3-Coder-30B"
echo "=========================================="

# Step 1: Check GPU
echo ""
echo "Step 1: Checking GPU..."
nvidia-smi

# Step 2: Check Ollama
echo ""
echo "Step 2: Checking Ollama..."
if command -v ollama &> /dev/null; then
    echo "Ollama is installed"
    ollama --version
    echo ""
    echo "Current models:"
    ollama list
else
    echo "Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Step 2.5: Remove old models (to free space for 30B)
echo ""
echo "Step 2.5: Removing old models to free space..."
echo "Checking disk space:"
df -h | grep -E "Filesystem|/$|/home"

# List of models to remove (excluding 30B)
MODELS_TO_REMOVE=("qwen2.5:7b-instruct" "qwen2.5-coder:14b" "qa-expert:7b" "qwen2.5-7b-instruct" "qwen2.5-coder-14b")

for model in "${MODELS_TO_REMOVE[@]}"; do
    if ollama list | grep -q "$model"; then
        echo "  Removing: $model"
        ollama rm "$model" || echo "    Warning: Could not remove $model"
    fi
done

echo ""
echo "Remaining models:"
ollama list

# Step 3: Install Qwen3-Coder-30B
echo ""
echo "Step 3: Installing qwen3-coder:30b..."
echo "This will take time (~18GB download)..."
ollama pull qwen3-coder:30b

# Step 4: Verify installation
echo ""
echo "Step 4: Verifying installation..."
ollama list

# Step 5: Test model
echo ""
echo "Step 5: Testing model..."
ollama run qwen3-coder:30b "Hello, can you generate a simple test case?"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Transfer training package: scp -r dgx_training_package madhujanu@spark-d435.local:~/qa_finetuning/"
echo "2. Setup training environment"
echo "3. Start fine-tuning"

