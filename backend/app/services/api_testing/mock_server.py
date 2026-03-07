"""
Mock Server - Actual HTTP Server for Service Virtualization
Creates and runs real HTTP mock servers for API testing

Features:
- Start/stop mock servers on dynamic ports
- Dynamic response generation based on request data
- Request logging and verification
- Scenario-based responses
- Latency simulation
- Webhook simulation
- Stateful mocking (sequence of responses)
"""

import logging
import asyncio
import json
import re
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from uuid import uuid4
from dataclasses import dataclass, field
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import socket

from app.services.utils.safe_regex import safe_regex_match

logger = logging.getLogger(__name__)


@dataclass
class MockEndpoint:
    """Definition of a mock endpoint"""
    endpoint_id: str
    path: str  # Can include path parameters like /users/{id}
    method: str
    response_body: Any
    response_status: int = 200
    response_headers: Dict[str, str] = field(default_factory=lambda: {"Content-Type": "application/json"})
    response_delay_ms: int = 0
    scenarios: List[Dict[str, Any]] = field(default_factory=list)
    sequence_responses: List[Dict[str, Any]] = field(default_factory=list)  # Stateful: return different response each call
    sequence_index: int = 0
    dynamic: bool = False  # If true, response can include template variables
    callback: Optional[str] = None  # Webhook URL to call after responding


@dataclass
class MockRequest:
    """Recorded incoming request"""
    request_id: str
    timestamp: str
    method: str
    path: str
    query_params: Dict[str, List[str]]
    headers: Dict[str, str]
    body: Any
    endpoint_id: Optional[str]
    response_status: int
    response_time_ms: float


class MockServer:
    """
    Real HTTP Mock Server
    
    Usage:
        server = MockServer()
        server_id = server.create_server("my-api-mock", port=8081)
        
        server.add_endpoint(server_id, MockEndpoint(
            endpoint_id="get-users",
            path="/api/users",
            method="GET",
            response_body={"users": [{"id": 1, "name": "Test"}]},
            response_status=200
        ))
        
        server.start(server_id)
        # Server is now running at http://localhost:8081
        
        server.stop(server_id)
    """
    
    def __init__(self):
        self.servers: Dict[str, Dict[str, Any]] = {}
        self.endpoints: Dict[str, Dict[str, MockEndpoint]] = {}  # server_id -> {endpoint_id: endpoint}
        self.request_logs: Dict[str, List[MockRequest]] = {}  # server_id -> requests
        self.running_servers: Dict[str, threading.Thread] = {}
        self.http_servers: Dict[str, HTTPServer] = {}
    
    def create_server(
        self,
        name: str,
        port: int = 0,  # 0 = auto-assign
        host: str = "127.0.0.1"
    ) -> str:
        """Create a new mock server (not started yet)"""
        server_id = str(uuid4())[:8]
        
        # If port is 0, find an available port
        if port == 0:
            port = self._find_available_port(host)
        
        self.servers[server_id] = {
            "server_id": server_id,
            "name": name,
            "host": host,
            "port": port,
            "base_url": f"http://{host}:{port}",
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "request_count": 0
        }
        
        self.endpoints[server_id] = {}
        self.request_logs[server_id] = []
        
        logger.info(f"Created mock server: {name} ({server_id}) at port {port}")
        return server_id
    
    def _find_available_port(self, host: str = "127.0.0.1", start_port: int = 8080) -> int:
        """Find an available port"""
        for port in range(start_port, start_port + 1000):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.bind((host, port))
                sock.close()
                return port
            except OSError:
                continue
        raise RuntimeError("No available ports found")
    
    def add_endpoint(self, server_id: str, endpoint: MockEndpoint) -> str:
        """Add an endpoint to a mock server"""
        if server_id not in self.servers:
            raise ValueError(f"Server not found: {server_id}")
        
        self.endpoints[server_id][endpoint.endpoint_id] = endpoint
        logger.info(f"Added endpoint {endpoint.method} {endpoint.path} to server {server_id}")
        return endpoint.endpoint_id
    
    def add_endpoints_from_openapi(self, server_id: str, openapi_spec: Dict[str, Any]) -> List[str]:
        """Generate mock endpoints from OpenAPI spec"""
        if server_id not in self.servers:
            raise ValueError(f"Server not found: {server_id}")
        
        endpoint_ids = []
        paths = openapi_spec.get("paths", {})
        
        for path, methods in paths.items():
            for method, operation in methods.items():
                if method.upper() not in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
                    continue
                
                # Generate mock response from schema
                response_body = self._generate_mock_response_from_schema(operation)
                
                endpoint = MockEndpoint(
                    endpoint_id=operation.get("operationId", f"{method}_{path}".replace("/", "_")),
                    path=path,
                    method=method.upper(),
                    response_body=response_body,
                    response_status=200
                )
                
                self.add_endpoint(server_id, endpoint)
                endpoint_ids.append(endpoint.endpoint_id)
        
        return endpoint_ids
    
    def _generate_mock_response_from_schema(self, operation: Dict[str, Any]) -> Any:
        """Generate mock response from OpenAPI operation schema"""
        from app.services.api_testing.test_data_generator import get_test_data_generator
        
        responses = operation.get("responses", {})
        success_response = responses.get("200") or responses.get("201") or {}
        content = success_response.get("content", {})
        
        json_content = content.get("application/json", {})
        schema = json_content.get("schema", {})
        
        if not schema:
            return {"message": "Mock response"}
        
        return self._generate_from_schema(schema)
    
    def _generate_from_schema(self, schema: Dict[str, Any], depth: int = 0) -> Any:
        """Generate mock data from JSON schema"""
        from app.services.api_testing.test_data_generator import get_test_data_generator
        gen = get_test_data_generator()
        
        if depth > 5:  # Prevent infinite recursion
            return None
        
        schema_type = schema.get("type", "object")
        
        if schema_type == "object":
            result = {}
            properties = schema.get("properties", {})
            for prop_name, prop_schema in properties.items():
                result[prop_name] = self._generate_from_schema(prop_schema, depth + 1)
            return result
        
        elif schema_type == "array":
            items_schema = schema.get("items", {})
            count = min(schema.get("maxItems", 3), 5)
            return [self._generate_from_schema(items_schema, depth + 1) for _ in range(count)]
        
        elif schema_type == "string":
            format_type = schema.get("format", "")
            if format_type == "email":
                return gen.generate("email")
            elif format_type == "date":
                return gen.generate("date")
            elif format_type == "date-time":
                return gen.generate("isoDate")
            elif format_type == "uuid":
                return gen.generate("uuid")
            elif format_type == "uri":
                return gen.generate("url")
            elif schema.get("enum"):
                return gen.generate("randomElement", items=schema["enum"])
            else:
                return gen.generate("word")
        
        elif schema_type == "integer":
            min_val = schema.get("minimum", 1)
            max_val = schema.get("maximum", 1000)
            return gen.generate("integer", min=min_val, max=max_val)
        
        elif schema_type == "number":
            min_val = schema.get("minimum", 0.0)
            max_val = schema.get("maximum", 1000.0)
            return gen.generate("float", min=min_val, max=max_val)
        
        elif schema_type == "boolean":
            return gen.generate("boolean")
        
        else:
            return None
    
    def update_endpoint(self, server_id: str, endpoint_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing endpoint"""
        if server_id not in self.endpoints or endpoint_id not in self.endpoints[server_id]:
            return False
        
        endpoint = self.endpoints[server_id][endpoint_id]
        
        for key, value in updates.items():
            if hasattr(endpoint, key):
                setattr(endpoint, key, value)
        
        return True
    
    def remove_endpoint(self, server_id: str, endpoint_id: str) -> bool:
        """Remove an endpoint"""
        if server_id not in self.endpoints:
            return False
        
        if endpoint_id in self.endpoints[server_id]:
            del self.endpoints[server_id][endpoint_id]
            return True
        return False
    
    def start(self, server_id: str) -> str:
        """Start the mock server"""
        if server_id not in self.servers:
            raise ValueError(f"Server not found: {server_id}")
        
        if server_id in self.running_servers:
            return self.servers[server_id]["base_url"]
        
        server_config = self.servers[server_id]
        host = server_config["host"]
        port = server_config["port"]
        
        # Create request handler with access to this MockServer instance
        mock_server = self
        
        class MockRequestHandler(BaseHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                self.mock_server = mock_server
                self.server_id = server_id
                super().__init__(*args, **kwargs)
            
            def log_message(self, format, *args):
                logger.debug(f"Mock server [{server_id}]: {format % args}")
            
            def do_GET(self):
                self._handle_request("GET")
            
            def do_POST(self):
                self._handle_request("POST")
            
            def do_PUT(self):
                self._handle_request("PUT")
            
            def do_PATCH(self):
                self._handle_request("PATCH")
            
            def do_DELETE(self):
                self._handle_request("DELETE")
            
            def do_OPTIONS(self):
                self._handle_cors_preflight()
            
            def _handle_cors_preflight(self):
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "*")
                self.end_headers()
            
            def _handle_request(self, method: str):
                start_time = time.time()
                
                # Parse URL
                parsed = urlparse(self.path)
                path = parsed.path
                query_params = parse_qs(parsed.query)
                
                # Get headers
                headers = dict(self.headers)
                
                # Get body
                content_length = int(self.headers.get("Content-Length", 0))
                body = None
                if content_length > 0:
                    raw_body = self.rfile.read(content_length)
                    try:
                        body = json.loads(raw_body.decode("utf-8"))
                    except:
                        body = raw_body.decode("utf-8")
                
                # Find matching endpoint
                endpoint = self._find_endpoint(method, path)
                
                if endpoint:
                    response_body, response_status, response_headers = self._generate_response(
                        endpoint, path, query_params, headers, body
                    )
                    
                    # Apply delay
                    if endpoint.response_delay_ms > 0:
                        time.sleep(endpoint.response_delay_ms / 1000.0)
                else:
                    response_status = 404
                    response_body = {"error": "Not found", "path": path, "method": method}
                    response_headers = {"Content-Type": "application/json"}
                
                # Send response
                self.send_response(response_status)
                self.send_header("Access-Control-Allow-Origin", "*")
                for header_name, header_value in response_headers.items():
                    self.send_header(header_name, header_value)
                self.end_headers()
                
                if response_body is not None:
                    if isinstance(response_body, (dict, list)):
                        self.wfile.write(json.dumps(response_body).encode())
                    else:
                        self.wfile.write(str(response_body).encode())
                
                # Log request
                response_time_ms = (time.time() - start_time) * 1000
                request_log = MockRequest(
                    request_id=str(uuid4())[:8],
                    timestamp=datetime.utcnow().isoformat(),
                    method=method,
                    path=path,
                    query_params=query_params,
                    headers=headers,
                    body=body,
                    endpoint_id=endpoint.endpoint_id if endpoint else None,
                    response_status=response_status,
                    response_time_ms=response_time_ms
                )
                self.mock_server.request_logs[self.server_id].append(request_log)
                self.mock_server.servers[self.server_id]["request_count"] += 1
            
            def _find_endpoint(self, method: str, path: str) -> Optional[MockEndpoint]:
                """Find matching endpoint for method and path"""
                endpoints = self.mock_server.endpoints.get(self.server_id, {})
                
                for endpoint in endpoints.values():
                    if endpoint.method.upper() != method.upper():
                        continue
                    
                    # Check exact match
                    if endpoint.path == path:
                        return endpoint
                    
                    # Check with path parameters
                    if self._path_matches(endpoint.path, path):
                        return endpoint
                
                return None
            
            def _path_matches(self, pattern: str, path: str) -> bool:
                """Check if path matches pattern with {param} placeholders"""
                # Convert {param} to regex groups
                regex_pattern = re.sub(r'\{[^}]+\}', r'[^/]+', pattern)
                regex_pattern = f"^{regex_pattern}$"
                return bool(re.match(regex_pattern, path))
            
            def _generate_response(
                self,
                endpoint: MockEndpoint,
                path: str,
                query_params: Dict[str, List[str]],
                headers: Dict[str, str],
                body: Any
            ) -> tuple:
                """Generate response for endpoint"""
                
                # Check scenarios first
                for scenario in endpoint.scenarios:
                    if self._scenario_matches(scenario, path, query_params, headers, body):
                        return (
                            scenario.get("response_body", endpoint.response_body),
                            scenario.get("response_status", endpoint.response_status),
                            scenario.get("response_headers", endpoint.response_headers)
                        )
                
                # Check sequence responses (stateful)
                if endpoint.sequence_responses:
                    idx = endpoint.sequence_index % len(endpoint.sequence_responses)
                    seq_response = endpoint.sequence_responses[idx]
                    endpoint.sequence_index += 1
                    return (
                        seq_response.get("response_body", endpoint.response_body),
                        seq_response.get("response_status", endpoint.response_status),
                        seq_response.get("response_headers", endpoint.response_headers)
                    )
                
                # Dynamic response
                response_body = endpoint.response_body
                if endpoint.dynamic and isinstance(response_body, (dict, str)):
                    response_body = self._apply_dynamic_response(
                        response_body, path, query_params, headers, body
                    )
                
                return (response_body, endpoint.response_status, endpoint.response_headers)
            
            def _scenario_matches(
                self,
                scenario: Dict[str, Any],
                path: str,
                query_params: Dict[str, List[str]],
                headers: Dict[str, str],
                body: Any
            ) -> bool:
                """Check if scenario conditions match"""
                condition = scenario.get("condition", {})
                
                if not condition:
                    return False
                
                condition_type = condition.get("type", "equals")
                field = condition.get("field", "")
                value = condition.get("value")
                
                # Get actual value based on source
                source = condition.get("source", "body")
                
                if source == "body" and isinstance(body, dict):
                    actual = body.get(field)
                elif source == "query":
                    actual = query_params.get(field, [None])[0]
                elif source == "header":
                    actual = headers.get(field)
                elif source == "path":
                    # Extract path param value
                    actual = self._extract_path_param(scenario.get("path_pattern", ""), path, field)
                else:
                    actual = None
                
                if condition_type == "equals":
                    return actual == value
                elif condition_type == "contains":
                    return value in str(actual) if actual else False
                elif condition_type == "exists":
                    return actual is not None
                elif condition_type == "regex":
                    if not actual:
                        return False
                    try:
                        return bool(safe_regex_match(value, str(actual)))
                    except (ValueError, TimeoutError):
                        logger.warning(f"Unsafe or timed-out regex in mock condition: {value}")
                        return False
                
                return False
            
            def _extract_path_param(self, pattern: str, path: str, param_name: str) -> Optional[str]:
                """Extract path parameter value"""
                # This is simplified - in production use a proper URL matcher
                return None
            
            def _apply_dynamic_response(
                self,
                response_body: Any,
                path: str,
                query_params: Dict[str, List[str]],
                headers: Dict[str, str],
                body: Any
            ) -> Any:
                """Apply dynamic template substitution"""
                if isinstance(response_body, str):
                    return self._substitute_template(response_body, query_params, headers, body)
                elif isinstance(response_body, dict):
                    return {
                        k: self._apply_dynamic_response(v, path, query_params, headers, body)
                        for k, v in response_body.items()
                    }
                elif isinstance(response_body, list):
                    return [
                        self._apply_dynamic_response(item, path, query_params, headers, body)
                        for item in response_body
                    ]
                return response_body
            
            def _substitute_template(
                self,
                template: str,
                query_params: Dict[str, List[str]],
                headers: Dict[str, str],
                body: Any
            ) -> str:
                """Substitute template variables"""
                result = template
                
                # Substitute {{query.param}}
                for key, values in query_params.items():
                    result = result.replace(f"{{{{query.{key}}}}}", values[0] if values else "")
                
                # Substitute {{header.name}}
                for key, value in headers.items():
                    result = result.replace(f"{{{{header.{key}}}}}", value)
                
                # Substitute {{body.field}}
                if isinstance(body, dict):
                    for key, value in body.items():
                        result = result.replace(f"{{{{body.{key}}}}}", str(value))
                
                # Substitute {{$random.*}}
                from app.services.api_testing.test_data_generator import get_test_data_generator
                gen = get_test_data_generator()
                
                random_patterns = re.findall(r'\{\{\$random\.(\w+)\}\}', result)
                for data_type in random_patterns:
                    try:
                        value = gen.generate(data_type)
                        result = result.replace(f"{{{{$random.{data_type}}}}}", str(value))
                    except:
                        pass
                
                return result
        
        # Create and start HTTP server
        http_server = HTTPServer((host, port), MockRequestHandler)
        self.http_servers[server_id] = http_server
        
        def run_server():
            http_server.serve_forever()
        
        thread = threading.Thread(target=run_server, daemon=True)
        thread.start()
        self.running_servers[server_id] = thread
        
        self.servers[server_id]["status"] = "running"
        self.servers[server_id]["started_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Started mock server {server_id} at {server_config['base_url']}")
        return server_config["base_url"]
    
    def stop(self, server_id: str) -> bool:
        """Stop a running mock server"""
        if server_id not in self.servers:
            return False
        
        if server_id in self.http_servers:
            self.http_servers[server_id].shutdown()
            del self.http_servers[server_id]
        
        if server_id in self.running_servers:
            del self.running_servers[server_id]
        
        self.servers[server_id]["status"] = "stopped"
        self.servers[server_id]["stopped_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Stopped mock server {server_id}")
        return True
    
    def delete_server(self, server_id: str) -> bool:
        """Delete a mock server"""
        self.stop(server_id)
        
        if server_id in self.servers:
            del self.servers[server_id]
        if server_id in self.endpoints:
            del self.endpoints[server_id]
        if server_id in self.request_logs:
            del self.request_logs[server_id]
        
        return True
    
    def get_server_info(self, server_id: str) -> Optional[Dict[str, Any]]:
        """Get server information"""
        return self.servers.get(server_id)
    
    def list_servers(self) -> List[Dict[str, Any]]:
        """List all mock servers"""
        return [
            {
                "server_id": server_id,
                "name": info["name"],
                "base_url": info["base_url"],
                "status": info["status"],
                "endpoint_count": len(self.endpoints.get(server_id, {})),
                "request_count": info["request_count"]
            }
            for server_id, info in self.servers.items()
        ]
    
    def get_request_logs(
        self,
        server_id: str,
        limit: int = 100,
        method: str = None,
        path: str = None
    ) -> List[Dict[str, Any]]:
        """Get request logs for a server"""
        logs = self.request_logs.get(server_id, [])
        
        # Filter
        if method:
            logs = [l for l in logs if l.method == method.upper()]
        if path:
            logs = [l for l in logs if path in l.path]
        
        # Return most recent
        return [
            {
                "request_id": l.request_id,
                "timestamp": l.timestamp,
                "method": l.method,
                "path": l.path,
                "query_params": l.query_params,
                "headers": l.headers,
                "body": l.body,
                "endpoint_id": l.endpoint_id,
                "response_status": l.response_status,
                "response_time_ms": l.response_time_ms
            }
            for l in logs[-limit:]
        ]
    
    def clear_request_logs(self, server_id: str) -> bool:
        """Clear request logs for a server"""
        if server_id in self.request_logs:
            self.request_logs[server_id] = []
            return True
        return False
    
    def verify_requests(
        self,
        server_id: str,
        method: str,
        path: str,
        expected_count: int = None,
        body_contains: str = None
    ) -> Dict[str, Any]:
        """Verify requests were made to the mock server"""
        logs = self.get_request_logs(server_id, method=method, path=path)
        
        if body_contains:
            logs = [
                l for l in logs
                if body_contains in json.dumps(l.get("body", ""))
            ]
        
        actual_count = len(logs)
        
        result = {
            "verified": True,
            "actual_count": actual_count,
            "expected_count": expected_count,
            "matching_requests": logs[:10]  # Limit returned
        }
        
        if expected_count is not None and actual_count != expected_count:
            result["verified"] = False
            result["error"] = f"Expected {expected_count} requests, got {actual_count}"
        
        return result


# Global instance
_mock_server: Optional[MockServer] = None


def get_mock_server() -> MockServer:
    """Get or create MockServer instance"""
    global _mock_server
    if _mock_server is None:
        _mock_server = MockServer()
    return _mock_server
