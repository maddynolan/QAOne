"""
API Test Engine - Deterministic Core
Generates API test suites from OpenAPI/Swagger/WSDL/Postman/GraphQL specs.
No LLM dependency for core test generation.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json
import re

logger = logging.getLogger(__name__)


class APITestEngine:
    """
    Deterministic API Test Engine
    Generates test suites from API specifications using rules and patterns.
    """
    
    def __init__(self):
        self.supported_formats = ["openapi", "swagger", "wsdl", "postman", "graphql"]
    
    def generate_test_suite(
        self,
        api_spec: Dict[str, Any],
        spec_format: str = "openapi"
    ) -> Dict[str, Any]:
        """
        Generate API test suite from specification.
        
        Args:
            api_spec: API specification (OpenAPI, Swagger, WSDL, Postman, GraphQL)
            spec_format: Format of the spec
            
        Returns:
            Test suite with endpoint catalogue and test cases
        """
        if spec_format.lower() == "openapi" or spec_format.lower() == "swagger":
            return self._generate_from_openapi(api_spec)
        elif spec_format.lower() == "postman":
            return self._generate_from_postman(api_spec)
        elif spec_format.lower() == "graphql":
            return self._generate_from_graphql(api_spec)
        elif spec_format.lower() == "wsdl":
            return self._generate_from_wsdl(api_spec)
        else:
            raise ValueError(f"Unsupported spec format: {spec_format}")
    
    def _generate_from_openapi(self, spec: Dict[str, Any]) -> Dict[str, Any]:
        """Generate tests from OpenAPI/Swagger spec"""
        endpoints = []
        test_cases = []
        
        # Extract endpoints
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            for method, operation in methods.items():
                if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
                    endpoint = {
                        "endpoint_id": str(uuid4()),
                        "method": method.upper(),
                        "path": path,
                        "operation_id": operation.get("operationId", ""),
                        "summary": operation.get("summary", ""),
                        "description": operation.get("description", ""),
                        "parameters": operation.get("parameters", []),
                        "request_body": operation.get("requestBody", {}),
                        "responses": operation.get("responses", {}),
                        "tags": operation.get("tags", []),
                        "security": operation.get("security", [])
                    }
                    endpoints.append(endpoint)
                    
                    # Generate test cases for this endpoint
                    endpoint_tests = self._generate_endpoint_tests(endpoint, spec)
                    test_cases.extend(endpoint_tests)
        
        return {
            "spec_format": "openapi",
            "spec_version": spec.get("openapi") or spec.get("swagger", "unknown"),
            "base_url": spec.get("servers", [{}])[0].get("url", "") if spec.get("servers") else "",
            "endpoints": endpoints,
            "test_cases": test_cases,
            "total_endpoints": len(endpoints),
            "total_tests": len(test_cases)
        }
    
    def _generate_from_postman(self, collection: Dict[str, Any]) -> Dict[str, Any]:
        """Generate tests from Postman collection (normalized or raw format)"""
        endpoints = []
        test_cases = []
        
        # Support BOTH normalized format (from APISpecParser) and raw Postman format
        # APISpecParser normalizes Postman into {format, paths: {"/path": {"METHOD": {...}}}}
        # Raw Postman has {item: [{name, request: {method, url, ...}}]}
        
        if "paths" in collection and collection.get("format") == "postman":
            # Normalized format from APISpecParser — use paths dict (same as OpenAPI)
            paths = collection.get("paths", {})
            base_url = collection.get("base_url", "")
            
            for path, methods in paths.items():
                for method, operation in methods.items():
                    if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]:
                        endpoint = {
                            "endpoint_id": str(uuid4()),
                            "method": method.upper(),
                            "path": path,
                            "operation_id": operation.get("operation_id", ""),
                            "summary": operation.get("summary", ""),
                            "description": operation.get("description", ""),
                            "parameters": operation.get("parameters", []),
                            "request_body": operation.get("request_body", {}),
                            "responses": operation.get("responses", {}),
                            "tags": operation.get("tags", []),
                            "security": operation.get("security", [])
                        }
                        endpoints.append(endpoint)
                        endpoint_tests = self._generate_endpoint_tests(endpoint, collection)
                        test_cases.extend(endpoint_tests)
            
            return {
                "spec_format": "postman",
                "spec_version": collection.get("version", "unknown"),
                "base_url": base_url,
                "endpoints": endpoints,
                "test_cases": test_cases,
                "total_endpoints": len(endpoints),
                "total_tests": len(test_cases)
            }
        
        # Raw Postman Collection format (direct import without parser)
        items = collection.get("item", [])
        self._process_postman_items_recursive(items, endpoints, test_cases, collection)
        
        # Extract base_url from variables
        base_url = ""
        variables = collection.get("variable", [])
        if isinstance(variables, list):
            for var in variables:
                if isinstance(var, dict) and var.get("key", "").lower() in ["base_url", "baseurl", "url"]:
                    base_url = var.get("value", "")
                    break
        
        return {
            "spec_format": "postman",
            "spec_version": collection.get("info", {}).get("schema", "unknown"),
            "base_url": base_url,
            "endpoints": endpoints,
            "test_cases": test_cases,
            "total_endpoints": len(endpoints),
            "total_tests": len(test_cases)
        }
    
    def _process_postman_items_recursive(
        self,
        items: List[Dict[str, Any]],
        endpoints: List[Dict[str, Any]],
        test_cases: List[Dict[str, Any]],
        collection: Dict[str, Any]
    ):
        """Recursively process Postman collection items (handles nested folders)"""
        for item in items:
            if "request" in item:
                request = item["request"]
                endpoint = {
                    "endpoint_id": str(uuid4()),
                    "method": request.get("method", "GET"),
                    "path": self._extract_path_from_url(request.get("url", {})),
                    "operation_id": item.get("name", ""),
                    "summary": item.get("name", ""),
                    "description": item.get("description", ""),
                    "parameters": self._extract_postman_params(request),
                    "request_body": self._extract_postman_body(request),
                    "responses": {},
                    "tags": [item.get("name", "")]
                }
                endpoints.append(endpoint)
                endpoint_tests = self._generate_endpoint_tests(endpoint, collection)
                test_cases.extend(endpoint_tests)
            
            # Recurse into nested folders
            if "item" in item:
                self._process_postman_items_recursive(item["item"], endpoints, test_cases, collection)
    
    def _extract_postman_params(self, request: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract parameters from Postman request"""
        params = []
        url_obj = request.get("url", {})
        if isinstance(url_obj, dict):
            for q in url_obj.get("query", []):
                if isinstance(q, dict):
                    params.append({
                        "name": q.get("key", ""),
                        "in": "query",
                        "required": not q.get("disabled", False),
                        "schema": {"type": "string", "example": q.get("value", "")}
                    })
        return params
    
    def _extract_postman_body(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract request body from Postman request"""
        body = request.get("body", {})
        if not body:
            return {}
        mode = body.get("mode", "")
        if mode == "raw":
            try:
                raw = body.get("raw", "")
                if raw:
                    body_json = json.loads(raw)
                    return {
                        "content": {
                            "application/json": {
                                "schema": self._infer_schema(body_json)
                            }
                        }
                    }
            except (json.JSONDecodeError, TypeError):
                pass
        return {}
    
    def _generate_from_graphql(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate tests from GraphQL schema (normalized or raw format)"""
        endpoints = []
        test_cases = []
        
        # Support BOTH normalized format (from APISpecParser) and raw introspection format
        # APISpecParser outputs: {format: "graphql", schema: {data: {__schema: {...}}}, paths: {...}}
        # Raw introspection: {data: {__schema: {queryType: {...}, mutationType: {...}}}}
        
        # Try normalized format first (parser wraps schema under "schema" key)
        schema_data = schema.get("schema", schema)  # unwrap if nested
        
        # Also check if queries/mutations are embedded in paths (normalized format)
        paths = schema.get("paths", {})
        graphql_op = paths.get("/graphql", {}).get("POST", {})
        embedded_queries = graphql_op.get("queries", [])
        embedded_mutations = graphql_op.get("mutations", [])
        
        # GraphQL has queries and mutations — try multiple access paths
        query_type = schema_data.get("data", {}).get("__schema", {}).get("queryType", {})
        mutation_type = schema_data.get("data", {}).get("__schema", {}).get("mutationType", {})
        
        # Process queries — from introspection or from embedded paths
        queries = query_type.get("fields", []) if query_type else embedded_queries
        for query in queries:
            endpoint = {
                "endpoint_id": str(uuid4()),
                "method": "POST",  # GraphQL uses POST
                "path": "/graphql",
                "operation_id": query.get("name", ""),
                "summary": query.get("description", ""),
                "query_type": "query",
                "fields": query.get("fields", []),
                "arguments": query.get("args", [])
            }
            endpoints.append(endpoint)
            
            endpoint_tests = self._generate_graphql_tests(endpoint, "query")
            test_cases.extend(endpoint_tests)
        
        # Process mutations — from introspection or from embedded paths
        mutations = mutation_type.get("fields", []) if mutation_type else embedded_mutations
        for mutation in mutations:
            endpoint = {
                "endpoint_id": str(uuid4()),
                "method": "POST",
                "path": "/graphql",
                "operation_id": mutation.get("name", ""),
                "summary": mutation.get("description", ""),
                "query_type": "mutation",
                "fields": mutation.get("fields", []),
                "arguments": mutation.get("args", [])
            }
            endpoints.append(endpoint)
            
            endpoint_tests = self._generate_graphql_tests(endpoint, "mutation")
            test_cases.extend(endpoint_tests)
        
        return {
            "spec_format": "graphql",
            "spec_version": "graphql",
            "base_url": "",
            "endpoints": endpoints,
            "test_cases": test_cases,
            "total_endpoints": len(endpoints),
            "total_tests": len(test_cases)
        }
    
    def _generate_from_wsdl(self, wsdl: Dict[str, Any]) -> Dict[str, Any]:
        """Generate tests from WSDL (normalized or raw format)"""
        endpoints = []
        test_cases = []
        base_url = wsdl.get("base_url", "")
        
        # Support BOTH normalized format (from APISpecParser) and raw WSDL-like format
        # APISpecParser normalizes WSDL into {format: "wsdl", paths: {"/service/op": {"POST": {...}}}, services: [...]}
        # The operations are in paths, not in services[].operations[]
        
        if "paths" in wsdl and wsdl.get("paths"):
            # Normalized format — operations are in paths dict
            paths = wsdl.get("paths", {})
            for path, methods in paths.items():
                for method, operation in methods.items():
                    if method.upper() == "POST":
                        endpoint = {
                            "endpoint_id": str(uuid4()),
                            "method": "POST",
                            "path": path,
                            "operation_id": operation.get("operation_id", ""),
                            "summary": operation.get("summary", ""),
                            "description": operation.get("description", ""),
                            "soap_action": operation.get("soap_action", ""),
                            "soap_service": operation.get("soap_service", ""),
                            "input": {"message": operation.get("input_message", "")},
                            "output": {"message": operation.get("output_message", "")}
                        }
                        endpoints.append(endpoint)
                        endpoint_tests = self._generate_soap_tests(endpoint)
                        test_cases.extend(endpoint_tests)
        else:
            # Raw format — services[].operations[]
            services = wsdl.get("services", [])
            for service in services:
                operations = service.get("operations", [])
                for operation in operations:
                    endpoint = {
                        "endpoint_id": str(uuid4()),
                        "method": "POST",
                        "path": service.get("endpoint", ""),
                        "operation_id": operation.get("name", ""),
                        "summary": operation.get("description", ""),
                        "soap_action": operation.get("soapAction", ""),
                        "input": operation.get("input", {}),
                        "output": operation.get("output", {})
                    }
                    endpoints.append(endpoint)
                    endpoint_tests = self._generate_soap_tests(endpoint)
                    test_cases.extend(endpoint_tests)
        
        return {
            "spec_format": "wsdl",
            "spec_version": "1.1",
            "base_url": base_url,
            "endpoints": endpoints,
            "test_cases": test_cases,
            "total_endpoints": len(endpoints),
            "total_tests": len(test_cases)
        }
    
    def _generate_endpoint_tests(self, endpoint: Dict[str, Any], spec: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate test cases for an endpoint"""
        tests = []
        method = endpoint["method"]
        path = endpoint["path"]
        
        # Test 1: Happy path
        happy_path_test = {
            "test_case_id": str(uuid4()),
            "title": f"{method} {path} - Happy Path",
            "description": f"Verify successful {method} request to {path}",
            "test_type": "api",
            "endpoint_id": endpoint["endpoint_id"],
            "method": method,
            "path": path,
            "request": self._build_happy_path_request(endpoint, spec),
            "expected_status": self._get_success_status(method),
            "expected_response": self._get_expected_response(endpoint),
            "tags": ["happy_path", "api", "smoke"],
            "priority": "high"
        }
        tests.append(happy_path_test)
        
        # Test 2: Missing required field (if POST/PUT/PATCH)
        if method in ["POST", "PUT", "PATCH"]:
            missing_field_test = {
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Missing Required Field",
                "description": f"Verify error handling when required field is missing",
                "test_type": "api",
                "endpoint_id": endpoint["endpoint_id"],
                "method": method,
                "path": path,
                "request": self._build_missing_field_request(endpoint),
                "expected_status": 400,
                "expected_response": {"error": "Validation error"},
                "tags": ["negative", "validation", "api"],
                "priority": "high"
            }
            tests.append(missing_field_test)
        
        # Test 3: Invalid data type
        if method in ["POST", "PUT", "PATCH"]:
            invalid_type_test = {
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Invalid Data Type",
                "description": f"Verify error handling for invalid data type",
                "test_type": "api",
                "endpoint_id": endpoint["endpoint_id"],
                "method": method,
                "path": path,
                "request": self._build_invalid_type_request(endpoint),
                "expected_status": 400,
                "expected_response": {"error": "Type validation error"},
                "tags": ["negative", "validation", "api"],
                "priority": "medium"
            }
            tests.append(invalid_type_test)
        
        # Test 4: Unauthorized (if auth required)
        if endpoint.get("security"):
            unauthorized_test = {
                "test_case_id": str(uuid4()),
                "title": f"{method} {path} - Unauthorized",
                "description": f"Verify error handling for unauthorized access",
                "test_type": "api",
                "endpoint_id": endpoint["endpoint_id"],
                "method": method,
                "path": path,
                "request": self._build_unauthorized_request(endpoint),
                "expected_status": 401,
                "expected_response": {"error": "Unauthorized"},
                "tags": ["negative", "security", "api"],
                "priority": "high"
            }
            tests.append(unauthorized_test)
        
        # Test 5: Boundary values (if numeric parameters)
        boundary_tests = self._generate_boundary_tests(endpoint)
        tests.extend(boundary_tests)
        
        return tests
    
    def _build_happy_path_request(self, endpoint: Dict[str, Any], spec: Dict[str, Any]) -> Dict[str, Any]:
        """Build happy path request"""
        method = endpoint["method"]
        path = endpoint["path"]
        
        request = {
            "method": method,
            "url": path,
            "headers": {}
        }
        
        # Add auth if required
        if endpoint.get("security"):
            request["headers"]["Authorization"] = "Bearer {{api_token}}"
        
        # Add body for POST/PUT/PATCH
        if method in ["POST", "PUT", "PATCH"]:
            request_body_schema = endpoint.get("request_body", {}).get("content", {}).get("application/json", {}).get("schema", {})
            if request_body_schema:
                request["body"] = self._generate_sample_body(request_body_schema)
        
        # Add query parameters
        params = endpoint.get("parameters", [])
        if params:
            query_params = {}
            for param in params:
                if param.get("in") == "query":
                    query_params[param["name"]] = self._generate_sample_value(param.get("schema", {}))
            if query_params:
                request["query"] = query_params
        
        return request
    
    def _build_missing_field_request(self, endpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Build request with missing required field"""
        request = self._build_happy_path_request(endpoint, {})
        # Remove a required field from body
        if "body" in request and isinstance(request["body"], dict):
            # Remove first key as missing field
            if request["body"]:
                first_key = list(request["body"].keys())[0]
                del request["body"][first_key]
        return request
    
    def _build_invalid_type_request(self, endpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Build request with invalid data type"""
        request = self._build_happy_path_request(endpoint, {})
        # Change a field to wrong type
        if "body" in request and isinstance(request["body"], dict):
            if request["body"]:
                first_key = list(request["body"].keys())[0]
                # Change to wrong type (string to number, etc.)
                if isinstance(request["body"][first_key], str):
                    request["body"][first_key] = 12345
                else:
                    request["body"][first_key] = "invalid_string"
        return request
    
    def _build_unauthorized_request(self, endpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Build request without auth"""
        request = self._build_happy_path_request(endpoint, {})
        # Remove auth header
        if "headers" in request:
            request["headers"].pop("Authorization", None)
        return request
    
    def _generate_boundary_tests(self, endpoint: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate boundary value tests"""
        tests = []
        
        # Find numeric parameters
        params = endpoint.get("parameters", [])
        numeric_params = [p for p in params if p.get("schema", {}).get("type") in ["integer", "number"]]
        
        for param in numeric_params[:2]:  # Limit to 2 params
            # Min value test
            min_test = {
                "test_case_id": str(uuid4()),
                "title": f"{endpoint['method']} {endpoint['path']} - Boundary: Min Value",
                "description": f"Test minimum value for {param['name']}",
                "test_type": "api",
                "endpoint_id": endpoint["endpoint_id"],
                "method": endpoint["method"],
                "path": endpoint["path"],
                "request": {
                    "method": endpoint["method"],
                    "url": endpoint["path"],
                    "query": {param["name"]: 0}
                },
                "expected_status": 200,
                "tags": ["boundary", "api"],
                "priority": "medium"
            }
            tests.append(min_test)
            
            # Max value test
            max_test = {
                "test_case_id": str(uuid4()),
                "title": f"{endpoint['method']} {endpoint['path']} - Boundary: Max Value",
                "description": f"Test maximum value for {param['name']}",
                "test_type": "api",
                "endpoint_id": endpoint["endpoint_id"],
                "method": endpoint["method"],
                "path": endpoint["path"],
                "request": {
                    "method": endpoint["method"],
                    "url": endpoint["path"],
                    "query": {param["name"]: 999999}
                },
                "expected_status": 200,
                "tags": ["boundary", "api"],
                "priority": "medium"
            }
            tests.append(max_test)
        
        return tests
    
    def _generate_sample_body(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate sample request body from schema"""
        body = {}
        
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        
        for prop_name, prop_schema in properties.items():
            body[prop_name] = self._generate_sample_value(prop_schema)
        
        return body
    
    def _generate_sample_value(self, schema: Dict[str, Any]) -> Any:
        """Generate sample value from schema"""
        schema_type = schema.get("type", "string")
        
        if schema_type == "string":
            if "enum" in schema:
                return schema["enum"][0]
            if "format" == "email":
                return "test@example.com"
            if "format" == "date":
                return "2024-01-01"
            return "sample_string"
        
        elif schema_type == "integer":
            return 1
        
        elif schema_type == "number":
            return 1.0
        
        elif schema_type == "boolean":
            return True
        
        elif schema_type == "array":
            items_schema = schema.get("items", {})
            return [self._generate_sample_value(items_schema)]
        
        elif schema_type == "object":
            obj = {}
            for prop_name, prop_schema in schema.get("properties", {}).items():
                obj[prop_name] = self._generate_sample_value(prop_schema)
            return obj
        
        return None
    
    def _get_success_status(self, method: str) -> int:
        """Get expected success status code"""
        status_map = {
            "GET": 200,
            "POST": 201,
            "PUT": 200,
            "PATCH": 200,
            "DELETE": 200
        }
        return status_map.get(method, 200)
    
    def _get_expected_response(self, endpoint: Dict[str, Any]) -> Dict[str, Any]:
        """Get expected response structure"""
        responses = endpoint.get("responses", {})
        success_code = str(self._get_success_status(endpoint["method"]))
        
        if success_code in responses:
            response_schema = responses[success_code].get("content", {}).get("application/json", {}).get("schema", {})
            if response_schema:
                return self._generate_sample_body(response_schema)
        
        return {}
    
    def _extract_path_from_url(self, url_obj) -> str:
        """Extract path from Postman URL object"""
        if isinstance(url_obj, str):
            # Could be a full URL or just a path
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url_obj)
                return parsed.path or url_obj
            except Exception:
                return url_obj
        if isinstance(url_obj, dict):
            # Postman URL object format: {raw, host, path[], query[]}
            path_parts = url_obj.get("path", [])
            if path_parts and isinstance(path_parts, list):
                path = "/" + "/".join(path_parts)
                return path
            raw = url_obj.get("raw", "")
            if raw:
                try:
                    from urllib.parse import urlparse
                    return urlparse(raw).path or raw
                except Exception:
                    return raw
        return ""
    
    def _infer_schema(self, json_obj: Any) -> Dict[str, Any]:
        """Infer JSON schema from a JSON object"""
        if isinstance(json_obj, dict):
            properties = {}
            for key, value in json_obj.items():
                properties[key] = self._infer_schema(value)
            return {"type": "object", "properties": properties}
        elif isinstance(json_obj, list):
            if json_obj:
                return {"type": "array", "items": self._infer_schema(json_obj[0])}
            return {"type": "array"}
        elif isinstance(json_obj, bool):
            return {"type": "boolean"}
        elif isinstance(json_obj, int):
            return {"type": "integer"}
        elif isinstance(json_obj, float):
            return {"type": "number"}
        return {"type": "string"}
    
    def _generate_graphql_tests(self, endpoint: Dict[str, Any], operation_type: str) -> List[Dict[str, Any]]:
        """Generate tests for GraphQL query/mutation"""
        tests = []
        
        # Happy path
        test = {
            "test_case_id": str(uuid4()),
            "title": f"GraphQL {operation_type}: {endpoint['operation_id']} - Happy Path",
            "description": f"Verify successful {operation_type} execution",
            "test_type": "api",
            "endpoint_id": endpoint["endpoint_id"],
            "method": "POST",
            "path": "/graphql",
            "request": {
                "method": "POST",
                "url": "/graphql",
                "body": {
                    "query": f"{operation_type} {{ {endpoint['operation_id']} }}"
                }
            },
            "expected_status": 200,
            "tags": ["graphql", "happy_path", "api"],
            "priority": "high"
        }
        tests.append(test)
        
        return tests
    
    def _generate_soap_tests(self, endpoint: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate tests for SOAP endpoint"""
        tests = []
        
        test = {
            "test_case_id": str(uuid4()),
            "title": f"SOAP: {endpoint['operation_id']} - Happy Path",
            "description": f"Verify successful SOAP operation",
            "test_type": "api",
            "endpoint_id": endpoint["endpoint_id"],
            "method": "POST",
            "path": endpoint["path"],
            "request": {
                "method": "POST",
                "url": endpoint["path"],
                "headers": {
                    "SOAPAction": endpoint.get("soap_action", ""),
                    "Content-Type": "text/xml"
                },
                "body": f"<soap:Envelope><soap:Body><{endpoint['operation_id']}></{endpoint['operation_id']}></soap:Body></soap:Envelope>"
            },
            "expected_status": 200,
            "tags": ["soap", "happy_path", "api"],
            "priority": "high"
        }
        tests.append(test)
        
        return tests
    
    def generate_executable_tests(self, test_suite: Dict[str, Any], framework: str = "playwright") -> Dict[str, Any]:
        """
        Generate executable test code from test suite.
        
        Args:
            test_suite: Test suite from generate_test_suite()
            framework: Test framework (playwright, pytest, k6, etc.)
        """
        # Import enhancement methods
        try:
            from app.services.engines.api_test_engine_enhancements import generate_postman_collection, generate_rest_assured_tests
        except ImportError:
            generate_postman_collection = None
            generate_rest_assured_tests = None
        
        if framework == "playwright":
            return {
                "framework": "playwright",
                "language": "typescript",
                "test_code": self._generate_playwright_api_tests(test_suite),
                "setup_instructions": "1. Install: npm install -D @playwright/test\n2. Run: npx playwright install\n3. Execute: npx playwright test"
            }
        elif framework == "pytest":
            return {
                "framework": "pytest",
                "language": "python",
                "test_code": self._generate_pytest_api_tests(test_suite),
                "setup_instructions": "1. Install: pip install pytest requests\n2. Execute: pytest test_api.py -v"
            }
        elif framework == "postman" and generate_postman_collection:
            return {
                "framework": "postman",
                "language": "json",
                "test_code": generate_postman_collection(test_suite),
                "setup_instructions": "1. Open Postman\n2. Click Import\n3. Select generated JSON file\n4. Set environment variables\n5. Run collection"
            }
        elif framework == "rest_assured" and generate_rest_assured_tests:
            return {
                "framework": "rest_assured",
                "language": "java",
                "test_code": generate_rest_assured_tests(test_suite),
                "setup_instructions": "1. Add REST Assured dependency to pom.xml\n2. Add JUnit 5 dependency\n3. Run: mvn test"
            }
        elif framework == "k6":
            return {
                "framework": "k6",
                "language": "javascript",
                "test_code": self._generate_k6_tests(test_suite),
                "setup_instructions": "1. Install k6 from https://k6.io\n2. Run: k6 run test.js\n3. Load test: k6 run --vus 10 --duration 30s test.js"
            }
        else:
            return {
                "framework": "playwright",
                "language": "typescript",
                "test_code": self._generate_playwright_api_tests(test_suite),
                "setup_instructions": "1. Install: npm install -D @playwright/test\n2. Run: npx playwright install\n3. Execute: npx playwright test"
            }
    
    def _generate_playwright_api_tests(self, test_suite: Dict[str, Any]) -> str:
        """Generate Playwright API test code"""
        base_url = test_suite.get("base_url", "")
        test_cases = test_suite.get("test_cases", [])
        
        code_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"const BASE_URL = '{base_url}';",
            ""
        ]
        
        for test_case in test_cases[:20]:  # Limit to 20 tests
            title = test_case.get("title", "API Test")
            method = test_case.get("method", "GET")
            path = test_case.get("path", "")
            request = test_case.get("request", {})
            expected_status = test_case.get("expected_status", 200)
            
            code_lines.append(f"test('{title}', async ({{ request }}) => {{")
            
            # Build request
            url = f"BASE_URL + '{path}'"
            if request.get("query"):
                query_str = "&".join([f"{k}={v}" for k, v in request["query"].items()])
                url = f"{url}?{query_str}"
            
            code_lines.append(f"  const response = await request.{method.lower()}('{path}', {{")
            
            if request.get("headers"):
                code_lines.append("    headers: {")
                for k, v in request["headers"].items():
                    code_lines.append(f"      '{k}': '{v}',")
                code_lines.append("    },")
            
            if request.get("body"):
                body_json = json.dumps(request["body"], indent=6)
                code_lines.append(f"    data: {body_json},")
            
            code_lines.append("  });")
            code_lines.append(f"  expect(response.status()).toBe({expected_status});")
            code_lines.append("});")
            code_lines.append("")
        
        return "\n".join(code_lines)
    
    def _generate_pytest_api_tests(self, test_suite: Dict[str, Any]) -> str:
        """Generate pytest API test code"""
        base_url = test_suite.get("base_url", "")
        test_cases = test_suite.get("test_cases", [])
        
        code_lines = [
            "import pytest",
            "import requests",
            "",
            f"BASE_URL = '{base_url}'",
            ""
        ]
        
        for test_case in test_cases[:20]:
            title = test_case.get("title", "API Test")
            method = test_case.get("method", "GET")
            path = test_case.get("path", "")
            request = test_case.get("request", {})
            expected_status = test_case.get("expected_status", 200)
            
            func_name = title.lower().replace(" ", "_").replace("-", "_")
            code_lines.append(f"def test_{func_name}():")
            code_lines.append(f"    url = BASE_URL + '{path}'")
            
            if method == "GET":
                code_lines.append(f"    response = requests.get(url)")
            elif method == "POST":
                body = json.dumps(request.get("body", {}))
                code_lines.append(f"    response = requests.post(url, json={body})")
            elif method == "PUT":
                body = json.dumps(request.get("body", {}))
                code_lines.append(f"    response = requests.put(url, json={body})")
            elif method == "DELETE":
                code_lines.append(f"    response = requests.delete(url)")
            
            code_lines.append(f"    assert response.status_code == {expected_status}")
            code_lines.append("")
        
        return "\n".join(code_lines)
    
    def _generate_k6_tests(self, test_suite: Dict[str, Any]) -> str:
        """Generate k6 performance test code"""
        base_url = test_suite.get("base_url", "")
        test_cases = test_suite.get("test_cases", [])
        
        code_lines = [
            "import http from 'k6/http';",
            "import { check } from 'k6';",
            "",
            f"const BASE_URL = '{base_url}';",
            "",
            "export default function () {"
        ]
        
        for test_case in test_cases[:10]:  # Limit for k6
            method = test_case.get("method", "GET")
            path = test_case.get("path", "")
            request = test_case.get("request", {})
            expected_status = test_case.get("expected_status", 200)
            
            if method == "GET":
                code_lines.append(f"  const res = http.get(BASE_URL + '{path}');")
            elif method == "POST":
                body = json.dumps(request.get("body", {}))
                code_lines.append(f"  const res = http.post(BASE_URL + '{path}', {body});")
            
            code_lines.append(f"  check(res, {{ 'status is {expected_status}': (r) => r.status === {expected_status} }});")
            code_lines.append("")
        
        code_lines.append("}")
        
        return "\n".join(code_lines)


