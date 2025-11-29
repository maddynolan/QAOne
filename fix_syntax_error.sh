#!/bin/bash
# Fix the syntax error - close the parentheses properly

cd ~/qa_finetuning/scripts

# Fix the broken learning_rate line
python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Fix the broken learning_rate line
    if 'learning_rate=float(config.get("learning_rate"' in line:
        # Find the closing part and fix it
        if line.count('(') > line.count(')'):
            # Missing closing paren - add it before the comma
            line = line.replace(',', ')),', 1) if ', 2e-5' in line else line.replace(',', '))', 1)
        # Or if it's already broken, fix it properly
        if 'learning_rate=float(config.get("learning_rate",' in line:
            # Replace the whole thing properly
            line = line.replace(
                'learning_rate=float(config.get("learning_rate"',
                'learning_rate=float(config.get("learning_rate"'
            )
            # Ensure proper closing
            if ', 2e-5)' in line:
                line = line.replace(', 2e-5)', ', 2e-5))')
            elif ', 2e-5),' in line:
                line = line.replace(', 2e-5),', ', 2e-5)),')
    new_lines.append(line)

with open('train_lora.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed syntax error!")
EOF

# Verify syntax
python3 -m py_compile train_lora.py && echo "✅ Syntax is valid!" || echo "❌ Still has errors"




