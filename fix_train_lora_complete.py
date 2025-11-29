#!/usr/bin/env python3
"""
Complete fix for train_lora.py preprocessing function
This ensures the function always returns a dict, not Encoding objects
"""

import re
import sys

def fix_preprocessing_function(file_path):
    """Fix the preprocess_function to always return dict"""
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the preprocess_function - look for the exact pattern
    # We need to find from "def preprocess_function" to "return tokenized"
    pattern = r'(    def preprocess_function\(examples\):.*?)(        return tokenized)'
    
    # New function that always returns dict
    replacement = r'''    def preprocess_function(examples):
        """Preprocess function - FIXED to always return dict"""
        # Format prompts
        prompts = []
        for i in range(len(examples.get("instruction", []))):
            example = {
                "instruction": examples["instruction"][i] if "instruction" in examples else "",
                "input": examples["input"][i] if "input" in examples else "",
                "output": examples["output"][i] if "output" in examples else ""
            }
            prompts.append(format_prompt(example))
        
        # Tokenize - always pass list to get dict back
        tokenized = tokenizer(
            prompts,  # List of strings
            truncation=True,
            max_length=2048,
            padding="max_length",
            return_tensors=None  # Returns dict with lists
        )
        
        # CRITICAL FIX: Ensure it's a dict, not Encoding
        if not isinstance(tokenized, dict):
            # Convert Encoding to dict
            if hasattr(tokenized, 'ids'):
                tokenized = {
                    "input_ids": [list(tokenized.ids)],
                    "attention_mask": [list(tokenized.attention_mask)]
                }
            else:
                # Already has input_ids but not a dict
                tokenized = {
                    "input_ids": list(tokenized["input_ids"]) if isinstance(tokenized["input_ids"], (list, tuple)) else [tokenized["input_ids"]],
                    "attention_mask": list(tokenized["attention_mask"]) if isinstance(tokenized["attention_mask"], (list, tuple)) else [tokenized["attention_mask"]]
                }
        
        # Ensure all values are lists (not single items)
        if not isinstance(tokenized["input_ids"], list):
            tokenized["input_ids"] = [tokenized["input_ids"]]
            tokenized["attention_mask"] = [tokenized["attention_mask"]]
        
        # Labels are same as input_ids
        tokenized["labels"] = tokenized["input_ids"].copy()
        
        # Final check: ensure each element is a list
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
        
        return tokenized'''
    
    # Try to replace
    if re.search(pattern, content, re.DOTALL):
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"✅ Fixed {file_path}")
        return True
    else:
        print(f"❌ Could not find preprocess_function in {file_path}")
        return False

if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else "train_lora.py"
    fix_preprocessing_function(file_path)




