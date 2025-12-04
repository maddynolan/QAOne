"""
API endpoints for Nexus Autonomous Exploratory Testing Service
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import os
import logging

from app.services.llm.openai_service import OpenAIService
from app.services.exploration.nexus_exploratory_service import NexusExploratoryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nexus", tags=["nexus"])

# Initialize OpenAI service
try:
    openai_service = OpenAIService()
    # Try to get OpenAI client
    import os
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        from openai import OpenAI
        openai_client = OpenAI(api_key=api_key)
    else:
        openai_client = None
except Exception:
    openai_client = None

# Initialize Nexus service
nexus_service = NexusExploratoryService(openai_client) if openai_client else None


class StartSessionRequest(BaseModel):
    """Request model for starting a Nexus exploratory session."""
    app_url: str = Field(..., description="Base URL of the application to test")
    session_id: Optional[str] = Field(None, description="Optional session ID")
    project_id: Optional[str] = Field(None, description="Project ID for defect storage")
    max_duration_minutes: int = Field(30, description="Maximum session duration in minutes")


class SessionStatusResponse(BaseModel):
    """Response model for session status."""
    session_id: str
    status: str
    defects_found: int
    risk_heatmap: Dict[str, str]
    time_elapsed_seconds: float
    proof: Optional[str] = None
    defects: list
    current_activity: Optional[str] = None
    progress: Optional[Dict[str, Any]] = None
    recent_activity: Optional[List[Dict[str, Any]]] = None
    last_update: Optional[str] = None


@router.post("/start")
async def start_nexus_session(request: StartSessionRequest) -> Dict[str, Any]:
    """
    Start a new Nexus autonomous exploratory testing session.
    
    Nexus will autonomously:
    - Crawl and map the application
    - Execute E2E flows
    - Detect defects
    - Maintain a risk heatmap
    - Continue until all P1/P2 risks are addressed
    """
    if not nexus_service:
        raise HTTPException(
            status_code=503,
            detail="OpenAI client not configured. Set OPENAI_API_KEY environment variable."
        )
    
    try:
        result = await nexus_service.start_session(
            app_url=request.app_url,
            session_id=request.session_id,
            project_id=request.project_id,
            max_duration_minutes=request.max_duration_minutes
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Failed to start Nexus session: {e}\n{error_details}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@router.get("/status/{session_id}")
async def get_nexus_status(session_id: str) -> SessionStatusResponse:
    """
    Get the current status of a Nexus exploratory session.
    
    Returns:
    - Current status (running/complete)
    - Number of defects found
    - Risk heatmap
    - Time elapsed
    - Recent defects
    """
    if not nexus_service:
        raise HTTPException(
            status_code=503,
            detail="Nexus service not available"
        )
    
    try:
        status = await nexus_service.get_session_status(session_id)
        return SessionStatusResponse(**status)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.post("/stop/{session_id}")
async def stop_nexus_session(session_id: str) -> Dict[str, Any]:
    """
    Stop a running Nexus exploratory session.
    
    This will gracefully terminate the autonomous loop and mark the session as complete.
    """
    if not nexus_service:
        raise HTTPException(
            status_code=503,
            detail="Nexus service not available"
        )
    
    try:
        result = await nexus_service.stop_session(session_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop Nexus session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to stop session: {str(e)}")


@router.get("/sessions")
async def list_nexus_sessions() -> Dict[str, Any]:
    """
    List all active Nexus exploratory sessions.
    """
    if not nexus_service:
        raise HTTPException(
            status_code=503,
            detail="Nexus service not available"
        )
    
    sessions = []
    for session_id, session_data in nexus_service.sessions.items():
        elapsed = (session_data["started_at"] - session_data["started_at"]).total_seconds()
        sessions.append({
            "session_id": session_id,
            "app_url": session_data["app_url"],
            "status": "complete" if session_data.get("complete") else "running",
            "defects_found": len(session_data["defects"]),
            "time_elapsed_seconds": elapsed
        })
    
    return {"sessions": sessions, "count": len(sessions)}

