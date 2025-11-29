#!/usr/bin/env python3
"""
Diagnose CUDA/PyTorch issues on DGX
"""

import subprocess
import os

def run_ssh_cmd(host, user, port, cmd):
    """Run SSH command"""
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

def diagnose():
    """Diagnose CUDA issues"""
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 CUDA DIAGNOSIS")
    print("=" * 70)
    print(f"DGX: {user}@{host}:{port}\n")
    
    # 1. Check nvidia-smi
    print("[1] Checking NVIDIA drivers...")
    success, output, _ = run_ssh_cmd(host, user, port, "nvidia-smi --query-gpu=name,driver_version,cuda_version --format=csv,noheader 2>/dev/null | head -1")
    if success and output.strip():
        parts = output.strip().split(', ')
        if len(parts) >= 3:
            print(f"   ✅ GPU: {parts[0]}")
            print(f"   ✅ Driver: {parts[1]}")
            print(f"   ✅ CUDA Version: {parts[2]}")
        else:
            print(f"   GPU Info: {output.strip()}")
    else:
        print("   ❌ nvidia-smi not working or no GPU detected")
    
    # 2. Check CUDA in system
    print("\n[2] Checking CUDA installation...")
    success, output, _ = run_ssh_cmd(host, user, port, "nvcc --version 2>/dev/null | grep 'release' || echo 'NVCC_NOT_FOUND'")
    if "NVCC_NOT_FOUND" not in output and output.strip():
        print(f"   ✅ CUDA Toolkit: {output.strip()}")
    else:
        print("   ⚠️  CUDA Toolkit (nvcc) not found")
        print("   💡 PyTorch can work without nvcc if drivers are installed")
    
    # 3. Check PyTorch version
    print("\n[3] Checking PyTorch installation...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "python -c 'import torch; print(torch.__version__)' 2>&1")
    if output.strip():
        print(f"   PyTorch: {output.strip()}")
    
    # 4. Check CUDA availability in PyTorch
    print("\n[4] Checking PyTorch CUDA support...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "python -c 'import torch; print(f\"CUDA Available: {torch.cuda.is_available()}\"); "
        "print(f\"CUDA Version: {torch.version.cuda if torch.cuda.is_available() else \"N/A\"}\"); "
        "print(f\"cuDNN Version: {torch.backends.cudnn.version() if torch.cuda.is_available() else \"N/A\"}\")' 2>&1")
    print(f"   {output.strip()}")
    
    # 5. Check if CUDA libraries are accessible
    print("\n[5] Checking CUDA libraries...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "ldconfig -p 2>/dev/null | grep -i cuda | head -3 || echo 'NO_CUDA_LIBS'")
    if "NO_CUDA_LIBS" not in output and output.strip():
        print(f"   ✅ CUDA libraries found:")
        for line in output.strip().split('\n')[:3]:
            if line.strip():
                print(f"      {line.strip()}")
    else:
        print("   ⚠️  CUDA libraries not found in system")
    
    # 6. Check PyTorch build info
    print("\n[6] Checking PyTorch build info...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "source ~/qa_finetuning/venv/bin/activate 2>/dev/null && "
        "python -c 'import torch; print(torch.version.cuda if hasattr(torch.version, \"cuda\") else \"N/A\"); "
        "print(f\"Built with CUDA: {torch.cuda.is_available()}\")' 2>&1")
    print(f"   {output.strip()}")
    
    print("\n" + "=" * 70)
    print("📋 RECOMMENDATIONS")
    print("=" * 70)
    
    # Provide recommendations
    print("\nIf CUDA is False, try:")
    print("1. Reinstall PyTorch with specific CUDA version:")
    print("   pip uninstall torch torchvision torchaudio -y")
    print("   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
    print("\n2. Or install from PyPI (auto-detects):")
    print("   pip install torch torchvision torchaudio --upgrade")
    print("\n3. Check if PyTorch was built with CUDA:")
    print("   python -c 'import torch; print(torch.cuda.is_available())'")
    print("=" * 70)

if __name__ == "__main__":
    diagnose()


