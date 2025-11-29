#!/usr/bin/env python3
"""Check Docker training progress"""

import subprocess
import os

def run_ssh_cmd(host, user, port, cmd):
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

def check():
    host = os.getenv("DGX_HOST") or "192.168.39.185"
    user = os.getenv("DGX_USER") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🐳 DOCKER TRAINING STATUS")
    print("=" * 70)
    
    # Check Docker container
    print("\n[1] Checking Docker container...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "docker ps -a | grep -E 'qa-training|pytorch' | head -2 || echo 'NO_CONTAINER'")
    if "NO_CONTAINER" not in output and output.strip():
        print("   ✅ Container found:")
        for line in output.strip().split('\n'):
            if line.strip():
                print(f"      {line.strip()[:80]}")
    else:
        print("   ⚠️  No training container found")
    
    # Check training log
    print("\n[2] Checking training log...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "tail -30 ~/qa_finetuning/docker_training.log 2>/dev/null || echo 'NO_LOG'")
    if "NO_LOG" not in output and output.strip():
        print("   Recent activity:")
        print("   " + "-" * 66)
        for line in output.strip().split('\n')[-15:]:
            if line.strip():
                print(f"   {line.strip()[:66]}")
        print("   " + "-" * 66)
    else:
        print("   ⚠️  No log file yet")
    
    # Check GPU usage
    print("\n[3] Checking GPU usage...")
    success, output, _ = run_ssh_cmd(host, user, port,
        "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1")
    if output.strip() and "error" not in output.lower():
        parts = output.strip().split(', ')
        if len(parts) >= 3:
            util, mem_used, mem_total = parts
            print(f"   GPU: {util}% | Memory: {mem_used}/{mem_total} MB")
            if int(util) > 10:
                print("   ✅ GPU is active (training likely running!)")
            else:
                print("   ⚠️  GPU not in use yet")
    
    print("\n" + "=" * 70)
    print("💡 To view live logs:")
    print(f"   ssh -p {port} {user}@{host} 'tail -f ~/qa_finetuning/docker_training.log'")
    print("=" * 70)

if __name__ == "__main__":
    check()


