#!/usr/bin/env python3
"""
Auto-connect to DGX Spark and run training
Handles SSH connection, file transfer, and training execution
"""

import os
import sys
import subprocess
import paramiko
from pathlib import Path
from scp import SCPClient

def get_dgx_connection():
    """Get DGX connection details from environment or prompt"""
    # Try environment variables first
    dgx_host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
    dgx_user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")
    dgx_port = int(os.getenv("DGX_SSH_PORT", "22"))
    dgx_key = os.getenv("DGX_SSH_KEY")
    
    # If not set, try to detect from common patterns
    if not dgx_host:
        # Check if port 31143 tunnel suggests localhost
        # But we need the actual DGX hostname
        print("⚠️  DGX connection details not found in environment")
        print("Please provide:")
        dgx_host = input("DGX Host/IP: ").strip()
        dgx_user = input("DGX Username: ").strip() if not dgx_user else dgx_user
        port_input = input(f"SSH Port (default 22): ").strip()
        dgx_port = int(port_input) if port_input else 22
    
    return dgx_host, dgx_user, dgx_port, dgx_key

def test_ssh_connection(host, user, port, key_path=None):
    """Test SSH connection to DGX"""
    print(f"\n🔌 Testing SSH connection to {user}@{host}:{port}...")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if key_path and os.path.exists(key_path):
            ssh.connect(host, port=port, username=user, key_filename=key_path, timeout=10)
        else:
            # Try password or default key
            ssh.connect(host, port=port, username=user, timeout=10)
        
        # Test connection
        stdin, stdout, stderr = ssh.exec_command("echo 'Connection successful'")
        result = stdout.read().decode().strip()
        
        if "successful" in result.lower():
            print(f"  ✅ SSH connection successful!")
            ssh.close()
            return True
        else:
            print(f"  ⚠️  Connection test: {result}")
            ssh.close()
            return True  # Still connected
    except paramiko.AuthenticationException:
        print(f"  ❌ Authentication failed")
        print(f"  💡 Check username and SSH key/password")
        return False
    except paramiko.SSHException as e:
        print(f"  ❌ SSH error: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        return False

def transfer_package(host, user, port, key_path=None):
    """Transfer training package to DGX"""
    print(f"\n📤 Transferring package to {user}@{host}:{port}...")
    
    package_dir = Path("dgx_training_package")
    if not package_dir.exists():
        print(f"  ❌ Package directory not found: {package_dir}")
        return False
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if key_path and os.path.exists(key_path):
            ssh.connect(host, port=port, username=user, key_filename=key_path, timeout=30)
        else:
            ssh.connect(host, port=port, username=user, timeout=30)
        
        # Create remote directory
        ssh.exec_command("mkdir -p ~/qa_finetuning")
        
        # Transfer files
        with SCPClient(ssh.get_transport()) as scp:
            print(f"  📦 Transferring {package_dir}...")
            scp.put(str(package_dir), remote_path="~/qa_finetuning/", recursive=True)
        
        print(f"  ✅ Package transferred successfully!")
        ssh.close()
        return True
    except Exception as e:
        print(f"  ❌ Transfer failed: {e}")
        return False

def run_training(host, user, port, key_path=None):
    """Run training script on DGX"""
    print(f"\n🚀 Starting training on {user}@{host}:{port}...")
    
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        if key_path and os.path.exists(key_path):
            ssh.connect(host, port=port, username=user, key_filename=key_path, timeout=30)
        else:
            ssh.connect(host, port=port, username=user, timeout=30)
        
        # Make script executable
        ssh.exec_command("chmod +x ~/qa_finetuning/dgx_training_package/auto_setup_and_train.sh")
        
        # Run training in background with nohup
        cmd = "cd ~/qa_finetuning/dgx_training_package && nohup bash auto_setup_and_train.sh > ../training.log 2>&1 & echo $!"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        pid = stdout.read().decode().strip()
        
        if pid:
            print(f"  ✅ Training started! PID: {pid}")
            print(f"  📊 Monitor with: ssh {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
            return True, pid
        else:
            error = stderr.read().decode()
            print(f"  ❌ Failed to start: {error}")
            return False, None
            
    except Exception as e:
        print(f"  ❌ Failed to start training: {e}")
        return False, None

def main():
    print("=" * 70)
    print("🚀 AUTOMATED DGX SPARK TRAINING")
    print("=" * 70)
    
    # Get connection details
    host, user, port, key = get_dgx_connection()
    
    if not host or not user:
        print("❌ Missing DGX connection details")
        print("💡 Set environment variables: DGX_HOST, DGX_USER")
        return 1
    
    print(f"\n📋 Connection Details:")
    print(f"  Host: {host}")
    print(f"  User: {user}")
    print(f"  Port: {port}")
    
    # Test connection
    if not test_ssh_connection(host, user, port, key):
        print("\n❌ Cannot connect to DGX Spark")
        return 1
    
    # Transfer package
    if not transfer_package(host, user, port, key):
        print("\n❌ Package transfer failed")
        return 1
    
    # Run training
    success, pid = run_training(host, user, port, key)
    
    if success:
        print("\n" + "=" * 70)
        print("✅ TRAINING STARTED!")
        print("=" * 70)
        print(f"\n📊 Monitor Progress:")
        print(f"  ssh {user}@{host} 'tail -f ~/qa_finetuning/training.log'")
        print(f"\n📁 Check Results:")
        print(f"  ssh {user}@{host} 'ls -lh ~/qa_finetuning/outputs/'")
        print(f"\n⏱️  Expected time: 3-5 hours")
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
    except ImportError:
        print("\n❌ Missing dependencies")
        print("💡 Install: pip install paramiko scp")
        exit(1)


