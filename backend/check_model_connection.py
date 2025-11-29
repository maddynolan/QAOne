#!/usr/bin/env python3
"""
Check which AI model is being used and verify Ollama connection
"""

import os
import sys
import asyncio
import aiohttp
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def check_ollama_connection():
    """Check if Ollama is accessible and which models are available"""
    ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qa-expert:7b")
    use_finetuned = os.getenv("USE_FINETUNED_MODEL", "true").lower() == "true"
    
    print("=" * 60)
    print("AI Model Configuration Check")
    print("=" * 60)
    print(f"\nOllama URL: {ollama_url}")
    print(f"Fine-tuned Model Name: {finetuned_model}")
    print(f"Use Fine-tuned Model: {use_finetuned}")
    print()
    
    try:
        async with aiohttp.ClientSession() as session:
            # Check if Ollama is accessible
            try:
                async with session.get(f"{ollama_url}/api/tags", timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("models", [])
                        
                        print("✅ Ollama is accessible!")
                        print(f"\nAvailable models ({len(models)}):")
                        for model in models:
                            model_name = model.get("name", "unknown")
                            size = model.get("size", 0)
                            size_gb = size / (1024**3) if size > 0 else 0
                            print(f"  - {model_name} ({size_gb:.2f} GB)")
                        
                        # Check if fine-tuned model is available
                        finetuned_available = any(finetuned_model in m.get("name", "") for m in models)
                        
                        print(f"\n{'✅' if finetuned_available else '❌'} Fine-tuned model '{finetuned_model}' is {'available' if finetuned_available else 'NOT available'}")
                        
                        if not finetuned_available and use_finetuned:
                            print(f"\n⚠️  WARNING: Fine-tuned model is enabled but not found!")
                            print(f"   System will fallback to base models:")
                            print(f"   - qwen2.5:7b-instruct (for quick mode)")
                            print(f"   - qwen2.5-coder:14b (for ui mode)")
                            print(f"   - qwen2.5-coder:32b (for heavy mode)")
                        
                        return finetuned_available
                    else:
                        print(f"❌ Ollama returned status {response.status}")
                        return False
            except asyncio.TimeoutError:
                print("❌ Connection timeout - Ollama is not accessible")
                print(f"   Check if Ollama is running at: {ollama_url}")
                return False
            except Exception as e:
                print(f"❌ Error connecting to Ollama: {str(e)}")
                print(f"   Check if Ollama is running at: {ollama_url}")
                return False
                
    except Exception as e:
        print(f"❌ Failed to check Ollama: {str(e)}")
        return False

async def test_model_generation():
    """Test actual model generation to see which model is used"""
    print("\n" + "=" * 60)
    print("Testing Model Generation")
    print("=" * 60)
    
    try:
        from app.services.ollama_service import OllamaService
        
        service = OllamaService()
        await service.initialize()
        
        # Test with quick mode (should use fine-tuned if available)
        print("\nTesting with 'quick' mode (should use fine-tuned model if enabled)...")
        model_quick = service._select_model("quick")
        print(f"Selected model: {model_quick}")
        
        # Test with ui mode (should use 14B base model)
        print("\nTesting with 'ui' mode (should use 14B base model)...")
        model_ui = service._select_model("ui")
        print(f"Selected model: {model_ui}")
        
        # Try a simple generation
        print("\nTesting actual generation (this may take a moment)...")
        try:
            result = await service.generate(
                prompt="Generate a simple test case for login functionality.",
                mode="quick",
                validate_json=False,
                max_retries=1
            )
            model_used = result.get("model", "unknown")
            response_length = len(result.get("response", ""))
            
            print(f"✅ Generation successful!")
            print(f"   Model used: {model_used}")
            print(f"   Response length: {response_length} characters")
            
            if "qa-expert" in model_used or finetuned_model in model_used:
                print(f"   ✅ Using fine-tuned model!")
            else:
                print(f"   ⚠️  Using base model (fine-tuned not available or disabled)")
                
        except Exception as e:
            print(f"❌ Generation failed: {str(e)}")
            print("   This might indicate:")
            print("   - Ollama is not running")
            print("   - Model is not available")
            print("   - Connection issue")
        
        await service.cleanup()
        
    except Exception as e:
        print(f"❌ Error testing generation: {str(e)}")

async def main():
    """Main function"""
    finetuned_available = await check_ollama_connection()
    await test_model_generation()
    
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    use_finetuned = os.getenv("USE_FINETUNED_MODEL", "true").lower() == "true"
    finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qa-expert:7b")
    
    if finetuned_available and use_finetuned:
        print("✅ Fine-tuned model is configured and available")
        print(f"   Model: {finetuned_model}")
        print("   Status: Will be used for 'quick' mode requests")
    elif use_finetuned and not finetuned_available:
        print("⚠️  Fine-tuned model is enabled but NOT available")
        print(f"   Expected: {finetuned_model}")
        print("   Status: System will fallback to base models")
        print("\n   To fix:")
        print(f"   1. Make sure Ollama is running")
        print(f"   2. Pull/load the fine-tuned model: ollama pull {finetuned_model}")
        print(f"   3. Or update FINETUNED_MODEL_NAME in .env to match available model")
    else:
        print("ℹ️  Fine-tuned model is disabled")
        print("   Status: Using base models (qwen2.5:7b-instruct, qwen2.5-coder:14b, etc.)")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(main())






