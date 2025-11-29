"""
Compliance API Router
Endpoints for compliance framework mapping and reporting.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from app.services.compliance.compliance_reporter import get_compliance_reporter
from app.services.compliance.framework_mapper import get_compliance_mapper
from app.decorators.audit import audit_log_action
from app.decorators.permissions import requires_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


class ComplianceReportRequest(BaseModel):
    test_run_id: Optional[str] = None
    project_id: Optional[str] = None
    frameworks: Optional[List[str]] = None  # ['PCI_DSS', 'HIPAA', 'SOC2', etc.]
    report_name: Optional[str] = None


@router.post("/report", summary="Generate compliance report")
@audit_log_action(
    action="generate_compliance_report",
    resource_type="compliance_report",
    get_resource_id=lambda *args, **kwargs: kwargs.get("request", {}).get("test_run_id") or kwargs.get("request", {}).get("project_id")
)
@requires_permission(["compliance:read", "compliance:generate"])
async def generate_compliance_report(request: ComplianceReportRequest):
    """
    Generate compliance report from test runs.
    Maps test results to compliance frameworks (PCI DSS, HIPAA, SOC 2, GDPR, ISO 27001).
    """
    try:
        compliance_reporter = get_compliance_reporter()
        
        report = await compliance_reporter.generate_compliance_report(
            test_run_id=request.test_run_id,
            project_id=request.project_id,
            frameworks=request.frameworks,
            report_name=request.report_name
        )
        
        return {
            "status": "success",
            "report": report
        }
    
    except Exception as e:
        logger.error(f"Failed to generate compliance report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate compliance report: {str(e)}")


@router.get("/report/{report_id}", summary="Get compliance report")
@requires_permission(["compliance:read"])
async def get_compliance_report(report_id: str):
    """Get stored compliance report by ID"""
    try:
        compliance_reporter = get_compliance_reporter()
        report = await compliance_reporter.get_compliance_report(report_id)
        
        if not report:
            raise HTTPException(status_code=404, detail="Compliance report not found")
        
        return {
            "status": "success",
            "report": report
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get compliance report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get compliance report: {str(e)}")


@router.get("/frameworks", summary="List supported compliance frameworks")
async def list_compliance_frameworks():
    """List all supported compliance frameworks"""
    from app.services.compliance.framework_mapper import ComplianceFramework
    
    frameworks = [
        {
            "framework": f.value,
            "name": f.value.replace("_", " ").title(),
            "description": _get_framework_description(f.value)
        }
        for f in ComplianceFramework
    ]
    
    return {
        "status": "success",
        "frameworks": frameworks
    }


def _get_framework_description(framework: str) -> str:
    """Get description for compliance framework"""
    descriptions = {
        "PCI_DSS": "Payment Card Industry Data Security Standard - for payment processing security",
        "HIPAA": "Health Insurance Portability and Accountability Act - for healthcare data protection",
        "SOC2": "System and Organization Controls 2 - for service organization security",
        "GDPR": "General Data Protection Regulation - for EU data protection",
        "ISO27001": "ISO/IEC 27001 - Information security management",
        "NIST": "NIST Cybersecurity Framework - for cybersecurity risk management",
        "FEDRAMP": "Federal Risk and Authorization Management Program - for US government cloud security"
    }
    return descriptions.get(framework, "Compliance framework")

