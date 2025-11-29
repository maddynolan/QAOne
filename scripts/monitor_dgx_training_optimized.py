#!/usr/bin/env python3
"""
Optimized Monitor for DGX Training
Real-time monitoring with speed metrics
"""

import os
import sys
import time
import argparse
import paramiko
from datetime import datetime

def monitor_training(dgx_host: str, dgx_user: str, dgx_port: int, work_dir: str, refresh_interval: int = 15):
    """Monitor training with speed metrics"""
    
    print("=" * 70)
    print("Optimized DGX Training Monitor")
    print("=" * 70)
    print(f"Host: {dgx_host}")
    print(f"User: {dgx_user}")
    print(f"Work Dir: {work_dir}")
    print(f"Refresh: Every {refresh_interval} seconds")
    print("=" * 70)
    print()
    
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
    last_step = 0
    start_time = time.time()
    
    try:
        while True:
            # Check if training is running
            stdin, stdout, stderr = client.exec_command(f"pgrep -f finetune_qwen3_30b_dgx_optimized.py")
            exit_status = stdout.channel.recv_exit_status()
            is_running = exit_status == 0
            
            # Get GPU usage (detailed)
            stdin, stdout, stderr = client.exec_command(
                "nvidia-smi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits"
            )
            gpu_info = stdout.read().decode('utf-8').strip()
            
            # Get latest log lines
            stdin, stdout, stderr = client.exec_command(f"tail -n 15 {log_file} 2>/dev/null")
            log_lines = stdout.read().decode('utf-8')
            
            # Get checkpoint count
            stdin, stdout, stderr = client.exec_command(f"ls -1 {output_dir} 2>/dev/null | grep checkpoint | wc -l")
            checkpoint_count = stdout.read().decode('utf-8').strip()
            
            # Extract training step from logs
            current_step = 0
            for line in log_lines.split('\n'):
                if 'step' in line.lower() and '/' in line:
                    try:
                        parts = line.split()
                        for part in parts:
                            if '/' in part and 'step' in part.lower():
                                current_step = int(part.split('/')[0])
                                break
                    except:
                        pass
            
            # Calculate speed
            elapsed = time.time() - start_time
            if current_step > last_step and elapsed > 0:
                steps_per_sec = (current_step - last_step) / refresh_interval
                last_step = current_step
            else:
                steps_per_sec = 0
            
            # Clear screen
            os.system('clear' if os.name != 'nt' else 'cls')
            
            print("=" * 70)
            print(f"📊 Training Monitor - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("=" * 70)
            print()
            
            # Status
            status = "[RUNNING]" if is_running else "[STOPPED]"
            print(f"Status: {status}")
            if current_step > 0:
                print(f"Step: {current_step} | Speed: {steps_per_sec:.2f} steps/sec")
            print()
            
            # GPU Info (detailed)
            if gpu_info:
                print("GPU Status:")
                for line in gpu_info.split('\n'):
                    if line.strip():
                        parts = [p.strip() for p in line.split(',')]
                        if len(parts) >= 6:
                            util_gpu, util_mem, mem_used, mem_total, temp, power = parts
                            print(f"  GPU: {util_gpu}% | Memory: {util_mem}% ({mem_used}/{mem_total} MB)")
                            print(f"  Temp: {temp}°C | Power: {power}W")
                print()
            
            # Checkpoints
            print(f"Checkpoints: {checkpoint_count}")
            print()
            
            # Latest logs
            print("Latest Logs:")
            print("-" * 70)
            for line in log_lines.split('\n')[-12:]:
                if line.strip():
                    # Highlight important lines
                    if 'loss' in line.lower():
                        print(f"  [LOSS] {line}")
                    elif 'step' in line.lower() and '/' in line:
                        print(f"  [STEP] {line}")
                    elif 'saved' in line.lower() or 'checkpoint' in line.lower():
                        print(f"  [SAVED] {line}")
                    elif 'error' in line.lower() or 'failed' in line.lower():
                        print(f"  [ERROR] {line}")
                    else:
                        print(f"     {line}")
            print("-" * 70)
            print()
            
            # Estimated time
            if current_step > 0 and steps_per_sec > 0:
                # Estimate based on typical training (50 steps per checkpoint, 50 checkpoints per epoch)
                total_steps_estimate = 50 * 50 * 3  # 3 epochs
                remaining_steps = max(0, total_steps_estimate - current_step)
                remaining_time = remaining_steps / steps_per_sec if steps_per_sec > 0 else 0
                hours = int(remaining_time // 3600)
                minutes = int((remaining_time % 3600) // 60)
                if hours > 0 or minutes > 0:
                    print(f"Estimated remaining: {hours}h {minutes}m")
                print()
            
            print(f"Refreshing in {refresh_interval} seconds... (Ctrl+C to stop)")
            
            if not is_running:
                print()
                print("[WARN] Training process not found. It may have completed or crashed.")
                print(f"   Check logs: ssh {dgx_user}@{dgx_host} 'tail -f {log_file}'")
            
            time.sleep(refresh_interval)
            
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped")
    finally:
        client.close()

def main():
    parser = argparse.ArgumentParser(description="Optimized DGX training monitor")
    parser.add_argument("--dgx-host", default="spark-d435.local", help="DGX hostname")
    parser.add_argument("--dgx-user", default="madhujanu", help="DGX username")
    parser.add_argument("--dgx-port", type=int, default=22, help="DGX SSH port")
    parser.add_argument("--work-dir", default="~/qa_finetuning", help="DGX work directory")
    parser.add_argument("--refresh", type=int, default=15, help="Refresh interval (seconds)")
    
    args = parser.parse_args()
    
    monitor_training(args.dgx_host, args.dgx_user, args.dgx_port, args.work_dir, args.refresh)

if __name__ == "__main__":
    main()

