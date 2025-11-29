"""
WebSocket Connection Manager for Flowstral Progress Updates
Manages WebSocket connections and broadcasts progress updates
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
import asyncio

logger = logging.getLogger(__name__)


class FlowstralWebSocketManager:
    """
    Manages WebSocket connections for Flowstral sessions
    Allows broadcasting progress updates to connected clients
    """
    
    def __init__(self):
        # Map session_id -> List of WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}
        logger.info("FlowstralWebSocketManager initialized")
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept and register a WebSocket connection"""
        await websocket.accept()
        
        if session_id not in self.connections:
            self.connections[session_id] = []
        
        self.connections[session_id].append(websocket)
        logger.info(f"WebSocket connected for session {session_id} (total: {len(self.connections[session_id])})")
    
    def disconnect(self, websocket: WebSocket, session_id: str):
        """Remove a WebSocket connection"""
        if session_id in self.connections:
            if websocket in self.connections[session_id]:
                self.connections[session_id].remove(websocket)
                logger.info(f"WebSocket disconnected for session {session_id} (remaining: {len(self.connections[session_id])})")
            
            # Clean up empty lists
            if not self.connections[session_id]:
                del self.connections[session_id]
    
    async def send_progress(
        self,
        session_id: str,
        message: str,
        progress: int,
        artifact: Optional[str] = None,
        status: str = "processing"  # processing, completed, error
    ):
        """
        Send progress update to all connected clients for a session
        
        Args:
            session_id: Session ID
            message: Progress message
            progress: Progress percentage (0-100)
            artifact: Artifact name being processed (optional)
            status: Status of the artifact (processing, completed, error)
        """
        if session_id not in self.connections:
            return
        
        update = {
            "type": "progress",
            "session_id": session_id,
            "message": message,
            "progress": progress,
            "artifact": artifact,
            "status": status,
            "timestamp": None  # Will be set by datetime
        }
        
        # Import here to avoid circular imports
        from datetime import datetime
        update["timestamp"] = datetime.utcnow().isoformat()
        
        # Send to all connected clients
        disconnected = []
        for websocket in self.connections[session_id]:
            try:
                await websocket.send_json(update)
            except Exception as e:
                logger.warning(f"Failed to send progress to WebSocket: {e}")
                disconnected.append(websocket)
        
        # Remove disconnected connections
        for ws in disconnected:
            self.disconnect(ws, session_id)
        
        logger.debug(f"Sent progress update to {len(self.connections[session_id])} clients: {message} ({progress}%)")
    
    async def send_artifact_complete(
        self,
        session_id: str,
        artifact: str,
        artifact_data: Optional[Dict[str, Any]] = None
    ):
        """Send artifact completion notification"""
        await self.send_progress(
            session_id=session_id,
            message=f"{artifact} completed",
            progress=100,
            artifact=artifact,
            status="completed"
        )
    
    async def send_error(
        self,
        session_id: str,
        artifact: str,
        error_message: str
    ):
        """Send error notification"""
        await self.send_progress(
            session_id=session_id,
            message=f"Error in {artifact}: {error_message}",
            progress=0,
            artifact=artifact,
            status="error"
        )
    
    async def cleanup(self):
        """Close all WebSocket connections during shutdown"""
        logger.info("Cleaning up WebSocket connections...")
        disconnected_count = 0
        for session_id, websockets in list(self.connections.items()):
            for websocket in websockets:
                try:
                    await websocket.close()
                    disconnected_count += 1
                except Exception as e:
                    logger.debug(f"Error closing WebSocket: {e}")
        self.connections.clear()
        logger.info(f"Closed {disconnected_count} WebSocket connections")


# Global WebSocket manager instance
flowstral_ws_manager = FlowstralWebSocketManager()

