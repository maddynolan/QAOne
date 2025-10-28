import subprocess
import json
import os
import tempfile
from typing import Dict, List, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PlaywrightRunner:
    """Runner for executing Playwright tests"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
    
    async def execute(self, artifacts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute Playwright tests"""
        try:
            results = {
                "status": "passed",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": ""
            }
            
            for artifact in artifacts:
                if artifact.get("type") == "playwright":
                    artifact_result = await self._run_playwright_tests(artifact)
                    
                    # Aggregate results
                    results["pass_count"] += artifact_result["pass_count"]
                    results["fail_count"] += artifact_result["fail_count"]
                    results["skip_count"] += artifact_result["skip_count"]
                    results["total_count"] += artifact_result["total_count"]
                    results["reports"].extend(artifact_result["reports"])
                    results["logs"] += artifact_result["logs"] + "\n"
                    
                    # Update overall status
                    if artifact_result["status"] == "failed":
                        results["status"] = "failed"
            
            return results
            
        except Exception as e:
            logger.error(f"Error executing Playwright tests: {str(e)}")
            return {
                "status": "error",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": f"Error: {str(e)}"
            }
    
    async def _run_playwright_tests(self, artifact: Dict[str, Any]) -> Dict[str, Any]:
        """Run Playwright tests"""
        try:
            # Create test directory
            test_dir = os.path.join(self.temp_dir, f"playwright_{datetime.now().timestamp()}")
            os.makedirs(test_dir, exist_ok=True)
            
            # Write test file
            test_file = os.path.join(test_dir, "test.spec.js")
            
            if "content" in artifact:
                with open(test_file, "w") as f:
                    f.write(artifact["content"])
            else:
                # Create basic test if no content provided
                basic_test = self._create_basic_test(artifact)
                with open(test_file, "w") as f:
                    f.write(basic_test)
            
            # Create playwright config
            config_file = os.path.join(test_dir, "playwright.config.js")
            config_content = self._create_playwright_config()
            with open(config_file, "w") as f:
                f.write(config_content)
            
            # Create JUnit report path
            junit_path = os.path.join(test_dir, "results.xml")
            
            # Run Playwright tests
            cmd = [
                "npx", "playwright", "test",
                "--config", config_file,
                "--reporter", "junit",
                "--output", junit_path,
                "--timeout", "30000"
            ]
            
            # Execute command
            result = subprocess.run(
                cmd,
                cwd=test_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            # Parse JUnit results
            junit_results = self._parse_junit_results(junit_path)
            
            # Determine status
            status = "passed"
            if result.returncode != 0 or junit_results["fail_count"] > 0:
                status = "failed"
            
            return {
                "status": status,
                "pass_count": junit_results["pass_count"],
                "fail_count": junit_results["fail_count"],
                "skip_count": junit_results["skip_count"],
                "total_count": junit_results["total_count"],
                "reports": [
                    {
                        "type": "junit",
                        "path": junit_path,
                        "content": junit_results["xml_content"]
                    }
                ],
                "logs": result.stdout + result.stderr
            }
            
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": "Test execution timed out"
            }
        except Exception as e:
            logger.error(f"Error running Playwright tests: {str(e)}")
            return {
                "status": "error",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": f"Error: {str(e)}"
            }
    
    def _create_basic_test(self, artifact: Dict[str, Any]) -> str:
        """Create a basic Playwright test"""
        return """
const { test, expect } = require('@playwright/test');

test('basic page test', async ({ page }) => {
  // Navigate to the page
  await page.goto('http://localhost:3000');
  
  // Check if page loads
  await expect(page).toHaveTitle(/QA AI Platform/);
  
  // Check for basic elements
  await expect(page.locator('h1')).toBeVisible();
});

test('health check', async ({ page }) => {
  // Test API health endpoint
  const response = await page.request.get('http://localhost:8000/health');
  expect(response.status()).toBe(200);
  
  const data = await response.json();
  expect(data.status).toBe('healthy');
});
"""
    
    def _create_playwright_config(self) -> str:
        """Create Playwright configuration"""
        return """
module.exports = {
  testDir: './',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['junit', { outputFile: 'results.xml' }],
    ['html']
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
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
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
};
"""
    
    def _parse_junit_results(self, junit_path: str) -> Dict[str, Any]:
        """Parse JUnit XML results"""
        try:
            if not os.path.exists(junit_path):
                return {
                    "pass_count": 0,
                    "fail_count": 0,
                    "skip_count": 0,
                    "total_count": 0,
                    "xml_content": ""
                }
            
            with open(junit_path, "r") as f:
                xml_content = f.read()
            
            # Simple XML parsing for JUnit results
            import re
            
            # Extract test counts from XML
            tests_match = re.search(r'tests="(\d+)"', xml_content)
            failures_match = re.search(r'failures="(\d+)"', xml_content)
            skipped_match = re.search(r'skipped="(\d+)"', xml_content)
            
            total_count = int(tests_match.group(1)) if tests_match else 0
            fail_count = int(failures_match.group(1)) if failures_match else 0
            skip_count = int(skipped_match.group(1)) if skipped_match else 0
            pass_count = total_count - fail_count - skip_count
            
            return {
                "pass_count": pass_count,
                "fail_count": fail_count,
                "skip_count": skip_count,
                "total_count": total_count,
                "xml_content": xml_content
            }
            
        except Exception as e:
            logger.error(f"Error parsing JUnit results: {str(e)}")
            return {
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "xml_content": ""
            }
