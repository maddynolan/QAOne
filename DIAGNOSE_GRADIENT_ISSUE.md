# Gradient Issue Diagnosis

The problem: Even though we enable gradients for 1.1B params, training fails with "does not require grad".

## What We Know:
1. ✅ Gradients ARE enabled: `1,134,034,944 params have gradients enabled`
2. ❌ Training fails: `None of the inputs have requires_grad=True`
3. ⚠️ Gradient checkpointing warning appears even though we disabled it

## Root Cause Hypothesis:
The Trainer or gradient checkpointing is disabling gradients AFTER we enable them, OR the model inputs (not parameters) don't have gradients.

## Solution Options:

### Option 1: Disable gradient checkpointing completely
Add this RIGHT after LoRA is applied:
```python
# Disable gradient checkpointing at model level
if hasattr(model, "gradient_checkpointing_disable"):
    model.gradient_checkpointing_disable()
if hasattr(model, "base_model") and hasattr(model.base_model, "gradient_checkpointing_disable"):
    model.base_model.gradient_checkpointing_disable()
```

### Option 2: Use custom training loop
Instead of Trainer, use a manual training loop that ensures gradients stay enabled.

### Option 3: Check PEFT version compatibility
Some PEFT versions have issues with gradient checkpointing. Try updating or downgrading.

## Quick Fix to Try:
Run this on DGX:
```bash
cd ~/qa_finetuning/scripts
python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Find where we enable gradients and add model-level gradient checkpointing disable
for i, line in enumerate(lines):
    if '✅' in line and 'params have gradients enabled' in line:
        lines.insert(i+1, '    \n')
        lines.insert(i+2, '    # Disable gradient checkpointing at model level\n')
        lines.insert(i+3, '    if hasattr(model, "gradient_checkpointing_disable"):\n')
        lines.insert(i+4, '        model.gradient_checkpointing_disable()\n')
        lines.insert(i+5, '    if hasattr(model, "base_model"):\n')
        lines.insert(i+6, '        if hasattr(model.base_model, "gradient_checkpointing_disable"):\n')
        lines.insert(i+7, '            model.base_model.gradient_checkpointing_disable()\n')
        break

with open('train_lora.py', 'w') as f:
    f.writelines(lines)
print('Added model-level gradient checkpointing disable')
EOF
```

Then restart training.




