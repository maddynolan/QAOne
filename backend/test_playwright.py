#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep

async def test_playwright():
    """Test Playwright runner directly"""
    print("Testing Playwright runner...")
    
    # Create a simple test case with valid actions
    steps = [
        TestStep(
            action="Navigate to Google",
            data={"url": "https://www.google.com"},
            expected="Google homepage loads",
            locator_hints=[]
        ),
        TestStep(
            action="Wait for page load",
            data={"timeout": 2000},
            expected="Page loads completely",
            locator_hints=[]
        )
    ]
    
    test_case = TestCase(
        case_id="test-1",
        title="Simple Navigation Test",
        description="Test basic navigation",
        priority="P1",
        tags=["smoke", "navigation"],
        steps=steps
    )
    
    # Initialize and run the test
    runner = PlaywrightRunner()
    try:
        await runner.initialize()
        print("Playwright initialized successfully")
        
        result = await runner.run_test_case(test_case)
        print(f"Test completed: {result.status}")
        print(f"Duration: {result.duration}ms")
        print(f"Logs: {len(result.logs)} log entries")
        print(f"Screenshots: {len(result.screenshots)} screenshots")
        
        if result.error:
            print(f"Error: {result.error}")
        else:
            print("✅ Test passed successfully!")
            
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        await runner.cleanup()
        print("Playwright cleaned up")

if __name__ == "__main__":
    asyncio.run(test_playwright())