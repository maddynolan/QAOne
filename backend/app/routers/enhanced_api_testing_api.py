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
    return {
        "status": "success",
        "capabilities": {
            "protocols": enhanced_engine.supported_protocols,
            "formats": enhanced_engine.supported_formats,
            "databases": db_connector.supported_databases,
            "execution_modes": execution_engine.execution_modes,
            "features": [
                "Multi-protocol support (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket)",
                "Database connectivity and assertions",
                "Data-driven testing",
                "Service virtualization/mocking",
                "Load and performance testing",
                "Comprehensive reporting and analytics",
                "CI/CD integration",
                "Multiple execution modes",
                "Security testing (OWASP API Top 10)",
                "Contract testing",
                "Integration testing",
                "Trend analysis",
                "Environment management",
                "Variable resolution"
            ]
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

