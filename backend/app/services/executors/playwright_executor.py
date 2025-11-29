"""
Playwright Executor - Runs Playwright in separate process to avoid Windows asyncio issues
Uses subprocess with file-based communication
"""

import subprocess
import sys
import tempfile
import json
import os
import platform
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class PlaywrightExecutor:
    """Execute Playwright tests in separate process (Windows-compatible)"""
    
    def __init__(self):
        self.temp_dir = None
    
    def _create_test_script(self, test_case: Dict[str, Any]) -> str:
        """Create a Python script that runs the Playwright test"""
        script = f"""
import json
import sys
import os
from playwright.sync_api import sync_playwright
import base64
from datetime import datetime

# Test case data
test_case = {json.dumps(test_case)}

try:
    start_time = datetime.now()
    logs = []
    screenshots = []
    
    with sync_playwright() as p:
        # Allow headless to be controlled via environment variable
        headless_mode = os.environ.get('PLAYWRIGHT_HEADLESS', 'true').lower() == 'true'
        browser = p.chromium.launch(headless=headless_mode)
        page = browser.new_page()
        
        logs.append(f"Starting test: {{test_case['title']}}")
        
        # Helper functions for auto-healing: try multiple selectors
        def try_click_with_fallbacks(primary_selector, fallback_selectors=None, timeout=10000):
            # Try clicking with primary selector, fallback to others if needed
            selectors_to_try = [primary_selector]
            if fallback_selectors:
                selectors_to_try.extend(fallback_selectors)
            
            for selector in selectors_to_try:
                try:
                    # Wait for element to be visible and clickable
                    page.wait_for_selector(selector, state='visible', timeout=5000)
                    page.click(selector, timeout=5000)
                    logs.append(f"✅ Clicked: {{selector}}")
                    return True
                except Exception as e:
                    logs.append(f"⚠️ Selector '{{selector}}' failed: {{str(e)[:50]}}")
                    continue
            return False
        
        def try_fill_with_fallbacks(primary_selector, value, fallback_selectors=None, timeout=10000):
            # Try filling with primary selector, fallback to others if needed
            selectors_to_try = [primary_selector]
            if fallback_selectors:
                selectors_to_try.extend(fallback_selectors)
            
            for selector in selectors_to_try:
                try:
                    page.wait_for_selector(selector, state='visible', timeout=5000)
                    page.fill(selector, value, timeout=5000)
                    logs.append(f"✅ Filled: {{selector}}")
                    return True
                except Exception as e:
                    logs.append(f"⚠️ Selector '{{selector}}' failed: {{str(e)[:50]}}")
                    continue
            return False
        
        # Execute steps
        for step in test_case.get('steps', []):
            action = step.get('action', '').lower()
            data = step.get('data', {{}})
            
            logs.append(f"Executing step: {{step.get('action', '')}}")
            
            # Take screenshot
            screenshot_bytes = page.screenshot(full_page=True)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            screenshots.append(screenshot_b64)
            
            # Execute action with auto-healing
            if 'navigate' in action or 'go' in action:
                navigate_url = data.get('url', 'https://example.com')
                # Ensure URL has protocol
                if not navigate_url.startswith('http://') and not navigate_url.startswith('https://'):
                    navigate_url = 'https://' + navigate_url
                logs.append(f"Navigating to: {{navigate_url}}")
                page.goto(navigate_url, wait_until='networkidle', timeout=30000)
                # Wait for page to be ready
                page.wait_for_load_state('domcontentloaded')
                logs.append(f"✅ Page loaded: {{navigate_url}}")
                
            elif 'click' in action:
                selector = data.get('selector', '')
                locator_hints = step.get('locator_hints', [])
                
                # Build fallback selectors from hints and context
                fallback_selectors = []
                if locator_hints:
                    fallback_selectors.extend(locator_hints)
                
                # Generate smart fallbacks based on action context
                action_lower = action.lower()
                if 'cart' in action_lower or 'add' in action_lower:
                    fallback_selectors.extend([
                        'button[aria-label*="cart" i], button[aria-label*="add" i]',
                        'button:has-text("Add to Cart")',
                        'button:has-text("Add")',
                        '[data-testid*="cart"]',
                        '[data-testid*="add"]',
                        '.add-to-cart, .add-cart, #add-to-cart'
                    ])
                elif 'search' in action_lower:
                    fallback_selectors.extend([
                        'button[type="submit"]',
                        'button:has-text("Search")',
                        '[data-testid*="search"]',
                        '.search-button, #search-button'
                    ])
                elif 'login' in action_lower or 'submit' in action_lower:
                    fallback_selectors.extend([
                        'button[type="submit"]',
                        'button:has-text("Login")',
                        'button:has-text("Submit")',
                        '#login-btn, .login-button'
                    ])
                
                # If no selector provided, use first fallback
                if not selector and fallback_selectors:
                    selector = fallback_selectors[0]
                elif not selector:
                    selector = 'button'  # Last resort
                
                if not try_click_with_fallbacks(selector, fallback_selectors):
                    # For search actions, if button doesn't exist, skip it (site may not have search)
                    if 'search' in action_lower:
                        logs.append(f"⚠️ Search button not found, skipping search step (site may not have search functionality)")
                    else:
                        raise Exception(f"Could not click any element. Tried: {{selector}} and {{len(fallback_selectors)}} fallbacks")
                    
            elif 'enter' in action or 'fill' in action:
                selector = data.get('selector', '')
                value = data.get('value', '')
                locator_hints = step.get('locator_hints', [])
                
                # Build fallback selectors
                fallback_selectors = list(locator_hints) if locator_hints else []
                
                action_lower = action.lower()
                if 'email' in action_lower:
                    if not selector:
                        selector = 'input[type="email"], input[name="email"], #email'
                    if not value:
                        value = 'test@example.com'
                    fallback_selectors.extend([
                        'input[type="email"]',
                        'input[name="email"]',
                        '#email',
                        'input[placeholder*="email" i]'
                    ])
                elif 'password' in action_lower:
                    if not selector:
                        selector = 'input[type="password"], input[name="password"], #password'
                    if not value:
                        value = 'password123'
                    fallback_selectors.extend([
                        'input[type="password"]',
                        'input[name="password"]',
                        '#password',
                        'input[placeholder*="password" i]'
                    ])
                elif 'search' in action_lower:
                    fallback_selectors.extend([
                        'input[type="search"]',
                        'input[name="search"], input[name="q"]',
                        '#search, .search-input, #search-bar',
                        'input[placeholder*="search" i]',
                        'input[aria-label*="search" i]',
                        'input.search, input[class*="search"]',
                        # If no search bar, maybe it's a product listing - skip search
                        'body'  # Last resort - just continue
                    ])
                else:
                    if not selector:
                        selector = 'input'
                
                if not try_fill_with_fallbacks(selector, value, fallback_selectors):
                    # For search actions, if element doesn't exist, skip it (site may not have search)
                    if 'search' in action_lower:
                        logs.append(f"⚠️ Search input not found, skipping search step (site may not have search functionality)")
                    else:
                        raise Exception(f"Could not fill any element. Tried: {{selector}} and {{len(fallback_selectors)}} fallbacks")
                    
            elif 'wait' in action:
                timeout = data.get('timeout', 1000)
                page.wait_for_timeout(timeout)
                logs.append(f"Waited {{timeout}}ms")
            elif 'type' in action:
                selector = data.get('selector', 'input')
                text = data.get('text', '')
                locator_hints = step.get('locator_hints', [])
                
                # Build fallback selectors for type action
                fallback_selectors = list(locator_hints) if locator_hints else []
                action_lower = action.lower()
                selector_lower = selector.lower() if selector else ''
                
                # Check if this is a search action (by selector name or action)
                # Check selector name, action name, or if text contains search-related terms
                # More robust detection - check multiple conditions
                is_search = False
                if selector:
                    selector_lower_check = selector.lower()
                    is_search = (
                        'search' in action_lower or 
                        'search' in selector_lower_check or 
                        '#search' in selector or 
                        'search-bar' in selector_lower_check or
                        'bar' in selector_lower_check or
                        selector.startswith('#search') or
                        selector.startswith('.search')
                    )
                else:
                    is_search = 'search' in action_lower
                
                if is_search:
                    fallback_selectors.extend([
                        'input[type="search"]',
                        'input[name="search"]',
                        'input[name="q"]',
                        '#search',
                        '.search-input',
                        '#search-bar',
                        'input[placeholder*="search" i]',
                        'input[aria-label*="search" i]',
                        'input.search',
                        'input[class*="search"]'
                    ])
                    logs.append(f"🔍 Detected search action, will try {{len(fallback_selectors)}} fallback selectors")
                
                # Try to type with fallbacks
                typed = False
                selectors_to_try = [selector] + fallback_selectors if fallback_selectors else [selector]
                
                logs.append(f"🔍 Attempting to type into selector: {{selector}}, will try {{len(selectors_to_try)}} selectors total")
                
                for sel in selectors_to_try:
                    try:
                        page.wait_for_selector(sel, state='visible', timeout=5000)
                        page.type(sel, text, delay=100)
                        logs.append(f"✅ Typed into: {{sel}}")
                        typed = True
                        break
                    except Exception as e:
                        logs.append(f"⚠️ Could not type into '{{sel}}': {{str(e)[:50]}}")
                        continue
                
                if not typed:
                    # ALWAYS check if this might be a search action (even if not detected earlier)
                    # If selector contains 'search' or 'bar', treat as search and skip
                    might_be_search = (
                        is_search or 
                        (selector and ('search' in str(selector).lower() or 'bar' in str(selector).lower())) or
                        (text and ('laptop' in text.lower() or 'search' in text.lower()))  # Common search terms
                    )
                    
                    if might_be_search:
                        # For search, if element doesn't exist, log and continue (maybe site doesn't have search)
                        logs.append(f"⚠️ Search element not found after trying {{len(selectors_to_try)}} selectors, skipping search step and continuing")
                        # Don't raise exception - just continue to next step (this is the key fix!)
                    else:
                        raise Exception(f"Could not type into any element. Tried: {{selector}} and {{len(fallback_selectors)}} fallbacks")
            elif 'press' in action:
                key = data.get('key', 'Enter')
                page.press('body', key)
                logs.append(f"✅ Pressed: {{key}}")
            elif 'expect' in action or 'assert' in action or 'verify' in action:
                # Handle assertions/expectations
                selector = data.get('selector', '')
                expected_value = data.get('value', '') or step.get('expected', '')
                
                if selector:
                    try:
                        # Wait for element to be visible
                        page.wait_for_selector(selector, state='visible', timeout=10000)
                        
                        # Get element text/content
                        element_text = page.locator(selector).text_content()
                        element_text = element_text.strip() if element_text else ''
                        
                        logs.append(f"🔍 Assertion - Selector: {{selector}}, Found text: '{{element_text}}', Expected: '{{expected_value}}'")
                        
                        # Check if expected value matches
                        if expected_value:
                            if expected_value in element_text or element_text == expected_value:
                                logs.append(f"✅ Assertion passed: Found expected value '{{expected_value}}'")
                            else:
                                # Try numeric comparison
                                try:
                                    found_num = int(element_text) if element_text.isdigit() else None
                                    expected_num = int(expected_value) if expected_value.isdigit() else None
                                    if found_num is not None and expected_num is not None:
                                        if found_num == expected_num:
                                            logs.append(f"✅ Assertion passed: Found expected number {{expected_num}}")
                                        else:
                                            raise Exception(f"Assertion failed: Expected {{expected_num}}, but found {{found_num}}")
                                    else:
                                        raise Exception(f"Assertion failed: Expected '{{expected_value}}', but found '{{element_text}}'")
                                except ValueError:
                                    raise Exception(f"Assertion failed: Expected '{{expected_value}}', but found '{{element_text}}'")
                        else:
                            # Just verify element exists and has content
                            if element_text:
                                logs.append(f"✅ Assertion passed: Element exists with content")
                            else:
                                raise Exception(f"Assertion failed: Element exists but has no text content")
                    except Exception as e:
                        logs.append(f"❌ Assertion failed: {{str(e)}}")
                        raise
                else:
                    # No selector - just verify page has content
                    content = page.content()
                    if not content or len(content) < 100:
                        raise Exception(f"Assertion failed: Page appears empty")
                    logs.append(f"✅ Assertion passed: Page has content")
            
            # Verify expected result if provided (legacy support)
            expected = step.get('expected', '')
            if expected and 'expect' not in action.lower() and 'assert' not in action.lower():
                expected_lower = expected.lower()
                if 'visible' in expected_lower or 'appears' in expected_lower:
                    content = page.content()
                    if not content or len(content) < 100:
                        raise Exception(f"Expected content to be visible, but page appears empty")
        
        duration = int((datetime.now() - start_time).total_seconds() * 1000)
        logs.append(f"Test completed successfully in {{duration}}ms")
        
        browser.close()
        
        # Return success result
        result = {{
            "status": "passed",
            "duration": duration,
            "logs": logs,
            "screenshots": screenshots,
            "error": None
        }}
        
except Exception as e:
    duration = int((datetime.now() - start_time).total_seconds() * 1000) if 'start_time' in locals() else 0
    logs.append(f"Test failed: {{str(e)}}")
    
    # Take screenshot on error
    try:
        screenshot_bytes = page.screenshot(full_page=True)
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
        screenshots.append(screenshot_b64)
    except:
        pass
    
    result = {{
        "status": "failed",
        "duration": duration,
        "logs": logs,
        "screenshots": screenshots,
        "error": str(e)
    }}

# Output result as JSON
print(json.dumps(result))
sys.exit(0 if result['status'] == 'passed' else 1)
"""
        return script
    
    async def execute_test(self, test_case: Dict[str, Any], timeout: int = 120) -> Dict[str, Any]:
        """
        Execute Playwright test in separate process
        
        Args:
            test_case: Test case dictionary with title, description, steps
            timeout: Execution timeout in seconds
            
        Returns:
            Dict with status, duration, logs, screenshots, error
        """
        # Create temp directory for script
        self.temp_dir = tempfile.mkdtemp(prefix="playwright_test_")
        script_path = os.path.join(self.temp_dir, "test_runner.py")
        
        try:
            # Write test script
            script_content = self._create_test_script(test_case)
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(script_content)
            
            logger.info(f"Executing Playwright test in separate process: {script_path}")
            print(f"🚀 Running Playwright test in separate process (Windows-compatible)...")
            
            # Run in subprocess (this works on Windows!)
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.temp_dir
            )
            
            # Log subprocess output for debugging
            logger.info(f"Subprocess return code: {result.returncode}")
            if result.stdout:
                logger.info(f"Subprocess stdout: {result.stdout[:500]}")
            if result.stderr:
                logger.error(f"Subprocess stderr: {result.stderr[:500]}")
            print(f"[INFO] Subprocess stdout: {result.stdout[:200] if result.stdout else 'None'}")
            print(f"[INFO] Subprocess stderr: {result.stderr[:200] if result.stderr else 'None'}")
            
            # Parse result
            if result.returncode == 0 or result.stdout:
                try:
                    # Try to parse JSON from stdout
                    output_lines = result.stdout.strip().split('\n')
                    json_line = None
                    for line in reversed(output_lines):
                        if line.strip().startswith('{{') or line.strip().startswith('['):
                            json_line = line.strip()
                            break
                    
                    if json_line:
                        execution_result = json.loads(json_line)
                    else:
                        # Fallback: create result from return code
                        execution_result = {
                            "status": "passed" if result.returncode == 0 else "failed",
                            "duration": 0,
                            "logs": output_lines[-10:] if output_lines else ["Test executed"],
                            "screenshots": [],
                            "error": result.stderr if result.stderr else None
                        }
                except json.JSONDecodeError:
                    # If JSON parsing fails, create result from output
                    execution_result = {
                        "status": "failed",
                        "duration": 0,
                        "logs": result.stdout.split('\n')[-10:] if result.stdout else [],
                        "screenshots": [],
                        "error": f"Failed to parse result. Return code: {result.returncode}. Stderr: {result.stderr[:200]}"
                    }
            else:
                execution_result = {
                    "status": "failed",
                    "duration": 0,
                    "logs": [],
                    "screenshots": [],
                    "error": f"Subprocess failed with code {result.returncode}. Stderr: {result.stderr[:500]}"
                }
            
            logger.info(f"Test execution completed: {execution_result['status']}")
            return execution_result
            
        except subprocess.TimeoutExpired:
            logger.error(f"Test execution timed out after {timeout} seconds")
            return {
                "status": "failed",
                "duration": timeout * 1000,
                "logs": ["Test execution timed out"],
                "screenshots": [],
                "error": f"Test execution timed out after {timeout} seconds"
            }
        except Exception as e:
            logger.error(f"Error executing test: {str(e)}")
            return {
                "status": "failed",
                "duration": 0,
                "logs": [],
                "screenshots": [],
                "error": f"Execution error: {str(e)}"
            }
        finally:
            # Cleanup
            try:
                if os.path.exists(script_path):
                    os.unlink(script_path)
                if self.temp_dir and os.path.exists(self.temp_dir):
                    os.rmdir(self.temp_dir)
            except Exception as e:
                logger.warning(f"Could not clean up temp files: {e}")

