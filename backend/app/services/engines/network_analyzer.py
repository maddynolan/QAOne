"""
Network Analyzer - Layer 2
Intercepts and analyzes network requests to map API calls to form submissions.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse, parse_qs

logger = logging.getLogger(__name__)


class NetworkAnalyzer:
    """
    Analyzes network requests to understand form submissions and API interactions.
    
    Layer 2 Components:
    1. Intercept XHR/fetch requests
    2. Map API calls to form submissions
    3. Extract request/response patterns
    """
    
    def __init__(self):
        self.request_patterns = []
        self.form_to_api_mapping = {}
    
    def analyze_network_requests(
        self,
        network_logs: List[Dict[str, Any]],
        form_selectors: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Analyze network requests to map them to form submissions.
        
        Args:
            network_logs: List of network request logs
            form_selectors: Optional list of form selectors to map
            
        Returns:
        {
            "form_api_mapping": {
                "form_selector": {
                    "endpoint": str,
                    "method": str,
                    "request_body": Dict,
                    "response_pattern": Dict,
                    "validation_rules": [str]
                }
            },
            "api_patterns": [{
                "endpoint": str,
                "method": str,
                "frequency": int,
                "associated_forms": [str]
            }]
        }
        """
        form_api_mapping = {}
        api_patterns = {}
        
        for log in network_logs:
            url = log.get("url", "")
            method = log.get("method", "GET").upper()
            request_body = log.get("requestBody") or log.get("body") or {}
            response = log.get("response") or {}
            
            # Extract endpoint pattern
            parsed_url = urlparse(url)
            endpoint = parsed_url.path
            
            # Try to map to form
            form_selector = self._identify_form_from_request(log, form_selectors)
            
            if form_selector:
                if form_selector not in form_api_mapping:
                    form_api_mapping[form_selector] = {
                        "endpoint": endpoint,
                        "method": method,
                        "request_body": request_body,
                        "response_pattern": self._extract_response_pattern(response),
                        "validation_rules": self._extract_validation_from_response(response)
                    }
            
            # Track API patterns
            api_key = f"{method} {endpoint}"
            if api_key not in api_patterns:
                api_patterns[api_key] = {
                    "endpoint": endpoint,
                    "method": method,
                    "frequency": 0,
                    "associated_forms": []
                }
            api_patterns[api_key]["frequency"] += 1
            if form_selector:
                api_patterns[api_key]["associated_forms"].append(form_selector)
        
        return {
            "form_api_mapping": form_api_mapping,
            "api_patterns": list(api_patterns.values())
        }
    
    def extract_request_validation(self, request_body: Dict[str, Any]) -> List[str]:
        """
        Extract validation rules from request body structure.
        
        Returns:
        ["required:email", "minLength:8", "pattern:password"]
        """
        validation_rules = []
        
        for field, value in request_body.items():
            rules = []
            
            # Check if field is required (present in request)
            if value is not None and value != "":
                rules.append("required")
            
            # Infer type from field name
            field_lower = field.lower()
            if "email" in field_lower:
                rules.append("email")
            elif "password" in field_lower:
                rules.append("password")
            elif "phone" in field_lower or "tel" in field_lower:
                rules.append("phone")
            elif "url" in field_lower:
                rules.append("url")
            
            # Infer constraints from value
            if isinstance(value, str):
                if len(value) < 8 and "password" in field_lower:
                    rules.append("minLength:8")
                if "@" in value and "." in value:
                    rules.append("email")
            
            if rules:
                validation_rules.append(f"{field}:{','.join(rules)}")
        
        return validation_rules
    
    def _identify_form_from_request(
        self,
        log: Dict[str, Any],
        form_selectors: Optional[List[str]]
    ) -> Optional[str]:
        """Identify which form triggered this request."""
        # Check request body for form field names
        request_body = log.get("requestBody") or log.get("body") or {}
        
        # Try to match form fields to form selectors
        if form_selectors:
            for form_selector in form_selectors:
                # This would require DOM analysis - simplified for now
                # In real implementation, we'd check if form contains fields matching request body
                pass
        
        # Check referrer or origin
        referrer = log.get("referrer") or log.get("referer") or ""
        if "form" in referrer.lower():
            # Extract form ID from referrer or URL
            form_match = re.search(r'form[_-]?id["\']?\s*[:=]\s*["\']?([^"\'\s]+)', referrer, re.IGNORECASE)
            if form_match:
                return f"#{form_match.group(1)}"
        
        return None
    
    def _extract_response_pattern(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Extract response pattern for validation."""
        pattern = {
            "success_status": [200, 201],
            "error_status": [400, 401, 403, 404, 500],
            "success_indicator": None,
            "error_indicator": None
        }
        
        status = response.get("status") or response.get("statusCode")
        if status:
            if status in [200, 201]:
                pattern["success_status"] = [status]
            else:
                pattern["error_status"] = [status]
        
        # Extract success/error indicators from response body
        body = response.get("body") or response.get("data") or {}
        if isinstance(body, dict):
            # Common success indicators
            success_keys = ["success", "status", "message", "data"]
            for key in success_keys:
                if key in body:
                    pattern["success_indicator"] = {key: body[key]}
                    break
            
            # Common error indicators
            error_keys = ["error", "errors", "message", "detail"]
            for key in error_keys:
                if key in body:
                    pattern["error_indicator"] = {key: body[key]}
                    break
        
        return pattern
    
    def _extract_validation_from_response(self, response: Dict[str, Any]) -> List[str]:
        """Extract validation rules from error responses."""
        validation_rules = []
        
        status = response.get("status") or response.get("statusCode")
        if status in [400, 422]:  # Bad Request, Unprocessable Entity
            body = response.get("body") or response.get("data") or {}
            if isinstance(body, dict):
                # Extract field-level errors
                errors = body.get("errors") or body.get("validation_errors") or {}
                if isinstance(errors, dict):
                    for field, error_list in errors.items():
                        if isinstance(error_list, list):
                            for error in error_list:
                                if "required" in error.lower():
                                    validation_rules.append(f"{field}:required")
                                if "invalid" in error.lower():
                                    validation_rules.append(f"{field}:invalid")
                                if "min" in error.lower() or "minimum" in error.lower():
                                    validation_rules.append(f"{field}:min")
                                if "max" in error.lower() or "maximum" in error.lower():
                                    validation_rules.append(f"{field}:max")
        
        return validation_rules


