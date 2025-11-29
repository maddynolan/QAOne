"""
App-First Flow Router - Complete automation flow from recording to test execution
Flow A: User records flow → Automation Agent → Test Design Agent → Requirements Agent → Run → Defect Agent
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from datetime import datetime
import asyncio

from app.services.core.app_first_flow_orchestrator import AppFirstFlowOrchestrator
from app.services.core.plugin_service import PluginService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/app-first", tags=["app-first-flow"])

orchestrator = AppFirstFlowOrchestrator()
plugin_service = PluginService()


# ==================== Authentication ====================

async def verify_api_key(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify API key from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    if authorization.startswith("Bearer "):
        api_key = authorization[7:]
    else:
        api_key = authorization
    
    key_data = await plugin_service.validate_api_key(api_key)
    if not key_data:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    
    return key_data


# ==================== Request Models ====================

class RecordingFlowRequest(BaseModel):
    """Request for recording a user flow"""
    url: str
    title: Optional[str] = None
    snapshots: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    enable_performance: bool = False
    enable_accessibility: bool = False
    file_defects_to_jira: bool = False
    jira_project_key: Optional[str] = None


class FlowExecutionRequest(BaseModel):
    """Request for executing a recorded flow"""
    recording_id: str
    project_id: Optional[str] = None
    org_id: Optional[str] = None
    run_performance: bool = False
    run_accessibility: bool = False


# ==================== API Endpoints ====================

@router.post("/record-and-generate")
async def record_and_generate(
    request: RecordingFlowRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """
    Complete App-First Flow:
    1. User records flow (DOM + actions)
    2. Automation Agent generates Playwright script
    3. Test Design Agent converts to structured test cases
    4. Requirements Agent infers requirements and suggests acceptance criteria
    5. Returns generated test cases ready for execution
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        result = await orchestrator.execute_complete_flow(
            recording_data={
                "url": request.url,
                "title": request.title or "Recorded Flow",
                "snapshots": request.snapshots,
                "metadata": request.metadata or {}
            },
            project_id=request.project_id,
            org_id=request.org_id,
            tenant_id=tenant_id,
            enable_performance=request.enable_performance,
            enable_accessibility=request.enable_accessibility,
            file_defects_to_jira=request.file_defects_to_jira,
            jira_project_key=request.jira_project_key
        )
        
        return {
            "status": "success",
            "flow_id": result.get("flow_id"),
            "recording_id": result.get("recording_id"),
            "playwright_script": result.get("playwright_script"),
            "test_cases": result.get("test_cases", []),
            "requirements": result.get("requirements", []),
            "suggested_acceptance_criteria": result.get("suggested_acceptance_criteria", []),
            "created_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"App-First flow failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-flow")
async def execute_flow(
    request: FlowExecutionRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """
    Execute a recorded flow:
    1. Run automation tests
    2. If failures occur, Defect Agent captures and files defects
    3. Optionally run performance and accessibility tests
    4. Return execution results with findings
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        result = await orchestrator.execute_recorded_flow(
            recording_id=request.recording_id,
            project_id=request.project_id,
            org_id=request.org_id,
            tenant_id=tenant_id,
            run_performance=request.run_performance,
            run_accessibility=request.run_accessibility
        )
        
        return {
            "status": "success",
            "execution_id": result.get("execution_id"),
            "test_run_id": result.get("test_run_id"),
            "test_results": result.get("test_results", {}),
            "defects": result.get("defects", []),
            "performance_findings": result.get("performance_findings", []),
            "accessibility_findings": result.get("accessibility_findings", []),
            "created_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Flow execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/flow/{flow_id}")
async def get_flow_status(
    flow_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """Get status of an App-First flow"""
    try:
        tenant_id = key_data.get("tenant_id")
        
        status = await orchestrator.get_flow_status(flow_id, tenant_id)
        
        return {
            "status": "success",
            "flow": status
        }
    
    except Exception as e:
        logger.error(f"Failed to get flow status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/findings/{flow_id}")
async def get_flow_findings(
    flow_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """Get all findings (defects, performance, accessibility) for a flow"""
    try:
        tenant_id = key_data.get("tenant_id")
        
        findings = await orchestrator.get_flow_findings(flow_id, tenant_id)
        
        return {
            "status": "success",
            "findings": findings
        }
    
    except Exception as e:
        logger.error(f"Failed to get flow findings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



