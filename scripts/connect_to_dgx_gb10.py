#!/usr/bin/env python3
"""
Connect to DGX Spark GB10 using details from setup documents
Based on docs/DGX_REMOTE_SETUP.md which mentions "dgx-sparx"
"""

import os
import sys
import subprocess

def get_connection_from_docs():
    """Extract connection details from documentation"""
    # From docs/DGX_REMOTE_SETUP.md, we see "dgx-sparx" mentioned
    # This is likely the hostname for DGX Spark GB10
    
    # Try common hostname patterns
    possible_hostnames = [
        "dgx-sparx",
        "dgx-spark",
        "dgx-spark-gb10",
        "dgx-gb10"
    ]
    
    # Try to get from environment or use defaults
    dgx_host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
    dgx_user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")
    dgx_port = os.getenv("DGX_SSH_PORT", "22")
    
    # If not in env, try to detect from tunnel or use hostname from docs
    if not dgx_host:
        # Check if we can resolve dgx-sparx (from docs)
        for hostname in possible_hostnames:
            try:
                result = subprocess.run(
                    ["ping", "-n", "1", hostname] if sys.platform == "win32" else ["ping", "-c", "1", hostname],
                    capture_output=True,
                    timeout=5
                )
                if result.returncode == 0:
                    dgx_host = hostname
                    print(f"Found hostname: {hostname}")
                    break
            except:
                pass
    
    return dgx_host, dgx_user, dgx_port

def test_connection(host, user, port):
    """Test SSH connection"""
    if not host or not user:
        print("Missing connection details")
        return False
    
    print(f"\nTesting SSH connection to {user}@{host}:{port}...")
    
    try:
        # Build SSH command
        ssh_cmd = ["ssh"]
        ssh_cmd.extend([
            "-p", str(port),
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{user}@{host}",
            "echo 'Connection successful' && hostname && whoami && hostname -I"
        ])
        
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
                print(f"  Server information:")
                for line in output.split('\n'):
                    if line.strip():
                        print(f"    {line.strip()}")
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

def main():
    print("=" * 70)
    print("Connecting to DGX Spark GB10")
    print("=" * 70)
    print("\nUsing connection details from setup documents...")
    
    # Get connection details
    host, user, port = get_connection_from_docs()
    
    # If still missing, prompt
    if not host:
        print("\n[WARNING] Hostname not found in environment or docs")
        print("From docs/DGX_REMOTE_SETUP.md, the hostname appears to be 'dgx-sparx'")
        print("\nPlease provide:")
        host = input("DGX Spark GB10 Hostname/IP (or try 'dgx-sparx'): ").strip()
        if not host:
            host = "dgx-sparx"  # Default from docs
            print(f"Using default from docs: {host}")
    
    if not user:
        user = input("DGX Username: ").strip()
        if not user:
            print("[ERROR] Username required")
            return 1
    
    print(f"\nConnection Details:")
    print(f"  Host: {host}")
    print(f"  User: {user}")
    print(f"  Port: {port}")
    print()
    
    # Test connection
    if test_connection(host, user, port):
        print("\n" + "=" * 70)
        print("[OK] Connection Established!")
        print("=" * 70)
        print("\nNext Steps:")
        print("1. Install Qwen3-Coder-30B: ollama pull Qwen/Qwen3-Coder-30B-Instruct")
        print("2. Transfer training package")
        print("3. Start fine-tuning")
        return 0
    else:
        print("\n" + "=" * 70)
        print("[ERROR] Connection Failed")
        print("=" * 70)
        print("\nTroubleshooting:")
        print(f"1. Verify hostname/IP: {host}")
        print(f"2. Check username: {user}")
        print(f"3. Test connectivity: ping {host}")
        print(f"4. Check SSH port: {port}")
        return 1

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        exit(1)




