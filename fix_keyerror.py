#!/usr/bin/env python3
"""
Fix KeyError: 0 - The lambda is trying to index a dict with [0]
Run on DGX: python3 fix_keyerror.py
"""

file_path = "train_lora.py"

with open(file_path, 'r') as f:
    content = f.read()

# Find and fix the lambda that's causing KeyError
old_lambda = 'lambda x: preprocess_dataset([x], tokenizer)[0]'

# New lambda extracts first element from each list in the dict
new_lambda = 'lambda x: {k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in preprocess_dataset([x], tokenizer).items()}'

if old_lambda in content:
    content = content.replace(old_lambda, new_lambda)
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Fixed {file_path}!")
    print("Changed: lambda x: preprocess_dataset([x], tokenizer)[0]")
    print("To: lambda x: {k: v[0] ... for k, v in preprocess_dataset([x], tokenizer).items()}")
else:
    print(f"❌ Could not find lambda in {file_path}")
    print("Searching for similar patterns...")
    # Try to find the line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'preprocess_dataset([x]' in line and '[0]' in line:
            print(f"Found at line {i+1}: {line.strip()}")
            # Fix it
            lines[i] = lines[i].replace('[0]', '')
            # Add proper extraction
            if 'lambda x:' in lines[i]:
                lines[i] = lines[i].replace(
                    'preprocess_dataset([x], tokenizer)[0]',
                    '{k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in preprocess_dataset([x], tokenizer).items()}'
                )
            with open(file_path, 'w') as f:
                f.write('\n'.join(lines))
            print(f"✅ Fixed {file_path}!")
            break
    else:
        print("❌ Could not find the problematic line")




