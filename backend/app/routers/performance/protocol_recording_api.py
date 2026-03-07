"""
Protocol Recording API - Endpoints for capturing HTTP traffic during browser sessions
"""

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
import json
import asyncio

from app.services.performance.protocol_recorder import protocol_recorder
from app.services.performance.headless_executor import headless_executor, ExecutionMode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/protocol-recording", tags=["protocol-recording"])


# ============================================================================
# PROTOCOL RECORDING ENDPOINTS
# ============================================================================

@router.post("/start")
async def start_recording(request: Request, body: dict):
    """
    Start a new protocol recording session.
    
    This captures all HTTP traffic that occurs during browser interactions.
    Use with Flowstral recording for combined UI + protocol recording.
    """
    try:
        recording_id = body.get("recording_id")
        name = body.get("name", "Protocol Recording")
        base_url = body.get("base_url", "")
        
        if not recording_id:
            import uuid
            recording_id = str(uuid.uuid4())
        
        await protocol_recorder.start_recording(
            recording_id=recording_id,
            name=name,
            base_url=base_url
        )
        
        return {
            "status": "success",
            "recording_id": recording_id,
            "message": "Protocol recording started"
        }
    
    except Exception as e:
        logger.error(f"Error starting recording: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start protocol recording")


@router.post("/stop/{recording_id}")
async def stop_recording(request: Request, recording_id: str):
    """Stop protocol recording and get summary"""
    try:
        recording = await protocol_recorder.stop_recording(recording_id)
        
        return {
            "status": "success",
            "recording_id": recording_id,
            "summary": {
                "total_requests": recording.total_requests,
                "total_bytes": recording.total_bytes,
                "avg_response_time": recording.avg_response_time,
                "duration_seconds": (recording.end_time or 0) - recording.start_time,
                "correlation_rules_detected": len(recording.correlation_rules)
            }
        }
    
    except ValueError as e:
        logger.error(f"Recording not found for stop: {e}")
        raise HTTPException(status_code=404, detail="Recording not found")
    except Exception as e:
        logger.error(f"Error stopping recording: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to stop protocol recording")


@router.post("/request/{recording_id}")
async def record_request(request: Request, recording_id: str, body: dict):
    """
    Record an HTTP request.
    Called by browser extension during recording.
    """
    try:
        request_id = await protocol_recorder.record_request(recording_id, body)
        
        return {
            "status": "success",
            "request_id": request_id
        }
    
    except ValueError as e:
        logger.error(f"Recording not found for request capture: {e}")
        raise HTTPException(status_code=404, detail="Recording not found")
    except Exception as e:
        logger.error(f"Error recording request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record request")


@router.post("/websocket/{recording_id}")
async def record_websocket(request: Request, recording_id: str, body: dict):
    """Record a WebSocket message"""
    try:
        await protocol_recorder.record_websocket_message(
            recording_id=recording_id,
            ws_url=body.get("url", ""),
            message=body.get("message", ""),
            direction=body.get("direction", "sent")
        )
        
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Error recording WebSocket: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to record WebSocket message")


@router.post("/action/{recording_id}")
async def link_action(request: Request, recording_id: str, body: dict):
    """Link a user action to the recording"""
    try:
        await protocol_recorder.link_user_action(recording_id, body)
        return {"status": "success"}
    
    except Exception as e:
        logger.error(f"Error linking action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to link user action")


@router.get("/recording/{recording_id}")
async def get_recording(request: Request, recording_id: str):
    """Get recording details"""
    try:
        recording = protocol_recorder.get_recording(recording_id)
        
        if not recording:
            raise HTTPException(status_code=404, detail="Recording not found")
        
        return {
            "status": "success",
            "recording": {
                "recording_id": recording.recording_id,
                "name": recording.name,
                "start_time": datetime.fromtimestamp(recording.start_time).isoformat(),
                "end_time": datetime.fromtimestamp(recording.end_time).isoformat() if recording.end_time else None,
                "base_url": recording.base_url,
                "total_requests": recording.total_requests,
                "total_bytes": recording.total_bytes,
                "avg_response_time": recording.avg_response_time,
                "requests": [
                    {
                        "request_id": r.request_id,
                        "method": r.method,
                        "url": r.url,
                        "status_code": r.status_code,
                        "duration_ms": r.duration_ms,
                        "response_size": r.response_size,
                        "request_type": r.request_type.value,
                        "detected_correlations": r.detected_correlations
                    }
                    for r in recording.requests
                ],
                "correlation_rules": recording.correlation_rules,
                "user_actions": recording.user_actions
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recording: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get recording details")


@router.get("/recordings")
async def list_recordings(request: Request):
    """List all recordings"""
    try:
        recordings = [
            {
                "recording_id": r.recording_id,
                "name": r.name,
                "start_time": datetime.fromtimestamp(r.start_time).isoformat(),
                "total_requests": r.total_requests,
                "total_bytes": r.total_bytes
            }
            for r in protocol_recorder.recordings.values()
        ]
        
        return {
            "status": "success",
            "recordings": recordings
        }
    
    except Exception as e:
        logger.error(f"Error listing recordings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list recordings")


# ============================================================================
# SCRIPT GENERATION
# ============================================================================

@router.post("/generate-script/{recording_id}")
async def generate_script(request: Request, recording_id: str, body: dict):
    """
    Generate load test script from recording.
    
    Formats: qaai (default), k6, jmeter
    """
    try:
        format = body.get("format", "qaai")
        
        script = await protocol_recorder.generate_load_script(
            recording_id=recording_id,
            format=format
        )
        
        return {
            "status": "success",
            "format": format,
            "script": script
        }
    
    except ValueError as e:
        logger.error(f"Recording not found for script generation: {e}")
        raise HTTPException(status_code=404, detail="Recording not found")
    except Exception as e:
        logger.error(f"Error generating script: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate load test script")


# ============================================================================
# HAR IMPORT/EXPORT
# ============================================================================

@router.post("/export-har/{recording_id}")
async def export_har(request: Request, recording_id: str):
    """Export recording as HAR (HTTP Archive) file"""
    try:
        har = await protocol_recorder.export_har(recording_id)
        
        return {
            "status": "success",
            "har": har
        }
    
    except ValueError as e:
        logger.error(f"Recording not found for HAR export: {e}")
        raise HTTPException(status_code=404, detail="Recording not found")
    except Exception as e:
        logger.error(f"Error exporting HAR: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to export HAR")


@router.post("/import-har")
async def import_har(request: Request, body: dict):
    """Import recording from HAR file"""
    try:
        har_data = body.get("har")
        name = body.get("name", "HAR Import")
        
        if not har_data:
            raise HTTPException(status_code=400, detail="HAR data required")
        
        recording_id = await protocol_recorder.import_har(har_data, name)
        
        recording = protocol_recorder.get_recording(recording_id)
        
        return {
            "status": "success",
            "recording_id": recording_id,
            "summary": {
                "total_requests": recording.total_requests,
                "correlation_rules_detected": len(recording.correlation_rules)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing HAR: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to import HAR data")


# ============================================================================
# HEADLESS EXECUTION
# ============================================================================

@router.post("/execute-headless")
async def execute_headless(request: Request, body: dict):
    """
    Execute a test scenario headlessly for performance testing.
    
    This runs the scenario using Playwright in headless mode,
    capturing all network traffic for protocol-level analysis.
    """
    try:
        scenario = body.get("scenario")
        base_url = body.get("base_url", "")
        virtual_users = body.get("virtual_users", 1)
        duration_seconds = body.get("duration_seconds", 60)
        ramp_up_seconds = body.get("ramp_up_seconds", 10)
        think_time_ms = body.get("think_time_ms", 1000)
        mode = body.get("mode", "headless_browser")
        
        if not scenario:
            raise HTTPException(status_code=400, detail="scenario is required")
        
        # Map mode string to enum
        mode_map = {
            "protocol_only": ExecutionMode.PROTOCOL_ONLY,
            "headless_browser": ExecutionMode.HEADLESS_BROWSER,
            "headed_debug": ExecutionMode.HEADED_DEBUG
        }
        
        exec_mode = mode_map.get(mode, ExecutionMode.HEADLESS_BROWSER)
        
        # Run load test
        report = await headless_executor.run_load_test(
            scenario=scenario,
            virtual_users=virtual_users,
            duration_seconds=duration_seconds,
            ramp_up_seconds=ramp_up_seconds,
            think_time_ms=think_time_ms,
            base_url=base_url,
            mode=exec_mode
        )
        
        return {
            "status": "success",
            "report": report
        }
    
    except Exception as e:
        logger.error(f"Error executing headless test: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to execute headless test")


@router.post("/execute-headless/stop")
async def stop_headless_execution(request: Request):
    """Stop the running headless execution"""
    try:
        await headless_executor.stop()
        
        return {
            "status": "success",
            "message": "Execution stopped"
        }
    
    except Exception as e:
        logger.error(f"Error stopping execution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to stop headless execution")


# ============================================================================
# REAL-TIME METRICS WEBSOCKET
# ============================================================================

@router.websocket("/metrics-stream")
async def metrics_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time metrics streaming.
    Sends metrics updates every second during load tests.
    """
    await websocket.accept()
    
    try:
        while True:
            # Get current metrics from headless executor
            if headless_executor.is_running:
                metrics = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "is_running": True,
                    "total_iterations": len(headless_executor.metrics),
                    "total_requests": sum(m.requests_made for m in headless_executor.metrics),
                    "failed_requests": sum(m.requests_failed for m in headless_executor.metrics),
                    "active_users": len(set(m.user_id for m in headless_executor.metrics[-100:] if m.end_time == 0)) if headless_executor.metrics else 0
                }
                
                # Calculate recent response times
                recent_times = []
                for m in headless_executor.metrics[-100:]:
                    recent_times.extend(m.response_times[-10:])
                
                if recent_times:
                    sorted_times = sorted(recent_times)
                    metrics["response_times"] = {
                        "avg": sum(sorted_times) / len(sorted_times),
                        "p95": sorted_times[int(len(sorted_times) * 0.95)] if sorted_times else 0
                    }
                
                await websocket.send_json(metrics)
            else:
                await websocket.send_json({
                    "timestamp": datetime.utcnow().isoformat(),
                    "is_running": False
                })
            
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info("Metrics WebSocket disconnected")
    except Exception as e:
        logger.error(f"Metrics WebSocket error: {e}")


# ============================================================================
# TEST CASE IMPORT FOR LOAD TESTING
# ============================================================================

@router.post("/import-test-case")
async def import_test_case_for_load(request: Request, body: dict):
    """
    Import a test case and convert it to a load test scenario.
    
    Automatically detects:
    - HTTP requests from API steps
    - Browser interactions to convert to protocol steps
    - Correlatable values
    """
    try:
        test_case = body.get("test_case")
        
        if not test_case:
            raise HTTPException(status_code=400, detail="test_case is required")
        
        # Convert test case steps to performance scenario
        scenario_steps = []
        
        for i, step in enumerate(test_case.get("steps", [])):
            step_type = step.get("type", "click")
            
            converted_step = {
                "step_id": f"step_{i}",
                "name": step.get("name") or step.get("action") or f"Step {i+1}",
                "type": step_type,
                "target": step.get("selector") or step.get("target"),
                "value": step.get("value") or step.get("text"),
                "parameters": step.get("parameters", {})
            }
            
            # Handle API steps specially
            if step_type == "api":
                converted_step["action_type"] = "http_request"
                converted_step["parameters"] = {
                    "method": step.get("method", "GET"),
                    "url": step.get("endpoint") or step.get("url"),
                    "body": step.get("body"),
                    "headers": step.get("headers", {})
                }
            
            scenario_steps.append(converted_step)
        
        # Create scenario
        scenario = {
            "scenario_id": test_case.get("id"),
            "name": f"Load Test: {test_case.get('name', 'Imported Test Case')}",
            "description": test_case.get("description", ""),
            "steps": scenario_steps,
            "source": {
                "type": "test_case",
                "test_case_id": test_case.get("id")
            }
        }
        
        # Detect potential correlation points
        correlations = _detect_correlation_opportunities(scenario_steps)
        scenario["correlation_rules"] = correlations
        
        return {
            "status": "success",
            "scenario": scenario,
            "correlation_count": len(correlations)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing test case: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to import test case for load testing")


def _detect_correlation_opportunities(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect potential correlation points in steps"""
    correlations = []
    
    # Look for common patterns that need correlation
    patterns = [
        {"name": "session_id", "patterns": ["session", "sid", "sessionid"]},
        {"name": "csrf_token", "patterns": ["csrf", "_token", "xsrf"]},
        {"name": "auth_token", "patterns": ["token", "jwt", "bearer", "auth"]},
        {"name": "user_id", "patterns": ["user_id", "userid", "uid"]},
        {"name": "request_id", "patterns": ["request_id", "requestid", "trace"]},
    ]
    
    for step in steps:
        step_text = json.dumps(step).lower()
        
        for pattern in patterns:
            for p in pattern["patterns"]:
                if p in step_text:
                    correlations.append({
                        "variable_name": pattern["name"],
                        "step_id": step.get("step_id"),
                        "extract_type": "auto",
                        "detected_in": "step_parameters"
                    })
                    break
    
    # Remove duplicates
    seen = set()
    unique_correlations = []
    for c in correlations:
        key = c["variable_name"]
        if key not in seen:
            seen.add(key)
            unique_correlations.append(c)
    
    return unique_correlations
