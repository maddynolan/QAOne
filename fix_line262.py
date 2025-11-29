#!/usr/bin/env python3
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Fix line 262 - replace the broken string
for i, line in enumerate(lines):
    if 'gradient_checkpointing=config.get(" gradient_checkpointing' in line:
        lines[i] = '        gradient_checkpointing=config.get("gradient_checkpointing", True),  # Required for 30B memory\n'
        print(f'Fixed line {i+1}')

with open('train_lora.py', 'w') as f:
    f.writelines(lines)

print('Fixed')




