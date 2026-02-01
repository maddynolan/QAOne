"""
Checks Engine - k6-style inline assertions during test execution
Comparable to k6's check() function and Gatling's assertions

Features:
- Inline checks during request execution
- Multiple assertion types (status, body, headers, timing)
- Check aggregation and reporting
- Threshold integration
"""

import logging
import re
import json
import time
from typing import Dict, List, Any, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import threading

logger = logging.getLogger(__name__)


class CheckType(Enum):
    """Types of checks"""
    STATUS = "status"
    BODY_CONTAINS = "body_contains"
    BODY_NOT_CONTAINS = "body_not_contains"
    BODY_REGEX = "body_regex"
    BODY_JSON = "body_json"
    BODY_SIZE = "body_size"
    HEADER = "header"
    RESPONSE_TIME = "response_time"
    CUSTOM = "custom"


@dataclass
class Check:
    """Definition of a single check"""
    name: str
    check_type: CheckType
    expected: Any
    operator: str = "=="  # ==, !=, <, >, <=, >=, contains, regex
    json_path: Optional[str] = None  # For JSON body checks
    header_name: Optional[str] = None  # For header checks
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "check_type": self.check_type.value,
            "expected": self.expected,
            "operator": self.operator,
            "json_path": self.json_path,
            "header_name": self.header_name
        }


@dataclass
class CheckResult:
    """Result of a single check execution"""
    check_name: str
    passed: bool
    actual_value: Any
    expected_value: Any
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tags: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "passed": self.passed,
            "actual_value": str(self.actual_value)[:200],  # Truncate for reporting
            "expected_value": str(self.expected_value)[:200],
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
            "tags": self.tags
        }


@dataclass
class CheckAggregation:
    """Aggregated results for a check"""
    check_name: str
    passes: int = 0
    fails: int = 0
    
    @property
    def total(self) -> int:
        return self.passes + self.fails
    
    @property
    def pass_rate(self) -> float:
        return self.passes / self.total if self.total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "passes": self.passes,
            "fails": self.fails,
            "total": self.total,
            "pass_rate": self.pass_rate
        }


class ChecksEngine:
    """
    Checks Engine - Execute and aggregate inline checks during load tests.
    Similar to k6's check() function.
    
    Usage:
        engine = ChecksEngine()
        
        # Define checks for a request
        checks = [
            Check("status is 200", CheckType.STATUS, 200),
            Check("body contains 'success'", CheckType.BODY_CONTAINS, "success"),
            Check("response time < 500ms", CheckType.RESPONSE_TIME, 500, operator="<")
        ]
        
        # Execute checks against response
        results = engine.check(response, checks, tags={"name": "login"})
        
        # Get aggregated results
        summary = engine.get_summary()
    """
    
    def __init__(self):
        self.results: List[CheckResult] = []
        self.aggregations: Dict[str, CheckAggregation] = {}
        self._lock = threading.Lock()
        self.is_recording = True
    
    def check(
        self,
        response: Dict[str, Any],
        checks: Union[List[Check], Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> List[CheckResult]:
        """
        Execute checks against a response.
        
        Args:
            response: Response data with keys: status, body, headers, response_time_ms
            checks: List of Check objects or k6-style check dict
            tags: Optional tags for grouping results
            
        Returns:
            List of CheckResult objects
        """
        # Convert k6-style dict to Check objects if needed
        if isinstance(checks, dict):
            checks = self._convert_k6_checks(checks)
        
        results = []
        
        for check in checks:
            result = self._execute_check(response, check, tags or {})
            results.append(result)
            
            # Record result
            if self.is_recording:
                self._record_result(result)
        
        return results
    
    def _execute_check(
        self,
        response: Dict[str, Any],
        check: Check,
        tags: Dict[str, str]
    ) -> CheckResult:
        """Execute a single check"""
        try:
            passed = False
            actual_value = None
            message = ""
            
            if check.check_type == CheckType.STATUS:
                actual_value = response.get("status", 0)
                passed = self._compare(actual_value, check.expected, check.operator)
                message = f"Status {actual_value} {'==' if passed else '!='} {check.expected}"
            
            elif check.check_type == CheckType.BODY_CONTAINS:
                body = self._get_body_text(response)
                actual_value = check.expected in body
                passed = actual_value
                message = f"Body {'contains' if passed else 'does not contain'} '{check.expected}'"
            
            elif check.check_type == CheckType.BODY_NOT_CONTAINS:
                body = self._get_body_text(response)
                actual_value = check.expected not in body
                passed = actual_value
                message = f"Body {'does not contain' if passed else 'contains'} '{check.expected}'"
            
            elif check.check_type == CheckType.BODY_REGEX:
                body = self._get_body_text(response)
                match = re.search(check.expected, body)
                actual_value = match.group(0) if match else None
                passed = match is not None
                message = f"Body regex {'matched' if passed else 'did not match'}"
            
            elif check.check_type == CheckType.BODY_JSON:
                body = response.get("body", {})
                if isinstance(body, str):
                    try:
                        body = json.loads(body)
                    except:
                        body = {}
                
                actual_value = self._extract_json_path(body, check.json_path)
                passed = self._compare(actual_value, check.expected, check.operator)
                message = f"JSON {check.json_path} = {actual_value}"
            
            elif check.check_type == CheckType.BODY_SIZE:
                body = self._get_body_text(response)
                actual_value = len(body)
                passed = self._compare(actual_value, check.expected, check.operator)
                message = f"Body size {actual_value} {check.operator} {check.expected}"
            
            elif check.check_type == CheckType.HEADER:
                headers = response.get("headers", {})
                actual_value = headers.get(check.header_name, headers.get(check.header_name.lower()))
                passed = self._compare(actual_value, check.expected, check.operator)
                message = f"Header {check.header_name} = {actual_value}"
            
            elif check.check_type == CheckType.RESPONSE_TIME:
                actual_value = response.get("response_time_ms", 0)
                passed = self._compare(actual_value, check.expected, check.operator)
                message = f"Response time {actual_value}ms {check.operator} {check.expected}ms"
            
            elif check.check_type == CheckType.CUSTOM:
                # Custom check with expected as callable
                if callable(check.expected):
                    actual_value = check.expected(response)
                    passed = bool(actual_value)
                    message = f"Custom check {'passed' if passed else 'failed'}"
                else:
                    passed = False
                    message = "Custom check requires callable"
            
            return CheckResult(
                check_name=check.name,
                passed=passed,
                actual_value=actual_value,
                expected_value=check.expected,
                message=message,
                tags=tags
            )
        
        except Exception as e:
            logger.error(f"Check execution error: {e}")
            return CheckResult(
                check_name=check.name,
                passed=False,
                actual_value=None,
                expected_value=check.expected,
                message=f"Check error: {str(e)}",
                tags=tags
            )
    
    def _compare(self, actual: Any, expected: Any, operator: str) -> bool:
        """Compare values using operator"""
        try:
            if operator == "==":
                return actual == expected
            elif operator == "!=":
                return actual != expected
            elif operator == "<":
                return actual < expected
            elif operator == ">":
                return actual > expected
            elif operator == "<=":
                return actual <= expected
            elif operator == ">=":
                return actual >= expected
            elif operator == "contains":
                return expected in str(actual)
            elif operator == "regex":
                return re.search(expected, str(actual)) is not None
            else:
                return actual == expected
        except (TypeError, ValueError):
            return False
    
    def _get_body_text(self, response: Dict[str, Any]) -> str:
        """Extract body as text"""
        body = response.get("body", "")
        if isinstance(body, dict):
            return json.dumps(body)
        elif isinstance(body, bytes):
            return body.decode("utf-8", errors="ignore")
        return str(body)
    
    def _extract_json_path(self, data: Any, path: str) -> Any:
        """Extract value from JSON using simple path notation"""
        if not path or not data:
            return None
        
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
    
    def _convert_k6_checks(self, k6_checks: Dict[str, Any]) -> List[Check]:
        """
        Convert k6-style check dictionary to Check objects.
        
        k6 style:
            check(res, {
                "status is 200": (r) => r.status === 200,
                "body contains success": (r) => r.body.includes("success")
            })
            
        Our format:
            {"status is 200": {"type": "status", "expected": 200}}
        """
        checks = []
        
        for name, definition in k6_checks.items():
            if isinstance(definition, dict):
                check_type = CheckType(definition.get("type", "status"))
                checks.append(Check(
                    name=name,
                    check_type=check_type,
                    expected=definition.get("expected"),
                    operator=definition.get("operator", "=="),
                    json_path=definition.get("json_path"),
                    header_name=definition.get("header_name")
                ))
            elif callable(definition):
                # Lambda/function check
                checks.append(Check(
                    name=name,
                    check_type=CheckType.CUSTOM,
                    expected=definition
                ))
        
        return checks
    
    def _record_result(self, result: CheckResult):
        """Record result and update aggregations"""
        with self._lock:
            self.results.append(result)
            
            # Update aggregation
            if result.check_name not in self.aggregations:
                self.aggregations[result.check_name] = CheckAggregation(
                    check_name=result.check_name
                )
            
            agg = self.aggregations[result.check_name]
            if result.passed:
                agg.passes += 1
            else:
                agg.fails += 1
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all checks"""
        with self._lock:
            total_passes = sum(a.passes for a in self.aggregations.values())
            total_fails = sum(a.fails for a in self.aggregations.values())
            total = total_passes + total_fails
            
            return {
                "total_checks": total,
                "total_passes": total_passes,
                "total_fails": total_fails,
                "pass_rate": total_passes / total if total > 0 else 1.0,
                "checks": {
                    name: agg.to_dict() 
                    for name, agg in self.aggregations.items()
                }
            }
    
    def get_failed_checks(self) -> List[CheckResult]:
        """Get all failed check results"""
        with self._lock:
            return [r for r in self.results if not r.passed]
    
    def get_checks_by_tag(self, tag_name: str, tag_value: str) -> List[CheckResult]:
        """Get check results filtered by tag"""
        with self._lock:
            return [
                r for r in self.results 
                if r.tags.get(tag_name) == tag_value
            ]
    
    def reset(self):
        """Reset all results and aggregations"""
        with self._lock:
            self.results.clear()
            self.aggregations.clear()
    
    def threshold_check(self, check_name: str, min_pass_rate: float = 0.95) -> bool:
        """
        Check if a specific check meets the threshold.
        Used for pass/fail determination.
        """
        with self._lock:
            if check_name not in self.aggregations:
                return True  # No data = pass
            
            return self.aggregations[check_name].pass_rate >= min_pass_rate
    
    def all_thresholds_passed(self, thresholds: Dict[str, float] = None) -> bool:
        """
        Check if all checks meet their thresholds.
        
        Args:
            thresholds: Dict of check_name -> min_pass_rate (default 0.95 for all)
        """
        default_threshold = 0.95
        
        with self._lock:
            for name, agg in self.aggregations.items():
                threshold = (thresholds or {}).get(name, default_threshold)
                if agg.pass_rate < threshold:
                    return False
            
            return True


# Helper functions for creating common checks
def status_is(expected_status: int) -> Check:
    """Create status check"""
    return Check(
        name=f"status is {expected_status}",
        check_type=CheckType.STATUS,
        expected=expected_status
    )

def status_is_2xx() -> Check:
    """Create check for 2xx status"""
    return Check(
        name="status is 2xx",
        check_type=CheckType.STATUS,
        expected=200,
        operator=">="
    )

def body_contains(text: str) -> Check:
    """Create body contains check"""
    return Check(
        name=f"body contains '{text[:30]}...'",
        check_type=CheckType.BODY_CONTAINS,
        expected=text
    )

def body_not_contains(text: str) -> Check:
    """Create body not contains check"""
    return Check(
        name=f"body does not contain '{text[:30]}...'",
        check_type=CheckType.BODY_NOT_CONTAINS,
        expected=text
    )

def response_time_below(max_ms: int) -> Check:
    """Create response time check"""
    return Check(
        name=f"response time < {max_ms}ms",
        check_type=CheckType.RESPONSE_TIME,
        expected=max_ms,
        operator="<"
    )

def json_path_equals(path: str, expected: Any) -> Check:
    """Create JSON path check"""
    return Check(
        name=f"json {path} == {expected}",
        check_type=CheckType.BODY_JSON,
        expected=expected,
        json_path=path
    )

def header_equals(header_name: str, expected: str) -> Check:
    """Create header check"""
    return Check(
        name=f"header {header_name} == {expected}",
        check_type=CheckType.HEADER,
        expected=expected,
        header_name=header_name
    )


# Singleton instance
_checks_engine: Optional[ChecksEngine] = None

def get_checks_engine() -> ChecksEngine:
    """Get singleton checks engine"""
    global _checks_engine
    if _checks_engine is None:
        _checks_engine = ChecksEngine()
    return _checks_engine
