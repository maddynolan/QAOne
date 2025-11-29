#!/usr/bin/env python3
"""Load 7B model on Spark DGX via SSH tunnel"""

import requests
import json
import sys

OLLAMA_URL = "http://localhost:31143"
MODEL_NAME = "qwen2.5-coder:7b"

print("=" * 60)
print(f"Loading {MODEL_NAME} on Spark DGX")
print("=" * 60)
print("\n⚠️  This will download the model (~4-5 GB)")
print("    This may take several minutes...\n")

try:
    response = requests.post(
        f"{OLLAMA_URL}/api/pull",
        json={"name": MODEL_NAME},
        stream=True,
        timeout=600
    )
    
    if response.status_code == 200:
        print("Downloading model...\n")
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    status = data.get("status", "")
                    if status:
                        print(f"  {status}", end="\r", flush=True)
                except:
                    pass
        print("\n\n✅ Model loaded successfully!")
        print(f"   {MODEL_NAME} is now available on Spark DGX")
    else:
        print(f"❌ Failed to load model: HTTP {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        sys.exit(1)
        
except requests.exceptions.ConnectionError:
    print("❌ Connection failed!")
    print("\n⚠️  Make sure SSH tunnel is running:")
    print("   ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)

