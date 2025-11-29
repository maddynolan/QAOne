from typing import List, Dict, Any, Optional
import asyncio
import json
import base64
from datetime import datetime
import platform
import logging
import concurrent.futures

logger = logging.getLogger(__name__)

# Use sync Playwright on Windows, async on other platforms
if platform.system() == "Windows":
    from playwright.sync_api import sync_playwright, Browser, Page
    USE_SYNC_PLAYWRIGHT = True
else:
    from playwright.async_api import async_playwright, Browser, Page
    USE_SYNC_PLAYWRIGHT = False

class TestStep:
    def __init__(self, action: str, data: Optional[Dict[str, Any]] = None, 
                 expected: str = "", locator_hints: Optional[List[str]] = None):
        self.action = action
        self.data = data or {}
        self.expected = expected
        self.locator_hints = locator_hints or []

class TestCase:
    def __init__(self, case_id: str, title: str, description: str = "", 
                 priority: str = "P2", tags: Optional[List[str]] = None, 
                 steps: Optional[List[TestStep]] = None):
        self.case_id = case_id
        self.title = title
        self.description = description
        self.priority = priority
        self.tags = tags or []
        self.steps = steps or []

class TestRunResult:
    def __init__(self, case_id: str, status: str, duration: int, 
                 error: Optional[str] = None, screenshots: Optional[List[str]] = None,
                 logs: Optional[List[str]] = None):
        self.case_id = case_id
        self.status = status  # 'passed', 'failed', 'skipped'
        self.duration = duration
        self.error = error
        self.screenshots = screenshots or []
        self.logs = logs or []

class PlaywrightRunner:
    def __init__(self):
        self.browser: Optional[Browser] = None
        self.page: Optional[Page] = None
        self.playwright = None
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=1) if USE_SYNC_PLAYWRIGHT else None
        self._windows_mode = False  # Flag for Windows execution limitation
        self._executor = None  # Subprocess executor for Windows

    async def _run_sync(self, func):
        """Helper to run sync Playwright operations in thread pool"""
        if USE_SYNC_PLAYWRIGHT:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(self.executor, func)
        else:
            return await func()

    async def initialize(self):
        """Initialize Playwright browser"""
        # On Windows, use subprocess executor instead
        if USE_SYNC_PLAYWRIGHT:
            from app.services.executors.playwright_executor import PlaywrightExecutor
            self._executor = PlaywrightExecutor()
            self._windows_mode = True
            logger.info("Using subprocess-based Playwright executor for Windows compatibility")
            return
        
        try:
            if USE_SYNC_PLAYWRIGHT:
                # Windows: Use subprocess to run Playwright in separate process
                # This avoids asyncio subprocess limitations on Windows
                import subprocess
                import sys
                import tempfile
                import os
                
                # Create a temporary script that initializes Playwright
                script_content = f"""
import sys
import json
from playwright.sync_api import sync_playwright

try:
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Return success
    print(json.dumps({{"status": "success", "message": "Playwright initialized"}}))
    sys.exit(0)
except Exception as e:
    print(json.dumps({{"status": "error", "message": str(e)}}))
    sys.exit(1)
"""
                
                # Write script to temp file
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                    f.write(script_content)
                    script_path = f.name
                
                try:
                    # Run in subprocess with new event loop
                    result = subprocess.run(
                        [sys.executable, script_path],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if result.returncode != 0:
                        error_data = json.loads(result.stdout) if result.stdout else {}
                        raise Exception(error_data.get("message", "Playwright initialization failed"))
                    
                    # For Windows, we'll use a different approach - generate code but don't execute
                    # Instead, return a mock result that indicates code was generated
                    logger.warning("Playwright execution on Windows is limited. Code will be generated but execution is disabled.")
                    self.playwright = None
                    self.browser = None
                    self.page = None
                    self._windows_mode = True  # Flag to indicate Windows mode
                    return
                    
                finally:
                    # Clean up temp file
                    try:
                        os.unlink(script_path)
                    except:
                        pass
            else:
                # Linux/Mac: Use async Playwright
                self.playwright = await async_playwright().start()
                self.browser = await self.playwright.chromium.launch(headless=True)
                self.page = await self.browser.new_page()
                self._windows_mode = False
            
        except Exception as e:
            error_msg = str(e)
            if "NotImplementedError" in error_msg or "subprocess" in error_msg.lower():
                # On Windows, allow code generation but skip execution
                logger.warning("Playwright cannot execute on Windows. Code will be generated but execution is disabled.")
                self.playwright = None
                self.browser = None
                self.page = None
                self._windows_mode = True
                return
            raise

    async def cleanup(self):
        """Clean up browser resources"""
        if USE_SYNC_PLAYWRIGHT:
            def cleanup_sync():
                if self.page:
                    self.page.close()
                if self.browser:
                    self.browser.close()
                if self.playwright:
                    self.playwright.stop()
            
            await self._run_sync(cleanup_sync)
            if self.executor:
                self.executor.shutdown(wait=True)
        else:
            if self.page:
                await self.page.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()

    async def run_test_case(self, test_case: TestCase) -> TestRunResult:
        """Run a single test case"""
        # On Windows, use subprocess executor (works on Windows!)
        if hasattr(self, '_windows_mode') and self._windows_mode and hasattr(self, '_executor') and self._executor:
            logger.info("Using subprocess executor for Windows - this will work!")
            print("🚀 Using subprocess executor for Windows compatibility")
            
            # Convert TestCase to dict for executor
            test_case_dict = {
                "title": test_case.title,
                "description": test_case.description,
                "steps": [
                    {
                        "action": step.action,
                        "data": step.data,
                        "expected": step.expected
                    }
                    for step in test_case.steps
                ]
            }
            
            # Execute in separate process (this works on Windows!)
            result = await self._executor.execute_test(test_case_dict)
            
            return TestRunResult(
                case_id=test_case.case_id,
                status=result['status'],
                duration=result['duration'],
                error=result.get('error'),
                logs=result.get('logs', []),
                screenshots=result.get('screenshots', [])
            )
        
        # On Linux/Mac, use normal async execution
        if not self.page:
            raise Exception("Playwright not initialized")

        start_time = datetime.now()
        logs = []
        screenshots = []

        try:
            logs.append(f"Starting test: {test_case.title}")

            for step in test_case.steps:
                logs.append(f"Executing step: {step.action}")
                
                # Take screenshot before each step
                if USE_SYNC_PLAYWRIGHT:
                    screenshot_bytes = await self._run_sync(lambda: self.page.screenshot(full_page=True))
                else:
                    screenshot_bytes = await self.page.screenshot(full_page=True)
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                screenshots.append(screenshot_b64)

                # Execute the step
                await self._execute_step(step)
                
                # Verify expected result
                if step.expected:
                    await self._verify_expected(step.expected)

            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            logs.append(f"Test completed successfully in {duration}ms")

            return TestRunResult(
                case_id=test_case.case_id,
                status='passed',
                duration=duration,
                logs=logs,
                screenshots=screenshots
            )

        except Exception as error:
            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            logs.append(f"Test failed: {str(error)}")
            
            # Take final screenshot on failure
            try:
                if USE_SYNC_PLAYWRIGHT:
                    screenshot_bytes = await self._run_sync(lambda: self.page.screenshot(full_page=True))
                else:
                    screenshot_bytes = await self.page.screenshot(full_page=True)
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                screenshots.append(screenshot_b64)
            except:
                pass

            return TestRunResult(
                case_id=test_case.case_id,
                status='failed',
                duration=duration,
                error=str(error),
                logs=logs,
                screenshots=screenshots
            )

    async def _execute_step(self, step: TestStep):
        """Execute a single test step"""
        if not self.page:
            return

        action = step.action.lower()
        data = step.data or {}

        if USE_SYNC_PLAYWRIGHT:
            # Windows: Run all operations in thread pool
            if 'navigate' in action:
                url = data.get('url', 'https://example.com')
                await self._run_sync(lambda: self.page.goto(url))
            elif 'click' in action:
                if 'login' in action.lower() and 'button' in action.lower():
                    await self._run_sync(lambda: self.page.click('button[type="submit"], #login-btn, .login-button, button:has-text("Login")'))
                else:
                    selector = data.get('selector', 'button')
                    await self._run_sync(lambda: self.page.click(selector))
            elif 'enter' in action or 'fill' in action:
                if 'email' in action.lower() and 'password' in action.lower():
                    await self._run_sync(lambda: self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com'))
                    await self._run_sync(lambda: self.page.fill('input[type="password"], input[name="password"], #password', 'password123'))
                elif 'email' in action.lower():
                    await self._run_sync(lambda: self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com'))
                elif 'password' in action.lower():
                    await self._run_sync(lambda: self.page.fill('input[type="password"], input[name="password"], #password', 'password123'))
                else:
                    selector = data.get('selector', 'input')
                    value = data.get('value', '')
                    await self._run_sync(lambda: self.page.fill(selector, value))
            elif 'wait' in action:
                timeout = data.get('timeout', 1000)
                await self._run_sync(lambda: self.page.wait_for_timeout(timeout))
            elif 'select' in action:
                selector = data.get('selector', 'select')
                value = data.get('value', '')
                await self._run_sync(lambda: self.page.select_option(selector, value))
            elif 'check' in action and 'page' not in action.lower():
                selector = data.get('selector', 'input[type="checkbox"]')
                await self._run_sync(lambda: self.page.check(selector))
            elif 'uncheck' in action:
                selector = data.get('selector', 'input[type="checkbox"]')
                await self._run_sync(lambda: self.page.uncheck(selector))
            elif 'type' in action:
                selector = data.get('selector', 'input')
                text = data.get('text', '')
                await self._run_sync(lambda: self.page.type(selector, text))
            elif 'press' in action:
                key = data.get('key', 'Enter')
                await self._run_sync(lambda: self.page.press('body', key))
            elif 'hover' in action:
                selector = data.get('selector', 'button')
                await self._run_sync(lambda: self.page.hover(selector))
            elif 'scroll' in action:
                direction = data.get('direction', 'down')
                if direction == 'down':
                    await self._run_sync(lambda: self.page.evaluate('window.scrollBy(0, 500)'))
                else:
                    await self._run_sync(lambda: self.page.evaluate('window.scrollBy(0, -500)'))
        else:
            # Linux/Mac: Use async operations
            if 'navigate' in action:
                url = data.get('url', 'https://example.com')
                await self.page.goto(url)
            elif 'click' in action:
                if 'login' in action.lower() and 'button' in action.lower():
                    await self.page.click('button[type="submit"], #login-btn, .login-button, button:has-text("Login")')
                else:
                    selector = data.get('selector', 'button')
                    await self.page.click(selector)
            elif 'enter' in action or 'fill' in action:
                if 'email' in action.lower() and 'password' in action.lower():
                    await self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com')
                    await self.page.fill('input[type="password"], input[name="password"], #password', 'password123')
                elif 'email' in action.lower():
                    await self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com')
                elif 'password' in action.lower():
                    await self.page.fill('input[type="password"], input[name="password"], #password', 'password123')
                else:
                    selector = data.get('selector', 'input')
                    value = data.get('value', '')
                    await self.page.fill(selector, value)
            elif 'wait' in action:
                timeout = data.get('timeout', 1000)
                await self.page.wait_for_timeout(timeout)
            elif 'select' in action:
                selector = data.get('selector', 'select')
                value = data.get('value', '')
                await self.page.select_option(selector, value)
            elif 'check' in action and 'page' not in action.lower():
                selector = data.get('selector', 'input[type="checkbox"]')
                await self.page.check(selector)
            elif 'uncheck' in action:
                selector = data.get('selector', 'input[type="checkbox"]')
                await self.page.uncheck(selector)
            elif 'type' in action:
                selector = data.get('selector', 'input')
                text = data.get('text', '')
                await self.page.type(selector, text)
            elif 'press' in action:
                key = data.get('key', 'Enter')
                await self.page.press('body', key)
            elif 'hover' in action:
                selector = data.get('selector', 'button')
                await self.page.hover(selector)
            elif 'scroll' in action:
                direction = data.get('direction', 'down')
                if direction == 'down':
                    await self.page.evaluate('window.scrollBy(0, 500)')
                else:
                    await self.page.evaluate('window.scrollBy(0, -500)')

    async def _verify_expected(self, expected: str):
        """Verify expected result"""
        if not self.page:
            return

        expected_lower = expected.lower()
        
        if USE_SYNC_PLAYWRIGHT:
            # Windows: Run verification in thread pool
            if 'visible' in expected_lower or 'appears' in expected_lower or 'shows' in expected_lower:
                # Check if page has content
                content = await self._run_sync(lambda: self.page.content())
                if not content or len(content) < 100:
                    raise Exception(f"Expected content to be visible, but page appears empty")
            elif 'error' in expected_lower or 'fail' in expected_lower:
                # Check for error messages
                content = await self._run_sync(lambda: self.page.content())
                if 'error' not in content.lower() and 'fail' not in content.lower():
                    raise Exception(f"Expected error message, but none found")
        else:
            # Linux/Mac: Use async verification
            if 'visible' in expected_lower or 'appears' in expected_lower or 'shows' in expected_lower:
                content = await self.page.content()
                if not content or len(content) < 100:
                    raise Exception(f"Expected content to be visible, but page appears empty")
            elif 'error' in expected_lower or 'fail' in expected_lower:
                content = await self.page.content()
                if 'error' not in content.lower() and 'fail' not in content.lower():
                    raise Exception(f"Expected error message, but none found")
