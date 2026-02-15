"""
Agent WebSocket API

Real-time communication with Flowstral Desktop Agents.
Supports remote control, live streaming, and orchestration.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from typing import Dict, Set, Optional
from datetime import datetime
import json
import asyncio
import logging

router = APIRouter(tags=["Agent WebSocket"])
logger = logging.getLogger(__name__)

# Connected agents registry
class AgentRegistry:
    def __init__(self):
        self.agents: Dict[str, "AgentConnection"] = {}
        self.subscribers: Dict[str, Set[WebSocket]] = {}  # agent_id -> subscribers
    
    def register(self, agent_id: str, connection: "AgentConnection"):
        self.agents[agent_id] = connection
        logger.info(f"Agent registered: {agent_id}")
    
    def unregister(self, agent_id: str):
        if agent_id in self.agents:
            del self.agents[agent_id]
            logger.info(f"Agent unregistered: {agent_id}")
    
    def get(self, agent_id: str) -> Optional["AgentConnection"]:
        return self.agents.get(agent_id)
    
    def list_all(self):
        return [
            {
                "id": agent_id,
                "status": agent.status,
                "platform": agent.platform,
                "version": agent.version,
                "connected_at": agent.connected_at.isoformat(),
                "last_heartbeat": agent.last_heartbeat.isoformat() if agent.last_heartbeat else None
            }
            for agent_id, agent in self.agents.items()
        ]
    
    def subscribe(self, agent_id: str, ws: WebSocket):
        if agent_id not in self.subscribers:
            self.subscribers[agent_id] = set()
        self.subscribers[agent_id].add(ws)
    
    def unsubscribe(self, agent_id: str, ws: WebSocket):
        if agent_id in self.subscribers:
            self.subscribers[agent_id].discard(ws)
    
    async def broadcast_to_subscribers(self, agent_id: str, message: dict):
        if agent_id in self.subscribers:
            for ws in self.subscribers[agent_id].copy():
                try:
                    await ws.send_json(message)
                except:
                    self.subscribers[agent_id].discard(ws)


class AgentConnection:
    def __init__(self, websocket: WebSocket, device_id: str, license_key: str = None):
        self.websocket = websocket
        self.device_id = device_id
        self.license_key = license_key
        self.status = "connecting"
        self.platform = None
        self.version = None
        self.connected_at = datetime.now()
        self.last_heartbeat = None
        self.current_task = None
        self.pending_requests: Dict[str, asyncio.Future] = {}
    
    async def send(self, message: dict):
        await self.websocket.send_json(message)
    
    async def request(self, message: dict, timeout: float = 30.0) -> dict:
        """Send a message and wait for response."""
        import uuid
        msg_id = str(uuid.uuid4())
        message["id"] = msg_id
        message["expectResponse"] = True
        
        future = asyncio.get_event_loop().create_future()
        self.pending_requests[msg_id] = future
        
        try:
            await self.send(message)
            return await asyncio.wait_for(future, timeout)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="Agent request timed out")
        finally:
            self.pending_requests.pop(msg_id, None)
    
    def handle_response(self, response: dict):
        """Handle a response to a pending request."""
        response_to_id = response.get("responseToId")
        if response_to_id and response_to_id in self.pending_requests:
            self.pending_requests[response_to_id].set_result(response)


# Global registry
agent_registry = AgentRegistry()


@router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for Flowstral Desktop Agents.
    
    Headers required:
    - X-Device-ID: Unique device identifier
    - X-License-Key: License key for validation
    - X-Agent-Version: Agent software version
    """
    await websocket.accept()
    
    # Extract headers
    device_id = websocket.headers.get("x-device-id")
    license_key = websocket.headers.get("x-license-key")
    version = websocket.headers.get("x-agent-version", "unknown")
    
    if not device_id:
        await websocket.close(code=4001, reason="Missing device ID")
        return
    
    # Create connection
    connection = AgentConnection(websocket, device_id, license_key)
    connection.version = version
    
    try:
        # Wait for registration message
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.close(code=4002, reason="Registration timeout")
                return
            
            if data.get("type") == "register":
                connection.platform = data.get("data", {}).get("platform")
                connection.status = "online"
                agent_registry.register(device_id, connection)
                
                # Send acknowledgment
                await connection.send({
                    "type": "registered",
                    "data": {"agentId": device_id}
                })
                break
        
        # Main message loop
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "ping":
                connection.last_heartbeat = datetime.now()
                await connection.send({"type": "pong"})
            
            elif message_type == "status":
                connection.status = data.get("status", "online")
                # Broadcast to subscribers
                await agent_registry.broadcast_to_subscribers(device_id, {
                    "type": "agent-status",
                    "agentId": device_id,
                    "status": connection.status,
                    "data": data.get("data")
                })
            
            elif message_type == "action":
                # Forward recorded action to subscribers
                await agent_registry.broadcast_to_subscribers(device_id, {
                    "type": "action-recorded",
                    "agentId": device_id,
                    "action": data.get("data")
                })
            
            elif message_type == "screenshot":
                # Forward screenshot to subscribers
                await agent_registry.broadcast_to_subscribers(device_id, {
                    "type": "screenshot",
                    "agentId": device_id,
                    "data": data.get("data")
                })
            
            elif data.get("responseToId"):
                # This is a response to a pending request
                connection.handle_response(data)
            
            else:
                logger.debug(f"Unknown message type from agent {device_id}: {message_type}")
    
    except WebSocketDisconnect:
        logger.info(f"Agent disconnected: {device_id}")
    except Exception as e:
        logger.error(f"Agent error: {device_id} - {str(e)}")
    finally:
        agent_registry.unregister(device_id)


@router.get("/api/agents")
async def list_agents():
    """List all connected agents."""
    return agent_registry.list_all()


@router.get("/api/agents/{agent_id}")
async def get_agent(agent_id: str):
    """Get details of a specific agent."""
    agent = agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {
        "id": agent_id,
        "status": agent.status,
        "platform": agent.platform,
        "version": agent.version,
        "connected_at": agent.connected_at.isoformat(),
        "last_heartbeat": agent.last_heartbeat.isoformat() if agent.last_heartbeat else None
    }


@router.post("/api/agents/{agent_id}/start-recording")
async def start_agent_recording(agent_id: str, url: str = "about:blank"):
    """Command an agent to start recording."""
    agent = agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    response = await agent.request({
        "type": "start-recording",
        "data": {"url": url}
    })
    
    return {"success": True, "response": response}


@router.post("/api/agents/{agent_id}/stop-recording")
async def stop_agent_recording(agent_id: str):
    """Command an agent to stop recording."""
    agent = agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    response = await agent.request({
        "type": "stop-recording"
    })
    
    return {"success": True, "response": response}


@router.post("/api/agents/{agent_id}/execute")
async def execute_on_agent(agent_id: str, test_data: dict):
    """Execute a test on a specific agent."""
    agent = agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    response = await agent.request({
        "type": "execute-test",
        "data": test_data
    }, timeout=300.0)  # 5 minute timeout for test execution
    
    return {"success": True, "response": response}


@router.websocket("/ws/agent/{agent_id}/subscribe")
async def subscribe_to_agent(websocket: WebSocket, agent_id: str):
    """
    Subscribe to real-time updates from a specific agent.
    
    Receives:
    - screenshot updates
    - recorded actions
    - status changes
    """
    await websocket.accept()
    
    agent = agent_registry.get(agent_id)
    if not agent:
        await websocket.close(code=4004, reason="Agent not found")
        return
    
    agent_registry.subscribe(agent_id, websocket)
    
    try:
        # Send initial status
        await websocket.send_json({
            "type": "connected",
            "agentId": agent_id,
            "agentStatus": agent.status
        })
        
        # Keep connection alive
        while True:
            # Wait for ping or any message
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        pass
    finally:
        agent_registry.unsubscribe(agent_id, websocket)

