#!/usr/bin/env python3
"""Final robust gradient fix - handles device placement and finds ALL LoRA params"""

file_path = "scripts/train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# Replace the gradient fix section with a version that:
# 1. Enables gradients for ALL parameters matching LoRA patterns
# 2. Works regardless of device placement
# 3. Uses PEFT's internal trainable parameter detection

import re

pattern = r'(model\.print_trainable_parameters\(\)\s*\n)(.*?)(\s+# Load dataset|\s+print\(f"\\n📊)'

def replace_fix(match):
    before = match.group(1)
    after = match.group(3)
    
    new_fix = '''    model.train()  # Set to training mode
    
    # CRITICAL FIX: Enable gradients for ALL 1.1B trainable parameters
    # The issue: PEFT marks params as trainable but requires_grad might be False
    # Solution: Enable gradients for ALL parameters that match LoRA patterns
    
    print('  Enabling gradients for all LoRA parameters...')
    
    # Method 1: Enable for ALL parameters matching LoRA patterns
    # LoRA parameters have these in their names: lora_A, lora_B, lora_embedding
    lora_param_count = 0
    for name, param in model.named_parameters():
        if any(pattern in name for pattern in ['lora_A', 'lora_B', 'lora_embedding', '.lora.', 'adapter']):
            param.requires_grad = True
            lora_param_count += param.numel()
    
    # Method 2: Also enable for any parameter that PEFT marked as trainable
    # Get all parameters that should be trainable
    for name, param in model.named_parameters():
        # If PEFT considers it trainable, force enable gradient
        if hasattr(param, 'requires_grad') and param.requires_grad:
            param.requires_grad = True
    
    # Method 3: Use PEFT's get_nb_trainable_parameters to verify
    # Then enable gradients for that many parameters
    try:
        from peft import get_peft_model_state_dict
        trainable_state = get_peft_model_state_dict(model, trainable_only=True)
        # Enable gradients for all parameters in trainable_state
        for name in trainable_state.keys():
            # Find the parameter in the model
            for model_name, param in model.named_parameters():
                if name in model_name or model_name in name:
                    param.requires_grad = True
    except:
        pass
    
    # Verify total count
    total_with_grad = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f'  Total params with requires_grad=True: {total_with_grad:,}')
    
    # If still too low, enable for ALL parameters containing 'lora' in name
    if total_with_grad < 1_000_000_000:
        print(f'  WARNING: Only {total_with_grad:,} params have gradients (expected ~1.1B)')
        print('  Forcing enable for ALL parameters with lora in name...')
        for name, param in model.named_parameters():
            if 'lora' in name.lower():
                param.requires_grad = True
        total_with_grad = sum(p.numel() for p in model.parameters() if p.requires_grad)
        print(f'  After force enable: {total_with_grad:,}')
    
    if total_with_grad >= 1_000_000_000:
        print(f'  ✅ {total_with_grad:,} params have gradients enabled')
    else:
        print(f'  ❌ ERROR: Only {total_with_grad:,} params have gradients! Training will fail!')
    
'''
    
    return before + new_fix + after

new_content = re.sub(pattern, replace_fix, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(new_content)

print(f"✅ Applied robust gradient fix to {file_path}")




