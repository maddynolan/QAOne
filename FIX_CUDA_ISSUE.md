# 🔧 Fix: CUDA Not Available in venv

## Problem

Training fails with:
```
RuntimeError: CUDA not available! This script requires GPU.
```

**Root Cause**: PyTorch in venv doesn't have CUDA support, even though GPU exists.

## Solution: Reinstall PyTorch with CUDA Support

**On DGX, run these commands:**

```bash
cd ~/qa_finetuning
source venv/bin/activate

# Uninstall current PyTorch (CPU version)
pip uninstall torch torchvision torchaudio -y

# Reinstall PyTorch with CUDA 12.1 support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Verify CUDA is now available
python3 -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'CUDA Version: {torch.version.cuda if torch.cuda.is_available() else \"N/A\"}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"
```

## Alternative: Check CUDA Version First

If CUDA 12.1 doesn't work, check what CUDA version is available:

```bash
# Check CUDA version
nvidia-smi | grep CUDA

# Or check CUDA toolkit
nvcc --version 2>/dev/null || echo "nvcc not found"

# Then install matching PyTorch:
# For CUDA 11.8:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.4:
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
```

## Quick Fix Command

**Copy and paste this on DGX:**

```bash
cd ~/qa_finetuning && \
source venv/bin/activate && \
pip uninstall torch torchvision torchaudio -y && \
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 && \
python3 -c "import torch; print('CUDA Available:', torch.cuda.is_available())"
```

## After Fixing

Once CUDA is available, you can start training:

```bash
cd ~/qa_finetuning
source venv/bin/activate
python3 scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

## Why This Happened

The venv was created but PyTorch was installed without specifying CUDA support, so it installed the CPU-only version. We need to reinstall with the CUDA index URL.




