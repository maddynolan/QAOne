"""
Blaze API v2.0 — Enterprise-Grade Autonomous Exploratory Testing

Real defect detection on any website without AI dependencies.
Supports SSE streaming, concurrent crawling, authentication, axe-core,
defect screenshots, and test suite generation.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
import asyncio
import json
import secrets

from app.services.exploration.blaze_explorer import (
    start_blaze_session,
    get_session_status,
    stop_session,
    remove_session,
    get_session_explorer,
    BlazeExplorer,
    CrawlConfig,
    _active_sessions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/blaze", tags=["blaze"])


# ─── Request/Response Schemas ────────────────────────────────────────────


class AuthConfig(BaseModel):
    """Authentication configuration for crawling."""
    type: str = Field("", description="Auth type: cookie, bearer, basic, form_login")
    # cookie auth
    cookies: Optional[Any] = Field(None, description="List of cookie dicts or JSON string")
    # bearer auth
    token: Optional[str] = Field(None, description="Bearer token")
    # basic auth
    username: Optional[str] = Field(None, description="Username for basic/form auth")
    password: Optional[str] = Field(None, description="Password for basic/form auth")
    # form_login auth
    login_url: Optional[str] = Field(None, description="Login page URL")
    username_selector: Optional[str] = Field("#username", description="CSS selector for username field")
    password_selector: Optional[str] = Field("#password", description="CSS selector for password field")
    submit_selector: Optional[str] = Field("button[type='submit']", description="CSS selector for submit button")


class StartBlazeRequest(BaseModel):
    """Request to start Blaze exploration."""
    url: str = Field(..., description="URL to test")
    max_pages: int = Field(50, description="Maximum pages to visit (max 500)")
    max_depth: int = Field(5, description="Maximum BFS depth (max 10)")
    max_duration_minutes: int = Field(10, description="Maximum duration in minutes (max 60)")
    concurrency: int = Field(3, description="Concurrent browser pages (1-10)")
    delay_ms: int = Field(200, description="Delay between page visits in ms")
    headless: bool = Field(True, description="Run browser in headless mode")
    test_types: Optional[Dict[str, bool]] = Field(
        default=None,
        description="Test types to run: functional, accessibility, performance, security"
    )
    auth: Optional[AuthConfig] = Field(None, description="Authentication configuration")


class BlazeSessionResponse(BaseModel):
    """Response with session info."""
    session_id: str
    status: str
    message: str


class BlazeStatusResponse(BaseModel):
    """Response with session status."""
    session_id: str
    status: str
    progress: float
    current_activity: str
    pages_visited: int
    defects_found: int
    defects: List[Dict[str, Any]]
    duration: float


# ─── Validation Helpers ──────────────────────────────────────────────────


def _validate_request(request: StartBlazeRequest):
    """Validate and clamp request parameters."""
    # SEC-INPUT-004: SSRF prevention
    from app.utils.url_validator import validate_url, sanitize_url_for_logging
    try:
        validate_url(request.url)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid URL")

    # Resource limits
    if request.max_pages > 500:
        raise HTTPException(status_code=400, detail="max_pages cannot exceed 500")
    if request.max_pages < 1:
        raise HTTPException(status_code=400, detail="max_pages must be at least 1")
    if request.max_depth > 10:
        raise HTTPException(status_code=400, detail="max_depth cannot exceed 10")
    if request.max_depth < 1:
        raise HTTPException(status_code=400, detail="max_depth must be at least 1")
    if request.max_duration_minutes > 60:
        raise HTTPException(status_code=400, detail="max_duration_minutes cannot exceed 60")
    if request.max_duration_minutes < 1:
        raise HTTPException(status_code=400, detail="max_duration_minutes must be at least 1")
    if request.concurrency > 10:
        raise HTTPException(status_code=400, detail="concurrency cannot exceed 10")
    if request.concurrency < 1:
        raise HTTPException(status_code=400, detail="concurrency must be at least 1")
    if request.delay_ms < 0:
        raise HTTPException(status_code=400, detail="delay_ms cannot be negative")
    if request.delay_ms > 5000:
        raise HTTPException(status_code=400, detail="delay_ms cannot exceed 5000")

    # Validate auth login_url if form_login
    if request.auth and request.auth.type == "form_login" and request.auth.login_url:
        try:
            validate_url(request.auth.login_url)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid login URL")


def _build_auth_dict(auth: Optional[AuthConfig]) -> Optional[Dict[str, Any]]:
    """Convert AuthConfig to dict for BlazeExplorer."""
    if not auth or not auth.type:
        return None
    return {
        "type": auth.type,
        "cookies": auth.cookies,
        "token": auth.token,
        "username": auth.username,
        "password": auth.password,
        "login_url": auth.login_url,
        "username_selector": auth.username_selector,
        "password_selector": auth.password_selector,
        "submit_selector": auth.submit_selector,
    }


# ─── SSE Streaming Endpoint ─────────────────────────────────────────────


@router.post("/start-stream")
async def start_blaze_stream(request: StartBlazeRequest):
    """
    Start a Blaze exploration with Server-Sent Events (SSE) streaming.

    Events streamed:
    - page_visited: {url, title, depth, defects_found}
    - defect_found: {defect: {..., screenshot: "base64..."}}
    - progress: {pages_visited, pages_queued, defects_total}
    - complete: {summary, pages, defects}
    - error: {error: "message"}
    """
    _validate_request(request)

    session_id = secrets.token_urlsafe(12)
    from app.utils.url_validator import sanitize_url_for_logging
    logger.info(f"Starting Blaze SSE stream {session_id} for {sanitize_url_for_logging(request.url)}")

    explorer = BlazeExplorer()
    _active_sessions[session_id] = explorer

    config = CrawlConfig(
        start_url=request.url,
        max_pages=request.max_pages,
        max_depth=request.max_depth,
        max_duration_minutes=request.max_duration_minutes,
        concurrency=request.concurrency,
        delay_ms=request.delay_ms,
        headless=request.headless,
        test_types=request.test_types,
        auth=_build_auth_dict(request.auth),
    )

    async def event_generator():
        """Generate SSE events from the explorer stream."""
        try:
            # Send session_id as first event
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            async for event in explorer.explore_stream(config):
                yield f"data: {json.dumps(event, default=str)}\n\n"

        except asyncio.CancelledError:
            explorer.request_stop()
            yield f"data: {json.dumps({'type': 'stopped', 'message': 'Exploration cancelled'})}\n\n"
        except Exception as e:
            logger.error(f"SSE stream error for session {session_id}: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': 'Stream error'})}\n\n"
        finally:
            # Keep session for test suite generation
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Blaze-Session-Id": session_id,
        },
    )


# ─── Background Start Endpoint (Polling) ────────────────────────────────


@router.post("/start")
async def start_blaze(request: StartBlazeRequest, background_tasks: BackgroundTasks):
    """
    Start a Blaze exploration in the background.
    Use GET /api/blaze/status/{session_id} to poll for progress.
    """
    _validate_request(request)

    session_id = secrets.token_urlsafe(12)
    from app.utils.url_validator import sanitize_url_for_logging
    logger.info(f"Starting Blaze session {session_id} for {sanitize_url_for_logging(request.url)}")

    async def run_exploration():
        try:
            await start_blaze_session(
                session_id=session_id,
                start_url=request.url,
                max_pages=request.max_pages,
                max_duration_minutes=request.max_duration_minutes,
                headless=request.headless,
                test_types=request.test_types,
                concurrency=request.concurrency,
                max_depth=request.max_depth,
                delay_ms=request.delay_ms,
                auth=_build_auth_dict(request.auth),
            )
        except Exception as e:
            logger.error(f"Blaze session {session_id} failed: {e}")
            explorer = _active_sessions.get(session_id)
            if explorer:
                explorer.status = "error"

    background_tasks.add_task(asyncio.create_task, run_exploration())

    return BlazeSessionResponse(
        session_id=session_id,
        status="started",
        message=f"Blaze exploration started for {request.url}"
    )


# ─── Synchronous Start ──────────────────────────────────────────────────


@router.post("/start-sync")
async def start_blaze_sync(request: StartBlazeRequest):
    """
    Start Blaze and wait for completion (synchronous).
    Returns full results when done.
    """
    _validate_request(request)

    session_id = secrets.token_urlsafe(12)
    from app.utils.url_validator import sanitize_url_for_logging
    logger.info(f"Starting sync Blaze session {session_id} for {sanitize_url_for_logging(request.url)}")

    try:
        result = await start_blaze_session(
            session_id=session_id,
            start_url=request.url,
            max_pages=request.max_pages,
            max_duration_minutes=request.max_duration_minutes,
            headless=request.headless,
            test_types=request.test_types,
            concurrency=request.concurrency,
            max_depth=request.max_depth,
            delay_ms=request.delay_ms,
            auth=_build_auth_dict(request.auth),
        )
        return {"session_id": session_id, **result}
    except Exception as e:
        logger.error(f"Blaze sync session failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Exploration session failed. Check server logs.")


# ─── Status / Control Endpoints ──────────────────────────────────────────


@router.get("/status/{session_id}")
async def get_blaze_status(session_id: str):
    """Get status of a Blaze session."""
    status = get_session_status(session_id)
    if not status:
        raise HTTPException(status_code=404, detail="Session not found")
    return status


@router.post("/stop/{session_id}")
async def stop_blaze(session_id: str):
    """Stop a running Blaze session gracefully."""
    status = get_session_status(session_id)
    if not status:
        raise HTTPException(status_code=404, detail="Session not found")

    stop_session(session_id)
    return {"message": "Stop requested", "session_id": session_id}


@router.get("/sessions")
async def list_sessions():
    """List all active Blaze sessions."""
    sessions = []
    for session_id, explorer in _active_sessions.items():
        sessions.append({
            "session_id": session_id,
            "status": explorer.status,
            "progress": explorer.progress,
            "pages_visited": len(explorer.visited_urls),
            "defects_found": len(explorer.defects),
        })
    return {"sessions": sessions}


# ─── Test Suite Generation ───────────────────────────────────────────────


@router.post("/generate-tests/{session_id}")
async def generate_tests(session_id: str):
    """
    Generate a test suite from a completed Blaze session.

    Returns test cases that can be saved via POST /test-cases.
    Generates:
    - Smoke tests for each discovered page
    - Form tests for pages with forms
    - Regression tests for each defect found
    """
    explorer = get_session_explorer(session_id)
    if not explorer:
        raise HTTPException(status_code=404, detail="Session not found")

    if explorer.status not in ("completed", "stopped", "stopping"):
        raise HTTPException(status_code=400, detail="Session must be completed before generating tests")

    try:
        test_cases = explorer.generate_test_suite()
        return {
            "session_id": session_id,
            "test_count": len(test_cases),
            "tests": test_cases,
            "summary": {
                "smoke_tests": sum(1 for t in test_cases if "smoke" in t.get("tags", [])),
                "form_tests": sum(1 for t in test_cases if "form" in t.get("tags", [])),
                "regression_tests": sum(1 for t in test_cases if "regression" in t.get("tags", [])),
            }
        }
    except Exception as e:
        logger.error(f"Test suite generation failed for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Test suite generation failed")


# ─── Health Check ────────────────────────────────────────────────────────


@router.get("/health")
async def health_check():
    """Health check for Blaze service."""
    return {
        "status": "ok",
        "service": "blaze",
        "version": "2.0",
        "active_sessions": len(_active_sessions),
    }
