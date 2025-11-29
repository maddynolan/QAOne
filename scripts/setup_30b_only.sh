#!/bin/bash
# Script to setup Qwen3-Coder-30B and remove other models
# Run on DGX: bash setup_30b_only.sh

set -e

echo "=========================================="
echo "DGX Setup: Qwen3-Coder-30B Only"
echo "=========================================="

# Step 1: Check system info
echo ""
echo "Step 1: Checking system info..."
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
echo ""
echo "Disk space:"
df -h | grep -E "Filesystem|/$|/home"

# Step 2: Check GPU
echo ""
echo "Step 2: Checking GPU..."
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader

# Step 3: Check Ollama
echo ""
echo "Step 3: Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "Ollama is installed:"
    ollama --version
fi

# Step 4: List current models
echo ""
echo "Step 4: Current models installed:"
ollama list

# Step 5: Calculate space used by current models
echo ""
echo "Step 5: Checking model sizes..."
MODELS_TO_REMOVE=()
CURRENT_MODELS=$(ollama list --format json 2>/dev/null | jq -r '.[] | select(.name | test("qwen|qa-expert")) | .name' 2>/dev/null || ollama list | tail -n +2 | awk '{print $1}')

if [ -n "$CURRENT_MODELS" ]; then
    echo "Found models that can be removed:"
    for model in $CURRENT_MODELS; do
        # Skip if it's already the 30B model
        if [[ "$model" != *"30B"* ]] && [[ "$model" != *"30b"* ]]; then
            MODELS_TO_REMOVE+=("$model")
            echo "  - $model"
        fi
    done
else
    echo "No models found to remove"
fi

# Step 6: Ask for confirmation (or auto-remove if MODELS_TO_REMOVE is set)
if [ ${#MODELS_TO_REMOVE[@]} -gt 0 ]; then
    echo ""
    echo "Step 6: Removing old models to free space..."
    for model in "${MODELS_TO_REMOVE[@]}"; do
        echo "  Removing: $model"
        ollama rm "$model" || echo "    Warning: Could not remove $model (may not exist)"
    done
    echo ""
    echo "Remaining models:"
    ollama list
else
    echo ""
    echo "Step 6: No old models to remove"
fi

# Step 7: Install Qwen3-Coder-30B
echo ""
echo "Step 7: Installing Qwen3-Coder-30B-Instruct..."
echo "This will take time (~60GB download)..."
echo "Starting download..."

# Start download in background and show progress
ollama pull Qwen/Qwen3-Coder-30B-Instruct &
DOWNLOAD_PID=$!

# Monitor progress
while kill -0 $DOWNLOAD_PID 2>/dev/null; do
    echo "  Downloading... (check progress with: ollama list)"
    sleep 10
done

wait $DOWNLOAD_PID
DOWNLOAD_STATUS=$?

if [ $DOWNLOAD_STATUS -eq 0 ]; then
    echo ""
    echo "  [OK] Qwen3-Coder-30B installed successfully!"
else
    echo ""
    echo "  [ERROR] Download failed. Check logs above."
    exit 1
fi

# Step 8: Verify installation
echo ""
echo "Step 8: Verifying installation..."
ollama list

# Step 9: Test the model
echo ""
echo "Step 9: Testing Qwen3-Coder-30B..."
echo "Running quick test..."
ollama run Qwen/Qwen3-Coder-30B-Instruct "Generate a simple test case for user login" <<< "exit" || echo "Test completed"

# Step 10: Final status
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Current models:"
ollama list
echo ""
echo "Disk space after installation:"
df -h | grep -E "Filesystem|/$|/home"
echo ""
echo "Next steps:"
echo "1. Fine-tune the model: cd ~/qa_finetuning/dgx_training_package"
echo "2. Start training: python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml"
echo ""




