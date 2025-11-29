#!/usr/bin/env python3
"""Find CUDA library path on ARM system"""

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

def find_cuda():
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 Finding CUDA Library Path")
    print("=" * 70)
    
    # Find CUDA installations
    print("\nSearching for CUDA...")
    paths_to_check = [
        "/usr/local/cuda",
        "/usr/local/cuda-13",
        "/usr/local/cuda-13.0",
        "/opt/cuda",
        "/usr/cuda",
    ]
    
    found_paths = []
    for path in paths_to_check:
        success, output, _ = run_ssh_cmd(host, user, port, f"test -d {path} && echo 'EXISTS' || echo 'NOT_FOUND'")
        if "EXISTS" in output:
            found_paths.append(path)
            print(f"   ✅ Found: {path}")
    
    # Check for libcudart
    print("\nSearching for CUDA libraries...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "find /usr -name 'libcudart.so*' 2>/dev/null | head -3 || echo 'NOT_FOUND'")
    if "NOT_FOUND" not in output and output.strip():
        print(f"   Libraries found:")
        for line in output.strip().split('\n')[:3]:
            if line.strip():
                lib_path = '/'.join(line.strip().split('/')[:-1])
                print(f"      {line.strip()} (dir: {lib_path})")
                if lib_path not in found_paths:
                    found_paths.append(lib_path)
    
    # Check ldconfig
    print("\nChecking system library cache...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "ldconfig -p 2>/dev/null | grep cuda | head -5 || echo 'NOT_FOUND'")
    if "NOT_FOUND" not in output and output.strip():
        print("   CUDA libraries in system cache:")
        for line in output.strip().split('\n')[:5]:
            if line.strip():
                print(f"      {line.strip()}")
    
    print("\n" + "=" * 70)
    print("📋 SETUP COMMANDS")
    print("=" * 70)
    
    if found_paths:
        primary_path = found_paths[0]
        lib_path = f"{primary_path}/lib64"
        
        print("\nRun these commands on DGX Spark:")
        print(f"\nexport LD_LIBRARY_PATH={lib_path}:$LD_LIBRARY_PATH")
        print(f"export CUDA_HOME={primary_path}")
        print(f"export PATH={primary_path}/bin:$PATH")
        print("\nsource ~/qa_finetuning/venv/bin/activate")
        print("pip uninstall torch torchvision torchaudio -y")
        print("pip install torch torchvision torchaudio")
        print("\npython -c 'import torch; print(f\"CUDA: {torch.cuda.is_available()}\")'")
    else:
        print("\n⚠️  CUDA path not found automatically")
        print("\nTry Docker instead:")
        print("  docker pull nvcr.io/nvidia/pytorch:24.06-py3")
        print("  (Easier and guaranteed to work!)")
    
    print("=" * 70)

if __name__ == "__main__":
    find_cuda()


