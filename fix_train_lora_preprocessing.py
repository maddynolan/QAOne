#!/usr/bin/env python3
"""
Fix for train_lora.py preprocessing issue
Run this on DGX to fix the training script
"""

FIX = '''
# Replace the preprocess_function in train_lora.py with this:

def preprocess_function(examples):
    """Preprocess function for dataset.map - FIXED VERSION"""
    # Format prompts - examples is a dict with lists of values when batched=True
    prompts = []
    for i in range(len(examples.get("instruction", []))):
        example = {
            "instruction": examples["instruction"][i] if "instruction" in examples else "",
            "input": examples["input"][i] if "input" in examples else "",
            "output": examples["output"][i] if "output" in examples else ""
        }
        prompts.append(format_prompt(example))
    
    # Tokenize batch - ensure we pass a list and get a dict back
    tokenized = tokenizer(
        prompts,  # List of strings
        truncation=True,
        max_length=2048,
        padding="max_length",
        return_tensors=None  # Returns dict with lists, not tensors
    )
    
    # CRITICAL FIX: Ensure tokenized is a dict, not Encoding object
    # If tokenizer returned Encoding (shouldn't happen with list input, but check)
    if not isinstance(tokenized, dict):
        # Convert Encoding to dict
        tokenized = {
            "input_ids": tokenized["input_ids"],
            "attention_mask": tokenized["attention_mask"]
        }
    
    # Ensure all values are lists (not single items)
    if not isinstance(tokenized["input_ids"], list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    # Labels are the same as input_ids (for causal LM)
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Final check: ensure each element in lists is a list (not tensor or Encoding)
    tokenized["input_ids"] = [
        list(x) if not isinstance(x, list) else x 
        for x in tokenized["input_ids"]
    ]
    tokenized["attention_mask"] = [
        list(x) if not isinstance(x, list) else x 
        for x in tokenized["attention_mask"]
    ]
    tokenized["labels"] = [
        list(x) if not isinstance(x, list) else x 
        for x in tokenized["labels"]
    ]
    
    return tokenized
'''

print("=" * 70)
print("FIX FOR train_lora.py PREPROCESSING ISSUE")
print("=" * 70)
print()
print("The issue: tokenizer returns Encoding object instead of dict")
print("The fix: ensure we always return a dict with lists")
print()
print("Copy this function to replace preprocess_function in:")
print("  ~/qa_finetuning/scripts/train_lora.py")
print()
print("-" * 70)
print(FIX)
print("-" * 70)




