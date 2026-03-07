"""
OWASP API Security Testing Router
==================================
API endpoints for running OWASP API Security Top 10 scans.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

from app.services.api_testing.owasp_api_security import (
    get_owasp_scanner,
    OWASPCategory,
    Severity
)

router = APIRouter(prefix="/api/security", tags=["OWASP API Security"])


class EndpointDefinition(BaseModel):
    path: str
    method: str = "GET"
    parameters: Dict[str, str] = {}


class SecurityScanRequest(BaseModel):
    target_url: str
    endpoints: List[EndpointDefinition] = []
    auth_token: Optional[str] = None
    scan_types: Optional[List[str]] = None  # None = all scans


class QuickScanRequest(BaseModel):
    target_url: str
    auth_token: Optional[str] = None


@router.post("/scan")
async def run_security_scan(request: SecurityScanRequest):
    """
    Run an OWASP API Security Top 10 scan.
    
    Scan types available:
    - bola: Broken Object Level Authorization
    - broken_auth: Broken Authentication
    - bopla: Broken Object Property Level Authorization
    - resource_consumption: Unrestricted Resource Consumption
    - bfla: Broken Function Level Authorization
    - ssrf: Server-Side Request Forgery
    - misconfig: Security Misconfiguration
    - inventory: Improper Inventory Management
    
    Example:
    ```json
    {
        "target_url": "https://api.example.com",
        "endpoints": [
            {"path": "/api/users", "method": "GET"},
            {"path": "/api/users/{id}", "method": "GET"},
            {"path": "/api/auth/login", "method": "POST"}
        ],
        "auth_token": "your-jwt-token",
        "scan_types": ["bola", "broken_auth", "misconfig"]
    }
    ```
    """
    scanner = get_owasp_scanner()
    
    try:
        endpoints = [{"path": e.path, "method": e.method} for e in request.endpoints]
        
        result = await scanner.scan(
            target_url=request.target_url,
            endpoints=endpoints if endpoints else None,
            auth_token=request.auth_token,
            scan_types=request.scan_types
        )
        
        return {
            "status": "success",
            "scan_id": result.scan_id,
            "target_url": result.target_url,
            "duration_ms": result.duration_ms,
            "total_tests": result.total_tests,
            "summary": result.summary,
            "findings": [
                {
                    "id": f.id,
                    "title": f.title,
                    "category": f.category.value,
                    "severity": f.severity.value,
                    "description": f.description,
                    "evidence": f.evidence,
                    "remediation": f.remediation,
                    "endpoint": f.endpoint,
                    "method": f.method,
                    "cwe_id": f.cwe_id
                }
                for f in result.findings
            ],
            "start_time": result.start_time,
            "end_time": result.end_time
        }
        
    except Exception as e:
        logger.error(f"OWASP scan failed: {e}")
        raise HTTPException(status_code=500, detail="Scan failed")


@router.post("/quick-scan")
async def run_quick_scan(request: QuickScanRequest):
    """
    Run a quick security scan with auto-discovered endpoints.
    Useful for a fast security assessment.
    """
    scanner = get_owasp_scanner()
    
    try:
        result = await scanner.scan(
            target_url=request.target_url,
            auth_token=request.auth_token,
            scan_types=["misconfig", "inventory", "broken_auth"]
        )
        
        return {
            "status": "success",
            "scan_id": result.scan_id,
            "summary": result.summary,
            "critical_findings": [
                {
                    "id": f.id,
                    "title": f.title,
                    "severity": f.severity.value,
                    "remediation": f.remediation
                }
                for f in result.findings
                if f.severity in [Severity.CRITICAL, Severity.HIGH]
            ],
            "duration_ms": result.duration_ms
        }
        
    except Exception as e:
        logger.error(f"OWASP quick scan failed: {e}")
        raise HTTPException(status_code=500, detail="Quick scan failed")


@router.get("/categories")
async def get_owasp_categories():
    """Get all OWASP API Security Top 10 categories"""
    return {
        "status": "success",
        "categories": [
            {
                "id": "API1",
                "name": "Broken Object Level Authorization (BOLA)",
                "description": "APIs tend to expose endpoints that handle object identifiers, creating a wide attack surface Level Access Control issue.",
                "scan_type": "bola"
            },
            {
                "id": "API2",
                "name": "Broken Authentication",
                "description": "Authentication mechanisms are often implemented incorrectly, allowing attackers to compromise authentication tokens.",
                "scan_type": "broken_auth"
            },
            {
                "id": "API3",
                "name": "Broken Object Property Level Authorization",
                "description": "This category combines API3:2019 Excessive Data Exposure and API6:2019 Mass Assignment.",
                "scan_type": "bopla"
            },
            {
                "id": "API4",
                "name": "Unrestricted Resource Consumption",
                "description": "Satisfying API requests requires resources such as network bandwidth, CPU, memory, and storage.",
                "scan_type": "resource_consumption"
            },
            {
                "id": "API5",
                "name": "Broken Function Level Authorization",
                "description": "Complex access control policies with different hierarchies, groups, and roles.",
                "scan_type": "bfla"
            },
            {
                "id": "API6",
                "name": "Unrestricted Access to Sensitive Business Flows",
                "description": "APIs vulnerable to this risk expose a business flow without compensating for the damage it can cause.",
                "scan_type": "business_flow"
            },
            {
                "id": "API7",
                "name": "Server Side Request Forgery (SSRF)",
                "description": "SSRF flaws can occur when an API is fetching a remote resource without validating the user-supplied URI.",
                "scan_type": "ssrf"
            },
            {
                "id": "API8",
                "name": "Security Misconfiguration",
                "description": "APIs and the systems supporting them typically contain complex configurations.",
                "scan_type": "misconfig"
            },
            {
                "id": "API9",
                "name": "Improper Inventory Management",
                "description": "APIs tend to expose more endpoints than traditional web applications.",
                "scan_type": "inventory"
            },
            {
                "id": "API10",
                "name": "Unsafe Consumption of APIs",
                "description": "Developers tend to trust data received from third-party APIs more than user input.",
                "scan_type": "unsafe_consumption"
            }
        ]
    }


@router.get("/scan-types")
async def get_scan_types():
    """Get available scan types"""
    return {
        "status": "success",
        "scan_types": [
            {"id": "bola", "name": "BOLA Testing", "duration": "~30s"},
            {"id": "broken_auth", "name": "Authentication Testing", "duration": "~45s"},
            {"id": "bopla", "name": "Property Authorization Testing", "duration": "~30s"},
            {"id": "resource_consumption", "name": "DoS/Resource Testing", "duration": "~60s"},
            {"id": "bfla", "name": "Function Authorization Testing", "duration": "~30s"},
            {"id": "ssrf", "name": "SSRF Testing", "duration": "~45s"},
            {"id": "misconfig", "name": "Misconfiguration Testing", "duration": "~20s"},
            {"id": "inventory", "name": "Inventory Discovery", "duration": "~60s"}
        ]
    }


@router.get("/severity-levels")
async def get_severity_levels():
    """Get severity level definitions"""
    return {
        "status": "success",
        "severity_levels": [
            {
                "level": "critical",
                "cvss_range": "9.0-10.0",
                "description": "Immediate exploitation risk. Fix immediately.",
                "color": "#dc2626"
            },
            {
                "level": "high",
                "cvss_range": "7.0-8.9",
                "description": "Significant risk. Prioritize remediation.",
                "color": "#ea580c"
            },
            {
                "level": "medium",
                "cvss_range": "4.0-6.9",
                "description": "Moderate risk. Plan remediation.",
                "color": "#ca8a04"
            },
            {
                "level": "low",
                "cvss_range": "0.1-3.9",
                "description": "Minor risk. Address when possible.",
                "color": "#16a34a"
            },
            {
                "level": "info",
                "cvss_range": "N/A",
                "description": "Informational finding. Review for best practices.",
                "color": "#2563eb"
            }
        ]
    }



