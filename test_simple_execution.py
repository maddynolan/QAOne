#!/usr/bin/env python3
"""
Simple test to verify test execution is working
"""

import requests
import json

def test_execution():
    # Simple test code
    test_code = """
import { test, expect } from '@playwright/test';

test.describe('Simple Test', () => {
  test('should work', async ({ page }) => {
    await page.goto('https://www.saucedemo.com');
    await expect(page).toHaveTitle(/.*/);
  });
});
"""
    
    # Test the endpoint
    url = "http://localhost:8001/tests/run-generated"
    payload = {
        "test_code": test_code,
        "test_name": "simple_test"
    }
    
    print("Testing test execution endpoint...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=180)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('status') == 'success':
                print("✅ Test execution successful!")
                for test_result in result.get('test_results', []):
                    print(f"  - {test_result['test_name']}: {test_result['status']}")
            else:
                print(f"❌ Test execution failed: {result.get('error')}")
        else:
            print(f"❌ HTTP error: {response.status_code}")
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_execution()


