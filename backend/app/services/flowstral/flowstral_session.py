"""
Flowstral Session Management
Real-time capture → Multi-modal analysis → Action Graph → Automation → Test Cases → Insights
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import asyncio

logger = logging.getLogger(__name__)


class FlowstralSession:
    """
    Manages a Flowstral session:
    - Session initialization
    - Real-time event capture
    - Action Graph construction
    - Multi-modal analysis coordination
    """
    
    def __init__(self):
        self.session_id: Optional[str] = None
        self.project_id: Optional[str] = None
        self.user_id: Optional[str] = None
        self.start_timestamp: Optional[datetime] = None
        self.is_active: bool = False
        
        # Action Graph
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.current_node_id: Optional[str] = None
        
        # Real-time outputs
        self.playwright_code: List[str] = []
        self.test_steps: List[Dict[str, Any]] = []
        self.wcag_issues: List[Dict[str, Any]] = []
        self.performance_metrics: List[Dict[str, Any]] = []
        
        # Stored artifacts (after generation)
        self.artifacts: Optional[Dict[str, Any]] = None
        self.artifacts_generated_at: Optional[str] = None
        
    def start_session(
        self,
        project_id: str,
        user_id: str,
        initial_url: str,
        initial_dom: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start a new Flowstral session"""
        self.session_id = str(uuid4())
        self.project_id = project_id
        self.user_id = user_id
        self.start_timestamp = datetime.utcnow()
        self.is_active = True
        
        # Initialize Action Graph with root node
        root_node = {
            "id": str(uuid4()),
            "event_type": "session_start",
            "target_selector": None,
            "target_text": None,
            "url": initial_url,
            "state_before": None,
            "state_after": None,
            "dom_snapshot_id": None,
            "wcag_snapshot_id": None,
            "performance_snapshot_id": None,
            "action_description": "Flowstral session started",
            "timestamp": self.start_timestamp.isoformat(),
            "metadata": {}
        }
        
        self.nodes.append(root_node)
        self.current_node_id = root_node["id"]
        
        logger.info(f"Flowstral session started: {self.session_id}")
        
        return {
            "session_id": self.session_id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "start_timestamp": self.start_timestamp.isoformat(),
            "root_node_id": root_node["id"]
        }
    
    def stop_session(self) -> Dict[str, Any]:
        """Stop Flowstral session and finalize"""
        logger.info(f"🛑 Stopping session {self.session_id}")
        logger.info(f"Session state: is_active={self.is_active}, nodes={len(self.nodes)}, edges={len(self.edges)}")
        
        if not self.is_active:
            # If already stopped, return current state instead of error
            logger.warning(f"Session {self.session_id} is already stopped")
            return {
                "session_id": self.session_id,
                "end_timestamp": datetime.utcnow().isoformat(),
                "duration_seconds": 0,
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
                "total_wcag_issues": len(self.wcag_issues),
                "total_performance_metrics": len(self.performance_metrics),
                "already_stopped": True
            }
        
        self.is_active = False
        end_timestamp = datetime.utcnow()
        
        # Add end node
        end_node = {
            "id": str(uuid4()),
            "event_type": "session_end",
            "target_selector": None,
            "target_text": None,
            "url": None,
            "state_before": self.current_node_id,
            "state_after": None,
            "dom_snapshot_id": None,
            "wcag_snapshot_id": None,
            "performance_snapshot_id": None,
            "action_description": "Flowstral session ended",
            "timestamp": end_timestamp.isoformat(),
            "metadata": {}
        }
        
        self.nodes.append(end_node)
        
        # Create edge from last node to end node
        if self.current_node_id:
            self.edges.append({
                "id": str(uuid4()),
                "from_node_id": self.current_node_id,
                "to_node_id": end_node["id"],
                "action": "session_end",
                "transition_time_ms": 0,
                "latency_ms": 0,
                "warnings": []
            })
        
        duration = (end_timestamp - self.start_timestamp).total_seconds()
        
        logger.info(f"Flowstral session stopped: {self.session_id}, duration: {duration}s")
        
        return {
            "session_id": self.session_id,
            "end_timestamp": end_timestamp.isoformat(),
            "duration_seconds": duration,
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "total_wcag_issues": len(self.wcag_issues),
            "total_performance_metrics": len(self.performance_metrics)
        }
    
    def add_node(
        self,
        event_type: str,
        target_selector: Optional[str],
        target_text: Optional[str],
        url: Optional[str],
        dom_snapshot_id: Optional[str],
        wcag_snapshot_id: Optional[str],
        performance_snapshot_id: Optional[str],
        action_description: str,
        metadata: Optional[Dict[str, Any]] = None,
        screenshot_url: Optional[str] = None
    ) -> str:
        """Add a new node to the Action Graph"""
        if not self.is_active:
            raise ValueError("Session is not active")
        
        node_id = str(uuid4())
        previous_node_id = self.current_node_id
        
        node = {
            "id": node_id,
            "event_type": event_type,
            "target_selector": target_selector,
            "target_text": target_text,
            "url": url,
            "state_before": previous_node_id,
            "state_after": None,  # Will be set by next node
            "dom_snapshot_id": dom_snapshot_id,
            "wcag_snapshot_id": wcag_snapshot_id,
            "performance_snapshot_id": performance_snapshot_id,
            "action_description": action_description,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {},
            "screenshot_url": screenshot_url  # Store screenshot base64 data URL
        }
        
        self.nodes.append(node)
        
        # Create edge from previous node to this node
        if previous_node_id:
            edge = {
                "id": str(uuid4()),
                "from_node_id": previous_node_id,
                "to_node_id": node_id,
                "action": event_type,
                "transition_time_ms": 0,  # Will be calculated
                "latency_ms": 0,  # Will be calculated
                "warnings": []
            }
            self.edges.append(edge)
        
        self.current_node_id = node_id
        
        return node_id
    
    def get_action_graph(self) -> Dict[str, Any]:
        """Get the complete Action Graph"""
        return {
            "session_id": self.session_id,
            "nodes": self.nodes,
            "edges": self.edges,
            "metadata": {
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
                "start_timestamp": self.start_timestamp.isoformat() if self.start_timestamp else None,
                "is_active": self.is_active
            }
        }
    
    def get_real_time_outputs(self) -> Dict[str, Any]:
        """Get real-time outputs for UI"""
        return {
            "playwright_code": "\n".join(self.playwright_code),
            "test_steps": self.test_steps,
            "wcag_issues": self.wcag_issues,
            "performance_metrics": self.performance_metrics,
            "current_node": self.nodes[-1] if self.nodes else None,
            "total_nodes": len(self.nodes)
        }


class FlowstralSessionManager:
    """Manages multiple Flowstral sessions"""
    
    def __init__(self):
        self.sessions: Dict[str, FlowstralSession] = {}
        logger.info(f"FlowstralSessionManager initialized. Sessions dict id: {id(self.sessions)}")
    
    def create_session(
        self,
        project_id: str,
        user_id: str,
        initial_url: str,
        initial_dom: Optional[str] = None
    ) -> FlowstralSession:
        """Create a new Flowstral session"""
        logger.info(f"Creating session. Current sessions count: {len(self.sessions)}")
        logger.info(f"Sessions dict id: {id(self.sessions)}")
        session = FlowstralSession()
        session.start_session(project_id, user_id, initial_url, initial_dom)
        self.sessions[session.session_id] = session
        logger.info(f"Session {session.session_id} stored. New sessions count: {len(self.sessions)}")
        logger.info(f"Session IDs: {list(self.sessions.keys())}")
        return session
    
    def get_session(self, session_id: str) -> Optional[FlowstralSession]:
        """Get a session by ID"""
        logger.debug(f"Getting session {session_id}. Current sessions count: {len(self.sessions)}")
        logger.debug(f"Sessions dict id: {id(self.sessions)}")
        logger.debug(f"Session IDs: {list(self.sessions.keys())}")
        session = self.sessions.get(session_id)
        if not session:
            logger.warning(f"Session {session_id} not found in manager!")
            logger.warning(f"Available session IDs: {list(self.sessions.keys())}")
        return session
    
    def stop_session(self, session_id: str) -> Dict[str, Any]:
        """Stop a session"""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        result = session.stop_session()
        return result
    
    def cleanup_session(self, session_id: str):
        """Remove a session from memory"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def list_sessions(
        self,
        project_id: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List all sessions, optionally filtered by project_id or user_id"""
        sessions_list = []
        
        for session in self.sessions.values():
            # Apply filters
            if project_id and session.project_id != project_id:
                continue
            if user_id and session.user_id != user_id:
                continue
            
            # Convert session to dict
            session_dict = {
                "session_id": session.session_id,
                "project_id": session.project_id,
                "user_id": session.user_id,
                "start_timestamp": session.start_timestamp.isoformat() if session.start_timestamp else None,
                "is_active": session.is_active,
                "node_count": len(session.nodes),
                "edge_count": len(session.edges),
                "wcag_issues_count": len(session.wcag_issues),
                "performance_metrics_count": len(session.performance_metrics)
            }
            sessions_list.append(session_dict)
        
        # Sort by start_timestamp (newest first)
        sessions_list.sort(key=lambda x: x.get("start_timestamp") or "", reverse=True)
        
        # Apply limit
        return sessions_list[:limit]
    
    def get_session_summary(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a summary of a session"""
        session = self.get_session(session_id)
        if not session:
            return None
        
        return {
            "session_id": session.session_id,
            "project_id": session.project_id,
            "user_id": session.user_id,
            "start_timestamp": session.start_timestamp.isoformat() if session.start_timestamp else None,
            "is_active": session.is_active,
            "node_count": len(session.nodes),
            "edge_count": len(session.edges),
            "wcag_issues_count": len(session.wcag_issues),
            "performance_metrics_count": len(session.performance_metrics),
            "action_graph": session.get_action_graph()
        }


# Global session manager
flowstral_session_manager = FlowstralSessionManager()

