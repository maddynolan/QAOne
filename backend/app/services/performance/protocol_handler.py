"""
Protocol Handler - Handles different protocols (HTTP, WebSocket, etc.)
Similar to Neoload/LoadRunner protocol support
"""

import asyncio
import logging
import aiohttp
import json
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
import time

logger = logging.getLogger(__name__)


class ProtocolHandler(ABC):
    """Base class for protocol handlers"""
    
    @abstractmethod
    async def execute(
        self,
        step: Dict[str, Any],
        session_data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a protocol step"""
        pass
    
    @abstractmethod
    def get_protocol_name(self) -> str:
        """Get protocol name"""
        pass


class HTTPHandler(ProtocolHandler):
    """
    HTTP/HTTPS protocol handler
    Supports REST APIs, GraphQL, SOAP, etc.
    """
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.cookies: Dict[str, Any] = {}
        self.headers: Dict[str, str] = {
            "User-Agent": "QAAI-Performance-Test/1.0",
            "Accept": "application/json"
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            cookies=self.cookies,
            headers=self.headers,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def execute(
        self,
        step: Dict[str, Any],
        session_data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute HTTP request"""
        if not self.session:
            self.session = aiohttp.ClientSession(
                cookies=self.cookies,
                headers=self.headers,
                timeout=aiohttp.ClientTimeout(total=30)
            )
        
        method = step.get("method", "GET").upper()
        url = step.get("url", "")
        
        # Build full URL
        if url.startswith("http"):
            full_url = url
        elif self.base_url:
            full_url = f"{self.base_url.rstrip('/')}/{url.lstrip('/')}"
        else:
            full_url = url
        
        # Apply correlation (replace variables)
        full_url = self._apply_correlation(full_url, correlation_data)
        
        # Prepare headers
        headers = {**self.headers}
        if step.get("headers"):
            headers.update(step["headers"])
        
        # Apply correlation to headers
        headers = {k: self._apply_correlation(v, correlation_data) for k, v in headers.items()}
        
        # Prepare body
        body = None
        if step.get("body"):
            body_data = step["body"]
            if isinstance(body_data, str):
                body_data = self._apply_correlation(body_data, correlation_data)
            elif isinstance(body_data, dict):
                body_data = self._apply_correlation_dict(body_data, correlation_data)
            
            if step.get("content_type") == "application/json" or isinstance(body_data, dict):
                body = json.dumps(body_data) if isinstance(body_data, dict) else body_data
                headers["Content-Type"] = "application/json"
            else:
                body = body_data
        
        # Execute request
        start_time = time.time()
        error = None
        status_code = None
        response_body = None
        response_headers = {}
        
        try:
            async with self.session.request(
                method=method,
                url=full_url,
                headers=headers,
                data=body
            ) as response:
                status_code = response.status
                response_headers = dict(response.headers)
                
                # Read response body
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    try:
                        response_body = await response.json()
                    except:
                        response_body = await response.text()
                else:
                    response_body = await response.text()
                
                # Update cookies
                if response.cookies:
                    self.cookies.update({c.key: c.value for c in response.cookies.values()})
                
                # Check for errors
                if status_code >= 400:
                    error = f"HTTP {status_code}: {response_body}"
        
        except asyncio.TimeoutError:
            error = "Request timeout"
            status_code = 0
        except Exception as e:
            error = str(e)
            status_code = 0
        
        duration = (time.time() - start_time) * 1000  # ms
        
        # Extract correlation data from response
        extracted_correlation = {}
        if step.get("correlation_rules") and response_body:
            extracted_correlation = self._extract_correlation(
                response_body,
                step["correlation_rules"]
            )
        
        return {
            "success": error is None and status_code < 400,
            "status_code": status_code,
            "duration_ms": duration,
            "response_body": response_body,
            "response_headers": response_headers,
            "error": error,
            "correlation_data": extracted_correlation
        }
    
    def _apply_correlation(self, text: str, correlation_data: Dict[str, Any]) -> str:
        """Apply correlation variables to text"""
        if not text or not correlation_data:
            return text
        
        result = text
        for key, value in correlation_data.items():
            placeholder = f"${{key}}" if "${" in text else f"{{key}}"
            result = result.replace(placeholder, str(value))
        
        return result
    
    def _apply_correlation_dict(
        self,
        data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply correlation to dictionary"""
        if not correlation_data:
            return data
        
        result = {}
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self._apply_correlation(value, correlation_data)
            elif isinstance(value, dict):
                result[key] = self._apply_correlation_dict(value, correlation_data)
            elif isinstance(value, list):
                result[key] = [
                    self._apply_correlation(item, correlation_data) if isinstance(item, str)
                    else self._apply_correlation_dict(item, correlation_data) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        
        return result
    
    def _extract_correlation(
        self,
        response_body: Any,
        correlation_rules: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract correlation data from response"""
        extracted = {}
        
        if not response_body or not correlation_rules:
            return extracted
        
        # Convert response to dict if needed
        if isinstance(response_body, str):
            try:
                response_body = json.loads(response_body)
            except:
                return extracted
        
        for rule in correlation_rules:
            var_name = rule.get("variable_name")
            extract_type = rule.get("extract_type", "jsonpath")
            extract_value = rule.get("extract_value")
            
            if not var_name or not extract_value:
                continue
            
            try:
                if extract_type == "jsonpath":
                    # Simple JSON path extraction
                    value = self._extract_jsonpath(response_body, extract_value)
                    if value is not None:
                        extracted[var_name] = value
                
                elif extract_type == "regex":
                    # Regex extraction (for text responses)
                    if isinstance(response_body, str):
                        import re
                        match = re.search(extract_value, response_body)
                        if match:
                            extracted[var_name] = match.group(1) if match.groups() else match.group(0)
                
                elif extract_type == "header":
                    # Header extraction (would need response_headers passed)
                    pass
            
            except Exception as e:
                logger.warning(f"Failed to extract correlation {var_name}: {e}")
        
        return extracted
    
    def _extract_jsonpath(self, data: Any, path: str) -> Any:
        """Extract value from JSON using simple path"""
        if not path or not data:
            return None
        
        parts = path.strip("$.").split(".")
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list):
                try:
                    index = int(part)
                    current = current[index] if index < len(current) else None
                except:
                    return None
            else:
                return None
            
            if current is None:
                return None
        
        return current
    
    def get_protocol_name(self) -> str:
        return "HTTP/HTTPS"
    
    def set_base_url(self, base_url: str):
        """Set base URL for requests"""
        self.base_url = base_url
    
    def set_headers(self, headers: Dict[str, str]):
        """Set default headers"""
        self.headers.update(headers)
    
    def set_cookies(self, cookies: Dict[str, Any]):
        """Set cookies"""
        self.cookies.update(cookies)


class WebSocketHandler(ProtocolHandler):
    """
    WebSocket protocol handler
    """
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url
        self.connections: Dict[str, Any] = {}
    
    async def execute(
        self,
        step: Dict[str, Any],
        session_data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute WebSocket operation"""
        ws_url = step.get("url", "")
        operation = step.get("operation", "send")  # send, receive, close
        
        if not ws_url.startswith("ws"):
            if self.base_url:
                ws_url = f"{self.base_url.replace('http', 'ws')}/{ws_url.lstrip('/')}"
        
        connection_id = step.get("connection_id", "default")
        
        try:
            if operation == "connect" or connection_id not in self.connections:
                # Connect to WebSocket
                async with aiohttp.ClientSession() as session:
                    ws = await session.ws_connect(ws_url)
                    self.connections[connection_id] = ws
            
            elif operation == "send":
                # Send message
                ws = self.connections.get(connection_id)
                if not ws:
                    return {"success": False, "error": "WebSocket not connected"}
                
                message = step.get("message", "")
                message = self._apply_correlation(message, correlation_data)
                
                await ws.send_str(message if isinstance(message, str) else json.dumps(message))
                return {"success": True}
            
            elif operation == "receive":
                # Receive message
                ws = self.connections.get(connection_id)
                if not ws:
                    return {"success": False, "error": "WebSocket not connected"}
                
                timeout = step.get("timeout", 5.0)
                msg = await asyncio.wait_for(ws.receive(), timeout=timeout)
                
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = msg.data
                    try:
                        data = json.loads(data)
                    except:
                        pass
                    return {"success": True, "data": data}
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    return {"success": False, "error": f"WebSocket error: {ws.exception()}"}
                else:
                    return {"success": False, "error": f"Unexpected message type: {msg.type}"}
            
            elif operation == "close":
                # Close connection
                ws = self.connections.pop(connection_id, None)
                if ws:
                    await ws.close()
                return {"success": True}
            
            else:
                return {"success": False, "error": f"Unknown operation: {operation}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _apply_correlation(self, text: str, correlation_data: Dict[str, Any]) -> str:
        """Apply correlation variables"""
        if not text or not correlation_data:
            return text
        
        result = text
        for key, value in correlation_data.items():
            result = result.replace(f"${{{key}}}", str(value))
        
        return result
    
    def get_protocol_name(self) -> str:
        return "WebSocket"
    
    async def close_all(self):
        """Close all WebSocket connections"""
        for ws in self.connections.values():
            try:
                await ws.close()
            except:
                pass
        self.connections.clear()


# Factory function
def create_protocol_handler(protocol: str, **kwargs) -> ProtocolHandler:
    """Create a protocol handler for the specified protocol"""
    protocol_lower = protocol.lower()
    
    if protocol_lower in ["http", "https", "rest", "api"]:
        return HTTPHandler(**kwargs)
    elif protocol_lower in ["websocket", "ws", "wss"]:
        return WebSocketHandler(**kwargs)
    else:
        raise ValueError(f"Unsupported protocol: {protocol}")




