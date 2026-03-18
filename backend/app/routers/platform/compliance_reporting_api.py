"""
Compliance Reporting API — SOC 2, HIPAA, GDPR, ISO 27001 Reports

Generate, list, and download compliance evidence reports.

Prefix: /api/compliance/reports
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from app.dependencies import require_plan
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from app.services.core.compliance_report_service import compliance_report_service

logger = logging.getLogger(__name__)

compliance_reporting_router = APIRouter(
    prefix="/api/compliance/reports", tags=["Compliance Reporting"]
)


# ==================== Request Models ====================

class GenerateReportRequest(BaseModel):
    report_type: str = Field(..., description="soc2, hipaa, gdpr, access_review")
    start_date: Optional[str] = Field(default=None, description="ISO date: YYYY-MM-DD")
    end_date: Optional[str] = Field(default=None, description="ISO date: YYYY-MM-DD")
    user_id: Optional[str] = Field(default=None, description="For GDPR DSAR reports")


class ExportAuditRequest(BaseModel):
    start_date: str
    end_date: str
    format: str = Field(default="csv", description="csv or json")


# ==================== Helpers ====================

def _get_auth(request: Request):
    org_id = getattr(request.state, "org_id", None) or getattr(request.state, "tenant_id", None)
    user_id = getattr(request.state, "user_id", None)
    return org_id, user_id


# ==================== Generate Reports ====================

@compliance_reporting_router.post("/generate")
async def generate_report(body: GenerateReportRequest, request: Request, _: None = Depends(require_plan("compliance_reporting"))):
    """
    Generate a compliance report.
    Supported types: soc2, hipaa, gdpr, access_review
    """
    org_id, user_id = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        generators = {
            "soc2": lambda: compliance_report_service.generate_soc2_report(
                org_id=org_id,
                start_date=body.start_date or "2026-01-01",
                end_date=body.end_date or "2026-12-31",
                generated_by=user_id,
            ),
            "hipaa": lambda: compliance_report_service.generate_hipaa_report(
                org_id=org_id,
                start_date=body.start_date or "2026-01-01",
                end_date=body.end_date or "2026-12-31",
                generated_by=user_id,
            ),
            "gdpr": lambda: compliance_report_service.generate_gdpr_report(
                org_id=org_id,
                user_id=body.user_id,
                generated_by=user_id,
            ),
            "access_review": lambda: compliance_report_service.generate_access_review(
                org_id=org_id,
                generated_by=user_id,
            ),
        }

        generator = generators.get(body.report_type)
        if not generator:
            raise HTTPException(400, f"Unknown report type: {body.report_type}")

        report = await generator()
        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Generate report error: {e}")
        raise HTTPException(500, "Report generation failed")


# ==================== List Reports ====================

@compliance_reporting_router.get("/list")
async def list_reports(
    request: Request,
    report_type: Optional[str] = None,
    limit: int = 20,
):
    """List generated compliance reports."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        reports = await compliance_report_service.list_reports(
            org_id=org_id,
            report_type=report_type,
            limit=min(limit, 100),
        )
        return {"reports": reports, "total": len(reports)}
    except Exception as e:
        logger.error(f"List reports error: {e}")
        raise HTTPException(500, "Failed to list reports")


# ==================== Get Report ====================

@compliance_reporting_router.get("/{report_id}")
async def get_report(report_id: str, request: Request):
    """Get full compliance report by ID."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        report = await compliance_report_service.get_report(report_id, org_id)
        if not report:
            raise HTTPException(404, "Report not found")
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get report error: {e}")
        raise HTTPException(500, "Failed to retrieve report")


# ==================== Export Audit Trail ====================

@compliance_reporting_router.post("/audit-export")
async def export_audit_trail(body: ExportAuditRequest, request: Request):
    """Export audit trail as CSV or JSON for compliance evidence."""
    org_id, _ = _get_auth(request)
    if not org_id:
        org_id = "default"

    try:
        result = await compliance_report_service.export_audit_trail(
            org_id=org_id,
            start_date=body.start_date,
            end_date=body.end_date,
            format=body.format,
        )
        if not result.get("success"):
            raise HTTPException(500, result.get("message", "Export failed"))

        if body.format == "csv":
            return PlainTextResponse(
                content=result["content"],
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=audit-trail.csv"},
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Audit export error: {e}")
        raise HTTPException(500, "Audit export failed")


# ==================== Health ====================

@compliance_reporting_router.get("/health")
async def compliance_reporting_health():
    """Compliance reporting service health check."""
    return {"status": "ok", "service": "compliance_reporting"}
