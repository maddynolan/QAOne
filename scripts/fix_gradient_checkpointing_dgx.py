#!/usr/bin/env python3
"""
Fix gradient checkpointing on DGX - Remove disable code and add enable code
Run this on DGX: python3 scripts/fix_gradient_checkpointing_dgx.py
"""

import re

script_path = "scripts/train_lora.py"

print("=" * 60)
print("Fixing Gradient Checkpointing on DGX")
print("=" * 60)

with open(script_path, 'r') as f:
    content = f.read()

# Step 1: Remove ALL gradient_checkpointing_disable code
print("\n1. Removing gradient_checkpointing_disable code...")
lines_removed = 0

# Remove the disable block
disable_pattern = r'\s*# CRITICAL: Disable gradient checkpointing at model level.*?print\("  Disabled gradient checkpointing at model level"\)'
matches = re.findall(disable_pattern, content, re.DOTALL)
if matches:
    content = re.sub(disable_pattern, '', content, flags=re.DOTALL)
    lines_removed = len(matches)
    print(f"   ✅ Removed {lines_removed} disable block(s)")

# Also remove individual disable lines
disable_lines = [
    r'if hasattr\(model, "gradient_checkpointing_disable"\):.*?model\.gradient_checkpointing_disable\(\)',
    r'if hasattr\(model\.base_model, "gradient_checkpointing_disable"\):.*?model\.base_model\.gradient_checkpointing_disable\(\)',
    r'if hasattr\(model\.base_model\.model, "gradient_checkpointing_disable"\):.*?model\.base_model\.model\.gradient_checkpointing_disable\(\)',
]

for pattern in disable_lines:
    matches = re.findall(pattern, content, re.DOTALL)
    if matches:
        content = re.sub(pattern, '', content, flags=re.DOTALL)
        lines_removed += len(matches)

# Remove the print statement
content = re.sub(r'\s*print\("  Disabled gradient checkpointing at model level"\)', '', content)

# Step 2: Ensure gradient checkpointing ENABLE code exists
print("\n2. Ensuring gradient checkpointing ENABLE code exists...")

if 'gradient_checkpointing_enable' not in content:
    print("   Adding gradient checkpointing enable code...")
    
    # Find where LoRA is applied (after model.print_trainable_parameters())
    pattern = r'(model\.print_trainable_parameters\(\))'
    replacement = r'''\1
    
    # CRITICAL: Enable gradient checkpointing at model level for 30B models
    # This is essential for memory efficiency
    if config.get("gradient_checkpointing", True):
        if hasattr(model, "gradient_checkpointing_enable"):
            model.gradient_checkpointing_enable()
        if hasattr(model, "base_model") and hasattr(model.base_model, "gradient_checkpointing_enable"):
            model.base_model.gradient_checkpointing_enable()
        print("  ✅ Gradient checkpointing enabled at model level")'''
    
    content = re.sub(pattern, replacement, content)
    print("   ✅ Added gradient checkpointing enable code")
else:
    print("   ✅ Gradient checkpointing enable code already exists")

# Step 3: Verify TrainingArguments has gradient_checkpointing=True
print("\n3. Verifying TrainingArguments...")
if 'gradient_checkpointing=config.get("gradient_checkpointing", True)' in content:
    print("   ✅ TrainingArguments has gradient_checkpointing=True")
elif 'gradient_checkpointing=False' in content:
    print("   ❌ WARNING: TrainingArguments has gradient_checkpointing=False!")
    print("   Fixing...")
    content = re.sub(
        r'gradient_checkpointing=False.*?#.*?',
        'gradient_checkpointing=config.get("gradient_checkpointing", True),  # CRITICAL: Must be True for 30B\n',
        content
    )
    print("   ✅ Fixed TrainingArguments")
else:
    print("   ⚠️  Could not verify TrainingArguments gradient_checkpointing setting")

# Write fixed file
with open(script_path, 'w') as f:
    f.write(content)

print("\n" + "=" * 60)
print("✅ FIX COMPLETE!")
print("=" * 60)
print("\nVerification:")
print("  - Removed gradient_checkpointing_disable code")
print("  - Added gradient_checkpointing_enable code")
print("  - TrainingArguments should have gradient_checkpointing=True")
print("\nNext: Restart training!")



