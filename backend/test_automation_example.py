#!/usr/bin/env python3
"""
Example script to test automation generation and execution
"""

import asyncio
import aiohttp
import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def test_automation():
    """Test the automation generation and execution"""
    
    url = "http://localhost:8000/ai/generate-and-execute-automated"
    
    # Example 1: Simple login test
    test_cases = [
        {
            "name": "Login Test - SauceDemo",
            "description": "Test user login on saucedemo.com with username standard_user and password secret_sauce",
            "app_url": "https://www.saucedemo.com"
        },
        {
            "name": "Add to Cart Test",
            "description": "Login to saucedemo.com, add Sauce Labs Backpack product to cart, verify cart count increases to 1",
            "app_url": "https://www.saucedemo.com"
        }
    ]
    
    async with aiohttp.ClientSession() as session:
        for i, payload in enumerate(test_cases, 1):
            print("=" * 70)
            print(f"Test Case {i}: {payload['name']}")
            print("=" * 70)
            print(f"Description: {payload['description']}")
            print(f"App URL: {payload['app_url']}")
            print()
            
            # Add required fields
            full_payload = {
                **payload,
                "project_id": "11111111-1111-1111-1111-111111111111",
                "org_id": "00000000-0000-0000-0000-000000000000"
            }
            
            try:
                print("🚀 Generating and executing automated test...")
                print("   (This may take 30-60 seconds)")
                print()
                
                async with session.post(url, json=full_payload, timeout=aiohttp.ClientTimeout(total=120)) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        print("✅ Test completed!")
                        print(f"   Status: {data['execution_result']['status']}")
                        print(f"   Duration: {data['execution_result']['duration']}ms")
                        print(f"   Model used: {data.get('model', 'unknown')}")
                        print(f"   Test Run ID: {data['test_run_id']}")
                        print()
                        
                        if data['execution_result']['status'] == 'passed':
                            print("🎉 Test PASSED!")
                        else:
                            print(f"❌ Test FAILED")
                            if data['execution_result'].get('error'):
                                print(f"   Error: {data['execution_result']['error']}")
                        
                        if data['execution_result'].get('logs'):
                            print("\n   Execution Logs:")
                            for log in data['execution_result']['logs'][:5]:  # Show first 5 logs
                                print(f"   - {log}")
                        
                        print(f"\n   View results: http://localhost:8080/runs/{data['test_run_id']}")
                        print()
                        
                    else:
                        error_text = await response.text()
                        print(f"❌ Error: HTTP {response.status}")
                        try:
                            error_data = json.loads(error_text)
                            print(f"   Detail: {error_data.get('detail', error_text)}")
                        except:
                            print(f"   Detail: {error_text}")
                        print()
                        
            except asyncio.TimeoutError:
                print("❌ Request timed out (took longer than 2 minutes)")
                print("   This might indicate:")
                print("   - Ollama is slow or not responding")
                print("   - Model generation is taking too long")
                print()
            except Exception as e:
                print(f"❌ Error: {str(e)}")
                print()
            
            # Wait between tests
            if i < len(test_cases):
                print("Waiting 2 seconds before next test...")
                await asyncio.sleep(2)
                print()
    
    print("=" * 70)
    print("Testing Complete!")
    print("=" * 70)
    print("\n💡 Tips:")
    print("   1. Check backend logs to see which model was used")
    print("   2. View test runs in dashboard: http://localhost:8080/runs")
    print("   3. Check /debug/model-info to verify model configuration")

if __name__ == "__main__":
    asyncio.run(test_automation())






