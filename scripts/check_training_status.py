#!/usr/bin/env python3
"""
Quick check of training status on DGX Spark
"""

import subprocess
import os
import sys

def check_status():
    """Quick status check"""
    host = os.getenv("DGX_HOST") or os.getenv("DGX_IP") or "localhost"
    user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME") or os.getenv("USER", "")
    port = os.getenv("DGX_SSH_PORT", "22")
    
    # If no user, try to get from common patterns or prompt
    if not user or user == "":
        print("\n⚠️  DGX connection details needed")
        print("To check training status, I need:")
        print("  1. DGX Hostname/IP")
        print("  2. DGX Username")
        print("  3. SSH Port (usually 22)")
        print("\nSet environment variables:")
        print("  $env:DGX_HOST = 'your-dgx-ip-or-hostname'")
        print("  $env:DGX_USER = 'your-username'")
        print("  $env:DGX_SSH_PORT = '22'")
        print("\nOr provide them now:")
        host = input("  DGX Hostname/IP: ").strip() or host
        user = input("  DGX Username: ").strip()
        port_input = input(f"  SSH Port (default 22): ").strip()
        port = port_input if port_input else port
        
        if not user:
            print("\n❌ Cannot proceed without username")
            return
    
    print("=" * 70)
    print("📊 TRAINING STATUS CHECK - DGX SPARK")
    print("=" * 70)
    print(f"📍 Connection: {user}@{host}:{port}\n")
    
    # Check if process is running
    print("1️⃣  Checking if training process is running...")
    try:
        cmd = "ps aux | grep '[t]rain_lora.py' | wc -l"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        if count > 0:
            print(f"  ✅ Training is RUNNING ({count} process(es))")
        else:
            print(f"  ❌ Training is NOT running")
    except Exception as e:
        print(f"  ⚠️  Could not check: {e}")
    
    # Check log file
    print("\n2️⃣  Checking training log...")
    try:
        cmd = "tail -5 ~/qa_finetuning/training.log 2>/dev/null || echo 'NO_LOG_FILE'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "NO_LOG_FILE" not in result.stdout:
            print(f"  ✅ Log file exists")
            print(f"  Recent output:")
            for line in result.stdout.strip().split('\n')[-5:]:
                if line.strip():
                    print(f"    {line}")
        else:
            print(f"  ⚠️  No log file found")
    except Exception as e:
        print(f"  ⚠️  Could not check: {e}")
    
    # Check GPU
    print("\n3️⃣  Checking GPU usage...")
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
                print(f"  GPU Utilization: {util}%")
                print(f"  Memory: {mem_used}/{mem_total} MB")
        else:
            print(f"  ⚠️  Could not get GPU info")
    except:
        print(f"  ⚠️  Could not check GPU")
    
    # Check output directory
    print("\n4️⃣  Checking output directory...")
    try:
        cmd = "ls -lh ~/qa_finetuning/outputs/ 2>/dev/null | tail -5 || echo 'NO_OUTPUT'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if "NO_OUTPUT" not in result.stdout:
            print(f"  ✅ Output directory exists")
            print(f"  Contents:")
            for line in result.stdout.strip().split('\n')[-5:]:
                if line.strip():
                    print(f"    {line}")
        else:
            print(f"  ⚠️  No output directory yet")
    except Exception as e:
        print(f"  ⚠️  Could not check: {e}")
    
    # Final summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)
    
    # Try to determine overall status
    try:
        cmd = "ps aux | grep '[t]rain_lora.py' | wc -l"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        if count > 0:
            print("✅ STATUS: TRAINING IS IN PROGRESS")
            print(f"\n💡 Monitor live progress:")
            print(f"   python scripts/monitor_training.py --host {host} --user {user} --port {port}")
            print(f"\n   Or view logs:")
            print(f"   ssh -p {port} {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
        else:
            print("❌ STATUS: TRAINING IS NOT RUNNING")
            print(f"\n💡 To start training:")
            print(f"   ssh -p {port} {user}@{host}")
            print(f"   cd ~/qa_finetuning/dgx_training_package")
            print(f"   bash auto_setup_and_train.sh")
    except Exception as e:
        print(f"⚠️  Could not determine final status: {e}")
    
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
