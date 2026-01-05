"""
Request Chaining & Test Flow Service
=====================================
Enterprise-grade request chaining for API tests (like ReadyAPI TestSuites)

Features:
- Chain multiple API requests together
- Extract values from responses to use in subsequent requests
- Conditional branching based on response data
- Variable extraction using JSONPath, XPath, Regex
- Built-in assertions at each step
- Parallel and sequential execution modes
"""

import logging
import re
import json
import asyncio
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import httpx
import jsonpath_ng
from jsonpath_ng.ext import parse as jsonpath_parse

logger = logging.getLogger(__name__)


class ExtractionMethod(Enum):
    """Methods for extracting values from responses"""
    JSONPATH = "jsonpath"
    REGEX = "regex"
    HEADER = "header"
    COOKIE = "cookie"
    STATUS_CODE = "status_code"
    RESPONSE_TIME = "response_time"


class AssertionOperator(Enum):
    """Operators for assertions"""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    MATCHES_REGEX = "matches_regex"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"
    EXISTS = "exists"
    NOT_EXISTS = "not_exists"
    JSON_SCHEMA = "json_schema"


class ConditionOperator(Enum):
    """Operators for conditional branching"""
    IF_EQUALS = "if_equals"
    IF_NOT_EQUALS = "if_not_equals"
    IF_CONTAINS = "if_contains"
    IF_STATUS_CODE = "if_status_code"
    IF_SUCCESS = "if_success"
    IF_FAILURE = "if_failure"


@dataclass
class Extraction:
    """Defines how to extract a value from a response"""
    name: str  # Variable name to store the extracted value
    method: ExtractionMethod
    expression: str  # JSONPath, regex, header name, etc.
    default_value: Any = None
    transform: Optional[str] = None  # Optional transform: upper, lower, trim, etc.


@dataclass
class Assertion:
    """Defines an assertion to validate response"""
    source: str  # Variable name or extraction expression
    operator: AssertionOperator
    expected: Any = None
    message: str = ""
    stop_on_failure: bool = False


@dataclass
class Condition:
    """Defines conditional branching logic"""
    source: str
    operator: ConditionOperator
    expected: Any = None
    goto_step: Optional[str] = None  # Step ID to jump to if condition is true
    skip_step: Optional[str] = None  # Step ID to skip if condition is true


@dataclass
class ChainStep:
    """A single step in a request chain"""
    id: str
    name: str
    method: str
    url: str
    headers: Dict[str, str] = field(default_factory=dict)
    body: Optional[str] = None
    body_type: str = "json"  # json, form, xml, raw
    timeout: int = 30
    extractions: List[Extraction] = field(default_factory=list)
    assertions: List[Assertion] = field(default_factory=list)
    conditions: List[Condition] = field(default_factory=list)
    retry_on_failure: bool = False
    retry_count: int = 3
    retry_delay: float = 1.0
    delay_before: float = 0  # Delay before executing this step
    enabled: bool = True


@dataclass
class StepResult:
    """Result of executing a chain step"""
    step_id: str
    step_name: str
    status: str  # success, failed, skipped
    status_code: Optional[int] = None
    response_time_ms: float = 0
    response_body: Any = None
    response_headers: Dict[str, str] = field(default_factory=dict)
    extracted_values: Dict[str, Any] = field(default_factory=dict)
    assertion_results: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class ChainResult:
    """Result of executing an entire chain"""
    chain_id: str
    chain_name: str
    status: str  # success, failed, partial
    total_steps: int
    passed_steps: int
    failed_steps: int
    skipped_steps: int
    total_duration_ms: float
    step_results: List[StepResult] = field(default_factory=list)
    final_variables: Dict[str, Any] = field(default_factory=dict)
    start_time: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    end_time: str = ""


class RequestChainEngine:
    """
    Engine for executing request chains with variable extraction and chaining.
    Similar to ReadyAPI TestSuites with request chaining.
    """

    def __init__(self):
        self.variables: Dict[str, Any] = {}
        self.chains: Dict[str, List[ChainStep]] = {}
        self.results: Dict[str, ChainResult] = {}

    def create_chain(self, chain_id: str, name: str, steps: List[ChainStep]) -> Dict[str, Any]:
        """Create a new request chain"""
        self.chains[chain_id] = steps
        return {
            "chain_id": chain_id,
            "name": name,
            "steps_count": len(steps),
            "created_at": datetime.utcnow().isoformat()
        }

    def set_variable(self, name: str, value: Any):
        """Set a variable that can be used in requests"""
        self.variables[name] = value

    def set_variables(self, variables: Dict[str, Any]):
        """Set multiple variables"""
        self.variables.update(variables)

    def _resolve_variables(self, text: str) -> str:
        """Replace ${variable} placeholders with actual values"""
        if not text or not isinstance(text, str):
            return text

        pattern = r'\$\{([^}]+)\}'

        def replacer(match):
            var_name = match.group(1)
            if var_name in self.variables:
                return str(self.variables[var_name])
            return match.group(0)  # Keep original if not found

        return re.sub(pattern, replacer, text)

    def _resolve_dict_variables(self, data: Dict[str, str]) -> Dict[str, str]:
        """Resolve variables in a dictionary"""
        return {k: self._resolve_variables(v) for k, v in data.items()}

    def _extract_value(self, response: httpx.Response, extraction: Extraction, 
                       response_time_ms: float) -> Any:
        """Extract a value from a response using the specified method"""
        try:
            if extraction.method == ExtractionMethod.JSONPATH:
                json_data = response.json()
                jsonpath_expr = jsonpath_parse(extraction.expression)
                matches = [match.value for match in jsonpath_expr.find(json_data)]
                value = matches[0] if len(matches) == 1 else matches if matches else extraction.default_value

            elif extraction.method == ExtractionMethod.REGEX:
                text = response.text
                match = re.search(extraction.expression, text)
                value = match.group(1) if match and match.groups() else (
                    match.group(0) if match else extraction.default_value
                )

            elif extraction.method == ExtractionMethod.HEADER:
                value = response.headers.get(extraction.expression, extraction.default_value)

            elif extraction.method == ExtractionMethod.COOKIE:
                value = response.cookies.get(extraction.expression, extraction.default_value)

            elif extraction.method == ExtractionMethod.STATUS_CODE:
                value = response.status_code

            elif extraction.method == ExtractionMethod.RESPONSE_TIME:
                value = response_time_ms

            else:
                value = extraction.default_value

            # Apply transform if specified
            if value and extraction.transform:
                value = self._apply_transform(value, extraction.transform)

            return value

        except Exception as e:
            logger.warning(f"Extraction failed for {extraction.name}: {e}")
            return extraction.default_value

    def _apply_transform(self, value: Any, transform: str) -> Any:
        """Apply a transformation to an extracted value"""
        if not isinstance(value, str):
            value = str(value)

        transforms = {
            "upper": lambda v: v.upper(),
            "lower": lambda v: v.lower(),
            "trim": lambda v: v.strip(),
            "int": lambda v: int(v),
            "float": lambda v: float(v),
            "bool": lambda v: v.lower() in ("true", "1", "yes"),
            "json": lambda v: json.loads(v),
            "length": lambda v: len(v),
        }

        if transform in transforms:
            return transforms[transform](value)
        return value

    def _evaluate_assertion(self, assertion: Assertion) -> Dict[str, Any]:
        """Evaluate an assertion and return result"""
        source_value = self.variables.get(assertion.source)

        result = {
            "assertion": f"{assertion.source} {assertion.operator.value} {assertion.expected}",
            "source_value": source_value,
            "expected_value": assertion.expected,
            "passed": False,
            "message": assertion.message or ""
        }

        try:
            op = assertion.operator
            expected = assertion.expected

            if op == AssertionOperator.EQUALS:
                result["passed"] = source_value == expected
            elif op == AssertionOperator.NOT_EQUALS:
                result["passed"] = source_value != expected
            elif op == AssertionOperator.CONTAINS:
                result["passed"] = expected in str(source_value)
            elif op == AssertionOperator.NOT_CONTAINS:
                result["passed"] = expected not in str(source_value)
            elif op == AssertionOperator.STARTS_WITH:
                result["passed"] = str(source_value).startswith(str(expected))
            elif op == AssertionOperator.ENDS_WITH:
                result["passed"] = str(source_value).endswith(str(expected))
            elif op == AssertionOperator.MATCHES_REGEX:
                result["passed"] = bool(re.search(expected, str(source_value)))
            elif op == AssertionOperator.GREATER_THAN:
                result["passed"] = float(source_value) > float(expected)
            elif op == AssertionOperator.LESS_THAN:
                result["passed"] = float(source_value) < float(expected)
            elif op == AssertionOperator.IS_NULL:
                result["passed"] = source_value is None
            elif op == AssertionOperator.IS_NOT_NULL:
                result["passed"] = source_value is not None
            elif op == AssertionOperator.EXISTS:
                result["passed"] = assertion.source in self.variables
            elif op == AssertionOperator.NOT_EXISTS:
                result["passed"] = assertion.source not in self.variables

        except Exception as e:
            result["error"] = str(e)
            result["passed"] = False

        return result

    def _evaluate_condition(self, condition: Condition) -> bool:
        """Evaluate a condition for branching"""
        source_value = self.variables.get(condition.source)

        try:
            op = condition.operator
            expected = condition.expected

            if op == ConditionOperator.IF_EQUALS:
                return source_value == expected
            elif op == ConditionOperator.IF_NOT_EQUALS:
                return source_value != expected
            elif op == ConditionOperator.IF_CONTAINS:
                return expected in str(source_value)
            elif op == ConditionOperator.IF_STATUS_CODE:
                return source_value == expected
            elif op == ConditionOperator.IF_SUCCESS:
                return source_value in [200, 201, 202, 204]
            elif op == ConditionOperator.IF_FAILURE:
                return source_value >= 400

        except Exception as e:
            logger.warning(f"Condition evaluation failed: {e}")
            return False

        return False

    async def _execute_step(self, step: ChainStep, 
                            client: httpx.AsyncClient) -> StepResult:
        """Execute a single chain step"""
        result = StepResult(
            step_id=step.id,
            step_name=step.name,
            status="pending"
        )

        if not step.enabled:
            result.status = "skipped"
            return result

        # Apply delay before execution
        if step.delay_before > 0:
            await asyncio.sleep(step.delay_before)

        # Resolve variables in URL, headers, and body
        url = self._resolve_variables(step.url)
        headers = self._resolve_dict_variables(step.headers)
        body = self._resolve_variables(step.body) if step.body else None

        # Prepare request kwargs
        request_kwargs = {
            "method": step.method.upper(),
            "url": url,
            "headers": headers,
            "timeout": step.timeout
        }

        if body:
            if step.body_type == "json":
                try:
                    request_kwargs["json"] = json.loads(body)
                except json.JSONDecodeError:
                    request_kwargs["content"] = body
            elif step.body_type == "form":
                request_kwargs["data"] = dict(item.split("=") for item in body.split("&"))
            else:
                request_kwargs["content"] = body

        # Execute with retry logic
        attempts = 0
        max_attempts = step.retry_count if step.retry_on_failure else 1

        while attempts < max_attempts:
            attempts += 1
            try:
                start_time = datetime.utcnow()
                response = await client.request(**request_kwargs)
                end_time = datetime.utcnow()

                response_time_ms = (end_time - start_time).total_seconds() * 1000

                result.status_code = response.status_code
                result.response_time_ms = response_time_ms
                result.response_headers = dict(response.headers)

                try:
                    result.response_body = response.json()
                except:
                    result.response_body = response.text

                # Perform extractions
                for extraction in step.extractions:
                    value = self._extract_value(response, extraction, response_time_ms)
                    self.variables[extraction.name] = value
                    result.extracted_values[extraction.name] = value

                # Store common values automatically
                self.variables[f"{step.id}_status_code"] = response.status_code
                self.variables[f"{step.id}_response_time"] = response_time_ms

                # Evaluate assertions
                all_passed = True
                for assertion in step.assertions:
                    assertion_result = self._evaluate_assertion(assertion)
                    result.assertion_results.append(assertion_result)
                    if not assertion_result["passed"]:
                        all_passed = False
                        if assertion.stop_on_failure:
                            result.status = "failed"
                            result.error = f"Assertion failed: {assertion_result['assertion']}"
                            return result

                result.status = "success" if all_passed else "failed"
                break  # Success, exit retry loop

            except Exception as e:
                logger.warning(f"Step {step.id} attempt {attempts} failed: {e}")
                result.error = str(e)
                result.status = "failed"

                if attempts < max_attempts:
                    await asyncio.sleep(step.retry_delay)

        return result

    async def execute_chain(self, chain_id: str, 
                            initial_variables: Optional[Dict[str, Any]] = None) -> ChainResult:
        """Execute an entire request chain"""
        if chain_id not in self.chains:
            raise ValueError(f"Chain {chain_id} not found")

        steps = self.chains[chain_id]
        
        # Initialize variables
        if initial_variables:
            self.variables.update(initial_variables)

        chain_result = ChainResult(
            chain_id=chain_id,
            chain_name=f"Chain {chain_id}",
            status="running",
            total_steps=len(steps),
            passed_steps=0,
            failed_steps=0,
            skipped_steps=0,
            total_duration_ms=0
        )

        start_time = datetime.utcnow()
        skip_steps: set = set()
        goto_step: Optional[str] = None

        async with httpx.AsyncClient() as client:
            for step in steps:
                # Check if we should skip this step
                if step.id in skip_steps:
                    chain_result.skipped_steps += 1
                    continue

                # Check if we're jumping to a specific step
                if goto_step and step.id != goto_step:
                    chain_result.skipped_steps += 1
                    continue
                elif step.id == goto_step:
                    goto_step = None  # Reset after reaching the target

                # Execute the step
                step_result = await self._execute_step(step, client)
                chain_result.step_results.append(step_result)

                if step_result.status == "success":
                    chain_result.passed_steps += 1
                elif step_result.status == "failed":
                    chain_result.failed_steps += 1
                else:
                    chain_result.skipped_steps += 1

                # Evaluate conditions for branching
                for condition in step.conditions:
                    if self._evaluate_condition(condition):
                        if condition.goto_step:
                            goto_step = condition.goto_step
                        if condition.skip_step:
                            skip_steps.add(condition.skip_step)

        end_time = datetime.utcnow()
        chain_result.total_duration_ms = (end_time - start_time).total_seconds() * 1000
        chain_result.end_time = end_time.isoformat()
        chain_result.final_variables = dict(self.variables)

        # Determine overall status
        if chain_result.failed_steps == 0:
            chain_result.status = "success"
        elif chain_result.passed_steps > 0:
            chain_result.status = "partial"
        else:
            chain_result.status = "failed"

        self.results[chain_id] = chain_result
        return chain_result

    def get_chain_result(self, chain_id: str) -> Optional[ChainResult]:
        """Get the result of a chain execution"""
        return self.results.get(chain_id)

    def export_chain(self, chain_id: str) -> Dict[str, Any]:
        """Export a chain definition as JSON"""
        if chain_id not in self.chains:
            raise ValueError(f"Chain {chain_id} not found")

        steps = self.chains[chain_id]
        return {
            "chain_id": chain_id,
            "exported_at": datetime.utcnow().isoformat(),
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "method": s.method,
                    "url": s.url,
                    "headers": s.headers,
                    "body": s.body,
                    "body_type": s.body_type,
                    "extractions": [
                        {
                            "name": e.name,
                            "method": e.method.value,
                            "expression": e.expression,
                            "default_value": e.default_value,
                            "transform": e.transform
                        }
                        for e in s.extractions
                    ],
                    "assertions": [
                        {
                            "source": a.source,
                            "operator": a.operator.value,
                            "expected": a.expected,
                            "message": a.message,
                            "stop_on_failure": a.stop_on_failure
                        }
                        for a in s.assertions
                    ],
                    "retry_on_failure": s.retry_on_failure,
                    "retry_count": s.retry_count,
                    "enabled": s.enabled
                }
                for s in steps
            ]
        }


# Singleton instance
_request_chain_engine: Optional[RequestChainEngine] = None


def get_request_chain_engine() -> RequestChainEngine:
    """Get the singleton RequestChainEngine instance"""
    global _request_chain_engine
    if _request_chain_engine is None:
        _request_chain_engine = RequestChainEngine()
    return _request_chain_engine

