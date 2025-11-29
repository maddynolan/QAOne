#!/usr/bin/env python3
"""
Check PyTorch CUDA options for ARM systems
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

def check():
    """Check ARM PyTorch options"""
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 ARM PyTorch CUDA Check")
    print("=" * 70)
    
    # Check CUDA version from nvidia-smi
    print("\n[1] Checking CUDA version...")
    success, output, _ = run_ssh_cmd(host, user, port, 
        "nvidia-smi 2>/dev/null | grep -i 'cuda version' | head -1 || nvidia-smi | grep -i version | head -1")
    if output.strip():
        print(f"   {output.strip()}")
    
    # Check CUDA path
    print("\n[2] Checking CUDA installation path...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "ls -d /usr/local/cuda* 2>/dev/null | head -1 || echo 'NOT_FOUND'")
    if "NOT_FOUND" not in output and output.strip():
        cuda_path = output.strip()
        print(f"   ✅ CUDA path: {cuda_path}")
        
        # Check CUDA version in path
        success, version, _ = run_ssh_cmd(host, user, port,
            f"cat {cuda_path}/version.txt 2>/dev/null || echo 'NO_VERSION_FILE'")
        if "NO_VERSION_FILE" not in version and version.strip():
            print(f"   CUDA Version: {version.strip()}")
    else:
        print("   ⚠️  CUDA path not found")
    
    # Check LD_LIBRARY_PATH
    print("\n[3] Checking library paths...")
    success, output, _ = run_ssh_cmd(host, user, port, "echo $LD_LIBRARY_PATH")
    if output.strip():
        print(f"   LD_LIBRARY_PATH: {output.strip() or 'Not set'}")
    
    # Check if Docker is available
    print("\n[4] Checking Docker availability...")
    success, output, _ = run_ssh_cmd(host, user, port, "docker --version 2>/dev/null || echo 'NOT_AVAILABLE'")
    if "NOT_AVAILABLE" not in output and output.strip():
        print(f"   ✅ Docker: {output.strip()}")
        print("   💡 You can use NVIDIA PyTorch containers!")
    else:
        print("   ⚠️  Docker not available")
    
    print("\n" + "=" * 70)
    print("📋 RECOMMENDED FIX")
    print("=" * 70)
    print("\nOn DGX Spark, try this:")
    print("\n# Set CUDA library path")
    print("export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH")
    print("export CUDA_HOME=/usr/local/cuda")
    print("\n# Activate venv")
    print("source ~/qa_finetuning/venv/bin/activate")
    print("\n# Reinstall PyTorch")
    print("pip uninstall torch torchvision torchaudio -y")
    print("pip install torch torchvision torchaudio")
    print("\n# Verify")
    print("python -c 'import torch; print(f\"CUDA: {torch.cuda.is_available()}\")'")
    print("=" * 70)

if __name__ == "__main__":
    check()


