#!/bin/bash
# Final fix for preprocessing Encoding issue

cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup2

# Create Python script to fix the preprocessing function
python3 << 'PYEOF'
import re

with open('train_lora.py', 'r') as f:
    content = f.read()

# Find the preprocess_function and replace it completely
# Look for the function definition
pattern = r'    def preprocess_function\(examples\):.*?        return tokenized'

# New function that always returns dict
new_function = '''    def preprocess_function(examples):
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
        
        # CRITICAL: Ensure it's a dict, not Encoding
        if not isinstance(tokenized, dict):
            # Convert Encoding to dict
            tokenized = {
                "input_ids": list(tokenized.ids) if hasattr(tokenized, 'ids') else list(tokenized["input_ids"]),
                "attention_mask": list(tokenized.attention_mask) if hasattr(tokenized, 'attention_mask') else list(tokenized["attention_mask"])
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

# Replace the function
content = re.sub(pattern, new_function, content, flags=re.DOTALL)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("✅ Preprocessing function fixed!")
PYEOF

echo ""
echo "✅ Fix applied! The preprocessing function now always returns a dict."
echo ""
echo "Restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"




