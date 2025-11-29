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
        
        # Determine content type from file extension
        filename = file.filename.lower()
        if filename.endswith(('.yaml', '.yml')):
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
        
        # Generate test suite
        test_suite = engine.generate_test_suite(
            api_spec=parsed_spec,
            spec_format=parsed_spec.get("format", spec_format)
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
    Generate executable test scripts from parsed API specification with OpenAI enhancement.
    
    Frameworks supported:
    - playwright: Playwright API tests (TypeScript/JavaScript)
    - pytest: pytest with requests (Python)
    - postman: Postman collection
    - rest_assured: REST Assured (Java)
    - k6: k6 performance tests (JavaScript)
    
    Uses OpenAI (gpt-4o-mini) to enhance test cases and generate high-quality automation code.
    Falls back to deterministic engine if OpenAI is unavailable.
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
        
        # Step 2: Enhance test cases with OpenAI (if available)
        enhancement_metrics = None
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
                logger.info(f"Enhanced test cases: {enhancement_metrics}")
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
                "llm_code_generation": code_metrics is not None
            },
            "metrics": {
                "enhancement": enhancement_metrics,
                "code_generation": code_metrics
            }
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
            "graphql": [".graphql", ".gql", ".json"]
        }
    }

