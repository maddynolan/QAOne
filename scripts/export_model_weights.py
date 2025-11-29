#!/usr/bin/env python3
"""
Export model weights for easy transport
Supports multiple formats: safetensors, pytorch, onnx
"""

import os
import sys
import argparse
import json
from pathlib import Path
import torch
try:
    from safetensors.torch import save_file
    SAFETENSORS_AVAILABLE = True
except ImportError:
    SAFETENSORS_AVAILABLE = False
    print("⚠️  safetensors not available, will use PyTorch format")
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

def export_to_safetensors(model_dir: Path, output_dir: Path):
    """Export model to SafeTensors format (recommended)"""
    if not SAFETENSORS_AVAILABLE:
        print("⚠️  safetensors not available, falling back to PyTorch format")
        return export_to_pytorch(model_dir, output_dir)
    
    print(f"📦 Exporting to SafeTensors format...")
    
    # Load base model
    base_model_name = "Qwen/Qwen3-Coder-30B-Instruct"
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )
    
    # Load LoRA weights
    adapter_path = model_dir / "adapter_model.bin"
    if adapter_path.exists():
        model = PeftModel.from_pretrained(model, str(model_dir))
        print("  ✓ Loaded LoRA adapters")
    
    # Merge adapters into base model
    print("  Merging LoRA adapters...")
    model = model.merge_and_unload()
    
    # Save in SafeTensors format
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Save model state dict
    state_dict = model.state_dict()
    
    # Split into chunks if needed (for large models)
    chunk_size = 10_000_000_000  # 10GB chunks
    total_size = sum(p.numel() * p.element_size() for p in state_dict.values())
    
    if total_size > chunk_size:
        print(f"  Splitting into chunks (total size: {total_size / 1e9:.2f} GB)...")
        chunk_idx = 0
        current_chunk = {}
        current_size = 0
        
        for name, tensor in state_dict.items():
            tensor_size = tensor.numel() * tensor.element_size()
            
            if current_size + tensor_size > chunk_size and current_chunk:
                chunk_file = output_dir / f"model-{chunk_idx:03d}.safetensors"
                save_file(current_chunk, str(chunk_file))
                print(f"    Saved chunk {chunk_idx}: {chunk_file.name}")
                chunk_idx += 1
                current_chunk = {}
                current_size = 0
            
            current_chunk[name] = tensor
            current_size += tensor_size
        
        # Save last chunk
        if current_chunk:
            chunk_file = output_dir / f"model-{chunk_idx:03d}.safetensors"
            save_file(current_chunk, str(chunk_file))
            print(f"    Saved chunk {chunk_idx}: {chunk_file.name}")
    else:
        # Single file
        weights_file = output_dir / "model.safetensors"
        save_file(state_dict, str(weights_file))
        print(f"  ✓ Saved: {weights_file.name}")
    
    # Save config
    config_file = output_dir / "config.json"
    model.config.save_pretrained(str(output_dir))
    print(f"  ✓ Saved config")
    
    # Save tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    tokenizer.save_pretrained(str(output_dir))
    print(f"  ✓ Saved tokenizer")
    
    # Save metadata
    metadata = {
        "model_name": "qa-expert-30b-coder",
        "base_model": base_model_name,
        "format": "safetensors",
        "total_parameters": sum(p.numel() for p in model.parameters()),
        "file_size_gb": total_size / 1e9,
    }
    
    metadata_file = output_dir / "metadata.json"
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✓ Saved metadata")
    
    print(f"✅ Export complete: {output_dir}")
    return output_dir

def export_to_pytorch(model_dir: Path, output_dir: Path):
    """Export model to PyTorch format"""
    print(f"📦 Exporting to PyTorch format...")
    
    base_model_name = "Qwen/Qwen3-Coder-30B-Instruct"
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True
    )
    
    adapter_path = model_dir / "adapter_model.bin"
    if adapter_path.exists():
        model = PeftModel.from_pretrained(model, str(model_dir))
        model = model.merge_and_unload()
    
    output_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(output_dir))
    
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    tokenizer.save_pretrained(str(output_dir))
    
    print(f"✅ Export complete: {output_dir}")
    return output_dir

def main():
    parser = argparse.ArgumentParser(description="Export model weights for transport")
    parser.add_argument("--model-dir", type=str, required=True, help="Path to trained model directory")
    parser.add_argument("--output-dir", type=str, required=True, help="Output directory for weights")
    parser.add_argument("--format", type=str, default="safetensors", choices=["safetensors", "pytorch"], help="Export format")
    
    args = parser.parse_args()
    
    model_dir = Path(args.model_dir)
    output_dir = Path(args.output_dir)
    
    if not model_dir.exists():
        print(f"❌ Model directory not found: {model_dir}")
        sys.exit(1)
    
    print("=" * 60)
    print("📦 Model Weight Export")
    print("=" * 60)
    print(f"Model: {model_dir}")
    print(f"Output: {output_dir}")
    print(f"Format: {args.format}")
    print("=" * 60)
    print()
    
    if args.format == "safetensors":
        export_to_safetensors(model_dir, output_dir)
    elif args.format == "pytorch":
        export_to_pytorch(model_dir, output_dir)
    
    # Get size
    total_size = sum(f.stat().st_size for f in output_dir.rglob("*") if f.is_file())
    print(f"\n📊 Total size: {total_size / 1e9:.2f} GB")
    print(f"📁 Location: {output_dir}")

if __name__ == "__main__":
    main()

