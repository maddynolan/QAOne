#!/usr/bin/env python3
"""
Example Automation Script - Run Automated Tests on Your Site

This script demonstrates how to:
1. Generate automated test scripts from descriptions
2. Execute them on your website
3. View results in the dashboard

Usage:
    python automation_example.py
"""

import asyncio
import aiohttp
import json
import sys

# Configuration - UPDATE THESE FOR YOUR SITE
YOUR_SITE_URL = "https://your-website.com"  # Change this to your site
BACKEND_URL = "http://localhost:8000"
PROJECT_ID = "11111111-1111-1111-1111-111111111111"
ORG_ID = "00000000-0000-0000-0000-000000000000"

async def generate_and_run_test(name: str, description: str, app_url: str):
    """
    Generate and execute an automated test
    
    Args:
        name: Test name
        description: What the test should do
        app_url: Your website URL
    """
    url = f"{BACKEND_URL}/ai/generate-and-execute-automated"
    
    payload = {
        "name": name,
        "description": description,
        "app_url": app_url,
        "project_id": PROJECT_ID,
        "org_id": ORG_ID
    }
    
    print(f"\n{'='*70}")
    print(f"🧪 Test: {name}")
    print(f"{'='*70}")
    print(f"📝 Description: {description}")
    print(f"🌐 URL: {app_url}")
    print(f"\n🚀 Generating and executing test...")
    print("   (This may take 30-90 seconds)")
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                url, 
                json=payload, 
                timeout=aiohttp.ClientTimeout(total=180)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    print(f"\n✅ Test Completed!")
                    print(f"   Status: {data['execution_result']['status']}")
                    print(f"   Duration: {data['execution_result']['duration']}ms")
                    print(f"   Model: {data.get('model', 'unknown')}")
                    print(f"   Test Run ID: {data['test_run_id']}")
                    
                    if data['execution_result']['status'] == 'passed':
                        print(f"\n🎉 Test PASSED!")
                    else:
                        print(f"\n❌ Test FAILED")
                        if data['execution_result'].get('error'):
                            print(f"   Error: {data['execution_result']['error'][:200]}")
                    
                    # Show generated code snippet
                    if data.get('generated_code'):
                        code = data['generated_code']
                        if len(code) > 300:
                            code = code[:300] + "..."
                        print(f"\n📄 Generated Code (snippet):")
                        print("   " + "\n   ".join(code.split("\n")[:10]))
                    
                    print(f"\n📊 View in Dashboard:")
                    print(f"   http://localhost:8080/runs/{data['test_run_id']}")
                    
                    return data
                else:
                    error_text = await response.text()
                    print(f"\n❌ Error: HTTP {response.status}")
                    try:
                        error_data = json.loads(error_text)
                        print(f"   {error_data.get('detail', error_text)}")
                    except:
                        print(f"   {error_text}")
                    return None
                    
        except asyncio.TimeoutError:
            print(f"\n❌ Request timed out (>3 minutes)")
            return None
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            return None

async def main():
    """Main function - Define your test cases here"""
    
    print("="*70)
    print("🤖 Automated Test Execution")
    print("="*70)
    print(f"\nTarget Site: {YOUR_SITE_URL}")
    print(f"Backend: {BACKEND_URL}\n")
    
    # ============================================================
    # EXAMPLE TEST CASES - CUSTOMIZE THESE FOR YOUR SITE
    # ============================================================
    
    test_cases = [
        {
            "name": "Homepage Load Test",
            "description": f"Navigate to {YOUR_SITE_URL}, verify the page loads, check that the main heading or logo is visible",
            "app_url": YOUR_SITE_URL
        },
        {
            "name": "Login Test",
            "description": f"Go to {YOUR_SITE_URL}/login, enter username 'testuser' and password 'testpass', click login button, verify successful login or error message appears",
            "app_url": YOUR_SITE_URL
        },
        {
            "name": "Search Functionality",
            "description": f"On {YOUR_SITE_URL}, find the search box, type 'test query', click search button, verify search results are displayed",
            "app_url": YOUR_SITE_URL
        },
        {
            "name": "Navigation Test",
            "description": f"On {YOUR_SITE_URL}, click on 'About' or 'Contact' link in navigation menu, verify the page navigates correctly and new page content is displayed",
            "app_url": YOUR_SITE_URL
        },
        {
            "name": "Form Submission",
            "description": f"On {YOUR_SITE_URL}, find a contact form or signup form, fill in name field with 'John Doe', email with 'john@example.com', submit the form, verify success message or confirmation appears",
            "app_url": YOUR_SITE_URL
        }
    ]
    
    # ============================================================
    # Run all tests
    # ============================================================
    
    results = []
    for i, test in enumerate(test_cases, 1):
        print(f"\n[{i}/{len(test_cases)}]")
        result = await generate_and_run_test(
            test["name"],
            test["description"],
            test["app_url"]
        )
        results.append(result)
        
        # Wait between tests
        if i < len(test_cases):
            print("\n⏳ Waiting 3 seconds before next test...")
            await asyncio.sleep(3)
    
    # Summary
    print("\n" + "="*70)
    print("📊 Test Summary")
    print("="*70)
    
    passed = sum(1 for r in results if r and r.get('execution_result', {}).get('status') == 'passed')
    failed = sum(1 for r in results if r and r.get('execution_result', {}).get('status') == 'failed')
    total = len([r for r in results if r is not None])
    
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📊 Total: {total}")
    
    if results:
        print(f"\n📋 Test Run IDs:")
        for i, result in enumerate(results, 1):
            if result:
                run_id = result.get('test_run_id', 'N/A')
                status = result.get('execution_result', {}).get('status', 'unknown')
                print(f"   {i}. {run_id} - {status}")
    
    print(f"\n💡 View all results in dashboard:")
    print(f"   http://localhost:8080/runs")
    print("\n" + "="*70)

if __name__ == "__main__":
    print("\n⚠️  IMPORTANT: Update YOUR_SITE_URL in this script before running!")
    print(f"   Current: {YOUR_SITE_URL}\n")
    
    response = input("Continue with example tests? (y/n): ")
    if response.lower() != 'y':
        print("Exiting. Please update YOUR_SITE_URL and try again.")
        sys.exit(0)
    
    asyncio.run(main())






