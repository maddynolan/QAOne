"""
Service Virtualization / Mocking Module
Create virtual services to mimic real API behavior for testing
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json

logger = logging.getLogger(__name__)


class ServiceVirtualization:
    """
    Service virtualization for creating mock APIs
    Supports response templates, dynamic responses, and scenario simulation
    """
    
    def __init__(self):
        self.virtual_services: Dict[str, Any] = {}
        self.scenarios: Dict[str, Any] = {}
    
    def create_virtual_service(
        self,
        service_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a virtual service (mock API)
        
        Args:
            service_config: Service configuration
            
        Returns:
            Virtual service definition
        """
        service_id = service_config.get("service_id") or str(uuid4())
        base_url = service_config.get("base_url", f"http://localhost:8080/mock/{service_id}")
        
        virtual_service = {
            "service_id": service_id,
            "name": service_config.get("name", f"Virtual Service {service_id}"),
            "base_url": base_url,
            "endpoints": [],
            "scenarios": [],
            "created_at": datetime.utcnow().isoformat(),
            "status": "active"
        }
        
        # Add endpoints
        endpoints = service_config.get("endpoints", [])
        for endpoint_config in endpoints:
            endpoint = self._create_endpoint(endpoint_config)
            virtual_service["endpoints"].append(endpoint)
        
        self.virtual_services[service_id] = virtual_service
        
        logger.info(f"Created virtual service: {service_id}")
        return virtual_service
    
    def _create_endpoint(self, endpoint_config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a virtual endpoint"""
        endpoint_id = str(uuid4())
        
        return {
            "endpoint_id": endpoint_id,
            "path": endpoint_config.get("path", "/"),
            "method": endpoint_config.get("method", "GET"),
            "response_template": endpoint_config.get("response_template", {}),
            "response_status": endpoint_config.get("response_status", 200),
            "response_delay_ms": endpoint_config.get("response_delay_ms", 0),
            "dynamic_response": endpoint_config.get("dynamic_response", False),
            "scenarios": endpoint_config.get("scenarios", [])
        }
    
    def add_scenario(
        self,
        service_id: str,
        scenario_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Add a scenario to a virtual service
        
        Args:
            service_id: Service identifier
            scenario_config: Scenario configuration
            
        Returns:
            Scenario definition
        """
        if service_id not in self.virtual_services:
            raise ValueError(f"Service {service_id} not found")
        
        scenario_id = scenario_config.get("scenario_id") or str(uuid4())
        
        scenario = {
            "scenario_id": scenario_id,
            "name": scenario_config.get("name", f"Scenario {scenario_id}"),
            "condition": scenario_config.get("condition", {}),
            "response": scenario_config.get("response", {}),
            "response_status": scenario_config.get("response_status", 200),
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.virtual_services[service_id]["scenarios"].append(scenario)
        self.scenarios[scenario_id] = scenario
        
        return scenario
    
    def generate_mock_response(
        self,
        service_id: str,
        endpoint_path: str,
        method: str,
        request_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate mock response for a request
        
        Args:
            service_id: Service identifier
            endpoint_path: Endpoint path
            method: HTTP method
            request_data: Request data
            
        Returns:
            Mock response
        """
        if service_id not in self.virtual_services:
            raise ValueError(f"Service {service_id} not found")
        
        service = self.virtual_services[service_id]
        
        # Find matching endpoint
        endpoint = None
        for ep in service["endpoints"]:
            if ep["path"] == endpoint_path and ep["method"].upper() == method.upper():
                endpoint = ep
                break
        
        if not endpoint:
            return {
                "status": 404,
                "body": {"error": "Endpoint not found"},
                "headers": {}
            }
        
        # Check scenarios
        for scenario in endpoint.get("scenarios", []):
            if self._evaluate_scenario_condition(scenario["condition"], request_data):
                return {
                    "status": scenario.get("response_status", 200),
                    "body": scenario.get("response", {}),
                    "headers": {"Content-Type": "application/json"},
                    "delay_ms": endpoint.get("response_delay_ms", 0)
                }
        
        # Default response
        response_body = endpoint.get("response_template", {})
        
        # Apply dynamic response if enabled
        if endpoint.get("dynamic_response"):
            response_body = self._apply_dynamic_response(response_body, request_data)
        
        return {
            "status": endpoint.get("response_status", 200),
            "body": response_body,
            "headers": {"Content-Type": "application/json"},
            "delay_ms": endpoint.get("response_delay_ms", 0)
        }
    
    def _evaluate_scenario_condition(
        self,
        condition: Dict[str, Any],
        request_data: Optional[Dict[str, Any]]
    ) -> bool:
        """Evaluate if scenario condition matches request"""
        if not condition:
            return True
        
        condition_type = condition.get("type", "equals")
        field = condition.get("field")
        value = condition.get("value")
        
        if not request_data:
            return False
        
        request_value = request_data.get(field) if isinstance(request_data, dict) else None
        
        if condition_type == "equals":
            return request_value == value
        elif condition_type == "contains":
            return value in str(request_value)
        elif condition_type == "greater_than":
            return request_value > value
        elif condition_type == "less_than":
            return request_value < value
        else:
            return False
    
    def _apply_dynamic_response(
        self,
        template: Dict[str, Any],
        request_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply dynamic response generation"""
        if not request_data:
            return template
        
        # Simple template substitution
        response_str = json.dumps(template)
        
        # Replace placeholders with request data
        for key, value in request_data.items():
            response_str = response_str.replace(f"{{{{{key}}}}}", str(value))
            response_str = response_str.replace(f"${{{key}}}", str(value))
        
        try:
            return json.loads(response_str)
        except:
            return template
    
    def list_virtual_services(self) -> List[Dict[str, Any]]:
        """List all virtual services"""
        return [
            {
                "service_id": service_id,
                "name": service["name"],
                "base_url": service["base_url"],
                "endpoints_count": len(service["endpoints"]),
                "status": service["status"]
            }
            for service_id, service in self.virtual_services.items()
        ]
    
    def delete_virtual_service(self, service_id: str) -> bool:
        """Delete a virtual service"""
        if service_id in self.virtual_services:
            del self.virtual_services[service_id]
            logger.info(f"Deleted virtual service: {service_id}")
            return True
        return False


# Global instance
_service_virtualization = None

def get_service_virtualization() -> ServiceVirtualization:
    """Get or create global ServiceVirtualization instance"""
    global _service_virtualization
    if _service_virtualization is None:
        _service_virtualization = ServiceVirtualization()
    return _service_virtualization




