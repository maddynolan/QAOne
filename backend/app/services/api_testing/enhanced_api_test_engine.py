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
        """Generate functional test cases from all endpoints"""
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
                "title": f"{title} - Verify JSON Content-Type",
                "description": f"Verify {method} {path} returns application/json content type",
                "test_type": "functional",
                "method": method,
                "path": path,
                "expected_status": 200,
                "assertions": [
                    {"type": "header", "path": "content-type", "operator": "contains", "expected": "json"}
                ],
                "tags": ["functional", "content-type"],
                "request": ep.get("request", {}),
            })
            
            # Response structure validation (for GET endpoints)
            if method == "GET":
                functional_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{title} - Verify Response Not Empty",
                    "description": f"Verify {method} {path} returns non-empty response body",
                    "test_type": "functional",
                    "method": method,
                    "path": path,
                    "expected_status": 200,
                    "assertions": [
                        {"type": "not_contains", "expected": ""},
                    ],
                    "tags": ["functional", "response-body"],
                    "request": ep.get("request", {}),
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
        """Generate performance test cases"""
        performance_tests = []
        
        test_cases = test_suite.get("test_cases", [])
        for tc in test_cases[:5]:  # Limit to 5 for performance
            perf_test = {
                **tc,
                "test_case_id": str(uuid4()),
                "title": f"{tc.get('title', '')} - Performance",
                "test_type": "performance",
                "performance_metrics": {
                    "max_response_time_ms": 1000,
                    "throughput_rps": 100,
                    "concurrent_users": 10
                },
                "tags": tc.get("tags", []) + ["performance"]
            }
            performance_tests.append(perf_test)
        
        return performance_tests
    
    def _generate_integration_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate integration test cases"""
        integration_tests = []
        
        # Create test flows that chain multiple endpoints
        endpoints = test_suite.get("endpoints", [])
        if len(endpoints) >= 2:
            integration_test = {
                "test_case_id": str(uuid4()),
                "title": "Multi-Endpoint Integration Flow",
                "description": "Test flow across multiple endpoints",
                "test_type": "integration",
                "test_flow": [
                    {
                        "step": 1,
                        "endpoint": endpoints[0].get("path", ""),
                        "method": endpoints[0].get("method", "GET"),
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
        """Generate negative test cases for each endpoint"""
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
                "title": f"{title} - Wrong Method ({wrong})",
                "description": f"Send {wrong} instead of {method} to {path}",
                "test_type": "negative",
                "method": wrong,
                "path": path,
                "expected_status": 405,
                "tags": ["negative", "wrong-method"],
                "request": {},
            })
            
            # For endpoints with path params, test with invalid ID
            if "{" in path:
                invalid_path = re.sub(r'\{[^}]+\}', '99999999', path)
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{title} - Invalid Resource ID",
                    "description": f"Request {method} {path} with non-existent resource ID",
                    "test_type": "negative",
                    "method": method,
                    "path": invalid_path,
                    "expected_status": 404,
                    "tags": ["negative", "invalid-id"],
                    "request": ep.get("request", {}),
                })
            
            # For POST/PUT/PATCH, test with empty body
            if method in ["POST", "PUT", "PATCH"]:
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{title} - Empty Request Body",
                    "description": f"Send {method} {path} with empty body",
                    "test_type": "negative",
                    "method": method,
                    "path": path,
                    "expected_status": 400,
                    "request": {"headers": {"Content-Type": "application/json"}, "body": {}},
                    "tags": ["negative", "empty-body"],
                })
                
                # Test with malformed JSON
                negative_tests.append({
                    "test_case_id": str(uuid4()),
                    "title": f"{title} - Malformed JSON Body",
                    "description": f"Send {method} {path} with invalid JSON",
                    "test_type": "negative",
                    "method": method,
                    "path": path,
                    "expected_status": 400,
                    "request": {"headers": {"Content-Type": "application/json"}, "body": "{{invalid json}}"},
                    "tags": ["negative", "malformed-json"],
                })
        
        return negative_tests
    
    def _generate_boundary_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate boundary value test cases"""
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
                        # Zero value
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name}=0 (boundary)",
                            "description": f"Test {path} with {param_name}=0",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"query": {param_name: "0"}},
                            "tags": ["boundary", "zero-value"],
                        })
                        # Very large value
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name}=999999 (boundary)",
                            "description": f"Test {path} with extremely large {param_name}",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"query": {param_name: "999999"}},
                            "tags": ["boundary", "large-value"],
                        })
                        # Negative value
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name}=-1 (boundary)",
                            "description": f"Test {path} with negative {param_name}",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 400,
                            "request": {"query": {param_name: "-1"}},
                            "tags": ["boundary", "negative-value"],
                        })
                    elif param_type == "string":
                        # Empty string
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name}='' (empty string)",
                            "description": f"Test {path} with empty {param_name}",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"query": {param_name: ""}},
                            "tags": ["boundary", "empty-string"],
                        })
                        # Very long string
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name} very long (boundary)",
                            "description": f"Test {path} with 5000-char {param_name}",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"query": {param_name: "a" * 5000}},
                            "tags": ["boundary", "long-string"],
                        })
                        # Special characters
                        boundary_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - {param_name} special chars (boundary)",
                            "description": f"Test {path} with special characters in {param_name}",
                            "test_type": "boundary",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"query": {param_name: "!@#$%^&*(){}[]|\\<>?/~`"}},
                            "tags": ["boundary", "special-chars"],
                        })
        
        return boundary_tests
    
    def _generate_data_driven_tests(self, test_suite: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate data-driven test cases derived from spec schemas"""
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
                    
                    data_driven_tests.append({
                        "test_case_id": str(uuid4()),
                        "title": f"{title} - Valid Data",
                        "test_type": "data_driven",
                        "method": method,
                        "path": path,
                        "expected_status": 200,
                        "request": {"body": valid_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "valid"],
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
                        "title": f"{title} - Minimum Values",
                        "test_type": "data_driven",
                        "method": method,
                        "path": path,
                        "expected_status": 200,
                        "request": {"body": min_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "minimum"],
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
                        "title": f"{title} - Maximum Values",
                        "test_type": "data_driven",
                        "method": method,
                        "path": path,
                        "expected_status": 200,
                        "request": {"body": max_body, "headers": {"Content-Type": "application/json"}},
                        "tags": ["data_driven", "maximum"],
                    })
                    
                    # Variation 4: Only required fields (skip optional)
                    if required:
                        required_only = {k: v for k, v in valid_body.items() if k in required}
                        data_driven_tests.append({
                            "test_case_id": str(uuid4()),
                            "title": f"{title} - Required Fields Only",
                            "test_type": "data_driven",
                            "method": method,
                            "path": path,
                            "expected_status": 200,
                            "request": {"body": required_only, "headers": {"Content-Type": "application/json"}},
                            "tags": ["data_driven", "required-only"],
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
        
        return {
            "endpoint_coverage": endpoint_coverage,
            "total_endpoints": len(endpoints),
            "total_tests": len(all_tests),
            "coverage_percentage": min(100, (len(endpoints) / max(1, len(endpoints))) * 100)
        }




