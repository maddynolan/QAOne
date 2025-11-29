#!/usr/bin/env python3
"""
Simple script to test DGX Spark GB10 connection
Uses standard libraries only (no paramiko required)
"""

import os
import sys
import subprocess
from pathlib import Path

def get_dgx_connection():
    """Get DGX connection details from environment or prompt"""
    # Try environment variables first
    dgx_host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
    dgx_user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")
    dgx_port = os.getenv("DGX_SSH_PORT", "22")
    dgx_key = os.getenv("DGX_SSH_KEY")
    
    # If not set, prompt
    if not dgx_host:
        print("[WARNING] DGX connection details not found in environment")
        print("Please provide:")
        dgx_host = input("DGX Spark GB10 Hostname/IP: ").strip()
        dgx_user = input("DGX Username: ").strip() if not dgx_user else dgx_user
        port_input = input(f"SSH Port (default 22): ").strip()
        dgx_port = port_input if port_input else "22"
    
    return dgx_host, dgx_user, dgx_port, dgx_key

def test_ssh_connection(host, user, port, key_path=None):
    """Test SSH connection using subprocess (no paramiko needed)"""
    print(f"\nTesting SSH connection to {user}@{host}:{port}...")
    
    try:
        # Build SSH command
        ssh_cmd = ["ssh"]
        
        if key_path and os.path.exists(key_path):
            ssh_cmd.extend(["-i", key_path])
        
        ssh_cmd.extend([
            "-p", str(port),
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{user}@{host}",
            "echo 'SSH connection successful' && hostname && whoami"
        ])
        
        # Run SSH command
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode == 0:
            print(f"  [OK] SSH connection successful!")
            output = result.stdout.strip()
            if output:
                print(f"  Server info:")
                for line in output.split('\n'):
                    if line:
                        print(f"     {line}")
            return True
        else:
            print(f"  [ERROR] Connection failed")
            if result.stderr:
                print(f"  Error: {result.stderr.strip()}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"  [ERROR] Connection timeout")
        return False
    except FileNotFoundError:
        print(f"  [ERROR] SSH command not found")
        print(f"  Make sure SSH is installed and in PATH")
        return False
    except Exception as e:
        print(f"  [ERROR] Connection failed: {e}")
        return False

def check_gpu(host, user, port, key_path=None):
    """Check GPU information on DGX"""
    print(f"\nChecking GPU on DGX...")
    
    try:
        ssh_cmd = ["ssh"]
        
        if key_path and os.path.exists(key_path):
            ssh_cmd.extend(["-i", key_path])
        
        ssh_cmd.extend([
            "-p", str(port),
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{user}@{host}",
            "nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader 2>/dev/null || echo 'nvidia-smi not available'"
        ])
        
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode == 0 and "nvidia-smi" not in result.stdout:
            print(f"  [OK] GPU Information:")
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    print(f"     {line.strip()}")
        else:
            print(f"  [WARNING] Could not get GPU info (nvidia-smi may not be available)")
            
    except Exception as e:
        print(f"  [WARNING] Could not check GPU: {e}")

def check_ollama(host, user, port, key_path=None):
    """Check if Ollama is installed and what models are available"""
    print(f"\nChecking Ollama on DGX...")
    
    try:
        ssh_cmd = ["ssh"]
        
        if key_path and os.path.exists(key_path):
            ssh_cmd.extend(["-i", key_path])
        
        ssh_cmd.extend([
            "-p", str(port),
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{user}@{host}",
            "ollama list 2>/dev/null || echo 'Ollama not installed'"
        ])
        
        result = subprocess.run(
            ssh_cmd,
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode == 0:
            output = result.stdout.strip()
            if "not installed" in output.lower():
                print(f"  [WARNING] Ollama is not installed")
            else:
                print(f"  [OK] Ollama is installed")
                if output:
                    print(f"  Installed models:")
                    for line in output.split('\n')[1:]:  # Skip header
                        if line.strip():
                            print(f"     {line.strip()}")
        else:
            print(f"  [WARNING] Could not check Ollama")
            
    except Exception as e:
        print(f"  [WARNING] Could not check Ollama: {e}")

def main():
    print("=" * 70)
    print("DGX Spark GB10 Connection Test")
    print("=" * 70)
    
    # Get connection details
    host, user, port, key = get_dgx_connection()
    
    if not host or not user:
        print("\n[ERROR] Missing DGX connection details")
        print("Set environment variables:")
        print("   $env:DGX_HOST = 'your-dgx-ip'")
        print("   $env:DGX_USER = 'your-username'")
        return 1
    
    print(f"\nConnection Details:")
    print(f"  Host: {host}")
    print(f"  User: {user}")
    print(f"  Port: {port}")
    if key:
        print(f"  SSH Key: {key}")
    print()
    
    # Test connection
    if not test_ssh_connection(host, user, port, key):
        print("\n[ERROR] Cannot connect to DGX Spark GB10")
        print("\nTroubleshooting:")
        print("   1. Check if DGX is accessible: ping " + host)
        print("   2. Verify SSH port (usually 22)")
        print("   3. Check username is correct")
        print("   4. Ensure SSH key is set up (if using key auth)")
        return 1
    
    # Check GPU
    check_gpu(host, user, port, key)
    
    # Check Ollama
    check_ollama(host, user, port, key)
    
    print("\n" + "=" * 70)
    print("[OK] Connection Test Complete!")
    print("=" * 70)
    print("\nNext Steps:")
    print("   1. Install Qwen3-Coder-30B: ollama pull Qwen/Qwen3-Coder-30B-Instruct")
    print("   2. Transfer training package")
    print("   3. Start fine-tuning")
    print()
    
    return 0

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\n[WARNING] Interrupted by user")
        exit(1)

