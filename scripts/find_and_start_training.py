#!/usr/bin/env python3
"""
Automatically find DGX and start training
Detects active SSH connections and tries to connect
"""

import subprocess
import sys
import os

def detect_ssh_connections():
    """Detect active SSH connections"""
    print("🔍 Detecting active SSH connections...")
    
    try:
        # Get active SSH connections
        result = subprocess.run(
            ["netstat", "-an"],
            capture_output=True,
            text=True
        )
        
        # Parse SSH connections (port 22)
        hosts = set()
        for line in result.stdout.split('\n'):
            if 'ESTABLISHED' in line and ':22' in line:
                # Extract IP from connection
                parts = line.split()
                if len(parts) >= 2:
                    # Format: TCP local:port remote:port ESTABLISHED
                    remote = parts[2] if len(parts) > 2 else ""
                    if ':' in remote:
                        ip = remote.split(':')[0]
                        if ip and ip != '127.0.0.1' and ip != '::1':
                            hosts.add(ip)
        
        return list(hosts)
    except:
        return []

def test_dgx_connection(host, user="", port=22):
    """Test if this is the DGX by checking for training files or GPU"""
    print(f"\n  Testing {host}...")
    
    # Try common usernames if not provided
    users_to_try = [user] if user else ["ubuntu", "user", "admin", "root", os.getenv("USER", "")]
    
    for test_user in users_to_try:
        if not test_user:
            continue
            
        try:
            # Quick test: check if GPU available
            cmd = "nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo 'NO_GPU'"
            result = subprocess.run(
                ["ssh", "-p", str(port), "-o", "ConnectTimeout=3", "-o", "StrictHostKeyChecking=no",
                 f"{test_user}@{host}", cmd],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0 and "NO_GPU" not in result.stdout and result.stdout.strip():
                print(f"    ✅ Found GPU on {test_user}@{host}: {result.stdout.strip()}")
                return True, test_user, host
        except:
            continue
    
    return False, None, None

def main():
    print("=" * 70)
    print("🔍 AUTO-DETECT DGX AND START TRAINING")
    print("=" * 70)
    print("")
    
    # Detect SSH connections
    hosts = detect_ssh_connections()
    
    if not hosts:
        print("⚠️  No active SSH connections detected")
        print("\nPlease provide DGX connection details:")
        host = input("  DGX Hostname/IP: ").strip()
        user = input("  DGX Username: ").strip()
        port = input("  SSH Port (default 22): ").strip() or "22"
        
        if host and user:
            print(f"\n🚀 Starting training on {user}@{host}:{port}...")
            # Use start_and_monitor script
            os.system(f"python scripts/start_and_monitor_training.py")
        else:
            print("❌ Cannot proceed without connection details")
            return 1
    else:
        print(f"Found {len(hosts)} potential host(s): {', '.join(hosts)}")
        print("\n🔍 Testing which one is DGX Spark...")
        
        # Test each host
        dgx_found = False
        for host in hosts:
            found, user, ip = test_dgx_connection(host)
            if found:
                print(f"\n✅ Found DGX Spark: {user}@{ip}")
                dgx_found = True
                
                # Start training
                print(f"\n🚀 Starting training...")
                os.environ["DGX_HOST"] = ip
                os.environ["DGX_USER"] = user
                os.environ["DGX_SSH_PORT"] = "22"
                
                # Use start_and_monitor script
                os.system(f"python scripts/start_and_monitor_training.py")
                break
        
        if not dgx_found:
            print("\n⚠️  Could not auto-detect DGX")
            print("Please provide connection details manually")
            return 1
    
    return 0

if __name__ == "__main__":
    exit(main())


