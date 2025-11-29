#!/usr/bin/env python3
"""
Comprehensive validation BEFORE training - NO MODEL LOADING!
Checks everything in seconds, catches all issues before 8-minute model load.
"""

import yaml
import ast
import sys
import re
from pathlib import Path

print("="*70)
print("COMPREHENSIVE PRE-TRAINING VALIDATION (No Model Loading!)")
print("="*70)

errors = []
warnings = []

# 1. Check config file
print("\n[1/6] Checking config file...")
config_path = "configs/lora_qwen3_30b_coder.yaml"
if not Path(config_path).exists():
    errors.append(f"Config file not found: {config_path}")
else:
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    # Check learning_rate is a number
    lr = config.get("learning_rate", 2e-5)
    if isinstance(lr, str):
        errors.append(f"learning_rate is string '{lr}' - must be number! Fix: learning_rate: {eval(lr) if 'e' in lr.lower() else float(lr)}")
    
    # Check other numeric fields
    numeric_fields = ["per_device_train_batch_size", "gradient_accumulation_steps", 
                     "num_train_epochs", "warmup_steps", "logging_steps", 
                     "save_steps", "eval_steps", "lora_r", "lora_alpha", "lora_dropout"]
    for field in numeric_fields:
        val = config.get(field)
        if val is not None and isinstance(val, str):
            warnings.append(f"{field} is string '{val}' - should be number")
    
    print(f"  ✅ Config loaded: {config.get('base_model')}")

# 2. Check train_lora.py syntax and common issues
print("\n[2/6] Checking train_lora.py...")
script_path = "scripts/train_lora.py"
if not Path(script_path).exists():
    errors.append(f"Script not found: {script_path}")
else:
    with open(script_path, 'r') as f:
        code = f.read()
    
    # Check for common issues
    issues = [
        ('evaluation_strategy', 'eval_strategy', 'Found old API name'),
        ('return_tensors="pt"', 'return_tensors=None', 'Returns tensors instead of lists'),
        ('.clone()', '.copy()', 'Using tensor method on lists'),
    ]
    
    for old, new, desc in issues:
        if old in code:
            errors.append(f"{desc}: '{old}' should be '{new}'")
    
    # Check if model.train() is called
    if 'model = get_peft_model(model, lora_config)' in code:
        if 'model.train()' not in code:
            errors.append("Missing model.train() after LoRA application - gradients won't work!")
        else:
            print("  ✅ model.train() found")
    
    # Check if LoRA parameters are enabled
    if 'requires_grad' not in code and 'model.train()' in code:
        warnings.append("Consider explicitly setting requires_grad=True for LoRA parameters")
    
    # Try to parse Python syntax
    try:
        ast.parse(code)
        print("  ✅ Python syntax is valid")
    except SyntaxError as e:
        errors.append(f"Python syntax error: {e}")

# 3. Check TrainingArguments
print("\n[3/6] Checking TrainingArguments...")
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
                if 'float(' not in line and 'int(' not in line:
                    warnings.append(f"Line {i}: learning_rate might be string - add float() conversion")
        if in_training_args and line.strip().endswith(')'):
            break

# 4. Check data files
print("\n[4/6] Checking data files...")
if 'config' in locals():
    train_file = config.get("train_file", "data/train.jsonl")
    val_file = config.get("val_file", "data/val.jsonl")
    
    if not Path(train_file).exists():
        errors.append(f"Train file not found: {train_file}")
    else:
        # Quick check - count lines
        with open(train_file, 'r') as f:
            train_count = sum(1 for _ in f)
        print(f"  ✅ Train file exists: {train_file} ({train_count} examples)")
    
    if not Path(val_file).exists():
        errors.append(f"Val file not found: {val_file}")
    else:
        with open(val_file, 'r') as f:
            val_count = sum(1 for _ in f)
        print(f"  ✅ Val file exists: {val_file} ({val_count} examples)")

# 5. Check preprocessing function
print("\n[5/6] Checking preprocessing function...")
if Path(script_path).exists():
    with open(script_path, 'r') as f:
        code = f.read()
    
    # Check preprocess_dataset returns dict
    if 'def preprocess_dataset' in code:
        if 'return_tensors=None' not in code:
            errors.append("preprocess_dataset must use return_tensors=None (not 'pt')")
        if 'isinstance(tokenized, dict)' in code or 'CRITICAL FIX' in code:
            print("  ✅ Preprocessing has dict type checking")
        else:
            warnings.append("Preprocessing might return Encoding object - add dict check")
        
        # Check lambda extraction
        if 'preprocess_dataset([x], tokenizer)[0]' in code:
            errors.append("Lambda uses [0] on dict - should extract from dict values!")
        elif '{k: v[0]' in code and 'preprocess_dataset([x]' in code:
            print("  ✅ Lambda correctly extracts from dict")

# 6. Check LoRA setup
print("\n[6/6] Checking LoRA configuration...")
if 'config' in locals():
    if 'lora_r' not in config:
        warnings.append("lora_r not in config - using default")
    if 'target_modules' not in config:
        warnings.append("target_modules not in config - using default")

# Report
print("\n" + "="*70)
if errors:
    print("❌ CRITICAL ERRORS (Must fix before training):")
    for i, err in enumerate(errors, 1):
        print(f"  {i}. {err}")
    print("\n" + "="*70)
    print("\n🔧 QUICK FIXES:")
    print("="*70)
    
    # Provide fix commands
    if any('learning_rate' in e for e in errors):
        print("\n1. Fix learning_rate:")
        print("   python3 << 'EOF'")
        print("   import yaml")
        print("   with open('configs/lora_qwen3_30b_coder.yaml', 'r') as f: c = yaml.safe_load(f)")
        print("   lr = c.get('learning_rate', 2e-5)")
        print("   if isinstance(lr, str): c['learning_rate'] = eval(lr) if 'e' in lr.lower() else float(lr)")
        print("   with open('configs/lora_qwen3_30b_coder.yaml', 'w') as f: yaml.dump(c, f, default_flow_style=False)")
        print("   print('✅ Fixed!')")
        print("   EOF")
    
    if any('evaluation_strategy' in e for e in errors):
        print("\n2. Fix evaluation_strategy:")
        print("   cd scripts && sed -i 's/evaluation_strategy/eval_strategy/g' train_lora.py")
    
    if any('model.train()' in e for e in errors):
        print("\n3. Fix model.train():")
        print("   cd scripts && python3 << 'EOF'")
        print("   with open('train_lora.py', 'r') as f: lines = f.readlines()")
        print("   new = []")
        print("   for line in lines:")
        print("       new.append(line)")
        print("       if 'model.print_trainable_parameters()' in line:")
        print("           new.append('    model.train()\\n')")
        print("   with open('train_lora.py', 'w') as f: f.writelines(new)")
        print("   print('✅ Fixed!')")
        print("   EOF")
    
    if any('preprocess_dataset([x], tokenizer)[0]' in e for e in errors):
        print("\n4. Fix preprocessing lambda:")
        print("   cd scripts && sed -i \"s/preprocess_dataset(\\[x\\], tokenizer)\\[0\\]/{k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in preprocess_dataset([x], tokenizer).items()}/g\" train_lora.py")
    
    sys.exit(1)
elif warnings:
    print("⚠️  WARNINGS (Should fix):")
    for i, warn in enumerate(warnings, 1):
        print(f"  {i}. {warn}")
    print("\n✅ No critical errors - training might work, but fix warnings!")
else:
    print("✅ ALL CHECKS PASSED! Ready for training!")
print("="*70)




