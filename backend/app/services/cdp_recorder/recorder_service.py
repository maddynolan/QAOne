"""
CDP Recorder Service using subprocess for Playwright.
This avoids all threading/greenlet issues by running Playwright in a separate process.
"""

import asyncio
import subprocess
import json
import os
import sys
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class CDPRecorderService:
    """
    CDP-based recorder that runs Playwright in a separate subprocess.
    This eliminates all threading/greenlet issues on Windows.
    """
    
    def __init__(self, session_id: str, user_data_dir: Optional[str] = None):
        self.session_id = session_id
        self.user_data_dir = user_data_dir
        self.process: Optional[subprocess.Popen] = None
        self.actions_file: Optional[str] = None
        self._recording = False
        
        # Create temp file for communication
        temp_dir = tempfile.gettempdir()
        self.actions_file = os.path.join(temp_dir, f"cdp_recorder_{session_id}.json")
        
        logger.info(f"CDPRecorderService initialized: {session_id}")
    
    async def start_recording(self, start_url: str = "about:blank") -> Dict[str, Any]:
        """Start recording in a subprocess."""
        if self._recording:
            return {"error": "Already recording"}
        
        # Get path to subprocess script
        script_path = Path(__file__).parent / "recorder_subprocess.py"
        
        # Build command
        cmd = [
            sys.executable,
            str(script_path),
            self.session_id,
            self.actions_file
        ]
        
        if self.user_data_dir:
            cmd.append(self.user_data_dir)
        else:
            cmd.append("")  # Empty placeholder
        
        cmd.append(start_url)
        
        logger.info(f"Starting recorder subprocess: {' '.join(cmd)}")
        
        try:
            # Start subprocess
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
            )
            
            self._recording = True
            
            # Wait for recording to start
            for _ in range(50):  # Wait up to 5 seconds
                await asyncio.sleep(0.1)
                state = self._read_state()
                if state and state.get("status") == "recording":
                    return {
                        "session_id": self.session_id,
                        "status": "recording",
                        "url": state.get("current_url", start_url)
                    }
            
            # Check for errors
            state = self._read_state()
            if state and state.get("error"):
                return {"error": state["error"]}
            
            return {
                "session_id": self.session_id,
                "status": "starting",
                "url": start_url
            }
            
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            return {"error": str(e)}
    
    async def stop_recording(self) -> Dict[str, Any]:
        """Stop recording."""
        if not self._recording:
            return {"error": "Not recording"}
        
        try:
            # Signal the subprocess to stop
            state = self._read_state() or {}
            state["status"] = "stopping"
            self._write_state(state)
            
            # Wait for graceful shutdown
            for _ in range(30):  # Wait up to 3 seconds
                await asyncio.sleep(0.1)
                state = self._read_state()
                if state and state.get("status") == "stopped":
                    break
            
            # Force kill if still running
            if self.process and self.process.poll() is None:
                logger.warning("Force killing recorder subprocess")
                if sys.platform == 'win32':
                    self.process.terminate()
                else:
                    self.process.kill()
                self.process.wait(timeout=5)
            
            self._recording = False
            
            # Get final state
            state = self._read_state() or {}
            
            return {
                "session_id": self.session_id,
                "status": "stopped",
                "actions": state.get("actions", []),
                "total_actions": len(state.get("actions", []))
            }
            
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            self._recording = False
            return {"error": str(e)}
    
    def get_actions(self) -> List[Dict[str, Any]]:
        """Get current recorded actions."""
        state = self._read_state()
        if state:
            return state.get("actions", [])
        return []
    
    def get_current_url(self) -> str:
        """Get current URL."""
        state = self._read_state()
        if state:
            return state.get("current_url", "")
        return ""
    
    def get_screenshot(self) -> Optional[str]:
        """Get current screenshot as base64."""
        state = self._read_state()
        if state:
            return state.get("screenshot")
        return None
    
    def get_app_type(self) -> str:
        """Get detected app type."""
        state = self._read_state()
        if state:
            return state.get("app_type", "generic")
        return "generic"
    
    def get_status(self) -> str:
        """Get current recording status."""
        state = self._read_state()
        if state:
            return state.get("status", "unknown")
        return "unknown"
    
    def is_recording(self) -> bool:
        """Check if recording is active."""
        return self._recording and self.process is not None and self.process.poll() is None
    
    async def analyze_page(self) -> Dict[str, Any]:
        """
        Analyze current page for suggested actions.
        Sends a command to subprocess to run PageAnalyzer.
        """
        state = self._read_state()
        if not state:
            return {"error": "No active session"}
        
        # Request page analysis from subprocess
        state["analyze_request"] = True
        self._write_state(state)
        
        # Wait for analysis result (up to 5 seconds)
        for _ in range(50):
            await asyncio.sleep(0.1)
            state = self._read_state()
            if state and state.get("page_analysis"):
                analysis = state["page_analysis"]
                # Clear the analysis request
                state["analyze_request"] = False
                state["page_analysis"] = None
                self._write_state(state)
                return analysis
        
        # Fallback to static suggestions if live analysis failed
        return self._get_static_analysis(state)
    
    def _get_static_analysis(self, state: Dict) -> Dict[str, Any]:
        """Generate static analysis based on app type (fallback)."""
        app_type = state.get("app_type", "generic")
        url = state.get("current_url", "")
        
        suggested_actions = []
        
        if app_type == "salesforce":
            suggested_actions = [
                {
                    "type": "click",
                    "name": "Click App Launcher",
                    "elementType": "button",
                    "selectors": [
                        {"strategy": "css", "value": "div.slds-icon-waffle", "confidence": 0.9},
                        {"strategy": "title", "value": "[title='App Launcher']", "confidence": 0.85}
                    ]
                },
                {
                    "type": "click",
                    "name": "Click Global Search",
                    "elementType": "button",
                    "selectors": [
                        {"strategy": "css", "value": "button.slds-global-actions__item", "confidence": 0.8},
                        {"strategy": "aria", "value": "[aria-label='Search']", "confidence": 0.85}
                    ]
                },
                {
                    "type": "fill",
                    "name": "Fill Search Input",
                    "elementType": "input",
                    "selectors": [
                        {"strategy": "css", "value": "input[type='search']", "confidence": 0.9},
                        {"strategy": "placeholder", "value": "[placeholder*='Search']", "confidence": 0.8}
                    ]
                },
                {
                    "type": "click",
                    "name": "Click Home Tab",
                    "elementType": "link",
                    "selectors": [
                        {"strategy": "text", "value": "text='Home'", "confidence": 0.85}
                    ]
                },
                {
                    "type": "click",
                    "name": "Click New Button",
                    "elementType": "button",
                    "selectors": [
                        {"strategy": "text", "value": "text='New'", "confidence": 0.85},
                        {"strategy": "css", "value": "button[name='New']", "confidence": 0.8}
                    ]
                }
            ]
        elif app_type == "servicenow":
            suggested_actions = [
                {
                    "type": "fill",
                    "name": "Search Navigator",
                    "elementType": "input",
                    "selectors": [
                        {"strategy": "id", "value": "#filter", "confidence": 0.95}
                    ]
                },
                {
                    "type": "click",
                    "name": "Click Menu",
                    "elementType": "button",
                    "selectors": [
                        {"strategy": "css", "value": ".navpage-header-content", "confidence": 0.8}
                    ]
                }
            ]
        else:
            # Generic suggestions
            suggested_actions = [
                {
                    "type": "click",
                    "name": "Click Button",
                    "elementType": "button",
                    "selectors": [
                        {"strategy": "css", "value": "button", "confidence": 0.7}
                    ]
                },
                {
                    "type": "fill",
                    "name": "Fill Input",
                    "elementType": "input",
                    "selectors": [
                        {"strategy": "css", "value": "input[type='text']", "confidence": 0.7}
                    ]
                }
            ]
        
        return {
            "url": url,
            "title": "",
            "appType": app_type,
            "elements": [],
            "suggestedActions": suggested_actions
        }
    
    def _read_state(self) -> Optional[Dict]:
        """Read state from JSON file."""
        try:
            if self.actions_file and os.path.exists(self.actions_file):
                with open(self.actions_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.debug(f"Error reading state: {e}")
        return None
    
    def _write_state(self, state: Dict):
        """Write state to JSON file."""
        try:
            if self.actions_file:
                temp_file = self.actions_file + ".tmp"
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(state, f, ensure_ascii=False)
                os.replace(temp_file, self.actions_file)
        except Exception as e:
            logger.error(f"Error writing state: {e}")
    
    def cleanup(self):
        """Clean up resources."""
        self._recording = False
        
        # Kill subprocess if running
        if self.process and self.process.poll() is None:
            try:
                if sys.platform == 'win32':
                    self.process.terminate()
                else:
                    self.process.kill()
                self.process.wait(timeout=5)
            except:
                pass
        
        # Remove temp file
        if self.actions_file and os.path.exists(self.actions_file):
            try:
                os.remove(self.actions_file)
            except:
                pass
        
        logger.info(f"CDPRecorderService cleaned up: {self.session_id}")
