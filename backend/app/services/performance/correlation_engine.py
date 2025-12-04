"""
Correlation Engine - Automatic correlation and parameterization
Similar to Neoload/LoadRunner correlation capabilities
"""

import logging
import re
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CorrelationRule:
    """Correlation rule definition"""
    variable_name: str
    extract_type: str  # jsonpath, regex, xpath, header, cookie
    extract_value: str
    apply_to: List[str] = None  # List of step names or "all"
    scope: str = "session"  # session, iteration, global


class CorrelationEngine:
    """
    Correlation Engine - Automatically extract and correlate dynamic values
    Similar to Neoload/LoadRunner correlation
    """
    
    def __init__(self):
        self.rules: List[CorrelationRule] = []
        self.correlation_data: Dict[str, Dict[str, Any]] = {}  # session_id -> variables
        self.auto_detection_enabled: bool = True
    
    def add_rule(self, rule: CorrelationRule):
        """Add a correlation rule"""
        self.rules.append(rule)
        logger.info(f"Added correlation rule: {rule.variable_name} ({rule.extract_type})")
    
    def extract_from_response(
        self,
        response_body: Any,
        response_headers: Dict[str, str],
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """
        Extract correlation variables from response
        
        Args:
            response_body: Response body (dict, str, or bytes)
            response_headers: Response headers
            session_id: Session identifier
            
        Returns:
            Dictionary of extracted variables
        """
        extracted = {}
        
        # Initialize session data if needed
        if session_id not in self.correlation_data:
            self.correlation_data[session_id] = {}
        
        # Apply all rules
        for rule in self.rules:
            try:
                value = None
                
                if rule.extract_type == "jsonpath":
                    value = self._extract_jsonpath(response_body, rule.extract_value)
                
                elif rule.extract_type == "regex":
                    text = self._response_to_text(response_body)
                    value = self._extract_regex(text, rule.extract_value)
                
                elif rule.extract_type == "header":
                    value = response_headers.get(rule.extract_value)
                
                elif rule.extract_type == "cookie":
                    # Extract from Set-Cookie header
                    set_cookie = response_headers.get("Set-Cookie", "")
                    value = self._extract_cookie(set_cookie, rule.extract_value)
                
                elif rule.extract_type == "xpath":
                    # XPath extraction (for XML/HTML)
                    value = self._extract_xpath(response_body, rule.extract_value)
                
                if value is not None:
                    extracted[rule.variable_name] = value
                    self.correlation_data[session_id][rule.variable_name] = value
                    logger.debug(f"Extracted {rule.variable_name} = {value}")
            
            except Exception as e:
                logger.warning(f"Failed to extract {rule.variable_name}: {e}")
        
        # Auto-detect common patterns if enabled
        if self.auto_detection_enabled:
            auto_extracted = self._auto_detect_correlation(response_body, response_headers)
            extracted.update(auto_extracted)
            self.correlation_data[session_id].update(auto_extracted)
        
        return extracted
    
    def apply_correlation(
        self,
        text: str,
        session_id: str = "default"
    ) -> str:
        """
        Apply correlation variables to text
        
        Args:
            text: Text with correlation variables (e.g., "${token}" or "{token}")
            session_id: Session identifier
            
        Returns:
            Text with variables replaced
        """
        if not text or session_id not in self.correlation_data:
            return text
        
        result = text
        variables = self.correlation_data[session_id]
        
        # Replace ${variable} or {variable} patterns
        for var_name, var_value in variables.items():
            # Replace ${var_name}
            result = result.replace(f"${{{var_name}}}", str(var_value))
            # Replace {var_name} (if not already replaced)
            result = result.replace(f"{{{var_name}}}", str(var_value))
        
        return result
    
    def apply_correlation_dict(
        self,
        data: Dict[str, Any],
        session_id: str = "default"
    ) -> Dict[str, Any]:
        """Apply correlation to dictionary recursively"""
        if not data or session_id not in self.correlation_data:
            return data
        
        result = {}
        variables = self.correlation_data[session_id]
        
        for key, value in data.items():
            if isinstance(value, str):
                result[key] = self.apply_correlation(value, session_id)
            elif isinstance(value, dict):
                result[key] = self.apply_correlation_dict(value, session_id)
            elif isinstance(value, list):
                result[key] = [
                    self.apply_correlation(item, session_id) if isinstance(item, str)
                    else self.apply_correlation_dict(item, session_id) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                result[key] = value
        
        return result
    
    def get_correlation_data(self, session_id: str = "default") -> Dict[str, Any]:
        """Get correlation data for a session"""
        return self.correlation_data.get(session_id, {}).copy()
    
    def set_correlation_data(self, session_id: str, data: Dict[str, Any]):
        """Set correlation data for a session"""
        if session_id not in self.correlation_data:
            self.correlation_data[session_id] = {}
        self.correlation_data[session_id].update(data)
    
    def clear_session(self, session_id: str):
        """Clear correlation data for a session"""
        if session_id in self.correlation_data:
            del self.correlation_data[session_id]
    
    def _extract_jsonpath(self, data: Any, path: str) -> Optional[Any]:
        """Extract value using JSONPath-like syntax"""
        if not data or not path:
            return None
        
        # Convert to dict if string
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except:
                return None
        
        # Simple JSON path extraction
        path = path.strip("$.").strip(".")
        parts = path.split(".")
        
        current = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list):
                try:
                    index = int(part)
                    current = current[index] if 0 <= index < len(current) else None
                except ValueError:
                    return None
            else:
                return None
            
            if current is None:
                return None
        
        return current
    
    def _extract_regex(self, text: str, pattern: str) -> Optional[str]:
        """Extract value using regex"""
        if not text or not pattern:
            return None
        
        try:
            match = re.search(pattern, text)
            if match:
                # Return first capture group if available, otherwise full match
                return match.group(1) if match.groups() else match.group(0)
        except Exception as e:
            logger.warning(f"Regex extraction failed: {e}")
        
        return None
    
    def _extract_cookie(self, set_cookie_header: str, cookie_name: str) -> Optional[str]:
        """Extract cookie value from Set-Cookie header"""
        if not set_cookie_header or not cookie_name:
            return None
        
        # Simple cookie extraction
        pattern = rf"{cookie_name}=([^;]+)"
        match = re.search(pattern, set_cookie_header)
        return match.group(1) if match else None
    
    def _extract_xpath(self, data: Any, xpath: str) -> Optional[str]:
        """Extract value using XPath (simplified)"""
        # This is a simplified implementation
        # For full XPath support, use lxml or similar library
        logger.warning("XPath extraction not fully implemented")
        return None
    
    def _response_to_text(self, response_body: Any) -> str:
        """Convert response body to text"""
        if isinstance(response_body, str):
            return response_body
        elif isinstance(response_body, bytes):
            return response_body.decode("utf-8", errors="ignore")
        elif isinstance(response_body, dict):
            return json.dumps(response_body)
        else:
            return str(response_body)
    
    def _auto_detect_correlation(
        self,
        response_body: Any,
        response_headers: Dict[str, str]
    ) -> Dict[str, Any]:
        """Auto-detect common correlation patterns"""
        extracted = {}
        
        # Convert to text for pattern matching
        text = self._response_to_text(response_body)
        
        # Common patterns to detect
        patterns = {
            "session_id": [
                r'"session[_-]?id"\s*:\s*"([^"]+)"',
                r'session[_-]?id=([^;&\s]+)',
                r'<input[^>]*name=["\']session[_-]?id["\'][^>]*value=["\']([^"\']+)["\']'
            ],
            "csrf_token": [
                r'"csrf[_-]?token"\s*:\s*"([^"]+)"',
                r'csrf[_-]?token=([^;&\s]+)',
                r'<input[^>]*name=["\']csrf[_-]?token["\'][^>]*value=["\']([^"\']+)["\']',
                r'<meta[^>]*name=["\']csrf-token["\'][^>]*content=["\']([^"\']+)["\']'
            ],
            "auth_token": [
                r'"token"\s*:\s*"([^"]+)"',
                r'"access[_-]?token"\s*:\s*"([^"]+)"',
                r'"auth[_-]?token"\s*:\s*"([^"]+)"'
            ]
        }
        
        for var_name, pattern_list in patterns.items():
            for pattern in pattern_list:
                value = self._extract_regex(text, pattern)
                if value:
                    extracted[var_name] = value
                    break  # Use first match
        
        # Extract from headers
        if "Authorization" in response_headers:
            auth_header = response_headers["Authorization"]
            if auth_header.startswith("Bearer "):
                extracted["bearer_token"] = auth_header[7:]
        
        # Extract Set-Cookie values
        set_cookie = response_headers.get("Set-Cookie", "")
        if set_cookie:
            # Common cookie names
            cookie_names = ["sessionid", "JSESSIONID", "PHPSESSID", "ASP.NET_SessionId"]
            for cookie_name in cookie_names:
                value = self._extract_cookie(set_cookie, cookie_name)
                if value:
                    extracted[cookie_name.lower()] = value
                    break
        
        return extracted
    
    def generate_parameterization_data(
        self,
        data_source: str,
        count: int
    ) -> List[Dict[str, Any]]:
        """
        Generate parameterization data from CSV/JSON source
        
        Args:
            data_source: Path to CSV or JSON file
            count: Number of rows to generate
            
        Returns:
            List of parameter dictionaries
        """
        # This would read from CSV/JSON and return parameterized data
        # Simplified implementation
        logger.warning("Parameterization data generation not fully implemented")
        return [{} for _ in range(count)]

