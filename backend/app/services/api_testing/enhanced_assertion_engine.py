"""
Enhanced Assertion Engine
Supports JSONPath, XPath, Schema Validation, Script Assertions, and more
Better than ReadyAPI with AI-powered smart assertions
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
import xml.etree.ElementTree as ET

from app.services.utils.safe_regex import safe_regex_search

try:
    import jsonpath_ng
    JSONPATH_AVAILABLE = True
except ImportError:
    JSONPATH_AVAILABLE = False

try:
    from jsonschema import validate, ValidationError
    JSONSCHEMA_AVAILABLE = True
except ImportError:
    JSONSCHEMA_AVAILABLE = False

logger = logging.getLogger(__name__)


class AssertionResult:
    """Result of an assertion evaluation"""
    def __init__(
        self,
        assertion_type: str,
        assertion_name: str,
        passed: bool,
        expected: Any = None,
        actual: Any = None,
        message: str = "",
        error: Optional[str] = None
    ):
        self.assertion_type = assertion_type
        self.assertion_name = assertion_name
        self.passed = passed
        self.expected = expected
        self.actual = actual
        self.message = message
        self.error = error
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "assertion_type": self.assertion_type,
            "assertion_name": self.assertion_name,
            "passed": self.passed,
            "expected": self.expected,
            "actual": self.actual,
            "message": self.message,
            "error": self.error,
            "timestamp": self.timestamp
        }


class EnhancedAssertionEngine:
    """
    Enhanced Assertion Engine
    Supports all ReadyAPI assertion types plus AI-powered smart assertions
    """
    
    def __init__(self):
        self.supported_types = [
            "status_code",
            "response_time",
            "contains",
            "not_contains",
            "equals",
            "not_equals",
            "jsonpath",
            "xpath",
            "schema",
            "regex",
            "script",
            "database",
            "performance",
            "header",
            "cookie",
            "matches_baseline"
        ]
    
    def evaluate_assertions(
        self,
        assertions: List[Union[str, Dict[str, Any]]],
        response_data: Any,
        status_code: int,
        response_headers: Dict[str, str] = None,
        response_time_ms: float = 0,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Evaluate all assertions
        
        Args:
            assertions: List of assertion strings or dicts
            response_data: Response body (JSON, XML, text)
            status_code: HTTP status code
            response_headers: Response headers
            response_time_ms: Response time in milliseconds
            context: Additional context (database, variables, etc.)
            
        Returns:
            Assertion results
        """
        results = []
        all_passed = True
        context = context or {}
        response_headers = response_headers or {}
        
        for assertion in assertions:
            try:
                # Parse assertion (string or dict)
                if isinstance(assertion, str):
                    parsed = self._parse_assertion_string(assertion)
                else:
                    parsed = assertion
                
                result = self._evaluate_single_assertion(
                    parsed,
                    response_data,
                    status_code,
                    response_headers,
                    response_time_ms,
                    context
                )
                
                results.append(result.to_dict())
                
                if not result.passed:
                    all_passed = False
                    
            except Exception as e:
                logger.error(f"Error evaluating assertion: {e}", exc_info=True)
                results.append({
                    "assertion_type": "unknown",
                    "assertion_name": str(assertion),
                    "passed": False,
                    "error": str(e),
                    "timestamp": datetime.utcnow().isoformat()
                })
                all_passed = False
        
        return {
            "passed": all_passed,
            "total_assertions": len(assertions),
            "passed_count": sum(1 for r in results if r.get("passed")),
            "failed_count": sum(1 for r in results if not r.get("passed")),
            "results": results
        }
    
    def _parse_assertion_string(self, assertion: str) -> Dict[str, Any]:
        """Parse assertion string into structured format"""
        assertion = assertion.strip()
        
        # Status code assertion
        if re.match(r'status\s*[=!<>]+\s*\d+', assertion, re.IGNORECASE):
            match = re.search(r'status\s*([=!<>]+)\s*(\d+)', assertion, re.IGNORECASE)
            if match:
                operator = match.group(1)
                expected = int(match.group(2))
                return {
                    "type": "status_code",
                    "operator": operator,
                    "expected": expected
                }
        
        # Response time assertion
        if "response_time" in assertion.lower() or "responseTime" in assertion:
            match = re.search(r'response[_\s]*time\s*([<>=]+)\s*(\d+)', assertion, re.IGNORECASE)
            if match:
                operator = match.group(1)
                threshold = int(match.group(2))
                return {
                    "type": "response_time",
                    "operator": operator,
                    "threshold_ms": threshold
                }
        
        # Contains assertion
        if "contains" in assertion.lower():
            match = re.search(r'contains\s+["\']([^"\']+)["\']', assertion, re.IGNORECASE)
            if match:
                return {
                    "type": "contains",
                    "expected": match.group(1)
                }
        
        # JSONPath assertion
        if "$." in assertion or assertion.startswith("$"):
            # Extract JSONPath and expected value
            parts = assertion.split("==")
            if len(parts) == 2:
                jsonpath = parts[0].strip()
                expected = parts[1].strip().strip('"\'')
                return {
                    "type": "jsonpath",
                    "path": jsonpath,
                    "expected": expected
                }
        
        # XPath assertion
        if "xpath" in assertion.lower() or "//" in assertion:
            match = re.search(r'xpath\s*[:=]\s*["\']([^"\']+)["\']', assertion, re.IGNORECASE)
            if match:
                return {
                    "type": "xpath",
                    "path": match.group(1)
                }
        
        # Schema assertion
        if "schema" in assertion.lower():
            return {
                "type": "schema",
                "validate": True
            }
        
        # Regex assertion
        if assertion.startswith("/") and assertion.endswith("/"):
            return {
                "type": "regex",
                "pattern": assertion.strip("/")
            }
        
        # Default: treat as contains
        return {
            "type": "contains",
            "expected": assertion
        }
    
    def _evaluate_single_assertion(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        status_code: int,
        response_headers: Dict[str, str],
        response_time_ms: float,
        context: Dict[str, Any]
    ) -> AssertionResult:
        """Evaluate a single assertion"""
        assertion_type = assertion.get("type", "unknown")
        assertion_name = assertion.get("name", assertion_type)
        
        try:
            if assertion_type == "status_code":
                return self._assert_status_code(assertion, status_code, assertion_name)
            
            elif assertion_type == "response_time":
                return self._assert_response_time(assertion, response_time_ms, assertion_name)
            
            elif assertion_type == "contains":
                return self._assert_contains(assertion, response_data, assertion_name)
            
            elif assertion_type == "not_contains":
                return self._assert_not_contains(assertion, response_data, assertion_name)
            
            elif assertion_type == "equals":
                return self._assert_equals(assertion, response_data, assertion_name)
            
            elif assertion_type == "jsonpath":
                return self._assert_jsonpath(assertion, response_data, assertion_name)
            
            elif assertion_type == "xpath":
                return self._assert_xpath(assertion, response_data, assertion_name)
            
            elif assertion_type == "schema":
                return self._assert_schema(assertion, response_data, assertion_name)
            
            elif assertion_type == "regex":
                return self._assert_regex(assertion, response_data, assertion_name)
            
            elif assertion_type == "script":
                return self._assert_script(assertion, response_data, status_code, response_headers, context, assertion_name)
            
            elif assertion_type == "database":
                return self._assert_database(assertion, context, assertion_name)
            
            elif assertion_type == "header":
                return self._assert_header(assertion, response_headers, assertion_name)
            
            elif assertion_type == "cookie":
                return self._assert_cookie(assertion, response_headers, assertion_name)
            
            elif assertion_type == "matches_baseline":
                return self._assert_matches_baseline(assertion, response_data, assertion_name)
            
            else:
                return AssertionResult(
                    assertion_type,
                    assertion_name,
                    False,
                    message=f"Unknown assertion type: {assertion_type}",
                    error="Unsupported assertion type"
                )
                
        except Exception as e:
            logger.error(f"Error in assertion {assertion_type}: {e}", exc_info=True)
            return AssertionResult(
                assertion_type,
                assertion_name,
                False,
                error=str(e),
                message=f"Assertion evaluation failed: {e}"
            )
    
    def _assert_status_code(
        self,
        assertion: Dict[str, Any],
        status_code: int,
        name: str
    ) -> AssertionResult:
        """Assert status code"""
        operator = assertion.get("operator", "==")
        try:
            expected = int(assertion.get("expected", 200))
        except (ValueError, TypeError):
            expected = 200
        
        passed = False
        if operator in ("==", "=", "equals"):
            passed = status_code == expected
        elif operator in ("!=", "not_equals"):
            passed = status_code != expected
        elif operator in (">", "greater_than"):
            passed = status_code > expected
        elif operator in (">=",):
            passed = status_code >= expected
        elif operator in ("<", "less_than"):
            passed = status_code < expected
        elif operator in ("<=",):
            passed = status_code <= expected
        
        return AssertionResult(
            "status_code",
            name,
            passed,
            expected=expected,
            actual=status_code,
            message=f"Status code {status_code} {'matches' if passed else 'does not match'} expected {expected}"
        )
    
    def _assert_response_time(
        self,
        assertion: Dict[str, Any],
        response_time_ms: float,
        name: str
    ) -> AssertionResult:
        """Assert response time"""
        operator = assertion.get("operator", "<")
        # Read threshold from threshold_ms OR expected (frontend sends 'expected')
        try:
            threshold = float(assertion.get("threshold_ms") or assertion.get("expected") or 1000)
        except (ValueError, TypeError):
            threshold = 1000
        
        passed = False
        if operator in ("<", "less_than"):
            passed = response_time_ms < threshold
        elif operator in ("<=",):
            passed = response_time_ms <= threshold
        elif operator in (">", "greater_than"):
            passed = response_time_ms > threshold
        elif operator in (">=",):
            passed = response_time_ms >= threshold
        elif operator in ("==", "equals"):
            passed = abs(response_time_ms - threshold) < 10  # 10ms tolerance
        
        return AssertionResult(
            "response_time",
            name,
            passed,
            expected=f"< {threshold}ms",
            actual=f"{response_time_ms:.2f}ms",
            message=f"Response time {response_time_ms:.2f}ms {'meets' if passed else 'exceeds'} threshold {threshold}ms"
        )
    
    def _assert_contains(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert response contains value"""
        expected = assertion.get("expected", "")
        response_text = self._to_string(response_data)
        passed = expected in response_text
        
        return AssertionResult(
            "contains",
            name,
            passed,
            expected=expected,
            actual=response_text[:100] if len(response_text) > 100 else response_text,
            message=f"Response {'contains' if passed else 'does not contain'} '{expected}'"
        )
    
    def _assert_not_contains(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert response does not contain value"""
        expected = assertion.get("expected", "")
        response_text = self._to_string(response_data)
        passed = expected not in response_text
        
        return AssertionResult(
            "not_contains",
            name,
            passed,
            expected=expected,
            message=f"Response {'does not contain' if passed else 'contains'} '{expected}'"
        )
    
    def _assert_equals(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert response equals value"""
        expected = assertion.get("expected")
        actual = response_data
        passed = actual == expected
        
        return AssertionResult(
            "equals",
            name,
            passed,
            expected=expected,
            actual=actual,
            message=f"Response {'equals' if passed else 'does not equal'} expected value"
        )
    
    def _assert_jsonpath(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert JSONPath expression"""
        if not JSONPATH_AVAILABLE:
            return AssertionResult(
                "jsonpath",
                name,
                False,
                error="jsonpath-ng library not installed",
                message="Install jsonpath-ng for JSONPath support"
            )
        
        path = assertion.get("path", "$")
        expected = assertion.get("expected")
        
        try:
            # Parse JSON if string
            if isinstance(response_data, str):
                try:
                    data = json.loads(response_data)
                except:
                    return AssertionResult(
                        "jsonpath",
                        name,
                        False,
                        error="Response is not valid JSON",
                        message="Cannot apply JSONPath to non-JSON response"
                    )
            else:
                data = response_data
            
            # Evaluate JSONPath
            jsonpath_expr = jsonpath_ng.parse(path)
            matches = [match.value for match in jsonpath_expr.find(data)]
            
            operator = assertion.get("operator", "equals")
            actual = matches[0] if matches else None
            
            if operator in ("exists",):
                # Just check if path exists (regardless of expected)
                passed = len(matches) > 0
            elif operator in ("not_exists",):
                passed = len(matches) == 0
            elif operator in ("contains",) and expected is not None:
                passed = any(str(expected).lower() in str(match).lower() for match in matches)
            elif operator in ("not_contains",) and expected is not None:
                passed = all(str(expected).lower() not in str(match).lower() for match in matches)
            elif operator in ("greater_than", ">") and expected is not None:
                try:
                    passed = any(float(match) > float(expected) for match in matches)
                except (ValueError, TypeError):
                    passed = False
            elif operator in ("less_than", "<") and expected is not None:
                try:
                    passed = any(float(match) < float(expected) for match in matches)
                except (ValueError, TypeError):
                    passed = False
            elif operator in ("length_equals", "length_greater_than", "length_less_than") and expected is not None:
                # Length operators: get length of array, string, or object keys
                try:
                    expected_len = int(expected)
                except (ValueError, TypeError):
                    expected_len = 0
                val = matches[0] if matches else None
                if isinstance(val, list):
                    length = len(val)
                elif isinstance(val, str):
                    length = len(val)
                elif isinstance(val, dict):
                    length = len(val)
                else:
                    length = 0
                if operator == "length_equals":
                    passed = length == expected_len
                elif operator == "length_greater_than":
                    passed = length > expected_len
                else:
                    passed = length < expected_len
                actual = length
                op_label = operator.replace("length_", "")
                msg = f"JSONPath '{path}' length: matched" if passed else f"JSONPath '{path}' length: expected {op_label} {expected_len}, got {length}"
                return AssertionResult(
                    "jsonpath",
                    name,
                    passed,
                    expected=expected,
                    actual=length,
                    message=msg
                )
            elif expected is not None and expected != "":
                # Default: equals comparison
                passed = any(str(match) == str(expected) for match in matches)
            else:
                # No expected value and no explicit operator — check existence
                passed = len(matches) > 0
            
            return AssertionResult(
                "jsonpath",
                name,
                passed,
                expected=expected,
                actual=actual,
                message=f"JSONPath '{path}' {'matched' if passed else 'did not match'} (operator: {operator})"
            )
            
        except Exception as e:
            return AssertionResult(
                "jsonpath",
                name,
                False,
                error=str(e),
                message=f"JSONPath evaluation failed: {e}"
            )
    
    def _assert_xpath(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert XPath expression"""
        path = assertion.get("path", "//")
        expected = assertion.get("expected")
        
        try:
            # Parse XML if string
            if isinstance(response_data, str):
                try:
                    root = ET.fromstring(response_data)
                except:
                    return AssertionResult(
                        "xpath",
                        name,
                        False,
                        error="Response is not valid XML",
                        message="Cannot apply XPath to non-XML response"
                    )
            else:
                return AssertionResult(
                    "xpath",
                    name,
                    False,
                    error="XPath requires XML string",
                    message="XPath can only be applied to XML responses"
                )
            
            # Evaluate XPath (simplified - use lxml for full XPath support)
            # For now, just check if element exists
            elements = root.findall(path.replace("//", "."))
            passed = len(elements) > 0
            
            return AssertionResult(
                "xpath",
                name,
                passed,
                expected=expected,
                actual=len(elements),
                message=f"XPath '{path}' {'found' if passed else 'not found'} in response"
            )
            
        except Exception as e:
            return AssertionResult(
                "xpath",
                name,
                False,
                error=str(e),
                message=f"XPath evaluation failed: {e}"
            )
    
    def _assert_schema(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert JSON schema validation"""
        if not JSONSCHEMA_AVAILABLE:
            return AssertionResult(
                "schema",
                name,
                False,
                error="jsonschema library not installed",
                message="Install jsonschema for schema validation"
            )
        
        schema = assertion.get("schema")
        if not schema:
            return AssertionResult(
                "schema",
                name,
                False,
                error="No schema provided",
                message="Schema assertion requires a schema definition"
            )

        try:
            # Parse JSON if string
            if isinstance(response_data, str):
                data = json.loads(response_data)
            else:
                data = response_data

            # Parse schema from JSON string if needed
            if isinstance(schema, str):
                schema = json.loads(schema)

            validate(instance=data, schema=schema)
            
            return AssertionResult(
                "schema",
                name,
                True,
                message="Response matches schema"
            )
            
        except ValidationError as e:
            return AssertionResult(
                "schema",
                name,
                False,
                error=str(e),
                message=f"Schema validation failed: {e.message}"
            )
        except Exception as e:
            return AssertionResult(
                "schema",
                name,
                False,
                error=str(e),
                message=f"Schema validation error: {e}"
            )
    
    def _assert_regex(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """Assert regex pattern"""
        pattern = assertion.get("pattern", "")
        response_text = self._to_string(response_data)
        
        try:
            match = safe_regex_search(pattern, response_text, flags=re.IGNORECASE | re.MULTILINE)
            passed = match is not None

            return AssertionResult(
                "regex",
                name,
                passed,
                expected=pattern,
                actual=match.group(0) if match else None,
                message=f"Regex pattern {'matched' if passed else 'did not match'} in response"
            )

        except (ValueError, TimeoutError) as e:
            return AssertionResult(
                "regex",
                name,
                False,
                error=str(e),
                message=f"Regex rejected (unsafe or timed out): {e}"
            )
        except Exception as e:
            return AssertionResult(
                "regex",
                name,
                False,
                error=str(e),
                message=f"Regex evaluation failed: {e}"
            )
    
    def _assert_script(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        status_code: int,
        response_headers: Dict[str, str],
        context: Dict[str, Any],
        name: str
    ) -> AssertionResult:
        """Assert script execution (Python sandbox)
        
        The script has access to:
        - response: the parsed response body (dict/list/str)
        - status_code: HTTP status code (int)
        - headers: response headers (dict)
        - context: execution context (dict)
        - json, re: standard library modules
        
        The script must set `result = True` to pass the assertion.
        Optionally set `message = "..."` for custom messages.
        
        Example script:
            result = status_code == 200 and len(response) > 0
            message = f"Found {len(response)} items"
        """
        script = assertion.get("script", "")
        language = assertion.get("language", "python")
        
        if not script or not script.strip():
            return AssertionResult(
                "script", name, False,
                error="No script provided",
                message="Script assertion requires a 'script' field"
            )
        
        if language not in ("python", "py"):
            return AssertionResult(
                "script", name, False,
                error=f"Script language '{language}' not supported. Use 'python'.",
                message="Only Python script assertions are currently supported"
            )
        
        try:
            import ast as _ast

            # Security: validate AST before execution — block dangerous constructs
            BLOCKED_NAMES = {"__import__", "eval", "exec", "compile", "open", "getattr",
                             "setattr", "delattr", "globals", "locals", "vars", "dir",
                             "__builtins__", "breakpoint", "exit", "quit", "input",
                             "memoryview", "bytearray", "__subclasses__", "subprocess",
                             "os", "sys", "shutil", "pathlib", "importlib"}

            tree = _ast.parse(script, mode="exec")
            for node in _ast.walk(tree):
                # Block imports
                if isinstance(node, (_ast.Import, _ast.ImportFrom)):
                    return AssertionResult(
                        "script", name, False,
                        error="Import statements are not allowed in script assertions",
                        message="Security: import statements are blocked"
                    )
                # Block dangerous function calls and attribute access
                if isinstance(node, _ast.Name) and node.id in BLOCKED_NAMES:
                    return AssertionResult(
                        "script", name, False,
                        error=f"Access to '{node.id}' is not allowed",
                        message=f"Security: '{node.id}' is blocked"
                    )
                if isinstance(node, _ast.Attribute) and node.attr in BLOCKED_NAMES:
                    return AssertionResult(
                        "script", name, False,
                        error=f"Access to '.{node.attr}' is not allowed",
                        message=f"Security: '.{node.attr}' is blocked"
                    )

            # Limit script length
            if len(script) > 5000:
                return AssertionResult(
                    "script", name, False,
                    error="Script too long (max 5000 characters)",
                    message="Security: script size limit exceeded"
                )

            # Sandboxed execution — limited builtins for safety
            safe_builtins = {
                "True": True, "False": False, "None": None,
                "len": len, "str": str, "int": int, "float": float,
                "bool": bool, "list": list, "dict": dict, "tuple": tuple,
                "set": set, "type": type, "isinstance": isinstance,
                "range": range, "enumerate": enumerate, "zip": zip,
                "min": min, "max": max, "sum": sum, "abs": abs,
                "sorted": sorted, "reversed": reversed,
                "any": any, "all": all, "map": map, "filter": filter,
                "round": round, "print": lambda *a: None,  # no-op print
            }

            script_locals = {
                "response": response_data,
                "status_code": status_code,
                "headers": response_headers,
                "context": context,
                "json": json,
                "re": re,
                "result": False,
                "message": "",
            }

            # Compile and execute with AST-validated code
            code = compile(tree, "<assertion>", "exec")
            exec(code, {"__builtins__": safe_builtins}, script_locals)

            passed = bool(script_locals.get("result", False))
            msg = script_locals.get("message", "")
            
            return AssertionResult(
                "script", name, passed,
                message=msg or f"Script assertion {'passed' if passed else 'failed'}"
            )
        except Exception as e:
            return AssertionResult(
                "script", name, False,
                error=str(e),
                message=f"Script execution failed: {e}"
            )
    
    def _assert_database(
        self,
        assertion: Dict[str, Any],
        context: Dict[str, Any],
        name: str
    ) -> AssertionResult:
        """Assert database state using DatabaseConnector"""
        db_connector = context.get("db_connector")
        if not db_connector:
            # Try to get or create a DatabaseConnector instance
            try:
                from app.services.api_testing.database_connector import DatabaseConnector
                db_connector = DatabaseConnector()
            except Exception:
                return AssertionResult(
                    "database",
                    name,
                    False,
                    error="Database connector not available",
                    message="Database assertions require a database connection"
                )
        
        connection_id = assertion.get("connection_id") or assertion.get("db_connection_id") or context.get("connection_id")
        if not connection_id:
            return AssertionResult(
                "database",
                name,
                False,
                error="No connection_id provided",
                message="Database assertion requires a connection_id in the assertion or context"
            )

        query = assertion.get("query") or assertion.get("db_query") or ""
        if not query:
            return AssertionResult(
                "database",
                name,
                False,
                error="No query provided",
                message="Database assertion requires a 'query' field"
            )

        # For cross-verify assertions, resolve the response JSONPath value
        comparison = assertion.get("comparison") or assertion.get("db_comparison") or "equals"
        if comparison in ("field_equals_response", "field_contains_response", "row_matches_response"):
            response_jsonpath = assertion.get("response_jsonpath", "")
            response_data = context.get("response_data") or context.get("response_body")
            if response_data and response_jsonpath:
                try:
                    import json
                    if isinstance(response_data, str):
                        try:
                            response_data = json.loads(response_data)
                        except (json.JSONDecodeError, TypeError):
                            pass
                    # JSONPath resolution — supports $.field.nested, $.array[0].field, $.arr[0]
                    import re
                    # Tokenize: split on dots but handle bracket indices like [0]
                    raw_path = response_jsonpath.lstrip("$").lstrip(".")
                    tokens = []
                    for segment in raw_path.split("."):
                        if not segment:
                            continue
                        # Split "defects[0]" into ("defects", "0")
                        bracket_match = re.match(r'^([^\[]*)\[(\d+)\]$', segment)
                        if bracket_match:
                            key_part, idx_part = bracket_match.groups()
                            if key_part:
                                tokens.append(key_part)
                            tokens.append(int(idx_part))
                        else:
                            tokens.append(segment)
                    value = response_data
                    for token in tokens:
                        if isinstance(token, int) and isinstance(value, list):
                            try:
                                value = value[token]
                            except IndexError:
                                value = None
                                break
                        elif isinstance(token, str) and isinstance(value, dict):
                            value = value.get(token)
                        else:
                            value = None
                            break
                    assertion = {**assertion, "response_value": value}
                except Exception:
                    assertion = {**assertion, "response_value": None}

        try:
            import asyncio
            # DatabaseConnector.assert_database_state is async, run it synchronously
            loop = None
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # We're in an async context — create a task
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    result = pool.submit(
                        asyncio.run,
                        db_connector.assert_database_state(connection_id, assertion)
                    ).result(timeout=30)
            else:
                result = asyncio.run(
                    db_connector.assert_database_state(connection_id, assertion)
                )
            
            return AssertionResult(
                "database",
                name,
                passed=result.get("passed", False),
                expected=assertion.get("expected_result"),
                actual=result.get("actual_result"),
                message=result.get("message", "Database assertion evaluated")
            )
        except Exception as e:
            return AssertionResult(
                "database",
                name,
                False,
                error=str(e),
                message=f"Database assertion failed: {e}"
            )
    
    def _assert_header(
        self,
        assertion: Dict[str, Any],
        response_headers: Dict[str, str],
        name: str
    ) -> AssertionResult:
        """Assert response header"""
        # Frontend sends header name as 'path'; backend also accepts 'header'
        header_name = assertion.get("header") or assertion.get("path", "")
        expected = assertion.get("expected", "")
        operator = assertion.get("operator", "equals")
        
        # Case-insensitive header lookup
        actual = ""
        for k, v in response_headers.items():
            if k.lower() == header_name.lower():
                actual = v
                break
        
        passed = False
        if not expected:
            passed = actual != ""
        elif operator in ("contains",):
            passed = expected.lower() in actual.lower()
        elif operator in ("not_contains",):
            passed = expected.lower() not in actual.lower()
        elif operator in ("equals", "==", "="):
            passed = actual == expected
        elif operator in ("not_equals", "!="):
            passed = actual != expected
        elif operator in ("exists",):
            passed = actual != ""
        else:
            passed = actual == expected
        
        return AssertionResult(
            "header",
            name,
            passed,
            expected=expected,
            actual=actual,
            message=f"Header '{header_name}' {'matches' if passed else 'does not match'} expected"
        )
    
    def _assert_cookie(
        self,
        assertion: Dict[str, Any],
        response_headers: Dict[str, str],
        name: str
    ) -> AssertionResult:
        """Assert cookie"""
        cookie_name = assertion.get("cookie", "")
        expected = assertion.get("expected", "")
        
        set_cookie = response_headers.get("Set-Cookie", "")
        # Simple cookie extraction
        if cookie_name in set_cookie:
            passed = expected in set_cookie if expected else True
        else:
            passed = False
        
        return AssertionResult(
            "cookie",
            name,
            passed,
            expected=expected,
            actual=set_cookie[:100] if set_cookie else None,
            message=f"Cookie '{cookie_name}' {'found' if passed else 'not found'}"
        )
    
    def _assert_matches_baseline(
        self,
        assertion: Dict[str, Any],
        response_data: Any,
        name: str
    ) -> AssertionResult:
        """
        Regression assertion: compare current response body to a stored baseline (expected).
        Use when you want to detect any change from a known-good response.
        """
        baseline_raw = assertion.get("baseline") or assertion.get("expected") or assertion.get("schema")
        if baseline_raw is None or (isinstance(baseline_raw, str) and not baseline_raw.strip()):
            return AssertionResult(
                "matches_baseline",
                name,
                False,
                error="No baseline provided",
                message="Matches baseline requires a baseline JSON (paste previous response or use Save as baseline)"
            )
        try:
            if isinstance(response_data, str):
                current = json.loads(response_data)
            else:
                current = response_data if isinstance(response_data, (dict, list)) else json.loads(str(response_data))
        except Exception as e:
            return AssertionResult(
                "matches_baseline",
                name,
                False,
                error=str(e),
                message=f"Current response is not valid JSON: {e}"
            )
        try:
            if isinstance(baseline_raw, str):
                baseline = json.loads(baseline_raw)
            else:
                baseline = baseline_raw
        except Exception as e:
            return AssertionResult(
                "matches_baseline",
                name,
                False,
                error=str(e),
                message=f"Baseline is not valid JSON: {e}"
            )
        passed = current == baseline
        return AssertionResult(
            "matches_baseline",
            name,
            passed,
            expected="<baseline>",
            actual=json.dumps(current)[:500] if not passed else None,
            message="Response matches baseline" if passed else "Response differs from baseline (regression)"
        )
    
    def _to_string(self, data: Any) -> str:
        """Convert data to string"""
        if isinstance(data, str):
            return data
        elif isinstance(data, (dict, list)):
            return json.dumps(data)
        else:
            return str(data)
    
    def suggest_assertions(
        self,
        response_data: Any,
        status_code: int,
        response_headers: Dict[str, str] = None
    ) -> List[Dict[str, Any]]:
        """
        AI-powered smart assertion suggestions
        Analyzes response and suggests appropriate assertions
        """
        suggestions = []
        response_headers = response_headers or {}
        
        # Always suggest status code assertion
        suggestions.append({
            "type": "status_code",
            "name": "Status Code Check",
            "expected": status_code,
            "operator": "=="
        })
        
        # Suggest response time if available
        suggestions.append({
            "type": "response_time",
            "name": "Response Time Check",
            "threshold_ms": 1000,
            "operator": "<"
        })
        
        # If JSON response, suggest JSONPath assertions
        if isinstance(response_data, dict):
            # Suggest assertions for top-level keys
            for key in list(response_data.keys())[:5]:  # Limit to 5
                suggestions.append({
                    "type": "jsonpath",
                    "name": f"Check {key} exists",
                    "path": f"$.{key}",
                    "expected": None
                })
        
        # If XML response, suggest XPath assertions
        if isinstance(response_data, str) and response_data.strip().startswith("<"):
            suggestions.append({
                "type": "xpath",
                "name": "XML Structure Check",
                "path": "//*",
                "expected": None
            })
        
        # Suggest schema validation if JSON
        if isinstance(response_data, dict):
            suggestions.append({
                "type": "schema",
                "name": "Schema Validation",
                "validate": True
            })
        
        return suggestions


