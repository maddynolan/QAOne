"""
Session Manager for CDP Recorder.
Manages multiple recording sessions.
"""

import uuid
import time
import os
from typing import Dict, Optional, Any
from pathlib import Path
import logging

from .recorder_service import CDPRecorderService

logger = logging.getLogger(__name__)


class CDPSessionManager:
    """Manages multiple CDP recording sessions."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.sessions: Dict[str, CDPRecorderService] = {}
        self._initialized = True
        
        # Default user data directory for persistent contexts
        self.default_user_data_dir = str(Path.home() / ".qaai" / "cdp_browser_data")
        os.makedirs(self.default_user_data_dir, exist_ok=True)
        
        logger.info("CDPSessionManager initialized")
    
    async def create_session(
        self,
        start_url: str = "about:blank",
        use_persistent_context: bool = False,
        user_data_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new recording session."""
        
        # Generate session ID
        session_id = f"cdp_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        
        # Determine user data dir
        if use_persistent_context:
            user_data_dir = user_data_dir or self.default_user_data_dir
        else:
            user_data_dir = None
        
        # Create service
        service = CDPRecorderService(
            session_id=session_id,
            user_data_dir=user_data_dir
        )
        
        # Start recording
        result = await service.start_recording(start_url)
        
        if "error" in result:
            service.cleanup()
            return result
        
        # Store session
        self.sessions[session_id] = service
        
        logger.info(f"Created session: {session_id}")
        
        return {
            "session_id": session_id,
            "status": result.get("status", "starting"),
            "url": result.get("url", start_url),
            "persistent_context": use_persistent_context
        }
    
    async def stop_session(self, session_id: str) -> Dict[str, Any]:
        """Stop a recording session."""
        
        service = self.sessions.get(session_id)
        if not service:
            return {"error": f"Session not found: {session_id}"}
        
        result = await service.stop_recording()
        
        logger.info(f"Stopped session: {session_id}")
        
        return result
    
    def get_session(self, session_id: str) -> Optional[CDPRecorderService]:
        """Get a session by ID."""
        return self.sessions.get(session_id)
    
    def get_actions(self, session_id: str) -> Dict[str, Any]:
        """Get actions for a session, including screenshot for efficiency."""
        
        service = self.sessions.get(session_id)
        
        # Try to recover session from state file if not in memory
        if not service:
            service = self._try_recover_session(session_id)
        
        if not service:
            return {"error": f"Session not found: {session_id}"}
        
        return {
            "session_id": session_id,
            "actions": service.get_actions(),
            "url": service.get_current_url(),
            "app_type": service.get_app_type(),
            "status": service.get_status(),
            "screenshot": service.get_screenshot()  # Include screenshot for single-request updates
        }
    
    def _try_recover_session(self, session_id: str) -> Optional[CDPRecorderService]:
        """Try to recover a session from its state file (useful after server reload)."""
        import tempfile
        
        state_file = os.path.join(tempfile.gettempdir(), f"cdp_recorder_{session_id}.json")
        if os.path.exists(state_file):
            try:
                # Create a service that can read the existing state file
                service = CDPRecorderService(
                    session_id=session_id,
                    user_data_dir=self.default_user_data_dir
                )
                # The service will read from the existing state file
                state = service._read_state()
                if state and state.get("status") in ("recording", "stopped"):
                    self.sessions[session_id] = service
                    logger.info(f"Recovered session from state file: {session_id}")
                    return service
            except Exception as e:
                logger.debug(f"Failed to recover session {session_id}: {e}")
        
        return None
    
    def get_screenshot(self, session_id: str) -> Optional[str]:
        """Get current screenshot for a session."""
        
        service = self.sessions.get(session_id)
        if service:
            return service.get_screenshot()
        return None
    
    def get_app_type(self, session_id: str) -> str:
        """Get detected app type for a session."""
        
        service = self.sessions.get(session_id)
        if service:
            return service.get_app_type()
        return "generic"
    
    async def analyze_page(self, session_id: str) -> Dict[str, Any]:
        """Analyze current page for a session."""
        
        service = self.sessions.get(session_id)
        if not service:
            return {"error": f"Session not found: {session_id}"}
        
        return await service.analyze_page()
    
    def cleanup_session(self, session_id: str):
        """Clean up and remove a session."""
        
        service = self.sessions.pop(session_id, None)
        if service:
            service.cleanup()
            logger.info(f"Cleaned up session: {session_id}")
    
    def cleanup_all(self):
        """Clean up all sessions."""
        
        for session_id in list(self.sessions.keys()):
            self.cleanup_session(session_id)
        
        logger.info("Cleaned up all sessions")
    
    def list_sessions(self) -> Dict[str, Any]:
        """List all active sessions."""
        
        sessions = []
        for session_id, service in self.sessions.items():
            sessions.append({
                "session_id": session_id,
                "status": service.get_status(),
                "url": service.get_current_url(),
                "app_type": service.get_app_type(),
                "actions_count": len(service.get_actions()),
                "is_recording": service.is_recording()
            })
        
        return {
            "sessions": sessions,
            "total": len(sessions)
        }


# Global instance
_session_manager: Optional[CDPSessionManager] = None


def get_session_manager() -> CDPSessionManager:
    """Get the global session manager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = CDPSessionManager()
    return _session_manager
