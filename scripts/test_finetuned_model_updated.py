#!/usr/bin/env python3
"""
Test the finetuned Qwen3 Coder model
Compares base model vs finetuned model outputs
"""

import json
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_model_inference(model_path: str, test_prompt: str):
    """Test model inference"""
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        from peft import PeftModel
        import torch
        
        print(f"Loading model from {model_path}...")
        
        # Load base model
        base_model_name = "Qwen/Qwen2.5-Coder-7B-Instruct"  # Update if using different base
        tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
        
        # Load model with LoRA
        model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True
        )
        
        # Load LoRA weights
        if os.path.exists(model_path):
            model = PeftModel.from_pretrained(model, model_path)
            print("  ✓ Loaded LoRA weights")
        else:
            print(f"  ⚠️  Model path not found: {model_path}")
            print("  Using base model only")
        
        # Tokenize prompt
        inputs = tokenizer(test_prompt, return_tensors="pt").to(model.device)
        
        # Generate
        print("\nGenerating response...")
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract assistant response
        if "<|im_start|>assistant" in response:
            response = response.split("<|im_start|>assistant")[-1].strip()
        
        return response
        
    except Exception as e:
        print(f"Error testing model: {e}")
        return None

def main():
    model_path = os.getenv("FINETUNED_MODEL_PATH", "./models/qwen3_coder_30b_qa_lora")
    
    test_prompt = """<|im_start|>system
You are a senior QA automation architect. You write structured test cases and runnable code for UI, API, performance, accessibility, and security.<|im_end|>
<|im_start|>user
Requirement:
As a user, I can login to the e-commerce site with email and password.

App type: ecommerce
Test domains: ui, api

Return STRICT JSON with this schema:
{
  "test_cases": [...],
  "code": {
    "ui_playwright_ts": "...",
    "api_pytest": "..."
  }
}<|im_end|>
<|im_start|>assistant
"""
    
    print("=" * 60)
    print("Testing Finetuned Model")
    print("=" * 60)
    print(f"Model path: {model_path}")
    print()
    
    response = test_model_inference(model_path, test_prompt)
    
    if response:
        print("\n" + "=" * 60)
        print("Model Response:")
        print("=" * 60)
        print(response)
        print()
        
        # Try to parse JSON
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                parsed = json.loads(json_str)
                print("✅ Valid JSON response!")
                print(f"   Test cases: {len(parsed.get('test_cases', []))}")
                print(f"   Code keys: {list(parsed.get('code', {}).keys())}")
        except:
            print("⚠️  Could not parse JSON from response")
    else:
        print("❌ Failed to get response from model")

if __name__ == "__main__":
    main()




