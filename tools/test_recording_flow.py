"""
Test script for App-First Flow recording and Playwright generation
Usage: python tools/test_recording_flow.py
"""

import asyncio
import json
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.services.dom_recorder import DOMRecorder
from app.services.automation_agent import AutomationAgent
from app.services.test_design_agent import TestDesignAgent
from app.services.app_first_flow_orchestrator import AppFirstFlowOrchestrator


async def test_dom_recorder():
    """Test DOM recorder with sample data"""
    print("=" * 60)
    print("Testing DOM Recorder")
    print("=" * 60)
    
    recorder = DOMRecorder()
    
    # Sample recording data
    sample_recording = {
        "url": "https://example.com",
        "title": "Test Recording",
        "snapshots": [
            {
                "timestamp": 0,
                "dom": "<html><body><h1>Welcome</h1><button id='login-btn'>Login</button></body></html>",
                "screenshot": "base64...",
                "interactions": [
                    {
                        "type": "click",
                        "selector": "#login-btn",
                        "timestamp": 1000
                    }
                ]
            },
            {
                "timestamp": 2000,
                "dom": "<html><body><form><input name='username'/><input name='password'/><button type='submit'>Submit</button></form></body></html>",
                "screenshot": "base64...",
                "interactions": [
                    {
                        "type": "type",
                        "selector": "[name='username']",
                        "value": "testuser",
                        "timestamp": 3000
                    },
                    {
                        "type": "type",
                        "selector": "[name='password']",
                        "value": "password123",
                        "timestamp": 4000
                    },
                    {
                        "type": "click",
                        "selector": "button[type='submit']",
                        "timestamp": 5000
                    }
                ]
            }
        ],
        "metadata": {
            "browser": "Chrome",
            "viewport": {"width": 1920, "height": 1080}
        }
    }
    
    # Parse recording
    parsed = recorder.parse_recording(sample_recording)
    print(f"✅ Parsed recording: {parsed.get('recording_id')}")
    
    # Extract test steps
    steps = recorder.extract_test_steps(parsed)
    print(f"✅ Extracted {len(steps)} test steps")
    for i, step in enumerate(steps, 1):
        print(f"  Step {i}: {step.get('action')} on {step.get('selector')}")
    
    # Generate Playwright script
    playwright_code = recorder.generate_playwright_code(parsed)
    print(f"\n✅ Generated Playwright script ({len(playwright_code)} chars)")
    print("\n" + "-" * 60)
    print(playwright_code)
    print("-" * 60)
    
    return parsed, playwright_code


async def test_automation_agent(recording):
    """Test Automation Agent"""
    print("\n" + "=" * 60)
    print("Testing Automation Agent")
    print("=" * 60)
    
    agent = AutomationAgent()
    
    # Generate test from recording
    result = await agent.generate_test(
        recording_id=recording.get("recording_id"),
        tenant_id=None
    )
    
    print(f"✅ Generated test from recording")
    print(f"   Source: {result.get('source')}")
    print(f"   Test code length: {len(result.get('test_code', ''))} chars")
    
    return result


async def test_test_design_agent(playwright_script, recording):
    """Test Test Design Agent"""
    print("\n" + "=" * 60)
    print("Testing Test Design Agent")
    print("=" * 60)
    
    agent = TestDesignAgent()
    
    # Convert script to test case
    result = await agent.convert_script_to_test_case(
        playwright_script=playwright_script,
        recording_data=recording,
        tenant_id=None
    )
    
    print(f"✅ Converted to structured test case")
    print(f"   Test Case ID: {result.get('test_case_id')}")
    test_case = result.get('test_case', {})
    print(f"   Title: {test_case.get('title')}")
    print(f"   Steps: {len(test_case.get('steps', []))}")
    print(f"   Priority: {test_case.get('priority')}")
    
    return result


async def test_complete_flow():
    """Test complete App-First Flow"""
    print("\n" + "=" * 60)
    print("Testing Complete App-First Flow")
    print("=" * 60)
    
    orchestrator = AppFirstFlowOrchestrator()
    
    # Sample recording data
    recording_data = {
        "url": "https://example.com/login",
        "title": "Login Flow Test",
        "snapshots": [
            {
                "timestamp": 0,
                "dom": "<html><body><h1>Login Page</h1><form><input name='email'/><input name='password'/><button type='submit'>Login</button></form></body></html>",
                "screenshot": "base64...",
                "interactions": [
                    {
                        "type": "type",
                        "selector": "[name='email']",
                        "value": "user@example.com",
                        "timestamp": 1000
                    },
                    {
                        "type": "type",
                        "selector": "[name='password']",
                        "value": "password123",
                        "timestamp": 2000
                    },
                    {
                        "type": "click",
                        "selector": "button[type='submit']",
                        "timestamp": 3000
                    }
                ]
            },
            {
                "timestamp": 4000,
                "dom": "<html><body><h1>Dashboard</h1><p>Welcome!</p></body></html>",
                "screenshot": "base64...",
                "interactions": []
            }
        ],
        "metadata": {
            "browser": "Chrome",
            "viewport": {"width": 1920, "height": 1080}
        }
    }
    
    try:
        result = await orchestrator.execute_complete_flow(
            recording_data=recording_data,
            project_id=None,
            org_id=None,
            tenant_id=None,
            enable_performance=False,
            enable_accessibility=False
        )
        
        print(f"✅ Complete flow executed successfully")
        print(f"   Flow ID: {result.get('flow_id')}")
        print(f"   Recording ID: {result.get('recording_id')}")
        print(f"   Test Cases: {len(result.get('test_cases', []))}")
        print(f"   Requirements: {len(result.get('requirements', []))}")
        print(f"   Duration: {result.get('duration_seconds', 0):.2f}s")
        
        # Show Playwright script
        playwright_script = result.get('playwright_script', '')
        if playwright_script:
            print(f"\n📝 Generated Playwright Script:")
            print("-" * 60)
            print(playwright_script)
            print("-" * 60)
        
        return result
        
    except Exception as e:
        print(f"❌ Flow execution failed: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_with_real_website():
    """Instructions for testing with a real website"""
    print("\n" + "=" * 60)
    print("Testing with Real Website")
    print("=" * 60)
    
    print("""
To test with a real website:

1. Open the browser recorder:
   - Open tools/browser_recorder.html in your browser
   - OR inject the recorder script into any webpage

2. Start recording:
   - Click "Start Recording"
   - Navigate and interact with the website
   - Click "Stop Recording"

3. Upload and generate:
   - Configure API endpoint (default: http://localhost:8000/api/app-first/record-and-generate)
   - Optionally add API key and Project ID
   - Click "Upload & Generate"

4. View results:
   - A new window will open with the generated Playwright script
   - Check the console for flow ID and other details

5. Execute the script:
   - Copy the Playwright script
   - Save it as a .spec.js file
   - Run with: npx playwright test your-script.spec.js

Alternative: Use the API directly:
   POST http://localhost:8000/api/app-first/record-and-generate
   Body: { "url": "...", "snapshots": [...], ... }
    """)


async def main():
    """Main test function"""
    print("\n" + "=" * 60)
    print("App-First Flow Testing")
    print("=" * 60)
    
    # Test 1: DOM Recorder
    recording, playwright_code = await test_dom_recorder()
    
    # Test 2: Automation Agent
    automation_result = await test_automation_agent(recording)
    
    # Test 3: Test Design Agent
    test_design_result = await test_test_design_agent(
        automation_result.get('test_code', playwright_code),
        recording
    )
    
    # Test 4: Complete Flow
    flow_result = await test_complete_flow()
    
    # Test 5: Instructions
    await test_with_real_website()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())



