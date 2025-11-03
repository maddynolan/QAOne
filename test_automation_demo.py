#!/usr/bin/env python3
"""
Simple test script to demonstrate automated test execution
This bypasses the FastAPI server and directly tests the Playwright runner
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep

async def test_automated_execution():
    """Test automated test execution with Playwright"""
    
    print("🚀 Starting Automated Test Execution Demo")
    print("=" * 50)
    
    # Create a test case
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
            action="Check page content",
            data={},
            expected="Page contains expected content"
        )
    ]
    
    test_case = TestCase(
        case_id="demo_test_001",
        title="Example.com Navigation Test",
        description="Test basic navigation to example.com",
        priority="P2",
        tags=["smoke", "navigation"],
        steps=test_steps
    )
    
    print(f"📋 Test Case: {test_case.title}")
    print(f"📝 Description: {test_case.description}")
    print(f"🏷️  Tags: {', '.join(test_case.tags)}")
    print(f"📊 Priority: {test_case.priority}")
    print(f"📈 Steps: {len(test_case.steps)}")
    print()
    
    # Initialize Playwright runner
    runner = PlaywrightRunner()
    
    try:
        print("🔧 Initializing Playwright...")
        await runner.initialize()
        print("✅ Playwright initialized successfully")
        print()
        
        print("🎬 Executing test case...")
        result = await runner.run_test_case(test_case)
        
        print("📊 Test Results:")
        print(f"   Status: {'✅ PASSED' if result.status == 'passed' else '❌ FAILED'}")
        print(f"   Duration: {result.duration}ms")
        print(f"   Screenshots: {len(result.screenshots)} captured")
        print(f"   Logs: {len(result.logs)} entries")
        
        if result.error:
            print(f"   Error: {result.error}")
        
        print("\n📝 Execution Logs:")
        for i, log in enumerate(result.logs, 1):
            print(f"   {i}. {log}")
        
        print(f"\n📸 Screenshots captured: {len(result.screenshots)}")
        if result.screenshots:
            print("   (Screenshots are base64 encoded)")
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        
    finally:
        print("\n🧹 Cleaning up...")
        await runner.cleanup()
        print("✅ Cleanup completed")
    
    print("\n🎉 Automated Test Execution Demo Complete!")
    print("=" * 50)

if __name__ == "__main__":
    print("🤖 QAOne Automated Test Execution Demo")
    print("This script demonstrates how automated tests work in the platform")
    print()
    
    try:
        asyncio.run(test_automated_execution())
    except KeyboardInterrupt:
        print("\n⏹️  Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed: {str(e)}")
        print("\n💡 Make sure Playwright is installed:")
        print("   pip install playwright")
        print("   playwright install")


