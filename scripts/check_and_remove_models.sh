#!/bin/bash
# Quick script to check models and optionally remove old ones
# Run on DGX: bash check_and_remove_models.sh

echo "=========================================="
echo "Model Management on DGX"
echo "=========================================="

# Check current models
echo ""
echo "Current models:"
ollama list

# Show disk space
echo ""
echo "Disk space:"
df -h | grep -E "Filesystem|/$|/home"

# List models to potentially remove
echo ""
echo "Models that can be removed (7B, 14B, old fine-tuned):"
ollama list | tail -n +2 | awk '{print $1}' | while read model; do
    if [[ "$model" != *"30B"* ]] && [[ "$model" != *"30b"* ]] && [[ "$model" != *"Qwen3-Coder-30B"* ]]; then
        echo "  - $model"
    fi
done

echo ""
echo "To remove a model, run:"
echo "  ollama rm <model-name>"
echo ""
echo "Example:"
echo "  ollama rm qwen2.5:7b-instruct"
echo "  ollama rm qwen2.5-coder:14b"
echo "  ollama rm qa-expert:7b"




