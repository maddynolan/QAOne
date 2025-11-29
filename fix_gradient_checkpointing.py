#!/usr/bin/env python3
"""Fix gradient checkpointing issue - disable it and re-enable gradients before training"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

# Fix 1: Disable gradient checkpointing (it's causing the gradient issue)
for i, line in enumerate(lines):
    if 'gradient_checkpointing=config.get("gradient_checkpointing", True),' in line:
        lines[i] = '        gradient_checkpointing=False,  # Disabled: causes gradient issues with LoRA\n'
        print(f'✅ Disabled gradient checkpointing on line {i+1}')

# Fix 2: Add gradient re-enable right before trainer.train()
for i, line in enumerate(lines):
    if 'train_result = trainer.train()' in line:
        # Insert gradient re-enable code before this line
        gradient_fix = '''    # CRITICAL: Re-enable gradients right before training starts
    # Gradient checkpointing or trainer setup might have disabled them
    print('  Re-enabling gradients before training...')
    for name, param in model.named_parameters():
        if any(pattern in name for pattern in ['lora_A', 'lora_B', 'lora_embedding', '.lora.', 'adapter']):
            param.requires_grad = True
    final_count = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f'  Final check: {final_count:,} params have requires_grad=True')
    if final_count < 1_000_000_000:
        print('  ERROR: Too few params have gradients! Training will fail!')
    else:
        print(f'  ✅ Ready to train with {final_count:,} trainable params')
    
'''
        lines[i] = gradient_fix + line
        print(f'✅ Added gradient re-enable before training on line {i+1}')

with open(file_path, 'w') as f:
    f.writelines(lines)

print(f"✅ Fixed gradient checkpointing issue in {file_path}")




