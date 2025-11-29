"""
k6 Performance Test Executor
Executes k6 performance tests and processes results.
"""

import os
import json
import subprocess
import tempfile
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class K6Executor:
    """
    Executor for k6 performance tests.
    Generates and executes k6 scripts.
    """

    def __init__(self, k6_binary: Optional[str] = None):
        """
        Initialize k6 executor.
        
        Args:
            k6_binary: Path to k6 binary (default: 'k6' from PATH)
        """
        self.k6_binary = k6_binary or os.getenv("K6_BINARY", "k6")
        self.results_dir = Path(os.getenv("K6_RESULTS_DIR", "/tmp/k6-results"))
        self.results_dir.mkdir(parents=True, exist_ok=True)

    async def execute_test(
        self,
        test_script: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a k6 test script.
        
        Args:
            test_script: k6 JavaScript test script
            options: Execution options (vus, duration, stages, etc.)
            
        Returns:
            Test execution results
        """
        options = options or {}
        
        # Create temporary script file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(test_script)
            script_path = f.name

        try:
            # Build k6 command
            cmd = [self.k6_binary, "run", script_path]
            
            # Add options
            if options.get("vus"):
                cmd.extend(["--vus", str(options["vus"])])
            if options.get("duration"):
                cmd.extend(["--duration", str(options["duration"])])
            if options.get("stages"):
                # Convert stages to k6 format
                stages_str = ",".join([f"{s['duration']}s:{s['target']}" for s in options["stages"]])
                cmd.extend(["--stages", stages_str])
            if options.get("thresholds"):
                # Add thresholds
                for threshold in options["thresholds"]:
                    cmd.extend(["--threshold", threshold])

            # Output JSON
            output_file = self.results_dir / f"k6_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            cmd.extend(["--out", f"json={output_file}"])

            logger.info(f"Executing k6 test: {' '.join(cmd)}")

            # Execute k6
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=options.get("timeout", 3600)  # Default 1 hour timeout
            )

            # Parse results
            if result.returncode == 0:
                # Read JSON output
                if output_file.exists():
                    with open(output_file, 'r') as f:
                        k6_results = json.load(f)
                else:
                    k6_results = {}

                # Extract metrics
                metrics = self._extract_metrics(k6_results)

                return {
                    "status": "success",
                    "metrics": metrics,
                    "raw_output": result.stdout,
                    "results_file": str(output_file)
                }
            else:
                return {
                    "status": "failed",
                    "error": result.stderr,
                    "raw_output": result.stdout,
                    "returncode": result.returncode
                }

        except subprocess.TimeoutExpired:
            return {
                "status": "timeout",
                "error": "Test execution exceeded timeout"
            }
        except Exception as e:
            logger.error(f"Error executing k6 test: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
        finally:
            # Clean up script file
            if os.path.exists(script_path):
                os.unlink(script_path)

    def _extract_metrics(self, k6_results: Dict[str, Any]) -> Dict[str, Any]:
        """Extract key metrics from k6 results"""
        metrics = {
            "http_req_duration": {},
            "http_req_failed": {},
            "http_reqs": {},
            "iterations": {},
            "vus": {},
            "data_sent": {},
            "data_received": {}
        }

        if "metrics" in k6_results:
            for metric_name, metric_data in k6_results["metrics"].items():
                if metric_name in metrics:
                    metrics[metric_name] = {
                        "avg": metric_data.get("values", {}).get("avg", 0),
                        "min": metric_data.get("values", {}).get("min", 0),
                        "max": metric_data.get("values", {}).get("max", 0),
                        "p95": metric_data.get("values", {}).get("p(95)", 0),
                        "p99": metric_data.get("values", {}).get("p(99)", 0),
                        "count": metric_data.get("values", {}).get("count", 0)
                    }

        return metrics

    def generate_test_script(
        self,
        endpoints: List[Dict[str, Any]],
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a k6 test script from endpoint definitions.
        
        Args:
            endpoints: List of endpoints to test with method, URL, headers, body
            options: Test options (vus, duration, etc.)
            
        Returns:
            k6 JavaScript test script
        """
        options = options or {}
        vus = options.get("vus", 10)
        duration = options.get("duration", "30s")

        script = f"""import http from 'k6/http';
import {{ check }} from 'k6';
import {{ Rate }} from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {{
    stages: [
        {{ duration: '10s', target: {vus} }},  // Ramp up
        {{ duration: '{duration}', target: {vus} }},  // Stay at target
        {{ duration: '10s', target: 0 }},  // Ramp down
    ],
    thresholds: {{
        'http_req_duration': ['p(95)<500'],  // 95% of requests < 500ms
        'http_req_failed': ['rate<0.01'],  // Error rate < 1%
        'errors': ['rate<0.01'],
    }},
}};

export default function() {{
"""

        for i, endpoint in enumerate(endpoints):
            method = endpoint.get("method", "GET").upper()
            url = endpoint.get("url", "")
            headers = endpoint.get("headers", {})
            body = endpoint.get("body")

            if method == "GET":
                script += f"""
    // Test endpoint {i+1}: {url}
    const response{i} = http.get('{url}', {{
        headers: {json.dumps(headers)},
    }});
    
    check(response{i}, {{
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    }}) || errorRate.add(1);
"""
            elif method == "POST":
                script += f"""
    // Test endpoint {i+1}: {url}
    const response{i} = http.post('{url}', {json.dumps(body) if body else 'null'}, {{
        headers: {json.dumps(headers)},
    }});
    
    check(response{i}, {{
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    }}) || errorRate.add(1);
"""
            else:
                script += f"""
    // Test endpoint {i+1}: {url} ({method})
    const response{i} = http.request('{method}', '{url}', {json.dumps(body) if body else 'null'}, {{
        headers: {json.dumps(headers)},
    }});
    
    check(response{i}, {{
        'status is 2xx': (r) => r.status >= 200 && r.status < 300,
        'response time < 500ms': (r) => r.timings.duration < 500,
    }}) || errorRate.add(1);
"""

        script += """
}
"""

        return script


# Global instance
k6_executor = K6Executor()




