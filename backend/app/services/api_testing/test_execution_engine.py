"""
Test Execution Engine - Multiple Testing Modes
Supports: Manual, Automated, Scheduled, CI/CD execution
"""

import logging
import asyncio
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from uuid import uuid4
import aiohttp
import time

logger = logging.getLogger(__name__)


class TestExecutionEngine:
    """
    Comprehensive test execution engine
    Supports multiple testing modes and execution strategies
    """
    
    def __init__(self):
        self.execution_modes = ["manual", "automated", "scheduled", "ci_cd", "load"]
        # Initialize correlation engine for property transfer
        from app.services.performance.correlation_engine import CorrelationEngine
        self.correlation_engine = CorrelationEngine()
        self.active_executions: Dict[str, Any] = {}
    
    async def execute_test_suite(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        mode: str = "automated"
    ) -> Dict[str, Any]:
        """
        Execute a test suite
        
        Args:
            test_suite: Test suite to execute
            execution_config: Execution configuration
            mode: Execution mode (manual, automated, scheduled, ci_cd, load)
            
        Returns:
            Execution results
        """
        execution_id = str(uuid4())
        start_time = datetime.utcnow()
        
        try:
            if mode == "manual":
                return await self._execute_manual(test_suite, execution_config, execution_id)
            elif mode == "automated":
                return await self._execute_automated(test_suite, execution_config, execution_id)
            elif mode == "scheduled":
                return await self._execute_scheduled(test_suite, execution_config, execution_id)
            elif mode == "ci_cd":
                return await self._execute_ci_cd(test_suite, execution_config, execution_id)
            elif mode == "load":
                return await self._execute_load(test_suite, execution_config, execution_id)
            else:
                raise ValueError(f"Unsupported execution mode: {mode}")
                
        except Exception as e:
            logger.error(f"Test execution failed: {e}", exc_info=True)
            return {
                "execution_id": execution_id,
                "status": "failed",
                "error": str(e),
                "start_time": start_time.isoformat(),
                "end_time": datetime.utcnow().isoformat()
            }
    
    async def _execute_manual(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute tests in manual mode (step-by-step)"""
        results = {
            "execution_id": execution_id,
            "mode": "manual",
            "status": "in_progress",
            "test_results": [],
            "start_time": datetime.utcnow().isoformat()
        }
        
        # In manual mode, return test cases for manual execution
        test_cases = test_suite.get("test_cases", [])
        for tc in test_cases:
            results["test_results"].append({
                "test_case_id": tc.get("test_case_id"),
                "title": tc.get("title"),
                "status": "pending",
                "manual_execution_required": True
            })
        
        results["status"] = "ready_for_manual_execution"
        return results
    
    async def _execute_automated(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute tests in automated mode with property transfer support"""
        base_url = test_suite.get("base_url", execution_config.get("base_url", ""))
        test_cases = test_suite.get("test_cases", [])
        parallel = execution_config.get("parallel", False)
        max_workers = execution_config.get("max_workers", 5)
        
        # Initialize correlation session for property transfer
        session_id = execution_config.get("session_id", execution_id)
        self.correlation_engine.clear_session(session_id)
        
        # Add correlation rules from test suite or config
        correlation_rules = execution_config.get("correlation_rules", [])
        for rule_config in correlation_rules:
            from app.services.performance.correlation_engine import CorrelationRule
            rule = CorrelationRule(
                variable_name=rule_config.get("variable_name"),
                extract_type=rule_config.get("extract_type", "jsonpath"),
                extract_value=rule_config.get("extract_value"),
                apply_to=rule_config.get("apply_to", ["all"]),
                scope=rule_config.get("scope", "session")
            )
            self.correlation_engine.add_rule(rule)
        
        results = {
            "execution_id": execution_id,
            "mode": "automated",
            "status": "running",
            "test_results": [],
            "start_time": datetime.utcnow().isoformat(),
            "base_url": base_url
        }
        
        if parallel:
            # Execute tests in parallel (limited correlation support)
            tasks = [
                self._execute_test_case(tc, base_url, execution_config, session_id)
                for tc in test_cases
            ]
            test_results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            # Execute tests sequentially with full property transfer support
            test_results = []
            for tc in test_cases:
                result = await self._execute_test_case(tc, base_url, execution_config, session_id)
                test_results.append(result)
        
        results["test_results"] = test_results
        results["status"] = "completed"
        results["end_time"] = datetime.utcnow().isoformat()
        results["summary"] = self._calculate_summary(test_results)
        
        # Include correlation data in results
        correlation_data = self.correlation_engine.get_correlation_data(session_id)
        results["correlation_data"] = correlation_data
        
        return results
    
    async def _execute_scheduled(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute tests in scheduled mode"""
        schedule = execution_config.get("schedule", {})
        cron_expression = schedule.get("cron")
        timezone = schedule.get("timezone", "UTC")
        
        # For now, execute immediately (scheduling would be handled by external scheduler)
        # In production, this would integrate with Celery, APScheduler, or similar
        return await self._execute_automated(test_suite, execution_config, execution_id)
    
    async def _execute_ci_cd(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute tests in CI/CD mode (fast, fail-fast)"""
        execution_config["parallel"] = True
        execution_config["fail_fast"] = True
        execution_config["max_workers"] = 10
        
        results = await self._execute_automated(test_suite, execution_config, execution_id)
        results["mode"] = "ci_cd"
        
        # In CI/CD mode, exit code should reflect test results
        if results["summary"]["failed"] > 0:
            results["exit_code"] = 1
        else:
            results["exit_code"] = 0
        
        return results
    
    async def _execute_load(
        self,
        test_suite: Dict[str, Any],
        execution_config: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute load/performance tests"""
        load_config = execution_config.get("load_config", {})
        virtual_users = load_config.get("virtual_users", 10)
        duration_seconds = load_config.get("duration_seconds", 60)
        ramp_up_seconds = load_config.get("ramp_up_seconds", 10)
        
        results = {
            "execution_id": execution_id,
            "mode": "load",
            "status": "running",
            "load_config": load_config,
            "start_time": datetime.utcnow().isoformat()
        }
        
        # Simulate load testing (in production, use k6, Locust, or similar)
        test_cases = test_suite.get("test_cases", [])[:5]  # Limit for load testing
        base_url = test_suite.get("base_url", execution_config.get("base_url", ""))
        
        load_results = []
        start_time = time.time()
        
        while time.time() - start_time < duration_seconds:
            # Execute tests with virtual users
            tasks = []
            for _ in range(virtual_users):
                for tc in test_cases:
                    tasks.append(self._execute_test_case(tc, base_url, execution_config))
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            load_results.extend(batch_results)
            
            await asyncio.sleep(1)  # Wait 1 second between batches
        
        results["test_results"] = load_results
        results["status"] = "completed"
        results["end_time"] = datetime.utcnow().isoformat()
        results["performance_metrics"] = self._calculate_performance_metrics(load_results)
        results["summary"] = self._calculate_summary(load_results)
        
        return results
    
    async def _execute_test_case(
        self,
        test_case: Dict[str, Any],
        base_url: str,
        execution_config: Dict[str, Any],
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """Execute a single test case with property transfer support"""
        test_id = test_case.get("test_case_id", str(uuid4()))
        method = test_case.get("method", "GET")
        path = test_case.get("path", "")
        request_config = test_case.get("request", {})
        expected_status = test_case.get("expected_status", 200)
        
        # Get correlation data for property transfer
        correlation_data = self.correlation_engine.get_correlation_data(session_id)
        
        start_time = time.time()
        
        try:
            # Apply correlation to path, headers, body, and params
            path = self.correlation_engine.apply_correlation(path, session_id)
            url = f"{base_url}{path}" if not path.startswith("http") else path
            url = self.correlation_engine.apply_correlation(url, session_id)
            
            async with aiohttp.ClientSession() as session:
                # Prepare request with property transfer
                headers = request_config.get("headers", {})
                headers = self.correlation_engine.apply_correlation_dict(headers, session_id)
                
                body = request_config.get("body")
                if body:
                    if isinstance(body, dict):
                        body = self.correlation_engine.apply_correlation_dict(body, session_id)
                    elif isinstance(body, str):
                        body = self.correlation_engine.apply_correlation(body, session_id)
                
                params = request_config.get("query", {})
                params = self.correlation_engine.apply_correlation_dict(params, session_id)
                
                # Set default Content-Type for POST/PUT/PATCH if not specified
                if method in ["POST", "PUT", "PATCH"] and "Content-Type" not in headers and "content-type" not in headers:
                    headers["Content-Type"] = "application/json"
                
                # Make request
                if method == "GET":
                    async with session.get(url, headers=headers, params=params) as response:
                        response_data = await response.json() if response.content_type == "application/json" else await response.text()
                        status_code = response.status
                elif method == "POST":
                    # Handle form data vs JSON
                    if headers.get("Content-Type") == "application/x-www-form-urlencoded":
                        async with session.post(url, headers=headers, data=body, params=params) as response:
                            response_data = await response.json() if response.content_type == "application/json" else await response.text()
                            status_code = response.status
                    else:
                        async with session.post(url, headers=headers, json=body, params=params) as response:
                            response_data = await response.json() if response.content_type == "application/json" else await response.text()
                            status_code = response.status
                elif method == "PUT":
                    async with session.put(url, headers=headers, json=body, params=params) as response:
                        response_data = await response.json() if response.content_type == "application/json" else await response.text()
                        status_code = response.status
                elif method == "PATCH":
                    async with session.patch(url, headers=headers, json=body, params=params) as response:
                        response_data = await response.json() if response.content_type == "application/json" else await response.text()
                        status_code = response.status
                elif method == "DELETE":
                    async with session.delete(url, headers=headers, params=params) as response:
                        response_data = await response.json() if response.content_type == "application/json" else await response.text()
                        status_code = response.status
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                response_time_ms = (time.time() - start_time) * 1000
                passed = status_code == expected_status
                
                # Extract correlation data from response (property transfer)
                response_headers_dict = dict(response.headers)
                extracted_variables = self.correlation_engine.extract_from_response(
                    response_body=response_data,
                    response_headers=response_headers_dict,
                    session_id=session_id
                )
                
                # Also extract from test case correlation rules if specified
                test_case_correlation = test_case.get("correlation", {})
                if test_case_correlation:
                    for var_name, extract_config in test_case_correlation.items():
                        extract_type = extract_config.get("type", "jsonpath")
                        extract_value = extract_config.get("path", "")
                        
                        if extract_type == "jsonpath":
                            value = self.correlation_engine._extract_jsonpath(response_data, extract_value)
                        elif extract_type == "regex":
                            text = self.correlation_engine._response_to_text(response_data)
                            value = self.correlation_engine._extract_regex(text, extract_value)
                        elif extract_type == "header":
                            value = response_headers_dict.get(extract_value)
                        else:
                            value = None
                        
                        if value is not None:
                            extracted_variables[var_name] = value
                            self.correlation_engine.set_correlation_data(session_id, {var_name: value})
                
                # Run assertions
                assertions_result = self._run_assertions(
                    test_case.get("assertions", []),
                    response_data,
                    status_code,
                    response_headers_dict,
                    response_time_ms
                )
                
                return {
                    "test_case_id": test_id,
                    "title": test_case.get("title", ""),
                    "status": "passed" if passed and assertions_result["passed"] else "failed",
                    "method": method,
                    "url": url,
                    "expected_status": expected_status,
                    "actual_status": status_code,
                    "response_time_ms": response_time_ms,
                    "response_data": response_data if len(str(response_data)) < 1000 else str(response_data)[:1000] + "...",
                    "assertions": assertions_result,
                    "extracted_variables": extracted_variables,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            return {
                "test_case_id": test_id,
                "title": test_case.get("title", ""),
                "status": "failed",
                "error": str(e),
                "response_time_ms": response_time_ms,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def _run_assertions(
        self,
        assertions: List[str],
        response_data: Any,
        status_code: int,
        response_headers: Dict[str, str] = None,
        response_time_ms: float = 0
    ) -> Dict[str, Any]:
        """Run assertions on response using enhanced assertion engine"""
        from app.services.api_testing.enhanced_assertion_engine import EnhancedAssertionEngine
        
        engine = EnhancedAssertionEngine()
        return engine.evaluate_assertions(
            assertions=assertions,
            response_data=response_data,
            status_code=status_code,
            response_headers=response_headers or {},
            response_time_ms=response_time_ms,
            context={}
        )
    
    def _calculate_summary(self, test_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate execution summary"""
        total = len(test_results)
        passed = sum(1 for r in test_results if r.get("status") == "passed")
        failed = sum(1 for r in test_results if r.get("status") == "failed")
        skipped = sum(1 for r in test_results if r.get("status") == "skipped")
        
        response_times = [r.get("response_time_ms", 0) for r in test_results if r.get("response_time_ms")]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        max_response_time = max(response_times) if response_times else 0
        min_response_time = min(response_times) if response_times else 0
        
        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "pass_rate": (passed / total * 100) if total > 0 else 0,
            "avg_response_time_ms": avg_response_time,
            "max_response_time_ms": max_response_time,
            "min_response_time_ms": min_response_time
        }
    
    def _calculate_performance_metrics(
        self,
        test_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate performance metrics"""
        response_times = [r.get("response_time_ms", 0) for r in test_results if r.get("response_time_ms")]
        
        if not response_times:
            return {}
        
        sorted_times = sorted(response_times)
        p50 = sorted_times[len(sorted_times) // 2]
        p95 = sorted_times[int(len(sorted_times) * 0.95)]
        p99 = sorted_times[int(len(sorted_times) * 0.99)]
        
        return {
            "total_requests": len(test_results),
            "avg_response_time_ms": sum(response_times) / len(response_times),
            "min_response_time_ms": min(response_times),
            "max_response_time_ms": max(response_times),
            "p50_response_time_ms": p50,
            "p95_response_time_ms": p95,
            "p99_response_time_ms": p99,
            "requests_per_second": len(test_results) / (max(response_times) / 1000) if response_times else 0
        }


# Global instance
_test_execution_engine = None

def get_test_execution_engine() -> TestExecutionEngine:
    """Get or create global TestExecutionEngine instance"""
    global _test_execution_engine
    if _test_execution_engine is None:
        _test_execution_engine = TestExecutionEngine()
    return _test_execution_engine



