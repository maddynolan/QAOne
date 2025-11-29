#!/usr/bin/env python3
"""Fix the syntax error on line 214"""

with open('train_lora.py', 'r') as f:
    lines = f.readlines()

# Line 214 (index 213) has: learning_rate=float(config.get("learning_rate", 2e-5),
# Should be: learning_rate=float(config.get("learning_rate", 2e-5)),
if 'learning_rate=float(config.get("learning_rate", 2e-5),' in lines[213]:
    lines[213] = lines[213].replace('learning_rate=float(config.get("learning_rate", 2e-5),', 
                                    'learning_rate=float(config.get("learning_rate", 2e-5)),')
    print('✅ Fixed line 214')
else:
    print(f'Line 214 content: {repr(lines[213])}')

with open('train_lora.py', 'w') as f:
    f.writelines(lines)




