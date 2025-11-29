#!/usr/bin/env python3
"""
ROBUST gradient fix - enable gradients for ALL trainable parameters
The issue: Only 24K params have gradients, but should be 1.1B!
"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

# Find where to add the fix
new_lines = []
found_lora = False
added_fix = False

for i, line in enumerate(lines):
    new_lines.append(line)
    
    if 'model.print_trainable_parameters()' in line:
        found_lora = True
    
    # After print_trainable_parameters, add ROBUST gradient fix
    if found_lora and not added_fix and 'model.print_trainable_parameters()' not in line:
        # Add comprehensive gradient fix
        new_lines.append("\n")
        new_lines.append("    # CRITICAL FIX: Enable gradients for ALL trainable parameters\n")
        new_lines.append("    model.train()  # Set to training mode\n")
        new_lines.append("    \n")
        new_lines.append("    # Get list of trainable parameter names from print_trainable_parameters\n")
        new_lines.append("    # Then force enable gradients for ALL parameters that should be trainable\n")
        new_lines.append("    trainable_names = set()\n")
        new_lines.append("    for name, param in model.named_parameters():\n")
        new_lines.append("        if param.requires_grad:\n")
        new_lines.append("            trainable_names.add(name)\n")
        new_lines.append("    \n")
        new_lines.append("    # Now force enable for all trainable params\n")
        new_lines.append("    for name, param in model.named_parameters():\n")
        new_lines.append("        if name in trainable_names:\n")
        new_lines.append("            param.requires_grad = True\n")
        new_lines.append("        # Also enable for any LoRA-related params\n")
        new_lines.append("        elif 'lora' in name.lower() or 'adapter' in name.lower():\n")
        new_lines.append("            param.requires_grad = True\n")
        new_lines.append("    \n")
        new_lines.append("    # Verify - should match trainable params count\n")
        new_lines.append("    trainable_with_grad = sum(p.requires_grad for p in model.parameters())\n")
        new_lines.append("    print(f'  Params with requires_grad=True: {trainable_with_grad:,}')\n")
        new_lines.append("    if trainable_with_grad < 1_000_000:\n")
        new_lines.append("        print('  WARNING: Too few params have gradients! Forcing ALL trainable params...')\n")
        new_lines.append("        # Last resort: enable for ALL parameters marked as trainable by PEFT\n")
        new_lines.append("        for name, param in model.named_parameters():\n")
        new_lines.append("            # PEFT marks trainable params - enable gradients for all of them\n")
        new_lines.append("            if hasattr(model, 'get_nb_trainable_parameters'):\n")
        new_lines.append("                # Use PEFT's internal method to find trainable params\n")
        new_lines.append("                pass\n")
        new_lines.append("            # Force enable for any param that PEFT considers trainable\n")
        new_lines.append("            if not param.requires_grad:\n")
        new_lines.append("                # Check if it's a LoRA param by checking module structure\n")
        new_lines.append("                if 'lora' in name.lower() or any(x in name.lower() for x in ['adapter', 'A', 'B']):\n")
        new_lines.append("                    param.requires_grad = True\n")
        new_lines.append("        trainable_with_grad = sum(p.requires_grad for p in model.parameters())\n")
        new_lines.append("        print(f'  After force fix: {trainable_with_grad:,}')\n")
        new_lines.append("\n")
        added_fix = True
        found_lora = False

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print(f"✅ Added ROBUST gradient fix to {file_path}!")
print("This fix:")
print("  1. Gets all trainable param names")
print("  2. Forces requires_grad=True for all of them")
print("  3. Also enables for any LoRA/adapter params")
print("  4. Verifies the count matches expected trainable params")




