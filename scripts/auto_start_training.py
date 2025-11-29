#!/usr/bin/env python3
"""
Automated DGX Spark Training - Detects connection and starts training
This script will try to connect to DGX Spark and run training automatically
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def detect_dgx_from_tunnel():
    """Try to detect DGX connection from tunnel setup"""
    # Check if there's an active tunnel
    # Common pattern: ssh -L 31143:localhost:11434 user@host
    print("🔍 Attempting to detect DGX connection...")
    
    # Check if we can connect via tunnel
    try:
        import requests
        response = requests.get("http://localhost:31143/api/tags", timeout=5)
        if response.ok:
            print("  ✅ Ollama tunnel active on localhost:31143")
            # Tunnel is active, but we still need SSH details
            return None
    except:
        pass
    
    return None

def get_dgx_connection():
    """Get DGX connection details"""
    # Try environment variables
    dgx_host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
    dgx_user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME") 
    ssh_port = os.getenv("DGX_SSH_PORT", "22")
    
    # If all env vars are set, use them without prompting
    if dgx_host and dgx_user:
        print(f"\n✅ Using connection details from environment:")
        print(f"   Host: {dgx_host}")
        print(f"   User: {dgx_user}")
        print(f"   Port: {ssh_port}")
        return dgx_host, dgx_user, ssh_port
    
    # Otherwise prompt for missing values
    if not dgx_host:
        print("\n⚠️  DGX connection details needed")
        print("I can see you have a tunnel on port 31143 (Ollama),")
        print("but I need SSH connection details to transfer files and run training.")
        print("\nPlease provide:")
        dgx_host = input("  DGX Hostname/IP: ").strip()
        if not dgx_host:
            print("  ❌ Cannot proceed without DGX hostname/IP")
            return None, None, None
    
    if not dgx_user:
        dgx_user = input("  DGX Username: ").strip()
        if not dgx_user:
            print("  ❌ Cannot proceed without username")
            return None, None, None
    
    if not ssh_port or ssh_port == "22":
        port_input = input(f"  SSH Port (default 22): ").strip()
        ssh_port = port_input if port_input else "22"
    
    return dgx_host, dgx_user, ssh_port

def test_ssh_connection(host, user, port):
    """Test SSH connection"""
    print(f"\n🔌 Testing SSH connection to {user}@{host}:{port}...")
    
    try:
        # Try SSH connection test
        result = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no", 
             "-p", str(port), f"{user}@{host}", "echo 'Connection successful'"],
            capture_output=True,
            timeout=10,
            text=True
        )
        
        if result.returncode == 0:
            print(f"  ✅ SSH connection successful!")
            return True
        else:
            print(f"  ❌ SSH connection failed: {result.stderr}")
            return False
    except FileNotFoundError:
        print(f"  ❌ SSH command not found (install OpenSSH)")
        return False
    except Exception as e:
        print(f"  ❌ Connection error: {e}")
        return False

def transfer_and_run(host, user, port):
    """Transfer package and run training"""
    print(f"\n📤 STEP 1: Transferring package to {user}@{host}:{port}...")
    print(f"   This may take 2-5 minutes...")
    
    package_dir = Path("dgx_training_package")
    if not package_dir.exists():
        print(f"  ❌ Package not found: {package_dir}")
        return False
    
    try:
        # Create directory first if it doesn't exist
        print(f"  🔧 Creating directory on DGX if needed...")
        mkdir_cmd = "mkdir -p ~/qa_finetuning"
        mkdir_result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", mkdir_cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        if mkdir_result.returncode == 0:
            print(f"  ✅ Directory ready")
        else:
            print(f"  ⚠️  Directory creation warning (might already exist)")
        
        # Transfer package with progress
        print(f"  📦 Transferring {package_dir}...")
        print(f"  ⏳ Please wait, this may take 2-5 minutes...")
        
        result = subprocess.run(
            ["scp", "-r", "-P", str(port), "-o", "StrictHostKeyChecking=no",
             str(package_dir), f"{user}@{host}:~/qa_finetuning/"],
            timeout=300  # 5 minutes for transfer
        )
        
        if result.returncode != 0:
            print(f"  ❌ Transfer failed (exit code: {result.returncode})")
            if result.stderr:
                print(f"  Error: {result.stderr}")
            return False
        
        print(f"  ✅ Package transferred successfully!")
        
        # Verify package arrived
        print(f"\n🔍 Verifying package on DGX...")
        verify_cmd = "test -d ~/qa_finetuning/dgx_training_package && echo 'EXISTS' || echo 'NOT_FOUND'"
        verify_result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", verify_cmd],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if "EXISTS" in verify_result.stdout:
            print(f"  ✅ Package verified on DGX")
        else:
            print(f"  ⚠️  Package verification failed")
        
        # Run training
        print(f"\n🚀 STEP 2: Starting training on DGX Spark...")
        print(f"  This will:")
        print(f"    - Setup environment (10-15 min)")
        print(f"    - Install dependencies (5-10 min)")
        print(f"    - Run training (2-4 hours)")
        print(f"  Training will run in background")
        print(f"  Logs will be saved to: ~/qa_finetuning/training.log")
        
        ssh_cmd = f"""cd ~/qa_finetuning/dgx_training_package && 
chmod +x auto_setup_and_train.sh && 
cd ~/qa_finetuning && 
nohup bash dgx_training_package/auto_setup_and_train.sh > training.log 2>&1 & 
echo $! > training.pid && 
echo 'Training started! PID:' && 
cat training.pid"""
        
        print(f"\n  ⏳ Starting training process...")
        result = subprocess.run(
            ["ssh", "-p", str(port), "-o", "StrictHostKeyChecking=no",
             f"{user}@{host}", ssh_cmd],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print(f"\n{result.stdout}")
            print(f"\n" + "="*70)
            print(f"✅ TRAINING STARTED SUCCESSFULLY!")
            print(f"="*70)
            print(f"\n📊 To monitor progress:")
            print(f"   python scripts/quick_training_status.py")
            print(f"\n📋 To view live logs:")
            print(f"   ssh -p {port} {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
            print(f"\n💡 Quick status check:")
            print(f"   python scripts/monitor_training.py --host {host} --user {user} --port {port}")
            print(f"\n" + "="*70)
            return True
        else:
            print(f"  ❌ Failed to start training")
            print(f"  Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 70)
    print("🚀 AUTOMATED DGX SPARK TRAINING")
    print("=" * 70)
    print("")
    
    # Detect or get connection details
    host, user, port = get_dgx_connection()
    
    if not host or not user:
        print("\n❌ Cannot proceed without DGX connection details")
        print("\n💡 Set environment variables:")
        print("  $env:DGX_HOST = 'your-dgx-ip'")
        print("  $env:DGX_USER = 'your-username'")
        print("  $env:DGX_SSH_PORT = '22'")
        return 1
    
    print(f"\n📋 Connection Details:")
    print(f"  Host: {host}")
    print(f"  User: {user}")
    print(f"  Port: {port}")
    print(f"\n⚠️  Note: Port 31143 is for Ollama tunnel (HTTP), not SSH")
    print(f"      SSH typically uses port 22")
    
    # Test connection
    if not test_ssh_connection(host, user, port):
        print("\n❌ Cannot connect to DGX Spark")
        print("💡 Check:")
        print("  - Hostname/IP is correct")
        print("  - SSH port is correct (usually 22, not 31143)")
        print("  - SSH key is configured (if using key auth)")
        print("  - Network connectivity")
        return 1
    
    # Transfer and run
    if transfer_and_run(host, user, port):
        print("\n" + "=" * 70)
        print("✅ TRAINING STARTED ON DGX SPARK!")
        print("=" * 70)
        print("\n⏱️  Expected time: 3-5 hours")
        print("📊 Training will run automatically")
        return 0
    else:
        print("\n❌ Failed to start training")
        return 1

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        exit(1)

