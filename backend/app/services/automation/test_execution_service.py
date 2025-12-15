"""
Test Execution Service
Provides environment to run recorded Playwright tests directly.
Supports local execution, CI/CD integration, and test reporting.
Now with SELF-HEALING capabilities and real-time WebSocket progress!
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
import glob
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Import WebSocket manager for real-time progress updates
try:
    from app.services.execution_websocket_manager import execution_ws_manager
    WEBSOCKET_ENABLED = True
except ImportError:
    WEBSOCKET_ENABLED = False
    execution_ws_manager = None
    logger.warning("WebSocket manager not available - real-time updates disabled")

# Self-healing patterns to detect selector failures
SELECTOR_ERROR_PATTERNS = [
    r"locator\..*timeout",
    r"element not found",
    r"waiting for selector",
    r"timeout \d+ms exceeded",
    r"strict mode violation",
    r"element is not visible",
    r"element is not attached",
    r"Target closed",
    r"page\.waitForSelector.*timeout",
    r"waiting for locator",
]


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
        self._test_healer = None
        self._healing_enabled = True  # Enable self-healing by default
        self._max_healing_attempts = 3
        self._current_execution_id = None  # Track current execution for WebSocket
    
    async def _emit_ws_event(self, event_type: str, **kwargs):
        """Emit WebSocket event for real-time progress updates"""
        if not WEBSOCKET_ENABLED or not execution_ws_manager or not self._current_execution_id:
            return
        
        try:
            if event_type == "step_start":
                await execution_ws_manager.send_step_start(
                    self._current_execution_id,
                    kwargs.get("step_number", 0),
                    kwargs.get("step_name", ""),
                    kwargs.get("total_steps", 0)
                )
            elif event_type == "step_complete":
                await execution_ws_manager.send_step_complete(
                    self._current_execution_id,
                    kwargs.get("step_number", 0),
                    kwargs.get("step_name", ""),
                    kwargs.get("status", "passed"),
                    kwargs.get("duration_ms", 0),
                    kwargs.get("error"),
                    kwargs.get("screenshot")
                )
            elif event_type == "self_healing":
                await execution_ws_manager.send_self_healing(
                    self._current_execution_id,
                    kwargs.get("step_number", 0),
                    kwargs.get("original_selector", ""),
                    kwargs.get("healed_selector", ""),
                    kwargs.get("strategy", "fallback")
                )
            elif event_type == "screenshot":
                await execution_ws_manager.send_screenshot(
                    self._current_execution_id,
                    kwargs.get("step_number", 0),
                    kwargs.get("screenshot_type", "step"),
                    kwargs.get("base64_data"),
                    kwargs.get("path")
                )
            elif event_type == "execution_complete":
                await execution_ws_manager.send_execution_complete(
                    self._current_execution_id,
                    kwargs.get("status", "passed"),
                    kwargs.get("total_steps", 0),
                    kwargs.get("passed_steps", 0),
                    kwargs.get("failed_steps", 0),
                    kwargs.get("healed_steps", 0),
                    kwargs.get("duration_ms", 0),
                    kwargs.get("error")
                )
            elif event_type == "log":
                await execution_ws_manager.send_log(
                    self._current_execution_id,
                    kwargs.get("level", "info"),
                    kwargs.get("message", "")
                )
        except Exception as e:
            logger.debug(f"Failed to emit WebSocket event: {e}")
    
    def _get_test_healer(self):
        """Lazy load test healer to avoid circular imports"""
        if self._test_healer is None:
            try:
                from app.services.flowstral.test_healer import TestHealer
                self._test_healer = TestHealer()
            except ImportError as e:
                logger.warning(f"Self-healing not available: {e}")
        return self._test_healer
    
    def _is_selector_failure(self, error_output: str) -> bool:
        """Check if the error is a selector-related failure that can be healed"""
        if not error_output:
            return False
        
        error_lower = error_output.lower()
        for pattern in SELECTOR_ERROR_PATTERNS:
            if re.search(pattern, error_lower, re.IGNORECASE):
                logger.debug(f"Detected selector failure pattern: {pattern}")
                return True
        return False
    
    def _extract_failed_selector(self, error_output: str, test_code: str) -> Optional[str]:
        """Extract the failing selector from error output"""
        # Try to find selector in error message
        patterns = [
            r"locator\(['\"]([^'\"]+)['\"]\)",
            r"getByText\(['\"]([^'\"]+)['\"]\)",
            r"getByRole\(['\"]([^'\"]+)['\"],?\s*{?\s*name:\s*['\"]([^'\"]+)['\"]",
            r"selector ['\"]([^'\"]+)['\"]",
            r"waiting for selector ['\"]([^'\"]+)['\"]",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, error_output)
            if match:
                return match.group(1)
        
        return None
    
    async def _attempt_self_healing(
        self,
        test_code: str,
        failed_selector: str,
        error_message: str,
        element_model_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Attempt to heal a failed test by finding alternative selectors.
        Returns the healed test code if successful, None otherwise.
        """
        healer = self._get_test_healer()
        if not healer:
            return None
        
        try:
            logger.info(f"[SELF-HEAL] Attempting to heal selector: {failed_selector}")
            
            # If we have an element model ID, use the healer directly
            if element_model_id:
                result = await healer.heal_failed_action(
                    element_model_id=element_model_id,
                    failed_locator=failed_selector,
                    error_message=error_message
                )
                
                if result and result.get("healed"):
                    new_selector = result.get("new_locator")
                    healed_code = test_code.replace(failed_selector, new_selector)
                    logger.info(f"[SELF-HEAL] Successfully healed: {failed_selector} → {new_selector}")
                    return healed_code
            
            # Fallback: Try common alternative selectors
            alternatives = await self._generate_alternative_selectors(failed_selector)
            
            for alt_selector in alternatives:
                logger.debug(f"[SELF-HEAL] Trying alternative: {alt_selector}")
                healed_code = test_code.replace(failed_selector, alt_selector)
                if healed_code != test_code:  # Made a replacement
                    return healed_code
            
            logger.warning(f"[SELF-HEAL] Could not heal selector: {failed_selector}")
            return None
            
        except Exception as e:
            logger.error(f"[SELF-HEAL] Healing failed: {e}")
            return None
    
    async def _generate_alternative_selectors(self, failed_selector: str) -> List[str]:
        """Generate alternative selectors based on the failed one"""
        alternatives = []
        
        # If it's an ID selector, try text/role based
        if failed_selector.startswith("#"):
            element_id = failed_selector[1:]
            alternatives.append(f"[data-testid='{element_id}']")
            alternatives.append(f"[id*='{element_id}']")
        
        # If it's an attribute selector, try variations
        elif "=" in failed_selector:
            attr_match = re.match(r"\[(\w+)=['\"]([^'\"]+)['\"]\]", failed_selector)
            if attr_match:
                attr, value = attr_match.groups()
                alternatives.append(f"[{attr}*='{value}']")  # Contains
                alternatives.append(f"[data-{attr}='{value}']")  # Data attribute
        
        # If it's a text-based selector, try partial match
        elif "text=" in failed_selector.lower():
            text_match = re.search(r"text=['\"]([^'\"]+)['\"]", failed_selector, re.IGNORECASE)
            if text_match:
                text = text_match.group(1)
                alternatives.append(f"text=/{text}/i")  # Case insensitive regex
                if len(text) > 10:
                    alternatives.append(f"text='{text[:20]}'")  # Partial text
        
        return alternatives
    
    async def execute_test(
        self,
        test_code: str,
        test_name: str = "flowstral_test",
        browser: str = "chromium",
        headless: bool = True,
        timeout: int = 30000,
        environment: str = "local",
        language: str = "typescript",
        execution_id: Optional[str] = None,
        step_names: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Execute Playwright test code with real-time WebSocket progress.
        
        Args:
            test_code: Playwright TypeScript test code
            test_name: Name for the test
            browser: Browser to use (chromium, firefox, webkit)
            headless: Run in headless mode
            timeout: Test timeout in milliseconds
            environment: Execution environment (local, ci, docker)
            execution_id: Optional ID for WebSocket progress tracking
            step_names: Optional list of step names for progress reporting
            
        Returns:
            Dict with execution results
        """
        start_time = datetime.utcnow()
        
        # Set execution ID for WebSocket events
        self._current_execution_id = execution_id
        total_steps = len(step_names) if step_names else 1
        
        try:
            logger.info(f"Starting test execution: {test_name}, browser={browser}, headless={headless}")
            
            # Emit execution started event
            await self._emit_ws_event("log", level="info", message=f"Starting test: {test_name}")
            await self._emit_ws_event("step_start", step_number=1, step_name="Initializing", total_steps=total_steps)
            
            # ============================================================
            # CRITICAL: Normalize language BEFORE runner selection
            # Handle framework names like "playwright-python" -> "python"
            # ============================================================
            effective_language = language.lower() if language else "typescript"
            if "python" in effective_language:
                effective_language = "python"
            elif "typescript" in effective_language or "ts" in effective_language:
                effective_language = "typescript"
            
            # Also detect from code to be safe
            if "from playwright.sync_api" in test_code:
                effective_language = "python"
            elif "import" in test_code and ("test(" in test_code or "test.describe" in test_code):
                effective_language = "typescript"
            
            logger.info(f"Effective language: {effective_language} (original: {language})")
            
            # Create temporary test file
            test_file = self._create_test_file(test_code, test_name, language=effective_language)
            logger.info(f"Created test file: {test_file}")
            
            # Setup Playwright project if needed
            logger.info("Ensuring Playwright is set up...")
            await self._emit_ws_event("log", level="info", message="Setting up Playwright environment...")
            await self._ensure_playwright_setup(test_file.parent, language=effective_language)
            logger.info("Playwright setup complete")
            
            # Execute test
            logger.info(f"Starting Playwright test execution (language: {effective_language})...")
            await self._emit_ws_event("step_complete", step_number=1, step_name="Initializing", status="passed", duration_ms=0)
            await self._emit_ws_event("step_start", step_number=2, step_name="Running test", total_steps=total_steps)
            await self._emit_ws_event("log", level="info", message=f"Executing {test_name} in {browser}...")
            if effective_language == "python":
                result = await self._run_playwright_python_test(
                    test_file,
                    browser=browser,
                    headless=headless,
                    timeout=timeout
                )
            else:
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
            
            # ============================================================
            # SELF-HEALING: Attempt to fix selector failures automatically
            # ============================================================
            healing_attempted = False
            healing_successful = False
            healed_test_code = None
            
            if status == "failed" and self._healing_enabled:
                error_output = result.get("stderr", "") + result.get("stdout", "")
                
                if self._is_selector_failure(error_output):
                    logger.info("[SELF-HEAL] Detected selector failure, attempting to heal...")
                    await self._emit_ws_event("log", level="warning", message="Selector failure detected, attempting self-healing...")
                    healing_attempted = True
                    
                    failed_selector = self._extract_failed_selector(error_output, test_code)
                    if failed_selector:
                        await self._emit_ws_event("log", level="info", message=f"Healing selector: {failed_selector[:50]}...")
                        healed_code = await self._attempt_self_healing(
                            test_code=test_code,
                            failed_selector=failed_selector,
                            error_message=error_output
                        )
                        
                        if healed_code and healed_code != test_code:
                            logger.info("[SELF-HEAL] Retrying test with healed selector...")
                            # Retry with healed code
                            healed_test_file = self._create_test_file(healed_code, f"{test_name}_healed", language=effective_language)
                            
                            if effective_language == "python":
                                healed_result = await self._run_playwright_python_test(
                                    healed_test_file,
                                    browser=browser,
                                    headless=headless,
                                    timeout=timeout
                                )
                            else:
                                healed_result = await self._run_playwright_test(
                                    healed_test_file,
                                    browser=browser,
                                    headless=headless,
                                    timeout=timeout
                                )
                            
                            if healed_result["exit_code"] == 0:
                                logger.info("[SELF-HEAL] ✅ Test passed after healing!")
                                healing_successful = True
                                healed_test_code = healed_code
                                result = healed_result
                                status = "success"
                                execution_time = (datetime.utcnow() - start_time).total_seconds()
                                # Emit self-healing success event
                                await self._emit_ws_event("self_healing", 
                                    step_number=2, 
                                    original_selector=failed_selector, 
                                    healed_selector="auto-healed",
                                    strategy="fallback"
                                )
                                await self._emit_ws_event("log", level="info", message="✅ Test passed after self-healing!")
                            else:
                                logger.warning("[SELF-HEAL] ❌ Test still failed after healing attempt")
                                await self._emit_ws_event("log", level="warning", message="Self-healing attempted but test still failed")
                    else:
                        logger.warning("[SELF-HEAL] Could not extract failed selector from error output")
            
            # Auto-create defect if test failed (and healing didn't help)
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
            
            # Emit final step completion and execution complete events
            await self._emit_ws_event("step_complete", 
                step_number=2, 
                step_name="Running test", 
                status="passed" if status == "success" else "failed",
                duration_ms=int(execution_time * 1000),
                error=result.get("stderr", "")[:500] if status == "failed" else None
            )
            
            await self._emit_ws_event("execution_complete",
                status="passed" if status == "success" else "failed",
                total_steps=total_steps,
                passed_steps=total_steps if status == "success" else 0,
                failed_steps=0 if status == "success" else 1,
                healed_steps=1 if healing_successful else 0,
                duration_ms=int(execution_time * 1000),
                error=result.get("stderr", "")[:500] if status == "failed" else None
            )
            
            # Clear execution ID
            self._current_execution_id = None
            
            return {
                "status": status,
                "test_name": test_name,
                "browser": browser,
                "execution_time_seconds": execution_time,
                "exit_code": result["exit_code"],
                "defect_id": defect_id,
                "stdout": result["stdout"],
                "stderr": result["stderr"],
                "test_file": str(test_file),
                "screenshots": result.get("screenshots", []),
                "video": result.get("video"),
                "trace": result.get("trace"),
                "environment": environment,
                "timestamp": start_time.isoformat(),
                # Self-healing metadata
                "self_healing": {
                    "attempted": healing_attempted,
                    "successful": healing_successful,
                    "healed_code": healed_test_code if healing_successful else None
                }
            }
            
        except Exception as e:
            logger.error(f"Test execution failed: {e}", exc_info=True)
            error_msg = str(e)
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            # Provide helpful error messages
            if "npm" in error_msg.lower() or "node" in error_msg.lower():
                error_msg = f"{error_msg}\n\nPlease ensure Node.js and npm are installed and available in PATH."
            elif "playwright" in error_msg.lower() and "not found" in error_msg.lower():
                error_msg = f"{error_msg}\n\nPlaywright installation may have failed. Check backend logs for npm install errors."
            elif "timeout" in error_msg.lower():
                error_msg = f"{error_msg}\n\nThe test execution exceeded the 5-minute timeout limit."
            
            # Emit failure events
            await self._emit_ws_event("log", level="error", message=f"Execution error: {error_msg[:200]}")
            await self._emit_ws_event("execution_complete",
                status="failed",
                total_steps=total_steps,
                passed_steps=0,
                failed_steps=1,
                healed_steps=0,
                duration_ms=int(execution_time * 1000),
                error=error_msg[:500]
            )
            
            # Clear execution ID
            self._current_execution_id = None
            
            return {
                "status": "error",
                "test_name": test_name,
                "error": error_msg,
                "execution_time_seconds": execution_time,
                "timestamp": start_time.isoformat(),
                "browser": browser,
                "stdout": "",
                "stderr": error_msg
            }
    
    def _create_test_file(self, test_code: str, test_name: str, language: str = "typescript") -> Path:
        """Create temporary test file with test code."""
        # Sanitize test name for filename
        safe_name = re.sub(r'[^\w\-_]', '_', test_name)
        
        # Create a unique directory for this test execution to avoid conflicts
        test_dir = Path(self.test_results_dir) / f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        test_dir.mkdir(parents=True, exist_ok=True)
        
        # Normalize language parameter (handle new framework names like "playwright-typescript")
        normalized_language = language.lower() if language else "typescript"
        if "python" in normalized_language:
            normalized_language = "python"
        elif "typescript" in normalized_language or "ts" in normalized_language:
            normalized_language = "typescript"
        
        # CRITICAL: Always auto-detect language from code content to prevent mismatches
        # The language parameter is just a hint - we always verify against actual code
        # Python detection: most reliable indicator is "from playwright.sync_api"
        code_is_python = "from playwright.sync_api" in test_code
        
        # TypeScript detection: has "import" with "test(" or "test.describe" and NOT Python
        code_is_typescript = (
            "import" in test_code and 
            ("test(" in test_code or "test.describe" in test_code) and 
            not code_is_python  # Explicitly not Python
        )
        
        # Always detect from code, regardless of language parameter
        if code_is_python:
            detected_language = "python"
        elif code_is_typescript:
            detected_language = "typescript"
        else:
            # Fallback: use provided (normalized) language or default to typescript
            detected_language = normalized_language if normalized_language and normalized_language != "auto" else "typescript"
        
        # Log if there was a mismatch (but only if the normalized versions differ)
        if normalized_language and normalized_language != "auto" and detected_language != normalized_language:
            logger.warning(f"Language mismatch detected: parameter='{language}' (normalized: '{normalized_language}'), but code is '{detected_language}'. Using detected language: {detected_language}")
        
        language = detected_language
        
        # Determine file extension based on language
        if language == "python":
            # Use .py extension (not .spec.py) to avoid pytest import issues
            test_file = test_dir / f"test_{safe_name}.py"
        else:
            test_file = test_dir / f"{safe_name}.spec.ts"
        
        # Ensure test code is properly formatted
        code_to_write = test_code.strip()
        
        # CRITICAL: Remove visual locator comments that break syntax
        # Pattern 1: page.// Visual locator: ... -> should be removed or replaced
        visual_locator_pattern = r'page\.\s*//\s*Visual\s+locator[^\n]*'
        code_to_write = re.sub(visual_locator_pattern, '', code_to_write, flags=re.IGNORECASE)
        
        # Pattern 2: Remove standalone visual locator comments
        code_to_write = re.sub(r'^\s*page\.\s*//.*$', '', code_to_write, flags=re.MULTILINE)
        
        # Pattern 3: Remove invalid syntax like: page.// Visual locator: span.click()
        code_to_write = re.sub(r'page\.\s*//[^.]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(', 'page.locator("body").\\1(', code_to_write)
        
        # Pattern 4: Remove any line containing "Visual locator" comment
        code_to_write = re.sub(r'^\s*.*Visual\s+locator.*$', '', code_to_write, flags=re.MULTILINE | re.IGNORECASE)
        
        # Pattern 5: Remove lines with page.// (any comment after page.)
        code_to_write = re.sub(r'^\s*page\.\s*//[^\n]*$', '', code_to_write, flags=re.MULTILINE)
        
        # Pattern 6: Fix cases where visual locator is in the middle of a line
        code_to_write = re.sub(r'page\.\s*//[^.]*\.([a-zA-Z_]+)\(', r'page.locator("body").\1(', code_to_write)
        
        # Pattern 7: Remove any remaining visual locator references
        code_to_write = re.sub(r'//\s*Visual\s+locator[^\n]*', '', code_to_write, flags=re.IGNORECASE)
        
        # Pattern 5: Remove duplicate navigations (for both Python and TypeScript)
        # Remove consecutive page.goto() calls to the same URL
        lines = code_to_write.split('\n')
        cleaned_lines = []
        last_goto_url = None
        skip_next_wait = False
        for i, line in enumerate(lines):
            # Check if this is a goto line (with or without await)
            goto_match = re.search(r'(?:await\s+)?page\.goto\(["\']([^"\']+)["\']\)', line)
            if goto_match:
                current_url = goto_match.group(1)
                # Check if this is a duplicate of the previous goto
                if current_url == last_goto_url:
                    # Skip this duplicate navigation line
                    skip_next_wait = True  # Also skip the wait that follows
                    continue
                last_goto_url = current_url
                skip_next_wait = False
            elif skip_next_wait and re.search(r'wait_for_load_state|waitForLoadState', line):
                # Skip wait_for_load_state after duplicate goto
                continue
            else:
                skip_next_wait = False
                # Reset goto tracking if we hit a non-goto, non-wait, non-comment line
                if line.strip() and not line.strip().startswith('#') and not line.strip().startswith('"""') and not re.search(r'wait_for_load_state|waitForLoadState', line):
                    last_goto_url = None
            cleaned_lines.append(line)
        code_to_write = '\n'.join(cleaned_lines)
        
        # Additional sanitization for Python code
        if language == "python":
            code_to_write = self._sanitize_python_code(code_to_write)
        
        if language == "python":
            # For Python, check if it has proper structure
            has_test_structure = (
                "from playwright.sync_api" in code_to_write and 
                ("def test_" in code_to_write or "def test(" in code_to_write)
            )
            
            if not has_test_structure:
                logger.warning("Python test code doesn't appear to have test structure, wrapping it")
                # Wrap in basic Python test structure
                code_to_write = f"""from playwright.sync_api import Page, expect

def test_{safe_name}(page: Page):
{self._indent_code(code_to_write, 4)}
"""
        else:
            # For TypeScript, sanitize and wrap if needed
            code_to_write = self._sanitize_playwright_code(code_to_write)
            
            # Check if code already has test structure
            has_test_structure = (
                'import' in code_to_write and 
                ('test(' in code_to_write or 'test.describe' in code_to_write)
            )
            
            if not has_test_structure:
                logger.warning("TypeScript test code doesn't appear to have test structure, wrapping it")
                # Wrap in basic test structure
                code_to_write = f"""import {{ test, expect }} from '@playwright/test';

test('{test_name}', async ({{ page }}) => {{
{self._indent_code(code_to_write, 2)}
}});
"""
        
        # Write test code to file
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(code_to_write)
        
        logger.info(f"Created test file: {test_file} (language: {language})")
        logger.debug(f"Test file content preview (first 200 chars): {code_to_write[:200]}")
        return test_file
    
    def _indent_code(self, code: str, spaces: int) -> str:
        """Indent code by specified number of spaces."""
        indent = " " * spaces
        lines = code.split('\n')
        indented = [indent + line if line.strip() else line for line in lines]
        return '\n'.join(indented)
    
    def _sanitize_python_code(self, code: str) -> str:
        """Remove visual locators and fix syntax errors in Python Playwright code."""
        # Pattern 1: Remove page.// Visual locator: ... lines
        code = re.sub(r'^\s*page\.\s*//\s*Visual\s+locator[^\n]*$', '', code, flags=re.MULTILINE | re.IGNORECASE)
        
        # Pattern 2: Fix page.// Visual locator: ... .click() syntax
        code = re.sub(r'page\.\s*//\s*Visual\s+locator[^.]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(', r'page.locator("body").\1(', code, flags=re.IGNORECASE)
        
        # Pattern 3: Remove any line containing "Visual locator"
        code = re.sub(r'^\s*.*Visual\s+locator.*$', '', code, flags=re.MULTILINE | re.IGNORECASE)
        
        # Pattern 4: Remove page.// comments
        code = re.sub(r'^\s*page\.\s*//[^\n]*$', '', code, flags=re.MULTILINE)
        
        # Pattern 5: Fix cases where visual locator is in the middle
        code = re.sub(r'page\.\s*//[^.]*\.([a-zA-Z_]+)\(', r'page.locator("body").\1(', code)
        
        # Pattern 6: Remove any remaining // Visual locator comments
        code = re.sub(r'//\s*Visual\s+locator[^\n]*', '', code, flags=re.IGNORECASE)
        
        return code
    
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
    
    async def _ensure_playwright_setup(self, project_dir: Path, language: str = "typescript"):
        """Ensure Playwright is set up in project directory."""
        logger.info(f"Ensuring Playwright setup in: {project_dir} (language: {language})")
        
        # For Python tests, we also need pytest and pytest-playwright
        if language == "python":
            requirements_file = project_dir / "requirements.txt"
            if not requirements_file.exists():
                logger.info("Creating requirements.txt for Python Playwright tests...")
                requirements_file.write_text("""pytest>=7.0.0
pytest-playwright>=0.3.0
playwright>=1.40.0
""")
                logger.info(f"Created requirements.txt at: {requirements_file}")
            
            # Create conftest.py for pytest-playwright (provides page fixture)
            conftest_file = project_dir / "conftest.py"
            if not conftest_file.exists():
                logger.info("Creating conftest.py for pytest-playwright...")
                conftest_file.write_text("""# Pytest configuration for Playwright
# This file provides the 'page' fixture used by pytest-playwright

import pytest

# Register pytest-playwright plugin
pytest_plugins = ['pytest_playwright']

# Configure default browser settings
@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "viewport": {"width": 1920, "height": 1080},
        "ignore_https_errors": True,
    }
""")
                logger.info(f"Created conftest.py at: {conftest_file}")
            
            # Always install Python dependencies and browsers (not just when conftest doesn't exist)
            logger.info("Installing Python dependencies (pytest, pytest-playwright)...")
            def install_python_deps_sync():
                pip_cmd = shutil.which("pip") or shutil.which("pip3") or "pip"
                use_shell = os.name == 'nt'
                result = subprocess.run(
                    [pip_cmd, "install", "-r", str(requirements_file)],
                    cwd=str(project_dir),
                    capture_output=True,
                    text=True,
                    timeout=300,
                    shell=use_shell
                )
                return result
            
            try:
                pip_result = await asyncio.to_thread(install_python_deps_sync)
                if pip_result.returncode != 0:
                    error_msg = pip_result.stderr or pip_result.stdout
                    logger.warning(f"pip install had issues (exit code {pip_result.returncode}): {error_msg[:500]}")
                    # Don't fail completely - pytest might already be installed
                else:
                    logger.info("Python dependencies installed successfully")
                
                # Always install Playwright browsers for Python (they might be missing)
                # IMPORTANT: Don't set cwd - browsers must be installed globally where pytest-playwright expects them
                logger.info("Installing Playwright browsers for Python (global installation)...")
                def install_playwright_browsers_sync():
                    use_shell = os.name == 'nt'
                    # Try python -m playwright install first (more reliable)
                    # Don't set cwd - install globally where pytest-playwright expects browsers
                    result = subprocess.run(
                        ["python", "-m", "playwright", "install", "chromium"],
                        capture_output=True,
                        text=True,
                        timeout=300,
                        shell=use_shell
                    )
                    return result
                
                browsers_result = await asyncio.to_thread(install_playwright_browsers_sync)
                if browsers_result.returncode != 0:
                    error_msg = browsers_result.stderr or browsers_result.stdout
                    logger.warning(f"Python playwright install had issues (exit code {browsers_result.returncode}): {error_msg[:500]}")
                    # Try with playwright command directly
                    logger.info("Trying playwright install directly...")
                    def install_playwright_browsers_direct_sync():
                        playwright_cmd = shutil.which("playwright") or "playwright"
                        use_shell = os.name == 'nt'
                        # Don't set cwd - install globally
                        result = subprocess.run(
                            [playwright_cmd, "install", "chromium"],
                            capture_output=True,
                            text=True,
                            timeout=300,
                            shell=use_shell
                        )
                        return result
                    
                    browsers_result2 = await asyncio.to_thread(install_playwright_browsers_direct_sync)
                    if browsers_result2.returncode != 0:
                        logger.error(f"Both playwright install methods failed: {browsers_result2.stderr[:500]}")
                        # Try one more time with explicit path
                        logger.info("Trying one more time with explicit python path...")
                        def install_playwright_browsers_final_sync():
                            import sys
                            python_exe = sys.executable
                            use_shell = os.name == 'nt'
                            result = subprocess.run(
                                [python_exe, "-m", "playwright", "install", "chromium"],
                                capture_output=True,
                                text=True,
                                timeout=300,
                                shell=use_shell
                            )
                            return result
                        
                        browsers_result3 = await asyncio.to_thread(install_playwright_browsers_final_sync)
                        if browsers_result3.returncode != 0:
                            logger.error(f"All playwright install methods failed. Last error: {browsers_result3.stderr[:500]}")
                            raise RuntimeError(f"Failed to install Playwright browsers. Please run 'python -m playwright install chromium' manually.")
                        else:
                            logger.info("Playwright browsers installed successfully via explicit python path")
                    else:
                        logger.info("Playwright browsers installed successfully via playwright command")
                else:
                    logger.info("Playwright browsers installed successfully via python -m playwright")
                
                # Verify browser installation by checking if the executable exists
                import sys
                from pathlib import Path
                playwright_path = Path(sys.executable).parent / "lib" / "site-packages" / "playwright" / "driver" / "package" / ".local-browsers"
                chromium_path = playwright_path / "chromium_headless_shell-1187" / "chrome-win" / "headless_shell.exe"
                if not chromium_path.exists():
                    # Try alternative location
                    chromium_path = playwright_path / "chromium-*" / "chrome-win" / "headless_shell.exe"
                    import glob
                    matches = list(playwright_path.glob("chromium-*/chrome-win/headless_shell.exe"))
                    if not matches:
                        logger.warning("Browser executable not found at expected location. Installation may have failed.")
                        logger.info("Attempting to verify installation by running 'playwright install chromium --force'...")
                        def verify_install_sync():
                            import sys
                            python_exe = sys.executable
                            use_shell = os.name == 'nt'
                            result = subprocess.run(
                                [python_exe, "-m", "playwright", "install", "chromium", "--force"],
                                capture_output=True,
                                text=True,
                                timeout=300,
                                shell=use_shell
                            )
                            return result
                        
                        verify_result = await asyncio.to_thread(verify_install_sync)
                        if verify_result.returncode != 0:
                            logger.error(f"Browser verification failed: {verify_result.stderr[:500]}")
                        else:
                            logger.info("Browser installation verified successfully")
            except Exception as e:
                logger.error(f"Failed to install Python dependencies or browsers: {e}")
                raise RuntimeError(f"Playwright browser installation failed: {e}. Please run 'python -m playwright install chromium' manually.")
        
        # Check if package.json exists (for TypeScript/JavaScript)
        package_json = project_dir / "package.json"
        needs_install = False
        
        if language != "python":
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
    
    async def _ensure_test_dependencies(self) -> bool:
        """
        Ensure pytest and pytest-playwright are installed.
        Auto-installs silently if not present (first-time setup).
        Returns True if dependencies are ready.
        """
        # Check if pytest is available
        try:
            result = subprocess.run(
                ["python", "-m", "pytest", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
                shell=os.name == 'nt'
            )
            if result.returncode == 0:
                return True
        except:
            pass
        
        # pytest not found - install silently
        logger.info("🔧 First-time setup: Installing test dependencies (pytest, pytest-playwright)...")
        
        # Emit WebSocket event if we have an active execution
        if hasattr(self, '_current_execution_id') and self._current_execution_id:
            await self._emit_ws_event("log", level="info", message="🔧 First-time setup: Installing test dependencies...")
        
        try:
            # Install pytest and pytest-playwright silently
            install_result = subprocess.run(
                ["python", "-m", "pip", "install", "pytest", "pytest-playwright", "-q", "--disable-pip-version-check"],
                capture_output=True,
                text=True,
                timeout=120,  # 2 minutes max for installation
                shell=os.name == 'nt'
            )
            
            if install_result.returncode == 0:
                logger.info("✅ Test dependencies installed successfully")
                if hasattr(self, '_current_execution_id') and self._current_execution_id:
                    await self._emit_ws_event("log", level="info", message="✅ Test dependencies installed successfully")
                return True
            else:
                logger.error(f"Failed to install dependencies: {install_result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("Dependency installation timed out")
            return False
        except Exception as e:
            logger.error(f"Error installing dependencies: {e}")
            return False

    async def _run_playwright_python_test(
        self,
        test_file: Path,
        browser: str = "chromium",
        headless: bool = True,
        timeout: int = 30000
    ) -> Dict[str, Any]:
        """Run Playwright Python test using pytest."""
        project_dir = test_file.parent
        
        # Ensure test dependencies are installed (auto-install on first run)
        deps_ready = await self._ensure_test_dependencies()
        
        # Build command - try python -m pytest first, then pytest
        pytest_cmd = None
        if deps_ready:
            try:
                result = subprocess.run(
                    ["python", "-m", "pytest", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    shell=os.name == 'nt'
                )
                if result.returncode == 0:
                    pytest_cmd = ["python", "-m", "pytest"]
            except:
                pass
        
        if not pytest_cmd:
            try:
                # Try pytest directly as fallback
                result = subprocess.run(
                    ["pytest", "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    shell=os.name == 'nt'
                )
                if result.returncode == 0:
                    pytest_cmd = ["pytest"]
            except:
                pass
        
        if pytest_cmd:
            # Use explicit file path to avoid import issues
            cmd = pytest_cmd + [str(test_file.name), "-v", "--tb=short", "--no-header"]
            
            # Add --headed flag if not running headless
            if not headless:
                cmd.append("--headed")
                logger.info("Running with visible browser (--headed flag)")
            
            # Set browser type
            cmd.append(f"--browser={browser}")
        else:
            # Dependencies couldn't be installed - provide helpful error
            logger.error("Could not set up test environment. Please try: pip install pytest pytest-playwright")
            raise RuntimeError(
                "Could not set up test environment automatically. "
                "Please run manually: pip install pytest pytest-playwright"
            )
        
        # Set browser path - use the standard ms-playwright location
        # On Windows, browsers are typically installed to %LOCALAPPDATA%\ms-playwright
        browsers_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright")
        if not os.path.exists(browsers_path):
            # Fallback to USERPROFILE if LOCALAPPDATA doesn't have it
            browsers_path = os.path.join(os.environ.get("USERPROFILE", ""), "AppData", "Local", "ms-playwright")
        
        # Check if browsers are installed, auto-install if not
        if not glob.glob(os.path.join(browsers_path, f"{browser}*")):
            logger.info(f"🔧 First-time setup: Installing Playwright {browser} browser...")
            if hasattr(self, '_current_execution_id') and self._current_execution_id:
                await self._emit_ws_event("log", level="info", message=f"🔧 Installing {browser} browser (first-time setup)...")
            
            try:
                # Install the specific browser
                install_cmd = ["python", "-m", "playwright", "install", browser]
                install_result = subprocess.run(
                    install_cmd,
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minutes for browser download
                    shell=os.name == 'nt'
                )
                if install_result.returncode == 0:
                    logger.info(f"✅ {browser} browser installed successfully")
                    if hasattr(self, '_current_execution_id') and self._current_execution_id:
                        await self._emit_ws_event("log", level="info", message=f"✅ {browser} browser installed")
                else:
                    logger.warning(f"Browser install returned non-zero: {install_result.stderr}")
            except Exception as e:
                logger.warning(f"Could not auto-install browser: {e}")
        
        env = {**os.environ, "PLAYWRIGHT_BROWSERS_PATH": browsers_path}
        logger.info(f"Using PLAYWRIGHT_BROWSERS_PATH: {browsers_path}")
        
        # On Windows, use shell=True and pass command as string for better PATH resolution
        use_shell = os.name == 'nt'
        if use_shell:
            cmd_str = " ".join(cmd)
            logger.info(f"Running Playwright Python test (Windows shell mode): {cmd_str}")
        else:
            logger.info(f"Running Playwright Python test: {' '.join(cmd)}")
        
        logger.info(f"Working directory: {project_dir}")
        logger.info(f"Test file: {test_file}")
        logger.info(f"Browser: {browser}, Headless: {headless}")
        
        # Use subprocess.run() wrapped in asyncio.to_thread() for Windows compatibility
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
                        env=env,
                        shell=True  # Use shell on Windows
                    )
                else:
                    result = subprocess.run(
                        cmd,
                        cwd=str(project_dir),
                        capture_output=True,
                        text=True,
                        timeout=300,  # 5 minutes max
                        env=env
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
        
        logger.info(f"Python test execution completed with exit code: {exit_code}")
        logger.info(f"Stdout length: {len(stdout_str)}, Stderr length: {len(stderr_str)}")
        
        if stderr_str:
            logger.warning(f"Test stderr (first 1000 chars): {stderr_str[:1000]}")
        
        # Parse results
        execution_result = {
            "exit_code": exit_code,
            "stdout": stdout_str,
            "stderr": stderr_str,
        }
        
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

