"""
Plugin API Router - External API for IDE/browser extensions
Phase 4.1: Plugin API
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime
import json
import asyncio

from app.services.core.plugin_service import PluginService
from app.services.utils.dom_recorder import DOMRecorder
from app.services.agents.automation_agent import AutomationAgent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

plugin_service = PluginService()
dom_recorder = DOMRecorder()
automation_agent = AutomationAgent()


# ==================== Authentication ====================

async def verify_api_key(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Verify API key from Authorization header"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    # Extract API key
    if authorization.startswith("Bearer "):
        api_key = authorization[7:]
    else:
        api_key = authorization
    
    # Validate
    key_data = await plugin_service.validate_api_key(api_key)
    if not key_data:
        raise HTTPException(status_code=401, detail="Invalid or expired API key")
    
    return key_data


# ==================== Request Models ====================

class RecordingUploadRequest(BaseModel):
    url: str
    title: Optional[str] = None
    snapshots: List[Dict[str, Any]]
    metadata: Optional[Dict[str, Any]] = None


class TestGenerationRequest(BaseModel):
    recording_id: Optional[str] = None
    description: Optional[str] = None
    requirement_id: Optional[str] = None


# ==================== API Endpoints ====================

@router.post("/recordings/upload")
async def upload_recording(
    request: RecordingUploadRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """Upload a DOM recording from browser extension"""
    try:
        # Parse recording
        recording_data = {
            "url": request.url,
            "title": request.title or "Recorded Session",
            "snapshots": request.snapshots,
            "metadata": request.metadata or {}
        }
        
        recording = dom_recorder.parse_recording(recording_data)
        
        # Store recording
        recording_id = await _store_recording(recording, key_data.get("tenant_id"))
        
        return {
            "status": "success",
            "recording_id": recording_id
        }
    
    except Exception as e:
        logger.error(f"Failed to upload recording: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tests/generate")
async def generate_test_from_recording(
    request: TestGenerationRequest,
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """Generate test from recording or description"""
    try:
        result = await automation_agent.generate_test(
            requirement_id=request.requirement_id,
            recording_id=request.recording_id,
            description=request.description,
            tenant_id=key_data.get("tenant_id")
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Failed to generate test: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/events")
async def websocket_events(websocket: WebSocket):
    """WebSocket endpoint for event streaming"""
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "subscribe":
                # Subscribe to events
                await websocket.send_json({
                    "type": "subscribed",
                    "channels": message.get("channels", [])
                })
            
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": "Unknown message type"
                })
    
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)


@router.get("/events/stream")
async def sse_events(
    key_data: Dict[str, Any] = Depends(verify_api_key)
):
    """Server-Sent Events endpoint for event streaming"""
    async def event_generator():
        try:
            while True:
                # In production, this would stream real events
                # For now, send heartbeat
                yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"SSE error: {e}", exc_info=True)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# ==================== Helper Functions ====================

async def _store_recording(recording: Dict[str, Any], tenant_id: Optional[str]) -> str:
    """Store recording in database"""
    import concurrent.futures
    from app.services.storage.postgres_direct import get_postgres_pool
    from uuid import uuid4
    import json
    
    pool = get_postgres_pool()
    if not pool:
        return str(uuid4())
    
    recording_id = recording.get("recording_id", str(uuid4()))
    
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        await loop.run_in_executor(
            executor,
            _store_recording_sync,
            pool,
            recording_id,
            recording,
            tenant_id
        )
    
    return recording_id


def _store_recording_sync(pool, recording_id: str, recording: Dict[str, Any], tenant_id: Optional[str]):
    """Synchronous recording insert"""
    import json
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO recordings
                (id, url, title, data, tenant_id, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                """,
                (
                    recording_id,
                    recording.get("url"),
                    recording.get("title"),
                    json.dumps(recording),
                    tenant_id
                )
            )
            conn.commit()
    finally:
        pool.putconn(conn)



