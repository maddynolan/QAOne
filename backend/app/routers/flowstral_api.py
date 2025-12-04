"""
Flowstral API Router
Real-time capture → Multi-modal analysis → Action Graph → Automation → Test Cases → Insights
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime
import json
import asyncio
import os
import base64

from app.services.flowstral.flowstral_orchestrator import FlowstralOrchestrator
from app.services.core.plugin_service import PluginService
from app.services.flowstral.flowstral_gateway import flowstral_gateway
from app.services.automation.test_execution_service import get_test_execution_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flowstral", tags=["flowstral"])

orchestrator = FlowstralOrchestrator()
plugin_service = PluginService()


# ==================== Authentication ====================

async def verify_api_key_optional(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify API key from Authorization header (optional - allows web UI access)"""
    if not authorization:
        # Return default tenant for web UI access
        logger.info("Flowstral request without API key - using default tenant (web UI access)")
        return {
            "key_id": None,
            "tenant_id": None,
            "permissions": []
        }
    
    if authorization.startswith("Bearer "):
        api_key = authorization[7:]
    else:
        api_key = authorization
    
    key_data = await plugin_service.validate_api_key(api_key)
    if not key_data:
        # If key is provided but invalid, still allow with default tenant
        # (for development - in production you might want to raise an error)
        logger.warning(f"Invalid API key provided, using default tenant")
        return {
            "key_id": None,
            "tenant_id": None,
            "permissions": []
        }
    
    return key_data


# ==================== Request Models ====================

class StartFlowstralRequest(BaseModel):
    project_id: str
    user_id: str
    initial_url: str
    initial_dom: Optional[str] = None


class CaptureEventRequest(BaseModel):
    session_id: str
    event_type: str  # click, input, select, navigate, scroll, hover
    event_data: Dict[str, Any]  # html, url, interacted_element, page_metrics, etc.


class StopFlowstralRequest(BaseModel):
    session_id: str
    project_id: Optional[str] = None


class CaptureEventsBatchRequest(BaseModel):
    events: List[Dict[str, Any]]  # List of events with session_id, event_type, event_data, timestamp


# ==================== API Endpoints ====================

@router.post("/start")
async def start_flowstral(
    request: StartFlowstralRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Phase 1: Start Flowstral Session
    Initializes session, captures initial DOM, runs WCAG scan, captures performance
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        result = await orchestrator.start_session(
            project_id=request.project_id,
            user_id=request.user_id,
            initial_url=request.initial_url,
            initial_dom=request.initial_dom
        )
        
        return {
            "status": "success",
            "session": result,
            "created_at": datetime.utcnow().isoformat()
        }
    
    except ValueError as e:
        logger.error(f"Flowstral session validation error: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start Flowstral session: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}. Check server logs for details.")


@router.post("/capture-event")
async def capture_event(
    request: CaptureEventRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Phase 2: Capture User Event (Single Event)
    Runs all 4 pipelines:
    - DOM Snapshot Pipeline
    - WCAG Scan Pipeline
    - Performance Probe Pipeline
    - Action Graph Update Pipeline
    
    Returns real-time outputs:
    - Playwright code line
    - Test step
    - Accessibility panel
    - Performance panel
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        logger.info(f"[CAPTURE] Received capture-event request: session_id={request.session_id}, event_type={request.event_type}")
        logger.debug(f"Event data keys: {list(request.event_data.keys()) if request.event_data else 'None'}")
        
        result = await orchestrator.capture_event(
            session_id=request.session_id,
            event_type=request.event_type,
            event_data=request.event_data
        )
        
        logger.info(f"[OK] Event captured successfully: session_id={request.session_id}, event_type={request.event_type}")
        
        return {
            "status": "success",
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except ValueError as e:
        logger.error(f"[ERROR] Flowstral event validation error: {e}", exc_info=True)
        logger.error(f"Session ID: {request.session_id}, Event Type: {request.event_type}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[ERROR] Failed to capture event: {e}", exc_info=True)
        logger.error(f"Session ID: {request.session_id}, Event Type: {request.event_type}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}. Check server logs for details.")


@router.post("/capture-events-batch")
async def capture_events_batch(
    request: CaptureEventsBatchRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Phase 2.1: Ingestion API Gateway - Batch Event Capture
    Validates, routes, and processes batched events from extension
    
    Features:
    - Tenant & user auth validation
    - Domain allowlist validation
    - Rate limiting
    - Event batching
    - Writes to event store
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        if not request.events or len(request.events) == 0:
            raise HTTPException(status_code=400, detail="No events provided")
        
        # Log received batch
        logger.info(f"[BATCH] Received batch request with {len(request.events)} events")
        for idx, event in enumerate(request.events[:5]):  # Log first 5 events
            logger.info(f"[BATCH] Event {idx+1}: session_id={event.get('session_id')}, event_type={event.get('event_type')}, timestamp={event.get('timestamp')}")
        
        # Process through gateway
        gateway_result = await flowstral_gateway.process_batch(
            events=request.events,
            tenant_id=tenant_id
        )
        
        logger.info(f"[BATCH] Gateway processed batch, sessions: {list(gateway_result.get('sessions', {}).keys())}")
        
        # Process each event through orchestrator
        processed_results = {}
        for session_id, session_info in gateway_result.get("sessions", {}).items():
            if session_info.get("status") != "success":
                processed_results[session_id] = session_info
                continue
            
            # Process each event in the session
            session_events = [e for e in request.events if e.get("session_id") == session_id]
            session_results = []
            
            for event in session_events:
                try:
                    logger.info(f"[BATCH] Processing event: session_id={event.get('session_id')}, event_type={event.get('event_type')}")
                    result = await orchestrator.capture_event(
                        session_id=event.get("session_id"),
                        event_type=event.get("event_type"),
                        event_data=event.get("event_data", {})
                    )
                    logger.info(f"[BATCH] Event processed successfully: event_type={event.get('event_type')}")
                    session_results.append({
                        "status": "success",
                        "event_type": event.get("event_type"),
                        "result": result
                    })
                except Exception as e:
                    error_msg = str(e)
                    # Log all errors, but use appropriate log level
                    if any(phrase in error_msg.lower() for phrase in ["not found", "not active", "already stopped", "does not exist"]):
                        logger.warning(f"[BATCH] Event dropped - session inactive: event_type={event.get('event_type')}, error={error_msg}")
                    else:
                        logger.error(f"[BATCH] Failed to process event: event_type={event.get('event_type')}, error={error_msg}", exc_info=True)
                    session_results.append({
                        "status": "error",
                        "event_type": event.get("event_type"),
                        "error": error_msg
                    })
            
            processed_results[session_id] = {
                "status": "success",
                "event_count": len(session_events),
                "processed": len([r for r in session_results if r.get("status") == "success"]),
                "errors": len([r for r in session_results if r.get("status") == "error"]),
                "warnings": session_info.get("warnings", []),
                "results": session_results
            }
        
        return {
            "status": "success",
            "sessions": processed_results,
            "total_events": len(request.events),
            "processed_at": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process event batch: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}. Check server logs for details.")


@router.post("/stop")
async def stop_flowstral(
    request: StopFlowstralRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Phase 4: Stop Flowstral Session
    Generates all 6 artifacts:
    1. Action Graph Model
    2. Full Playwright Script
    3. Structured Test Cases
    4. Accessibility Report
    5. Performance Report
    6. Auto Defects
    """
    try:
        tenant_id = key_data.get("tenant_id")
        
        result = await orchestrator.stop_session(
            session_id=request.session_id,
            project_id=request.project_id,
            tenant_id=tenant_id
        )
        
        # Extract artifacts from nested structure
        artifacts_result = result.get("artifacts", {})
        # generate_all_artifacts returns {artifacts: {...}, warnings: [...]}
        # So we need to extract the nested artifacts dict
        if isinstance(artifacts_result, dict) and "artifacts" in artifacts_result:
            artifacts_dict = artifacts_result.get("artifacts", {})
        else:
            artifacts_dict = artifacts_result
        
        logger.info(f"Returning artifacts with keys: {list(artifacts_dict.keys()) if isinstance(artifacts_dict, dict) else 'not a dict'}")
        
        return {
            "status": "success",
            "session_id": request.session_id,
            "artifacts": {
                "artifacts": artifacts_dict,  # Keep nested structure for compatibility
                "warnings": artifacts_result.get("warnings", []),
                "generated_at": artifacts_result.get("generated_at")
            },
            "real_time_outputs": result.get("real_time_outputs", {}),
            "completed_at": datetime.utcnow().isoformat()
        }
    
    except asyncio.TimeoutError:
        logger.error(f"Artifact generation timed out for session {request.session_id}")
        raise HTTPException(
            status_code=504,
            detail={
                "error": "Artifact generation timed out",
                "message": "Generation took longer than 5 minutes. This may indicate LLM connection issues or a very large session.",
                "session_id": request.session_id,
                "suggestion": "Try again or check LLM service availability (OpenAI/Ollama)"
            }
        )
    except ValueError as e:
        logger.error(f"Flowstral stop validation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Validation error",
                "message": str(e)
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stop Flowstral session: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "message": f"An unexpected error occurred: {str(e)}",
                "type": type(e).__name__,
                "suggestion": "Check server logs for details. If this persists, restart the backend server."
            }
        )


@router.get("/session/{session_id}/status")
async def get_session_status(
    session_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """Get current Flowstral session status"""
    try:
        status = orchestrator.get_session_status(session_id)
        return {
            "status": "success",
            "session": status
        }
    
    except Exception as e:
        logger.error(f"Failed to get session status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/{session_id}")
async def websocket_updates(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time progress updates
    Streams:
    - Artifact generation progress
    - LLM processing status
    - Completion notifications
    """
    from app.services.flowstral.flowstral_websocket_manager import flowstral_ws_manager
    
    # Register connection
    await flowstral_ws_manager.connect(websocket, session_id)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "message": "Connected to Flowstral progress stream",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and handle client messages
        while True:
            try:
                # Wait for client messages (ping/pong)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "session_id": session_id,
                        "timestamp": datetime.utcnow().isoformat()
                    })
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                await websocket.send_json({
                    "type": "heartbeat",
                    "session_id": session_id,
                    "timestamp": datetime.utcnow().isoformat()
                })
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for session {session_id}")
        flowstral_ws_manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        flowstral_ws_manager.disconnect(websocket, session_id)


@router.get("/session/{session_id}/artifacts")
async def get_artifacts(
    session_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Get all 6 artifacts for a completed session.
    Includes timeout protection and robust error handling.
    """
    try:
        from app.services.flowstral.flowstral_session import flowstral_session_manager
        
        # Validate session_id format (basic UUID check)
        if not session_id or len(session_id) < 10:
            raise HTTPException(
                status_code=400,
                detail="Invalid session_id format"
            )
        
        # Check if session exists with timeout
        try:
            session = await asyncio.wait_for(
                asyncio.to_thread(flowstral_session_manager.get_session, session_id),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            logger.error(f"Session lookup timed out for {session_id}")
            raise HTTPException(
                status_code=504,
                detail="Session lookup timed out. Please try again."
            )
        
        if not session:
            logger.warning(f"Session {session_id} not found when requesting artifacts")
            logger.warning(f"Available sessions: {list(flowstral_session_manager.sessions.keys())[:5]}")
            logger.warning(f"Total sessions in memory: {len(flowstral_session_manager.sessions)}")
            
            # Try to load artifacts from database
            logger.info(f"[INFO] Session not in memory, trying to load artifacts from database...")
            try:
                from app.services.storage.postgres_direct import execute_query
                
                # Query artifacts from database
                artifacts_query = """
                    SELECT artifact_type, artifact_data, export_format, created_at
                    FROM flowstral_artifacts
                    WHERE session_id::text = %s OR session_id = %s::uuid
                    ORDER BY created_at DESC
                """
                
                # Try both string and UUID format
                db_artifacts = await execute_query(artifacts_query, (session_id, session_id))
                
                if db_artifacts and len(db_artifacts) > 0:
                    logger.info(f"[OK] Found {len(db_artifacts)} artifacts in database for session {session_id}")
                    
                    # Reconstruct artifacts dict from database
                    artifacts_dict = {}
                    for row in db_artifacts:
                        artifact_type = row.get("artifact_type")
                        artifact_data = row.get("artifact_data")
                        if artifact_type and artifact_data:
                            artifacts_dict[artifact_type] = artifact_data
                    
                    if len(artifacts_dict) > 0:
                        logger.info(f"[OK] Returning {len(artifacts_dict)} artifacts from database")
                        return {
                            "status": "success",
                            "session_id": session_id,
                            "artifacts": artifacts_dict,
                            "source": "database",
                            "message": "Artifacts loaded from database (session was not in memory)"
                        }
                    else:
                        logger.warning(f"[WARNING] Database artifacts found but could not reconstruct dict")
                else:
                    logger.warning(f"[WARNING] No artifacts found in database for session {session_id}")
            except Exception as e:
                logger.error(f"[ERROR] Failed to load artifacts from database: {e}", exc_info=True)
            
            # Session not found and no DB artifacts - return helpful message
            available_sessions = list(flowstral_session_manager.sessions.keys())[:5]  # Limit to 5 for response
            return {
                "status": "success",
                "session_id": session_id,
                "artifacts": {},
                "message": f"Session not found in memory or database. The session may have expired or the backend was restarted. Available sessions: {len(flowstral_session_manager.sessions)}. Please check if artifacts were stored in browser localStorage or start a new recording session.",
                "available_sessions": available_sessions,
                "total_sessions": len(flowstral_session_manager.sessions)
            }
        
        # Check if session has stored artifacts
        logger.info(f"Checking artifacts for session {session_id}")
        logger.info(f"Session has artifacts attribute: {hasattr(session, 'artifacts')}")
        logger.info(f"Session artifacts value: {getattr(session, 'artifacts', 'NOT SET')}")
        logger.info(f"Session artifacts type: {type(getattr(session, 'artifacts', None))}")
        logger.info(f"Session is_active: {session.is_active}")
        
        artifacts_value = getattr(session, 'artifacts', None)
        
        # Check if artifacts are actually stored (not None and not empty)
        if artifacts_value is not None:
            # Check if it's a dict with actual content (not just placeholder strings)
            if isinstance(artifacts_value, dict):
                # Check if any value is not a placeholder string
                has_real_artifacts = any(
                    not isinstance(v, str) or "Available after" not in v 
                    for v in artifacts_value.values()
                )
                
                if has_real_artifacts and len(artifacts_value) > 0:
                    logger.info(f"[OK] Returning stored artifacts for session {session_id}")
                    logger.info(f"[OK] Artifacts keys: {list(artifacts_value.keys())}")
                    # Log each artifact type to see what we have
                    for key, value in artifacts_value.items():
                        if isinstance(value, dict):
                            logger.info(f"[OK] {key}: dict with keys {list(value.keys())[:5]}")
                        elif isinstance(value, str):
                            logger.info(f"[OK] {key}: string (length: {len(value)})")
                        else:
                            logger.info(f"[OK] {key}: {type(value).__name__}")
                    
                    return {
                        "status": "success",
                        "session_id": session_id,
                        "artifacts": artifacts_value,  # Return artifacts directly, not nested
                        "generated_at": getattr(session, 'artifacts_generated_at', None)
                    }
                else:
                    logger.warning(f"[WARNING] Artifacts dict exists but contains only placeholders")
        
        # If no stored artifacts, check if session is stopped
        if not session.is_active:
            logger.warning(f"[WARNING] Session {session_id} is stopped but no artifacts stored.")
            logger.warning(f"[WARNING] Session artifacts value: {getattr(session, 'artifacts', 'NOT SET')}")
            logger.warning(f"[WARNING] Session artifacts type: {type(getattr(session, 'artifacts', None))}")
            logger.warning(f"[WARNING] Session has {len(session.nodes)} nodes and {len(session.edges)} edges")
            
            # Check if artifacts attribute exists but is None
            if hasattr(session, 'artifacts') and session.artifacts is None:
                logger.warning(f"[WARNING] Session.artifacts is None - artifacts were never stored or were cleared")
            
            # Try to regenerate artifacts if session has data
            if len(session.nodes) > 0 or len(session.edges) > 0:
                logger.info(f"[INFO] Session has data, suggesting to regenerate artifacts or check localStorage")
                return {
                    "status": "success",
                    "session_id": session_id,
                    "artifacts": {},
                    "message": f"Artifacts not found in session. Session has {len(session.nodes)} nodes and {len(session.edges)} edges. The artifacts may not have been stored when the session was stopped, or the session was cleared from memory. Please check browser localStorage for cached artifacts, or start a new recording session."
                }
            else:
                return {
                    "status": "success",
                    "session_id": session_id,
                    "artifacts": {},
                    "message": "Artifacts not found. Session has no recorded actions (0 nodes, 0 edges)."
                }
        
        # Session is still active
        logger.info(f"Session {session_id} is still active")
        return {
            "status": "success",
            "session_id": session_id,
            "artifacts": {},
            "message": "Session is still active. Artifacts will be available after stopping the session."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get artifacts: {e}", exc_info=True)
        import traceback
        error_detail = {
            "error": str(e),
            "type": type(e).__name__,
            "message": "An unexpected error occurred while retrieving artifacts. Check server logs for details."
        }
        raise HTTPException(status_code=500, detail=error_detail)


@router.get("/sessions")
async def list_sessions(
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """List all Flowstral sessions, optionally filtered by project_id or user_id"""
    try:
        from app.services.flowstral.flowstral_session import flowstral_session_manager
        
        sessions = flowstral_session_manager.list_sessions(
            project_id=project_id,
            user_id=user_id,
            limit=limit
        )
        
        return {
            "status": "success",
            "sessions": sessions,
            "total": len(sessions)
        }
    
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/summary")
async def get_session_summary(
    session_id: str,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """Get a summary of a Flowstral session including action graph"""
    try:
        from app.services.flowstral.flowstral_session import flowstral_session_manager
        
        summary = flowstral_session_manager.get_session_summary(session_id)
        
        if not summary:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return {
            "status": "success",
            "session": summary
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/execute-test")
async def execute_flowstral_test(
    session_id: str,
    browser: str = "chromium",
    headless: bool = True,
    timeout: int = 30000,
    key_data: Dict[str, Any] = Depends(verify_api_key_optional)
):
    """
    Execute Playwright test from Flowstral session artifacts.
    HIGH PRIORITY: Run tests locally after recording.
    """
    logger.info(f"[FLOWSTRAL EXECUTE] ===== Starting test execution for session {session_id} =====")
    logger.info(f"[FLOWSTRAL EXECUTE] Parameters: browser={browser}, headless={headless}, timeout={timeout}")
    try:
        # Get session from session manager
        from app.services.flowstral.flowstral_session import flowstral_session_manager
        session = flowstral_session_manager.get_session(session_id)
        logger.info(f"[FLOWSTRAL EXECUTE] Session found: {session is not None}")
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get artifacts (from memory, database, or localStorage fallback)
        artifacts = session.artifacts if hasattr(session, 'artifacts') and session.artifacts else None
        
        if not artifacts:
            # Try to load from database
            from app.services.storage.postgres_direct import execute_query
            artifact_query = """
                SELECT artifacts FROM flowstral_artifacts 
                WHERE session_id = %s 
                ORDER BY created_at DESC 
                LIMIT 1
            """
            artifact_results = await execute_query(artifact_query, (session_id,))
            if artifact_results and len(artifact_results) > 0:
                artifacts = artifact_results[0].get("artifacts")
        
        if not artifacts or not artifacts.get("playwright_script") or not artifacts.get("playwright_script", {}).get("code"):
            raise HTTPException(
                status_code=404, 
                detail="Playwright script not found. Please ensure artifacts were generated after stopping the session."
            )
        
        playwright_code = artifacts["playwright_script"]["code"]
        logger.info(f"[FLOWSTRAL EXECUTE] Got Playwright code, length: {len(playwright_code)}")
        
        # Execute test using TestExecutionService
        logger.info(f"[FLOWSTRAL EXECUTE] Calling test_execution_service.execute_test...")
        result = await test_execution_service.execute_test(
            test_code=playwright_code,
            test_name=f"flowstral_test_{session_id[:8]}",
            browser=browser,
            headless=headless,
            timeout=timeout,
            environment="local"
        )
        logger.info(f"[FLOWSTRAL EXECUTE] Test execution completed, status: {result.get('status')}")
        logger.info(f"[FLOWSTRAL EXECUTE] Result keys: {list(result.keys())}")
        
        # Create a test run entry for tracking (optional but recommended)
        test_run_id = None
        try:
            logger.info(f"[FLOWSTRAL EXECUTE] Attempting to create test run for session {session_id}")
            from app.services.storage.postgres_direct import execute_insert, execute_query, ensure_default_org_project
            import asyncio
            
            # Add timeout to prevent hanging
            try:
                org_id, project_id = await asyncio.wait_for(
                    ensure_default_org_project(),
                    timeout=5.0  # 5 second timeout
                )
                logger.info(f"[FLOWSTRAL EXECUTE] Got project_id: {project_id}, org_id: {org_id}")
            except asyncio.TimeoutError:
                logger.error(f"[FLOWSTRAL EXECUTE] ⚠️ ensure_default_org_project() timed out after 5 seconds")
                raise Exception("Database connection timeout - test run creation skipped")
            except Exception as e:
                logger.error(f"[FLOWSTRAL EXECUTE] ⚠️ ensure_default_org_project() failed: {e}")
                raise
            
            # Create test run entry
            run_data = {
                "project_id": project_id,
                "name": f"Flowstral Test - {session_id[:8]}",
                "status": "passed" if result.get("status") == "success" else "failed",
                "environment": "local",
                "created_by": "22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
            }
            
            logger.info(f"[FLOWSTRAL EXECUTE] Creating test run with data: {run_data}")
            try:
                test_run_id = await asyncio.wait_for(
                    execute_insert("test_runs", run_data),
                    timeout=5.0  # 5 second timeout
                )
                if test_run_id:
                    logger.info(f"[FLOWSTRAL EXECUTE] ✅ Created test run {test_run_id} for Flowstral session {session_id}")
                else:
                    logger.warning(f"[FLOWSTRAL EXECUTE] ⚠️ execute_insert returned None for test run")
            except asyncio.TimeoutError:
                logger.error(f"[FLOWSTRAL EXECUTE] ⚠️ execute_insert() timed out after 5 seconds")
            except Exception as insert_error:
                logger.error(f"[FLOWSTRAL EXECUTE] ⚠️ execute_insert() failed: {insert_error}")
                
                # Store execution result details
                if result.get("screenshots"):
                    for idx, screenshot_path in enumerate(result.get("screenshots", [])[:5]):  # Limit to 5 screenshots
                        try:
                            from app.services.storage.test_results_storage import store_artifact
                            # Read screenshot file if it exists
                            if os.path.exists(screenshot_path):
                                with open(screenshot_path, 'rb') as f:
                                    screenshot_bytes = f.read()
                                    screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                                    image_url = f"data:image/png;base64,{screenshot_b64}"
                                    
                                    await store_artifact(
                                        run_id=test_run_id,
                                        step_id=None,
                                        artifact_type="screenshot",
                                        url=image_url,
                                        size_bytes=len(screenshot_bytes),
                                        metadata={"source": "flowstral_execution", "index": idx}
                                    )
                        except Exception as e:
                            logger.warning(f"Failed to store screenshot {idx}: {e}", exc_info=True)
        except Exception as e:
            logger.error(f"[FLOWSTRAL EXECUTE] ❌ Failed to create test run entry: {e}", exc_info=True)
            # Don't fail the execution if test run creation fails
        
        # If execution failed, return error status
        if result.get("status") == "error":
            logger.error(f"Test execution failed: {result.get('error')}")
            return {
                "status": "error",
                "session_id": session_id,
                "execution_result": result,
                "test_run_id": test_run_id,
                "message": f"Test execution failed: {result.get('error', 'Unknown error')}"
            }
        
        return {
            "status": "success",
            "session_id": session_id,
            "execution_result": result,
            "test_run_id": test_run_id,
            "message": f"Test execution completed with status: {result.get('status')}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing Flowstral test: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test execution failed: {str(e)}")

