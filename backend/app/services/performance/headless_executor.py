"""
Headless Browser Executor - Run browser tests at protocol level for load testing
Uses Playwright in headless mode with network interception

Key Features:
- Execute test cases headlessly for performance testing
- Capture all HTTP traffic during execution
- Support parallel virtual users with browser contexts
- Protocol-level metrics collection
- Memory-efficient context pooling
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright, Page, BrowserContext, Browser
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not available. Install with: pip install playwright")


class ExecutionMode(Enum):
    """Execution modes for load testing"""
    PROTOCOL_ONLY = "protocol_only"  # Only HTTP requests (fastest)
    HEADLESS_BROWSER = "headless_browser"  # Full browser, headless
    HEADED_DEBUG = "headed_debug"  # With visible browser (debugging)


@dataclass
class ExecutionMetrics:
    """Metrics from a single execution"""
    user_id: str
    iteration: int
    start_time: float
    end_time: float = 0
    duration_ms: float = 0
    
    # Step metrics
    steps_completed: int = 0
    steps_failed: int = 0
    
    # Network metrics
    requests_made: int = 0
    requests_failed: int = 0
    total_bytes_received: int = 0
    total_bytes_sent: int = 0
    
    # Response times
    response_times: List[float] = field(default_factory=list)
    
    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class NetworkRequest:
    """Captured network request during execution"""
    url: str
    method: str
    status: int
    duration_ms: float
    size: int
    request_headers: Dict[str, str]
    response_headers: Dict[str, str]
    timing: Dict[str, float]


class HeadlessExecutor:
    """
    Headless Browser Executor for Performance Testing
    
    Runs test scenarios using Playwright in headless mode,
    capturing all network traffic for protocol-level analysis.
    """
    
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context_pool: List[BrowserContext] = []
        self.max_contexts: int = 50  # Max concurrent browser contexts
        self.is_running: bool = False
        
        # Metrics collection
        self.metrics: List[ExecutionMetrics] = []
        self.network_requests: List[NetworkRequest] = []
        self.metrics_callback: Optional[Callable] = None
        
    async def initialize(self, mode: ExecutionMode = ExecutionMode.HEADLESS_BROWSER):
        """Initialize the browser instance"""
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError("Playwright is not installed. Run: pip install playwright && playwright install chromium")
        
        self.playwright = await async_playwright().start()
        
        # Launch browser based on mode
        launch_options = {
            "headless": mode != ExecutionMode.HEADED_DEBUG
        }
        
        self.browser = await self.playwright.chromium.launch(**launch_options)
        logger.info(f"Initialized headless executor in {mode.value} mode")
        
    async def cleanup(self):
        """Cleanup browser resources"""
        # Close all contexts
        for context in self.context_pool:
            try:
                await context.close()
            except:
                pass
        
        self.context_pool.clear()
        
        if self.browser:
            await self.browser.close()
        
        if self.playwright:
            await self.playwright.stop()
        
        logger.info("Headless executor cleaned up")
    
    async def _get_context(self) -> BrowserContext:
        """Get a browser context from pool or create new"""
        if self.context_pool:
            return self.context_pool.pop()
        
        # Create new context with request interception
        context = await self.browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="QAAI-LoadTest/1.0 (Headless Performance Testing)"
        )
        
        return context
    
    async def _return_context(self, context: BrowserContext):
        """Return context to pool or close if pool is full"""
        if len(self.context_pool) < self.max_contexts:
            # Clear cookies/storage before returning to pool
            try:
                await context.clear_cookies()
                self.context_pool.append(context)
            except:
                try:
                    await context.close()
                except:
                    pass
        else:
            try:
                await context.close()
            except:
                pass
    
    async def execute_scenario(
        self,
        scenario: Dict[str, Any],
        user_id: str,
        iteration: int,
        base_url: str = "",
        think_time_ms: int = 1000,
        variables: Dict[str, Any] = None
    ) -> ExecutionMetrics:
        """
        Execute a test scenario as a virtual user
        
        Args:
            scenario: Test scenario with steps
            user_id: Virtual user identifier
            iteration: Current iteration number
            base_url: Base URL for relative paths
            think_time_ms: Think time between steps
            variables: Variable substitutions
        """
        metrics = ExecutionMetrics(
            user_id=user_id,
            iteration=iteration,
            start_time=time.time()
        )
        
        context = await self._get_context()
        page = await context.new_page()
        
        # Track network requests
        captured_requests: List[NetworkRequest] = []
        
        async def handle_request(request):
            """Handle request start"""
            pass  # We capture on response
        
        async def handle_response(response):
            """Handle response received"""
            try:
                timing = response.request.timing
                
                captured_requests.append(NetworkRequest(
                    url=response.url,
                    method=response.request.method,
                    status=response.status,
                    duration_ms=timing.get("responseEnd", 0) - timing.get("requestStart", 0) if timing else 0,
                    size=int(response.headers.get("content-length", 0)),
                    request_headers=dict(response.request.headers),
                    response_headers=dict(response.headers),
                    timing=timing if timing else {}
                ))
                
                metrics.requests_made += 1
                
                if response.status >= 400:
                    metrics.requests_failed += 1
                
            except Exception as e:
                logger.debug(f"Error capturing response: {e}")
        
        # Attach handlers
        page.on("request", handle_request)
        page.on("response", handle_response)
        
        try:
            # Execute scenario steps
            steps = scenario.get("steps", [])
            
            for step in steps:
                if not self.is_running:
                    break
                
                step_start = time.time()
                
                try:
                    await self._execute_step(page, step, base_url, variables or {})
                    metrics.steps_completed += 1
                    
                    # Record response time
                    step_duration = (time.time() - step_start) * 1000
                    metrics.response_times.append(step_duration)
                    
                except Exception as e:
                    metrics.steps_failed += 1
                    metrics.errors.append({
                        "step": step.get("name", "Unknown"),
                        "error": str(e),
                        "timestamp": time.time()
                    })
                    logger.warning(f"Step failed for user {user_id}: {e}")
                
                # Think time between steps
                if think_time_ms > 0:
                    # Add variance (±30%)
                    import random
                    variance = random.uniform(0.7, 1.3)
                    await asyncio.sleep((think_time_ms * variance) / 1000)
            
            # Finalize metrics
            metrics.end_time = time.time()
            metrics.duration_ms = (metrics.end_time - metrics.start_time) * 1000
            
            # Calculate network metrics
            for req in captured_requests:
                metrics.total_bytes_received += req.size
                if req.duration_ms > 0:
                    metrics.response_times.append(req.duration_ms)
            
            # Store network requests
            self.network_requests.extend(captured_requests)
            
        except Exception as e:
            metrics.errors.append({
                "step": "scenario_execution",
                "error": str(e),
                "timestamp": time.time()
            })
            logger.error(f"Scenario execution failed for user {user_id}: {e}")
        
        finally:
            await page.close()
            await self._return_context(context)
        
        # Store metrics
        self.metrics.append(metrics)
        
        # Callback for real-time metrics
        if self.metrics_callback:
            await self.metrics_callback(metrics)
        
        return metrics
    
    async def _execute_step(
        self,
        page: Page,
        step: Dict[str, Any],
        base_url: str,
        variables: Dict[str, Any]
    ):
        """Execute a single test step"""
        step_type = step.get("type") or step.get("action_type", "click")
        timeout = step.get("timeout", 30000)
        
        # Apply variable substitution
        target = self._substitute_variables(step.get("target", ""), variables)
        value = self._substitute_variables(step.get("value", ""), variables)
        selector = self._substitute_variables(step.get("selector", ""), variables)
        
        if step_type == "navigate" or step_type == "goto":
            url = target or value
            if not url.startswith("http"):
                url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
            await page.goto(url, wait_until="networkidle", timeout=timeout)
            
        elif step_type == "click":
            sel = selector or target
            if sel:
                await page.click(sel, timeout=timeout)
                await page.wait_for_load_state("networkidle", timeout=timeout)
            
        elif step_type == "fill" or step_type == "type" or step_type == "input":
            sel = selector or target
            if sel:
                await page.fill(sel, value, timeout=timeout)
            
        elif step_type == "select":
            sel = selector or target
            if sel:
                await page.select_option(sel, value, timeout=timeout)
            
        elif step_type == "wait":
            wait_time = int(step.get("wait_time", value or 1000))
            await asyncio.sleep(wait_time / 1000)
            
        elif step_type == "wait_for_selector":
            sel = selector or target
            if sel:
                await page.wait_for_selector(sel, timeout=timeout)
            
        elif step_type == "screenshot":
            # Skip screenshots in load testing
            pass
            
        elif step_type == "assert":
            # Run assertion
            assertion_type = step.get("assertion_type", "visible")
            sel = selector or target
            
            if assertion_type == "visible":
                await page.wait_for_selector(sel, state="visible", timeout=timeout)
            elif assertion_type == "text":
                element = await page.wait_for_selector(sel, timeout=timeout)
                text = await element.text_content()
                expected = step.get("expected", value)
                if expected and expected not in text:
                    raise AssertionError(f"Expected '{expected}' not found in '{text}'")
            
        elif step_type == "http_request":
            # Direct HTTP request (for API testing within browser context)
            params = step.get("parameters", {})
            method = params.get("method", "GET")
            url = params.get("url", target)
            body = params.get("body")
            
            if not url.startswith("http"):
                url = f"{base_url.rstrip('/')}/{url.lstrip('/')}"
            
            # Use page.evaluate for fetch
            result = await page.evaluate(f"""
                async () => {{
                    const response = await fetch('{url}', {{
                        method: '{method}',
                        headers: {{'Content-Type': 'application/json'}},
                        body: {json.dumps(body) if body else 'undefined'}
                    }});
                    return {{
                        status: response.status,
                        body: await response.text()
                    }};
                }}
            """)
            
            if result.get("status", 0) >= 400:
                raise Exception(f"HTTP {method} {url} failed with status {result.get('status')}")
        
        else:
            logger.warning(f"Unknown step type: {step_type}")
    
    def _substitute_variables(self, text: str, variables: Dict[str, Any]) -> str:
        """Substitute variables in text"""
        if not text or not variables:
            return text
        
        result = text
        for key, value in variables.items():
            result = result.replace(f"${{{key}}}", str(value))
            result = result.replace(f"{{{key}}}", str(value))
        
        return result
    
    async def run_load_test(
        self,
        scenario: Dict[str, Any],
        virtual_users: int = 10,
        duration_seconds: int = 60,
        ramp_up_seconds: int = 10,
        think_time_ms: int = 1000,
        base_url: str = "",
        mode: ExecutionMode = ExecutionMode.HEADLESS_BROWSER,
        metrics_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Run a full load test with multiple virtual users
        
        Args:
            scenario: Test scenario to execute
            virtual_users: Number of concurrent virtual users
            duration_seconds: Test duration
            ramp_up_seconds: Time to ramp up to full load
            think_time_ms: Think time between steps
            base_url: Base URL for the test
            mode: Execution mode
            metrics_callback: Callback for real-time metrics
        """
        logger.info(f"Starting load test: {virtual_users} VUs, {duration_seconds}s duration")
        
        # Initialize if needed
        if not self.browser:
            await self.initialize(mode)
        
        self.is_running = True
        self.metrics = []
        self.network_requests = []
        self.metrics_callback = metrics_callback
        
        start_time = time.time()
        end_time = start_time + duration_seconds
        
        # Calculate ramp-up schedule
        vu_per_second = virtual_users / ramp_up_seconds if ramp_up_seconds > 0 else virtual_users
        
        active_tasks: List[asyncio.Task] = []
        user_counter = 0
        
        async def user_loop(user_id: str):
            """Run iterations for a single virtual user"""
            iteration = 0
            while self.is_running and time.time() < end_time:
                await self.execute_scenario(
                    scenario=scenario,
                    user_id=user_id,
                    iteration=iteration,
                    base_url=base_url,
                    think_time_ms=think_time_ms
                )
                iteration += 1
        
        try:
            # Ramp up users
            while time.time() < end_time and self.is_running:
                elapsed = time.time() - start_time
                target_users = min(virtual_users, int(elapsed * vu_per_second) + 1)
                
                # Add users to reach target
                while user_counter < target_users and self.is_running:
                    user_id = f"vu_{user_counter}"
                    task = asyncio.create_task(user_loop(user_id))
                    active_tasks.append(task)
                    user_counter += 1
                    logger.debug(f"Started virtual user {user_id}")
                
                await asyncio.sleep(1)  # Check every second
            
            # Wait for remaining tasks
            if active_tasks:
                await asyncio.wait(active_tasks, timeout=30)
                
        except Exception as e:
            logger.error(f"Load test error: {e}")
        finally:
            self.is_running = False
        
        # Generate report
        return self._generate_report(start_time, time.time())
    
    def _generate_report(self, start_time: float, end_time: float) -> Dict[str, Any]:
        """Generate load test report"""
        duration = end_time - start_time
        
        all_response_times = []
        total_requests = 0
        failed_requests = 0
        total_bytes = 0
        
        for m in self.metrics:
            all_response_times.extend(m.response_times)
            total_requests += m.requests_made
            failed_requests += m.requests_failed
            total_bytes += m.total_bytes_received
        
        # Calculate percentiles
        sorted_times = sorted(all_response_times) if all_response_times else [0]
        
        def percentile(p: float) -> float:
            if not sorted_times:
                return 0
            idx = int(len(sorted_times) * p)
            return sorted_times[min(idx, len(sorted_times) - 1)]
        
        return {
            "summary": {
                "start_time": datetime.fromtimestamp(start_time).isoformat(),
                "end_time": datetime.fromtimestamp(end_time).isoformat(),
                "duration_seconds": duration,
                "total_iterations": len(self.metrics),
                "total_requests": total_requests,
                "failed_requests": failed_requests,
                "error_rate": failed_requests / max(1, total_requests),
                "throughput_rps": total_requests / max(1, duration),
                "total_bytes_received": total_bytes
            },
            "response_times": {
                "min": min(sorted_times) if sorted_times else 0,
                "max": max(sorted_times) if sorted_times else 0,
                "avg": sum(sorted_times) / len(sorted_times) if sorted_times else 0,
                "p50": percentile(0.5),
                "p75": percentile(0.75),
                "p90": percentile(0.9),
                "p95": percentile(0.95),
                "p99": percentile(0.99)
            },
            "virtual_users": {
                "total": len(set(m.user_id for m in self.metrics)),
                "iterations_per_user": len(self.metrics) / max(1, len(set(m.user_id for m in self.metrics)))
            },
            "errors": [
                error
                for m in self.metrics
                for error in m.errors
            ][:100]  # Limit errors in report
        }
    
    async def stop(self):
        """Stop the running load test"""
        self.is_running = False
        logger.info("Stopping load test...")


# Import json for variable substitution
import json

# Global instance
headless_executor = HeadlessExecutor()
