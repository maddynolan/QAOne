#!/usr/bin/env python3
"""
Complete End-to-End Pipeline for DGX Spark GB10
Qwen Coder 3 30B Finetuning Pipeline with Progress Monitoring

This script orchestrates:
1. Data generation
2. Dataset preparation
3. Data transfer to DGX
4. Finetuning on DGX
5. Model evaluation
6. Progress monitoring
"""

import os
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import paramiko
from tqdm import tqdm

# Configuration
CONFIG = {
    "dgx_host": os.getenv("DGX_HOST", ""),
    "dgx_user": os.getenv("DGX_USER", ""),
    "dgx_ssh_port": int(os.getenv("DGX_SSH_PORT", "22")),
    "dgx_work_dir": os.getenv("DGX_WORK_DIR", "~/qa_finetuning"),
    "model_name": "Qwen/Qwen3-Coder-30B-Instruct",
    "output_model_name": "qa-expert-30b-coder",
    "local_data_dir": Path("data"),
    "local_models_dir": Path("models"),
    "test_cases_count": 1000,
    "automation_count": 1000,
    "num_epochs": 3,
    "batch_size": 1,
    "gradient_accumulation": 16,
    "learning_rate": 5e-6,
    "max_length": 4096,
}

class ProgressTracker:
    """Track pipeline progress"""
    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.steps = {}
        self.start_time = datetime.now()
        
    def log_step(self, step: str, status: str, message: str = ""):
        """Log a pipeline step"""
        timestamp = datetime.now().isoformat()
        elapsed = (datetime.now() - self.start_time).total_seconds()
        
        self.steps[step] = {
            "status": status,
            "message": message,
            "timestamp": timestamp,
            "elapsed_seconds": elapsed
        }
        
        log_entry = f"[{timestamp}] [{step}] {status}: {message}\n"
        with open(self.log_file, 'a') as f:
            f.write(log_entry)
        
        print(f"✅ [{step}] {status}: {message}")
    
    def get_summary(self) -> Dict[str, Any]:
        """Get progress summary"""
        return {
            "start_time": self.start_time.isoformat(),
            "current_time": datetime.now().isoformat(),
            "elapsed_seconds": (datetime.now() - self.start_time).total_seconds(),
            "steps": self.steps
        }

class DGXConnection:
    """Handle DGX SSH connection"""
    def __init__(self, host: str, user: str, port: int = 22):
        self.host = host
        self.user = user
        self.port = port
        self.client = None
        
    def connect(self) -> bool:
        """Connect to DGX"""
        try:
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            self.client.connect(
                self.host,
                port=self.port,
                username=self.user,
                timeout=30
            )
            return True
        except Exception as e:
            print(f"❌ Failed to connect to DGX: {e}")
            return False
    
    def execute(self, command: str, check: bool = True) -> tuple:
        """Execute command on DGX"""
        if not self.client:
            raise Exception("Not connected to DGX")
        
        stdin, stdout, stderr = self.client.exec_command(command)
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if check and exit_status != 0:
            raise Exception(f"Command failed: {command}\nError: {error}")
        
        return output, error, exit_status
    
    def upload_file(self, local_path: Path, remote_path: str):
        """Upload file to DGX"""
        sftp = self.client.open_sftp()
        sftp.put(str(local_path), remote_path)
        sftp.close()
    
    def upload_directory(self, local_dir: Path, remote_dir: str):
        """Upload directory to DGX"""
        sftp = self.client.open_sftp()
        
        # Create remote directory
        self.execute(f"mkdir -p {remote_dir}")
        
        # Upload files
        for file_path in local_dir.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(local_dir)
                remote_path = f"{remote_dir}/{rel_path}"
                remote_dir_path = "/".join(remote_path.split("/")[:-1])
                self.execute(f"mkdir -p {remote_dir_path}")
                sftp.put(str(file_path), remote_path)
        
        sftp.close()
    
    def close(self):
        """Close connection"""
        if self.client:
            self.client.close()

def step1_generate_data(tracker: ProgressTracker, config: Dict) -> bool:
    """Step 1: Generate synthetic training data"""
    try:
        tracker.log_step("step1_generate_data", "started", "Generating synthetic training data...")
        
        # Generate test cases
        cmd = [
            sys.executable,
            "scripts/generate_qa_synthetic_data.py",
            "--test-cases", str(config["test_cases_count"]),
            "--automation", str(config["automation_count"]),
            "--test-cases-out", str(config["local_data_dir"] / "qa_test_cases.jsonl"),
            "--automation-out", str(config["local_data_dir"] / "qa_automation_examples.jsonl")
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Data generation failed: {result.stderr}")
        
        tracker.log_step("step1_generate_data", "completed", 
                        f"Generated {config['test_cases_count']} test cases and {config['automation_count']} automation examples")
        return True
    except Exception as e:
        tracker.log_step("step1_generate_data", "failed", str(e))
        return False

def step2_prepare_dataset(tracker: ProgressTracker, config: Dict) -> bool:
    """Step 2: Prepare combined dataset"""
    try:
        tracker.log_step("step2_prepare_dataset", "started", "Preparing combined dataset...")
        
        cmd = [
            sys.executable,
            "scripts/prepare_finetuning_dataset.py",
            "--output", str(config["local_data_dir"] / "qa_training_data.jsonl")
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Dataset preparation failed: {result.stderr}")
        
        # Check if file exists and has data
        dataset_file = config["local_data_dir"] / "qa_training_data.jsonl"
        if not dataset_file.exists():
            raise Exception("Dataset file not created")
        
        # Count lines
        with open(dataset_file) as f:
            line_count = sum(1 for _ in f)
        
        tracker.log_step("step2_prepare_dataset", "completed", f"Prepared dataset with {line_count} examples")
        return True
    except Exception as e:
        tracker.log_step("step2_prepare_dataset", "failed", str(e))
        return False

def step3_setup_dgx(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 3: Setup DGX environment"""
    try:
        tracker.log_step("step3_setup_dgx", "started", "Setting up DGX environment...")
        
        work_dir = config["dgx_work_dir"]
        
        # Create work directory
        dgx.execute(f"mkdir -p {work_dir}/data")
        dgx.execute(f"mkdir -p {work_dir}/outputs")
        dgx.execute(f"mkdir -p {work_dir}/scripts")
        
        # Check Python and required packages
        output, _, _ = dgx.execute("python3 --version", check=False)
        if "Python" not in output:
            raise Exception("Python3 not found on DGX")
        
        # Check for transformers
        output, _, exit_code = dgx.execute("python3 -c 'import transformers; print(transformers.__version__)'", check=False)
        if exit_code != 0:
            tracker.log_step("step3_setup_dgx", "warning", "transformers not installed, will install during training")
        
        tracker.log_step("step3_setup_dgx", "completed", f"DGX environment ready at {work_dir}")
        return True
    except Exception as e:
        tracker.log_step("step3_setup_dgx", "failed", str(e))
        return False

def step4_transfer_data(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 4: Transfer data to DGX"""
    try:
        tracker.log_step("step4_transfer_data", "started", "Transferring data to DGX...")
        
        dataset_file = config["local_data_dir"] / "qa_training_data.jsonl"
        if not dataset_file.exists():
            raise Exception("Dataset file not found locally")
        
        remote_path = f"{config['dgx_work_dir']}/data/qa_training_data.jsonl"
        
        # Upload dataset
        dgx.upload_file(dataset_file, remote_path)
        
        # Verify upload
        output, _, exit_code = dgx.execute(f"wc -l {remote_path}", check=False)
        if exit_code == 0:
            line_count = output.split()[0]
            tracker.log_step("step4_transfer_data", "completed", f"Transferred dataset ({line_count} lines)")
        else:
            tracker.log_step("step4_transfer_data", "completed", "Dataset transferred")
        
        return True
    except Exception as e:
        tracker.log_step("step4_transfer_data", "failed", str(e))
        return False

def step5_upload_training_script(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 5: Upload finetuning script to DGX"""
    try:
        tracker.log_step("step5_upload_script", "started", "Uploading finetuning script...")
        
        # Upload the DGX-specific finetuning script
        script_path = Path("scripts/finetune_qwen3_30b_dgx.py")
        if not script_path.exists():
            raise Exception("Finetuning script not found")
        
        remote_path = f"{config['dgx_work_dir']}/scripts/finetune_qwen3_30b_dgx.py"
        dgx.upload_file(script_path, remote_path)
        dgx.execute(f"chmod +x {remote_path}")
        
        tracker.log_step("step5_upload_script", "completed", "Finetuning script uploaded")
        return True
    except Exception as e:
        tracker.log_step("step5_upload_script", "failed", str(e))
        return False

def step6_start_training(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 6: Start finetuning on DGX"""
    try:
        tracker.log_step("step6_start_training", "started", "Starting finetuning on DGX...")
        
        work_dir = config["dgx_work_dir"]
        script_path = f"{work_dir}/scripts/finetune_qwen3_30b_dgx.py"
        dataset_path = f"{work_dir}/data/qa_training_data.jsonl"
        output_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
        
        # Start training in background with nohup
        command = f"""
cd {work_dir} && \
nohup python3 {script_path} \
  --dataset {dataset_path} \
  --output-dir {output_dir} \
  --num-epochs {config['num_epochs']} \
  --batch-size {config['batch_size']} \
  --gradient-accumulation {config['gradient_accumulation']} \
  --learning-rate {config['learning_rate']} \
  --max-length {config['max_length']} \
  > {work_dir}/training.log 2>&1 &
echo $!
"""
        
        output, _, _ = dgx.execute(command)
        pid = output.strip()
        
        # Save PID for monitoring
        tracker.log_step("step6_start_training", "running", 
                        f"Training started (PID: {pid}). Monitor with: ssh {config['dgx_user']}@{config['dgx_host']} 'tail -f {work_dir}/training.log'")
        
        return True
    except Exception as e:
        tracker.log_step("step6_start_training", "failed", str(e))
        return False

def step7_monitor_training(tracker: ProgressTracker, config: Dict, dgx: DGXConnection, duration_hours: int = 16) -> bool:
    """Step 7: Monitor training progress"""
    try:
        tracker.log_step("step7_monitor", "started", f"Monitoring training for up to {duration_hours} hours...")
        
        work_dir = config["dgx_work_dir"]
        log_file = f"{work_dir}/training.log"
        output_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
        
        start_time = time.time()
        max_time = duration_hours * 3600
        last_size = 0
        
        print("\n📊 Training Progress:")
        print("=" * 60)
        
        while time.time() - start_time < max_time:
            # Check if training is still running
            output, _, exit_code = dgx.execute(f"pgrep -f finetune_qwen3_30b_dgx.py", check=False)
            if exit_code != 0:
                # Training finished
                break
            
            # Get latest log output
            output, _, _ = dgx.execute(f"tail -n 20 {log_file}", check=False)
            
            # Check for checkpoints
            output, _, _ = dgx.execute(f"ls -1 {output_dir} 2>/dev/null | wc -l", check=False)
            checkpoint_count = output.strip()
            
            # Show progress
            elapsed = int(time.time() - start_time)
            hours = elapsed // 3600
            minutes = (elapsed % 3600) // 60
            
            print(f"\r⏱️  Elapsed: {hours}h {minutes}m | Checkpoints: {checkpoint_count}", end="", flush=True)
            
            time.sleep(60)  # Check every minute
        
        print("\n")
        
        # Get final status
        output, _, _ = dgx.execute(f"tail -n 50 {log_file}", check=False)
        if "Training complete" in output or "✅" in output:
            tracker.log_step("step7_monitor", "completed", "Training completed successfully")
            return True
        else:
            tracker.log_step("step7_monitor", "warning", "Training may still be running or encountered issues")
            return True  # Continue anyway
    except Exception as e:
        tracker.log_step("step7_monitor", "failed", str(e))
        return False

def main():
    parser = argparse.ArgumentParser(description="Complete DGX Pipeline for Qwen3 Coder 30B Finetuning")
    parser.add_argument("--dgx-host", default=CONFIG["dgx_host"], help="DGX hostname/IP")
    parser.add_argument("--dgx-user", default=CONFIG["dgx_user"], help="DGX username")
    parser.add_argument("--dgx-port", type=int, default=CONFIG["dgx_ssh_port"], help="DGX SSH port")
    parser.add_argument("--skip-data-gen", action="store_true", help="Skip data generation (use existing)")
    parser.add_argument("--skip-transfer", action="store_true", help="Skip data transfer (data already on DGX)")
    parser.add_argument("--monitor-hours", type=int, default=16, help="Hours to monitor training")
    parser.add_argument("--test-cases", type=int, default=CONFIG["test_cases_count"], help="Number of test cases to generate")
    parser.add_argument("--automation", type=int, default=CONFIG["automation_count"], help="Number of automation examples")
    
    args = parser.parse_args()
    
    # Update config
    CONFIG["dgx_host"] = args.dgx_host
    CONFIG["dgx_user"] = args.dgx_user
    CONFIG["dgx_ssh_port"] = args.dgx_port
    CONFIG["test_cases_count"] = args.test_cases
    CONFIG["automation_count"] = args.automation
    
    # Validate DGX connection
    if not CONFIG["dgx_host"] or not CONFIG["dgx_user"]:
        print("❌ Error: DGX connection details required")
        print("Set DGX_HOST and DGX_USER environment variables, or use --dgx-host and --dgx-user")
        sys.exit(1)
    
    # Initialize progress tracker
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    tracker = ProgressTracker(log_file)
    
    print("=" * 60)
    print("🚀 DGX Spark GB10 - Complete Finetuning Pipeline")
    print("=" * 60)
    print(f"DGX Host: {CONFIG['dgx_host']}")
    print(f"DGX User: {CONFIG['dgx_user']}")
    print(f"Model: {CONFIG['model_name']}")
    print(f"Work Dir: {CONFIG['dgx_work_dir']}")
    print("=" * 60)
    print()
    
    # Connect to DGX
    dgx = DGXConnection(CONFIG["dgx_host"], CONFIG["dgx_user"], CONFIG["dgx_ssh_port"])
    
    try:
        if not dgx.connect():
            sys.exit(1)
        
        # Step 1: Generate data
        if not args.skip_data_gen:
            if not step1_generate_data(tracker, CONFIG):
                sys.exit(1)
        else:
            tracker.log_step("step1_generate_data", "skipped", "Using existing data")
        
        # Step 2: Prepare dataset
        if not args.skip_data_gen:
            if not step2_prepare_dataset(tracker, CONFIG):
                sys.exit(1)
        else:
            tracker.log_step("step2_prepare_dataset", "skipped", "Using existing dataset")
        
        # Step 3: Setup DGX
        if not step3_setup_dgx(tracker, CONFIG, dgx):
            sys.exit(1)
        
        # Step 4: Transfer data
        if not args.skip_transfer:
            if not step4_transfer_data(tracker, CONFIG, dgx):
                sys.exit(1)
        else:
            tracker.log_step("step4_transfer_data", "skipped", "Data already on DGX")
        
        # Step 5: Upload training script
        if not step5_upload_training_script(tracker, CONFIG, dgx):
            sys.exit(1)
        
        # Step 6: Start training
        if not step6_start_training(tracker, CONFIG, dgx):
            sys.exit(1)
        
        # Step 7: Monitor training
        if not step7_monitor_training(tracker, CONFIG, dgx, args.monitor_hours):
            tracker.log_step("step7_monitor", "warning", "Monitoring completed with warnings")
        
        # Final summary
        summary = tracker.get_summary()
        print("\n" + "=" * 60)
        print("✅ Pipeline Complete!")
        print("=" * 60)
        print(f"Total time: {summary['elapsed_seconds']/3600:.2f} hours")
        print(f"Log file: {log_file}")
        print("\nNext steps:")
        print(f"1. Check training logs: ssh {CONFIG['dgx_user']}@{CONFIG['dgx_host']} 'tail -f {CONFIG['dgx_work_dir']}/training.log'")
        print(f"2. Check model output: ssh {CONFIG['dgx_user']}@{CONFIG['dgx_host']} 'ls -lh {CONFIG['dgx_work_dir']}/outputs/'")
        print(f"3. Download model when ready: scp -r {CONFIG['dgx_user']}@{CONFIG['dgx_host']}:{CONFIG['dgx_work_dir']}/outputs/qa-expert-30b-coder ./models/")
        print("=" * 60)
        
    finally:
        dgx.close()

if __name__ == "__main__":
    main()




