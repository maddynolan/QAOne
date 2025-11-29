# 🔧 Fix: PyTorch CUDA on ARM (AArch64) System

## Problem

- System is ARM-based (AArch64) - detected from CUDA libraries
- PyTorch installed is CPU-only version (2.9.0+cpu)
- CUDA libraries exist but PyTorch can't use them

## Solution: Install PyTorch with CUDA for ARM

**On DGX Spark, run:**

### Option 1: Install PyTorch from source or ARM build

```bash
source ~/qa_finetuning/venv/bin/activate

# Uninstall CPU version
pip uninstall torch torchvision torchaudio -y

# For ARM systems, PyTorch with CUDA might need special installation
# Try installing from PyPI (may have ARM CUDA builds)
pip install torch torchvision torchaudio --upgrade

# If that doesn't work, you may need to build from source or use NVIDIA's builds
```

### Option 2: Check if NVIDIA provides pre-built ARM PyTorch

```bash
# Check NVIDIA NGC for ARM PyTorch containers/builds
# Or check: https://pytorch.org/get-started/locally/
```

### Option 3: Use Docker (if available)

If Docker is available, use NVIDIA's PyTorch container:

```bash
# Pull NVIDIA PyTorch container for ARM
docker pull nvcr.io/nvidia/pytorch:23.12-py3
```

### Option 4: Verify CUDA libraries are accessible

```bash
# Check CUDA library path
echo $LD_LIBRARY_PATH

# May need to add CUDA to library path
export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH

# Then try installing PyTorch again
pip install torch torchvision torchaudio --upgrade
```

### Option 5: Check PyTorch compatibility

**Check your system details:**

```bash
# Check architecture
uname -m

# Check CUDA version
nvidia-smi

# Check Python version
python3 --version

# Check if PyTorch has ARM CUDA builds available
pip search torch  # or check PyTorch website
```

## Alternative: Use CPU Training (slower but works)

If CUDA-enabled PyTorch isn't available for ARM, you can train on CPU:

```bash
# Training will be much slower but will work
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

## Recommended Next Steps

1. **Check NVIDIA documentation** for ARM-based DGX systems
2. **Check PyTorch website** for ARM CUDA builds
3. **Contact your system administrator** - they may have specific PyTorch builds
4. **Try Docker/NVIDIA containers** if available


