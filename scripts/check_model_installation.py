#!/usr/bin/env python3
"""
Check if Qwen Coder 3 30B is installed on DGX
Shows where model is located (HuggingFace cache or local)
"""

import argparse
import paramiko
import os

def check_model_on_dgx(dgx_host: str, dgx_user: str, dgx_port: int = 22):
    """Check model installation status on DGX"""
    
    print("=" * 70)
    print("Checking Qwen Coder 3 30B Installation on DGX")
    print("=" * 70)
    print(f"Host: {dgx_host}")
    print(f"User: {dgx_user}")
    print("=" * 70)
    print()
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        client.connect(dgx_host, port=dgx_port, username=dgx_user, timeout=30)
        print("[OK] Connected to DGX")
        print()
    except Exception as e:
        print(f"❌ Failed to connect: {e}")
        return
    
    # Check HuggingFace cache
    print("Checking HuggingFace cache...")
    cache_dir = "~/.cache/huggingface/hub"
    stdin, stdout, stderr = client.exec_command(f"find {cache_dir} -name '*Qwen*Coder*30B*' -type d 2>/dev/null | head -5")
    cache_results = stdout.read().decode('utf-8').strip()
    
    if cache_results:
        print("  [OK] Model found in HuggingFace cache:")
        for line in cache_results.split('\n'):
            if line.strip():
                print(f"     {line}")
        
        # Get size
        stdin, stdout, stderr = client.exec_command(f"du -sh {cache_dir} 2>/dev/null | head -1")
        cache_size = stdout.read().decode('utf-8').strip()
        if cache_size:
            print(f"  📊 Cache size: {cache_size}")
    else:
        print("  [WARN] Model not found in HuggingFace cache")
        print("     (Will download automatically during first training run)")
    
    print()
    
    # Check local model directories
    print("Checking local model directories...")
    local_dirs = [
        "~/models/Qwen3-Coder-30B-Instruct",
        "~/models/Qwen/Qwen3-Coder-30B-Instruct",
        "/models/Qwen3-Coder-30B-Instruct",
    ]
    
    found_local = False
    for model_dir in local_dirs:
        stdin, stdout, stderr = client.exec_command(f"test -d {model_dir} && echo 'exists' || echo 'not found'")
        result = stdout.read().decode('utf-8').strip()
        if result == "exists":
            print(f"  [OK] Found: {model_dir}")
            stdin, stdout, stderr = client.exec_command(f"du -sh {model_dir} 2>/dev/null")
            size = stdout.read().decode('utf-8').strip()
            if size:
                print(f"     Size: {size}")
            found_local = True
    
    if not found_local:
        print("  [WARN] No local model directory found")
        print("     (Model will download from HuggingFace during training)")
    
    print()
    
    # Check Docker images
    print("Checking Docker images...")
    stdin, stdout, stderr = client.exec_command("docker images | grep -i qwen || echo 'No Qwen images found'")
    docker_images = stdout.read().decode('utf-8').strip()
    print(f"  {docker_images}")
    
    print()
    
    # Summary
    print("=" * 70)
    print("📊 Summary")
    print("=" * 70)
    
    if cache_results:
        print("[OK] Model is available in HuggingFace cache")
        print("   Training will use cached model (fast)")
    else:
        print("[WARN] Model not in cache")
        print("   Training will download from HuggingFace (~60GB, ~10-30 min)")
        print("   This happens automatically - no action needed")
    
    print()
    print("Recommendation:")
    if cache_results:
        print("   [OK] Ready to train! Model is cached.")
    else:
        print("   [OK] Ready to train! Model will download automatically.")
        print("   Optional: Pre-download to avoid delay:")
        print("      ssh {}@{} 'python3 -c \"from transformers import AutoModelForCausalLM; AutoModelForCausalLM.from_pretrained(\\\"Qwen/Qwen3-Coder-30B-Instruct\\\")\"'".format(dgx_user, dgx_host))
    
    print("=" * 70)
    
    client.close()

def main():
    parser = argparse.ArgumentParser(description="Check model installation on DGX")
    parser.add_argument("--dgx-host", default="spark-d435.local", help="DGX hostname")
    parser.add_argument("--dgx-user", default="madhujanu", help="DGX username")
    parser.add_argument("--dgx-port", type=int, default=22, help="DGX SSH port")
    
    args = parser.parse_args()
    
    check_model_on_dgx(args.dgx_host, args.dgx_user, args.dgx_port)

if __name__ == "__main__":
    main()

