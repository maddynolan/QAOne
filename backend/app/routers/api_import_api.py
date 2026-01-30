"""
API Import API Router
Handles importing API specifications (WSDL, OpenAPI, GraphQL, Postman) and generating test cases
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import json

from app.services.connectors.api_spec_parser import APISpecParser
from app.services.engines.api_test_engine import APITestEngine
from app.services.agents.persona_registry import persona_registry, PersonaType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/import", tags=["api-import"])

parser = APISpecParser()
engine = APITestEngine()


class APIImportRequest(BaseModel):
    """Request to import API specification"""
    spec_content: str
    spec_format: str  # openapi, swagger, wsdl, postman, graphql, rest
    content_type: str = "json"  # json, xml, yaml
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class APITestGenerationRequest(BaseModel):
    """Request to generate test cases from imported API"""
    parsed_spec: Dict[str, Any]
    framework: str = "playwright"  # playwright, pytest, postman, rest_assured, k6
    include_negative: bool = True
    include_boundary: bool = True
    include_security: bool = True
    use_rift_persona: bool = True  # Use Rift persona for enterprise-grade testing


@router.post("/spec")
async def import_api_specification(request: APIImportRequest):
    """
    Import API specification from various formats
    
    Supports:
    - OpenAPI/Swagger (JSON/YAML)
    - WSDL (XML)
    - Postman Collection (JSON)
    - GraphQL Schema (JSON/SDL)
    - REST API (OpenAPI format)
    """
    try:
        # Parse the specification
        parsed_spec = parser.parse(
            spec_content=request.spec_content,
            spec_format=request.spec_format,
            content_type=request.content_type
        )
        
        # Generate test suite
        test_suite = engine.generate_test_suite(
            api_spec=parsed_spec,
            spec_format=parsed_spec.get("format", request.spec_format)
        )
        
        return {
            "status": "success",
            "parsed_spec": parsed_spec,
            "test_suite": test_suite,
            "summary": {
                "format": parsed_spec.get("format"),
                "total_endpoints": test_suite.get("total_endpoints", 0),
                "total_tests": test_suite.get("total_tests", 0)
            }
        }
    except Exception as e:
        logger.error(f"Error importing API spec: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to import API specification: {str(e)}")


@router.post("/spec/file")
async def import_api_specification_file(
    file: UploadFile = File(...),
    spec_format: str = Form(...),
    project_id: Optional[str] = Form(None),
    tenant_id: Optional[str] = Form(None)
):
    """
    Import API specification from uploaded file
    
    Supports file uploads for:
    - OpenAPI/Swagger (.json, .yaml, .yml)
    - WSDL (.wsdl, .xml)
    - Postman Collection (.json)
    - GraphQL Schema (.graphql, .gql, .json)
    """
    try:
        # Read file content
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Determine content type and format from file extension
        filename = file.filename.lower()
        if filename.endswith(('.har', '.har.json')) or ('har' in filename and filename.endswith('.json')):
            content_type = "json"
            spec_format = "har"
        elif filename.endswith(('.yaml', '.yml')):
            content_type = "yaml"
        elif filename.endswith(('.xml', '.wsdl')):
            content_type = "xml"
        else:
            content_type = "json"

        # Parse the specification
        parsed_spec = parser.parse(
            spec_content=content_str,
            spec_format=spec_format,
            content_type=content_type
        )
        # HAR normalizes to openapi-like; engine expects openapi for that
        out_format = parsed_spec.get("format", spec_format)
        if out_format == "har":
            out_format = "openapi"

        # Generate test suite
        test_suite = engine.generate_test_suite(
            api_spec=parsed_spec,
            spec_format=out_format
        )

        return {
            "status": "success",
            "filename": file.filename,
            "parsed_spec": parsed_spec,
            "test_suite": test_suite,
            "summary": {
                "format": parsed_spec.get("format"),
                "total_endpoints": test_suite.get("total_endpoints", 0),
                "total_tests": test_suite.get("total_tests", 0)
            }
        }
    except Exception as e:
        logger.error(f"Error importing API spec file: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to import API specification file: {str(e)}")


@router.post("/generate-tests")
async def generate_api_tests(request: APITestGenerationRequest):
    """
    Generate executable test scripts from parsed API specification with Rift persona (enterprise-grade).
    
    Frameworks supported:
    - playwright: Playwright API tests (TypeScript/JavaScript)
    - pytest: pytest with requests (Python)
    - postman: Postman collection
    - rest_assured: REST Assured (Java)
    - k6: k6 performance tests (JavaScript)
    
    Uses Rift persona (Ex-Stripe Principal API Engineer) for enterprise-grade comprehensive API testing:
    - OWASP API Top 10 security tests
    - Authentication matrix (valid, expired, revoked, missing, malformed)
    - Payload fuzzing (SQLi, XSS, XXE, oversized payloads)
    - Contract tests (Pact) and consumer-driven tests
    - Postman collection + Newman CLI + environment files
    - Rate limiting, pagination, retry behavior tests
    
    Falls back to OpenAI enhancement, then deterministic engine if Rift unavailable.
    """
    try:
        import asyncio
        from app.services.llm.api_test_service import get_api_test_service
        
        # Step 1: Generate base test suite (deterministic)
        test_suite = engine.generate_test_suite(
            api_spec=request.parsed_spec,
            spec_format=request.parsed_spec.get("format", "openapi")
        )
        
        # Filter test cases based on options
        filtered_tests = test_suite.get("test_cases", [])
        
        if not request.include_negative:
            filtered_tests = [t for t in filtered_tests if "negative" not in t.get("tags", [])]
        
        if not request.include_boundary:
            filtered_tests = [t for t in filtered_tests if "boundary" not in t.get("tags", [])]
        
        if not request.include_security:
            filtered_tests = [t for t in filtered_tests if "security" not in t.get("tags", [])]
        
        test_suite["test_cases"] = filtered_tests
        
        # Step 2: Use Rift persona for enterprise-grade comprehensive API testing
        rift_persona_result = None
        enhancement_metrics = None
        
        if request.use_rift_persona:
            try:
                logger.info("[Rift Persona] Generating enterprise-grade comprehensive API test suite...")
                rift_persona = persona_registry.get_persona(PersonaType.API)
                
                # Generate comprehensive API tests using Rift persona
                rift_persona_result = await rift_persona.generate(
                    input_data={
                        "openapi_spec": request.parsed_spec,
                        "include_security_tests": request.include_security,
                        "include_performance_tests": False,  # Performance is separate
                        "include_contract_tests": True
                    },
                    context={
                        "environment": "staging",
                        "authentication_type": _detect_auth_type(request.parsed_spec)
                    },
                    temperature=0.3,
                    tenant_id=None
                )
                
                # Convert Rift persona results to test suite format
                rift_test_cases = []
                for tc in rift_persona_result.test_cases:
                    rift_test_cases.append({
                        "test_case_id": f"rift_{len(rift_test_cases)}",
                        "title": tc.name,
                        "description": f"Rift-generated test: {tc.name}",
                        "test_type": "api",
                        "method": tc.method,
                        "path": tc.endpoint,
                        "request": {
                            "method": tc.method,
                            "url": tc.endpoint,
                            "headers": {},
                            "body": tc.request_payload if tc.request_payload is not None else {}
                        },
                        "expected_status": tc.expected_status,
                        "expected_result": f"Response status {tc.expected_status} with valid schema",
                        "expected_response": tc.expected_response_schema if tc.expected_response_schema is not None else {},
                        "assertions": tc.assertions,
                        "tags": [tc.test_type, "rift_persona"],
                        "priority": "high" if tc.test_type == "security" else "medium"
                    })
                
                # Add security tests from Rift
                for st in rift_persona_result.security_tests:
                    rift_test_cases.append({
                        "test_case_id": f"rift_security_{len(rift_test_cases)}",
                        "title": st.name,
                        "description": f"Security test: {st.attack_type} - {st.owasp_category}",
                        "test_type": "api",
                        "method": "POST",  # Most security tests are POST
                        "path": "/api/v1/test",  # Will be mapped to actual endpoints
                        "request": {
                            "method": "POST",
                            "url": "/api/v1/test",
                            "headers": {},
                            "body": {"payload": st.payload}
                        },
                        "expected_status": 400,  # Security tests expect rejection
                        "expected_result": st.expected_behavior,
                        "tags": ["security", "rift_persona", st.attack_type, st.owasp_category],
                        "priority": "high"
                    })
                
                # Merge Rift tests with base test suite
                test_suite["test_cases"].extend(rift_test_cases)
                # Convert authentication matrix to dict if it exists
                auth_matrix_dict = None
                if rift_persona_result.authentication_matrix:
                    auth_matrix = rift_persona_result.authentication_matrix
                    try:
                        auth_matrix_dict = {
                            "valid_token": auth_matrix.valid_token.model_dump() if hasattr(auth_matrix.valid_token, 'model_dump') else auth_matrix.valid_token.dict(),
                            "expired_token": auth_matrix.expired_token.model_dump() if hasattr(auth_matrix.expired_token, 'model_dump') else auth_matrix.expired_token.dict(),
                            "revoked_token": auth_matrix.revoked_token.model_dump() if hasattr(auth_matrix.revoked_token, 'model_dump') else auth_matrix.revoked_token.dict(),
                            "missing_token": auth_matrix.missing_token.model_dump() if hasattr(auth_matrix.missing_token, 'model_dump') else auth_matrix.missing_token.dict(),
                            "malformed_token": auth_matrix.malformed_token.model_dump() if hasattr(auth_matrix.malformed_token, 'model_dump') else auth_matrix.malformed_token.dict()
                        }
                    except Exception as e:
                        logger.warning(f"Failed to convert authentication matrix: {e}")
                        auth_matrix_dict = None
                
                test_suite["rift_persona"] = {
                    "test_cases": len(rift_persona_result.test_cases),
                    "security_tests": len(rift_persona_result.security_tests),
                    "postman_collection": rift_persona_result.postman_collection,
                    "newman_command": rift_persona_result.newman_command,
                    "owasp_coverage": rift_persona_result.owasp_coverage,
                    "authentication_matrix": auth_matrix_dict,
                    "persona_info": {
                        "name": "Rift",
                        "expertise": "Ex-Stripe Principal API Test Engineer, 17 years",
                        "track_record": "Zero API outages in production for 5 years"
                    }
                }
                
                enhancement_metrics = {
                    "provider": "rift_persona",
                    "test_cases_generated": len(rift_test_cases),
                    "security_tests": len(rift_persona_result.security_tests),
                    "owasp_coverage": len(rift_persona_result.owasp_coverage)
                }
                
                logger.info(f"[Rift Persona] Generated {len(rift_test_cases)} enterprise-grade API tests with OWASP coverage")
                
            except Exception as e:
                logger.warning(f"Rift persona generation failed: {e}, falling back to OpenAI enhancement", exc_info=True)
                rift_persona_result = None
                
                # Fallback to OpenAI enhancement
                try:
                    api_test_service = get_api_test_service()
                    enhancement_result = await asyncio.wait_for(
                        api_test_service.enhance_test_cases(
                            test_suite=test_suite,
                            api_spec=request.parsed_spec,
                            timeout=60.0
                        ),
                        timeout=65.0
                    )
                    
                    if enhancement_result.get("test_suite"):
                        test_suite = enhancement_result["test_suite"]
                        enhancement_metrics = enhancement_result.get("metrics")
                        logger.info(f"Enhanced test cases with OpenAI: {enhancement_metrics}")
                except Exception as e2:
                    logger.warning(f"OpenAI enhancement also failed: {e2}, using base test suite")
        else:
            # Rift persona disabled, use OpenAI enhancement
            try:
                api_test_service = get_api_test_service()
                enhancement_result = await asyncio.wait_for(
                    api_test_service.enhance_test_cases(
                        test_suite=test_suite,
                        api_spec=request.parsed_spec,
                        timeout=60.0
                    ),
                    timeout=65.0
                )
                
                if enhancement_result.get("test_suite"):
                    test_suite = enhancement_result["test_suite"]
                    enhancement_metrics = enhancement_result.get("metrics")
                    logger.info(f"Enhanced test cases with OpenAI: {enhancement_metrics}")
            except Exception as e:
                logger.warning(f"Test case enhancement failed: {e}, using base test suite")
        
        # Step 3: Generate executable test code (try OpenAI first, fallback to deterministic)
        test_code = ""
        setup_instructions = ""
        code_metrics = None
        
        try:
            api_test_service = get_api_test_service()
            code_result = await asyncio.wait_for(
                api_test_service.generate_automation_code(
                    test_suite=test_suite,
                    framework=request.framework,
                    timeout=60.0
                ),
                timeout=65.0
            )
            
            test_code = code_result.get("code", "")
            code_metrics = code_result.get("metrics")
            logger.info(f"Generated {request.framework} code: {code_metrics}")
            
            # Get setup instructions based on framework
            setup_instructions = {
                "playwright": "1. Install: npm install -D @playwright/test\n2. Run: npx playwright install\n3. Execute: npx playwright test",
                "pytest": "1. Install: pip install pytest requests\n2. Execute: pytest test_api.py -v",
                "k6": "1. Install k6 from https://k6.io\n2. Run: k6 run test.js\n3. Load test: k6 run --vus 10 --duration 30s test.js",
                "postman": "1. Open Postman\n2. Click Import\n3. Select generated JSON file\n4. Set environment variables\n5. Run collection",
                "rest_assured": "1. Add REST Assured dependency to pom.xml\n2. Add JUnit 5 dependency\n3. Run: mvn test"
            }.get(request.framework, "")
            
        except Exception as e:
            logger.warning(f"LLM code generation failed: {e}, using deterministic engine")
            # Fallback to deterministic engine
            test_result = engine.generate_executable_tests(
                test_suite=test_suite,
                framework=request.framework
            )
            
            if isinstance(test_result, dict):
                test_code = test_result.get("test_code", "")
                setup_instructions = test_result.get("setup_instructions", "")
            else:
                test_code = test_result
        
        return {
            "status": "success",
            "framework": request.framework,
            "language": {
                "playwright": "typescript",
                "pytest": "python",
                "k6": "javascript",
                "postman": "json",
                "rest_assured": "java"
            }.get(request.framework, "typescript"),
            "test_code": test_code,
            "setup_instructions": setup_instructions,
            "test_suite": test_suite,
            "summary": {
                "total_tests": len(test_suite.get("test_cases", [])),
                "endpoints_tested": len(set(t.get("endpoint_id") for t in test_suite.get("test_cases", []))),
                "enhancement_used": enhancement_metrics is not None,
                "llm_code_generation": code_metrics is not None,
                "rift_persona_used": rift_persona_result is not None
            },
            "metrics": {
                "enhancement": enhancement_metrics,
                "code_generation": code_metrics
            },
            "rift_persona": test_suite.get("rift_persona") if rift_persona_result else None
        }
    except Exception as e:
        logger.error(f"Error generating API tests: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to generate API tests",
                "message": str(e),
                "type": type(e).__name__
            }
        )


def _detect_auth_type(api_spec: Dict[str, Any]) -> str:
    """Detect authentication type from API spec"""
    security_schemes = api_spec.get("components", {}).get("securitySchemes", {})
    if not security_schemes:
        return "none"
    
    for scheme_name, scheme_def in security_schemes.items():
        scheme_type = scheme_def.get("type", "").lower()
        if scheme_type == "http":
            return scheme_def.get("scheme", "bearer").upper()
        elif scheme_type == "oauth2":
            return "OAUTH2"
        elif scheme_type == "apikey":
            return "API_KEY"
        elif scheme_type == "openidconnect":
            return "OPENID_CONNECT"
    
    return "JWT"  # Default assumption


@router.post("/har")
async def import_har(body: dict):
    """
    Import HAR (HTTP Archive) into API test suite.
    Use from: desktop/extension network capture, HAR file upload, or recorded tab → API.
    Returns same shape as /spec: parsed_spec, test_suite, summary.
    """
    har_data = body.get("har") or body.get("har_content") or body.get("harContent")
    if not har_data:
        raise HTTPException(status_code=400, detail="Request body must include 'har' or 'har_content'")
    try:
        content_str = json.dumps(har_data) if isinstance(har_data, dict) else har_data
        parsed_spec = parser.parse(
            spec_content=content_str,
            spec_format="har",
            content_type="json"
        )
        test_suite = engine.generate_test_suite(
            api_spec=parsed_spec,
            spec_format="openapi"
        )
        return {
            "status": "success",
            "parsed_spec": parsed_spec,
            "test_suite": test_suite,
            "summary": {
                "format": "har",
                "total_endpoints": test_suite.get("total_endpoints", 0),
                "total_tests": test_suite.get("total_tests", 0),
            },
        }
    except Exception as e:
        logger.error(f"Error importing HAR: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to import HAR: {str(e)}")


class ExportPostmanRequest(BaseModel):
    """Export current suite or raw requests to Postman Collection v2.1"""
    test_suite: Optional[Dict[str, Any]] = None
    requests: Optional[List[Dict[str, Any]]] = None
    name: str = "QAAI API Collection"


class ExportOpenAPIRequest(BaseModel):
    """Export current suite or raw requests to OpenAPI 3.x skeleton"""
    test_suite: Optional[Dict[str, Any]] = None
    requests: Optional[List[Dict[str, Any]]] = None
    name: str = "QAAI API"
    version: str = "1.0.0"


class ExportHARRequest(BaseModel):
    """Export raw requests to HAR (e.g. from recorder)"""
    requests: List[Dict[str, Any]]
    creator_name: str = "QAAI"


@router.post("/export-postman")
async def export_postman(request: ExportPostmanRequest):
    """
    Export test suite or recorded requests to Postman Collection v2.1.
    Use from: API tab (current suite) or recorder (captured requests).
    """
    try:
        from app.services.engines.api_test_engine_enhancements import generate_postman_collection
        test_suite = request.test_suite
        if not test_suite and request.requests:
            base_url = ""
            test_cases = []
            for i, req in enumerate(request.requests):
                url_str = req.get("url", "")
                try:
                    from urllib.parse import urlparse, urlunparse
                    p = urlparse(url_str)
                    path = p.path or "/"
                    if not base_url:
                        base_url = urlunparse((p.scheme, p.netloc, "", "", "", ""))
                except Exception:
                    path = "/"
                test_cases.append({
                    "test_case_id": f"rec_{i}",
                    "title": f"{req.get('method', 'GET')} {path}",
                    "method": req.get("method", "GET"),
                    "path": path,
                    "request": {
                        "method": req.get("method", "GET"),
                        "url": url_str,
                        "headers": req.get("headers", {}),
                        "body": req.get("body"),
                    },
                    "expected_status": 200,
                })
            test_suite = {
                "base_url": base_url or "{{base_url}}",
                "test_cases": test_cases,
            }
        if not test_suite:
            raise HTTPException(status_code=400, detail="Provide 'test_suite' or 'requests'")
        collection_json = generate_postman_collection(test_suite)
        if request.name != "QAAI API Collection":
            coll = json.loads(collection_json)
            coll["info"]["name"] = request.name
            collection_json = json.dumps(coll, indent=2)
        return {
            "status": "success",
            "format": "postman",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "collection": json.loads(collection_json),
            "collection_json": collection_json,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting Postman: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-openapi")
async def export_openapi_skeleton(request: ExportOpenAPIRequest):
    """
    Export test suite or recorded requests to OpenAPI 3.x skeleton.
    """
    try:
        paths = {}
        base_url = "https://api.example.com"
        test_cases = []
        if request.test_suite:
            test_cases = request.test_suite.get("test_cases", [])
            base_url = request.test_suite.get("base_url", base_url)
        elif request.requests:
            for i, req in enumerate(request.requests):
                url_str = req.get("url", "")
                try:
                    from urllib.parse import urlparse, urlunparse
                    p = urlparse(url_str)
                    path = p.path or "/"
                except Exception:
                    path = "/"
                test_cases.append({
                    "method": req.get("method", "GET"),
                    "path": path,
                    "title": f"{req.get('method', 'GET')} {path}",
                })
        for tc in test_cases:
            path = tc.get("path", "/")
            method = (tc.get("method") or "GET").lower()
            if path not in paths:
                paths[path] = {}
            paths[path][method] = {
                "summary": tc.get("title", f"{method.upper()} {path}"),
                "operationId": (tc.get("operation_id") or path.replace("/", "_").strip("_") + "_" + method),
                "responses": {"200": {"description": "OK"}},
            }
        openapi = {
            "openapi": "3.0.0",
            "info": {"title": request.name, "version": request.version},
            "servers": [{"url": base_url}],
            "paths": paths,
        }
        return {
            "status": "success",
            "format": "openapi",
            "openapi": openapi,
            "openapi_json": json.dumps(openapi, indent=2),
        }
    except Exception as e:
        logger.error(f"Error exporting OpenAPI: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export-har")
async def export_har_from_requests(request: ExportHARRequest):
    """
    Export raw requests (e.g. from recorder) to HAR 1.2.
    Use from: Record tab after capture, or API tab when showing recorded requests.
    """
    try:
        import time
        from datetime import datetime
        entries = []
        for i, req in enumerate(request.requests):
            url_str = req.get("url", "")
            method = req.get("method", "GET")
            headers = req.get("headers", {})
            body = req.get("body", "")
            status = req.get("statusCode") or req.get("status") or 200
            duration = req.get("duration") or req.get("responseTime") or 0
            if isinstance(headers, list):
                headers = {h.get("name", ""): h.get("value", "") for h in headers if isinstance(h, dict)}
            req_headers = [{"name": k, "value": str(v)} for k, v in headers.items()]
            ts = req.get("timestamp")
            if ts is None:
                ts = time.time()
            started = datetime.utcfromtimestamp(ts).isoformat() + "Z" if isinstance(ts, (int, float)) else str(ts)
            entries.append({
                "startedDateTime": started,
                "time": duration,
                "request": {
                    "method": method,
                    "url": url_str,
                    "httpVersion": "HTTP/1.1",
                    "headers": req_headers,
                    "postData": {"mimeType": "application/json", "text": (body if isinstance(body, str) else json.dumps(body or {}))} if body else None,
                },
                "response": {
                    "status": status,
                    "statusText": "",
                    "httpVersion": "HTTP/1.1",
                    "headers": [],
                    "content": {"size": 0, "mimeType": ""},
                },
                "timings": {"send": 0, "wait": duration, "receive": 0},
            })
        har = {
            "log": {
                "version": "1.2",
                "creator": {"name": request.creator_name, "version": "1.0.0"},
                "entries": entries,
            }
        }
        return {
            "status": "success",
            "format": "har",
            "har": har,
            "har_json": json.dumps(har, indent=2),
        }
    except Exception as e:
        logger.error(f"Error exporting HAR: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/formats")
async def get_supported_formats():
    """Get list of supported API specification formats"""
    return {
        "supported_formats": parser.supported_formats,
        "supported_frameworks": ["playwright", "pytest", "postman", "rest_assured", "k6"],
        "file_extensions": {
            "openapi": [".json", ".yaml", ".yml"],
            "swagger": [".json", ".yaml", ".yml"],
            "wsdl": [".wsdl", ".xml"],
            "postman": [".json"],
            "graphql": [".graphql", ".gql", ".json"],
            "har": [".har", ".json"]
        },
        "export_formats": ["postman", "openapi", "har"],
    }

