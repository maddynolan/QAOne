"""
Test Execution Service
Provides environment to run recorded Playwright tests directly.
Supports local execution, CI/CD integration, and test reporting.
"""

import logging
import os
import json
import tempfile
import subprocess
import asyncio
import re
import sys
import shutil
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
from pathlib import Path

logger = logging.getLogger(__name__)


class TestExecutionService:
    """
    Service for executing Playwright tests in isolated environments.
    Supports:
    - Local execution
    - CI/CD integration
    - Cross-browser testing
    - Parallel execution
    - Test reporting
    """
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        self.test_results_dir = os.path.join(self.temp_dir, "flowstral_test_results")
        os.makedirs(self.test_results_dir, exist_ok=True)
        # Lazy import to avoid circular dependency
        self._script_converter = None
    
    async def execute_test(
        self,
        test_code: str,
        test_name: str = "flowstral_test",
        browser: str = "chromium",
        headless: bool = True,
        timeout: int = 30000,
        environment: str = "local"
    ) -> Dict[str, Any]:
        """
        Execute Playwright test code.
        
        Args:
            test_code: Playwright TypeScript test code
            test_name: Name for the test
            browser: Browser to use (chromium, firefox, webkit)
            headless: Run in headless mode
            timeout: Test timeout in milliseconds
            environment: Execution environment (local, ci, docker)
            
        Returns:
            Dict with execution results
        """
        start_time = datetime.utcnow()
        
        try:
            logger.info(f"Starting test execution: {test_name}, browser={browser}, headless={headless}")
            
            # Create temporary test file
            test_file = self._create_test_file(test_code, test_name)
            logger.info(f"Created test file: {test_file}")
            
            # Setup Playwright project if needed
            logger.info("Ensuring Playwright is set up...")
            await self._ensure_playwright_setup(test_file.parent)
            logger.info("Playwright setup complete")
            
            # Execute test
            logger.info("Starting Playwright test execution...")
            result = await self._run_playwright_test(
                test_file,
                browser=browser,
                headless=headless,
                timeout=timeout
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Determine status based on exit code
            status = "success" if result["exit_code"] == 0 else "failed"
            logger.info(f"Test execution finished: status={status}, exit_code={result['exit_code']}, time={execution_time:.2f}s")
            
            # Auto-create defect if test failed
            defect_id = None
            if status == "failed":
                try:
                    defect_id = await self._create_defect_from_test_failure(
                        test_name=test_name,
                        error_message=result.get("stderr", result.get("stdout", "Test execution failed")),
                        execution_time=execution_time,
                        browser=browser,
                        test_code=test_code,
                        screenshot_path=result.get("screenshot_path"),
                        video_path=result.get("video_path")
                    )
                    logger.info(f"Created defect from test failure: {defect_id}")
                except Exception as defect_error:
                    logger.warning(f"Failed to create defect from test failure: {defect_error}")
            
            return {
                "status": status,
                "test_name": test_name,
                "browser": browser,
                "execution_time_seconds": execution_time,
                "exit_code": result["exit_code"],
                "defect_id": defect_id,
                "stdout": result["stdout"],
                "defect_id": defect_id,
                "stderr": result["stderr"],
                "test_file": str(test_file),
                "screenshots": result.get("screenshots", []),
                "video": result.get("video"),
                "trace": result.get("trace"),
                "environment": environment,
                "timestamp": start_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Test execution failed: {e}", exc_info=True)
            error_msg = str(e)
            
            # Provide helpful error messages
            if "npm" in error_msg.lower() or "node" in error_msg.lower():
                error_msg = f"{error_msg}\n\nPlease ensure Node.js and npm are installed and available in PATH."
            elif "playwright" in error_msg.lower() and "not found" in error_msg.lower():
                error_msg = f"{error_msg}\n\nPlaywright installation may have failed. Check backend logs for npm install errors."
            elif "timeout" in error_msg.lower():
                error_msg = f"{error_msg}\n\nThe test execution exceeded the 5-minute timeout limit."
            
            return {
                "status": "error",
                "test_name": test_name,
                "error": error_msg,
                "execution_time_seconds": (datetime.utcnow() - start_time).total_seconds(),
                "timestamp": start_time.isoformat(),
                "browser": browser,
                "stdout": "",
                "stderr": error_msg
            }
    
    def _create_test_file(self, test_code: str, test_name: str) -> Path:
        """Create temporary test file with test code."""
        # Sanitize test name for filename
        safe_name = re.sub(r'[^\w\-_]', '_', test_name)
        
        # Create a unique directory for this test execution to avoid conflicts
        test_dir = Path(self.test_results_dir) / f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        test_dir.mkdir(parents=True, exist_ok=True)
        
        test_file = test_dir / f"{safe_name}.spec.ts"
        
        # Ensure test code is properly formatted
        # If test code doesn't start with import, it might be missing the test wrapper
        code_to_write = test_code.strip()
        
        # CRITICAL: Sanitize code to fix syntax errors before writing
        code_to_write = self._sanitize_playwright_code(code_to_write)
        
        # Check if code already has test structure
        has_test_structure = (
            'import' in code_to_write and 
            ('test(' in code_to_write or 'test.describe' in code_to_write)
        )
        
        if not has_test_structure:
            logger.warning("Test code doesn't appear to have Playwright test structure, wrapping it")
            # Wrap in basic test structure
            code_to_write = f"""import {{ test, expect }} from '@playwright/test';

test('{test_name}', async ({{ page }}) => {{
{code_to_write}
}});
"""
        
        # Write test code to file
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(code_to_write)
        
        logger.info(f"Created test file: {test_file}")
        logger.debug(f"Test file content preview (first 200 chars): {code_to_write[:200]}")
        return test_file
    
    def _sanitize_playwright_code(self, code: str) -> str:
        """Fix common syntax errors in generated Playwright code."""
        # Fix malformed text= locators: page.click("text="Black Friday Deals"")
        # The exact error: await page.click("text="Black Friday Deals"");
        
        # Pattern 1: page.click("text="text"") - double quotes nested
        # Matches: page.click("text=" followed by "text" followed by "")
        pattern1 = r'page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def fix_pattern1(match):
            quote = match.group(1)
            text = match.group(2)
            return f'page.getByText({quote}{text}{quote}).click()'
        code = re.sub(pattern1, fix_pattern1, code)
        
        # Pattern 2: More specific - handles the exact error case
        # await page.click("text="Black Friday Deals"");
        # This pattern matches: "text=" + quote + text + quote + quote
        # The issue: "text="Black Friday Deals"" has nested quotes
        # We need to match: opening quote, text=, inner quote, text, inner quote, outer quote, closing quote
        pattern2 = r'page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def fix_pattern2(match):
            quote = match.group(1)
            text = match.group(2)
            return f'page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern2, fix_pattern2, code)
        
        # Pattern 2b: Handle case where there are TWO closing quotes: "text="text""
        pattern2b = r'page\.click\(["\']text=(["\'])([^"\']+)\1\1["\']\)'
        def fix_pattern2b(match):
            quote = match.group(1)
            text = match.group(2)
            return f'page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern2b, fix_pattern2b, code)
        
        # Pattern 3: Handle with await prefix
        pattern3 = r'await\s+page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def fix_pattern3(match):
            quote = match.group(1)
            text = match.group(2)
            return f'await page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern3, fix_pattern3, code)
        
        # Pattern 3b: Handle with await prefix and double closing quotes
        pattern3b = r'await\s+page\.click\(["\']text=(["\'])([^"\']+)\1\1["\']\)'
        def fix_pattern3b(match):
            quote = match.group(1)
            text = match.group(2)
            return f'await page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern3b, fix_pattern3b, code)
        
        # Pattern 4: General case - any nested quotes with text=
        # Matches: "text="text"" or 'text='text''
        pattern4 = r'page\.(click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\2["\']\)'
        def fix_pattern4(match):
            method = match.group(1)
            quote = match.group(2)
            text = match.group(3)
            if method == 'click':
                return f'page.getByText({quote}{text}{quote}).first().click()'
            elif method == 'fill':
                # For fill, we'll need to handle the value parameter separately
                return f'page.getByText({quote}{text}{quote}).fill('
            else:
                return f'page.getByText({quote}{text}{quote}).{method}()'
        code = re.sub(pattern4, fix_pattern4, code)
        
        # Pattern 4b: Handle double closing quotes
        pattern4b = r'page\.(click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\2\2["\']\)'
        def fix_pattern4b(match):
            method = match.group(1)
            quote = match.group(2)
            text = match.group(3)
            if method == 'click':
                return f'page.getByText({quote}{text}{quote}).first().click()'
            elif method == 'fill':
                return f'page.getByText({quote}{text}{quote}).fill('
            else:
                return f'page.getByText({quote}{text}{quote}).{method}()'
        code = re.sub(pattern4b, fix_pattern4b, code)
        
        # Pattern 5: Handle with await prefix for all methods
        pattern5 = r'await\s+page\.(click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\2["\']\)'
        def fix_pattern5(match):
            method = match.group(1)
            quote = match.group(2)
            text = match.group(3)
            if method == 'click':
                return f'await page.getByText({quote}{text}{quote}).first().click()'
            elif method == 'fill':
                return f'await page.getByText({quote}{text}{quote}).fill('
            else:
                return f'await page.getByText({quote}{text}{quote}).{method}()'
        code = re.sub(pattern5, fix_pattern5, code)
        
        # Pattern 5b: Handle with await prefix and double closing quotes
        pattern5b = r'await\s+page\.(click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\2\2["\']\)'
        def fix_pattern5b(match):
            method = match.group(1)
            quote = match.group(2)
            text = match.group(3)
            if method == 'click':
                return f'await page.getByText({quote}{text}{quote}).first().click()'
            elif method == 'fill':
                return f'await page.getByText({quote}{text}{quote}).fill('
            else:
                return f'await page.getByText({quote}{text}{quote}).{method}()'
        code = re.sub(pattern5b, fix_pattern5b, code)
        
        # Pattern 6: Catch any remaining text= patterns (most general)
        # This catches: page.click("text="anything"") with any quote combination
        pattern6 = r'page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def fix_pattern6(match):
            quote = match.group(1)
            text = match.group(2)
            logger.warning(f"Fixing text= locator pattern: text={text}")
            return f'page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern6, fix_pattern6, code)
        
        # Pattern 6b: With await
        pattern6b = r'await\s+page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def fix_pattern6b(match):
            quote = match.group(1)
            text = match.group(2)
            logger.warning(f"Fixing text= locator pattern (with await): text={text}")
            return f'await page.getByText({quote}{text}{quote}).first().click()'
        code = re.sub(pattern6b, fix_pattern6b, code)
        
        # CRITICAL: Filter out internal browser URLs from page.goto() calls
        # Remove chrome://, about:, edge://, etc. BUT ensure we have at least one goto
        # Pattern must match: await page.goto("chrome://newtab/");
        internal_goto_pattern = r'await\s+page\.goto\(["\']([^"\']+)["\']\)[;\s]*'
        
        # Find all goto calls first
        all_goto_matches = list(re.finditer(internal_goto_pattern, code))
        logger.debug(f"Found {len(all_goto_matches)} page.goto() calls in code")
        
        # Remove internal URLs first
        def filter_internal_urls(match):
            url = match.group(1)
            is_internal = self._is_internal_browser_url(url)
            if is_internal:
                logger.warning(f"Removing internal browser URL from page.goto(): {url}")
                return ''  # Remove this goto call
            logger.debug(f"Keeping valid URL in page.goto(): {url}")
            return match.group(0)
        
        code = re.sub(internal_goto_pattern, filter_internal_urls, code)
        
        # AFTER removal, check if we have any valid goto calls remaining
        remaining_goto_matches = list(re.finditer(r'await\s+page\.goto\(["\']([^"\']+)["\']\)[;\s]*', code))
        has_valid_goto = any(not self._is_internal_browser_url(m.group(1)) for m in remaining_goto_matches)
        
        logger.debug(f"After filtering: {len(remaining_goto_matches)} goto calls remaining, has_valid_goto={has_valid_goto}")
        
        # If no valid goto calls remain, add a placeholder at the start
        if not has_valid_goto or not re.search(r'await\s+page\.goto\(', code):
            logger.warning("No valid page.goto() found after filtering internal URLs. Adding placeholder.")
            # Add placeholder goto at the beginning of test
            code = re.sub(
                r'(test\([^)]+\)\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*\{)',
                r'\1\n  // TODO: Add the website URL - no URL was found in the recording\n  // await page.goto("https://example.com");',
                code,
                count=1
            )
            logger.info("Added placeholder page.goto() with TODO comment")
        
        logger.debug("Applied code sanitization to fix syntax errors and filter internal URLs")
        return code
    
    def _is_internal_browser_url(self, url: str) -> bool:
        """Check if URL is an internal browser URL that should be filtered out."""
        if not url:
            return True
        
        url_lower = url.lower().strip()
        
        # Internal browser URL patterns
        internal_patterns = [
            'chrome://',
            'about:',
            'edge://',
            'firefox://',
            'opera://',
            'safari://',
            'newtab',
            'blank',
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
        ]
        
        # Check if URL matches any internal pattern
        for pattern in internal_patterns:
            if pattern in url_lower:
                return True
        
        # Check if it's a localhost URL with common dev ports (but allow if it's the actual site)
        if 'localhost' in url_lower or '127.0.0.1' in url_lower:
            # Allow localhost if it's not a Flowstral/QA platform URL
            if 'flowstral' in url_lower or 'qa' in url_lower or 'platform' in url_lower:
                return True
            # Allow localhost if it has a port that's not a dev server port
            if re.search(r':(8080|8081|3000|5173|4200)', url_lower):
                return True
        
        return False
    
    async def _ensure_playwright_setup(self, project_dir: Path):
        """Ensure Playwright is set up in project directory."""
        logger.info(f"Ensuring Playwright setup in: {project_dir}")
        # Check if package.json exists
        package_json = project_dir / "package.json"
        needs_install = False
        
        if not package_json.exists():
            # Create minimal package.json
            logger.info("Creating package.json...")
            package_json.write_text(json.dumps({
                "name": "flowstral-tests",
                "version": "1.0.0",
                "type": "module",
                "scripts": {
                    "test": "playwright test"
                },
                "devDependencies": {
                    "@playwright/test": "^1.40.0"
                }
            }, indent=2))
            logger.info(f"Created package.json at: {package_json}")
            needs_install = True
        
        # Check if playwright.config.ts exists
        config_file = project_dir / "playwright.config.ts"
        if not config_file.exists():
            config_content = """import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
"""
            config_file.write_text(config_content)
        
        # Check if node_modules exists (Playwright installed)
        node_modules = project_dir / "node_modules"
        playwright_test = node_modules / "@playwright" / "test"
        if not node_modules.exists() or not playwright_test.exists():
            needs_install = True
            logger.info(f"Playwright not found - node_modules exists: {node_modules.exists()}, playwright test exists: {playwright_test.exists() if node_modules.exists() else False}")
        
        # Install dependencies if needed
        if needs_install:
            logger.info(f"Installing Playwright dependencies in {project_dir}")
            original_cwd = os.getcwd()
            try:
                os.chdir(project_dir)
                logger.info(f"Changed directory to: {os.getcwd()}")
                
                # Check if npm is available - use subprocess.run() for Windows compatibility
                logger.info("Checking npm availability...")
                def check_npm_sync():
                    # Find npm executable using shutil.which
                    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd") or "npm"
                    if not npm_cmd or npm_cmd == "npm":
                        # If not found, try direct execution (might work if in PATH)
                        npm_cmd = "npm"
                    
                    try:
                        # On Windows, use shell=True for better PATH resolution
                        use_shell = os.name == 'nt'
                        result = subprocess.run(
                            [npm_cmd, "--version"],
                            capture_output=True,
                            text=True,
                            timeout=10,
                            shell=use_shell
                        )
                        return result
                    except FileNotFoundError:
                        # Return error result
                        class ErrorResult:
                            returncode = 1
                            stderr = f"npm not found in PATH. Tried: {npm_cmd}"
                            stdout = ""
                        return ErrorResult()
                
                check_result = await asyncio.to_thread(check_npm_sync)
                if check_result.returncode != 0:
                    error_msg = check_result.stderr or check_result.stdout or "npm not found"
                    logger.error(f"npm check failed: {error_msg}")
                    raise RuntimeError(f"npm is not installed or not in PATH. Error: {error_msg}. Please install Node.js and npm from https://nodejs.org/")
                
                npm_version = check_result.stdout.strip()
                logger.info(f"npm version: {npm_version}")
                
                # Run npm install - use subprocess.run() for Windows compatibility
                logger.info("Running npm install (this may take 1-2 minutes on first run)...")
                def install_npm_sync():
                    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd") or "npm"
                    use_shell = os.name == 'nt'
                    result = subprocess.run(
                        [npm_cmd, "install"],
                        cwd=str(project_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,  # 5 minutes
                        shell=use_shell
                    )
                    return result
                
                install_result = await asyncio.to_thread(install_npm_sync)
                if install_result.returncode != 0:
                    error_msg = install_result.stderr or install_result.stdout
                    logger.error(f"npm install failed (exit code {install_result.returncode}): {error_msg[:500]}")
                    raise RuntimeError(f"Failed to install Playwright dependencies: {error_msg[:500]}")
                
                logger.info("npm install completed successfully")
                
                # Install Playwright browsers - use subprocess.run() for Windows compatibility
                logger.info("Installing Playwright browsers (chromium)...")
                def install_browsers_sync():
                    npx_cmd = shutil.which("npx") or shutil.which("npx.cmd") or "npx"
                    use_shell = os.name == 'nt'
                    result = subprocess.run(
                        [npx_cmd, "playwright", "install", "--with-deps", "chromium"],
                        cwd=str(project_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,  # 5 minutes
                        shell=use_shell
                    )
                    return result
                
                browsers_result = await asyncio.to_thread(install_browsers_sync)
                if browsers_result.returncode != 0:
                    error_msg = browsers_result.stderr or browsers_result.stdout
                    logger.warning(f"Playwright browser install had issues (exit code {browsers_result.returncode}): {error_msg[:500]}")
                    # Don't fail completely - browsers might already be installed
                else:
                    logger.info("Playwright browsers installed successfully")
                
                logger.info("Playwright setup completed successfully")
            except Exception as e:
                logger.error(f"Error during Playwright setup: {e}", exc_info=True)
                raise
            finally:
                os.chdir(original_cwd)
                logger.info(f"Restored directory to: {os.getcwd()}")
        else:
            logger.info("Playwright already installed, skipping setup")
    
    async def _run_playwright_test(
        self,
        test_file: Path,
        browser: str = "chromium",
        headless: bool = True,
        timeout: int = 30000
    ) -> Dict[str, Any]:
        """Run Playwright test using npx playwright test."""
        project_dir = test_file.parent
        
        # Build command
        cmd = [
            "npx", "playwright", "test",
            test_file.name,
            f"--project={browser}",
            "--reporter=json",
        ]
        
        # Playwright uses --headed for visible mode, no flag for headless (default)
        if not headless:
            cmd.append("--headed")
        
        # Set timeout
        cmd.extend(["--timeout", str(timeout)])
        
        # On Windows, use shell=True and pass command as string for better PATH resolution
        use_shell = os.name == 'nt'
        if use_shell:
            # Convert command list to string for Windows shell
            cmd_str = " ".join(cmd)
            logger.info(f"Running Playwright test (Windows shell mode): {cmd_str}")
        else:
            logger.info(f"Running Playwright test: {' '.join(cmd)}")
        
        logger.info(f"Working directory: {project_dir}")
        logger.info(f"Test file: {test_file}")
        logger.info(f"Browser: {browser}, Headless: {headless}")
        
        # Use subprocess.run() wrapped in asyncio.to_thread() for Windows compatibility
        # This is more reliable than asyncio.create_subprocess_* on Windows
        def run_test_sync():
            """Run test synchronously using subprocess.run() - works reliably on Windows"""
            try:
                # On Windows, use shell=True with string command for PATH resolution
                if use_shell:
                    result = subprocess.run(
                        cmd_str,
                        cwd=str(project_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,  # 5 minutes max
                        env={**os.environ, "CI": "false"},  # Ensure CI mode is off
                        shell=True  # Use shell on Windows
                    )
                else:
                    result = subprocess.run(
                        cmd,
                        cwd=str(project_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,  # 5 minutes max
                        env={**os.environ, "CI": "false"}  # Ensure CI mode is off
                    )
                return {
                    "exit_code": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
            except subprocess.TimeoutExpired:
                logger.error("Test execution timed out after 5 minutes")
                return {
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": "Test execution timed out after 5 minutes"
                }
            except Exception as e:
                logger.error(f"Error running test: {e}", exc_info=True)
                return {
                    "exit_code": -1,
                    "stdout": "",
                    "stderr": str(e)
                }
        
        # Run in thread pool to avoid blocking
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(run_test_sync),
                timeout=310.0  # Slightly longer than subprocess timeout
            )
        except asyncio.TimeoutError:
            logger.error("Test execution timed out at asyncio level")
            result = {
                "exit_code": -1,
                "stdout": "",
                "stderr": "Test execution timed out after 5 minutes"
            }
        
        exit_code = result["exit_code"]
        stdout_str = result["stdout"]
        stderr_str = result["stderr"]
        
        logger.info(f"Test execution completed with exit code: {exit_code}")
        logger.info(f"Stdout length: {len(stdout_str)}, Stderr length: {len(stderr_str)}")
        
        if stderr_str:
            logger.warning(f"Test stderr (first 1000 chars): {stderr_str[:1000]}")
        # Parse results
        execution_result = {
            "exit_code": exit_code,
            "stdout": stdout_str,
            "stderr": stderr_str,
        }
        
        if stdout_str:
            logger.info(f"Test stdout (first 500 chars): {stdout_str[:500]}")
            
            # Try to parse Playwright JSON output to extract error details
            try:
                json_data = json.loads(stdout_str)
                # Extract error information from Playwright JSON
                if "suites" in json_data:
                    for suite in json_data.get("suites", []):
                        for spec in suite.get("specs", []):
                            for test in spec.get("tests", []):
                                if test.get("status") == "failed":
                                    error_info = test.get("results", [{}])[0].get("errors", [])
                                    if error_info:
                                        error_msg = error_info[0].get("message", "Test failed")
                                        logger.error(f"Test failure error: {error_msg}")
                                        if "error_details" not in execution_result:
                                            execution_result["error_details"] = []
                                        execution_result["error_details"].append({
                                            "test": test.get("title", "Unknown"),
                                            "error": error_msg,
                                            "duration": test.get("duration", 0)
                                        })
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                logger.debug(f"Could not parse Playwright JSON output: {e}")
        
        # Try to find screenshots and videos
        test_results_dir = project_dir / "test-results"
        if test_results_dir.exists():
            screenshots = list(test_results_dir.glob("**/*.png"))
            videos = list(test_results_dir.glob("**/*.webm"))
            traces = list(test_results_dir.glob("**/*.zip"))
            
            execution_result["screenshots"] = [str(s) for s in screenshots]
            execution_result["video"] = str(videos[0]) if videos else None
            execution_result["trace"] = str(traces[0]) if traces else None
        
        return execution_result
    
    def convert_from_other_tool(
        self,
        source_code: str,
        source_framework: str = "auto"
    ) -> Dict[str, Any]:
        """
        Convert test script from another tool to Playwright.
        
        Args:
            source_code: Source test code
            source_framework: Framework (selenium, cypress, webdriverio, auto)
            
        Returns:
            Dict with converted code and metadata
        """
        # Lazy import to avoid circular dependency
        if self._script_converter is None:
            from app.services.automation.script_converter import get_script_converter
            self._script_converter = get_script_converter()
        
        return self._script_converter.convert_to_playwright(
            source_code=source_code,
            source_framework=source_framework
        )


# Global instance
_test_execution_service = None

def get_test_execution_service() -> TestExecutionService:
    """Get or create global TestExecutionService instance"""
    global _test_execution_service
    if _test_execution_service is None:
        _test_execution_service = TestExecutionService()
    return _test_execution_service

