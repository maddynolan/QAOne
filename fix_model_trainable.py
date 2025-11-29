#!/usr/bin/env python3
"""
Fix model trainable parameters - ensure model is in train mode
Run on DGX: python3 fix_model_trainable.py
"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# Check if model.train() is called after LoRA is applied
if 'model = get_peft_model(model, lora_config)' in content:
    # Find where LoRA is applied
    lines = content.split('\n')
    new_lines = []
    lora_applied = False
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        # After LoRA is applied, ensure model is in train mode
        if 'model = get_peft_model(model, lora_config)' in line:
            lora_applied = True
            # Add model.train() and ensure parameters are trainable
            new_lines.append("    model.train()  # Ensure model is in training mode")
            new_lines.append("    # Ensure LoRA parameters are trainable")
            new_lines.append("    for name, param in model.named_parameters():")
            new_lines.append("        if 'lora' in name.lower():")
            new_lines.append("            param.requires_grad = True")
    
    content = '\n'.join(new_lines)
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"✅ Fixed {file_path}!")
    print("Added:")
    print("  - model.train()")
    print("  - Ensure LoRA parameters have requires_grad=True")
else:
    print(f"❌ Could not find LoRA application in {file_path}")




