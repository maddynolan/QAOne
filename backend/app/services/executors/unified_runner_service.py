"""
Unified Runner Service
Routes test execution to appropriate runner based on test type
Supports: UI (Playwright), API (pytest), Performance (k6), Accessibility (axe), Security (ZAP)
"""

import os
import json
import tempfile
import subprocess
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Import existing runners
from app.services.executors.playwright_runner import PlaywrightRunner, TestCase, TestStep
from app.services.executors.k6_executor import k6_executor
from app.services.executors.zap_executor import zap_executor

logger = logging.getLogger(__name__)


class APIRunner:
    """Runner for pytest API tests"""
    
    def __init__(self):
        self.results_dir = Path(os.getenv("API_RESULTS_DIR", "/tmp/api-results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)
    
    async def execute_test(self, test_code: str, test_name: str = "api_test") -> Dict[str, Any]:
        """Execute pytest API test code"""
        try:
            # Create temporary directory
            temp_dir = tempfile.mkdtemp(prefix="api_test_")
            test_file = Path(temp_dir) / f"{test_name}.py"
            
            # Write test code
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write(test_code)
            
            # Create pytest.ini if needed
            pytest_ini = Path(temp_dir) / "pytest.ini"
            with open(pytest_ini, 'w') as f:
                f.write("""[pytest]
testpaths = .
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
""")
            
            # Execute pytest
            result = subprocess.run(
                ["pytest", str(test_file), "-v", "--json-report", "--json-report-file", str(Path(temp_dir) / "report.json")],
                capture_output=True,
                text=True,
                timeout=300,
                cwd=temp_dir
            )
            
            # Parse results
            report_file = Path(temp_dir) / "report.json"
            report_data = {}
            if report_file.exists():
                with open(report_file, 'r') as f:
                    report_data = json.load(f)
            
            passed = result.returncode == 0
            tests = report_data.get("tests", [])
            
            return {
                "status": "passed" if passed else "failed",
                "test_name": test_name,
                "duration": sum(t.get("call", {}).get("duration", 0) for t in tests),
                "tests": tests,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "logs": result.stdout.split('\n') if result.stdout else [],
                "artifacts": {
                    "report": str(report_file) if report_file.exists() else None
                }
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "timeout",
                "error": "Test execution exceeded timeout",
                "test_name": test_name
            }
        except Exception as e:
            logger.error(f"Error executing API test: {e}")
            return {
                "status": "error",
                "error": str(e),
                "test_name": test_name
            }
        finally:
            # Cleanup
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)


class AccessibilityRunner:
    """Runner for accessibility tests using axe-core"""
    
    def __init__(self):
        self.results_dir = Path(os.getenv("A11Y_RESULTS_DIR", "/tmp/a11y-results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)
    
    async def execute_test(self, test_code: str, test_name: str = "a11y_test", target_url: Optional[str] = None) -> Dict[str, Any]:
        """Execute accessibility test code"""
        try:
            # Create temporary directory
            temp_dir = tempfile.mkdtemp(prefix="a11y_test_")
            test_file = Path(temp_dir) / f"{test_name}.js"
            
            # Write test code
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write(test_code)
            
            # Create package.json
            package_json = {
                "name": "a11y-test",
                "version": "1.0.0",
                "dependencies": {
                    "selenium-webdriver": "^4.0.0",
                    "@axe-core/webdriver": "^4.7.0"
                }
            }
            with open(Path(temp_dir) / "package.json", 'w') as f:
                json.dump(package_json, f, indent=2)
            
            # Execute with Node.js
            result = subprocess.run(
                ["node", str(test_file)],
                capture_output=True,
                text=True,
                timeout=120,
                cwd=temp_dir
            )
            
            # Parse results (assuming JSON output)
            violations = []
            try:
                if result.stdout:
                    # Try to extract JSON from output
                    output_lines = result.stdout.split('\n')
                    for line in output_lines:
                        if line.strip().startswith('{'):
                            data = json.loads(line)
                            violations = data.get("violations", [])
                            break
            except:
                pass
            
            passed = len(violations) == 0
            
            return {
                "status": "passed" if passed else "failed",
                "test_name": test_name,
                "duration": 0,  # Could parse from output
                "violations": violations,
                "violation_count": len(violations),
                "stdout": result.stdout,
                "stderr": result.stderr,
                "logs": result.stdout.split('\n') if result.stdout else [],
                "artifacts": {
                    "report": None  # Could save report file
                }
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "timeout",
                "error": "Test execution exceeded timeout",
                "test_name": test_name
            }
        except Exception as e:
            logger.error(f"Error executing accessibility test: {e}")
            return {
                "status": "error",
                "error": str(e),
                "test_name": test_name
            }
        finally:
            # Cleanup
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)


class UnifiedRunnerService:
    """
    Unified service to execute tests across all domains
    Routes to appropriate runner based on test type
    """
    
    def __init__(self):
        self.playwright_runner = PlaywrightRunner()
        self.api_runner = APIRunner()
        self.a11y_runner = AccessibilityRunner()
        # k6_executor and zap_executor are already global instances
    
    async def execute_test(
        self,
        test_type: str,
        test_code: str,
        test_name: str,
        framework: str = None,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a test based on type
        
        Args:
            test_type: ui, api, performance, accessibility, security
            test_code: The generated test code
            test_name: Name of the test
            framework: Optional framework override
            options: Additional execution options
            
        Returns:
            Execution results with status, logs, artifacts
        """
        options = options or {}
        start_time = datetime.now()
        
        try:
            if test_type == "ui" or test_type == "automation":
                # Use Playwright runner
                # Convert code to TestCase if needed, or execute directly
                result = await self._execute_playwright_code(test_code, test_name, options)
            
            elif test_type == "api":
                # Use pytest runner
                result = await self.api_runner.execute_test(test_code, test_name)
            
            elif test_type == "performance" or test_type == "perf":
                # Use k6 executor
                k6_options = options.get("k6_options", {})
                result = await k6_executor.execute_test(test_code, k6_options)
                # Normalize result format
                result = {
                    "status": result.get("status", "unknown"),
                    "test_name": test_name,
                    "duration": 0,  # k6 provides this differently
                    "metrics": result.get("metrics", {}),
                    "logs": result.get("raw_output", "").split('\n') if result.get("raw_output") else [],
                    "artifacts": {
                        "results_file": result.get("results_file"),
                        "metrics": result.get("metrics", {})
                    },
                    "error": result.get("error")
                }
            
            elif test_type == "accessibility" or test_type == "a11y":
                # Use accessibility runner
                target_url = options.get("target_url")
                result = await self.a11y_runner.execute_test(test_code, test_name, target_url)
            
            elif test_type == "security":
                # Use ZAP executor
                target_url = options.get("target_url", "https://example.com")
                scan_type = options.get("scan_type", "spider")
                zap_options = options.get("zap_options", {})
                
                await zap_executor.initialize()
                result = await zap_executor.execute_scan(target_url, scan_type, zap_options)
                
                # Normalize result format
                result = {
                    "status": result.get("status", "unknown"),
                    "test_name": test_name,
                    "duration": 0,
                    "findings": result.get("findings", []),
                    "summary": result.get("summary", {}),
                    "logs": [],
                    "artifacts": {
                        "report": result.get("report", {}).get("file") if result.get("report") else None,
                        "summary": result.get("summary", {})
                    },
                    "error": result.get("error")
                }
            
            else:
                raise ValueError(f"Unsupported test type: {test_type}")
            
            # Add common metadata
            result["test_type"] = test_type
            result["framework"] = framework
            result["execution_time"] = (datetime.now() - start_time).total_seconds()
            result["timestamp"] = datetime.now().isoformat()
            
            return result
            
        except Exception as e:
            logger.error(f"Error in unified runner: {e}")
            return {
                "status": "error",
                "test_name": test_name,
                "test_type": test_type,
                "error": str(e),
                "execution_time": (datetime.now() - start_time).total_seconds(),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _execute_playwright_code(
        self,
        test_code: str,
        test_name: str,
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute Playwright TypeScript code"""
        try:
            # Use PlaywrightExecutor for code execution
            from app.services.executors.playwright_executor import PlaywrightExecutor
            
            executor = PlaywrightExecutor()
            
            # Extract test case from code or create a generic one
            # For now, create a test case dict that executor can use
            test_case_dict = {
                "title": test_name,
                "description": f"Generated test: {test_name}",
                "steps": []  # Executor will use the code directly
            }
            
            # Store code in temp file and execute
            temp_dir = tempfile.mkdtemp(prefix="playwright_code_")
            code_file = Path(temp_dir) / f"{test_name}.spec.ts"
            
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(test_code)
            
            # Execute using executor's subprocess method
            result = await executor.execute_test(test_case_dict)
            
            # Enhance with code execution details
            result["test_code"] = test_code
            result["code_file"] = str(code_file)
            
            return result
            
        except Exception as e:
            logger.error(f"Error executing Playwright code: {e}")
            return {
                "status": "error",
                "test_name": test_name,
                "error": str(e)
            }
    
    async def execute_multiple_tests(
        self,
        tests: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Execute multiple tests and return results"""
        results = []
        
        for test in tests:
            test_type = test.get("test_type", "ui")
            test_code = test.get("code", "")
            test_name = test.get("name", test.get("id", "unnamed_test"))
            framework = test.get("framework")
            options = test.get("options", {})
            
            result = await self.execute_test(
                test_type=test_type,
                test_code=test_code,
                test_name=test_name,
                framework=framework,
                options=options
            )
            
            results.append(result)
        
        return results


# Global instance
unified_runner_service = UnifiedRunnerService()


