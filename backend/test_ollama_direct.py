"""Direct test of Ollama API to verify it works"""
import asyncio
import aiohttp
import json

async def test_ollama():
    session = aiohttp.ClientSession()
    
    # Test 1: Simple prompt
    print("Test 1: Simple prompt")
    payload1 = {
        'model': 'qwen2.5-coder:7b',
        'prompt': 'Say hello',
        'stream': False
    }
    async with session.post('http://localhost:31143/api/generate', json=payload1) as r:
        data1 = await r.json()
        print(f"  Status: {r.status}")
        print(f"  Response length: {len(data1.get('response', ''))}")
        print(f"  Response: {data1.get('response', '')[:100]}")
    
    # Test 2: Test case generation prompt
    print("\nTest 2: Test case generation prompt")
    prompt = """Generate a JSON array with one manual test case:
[{"title": "Login Test", "description": "Test login functionality", "test_type": "manual", "steps": [{"step_number": 1, "action": "Navigate to login page", "expected_result": "Login page loads"}]}]"""
    
    payload2 = {
        'model': 'qwen2.5-coder:7b',
        'prompt': prompt,
        'stream': False
    }
    async with session.post('http://localhost:31143/api/generate', json=payload2) as r:
        data2 = await r.json()
        print(f"  Status: {r.status}")
        print(f"  Response length: {len(data2.get('response', ''))}")
        print(f"  Response preview: {data2.get('response', '')[:300]}")
        if data2.get('response'):
            try:
                parsed = json.loads(data2.get('response'))
                print(f"  ✅ Valid JSON! Type: {type(parsed)}")
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"  ✅ Array with {len(parsed)} items")
                    if 'steps' in parsed[0]:
                        print(f"  ✅ First item has {len(parsed[0].get('steps', []))} steps")
            except:
                print(f"  ❌ Not valid JSON")
    
    await session.close()

if __name__ == "__main__":
    asyncio.run(test_ollama())



