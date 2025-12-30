"""
Advanced Protocol Handlers - gRPC, GraphQL, MQTT
Extends protocol support beyond HTTP/WebSocket
"""

import logging
import json
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
import aiohttp

logger = logging.getLogger(__name__)


class GraphQLHandler:
    """
    GraphQL protocol handler
    Supports GraphQL queries and mutations
    """
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
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
        """Execute GraphQL query/mutation"""
        import time
        
        query = step.get("query", "")
        variables = step.get("variables", {})
        operation_name = step.get("operation_name")
        
        # Apply correlation to query and variables
        query = self._apply_correlation(query, correlation_data)
        variables = self._apply_correlation_dict(variables, correlation_data)
        
        # Build GraphQL request
        payload = {
            "query": query,
            "variables": variables
        }
        
        if operation_name:
            payload["operationName"] = operation_name
        
        # Build URL
        url = step.get("url", "/graphql")
        if not url.startswith("http"):
            if self.base_url:
                url = f"{self.base_url.rstrip('/')}/{url.lstrip('/')}"
        
        # Execute request
        start_time = time.time()
        error = None
        status_code = None
        response_data = None
        
        try:
            async with self.session.post(
                url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    **step.get("headers", {})
                }
            ) as response:
                status_code = response.status
                response_data = await response.json()
                
                if status_code >= 400:
                    error = response_data.get("errors", [{}])[0].get("message", "GraphQL error")
        
        except Exception as e:
            error = str(e)
            status_code = 0
        
        duration = (time.time() - start_time) * 1000  # ms
        
        # Extract correlation data
        extracted_correlation = {}
        if step.get("correlation_rules") and response_data:
            extracted_correlation = self._extract_correlation(
                response_data,
                step["correlation_rules"]
            )
        
        return {
            "success": error is None and status_code < 400,
            "status_code": status_code,
            "duration_ms": duration,
            "response_data": response_data,
            "error": error,
            "correlation_data": extracted_correlation
        }
    
    def _apply_correlation(self, text: str, correlation_data: Dict[str, Any]) -> str:
        """Apply correlation variables"""
        if not text or not correlation_data:
            return text
        
        result = text
        for key, value in correlation_data.items():
            result = result.replace(f"${{{key}}}", str(value))
            result = result.replace(f"{{{key}}}", str(value))
        
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
        response_data: Any,
        correlation_rules: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract correlation data from GraphQL response"""
        extracted = {}
        
        if not response_data or not correlation_rules:
            return extracted
        
        data = response_data.get("data", {})
        
        for rule in correlation_rules:
            var_name = rule.get("variable_name")
            extract_path = rule.get("extract_value")  # JSONPath-like path
            
            if not var_name or not extract_path:
                continue
            
            try:
                # Simple path extraction
                parts = extract_path.strip("$.").split(".")
                value = data
                
                for part in parts:
                    if isinstance(value, dict):
                        value = value.get(part)
                    elif isinstance(value, list):
                        try:
                            index = int(part)
                            value = value[index] if index < len(value) else None
                        except:
                            value = None
                    else:
                        value = None
                    
                    if value is None:
                        break
                
                if value is not None:
                    extracted[var_name] = value
            
            except Exception as e:
                logger.warning(f"Failed to extract correlation {var_name}: {e}")
        
        return extracted


class gRPCHandler:
    """
    gRPC protocol handler
    Note: Full gRPC support requires grpcio library
    This is a simplified implementation
    """
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url
        logger.warning("gRPC handler is simplified. Full gRPC support requires grpcio library.")
    
    async def execute(
        self,
        step: Dict[str, Any],
        session_data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute gRPC call"""
        # TODO: Implement full gRPC support with grpcio
        # For now, return placeholder
        return {
            "success": False,
            "error": "gRPC handler not fully implemented. Install grpcio for full support.",
            "status_code": 0,
            "duration_ms": 0
        }


class MQTTHandler:
    """
    MQTT protocol handler
    Supports MQTT publish/subscribe operations
    """
    
    def __init__(self, broker_url: Optional[str] = None):
        self.broker_url = broker_url or "mqtt://localhost:1883"
        self.clients: Dict[str, Any] = {}  # connection_id -> client
        logger.warning("MQTT handler requires aiomqtt library for full support.")
    
    async def execute(
        self,
        step: Dict[str, Any],
        session_data: Dict[str, Any],
        correlation_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute MQTT operation"""
        # TODO: Implement full MQTT support with aiomqtt
        # For now, return placeholder
        return {
            "success": False,
            "error": "MQTT handler not fully implemented. Install aiomqtt for full support.",
            "status_code": 0,
            "duration_ms": 0
        }


def create_advanced_protocol_handler(
    protocol: str,
    **kwargs
):
    """Factory function for advanced protocol handlers"""
    protocol_lower = protocol.lower()
    
    if protocol_lower in ["graphql", "gql"]:
        return GraphQLHandler(**kwargs)
    elif protocol_lower == "grpc":
        return gRPCHandler(**kwargs)
    elif protocol_lower == "mqtt":
        return MQTTHandler(**kwargs)
    else:
        raise ValueError(f"Unsupported advanced protocol: {protocol}")




