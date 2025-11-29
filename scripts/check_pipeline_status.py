#!/usr/bin/env python3
"""Check pipeline status on DGX"""

import paramiko
import sys

def check_dgx_status():
    """Check DGX pipeline status"""
    
    dgx_host = "spark-d435.local"
    dgx_user = "madhujanu"
    work_dir = "~/qa_finetuning"
    
    print("=" * 70)
    print("Pipeline Status Check")
    print("=" * 70)
    print(f"Host: {dgx_host}")
    print(f"User: {dgx_user}")
    print("=" * 70)
    print()
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(dgx_host, username=dgx_user, timeout=10)
        print("[OK] Connected to DGX")
        print()
    except Exception as e:
        print(f"[ERROR] Failed to connect: {e}")
        return
    
    # Check if training is running
    print("1. Training Process:")
    stdin, stdout, stderr = client.exec_command("pgrep -f finetune || echo 'NOT_RUNNING'")
    pid = stdout.read().decode('utf-8').strip()
    if pid and pid != "NOT_RUNNING":
        print(f"   [RUNNING] PID: {pid}")
    else:
        print("   [STOPPED] Training process not found")
    print()
    
    # Check GPU
    print("2. GPU Status:")
    stdin, stdout, stderr = client.exec_command("nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader 2>/dev/null || echo 'GPU_INFO_UNAVAILABLE'")
    gpu_info = stdout.read().decode('utf-8').strip()
    if gpu_info and gpu_info != "GPU_INFO_UNAVAILABLE":
        parts = gpu_info.split(',')
        if len(parts) >= 4:
            util, mem_used, mem_total, temp = [p.strip() for p in parts]
            print(f"   Utilization: {util}")
            print(f"   Memory: {mem_used} / {mem_total}")
            print(f"   Temperature: {temp}")
    else:
        print("   [WARN] GPU info unavailable")
    print()
    
    # Check training log
    print("3. Training Log:")
    log_file = f"{work_dir}/training.log"
    stdin, stdout, stderr = client.exec_command(f"test -f {log_file} && tail -30 {log_file} || echo 'LOG_NOT_FOUND'")
    log_content = stdout.read().decode('utf-8').strip()
    if log_content and log_content != "LOG_NOT_FOUND":
        print("   Latest log entries:")
        for line in log_content.split('\n')[-10:]:
            if line.strip():
                print(f"   {line}")
    else:
        print("   [INFO] Training log not found yet (may still be in setup phase)")
    print()
    
    # Check venv
    print("4. Environment:")
    venv_dir = f"{work_dir}/venv"
    stdin, stdout, stderr = client.exec_command(f"test -d {venv_dir} && echo 'EXISTS' || echo 'NOT_FOUND'")
    venv_status = stdout.read().decode('utf-8').strip()
    if venv_status == "EXISTS":
        print(f"   [OK] Venv exists at {venv_dir}")
    else:
        print(f"   [WARN] Venv not found")
    print()
    
    # Check data
    print("5. Data Files:")
    data_file = f"{work_dir}/data/qa_training_data.jsonl"
    stdin, stdout, stderr = client.exec_command(f"test -f {data_file} && wc -l {data_file} || echo 'NOT_FOUND'")
    data_info = stdout.read().decode('utf-8').strip()
    if data_info and "NOT_FOUND" not in data_info:
        lines = data_info.split()[0]
        print(f"   [OK] Dataset file exists: {lines} lines")
    else:
        print("   [WARN] Dataset file not found")
    print()
    
    # Check outputs
    print("6. Outputs:")
    output_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
    stdin, stdout, stderr = client.exec_command(f"test -d {output_dir} && ls -lh {output_dir} | head -5 || echo 'NOT_FOUND'")
    output_info = stdout.read().decode('utf-8').strip()
    if output_info and "NOT_FOUND" not in output_info:
        print(f"   [OK] Output directory exists")
        print(f"   Contents:")
        for line in output_info.split('\n')[:5]:
            if line.strip():
                print(f"     {line}")
    else:
        print("   [INFO] Output directory not created yet (training may not have started)")
    print()
    
    # Summary
    print("=" * 70)
    print("Summary:")
    print("=" * 70)
    if pid and pid != "NOT_RUNNING":
        print("[RUNNING] Training process is active")
    else:
        print("[STOPPED] Training process not running")
        print("   - May be in setup phase")
        print("   - May have completed")
        print("   - May have encountered an error")
    print()
    print("Check full logs:")
    print(f"  ssh {dgx_user}@{dgx_host} 'tail -f {work_dir}/training.log'")
    print("=" * 70)
    
    client.close()

if __name__ == "__main__":
    check_dgx_status()




