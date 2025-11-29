"""
Test script to verify 7B model selection for Flowstral test case generation
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load .env first
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ Loaded .env from: {env_path}")
else:
    load_dotenv()
    print("⚠️  Using default .env")

# Now import services
from app.services.ollama_service import OllamaService
from app.services.model_gateway import get_model_gateway, GenerationRequest

async def test_model_selection():
    """Test model selection for test case generation"""
    print("\n" + "="*60)
    print("Testing Model Selection for Flowstral Test Case Generation")
    print("="*60)
    
    # Test 1: Check OllamaService initialization
    print("\n1. Checking OllamaService initialization...")
    ollama = OllamaService()
    print(f"   OLLAMA_URL: {ollama.ollama_base_url}")
    print(f"   use_7b_for_test_cases: {ollama.use_7b_for_test_cases}")
    print(f"   test_case_model: {ollama.test_case_model}")
    print(f"   use_vllm: {ollama.use_vllm}")
    
    # Test 2: Test model selection
    print("\n2. Testing _select_model() with use_fast_model=True...")
    selected_model = ollama._select_model(mode="quick", task_type="test_design", use_fast_model=True)
    print(f"   Selected model: {selected_model}")
    if "7b" in selected_model.lower() or "qwen2.5-coder" in selected_model.lower():
        print("   ✅ Correctly selected 7B model!")
    else:
        print(f"   ❌ Expected 7B model, got: {selected_model}")
    
    # Test 3: Test through ModelGateway (as Flowstral uses it)
    print("\n3. Testing through ModelGateway (as Flowstral uses)...")
    model_gateway = get_model_gateway()
    
    # Create a test request like Flowstral does
    test_request = GenerationRequest(
        prompt="Generate a test case: User logs in",
        mode="quick",
        validate_json=True,
        task_type="test_design",
        max_tokens=1500,
        use_fast_model=True  # This is what Flowstral sets
    )
    
    print(f"   Request: use_fast_model={test_request.use_fast_model}, task_type={test_request.task_type}")
    
    # Test actual generation (small prompt to be fast)
    print("\n4. Testing actual generation (small prompt)...")
    try:
        result = await model_gateway.generate(test_request, tenant_id=None)
        print(f"   ✅ Generation successful!")
        print(f"   Model used: {result.model}")
        print(f"   Response length: {len(result.response)} chars")
        print(f"   Latency: {result.latency_ms:.0f}ms")
        
        if "7b" in result.model.lower() or "qwen2.5-coder" in result.model.lower():
            print("   ✅ Confirmed: Using 7B model!")
        else:
            print(f"   ❌ Not using 7B model - got: {result.model}")
            print(f"   This is the problem!")
    except Exception as e:
        print(f"   ❌ Generation failed: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("Test Complete")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_model_selection())



