#!/usr/bin/env python3
"""
Deploy Fine-Tuned Model to Ollama
Converts LoRA weights to Ollama format and creates model
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any

def load_training_info(model_dir: str) -> Dict[str, Any]:
    """Load training info from model directory"""
    info_path = Path(model_dir) / "training_info.json"
    if not info_path.exists():
        raise FileNotFoundError(f"Training info not found: {info_path}")
    
    with open(info_path, 'r') as f:
        return json.load(f)

def merge_lora_with_base(lora_path: str, base_model: str, output_path: str):
    """Merge LoRA weights with base model"""
    print(f"🔄 Merging LoRA weights with base model...")
    print(f"  LoRA: {lora_path}")
    print(f"  Base: {base_model}")
    print(f"  Output: {output_path}")
    
    # Use PEFT to merge LoRA weights
    merge_script = f"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

# Load base model
print("Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained(
    "{base_model}",
    torch_dtype=torch.float16,
    device_map="auto"
)

# Load LoRA weights
print("Loading LoRA weights...")
model = PeftModel.from_pretrained(base_model, "{lora_path}")

# Merge
print("Merging LoRA weights...")
model = model.merge_and_unload()

# Save merged model
print("Saving merged model...")
model.save_pretrained("{output_path}")
tokenizer = AutoTokenizer.from_pretrained("{base_model}")
tokenizer.save_pretrained("{output_path}")

print("✅ Merge complete!")
"""
    
    # Write and execute merge script
    merge_file = Path("/tmp/merge_lora.py")
    with open(merge_file, 'w') as f:
        f.write(merge_script)
    
    try:
        result = subprocess.run(
            [sys.executable, str(merge_file)],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        if result.stderr:
            print("Warnings:", result.stderr)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error merging LoRA: {e}")
        print(f"Output: {e.stdout}")
        print(f"Error: {e.stderr}")
        raise

def create_modelfile(model_path: str, output_file: str, base_model_name: str = "qwen2.5:7b-instruct"):
    """Create Ollama Modelfile"""
    modelfile_content = f"""FROM {model_path}

TEMPLATE \"\"\"<|im_start|>system
{{{{ .System }}}}<|im_end|>
<|im_start|>user
{{{{ .Prompt }}}}<|im_end|>
<|im_start|>assistant
{{{{ .Response }}}}<|im_end|>
\"\"\"

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096

SYSTEM \"\"\"You are a senior QA engineer specializing in comprehensive test case generation. 
You understand QA best practices, testing methodologies, and can generate high-quality test cases 
for manual testing, automation, API testing, performance testing, security testing, and accessibility testing.
Always output valid JSON format as requested. Be thorough, accurate, and follow QA industry standards.\"\"\"
"""
    
    with open(output_file, 'w') as f:
        f.write(modelfile_content)
    
    print(f"✅ Created Modelfile: {output_file}")

def create_ollama_model(model_name: str, modelfile_path: str):
    """Create Ollama model from Modelfile"""
    print(f"📦 Creating Ollama model: {model_name}")
    
    try:
        result = subprocess.run(
            ["ollama", "create", model_name, "-f", modelfile_path],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        print(f"✅ Model created: {model_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error creating Ollama model: {e}")
        print(f"Output: {e.stdout}")
        print(f"Error: {e.stderr}")
        print("\n💡 Make sure Ollama is installed and running")
        return False
    except FileNotFoundError:
        print("❌ Ollama not found. Make sure Ollama is installed and in PATH")
        return False

def verify_model(model_name: str):
    """Verify model is available in Ollama"""
    print(f"🔍 Verifying model: {model_name}")
    
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            check=True
        )
        
        if model_name in result.stdout:
            print(f"✅ Model {model_name} is available in Ollama")
            return True
        else:
            print(f"⚠️  Model {model_name} not found in Ollama list")
            print("Available models:")
            print(result.stdout)
            return False
    except Exception as e:
        print(f"❌ Error verifying model: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Deploy fine-tuned model to Ollama")
    parser.add_argument(
        "--model-dir",
        type=str,
        required=True,
        help="Path to trained model directory (e.g., outputs/qa-expert-7b-v1)"
    )
    parser.add_argument(
        "--model-name",
        type=str,
        default="qa-expert:7b",
        help="Ollama model name (default: qa-expert:7b)"
    )
    parser.add_argument(
        "--skip-merge",
        action="store_true",
        help="Skip LoRA merge (use if model is already merged)"
    )
    parser.add_argument(
        "--merged-dir",
        type=str,
        help="Path to merged model directory (if skip-merge is used)"
    )
    
    args = parser.parse_args()
    
    model_dir = Path(args.model_dir)
    if not model_dir.exists():
        print(f"❌ Model directory not found: {model_dir}")
        sys.exit(1)
    
    print("=" * 60)
    print("🚀 Deploy Fine-Tuned Model to Ollama")
    print("=" * 60)
    print()
    
    # Load training info
    try:
        training_info = load_training_info(str(model_dir))
        base_model = training_info.get("base_model", "Qwen/Qwen2.5-7B-Instruct")
        print(f"📋 Model Info:")
        print(f"  Base Model: {base_model}")
        print(f"  Training Loss: {training_info.get('train_loss', 'N/A')}")
        print()
    except Exception as e:
        print(f"⚠️  Could not load training info: {e}")
        base_model = "Qwen/Qwen2.5-7B-Instruct"
    
    # Step 1: Merge LoRA if needed
    if args.skip_merge:
        if not args.merged_dir:
            print("❌ --merged-dir required when using --skip-merge")
            sys.exit(1)
        merged_model_path = Path(args.merged_dir)
    else:
        merged_model_path = model_dir.parent / f"{model_dir.name}_merged"
        print(f"Step 1: Merging LoRA weights...")
        try:
            merge_lora_with_base(str(model_dir), base_model, str(merged_model_path))
            print()
        except Exception as e:
            print(f"❌ Failed to merge LoRA: {e}")
            print("\n💡 You can skip merge if model is already merged:")
            print(f"   python {sys.argv[0]} --model-dir {model_dir} --skip-merge --merged-dir <merged-path>")
            sys.exit(1)
    
    # Step 2: Create Modelfile
    print("Step 2: Creating Modelfile...")
    modelfile_path = merged_model_path / "Modelfile"
    create_modelfile(str(merged_model_path), str(modelfile_path), base_model)
    print()
    
    # Step 3: Create Ollama model
    print("Step 3: Creating Ollama model...")
    if not create_ollama_model(args.model_name, str(modelfile_path)):
        print("\n💡 Manual steps:")
        print(f"   1. cd {merged_model_path}")
        print(f"   2. ollama create {args.model_name} -f Modelfile")
        sys.exit(1)
    print()
    
    # Step 4: Verify
    print("Step 4: Verifying model...")
    if verify_model(args.model_name):
        print()
        print("=" * 60)
        print("✅ Deployment Complete!")
        print("=" * 60)
        print(f"\n📦 Model Name: {args.model_name}")
        print(f"📁 Model Path: {merged_model_path}")
        print(f"\n🧪 Test the model:")
        print(f"   ollama run {args.model_name} 'Generate test cases for user login'")
        print(f"\n🔧 Update backend to use this model:")
        print(f"   Update OLLAMA_URL if needed")
        print(f"   Model will be used automatically via model selection")
    else:
        print("\n⚠️  Model created but verification failed. Check Ollama status.")

if __name__ == "__main__":
    main()






