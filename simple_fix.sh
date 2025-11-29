#!/bin/bash
# Simple fix using sed - just changes the critical lines

cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup

# Fix 1: Change return_tensors="pt" to return_tensors=None
sed -i 's/return_tensors="pt"/return_tensors=None/g' train_lora.py

# Fix 2: Change .clone() to .copy()
sed -i 's/\.clone()/.copy()/g' train_lora.py

# Fix 3: Add dict check after tokenized = tokenizer(...)
# Find the line after return_tensors=None and add the check
python3 << 'PYEOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Find line with return_tensors=None
for i, line in enumerate(lines):
    if 'return_tensors=None' in line:
        # Find the closing ) of tokenizer call
        j = i
        while j < len(lines) and ')' not in lines[j]:
            j += 1
        
        # Insert dict check after the closing )
        check_lines = [
            '    )\n',
            '    \n',
            '    # CRITICAL FIX: Ensure dict format\n',
            '    if not isinstance(tokenized, dict):\n',
            '        if hasattr(tokenized, "ids"):\n',
            '            tokenized = {\n',
            '                "input_ids": [list(tokenized.ids)],\n',
            '                "attention_mask": [list(tokenized.attention_mask)]\n',
            '            }\n',
            '        else:\n',
            '            tokenized = dict(tokenized)\n',
            '    \n',
            '    # Ensure lists\n',
            '    if not isinstance(tokenized.get("input_ids"), list):\n',
            '        tokenized["input_ids"] = [tokenized["input_ids"]]\n',
            '    if not isinstance(tokenized.get("attention_mask"), list):\n',
            '        tokenized["attention_mask"] = [tokenized["attention_mask"]]\n',
            '    \n'
        ]
        
        # Replace the closing ) line
        if j < len(lines):
            lines[j] = '    )\n'
            # Insert check after this line
            lines = lines[:j+1] + check_lines + lines[j+1:]
            break

with open('train_lora.py', 'w') as f:
    f.writelines(lines)

print("✅ Fixed!")
PYEOF

echo ""
echo "✅ Fix applied! Verifying..."
grep -A 3 "CRITICAL FIX" train_lora.py

echo ""
echo "Restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"




