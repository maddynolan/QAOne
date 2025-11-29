#!/bin/bash
# Fix syntax error properly using Python

cd ~/qa_finetuning/scripts

python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines, 1):
    # Fix line 185 - the broken learning_rate line
    if i == 185:
        # The line is probably: learning_rate=float(config.get("learning_rate", 2e-5),
        # It should be: learning_rate=float(config.get("learning_rate", 2e-5)),
        if 'learning_rate=float(config.get("learning_rate", 2e-5),' in line:
            line = line.replace(
                'learning_rate=float(config.get("learning_rate", 2e-5),',
                'learning_rate=float(config.get("learning_rate", 2e-5)),'
            )
        elif 'learning_rate=float(config.get("learning_rate"' in line and '),' not in line:
            # Missing closing paren
            line = line.rstrip()
            if line.endswith(','):
                line = line[:-1] + ')),' + '\n'
            else:
                line = line + ')' + '\n'
    new_lines.append(line)

with open('train_lora.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed syntax!")
EOF

# Verify
python3 -m py_compile train_lora.py && echo "✅ Syntax is valid!" || echo "❌ Still broken - checking line 185:"
python3 -m py_compile train_lora.py 2>&1 | head -5




