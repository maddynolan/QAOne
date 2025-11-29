#!/usr/bin/env python3
"""
Monitor DGX Training Progress
Real-time monitoring of finetuning progress on DGX Spark GB10
"""

import os
import sys
import time
import argparse
import paramiko
from datetime import datetime
from pathlib import Path

def monitor_training(dgx_host: str, dgx_user: str, dgx_port: int, work_dir: str, refresh_interval: int = 30):
    """Monitor training progress on DGX"""
    
    print("=" * 60)
    print("📊 DGX Training Monitor")
    print("=" * 60)
    print(f"Host: {dgx_host}")
    print(f"User: {dgx_user}")
    print(f"Work Dir: {work_dir}")
    print(f"Refresh: Every {refresh_interval} seconds")
    print("=" * 60)
    print()
    
    # Connect to DGX
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(dgx_host, port=dgx_port, username=dgx_user, timeout=30)
        print("✅ Connected to DGX")
        print()
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        sys.exit(1)
    
    log_file = f"{work_dir}/training.log"
    output_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
    
    try:
        while True:
            # Check if training is running
            stdin, stdout, stderr = client.exec_command(f"pgrep -f finetune_qwen3_30b_dgx.py")
            exit_status = stdout.channel.recv_exit_status()
            is_running = exit_status == 0
            
            # Get GPU usage
            stdin, stdout, stderr = client.exec_command("nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits")
            gpu_info = stdout.read().decode('utf-8').strip()
            
            # Get latest log lines
            stdin, stdout, stderr = client.exec_command(f"tail -n 10 {log_file} 2>/dev/null")
            log_lines = stdout.read().decode('utf-8')
            
            # Get checkpoint count
            stdin, stdout, stderr = client.exec_command(f"ls -1 {output_dir} 2>/dev/null | grep checkpoint | wc -l")
            checkpoint_count = stdout.read().decode('utf-8').strip()
            
            # Clear screen (optional)
            os.system('clear' if os.name != 'nt' else 'cls')
            
            print("=" * 60)
            print(f"📊 Training Monitor - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 60)
            print()
            
            # Status
            status = "🟢 RUNNING" if is_running else "🔴 STOPPED"
            print(f"Status: {status}")
            print()
            
            # GPU Info
            if gpu_info:
                print("🖥️  GPU Status:")
                for line in gpu_info.split('\n'):
                    if line.strip():
                        parts = line.split(', ')
                        if len(parts) >= 4:
                            util, mem_used, mem_total, temp = parts[0], parts[1], parts[2], parts[3]
                            print(f"  GPU: {util}% | Memory: {mem_used}/{mem_total} MB | Temp: {temp}°C")
                print()
            
            # Checkpoints
            print(f"📁 Checkpoints: {checkpoint_count}")
            print()
            
            # Latest logs
            print("📝 Latest Logs:")
            print("-" * 60)
            for line in log_lines.split('\n')[-10:]:
                if line.strip():
                    print(f"  {line}")
            print("-" * 60)
            print()
            
            print(f"⏱️  Refreshing in {refresh_interval} seconds... (Ctrl+C to stop)")
            
            if not is_running:
                print()
                print("⚠️  Training process not found. It may have completed or crashed.")
                print(f"   Check logs: ssh {dgx_user}@{dgx_host} 'tail -f {log_file}'")
            
            time.sleep(refresh_interval)
            
    except KeyboardInterrupt:
        print("\n\n👋 Monitoring stopped")
    finally:
        client.close()

def main():
    parser = argparse.ArgumentParser(description="Monitor DGX training progress")
    parser.add_argument("--dgx-host", default=os.getenv("DGX_HOST", ""), help="DGX hostname/IP")
    parser.add_argument("--dgx-user", default=os.getenv("DGX_USER", ""), help="DGX username")
    parser.add_argument("--dgx-port", type=int, default=int(os.getenv("DGX_SSH_PORT", "22")), help="DGX SSH port")
    parser.add_argument("--work-dir", default=os.getenv("DGX_WORK_DIR", "~/qa_finetuning"), help="DGX work directory")
    parser.add_argument("--refresh", type=int, default=30, help="Refresh interval in seconds")
    
    args = parser.parse_args()
    
    if not args.dgx_host or not args.dgx_user:
        print("❌ Error: DGX connection details required")
        print("Set DGX_HOST and DGX_USER, or use --dgx-host and --dgx-user")
        sys.exit(1)
    
    monitor_training(args.dgx_host, args.dgx_user, args.dgx_port, args.work_dir, args.refresh)

if __name__ == "__main__":
    main()




