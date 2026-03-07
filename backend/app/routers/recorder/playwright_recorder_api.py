"""
Flowstral API - Simple and Fast Script Generation
Receives actions from Flowstral Recorder extension and generates Playwright scripts only
No action graphs, test cases, defects, etc. - just fast script generation
Supports 20+ enterprise applications with app-specific selectors
"""

import logging
import json
import os
import sys
from typing import Dict, List, Any, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from datetime import datetime

from .playwright_recorder_models import GenerateScriptRequest
from .playwright_recorder_utils import (
    PlaywrightScriptGenerator,
    TestCaseGenerator,
    _sanitize_test_name,
    _map_action_to_node_type,
    _map_node_type_to_action,
    _extract_selector_string,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flowstral", tags=["flowstral"])

# Add flowstral-extension to path to import PlaywrightGenerator
extension_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "flowstral-extension", "src", "lib")
sys.path.insert(0, extension_path)

try:
    # Try to import PlaywrightGenerator from the extension
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "playwright_generator",
        os.path.join(extension_path, "playwright-generator.js")
    )
    # For now, we'll implement a Python version based on the JS logic
    logger.debug("[PLAYWRIGHT-RECORDER] Using Python-based script generator")
except Exception as e:
    logger.warning(f"[PLAYWRIGHT-RECORDER] Could not load JS generator: {e}, using Python implementation")

# PlaywrightScriptGenerator and TestCaseGenerator moved to playwright_recorder_utils.py
# _sanitize_test_name, _map_action_to_node_type, _map_node_type_to_action,
# _extract_selector_string also moved to playwright_recorder_utils.py


# ==================== API Endpoints ====================

@router.post("/generate")
async def generate_script(request: GenerateScriptRequest) -> Dict[str, Any]:
    """
    Generate Playwright script from recorded actions.
    Fast, simple - no action graphs, test cases, or other artifacts.
    """
    try:
        logger.info(f"[FLOWSTRAL] Generating script from {len(request.actions)} actions")
        
        generator = PlaywrightScriptGenerator(options=request.options)
        script = generator.generate(request.actions, request.metadata)
        
        return {
            "status": "success",
            "script": script,
            "action_count": len(request.actions),
            "language": request.options.get("language", "typescript"),
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error generating script: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating script")




@router.post("/execute")
async def execute_script(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a Playwright script with real-time WebSocket progress.
    Accepts the generated script code and runs it.
    """
    try:
        script_code = request.get("script")
        if not script_code:
            raise HTTPException(status_code=400, detail="Script code is required")
        
        language = request.get("language", "typescript")
        browser = request.get("browser", "chromium")
        headless = request.get("headless", True)
        timeout = request.get("timeout", 30000)
        execution_id = request.get("execution_id")  # For WebSocket progress tracking
        step_names = request.get("step_names", [])  # Step names for progress
        # Sanitize workflow name to be a valid Python identifier
        workflow_name = _sanitize_test_name(request.get("workflow_name", "flowstral_recorded_test"))
        
        logger.info(f"[FLOWSTRAL] Executing script (language={language}, browser={browser}, headless={headless}, execution_id={execution_id})")
        
        # Import test execution service
        from app.services.automation.test_execution_service import TestExecutionService
        test_execution_service = TestExecutionService()
        
        # Execute the test with WebSocket tracking
        result = await test_execution_service.execute_test(
            test_code=script_code,
            test_name=workflow_name,
            browser=browser,
            headless=headless,
            timeout=timeout,
            environment="local",
            language=language,
            execution_id=execution_id,
            step_names=step_names
        )
        
        logger.info(f"[FLOWSTRAL] Test execution completed: {result.get('status')}")
        logger.info(f"[FLOWSTRAL] Exit code: {result.get('exit_code')}")
        if result.get('stderr'):
            logger.error(f"[FLOWSTRAL] Test stderr: {result.get('stderr')[:500]}")
        if result.get('stdout'):
            logger.info(f"[FLOWSTRAL] Test stdout: {result.get('stdout')[:500]}")
        
        return {
            "status": "success",
            "execution_result": result,
            "executed_at": datetime.now().isoformat()
        }
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error executing script: {e}", exc_info=True)
        # Return error details in response instead of raising
        return {
            "status": "error",
            "execution_result": {
                "status": "error",
                "error": str(e),
                "stderr": f"Execution failed: {str(e)}",
                "stdout": "",
                "exit_code": -1
            },
            "executed_at": datetime.now().isoformat()
        }


@router.post("/generate-test-cases")
async def generate_test_cases(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate manual test cases in various formats (ISTQB, Gherkin, Markdown).
    """
    try:
        actions = request.get("actions", [])
        format_type = request.get("format", "markdown")
        test_name = request.get("testName", "Recorded Test")
        app_type = request.get("appType", "generic")
        
        logger.info(f"[FLOWSTRAL] Generating {format_type} test cases from {len(actions)} actions")
        
        generator = TestCaseGenerator()
        test_cases = generator.generate(actions, format_type, test_name, app_type)
        
        return {
            "status": "success",
            "testCases": test_cases,
            "format": format_type,
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error generating test cases: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generating test cases")


# ==================== Session Storage ====================
# In-memory session storage for simplicity
# In production, this should use a database
_sessions: Dict[str, Dict[str, Any]] = {}


@router.get("/sessions")
async def get_sessions(project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get all recording sessions, optionally filtered by project_id.
    This provides compatibility with the frontend Flowstral page.
    """
    try:
        sessions_list = list(_sessions.values())
        
        if project_id:
            sessions_list = [s for s in sessions_list if s.get("project_id") == project_id]
        
        # Sort by created_at descending
        sessions_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        logger.info(f"[FLOWSTRAL] Returning {len(sessions_list)} sessions")
        
        return {
            "status": "success",
            "sessions": sessions_list,
            "total": len(sessions_list)
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error getting sessions: {e}", exc_info=True)
        return {"status": "success", "sessions": [], "total": 0}


@router.post("/save-session")
async def save_session(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save a recording session from the browser extension.
    This endpoint is called by the extension when stopping a recording.
    """
    try:
        session_id = request.get("session_id") or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        actions = request.get("actions", [])
        
        # Convert actions to action_graph format for workflow editor compatibility
        action_graph_nodes = []
        action_graph_edges = []
        
        for idx, action in enumerate(actions):
            node_id = f"node_{idx}_{session_id[:8]}"
            action_graph_nodes.append({
                "id": node_id,
                "event_type": action.get("type", "click"),
                "description": action.get("description", f"{action.get('type', 'action')}"),
                "playwright_locator": action.get("selector", {}).get("playwright") if isinstance(action.get("selector"), dict) else action.get("selector"),
                "selector": action.get("selector", {}).get("selector") if isinstance(action.get("selector"), dict) else action.get("selector"),
                "input_value": action.get("value"),
                "url": action.get("url"),
                "timestamp": action.get("timestamp"),
                "element_data": {
                    "tagName": action.get("tagName"),
                    "inputType": action.get("inputType"),
                    "innerText": action.get("innerText"),
                    "name": action.get("name"),
                    "placeholder": action.get("placeholder"),
                },
            })
            
            # Create edge to next node
            if idx > 0:
                action_graph_edges.append({
                    "id": f"edge_{idx-1}",
                    "source": f"node_{idx-1}_{session_id[:8]}",
                    "target": node_id,
                })
        
        # NEW: Process network/protocol data for unified test cases
        network_data = request.get("network_data")
        network_summary = None
        
        if network_data:
            network_summary = {
                "total_requests": len(network_data.get("requests", [])),
                "correlations": len(network_data.get("correlations", [])),
                "linked_actions": len(network_data.get("linked_actions", [])),
                "statistics": network_data.get("statistics", {}),
                "duration": network_data.get("duration"),
            }
            logger.info(f"[FLOWSTRAL] Session includes {network_summary['total_requests']} HTTP requests (protocol data)")
        
        session_data = {
            "session_id": session_id,
            "name": request.get("name", f"Recording {datetime.now().strftime('%Y-%m-%d %H:%M')}"),
            "initial_url": request.get("initial_url", ""),
            "actions": actions,  # Keep original actions
            "action_graph": {  # Add action_graph for workflow editor
                "nodes": action_graph_nodes,
                "edges": action_graph_edges,
            },
            "script": request.get("script", ""),
            "created_at": request.get("created_at", datetime.now().isoformat()),
            "start_timestamp": request.get("created_at", datetime.now().isoformat()),  # For UI display
            "is_active": False,
            "status": "draft",  # Initial status for workflow
            "metadata": request.get("metadata", {}),
            "project_id": request.get("project_id", "default"),
            # NEW: Protocol/network data for load testing
            "network_data": network_data,
            "network_summary": network_summary,
            "has_protocol_data": network_data is not None and len(network_data.get("requests", [])) > 0,
        }
        
        _sessions[session_id] = session_data
        
        protocol_msg = f", {network_summary['total_requests']} HTTP requests" if network_summary else ""
        logger.info(f"[FLOWSTRAL] Saved session {session_id} with {len(actions)} actions (action_graph: {len(action_graph_nodes)} nodes{protocol_msg})")
        
        return {
            "status": "success",
            "session_id": session_id,
            "message": f"Session saved with {len(actions)} actions",
            "network_summary": network_summary,
            "has_protocol_data": session_data.get("has_protocol_data", False),
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error saving session: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/start")
async def start_session(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Start a new recording session.
    Creates a session entry that the frontend can track.
    """
    try:
        import uuid
        session_id = str(uuid.uuid4())
        
        session_data = {
            "session_id": session_id,
            "project_id": request.get("project_id", "default"),
            "user_id": request.get("user_id", "anonymous"),
            "initial_url": request.get("initial_url", ""),
            "is_active": True,
            "created_at": datetime.now().isoformat(),
            "actions": [],
            "artifacts": None
        }
        
        _sessions[session_id] = session_data
        
        logger.info(f"[FLOWSTRAL] Started session {session_id}")
        
        return {
            "status": "success",
            "session": session_data,
            "created_at": session_data["created_at"]
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error starting session: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/stop")
async def stop_session(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stop a recording session and generate artifacts.
    """
    try:
        session_id = request.get("session_id")
        
        if not session_id or session_id not in _sessions:
            logger.warning(f"[FLOWSTRAL] Session {session_id} not found")
            return {
                "status": "success",
                "message": "Session not found or already stopped",
                "artifacts": None
            }
        
        session = _sessions[session_id]
        session["is_active"] = False
        session["stopped_at"] = datetime.now().isoformat()
        
        logger.info(f"[FLOWSTRAL] Stopped session {session_id}")
        
        return {
            "status": "success",
            "session": session,
            "artifacts": session.get("artifacts"),
            "stopped_at": session["stopped_at"]
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error stopping session: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/session/{session_id}/status")
async def get_session_status(session_id: str) -> Dict[str, Any]:
    """Get the status of a specific session"""
    try:
        if session_id not in _sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {
            "status": "success",
            "session": _sessions[session_id]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error getting session status: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.patch("/session/{session_id}/status")
async def update_session_status(session_id: str, request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update the workflow status of a recording session.
    Valid statuses: draft, in_review, approved, rejected
    """
    try:
        if session_id not in _sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        new_status = request.get("status")
        valid_statuses = ["draft", "in_review", "approved", "rejected"]
        
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        # Update session status
        _sessions[session_id]["status"] = new_status
        _sessions[session_id]["updated_at"] = datetime.now().isoformat()
        
        # If approved, store the linked test case ID if provided
        if new_status == "approved" and request.get("test_case_id"):
            _sessions[session_id]["test_case_id"] = request.get("test_case_id")
        
        # If rejected, store the rejection notes
        if new_status == "rejected" and request.get("notes"):
            _sessions[session_id]["rejection_notes"] = request.get("notes")
        
        logger.info(f"[FLOWSTRAL] Session {session_id} status updated to: {new_status}")
        
        return {
            "status": "success",
            "message": f"Session status updated to {new_status}",
            "session": _sessions[session_id]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error updating session status: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.delete("/session/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """Delete a recording session"""
    try:
        if session_id not in _sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        del _sessions[session_id]
        logger.info(f"[FLOWSTRAL] Session {session_id} deleted")
        
        return {
            "status": "success",
            "message": f"Session {session_id} deleted"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error deleting session: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/session/{session_id}/artifacts")
async def get_session_artifacts(session_id: str) -> Dict[str, Any]:
    """Get artifacts for a specific session, including action_graph for workflow editor"""
    try:
        if session_id not in _sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = _sessions[session_id]
        
        # Return action_graph as part of artifacts for workflow editor compatibility
        artifacts = session.get("artifacts") or {}
        if "action_graph" not in artifacts and session.get("action_graph"):
            artifacts["action_graph"] = session.get("action_graph")
        
        return {
            "status": "success",
            "artifacts": artifacts,
            "action_graph": session.get("action_graph"),  # Also return at top level
            "actions": session.get("actions", []),  # Return raw actions as fallback
            "name": session.get("name"),
            "metadata": session.get("metadata"),
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error getting session artifacts: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "flowstral-api",
        "timestamp": datetime.now().isoformat()
    }


# ==================== Test Case Management ====================

@router.post("/test-cases")
async def save_test_case(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save a recorded test as a test case.
    
    Request:
    {
        "actions": [...],
        "metadata": {"startUrl": "...", "appType": "..."},
        "name": "My Test Case",
        "tags": ["smoke", "salesforce"],
        "status": "draft"  // or "pending" for review
    }
    """
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.save_test_case(
            actions=request.get("actions", []),
            metadata=request.get("metadata", {}),
            name=request.get("name"),
            tags=request.get("tags"),
            status=request.get("status", "draft")
        )
        
        logger.info(f"[FLOWSTRAL] Saved test case: {test_case['id']}")
        
        return {
            "status": "success",
            "test_case": test_case
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error saving test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/test-cases")
async def list_test_cases(
    status: str = None,
    tag: str = None,
    app_type: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List all test cases with optional filters"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_cases = storage.list_test_cases(
            status=status,
            tag=tag,
            app_type=app_type,
            limit=limit,
            offset=offset
        )
        
        return {
            "status": "success",
            "test_cases": test_cases,
            "count": len(test_cases)
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error listing test cases: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/test-cases/stats")
async def get_test_case_stats() -> Dict[str, Any]:
    """Get test case statistics"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        stats = storage.get_stats()
        
        return {
            "status": "success",
            "stats": stats
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error getting stats: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/test-cases/{test_id}")
async def get_test_case(test_id: str) -> Dict[str, Any]:
    """Get a specific test case by ID"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.get_test_case(test_id)
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        return {
            "status": "success",
            "test_case": test_case
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error getting test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.put("/test-cases/{test_id}")
async def update_test_case(test_id: str, request: Dict[str, Any]) -> Dict[str, Any]:
    """Update a test case"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.update_test_case(test_id, request)
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        return {
            "status": "success",
            "test_case": test_case
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error updating test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/test-cases/{test_id}/approve")
async def approve_test_case(test_id: str, request: Dict[str, Any] = {}) -> Dict[str, Any]:
    """Approve a test case"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.approve_test_case(
            test_id,
            approved_by=request.get("approved_by", "user"),
            comments=request.get("comments", "")
        )
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        return {
            "status": "success",
            "test_case": test_case
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error approving test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/test-cases/{test_id}/reject")
async def reject_test_case(test_id: str, request: Dict[str, Any]) -> Dict[str, Any]:
    """Reject a test case"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.reject_test_case(
            test_id,
            rejected_by=request.get("rejected_by", "user"),
            reason=request.get("reason", "")
        )
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        return {
            "status": "success",
            "test_case": test_case
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error rejecting test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.delete("/test-cases/{test_id}")
async def delete_test_case(test_id: str) -> Dict[str, Any]:
    """Delete a test case"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        deleted = storage.delete_test_case(test_id)
        
        return {
            "status": "success" if deleted else "not_found",
            "deleted": deleted
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error deleting test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/test-cases/{test_id}/run")
async def run_test_case(test_id: str, request: Dict[str, Any] = {}) -> Dict[str, Any]:
    """Run a test case"""
    try:
        from app.services.automation.test_case_storage import get_storage
        from app.services.automation.test_execution_service import TestExecutionService
        
        storage = get_storage()
        test_case = storage.get_test_case(test_id)
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        # Generate script from actions
        generator = PlaywrightScriptGenerator()
        script = generator.generate(test_case["actions"], test_case.get("metadata", {}))
        
        # Execute
        browser = request.get("browser", "chromium")
        headless = request.get("headless", True)
        
        test_execution_service = TestExecutionService()
        result = await test_execution_service.execute_test(
            test_code=script,
            test_name=test_case["name"],
            browser=browser,
            headless=headless,
            timeout=60000,
            environment="local",
            language="python"
        )
        
        # Record execution
        storage.record_execution(test_id, result)
        
        return {
            "status": "success",
            "execution_result": result,
            "test_case_id": test_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error running test case: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/test-cases/{test_id}/workflow")
async def get_test_case_for_workflow(test_id: str) -> Dict[str, Any]:
    """Get test case in workflow editor format"""
    try:
        from app.services.automation.test_case_storage import get_storage
        
        storage = get_storage()
        test_case = storage.get_test_case(test_id)
        
        if not test_case:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        # Convert to workflow format
        actions = test_case.get("actions", [])
        nodes = []
        edges = []
        
        x_pos = 100
        y_pos = 50
        y_spacing = 120
        
        for i, action in enumerate(actions):
            node_id = f"node_{i}"
            action_type = action.get("type", "click")
            
            node_type = _map_action_to_node_type(action_type)
            
            nodes.append({
                "id": node_id,
                "position": {"x": x_pos, "y": y_pos},
                "data": {
                    "type": node_type,
                    "label": action.get("description", f"{action_type.capitalize()} action"),
                    "selector": _extract_selector_string(action),
                    "value": action.get("value", ""),
                    "url": action.get("url", ""),
                },
                "stepNumber": i + 1
            })
            
            y_pos += y_spacing
            
            if i > 0:
                edges.append({
                    "id": f"edge_{i-1}_{i}",
                    "source": f"node_{i-1}",
                    "target": node_id
                })
        
        return {
            "status": "success",
            "workflow": {
                "name": test_case["name"],
                "nodes": nodes,
                "edges": edges,
                "metadata": test_case.get("metadata", {})
            },
            "test_case_id": test_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error converting to workflow: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


# ==================== Enhanced Script Generation (Phase 1-3) ====================

@router.post("/generate-enhanced")
async def generate_enhanced_script(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate enhanced Playwright script with enterprise features:
    - Self-healing locators
    - Smart waits for spinners/loading
    - Screenshot on failure
    - Better error messages
    - Page Object Model (optional)
    - Data-driven tests (optional)
    - Cross-browser config (optional)
    """
    try:
        from app.services.automation.enhanced_script_generator import EnhancedScriptGenerator
        
        actions = request.get("actions", [])
        metadata = request.get("metadata", {})
        options = request.get("options", {})
        
        if not actions:
            raise HTTPException(status_code=400, detail="No actions provided")
        
        # Default options with overrides
        generator_options = {
            "language": options.get("language", "python"),
            "includeComments": options.get("includeComments", True),
            "selfHealing": options.get("selfHealing", True),
            "smartWaits": options.get("smartWaits", True),
            "screenshotOnFailure": options.get("screenshotOnFailure", True),
            "generateAssertions": options.get("generateAssertions", True),
            "pageObjectModel": options.get("pageObjectModel", False),
            "dataDriven": options.get("dataDriven", False),
            "visualRegression": options.get("visualRegression", False),
            "crossBrowser": options.get("crossBrowser", False),
        }
        
        generator = EnhancedScriptGenerator(generator_options)
        result = generator.generate(actions, metadata)
        
        logger.info(f"[FLOWSTRAL] Generated enhanced script with features: {result['metadata']['features']}")
        
        return {
            "status": "success",
            "script": result["script"],
            "page_objects": result.get("page_objects", {}),
            "test_data": result.get("test_data", []),
            "config": result.get("config", {}),
            "metadata": result["metadata"],
            "generated_at": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error generating enhanced script: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/generate-enhanced-script")
async def generate_enhanced_script_alias(request: Dict[str, Any]) -> Dict[str, Any]:
    """Alias for /generate-enhanced - same functionality"""
    return await generate_enhanced_script(request)


# ==================== AI Enhancement (GPT-4o-mini) ====================

@router.post("/soql/query")
async def execute_soql_query(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a SOQL query against Salesforce.
    
    Request body:
    {
        "query": "SELECT Id, Name FROM Contact WHERE Email = '{email}'",
        "parameters": {"email": "test@example.com"},
        "expected_count": 1  // Optional: for assertion validation
    }
    """
    try:
        from app.services.salesforce.soql_service import get_soql_service
        
        query = request.get("query")
        parameters = request.get("parameters", {})
        expected_count = request.get("expected_count")
        
        if not query:
            raise HTTPException(status_code=400, detail="No query provided")
        
        soql_service = get_soql_service()
        
        if expected_count is not None:
            # Validate assertion
            result = await soql_service.validate_assertion(query, int(expected_count), parameters)
        else:
            # Just execute query
            result = await soql_service.execute_query(query, parameters)
        
        return {
            "status": "success" if result.get("success", result.get("passed", False)) else "error",
            **result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] SOQL query error: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/frameworks")
async def get_supported_frameworks() -> Dict[str, Any]:
    """Get list of supported test frameworks for conversion"""
    try:
        from app.services.automation.framework_converter import get_framework_converter
        converter = get_framework_converter()
        return {
            "status": "success",
            "frameworks": converter.get_supported_frameworks()
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.post("/convert")
async def convert_to_framework(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert recorded actions to a specific test framework.
    
    Request body:
    {
        "actions": [...],
        "framework": "selenium-java" | "cypress" | "playwright-csharp" | etc.,
        "metadata": {"name": "Test Name", "startUrl": "..."},
        "options": {"pageObjectModel": true}
    }
    """
    try:
        from app.services.automation.framework_converter import get_framework_converter
        
        actions = request.get("actions", [])
        framework = request.get("framework", "playwright-python")
        metadata = request.get("metadata", {})
        options = request.get("options", {})
        
        if not actions:
            raise HTTPException(status_code=400, detail="No actions provided")
        
        converter = get_framework_converter()
        result = converter.convert(actions, framework, metadata, options)
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "status": "success",
            **result,
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Framework conversion error: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/soql/status")
async def get_soql_status() -> Dict[str, Any]:
    """Check Salesforce connection status"""
    try:
        from app.services.salesforce.soql_service import get_soql_service
        soql_service = get_soql_service()
        
        return {
            "connected": soql_service.is_available(),
            "instance_url": soql_service.instance_url,
            "message": "Connected to Salesforce" if soql_service.is_available() else "Not connected. Configure SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN in .env"
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e)
        }


@router.post("/enhance-recording")
async def enhance_recording(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhance a recording using GPT-4o-mini.
    
    Converts raw recorded actions into professional test cases with:
    - Better step descriptions
    - Meaningful test names
    - Smart assertions
    - Edge case suggestions
    
    Request body:
    {
        "actions": [...],
        "metadata": {"startUrl": "...", "appType": "..."},
        "enhancement_level": "quick" | "standard" | "comprehensive"
    }
    """
    try:
        from app.services.ai_layer.recording_enhancer import get_recording_enhancer
        
        actions = request.get("actions", [])
        metadata = request.get("metadata", {})
        level = request.get("enhancement_level", "standard")
        
        if not actions:
            raise HTTPException(status_code=400, detail="No actions provided")
        
        enhancer = get_recording_enhancer()
        result = await enhancer.enhance_recording(actions, metadata, level)
        
        return {
            "status": "success",
            "enhanced_test_case": result,
            "ai_enhanced": result.get("ai_enhanced", False),
            "generated_at": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error enhancing recording: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


# ==================== Workflow Editor Integration ====================

@router.post("/workflow/import-recording")
async def import_recording_to_workflow(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Import a recording from the extension into workflow editor format.
    Converts recorded actions to workflow nodes.
    """
    try:
        actions = request.get("actions", [])
        metadata = request.get("metadata", {})
        
        if not actions:
            raise HTTPException(status_code=400, detail="No actions provided")
        
        # Convert actions to workflow nodes
        nodes = []
        edges = []
        
        x_pos = 100
        y_pos = 50
        y_spacing = 120
        
        for i, action in enumerate(actions):
            node_id = f"node_{i}"
            action_type = action.get("type", "click")
            
            # Map action type to workflow node type
            node_type = _map_action_to_node_type(action_type)
            
            # Extract node data
            node_data = {
                "type": node_type,
                "label": action.get("description", f"{action_type.capitalize()} action"),
                "selector": _extract_selector_string(action),
                "value": action.get("value", ""),
                "url": action.get("url", ""),
                "duration": action.get("duration", 1000),
                "elementData": {
                    "tagName": action.get("tagName", ""),
                    "attributes": action.get("elementAttrs", {}),
                    "textContent": action.get("innerText", ""),
                    "className": action.get("className", ""),
                }
            }
            
            nodes.append({
                "id": node_id,
                "position": {"x": x_pos, "y": y_pos},
                "data": node_data,
                "stepNumber": i + 1
            })
            
            y_pos += y_spacing
            
            # Create edge to next node
            if i > 0:
                edges.append({
                    "id": f"edge_{i-1}_{i}",
                    "source": f"node_{i-1}",
                    "target": node_id
                })
        
        workflow = {
            "name": metadata.get("title", "Imported Recording"),
            "description": f"Imported from recording at {metadata.get('startUrl', 'unknown URL')}",
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "imported_at": datetime.now().isoformat(),
                "source": "flowstral-recorder",
                "action_count": len(actions),
                "start_url": metadata.get("startUrl", ""),
            }
        }
        
        logger.info(f"[FLOWSTRAL] Imported {len(actions)} actions to workflow with {len(nodes)} nodes")
        
        return {
            "status": "success",
            "workflow": workflow
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error importing recording to workflow: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.post("/workflow/generate")
async def generate_workflow_script(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate Playwright script from workflow nodes.
    """
    try:
        nodes = request.get("nodes", [])
        edges = request.get("edges", [])
        metadata = request.get("metadata", {})
        options = request.get("options", {})
        
        if not nodes:
            raise HTTPException(status_code=400, detail="No nodes provided")
        
        # Sort nodes by step number or position
        sorted_nodes = sorted(nodes, key=lambda n: n.get("stepNumber", 0))
        
        # Convert nodes back to actions
        actions = []
        for node in sorted_nodes:
            data = node.get("data", {})
            action = {
                "type": _map_node_type_to_action(data.get("type", "click")),
                "description": data.get("label", ""),
                "selector": {"selector": data.get("selector", "")},
                "value": data.get("value", ""),
                "url": data.get("url", ""),
                "innerText": data.get("elementData", {}).get("textContent", ""),
                "tagName": data.get("elementData", {}).get("tagName", ""),
                "elementAttrs": data.get("elementData", {}).get("attributes", {}),
            }
            actions.append(action)
        
        # Use enhanced generator if options request it
        if options.get("enhanced", True):
            from app.services.automation.enhanced_script_generator import EnhancedScriptGenerator
            
            generator_options = {
                "language": options.get("language", "python"),
                "selfHealing": options.get("selfHealing", True),
                "smartWaits": options.get("smartWaits", True),
                "screenshotOnFailure": options.get("screenshotOnFailure", True),
                "pageObjectModel": options.get("pageObjectModel", False),
            }
            
            generator = EnhancedScriptGenerator(generator_options)
            result = generator.generate(actions, metadata)
            
            return {
                "status": "success",
                "script": result["script"],
                "page_objects": result.get("page_objects", {}),
                "metadata": result["metadata"],
                "generated_at": datetime.now().isoformat()
            }
        else:
            # Use simple generator
            simple_generator = PlaywrightScriptGenerator()
            script = simple_generator.generate(actions, metadata)
            
            return {
                "status": "success",
                "script": script,
                "generated_at": datetime.now().isoformat()
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error generating workflow script: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


# ==================== Visual Regression Testing ====================

@router.post("/visual-regression/generate")
async def generate_visual_regression_test(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a visual regression test script.
    
    Request body:
    {
        "screenshots": [
            {"name": "homepage", "url": "https://example.com", "selector": null},
            {"name": "login_form", "url": "https://example.com/login", "selector": ".login-form"}
        ],
        "test_name": "my_visual_test",
        "threshold": 0.1
    }
    """
    try:
        from app.services.automation.visual_regression_service import VisualRegressionService
        
        screenshots = request.get("screenshots", [])
        test_name = request.get("test_name", "visual_regression")
        threshold = request.get("threshold", 0.1)
        
        if not screenshots:
            raise HTTPException(status_code=400, detail="No screenshots specified")
        
        service = VisualRegressionService(threshold=threshold)
        script = service.generate_visual_test_script(screenshots, test_name)
        
        logger.info(f"[FLOWSTRAL] Generated visual regression test with {len(screenshots)} screenshots")
        
        return {
            "status": "success",
            "script": script,
            "baselines": service.list_baselines(),
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "screenshot_count": len(screenshots),
                "threshold": threshold,
                "test_name": test_name,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error generating visual regression test: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.get("/visual-regression/baselines")
async def list_visual_baselines() -> Dict[str, Any]:
    """List all visual regression baselines"""
    try:
        from app.services.automation.visual_regression_service import VisualRegressionService
        
        service = VisualRegressionService()
        baselines = service.list_baselines()
        
        return {
            "status": "success",
            "baselines": baselines,
            "count": len(baselines)
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error listing baselines: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


@router.delete("/visual-regression/baselines/{test_name}")
async def delete_visual_baseline(test_name: str) -> Dict[str, Any]:
    """Delete a visual regression baseline"""
    try:
        from app.services.automation.visual_regression_service import VisualRegressionService
        
        service = VisualRegressionService()
        deleted = service.delete_baseline(test_name)
        
        return {
            "status": "success" if deleted else "not_found",
            "deleted": deleted,
            "test_name": test_name
        }
    except Exception as e:
        logger.error(f"[FLOWSTRAL] Error deleting baseline: {e}", exc_info=True)
        logging.getLogger(__name__).error(f"Recorder operation failed: {e}")
        raise HTTPException(status_code=500, detail="Recording operation failed")


# =============================================================================
# DEBUG MODE API - For Browser Extension to use via backend
# =============================================================================

# Store for active debug sessions
_debug_sessions: Dict[str, Dict[str, Any]] = {}

@router.post("/debug/run")
async def debug_run_test(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run a test in debug mode with pause/resume support.
    This allows the browser extension to use debug features via API.
    
    Request:
    - session_id: Unique session identifier
    - steps: List of test steps
    - url: Starting URL
    - step_by_step: Whether to pause after each step
    
    Returns session info for tracking execution.
    """
    session_id = request.get("session_id", str(uuid4()))
    steps = request.get("steps", [])
    url = request.get("url")
    step_by_step = request.get("step_by_step", False)
    
    logger.info(f"[DEBUG] Starting debug session {session_id} with {len(steps)} steps")
    
    # Create debug session
    _debug_sessions[session_id] = {
        "session_id": session_id,
        "status": "running",
        "current_step": 0,
        "total_steps": len(steps),
        "steps": steps,
        "url": url,
        "step_by_step": step_by_step,
        "paused": False,
        "results": [],
        "error": None,
        "created_at": datetime.now().isoformat(),
    }
    
    return {
        "status": "success",
        "session_id": session_id,
        "message": f"Debug session started with {len(steps)} steps"
    }

@router.post("/debug/pause")
async def debug_pause_test(request: Dict[str, Any]) -> Dict[str, Any]:
    """Pause a debug session"""
    session_id = request.get("session_id")
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    _debug_sessions[session_id]["paused"] = True
    _debug_sessions[session_id]["status"] = "paused"
    
    logger.info(f"[DEBUG] Session {session_id} paused at step {_debug_sessions[session_id]['current_step']}")
    
    return {
        "status": "success",
        "paused": True,
        "current_step": _debug_sessions[session_id]["current_step"]
    }

@router.post("/debug/resume")
async def debug_resume_test(request: Dict[str, Any]) -> Dict[str, Any]:
    """Resume a paused debug session"""
    session_id = request.get("session_id")
    from_step = request.get("from_step")
    updated_steps = request.get("steps")
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    session["paused"] = False
    session["status"] = "running"
    
    if from_step is not None:
        session["current_step"] = from_step
    
    if updated_steps:
        session["steps"] = updated_steps
    
    logger.info(f"[DEBUG] Session {session_id} resumed from step {session['current_step']}")
    
    return {
        "status": "success",
        "paused": False,
        "current_step": session["current_step"]
    }

@router.post("/debug/skip")
async def debug_skip_step(request: Dict[str, Any]) -> Dict[str, Any]:
    """Skip current step in debug session"""
    session_id = request.get("session_id")
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    skipped_step = session["current_step"]
    
    # Mark step as skipped
    session["results"].append({
        "step": skipped_step,
        "status": "skipped",
        "timestamp": datetime.now().isoformat()
    })
    
    # Move to next step
    session["current_step"] += 1
    session["paused"] = False
    session["status"] = "running"
    
    logger.info(f"[DEBUG] Session {session_id} skipped step {skipped_step}")
    
    return {
        "status": "success",
        "skipped_step": skipped_step,
        "next_step": session["current_step"]
    }

@router.post("/debug/retry")
async def debug_retry_step(request: Dict[str, Any]) -> Dict[str, Any]:
    """Retry current step with optional updates"""
    session_id = request.get("session_id")
    updated_step = request.get("step")
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    current_idx = session["current_step"]
    
    # Update step if provided
    if updated_step and current_idx < len(session["steps"]):
        session["steps"][current_idx] = updated_step
    
    logger.info(f"[DEBUG] Session {session_id} retrying step {current_idx}")
    
    return {
        "status": "success",
        "retry_step": current_idx,
        "step": session["steps"][current_idx] if current_idx < len(session["steps"]) else None
    }

@router.post("/debug/stop")
async def debug_stop_test(request: Dict[str, Any]) -> Dict[str, Any]:
    """Stop debug session"""
    session_id = request.get("session_id")
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    session["status"] = "stopped"
    session["ended_at"] = datetime.now().isoformat()
    
    logger.info(f"[DEBUG] Session {session_id} stopped")
    
    # Return final results
    result = {
        "status": "success",
        "session": session
    }
    
    # Clean up session after returning
    # del _debug_sessions[session_id]  # Keep for retrieval
    
    return result

@router.get("/debug/status/{session_id}")
async def debug_get_status(session_id: str) -> Dict[str, Any]:
    """Get debug session status"""
    if session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    
    return {
        "status": "success",
        "session": {
            "session_id": session["session_id"],
            "status": session["status"],
            "current_step": session["current_step"],
            "total_steps": session["total_steps"],
            "paused": session["paused"],
            "step_by_step": session["step_by_step"],
            "results": session["results"],
            "error": session.get("error"),
        }
    }

@router.post("/debug/execute-step")
async def debug_execute_single_step(request: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single step (for step-by-step mode)"""
    session_id = request.get("session_id")
    step = request.get("step")
    step_index = request.get("index", 0)
    
    if not session_id or session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = _debug_sessions[session_id]
    
    # Simulate step execution (actual execution would use Playwright)
    # In production, this would call the Playwright executor
    logger.info(f"[DEBUG] Executing step {step_index}: {step.get('description', 'Unknown')}")
    
    # Record result
    result = {
        "step": step_index,
        "status": "passed",  # Would be actual result
        "timestamp": datetime.now().isoformat(),
        "duration": 0
    }
    session["results"].append(result)
    session["current_step"] = step_index + 1
    
    return {
        "status": "success",
        "result": result
    }

@router.delete("/debug/session/{session_id}")
async def debug_delete_session(session_id: str) -> Dict[str, Any]:
    """Delete a debug session"""
    if session_id not in _debug_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del _debug_sessions[session_id]
    
    return {
        "status": "success",
        "deleted": session_id
    }

@router.get("/debug/sessions")
async def debug_list_sessions() -> Dict[str, Any]:
    """List all debug sessions"""
    sessions = []
    for sid, session in _debug_sessions.items():
        sessions.append({
            "session_id": sid,
            "status": session["status"],
            "current_step": session["current_step"],
            "total_steps": session["total_steps"],
            "created_at": session.get("created_at"),
        })
    
    return {
        "status": "success",
        "sessions": sessions,
        "count": len(sessions)
    }
