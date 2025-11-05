#!/usr/bin/env python3
"""
Simple working test script for QAOne test execution
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep

async def test_working_example():
    """Test with a working example that doesn't fail"""
    
    print("QAOne Working Test Example")
    print("=" * 40)
    
    # Create a simple, reliable test case
    test_steps = [
        TestStep(
            action="Navigate to example.com",
            data={"url": "https://example.com"},
            expected="Page loads successfully"
        ),
        TestStep(
            action="Verify page title",
            data={},
            expected="Title contains 'Example Domain'"
        ),
        TestStep(
            action="Wait for page load",
            data={"timeout": 2000},
            expected="Page is fully loaded"
        )
    ]
    
    test_case = TestCase(
        case_id="working_test_001",
        title="Working Example.com Test",
        description="Simple test that should pass",
        priority="P1",
        tags=["smoke", "navigation"],
        steps=test_steps
    )
    
    print(f"Test Case: {test_case.title}")
    print(f"Description: {test_case.description}")
    print(f"Steps: {len(test_case.steps)}")
    print()
    
    # Initialize Playwright runner
    runner = PlaywrightRunner()
    
    try:
        print("Initializing Playwright...")
        await runner.initialize()
        print("[PASS] Playwright initialized successfully")
        print()
        
        print("Executing test case...")
        result = await runner.run_test_case(test_case)
        
        print("Test Results:")
        status_text = "[PASS]" if result.status == 'passed' else "[FAIL]"
        print(f"  Status: {status_text}")
        print(f"  Duration: {result.duration}ms")
        print(f"  Screenshots: {len(result.screenshots)} captured")
        print(f"  Logs: {len(result.logs)} entries")
        
        if result.error:
            print(f"  Error: {result.error}")
        
        print("\nExecution Logs:")
        for i, log in enumerate(result.logs, 1):
            print(f"  {i}. {log}")
        
        print(f"\nScreenshots captured: {len(result.screenshots)}")
        
        if result.status == 'passed':
            print("\nSUCCESS: Test execution is working correctly!")
            print("You can now run automated tests using:")
            print("1. python test_playwright_simple.py")
            print("2. cd backend && python test_simple.py (for API server)")
        else:
            print("\nFAILED: Test execution has issues")
        
    except Exception as e:
        print(f"[FAIL] Test execution failed: {str(e)}")
        
    finally:
        print("\nCleaning up...")
        await runner.cleanup()
        print("[PASS] Cleanup completed")
    
    print("\n" + "=" * 40)

if __name__ == "__main__":
    print("QAOne Test Execution Demo")
    print("This script demonstrates working test execution")
    print()
    
    try:
        asyncio.run(test_working_example())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
    except Exception as e:
        print(f"\nTest failed: {str(e)}")



