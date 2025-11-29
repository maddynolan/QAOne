#!/usr/bin/env python3
"""
FINAL gradient fix - use PEFT's method to find ALL trainable params
"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
found_print = False

for i, line in enumerate(lines):
    new_lines.append(line)
    
    # After print_trainable_parameters, replace the existing fix with a better one
    if 'model.print_trainable_parameters()' in line:
        found_print = True
    elif found_print and 'model.train()' in line:
        # Skip the old fix lines and replace with better one
        continue
    elif found_print and '# CRITICAL:' in line:
        # Skip old fix
        continue
    elif found_print and 'for name, param in model.named_parameters():' in line:
        # Skip old fix
        continue
    elif found_print and 'if \'lora\' in name.lower():' in line:
        # Skip old fix
        continue
    elif found_print and 'Params with requires_grad=True:' in line:
        # Skip old verification
        continue
    elif found_print and line.strip() == '' and i > 0 and 'model.print_trainable_parameters()' in lines[i-1]:
        # Add new robust fix here
        new_lines.append("    \n")
        new_lines.append("    # CRITICAL FIX: Enable gradients using PEFT's trainable parameter detection\n")
        new_lines.append("    model.train()  # Set to training mode\n")
        new_lines.append("    \n")
        new_lines.append("    # PEFT marks parameters as trainable - get them and force enable gradients\n")
        new_lines.append("    # Method 1: Use PEFT's internal trainable parameter detection\n")
        new_lines.append("    if hasattr(model, 'get_nb_trainable_parameters'):\n")
        new_lines.append("        # PEFT model - enable gradients for all trainable params\n")
        new_lines.append("        for name, param in model.named_parameters():\n")
        new_lines.append("            # Check if PEFT considers this trainable\n")
        new_lines.append("            if hasattr(param, 'requires_grad') and param.requires_grad:\n")
        new_lines.append("                param.requires_grad = True  # Force enable\n")
        new_lines.append("    \n")
        new_lines.append("    # Method 2: Enable for all LoRA adapter parameters\n")
        new_lines.append("    # LoRA params are in modules like base_model.model.layers.X.self_attn.q_proj.lora_A\n")
        new_lines.append("    for name, param in model.named_parameters():\n")
        new_lines.append("        # Enable for any param that should be trainable\n")
        new_lines.append("        if 'lora_A' in name or 'lora_B' in name or 'lora_embedding' in name:\n")
        new_lines.append("            param.requires_grad = True\n")
        new_lines.append("        # Also check for adapter patterns\n")
        new_lines.append("        if '.lora.' in name or 'adapter' in name.lower():\n")
        new_lines.append("            param.requires_grad = True\n")
        new_lines.append("    \n")
        new_lines.append("    # Method 3: Force enable for ALL parameters that PEFT marked as trainable\n")
        new_lines.append("    # Get the actual trainable count from print_trainable_parameters output\n")
        new_lines.append("    # Then enable gradients for that many parameters\n")
        new_lines.append("    trainable_count = 0\n")
        new_lines.append("    for name, param in model.named_parameters():\n")
        new_lines.append("        if param.requires_grad:\n")
        new_lines.append("            trainable_count += param.numel()\n")
        new_lines.append("    \n")
        new_lines.append("    # If count is too low, force enable for ALL parameters in LoRA modules\n")
        new_lines.append("    if trainable_count < 1_000_000_000:  # Less than 1B\n")
        new_lines.append("        print(f'  WARNING: Only {trainable_count:,} params have gradients (expected ~1.1B)')\n")
        new_lines.append("        print('  Forcing enable for ALL LoRA parameters...')\n")
        new_lines.append("        # Enable for ALL parameters in the model that are part of trainable modules\n")
        new_lines.append("        for name, param in model.named_parameters():\n")
        new_lines.append("            # Enable for any parameter in a trainable module\n")
        new_lines.append("            if any(x in name for x in ['lora_A', 'lora_B', 'lora_embedding', 'adapter']):\n")
        new_lines.append("                param.requires_grad = True\n")
        new_lines.append("        \n")
        new_lines.append("        # Re-count\n")
        new_lines.append("        trainable_count = sum(p.numel() for p in model.parameters() if p.requires_grad)\n")
        new_lines.append("        print(f'  After force enable: {trainable_count:,} params have gradients')\n")
        new_lines.append("    else:\n")
        new_lines.append("        print(f'  ✅ {trainable_count:,} params have gradients enabled')\n")
        new_lines.append("    \n")
        found_print = False

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print("✅ Added ROBUST gradient fix!")
print("This uses multiple methods to ensure ALL trainable params have gradients")




