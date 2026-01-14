# ✅ Fix: Model Not Trainable

## 🎯 The Problem

```
RuntimeError: element 0 of tensors does not require grad and does not have a grad_fn
```

The model parameters don't have gradients enabled. This happens when:
- Model is not in train mode
- LoRA parameters aren't properly enabled

## ✅ Quick Fix

**On DGX:**

```bash
cd ~/qa_finetuning/scripts

# Add model.train() after LoRA is applied
python3 << 'FIXEOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'model = get_peft_model(model, lora_config)' in line:
        new_lines.append("    model.train()  # Ensure training mode\n")
        new_lines.append("    # Verify LoRA parameters are trainable\n")
        new_lines.append("    trainable_count = sum(p.requires_grad for p in model.parameters())\n")
        new_lines.append("    print(f'  Trainable parameters: {trainable_count:,}')\n")

with open('train_lora.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed!")
FIXEOF
```

**OR manually edit:**

Find this line:
```python
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
```

Add after it:
```python
model.train()  # Ensure model is in training mode
```

## 🚀 Then Restart Training

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

## 📋 What This Does

- Sets model to training mode (`model.train()`)
- Ensures gradients are enabled
- Allows backpropagation to work

This should fix the gradient issue! 🎉




