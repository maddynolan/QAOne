#!/usr/bin/env python3
"""
Quick test to verify backend is working after asyncio fix
"""

import requests
import json

BASE_URL = "http://localhost:8001"

print("=" * 70)
print("🧪 TESTING BACKEND AFTER FIX")
print("=" * 70)

# Test 1: Health check
print("\n[1/3] Testing health endpoint...")
try:
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    if response.ok:
        print("  ✅ Backend is reachable")
    else:
        print(f"  ❌ Health check failed: {response.status_code}")
        exit(1)
except Exception as e:
    print(f"  ❌ Backend not reachable: {e}")
    exit(1)

# Test 2: Single request
print("\n[2/3] Testing single test generation request...")
payload = {
    "org_id": "00000000-0000-0000-0000-000000000000",
    "project_id": "11111111-1111-1111-1111-111111111111",
    "requirement": "User login functionality",
    "test_type": "manual",
    "mode": "quick"  # Use 7B for speed
}

try:
    print("  ⏳ Sending request (this may take 1-2 minutes)...")
    response = requests.post(
        f"{BASE_URL}/ai/generate-tests-enhanced",
        json=payload,
        timeout=300
    )
    
    if response.ok:
        result = response.json()
        test_cases = result.get("test_cases", [])
        generation_id = result.get("generation_id")
        model = result.get("model", "unknown")
        
        print(f"  ✅ Request successful!")
        print(f"     Model: {model}")
        print(f"     Generation ID: {generation_id[:8] if generation_id else 'N/A'}...")
        print(f"     Test cases: {len(test_cases)}")
        
        if test_cases:
            print(f"     First test: {test_cases[0].get('name', 'N/A')[:50]}...")
    else:
        print(f"  ❌ Request failed: {response.status_code}")
        print(f"     Error: {response.text[:200]}")
        exit(1)
        
except requests.exceptions.Timeout:
    print("  ❌ Request timed out")
    exit(1)
except Exception as e:
    print(f"  ❌ Error: {e}")
    exit(1)

# Test 3: Verify no asyncio errors
print("\n[3/3] Verifying no asyncio errors...")
if response.ok:
    print("  ✅ No asyncio errors detected")
    print("  ✅ Backend is working correctly!")
else:
    print("  ❌ Request failed - check error above")

print("\n" + "=" * 70)
print("✅ BACKEND TEST COMPLETE")
print("=" * 70)
print("\n💡 If all tests passed, you can proceed with data collection:")
print("   python scripts/optimized_data_collection.py --target 500 --delay 10")

