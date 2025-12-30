"""
CDP Recorder API - REST endpoints for browser recording without extension.

This provides a complete API for:
- Starting/stopping recording sessions
- Getting live screenshots
- Retrieving recorded actions
- Generating test code from recordings
"""

import asyncio
import base64
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from ..services.cdp_recorder.session_manager import get_session_manager
from ..services.flowstral_engine.test_builder import FlowstralTestBuilder


router = APIRouter(prefix="/cdp-recorder", tags=["CDP Recorder"])


# ==================== Request/Response Models ====================

class StartSessionRequest(BaseModel):
    start_url: str
    use_persistent_context: bool = True  # For MFA persistence


class SessionResponse(BaseModel):
    session_id: str
    start_url: str
    status: str
    action_count: int
    current_url: str
    app_type: str = "generic"


class GenerateTestRequest(BaseModel):
    session_id: Optional[str] = None
    test_name: str = "Recorded Test"
    language: str = "python"  # python or typescript
    actions: Optional[List[dict]] = None  # Direct actions (for generating after stop)
    start_url: Optional[str] = None


# ==================== API Endpoints ====================

@router.post("/start")
async def start_recording(request: StartSessionRequest):
    """
    Start a new CDP recording session.
    
    This launches a browser window that the user can interact with.
    All actions are automatically recorded.
    """
    manager = get_session_manager()
    
    try:
        result = await manager.create_session(
            start_url=request.start_url,
            use_persistent_context=request.use_persistent_context,
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {
            "session_id": result.get("session_id"),
            "start_url": request.start_url,
            "status": result.get("status", "starting"),
            "action_count": 0,
            "current_url": result.get("url", request.start_url),
            "persistent_context": result.get("persistent_context", False),
            "app_type": "generic"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop/{session_id}")
async def stop_recording(session_id: str):
    """
    Stop a recording session and get all recorded actions.
    """
    manager = get_session_manager()
    result = await manager.stop_session(session_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return {
        "session_id": result.get("session_id", session_id),
        "status": "stopped",
        "action_count": result.get("total_actions", 0),
        "actions": result.get("actions", []),
    }


@router.get("/sessions")
async def list_sessions():
    """List all active recording sessions."""
    manager = get_session_manager()
    return manager.list_sessions()


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get details of a specific session."""
    manager = get_session_manager()
    service = manager.get_session(session_id)
    
    if not service:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "session_id": session_id,
        "status": service.get_status(),
        "current_url": service.get_current_url(),
        "app_type": service.get_app_type(),
        "action_count": len(service.get_actions()),
        "is_recording": service.is_recording()
    }


@router.get("/session/{session_id}/actions")
async def get_actions(session_id: str):
    """Get all recorded actions from a session, including screenshot for efficiency."""
    manager = get_session_manager()
    result = manager.get_actions(session_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return {
        "session_id": session_id,
        "actions": result.get("actions", []),
        "count": len(result.get("actions", [])),
        "url": result.get("url", ""),
        "app_type": result.get("app_type", "generic"),
        "status": result.get("status", "unknown"),
        "screenshot": result.get("screenshot")  # Include screenshot for live preview
    }


@router.get("/session/{session_id}/screenshot")
async def get_screenshot(session_id: str):
    """Get current screenshot from a session."""
    manager = get_session_manager()
    screenshot_b64 = manager.get_screenshot(session_id)
    
    if not screenshot_b64:
        raise HTTPException(status_code=404, detail="Screenshot not available")
    
    return {"screenshot": screenshot_b64}


@router.get("/session/{session_id}/analyze")
async def analyze_page(session_id: str):
    """
    Analyze current page and suggest test actions (like browser extension's Suggest tab).
    
    This performs deep page analysis to find:
    - Interactive elements (buttons, links, inputs)
    - Salesforce-specific components
    - Best selectors for each element
    - Suggested test actions
    """
    manager = get_session_manager()
    
    result = await manager.analyze_page(session_id)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up and remove a session."""
    manager = get_session_manager()
    manager.cleanup_session(session_id)
    return {"status": "cleaned up", "session_id": session_id}


class ClickRequest(BaseModel):
    x: int
    y: int


class TypeRequest(BaseModel):
    key: Optional[str] = None
    text: Optional[str] = None


@router.post("/session/{session_id}/click")
async def send_click(session_id: str, request: ClickRequest):
    """
    Send a click to the browser at specific coordinates.
    Used for interactive preview - click on preview → click in real browser.
    """
    manager = get_session_manager()
    service = manager.get_session(session_id)
    
    if not service:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Write click command to state file
    state = service._read_state() or {}
    state["pending_click"] = {"x": request.x, "y": request.y}
    service._write_state(state)
    
    return {"status": "click_sent", "x": request.x, "y": request.y}


@router.post("/session/{session_id}/type")
async def send_type(session_id: str, request: TypeRequest):
    """
    Send keyboard input to the browser.
    Used for interactive preview - type in preview → type in real browser.
    """
    manager = get_session_manager()
    service = manager.get_session(session_id)
    
    if not service:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Write type command to state file
    state = service._read_state() or {}
    state["pending_type"] = {"key": request.key, "text": request.text}
    service._write_state(state)
    
    return {"status": "type_sent", "text": request.text}


class KeyRequest(BaseModel):
    key: str


@router.post("/session/{session_id}/key")
async def send_key(session_id: str, request: KeyRequest):
    """
    Send a single key press to the browser (Enter, Tab, Escape, etc).
    """
    manager = get_session_manager()
    service = manager.get_session(session_id)
    
    if not service:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Write key command to state file
    state = service._read_state() or {}
    state["pending_key"] = request.key
    service._write_state(state)
    
    return {"status": "key_sent", "key": request.key}


@router.post("/generate-test")
async def generate_test(request: GenerateTestRequest):
    """
    Generate test code from recorded actions.
    
    Uses the Flowstral Engine's TestBuilder for robust, self-healing tests.
    Can accept either:
    - session_id to get actions from active/stopped session
    - actions directly (for generating after session cleanup)
    """
    actions = []
    start_url = request.start_url or ""
    
    # Try to get actions from session first
    if request.session_id:
        manager = get_session_manager()
        result = manager.get_actions(request.session_id)
        
        if "error" not in result:
            actions = result.get("actions", [])
            start_url = start_url or result.get("url", "")
    
    # Use directly provided actions if no session actions
    if not actions and request.actions:
        actions = request.actions
    
    if not actions:
        raise HTTPException(status_code=404, detail="No actions found. Provide session_id or actions.")
    
    # Convert CDP actions to TestBuilder format
    test_steps = []
    for action in actions:
        step = {
            'type': action.get('type', 'click'),
            'name': action.get('description', ''),
            'selector': _get_best_selector(action.get('selectors', [])),
            'value': action.get('value', ''),
            'url': action.get('url', ''),
        }
        test_steps.append(step)
    
    # Use Flowstral TestBuilder to generate robust test
    try:
        builder = FlowstralTestBuilder(app_type='auto')
        test_code = builder.build_from_recording({
            'name': request.test_name,
            'actions': test_steps,
            'url': start_url,
        })
        
        return {
            "success": True,
            "test_name": request.test_name,
            "test_code": test_code,
            "step_count": len(test_steps),
            "language": request.language,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "test_code": _generate_simple_test(request.test_name, test_steps, start_url),
        }


# ==================== WebSocket for Live Preview ====================

@router.websocket("/live/{session_id}")
async def live_preview_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for live screenshot streaming.
    
    Sends screenshots every 1 second for real-time preview.
    """
    await websocket.accept()
    manager = get_session_manager()
    
    try:
        while True:
            service = manager.get_session(session_id)
            if not service or not service.is_recording():
                await websocket.send_json({
                    "type": "status",
                    "status": "stopped"
                })
                break
            
            # Send screenshot
            screenshot = manager.get_screenshot(session_id)
            if screenshot:
                await websocket.send_json({
                    "type": "screenshot",
                    "data": screenshot
                })
            
            # Send status update
            await websocket.send_json({
                "type": "status",
                "action_count": len(service.get_actions()),
                "current_url": service.get_current_url(),
                "app_type": service.get_app_type(),
                "status": service.get_status()
            })
            
            await asyncio.sleep(1.0)  # 1 FPS to reduce load
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[CDP WS] Error: {e}")


# ==================== Helper Functions ====================

def _get_best_selector(selectors: list) -> str:
    """Get the best selector from the list."""
    if not selectors:
        return ''
    
    # Return first selector (already sorted by priority in recorder)
    if isinstance(selectors[0], str):
        return selectors[0]
    return selectors[0].get('value', '')


def _generate_simple_test(name: str, steps: list, start_url: str) -> str:
    """Generate a simple test as fallback."""
    safe_name = name.lower().replace(' ', '_').replace('-', '_')
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')
    
    lines = [
        '"""',
        f'Test: {name}',
        'Generated by CDP Recorder',
        '"""',
        '',
        'from playwright.sync_api import sync_playwright',
        '',
        f'def test_{safe_name}():',
        '    with sync_playwright() as p:',
        '        browser = p.chromium.launch(headless=False)',
        '        page = browser.new_page()',
        f'        page.goto("{start_url}")',
        '',
    ]
    
    for i, step in enumerate(steps, 1):
        step_type = step.get('type', 'click')
        selector = step.get('selector', '')
        value = step.get('value', '')
        step_name = step.get('name', f'Step {i}')
        
        lines.append(f'        # Step {i}: {step_name}')
        
        if step_type == 'click':
            if selector.startswith('#') or selector.startswith('.') or selector.startswith('['):
                lines.append(f'        page.locator("{selector}").click()')
            elif selector.startswith('text='):
                text = selector[5:].strip('"')
                lines.append(f'        page.get_by_text("{text}").click()')
            else:
                lines.append(f'        page.locator("{selector}").click()')
        elif step_type in ('fill', 'input'):
            value_escaped = value.replace('"', '\\"')
            lines.append(f'        page.locator("{selector}").fill("{value_escaped}")')
        elif step_type == 'select':
            lines.append(f'        page.locator("{selector}").select_option("{value}")')
        elif step_type == 'check':
            lines.append(f'        page.locator("{selector}").check()')
        elif step_type == 'uncheck':
            lines.append(f'        page.locator("{selector}").uncheck()')
        
        lines.append('')
    
    lines.extend([
        '        browser.close()',
        '',
        'if __name__ == "__main__":',
        f'    test_{safe_name}()',
    ])
    
    return '\n'.join(lines)
