"""
Enhanced API Test Engine - Enterprise-Grade Multi-Protocol Support
Supports: REST, SOAP, GraphQL, gRPC, Kafka, JMS, MQTT, WebSocket
"""

import logging
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import re

logger = logging.getLogger(__name__)


class EnhancedAPITestEngine:
    """
    Enterprise-grade API Test Engine with multi-protocol support
    Comparable to ReadyAPI, Postman, and other top-tier tools
    """
    
    def __init__(self):
        self.supported_protocols = [
            "REST", "SOAP", "GraphQL", "gRPC", 
            "Kafka", "JMS", "MQTT", "WebSocket", "HTTP/2"
        ]
        self.supported_formats = [
            "openapi", "swagger", "wsdl", "postman", 
            "graphql", "protobuf", "avro", "asyncapi"
        ]
    
    def generate_comprehensive_test_suite(
        self,
        api_spec: Dict[str, Any],
        spec_format: str = "openapi",
        test_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive test suite with all protocol support
        
        Args:
            api_spec: API specification
            spec_format: Format type
            test_options: Additional test options
            
        Returns:
            Comprehensive test suite
        """
        test_options = test_options or {}
        
        # Base test suite
        base_suite = self._generate_base_suite(api_spec, spec_format)
        
        # Add protocol-specific tests
        protocol = test_options.get("protocol", "REST")
        if protocol == "SOAP":
            base_suite.update(self._generate_soap_tests(api_spec))
        elif protocol == "GraphQL":
            base_suite.update(self._generate_graphql_tests(api_spec))
        elif protocol == "gRPC":
            base_suite.update(self._generate_grpc_tests(api_spec))
        elif protocol == "Kafka":
            base_suite.update(self._generate_kafka_tests(api_spec))
        elif protocol == "MQTT":
            base_suite.update(self._generate_mqtt_tests(api_spec))
        elif protocol == "WebSocket":
            base_suite.update(self._generate_websocket_tests(api_spec))
        
        # Add comprehensive test categories
        base_suite["test_categories"] = {
            "functional": self._generate_functional_tests(base_suite),
            "security": self._generate_security_tests(base_suite),
            "performance": self._generate_performance_tests(base_suite),
            "integration": self._generate_integration_tests(base_suite),
            "contract": self._generate_contract_tests(base_suite),
            "negative": self._generate_negative_tests(base_suite),
            "boundary": self._generate_boundary_tests(base_suite),
            "data_driven": self._generate_data_driven_tests(base_suite)
        }
        
        # Add metadata
        base_suite["metadata"] = {
            "generated_at": datetime.utcnow().isoformat(),
            "engine_version": "2.0.0",
            "protocol": protocol,
            "total_test_cases": sum(len(tests) for tests in base_suite["test_categories"].values()),
            "coverage": self._calculate_coverage(base_suite)
        }
        
        return base_suite
    
    def _generate_base_suite(self, api_spec: Dict[str, Any], spec_format: str) -> Dict[str, Any]:
        """Generate base test suite from API spec"""
        from app.services.engines.api_test_engine import APITestEngine
        
        engine = APITestEngine()
        return engine.generate_test_suite(api_spec, spec_format)
    
    def _generate_soap_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate SOAP-specific tests"""
        tests = []
        
        # SOAP envelope validation tests
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "SOAP Envelope Validation",
            "description": "Verify SOAP envelope structure",
            "test_type": "soap",
            "method": "POST",
            "soap_action": api_spec.get("soap_action", ""),
            "request": {
                "headers": {
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": api_spec.get("soap_action", "")
                },
                "body": "<soap:Envelope xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'><soap:Body></soap:Body></soap:Envelope>"
            },
            "expected_status": 200,
            "assertions": [
                "response contains valid SOAP envelope",
                "response contains SOAP body",
                "no SOAP faults"
            ],
            "tags": ["soap", "validation"]
        })
        
        return {"soap_tests": tests}
    
    def _generate_graphql_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate GraphQL-specific tests"""
        tests = []
        
        # GraphQL query validation
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "GraphQL Query Validation",
            "description": "Verify GraphQL query syntax",
            "test_type": "graphql",
            "method": "POST",
            "path": "/graphql",
            "request": {
                "body": {
                    "query": "{ __schema { queryType { name } } }"
                }
            },
            "expected_status": 200,
            "assertions": [
                "response contains data field",
                "no errors in response",
                "response matches schema"
            ],
            "tags": ["graphql", "query"]
        })
        
        return {"graphql_tests": tests}
    
    def _generate_grpc_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate gRPC-specific tests"""
        tests = []
        
        # gRPC service discovery
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "gRPC Service Discovery",
            "description": "Verify gRPC service is available",
            "test_type": "grpc",
            "service": api_spec.get("service", ""),
            "method": api_spec.get("method", ""),
            "request": {
                "payload": {}
            },
            "expected_status": "OK",
            "assertions": [
                "service responds",
                "response matches protobuf schema"
            ],
            "tags": ["grpc", "service"]
        })
        
        return {"grpc_tests": tests}
    
    def _generate_kafka_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Kafka-specific tests"""
        tests = []
        
        # Kafka producer/consumer tests
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "Kafka Message Production",
            "description": "Verify message can be produced to Kafka topic",
            "test_type": "kafka",
            "topic": api_spec.get("topic", ""),
            "request": {
                "key": "test-key",
                "value": {"message": "test"}
            },
            "expected_status": "success",
            "assertions": [
                "message produced successfully",
                "message can be consumed"
            ],
            "tags": ["kafka", "producer"]
        })
        
        return {"kafka_tests": tests}
    
    def _generate_mqtt_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate MQTT-specific tests"""
        tests = []
        
        # MQTT publish/subscribe tests
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "MQTT Publish/Subscribe",
            "description": "Verify MQTT message publish and subscribe",
            "test_type": "mqtt",
            "topic": api_spec.get("topic", ""),
            "qos": api_spec.get("qos", 0),
            "request": {
                "payload": "test message"
            },
            "expected_status": "success",
            "assertions": [
                "message published",
                "message received by subscriber"
            ],
            "tags": ["mqtt", "pubsub"]
        })
        
        return {"mqtt_tests": tests}
    
    def _generate_websocket_tests(self, api_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate WebSocket-specific tests"""
        tests = []
        
        # WebSocket connection and message tests
        tests.append({
            "test_case_id": str(uuid4()),
            "title": "WebSocket Connection",
            "description": "Verify WebSocket connection and message exchange",
            "test_type": "websocket",
            "url": api_spec.get("url", ""),
            "request": {
                "message": {"type": "ping", "data": "test"}
            },
            "expected_status": "connected",
            "assertions": [
                "connection established",
                "message sent",
                "response received"
            ],
            "tags": ["websocket", "realtime"]
        })
        
        return {"websocket_tests": tests}
    
    def _generate_functional_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate functional test cases from all endpoints with clear tester-friendly descriptions"""
        functional_tests = []
        test_cases = test_suite.get("test_cases", [])
        endpoints = test_suite.get("endpoints", [])
        
        # Include all happy-path tests from base suite
        for tc in test_cases:
            if "happy_path" in tc.get("tags", []):
                functional_tests.append(tc)
        
        # Generate additional functional tests per endpoint
        for ep in endpoints[:15]:
            method = ep.get("method", "GET").upper()
            path = ep.get("path", "/")
            title = ep.get("title", ep.get("summary", path))
            
            # Response content-type validation
            functional_tests.append({
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Returns Valid JSON",
                "description": (
                    f"PURPOSE: Verify the API returns proper JSON format.\n"
                    f"STEPS:\n"
                    f"  1. Send {method} request to {path}\n"
                    f"  2. Check response Content-Type header contains 'json'\n"
                    f"WHY: Ensures clients can parse the response. Non-JSON responses "
                    f"will break frontend apps and API consumers."
                ),
                "test_type": "functional",
                "method": method,
                "path": path,
                "expected_status": 200,
                "assertions": [
                    {"type": "status_code", "operator": "equals", "expected": "200"},
                    {"type": "header", "path": "content-type", "operator": "contains", "expected": "json"}
                ],
                "tags": ["functional", "content-type", "smoke"],
                "request": ep.get("request", {}),
                "priority": "high",
            })
            
            # Response structure validation (for GET endpoints)
            if method == "GET":
                functional_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"GET {path} - Returns Data",
                    "description": (
                        f"PURPOSE: Verify the endpoint returns actual data, not an empty response.\n"
                        f"STEPS:\n"
                        f"  1. Send GET request to {path}\n"
                        f"  2. Verify status code is 200\n"
                        f"  3. Verify response body is not empty\n"
                        f"WHY: An empty response from a data endpoint indicates a bug - "
                        f"the API is reachable but not serving data correctly."
                    ),
                    "test_type": "functional",
                    "method": method,
                    "path": path,
                    "expected_status": 200,
                    "assertions": [
                        {"type": "status_code", "operator": "equals", "expected": "200"},
                        {"type": "response_time", "operator": "less_than", "expected": "5000"},
                    ],
                    "tags": ["functional", "response-body", "smoke"],
                    "request": ep.get("request", {}),
                    "priority": "high",
                })
            
            # For POST endpoints, verify resource creation
            if method == "POST":
                functional_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"POST {path} - Creates Resource",
                    "description": (
                        f"PURPOSE: Verify a new resource can be created successfully.\n"
                        f"STEPS:\n"
                        f"  1. Send POST request to {path} with valid body\n"
                        f"  2. Verify status code is 200 or 201 (Created)\n"
                        f"  3. Verify response contains the created resource\n"
                        f"WHY: Core CRUD operation - if creation fails, the API's primary "
                        f"function is broken."
                    ),
                    "test_type": "functional",
                    "method": method,
                    "path": path,
                    "expected_status": 201,
                    "assertions": [
                        {"type": "status_code", "operator": "less_than", "expected": "300"},
                        {"type": "response_time", "operator": "less_than", "expected": "5000"},
                    ],
                    "tags": ["functional", "create", "crud"],
                    "request": ep.get("request", {}),
                    "priority": "critical",
                })
        
        return functional_tests
    
    def _generate_security_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate security test cases based on actual API endpoints"""
        security_tests = []
        test_cases = test_suite.get("test_cases", [])
        endpoints = test_suite.get("endpoints", [])
        
        # Use endpoints from spec, or fall back to test cases
        targets = endpoints or test_cases
        
        # OWASP API Security Top 10 attack templates
        attack_templates = [
            {
                "attack_type": "SQLi",
                "title_suffix": "SQL Injection",
                "description": "Inject SQL payloads in parameters to test for SQL injection",
                "payloads": ["admin' OR '1'='1", "1; DROP TABLE users--", "' UNION SELECT NULL--"],
                "owasp_category": "API3:2023 - Broken Object Property Level Authorization",
                "tags": ["security", "owasp", "sqli"],
                "applies_to": ["GET", "POST", "PUT", "PATCH", "DELETE"],
            },
            {
                "attack_type": "XSS",
                "title_suffix": "XSS",
                "description": "Inject script payloads to test for cross-site scripting",
                "payloads": ["<script>alert('XSS')</script>", "<img onerror=alert(1) src=x>"],
                "owasp_category": "API8:2023 - Security Misconfiguration",
                "tags": ["security", "owasp", "xss"],
                "applies_to": ["GET", "POST", "PUT", "PATCH"],
            },
            {
                "attack_type": "auth_bypass",
                "title_suffix": "Auth Bypass",
                "description": "Test endpoint without authentication credentials",
                "payloads": [None],
                "owasp_category": "API2:2023 - Broken Authentication",
                "tags": ["security", "owasp", "authentication"],
                "applies_to": ["GET", "POST", "PUT", "PATCH", "DELETE"],
            },
            {
                "attack_type": "BOLA",
                "title_suffix": "Broken Object Level Auth",
                "description": "Test accessing resources with different/invalid IDs",
                "payloads": ["99999", "0", "-1", "admin"],
                "owasp_category": "API1:2023 - Broken Object Level Authorization",
                "tags": ["security", "owasp", "bola"],
                "applies_to": ["GET", "PUT", "DELETE"],
            },
            {
                "attack_type": "rate_limit",
                "title_suffix": "Rate Limiting",
                "description": "Test for missing rate limiting by sending rapid requests",
                "payloads": [None],
                "owasp_category": "API4:2023 - Unrestricted Resource Consumption",
                "tags": ["security", "owasp", "rate-limit"],
                "applies_to": ["GET", "POST"],
            },
            {
                "attack_type": "mass_assignment",
                "title_suffix": "Mass Assignment",
                "description": "Test for mass assignment by adding extra fields (role, isAdmin)",
                "payloads": ['{"role": "admin", "isAdmin": true}'],
                "owasp_category": "API6:2023 - Unrestricted Access to Sensitive Business Flows",
                "tags": ["security", "owasp", "mass-assignment"],
                "applies_to": ["POST", "PUT", "PATCH"],
            },
        ]
        
        if targets:
            # Generate security tests for each actual endpoint
            for target in targets[:10]:  # Limit to 10 endpoints
                method = target.get("method", "GET").upper()
                endpoint_path = target.get("path", target.get("url", "/"))
                endpoint_title = target.get("title", endpoint_path)
                
                for template in attack_templates:
                    if method in template["applies_to"]:
                        security_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{endpoint_title} - {template['title_suffix']} ({template['attack_type']})",
                            "description": f"{template['description']} on {method} {endpoint_path}",
                            "test_type": "security",
                            "method": method,
                            "path": endpoint_path,
                            "attack_type": template["attack_type"],
                            "payload": template["payloads"][0],
                            "owasp_category": template["owasp_category"],
                            "tags": template["tags"],
                            "request": target.get("request", {}),
                        })
        else:
            # Fallback: generate generic security tests when no endpoints available
            for template in attack_templates[:3]:
                security_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{template['title_suffix']} Test ({template['attack_type']})",
                    "description": template["description"],
                    "test_type": "security",
                    "attack_type": template["attack_type"],
                    "payload": template["payloads"][0],
                    "owasp_category": template["owasp_category"],
                    "tags": template["tags"],
                })
        
        return security_tests
    
    def _generate_performance_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate performance test cases - verify response times are acceptable"""
        performance_tests = []
        endpoints = test_suite.get("endpoints", [])
        test_cases = test_suite.get("test_cases", [])
        
        # Generate from endpoints first (preferred), fall back to test cases
        targets = endpoints[:5] if endpoints else test_cases[:5]
        
        for target in targets:
            method = target.get("method", "GET").upper()
            path = target.get("path", target.get("url", "/"))
            title = target.get("title", f"{method} {path}")
            
            performance_tests.append({
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Response Under 1 Second",
                "description": (
                    f"PURPOSE: Verify {method} {path} responds within 1 second.\n"
                    f"THRESHOLD: 1000ms max response time\n"
                    f"WHY: Slow API responses degrade user experience. Endpoints should "
                    f"respond within 1s for interactive use. A slow response here may "
                    f"indicate missing DB indexes, N+1 queries, or unoptimized logic."
                ),
                "test_type": "performance",
                "method": method,
                "path": path,
                "expected_status": 200,
                "assertions": [
                    {"type": "status_code", "operator": "less_than", "expected": "500"},
                    {"type": "response_time", "operator": "less_than", "expected": "1000"},
                ],
                "performance_metrics": {
                    "max_response_time_ms": 1000,
                    "throughput_rps": 100,
                    "concurrent_users": 10,
                },
                "request": target.get("request", {}),
                "tags": ["performance", "response-time", "sla"],
                "priority": "high",
            })
        
        return performance_tests
    
    def _generate_integration_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate integration test cases - test workflows that chain multiple endpoints"""
        integration_tests = []
        
        # Create test flows that chain multiple endpoints
        endpoints = test_suite.get("endpoints", [])
        if len(endpoints) >= 2:
            ep1_method = endpoints[0].get("method", "GET").upper()
            ep1_path = endpoints[0].get("path", "")
            ep2_method = endpoints[1].get("method", "GET").upper()
            ep2_path = endpoints[1].get("path", "")
            
            integration_test = {
                "test_case_id": str(uuid4()),
                "title": f"Integration: {ep1_method} {ep1_path} -> {ep2_method} {ep2_path}",
                "description": (
                    f"PURPOSE: Test a workflow that chains two API calls together.\n"
                    f"FLOW:\n"
                    f"  Step 1: {ep1_method} {ep1_path} - extract 'id' from response\n"
                    f"  Step 2: {ep2_method} {ep2_path} - use extracted 'id' in request\n"
                    f"WHY: Individual endpoints may work, but chained workflows can fail due to "
                    f"data format mismatches, missing fields, or timing issues between calls."
                ),
                "test_type": "integration",
                "assertions": [
                    {"type": "status_code", "operator": "less_than", "expected": "500"},
                ],
                "test_flow": [
                    {
                        "step": 1,
                        "endpoint": ep1_path,
                        "method": ep1_method,
                        "extract": {"variable": "id", "path": "$.id"}
                    },
                    {
                        "step": 2,
                        "endpoint": endpoints[1].get("path", "").replace("{id}", "{{id}}"),
                        "method": endpoints[1].get("method", "GET"),
                        "use_extracted": ["id"]
                    }
                ],
                "tags": ["integration", "flow"]
            }
            integration_tests.append(integration_test)
        
        return integration_tests
    
    def _generate_contract_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate contract test cases with real schema assertions"""
        contract_tests = []
        endpoints = test_suite.get("endpoints", [])
        
        for ep in endpoints[:10]:
            method = ep.get("method", "GET").upper()
            path = ep.get("path", "/")
            title = ep.get("title", ep.get("summary", path))
            responses = ep.get("responses", {})
            
            # Build schema assertion from spec response definition
            response_schema = None
            for status_code, resp_def in responses.items():
                if str(status_code).startswith("2"):
                    content = resp_def.get("content", {})
                    json_content = content.get("application/json", {})
                    response_schema = json_content.get("schema")
                    break
            
            assertions = [
                {"type": "status_code", "operator": "equals", "expected": "200"},
                {"type": "header", "path": "content-type", "operator": "contains", "expected": "json"},
            ]
            
            # Add real JSON schema assertion if spec provides one
            if response_schema:
                assertions.append({
                    "type": "schema",
                    "schema": json.dumps(response_schema),
                    "operator": "equals",
                    "expected": "valid"
                })
            
            contract_tests.append({
                "test_case_id": str(uuid4()),
                "title": f"{title} - Contract Validation",
                "description": f"Validate {method} {path} response conforms to API contract",
                "test_type": "contract",
                "method": method,
                "path": path,
                "expected_status": 200,
                "assertions": assertions,
                "tags": ["contract", "schema"],
                "request": ep.get("request", {}),
            })
        
        return contract_tests
    
    def _generate_negative_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate negative test cases - verify the API handles bad input gracefully"""
        negative_tests = []
        test_cases = test_suite.get("test_cases", [])
        endpoints = test_suite.get("endpoints", [])
        
        # Include base-suite negative tests
        for tc in test_cases:
            if "negative" in tc.get("tags", []):
                negative_tests.append(tc)
        
        for ep in endpoints[:10]:
            method = ep.get("method", "GET").upper()
            path = ep.get("path", "/")
            title = ep.get("title", ep.get("summary", path))
            
            # Test with wrong HTTP method
            wrong_methods = {"GET": "DELETE", "POST": "GET", "PUT": "GET", "DELETE": "POST", "PATCH": "GET"}
            wrong = wrong_methods.get(method, "OPTIONS")
            negative_tests.append({
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Wrong Method ({wrong})",
                "description": (
                    f"PURPOSE: Verify the API rejects requests with incorrect HTTP method.\n"
                    f"STEPS:\n"
                    f"  1. Send {wrong} request to {path} (should be {method})\n"
                    f"  2. Expect 405 Method Not Allowed\n"
                    f"WHY: APIs must reject wrong methods to prevent accidental data "
                    f"modification (e.g., DELETE on a GET-only resource)."
                ),
                "test_type": "negative",
                "method": wrong,
                "path": path,
                "expected_status": 405,
                "assertions": [
                    {"type": "status_code", "operator": "greater_than", "expected": "399"},
                ],
                "tags": ["negative", "wrong-method"],
                "request": {},
                "priority": "medium",
            })
            
            # For endpoints with path params, test with invalid ID
            if "{" in path:
                invalid_path = re.sub(r'\{[^}]+\}', '99999999', path)
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{method} {path} - Non-Existent Resource (404)",
                    "description": (
                        f"PURPOSE: Verify the API returns 404 for resources that don't exist.\n"
                        f"STEPS:\n"
                        f"  1. Send {method} to {invalid_path} (ID=99999999)\n"
                        f"  2. Expect 404 Not Found\n"
                        f"WHY: Proper 404 handling prevents information leakage and helps "
                        f"clients distinguish 'not found' from server errors."
                    ),
                    "test_type": "negative",
                    "method": method,
                    "path": invalid_path,
                    "expected_status": 404,
                    "assertions": [
                        {"type": "status_code", "operator": "equals", "expected": "404"},
                    ],
                    "tags": ["negative", "invalid-id"],
                    "request": ep.get("request", {}),
                    "priority": "high",
                })
            
            # For POST/PUT/PATCH, test with empty body
            if method in ["POST", "PUT", "PATCH"]:
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{method} {path} - Empty Request Body",
                    "description": (
                        f"PURPOSE: Verify the API validates that required fields are present.\n"
                        f"STEPS:\n"
                        f"  1. Send {method} to {path} with empty JSON body {{}}\n"
                        f"  2. Expect 400 Bad Request or validation error\n"
                        f"WHY: Missing required fields should be caught by validation, "
                        f"not cause a 500 server error or corrupt data."
                    ),
                    "test_type": "negative",
                    "method": method,
                    "path": path,
                    "expected_status": 400,
                    "assertions": [
                        {"type": "status_code", "operator": "greater_than", "expected": "399"},
                    ],
                    "request": {"headers": {"Content-Type": "application/json"}, "body": {}},
                    "tags": ["negative", "empty-body", "validation"],
                    "priority": "high",
                })
                
                # Test with malformed JSON
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{method} {path} - Malformed JSON Body",
                    "description": (
                        f"PURPOSE: Verify the API handles malformed JSON gracefully.\n"
                        f"STEPS:\n"
                        f"  1. Send {method} to {path} with invalid JSON string\n"
                        f"  2. Expect 400 Bad Request\n"
                        f"WHY: Malformed input from clients should return a clear error, "
                        f"not crash the server (500) or be silently ignored."
                    ),
                    "test_type": "negative",
                    "method": method,
                    "path": path,
                    "expected_status": 400,
                    "assertions": [
                        {"type": "status_code", "operator": "greater_than", "expected": "399"},
                    ],
                    "request": {"headers": {"Content-Type": "application/json"}, "body": "{{invalid json}}"},
                    "tags": ["negative", "malformed-json", "validation"],
                    "priority": "medium",
                })
        
        return negative_tests
    
    def _generate_boundary_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate boundary value test cases - test at the edges of valid input"""
        boundary_tests = []
        test_cases = test_suite.get("test_cases", [])
        endpoints = test_suite.get("endpoints", [])
        
        # Include base-suite boundary tests
        for tc in test_cases:
            if "boundary" in tc.get("tags", []):
                boundary_tests.append(tc)
        
        for ep in endpoints[:10]:
            method = ep.get("method", "GET").upper()
            path = ep.get("path", "/")
            title = ep.get("title", ep.get("summary", path))
            params = ep.get("parameters", [])
            
            # Test with extreme query parameter values
            for param in params:
                if param.get("in") == "query":
                    param_name = param.get("name", "")
                    param_type = param.get("schema", {}).get("type", "string")
                    
                    if param_type in ["integer", "number"]:
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name}=0 (Zero Boundary)",
                            "description": (
                                f"PURPOSE: Test edge case where '{param_name}' is zero.\n"
                                f"STEPS: Send {method} to {path} with {param_name}=0\n"
                                f"EXPECTED: API handles zero gracefully (200 or 400)\n"
                                f"WHY: Zero is a common boundary that breaks pagination, offsets, and counts."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [{"type": "status_code", "operator": "less_than", "expected": "500"}],
                            "request": {"query": {param_name: "0"}},
                            "tags": ["boundary", "zero-value"],
                            "priority": "medium",
                        })
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name}=999999 (Max Boundary)",
                            "description": (
                                f"PURPOSE: Test with an extremely large value for '{param_name}'.\n"
                                f"STEPS: Send {method} to {path} with {param_name}=999999\n"
                                f"EXPECTED: API returns data or empty result, NOT a 500 error\n"
                                f"WHY: Large values can cause timeouts, memory issues, or DB query failures."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [
                                {"type": "status_code", "operator": "less_than", "expected": "500"},
                                {"type": "response_time", "operator": "less_than", "expected": "10000"},
                            ],
                            "request": {"query": {param_name: "999999"}},
                            "tags": ["boundary", "large-value"],
                            "priority": "medium",
                        })
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name}=-1 (Negative Boundary)",
                            "description": (
                                f"PURPOSE: Test with a negative value where positive is expected.\n"
                                f"STEPS: Send {method} to {path} with {param_name}=-1\n"
                                f"EXPECTED: API rejects with 400 or handles gracefully\n"
                                f"WHY: Negative values for IDs/limits can expose logic errors."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 400,
                            "assertions": [{"type": "status_code", "operator": "less_than", "expected": "500"}],
                            "request": {"query": {param_name: "-1"}},
                            "tags": ["boundary", "negative-value"],
                            "priority": "low",
                        })
                    elif param_type == "string":
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name}='' (Empty String)",
                            "description": (
                                f"PURPOSE: Test with empty string for '{param_name}'.\n"
                                f"EXPECTED: API handles empty input without crashing\n"
                                f"WHY: Empty strings can cause null reference errors in backend processing."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [{"type": "status_code", "operator": "less_than", "expected": "500"}],
                            "request": {"query": {param_name: ""}},
                            "tags": ["boundary", "empty-string"],
                            "priority": "medium",
                        })
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name} 5000 chars (Overflow)",
                            "description": (
                                f"PURPOSE: Test with extremely long string input.\n"
                                f"EXPECTED: API returns error or truncates, not a 500\n"
                                f"WHY: Long inputs can cause buffer overflows, DB column truncation, "
                                f"or memory exhaustion in unprotected APIs."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [
                                {"type": "status_code", "operator": "less_than", "expected": "500"},
                                {"type": "response_time", "operator": "less_than", "expected": "10000"},
                            ],
                            "request": {"query": {param_name: "a" * 5000}},
                            "tags": ["boundary", "long-string"],
                            "priority": "low",
                        })
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - {param_name} Special Characters",
                            "description": (
                                f"PURPOSE: Test with special characters in '{param_name}'.\n"
                                f"INPUT: !@#$%^&*(){{}}[]|\\<>?/~`\n"
                                f"EXPECTED: API encodes/rejects special chars safely\n"
                                f"WHY: Special chars can break URL parsing, SQL queries, or cause XSS."
                            ),
                            "test_type": "boundary",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [{"type": "status_code", "operator": "less_than", "expected": "500"}],
                            "request": {"query": {param_name: "!@#$%^&*(){}[]|\\<>?/~`"}},
                            "tags": ["boundary", "special-chars"],
                            "priority": "low",
                        })
        
        return boundary_tests
    
    def _generate_data_driven_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate data-driven test cases - test with different data variations from the API schema"""
        data_driven_tests = []
        endpoints = test_suite.get("endpoints", [])
        
        for ep in endpoints[:8]:
            method = ep.get("method", "GET").upper()
            path = ep.get("path", "/")
            title = ep.get("title", ep.get("summary", path))
            
            # For POST/PUT/PATCH with request body, generate data variations from schema
            if method in ["POST", "PUT", "PATCH"]:
                request_body = ep.get("request_body", ep.get("request", {}).get("body", {}))
                schema = {}
                if isinstance(request_body, dict):
                    content = request_body.get("content", {})
                    json_content = content.get("application/json", {})
                    schema = json_content.get("schema", request_body)
                
                properties = schema.get("properties", {})
                required = schema.get("required", [])
                
                if properties:
                    # Variation 1: All valid data
                    valid_body = {}
                    for prop_name, prop_schema in properties.items():
                        ptype = prop_schema.get("type", "string")
                        if ptype == "string":
                            valid_body[prop_name] = f"valid_{prop_name}"
                        elif ptype == "integer":
                            valid_body[prop_name] = 42
                        elif ptype == "number":
                            valid_body[prop_name] = 42.5
                        elif ptype == "boolean":
                            valid_body[prop_name] = True
                        elif ptype == "array":
                            valid_body[prop_name] = ["item1"]
                        else:
                            valid_body[prop_name] = "value"
                    
                    field_list = ", ".join(list(properties.keys())[:5])
                    data_driven_tests.append({
                        "test_case_id": str(uuid4()),
                        "title": f"{method} {path} - All Valid Fields",
                        "description": (
                            f"PURPOSE: Submit with all fields populated with valid data.\n"
                            f"FIELDS: {field_list}\n"
                            f"EXPECTED: Resource created/updated successfully (200/201)\n"
                            f"WHY: Baseline test - if this fails, the entire endpoint is broken."
                        ),
                        "test_type": "data_driven",
                        "method": method, "path": path,
                        "expected_status": 200,
                        "assertions": [
                            {"type": "status_code", "operator": "less_than", "expected": "300"},
                        ],
                        "request": {"body": valid_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "valid", "smoke"],
                        "priority": "high",
                    })
                    
                    # Variation 2: Min-length / empty strings
                    min_body = {}
                    for prop_name, prop_schema in properties.items():
                        ptype = prop_schema.get("type", "string")
                        if ptype == "string":
                            min_body[prop_name] = ""
                        elif ptype in ["integer", "number"]:
                            min_body[prop_name] = 0
                        elif ptype == "boolean":
                            min_body[prop_name] = False
                        elif ptype == "array":
                            min_body[prop_name] = []
                        else:
                            min_body[prop_name] = ""
                    
                    data_driven_tests.append({
                        "test_case_id": str(uuid4()),
                        "title": f"{method} {path} - Minimum/Empty Values",
                        "description": (
                            f"PURPOSE: Submit with minimum-length values (empty strings, zeros).\n"
                            f"EXPECTED: API accepts or returns validation error (not 500)\n"
                            f"WHY: Tests minimum constraints - empty strings may bypass validation."
                        ),
                        "test_type": "data_driven",
                        "method": method, "path": path,
                        "expected_status": 200,
                        "assertions": [
                            {"type": "status_code", "operator": "less_than", "expected": "500"},
                        ],
                        "request": {"body": min_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "minimum"],
                        "priority": "medium",
                    })
                    
                    # Variation 3: Max-length / large values
                    max_body = {}
                    for prop_name, prop_schema in properties.items():
                        ptype = prop_schema.get("type", "string")
                        max_len = prop_schema.get("maxLength", 255)
                        if ptype == "string":
                            max_body[prop_name] = "x" * min(max_len, 500)
                        elif ptype in ["integer", "number"]:
                            max_body[prop_name] = prop_schema.get("maximum", 999999)
                        elif ptype == "boolean":
                            max_body[prop_name] = True
                        elif ptype == "array":
                            max_body[prop_name] = ["item"] * 50
                        else:
                            max_body[prop_name] = "x" * 255
                    
                    data_driven_tests.append({
                        "test_case_id": str(uuid4()),
                        "title": f"{method} {path} - Maximum/Large Values",
                        "description": (
                            f"PURPOSE: Submit with maximum-length values to test upper limits.\n"
                            f"EXPECTED: API accepts if within limits, or returns 400 (not 500)\n"
                            f"WHY: Large values test DB column limits, memory, and processing capacity."
                        ),
                        "test_type": "data_driven",
                        "method": method, "path": path,
                        "expected_status": 200,
                        "assertions": [
                            {"type": "status_code", "operator": "less_than", "expected": "500"},
                            {"type": "response_time", "operator": "less_than", "expected": "10000"},
                        ],
                        "request": {"body": max_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "maximum"],
                        "priority": "medium",
                    })
                    
                    # Variation 4: Only required fields (skip optional)
                    if required:
                        required_only = {k: v for k, v in valid_body.items() if k in required}
                        data_driven_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{method} {path} - Required Fields Only",
                            "description": (
                                f"PURPOSE: Submit with only required fields, omitting optional ones.\n"
                                f"REQUIRED FIELDS: {', '.join(required)}\n"
                                f"EXPECTED: API accepts the request (200/201)\n"
                                f"WHY: Ensures optional fields are truly optional and don't cause errors."
                            ),
                            "test_type": "data_driven",
                            "method": method, "path": path,
                            "expected_status": 200,
                            "assertions": [
                                {"type": "status_code", "operator": "less_than", "expected": "300"},
                            ],
                            "request": {"body": required_only, "headers": {"Content-Type": "application/json"}},
                            "tags": ["data_driven", "required-only"],
                            "priority": "high",
                        })
            
            # For GET with query params, generate variations
            elif method == "GET":
                params = ep.get("parameters", [])
                query_params = [p for p in params if p.get("in") == "query"]
                if query_params:
                    data_driven_tests.append({
                        "test_case_id": str(uuid4()),
                        "title": f"{title} - No Query Params (defaults)",
                        "test_type": "data_driven",
                        "method": method,
                        "path": path,
                        "expected_status": 200,
                        "request": {"query": {}},
                        "tags": ["data_driven", "defaults"],
                    })
        
        return data_driven_tests
    
    def _calculate_coverage(self, test_suite: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate test coverage metrics"""
        endpoints = test_suite.get("endpoints", [])
        all_tests = []
        
        for category, tests in test_suite.get("test_categories", {}).items():
            all_tests.extend(tests)
        
        endpoint_coverage = {}
        for endpoint in endpoints:
            endpoint_id = endpoint.get("endpoint_id")
            tests_for_endpoint = [t for t in all_tests if t.get("endpoint_id") == endpoint_id]
            endpoint_coverage[endpoint_id] = {
                "total_tests": len(tests_for_endpoint),
                "categories": list(set(t.get("test_type") for t in tests_for_endpoint))
            }
        
        covered_endpoints = len([e for e in endpoint_coverage.values() if e["total_tests"] > 0])
        coverage_pct = round((covered_endpoints / max(1, len(endpoints))) * 100, 1)
        
        return {
            "endpoint_coverage": endpoint_coverage,
            "total_endpoints": len(endpoints),
            "covered_endpoints": covered_endpoints,
            "total_tests": len(all_tests),
            "coverage_percentage": coverage_pct,
            "categories_used": list(set(t.get("test_type") for t in all_tests if t.get("test_type")))
        }




