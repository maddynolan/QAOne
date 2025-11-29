#!/bin/bash
# Fix the entire TrainingArguments block properly

cd ~/qa_finetuning/scripts

# Show context around line 185
echo "Context around line 185:"
sed -n '180,190p' train_lora.py

# Fix it properly - restore from backup or fix the whole block
python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Find TrainingArguments block
for i in range(len(lines)):
    if 'training_args = TrainingArguments(' in lines[i]:
        # Found it - check the next few lines
        print(f"Found TrainingArguments at line {i+1}")
        # Check indentation of next line
        if i+1 < len(lines):
            next_line = lines[i+1]
            indent = len(next_line) - len(next_line.lstrip())
            print(f"Next line indentation: {indent} spaces")
            # Fix line 185 (index 184) to match
            if 'learning_rate' in lines[184]:
                # Get correct indentation from a working line
                for j in range(i+1, min(i+10, len(lines))):
                    if 'per_device_train_batch_size' in lines[j] or 'gradient_accumulation_steps' in lines[j]:
                        correct_indent = len(lines[j]) - len(lines[j].lstrip())
                        lines[184] = ' ' * correct_indent + 'learning_rate=float(config.get("learning_rate", 2e-5)),\n'
                        print(f"Fixed line 185 with {correct_indent} spaces (from line {j+1})")
                        break
        break

with open('train_lora.py', 'w') as f:
    f.writelines(lines)

print("✅ Fixed!")
EOF

# Verify
python3 -m py_compile train_lora.py && echo "✅ Syntax OK!" || echo "❌ Still broken"




