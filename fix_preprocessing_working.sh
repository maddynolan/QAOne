#!/bin/bash
# Working fix for preprocessing function - reads actual file and fixes it properly

cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup_working

# Read the actual function and fix it
python3 << 'PYEOF'
import re

with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Find the function start (line with "def preprocess_function")
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'def preprocess_function(examples):' in line:
        start_idx = i
    elif start_idx is not None and line.strip() == 'return tokenized':
        end_idx = i
        break

if start_idx is None or end_idx is None:
    print("❌ Could not find function boundaries")
    exit(1)

print(f"Found function at lines {start_idx+1} to {end_idx+1}")

# Build new function
new_function_lines = [
    '    def preprocess_function(examples):\n',
    '        """Preprocess function - FIXED to always return dict"""\n',
    '        # Format prompts\n',
    '        prompts = []\n',
    '        for i in range(len(examples.get("instruction", []))):\n',
    '            example = {\n',
    '                "instruction": examples["instruction"][i] if "instruction" in examples else "",\n',
    '                "input": examples["input"][i] if "input" in examples else "",\n',
    '                "output": examples["output"][i] if "output" in examples else ""\n',
    '            }\n',
    '            prompts.append(format_prompt(example))\n',
    '        \n',
    '        # Tokenize\n',
    '        tokenized = tokenizer(\n',
    '            prompts,\n',
    '            truncation=True,\n',
    '            max_length=2048,\n',
    '            padding="max_length",\n',
    '            return_tensors=None\n',
    '        )\n',
    '        \n',
    '        # CRITICAL FIX: Ensure dict format\n',
    '        if not isinstance(tokenized, dict):\n',
    '            if hasattr(tokenized, "ids"):\n',
    '                tokenized = {\n',
    '                    "input_ids": [list(tokenized.ids)],\n',
    '                    "attention_mask": [list(tokenized.attention_mask)]\n',
    '                }\n',
    '            else:\n',
    '                tokenized = dict(tokenized)\n',
    '        \n',
    '        # Ensure lists\n',
    '        if not isinstance(tokenized.get("input_ids"), list):\n',
    '            tokenized["input_ids"] = [tokenized["input_ids"]]\n',
    '        if not isinstance(tokenized.get("attention_mask"), list):\n',
    '            tokenized["attention_mask"] = [tokenized["attention_mask"]]\n',
    '        \n',
    '        # Labels\n',
    '        tokenized["labels"] = tokenized["input_ids"].copy()\n',
    '        \n',
    '        # Convert all to lists\n',
    '        tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]\n',
    '        tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]\n',
    '        tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]\n',
    '        \n',
    '        return tokenized\n'
]

# Replace the function
new_lines = lines[:start_idx] + new_function_lines + lines[end_idx+1:]

with open('train_lora.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Function replaced successfully!")
print(f"   Replaced lines {start_idx+1}-{end_idx+1}")
PYEOF

echo ""
echo "✅ Fix applied! Verifying..."
grep -A 5 "def preprocess_function" train_lora.py | head -8

echo ""
echo "Now restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"




