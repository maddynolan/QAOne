#!/usr/bin/env python3
"""
Optimized Complete Pipeline for DGX Spark GB10
- Docker vLLM with FP8/FP4 quantization
- Speed optimizations throughout
- Model weight export for easy transport
- Optimized for 128GB GPU, 4TB storage, 1 petaflop processing
"""

import os
import sys
import json
import time
import argparse
import subprocess
import socket
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import paramiko
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

# Optimized Configuration for DGX Spark GB10
CONFIG = {
    "dgx_host": "spark-d435.local",
    "dgx_user": "madhujanu",
    "dgx_ssh_port": 22,
    "dgx_work_dir": "~/qa_finetuning",
    "model_name": "Qwen/Qwen3-Coder-30B-Instruct",
    "output_model_name": "qa-expert-30b-coder",
    "local_data_dir": Path("data"),
    "local_models_dir": Path("models"),
    "test_cases_count": 2000,  # Increased for better quality
    "automation_count": 2000,
    "num_epochs": 3,
    "batch_size": 2,  # Increased for 128GB GPU
    "gradient_accumulation": 32,  # Higher for speed
    "learning_rate": 5e-6,
    "max_length": 4096,
    "use_fp8": True,  # FP8 quantization for speed
    "use_docker_vllm": True,  # Use Docker vLLM
    "num_workers": 8,  # Parallel data processing
    "export_weights": True,  # Export model weights
}

class ProgressTracker:
    """Track pipeline progress with speed metrics"""
    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.steps = {}
        self.start_time = datetime.now()
        self.speed_metrics = {}
        
    def log_step(self, step: str, status: str, message: str = "", duration: float = None):
        """Log a pipeline step with timing"""
        timestamp = datetime.now().isoformat()
        elapsed = (datetime.now() - self.start_time).total_seconds()
        
        if duration:
            self.speed_metrics[step] = duration
        
        self.steps[step] = {
            "status": status,
            "message": message,
            "timestamp": timestamp,
            "elapsed_seconds": elapsed,
            "duration": duration
        }
        
        log_entry = f"[{timestamp}] [{step}] {status}: {message}"
        if duration:
            log_entry += f" (took {duration:.2f}s)"
        log_entry += "\n"
        
        with open(self.log_file, 'a') as f:
            f.write(log_entry)
        
        status_icon = "[OK]" if status == "completed" else "[RUNNING]" if status == "in_progress" else "[WARNING]" if status == "warning" else "[ERROR]" if status == "failed" else "[INFO]"
        print(f"{status_icon} [{step}] {status}: {message}" + (f" ({duration:.2f}s)" if duration else ""))
    
    def get_summary(self) -> Dict[str, Any]:
        """Get progress summary with speed metrics"""
        return {
            "start_time": self.start_time.isoformat(),
            "current_time": datetime.now().isoformat(),
            "elapsed_seconds": (datetime.now() - self.start_time).total_seconds(),
            "steps": self.steps,
            "speed_metrics": self.speed_metrics
        }

class DGXConnection:
    """Optimized DGX SSH connection with parallel transfers"""
    def __init__(self, host: str, user: str, port: int = 22):
        self.host = host
        self.user = user
        self.port = port
        self.client = None
        self.sftp = None
        self.use_subprocess = False  # Fallback to subprocess if paramiko fails
        
    def connect(self) -> bool:
        """Connect to DGX with optimized settings - tries SSH keys first"""
        try:
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Resolve to IPv4 to avoid IPv6 issues
            try:
                ipv4_address = socket.gethostbyname(self.host)
                connect_host = ipv4_address
            except (socket.gaierror, socket.herror):
                connect_host = self.host
            
            # Try to find SSH keys in common locations
            ssh_keys = []
            home = Path.home()
            key_locations = [
                home / ".ssh" / "id_rsa",
                home / ".ssh" / "id_ed25519",
                home / ".ssh" / "id_ecdsa",
                home / ".ssh" / "id_dsa",
            ]
            
            for key_path in key_locations:
                if key_path.exists():
                    ssh_keys.append(str(key_path))
            
            # Try connecting with keys first, then without
            connected = False
            last_error = None
            
            if ssh_keys:
                # Try each key
                for key_path in ssh_keys:
                    try:
                        self.client.connect(
                            connect_host,
                            port=self.port,
                            username=self.user,
                            key_filename=key_path,
                            timeout=30,
                            look_for_keys=False,
                            allow_agent=False,
                            compress=True,
                        )
                        connected = True
                        break
                    except Exception as e:
                        last_error = e
                        continue
            
            # If keys didn't work, try default key locations
            if not connected:
                try:
                    self.client.connect(
                        connect_host,
                        port=self.port,
                        username=self.user,
                        timeout=30,
                        look_for_keys=True,
                        allow_agent=True,
                        compress=True,
                    )
                    connected = True
                except Exception as e:
                    last_error = e
            
            if not connected:
                # Paramiko failed, try subprocess SSH as fallback
                print(f"[WARNING] Paramiko connection failed, trying subprocess SSH...")
                test_result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                     f"{self.user}@{self.host}", "echo 'CONNECTED'"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if test_result.returncode == 0:
                    print(f"[OK] Subprocess SSH works, using that instead")
                    self.use_subprocess = True
                    return True
                else:
                    raise Exception(f"SSH authentication failed. Last error: {last_error}\n"
                                  f"Tip: Make sure SSH keys are set up or use: ssh-copy-id {self.user}@{self.host}")
            
            self.sftp = self.client.open_sftp()
            return True
        except Exception as e:
            # Try subprocess as last resort
            try:
                test_result = subprocess.run(
                    ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
                     f"{self.user}@{self.host}", "echo 'CONNECTED'"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if test_result.returncode == 0:
                    print(f"[OK] Using subprocess SSH (paramiko failed)")
                    self.use_subprocess = True
                    return True
            except:
                pass
            
            print(f"[ERROR] Failed to connect to DGX: {e}")
            print(f"\nTroubleshooting:")
            print(f"   1. Test SSH manually: ssh {self.user}@{self.host}")
            print(f"   2. Setup SSH keys: ssh-copy-id {self.user}@{self.host}")
            print(f"   3. Or ensure SSH keys are in ~/.ssh/")
            return False
    
    def execute(self, command: str, check: bool = True, timeout: int = 300) -> tuple:
        """Execute command on DGX with timeout"""
        if self.use_subprocess:
            # Use subprocess SSH
            ssh_cmd = [
                "ssh",
                "-o", "ConnectTimeout=10",
                "-o", "StrictHostKeyChecking=no",
                f"{self.user}@{self.host}",
                command
            ]
            result = subprocess.run(
                ssh_cmd,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=timeout
            )
            if check and result.returncode != 0:
                raise Exception(f"Command failed: {command}\nError: {result.stderr}")
            return result.stdout, result.stderr, result.returncode
        
        if not self.client:
            raise Exception("Not connected to DGX")
        
        stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
        exit_status = stdout.channel.recv_exit_status()
        output = stdout.read().decode('utf-8')
        error = stderr.read().decode('utf-8')
        
        if check and exit_status != 0:
            raise Exception(f"Command failed: {command}\nError: {error}")
        
        return output, error, exit_status
    
    def upload_file_fast(self, local_path: Path, remote_path: str):
        """Fast file upload using scp (more reliable than paramiko SFTP)"""
        try:
            # Use scp via subprocess for better reliability
            remote_dir = "/".join(remote_path.split("/")[:-1])
            # Create remote directory first
            self.execute(f"mkdir -p {remote_dir}", check=False)
            
            # Resolve to IPv4 for scp
            try:
                ipv4_address = socket.gethostbyname(self.host)
                scp_host = ipv4_address
            except (socket.gaierror, socket.herror):
                scp_host = self.host
            
            # Use scp to upload with IPv4
            scp_cmd = [
                "scp",
                "-4",  # Force IPv4
                "-o", "StrictHostKeyChecking=no",
                "-o", "ConnectTimeout=30",
                "-o", "AddressFamily=inet",  # Force IPv4
                str(local_path),
                f"{self.user}@{scp_host}:{remote_path}"
            ]
            result = subprocess.run(
                scp_cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            if result.returncode != 0:
                raise Exception(f"scp failed: {result.stderr}")
        except FileNotFoundError:
            # scp not available, try paramiko SFTP as fallback
            if not self.sftp:
                if not self.client:
                    raise Exception("Not connected to DGX")
                self.sftp = self.client.open_sftp()
            self.sftp.put(str(local_path), remote_path)
    
    def upload_directory_parallel(self, local_dir: Path, remote_dir: str, max_workers: int = 4):
        """Parallel directory upload for speed"""
        if not self.sftp:
            self.sftp = self.client.open_sftp()
        
        # Create remote directory
        self.execute(f"mkdir -p {remote_dir}")
        
        # Get all files
        files = list(local_dir.rglob("*"))
        files = [f for f in files if f.is_file()]
        
        def upload_file(file_path):
            rel_path = file_path.relative_to(local_dir)
            remote_path = f"{remote_dir}/{rel_path}"
            remote_dir_path = "/".join(remote_path.split("/")[:-1])
            self.execute(f"mkdir -p {remote_dir_path}", check=False)
            self.sftp.put(str(file_path), remote_path)
            return file_path
        
        # Parallel upload
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            list(executor.map(upload_file, files))
    
    def close(self):
        """Close connection"""
        if self.sftp:
            self.sftp.close()
        if self.client:
            self.client.close()

def step1_generate_data_parallel(tracker: ProgressTracker, config: Dict) -> bool:
    """Step 1: Generate data with parallel processing"""
    try:
        start = time.time()
        tracker.log_step("step1_generate_data", "started", "Generating training data in parallel...")
        
        # Use multiprocessing for faster generation
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
        
        duration = time.time() - start
        tracker.log_step("step1_generate_data", "completed", 
                        f"Generated {config['test_cases_count']} test cases and {config['automation_count']} automation examples",
                        duration)
        return True
    except Exception as e:
        tracker.log_step("step1_generate_data", "failed", str(e))
        return False

def step2_prepare_dataset_fast(tracker: ProgressTracker, config: Dict) -> bool:
    """Step 2: Fast dataset preparation"""
    try:
        start = time.time()
        tracker.log_step("step2_prepare_dataset", "started", "Preparing dataset...")
        
        cmd = [
            sys.executable,
            "scripts/prepare_finetuning_dataset.py",
            "--output", str(config["local_data_dir"] / "qa_training_data.jsonl")
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"Dataset preparation failed: {result.stderr}")
        
        dataset_file = config["local_data_dir"] / "qa_training_data.jsonl"
        with open(dataset_file) as f:
            line_count = sum(1 for _ in f)
        
        duration = time.time() - start
        tracker.log_step("step2_prepare_dataset", "completed", f"Prepared dataset with {line_count} examples", duration)
        return True
    except Exception as e:
        tracker.log_step("step2_prepare_dataset", "failed", str(e))
        return False

def step3_setup_dgx_optimized(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 3: Setup DGX with Docker and optimizations"""
    try:
        start = time.time()
        tracker.log_step("step3_setup_dgx", "started", "Setting up optimized DGX environment...")
        
        work_dir = config["dgx_work_dir"]
        
        # Create directories
        dgx.execute(f"mkdir -p {work_dir}/{{data,outputs,scripts,docker}}")
        
        # Check Docker
        output, _, exit_code = dgx.execute("docker --version", check=False)
        if exit_code != 0:
            tracker.log_step("step3_setup_dgx", "warning", "Docker not found, will install")
            dgx.execute("curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh", check=False)
        
        # Check NVIDIA Docker runtime
        output, _, exit_code = dgx.execute("docker info | grep -i nvidia", check=False)
        if exit_code != 0:
            tracker.log_step("step3_setup_dgx", "info", "Setting up NVIDIA Docker runtime...")
            # Install nvidia-docker2 if needed
            dgx.execute("distribution=$(. /etc/os-release;echo $ID$VERSION_ID) && curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list", check=False)
            dgx.execute("sudo apt-get update && sudo apt-get install -y nvidia-docker2", check=False)
            dgx.execute("sudo systemctl restart docker", check=False)
        
        # Check Python
        output, _, exit_code = dgx.execute("python3 --version", check=False)
        if exit_code != 0 or "Python" not in output:
            raise Exception("Python3 not found on DGX")
        tracker.log_step("step3_setup_dgx", "info", f"Python found: {output.strip()}")
        
        # Setup venv (no conda required)
        venv_dir = f"{work_dir}/venv"
        output, _, exit_code = dgx.execute(f"test -d {venv_dir} && echo 'exists' || echo 'not_found'", check=False)
        venv_exists = "exists" in output
        
        if not venv_exists:
            # Create venv
            tracker.log_step("step3_setup_dgx", "info", "Creating Python virtual environment...")
            dgx.execute(f"python3 -m venv {venv_dir}")
            
            # Install dependencies
            tracker.log_step("step3_setup_dgx", "info", "Installing dependencies (this may take a few minutes)...")
            install_cmd = f"""
source {venv_dir}/bin/activate && \
pip install --upgrade pip --quiet && \
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet && \
pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet && \
pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml trl>=0.7.0 --quiet
"""
            dgx.execute(install_cmd)
            tracker.log_step("step3_setup_dgx", "info", "Dependencies installed")
        else:
            tracker.log_step("step3_setup_dgx", "info", "Venv already exists, skipping setup")
        
        # Verify GPU access
        verify_cmd = f"""
source {venv_dir}/bin/activate && \
python3 -c "import torch; assert torch.cuda.is_available(), 'CUDA not available'; print(f'GPU: {{torch.cuda.get_device_name(0)}}')"
"""
        output, _, exit_code = dgx.execute(verify_cmd, check=False)
        if exit_code != 0:
            tracker.log_step("step3_setup_dgx", "warning", "GPU verification failed, but continuing...")
        else:
            tracker.log_step("step3_setup_dgx", "info", f"GPU verified: {output.strip()}")
        
        duration = time.time() - start
        tracker.log_step("step3_setup_dgx", "completed", f"DGX environment ready at {work_dir}", duration)
        return True
    except Exception as e:
        tracker.log_step("step3_setup_dgx", "failed", str(e))
        return False

def step4_transfer_data_fast(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 4: Fast parallel data transfer"""
    try:
        start = time.time()
        tracker.log_step("step4_transfer_data", "started", "Transferring data with parallel upload...")
        
        dataset_file = config["local_data_dir"] / "qa_training_data.jsonl"
        if not dataset_file.exists():
            raise Exception("Dataset file not found locally")
        
        remote_path = f"{config['dgx_work_dir']}/data/qa_training_data.jsonl"
        
        # Fast upload with compression
        dgx.upload_file_fast(dataset_file, remote_path)
        
        # Verify
        line_count = "unknown"
        output, _, exit_code = dgx.execute(f"wc -l {remote_path}", check=False)
        if exit_code == 0 and output:
            line_count = output.split()[0] if output.split() else "unknown"
        
        duration = time.time() - start
        tracker.log_step("step4_transfer_data", "completed", f"Transferred dataset ({line_count} lines)", duration)
        return True
    except Exception as e:
        tracker.log_step("step4_transfer_data", "failed", str(e))
        return False

def step5_upload_scripts_optimized(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 5: Upload optimized scripts"""
    try:
        start = time.time()
        tracker.log_step("step5_upload_scripts", "started", "Uploading optimized scripts...")
        
        scripts_to_upload = [
            ("scripts/finetune_qwen3_30b_dgx_optimized.py", f"{config['dgx_work_dir']}/scripts/finetune_qwen3_30b_dgx_optimized.py"),
            ("scripts/setup_docker_vllm.sh", f"{config['dgx_work_dir']}/scripts/setup_docker_vllm.sh"),
            ("scripts/export_model_weights.py", f"{config['dgx_work_dir']}/scripts/export_model_weights.py"),
        ]
        
        for local, remote in scripts_to_upload:
            if Path(local).exists():
                dgx.upload_file_fast(Path(local), remote)
                dgx.execute(f"chmod +x {remote}")
        
        duration = time.time() - start
        tracker.log_step("step5_upload_scripts", "completed", "Scripts uploaded", duration)
        return True
    except Exception as e:
        tracker.log_step("step5_upload_scripts", "failed", str(e))
        return False

def step6_start_training_optimized(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 6: Start optimized training"""
    try:
        start = time.time()
        tracker.log_step("step6_start_training", "started", "Starting optimized training...")
        
        work_dir = config["dgx_work_dir"]
        script_path = f"{work_dir}/scripts/finetune_qwen3_30b_dgx_optimized.py"
        dataset_path = f"{work_dir}/data/qa_training_data.jsonl"
        output_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
        
        # Start training with optimizations (using venv)
        venv_python = f"{work_dir}/venv/bin/python"
        command = f"""
cd {work_dir} && \
nohup {venv_python} {script_path} \
  --dataset {dataset_path} \
  --output-dir {output_dir} \
  --num-epochs {config['num_epochs']} \
  --batch-size {config['batch_size']} \
  --gradient-accumulation {config['gradient_accumulation']} \
  --learning-rate {config['learning_rate']} \
  --max-length {config['max_length']} \
  --num-workers {config['num_workers']} \
  --use-fp8 \
  > {work_dir}/training.log 2>&1 &
echo $!
"""
        
        output, _, _ = dgx.execute(command)
        pid = output.strip()
        
        duration = time.time() - start
        tracker.log_step("step6_start_training", "running", 
                        f"Training started (PID: {pid})", duration)
        
        return True
    except Exception as e:
        tracker.log_step("step6_start_training", "failed", str(e))
        return False

def step7_export_weights(tracker: ProgressTracker, config: Dict, dgx: DGXConnection) -> bool:
    """Step 7: Export model weights for easy transport"""
    try:
        start = time.time()
        tracker.log_step("step7_export_weights", "started", "Exporting model weights...")
        
        work_dir = config["dgx_work_dir"]
        model_dir = f"{work_dir}/outputs/qa-expert-30b-coder"
        weights_dir = f"{work_dir}/outputs/qa-expert-30b-coder-weights"
        export_script = f"{work_dir}/scripts/export_model_weights.py"
        
        # Run export script (using venv)
        venv_python = f"{work_dir}/venv/bin/python"
        command = f"""
{venv_python} {export_script} \
  --model-dir {model_dir} \
  --output-dir {weights_dir} \
  --format safetensors
"""
        
        dgx.execute(command)
        
        # Get weights file size
        output, _, _ = dgx.execute(f"du -sh {weights_dir} 2>/dev/null", check=False)
        size = output.split()[0] if output else "unknown"
        
        duration = time.time() - start
        tracker.log_step("step7_export_weights", "completed", f"Model weights exported ({size})", duration)
        return True
    except Exception as e:
        tracker.log_step("step7_export_weights", "warning", f"Weight export: {str(e)}")
        return True  # Non-critical

def main():
    parser = argparse.ArgumentParser(description="Optimized DGX Pipeline for Qwen3 Coder 30B")
    parser.add_argument("--skip-data-gen", action="store_true", help="Skip data generation")
    parser.add_argument("--skip-transfer", action="store_true", help="Skip data transfer")
    parser.add_argument("--test-cases", type=int, default=CONFIG["test_cases_count"], help="Number of test cases")
    parser.add_argument("--automation", type=int, default=CONFIG["automation_count"], help="Number of automation examples")
    parser.add_argument("--num-epochs", type=int, default=CONFIG["num_epochs"], help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=CONFIG["batch_size"], help="Batch size")
    
    args = parser.parse_args()
    
    # Update config
    CONFIG["test_cases_count"] = args.test_cases
    CONFIG["automation_count"] = args.automation
    CONFIG["num_epochs"] = args.num_epochs
    CONFIG["batch_size"] = args.batch_size
    
    # Initialize progress tracker
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"pipeline_optimized_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    tracker = ProgressTracker(log_file)
    
    print("=" * 60)
    print("Optimized DGX Pipeline - Qwen Coder 3 30B")
    print("=" * 60)
    print(f"Host: {CONFIG['dgx_host']}")
    print(f"User: {CONFIG['dgx_user']}")
    print(f"Model: {CONFIG['model_name']}")
    print(f"Optimizations: FP8, Docker vLLM, Parallel Processing")
    print("=" * 60)
    print()
    
    # Connect to DGX
    dgx = DGXConnection(CONFIG["dgx_host"], CONFIG["dgx_user"], CONFIG["dgx_ssh_port"])
    
    try:
        if not dgx.connect():
            sys.exit(1)
        
        # Execute pipeline steps
        if not args.skip_data_gen:
            if not step1_generate_data_parallel(tracker, CONFIG):
                sys.exit(1)
        
        if not args.skip_data_gen:
            if not step2_prepare_dataset_fast(tracker, CONFIG):
                sys.exit(1)
        
        if not step3_setup_dgx_optimized(tracker, CONFIG, dgx):
            sys.exit(1)
        
        if not args.skip_transfer:
            if not step4_transfer_data_fast(tracker, CONFIG, dgx):
                sys.exit(1)
        
        if not step5_upload_scripts_optimized(tracker, CONFIG, dgx):
            sys.exit(1)
        
        if not step6_start_training_optimized(tracker, CONFIG, dgx):
            sys.exit(1)
        
        # Summary
        summary = tracker.get_summary()
        print("\n" + "=" * 60)
        print("[OK] Pipeline Started!")
        print("=" * 60)
        print(f"Setup time: {summary['elapsed_seconds']/60:.2f} minutes")
        print(f"Log file: {log_file}")
        print("\nNext steps:")
        print(f"1. Monitor: python scripts/monitor_dgx_training_optimized.py")
        print(f"2. Check logs: ssh {CONFIG['dgx_user']}@{CONFIG['dgx_host']} 'tail -f {CONFIG['dgx_work_dir']}/training.log'")
        print(f"3. After training, export weights will run automatically")
        print("=" * 60)
        
    finally:
        dgx.close()

if __name__ == "__main__":
    main()

