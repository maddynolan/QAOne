#!/bin/bash
# Fix gradient checkpointing on DGX - REMOVE the disable code and ensure it's enabled

SCRIPT_PATH="~/qa_finetuning/scripts/train_lora.py"

echo "=========================================="
echo "Fixing Gradient Checkpointing on DGX"
echo "=========================================="
echo ""

# Remove the line that disables gradient checkpointing
echo "1. Removing 'Disabled gradient checkpointing at model level' code..."
sed -i '/Disabled gradient checkpointing at model level/d' $SCRIPT_PATH
sed -i '/gradient_checkpointing_disable/d' $SCRIPT_PATH

# Ensure gradient checkpointing is ENABLED
echo "2. Ensuring gradient checkpointing is enabled..."

# Check if enable code exists, if not add it
if ! grep -q "gradient_checkpointing_enable" $SCRIPT_PATH; then
    echo "   Adding gradient checkpointing enable code..."
    # Find the line after LoRA is applied and add enable code
    sed -i '/model.print_trainable_parameters()/a\
    # CRITICAL: Enable gradient checkpointing at model level for 30B models\
    # This is essential for memory efficiency\
    if config.get("gradient_checkpointing", True):\
        if hasattr(model, "gradient_checkpointing_enable"):\
            model.gradient_checkpointing_enable()\
        if hasattr(model, "base_model") and hasattr(model.base_model, "gradient_checkpointing_enable"):\
            model.base_model.gradient_checkpointing_enable()\
        print("  ✅ Gradient checkpointing enabled at model level")
' $SCRIPT_PATH
fi

echo ""
echo "3. Verifying fix..."
if grep -q "gradient_checkpointing_enable" $SCRIPT_PATH; then
    echo "   ✅ Gradient checkpointing ENABLE code found"
else
    echo "   ❌ Gradient checkpointing ENABLE code NOT found"
fi

if grep -q "gradient_checkpointing_disable" $SCRIPT_PATH; then
    echo "   ❌ WARNING: gradient_checkpointing_disable code still exists!"
else
    echo "   ✅ gradient_checkpointing_disable code removed"
fi

echo ""
echo "=========================================="
echo "Fix complete! Restart training."
echo "=========================================="



