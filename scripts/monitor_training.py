#!/usr/bin/env python3
"""
Real-time Training Progress Monitor
Shows live progress of training on DGX Spark
"""

import subprocess
import sys
import time
import os
from datetime import datetime

def get_dgx_connection():
    """Get DGX connection from environment or prompt"""
    host = os.getenv("DGX_HOST") or os.getenv("DGX_IP") or "localhost"
    user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME") or os.getenv("USER")
    port = os.getenv("DGX_SSH_PORT", "22")
    return host, user, port

def check_training_status(host, user, port):
    """Check if training is running on DGX"""
    try:
        # Check if training process is running
        cmd = "ps aux | grep '[t]rain_lora.py' || echo 'NOT_RUNNING'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if "train_lora.py" in result.stdout:
            return True, "Running"
        else:
            # Check if log file exists
            cmd = "test -f ~/qa_finetuning/training.log && tail -20 ~/qa_finetuning/training.log || echo 'NO_LOG'"
            log_result = subprocess.run(
                ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                 f"{user}@{host}", cmd],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if "NO_LOG" not in log_result.stdout:
                return True, "Running (checking logs)"
            else:
                return False, "Not running"
    except Exception as e:
        return None, f"Connection error: {e}"

def get_training_log(host, user, port, lines=50):
    """Get recent training log"""
    try:
        cmd = f"tail -n {lines} ~/qa_finetuning/training.log 2>/dev/null || echo 'Log file not found'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout
    except Exception as e:
        return f"Error: {e}"

def get_gpu_usage(host, user, port):
    """Get GPU usage on DGX"""
    try:
        cmd = "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo 'GPU_NOT_AVAILABLE'"
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout.strip()
    except:
        return "N/A"

def monitor_training(host="localhost", user="", port="22", interval=10):
    """Monitor training progress in real-time"""
    print("=" * 70)
    print("📊 TRAINING PROGRESS MONITOR")
    print("=" * 70)
    print(f"DGX: {user}@{host}:{port}")
    print(f"Update interval: {interval} seconds")
    print("Press Ctrl+C to stop monitoring")
    print("=" * 70)
    print("")
    
    last_log_size = 0
    
    try:
        while True:
            # Clear screen (optional, comment out if you want to see history)
            # os.system('clear' if os.name != 'nt' else 'cls')
            
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(f"\n[{timestamp}] Checking status...")
            print("-" * 70)
            
            # Check training status
            is_running, status = check_training_status(host, user, port)
            print(f"Status: {'✅ RUNNING' if is_running else '❌ NOT RUNNING'}")
            print(f"Details: {status}")
            
            # Get GPU usage
            gpu_info = get_gpu_usage(host, user, port)
            if "GPU_NOT_AVAILABLE" not in gpu_info and gpu_info != "N/A":
                print(f"\n🖥️  GPU Usage:")
                for line in gpu_info.split('\n'):
                    if line.strip():
                        parts = line.split(', ')
                        if len(parts) >= 4:
                            util, mem_used, mem_total, temp = parts
                            print(f"  GPU: {util}% | Memory: {mem_used}/{mem_total}MB | Temp: {temp}°C")
            else:
                print(f"\n🖥️  GPU: {gpu_info}")
            
            # Get recent log
            log = get_training_log(host, user, port, lines=30)
            if log and "Error" not in log and "not found" not in log.lower():
                print(f"\n📋 Recent Training Output:")
                print("-" * 70)
                # Show only new lines
                lines = log.split('\n')
                for line in lines[-15:]:  # Last 15 lines
                    if line.strip():
                        print(f"  {line}")
                print("-" * 70)
            else:
                print(f"\n📋 Log: {log[:100] if log else 'No log available'}")
            
            # Check if training completed
            if is_running:
                # Check for completion indicators
                completion_checks = [
                    "Training complete",
                    "✅ TRAINING COMPLETE",
                    "Model saved to",
                    "Training loss:"
                ]
                if any(indicator.lower() in log.lower() for indicator in completion_checks):
                    print("\n" + "=" * 70)
                    print("🎉 TRAINING COMPLETED!")
                    print("=" * 70)
                    break
            
            print(f"\n⏳ Next update in {interval} seconds... (Ctrl+C to stop)")
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Monitoring stopped by user")
        print("\n📊 To check results manually:")
        print(f"  ssh -p {port} {user}@{host} 'ls -lh ~/qa_finetuning/outputs/'")
        print(f"  ssh -p {port} {user}@{host} 'cat ~/qa_finetuning/training.log | tail -50'")
    except Exception as e:
        print(f"\n❌ Error: {e}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Monitor DGX Spark training progress")
    parser.add_argument("--host", help="DGX hostname/IP", default=None)
    parser.add_argument("--user", help="DGX username", default=None)
    parser.add_argument("--port", help="SSH port", default="22")
    parser.add_argument("--interval", type=int, default=10, help="Update interval in seconds")
    
    args = parser.parse_args()
    
    # Get connection details
    host = args.host or os.getenv("DGX_HOST") or os.getenv("DGX_IP") or "localhost"
    user = args.user or os.getenv("DGX_USER") or os.getenv("DGX_USERNAME") or os.getenv("USER", "")
    port = args.port or os.getenv("DGX_SSH_PORT", "22")
    
    if not user:
        print("⚠️  Username not provided")
        user = input("Enter DGX username: ").strip()
        if not user:
            print("❌ Cannot proceed without username")
            return 1
    
    monitor_training(host, user, port, args.interval)
    return 0

if __name__ == "__main__":
    exit(main())


