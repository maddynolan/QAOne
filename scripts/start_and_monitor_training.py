#!/usr/bin/env python3
"""
Start Training and Monitor Progress
This will connect to DGX, start training, and show real-time progress
"""

import subprocess
import sys
import time
import os
from pathlib import Path

def print_header():
    print("=" * 70)
    print("🚀 START TRAINING & MONITOR PROGRESS")
    print("=" * 70)
    print("")

def get_connection_details():
    """Get DGX connection details"""
    print("📋 DGX Connection Setup")
    print("  (Port 31143 is for Ollama tunnel, SSH uses port 22)")
    print("")
    
    host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
    user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")
    port = os.getenv("DGX_SSH_PORT", "22")
    
    if not host:
        host = input("  Enter DGX Hostname/IP: ").strip()
    else:
        print(f"  DGX Host: {host} (from environment)")
    
    if not user:
        user = input("  Enter DGX Username: ").strip()
    else:
        print(f"  DGX User: {user} (from environment)")
    
    port_input = input(f"  Enter SSH Port (default 22): ").strip()
    port = port_input if port_input else "22"
    
    print("")
    return host, user, port

def test_connection(host, user, port):
    """Test SSH connection"""
    print(f"🔌 Testing connection to {user}@{host}:{port}...")
    try:
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", "echo 'Connected'"],
            capture_output=True,
            timeout=10
        )
        if result.returncode == 0:
            print("  ✅ Connection successful!")
            return True
        else:
            print(f"  ❌ Connection failed: {result.stderr.decode()}")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def transfer_package(host, user, port):
    """Transfer training package"""
    print(f"\n📤 Transferring package...")
    package_dir = Path("dgx_training_package")
    
    if not package_dir.exists():
        print(f"  ❌ Package not found: {package_dir}")
        return False
    
    try:
        result = subprocess.run(
            ["scp", "-r", "-P", str(port), "-o", "StrictHostKeyChecking=no",
             str(package_dir), f"{user}@{host}:~/qa_finetuning/"],
            timeout=300
        )
        if result.returncode == 0:
            print("  ✅ Package transferred!")
            return True
        else:
            print("  ❌ Transfer failed")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def start_training(host, user, port):
    """Start training on DGX"""
    print(f"\n🚀 Starting training...")
    
    ssh_cmd = """cd ~/qa_finetuning/dgx_training_package && 
chmod +x auto_setup_and_train.sh && 
nohup bash auto_setup_and_train.sh > ../training.log 2>&1 & 
echo $! > ../training.pid && 
echo "Training PID: $(cat ../training.pid)" """
    
    try:
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", ssh_cmd],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(result.stdout)
            print("  ✅ Training started!")
            return True
        else:
            print(f"  ❌ Failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def monitor_training(host, user, port, interval=10):
    """Monitor training progress"""
    print("\n" + "=" * 70)
    print("📊 MONITORING TRAINING PROGRESS")
    print("=" * 70)
    print("Press Ctrl+C to stop monitoring (training will continue)")
    print("=" * 70)
    print("")
    
    try:
        while True:
            # Get recent log
            cmd = "tail -20 ~/qa_finetuning/training.log 2>/dev/null || echo 'NO_LOG'"
            result = subprocess.run(
                ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                 f"{user}@{host}", cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Clear screen (Windows compatible)
            os.system('cls' if os.name == 'nt' else 'clear')
            
            print("=" * 70)
            print(f"📊 TRAINING PROGRESS - {time.strftime('%H:%M:%S')}")
            print("=" * 70)
            
            if "NO_LOG" not in result.stdout and result.stdout.strip():
                lines = result.stdout.strip().split('\n')
                print("\n📋 Recent Output:")
                print("-" * 70)
                for line in lines[-15:]:
                    if line.strip():
                        print(f"  {line}")
                
                # Check for completion
                if any(x in result.stdout.lower() for x in ["training complete", "✅ training", "model saved"]):
                    print("\n" + "=" * 70)
                    print("🎉 TRAINING COMPLETED!")
                    print("=" * 70)
                    break
            else:
                print("\n⏳ Waiting for training to start...")
            
            # GPU info
            gpu_cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1"
            gpu_result = subprocess.run(
                ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                 f"{user}@{host}", gpu_cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            if gpu_result.stdout.strip() and "error" not in gpu_result.stdout.lower():
                parts = gpu_result.stdout.strip().split(', ')
                if len(parts) >= 3:
                    util, mem_used, mem_total = parts
                    print(f"\n🖥️  GPU: {util}% | Memory: {mem_used}/{mem_total}MB")
            
            print(f"\n⏳ Refreshing in {interval}s... (Ctrl+C to stop monitoring)")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Monitoring stopped (training continues)")
        print(f"\n📊 To check later:")
        print(f"  ssh -p {port} {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
    except Exception as e:
        print(f"\n❌ Error: {e}")

def main():
    print_header()
    
    # Get connection details
    host, user, port = get_connection_details()
    
    # Test connection
    if not test_connection(host, user, port):
        print("\n❌ Cannot connect to DGX Spark")
        return 1
    
    # Check if package exists
    if not Path("dgx_training_package").exists():
        print("\n❌ Training package not found!")
        print("💡 Run: python scripts/prepare_dgx_transfer.py")
        return 1
    
    # Transfer package
    if not transfer_package(host, user, port):
        print("\n❌ Package transfer failed")
        return 1
    
    # Start training
    if not start_training(host, user, port):
        print("\n❌ Failed to start training")
        return 1
    
    # Monitor
    print("\n⏱️  Training will run for 3-5 hours")
    print("📊 Starting real-time monitoring...")
    time.sleep(2)
    
    monitor_training(host, user, port, interval=10)
    
    print("\n✅ Done!")
    return 0

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted")
        exit(1)


