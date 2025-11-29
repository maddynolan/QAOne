"""
Test OpenAI Connection
Quick test to verify OpenAI API key and gpt-4o-mini model are working
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Load .env file
load_dotenv()

async def test_openai():
    """Test OpenAI API connection"""
    print("=" * 60)
    print("Testing OpenAI Connection")
    print("=" * 60)
    
    # Check API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("❌ ERROR: OPENAI_API_KEY not found in environment")
        print("   Make sure it's in .env file and backend was restarted")
        return False
    
    # Mask key for display
    masked_key = api_key[:7] + "..." if len(api_key) > 7 else "***"
    print(f"✅ API Key found: {masked_key}")
    
    # Check if openai package is installed
    try:
        from openai import AsyncOpenAI
        import openai
        print(f"✅ OpenAI package installed: version {openai.__version__}")
    except ImportError:
        print("❌ ERROR: openai package not installed")
        print("   Run: pip install openai")
        return False
    
    # Test API call
    print("\n📡 Testing API call to gpt-4o-mini...")
    try:
        client = AsyncOpenAI(api_key=api_key)
        
        # Simple test call
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say 'Hello, OpenAI is working!' and nothing else."}
                ],
                temperature=0.2,
                max_tokens=50
            ),
            timeout=10.0
        )
        
        content = response.choices[0].message.content
        usage = response.usage
        
        print(f"✅ API call successful!")
        print(f"   Response: {content}")
        print(f"   Model: {response.model}")
        print(f"   Tokens used: {usage.total_tokens} (input: {usage.prompt_tokens}, output: {usage.completion_tokens})")
        
        # Calculate cost
        input_cost = (usage.prompt_tokens / 1_000_000) * 0.15
        output_cost = (usage.completion_tokens / 1_000_000) * 0.60
        total_cost = input_cost + output_cost
        print(f"   Estimated cost: ${total_cost:.6f} USD")
        
        return True
        
    except asyncio.TimeoutError:
        print("❌ ERROR: API call timed out after 10 seconds")
        return False
    except Exception as e:
        print(f"❌ ERROR: API call failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        return False

async def test_openai_service():
    """Test the OpenAI service wrapper"""
    print("\n" + "=" * 60)
    print("Testing OpenAI Service Wrapper")
    print("=" * 60)
    
    try:
        from app.services.llm.openai_service import get_openai_service
        
        service = get_openai_service()
        
        if not service.is_available():
            print("❌ ERROR: OpenAI service reports as not available")
            return False
        
        print("✅ OpenAI service is available")
        
        # Test rewrite_test_case method
        system_prompt = "You are a test assistant. Return a simple JSON: {\"status\": \"ok\"}"
        user_message = "Test message"
        
        print("\n📡 Testing rewrite_test_case method...")
        result = await service.rewrite_test_case(
            system_prompt=system_prompt,
            user_message=user_message,
            timeout=10.0
        )
        
        print(f"✅ Service method call successful!")
        print(f"   Provider: {result.get('provider')}")
        print(f"   Model: {result.get('model')}")
        print(f"   Latency: {result.get('latency_ms', 0):.0f}ms")
        print(f"   Tokens: {result.get('tokens_used', 'N/A')}")
        cost = result.get('cost_usd')
        if cost:
            print(f"   Cost: ${cost:.6f} USD")
        else:
            print(f"   Cost: N/A")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: Service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("\n🚀 Starting OpenAI Connection Tests\n")
    
    # Test 1: Direct API call
    test1_result = await test_openai()
    
    # Test 2: Service wrapper
    test2_result = await test_openai_service()
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Direct API Call: {'✅ PASS' if test1_result else '❌ FAIL'}")
    print(f"Service Wrapper: {'✅ PASS' if test2_result else '❌ FAIL'}")
    
    if test1_result and test2_result:
        print("\n🎉 All tests passed! OpenAI is ready to use.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Check errors above.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

