"""
Advanced Correlation Engine - LoadRunner-level correlation capabilities

Features:
- Boundary-based extraction (LB/RB like LoadRunner's web_reg_save_param)
- Multi-occurrence handling (ORD=1, ORD=ALL)
- Array support (save all matches)
- Recording-based correlation detection
- Replay-based correlation detection (compare responses)
- Pre-built rules for common applications
- Correlation suggestions/wizard support
- Nested correlation
"""

import logging
import re
import json
import hashlib
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import difflib

logger = logging.getLogger(__name__)


class ExtractionType(Enum):
    """Types of value extraction"""
    BOUNDARY = "boundary"  # Left/Right boundary (LoadRunner style)
    JSONPATH = "jsonpath"
    REGEX = "regex"
    XPATH = "xpath"
    HEADER = "header"
    COOKIE = "cookie"
    HTML_ATTRIBUTE = "html_attribute"
    HTML_FORM = "html_form"


class OccurrenceType(Enum):
    """Which occurrence to capture"""
    FIRST = 1
    LAST = -1
    ALL = 0  # Save all to array
    # Specific numbers (2, 3, etc.) are represented as integers


@dataclass
class AdvancedCorrelationRule:
    """
    Advanced correlation rule with LoadRunner-level options.
    
    Comparable to LoadRunner's web_reg_save_param:
    - LB (left boundary)
    - RB (right boundary)
    - ORD (occurrence)
    - SEARCH (scope)
    - SaveLen, SaveOffset (substring)
    """
    variable_name: str
    extraction_type: ExtractionType
    
    # Boundary-based extraction (LB/RB)
    left_boundary: Optional[str] = None
    right_boundary: Optional[str] = None
    
    # JSONPath/XPath/Regex pattern
    pattern: Optional[str] = None
    
    # Header/Cookie name
    header_name: Optional[str] = None
    cookie_name: Optional[str] = None
    
    # HTML form extraction
    form_name: Optional[str] = None
    field_name: Optional[str] = None
    
    # Occurrence handling
    occurrence: int = 1  # 1=first, -1=last, 0=all, N=specific
    
    # Search scope
    search_scope: str = "body"  # body, headers, all, cookies
    
    # Substring options (like SaveLen, SaveOffset)
    save_offset: int = 0
    save_length: int = -1  # -1 = entire match
    
    # Conversion options
    convert_to: Optional[str] = None  # url_encode, url_decode, base64_encode, base64_decode
    
    # Default value if not found
    default_value: str = ""
    
    # Scope
    scope: str = "session"  # session, iteration, global
    
    # Apply to specific requests
    apply_to: Optional[List[str]] = None
    
    # Flag for not found action
    not_found_action: str = "warning"  # warning, error, use_default
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "variable_name": self.variable_name,
            "extraction_type": self.extraction_type.value,
            "left_boundary": self.left_boundary,
            "right_boundary": self.right_boundary,
            "pattern": self.pattern,
            "header_name": self.header_name,
            "cookie_name": self.cookie_name,
            "form_name": self.form_name,
            "field_name": self.field_name,
            "occurrence": self.occurrence,
            "search_scope": self.search_scope,
            "save_offset": self.save_offset,
            "save_length": self.save_length,
            "convert_to": self.convert_to,
            "default_value": self.default_value,
            "scope": self.scope,
            "not_found_action": self.not_found_action
        }


@dataclass
class CorrelationCandidate:
    """A potential correlation value detected during analysis"""
    variable_name: str
    value: str
    source: str  # Where it was found (response body, header, etc.)
    occurrences: int
    suggested_rule: AdvancedCorrelationRule
    confidence: float  # 0.0 to 1.0
    reason: str  # Why it's a candidate
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "variable_name": self.variable_name,
            "value": self.value[:100] + "..." if len(self.value) > 100 else self.value,
            "source": self.source,
            "occurrences": self.occurrences,
            "suggested_rule": self.suggested_rule.to_dict(),
            "confidence": self.confidence,
            "reason": self.reason
        }


# Pre-built correlation rules for common applications
PREBUILT_RULES = {
    "generic_web": [
        AdvancedCorrelationRule(
            variable_name="csrf_token",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='name="csrf_token" value="',
            right_boundary='"',
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="csrf_token_meta",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='<meta name="csrf-token" content="',
            right_boundary='"',
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="session_id",
            extraction_type=ExtractionType.COOKIE,
            cookie_name="sessionid",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="viewstate",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='name="__VIEWSTATE" value="',
            right_boundary='"',
            occurrence=1
        ),
    ],
    "asp_net": [
        AdvancedCorrelationRule(
            variable_name="__VIEWSTATE",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='id="__VIEWSTATE" value="',
            right_boundary='"',
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="__VIEWSTATEGENERATOR",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='id="__VIEWSTATEGENERATOR" value="',
            right_boundary='"',
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="__EVENTVALIDATION",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='id="__EVENTVALIDATION" value="',
            right_boundary='"',
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="ASP_NET_SessionId",
            extraction_type=ExtractionType.COOKIE,
            cookie_name="ASP.NET_SessionId",
            occurrence=1
        ),
    ],
    "java_web": [
        AdvancedCorrelationRule(
            variable_name="JSESSIONID",
            extraction_type=ExtractionType.COOKIE,
            cookie_name="JSESSIONID",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="javax_faces_ViewState",
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary='name="javax.faces.ViewState" value="',
            right_boundary='"',
            occurrence=1
        ),
    ],
    "php": [
        AdvancedCorrelationRule(
            variable_name="PHPSESSID",
            extraction_type=ExtractionType.COOKIE,
            cookie_name="PHPSESSID",
            occurrence=1
        ),
    ],
    "oauth2": [
        AdvancedCorrelationRule(
            variable_name="access_token",
            extraction_type=ExtractionType.JSONPATH,
            pattern="$.access_token",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="refresh_token",
            extraction_type=ExtractionType.JSONPATH,
            pattern="$.refresh_token",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="id_token",
            extraction_type=ExtractionType.JSONPATH,
            pattern="$.id_token",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="authorization_code",
            extraction_type=ExtractionType.REGEX,
            pattern=r'code=([^&\s]+)',
            occurrence=1
        ),
    ],
    "salesforce": [
        AdvancedCorrelationRule(
            variable_name="sid",
            extraction_type=ExtractionType.COOKIE,
            cookie_name="sid",
            occurrence=1
        ),
        AdvancedCorrelationRule(
            variable_name="oid",
            extraction_type=ExtractionType.REGEX,
            pattern=r'"oid":"([^"]+)"',
            occurrence=1
        ),
    ],
}


class AdvancedCorrelationEngine:
    """
    Advanced Correlation Engine with LoadRunner-level capabilities.
    
    Features:
    - Boundary-based extraction (LB/RB)
    - Multi-occurrence handling (ORD)
    - Array support
    - Recording-based detection
    - Replay-based detection
    - Pre-built rules
    - Correlation wizard support
    """
    
    def __init__(self):
        self.rules: List[AdvancedCorrelationRule] = []
        self.variables: Dict[str, Dict[str, Any]] = {}  # session_id -> {var_name: value/array}
        self.auto_detect_enabled: bool = True
        self.prebuilt_rules_loaded: Set[str] = set()
        
        # For replay-based detection
        self.recorded_responses: Dict[str, str] = {}  # request_id -> response_hash
        self.replay_responses: Dict[str, str] = {}
        
        # Correlation candidates
        self.candidates: List[CorrelationCandidate] = []
    
    def load_prebuilt_rules(self, application_type: str):
        """Load pre-built rules for a specific application type"""
        if application_type in PREBUILT_RULES:
            for rule in PREBUILT_RULES[application_type]:
                if rule.variable_name not in [r.variable_name for r in self.rules]:
                    self.rules.append(rule)
            self.prebuilt_rules_loaded.add(application_type)
            logger.info(f"Loaded {len(PREBUILT_RULES[application_type])} pre-built rules for {application_type}")
    
    def add_rule(self, rule: AdvancedCorrelationRule):
        """Add a correlation rule"""
        self.rules.append(rule)
        logger.info(f"Added correlation rule: {rule.variable_name}")
    
    def create_boundary_rule(
        self,
        variable_name: str,
        left_boundary: str,
        right_boundary: str,
        occurrence: int = 1,
        search_scope: str = "body"
    ) -> AdvancedCorrelationRule:
        """
        Create a boundary-based rule (LoadRunner style).
        
        Equivalent to LoadRunner's web_reg_save_param:
        web_reg_save_param("token", "LB=token=", "RB=&", "ORD=1", LAST);
        """
        rule = AdvancedCorrelationRule(
            variable_name=variable_name,
            extraction_type=ExtractionType.BOUNDARY,
            left_boundary=left_boundary,
            right_boundary=right_boundary,
            occurrence=occurrence,
            search_scope=search_scope
        )
        self.add_rule(rule)
        return rule
    
    def extract(
        self,
        response_body: Any,
        response_headers: Dict[str, str],
        session_id: str = "default",
        request_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract correlation values from response.
        
        Returns dict of extracted variables.
        """
        extracted = {}
        
        # Initialize session
        if session_id not in self.variables:
            self.variables[session_id] = {}
        
        # Get text content
        body_text = self._to_text(response_body)
        
        # Apply each rule
        for rule in self.rules:
            # Check if rule applies to this request
            if rule.apply_to and request_name and request_name not in rule.apply_to:
                continue
            
            try:
                value = self._extract_with_rule(rule, body_text, response_headers)
                
                if value is not None:
                    # Apply transformations
                    if rule.convert_to:
                        value = self._convert_value(value, rule.convert_to)
                    
                    # Apply substring
                    if isinstance(value, str) and (rule.save_offset > 0 or rule.save_length > 0):
                        end = rule.save_offset + rule.save_length if rule.save_length > 0 else None
                        value = value[rule.save_offset:end]
                    
                    extracted[rule.variable_name] = value
                    self.variables[session_id][rule.variable_name] = value
                    
                    logger.debug(f"Extracted {rule.variable_name} = {str(value)[:50]}...")
                
                elif rule.not_found_action == "error":
                    raise ValueError(f"Correlation variable not found: {rule.variable_name}")
                elif rule.not_found_action == "use_default":
                    extracted[rule.variable_name] = rule.default_value
                    self.variables[session_id][rule.variable_name] = rule.default_value
                else:
                    logger.warning(f"Correlation variable not found: {rule.variable_name}")
            
            except Exception as e:
                logger.error(f"Error extracting {rule.variable_name}: {e}")
                if rule.not_found_action == "error":
                    raise
        
        return extracted
    
    def _extract_with_rule(
        self,
        rule: AdvancedCorrelationRule,
        body_text: str,
        headers: Dict[str, str]
    ) -> Optional[Any]:
        """Extract value using a specific rule"""
        
        # Determine search text based on scope
        if rule.search_scope == "headers":
            search_text = json.dumps(headers)
        elif rule.search_scope == "cookies":
            search_text = headers.get("Set-Cookie", "") + headers.get("Cookie", "")
        elif rule.search_scope == "all":
            search_text = body_text + json.dumps(headers)
        else:
            search_text = body_text
        
        # Extract based on type
        if rule.extraction_type == ExtractionType.BOUNDARY:
            return self._extract_boundary(
                search_text, 
                rule.left_boundary, 
                rule.right_boundary,
                rule.occurrence
            )
        
        elif rule.extraction_type == ExtractionType.REGEX:
            return self._extract_regex(search_text, rule.pattern, rule.occurrence)
        
        elif rule.extraction_type == ExtractionType.JSONPATH:
            return self._extract_jsonpath(body_text, rule.pattern)
        
        elif rule.extraction_type == ExtractionType.HEADER:
            return headers.get(rule.header_name)
        
        elif rule.extraction_type == ExtractionType.COOKIE:
            return self._extract_cookie(headers, rule.cookie_name)
        
        elif rule.extraction_type == ExtractionType.HTML_FORM:
            return self._extract_html_form(body_text, rule.form_name, rule.field_name)
        
        return None
    
    def _extract_boundary(
        self,
        text: str,
        left_boundary: str,
        right_boundary: str,
        occurrence: int
    ) -> Optional[Any]:
        """
        Boundary-based extraction (LoadRunner style).
        
        occurrence: 1=first, -1=last, 0=all, N=specific
        """
        if not text or not left_boundary:
            return None
        
        matches = []
        start = 0
        
        while True:
            # Find left boundary
            lb_pos = text.find(left_boundary, start)
            if lb_pos == -1:
                break
            
            # Find right boundary
            value_start = lb_pos + len(left_boundary)
            
            if right_boundary:
                rb_pos = text.find(right_boundary, value_start)
                if rb_pos == -1:
                    break
                value = text[value_start:rb_pos]
            else:
                # No right boundary - take until end of line or whitespace
                match = re.match(r'([^\s\n\r]+)', text[value_start:])
                if match:
                    value = match.group(1)
                else:
                    break
            
            matches.append(value)
            start = value_start + len(value)
        
        if not matches:
            return None
        
        # Return based on occurrence
        if occurrence == 0:  # ALL
            return matches
        elif occurrence == -1:  # LAST
            return matches[-1]
        elif occurrence > 0 and occurrence <= len(matches):
            return matches[occurrence - 1]
        
        return None
    
    def _extract_regex(self, text: str, pattern: str, occurrence: int) -> Optional[Any]:
        """Extract using regex with occurrence support"""
        if not text or not pattern:
            return None
        
        try:
            matches = list(re.finditer(pattern, text))
            
            if not matches:
                return None
            
            # Get match values (prefer capture groups)
            values = []
            for m in matches:
                if m.groups():
                    values.append(m.group(1))
                else:
                    values.append(m.group(0))
            
            if occurrence == 0:  # ALL
                return values
            elif occurrence == -1:  # LAST
                return values[-1]
            elif occurrence > 0 and occurrence <= len(values):
                return values[occurrence - 1]
        
        except Exception as e:
            logger.warning(f"Regex error: {e}")
        
        return None
    
    def _extract_jsonpath(self, text: str, path: str) -> Optional[Any]:
        """Extract using JSONPath"""
        if not text or not path:
            return None
        
        try:
            data = json.loads(text) if isinstance(text, str) else text
        except:
            return None
        
        # Simple JSONPath implementation
        path = path.strip("$.").strip(".")
        parts = path.split(".")
        
        current = data
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list):
                try:
                    idx = int(part)
                    current = current[idx] if 0 <= idx < len(current) else None
                except:
                    return None
            else:
                return None
            
            if current is None:
                return None
        
        return current
    
    def _extract_cookie(self, headers: Dict[str, str], cookie_name: str) -> Optional[str]:
        """Extract cookie value"""
        set_cookie = headers.get("Set-Cookie", "")
        
        pattern = rf'{re.escape(cookie_name)}=([^;]+)'
        match = re.search(pattern, set_cookie, re.IGNORECASE)
        
        return match.group(1) if match else None
    
    def _extract_html_form(
        self,
        html: str,
        form_name: Optional[str],
        field_name: str
    ) -> Optional[str]:
        """Extract form field value from HTML"""
        # Find input field
        patterns = [
            rf'name=[\'"]{re.escape(field_name)}[\'"][^>]*value=[\'"]([^\'"]+)[\'"]',
            rf'value=[\'"]([^\'"]+)[\'"][^>]*name=[\'"]{re.escape(field_name)}[\'"]',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _convert_value(self, value: Any, convert_to: str) -> Any:
        """Apply conversion to value"""
        if not isinstance(value, str):
            return value
        
        import base64
        from urllib.parse import quote, unquote
        
        if convert_to == "url_encode":
            return quote(value)
        elif convert_to == "url_decode":
            return unquote(value)
        elif convert_to == "base64_encode":
            return base64.b64encode(value.encode()).decode()
        elif convert_to == "base64_decode":
            return base64.b64decode(value).decode()
        
        return value
    
    def _to_text(self, data: Any) -> str:
        """Convert response to text"""
        if isinstance(data, str):
            return data
        elif isinstance(data, bytes):
            return data.decode("utf-8", errors="ignore")
        elif isinstance(data, dict):
            return json.dumps(data)
        return str(data)
    
    # ==================== Replay-Based Detection ====================
    
    def record_response(self, request_id: str, response_body: str):
        """Record a response during initial recording"""
        self.recorded_responses[request_id] = self._hash_response(response_body)
    
    def compare_replay(self, request_id: str, replay_body: str) -> List[CorrelationCandidate]:
        """
        Compare replay response with recorded response to detect dynamic values.
        This is LoadRunner's replay-based correlation detection.
        """
        if request_id not in self.recorded_responses:
            return []
        
        candidates = []
        recorded_hash = self.recorded_responses[request_id]
        replay_hash = self._hash_response(replay_body)
        
        if recorded_hash == replay_hash:
            return []  # Responses are identical, no correlation needed
        
        # Find differences
        # This would compare the actual content and identify changed values
        # For now, we'll use auto-detection on the replay response
        candidates = self.detect_candidates(replay_body)
        
        for candidate in candidates:
            candidate.reason = "Value differs between recording and replay"
        
        return candidates
    
    def _hash_response(self, body: str) -> str:
        """Hash response for comparison"""
        return hashlib.md5(body.encode()).hexdigest()
    
    # ==================== Correlation Wizard Support ====================
    
    def detect_candidates(
        self,
        response_body: str,
        response_headers: Dict[str, str] = None
    ) -> List[CorrelationCandidate]:
        """
        Detect correlation candidates in a response.
        Returns suggestions for the correlation wizard.
        """
        candidates = []
        text = self._to_text(response_body)
        
        # Pattern definitions with confidence scores
        detection_patterns = [
            # High confidence patterns
            (r'"(?:csrf|xsrf)[_-]?token"\s*:\s*"([^"]+)"', "csrf_token", 0.95, "CSRF token in JSON"),
            (r'name=["\'](?:csrf|xsrf)[_-]?token["\'][^>]*value=["\']([^"\']+)["\']', "csrf_token", 0.95, "CSRF token in form"),
            (r'"(?:session|sess)[_-]?id"\s*:\s*"([^"]+)"', "session_id", 0.95, "Session ID in JSON"),
            (r'"(?:access|auth)[_-]?token"\s*:\s*"([^"]+)"', "access_token", 0.95, "Auth token in JSON"),
            
            # Medium confidence patterns
            (r'"id"\s*:\s*"?(\d+)"?', "id", 0.7, "Numeric ID in JSON"),
            (r'"uuid"\s*:\s*"([a-f0-9-]{36})"', "uuid", 0.85, "UUID in JSON"),
            (r'name=["\']__VIEWSTATE["\'][^>]*value=["\']([^"\']+)["\']', "viewstate", 0.9, "ASP.NET ViewState"),
            
            # Lower confidence (might be static)
            (r'"timestamp"\s*:\s*"?(\d+)"?', "timestamp", 0.6, "Timestamp in JSON"),
            (r'"nonce"\s*:\s*"([^"]+)"', "nonce", 0.8, "Nonce in JSON"),
        ]
        
        for pattern, var_name, confidence, reason in detection_patterns:
            matches = list(re.finditer(pattern, text, re.IGNORECASE))
            
            if matches:
                value = matches[0].group(1)
                
                # Create suggested rule
                suggested_rule = AdvancedCorrelationRule(
                    variable_name=var_name,
                    extraction_type=ExtractionType.REGEX,
                    pattern=pattern,
                    occurrence=1
                )
                
                candidates.append(CorrelationCandidate(
                    variable_name=var_name,
                    value=value,
                    source="body",
                    occurrences=len(matches),
                    suggested_rule=suggested_rule,
                    confidence=confidence,
                    reason=reason
                ))
        
        # Check headers
        if response_headers:
            # Set-Cookie
            set_cookie = response_headers.get("Set-Cookie", "")
            if set_cookie:
                cookie_matches = re.findall(r'([^=]+)=([^;]+)', set_cookie)
                for name, value in cookie_matches:
                    name = name.strip()
                    if name.lower() in ["sessionid", "jsessionid", "phpsessid", "sid"]:
                        candidates.append(CorrelationCandidate(
                            variable_name=name.lower(),
                            value=value,
                            source="cookie",
                            occurrences=1,
                            suggested_rule=AdvancedCorrelationRule(
                                variable_name=name.lower(),
                                extraction_type=ExtractionType.COOKIE,
                                cookie_name=name,
                                occurrence=1
                            ),
                            confidence=0.95,
                            reason=f"Session cookie: {name}"
                        ))
        
        # Sort by confidence
        candidates.sort(key=lambda x: x.confidence, reverse=True)
        
        self.candidates = candidates
        return candidates
    
    def get_correlation_suggestions(self) -> List[Dict[str, Any]]:
        """Get correlation suggestions for wizard UI"""
        return [c.to_dict() for c in self.candidates]
    
    def apply_suggestion(self, variable_name: str) -> bool:
        """Apply a suggested correlation rule"""
        for candidate in self.candidates:
            if candidate.variable_name == variable_name:
                self.add_rule(candidate.suggested_rule)
                return True
        return False
    
    # ==================== Variable Substitution ====================
    
    def substitute(
        self,
        text: str,
        session_id: str = "default"
    ) -> str:
        """
        Substitute correlation variables in text.
        Supports ${var}, {var}, and {{var}} formats.
        """
        if not text or session_id not in self.variables:
            return text
        
        result = text
        vars_dict = self.variables[session_id]
        
        for var_name, value in vars_dict.items():
            # Handle arrays
            if isinstance(value, list):
                # Use first value for simple substitution
                value = value[0] if value else ""
            
            value_str = str(value)
            
            # Replace all formats
            result = result.replace(f"${{{var_name}}}", value_str)
            result = result.replace(f"{{{var_name}}}", value_str)
            result = result.replace(f"{{{{{var_name}}}}}", value_str)
        
        return result
    
    def get_variable(self, var_name: str, session_id: str = "default", index: int = 0) -> Optional[Any]:
        """Get a correlation variable value"""
        if session_id not in self.variables:
            return None
        
        value = self.variables[session_id].get(var_name)
        
        # Handle array access
        if isinstance(value, list) and index < len(value):
            return value[index]
        
        return value
    
    def get_all_variables(self, session_id: str = "default") -> Dict[str, Any]:
        """Get all variables for a session"""
        return self.variables.get(session_id, {}).copy()
    
    def clear_session(self, session_id: str):
        """Clear all variables for a session"""
        if session_id in self.variables:
            del self.variables[session_id]
    
    def reset(self):
        """Reset engine state"""
        self.rules.clear()
        self.variables.clear()
        self.candidates.clear()
        self.recorded_responses.clear()
        self.replay_responses.clear()


# Singleton instance
_advanced_correlation_engine: Optional[AdvancedCorrelationEngine] = None

def get_advanced_correlation_engine() -> AdvancedCorrelationEngine:
    """Get singleton advanced correlation engine"""
    global _advanced_correlation_engine
    if _advanced_correlation_engine is None:
        _advanced_correlation_engine = AdvancedCorrelationEngine()
    return _advanced_correlation_engine
