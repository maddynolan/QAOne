#!/usr/bin/env python3
"""
Fix learning_rate in config - ensure it's a number, not string
Run: python3 fix_learning_rate.py
"""

import yaml
from pathlib import Path

config_path = "configs/lora_qwen3_30b_coder.yaml"

if not Path(config_path).exists():
    print(f"❌ Config not found: {config_path}")
    exit(1)

with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

# Fix learning_rate if it's a string
lr = config.get("learning_rate", 2e-5)
if isinstance(lr, str):
    try:
        # Try to convert string to float
        if 'e' in lr.lower():
            config["learning_rate"] = float(lr)
        else:
            config["learning_rate"] = float(lr)
        print(f"✅ Fixed learning_rate: '{lr}' → {config['learning_rate']}")
    except:
        config["learning_rate"] = 2e-5
        print(f"✅ Set learning_rate to default: 2e-5")
else:
    print(f"✅ learning_rate is already a number: {lr}")

# Also ensure other numeric fields are numbers
numeric_fields = ["per_device_train_batch_size", "gradient_accumulation_steps", 
                  "num_train_epochs", "warmup_steps", "logging_steps", 
                  "save_steps", "eval_steps", "lora_r", "lora_alpha", "lora_dropout"]

for field in numeric_fields:
    val = config.get(field)
    if val is not None and isinstance(val, str):
        try:
            if '.' in val:
                config[field] = float(val)
            else:
                config[field] = int(val)
            print(f"✅ Fixed {field}: '{val}' → {config[field]}")
        except:
            pass

# Save fixed config
with open(config_path, 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print(f"\n✅ Config fixed and saved: {config_path}")




