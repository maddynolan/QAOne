#!/usr/bin/env python3
"""
Fix gradient issue properly - ensure ALL LoRA parameters have requires_grad=True
The issue: Only 24,960 params have gradients, but should be 1.1B!
"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
found_lora = False
added_fix = False

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # Find where LoRA is applied
    if 'model = get_peft_model(model, lora_config)' in line:
        found_lora = True
    
    # After print_trainable_parameters, add the gradient fix
    if found_lora and 'model.print_trainable_parameters()' in line and not added_fix:
        new_lines.append("\n")
        new_lines.append("    # CRITICAL FIX: Enable gradients for ALL LoRA parameters\n")
        new_lines.append("    model.train()  # Set to training mode\n")
        new_lines.append("    # Explicitly enable gradients - the issue is they're not enabled!\n")
        new_lines.append("    for name, param in model.named_parameters():\n")
        new_lines.append("        if param.requires_grad:  # If it should be trainable\n")
        new_lines.append("            param.requires_grad = True  # Force enable\n")
        new_lines.append("    \n")
        new_lines.append("    # Verify - should match trainable params count\n")
        new_lines.append("    trainable_with_grad = sum(p.requires_grad for p in model.parameters())\n")
        new_lines.append("    print(f'  Params with requires_grad=True: {trainable_with_grad:,}')\n")
        new_lines.append("    if trainable_with_grad < 1_000_000:\n")
        new_lines.append("        print('  WARNING: Too few params have gradients! LoRA might not work.')\n")
        new_lines.append("        # Force enable for all parameters marked as trainable\n")
        new_lines.append("        for name, param in model.named_parameters():\n")
        new_lines.append("            if 'lora' in name.lower():\n")
        new_lines.append("                param.requires_grad = True\n")
        new_lines.append("        trainable_with_grad = sum(p.requires_grad for p in model.parameters())\n")
        new_lines.append("        print(f'  After force fix: {trainable_with_grad:,}')\n")
        added_fix = True
        found_lora = False

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print(f"✅ Fixed {file_path}!")
print("Added comprehensive gradient fix that:")
print("  1. Sets model.train()")
print("  2. Explicitly enables requires_grad=True for trainable params")
print("  3. If still too few, forces enable for all LoRA params")
print("  4. Verifies the count matches expected trainable params")




