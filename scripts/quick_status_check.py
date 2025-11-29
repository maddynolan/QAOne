#!/usr/bin/env python3
"""
Quick status check - No SSH needed, checks local indicators
"""

import os
import subprocess
from pathlib import Path

print("=" * 70)
print("📊 TRAINING STATUS CHECK")
print("=" * 70)
print("")

# Check 1: Local package
package_dir = Path("dgx_training_package")
if package_dir.exists():
    print("✅ Training package ready locally")
    print(f"   Location: {package_dir.absolute()}")
    print(f"   Size: {sum(f.stat().st_size for f in package_dir.rglob('*') if f.is_file()) / 1024 / 1024:.1f} MB")
else:
    print("❌ Training package not found locally")

print("")

# Check 2: Training data
train_file = Path("data/train.jsonl")
val_file = Path("data/val.jsonl")
if train_file.exists() and val_file.exists():
    print("✅ Training data ready")
    print(f"   Train: {train_file} ({train_file.stat().st_size / 1024 / 1024:.1f} MB)")
    print(f"   Val: {val_file} ({val_file.stat().st_size / 1024 / 1024:.1f} MB)")
else:
    print("⚠️  Training data not found locally")

print("")

# Check 3: Try to detect DGX connection
print("🔍 Checking DGX connection...")
dgx_host = os.getenv("DGX_HOST") or os.getenv("DGX_IP")
dgx_user = os.getenv("DGX_USER") or os.getenv("DGX_USERNAME")

if dgx_host and dgx_user:
    print(f"  ✅ DGX connection details found:")
    print(f"     Host: {dgx_host}")
    print(f"     User: {dgx_user}")
    print(f"     Port: {os.getenv('DGX_SSH_PORT', '22')}")
    print("")
    print("  💡 To check if training is running:")
    print(f"     ssh {dgx_user}@{dgx_host} 'ps aux | grep train_lora'")
    print(f"     ssh {dgx_user}@{dgx_host} 'tail -f ~/qa_finetuning/training.log'")
else:
    print("  ⚠️  DGX connection details not set")
    print("  💡 Set environment variables:")
    print("     $env:DGX_HOST = 'your-dgx-ip'")
    print("     $env:DGX_USER = 'your-username'")

print("")

# Check 4: Ollama tunnel
print("🔍 Checking Ollama tunnel (port 31143)...")
try:
    import requests
    response = requests.get("http://localhost:31143/api/tags", timeout=5)
    if response.ok:
        models = response.json().get("models", [])
        print(f"  ✅ Ollama tunnel active on localhost:31143")
        print(f"     Found {len(models)} model(s)")
        for model in models[:3]:
            print(f"       - {model.get('name', 'unknown')}")
    else:
        print("  ⚠️  Tunnel not responding")
except:
    print("  ⚠️  Cannot connect to tunnel (may not be active)")

print("")

# Summary
print("=" * 70)
print("📋 SUMMARY")
print("=" * 70)
print("")
print("Training Status: NOT STARTED YET")
print("")
print("Reason: Need to connect to DGX Spark via SSH to start training")
print("")
print("To Start Training:")
print("  1. Provide DGX connection details (host, user, SSH port)")
print("  2. Run: python scripts/start_and_monitor_training.py")
print("  3. Or manually:")
print("     - scp -r dgx_training_package user@dgx:~/qa_finetuning/")
print("     - ssh user@dgx 'cd ~/qa_finetuning/dgx_training_package && bash auto_setup_and_train.sh'")
print("")
print("=" * 70)


