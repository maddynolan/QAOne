#!/usr/bin/env python3
"""
Fix the gradient issue - ensure LoRA parameters have requires_grad=True
This is the root cause of "does not require grad" error
"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# The issue: LoRA parameters might not have requires_grad=True
# Fix: After get_peft_model, explicitly enable gradients for LoRA params

fix_code = '''    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # CRITICAL FIX: Ensure LoRA parameters have gradients enabled
    model.train()  # Set to training mode
    for name, param in model.named_parameters():
        if 'lora' in name.lower() or param.requires_grad:
            param.requires_grad = True
    
    # Verify trainable parameters
    trainable = sum(p.requires_grad for p in model.parameters())
    print(f"  Trainable params with gradients: {trainable:,}")'''

# Find and replace the LoRA application section
old_pattern = r'model = get_peft_model\(model, lora_config\)\s+model\.print_trainable_parameters\(\)'
new_pattern = fix_code

if re.search(old_pattern, content):
    content = re.sub(old_pattern, new_pattern, content)
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Fixed {file_path}!")
    print("Added explicit requires_grad=True for LoRA parameters")
else:
    # Try alternative pattern
    if 'model = get_peft_model(model, lora_config)' in content:
        lines = content.split('\n')
        new_lines = []
        found = False
        
        for i, line in enumerate(lines):
            new_lines.append(line)
            if 'model = get_peft_model(model, lora_config)' in line:
                found = True
            elif found and 'model.print_trainable_parameters()' in line:
                new_lines.append("    model.train()  # Set to training mode")
                new_lines.append("    # CRITICAL: Enable gradients for LoRA parameters")
                new_lines.append("    for name, param in model.named_parameters():")
                new_lines.append("        if 'lora' in name.lower() or param.requires_grad:")
                new_lines.append("            param.requires_grad = True")
                new_lines.append("    trainable = sum(p.requires_grad for p in model.parameters())")
                new_lines.append("    print(f'  Trainable params with gradients: {trainable:,}')")
                found = False
        
        with open(file_path, 'w') as f:
            f.write('\n'.join(new_lines))
        print(f"✅ Fixed {file_path}!")
    else:
        print(f"❌ Could not find LoRA application in {file_path}")




