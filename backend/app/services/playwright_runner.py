from playwright.async_api import async_playwright, Browser, Page
from typing import List, Dict, Any, Optional
import asyncio
import json
import base64
from datetime import datetime

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

    async def initialize(self):
        """Initialize Playwright browser"""
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()

    async def cleanup(self):
        """Clean up browser resources"""
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def run_test_case(self, test_case: TestCase) -> TestRunResult:
        """Run a single test case"""
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
            screenshot_bytes = await self.page.screenshot(full_page=True)
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            screenshots.append(screenshot_b64)

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

        if 'navigate' in action:
            url = data.get('url', 'https://example.com')
            await self.page.goto(url)
        elif 'click' in action:
            # Handle natural language click actions
            if 'login' in action.lower() and 'button' in action.lower():
                await self.page.click('button[type="submit"], #login-btn, .login-button, button:has-text("Login")')
            elif 'button' in action.lower():
                selector = data.get('selector', 'button')
                await self.page.click(selector)
            else:
                selector = data.get('selector', 'button')
                await self.page.click(selector)
        elif 'enter' in action or 'fill' in action:
            # Handle "Enter valid email and password" type actions
            if 'email' in action.lower() and 'password' in action.lower():
                # Split email and password actions
                await self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com')
                await self.page.fill('input[type="password"], input[name="password"], #password', 'password123')
            elif 'email' in action.lower():
                await self.page.fill('input[type="email"], input[name="email"], #email', 'test@example.com')
            elif 'password' in action.lower():
                await self.page.fill('input[type="password"], input[name="password"], #password', 'password123')
            else:
                # Generic fill action
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
        elif 'hover' in action:
            selector = data.get('selector', 'button')
            await self.page.hover(selector)
        elif 'press' in action:
            key = data.get('key', 'Enter')
            await self.page.press('body', key)
        elif 'verify' in action or 'check' in action:
            # Verification actions - these are handled by the expected verification
            # Just wait a moment for the page to be ready
            await self.page.wait_for_timeout(1000)
        else:
            raise Exception(f"Unknown action: {step.action}")

    async def _verify_expected(self, expected: str):
        """Verify expected result"""
        if not self.page:
            return

        expected_lower = expected.lower()

        if 'visible' in expected_lower:
            import re
            match = re.search(r'visible\s+(\S+)', expected)
            if match:
                selector = match.group(1)
                await self.page.wait_for_selector(selector, state='visible')
        elif 'hidden' in expected_lower:
            import re
            match = re.search(r'hidden\s+(\S+)', expected)
            if match:
                selector = match.group(1)
                await self.page.wait_for_selector(selector, state='hidden')
        elif 'contains' in expected_lower:
            import re
            match = re.search(r'contains\s+"([^"]+)"', expected)
            if match:
                text = match.group(1)
                await self.page.wait_for_selector(f'text={text}')
        elif 'url' in expected_lower:
            import re
            match = re.search(r'url\s+(\S+)', expected)
            if match:
                url = match.group(1)
                await self.page.wait_for_url(url)
        elif 'title' in expected_lower:
            import re
            match = re.search(r'title\s+"([^"]+)"', expected)
            if match:
                title = match.group(1)
                await self.page.wait_for_function(
                    f"document.title === '{title}'"
                )
            elif 'contains' in expected_lower:
                # Handle "Title contains 'Example Domain'" pattern
                match = re.search(r'contains\s+"([^"]+)"', expected)
                if match:
                    text = match.group(1)
                    await self.page.wait_for_function(
                        f"document.title.includes('{text}')"
                    )

# Global instance
playwright_runner = PlaywrightRunner()
