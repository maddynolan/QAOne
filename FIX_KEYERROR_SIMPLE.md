# ✅ Fix KeyError: 0 - Simple Solution

## 🎯 The Problem

The code does:
```python
lambda x: preprocess_dataset([x], tokenizer)[0]
```

But `preprocess_dataset` returns a **dict**, not a list! You can't use `[0]` on a dict.

## ✅ Simple Fix

**On DGX, run:**

```bash
cd ~/qa_finetuning/scripts
python3 fix_keyerror.py
```

**OR manually fix it:**

```bash
cd ~/qa_finetuning/scripts
sed -i 's/preprocess_dataset(\[x\], tokenizer)\[0\]/{k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in preprocess_dataset([x], tokenizer).items()}/g' train_lora.py
```

## 📋 What This Does

- **Before**: Tries to access `[0]` on a dict → `KeyError: 0`
- **After**: Extracts the first element from each list in the dict → Works!

## 🚀 Then Restart Training

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

This should finally work! 🎉




