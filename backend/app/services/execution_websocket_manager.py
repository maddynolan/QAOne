"""
WebSocket Connection Manager for Test Execution Progress Updates
Manages WebSocket connections and broadcasts real-time step progress
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from datetime import datetime

logger = logging.getLogger(__name__)


class ExecutionWebSocketManager:
    """
    Manages WebSocket connections for test execution sessions
    Broadcasts step-by-step progress, screenshots, and self-healing events
    """
    
    def __init__(self):
        # Map execution_id -> List of WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}
        logger.info("ExecutionWebSocketManager initialized")
    
    async def connect(self, websocket: WebSocket, execution_id: str):
        """Accept and register a WebSocket connection"""
        await websocket.accept()
        
        if execution_id not in self.connections:
            self.connections[execution_id] = []
        
        self.connections[execution_id].append(websocket)
        logger.info(f"Execution WebSocket connected for {execution_id} (total: {len(self.connections[execution_id])})")
    
    def disconnect(self, websocket: WebSocket, execution_id: str):
        """Remove a WebSocket connection"""
        if execution_id in self.connections:
            if websocket in self.connections[execution_id]:
                self.connections[execution_id].remove(websocket)
                logger.info(f"Execution WebSocket disconnected for {execution_id}")
            
            if not self.connections[execution_id]:
                del self.connections[execution_id]
    
    async def send_step_start(
        self,
        execution_id: str,
        step_number: int,
        step_name: str,
        total_steps: int
    ):
        """Send step start notification"""
        await self._broadcast(execution_id, {
            "type": "step_start",
            "step_number": step_number,
            "step_name": step_name,
            "total_steps": total_steps,
            "status": "running",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def send_step_complete(
        self,
        execution_id: str,
        step_number: int,
        step_name: str,
        status: str,  # passed, failed, healed
        duration_ms: int,
        error: Optional[str] = None,
        screenshot: Optional[Dict[str, Any]] = None
    ):
        """Send step completion notification"""
        await self._broadcast(execution_id, {
            "type": "step_complete",
            "step_number": step_number,
            "step_name": step_name,
            "status": status,
            "duration_ms": duration_ms,
            "error": error,
            "screenshot": screenshot,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def send_self_healing(
        self,
        execution_id: str,
        step_number: int,
        original_selector: str,
        healed_selector: str,
        strategy: str = "fallback"
    ):
        """Send self-healing notification"""
        await self._broadcast(execution_id, {
            "type": "self_healing",
            "step_number": step_number,
            "original_selector": original_selector,
            "healed_selector": healed_selector,
            "strategy": strategy,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def send_screenshot(
        self,
        execution_id: str,
        step_number: int,
        screenshot_type: str,  # step, failure, assertion
        base64_data: Optional[str] = None,
        path: Optional[str] = None
    ):
        """Send screenshot capture notification"""
        await self._broadcast(execution_id, {
            "type": "screenshot",
            "step_number": step_number,
            "screenshot_type": screenshot_type,
            "base64": base64_data,
            "path": path,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def send_execution_complete(
        self,
        execution_id: str,
        status: str,  # passed, failed
        total_steps: int,
        passed_steps: int,
        failed_steps: int,
        healed_steps: int,
        duration_ms: int,
        error: Optional[str] = None
    ):
        """Send execution completion notification"""
        await self._broadcast(execution_id, {
            "type": "execution_complete",
            "status": status,
            "total_steps": total_steps,
            "passed_steps": passed_steps,
            "failed_steps": failed_steps,
            "healed_steps": healed_steps,
            "duration_ms": duration_ms,
            "error": error,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def send_log(
        self,
        execution_id: str,
        level: str,  # info, warning, error, debug
        message: str
    ):
        """Send log message"""
        await self._broadcast(execution_id, {
            "type": "log",
            "level": level,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def _broadcast(self, execution_id: str, data: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if execution_id not in self.connections:
            return
        
        data["execution_id"] = execution_id
        
        disconnected = []
        for websocket in self.connections[execution_id]:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.append(websocket)
        
        for ws in disconnected:
            self.disconnect(ws, execution_id)
    
    def get_connection_count(self, execution_id: str) -> int:
        """Get number of connected clients for an execution"""
        return len(self.connections.get(execution_id, []))
    
    async def cleanup(self):
        """Close all WebSocket connections"""
        logger.info("Cleaning up execution WebSocket connections...")
        for execution_id, websockets in list(self.connections.items()):
            for websocket in websockets:
                try:
                    await websocket.close()
                except Exception:
                    pass
        self.connections.clear()


# Global instance
execution_ws_manager = ExecutionWebSocketManager()
