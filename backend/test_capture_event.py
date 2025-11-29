"""
Test script to verify Flowstral capture-event endpoint
Tests session creation, event capture, and artifact generation
"""

import asyncio
import sys
import os
import json
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import httpx
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"


async def test_capture_event():
    """Test the complete Flowstral flow: start → capture → stop"""
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        logger.info("=" * 80)
        logger.info("🧪 Testing Flowstral Capture Event Endpoint")
        logger.info("=" * 80)
        
        # Step 1: Start a session
        logger.info("\n📝 Step 1: Starting Flowstral session...")
        start_request = {
            "project_id": "test_project",
            "user_id": "test_user",
            "initial_url": "https://www.saucedemo.com/",
            "initial_dom": "<html><body><h1>Test Page</h1></body></html>"
        }
        
        try:
            start_response = await client.post(
                f"{BASE_URL}/api/flowstral/start",
                json=start_request
            )
            start_response.raise_for_status()
            start_data = start_response.json()
            session_id = start_data.get("session", {}).get("session_id")
            
            if not session_id:
                logger.error("❌ No session_id returned from start endpoint")
                logger.error(f"Response: {json.dumps(start_data, indent=2)}")
                return False
            
            logger.info(f"✅ Session started: {session_id}")
            logger.info(f"Session data: {json.dumps(start_data, indent=2)}")
            
        except Exception as e:
            logger.error(f"❌ Failed to start session: {e}")
            return False
        
        # Step 2: Capture a click event
        logger.info("\n📝 Step 2: Capturing a click event...")
        capture_request = {
            "session_id": session_id,
            "event_type": "click",
            "event_data": {
                "html": "<html><body><button id='login-button'>Login</button></body></html>",
                "url": "https://www.saucedemo.com/",
                "interacted_element": {
                    "tag": "button",
                    "id": "login-button",
                    "text_content": "Login",
                    "selector": "#login-button",
                    "aria-label": None
                },
                "action_description": "User clicks Login button",
                "page_metrics": {
                    "load_time": 1200,
                    "dom_content_loaded": 800
                }
            }
        }
        
        try:
            capture_response = await client.post(
                f"{BASE_URL}/api/flowstral/capture-event",
                json=capture_request
            )
            capture_response.raise_for_status()
            capture_data = capture_response.json()
            
            logger.info(f"✅ Event captured successfully")
            logger.info(f"Capture response: {json.dumps(capture_data, indent=2)}")
            
        except Exception as e:
            logger.error(f"❌ Failed to capture event: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False
        
        # Step 3: Capture an input event (username)
        logger.info("\n📝 Step 3: Capturing an input event (username)...")
        input_request = {
            "session_id": session_id,
            "event_type": "input",
            "event_data": {
                "html": "<html><body><input id='user-name' type='text' placeholder='Username'></body></html>",
                "url": "https://www.saucedemo.com/",
                "interacted_element": {
                    "tag": "input",
                    "id": "user-name",
                    "type": "text",
                    "placeholder": "Username",
                    "selector": "#user-name",
                    "aria-label": None
                },
                "value": "standard_user",
                "action_description": "User enters username",
                "page_metrics": {
                    "load_time": 1200,
                    "dom_content_loaded": 800
                }
            }
        }
        
        try:
            input_response = await client.post(
                f"{BASE_URL}/api/flowstral/capture-event",
                json=input_request
            )
            input_response.raise_for_status()
            input_data = input_response.json()
            
            logger.info(f"✅ Input event captured successfully")
            logger.info(f"Input response: {json.dumps(input_data, indent=2)}")
            
        except Exception as e:
            logger.error(f"❌ Failed to capture input event: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False
        
        # Step 4: Capture another input event (password)
        logger.info("\n📝 Step 4: Capturing an input event (password)...")
        password_request = {
            "session_id": session_id,
            "event_type": "input",
            "event_data": {
                "html": "<html><body><input id='password' type='password' placeholder='Password'></body></html>",
                "url": "https://www.saucedemo.com/",
                "interacted_element": {
                    "tag": "input",
                    "id": "password",
                    "type": "password",
                    "placeholder": "Password",
                    "selector": "#password",
                    "aria-label": None
                },
                "value": "secret_sauce",
                "action_description": "User enters password",
                "page_metrics": {
                    "load_time": 1200,
                    "dom_content_loaded": 800
                }
            }
        }
        
        try:
            password_response = await client.post(
                f"{BASE_URL}/api/flowstral/capture-event",
                json=password_request
            )
            password_response.raise_for_status()
            password_data = password_response.json()
            
            logger.info(f"✅ Password input event captured successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to capture password event: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False
        
        # Step 5: Capture a submit/click event (login button)
        logger.info("\n📝 Step 5: Capturing a submit event (login button)...")
        submit_request = {
            "session_id": session_id,
            "event_type": "click",
            "event_data": {
                "html": "<html><body><input id='login-button' type='submit' value='Login'></body></html>",
                "url": "https://www.saucedemo.com/",
                "interacted_element": {
                    "tag": "input",
                    "id": "login-button",
                    "type": "submit",
                    "value": "Login",
                    "selector": "#login-button",
                    "aria-label": None
                },
                "action_description": "User clicks Login button to submit form",
                "page_metrics": {
                    "load_time": 1200,
                    "dom_content_loaded": 800
                }
            }
        }
        
        try:
            submit_response = await client.post(
                f"{BASE_URL}/api/flowstral/capture-event",
                json=submit_request
            )
            submit_response.raise_for_status()
            submit_data = submit_response.json()
            
            logger.info(f"✅ Submit event captured successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to capture submit event: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False
        
        # Step 6: Stop session and generate artifacts
        logger.info("\n📝 Step 6: Stopping session and generating artifacts...")
        stop_request = {
            "session_id": session_id,
            "project_id": "test_project"
        }
        
        try:
            stop_response = await client.post(
                f"{BASE_URL}/api/flowstral/stop",
                json=stop_request
            )
            stop_response.raise_for_status()
            stop_data = stop_response.json()
            
            logger.info(f"✅ Session stopped")
            logger.info(f"Stop response keys: {list(stop_data.keys())}")
            
            # Check artifacts
            artifacts = stop_data.get("artifacts", {}).get("artifacts", {})
            logger.info(f"\n📊 Artifact Generation Results:")
            logger.info(f"Total artifacts: {len(artifacts)}")
            
            for artifact_name, artifact_data in artifacts.items():
                if isinstance(artifact_data, dict):
                    if "error" in artifact_data:
                        logger.warning(f"  ❌ {artifact_name}: {artifact_data.get('error')}")
                    else:
                        logger.info(f"  ✅ {artifact_name}: Generated successfully")
                else:
                    logger.info(f"  ✅ {artifact_name}: Generated (type: {type(artifact_data).__name__})")
            
            # Check for warnings
            warnings = stop_data.get("artifacts", {}).get("warnings", [])
            if warnings:
                logger.warning(f"\n⚠️ Warnings:")
                for warning in warnings:
                    logger.warning(f"  - {warning}")
            
            # Check test cases specifically
            test_cases = artifacts.get("test_cases", {})
            logger.info(f"\n📋 Test Cases Analysis:")
            logger.info(f"  Test cases type: {type(test_cases).__name__}")
            logger.info(f"  Test cases keys: {list(test_cases.keys()) if isinstance(test_cases, dict) else 'N/A'}")
            
            if test_cases:
                if isinstance(test_cases, dict):
                    # Check different possible structures
                    automated = test_cases.get("automated", [])
                    test_cases_list = test_cases.get("test_cases", [])
                    formatted = test_cases.get("formatted", [])
                    
                    logger.info(f"  Automated test cases: {len(automated)}")
                    logger.info(f"  Test cases list: {len(test_cases_list)}")
                    logger.info(f"  Formatted test cases: {len(formatted)}")
                    
                    # Show first automated test case
                    if automated:
                        logger.info(f"\n  First Automated Test Case:")
                        tc = automated[0]
                        logger.info(f"    Title: {tc.get('title', 'No title')}")
                        logger.info(f"    ID: {tc.get('test_case_id', 'No ID')}")
                        logger.info(f"    Steps: {len(tc.get('test_steps', tc.get('steps', [])))}")
                        logger.info(f"    Confidence: {tc.get('confidence_score', 0):.2f}")
                        logger.info(f"    Format: {tc.get('format', 'N/A')}")
                    
                    # Show first test case from list
                    if test_cases_list:
                        logger.info(f"\n  First Test Case from List:")
                        tc = test_cases_list[0]
                        logger.info(f"    Title: {tc.get('title', 'No title')}")
                        logger.info(f"    ID: {tc.get('test_case_id', 'No ID')}")
                        logger.info(f"    Steps: {len(tc.get('test_steps', tc.get('steps', [])))}")
                    
                    # If no test cases found, show the full structure
                    if not automated and not test_cases_list and not formatted:
                        logger.warning(f"  ⚠️ No test cases found in expected locations")
                        logger.info(f"  Full test_cases structure (first 500 chars):")
                        logger.info(f"    {str(test_cases)[:500]}")
                elif isinstance(test_cases, list):
                    logger.info(f"  Test cases is a list with {len(test_cases)} items")
                    if test_cases:
                        tc = test_cases[0]
                        logger.info(f"    First test case: {tc.get('title', 'No title')}")
                        logger.info(f"    Steps: {len(tc.get('test_steps', tc.get('steps', [])))}")
            else:
                logger.warning(f"  ⚠️ No test_cases artifact found")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to stop session: {e}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response body: {e.response.text}")
            return False


async def test_session_status(session_id: str):
    """Test getting session status"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{BASE_URL}/api/flowstral/session/{session_id}/status"
            )
            response.raise_for_status()
            status_data = response.json()
            logger.info(f"\n📊 Session Status:")
            logger.info(f"{json.dumps(status_data, indent=2)}")
            return status_data
        except Exception as e:
            logger.warning(f"⚠️ Could not get session status: {e}")
            return None


if __name__ == "__main__":
    logger.info("Starting Flowstral Capture Event Test...")
    logger.info(f"Testing against: {BASE_URL}")
    
    try:
        result = asyncio.run(test_capture_event())
        if result:
            logger.info("\n" + "=" * 80)
            logger.info("✅ ALL TESTS PASSED!")
            logger.info("=" * 80)
            sys.exit(0)
        else:
            logger.error("\n" + "=" * 80)
            logger.error("❌ TESTS FAILED!")
            logger.error("=" * 80)
            sys.exit(1)
    except KeyboardInterrupt:
        logger.info("\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Test failed with exception: {e}", exc_info=True)
        sys.exit(1)

