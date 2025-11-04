#!/usr/bin/env python3
"""
Test script to verify connection to remote Ollama on DGX Sparx
"""

import os
import sys
import requests

def test_connection(dgx_url: str):
    """Test connection to remote Ollama instance"""
    print("=" * 60)
    print("Testing DGX Ollama Connection")
    print("=" * 60)
    print(f"Target URL: {dgx_url}")
    print()
    
    # Test 1: Basic connectivity
    print("[1/3] Testing basic connectivity...")
    try:
        response = requests.get(f"{dgx_url}/api/tags", timeout=10)
        if response.ok:
            print("  ✅ Connected successfully!")
        else:
            print(f"  ❌ Connection failed: HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("  ❌ Connection refused - Cannot reach DGX server")
        print(f"     Check: Is DGX IP correct? Is Ollama running?")
        return False
    except requests.exceptions.Timeout:
        print("  ❌ Connection timeout - Server not responding")
        print(f"     Check: Is network connection stable?")
        return False
    except Exception as e:
        print(f"  ❌ Error: {str(e)}")
        return False
    
    # Test 2: List available models
    print("\n[2/3] Listing available models...")
    try:
        response = requests.get(f"{dgx_url}/api/tags", timeout=10)
        if response.ok:
            data = response.json()
            models = data.get("models", [])
            if models:
                print(f"  ✅ Found {len(models)} model(s):")
                for model in models:
                    name = model.get("name", "Unknown")
                    size = model.get("size", 0)
                    size_gb = size / (1024**3) if size > 0 else 0
                    print(f"     - {name} ({size_gb:.2f} GB)")
            else:
                print("  ⚠️  No models found on DGX")
                print("     Run: ollama pull qwen2.5-coder:14b (on DGX)")
        else:
            print(f"  ❌ Failed to list models: HTTP {response.status_code}")
    except Exception as e:
        print(f"  ❌ Error listing models: {str(e)}")
    
    # Test 3: Try a simple generation
    print("\n[3/3] Testing model generation...")
    try:
        # Get first available model
        response = requests.get(f"{dgx_url}/api/tags", timeout=10)
        if response.ok:
            models = response.json().get("models", [])
            if models:
                test_model = models[0].get("name", "qwen2.5:7b-instruct")
                print(f"  Using model: {test_model}")
                
                payload = {
                    "model": test_model,
                    "prompt": "Say 'Hello from DGX' in JSON format.",
                    "stream": False
                }
                
                response = requests.post(
                    f"{dgx_url}/api/generate",
                    json=payload,
                    timeout=30
                )
                
                if response.ok:
                    data = response.json()
                    result = data.get("response", "")
                    print(f"  ✅ Generation successful!")
                    print(f"  Response: {result[:100]}...")
                else:
                    print(f"  ⚠️  Generation test failed: HTTP {response.status_code}")
            else:
                print("  ⚠️  Skipping generation test (no models available)")
    except Exception as e:
        print(f"  ⚠️  Generation test error: {str(e)}")
    
    print("\n" + "=" * 60)
    print("Connection Test Complete")
    print("=" * 60)
    print("\nNext steps:")
    print("1. If connection works, set OLLAMA_URL environment variable")
    print("2. Update backend/.env file with DGX URL")
    print("3. Restart backend server")
    print("4. Test test generation via API")
    
    return True


def main():
    """Main function"""
    # Get URL from command line or environment
    if len(sys.argv) > 1:
        dgx_url = sys.argv[1]
    else:
        dgx_url = os.getenv("OLLAMA_URL", "http://localhost:31143")  # Default to tunnel
        if dgx_url == "http://localhost:31143":
            print("Testing tunnel connection at: http://localhost:31143")
            print("\nIf using different tunnel port, specify:")
            print("  python test_dgx_connection.py http://localhost:PORT")
            print("\nOr set OLLAMA_URL environment variable:")
            print("  $env:OLLAMA_URL = 'http://localhost:31143'")
            print("  python test_dgx_connection.py")
    
    # Validate URL format
    if not dgx_url.startswith("http://") and not dgx_url.startswith("https://"):
        dgx_url = f"http://{dgx_url}"
    
    if ":11434" not in dgx_url and ":" not in dgx_url.split("//")[1]:
        dgx_url = f"{dgx_url}:11434"
    
    test_connection(dgx_url)


if __name__ == "__main__":
    main()

