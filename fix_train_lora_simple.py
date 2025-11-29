#!/usr/bin/env python3
"""
Simple fix for train_lora.py - just fixes the preprocess_dataset function
Run this on DGX: python3 fix_train_lora_simple.py
"""

import sys

file_path = sys.argv[1] if len(sys.argv) > 1 else "train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# Simple string replacement - find exact match
old_code = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors="pt"
    )
    
    # Labels are the same as input_ids (for causal LM)
    tokenized["labels"] = tokenized["input_ids"].clone()
    
    return tokenized'''

new_code = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training - FIXED"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize (return lists, not tensors)
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None
    )
    
    # CRITICAL FIX: Ensure dict format
    if not isinstance(tokenized, dict):
        if hasattr(tokenized, "ids"):
            tokenized = {"input_ids": [list(tokenized.ids)], "attention_mask": [list(tokenized.attention_mask)]}
        else:
            tokenized = dict(tokenized)
    
    # Ensure lists
    if not isinstance(tokenized.get("input_ids"), list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
    if not isinstance(tokenized.get("attention_mask"), list):
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    # Labels
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all to lists
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized'''

if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Fixed {file_path}!")
else:
    print(f"❌ Could not find exact match in {file_path}")
    print("Trying alternative...")
    # Try with different spacing
    import re
    pattern = r'def preprocess_dataset.*?return tokenized'
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, new_code, content, flags=re.DOTALL)
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"✅ Fixed {file_path} with regex!")
    else:
        print("❌ Could not find function. Please edit manually.")
        sys.exit(1)




