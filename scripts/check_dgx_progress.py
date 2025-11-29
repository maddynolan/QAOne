#!/usr/bin/env python3
"""
Real-time progress checker for DGX setup/training
Shows what's happening RIGHT NOW
"""

import subprocess
import os
import sys
import time

def run_ssh_cmd(host, user, port, cmd):
    """Run SSH command and return output"""
    try:
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def check_progress():
    """Check current progress"""
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 REAL-TIME PROGRESS CHECK")
    print("=" * 70)
    print(f"DGX: {user}@{host}:{port}\n")
    
    # Check venv
    print("📦 [1] Checking venv setup...")
    success, output, _ = run_ssh_cmd(host, user, port, "test -d ~/qa_finetuning/venv && echo 'EXISTS' || echo 'NOT_FOUND'")
    if "EXISTS" in output:
        print("   ✅ venv exists")
    else:
        print("   ⚠️  venv not created yet")
    
    # Check if venv is activated (check for pip in venv)
    print("\n📋 [2] Checking pip installation...")
    success, output, _ = run_ssh_cmd(host, user, port, "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && pip --version 2>&1 | head -1 || echo 'NOT_ACTIVE'")
    if "NOT_ACTIVE" not in output and output.strip():
        print(f"   ✅ pip found: {output.strip()[:50]}")
    else:
        print("   ⚠️  venv not activated or pip not installed")
    
    # Check PyTorch installation
    print("\n🔥 [3] Checking PyTorch installation...")
    success, output, _ = run_ssh_cmd(host, user, port, 
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "python -c 'import torch; print(torch.__version__)' 2>&1 || echo 'NOT_INSTALLED'")
    if "NOT_INSTALLED" in output or "ModuleNotFoundError" in output:
        print("   ❌ PyTorch NOT installed")
        print("   💡 Try: pip install torch torchvision torchaudio")
    elif output.strip():
        print(f"   ✅ PyTorch installed: {output.strip()}")
        
        # Check CUDA
        success, cuda_output, _ = run_ssh_cmd(host, user, port,
            "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
            "python -c 'import torch; print(f\"CUDA: {torch.cuda.is_available()}\")' 2>&1")
        if "CUDA: True" in cuda_output:
            print("   ✅ CUDA available")
        else:
            print("   ⚠️  CUDA not available")
    else:
        print("   ⚠️  Could not check PyTorch")
    
    # Check other packages
    print("\n📚 [4] Checking other packages...")
    packages = ["transformers", "peft", "accelerate", "datasets"]
    for pkg in packages:
        success, output, _ = run_ssh_cmd(host, user, port,
            f"source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
            f"python -c 'import {pkg}; print(\"OK\")' 2>&1 || echo 'NOT_INSTALLED'")
        if "NOT_INSTALLED" in output or "ModuleNotFoundError" in output:
            print(f"   ❌ {pkg} not installed")
        elif "OK" in output:
            print(f"   ✅ {pkg} installed")
    
    # Check training process
    print("\n🚀 [5] Checking training process...")
    success, output, _ = run_ssh_cmd(host, user, port, 
        "ps aux | grep '[t]rain_lora.py' | wc -l")
    count = int(output.strip()) if output.strip().isdigit() else 0
    if count > 0:
        print(f"   ✅ Training IS RUNNING ({count} process)")
    else:
        print("   ❌ Training NOT running")
    
    # Check GPU usage
    print("\n🖥️  [6] Checking GPU usage...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1")
    if output.strip() and "error" not in output.lower():
        parts = output.strip().split(', ')
        if len(parts) >= 3:
            util, mem_used, mem_total = parts
            print(f"   GPU: {util}% | Memory: {mem_used}/{mem_total} MB")
            if int(util) > 10:
                print("   ✅ GPU is active!")
    
    print("\n" + "=" * 70)
    print("💡 To check again, run this script again")
    print("=" * 70)

if __name__ == "__main__":
    try:
        check_progress()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


