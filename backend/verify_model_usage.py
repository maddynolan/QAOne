#!/usr/bin/env python3
"""
Verify which model is actually being used for test generation
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

async def test_model_selection():
    """Test which model is selected for different modes"""
    print("=" * 70)
    print("Model Selection Verification")
    print("=" * 70)
    
    from app.services.ollama_service import OllamaService
    
    service = OllamaService()
    
    print("\n1. Testing Model Selection:")
    print("-" * 70)
    
    # Test different modes
    modes = ["quick", "ui", "heavy"]
    for mode in modes:
        selected = service._select_model(mode)
        is_trained = "qa-expert" in selected.lower()
        status = "✅ TRAINED MODEL" if is_trained else "⚠️  BASE MODEL"
        print(f"   Mode '{mode:6}' → {selected:30} {status}")
    
    print("\n2. Testing Actual Generation:")
    print("-" * 70)
    
    await service.initialize()
    
    try:
        # Test with quick mode (should use trained model)
        print("\n   Generating test case with 'quick' mode...")
        result = await service.generate(
            prompt="Generate a test case for user login functionality.",
            mode="quick",
            validate_json=False,
            max_retries=1
        )
        
        model_used = result.get("model", "unknown")
        response_preview = result.get("response", "")[:100]
        
        print(f"\n   ✅ Generation completed!")
        print(f"   Model used: {model_used}")
        print(f"   Is trained model: {'✅ YES' if 'qa-expert' in model_used.lower() else '❌ NO'}")
        print(f"   Response preview: {response_preview}...")
        
        # Test with ui mode (should use base model)
        print("\n   Generating test case with 'ui' mode...")
        result2 = await service.generate(
            prompt="Generate a test case for user login functionality.",
            mode="ui",
            validate_json=False,
            max_retries=1
        )
        
        model_used2 = result2.get("model", "unknown")
        print(f"\n   ✅ Generation completed!")
        print(f"   Model used: {model_used2}")
        print(f"   Is trained model: {'✅ YES' if 'qa-expert' in model_used2.lower() else '❌ NO (expected - ui mode uses base model)'}")
        
    except Exception as e:
        print(f"\n   ❌ Error during generation: {str(e)}")
        print("   This might indicate:")
        print("   - Ollama is not running")
        print("   - Model is not available")
        print("   - Connection issue")
    
    finally:
        await service.cleanup()
    
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    
    use_finetuned = os.getenv("USE_FINETUNED_MODEL", "true").lower() == "true"
    finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qa-expert:7b")
    
    if use_finetuned:
        print(f"✅ Fine-tuned model is ENABLED: {finetuned_model}")
        print("   → Will be used for 'quick' mode requests")
        print("   → Base models used for 'ui' and 'heavy' modes")
    else:
        print("⚠️  Fine-tuned model is DISABLED")
        print("   → All modes will use base models")
    
    print("\n💡 To verify in production:")
    print("   1. Check backend logs for 'Using fine-tuned model: qa-expert:7b'")
    print("   2. Check API response JSON - it includes 'model' field")
    print("   3. Monitor /ai/generate-tests endpoint responses")

if __name__ == "__main__":
    asyncio.run(test_model_selection())






