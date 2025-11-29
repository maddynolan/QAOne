#!/bin/bash
# Run this on DGX to fix all issues

cd ~/qa_finetuning/scripts

echo "Fixing syntax error on line 214..."
python3 << 'PYEOF'
with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Fix line 214 - missing closing parenthesis
if 'learning_rate=float(config.get("learning_rate", 2e-5),' in lines[213]:
    lines[213] = lines[213].replace('2e-5),', '2e-5)),')
    print('✅ Fixed line 214')

with open('train_lora.py', 'w') as f:
    f.writelines(lines)
PYEOF

echo "Verifying syntax..."
python3 -m py_compile train_lora.py && echo "✅ Syntax OK!" || echo "❌ Syntax error"

echo ""
echo "Validating..."
cd ~/qa_finetuning
python3 validate_all_before_training.py | tail -6

echo ""
echo "✅ All fixes applied! Ready to train with: ./train_in_docker.sh"




