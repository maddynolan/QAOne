"""
Enhanced API Testing Router
Enterprise-grade API testing endpoints with multi-protocol support
Comparable to ReadyAPI and other top-tier tools
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
import json

from app.services.api_testing import (
    EnhancedAPITestEngine,
    get_database_connector,
    get_test_execution_engine,
    get_service_virtualization,
    get_reporting_engine
)
from app.services.api_testing.environment_manager import get_environment_manager
from app.services.api_testing.openapi_validator import get_openapi_validator, get_schema_inference_engine
from app.services.api_testing.data_driven_engine import get_data_driven_engine
from app.services.connectors.api_spec_parser import APISpecParser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v2/testing", tags=["enhanced-api-testing"])

# Initialize services
enhanced_engine = EnhancedAPITestEngine()
parser = APISpecParser()
db_connector = get_database_connector()
execution_engine = get_test_execution_engine()
virtualization = get_service_virtualization()
reporting = get_reporting_engine()
environment_manager = get_environment_manager()
openapi_validator = get_openapi_validator()
schema_inference = get_schema_inference_engine()
data_driven_engine = get_data_driven_engine()


# Request Models
class EnhancedTestSuiteRequest(BaseModel):
    """Request for enhanced test suite generation"""
    api_spec: Dict[str, Any]
    spec_format: str = "openapi"
    protocol: str = "REST"  # REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket
    test_options: Optional[Dict[str, Any]] = None


class DatabaseConnectionRequest(BaseModel):
    """Request for database connection"""
    connection_id: str
    db_type: str  # postgresql, mysql, sqlite, mongodb, mssql
    connection_config: Dict[str, Any]


class TestExecutionRequest(BaseModel):
    """Request for test execution"""
    test_suite: Dict[str, Any]
    execution_config: Dict[str, Any]
    mode: str = "automated"  # manual, automated, scheduled, ci_cd, load


class VirtualServiceRequest(BaseModel):
    """Request for virtual service creation"""
    service_config: Dict[str, Any]


class LoadTestRequest(BaseModel):
    """Request for load testing"""
    test_suite: Dict[str, Any]
    load_config: Dict[str, Any]  # virtual_users, duration_seconds, ramp_up_seconds


class EnvironmentRequest(BaseModel):
    """Request for environment creation"""
    environment_config: Dict[str, Any]


class OpenAPIValidateRequest(BaseModel):
    """Request for OpenAPI spec validation"""
    spec: Dict[str, Any]
    apply_auto_fixes: bool = False


class DataSourceRequest(BaseModel):
    """Request for data-driven data source"""
    name: str
    source_type: str  # csv, json, excel, inline
    content: Optional[str] = None  # For CSV/JSON text
    data_path: Optional[str] = None  # For JSON: path to array, e.g. "data.items"
    rows: Optional[List[Dict[str, Any]]] = None  # For inline


class DataDrivenExecuteRequest(BaseModel):
    """Request for data-driven test execution"""
    test_suite: Dict[str, Any]
    source_id: str
    execution_config: Optional[Dict[str, Any]] = None


class SchemaInferRequest(BaseModel):
    """Request for schema inference from response"""
    response_data: Any


# Endpoints

@router.post("/test-suite/generate")
async def generate_enhanced_test_suite(request: EnhancedTestSuiteRequest):
    """
    Generate comprehensive test suite with multi-protocol support
    
    Supports:
    - REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket
    - Functional, Security, Performance, Integration, Contract tests
    - Data-driven testing
    """
    try:
        test_suite = enhanced_engine.generate_comprehensive_test_suite(
            api_spec=request.api_spec,
            spec_format=request.spec_format,
            test_options={
                "protocol": request.protocol,
                **(request.test_options or {})
            }
        )
        
        return {
            "status": "success",
            "test_suite": test_suite,
            "summary": {
                "protocol": request.protocol,
                "total_test_cases": test_suite.get("metadata", {}).get("total_test_cases", 0),
                "coverage": test_suite.get("metadata", {}).get("coverage", {})
            }
        }
    except Exception as e:
        logger.error(f"Error generating enhanced test suite: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/openapi/validate")
async def validate_openapi_spec(request: OpenAPIValidateRequest):
    """
    Validate OpenAPI spec and report issues. Handles incomplete specs gracefully.
    Returns errors, warnings, info, and optional auto-fixes.
    """
    try:
        result = openapi_validator.validate(request.spec)
        if request.apply_auto_fixes and result.get("auto_fixes_available", 0) > 0:
            fixed_spec, applied_list = openapi_validator.apply_auto_fixes(request.spec)
            result["fixed_spec"] = fixed_spec
            result["applied_fixes"] = applied_list
        return result
    except Exception as e:
        logger.error(f"OpenAPI validation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/openapi/infer-schema")
async def infer_schema_from_response(request: SchemaInferRequest):
    """
    Infer JSON schema from actual API response. Use when OpenAPI spec is incomplete.
    """
    try:
        schema = schema_inference.infer_schema(request.response_data)
        return {"status": "success", "schema": schema}
    except Exception as e:
        logger.error(f"Schema inference error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-driven/source")
async def create_data_source(request: DataSourceRequest):
    """
    Create a data source for data-driven testing (CSV, JSON, Excel, or inline).
    Comparable to Postman/ReadyAPI data sources.
    """
    try:
        if request.source_type == "csv" and request.content:
            source_id = data_driven_engine.create_csv_source(request.name, request.content)
        elif request.source_type == "json" and request.content:
            source_id = data_driven_engine.create_json_source(
                request.name, request.content, data_path=request.data_path
            )
        elif request.source_type == "inline" and request.rows:
            source_id = data_driven_engine.create_inline_source(request.name, request.rows)
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide content for csv/json or rows for inline"
            )
        preview = data_driven_engine.get_data_source_preview(source_id)
        return {"status": "success", "source_id": source_id, "preview": preview}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Data source creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-driven/source/{source_id}/preview")
async def get_data_source_preview(source_id: str, max_rows: int = 10):
    """Get preview of a data source."""
    try:
        preview = data_driven_engine.get_data_source_preview(source_id, max_rows=max_rows)
        if "error" in preview:
            raise HTTPException(status_code=404, detail=preview["error"])
        return preview
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Data source preview error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-driven/execute")
async def execute_data_driven_tests(request: DataDrivenExecuteRequest):
    """
    Execute test suite with data-driven iterations (CSV/JSON rows).
    Variables in test suite are substituted per row.
    """
    try:
        import asyncio
        results = await data_driven_engine.execute_data_driven_tests(
            request.test_suite,
            request.source_id,
            request.execution_config or {}
        )
        return results
    except Exception as e:
        logger.error(f"Data-driven execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/database/connect")
async def connect_database(request: DatabaseConnectionRequest):
    """
    Connect to a database for data-driven testing and assertions
    
    Supports:
    - PostgreSQL, MySQL, SQLite, MongoDB, MSSQL, Oracle, Redis, Cassandra
    """
    try:
        success = await db_connector.connect(
            connection_id=request.connection_id,
            db_type=request.db_type,
            connection_config=request.connection_config
        )
        
        if success:
            return {
                "status": "connected",
                "connection_id": request.connection_id,
                "db_type": request.db_type
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to connect to database")
    except Exception as e:
        logger.error(f"Database connection error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/database/query")
async def execute_database_query(
    connection_id: str,
    query: str,
    parameters: Optional[Dict[str, Any]] = None
):
    """Execute a database query"""
    try:
        results = await db_connector.execute_query(
            connection_id=connection_id,
            query=query,
            parameters=parameters or {}
        )
        
        return {
            "status": "success",
            "results": results,
            "row_count": len(results)
        }
    except Exception as e:
        logger.error(f"Database query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/database/assert")
async def assert_database_state(
    connection_id: str,
    assertion: Dict[str, Any]
):
    """Assert database state after API call"""
    try:
        result = await db_connector.assert_database_state(
            connection_id=connection_id,
            assertion=assertion
        )
        
        return result
    except Exception as e:
        logger.error(f"Database assertion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/database/connections")
async def list_database_connections():
    """List all active database connections"""
    connections = db_connector.list_connections()
    return {
        "status": "success",
        "connections": connections
    }


@router.post("/execute")
async def execute_tests(request: TestExecutionRequest):
    """
    Execute test suite in various modes
    
    Modes:
    - manual: Step-by-step manual execution
    - automated: Full automated execution
    - scheduled: Scheduled execution (requires external scheduler)
    - ci_cd: CI/CD optimized execution (fast, fail-fast)
    - load: Load/performance testing
    """
    try:
        results = await execution_engine.execute_test_suite(
            test_suite=request.test_suite,
            execution_config=request.execution_config,
            mode=request.mode
        )
        
        return {
            "status": "success",
            "execution_results": results
        }
    except Exception as e:
        logger.error(f"Test execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/load")
async def execute_load_test(request: LoadTestRequest):
    """Execute load/performance test"""
    try:
        execution_config = {
            "base_url": request.test_suite.get("base_url", ""),
            "load_config": request.load_config,
            "parallel": True
        }
        
        results = await execution_engine.execute_test_suite(
            test_suite=request.test_suite,
            execution_config=execution_config,
            mode="load"
        )
        
        return {
            "status": "success",
            "load_test_results": results
        }
    except Exception as e:
        logger.error(f"Load test error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/virtual-service/create")
async def create_virtual_service(request: VirtualServiceRequest):
    """
    Create a virtual service (mock API) for testing
    
    Supports:
    - Response templates
    - Dynamic responses
    - Scenario simulation
    - Response delays
    """
    try:
        virtual_service = virtualization.create_virtual_service(
            service_config=request.service_config
        )
        
        return {
            "status": "success",
            "virtual_service": virtual_service
        }
    except Exception as e:
        logger.error(f"Virtual service creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/virtual-service/{service_id}/scenario")
async def add_virtual_service_scenario(
    service_id: str,
    scenario_config: Dict[str, Any]
):
    """Add a scenario to a virtual service"""
    try:
        scenario = virtualization.add_scenario(
            service_id=service_id,
            scenario_config=scenario_config
        )
        
        return {
            "status": "success",
            "scenario": scenario
        }
    except Exception as e:
        logger.error(f"Scenario creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/virtual-service")
async def list_virtual_services():
    """List all virtual services"""
    services = virtualization.list_virtual_services()
    return {
        "status": "success",
        "virtual_services": services
    }


@router.delete("/virtual-service/{service_id}")
async def delete_virtual_service(service_id: str):
    """Delete a virtual service"""
    success = virtualization.delete_virtual_service(service_id)
    if success:
        return {"status": "success", "message": f"Virtual service {service_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail="Virtual service not found")


@router.post("/report/generate")
async def generate_report(execution_results: Dict[str, Any]):
    """Generate comprehensive test execution report"""
    try:
        report = reporting.generate_execution_report(execution_results)
        
        return {
            "status": "success",
            "report": report
        }
    except Exception as e:
        logger.error(f"Report generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report/{report_id}")
async def get_report(report_id: str, format: str = "json"):
    """Get report in various formats (json, html, csv)"""
    try:
        report_content = reporting.export_report(report_id, format)
        
        if format == "json":
            return json.loads(report_content)
        elif format == "html":
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content=report_content)
        elif format == "csv":
            from fastapi.responses import Response
            return Response(content=report_content, media_type="text/csv")
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
    except Exception as e:
        logger.error(f"Report retrieval error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/report/trends")
async def generate_trend_report(
    execution_results_list: List[Dict[str, Any]],
    days: int = 30
):
    """Generate trend report across multiple executions"""
    try:
        trend_report = reporting.generate_trend_report(execution_results_list, days)
        
        return {
            "status": "success",
            "trend_report": trend_report
        }
    except Exception as e:
        logger.error(f"Trend report generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/protocols")
async def get_supported_protocols():
    """Get list of supported protocols"""
    return {
        "status": "success",
        "protocols": enhanced_engine.supported_protocols,
        "formats": enhanced_engine.supported_formats
    }


@router.post("/environment/create")
async def create_environment(request: EnvironmentRequest):
    """Create a test environment (dev, staging, prod)"""
    try:
        environment = environment_manager.create_environment(request.environment_config)
        return {
            "status": "success",
            "environment": environment
        }
    except Exception as e:
        logger.error(f"Environment creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/environment")
async def list_environments():
    """List all test environments"""
    environments = environment_manager.list_environments()
    return {
        "status": "success",
        "environments": environments
    }


@router.get("/environment/{environment_id}")
async def get_environment(environment_id: str):
    """Get environment configuration"""
    try:
        environment = environment_manager.get_environment(environment_id)
        return {
            "status": "success",
            "environment": environment
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/environment/{environment_id}")
async def update_environment(
    environment_id: str,
    updates: Dict[str, Any]
):
    """Update environment configuration"""
    try:
        environment = environment_manager.update_environment(environment_id, updates)
        return {
            "status": "success",
            "environment": environment
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/environment/{environment_id}")
async def delete_environment(environment_id: str):
    """Delete an environment"""
    success = environment_manager.delete_environment(environment_id)
    if success:
        return {"status": "success", "message": f"Environment {environment_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail="Environment not found")


@router.post("/environment/{environment_id}/resolve")
async def resolve_environment_variables(
    environment_id: str,
    template: str
):
    """Resolve variables in a template string"""
    try:
        resolved = environment_manager.resolve_variables(environment_id, template)
        return {
            "status": "success",
            "template": template,
            "resolved": resolved
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/capabilities")
async def get_capabilities():
    """Get comprehensive capabilities of the API testing tool"""
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    gen = get_test_data_generator()
    
    return {
        "status": "success",
        "capabilities": {
            "protocols": enhanced_engine.supported_protocols,
            "formats": enhanced_engine.supported_formats,
            "databases": db_connector.supported_databases,
            "execution_modes": execution_engine.execution_modes,
            "datagen_types": gen.list_types(),
            "features": [
                "Multi-protocol support (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket)",
                "Database connectivity and assertions",
                "Data-driven testing (CSV, JSON, Excel, Database)",
                "Test data generation (DataGen) - 50+ data types",
                "Mock server (real HTTP server) with dynamic responses",
                "Service virtualization with scenarios and sequences",
                "Load and performance testing",
                "Comprehensive reporting and analytics",
                "CI/CD integration with exit codes",
                "Multiple execution modes (manual, automated, scheduled, ci_cd, load)",
                "Security testing (OWASP API Top 10)",
                "Contract testing",
                "Integration testing",
                "OpenAPI validation with auto-fixes",
                "Schema inference from responses",
                "Request chaining with property transfer",
                "OAuth2 authentication (all grant types, PKCE)",
                "Environment management with variable resolution",
                "Trend analysis and recommendations"
            ],
            "comparison_to_postman": {
                "data_driven_testing": "Yes - CSV, JSON, Excel, Inline, Database",
                "mock_servers": "Yes - Real HTTP mock servers with request verification",
                "test_data_generation": "Yes - 50+ data types (DataGen equivalent)",
                "collection_runner": "Yes - Via test execution engine",
                "environments": "Yes - Full environment management",
                "oauth2": "Yes - All grant types including PKCE",
                "assertions": "Yes - JSONPath, XPath, regex, schema, status, headers",
                "ci_cd_integration": "Yes - With exit codes and fail-fast mode"
            },
            "comparison_to_readyapi": {
                "soap_wsdl": "Yes - Full WSDL parsing and test generation",
                "service_virtualization": "Yes - Mock servers with scenarios",
                "data_driven": "Yes - Multiple data sources",
                "datagen": "Yes - Comprehensive test data generation",
                "security_testing": "Yes - OWASP API Top 10",
                "groovy_scripts": "Partial - Basic script support",
                "database_assertions": "Yes - PostgreSQL, MySQL, MongoDB, etc."
            }
        }
    }


class SecurityScanRequest(BaseModel):
    """Request for security scan"""
    target_url: str
    tests: List[str] = ["auth_matrix", "bola", "injection", "rate_limiting"]
    api_spec: Optional[Dict[str, Any]] = None


@router.post("/security/scan")
async def run_security_scan(request: SecurityScanRequest):
    """
    Run OWASP API Security scan against target URL.
    
    Scan types:
    - auth_matrix: Test 401/403 responses for no auth, wrong role, expired token
    - bola: Broken Object Level Authorization (API1:2023)
    - injection: SQL, NoSQL, Command injection testing
    - rate_limiting: Test for 429 rate limiting
    - ssrf: Server-Side Request Forgery (API7:2023)
    - mass_assignment: Test for extra properties accepted
    """
    from app.services.api_testing.owasp_api_security import get_owasp_scanner
    
    try:
        scanner = get_owasp_scanner()
        
        # Extract endpoints from API spec if provided
        endpoints = []
        if request.api_spec:
            paths = request.api_spec.get("paths", {})
            base_url = request.target_url.rstrip("/")
            
            for path, methods in paths.items():
                for method in methods:
                    if method.upper() in ["GET", "POST", "PUT", "PATCH", "DELETE"]:
                        endpoints.append({
                            "path": path,
                            "method": method.upper(),
                            "url": f"{base_url}{path}"
                        })
        
        # Map test names to scan types
        scan_type_map = {
            "auth_matrix": ["authentication", "authorization"],
            "bola": ["bola"],
            "injection": ["injection"],
            "rate_limiting": ["resource_consumption"],
            "ssrf": ["ssrf"],
            "mass_assignment": ["property_authorization"],
        }
        
        scan_types = []
        for test in request.tests:
            if test in scan_type_map:
                scan_types.extend(scan_type_map[test])
        
        # Run scan
        result = await scanner.scan(
            base_url=request.target_url,
            endpoints=endpoints,
            scan_types=scan_types if scan_types else None
        )
        
        # Convert findings to dict
        findings = []
        for finding in result.findings:
            findings.append({
                "id": finding.id,
                "title": finding.title,
                "category": finding.category.value if hasattr(finding.category, 'value') else str(finding.category),
                "severity": finding.severity.value if hasattr(finding.severity, 'value') else str(finding.severity),
                "description": finding.description,
                "evidence": finding.evidence,
                "remediation": finding.remediation,
                "endpoint": finding.endpoint,
                "method": finding.method,
                "cwe_id": finding.cwe_id
            })
        
        return {
            "status": "success",
            "scan_id": result.scan_id,
            "target_url": result.target_url,
            "duration_ms": result.duration_ms,
            "total_tests": result.total_tests,
            "findings": findings,
            "summary": result.summary
        }
        
    except Exception as e:
        logger.error(f"Security scan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ===================== Test Data Generator Endpoints =====================

class DataGenRequest(BaseModel):
    """Request for data generation"""
    data_type: str
    count: int = 1
    options: Optional[Dict[str, Any]] = None
    ensure_unique: bool = True  # For large batches


class DataGenObjectRequest(BaseModel):
    """Request for object generation from schema"""
    schema: Dict[str, Any]
    count: int = 1


class DataGenBatchRequest(BaseModel):
    """Request for large batch generation (10,000+)"""
    data_type: str
    count: int
    ensure_unique: bool = True
    options: Optional[Dict[str, Any]] = None


@router.get("/datagen/types")
async def get_datagen_types():
    """Get all available data generation types (DataGen equivalent)"""
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    gen = get_test_data_generator()
    return {
        "status": "success",
        "types": gen.list_types(),
        "categories": {
            "names": ["firstName", "lastName", "fullName", "maleFirstName", "femaleFirstName", "username"],
            "contact": ["email", "phone", "phoneInternational"],
            "address": ["streetAddress", "city", "state", "stateAbbr", "zipCode", "country", "fullAddress"],
            "numbers": ["integer", "float", "decimal"],
            "identifiers": ["uuid", "guid", "objectId"],
            "dates": ["date", "datetime", "timestamp", "isoDate", "pastDate", "futureDate"],
            "financial": ["creditCard", "creditCardExpiry", "cvv", "price", "currency"],
            "boolean": ["boolean", "yesNo", "truefalse"],
            "text": ["word", "sentence", "paragraph", "lorem"],
            "strings": ["alphanumeric", "alpha", "numeric", "hex", "base64"],
            "patterns": ["pattern", "regex"],
            "collections": ["randomElement", "sequential", "weighted"],
            "company": ["companyName", "jobTitle"],
            "internet": ["url", "domain", "ipv4", "ipv6", "macAddress", "userAgent"],
            "colors": ["hexColor", "rgbColor"]
        }
    }


@router.post("/datagen/generate")
async def generate_test_data(request: DataGenRequest):
    """
    Generate random test data (like ReadyAPI DataGen or Postman dynamic variables)
    
    Example types: email, fullName, uuid, integer, phone, creditCard, isoDate, etc.
    """
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    try:
        gen = get_test_data_generator()
        options = request.options or {}
        
        if request.count == 1:
            value = gen.generate(request.data_type, **options)
        else:
            value = gen.generate_batch(request.data_type, request.count, **options)
        
        return {
            "status": "success",
            "data_type": request.data_type,
            "count": request.count,
            "value": value
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Data generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/datagen/object")
async def generate_test_object(request: DataGenObjectRequest):
    """
    Generate test objects from schema definition
    
    Schema example:
    {
        "name": {"type": "fullName"},
        "email": {"type": "email"},
        "age": {"type": "integer", "min": 18, "max": 65}
    }
    """
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    try:
        gen = get_test_data_generator()
        
        if request.count == 1:
            value = gen.generate_object(request.schema)
        else:
            value = [gen.generate_object(request.schema) for _ in range(request.count)]
        
        return {
            "status": "success",
            "count": request.count,
            "objects": value
        }
    except Exception as e:
        logger.error(f"Object generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/datagen/batch")
async def generate_large_batch(request: DataGenBatchRequest):
    """
    Generate large batches of test data (10,000+ records).
    Optimized for bulk data generation with optional uniqueness guarantee.
    
    Requires Faker library for best results: pip install faker
    """
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    try:
        gen = get_test_data_generator()
        options = request.options or {}
        
        values = gen.generate_large_batch(
            request.data_type,
            request.count,
            ensure_unique=request.ensure_unique,
            **options
        )
        
        stats = gen.get_stats()
        
        return {
            "status": "success",
            "data_type": request.data_type,
            "count": len(values),
            "unique_count": len(set(str(v) for v in values)),
            "values": values,
            "faker_enabled": stats.get("faker_enabled", False)
        }
    except Exception as e:
        logger.error(f"Batch generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/datagen/stats")
async def get_datagen_stats():
    """Get data generation statistics and capabilities"""
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    gen = get_test_data_generator()
    return {
        "status": "success",
        "stats": gen.get_stats()
    }


@router.post("/datagen/reset-tracking")
async def reset_datagen_tracking(data_type: str = None):
    """Reset uniqueness tracking (allows duplicates to be generated again)"""
    from app.services.api_testing.test_data_generator import get_test_data_generator
    
    gen = get_test_data_generator()
    gen.reset_uniqueness_tracking(data_type)
    
    return {
        "status": "success",
        "message": f"Tracking reset for: {data_type or 'all types'}"
    }


# ===================== Mock Server Endpoints =====================

class MockServerCreateRequest(BaseModel):
    """Request to create a mock server"""
    name: str
    port: int = 0  # 0 = auto-assign
    host: str = "127.0.0.1"


class MockEndpointRequest(BaseModel):
    """Request to add a mock endpoint"""
    endpoint_id: str
    path: str
    method: str
    response_body: Any
    response_status: int = 200
    response_headers: Optional[Dict[str, str]] = None
    response_delay_ms: int = 0
    dynamic: bool = False
    scenarios: Optional[List[Dict[str, Any]]] = None
    sequence_responses: Optional[List[Dict[str, Any]]] = None


@router.post("/mock/server")
async def create_mock_server(request: MockServerCreateRequest):
    """
    Create a new mock server (actual HTTP server)
    Unlike basic service virtualization, this starts a real HTTP server.
    """
    from app.services.api_testing.mock_server import get_mock_server
    
    try:
        mock = get_mock_server()
        server_id = mock.create_server(
            name=request.name,
            port=request.port,
            host=request.host
        )
        server_info = mock.get_server_info(server_id)
        
        return {
            "status": "success",
            "server_id": server_id,
            "server": server_info
        }
    except Exception as e:
        logger.error(f"Mock server creation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mock/server/{server_id}/start")
async def start_mock_server(server_id: str):
    """Start a mock server (begins listening for requests)"""
    from app.services.api_testing.mock_server import get_mock_server
    
    try:
        mock = get_mock_server()
        base_url = mock.start(server_id)
        
        return {
            "status": "success",
            "message": f"Mock server started",
            "base_url": base_url
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Mock server start error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mock/server/{server_id}/stop")
async def stop_mock_server(server_id: str):
    """Stop a running mock server"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    success = mock.stop(server_id)
    
    if success:
        return {"status": "success", "message": "Mock server stopped"}
    else:
        raise HTTPException(status_code=404, detail="Server not found")


@router.delete("/mock/server/{server_id}")
async def delete_mock_server(server_id: str):
    """Delete a mock server"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    success = mock.delete_server(server_id)
    
    if success:
        return {"status": "success", "message": "Mock server deleted"}
    else:
        raise HTTPException(status_code=404, detail="Server not found")


@router.get("/mock/server")
async def list_mock_servers():
    """List all mock servers"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    servers = mock.list_servers()
    
    return {
        "status": "success",
        "servers": servers
    }


@router.get("/mock/server/{server_id}")
async def get_mock_server_info(server_id: str):
    """Get mock server information"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    info = mock.get_server_info(server_id)
    
    if info:
        return {
            "status": "success",
            "server": info,
            "endpoints": list(mock.endpoints.get(server_id, {}).keys())
        }
    else:
        raise HTTPException(status_code=404, detail="Server not found")


@router.post("/mock/server/{server_id}/endpoint")
async def add_mock_endpoint(server_id: str, request: MockEndpointRequest):
    """Add an endpoint to a mock server"""
    from app.services.api_testing.mock_server import get_mock_server, MockEndpoint
    
    try:
        mock = get_mock_server()
        
        endpoint = MockEndpoint(
            endpoint_id=request.endpoint_id,
            path=request.path,
            method=request.method.upper(),
            response_body=request.response_body,
            response_status=request.response_status,
            response_headers=request.response_headers or {"Content-Type": "application/json"},
            response_delay_ms=request.response_delay_ms,
            dynamic=request.dynamic,
            scenarios=request.scenarios or [],
            sequence_responses=request.sequence_responses or []
        )
        
        endpoint_id = mock.add_endpoint(server_id, endpoint)
        
        return {
            "status": "success",
            "endpoint_id": endpoint_id
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Add endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mock/server/{server_id}/from-openapi")
async def create_mock_from_openapi(server_id: str, openapi_spec: Dict[str, Any]):
    """Generate mock endpoints from OpenAPI specification"""
    from app.services.api_testing.mock_server import get_mock_server
    
    try:
        mock = get_mock_server()
        endpoint_ids = mock.add_endpoints_from_openapi(server_id, openapi_spec)
        
        return {
            "status": "success",
            "endpoints_created": len(endpoint_ids),
            "endpoint_ids": endpoint_ids
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"OpenAPI mock generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/mock/server/{server_id}/endpoint/{endpoint_id}")
async def remove_mock_endpoint(server_id: str, endpoint_id: str):
    """Remove an endpoint from a mock server"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    success = mock.remove_endpoint(server_id, endpoint_id)
    
    if success:
        return {"status": "success", "message": "Endpoint removed"}
    else:
        raise HTTPException(status_code=404, detail="Endpoint not found")


@router.get("/mock/server/{server_id}/logs")
async def get_mock_request_logs(
    server_id: str,
    limit: int = 100,
    method: str = None,
    path: str = None
):
    """Get request logs from mock server"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    logs = mock.get_request_logs(server_id, limit=limit, method=method, path=path)
    
    return {
        "status": "success",
        "logs": logs,
        "count": len(logs)
    }


@router.post("/mock/server/{server_id}/verify")
async def verify_mock_requests(
    server_id: str,
    method: str,
    path: str,
    expected_count: int = None,
    body_contains: str = None
):
    """
    Verify requests were made to mock server.
    Useful for testing that your code made expected API calls.
    """
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    result = mock.verify_requests(
        server_id,
        method=method,
        path=path,
        expected_count=expected_count,
        body_contains=body_contains
    )
    
    return {
        "status": "success",
        **result
    }


@router.delete("/mock/server/{server_id}/logs")
async def clear_mock_logs(server_id: str):
    """Clear request logs for a mock server"""
    from app.services.api_testing.mock_server import get_mock_server
    
    mock = get_mock_server()
    success = mock.clear_request_logs(server_id)
    
    if success:
        return {"status": "success", "message": "Logs cleared"}
    else:
        raise HTTPException(status_code=404, detail="Server not found")
