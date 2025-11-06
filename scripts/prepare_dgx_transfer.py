#!/usr/bin/env python3
"""
Prepare files for transfer to DGX Spark
Creates a package with all necessary files for training
"""

import os
import shutil
import json
from pathlib import Path

def create_training_package():
    """Create a package with all files needed for DGX Spark training"""
    
    print("=" * 70)
    print("📦 PREPARING DGX SPARK TRAINING PACKAGE")
    print("=" * 70)
    
    # Create package directory
    package_dir = Path("dgx_training_package")
    if package_dir.exists():
        shutil.rmtree(package_dir)
    package_dir.mkdir()
    
    # Create data directory
    data_dir = package_dir / "data"
    data_dir.mkdir()
    
    # Copy training data files
    print("\n[1/5] Copying training data...")
    files_to_copy = [
        ("training_data.jsonl", "data/training_data.jsonl"),
        ("data/train.jsonl", "data/train.jsonl"),
        ("data/val.jsonl", "data/val.jsonl"),
    ]
    
    for src, dst in files_to_copy:
        if os.path.exists(src):
            dst_path = package_dir / dst
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst_path)
            print(f"  ✅ Copied: {src} → {dst}")
        else:
            print(f"  ⚠️  Missing: {src}")
    
    # Copy training scripts
    print("\n[2/5] Copying training scripts...")
    scripts_to_copy = [
        "scripts/train_lora.py",
        "scripts/evaluate_model.py",
    ]
    
    scripts_dir = package_dir / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    
    for script in scripts_to_copy:
        if os.path.exists(script):
            shutil.copy2(script, scripts_dir / os.path.basename(script))
            print(f"  ✅ Copied: {script}")
        else:
            print(f"  ⚠️  Missing: {script}")
    
    # Copy config files
    print("\n[3/5] Copying config files...")
    configs_dir = package_dir / "configs"
    configs_dir.mkdir(exist_ok=True)
    
    if os.path.exists("configs/lora_qwen7b_dgx.yaml"):
        shutil.copy2("configs/lora_qwen7b_dgx.yaml", configs_dir / "lora_qwen7b_dgx.yaml")
        print(f"  ✅ Copied: configs/lora_qwen7b_dgx.yaml")
    else:
        print(f"  ⚠️  Missing: configs/lora_qwen7b_dgx.yaml")
    
    # Create setup script
    print("\n[4/5] Creating setup script...")
    setup_script = """#!/bin/bash
# DGX Spark Training Setup Script
# Run this on DGX Spark after transferring the package

echo "=========================================="
echo "🚀 Setting up QA Expert Fine-Tuning"
echo "=========================================="

# Create conda environment
echo "Creating conda environment..."
conda create -n qafn python=3.10 -y
conda activate qafn

# Install dependencies
echo "Installing dependencies..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers>=4.35.0
pip install peft>=0.7.0
pip install accelerate>=0.24.0
pip install datasets>=2.14.0
pip install bitsandbytes>=0.41.0
pip install scipy
pip install pyyaml

# Verify GPU
echo "Checking GPU..."
nvidia-smi

# Verify installation
echo "Verifying installation..."
python -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"

echo "=========================================="
echo "✅ Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. conda activate qafn"
echo "2. python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml"
"""
    
    setup_path = package_dir / "setup.sh"
    with open(setup_path, "w", encoding="utf-8") as f:
        f.write(setup_script)
    os.chmod(setup_path, 0o755)
    print(f"  ✅ Created: setup.sh")
    
    # Create README
    print("\n[5/5] Creating README...")
    readme = """# QA Expert Fine-Tuning Package

## Contents

- **data/** - Training data (train.jsonl, val.jsonl)
- **scripts/** - Training scripts (train_lora.py, evaluate_model.py)
- **configs/** - Training configuration (lora_qwen7b_dgx.yaml)
- **setup.sh** - Setup script for DGX Spark

## Quick Start

### 1. Transfer to DGX Spark
```bash
scp -r dgx_training_package user@dgx-spark:~/qa_finetuning/
```

### 2. SSH to DGX Spark
```bash
ssh user@dgx-spark
cd ~/qa_finetuning/dgx_training_package
```

### 3. Run Setup
```bash
bash setup.sh
```

### 4. Activate Environment
```bash
conda activate qafn
```

### 5. Start Training
```bash
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

## Data Summary

- **Training examples:** 396
- **Validation examples:** 100
- **Total:** 496 examples
- **Quality:** 97% high quality (4+ stars)
- **Format:** JSONL (instruction/input/output)

## Expected Training Time

- **Estimated:** 2-4 hours on DGX Spark
- **Model output:** `outputs/qa-expert-7b-v1`

## Next Steps After Training

1. Evaluate model: `python scripts/evaluate_model.py --model outputs/qa-expert-7b-v1`
2. Convert to Ollama format
3. Deploy to Ollama server
4. Register in Model Registry
5. A/B test against base model

## Troubleshooting

- **GPU not detected:** Check `nvidia-smi` and CUDA installation
- **Out of memory:** Reduce batch_size in config
- **Training slow:** Check GPU utilization with `nvidia-smi`
"""
    
    readme_path = package_dir / "README.md"
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme)
    print(f"  ✅ Created: README.md")
    
    # Create requirements.txt
    requirements = """torch>=2.0.0
transformers>=4.35.0
peft>=0.7.0
accelerate>=0.24.0
datasets>=2.14.0
bitsandbytes>=0.41.0
scipy
pyyaml
"""
    
    req_path = package_dir / "requirements.txt"
    with open(req_path, "w", encoding="utf-8") as f:
        f.write(requirements)
    print(f"  ✅ Created: requirements.txt")
    
    # Summary
    print("\n" + "=" * 70)
    print("✅ PACKAGE CREATED SUCCESSFULLY")
    print("=" * 70)
    print(f"\n📦 Package location: {package_dir.absolute()}")
    print(f"📊 Package size: {sum(f.stat().st_size for f in package_dir.rglob('*') if f.is_file()) / 1024 / 1024:.1f} MB")
    print("\n📋 Contents:")
    for item in sorted(package_dir.rglob('*')):
        if item.is_file():
            rel_path = item.relative_to(package_dir)
            size = item.stat().st_size / 1024
            print(f"  - {rel_path} ({size:.1f} KB)")
    
    print("\n🚀 Next Steps:")
    print("1. Transfer to DGX Spark:")
    print(f"   scp -r {package_dir} user@dgx-spark:~/qa_finetuning/")
    print("2. SSH and run setup:")
    print("   ssh user@dgx-spark")
    print("   cd ~/qa_finetuning/dgx_training_package")
    print("   bash setup.sh")
    print("3. Start training:")
    print("   conda activate qafn")
    print("   python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml")
    print("\n" + "=" * 70)

if __name__ == "__main__":
    create_training_package()

