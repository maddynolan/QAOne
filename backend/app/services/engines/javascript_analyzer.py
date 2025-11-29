"""
JavaScript Analyzer - Layer 2
Analyzes JavaScript code to extract validation logic, event handlers, and dynamic behavior.
"""

import logging
import re
from typing import Dict, List, Any, Optional
import json

logger = logging.getLogger(__name__)

# Try to import AST parsers (optional dependencies)
try:
    import ast
    HAS_AST = True
except ImportError:
    HAS_AST = False

try:
    # For browser-side JavaScript, we'd need acorn or similar
    # For now, we'll use regex-based extraction
    HAS_ACORN = False
except ImportError:
    HAS_ACORN = False


class JavaScriptAnalyzer:
    """
    Analyzes JavaScript to extract validation logic and event handlers.
    
    Layer 2 Components:
    1. AST parsing for validation logic
    2. Event handler mapping
    3. Network request interception
    4. CSS state analysis
    """
    
    def __init__(self):
        self.validation_patterns = []
        self.event_handlers = []
        self.network_calls = []
    
    def extract_validation_functions(self, js_code: str) -> List[Dict[str, Any]]:
        """
        Extract validation functions from JavaScript code.
        
        Returns:
        [{
            "function_name": str,
            "field_name": str,
            "validation_rules": [str],
            "error_messages": [str],
            "pattern": Optional[str]
        }]
        """
        validations = []
        
        # Pattern 1: Function declarations with "validate" or "check"
        validate_pattern = r'function\s+(\w*validate\w*|check\w*)\s*\([^)]*\)\s*\{([^}]+)\}'
        for match in re.finditer(validate_pattern, js_code, re.MULTILINE | re.DOTALL):
            func_name = match.group(1)
            func_body = match.group(2)
            
            # Extract field name from function parameters or body
            field_name = self._extract_field_name(func_body)
            
            # Extract validation rules
            rules = self._extract_validation_rules(func_body)
            
            # Extract error messages
            error_messages = self._extract_error_messages(func_body)
            
            # Extract regex patterns
            pattern = self._extract_regex_pattern(func_body)
            
            validations.append({
                "function_name": func_name,
                "field_name": field_name,
                "validation_rules": rules,
                "error_messages": error_messages,
                "pattern": pattern
            })
        
        # Pattern 2: Arrow functions with validation
        arrow_pattern = r'(\w+)\s*=>\s*\{([^}]+)\}'
        for match in re.finditer(arrow_pattern, js_code, re.MULTILINE | re.DOTALL):
            func_body = match.group(2)
            if any(keyword in func_body.lower() for keyword in ["validate", "check", "required", "pattern", "test"]):
                field_name = self._extract_field_name(func_body)
                rules = self._extract_validation_rules(func_body)
                error_messages = self._extract_error_messages(func_body)
                pattern = self._extract_regex_pattern(func_body)
                
                validations.append({
                    "function_name": "anonymous",
                    "field_name": field_name,
                    "validation_rules": rules,
                    "error_messages": error_messages,
                    "pattern": pattern
                })
        
        # Pattern 3: addEventListener with validation
        event_pattern = r'addEventListener\s*\(\s*["\'](\w+)["\']\s*,\s*function\s*\([^)]*\)\s*\{([^}]+)\}'
        for match in re.finditer(event_pattern, js_code, re.MULTILINE | re.DOTALL):
            event_type = match.group(1)
            handler_body = match.group(2)
            
            if any(keyword in handler_body.lower() for keyword in ["validate", "check", "required"]):
                field_name = self._extract_field_name(handler_body)
                rules = self._extract_validation_rules(handler_body)
                error_messages = self._extract_error_messages(handler_body)
                
                validations.append({
                    "function_name": f"event_handler_{event_type}",
                    "field_name": field_name,
                    "validation_rules": rules,
                    "error_messages": error_messages,
                    "event_type": event_type
                })
        
        logger.info(f"Extracted {len(validations)} validation functions")
        return validations
    
    def map_event_handlers(self, js_code: str, html_content: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Map event handlers to DOM elements.
        
        Returns:
        [{
            "element_selector": str,
            "event_type": str,
            "handler_function": str,
            "validation_rules": [str]
        }]
        """
        handlers = []
        
        # Pattern 1: getElementById/addEventListener
        pattern1 = r'getElementById\s*\(\s*["\']([^"\']+)["\']\s*\)\s*\.\s*addEventListener\s*\(\s*["\'](\w+)["\']\s*,\s*(\w+)'
        for match in re.finditer(pattern1, js_code):
            element_id = match.group(1)
            event_type = match.group(2)
            handler_func = match.group(3)
            
            handlers.append({
                "element_selector": f"#{element_id}",
                "event_type": event_type,
                "handler_function": handler_func,
                "validation_rules": self._extract_validation_rules_from_function(js_code, handler_func)
            })
        
        # Pattern 2: querySelector/addEventListener
        pattern2 = r'querySelector\s*\(\s*["\']([^"\']+)["\']\s*\)\s*\.\s*addEventListener\s*\(\s*["\'](\w+)["\']\s*,\s*(\w+)'
        for match in re.finditer(pattern2, js_code):
            selector = match.group(1)
            event_type = match.group(2)
            handler_func = match.group(3)
            
            handlers.append({
                "element_selector": selector,
                "event_type": event_type,
                "handler_function": handler_func,
                "validation_rules": self._extract_validation_rules_from_function(js_code, handler_func)
            })
        
        # Pattern 3: Inline event handlers in HTML (if HTML provided)
        if html_content:
            inline_pattern = r'<[^>]+\s+on(\w+)=["\']([^"\']+)["\']'
            for match in re.finditer(inline_pattern, html_content, re.IGNORECASE):
                event_type = match.group(1).lower()
                handler_code = match.group(2)
                
                # Try to extract element selector
                element_match = re.search(r'<(\w+)[^>]*\s+on\w+=', match.group(0), re.IGNORECASE)
                if element_match:
                    tag = element_match.group(1)
                    # Try to find id or name
                    id_match = re.search(r'id=["\']([^"\']+)["\']', match.group(0))
                    name_match = re.search(r'name=["\']([^"\']+)["\']', match.group(0))
                    
                    selector = None
                    if id_match:
                        selector = f"#{id_match.group(1)}"
                    elif name_match:
                        selector = f"[name='{name_match.group(1)}']"
                    else:
                        selector = tag
                    
                    handlers.append({
                        "element_selector": selector,
                        "event_type": event_type,
                        "handler_function": "inline",
                        "handler_code": handler_code,
                        "validation_rules": self._extract_validation_rules(handler_code)
                    })
        
        logger.info(f"Mapped {len(handlers)} event handlers")
        return handlers
    
    def extract_network_calls(self, js_code: str) -> List[Dict[str, Any]]:
        """
        Extract network request patterns from JavaScript.
        
        Returns:
        [{
            "method": str,  # "fetch", "xhr", "axios", etc.
            "url_pattern": str,
            "method_type": str,  # "GET", "POST", etc.
            "request_body": Optional[str],
            "headers": Optional[Dict],
            "associated_form": Optional[str]
        }]
        """
        network_calls = []
        
        # Pattern 1: fetch() calls
        fetch_pattern = r'fetch\s*\(\s*["\']([^"\']+)["\']\s*,\s*\{([^}]+)\}'
        for match in re.finditer(fetch_pattern, js_code, re.MULTILINE | re.DOTALL):
            url = match.group(1)
            options = match.group(2)
            
            method = "GET"
            method_match = re.search(r'method\s*:\s*["\'](\w+)["\']', options, re.IGNORECASE)
            if method_match:
                method = method_match.group(1).upper()
            
            body_match = re.search(r'body\s*:\s*([^,}]+)', options, re.IGNORECASE)
            body = body_match.group(1).strip() if body_match else None
            
            headers_match = re.search(r'headers\s*:\s*\{([^}]+)\}', options, re.IGNORECASE)
            headers = {}
            if headers_match:
                header_text = headers_match.group(1)
                for header_pair in re.finditer(r'["\']([^"\']+)["\']\s*:\s*["\']([^"\']+)["\']', header_text):
                    headers[header_pair.group(1)] = header_pair.group(2)
            
            network_calls.append({
                "method": "fetch",
                "url_pattern": url,
                "method_type": method,
                "request_body": body,
                "headers": headers
            })
        
        # Pattern 2: XMLHttpRequest
        xhr_pattern = r'new\s+XMLHttpRequest\s*\(\)|xhr\s*=\s*new\s+XMLHttpRequest'
        if re.search(xhr_pattern, js_code, re.IGNORECASE):
            # Find .open() calls
            open_pattern = r'\.open\s*\(\s*["\'](\w+)["\']\s*,\s*["\']([^"\']+)["\']'
            for match in re.finditer(open_pattern, js_code):
                method = match.group(1).upper()
                url = match.group(2)
                
                network_calls.append({
                    "method": "xhr",
                    "url_pattern": url,
                    "method_type": method
                })
        
        # Pattern 3: axios calls
        axios_pattern = r'axios\.(get|post|put|delete|patch)\s*\(\s*["\']([^"\']+)["\']'
        for match in re.finditer(axios_pattern, js_code, re.IGNORECASE):
            method = match.group(1).upper()
            url = match.group(2)
            
            network_calls.append({
                "method": "axios",
                "url_pattern": url,
                "method_type": method
            })
        
        logger.info(f"Extracted {len(network_calls)} network calls")
        return network_calls
    
    def _extract_field_name(self, code: str) -> Optional[str]:
        """Extract field name from code."""
        # Look for common patterns: getElementById, querySelector, name attribute
        patterns = [
            r'getElementById\s*\(\s*["\']([^"\']+)["\']',
            r'querySelector\s*\(\s*["\']([^"\']+)["\']',
            r'name\s*=\s*["\']([^"\']+)["\']',
            r'\.name\s*=\s*["\']([^"\']+)["\']'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, code, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_validation_rules(self, code: str) -> List[str]:
        """Extract validation rules from code."""
        rules = []
        
        # Check for required
        if re.search(r'required|\.required\s*===?\s*true|!.*\.value', code, re.IGNORECASE):
            rules.append("required")
        
        # Check for email
        if re.search(r'email|@.*\.|email.*test', code, re.IGNORECASE):
            rules.append("email")
        
        # Check for min length
        min_length_match = re.search(r'\.length\s*[<>=]+\s*(\d+)', code, re.IGNORECASE)
        if min_length_match:
            rules.append(f"minLength:{min_length_match.group(1)}")
        
        # Check for max length
        max_length_match = re.search(r'\.length\s*[<>=]+\s*(\d+)', code, re.IGNORECASE)
        if max_length_match:
            rules.append(f"maxLength:{max_length_match.group(1)}")
        
        # Check for pattern/test
        pattern_match = re.search(r'\.test\s*\(|match\s*\(|pattern', code, re.IGNORECASE)
        if pattern_match:
            rules.append("pattern")
        
        return rules
    
    def _extract_error_messages(self, code: str) -> List[str]:
        """Extract error messages from code."""
        messages = []
        
        # Look for error message strings
        error_patterns = [
            r'["\']([^"\']*error[^"\']*)["\']',
            r'["\']([^"\']*invalid[^"\']*)["\']',
            r'["\']([^"\']*required[^"\']*)["\']',
            r'innerHTML\s*=\s*["\']([^"\']+)["\']',
            r'textContent\s*=\s*["\']([^"\']+)["\']'
        ]
        
        for pattern in error_patterns:
            for match in re.finditer(pattern, code, re.IGNORECASE):
                message = match.group(1)
                if len(message) > 5 and len(message) < 200:  # Reasonable length
                    messages.append(message)
        
        return messages[:5]  # Limit to 5 messages
    
    def _extract_regex_pattern(self, code: str) -> Optional[str]:
        """Extract regex pattern from code."""
        # Look for /pattern/ or new RegExp()
        regex_patterns = [
            r'/([^/]+)/',
            r'new\s+RegExp\s*\(\s*["\']([^"\']+)["\']'
        ]
        
        for pattern in regex_patterns:
            match = re.search(pattern, code)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_validation_rules_from_function(self, js_code: str, func_name: str) -> List[str]:
        """Extract validation rules from a specific function."""
        # Find function definition
        func_pattern = rf'function\s+{re.escape(func_name)}\s*\([^)]*\)\s*{{([^}}]+)}}'
        match = re.search(func_pattern, js_code, re.MULTILINE | re.DOTALL)
        if match:
            return self._extract_validation_rules(match.group(1))
        return []


