#!/usr/bin/env python3
"""Check PyTorch build details and find CUDA-enabled version"""

import subprocess
import os

def run_ssh_cmd(host, user, port, cmd):
    try:
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=15
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def check():
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 PyTorch Build Analysis")
    print("=" * 70)
    
    # Check current PyTorch
    print("\n[1] Current PyTorch installation...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "python -c 'import torch; print(f\"Version: {torch.__version__}\"); "
        "print(f\"CUDA available: {torch.cuda.is_available()}\"); "
        "print(f\"CUDA compiled: {torch.version.cuda if hasattr(torch.version, \"cuda\") and torch.version.cuda else \"N/A\"}\")' 2>&1")
    print(f"   {output.strip()}")
    
    # Check what PyTorch packages are available
    print("\n[2] Checking available PyTorch builds...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "pip index versions torch 2>&1 | head -10 || pip search torch 2>&1 | head -5 || echo 'Cannot check'")
    if output.strip() and "Cannot check" not in output:
        print(f"   {output.strip()[:200]}")
    
    # Check if PyTorch has CUDA in the package name
    print("\n[3] Checking PyTorch package details...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "pip show torch 2>&1")
    if output.strip():
        for line in output.strip().split('\n')[:10]:
            if line.strip():
                print(f"   {line.strip()}")
    
    # Check architecture
    print("\n[4] System details...")
    success, arch, _ = run_ssh_cmd(host, user, port, "uname -m")
    success2, python_v, _ = run_ssh_cmd(host, user, port, 
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && python --version")
    print(f"   Architecture: {arch.strip()}")
    print(f"   Python: {python_v.strip()}")
    
    print("\n" + "=" * 70)
    print("📋 SOLUTION OPTIONS")
    print("=" * 70)
    
    print("\n⚠️  PyTorch CUDA builds for ARM/AArch64 are LIMITED")
    print("\nOption 1: Use Docker (RECOMMENDED - Easiest!)")
    print("   docker pull nvcr.io/nvidia/pytorch:24.06-py3")
    print("   # Run training in container with CUDA support")
    
    print("\nOption 2: Build PyTorch from source")
    print("   # This takes hours but gives you CUDA support")
    print("   # See: https://pytorch.org/get-started/locally/")
    
    print("\nOption 3: Check NVIDIA NGC for ARM PyTorch")
    print("   # NVIDIA may have pre-built ARM PyTorch containers")
    print("   # Visit: https://catalog.ngc.nvidia.com/")
    
    print("\nOption 4: Train on CPU (slower but works)")
    print("   # Current PyTorch works but won't use GPU")
    print("   # Training will be 10-100x slower")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    check()


