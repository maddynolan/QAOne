"""
API endpoints for Real Exploratory Testing Service (Blaze)

Provides REAL exploratory testing that actually crawls websites and finds defects.
Works WITHOUT OpenAI - uses intelligent heuristics and Playwright.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging

from app.services.exploration.real_exploratory_service import get_real_exploratory_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nexus", tags=["nexus", "blaze"])

# Get the real exploratory service (no OpenAI dependency!)
real_service = get_real_exploratory_service()


class StartSessionRequest(BaseModel):
    """Request model for starting an exploratory testing session."""
    app_url: str = Field(..., description="URL of the application to test")
    max_duration_minutes: int = Field(10, description="Maximum duration in minutes")
    max_pages: int = Field(30, description="Maximum pages to crawl")
    headless: bool = Field(True, description="Run browser in headless mode")


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
async def start_blaze_session(request: StartSessionRequest) -> Dict[str, Any]:
    """
    Start a real exploratory testing session.
    
    Blaze will autonomously:
    - Crawl your actual website
    - Detect real defects (broken links, JS errors, accessibility issues, etc.)
    - Build a risk heatmap
    - Complete within the time limit
    
    NO OpenAI required - works on any website!
    """
    try:
        result = await real_service.start_session(
            app_url=request.app_url,
            max_duration_minutes=request.max_duration_minutes,
            max_pages=request.max_pages,
            headless=request.headless
        )
        return result
    except Exception as e:
        logger.error(f"Failed to start session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start session: {str(e)}")


@router.get("/status/{session_id}")
async def get_blaze_status(session_id: str) -> SessionStatusResponse:
    """
    Get the current status of an exploratory testing session.
    
    Returns:
    - Current status (running/completed/error)
    - Number of defects found
    - Risk heatmap by category
    - Time elapsed
    - List of defects with details
    """
    try:
        status = await real_service.get_session_status(session_id)
        return SessionStatusResponse(**status)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get status: {str(e)}")


@router.post("/stop/{session_id}")
async def stop_blaze_session(session_id: str) -> Dict[str, Any]:
    """
    Stop a running exploratory testing session.
    """
    try:
        result = await real_service.stop_session(session_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to stop session: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to stop session: {str(e)}")


@router.get("/sessions")
async def list_blaze_sessions() -> Dict[str, Any]:
    """
    List all exploratory testing sessions.
    """
    sessions = []
    for session_id, session_data in real_service.sessions.items():
        sessions.append({
            "session_id": session_id,
            "app_url": session_data.get("app_url", ""),
            "status": session_data.get("status", "unknown"),
            "defects_found": len(session_data.get("defects", [])),
            "pages_crawled": session_data.get("pages_crawled", 0)
        })
    
    return {"sessions": sessions, "count": len(sessions)}


@router.get("/health")
async def blaze_health() -> Dict[str, Any]:
    """
    Health check for the Blaze service.
    """
    return {
        "status": "healthy",
        "service": "Blaze Real Exploratory Testing",
        "openai_required": False,
        "features": [
            "HTTP Error Detection",
            "JavaScript Error Detection",
            "Accessibility Testing (WCAG)",
            "Performance Monitoring",
            "Security Checks",
            "Mobile Responsiveness",
            "Broken Link Detection"
        ]
    }
