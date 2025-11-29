#!/usr/bin/env python3
"""
Check and load 7B model on Spark DGX via SSH tunnel
Run this after establishing SSH tunnel: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local
"""

import asyncio
import aiohttp
import json
import sys

OLLAMA_URL = "http://localhost:31143"  # SSH tunnel port
TARGET_MODEL = "qwen2.5-coder:7b"  # The 7B model we need

async def check_models():
    """Check what models are available on Spark"""
    print("=" * 60)
    print("Checking Models on Spark DGX (via SSH tunnel)")
    print("=" * 60)
    print(f"\nConnecting to: {OLLAMA_URL}")
    print("(Make sure SSH tunnel is running: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local)\n")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Check available models
            async with session.get(f"{OLLAMA_URL}/api/tags", timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status == 200:
                    data = await response.json()
                    models = data.get("models", [])
                    
                    print(f"✅ Connected to Spark DGX!")
                    print(f"\nAvailable models ({len(models)}):")
                    print("-" * 60)
                    
                    has_7b = False
                    has_30b = False
                    
                    for model in models:
                        model_name = model.get("name", "unknown")
                        size = model.get("size", 0)
                        size_gb = size / (1024**3) if size > 0 else 0
                        modified = model.get("modified_at", "")
                        
                        # Check for 7B model
                        if "7b" in model_name.lower() or "7B" in model_name.lower():
                            has_7b = True
                            print(f"  ✅ {model_name} ({size_gb:.2f} GB) - {modified[:19] if modified else 'N/A'}")
                        # Check for 30B model
                        elif "30b" in model_name.lower() or "30B" in model_name.lower():
                            has_30b = True
                            print(f"  ✅ {model_name} ({size_gb:.2f} GB) - {modified[:19] if modified else 'N/A'}")
                        else:
                            print(f"  - {model_name} ({size_gb:.2f} GB) - {modified[:19] if modified else 'N/A'}")
                    
                    print("-" * 60)
                    
                    # Check specifically for qwen2.5-coder:7b
                    target_found = any(TARGET_MODEL in m.get("name", "") for m in models)
                    
                    if target_found:
                        print(f"\n✅ {TARGET_MODEL} is already loaded!")
                        return True
                    else:
                        print(f"\n❌ {TARGET_MODEL} is NOT loaded")
                        if has_7b:
                            print(f"   (Found other 7B models, but not {TARGET_MODEL})")
                        return False
                else:
                    print(f"❌ Ollama returned status {response.status}")
                    return False
                    
    except asyncio.TimeoutError:
        print("❌ Connection timeout")
        print("\n⚠️  Make sure:")
        print("   1. SSH tunnel is running: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local")
        print("   2. Ollama is running on Spark DGX")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print("\n⚠️  Make sure SSH tunnel is active:")
        print("   ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local")
        return False

async def load_7b_model():
    """Load the 7B model on Spark"""
    print("\n" + "=" * 60)
    print(f"Loading {TARGET_MODEL} on Spark DGX")
    print("=" * 60)
    print("\n⚠️  This will download the model if not already present.")
    print("    This may take several minutes depending on network speed...\n")
    
    try:
        async with aiohttp.ClientSession() as session:
            # Start pull request
            pull_data = {
                "name": TARGET_MODEL
            }
            
            print(f"Requesting model pull: {TARGET_MODEL}")
            print("(This may take a while - model is ~4-5 GB)...\n")
            
            async with session.post(
                f"{OLLAMA_URL}/api/pull",
                json=pull_data,
                timeout=aiohttp.ClientTimeout(total=600)  # 10 minute timeout
            ) as response:
                if response.status == 200:
                    # Stream the response
                    async for line in response.content:
                        if line:
                            try:
                                data = json.loads(line)
                                status = data.get("status", "")
                                if status:
                                    print(f"  {status}", end="\r")
                            except:
                                pass
                    
                    print("\n\n✅ Model pull completed!")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Failed to pull model: {response.status}")
                    print(f"   Error: {error_text[:200]}")
                    return False
                    
    except asyncio.TimeoutError:
        print("\n❌ Timeout - model pull took too long")
        print("   The model may still be downloading in the background")
        return False
    except Exception as e:
        print(f"\n❌ Error loading model: {str(e)}")
        return False

async def main():
    """Main function"""
    # Check if model exists
    model_exists = await check_models()
    
    if not model_exists:
        print("\n" + "=" * 60)
        response = input(f"\nDo you want to load {TARGET_MODEL} now? (y/n): ").strip().lower()
        
        if response == 'y' or response == 'yes':
            success = await load_7b_model()
            if success:
                print("\n✅ Model loaded successfully!")
                print(f"   You can now use {TARGET_MODEL} for faster test case generation")
            else:
                print("\n❌ Failed to load model")
                print("   You may need to load it manually on Spark:")
                print(f"   ssh madhujanu@spark-d435.local")
                print(f"   ollama pull {TARGET_MODEL}")
        else:
            print("\n⚠️  Model not loaded. To load it manually:")
            print(f"   ssh madhujanu@spark-d435.local")
            print(f"   ollama pull {TARGET_MODEL}")
    else:
        print("\n✅ All set! The 7B model is ready to use.")
        print("   Flowstral will automatically use it for faster test case generation.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(1)

