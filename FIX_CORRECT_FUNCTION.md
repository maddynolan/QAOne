# ✅ Fix: Correct Function (preprocess_dataset)

## 🎯 The Real Problem

The file uses `preprocess_dataset` function, NOT `preprocess_function`!

**The code calls:**
```python
train_dataset = train_dataset.map(
    lambda x: preprocess_dataset([x], tokenizer)[0],
    ...
)
```

**So we need to fix `preprocess_dataset`, not `preprocess_function`!**

## ✅ Correct Fix

**On DGX, run this:**

```bash
cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup_correct

# Fix preprocess_dataset function
python3 << 'FIXEOF'
import re

with open('train_lora.py', 'r') as f:
    content = f.read()

# Find preprocess_dataset function (around line 55)
old_func = r'def preprocess_dataset\(examples: Dict, tokenizer, max_length: int = 2048\):.*?return tokenized'

new_func = '''def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training - FIXED to always return dict"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None
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
    
    # Labels
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all to lists
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized'''

content = re.sub(old_func, new_func, content, flags=re.DOTALL)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("✅ Fixed preprocess_dataset function!")
FIXEOF

echo ""
echo "Verifying..."
grep -A 5 "def preprocess_dataset" train_lora.py | head -8

echo ""
echo "✅ Fix complete! Restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"
```

## 🔍 Manual Edit (If Script Fails)

**Edit the file manually:**

```bash
cd ~/qa_finetuning/scripts
nano train_lora.py
```

**Find line ~55 (the `def preprocess_dataset` function) and replace it with the new_func from above.**

## ✅ Why This Works

- Fixes the **actual function being called** (`preprocess_dataset`)
- Adds dict type checking
- Ensures all values are lists
- Handles Encoding objects properly

## 🚀 After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

**This should finally work!** 🎉




