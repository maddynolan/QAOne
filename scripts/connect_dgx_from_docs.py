#!/usr/bin/env python3
"""
Connect to DGX Spark GB10 using hostname from docs/DGX_REMOTE_SETUP.md
The document mentions "dgx-sparx" as the hostname
"""

import os
import sys
import subprocess

# From docs/DGX_REMOTE_SETUP.md line 38: ssh -L 31143:localhost:11434 user@dgx-sparx
DGX_HOSTNAME = "dgx-sparx"  # From setup document
DGX_SSH_PORT = "22"

def get_username():
    """Get username from environment or common defaults"""
    username = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")
    
    # Try common usernames if not set
    if not username:
        common_users = ["ubuntu", "user", "admin", "dgx", "spark"]
        print(f"Trying to connect to {DGX_HOSTNAME}...")
        print("Please provide username or it will try common defaults")
        username = input("DGX Username (or press Enter to try defaults): ").strip()
        
        if not username:
            # Try common usernames
            for user in common_users:
                print(f"Trying username: {user}")
                if test_connection(DGX_HOSTNAME, user, DGX_SSH_PORT):
                    return user
            return None
    
    return username

def test_connection(host, user, port):
    """Test SSH connection"""
    print(f"\nTesting SSH connection to {user}@{host}:{port}...")
    
    try:
        ssh_cmd = ["ssh"]
        ssh_cmd.extend([
            "-p", str(port),
            "-o", "ConnectTimeout=10",
            "-o", "StrictHostKeyChecking=no",
            f"{user}@{host}",
            "echo 'Connection successful' && hostname && whoami && hostname -I 2>/dev/null || ip addr show | grep 'inet ' | head -1"
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
                print(f"  Server Information:")
                for line in output.split('\n'):
                    if line.strip():
                        print(f"    {line.strip()}")
            return True
        else:
            if result.stderr:
                print(f"  Error: {result.stderr.strip()}")
            return False
            
    except Exception as e:
        print(f"  Connection failed: {e}")
        return False

def main():
    print("=" * 70)
    print("Connecting to DGX Spark GB10")
    print("=" * 70)
    print(f"\nUsing hostname from docs/DGX_REMOTE_SETUP.md: {DGX_HOSTNAME}")
    print(f"SSH Port: {DGX_SSH_PORT}")
    
    # Get username
    username = get_username()
    if not username:
        print("\n[ERROR] Could not determine username")
        print("Please set environment variable: $env:DGX_USER = 'your-username'")
        return 1
    
    print(f"\nConnection Details:")
    print(f"  Hostname: {DGX_HOSTNAME}")
    print(f"  Username: {username}")
    print(f"  Port: {DGX_SSH_PORT}")
    print()
    
    # Test connection
    if test_connection(DGX_HOSTNAME, username, DGX_SSH_PORT):
        print("\n" + "=" * 70)
        print("[OK] Connection Established to DGX Spark GB10!")
        print("=" * 70)
        print("\nNext Steps:")
        print("1. Install Qwen3-Coder-30B")
        print("2. Transfer training package")
        print("3. Start fine-tuning")
        return 0
    else:
        print("\n[ERROR] Connection Failed")
        print("\nTroubleshooting:")
        print(f"1. Verify hostname resolves: ping {DGX_HOSTNAME}")
        print(f"2. Check username: {username}")
        print(f"3. Try IP address instead if hostname doesn't work")
        return 1

if __name__ == "__main__":
    try:
        exit(main())
    except KeyboardInterrupt:
        print("\n\nInterrupted")
        exit(1)




