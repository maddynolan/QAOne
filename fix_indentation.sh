#!/bin/bash
# Fix the indentation issue on line 185

cd ~/qa_finetuning/scripts

# Check the indentation of surrounding lines
echo "Checking lines 183-187:"
sed -n '183,187p' train_lora.py

# Fix it properly - use the same indentation as other lines
python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Check what indentation line 184 uses
if len(lines) >= 184:
    indent = len(lines[183]) - len(lines[183].lstrip())  # Get indentation from line 184
    print(f"Indentation should be: {indent} spaces")
    
    # Fix line 185
    if len(lines) >= 185:
        # Replace line 185 with correct indentation
        lines[184] = ' ' * indent + 'learning_rate=float(config.get("learning_rate", 2e-5)),\n'
        print(f"Fixed line 185 with {indent} spaces indentation")

with open('train_lora.py', 'w') as f:
    f.writelines(lines)

print("✅ Fixed!")
EOF

# Verify
python3 -m py_compile train_lora.py && echo "✅ Syntax OK!" || echo "❌ Still broken"




