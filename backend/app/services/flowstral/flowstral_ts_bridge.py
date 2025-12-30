"""
Flowstral TypeScript Engine Bridge
Bridges Python Flowstral backend with TypeScript Flowstral Engine
"""

import logging
import json
import subprocess
import os
import tempfile
from typing import Dict, List, Any, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

# Path to TypeScript Flowstral Engine
# Check both possible locations: flowstral-engine/ or root directory
_ROOT = Path(__file__).parent.parent.parent.parent
FLOWSTRAL_TS_ENGINE_PATH = _ROOT / "flowstral-engine"
FLOWSTRAL_TS_BRIDGE_SCRIPT = _ROOT / "flowstral-engine" / "bridge" / "generate.js"

# Fallback: if flowstral-engine doesn't exist, check root for TS files
if not FLOWSTRAL_TS_ENGINE_PATH.exists():
    FLOWSTRAL_TS_ENGINE_PATH = _ROOT
    FLOWSTRAL_TS_BRIDGE_SCRIPT = _ROOT / "flowstral-engine" / "bridge" / "generate.js"


class FlowstralTSBridge:
    """
    Bridge to TypeScript Flowstral Engine
    
    This class provides a Python interface to the TypeScript Flowstral Engine,
    which includes:
    - Application detection for 25+ enterprise apps
    - Auto-healing locator generation
    - Shadow DOM handling
    - Application-specific handlers
    - Production-ready Playwright script generation
    """
    
    def __init__(self):
        self.engine_path = FLOWSTRAL_TS_ENGINE_PATH
        self.bridge_script = FLOWSTRAL_TS_BRIDGE_SCRIPT
        
        # Check if TypeScript engine is available
        if not self.engine_path.exists():
            logger.warning(f"Flowstral TypeScript Engine not found at {self.engine_path}")
            logger.warning("Falling back to Python-only generation")
            self.available = False
        else:
            self.available = True
            logger.info(f"Flowstral TypeScript Engine available at {self.engine_path}")
    
    def is_available(self) -> bool:
        """Check if TypeScript engine is available"""
        return self.available
    
    def generate_script(
        self,
        action_graph_nodes: List[Any],
        session_id: str,
        application_type: Optional[str] = None,
        initial_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate Playwright script using TypeScript Flowstral Engine
        
        Args:
            action_graph_nodes: List of action graph nodes
            session_id: Session ID
            application_type: Detected application type (e.g., 'salesforce', 'workday')
            initial_url: Initial URL
            
        Returns:
            {
                "code": "...",
                "application": "salesforce",
                "confidence": 95,
                "locator_strategies": [...],
                "generation_time_ms": 1234
            }
        """
        if not self.available:
            raise RuntimeError("TypeScript Flowstral Engine not available")
        
        try:
            # Convert Python nodes to TypeScript-compatible format
            ts_nodes = self._convert_nodes_to_ts_format(action_graph_nodes)
            
            # Create temporary file with session data
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                session_data = {
                    "sessionId": session_id,
                    "application": application_type or "unknown",
                    "initialUrl": initial_url,
                    "nodes": ts_nodes,
                    "timestamp": int(datetime.now().timestamp() * 1000)
                }
                json.dump(session_data, f, indent=2)
                temp_file = f.name
            
            try:
                # Call TypeScript bridge script
                result = subprocess.run(
                    [
                        "node",
                        str(self.bridge_script),
                        temp_file
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    cwd=str(self.engine_path)
                )
                
                if result.returncode != 0:
                    logger.error(f"TypeScript engine failed: {result.stderr}")
                    raise RuntimeError(f"TypeScript engine error: {result.stderr}")
                
                # Parse result
                output = json.loads(result.stdout)
                
                return {
                    "code": output.get("script", ""),
                    "application": output.get("application", application_type),
                    "confidence": output.get("confidence", 0),
                    "locator_strategies": output.get("locatorStrategies", []),
                    "generation_time_ms": output.get("generationTimeMs", 0),
                    "page_object": output.get("pageObject"),
                    "warnings": output.get("warnings", [])
                }
                
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_file)
                except:
                    pass
                    
        except subprocess.TimeoutExpired:
            logger.error("TypeScript engine timed out after 30 seconds")
            raise RuntimeError("TypeScript engine timeout")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse TypeScript engine output: {e}")
            raise RuntimeError(f"Invalid output from TypeScript engine: {e}")
        except Exception as e:
            logger.error(f"Error calling TypeScript engine: {e}", exc_info=True)
            raise
    
    def _convert_nodes_to_ts_format(self, nodes: List[Any]) -> List[Dict[str, Any]]:
        """
        Convert Python action graph nodes to TypeScript Flowstral format
        
        TypeScript format expects:
        {
            id: string,
            type: 'click' | 'fill' | 'navigate' | etc,
            timestamp: number,
            element?: {
                tagName: string,
                text: string,
                ariaLabel: string,
                dataAttributes: Record<string, string>,
                ...
            },
            value?: string,
            url?: string
        }
        """
        ts_nodes = []
        
        for node in nodes:
            # Extract node properties (handle both dict and object)
            event_type = self._get_property(node, 'event_type') or self._get_property(node, 'type') or 'unknown'
            node_id = self._get_property(node, 'id') or self._get_property(node, 'node_id') or f"node_{len(ts_nodes)}"
            timestamp = self._get_property(node, 'timestamp') or self._get_property(node, 'time') or 0
            target_text = self._get_property(node, 'target_text') or ""
            target_selector = self._get_property(node, 'target_selector') or ""
            input_value = self._get_property(node, 'input_value') or self._get_property(node, 'value') or ""
            url = self._get_property(node, 'url') or ""
            
            # Normalize event type
            if event_type in ['click_button', 'click']:
                event_type = 'click'
            elif event_type in ['fill_field', 'input', 'type']:
                event_type = 'fill'
            elif event_type == 'navigate':
                event_type = 'navigate'
            
            # Extract element data from metadata
            element_data = None
            metadata = self._get_property(node, 'metadata') or {}
            if isinstance(metadata, dict):
                interacted_element = metadata.get('interacted_element') or {}
                if isinstance(interacted_element, dict) and interacted_element:
                    element_data = {
                        "tagName": interacted_element.get('tag_name') or interacted_element.get('tagName') or "",
                        "text": interacted_element.get('text_content') or interacted_element.get('textContent') or target_text or "",
                        "ariaLabel": interacted_element.get('aria_label') or interacted_element.get('ariaLabel') or "",
                        "role": interacted_element.get('role') or "",
                        "placeholder": interacted_element.get('placeholder') or "",
                        "name": interacted_element.get('name') or "",
                        "type": interacted_element.get('type') or "",
                        "id": interacted_element.get('id') or "",
                        "className": interacted_element.get('class') or interacted_element.get('className') or "",
                        "dataAttributes": interacted_element.get('attributes') or interacted_element.get('dataAttributes') or {},
                        "href": interacted_element.get('href') or "",
                        "xpath": interacted_element.get('xpath') or "",
                        "cssSelector": interacted_element.get('css_selector') or interacted_element.get('cssSelector') or target_selector or ""
                    }
            
            # Build TS node
            # Handle timestamp conversion (can be datetime, string, or number)
            ts_timestamp = 0
            if timestamp:
                if isinstance(timestamp, (int, float)):
                    ts_timestamp = int(timestamp)
                elif isinstance(timestamp, str):
                    try:
                        ts_timestamp = int(float(timestamp))
                    except (ValueError, TypeError):
                        ts_timestamp = 0
                elif hasattr(timestamp, 'timestamp'):  # datetime object
                    ts_timestamp = int(timestamp.timestamp() * 1000)  # Convert to milliseconds
                else:
                    ts_timestamp = 0
            
            ts_node = {
                "id": node_id,
                "type": event_type,
                "timestamp": ts_timestamp,
                "description": self._get_property(node, 'action_description') or target_text or event_type
            }
            
            if element_data:
                ts_node["element"] = element_data
            
            if input_value:
                ts_node["value"] = str(input_value)
            
            if url:
                ts_node["url"] = url
            
            ts_nodes.append(ts_node)
        
        return ts_nodes
    
    def _get_property(self, obj: Any, prop: str) -> Any:
        """Safely get property from object or dict"""
        try:
            if hasattr(obj, prop):
                return getattr(obj, prop)
            if isinstance(obj, dict):
                return obj.get(prop)
        except:
            pass
        return None


# Singleton instance
_ts_bridge_instance: Optional[FlowstralTSBridge] = None


def get_flowstral_ts_bridge() -> FlowstralTSBridge:
    """Get singleton instance of TypeScript bridge"""
    global _ts_bridge_instance
    if _ts_bridge_instance is None:
        _ts_bridge_instance = FlowstralTSBridge()
    return _ts_bridge_instance

