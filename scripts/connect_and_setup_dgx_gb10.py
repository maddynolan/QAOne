#!/usr/bin/env python3
"""
Connect to DGX Spark GB10 and set up Qwen3-Coder-30B
IP: 192.168.1.233
Username: madhujanu
"""

import os
import sys
import subprocess

DGX_HOST = "spark-d435.local"  # or use IP: 192.168.1.233
DGX_USER = "madhujanu"
DGX_PORT = "22"

def run_ssh_command(cmd, description):
    """Run SSH command on DGX"""
    print(f"\n{description}...")
    try:
        ssh_cmd = ["ssh"]
        ssh_cmd.extend([
            "-p", DGX_PORT,
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{DGX_USER}@{DGX_HOST}",
            cmd
        ])
        
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"  [OK] Success")
            if result.stdout.strip():
                print(f"  Output: {result.stdout.strip()}")
            return True, result.stdout
        else:
            print(f"  [ERROR] Failed")
            if result.stderr:
                print(f"  Error: {result.stderr.strip()}")
            return False, result.stderr
    except Exception as e:
        print(f"  [ERROR] Exception: {e}")
        return False, str(e)

def main():
    print("=" * 70)
    print("DGX Spark GB10 Setup: Qwen3-Coder-30B")
    print("=" * 70)
    print(f"\nConnection Details:")
    print(f"  Host: {DGX_HOST}")
    print(f"  User: {DGX_USER}")
    print(f"  Port: {DGX_PORT}")
    print()
    
    # Step 1: Test connection
    print("Step 1: Testing SSH connection...")
    success, output = run_ssh_command("echo 'Connection test' && hostname && whoami", "Testing connection")
    if not success:
        print("\n[ERROR] Cannot connect to DGX Spark GB10")
        print("\nTroubleshooting:")
        print("  1. Check if DGX is accessible: ping 192.168.1.233")
        print("  2. Verify SSH is running on port 22")
        print("  3. Check if SSH key authentication is required")
        print("  4. Ensure network connectivity")
        return 1
    
    print(f"\n[OK] Connected! Server info:")
    for line in output.split('\n'):
        if line.strip():
            print(f"    {line.strip()}")
    
    # Step 2: Check GPU
    print("\nStep 2: Checking GPU...")
    run_ssh_command("nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader", "Checking GPU")
    
    # Step 3: Check Ollama
    print("\nStep 3: Checking Ollama installation...")
    success, output = run_ssh_command("ollama --version 2>/dev/null || echo 'Ollama not found'", "Checking Ollama")
    
    if "not found" in output.lower():
        print("  [WARNING] Ollama not installed. Installing...")
        run_ssh_command("curl -fsSL https://ollama.com/install.sh | sh", "Installing Ollama")
    
    # Step 4: Check existing models
    print("\nStep 4: Checking existing models...")
    run_ssh_command("ollama list", "Listing models")
    
    # Step 5: Install Qwen3-Coder-30B
    print("\nStep 5: Installing Qwen3-Coder-30B-Instruct...")
    print("  This will take time (30B model is ~60GB)...")
    print("  Starting download in background...")
    
    # Start installation in background
    success, output = run_ssh_command(
        "nohup ollama pull Qwen/Qwen3-Coder-30B-Instruct > /tmp/ollama_pull.log 2>&1 & echo 'Download started, PID: $!'",
        "Starting model download"
    )
    
    if success:
        print("\n[OK] Model download started!")
        print("  Monitor progress: ssh madhujanu@192.168.1.233 'tail -f /tmp/ollama_pull.log'")
        print("  Check status: ssh madhujanu@192.168.1.233 'ollama list'")
    
    print("\n" + "=" * 70)
    print("[OK] Setup Complete!")
    print("=" * 70)
    print("\nNext Steps:")
    print("1. Wait for Qwen3-Coder-30B to finish downloading")
    print("2. Transfer training package")
    print("3. Start fine-tuning")
    print()
    
    return 0

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\n[WARNING] Interrupted by user")
        exit(1)

