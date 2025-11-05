#!/usr/bin/env python3
"""
Quick script to verify DGX connection and check if backend is using it
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load .env from backend directory
backend_env = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env)
    print(f"✅ Loaded .env from: {backend_env}")
else:
    print(f"⚠️  No .env file found at: {backend_env}")

ollama_url = os.getenv("OLLAMA_URL", "NOT SET")
print(f"\n📊 OLLAMA_URL: {ollama_url}")

if ollama_url == "NOT SET":
    print("\n❌ PROBLEM: OLLAMA_URL is not set!")
    print("   Backend will default to http://localhost:11434 (your laptop)")
    print("   This means it's NOT using DGX Spark!")
    print("\n💡 Fix: Set OLLAMA_URL in backend/.env file")
    print("   OLLAMA_URL=http://localhost:31143")
    sys.exit(1)

# Test connection
print(f"\n🔍 Testing connection to: {ollama_url}")
try:
    response = requests.get(f"{ollama_url}/api/tags", timeout=5)
    if response.ok:
        models = response.json().get("models", [])
        print(f"✅ Connected! Found {len(models)} models:")
        for model in models:
            name = model.get("name", "unknown")
            size_gb = model.get("size", 0) / (1024**3)
            print(f"   - {name} ({size_gb:.2f} GB)")
        print("\n✅ DGX Spark is accessible!")
        print("\n⚠️  IMPORTANT: Backend must be RESTARTED to use this URL!")
        print("   After restart, check backend logs for:")
        print(f"   'Ollama service initialized with URL: {ollama_url}'")
    else:
        print(f"❌ Connection failed: HTTP {response.status_code}")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

