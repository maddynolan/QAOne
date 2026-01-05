"""
Request Chaining API Router
============================
API endpoints for managing and executing request chains.
Like ReadyAPI TestSuites with request chaining capabilities.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.services.api_testing.request_chaining import (
    get_request_chain_engine,
    ChainStep,
    Extraction,
    Assertion,
    Condition,
    ExtractionMethod,
    AssertionOperator,
    ConditionOperator
)

router = APIRouter(prefix="/api/request-chain", tags=["Request Chaining"])


class ExtractionModel(BaseModel):
    name: str
    method: str  # jsonpath, regex, header, cookie, status_code, response_time
    expression: str
    default_value: Optional[Any] = None
    transform: Optional[str] = None


class AssertionModel(BaseModel):
    source: str
    operator: str  # equals, not_equals, contains, etc.
    expected: Optional[Any] = None
    message: str = ""
    stop_on_failure: bool = False


class ConditionModel(BaseModel):
    source: str
    operator: str  # if_equals, if_not_equals, if_contains, etc.
    expected: Optional[Any] = None
    goto_step: Optional[str] = None
    skip_step: Optional[str] = None


class ChainStepModel(BaseModel):
    id: str
    name: str
    method: str
    url: str
    headers: Dict[str, str] = {}
    body: Optional[str] = None
    body_type: str = "json"
    timeout: int = 30
    extractions: List[ExtractionModel] = []
    assertions: List[AssertionModel] = []
    conditions: List[ConditionModel] = []
    retry_on_failure: bool = False
    retry_count: int = 3
    retry_delay: float = 1.0
    delay_before: float = 0
    enabled: bool = True


class CreateChainRequest(BaseModel):
    chain_id: str
    name: str
    steps: List[ChainStepModel]


class ExecuteChainRequest(BaseModel):
    chain_id: str
    variables: Dict[str, Any] = {}


class SetVariablesRequest(BaseModel):
    variables: Dict[str, Any]


def _model_to_step(model: ChainStepModel) -> ChainStep:
    """Convert Pydantic model to dataclass"""
    extractions = [
        Extraction(
            name=e.name,
            method=ExtractionMethod(e.method),
            expression=e.expression,
            default_value=e.default_value,
            transform=e.transform
        )
        for e in model.extractions
    ]

    assertions = [
        Assertion(
            source=a.source,
            operator=AssertionOperator(a.operator),
            expected=a.expected,
            message=a.message,
            stop_on_failure=a.stop_on_failure
        )
        for a in model.assertions
    ]

    conditions = [
        Condition(
            source=c.source,
            operator=ConditionOperator(c.operator),
            expected=c.expected,
            goto_step=c.goto_step,
            skip_step=c.skip_step
        )
        for c in model.conditions
    ]

    return ChainStep(
        id=model.id,
        name=model.name,
        method=model.method,
        url=model.url,
        headers=model.headers,
        body=model.body,
        body_type=model.body_type,
        timeout=model.timeout,
        extractions=extractions,
        assertions=assertions,
        conditions=conditions,
        retry_on_failure=model.retry_on_failure,
        retry_count=model.retry_count,
        retry_delay=model.retry_delay,
        delay_before=model.delay_before,
        enabled=model.enabled
    )


@router.post("/chains")
async def create_chain(request: CreateChainRequest):
    """
    Create a new request chain.
    
    Example:
    ```json
    {
        "chain_id": "auth-flow",
        "name": "Authentication Flow",
        "steps": [
            {
                "id": "login",
                "name": "Login Request",
                "method": "POST",
                "url": "https://api.example.com/auth/login",
                "headers": {"Content-Type": "application/json"},
                "body": "{\"username\": \"${username}\", \"password\": \"${password}\"}",
                "extractions": [
                    {"name": "token", "method": "jsonpath", "expression": "$.access_token"}
                ],
                "assertions": [
                    {"source": "login_status_code", "operator": "equals", "expected": 200}
                ]
            },
            {
                "id": "get-profile",
                "name": "Get User Profile",
                "method": "GET",
                "url": "https://api.example.com/users/me",
                "headers": {"Authorization": "Bearer ${token}"}
            }
        ]
    }
    ```
    """
    engine = get_request_chain_engine()
    steps = [_model_to_step(s) for s in request.steps]
    result = engine.create_chain(request.chain_id, request.name, steps)
    return {
        "status": "success",
        "message": f"Chain '{request.name}' created successfully",
        **result
    }


@router.post("/chains/execute")
async def execute_chain(request: ExecuteChainRequest):
    """
    Execute a request chain.
    
    Provide initial variables that will be available to all steps.
    Variables can be referenced using ${variable_name} syntax.
    """
    engine = get_request_chain_engine()
    
    try:
        result = await engine.execute_chain(request.chain_id, request.variables)
        return {
            "status": "success",
            "result": {
                "chain_id": result.chain_id,
                "chain_name": result.chain_name,
                "status": result.status,
                "total_steps": result.total_steps,
                "passed_steps": result.passed_steps,
                "failed_steps": result.failed_steps,
                "skipped_steps": result.skipped_steps,
                "total_duration_ms": result.total_duration_ms,
                "step_results": [
                    {
                        "step_id": sr.step_id,
                        "step_name": sr.step_name,
                        "status": sr.status,
                        "status_code": sr.status_code,
                        "response_time_ms": sr.response_time_ms,
                        "extracted_values": sr.extracted_values,
                        "assertion_results": sr.assertion_results,
                        "error": sr.error
                    }
                    for sr in result.step_results
                ],
                "final_variables": result.final_variables,
                "start_time": result.start_time,
                "end_time": result.end_time
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.get("/chains/{chain_id}")
async def get_chain(chain_id: str):
    """Get chain definition and export as JSON"""
    engine = get_request_chain_engine()
    
    try:
        export = engine.export_chain(chain_id)
        return {
            "status": "success",
            "chain": export
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/chains/{chain_id}/result")
async def get_chain_result(chain_id: str):
    """Get the last execution result for a chain"""
    engine = get_request_chain_engine()
    result = engine.get_chain_result(chain_id)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No execution result found for chain {chain_id}")
    
    return {
        "status": "success",
        "result": {
            "chain_id": result.chain_id,
            "chain_name": result.chain_name,
            "status": result.status,
            "total_steps": result.total_steps,
            "passed_steps": result.passed_steps,
            "failed_steps": result.failed_steps,
            "total_duration_ms": result.total_duration_ms,
            "start_time": result.start_time,
            "end_time": result.end_time
        }
    }


@router.post("/variables")
async def set_variables(request: SetVariablesRequest):
    """Set global variables that can be used across all chains"""
    engine = get_request_chain_engine()
    engine.set_variables(request.variables)
    return {
        "status": "success",
        "message": f"Set {len(request.variables)} variables",
        "variables": list(request.variables.keys())
    }


@router.get("/variables")
async def get_variables():
    """Get all current variables"""
    engine = get_request_chain_engine()
    return {
        "status": "success",
        "variables": engine.variables
    }


@router.get("/extraction-methods")
async def get_extraction_methods():
    """Get available extraction methods"""
    return {
        "status": "success",
        "methods": [
            {"value": "jsonpath", "label": "JSONPath", "example": "$.data.id"},
            {"value": "regex", "label": "Regular Expression", "example": "\"id\":\\s*(\\d+)"},
            {"value": "header", "label": "Response Header", "example": "X-Request-Id"},
            {"value": "cookie", "label": "Cookie", "example": "session_id"},
            {"value": "status_code", "label": "Status Code", "example": ""},
            {"value": "response_time", "label": "Response Time (ms)", "example": ""}
        ]
    }


@router.get("/assertion-operators")
async def get_assertion_operators():
    """Get available assertion operators"""
    return {
        "status": "success",
        "operators": [
            {"value": "equals", "label": "Equals", "example": "200"},
            {"value": "not_equals", "label": "Not Equals", "example": "500"},
            {"value": "contains", "label": "Contains", "example": "success"},
            {"value": "not_contains", "label": "Not Contains", "example": "error"},
            {"value": "starts_with", "label": "Starts With", "example": "Bearer"},
            {"value": "ends_with", "label": "Ends With", "example": ".json"},
            {"value": "matches_regex", "label": "Matches Regex", "example": "^[a-z]+$"},
            {"value": "greater_than", "label": "Greater Than", "example": "0"},
            {"value": "less_than", "label": "Less Than", "example": "1000"},
            {"value": "is_null", "label": "Is Null", "example": ""},
            {"value": "is_not_null", "label": "Is Not Null", "example": ""},
            {"value": "exists", "label": "Exists", "example": ""},
            {"value": "not_exists", "label": "Not Exists", "example": ""}
        ]
    }


@router.post("/quick-chain")
async def quick_chain(steps: List[Dict[str, Any]]):
    """
    Execute a quick chain without saving it.
    
    Simplified format for quick testing:
    ```json
    [
        {
            "method": "POST",
            "url": "https://api.example.com/login",
            "body": {"username": "test", "password": "test"},
            "extract": {"token": "$.access_token"}
        },
        {
            "method": "GET",
            "url": "https://api.example.com/profile",
            "headers": {"Authorization": "Bearer ${token}"}
        }
    ]
    ```
    """
    engine = get_request_chain_engine()
    
    # Convert simplified format to full format
    chain_steps = []
    for i, step in enumerate(steps):
        extractions = []
        if "extract" in step:
            for name, expr in step["extract"].items():
                extractions.append(Extraction(
                    name=name,
                    method=ExtractionMethod.JSONPATH,
                    expression=expr
                ))
        
        assertions = []
        if "assert" in step:
            for source, expected in step["assert"].items():
                assertions.append(Assertion(
                    source=source,
                    operator=AssertionOperator.EQUALS,
                    expected=expected
                ))
        
        body = step.get("body")
        if isinstance(body, dict):
            body = __import__("json").dumps(body)
        
        chain_steps.append(ChainStep(
            id=f"step_{i}",
            name=step.get("name", f"Step {i+1}"),
            method=step.get("method", "GET"),
            url=step["url"],
            headers=step.get("headers", {}),
            body=body,
            extractions=extractions,
            assertions=assertions
        ))
    
    # Create and execute
    chain_id = f"quick_{datetime.utcnow().timestamp()}"
    engine.create_chain(chain_id, "Quick Chain", chain_steps)
    result = await engine.execute_chain(chain_id)
    
    return {
        "status": "success",
        "result": {
            "status": result.status,
            "total_steps": result.total_steps,
            "passed_steps": result.passed_steps,
            "failed_steps": result.failed_steps,
            "total_duration_ms": result.total_duration_ms,
            "extracted_variables": result.final_variables
        }
    }

