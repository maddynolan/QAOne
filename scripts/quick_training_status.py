#!/usr/bin/env python3
"""
Quick Training Status - Shows what's happening RIGHT NOW
Run this anytime to see current status
"""

import subprocess
import os
import sys

def check_status():
    """Quick status check with clear output"""
    host = os.getenv("DGX_HOST") or os.getenv("DGX_IP") or "192.168.39.185"
    user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME") or "madhujanu"
    port = os.getenv("DGX_SSH_PORT", "22")
    
    print("=" * 70)
    print("🔍 TRAINING STATUS CHECK")
    print("=" * 70)
    print(f"DGX: {user}@{host}:{port}\n")
    
    # 1. Check if package exists
    print("📦 [1/5] Checking if package was transferred...")
    try:
        cmd = "test -d ~/qa_finetuning/dgx_training_package && echo 'YES' || echo 'NO'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "YES" in result.stdout:
            print("   ✅ Package EXISTS on DGX")
        else:
            print("   ❌ Package NOT transferred yet")
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
    
    # 2. Check if training process is running
    print("\n🔄 [2/5] Checking if training process is running...")
    try:
        cmd = "ps aux | grep '[t]rain_lora.py\|[a]uto_setup_and_train' | wc -l"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        if count > 0:
            print(f"   ✅ Training IS RUNNING ({count} process(es))")
            
            # Get process details
            cmd = "ps aux | grep '[t]rain_lora.py\|[a]uto_setup_and_train' | head -1"
            proc_result = subprocess.run(
                ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                 f"{user}@{host}", cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            if proc_result.stdout:
                parts = proc_result.stdout.strip().split()
                if len(parts) > 0:
                    print(f"   PID: {parts[1]}")
                    print(f"   Command: {' '.join(parts[10:15])}...")
        else:
            print("   ❌ Training is NOT running")
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
    
    # 3. Check training log
    print("\n📋 [3/5] Checking training log...")
    try:
        cmd = "tail -10 ~/qa_finetuning/training.log 2>/dev/null || echo 'NO_LOG'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "NO_LOG" not in result.stdout and result.stdout.strip():
            print("   ✅ Log file exists")
            print("\n   Recent log entries:")
            print("   " + "-" * 66)
            for line in result.stdout.strip().split('\n')[-5:]:
                if line.strip():
                    print(f"   {line[:66]}")
            print("   " + "-" * 66)
        else:
            print("   ⚠️  No log file found")
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
    
    # 4. Check GPU usage
    print("\n🖥️  [4/5] Checking GPU usage...")
    try:
        cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.stdout.strip() and "error" not in result.stdout.lower():
            parts = result.stdout.strip().split(', ')
            if len(parts) >= 3:
                util, mem_used, mem_total = parts
                print(f"   GPU Utilization: {util}%")
                print(f"   Memory Used: {mem_used}/{mem_total} MB")
                if int(util) > 10:
                    print("   ✅ GPU is being used (training likely active)")
                else:
                    print("   ⚠️  GPU not in use")
        else:
            print("   ⚠️  Could not get GPU info")
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
    
    # 5. Check output directory
    print("\n📁 [5/5] Checking output directory...")
    try:
        cmd = "ls -lh ~/qa_finetuning/outputs/ 2>/dev/null | tail -3 || echo 'NO_OUTPUT'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "NO_OUTPUT" not in result.stdout and result.stdout.strip():
            print("   ✅ Output directory exists")
            for line in result.stdout.strip().split('\n')[-3:]:
                if line.strip() and not line.startswith('total'):
                    print(f"   {line}")
        else:
            print("   ⚠️  No output directory yet")
    except Exception as e:
        print(f"   ⚠️  Could not check: {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    print("\n💡 To monitor continuously:")
    print(f"   python scripts/monitor_training.py --host {host} --user {user} --port {port}")
    print("\n💡 To view live logs:")
    print(f"   ssh -p {port} {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
    print("=" * 70)

if __name__ == "__main__":
    try:
        check_status()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


