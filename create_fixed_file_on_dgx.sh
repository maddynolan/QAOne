#!/bin/bash
# Create fixed train_lora.py directly on DGX
# Copy and paste this ENTIRE script on DGX

cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup_$(date +%Y%m%d_%H%M%S)

# Create fixed file - this replaces the preprocess_dataset function
python3 << 'FIXEOF'
with open('train_lora.py', 'r') as f:
    content = f.read()

# Find and replace the preprocess_dataset function
old_func = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
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

new_func = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training - FIXED to always return dict"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize (return as lists, not tensors, for dataset.map)
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None  # FIXED: Return lists, not tensors
    )
    
    # CRITICAL FIX: Ensure dict format (not Encoding object)
    if not isinstance(tokenized, dict):
        if hasattr(tokenized, 'ids'):
            # It's an Encoding object - convert to dict
            tokenized = {
                "input_ids": [list(tokenized.ids)],
                "attention_mask": [list(tokenized.attention_mask)]
            }
        else:
            # Try to convert to dict
            tokenized = dict(tokenized)
    
    # Ensure all values are lists
    if not isinstance(tokenized.get("input_ids"), list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
    if not isinstance(tokenized.get("attention_mask"), list):
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    # Labels are the same as input_ids (for causal LM)
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all elements to lists (not tensors or Encoding)
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized'''

# Replace
content = content.replace(old_func, new_func)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("✅ Fixed preprocess_dataset function!")
print("   Changed: return_tensors='pt' → return_tensors=None")
print("   Changed: .clone() → .copy()")
print("   Added: dict type checking")
FIXEOF

echo ""
echo "✅ File fixed! Verifying..."
grep -A 3 "CRITICAL FIX" train_lora.py

echo ""
echo "Now restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"




