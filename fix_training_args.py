#!/usr/bin/env python3
"""
Fix TrainingArguments - change evaluation_strategy to eval_strategy
Run on DGX: python3 fix_training_args.py
"""

file_path = "train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# Fix evaluation_strategy -> eval_strategy (newer transformers API)
if 'evaluation_strategy' in content:
    content = content.replace('evaluation_strategy', 'eval_strategy')
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Fixed {file_path}!")
    print("Changed: evaluation_strategy → eval_strategy")
else:
    print(f"✅ No evaluation_strategy found in {file_path}")




