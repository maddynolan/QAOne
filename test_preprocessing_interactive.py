#!/usr/bin/env python3
"""
Interactive preprocessing tester - keeps model in memory
Run: python3 -i test_preprocessing_interactive.py
Then use: test_preprocessing() to test after making changes
"""

import torch
import yaml
import json
from pathlib import Path
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset
import importlib.util

# Global variables to keep model loaded
_tokenizer = None
_model = None
_config = None
_sample = None

def load_model_once():
    """Load model and tokenizer - only once"""
    global _tokenizer, _model, _config, _sample
    
    if _tokenizer is not None:
        print("✅ Model already loaded!")
        return
    
    config_path = "configs/lora_qwen3_30b_coder.yaml"
    with open(config_path, 'r') as f:
        _config = yaml.safe_load(f)
    
    base_model = _config["base_model"]
    print(f"Loading model: {base_model} (this takes ~8 minutes, only once!)")
    
    _tokenizer = AutoTokenizer.from_pretrained(base_model)
    _model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    print("✅ Model loaded!")
    
    # Load sample
    train_file = _config["train_file"]
    dataset = load_dataset("json", data_files=train_file, split="train")
    _sample = dataset[0]
    print(f"✅ Sample loaded!")

def test_preprocessing():
    """Test preprocessing function - can be called multiple times"""
    global _tokenizer, _sample
    
    if _tokenizer is None:
        print("Loading model first...")
        load_model_once()
        return
    
    # Import preprocessing function
    spec = importlib.util.spec_from_file_location("train_lora", "scripts/train_lora.py")
    train_lora = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(train_lora)
    preprocess_dataset = train_lora.preprocess_dataset
    
    print("\n" + "="*60)
    print("TESTING PREPROCESSING")
    print("="*60)
    
    try:
        # Test with single example
        result = preprocess_dataset([_sample], _tokenizer)
        
        print(f"\n✅ Preprocessing succeeded!")
        print(f"Result type: {type(result)}")
        
        if isinstance(result, dict):
            print(f"Result keys: {result.keys()}")
            for key, value in result.items():
                print(f"  {key}: type={type(value)}, len={len(value) if isinstance(value, list) else 'N/A'}")
            
            # Test lambda extraction
            print("\n" + "-"*60)
            print("TESTING LAMBDA EXTRACTION")
            print("-"*60)
            
            extracted = {k: v[0] if isinstance(v, list) and len(v) > 0 else v for k, v in result.items()}
            print(f"✅ Lambda extraction succeeded!")
            for key, value in extracted.items():
                print(f"  {key}: type={type(value)}, len={len(value) if isinstance(value, list) else 'N/A'}")
            
            print("\n" + "="*60)
            print("✅ ALL TESTS PASSED!")
            print("="*60)
            return True
        else:
            print(f"❌ ERROR: Result is not a dict! It's a {type(result)}")
            return False
            
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

# Auto-load on import
if __name__ == "__main__":
    print("="*60)
    print("INTERACTIVE PREPROCESSING TESTER")
    print("="*60)
    print("\nModel will load now (takes ~8 minutes, only once)")
    print("After loading, you can call test_preprocessing() anytime!")
    print("\nUsage:")
    print("  1. Edit scripts/train_lora.py")
    print("  2. Call: test_preprocessing()")
    print("  3. Repeat until it passes!")
    print("\n" + "="*60 + "\n")
    
    load_model_once()
    print("\n✅ Ready! Call test_preprocessing() to test your changes.")
    print("   (Model stays loaded - no waiting!)")




