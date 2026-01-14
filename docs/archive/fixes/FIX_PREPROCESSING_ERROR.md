# 🔧 Fix: Preprocessing TypeError (Encoding object)

## Error

```
TypeError: Provided `function` which is applied to all elements of table returns a variable of type <class 'tokenizers.Encoding'>. Make sure provided `function` returns a variable of type `dict`
```

## Problem

The tokenizer is returning `Encoding` objects instead of dictionaries when processing the dataset. This happens when the tokenizer is called incorrectly or when processing single items instead of batches.

## Solution: Fix the preprocessing function

**On DGX, edit the training script:**

```bash
cd ~/qa_finetuning
nano scripts/train_lora.py
```

**Find the `preprocess_function` (around line 137) and replace it with:**

```python
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
    if not isinstance(tokenized, dict):
        # Convert Encoding to dict (shouldn't happen, but safety check)
        tokenized = {
            "input_ids": list(tokenized["input_ids"]) if hasattr(tokenized, "input_ids") else tokenized.ids,
            "attention_mask": list(tokenized["attention_mask"]) if hasattr(tokenized, "attention_mask") else tokenized.attention_mask
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
```

## Quick Fix Command

**On DGX, run this to apply the fix:**

```bash
cd ~/qa_finetuning/scripts

# Backup original
cp train_lora.py train_lora.py.backup

# Apply fix using sed (or edit manually)
cat > /tmp/fix_preprocess.py << 'PYEOF'
import re

with open('train_lora.py', 'r') as f:
    content = f.read()

# Find and replace preprocess_function
old_pattern = r'def preprocess_function\(examples\):.*?return tokenized'
new_function = '''def preprocess_function(examples):
    """Preprocess function for dataset.map - FIXED VERSION"""
    # Format prompts
    prompts = []
    for i in range(len(examples.get("instruction", []))):
        example = {
            "instruction": examples["instruction"][i] if "instruction" in examples else "",
            "input": examples["input"][i] if "input" in examples else "",
            "output": examples["output"][i] if "output" in examples else ""
        }
        prompts.append(format_prompt(example))
    
    # Tokenize
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=2048,
        padding="max_length",
        return_tensors=None
    )
    
    # Ensure dict format
    if not isinstance(tokenized, dict):
        tokenized = {
            "input_ids": list(tokenized["input_ids"]) if hasattr(tokenized, "input_ids") else list(tokenized.ids),
            "attention_mask": list(tokenized["attention_mask"]) if hasattr(tokenized, "attention_mask") else list(tokenized.attention_mask)
        }
    
    # Ensure lists
    if not isinstance(tokenized["input_ids"], list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all to lists
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized'''

# Simple replacement - find the function and replace
import re
pattern = r'def preprocess_function\(examples\):.*?return tokenized'
content = re.sub(pattern, new_function, content, flags=re.DOTALL)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("Fix applied!")
PYEOF

python3 /tmp/fix_preprocess.py
```

## Manual Edit (Easier)

**Or just edit manually:**

1. Open: `~/qa_finetuning/scripts/train_lora.py`
2. Find line ~137: `def preprocess_function(examples):`
3. Replace the entire function with the fixed version above
4. Save and re-run training

## After Fix

Restart training:

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

## Why This Happens

- Tokenizer can return `Encoding` objects when called incorrectly
- With `batched=True`, it should return dicts, but sometimes doesn't
- The fix ensures we always convert to dict format before returning




