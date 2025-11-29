#!/usr/bin/env python3
"""
Validate config and code BEFORE training - NO MODEL LOADING!
Run: python3 validate_before_training.py
This checks everything in seconds, not 15 minutes!
"""

import yaml
import ast
import sys
from pathlib import Path

print("="*60)
print("VALIDATING BEFORE TRAINING (No Model Loading!)")
print("="*60)

errors = []
warnings = []

# 1. Check config file
print("\n[1/4] Checking config file...")
config_path = "configs/lora_qwen3_30b_coder.yaml"
if not Path(config_path).exists():
    errors.append(f"Config file not found: {config_path}")
else:
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    # Check learning_rate is a number, not string
    lr = config.get("learning_rate", 2e-5)
    if isinstance(lr, str):
        errors.append(f"learning_rate is a string '{lr}' - must be a number! Fix: learning_rate: {float(lr) if lr.replace('.','').replace('-','').isdigit() else '2e-5'}")
    elif not isinstance(lr, (int, float)):
        errors.append(f"learning_rate is {type(lr)} - must be a number!")
    
    # Check other numeric fields
    for field in ["per_device_train_batch_size", "gradient_accumulation_steps", "num_train_epochs", "warmup_steps", "logging_steps", "save_steps", "eval_steps"]:
        val = config.get(field)
        if val is not None and isinstance(val, str):
            warnings.append(f"{field} is a string '{val}' - should be a number")
    
    print(f"  ✅ Config loaded: {config.get('base_model')}")

# 2. Check train_lora.py syntax
print("\n[2/4] Checking train_lora.py syntax...")
script_path = "scripts/train_lora.py"
if not Path(script_path).exists():
    errors.append(f"Script not found: {script_path}")
else:
    with open(script_path, 'r') as f:
        code = f.read()
    
    # Check for common issues
    if 'evaluation_strategy' in code:
        errors.append("Found 'evaluation_strategy' - should be 'eval_strategy'")
    
    if 'return_tensors="pt"' in code:
        errors.append("Found 'return_tensors=\"pt\"' - should be 'return_tensors=None' for dataset.map()")
    
    if '.clone()' in code and 'preprocess_dataset' in code:
        errors.append("Found '.clone()' in preprocess_dataset - should be '.copy()' for lists")
    
    # Check learning_rate usage
    if 'learning_rate=config.get("learning_rate"' in code:
        # Check if it's converted to float
        if 'float(' not in code and 'int(' not in code:
            warnings.append("learning_rate from config might be string - ensure it's converted to float")
    
    # Try to parse Python syntax
    try:
        ast.parse(code)
        print("  ✅ Python syntax is valid")
    except SyntaxError as e:
        errors.append(f"Python syntax error: {e}")

# 3. Check TrainingArguments usage
print("\n[3/4] Checking TrainingArguments...")
if Path(script_path).exists():
    with open(script_path, 'r') as f:
        lines = f.readlines()
    
    in_training_args = False
    for i, line in enumerate(lines, 1):
        if 'TrainingArguments(' in line:
            in_training_args = True
        if in_training_args:
            if 'evaluation_strategy' in line:
                errors.append(f"Line {i}: Found 'evaluation_strategy' - should be 'eval_strategy'")
            if 'learning_rate=' in line and 'config.get' in line:
                # Check if it's converted
                if 'float(' not in line and 'int(' not in line:
                    warnings.append(f"Line {i}: learning_rate might be string - add float() conversion")
        if in_training_args and line.strip().endswith(')'):
            break

# 4. Check data files
print("\n[4/4] Checking data files...")
if 'config' in locals():
    train_file = config.get("train_file", "data/train.jsonl")
    val_file = config.get("val_file", "data/val.jsonl")
    
    if not Path(train_file).exists():
        errors.append(f"Train file not found: {train_file}")
    else:
        print(f"  ✅ Train file exists: {train_file}")
    
    if not Path(val_file).exists():
        errors.append(f"Val file not found: {val_file}")
    else:
        print(f"  ✅ Val file exists: {val_file}")

# Report
print("\n" + "="*60)
if errors:
    print("❌ ERRORS FOUND (Must fix before training):")
    for i, err in enumerate(errors, 1):
        print(f"  {i}. {err}")
    print("\n" + "="*60)
    sys.exit(1)
elif warnings:
    print("⚠️  WARNINGS (Should fix):")
    for i, warn in enumerate(warnings, 1):
        print(f"  {i}. {warn}")
    print("\n✅ No critical errors - training might work, but fix warnings!")
else:
    print("✅ ALL CHECKS PASSED! Ready for training!")
print("="*60)




