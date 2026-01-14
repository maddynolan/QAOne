# ✅ Fix Syntax Error

## 🎯 The Problem

The learning_rate fix broke the syntax - missing closing parenthesis.

## 🔧 Quick Fix

**On DGX:**

```bash
cd ~/qa_finetuning/scripts

# Fix the broken line properly
python3 << 'EOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Fix the broken learning_rate line
    if 'learning_rate=float(config.get("learning_rate"' in line:
        # The line should be: learning_rate=float(config.get("learning_rate", 2e-5)),
        # But it's probably: learning_rate=float(config.get("learning_rate", 2e-5),
        # Fix it:
        if line.count('(') > line.count(')'):
            # Add missing closing paren
            line = line.rstrip()  # Remove newline
            if line.endswith(','):
                line = line[:-1] + ')),'  # Add closing paren before comma
            else:
                line = line + ')'  # Add closing paren
            line = line + '\n'  # Add newline back
    new_lines.append(line)

with open('train_lora.py', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed!")
EOF

# Verify
python3 -m py_compile train_lora.py && echo "✅ Syntax OK!" || echo "❌ Still broken"
```

**OR simpler - just fix line 185 directly:**

```bash
cd ~/qa_finetuning/scripts

# Check what line 185 looks like
sed -n '185p' train_lora.py

# Fix it - ensure it has proper closing: learning_rate=float(config.get("learning_rate", 2e-5)),
sed -i '185s/learning_rate=float(config.get("learning_rate", 2e-5),/learning_rate=float(config.get("learning_rate", 2e-5)),/' train_lora.py

# Verify
python3 -m py_compile train_lora.py
```

**Then validate:**

```bash
cd ~/qa_finetuning
python3 validate_all_before_training.py
```

When validation passes, start training!




