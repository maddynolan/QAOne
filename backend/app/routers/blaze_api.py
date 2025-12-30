"""
Blaze API - Real Autonomous Exploratory Testing
Finds actual defects on any website without AI dependencies
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import uuid
import logging
import asyncio

from app.services.exploration.blaze_explorer import (
    start_blaze_session,
    get_session_status,
    stop_session,
    BlazeExplorer,
    _active_sessions
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/blaze", tags=["blaze"])


class StartBlazeRequest(BaseModel):
    """Request to start Blaze exploration"""
    url: str = Field(..., description="URL to test")
    max_pages: int = Field(20, description="Maximum pages to visit")
    max_duration_minutes: int = Field(10, description="Maximum duration in minutes")
    headless: bool = Field(True, description="Run browser in headless mode")
    test_types: Optional[Dict[str, bool]] = Field(
        default=None,
        description="Test types to run: functional, accessibility, performance, security"
    )


class BlazeSessionResponse(BaseModel):
    """Response with session info"""
    session_id: str
    status: str
    message: str


class BlazeStatusResponse(BaseModel):
    """Response with session status"""
    session_id: str
    status: str
    progress: float
    current_activity: str
    pages_visited: int
    defects_found: int
    defects: List[Dict[str, Any]]
    duration: float


@router.post("/start")
async def start_blaze(request: StartBlazeRequest, background_tasks: BackgroundTasks):
    """
    Start a new Blaze exploration session.
    
    Blaze will:
    - Crawl the website
    - Find broken links
    - Detect JavaScript errors
    - Check accessibility issues
    - Identify security vulnerabilities
    - Measure performance
    """
    # Validate URL
    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    
    session_id = str(uuid.uuid4())[:8]
    
    logger.info(f"Starting Blaze session {session_id} for {request.url}")
    
    # Start exploration in background
    async def run_exploration():
        try:
            await start_blaze_session(
                session_id=session_id,
                start_url=request.url,
                max_pages=request.max_pages,
                max_duration_minutes=request.max_duration_minutes,
                headless=request.headless,
                test_types=request.test_types
            )
        except Exception as e:
            logger.error(f"Blaze session {session_id} failed: {e}")
    
    # Run in background
    background_tasks.add_task(asyncio.create_task, run_exploration())
    
    return BlazeSessionResponse(
        session_id=session_id,
        status="started",
        message=f"Blaze exploration started for {request.url}"
    )


@router.post("/start-sync")
async def start_blaze_sync(request: StartBlazeRequest):
    """
    Start Blaze and wait for completion (synchronous).
    Good for quick tests.
    """
    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    
    session_id = str(uuid.uuid4())[:8]
    
    logger.info(f"Starting synchronous Blaze session {session_id} for {request.url}")
    
    try:
        result = await start_blaze_session(
            session_id=session_id,
            start_url=request.url,
            max_pages=request.max_pages,
            max_duration_minutes=request.max_duration_minutes,
            headless=request.headless,
            test_types=request.test_types
        )
        
        return {
            "session_id": session_id,
            **result
        }
    except Exception as e:
        logger.error(f"Blaze session failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{session_id}")
async def get_blaze_status(session_id: str):
    """Get status of a Blaze session"""
    status = get_session_status(session_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return status


@router.post("/stop/{session_id}")
async def stop_blaze(session_id: str):
    """Stop a running Blaze session"""
    status = get_session_status(session_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="Session not found")
    
    stop_session(session_id)
    
    return {"message": "Session stopped", "session_id": session_id}


@router.get("/sessions")
async def list_sessions():
    """List all active Blaze sessions"""
    sessions = []
    for session_id, explorer in _active_sessions.items():
        sessions.append({
            "session_id": session_id,
            "status": explorer.status,
            "progress": explorer.progress,
            "pages_visited": len(explorer.visited_urls),
            "defects_found": len(explorer.defects)
        })
    
    return {"sessions": sessions}


@router.get("/health")
async def health_check():
    """Health check for Blaze service"""
    return {
        "status": "ok",
        "service": "blaze",
        "active_sessions": len(_active_sessions)
    }

