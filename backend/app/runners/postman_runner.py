import subprocess
import json
import os
import tempfile
from typing import Dict, List, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PostmanRunner:
    """Runner for executing Postman collections using Newman"""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
    
    async def execute(self, artifacts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Execute Postman collection tests"""
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
                if artifact.get("type") == "postman":
                    artifact_result = await self._run_postman_collection(artifact)
                    
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
            logger.error(f"Error executing Postman tests: {str(e)}")
            return {
                "status": "error",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": f"Error: {str(e)}"
            }
    
    async def _run_postman_collection(self, artifact: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single Postman collection"""
        try:
            # Write collection to temporary file
            collection_path = os.path.join(self.temp_dir, f"collection_{datetime.now().timestamp()}.json")
            
            if "content" in artifact:
                with open(collection_path, "w") as f:
                    f.write(artifact["content"])
            else:
                # If no content, create a basic collection
                basic_collection = self._create_basic_collection(artifact)
                with open(collection_path, "w") as f:
                    json.dump(basic_collection, f, indent=2)
            
            # Create JUnit report path
            junit_path = os.path.join(self.temp_dir, f"junit_{datetime.now().timestamp()}.xml")
            
            # Run Newman
            cmd = [
                "newman",
                "run", collection_path,
                "--reporters", "junit,cli",
                "--reporter-junit-export", junit_path,
                "--suppress-exit-code"
            ]
            
            # Add environment file if specified
            if "environment" in artifact.get("metadata", {}):
                env_path = os.path.join(self.temp_dir, f"env_{datetime.now().timestamp()}.json")
                with open(env_path, "w") as f:
                    json.dump(artifact["metadata"]["environment"], f)
                cmd.extend(["--environment", env_path])
            
            # Execute command
            result = subprocess.run(
                cmd,
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
            logger.error(f"Error running Postman collection: {str(e)}")
            return {
                "status": "error",
                "pass_count": 0,
                "fail_count": 0,
                "skip_count": 0,
                "total_count": 0,
                "reports": [],
                "logs": f"Error: {str(e)}"
            }
    
    def _create_basic_collection(self, artifact: Dict[str, Any]) -> Dict[str, Any]:
        """Create a basic Postman collection for testing"""
        return {
            "info": {
                "name": artifact.get("path", "Generated Collection"),
                "description": "Auto-generated Postman collection",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [
                {
                    "name": "Health Check",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {
                            "raw": "{{base_url}}/health",
                            "host": ["{{base_url}}"],
                            "path": ["health"]
                        }
                    },
                    "response": []
                }
            ],
            "variable": [
                {
                    "key": "base_url",
                    "value": "http://localhost:8000",
                    "type": "string"
                }
            ]
        }
    
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
            # In production, use proper XML parser like lxml
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
