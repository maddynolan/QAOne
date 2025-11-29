# 🔧 Final Fix: Preprocessing Encoding Error

## ❌ Error

```
TypeError: Provided `function` which is applied to all elements of table returns a variable of type <class 'tokenizers.Encoding'>
```

## 🎯 Problem

The preprocessing function is returning `Encoding` objects instead of dictionaries. This happens when the tokenizer is called incorrectly.

## ✅ Solution

**On DGX, run this fix:**

```bash
cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup2

# Apply fix
python3 << 'PYEOF'
import re

with open('train_lora.py', 'r') as f:
    content = f.read()

# Replace preprocess_function
pattern = r'    def preprocess_function\(examples\):.*?        return tokenized'

new_function = '''    def preprocess_function(examples):
        """Preprocess function - FIXED to always return dict"""
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
            prompts,
            truncation=True,
            max_length=2048,
            padding="max_length",
            return_tensors=None
        )
        
        # CRITICAL: Ensure it's a dict, not Encoding
        if not isinstance(tokenized, dict):
            tokenized = {
                "input_ids": list(tokenized.ids) if hasattr(tokenized, 'ids') else list(tokenized["input_ids"]),
                "attention_mask": list(tokenized.attention_mask) if hasattr(tokenized, 'attention_mask') else list(tokenized["attention_mask"])
            }
        
        # Ensure all values are lists
        if not isinstance(tokenized["input_ids"], list):
            tokenized["input_ids"] = [tokenized["input_ids"]]
            tokenized["attention_mask"] = [tokenized["attention_mask"]]
        
        tokenized["labels"] = tokenized["input_ids"].copy()
        
        # Final check: ensure each element is a list
        tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
        tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
        tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
        
        return tokenized'''

content = re.sub(pattern, new_function, content, flags=re.DOTALL)

with open('train_lora.py', 'w') as f:
    f.write(content)

print("✅ Fixed!")
PYEOF
```

## 🔍 What the Fix Does

1. **Always passes a list** to tokenizer (not single items)
2. **Checks if result is dict** - if not, converts Encoding to dict
3. **Ensures all values are lists** (not single items)
4. **Converts all elements to lists** (not tensors or Encoding objects)

## 🚀 After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

## 📋 Key Changes

**Before (broken):**
- Tokenizer sometimes returns Encoding objects
- No check for dict format
- Fails when Encoding is returned

**After (fixed):**
- Always ensures dict format
- Converts Encoding to dict if needed
- All values are lists (required by datasets library)

## ✅ Expected Result

After fix, you should see:
```
🔄 Preprocessing dataset...
Map: 100%|██████████| 396/396 [00:XX<00:00, XXX examples/s]
```

Training will continue! 🎉




