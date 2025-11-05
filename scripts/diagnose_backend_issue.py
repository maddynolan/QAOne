#!/usr/bin/env python3
"""
Diagnose backend timeout and connectivity issues
"""

import requests
import time
import json

BASE_URL = "http://localhost:8001"
DGX_URL = "http://localhost:31143"

print("=" * 70)
print("🔍 BACKEND DIAGNOSTIC TOOL")
print("=" * 70)

# Test 1: Basic connectivity
print("\n[1/6] Testing basic backend connectivity...")
try:
    response = requests.get(f"{BASE_URL}/health", timeout=5)
    if response.ok:
        print("  ✅ Backend is reachable")
    else:
        print(f"  ❌ Backend returned error: {response.status_code}")
        exit(1)
except Exception as e:
    print(f"  ❌ Backend NOT reachable: {e}")
    print("  💡 Backend might be crashed or not running")
    exit(1)

# Test 2: Check DGX connectivity
print("\n[2/6] Testing DGX Spark connectivity...")
try:
    response = requests.get(f"{DGX_URL}/api/tags", timeout=5)
    if response.ok:
        models = response.json().get("models", [])
        print(f"  ✅ DGX Spark is reachable ({len(models)} models)")
    else:
        print(f"  ❌ DGX Spark returned error: {response.status_code}")
except Exception as e:
    print(f"  ❌ DGX Spark NOT reachable: {e}")
    print("  💡 Tunnel might be down or DGX unreachable")

# Test 3: Single request timing
print("\n[3/6] Testing single request timing (this will take ~2 minutes)...")
test_payload = {
    "org_id": "00000000-0000-0000-0000-000000000000",
    "project_id": "11111111-1111-1111-1111-111111111111",
    "requirement": "Test user login functionality",
    "test_type": "manual",
    "mode": "ui"
}

start_time = time.time()
try:
    print("  ⏳ Sending request (waiting up to 5 minutes)...")
    response = requests.post(
        f"{BASE_URL}/ai/generate-tests-enhanced",
        json=test_payload,
        timeout=300  # 5 minutes
    )
    elapsed = time.time() - start_time
    
    if response.ok:
        result = response.json()
        latency_ms = result.get("latency_ms", 0)
        print(f"  ✅ Request successful!")
        print(f"     Total time: {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
        print(f"     Backend latency: {latency_ms}ms ({latency_ms/1000:.1f}s)")
        print(f"     Model: {result.get('model', 'unknown')}")
        
        if elapsed > 240:  # > 4 minutes
            print(f"  ⚠️  Request took very long - backend might be overloaded")
        elif elapsed > 180:  # > 3 minutes
            print(f"  ⚠️  Request took longer than expected")
        else:
            print(f"  ✅ Request timing is normal")
    else:
        print(f"  ❌ Request failed: {response.status_code}")
        print(f"     Response: {response.text[:200]}")
        
except requests.exceptions.Timeout:
    elapsed = time.time() - start_time
    print(f"  ❌ Request TIMED OUT after {elapsed:.1f}s")
    print(f"  💡 Backend is taking longer than 5 minutes to respond")
    print(f"  💡 Possible causes:")
    print(f"     - Backend is processing but very slow")
    print(f"     - DGX Spark is overloaded")
    print(f"     - Network issues between backend and DGX")
    print(f"     - Backend is stuck/hung")
    
except requests.exceptions.ConnectionError:
    elapsed = time.time() - start_time
    print(f"  ❌ Connection error after {elapsed:.1f}s")
    print(f"  💡 Backend became unreachable during request")
    print(f"  💡 Possible causes:")
    print(f"     - Backend crashed during processing")
    print(f"     - Backend hung and stopped responding")
    print(f"     - Network connection lost")
    
except Exception as e:
    elapsed = time.time() - start_time
    print(f"  ❌ Error after {elapsed:.1f}s: {e}")

# Test 4: Check concurrent request handling
print("\n[4/6] Testing concurrent request handling...")
print("  ⚠️  This will test if backend can handle multiple requests")
print("  💡 Sending 2 concurrent requests (small test)")

import threading

results = []
errors = []

def make_request(index):
    try:
        payload = {
            "org_id": "00000000-0000-0000-0000-000000000000",
            "project_id": "11111111-1111-1111-1111-111111111111",
            "requirement": f"Test {index}",
            "test_type": "manual",
            "mode": "quick"  # Use 7B for faster response
        }
        start = time.time()
        response = requests.post(
            f"{BASE_URL}/ai/generate-tests-enhanced",
            json=payload,
            timeout=180
        )
        elapsed = time.time() - start
        if response.ok:
            results.append({"index": index, "success": True, "time": elapsed})
        else:
            errors.append({"index": index, "error": response.status_code})
    except Exception as e:
        errors.append({"index": index, "error": str(e)[:100]})

threads = []
for i in range(2):
    t = threading.Thread(target=make_request, args=(i+1,))
    threads.append(t)
    t.start()

for t in threads:
    t.join(timeout=200)

print(f"  ✅ Completed: {len(results)} successful, {len(errors)} errors")
if errors:
    print(f"  ⚠️  Backend may have issues with concurrent requests")
    for err in errors:
        print(f"     Request {err['index']}: {err.get('error', 'unknown')}")

# Test 5: Check backend response to health check during processing
print("\n[5/6] Testing if backend responds to health checks during processing...")
print("  💡 This will show if backend is blocked during long requests")

health_check_results = []

def check_health():
    for i in range(10):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=2)
            health_check_results.append({
                "time": time.time(),
                "status": response.status_code if response.ok else "error"
            })
        except:
            health_check_results.append({
                "time": time.time(),
                "status": "unreachable"
            })
        time.sleep(2)

# Start health check monitoring
import threading
health_thread = threading.Thread(target=check_health)
health_thread.start()

# Make a test request
try:
    test_payload_small = {
        "org_id": "00000000-0000-0000-0000-000000000000",
        "project_id": "11111111-1111-1111-1111-111111111111",
        "requirement": "Quick test",
        "test_type": "manual",
        "mode": "quick"  # Use 7B for faster response
    }
    requests.post(f"{BASE_URL}/ai/generate-tests-enhanced", json=test_payload_small, timeout=120)
except:
    pass

health_thread.join(timeout=25)

unreachable_count = sum(1 for r in health_check_results if r["status"] == "unreachable")
if unreachable_count > 0:
    print(f"  ⚠️  Backend became unreachable {unreachable_count} times during processing")
    print(f"  💡 Backend might be blocking on long requests")
else:
    print(f"  ✅ Backend remained reachable during processing")

# Test 6: Summary and recommendations
print("\n[6/6] Diagnostic Summary")
print("=" * 70)

print("\n📊 Findings:")
if len(results) == 0 and len(errors) > 0:
    print("  ❌ All requests failing - backend may be down or overloaded")
elif unreachable_count > 0:
    print("  ⚠️  Backend becomes unreachable during processing")
    print("  💡 Backend might be blocking/synchronous")
else:
    print("  ✅ Backend appears functional")

print("\n💡 Recommendations:")
print("  1. Check backend logs for errors")
print("  2. Verify DGX Spark is not overloaded")
print("  3. Reduce batch size or increase delays")
print("  4. Consider using 7B model for faster responses")
print("  5. Check if backend has request queue limits")

print("\n" + "=" * 70)

