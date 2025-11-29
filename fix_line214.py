#!/usr/bin/env python3
with open('train_lora.py', 'r') as f:
    lines = f.readlines()
lines[213] = lines[213].replace('2e-5),', '2e-5)),')
with open('train_lora.py', 'w') as f:
    f.writelines(lines)
print('Fixed')




