#!/usr/bin/env python3
"""
Evaluate Fine-Tuned Model
Compare fine-tuned model vs baseline on validation set
"""

import torch
import json
import argparse
import requests
from pathlib import Path
from typing import List, Dict, Any
from collections import defaultdict

from transformers import AutoModelForCausalLM, AutoTokenizer


def load_jsonl(file_path: str) -> List[Dict]:
    """Load JSONL file"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    return data


def generate_with_model(model, tokenizer, prompt: str, max_length: int = 2048) -> str:
    """Generate text with model"""
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=512,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    generated = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Extract only the assistant response
    if "<|im_start|>assistant" in generated:
        generated = generated.split("<|im_start|>assistant")[-1].strip()
    
    return generated


def check_json_validity(text: str) -> bool:
    """Check if text is valid JSON"""
    try:
        json.loads(text)
        return True
    except:
        return False


def evaluate_json_validity(outputs: List[str]) -> Dict[str, Any]:
    """Evaluate JSON validity rate"""
    valid = sum(1 for o in outputs if check_json_validity(o))
    total = len(outputs)
    
    return {
        "valid": valid,
        "total": total,
        "validity_rate": valid / total if total > 0 else 0
    }


def evaluate_approval_rate(outputs: List[str], quality_threshold: float = 4.0) -> Dict[str, Any]:
    """Simulate approval rate (would need actual ratings)"""
    # For now, use heuristics:
    # - Valid JSON = approved
    # - Reasonable length = approved
    approved = 0
    for output in outputs:
        if check_json_validity(output) and len(output) > 50:
            approved += 1
    
    return {
        "approved": approved,
        "total": len(outputs),
        "approval_rate": approved / len(outputs) if outputs else 0
    }


def compare_outputs(baseline_outputs: List[str], finetuned_outputs: List[str]) -> Dict[str, Any]:
    """Compare baseline vs fine-tuned outputs"""
    baseline_valid = sum(1 for o in baseline_outputs if check_json_validity(o))
    finetuned_valid = sum(1 for o in finetuned_outputs if check_json_validity(o))
    
    baseline_avg_length = sum(len(o) for o in baseline_outputs) / len(baseline_outputs) if baseline_outputs else 0
    finetuned_avg_length = sum(len(o) for o in finetuned_outputs) / len(finetuned_outputs) if finetuned_outputs else 0
    
    return {
        "baseline": {
            "json_validity": baseline_valid / len(baseline_outputs) if baseline_outputs else 0,
            "avg_length": baseline_avg_length
        },
        "finetuned": {
            "json_validity": finetuned_valid / len(finetuned_outputs) if finetuned_outputs else 0,
            "avg_length": finetuned_avg_length
        },
        "improvement": {
            "json_validity": (finetuned_valid / len(finetuned_outputs) - baseline_valid / len(baseline_outputs)) if baseline_outputs and finetuned_outputs else 0,
            "avg_length": finetuned_avg_length - baseline_avg_length
        }
    }


def evaluate_model(model_path: str, val_file: str, baseline_model: str = None):
    """Evaluate fine-tuned model"""
    print("=" * 60)
    print("Model Evaluation")
    print("=" * 60)
    
    # Load validation data
    print(f"\n📊 Loading validation data from {val_file}...")
    val_data = load_jsonl(val_file)
    print(f"  Loaded {len(val_data)} examples")
    
    # Load fine-tuned model
    print(f"\n📥 Loading fine-tuned model from {model_path}...")
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    print(f"  Model loaded on {model.device}")
    
    # Generate with fine-tuned model
    print(f"\n🔄 Generating with fine-tuned model...")
    finetuned_outputs = []
    for i, example in enumerate(val_data[:50]):  # Evaluate on first 50 for speed
        if i % 10 == 0:
            print(f"  Processing {i+1}/{min(50, len(val_data))}...")
        
        prompt = f"""<|im_start|>system
You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only.<|im_start|>
<|im_start|>user
{example.get('instruction', '')}

{example.get('input', '')}<|im_end|>
<|im_start|>assistant
"""
        
        output = generate_with_model(model, tokenizer, prompt)
        finetuned_outputs.append(output)
    
    # Evaluate fine-tuned model
    print(f"\n📈 Evaluating fine-tuned model...")
    finetuned_validity = evaluate_json_validity(finetuned_outputs)
    finetuned_approval = evaluate_approval_rate(finetuned_outputs)
    
    print(f"\n✅ Fine-Tuned Model Results:")
    print(f"  JSON Validity: {finetuned_validity['validity_rate']:.2%} ({finetuned_validity['valid']}/{finetuned_validity['total']})")
    print(f"  Approval Rate: {finetuned_approval['approval_rate']:.2%} ({finetuned_approval['approved']}/{finetuned_approval['total']})")
    
    # Compare with baseline if provided
    if baseline_model:
        print(f"\n📥 Loading baseline model: {baseline_model}...")
        baseline_tokenizer = AutoTokenizer.from_pretrained(baseline_model, trust_remote_code=True)
        baseline_model_obj = AutoModelForCausalLM.from_pretrained(
            baseline_model,
            torch_dtype=torch.float16,
            device_map="auto",
            trust_remote_code=True
        )
        
        print(f"\n🔄 Generating with baseline model...")
        baseline_outputs = []
        for i, example in enumerate(val_data[:50]):
            if i % 10 == 0:
                print(f"  Processing {i+1}/{min(50, len(val_data))}...")
            
            prompt = f"""<|im_start|>system
You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only.<|im_start|>
<|im_start|>user
{example.get('instruction', '')}

{example.get('input', '')}<|im_end|>
<|im_start|>assistant
"""
            
            output = generate_with_model(baseline_model_obj, baseline_tokenizer, prompt)
            baseline_outputs.append(output)
        
        # Compare
        comparison = compare_outputs(baseline_outputs, finetuned_outputs)
        
        print(f"\n📊 Comparison (Fine-Tuned vs Baseline):")
        print(f"  JSON Validity:")
        print(f"    Baseline: {comparison['baseline']['json_validity']:.2%}")
        print(f"    Fine-Tuned: {comparison['finetuned']['json_validity']:.2%}")
        print(f"    Improvement: {comparison['improvement']['json_validity']:+.2%}")
        
        print(f"\n  Average Length:")
        print(f"    Baseline: {comparison['baseline']['avg_length']:.0f} chars")
        print(f"    Fine-Tuned: {comparison['finetuned']['avg_length']:.0f} chars")
        print(f"    Difference: {comparison['improvement']['avg_length']:+.0f} chars")
    
    print("\n" + "=" * 60)
    print("✅ Evaluation Complete!")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned model")
    parser.add_argument("--model", "-m", required=True, help="Path to fine-tuned model")
    parser.add_argument("--val_file", "-v", required=True, help="Path to validation JSONL file")
    parser.add_argument("--baseline", "-b", help="Baseline model to compare (e.g., Qwen/Qwen2.5-7B-Instruct)")
    
    args = parser.parse_args()
    
    if not Path(args.model).exists():
        print(f"ERROR: Model path not found: {args.model}")
        return 1
    
    if not Path(args.val_file).exists():
        print(f"ERROR: Validation file not found: {args.val_file}")
        return 1
    
    try:
        evaluate_model(args.model, args.val_file, args.baseline)
    except Exception as e:
        print(f"\n❌ Evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

