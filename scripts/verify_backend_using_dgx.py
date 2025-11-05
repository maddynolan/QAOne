#!/usr/bin/env python3
"""
Verify that backend is actually using DGX Spark for inference
"""

import requests
import json
import time

BACKEND_URL = "http://localhost:8001"
DGX_URL = "http://localhost:31143"

print("=" * 70)
print("🔍 VERIFYING BACKEND IS USING DGX SPARK")
print("=" * 70)

# Step 1: Check backend health
print("\n[1/4] Checking backend health...")
try:
    response = requests.get(f"{BACKEND_URL}/health", timeout=5)
    if response.ok:
        print("  ✅ Backend is running")
    else:
        print(f"  ❌ Backend not responding: {response.status_code}")
        exit(1)
except Exception as e:
    print(f"  ❌ Backend not accessible: {e}")
    exit(1)

# Step 2: Check DGX is accessible
print("\n[2/4] Checking DGX Spark connection...")
try:
    response = requests.get(f"{DGX_URL}/api/tags", timeout=5)
    if response.ok:
        models = response.json().get("models", [])
        print(f"  ✅ DGX Spark accessible ({len(models)} models)")
        for model in models:
            print(f"     - {model.get('name', 'unknown')}")
    else:
        print(f"  ❌ DGX Spark not accessible: {response.status_code}")
        exit(1)
except Exception as e:
    print(f"  ❌ DGX Spark not accessible: {e}")
    exit(1)

# Step 3: Make a test request and check what model/URL it uses
print("\n[3/4] Making test generation request...")
print("  This will show which Ollama instance is being used...")

test_payload = {
    "org_id": "00000000-0000-0000-0000-000000000000",
    "project_id": "11111111-1111-1111-1111-111111111111",
    "requirement": "Test user login functionality",
    "test_type": "manual",
    "mode": "ui"
}

start_time = time.time()
try:
    response = requests.post(
        f"{BACKEND_URL}/ai/generate-tests-enhanced",
        json=test_payload,
        timeout=180
    )
    elapsed = time.time() - start_time
    
    if response.ok:
        result = response.json()
        model_used = result.get("model", "unknown")
        latency_ms = result.get("latency_ms", 0)
        
        print(f"  ✅ Request successful!")
        print(f"     Model used: {model_used}")
        print(f"     Latency: {latency_ms}ms")
        print(f"     Elapsed time: {elapsed:.1f}s")
        
        # Check if model name matches DGX models
        if "qwen" in model_used.lower():
            print(f"  ✅ Using Qwen model (likely from DGX Spark)")
        else:
            print(f"  ⚠️  Model name doesn't match expected Qwen models")
        
        # Latency check - DGX should be slower (60-90s for 14B)
        if latency_ms > 50000:  # > 50 seconds
            print(f"  ✅ High latency suggests GPU inference on DGX Spark")
        elif latency_ms < 10000:  # < 10 seconds
            print(f"  ⚠️  Low latency suggests local/CPU inference (not DGX)")
        else:
            print(f"  ⚠️  Medium latency - could be DGX or local")
            
    else:
        print(f"  ❌ Request failed: {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        exit(1)
except Exception as e:
    print(f"  ❌ Request failed: {e}")
    exit(1)

# Step 4: Check backend logs (if possible)
print("\n[4/4] Checking backend configuration...")
print("  💡 Check your backend terminal logs for:")
print("     'Ollama service initialized with URL: http://localhost:31143'")
print("  ✅ If you see that, backend is using DGX Spark")
print("  ❌ If you see 'http://localhost:11434', backend is using local")

print("\n" + "=" * 70)
print("📊 SUMMARY")
print("=" * 70)
print("\n✅ If model is 'qwen2.5-coder:14b' and latency > 50s:")
print("   → Backend IS using DGX Spark ✅")
print("\n⚠️  If latency is < 10s or model is different:")
print("   → Backend might NOT be using DGX Spark")
print("\n💡 Check backend logs to confirm OLLAMA_URL being used!")

