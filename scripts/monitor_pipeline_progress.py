#!/usr/bin/env python3
"""
Monitor pipeline progress and show step-by-step status
"""

import os
import time
import json
import socket
import subprocess
from pathlib import Path
from datetime import datetime
import paramiko

def count_lines(filepath):
    """Count lines in a file"""
    try:
        if Path(filepath).exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                return sum(1 for _ in f)
        return 0
    except:
        return 0

def run_ssh_command(host, user, command, timeout=10):
    """Run SSH command using subprocess (more reliable on Windows)"""
    try:
        # Use subprocess instead of paramiko for better Windows compatibility
        ssh_cmd = [
            "ssh",
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            "-o", "BatchMode=yes",  # Non-interactive
            f"{user}@{host}",
            command
        ]
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',  # Force UTF-8 encoding
            errors='replace',  # Replace invalid characters instead of failing
            timeout=timeout
        )
        if result.returncode == 0:
            return True, result.stdout.strip()
        else:
            error_msg = result.stderr.strip() if result.stderr else "Command failed"
            # Clean up any problematic characters
            error_msg = error_msg.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
            return False, error_msg
    except subprocess.TimeoutExpired:
        return False, "SSH command timeout"
    except FileNotFoundError:
        # SSH command not found, try paramiko as fallback
        return None, "SSH command not found"
    except UnicodeDecodeError as e:
        return False, f"Encoding error: {str(e)}"
    except Exception as e:
        return False, str(e)

def check_dgx_status(dgx_host, dgx_user, work_dir):
    """Check DGX status using subprocess SSH (more reliable than paramiko on Windows)"""
    try:
        # First try subprocess SSH (works on Windows with Git Bash/WSL)
        # Check if we can connect
        can_connect, test_output = run_ssh_command(dgx_host, dgx_user, "echo 'CONNECTED'", timeout=5)
        
        if can_connect is None:
            # SSH command not available, try paramiko fallback
            return check_dgx_status_paramiko(dgx_host, dgx_user, work_dir)
        
        if not can_connect:
            return {
                "connected": False,
                "error": f"SSH connection failed: {test_output}"
            }
        
        # Connection works, check status
        results = {}
        
        # Check training process
        success, output = run_ssh_command(dgx_host, dgx_user, "pgrep -f finetune || echo 'NOT_RUNNING'", timeout=5)
        if success:
            training_running = output and output != "NOT_RUNNING"
            results["training_running"] = training_running
        
        # Check training log
        log_file = f"{work_dir}/training.log"
        success, output = run_ssh_command(dgx_host, dgx_user, f"test -f {log_file} && tail -5 {log_file} || echo 'NO_LOG'", timeout=5)
        if success:
            results["log_content"] = output
        
        # Check data file
        data_file = f"{work_dir}/data/qa_training_data.jsonl"
        success, output = run_ssh_command(dgx_host, dgx_user, f"test -f {data_file} && wc -l {data_file} || echo '0'", timeout=5)
        if success:
            data_lines = output.split()[0] if output and output != "0" else "0"
            results["data_lines"] = data_lines
        
        # Check venv
        venv_dir = f"{work_dir}/venv"
        success, output = run_ssh_command(dgx_host, dgx_user, f"test -d {venv_dir} && echo 'EXISTS' || echo 'NOT_FOUND'", timeout=5)
        if success:
            results["venv_exists"] = "EXISTS" in output
        
        # Check GPU
        success, output = run_ssh_command(dgx_host, dgx_user, "nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null || echo 'N/A'", timeout=5)
        if success:
            results["gpu_info"] = output
        
        return {
            "connected": True,
            "training_running": results.get("training_running", False),
            "log_content": results.get("log_content", ""),
            "data_lines": results.get("data_lines", "0"),
            "venv_exists": results.get("venv_exists", False),
            "gpu_info": results.get("gpu_info", "N/A")
        }
        
    except Exception as e:
        return {
            "connected": False,
            "error": f"Error checking DGX status: {str(e)}"
        }

def check_dgx_status_paramiko(dgx_host, dgx_user, work_dir):
    """Fallback paramiko method if subprocess SSH is not available"""
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Resolve to IPv4
        try:
            ipv4_address = socket.gethostbyname(dgx_host)
            connect_host = ipv4_address
        except (socket.gaierror, socket.herror):
            connect_host = dgx_host
        
        client.connect(
            connect_host,
            username=dgx_user,
            timeout=15,
            look_for_keys=False,
            allow_agent=False,
            banner_timeout=15
        )
        
        # Execute commands (same as before)
        stdin, stdout, stderr = client.exec_command("pgrep -f finetune || echo 'NOT_RUNNING'", timeout=5)
        pid = stdout.read().decode('utf-8').strip()
        training_running = pid and pid != "NOT_RUNNING"
        
        log_file = f"{work_dir}/training.log"
        stdin, stdout, stderr = client.exec_command(f"test -f {log_file} && tail -5 {log_file} || echo 'NO_LOG'", timeout=5)
        log_content = stdout.read().decode('utf-8').strip()
        
        data_file = f"{work_dir}/data/qa_training_data.jsonl"
        stdin, stdout, stderr = client.exec_command(f"test -f {data_file} && wc -l {data_file} || echo '0'", timeout=5)
        data_output = stdout.read().decode('utf-8').strip()
        data_lines = data_output.split()[0] if data_output and data_output != "0" else "0"
        
        venv_dir = f"{work_dir}/venv"
        stdin, stdout, stderr = client.exec_command(f"test -d {venv_dir} && echo 'EXISTS' || echo 'NOT_FOUND'", timeout=5)
        venv_exists = "EXISTS" in stdout.read().decode('utf-8')
        
        stdin, stdout, stderr = client.exec_command("nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null || echo 'N/A'", timeout=5)
        gpu_info = stdout.read().decode('utf-8').strip()
        
        client.close()
        
        return {
            "connected": True,
            "training_running": training_running,
            "log_content": log_content,
            "data_lines": data_lines,
            "venv_exists": venv_exists,
            "gpu_info": gpu_info
        }
    except Exception as e:
        return {
            "connected": False,
            "error": f"Paramiko connection failed: {str(e)}"
        }

# Global state for tracking generation speed
_generation_start_time = None
_last_test_cases_count = 0
_last_automation_count = 0
_last_update_time = None

def get_progress():
    """Get current pipeline progress with ETA calculations"""
    global _generation_start_time, _last_test_cases_count, _last_automation_count, _last_update_time
    
    config = {
        "dgx_host": "spark-d435.local",
        "dgx_user": "madhujanu",
        "work_dir": "~/qa_finetuning",
        "target_test_cases": 2000,
        "target_automation": 2000
    }
    
    progress = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "steps": {}
    }
    
    current_time = time.time()
    
    # Step 1: Data Generation - Test Cases
    test_cases_file = Path("data/qa_test_cases.jsonl")
    test_cases_count = count_lines(test_cases_file)
    test_cases_progress = (test_cases_count / config["target_test_cases"]) * 100 if config["target_test_cases"] > 0 else 0
    
    # Calculate ETA for test cases
    test_cases_eta = None
    test_cases_rate = None
    if test_cases_count > 0 and test_cases_count < config["target_test_cases"]:
        if _generation_start_time is None:
            _generation_start_time = current_time
        
        elapsed = current_time - _generation_start_time
        if elapsed > 0:
            test_cases_rate = test_cases_count / elapsed
            remaining = config["target_test_cases"] - test_cases_count
            if test_cases_rate > 0:
                test_cases_eta_seconds = remaining / test_cases_rate
                test_cases_eta = test_cases_eta_seconds / 60  # in minutes
    
    _last_test_cases_count = test_cases_count
    
    progress["steps"]["1_data_generation_test_cases"] = {
        "status": "completed" if test_cases_count >= config["target_test_cases"] else "in_progress",
        "progress": f"{test_cases_count}/{config['target_test_cases']}",
        "percentage": f"{test_cases_progress:.1f}%",
        "file": str(test_cases_file) if test_cases_file.exists() else "Not created",
        "rate": test_cases_rate,
        "eta_minutes": test_cases_eta
    }
    
    # Step 2: Data Generation - Automation Examples
    automation_file = Path("data/qa_automation_examples.jsonl")
    automation_count = count_lines(automation_file)
    automation_progress = (automation_count / config["target_automation"]) * 100 if config["target_automation"] > 0 else 0
    
    # Calculate ETA for automation
    automation_eta = None
    automation_rate = None
    if automation_count > 0 and automation_count < config["target_automation"]:
        if _generation_start_time is None:
            _generation_start_time = current_time
        
        elapsed = current_time - _generation_start_time
        if elapsed > 0:
            automation_rate = automation_count / elapsed
            remaining = config["target_automation"] - automation_count
            if automation_rate > 0:
                automation_eta_seconds = remaining / automation_rate
                automation_eta = automation_eta_seconds / 60  # in minutes
    
    _last_automation_count = automation_count
    _last_update_time = current_time
    
    progress["steps"]["2_data_generation_automation"] = {
        "status": "completed" if automation_count >= config["target_automation"] else "in_progress",
        "progress": f"{automation_count}/{config['target_automation']}",
        "percentage": f"{automation_progress:.1f}%",
        "file": str(automation_file) if automation_file.exists() else "Not created",
        "rate": automation_rate,
        "eta_minutes": automation_eta
    }
    
    # Step 3: Dataset Preparation
    combined_file = Path("data/qa_training_data.jsonl")
    combined_count = count_lines(combined_file)
    
    progress["steps"]["3_dataset_preparation"] = {
        "status": "completed" if combined_file.exists() and combined_count > 0 else "pending",
        "progress": f"{combined_count} examples",
        "file": str(combined_file) if combined_file.exists() else "Not created"
    }
    
    # Step 4: DGX Setup (with error suppression)
    try:
        dgx_status = check_dgx_status(config["dgx_host"], config["dgx_user"], config["work_dir"])
    except Exception as e:
        # If check itself fails, create a safe status
        dgx_status = {
            "connected": False,
            "error": f"Error checking DGX: {str(e)}"
        }
    
    if dgx_status.get("connected"):
        progress["steps"]["4_dgx_setup"] = {
            "status": "completed" if dgx_status.get("venv_exists") else "in_progress",
            "venv": "exists" if dgx_status.get("venv_exists") else "not found",
            "data_transferred": "yes" if dgx_status.get("data_lines", "0") != "0" else "no",
            "data_lines": dgx_status.get("data_lines", "0")
        }
    else:
        error_msg = dgx_status.get("error", "Cannot connect to DGX")
        # Shorten long error messages
        if len(error_msg) > 60:
            error_msg = error_msg[:57] + "..."
        progress["steps"]["4_dgx_setup"] = {
            "status": "unknown",
            "error": error_msg
        }
    
    # Step 5: Training
    if dgx_status.get("connected"):
        progress["steps"]["5_training"] = {
            "status": "running" if dgx_status.get("training_running") else "not_started",
            "gpu_info": dgx_status.get("gpu_info", "N/A"),
            "log_available": "yes" if dgx_status.get("log_content", "") != "NO_LOG" else "no"
        }
    else:
        progress["steps"]["5_training"] = {
            "status": "unknown",
            "error": "Cannot verify (DGX unreachable)"
        }
    
    return progress

def print_progress(progress):
    """Print progress in a nice format"""
    
    print("=" * 80)
    print(f"Pipeline Progress Report - {progress['timestamp']}")
    print("=" * 80)
    print()
    
    steps = progress["steps"]
    
    # Step 1
    step1 = steps.get("1_data_generation_test_cases", {})
    status_icon = "[OK]" if step1.get("status") == "completed" else "[RUNNING]" if step1.get("status") == "in_progress" else "[PENDING]"
    print(f"{status_icon} Step 1: Test Cases Generation")
    print(f"   Progress: {step1.get('progress', 'N/A')} ({step1.get('percentage', '0%')})")
    if step1.get("rate") and step1.get("eta_minutes"):
        print(f"   Speed: {step1.get('rate', 0):.1f} examples/s | ETA: {step1.get('eta_minutes', 0):.1f} min")
    print(f"   File: {step1.get('file', 'N/A')}")
    print()
    
    # Step 2
    step2 = steps.get("2_data_generation_automation", {})
    status_icon = "[OK]" if step2.get("status") == "completed" else "[RUNNING]" if step2.get("status") == "in_progress" else "[PENDING]"
    print(f"{status_icon} Step 2: Automation Examples Generation")
    print(f"   Progress: {step2.get('progress', 'N/A')} ({step2.get('percentage', '0%')})")
    if step2.get("rate") and step2.get("eta_minutes"):
        print(f"   Speed: {step2.get('rate', 0):.1f} examples/s | ETA: {step2.get('eta_minutes', 0):.1f} min")
    print(f"   File: {step2.get('file', 'N/A')}")
    print()
    
    # Step 3
    step3 = steps.get("3_dataset_preparation", {})
    status_icon = "[OK]" if step3.get("status") == "completed" else "[PENDING]"
    print(f"{status_icon} Step 3: Dataset Preparation")
    print(f"   Status: {step3.get('status', 'pending')}")
    print(f"   Examples: {step3.get('progress', 'N/A')}")
    print(f"   File: {step3.get('file', 'N/A')}")
    print()
    
    # Step 4
    step4 = steps.get("4_dgx_setup", {})
    if step4.get("status") == "completed":
        status_icon = "[OK]"
    elif step4.get("status") == "in_progress":
        status_icon = "[RUNNING]"
    elif step4.get("status") == "unknown":
        status_icon = "[UNKNOWN]"
    else:
        status_icon = "[PENDING]"
    print(f"{status_icon} Step 4: DGX Setup")
    print(f"   Status: {step4.get('status', 'unknown')}")
    if "venv" in step4:
        print(f"   Venv: {step4.get('venv', 'N/A')}")
    if "data_transferred" in step4:
        print(f"   Data Transferred: {step4.get('data_transferred', 'N/A')}")
        print(f"   Data Lines: {step4.get('data_lines', 'N/A')}")
    if "error" in step4:
        print(f"   Error: {step4.get('error', 'N/A')}")
    print()
    
    # Step 5
    step5 = steps.get("5_training", {})
    if step5.get("status") == "running":
        status_icon = "[RUNNING]"
    elif step5.get("status") == "not_started":
        status_icon = "[PENDING]"
    else:
        status_icon = "[UNKNOWN]"
    print(f"{status_icon} Step 5: Training")
    print(f"   Status: {step5.get('status', 'unknown')}")
    if "gpu_info" in step5 and step5["gpu_info"] != "N/A":
        print(f"   GPU: {step5.get('gpu_info', 'N/A')}")
    if "log_available" in step5:
        print(f"   Log: {step5.get('log_available', 'N/A')}")
    if "error" in step5:
        print(f"   Error: {step5.get('error', 'N/A')}")
    print()
    
    print("=" * 80)
    print()
    print("Next update in 30 seconds... (Ctrl+C to stop)")
    print()

def main():
    """Main monitoring loop"""
    import sys
    
    print("Starting pipeline progress monitor...")
    print("Press Ctrl+C to stop")
    print("Note: DGX connection errors will be shown but won't stop monitoring")
    print()
    
    try:
        while True:
            try:
                progress = get_progress()
                print_progress(progress)
            except Exception as e:
                # Don't crash on errors, just show them
                print(f"\n[WARNING] Error getting progress: {e}")
                print("Continuing to monitor...\n")
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")
        sys.exit(0)

if __name__ == "__main__":
    main()

