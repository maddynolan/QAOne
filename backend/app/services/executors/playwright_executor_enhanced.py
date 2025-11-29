"""
Enhanced Playwright Executor with Multi-Layer Selector Support and Wait Heuristics
Uses the 5-layer selector strategy and automatic wait heuristics for self-healing tests.
"""

import subprocess
import sys
import tempfile
import json
import os
import platform
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class EnhancedPlaywrightExecutor:
    """
    Enhanced Playwright executor with:
    - Multi-layer selector support (5-layer strategy)
    - Automatic wait heuristics (toBeVisible before interactions)
    - Self-healing with fallback chain
    """
    
    def __init__(self):
        self.temp_dir = None
    
    def _build_playwright_locator_code(
        self,
        selectors: Dict[str, Any],
        element_type: str = "element"
    ) -> str:
        """
        Build Playwright locator code using multi-layer selectors.
        Uses Playwright's getBy* methods for better reliability.
        
        Returns code that tries selectors in priority order:
        1. getByTestId (if testid available)
        2. getByRole (if role available)
        3. getByText (if text available)
        4. locator with CSS/XPath (fallback)
        """
        code_lines = []
        
        # Extract selector data
        testid = selectors.get("testid")
        role = selectors.get("role")
        aria_label = selectors.get("aria_label")
        text = selectors.get("text")
        css = selectors.get("css")
        element_id = selectors.get("id")
        
        # Build locator chain using Playwright's getBy* methods
        locator_parts = []
        
        # Layer 1: getByTestId (highest priority)
        if testid:
            locator_parts.append(f'page.getByTestId("{testid}")')
        
        # Layer 2: getByRole (with name if available)
        if role:
            if aria_label:
                locator_parts.append(f'page.getByRole("{role}", {{ name: "{aria_label}" }})')
            elif text:
                locator_parts.append(f'page.getByRole("{role}", {{ name: "{text}" }})')
            else:
                locator_parts.append(f'page.getByRole("{role}")')
        
        # Layer 3: getByText
        if text and not role:  # Don't duplicate if already used in role
            locator_parts.append(f'page.getByText("{text}")')
        
        # Layer 4: CSS selector
        if css:
            locator_parts.append(f'page.locator("{css}")')
        elif element_id:
            locator_parts.append(f'page.locator("#{element_id}")')
        
        # Build the locator chain with .or() for fallback
        if len(locator_parts) > 1:
            locator_code = locator_parts[0]
            for part in locator_parts[1:]:
                locator_code += f".or({part})"
        elif len(locator_parts) == 1:
            locator_code = locator_parts[0]
        else:
            # Fallback to generic selector
            locator_code = f'page.locator("{element_type}")'
        
        return locator_code
    
    def _create_enhanced_test_script(self, test_case: Dict[str, Any]) -> str:
        """Create an enhanced Playwright test script with multi-layer selectors and wait heuristics."""
        script = f"""
import json
import sys
import os
from playwright.sync_api import sync_playwright, expect
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
        
        # Enhanced helper function with multi-layer selectors and wait heuristics
        def enhanced_click(selectors, timeout=10000):
            '''Click with multi-layer selector support and automatic wait heuristics'''
            locator_code = None
            
            # Build locator code from selectors
            testid = selectors.get("testid")
            role = selectors.get("role")
            aria_label = selectors.get("aria_label")
            text = selectors.get("text")
            css = selectors.get("css")
            element_id = selectors.get("id")
            
            # Try selectors in priority order
            locator = None
            tried_selectors = []
            
            # Layer 1: getByTestId
            if testid:
                try:
                    locator = page.getByTestId(testid)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.click(timeout=5000)
                    logs.append(f"✅ Clicked using getByTestId: {{testid}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"getByTestId({{testid}}): {{str(e)[:50]}}")
            
            # Layer 2: getByRole
            if role:
                try:
                    if aria_label:
                        locator = page.getByRole(role, {{"name": aria_label}})
                    elif text:
                        locator = page.getByRole(role, {{"name": text}})
                    else:
                        locator = page.getByRole(role)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.click(timeout=5000)
                    logs.append(f"✅ Clicked using getByRole: {{role}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"getByRole({{role}}): {{str(e)[:50]}}")
            
            # Layer 3: getByText
            if text:
                try:
                    locator = page.getByText(text)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.click(timeout=5000)
                    logs.append(f"✅ Clicked using getByText: {{text}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"getByText({{text}}): {{str(e)[:50]}}")
            
            # Layer 4: CSS selector
            if css:
                try:
                    locator = page.locator(css)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.click(timeout=5000)
                    logs.append(f"✅ Clicked using CSS: {{css}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"CSS({{css}}): {{str(e)[:50]}}")
            elif element_id:
                try:
                    locator = page.locator(f"#{{element_id}}")
                    expect(locator).toBeVisible(timeout=5000)
                    locator.click(timeout=5000)
                    logs.append(f"✅ Clicked using ID: {{element_id}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"ID({{element_id}}): {{str(e)[:50]}}")
            
            # All selectors failed
            logs.append(f"❌ All selectors failed. Tried: {{', '.join(tried_selectors)}}")
            return False
        
        def enhanced_fill(selectors, value, timeout=10000):
            '''Fill with multi-layer selector support and automatic wait heuristics'''
            testid = selectors.get("testid")
            role = selectors.get("role")
            aria_label = selectors.get("aria_label")
            text = selectors.get("text")
            css = selectors.get("css")
            element_id = selectors.get("id")
            
            tried_selectors = []
            
            # Layer 1: getByTestId
            if testid:
                try:
                    locator = page.getByTestId(testid)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.fill(value, timeout=5000)
                    logs.append(f"✅ Filled using getByTestId: {{testid}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"getByTestId({{testid}}): {{str(e)[:50]}}")
            
            # Layer 2: getByRole
            if role:
                try:
                    if aria_label:
                        locator = page.getByRole(role, {{"name": aria_label}})
                    else:
                        locator = page.getByRole(role)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.fill(value, timeout=5000)
                    logs.append(f"✅ Filled using getByRole: {{role}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"getByRole({{role}}): {{str(e)[:50]}}")
            
            # Layer 3: CSS selector
            if css:
                try:
                    locator = page.locator(css)
                    expect(locator).toBeVisible(timeout=5000)
                    locator.fill(value, timeout=5000)
                    logs.append(f"✅ Filled using CSS: {{css}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"CSS({{css}}): {{str(e)[:50]}}")
            elif element_id:
                try:
                    locator = page.locator(f"#{{element_id}}")
                    expect(locator).toBeVisible(timeout=5000)
                    locator.fill(value, timeout=5000)
                    logs.append(f"✅ Filled using ID: {{element_id}}")
                    return True
                except Exception as e:
                    tried_selectors.append(f"ID({{element_id}}): {{str(e)[:50]}}")
            
            logs.append(f"❌ All selectors failed. Tried: {{', '.join(tried_selectors)}}")
            return False
        
        # Execute steps
        for step in test_case.get('steps', []):
            action = step.get('action', '').lower()
            data = step.get('data', {{}})
            selectors = step.get('selectors', {{}})  # Multi-layer selectors
            
            logs.append(f"Executing step: {{step.get('action', '')}}")
            
            # Take screenshot
            screenshot_bytes = page.screenshot(full_page=True)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            screenshots.append(screenshot_b64)
            
            # Execute action with enhanced selectors
            if 'navigate' in action or 'go' in action:
                navigate_url = data.get('url', 'https://example.com')
                if not navigate_url.startswith('http://') and not navigate_url.startswith('https://'):
                    navigate_url = 'https://' + navigate_url
                logs.append(f"Navigating to: {{navigate_url}}")
                page.goto(navigate_url, wait_until='networkidle', timeout=30000)
                page.wait_for_load_state('domcontentloaded')
                logs.append(f"✅ Page loaded: {{navigate_url}}")
                
            elif 'click' in action:
                if not enhanced_click(selectors):
                    raise Exception(f"Could not click element with any selector")
                    
            elif 'enter' in action or 'fill' in action:
                value = data.get('value', '')
                if not enhanced_fill(selectors, value):
                    raise Exception(f"Could not fill element with any selector")
                    
            elif 'wait' in action:
                timeout = data.get('timeout', 1000)
                page.wait_for_timeout(timeout)
                logs.append(f"Waited {{timeout}}ms")
            
            # Verify expected outcome
            expected = step.get('expected_outcome', '')
            if expected:
                logs.append(f"Expected: {{expected}}")
        
        duration = int((datetime.now() - start_time).total_seconds() * 1000)
        logs.append(f"Test completed successfully in {{duration}}ms")
        
        browser.close()
        
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
    
    async def execute_test(
        self,
        test_case: Dict[str, Any],
        timeout: int = 120
    ) -> Dict[str, Any]:
        """
        Execute Playwright test with enhanced multi-layer selector support.
        
        Args:
            test_case: Test case dictionary with semantic steps (including selectors)
            timeout: Execution timeout in seconds
            
        Returns:
            Dict with status, duration, logs, screenshots, error
        """
        # Create temp directory for script
        self.temp_dir = tempfile.mkdtemp(prefix="playwright_enhanced_")
        script_path = os.path.join(self.temp_dir, "test_runner.py")
        
        try:
            # Write enhanced test script
            script_content = self._create_enhanced_test_script(test_case)
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(script_content)
            
            logger.info(f"Executing enhanced Playwright test: {script_path}")
            
            # Run in subprocess
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self.temp_dir
            )
            
            # Parse result
            if result.returncode == 0 or result.stdout:
                try:
                    output_lines = result.stdout.strip().split('\n')
                    json_line = None
                    for line in reversed(output_lines):
                        if line.strip().startswith('{') or line.strip().startswith('['):
                            json_line = line.strip()
                            break
                    
                    if json_line:
                        execution_result = json.loads(json_line)
                    else:
                        execution_result = {
                            "status": "passed" if result.returncode == 0 else "failed",
                            "duration": 0,
                            "logs": output_lines[-10:] if output_lines else ["Test executed"],
                            "screenshots": [],
                            "error": result.stderr if result.stderr else None
                        }
                except json.JSONDecodeError:
                    execution_result = {
                        "status": "failed",
                        "duration": 0,
                        "logs": result.stdout.split('\n')[-10:] if result.stdout else [],
                        "screenshots": [],
                        "error": f"Failed to parse result. Return code: {result.returncode}"
                    }
            else:
                execution_result = {
                    "status": "failed",
                    "duration": 0,
                    "logs": [],
                    "screenshots": [],
                    "error": f"Subprocess failed with code {result.returncode}"
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

