#!/usr/bin/env python3
"""COMPLETE fix for ALL gradient issues - this MUST work"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

# Fix 1: Change gradient_checkpointing to False
# Fix 2: Change evaluation_strategy to eval_strategy
# Fix 3: Add model-level gradient checkpointing disable after LoRA
# Fix 4: Add gradient re-enable + torch.set_grad_enabled before training

for i, line in enumerate(lines):
    # Fix 1: Disable gradient checkpointing
    if 'gradient_checkpointing=config.get("gradient_checkpointing", True),' in line:
        lines[i] = '        gradient_checkpointing=False,  # CRITICAL: Must be False for LoRA\n'
        print(f'✅ Fixed gradient_checkpointing on line {i+1}')
    
    # Fix 2: Change evaluation_strategy to eval_strategy
    if 'evaluation_strategy=' in line and 'eval_strategy' not in line:
        lines[i] = line.replace('evaluation_strategy', 'eval_strategy')
        print(f'✅ Fixed evaluation_strategy on line {i+1}')
    
    # Fix 3: Add model-level disable after gradient enable
    if '✅' in line and 'params have gradients enabled' in line:
        # Add after this line
        disable_code = '''    # CRITICAL: Disable gradient checkpointing at MODEL level
    # Trainer might enable it even though we disabled it in TrainingArguments
    if hasattr(model, "gradient_checkpointing_disable"):
        model.gradient_checkpointing_disable()
    if hasattr(model, "base_model"):
        if hasattr(model.base_model, "gradient_checkpointing_disable"):
            model.base_model.gradient_checkpointing_disable()
        if hasattr(model.base_model, "model") and hasattr(model.base_model.model, "gradient_checkpointing_disable"):
            model.base_model.model.gradient_checkpointing_disable()
    print("  Disabled gradient checkpointing at model level")
    
'''
        lines.insert(i+1, disable_code)
        print(f'✅ Added model-level disable after line {i+1}')
        break

# Fix 4: Add gradient re-enable before trainer.train()
for i, line in enumerate(lines):
    if 'train_result = trainer.train()' in line:
        gradient_fix = '''    # CRITICAL: Re-enable gradients right before training
    # Ensure gradients are enabled globally and for all LoRA params
    import torch
    torch.set_grad_enabled(True)
    
    print("  Re-enabling gradients before training...")
    for name, param in model.named_parameters():
        if any(pattern in name for pattern in ['lora_A', 'lora_B', 'lora_embedding', '.lora.', 'adapter']):
            param.requires_grad = True
    
    # Ensure model is in train mode
    model.train()
    
    # Verify
    final_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Final check: {final_count:,} params have requires_grad=True")
    if final_count < 1_000_000_000:
        raise RuntimeError(f"Only {final_count:,} params have gradients! Expected ~1.1B")
    print(f"  ✅ Ready to train with {final_count:,} trainable params")
    
'''
        lines[i] = gradient_fix + line
        print(f'✅ Added gradient re-enable before training on line {i+1}')
        break

with open(file_path, 'w') as f:
    f.writelines(lines)

print(f"\n✅✅✅ COMPLETE FIX APPLIED to {file_path}")
print("This fixes:")
print("  1. gradient_checkpointing=False in TrainingArguments")
print("  2. evaluation_strategy -> eval_strategy")
print("  3. Model-level gradient checkpointing disable")
print("  4. Gradient re-enable + torch.set_grad_enabled before training")




