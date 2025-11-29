#!/bin/bash
# Fix the preprocess_dataset function that's actually being used

cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup_correct

# Fix the preprocess_dataset function
python3 << 'FIXEOF'
with open('train_lora.py', 'r') as f:
    content = f.read()

# Find and fix preprocess_dataset function
# It's being called as: preprocess_dataset([x], tokenizer)[0]
# The issue is it returns Encoding, not dict

# Fix the function to always return dict
old_func = r'def preprocess_dataset\(examples: Dict, tokenizer, max_length: int = 2048\):.*?return tokenized'

new_func = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training - FIXED to always return dict"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize (return as lists, not tensors, for dataset.map)
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None  # Return lists, not tensors
    )
    
    # CRITICAL FIX: Ensure dict format
    if not isinstance(tokenized, dict):
        if hasattr(tokenized, 'ids'):
            tokenized = {
                "input_ids": [list(tokenized.ids)],
                "attention_mask": [list(tokenized.attention_mask)]
            }
        else:
            tokenized = dict(tokenized)
    
    # Ensure lists
    if not isinstance(tokenized.get("input_ids"), list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
    if not isinstance(tokenized.get("attention_mask"), list):
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    # Labels are the same as input_ids (for causal LM)
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all to lists
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized'''

import re
content = re.sub(old_func, new_func, content, flags=re.DOTALL)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("✅ Fixed preprocess_dataset function!")
FIXEOF

echo ""
echo "✅ Fix applied! Restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"




