#!/usr/bin/env python3
"""Fix device_map to avoid meta device issue"""
import re

with open('scripts/train_lora.py', 'r') as f:
    content = f.read()

# Change device_map from "auto" to "cuda:0"
content = re.sub(r'device_map="auto"', 'device_map="cuda:0"', content)

with open('scripts/train_lora.py', 'w') as f:
    f.write(content)

print('✅ Changed device_map from "auto" to "cuda:0"')
print('This will prevent parameters from being offloaded to meta device')




