#!/usr/bin/env python3
"""
Test preprocessing function without full training
Loads model once, then tests preprocessing logic
Run: python3 test_preprocessing.py
"""

import torch
import yaml
import json
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset

# Load config
config_path = "configs/lora_qwen3_30b_coder.yaml"
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

base_model = config["base_model"]
print(f"Loading model: {base_model}")

# Load tokenizer and model (ONCE)
tokenizer = AutoTokenizer.from_pretrained(base_model)
model = AutoModelForCausalLM.from_pretrained(
    base_model,
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)
print("✅ Model loaded!")

# Load a small sample
train_file = config["train_file"]
print(f"\nLoading sample from: {train_file}")
dataset = load_dataset("json", data_files=train_file, split="train")
sample = dataset[0]  # Get first example
print(f"Sample: {json.dumps(sample, indent=2)[:200]}...")

# Import the preprocessing function from train_lora.py
import sys
import importlib.util
spec = importlib.util.spec_from_file_location("train_lora", "scripts/train_lora.py")
train_lora = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train_lora)
format_prompt = train_lora.format_prompt
preprocess_dataset = train_lora.preprocess_dataset

# Test preprocessing
print("\n" + "="*60)
print("TESTING PREPROCESSING")
print("="*60)

try:
    # Test with single example (like the lambda does)
    result = preprocess_dataset([sample], tokenizer)
    
    print(f"\n✅ Preprocessing succeeded!")
    print(f"Result type: {type(result)}")
    print(f"Result keys: {result.keys() if isinstance(result, dict) else 'NOT A DICT!'}")
    
    if isinstance(result, dict):
        for key, value in result.items():
            print(f"  {key}: type={type(value)}, len={len(value) if isinstance(value, list) else 'N/A'}")
            if isinstance(value, list) and len(value) > 0:
                print(f"    First element type: {type(value[0])}, len={len(value[0]) if isinstance(value[0], list) else 'N/A'}")
        
        # Test the lambda extraction
        print("\n" + "-"*60)
        print("TESTING LAMBDA EXTRACTION")
        print("-"*60)
        
        extracted = {k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in result.items()}
        print(f"✅ Lambda extraction succeeded!")
        print(f"Extracted keys: {extracted.keys()}")
        for key, value in extracted.items():
            print(f"  {key}: type={type(value)}, len={len(value) if isinstance(value, list) else 'N/A'}")
        
        # Test with dataset.map
        print("\n" + "-"*60)
        print("TESTING WITH dataset.map()")
        print("-"*60)
        
        test_dataset = dataset.select(range(3))  # Just 3 examples
        processed = test_dataset.map(
            lambda x: {k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in preprocess_dataset([x], tokenizer).items()},
            remove_columns=test_dataset.column_names
        )
        
        print(f"✅ dataset.map() succeeded!")
        print(f"Processed dataset: {len(processed)} examples")
        print(f"Processed columns: {processed.column_names}")
        print(f"First example keys: {processed[0].keys() if len(processed) > 0 else 'N/A'}")
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED! Preprocessing is working correctly!")
        print("="*60)
        
    else:
        print(f"❌ ERROR: Result is not a dict! It's a {type(result)}")
        if hasattr(result, 'ids'):
            print("  It's an Encoding object - need to convert to dict!")
        
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    print("\n" + "="*60)
    print("❌ PREPROCESSING FAILED - Fix the function and run again")
    print("="*60)

