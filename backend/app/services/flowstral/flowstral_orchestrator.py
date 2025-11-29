"""
Flowstral Main Orchestrator
Coordinates all pipelines and generates real-time outputs
"""

import logging
import asyncio
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.flowstral.flowstral_session import FlowstralSession, flowstral_session_manager
from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.flowstral.flowstral_dom_pipeline import DOMSnapshotPipeline
from app.services.flowstral.flowstral_wcag_pipeline import WCAGPipeline
from app.services.flowstral.flowstral_performance_pipeline import PerformancePipeline
from app.services.flowstral.flowstral_realtime_output import RealTimeOutputGenerator
from app.services.flowstral.flowstral_artifacts import FlowstralArtifactsGenerator

logger = logging.getLogger(__name__)


class FlowstralOrchestrator:
    """
    Main Flowstral orchestrator
    Coordinates all 4 pipelines and generates real-time outputs
    """
    
    def __init__(self):
        self.dom_pipeline = DOMSnapshotPipeline()
        self.wcag_pipeline = WCAGPipeline()
        self.performance_pipeline = PerformancePipeline()
        self.realtime_generator = RealTimeOutputGenerator()
        self.artifacts_generator = FlowstralArtifactsGenerator()
    
    async def start_session(
        self,
        project_id: str,
        user_id: str,
        initial_url: str,
        initial_dom: Optional[str] = None
    ) -> Dict[str, Any]:
        """Start a new Flowstral session"""
        session = flowstral_session_manager.create_session(
            project_id=project_id,
            user_id=user_id,
            initial_url=initial_url,
            initial_dom=initial_dom
        )
        
        logger.info(f"[OK] Session created: {session.session_id}")
        logger.info(f"Session stored in manager: {session.session_id in flowstral_session_manager.sessions}")
        logger.info(f"Total sessions in manager: {len(flowstral_session_manager.sessions)}")
        
        # Initialize Action Graph
        action_graph = ActionGraph(session.session_id)
        
        # Capture initial DOM snapshot
        if initial_dom:
            try:
                dom_snapshot = await self.dom_pipeline.capture_snapshot(
                    html=initial_dom,
                    url=initial_url
                )
            except Exception as e:
                logger.warning(f"DOM snapshot failed: {e}", exc_info=True)
                dom_snapshot = {"dom_snapshot_id": None, "error": str(e)}
            
            try:
                # Run initial WCAG scan
                wcag_snapshot = await self.wcag_pipeline.scan_page(
                    html=initial_dom,
                    url=initial_url
                )
            except Exception as e:
                logger.warning(f"WCAG scan failed: {e}", exc_info=True)
                wcag_snapshot = {"wcag_snapshot_id": None, "violations": [], "summary": {"total": 0}, "error": str(e)}
            
            try:
                # Capture initial performance metrics
                perf_snapshot = await self.performance_pipeline.capture_metrics(
                    url=initial_url
                )
            except Exception as e:
                logger.warning(f"Performance capture failed: {e}", exc_info=True)
                perf_snapshot = {"performance_snapshot_id": None, "bottlenecks": [], "summary": {}, "error": str(e)}
            
            # Add root node to action graph
            try:
                action_graph.add_node(
                    event_type="session_start",
                    url=initial_url,
                    dom_snapshot_id=dom_snapshot.get("dom_snapshot_id"),
                    wcag_snapshot_id=wcag_snapshot.get("wcag_snapshot_id"),
                    performance_snapshot_id=perf_snapshot.get("performance_snapshot_id"),
                    action_description="Flowstral session started"
                )
            except Exception as e:
                logger.warning(f"Failed to add root node: {e}", exc_info=True)
        
        return {
            "session_id": session.session_id,
            "status": "active",
            "action_graph": action_graph.to_dict()
        }
    
    async def capture_event(
        self,
        session_id: str,
        event_type: str,
        event_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Capture a user event and run all 4 pipelines:
        - DOM Snapshot Pipeline
        - WCAG Scan Pipeline
        - Performance Probe Pipeline
        - Action Graph Update Pipeline
        """
        session = flowstral_session_manager.get_session(session_id)
        if not session:
            # Log at WARNING level since this is expected when:
            # - Session was never created via /start
            # - Session expired or backend restarted
            # - Events sent before session creation
            logger.warning(f"[WARNING] Cannot capture event: Session {session_id} not found")
            logger.debug(f"Available sessions: {list(flowstral_session_manager.sessions.keys())}")
            raise ValueError(f"Session {session_id} not found. Make sure you started the session first with /api/flowstral/start")
        
        if not session.is_active:
            logger.warning(f"[WARNING] Session {session_id} is not active (already stopped)")
            raise ValueError(f"Session {session_id} is not active")
        
        logger.debug(f"[CAPTURE] Capturing event: {event_type} for session {session_id}")
        
        # Extract event data
        html = event_data.get("html", "")
        url = event_data.get("url", "")
        interacted_element = event_data.get("interacted_element")
        page_metrics = event_data.get("page_metrics")
        component_metrics = event_data.get("component_metrics")
        network_calls = event_data.get("network_calls")
        screenshot = event_data.get("screenshot")  # Base64 data URL from extension
        
        # Run all 4 pipelines in parallel with error handling
        async def safe_dom_capture():
            try:
                return await self.dom_pipeline.capture_snapshot(html, url, interacted_element)
            except Exception as e:
                logger.warning(f"DOM snapshot failed: {e}", exc_info=True)
                return {"dom_snapshot_id": None, "selector_set": {}, "error": str(e)}
        
        async def safe_wcag_scan():
            try:
                # Check if this is a wcag_scan event with pre-scanned data
                wcag_scan_data = None
                if event_type == "wcag_scan" and event_data.get("violations"):
                    wcag_scan_data = {
                        "violations": event_data.get("violations", []),
                        "passes": event_data.get("passes", []),
                        "incomplete": event_data.get("incomplete", [])
                    }
                
                return await self.wcag_pipeline.scan_page(html, url, wcag_scan_data=wcag_scan_data)
            except Exception as e:
                logger.warning(f"WCAG scan failed: {e}", exc_info=True)
                return {"wcag_snapshot_id": None, "violations": [], "summary": {"total": 0}, "error": str(e)}
        
        async def safe_perf_capture():
            try:
                return await self.performance_pipeline.capture_metrics(url, page_metrics, component_metrics, network_calls)
            except Exception as e:
                logger.warning(f"Performance capture failed: {e}", exc_info=True)
                return {"performance_snapshot_id": None, "bottlenecks": [], "summary": {}, "error": str(e)}
        
        dom_snapshot, wcag_snapshot, perf_snapshot = await asyncio.gather(
            safe_dom_capture(), safe_wcag_scan(), safe_perf_capture()
        )
        
        # Generate selector
        selector = None
        if interacted_element:
            selector_set = dom_snapshot.get("selector_set", {})
            recommended = selector_set.get("recommended")
            if recommended:
                selector = recommended.get("selector")
        
        # Extract target_text with fallback to multiple sources
        target_text = None
        if interacted_element:
            # Priority 1: text_content (innerText/textContent)
            target_text = interacted_element.get("text_content")
            if target_text:
                target_text = target_text.strip()
            
            # Priority 2: aria-label
            if not target_text and interacted_element.get("accessibility"):
                a11y = interacted_element.get("accessibility", {})
                target_text = a11y.get("aria_label") or a11y.get("ariaLabel")
                if target_text:
                    target_text = target_text.strip()
            
            # Priority 3: name attribute (for form fields)
            if not target_text:
                target_text = interacted_element.get("name")
                if target_text:
                    target_text = target_text.strip()
            
            # Priority 4: id attribute (as fallback, clean it up)
            if not target_text:
                element_id = interacted_element.get("id")
                if element_id:
                    # Clean up ID to readable text (e.g., "cart-badge" -> "Cart Badge")
                    target_text = element_id.replace("_", " ").replace("-", " ")
                    target_text = re.sub(r'([a-z])([A-Z])', r'\1 \2', target_text)
                    target_text = target_text.title().strip()
            
            # Priority 5: Extract from action_description if it contains text
            if not target_text:
                action_desc = event_data.get("action_description", "")
                # Pattern: "CLICK_BUTTON: BUTTON - Text" or "User clicks 'Text'"
                if " - " in action_desc:
                    parts = action_desc.split(" - ", 1)
                    if len(parts) > 1:
                        target_text = parts[-1].strip()
                elif ":" in action_desc and len(action_desc.split(":")) > 1:
                    # Try to extract meaningful text after colon
                    after_colon = action_desc.split(":", 1)[1].strip()
                    # Remove tag names and IDs, keep text
                    target_text = re.sub(r'[A-Z]+\s*#?[^\s]*', '', after_colon).strip()
                    if target_text and len(target_text) > 2:
                        target_text = target_text.strip()
                    else:
                        target_text = None
        
        # Log what we extracted for debugging
        if target_text:
            logger.debug(f"Extracted target_text: '{target_text}' from event_type={event_type}, selector={selector}")
        else:
            logger.debug(f"No target_text extracted for event_type={event_type}, selector={selector}, interacted_element keys: {list(interacted_element.keys()) if interacted_element else 'None'}")
        
        # Add node to action graph with screenshot
        node_id = session.add_node(
            event_type=event_type,
            target_selector=selector,
            target_text=target_text,
            url=url,
            dom_snapshot_id=dom_snapshot.get("dom_snapshot_id"),
            wcag_snapshot_id=wcag_snapshot.get("wcag_snapshot_id"),
            performance_snapshot_id=perf_snapshot.get("performance_snapshot_id"),
            action_description=event_data.get("action_description", f"User {event_type}"),
            screenshot_url=screenshot,  # Store screenshot base64 data URL
            metadata={
                "value": event_data.get("value"),
                "latency_ms": perf_snapshot.get("summary", {}).get("avg_latency", 0),
                "wcag_violations_count": wcag_snapshot.get("summary", {}).get("total", 0),
                "performance_issues_count": len(perf_snapshot.get("bottlenecks", []))
            }
        )
        
        logger.info(f"[OK] Added node {node_id} to session {session_id}. Total nodes: {len(session.nodes)}, Total edges: {len(session.edges)}")
        logger.info(f"Session still in manager: {session_id in flowstral_session_manager.sessions}")
        
        # Generate real-time outputs with error handling
        try:
            playwright_line = self.realtime_generator.generate_playwright_line(
                event_type=event_type,
                selector=selector,
                value=event_data.get("value"),
                url=url if event_type == "navigate" else None
            )
        except Exception as e:
            logger.warning(f"Playwright line generation failed: {e}", exc_info=True)
            playwright_line = f"// Error generating playwright code: {e}"
        
        try:
            test_step = self.realtime_generator.generate_test_step(
                step_number=len(session.test_steps) + 1,
                event_type=event_type,
                action_description=event_data.get("action_description", f"User {event_type}"),
                expected_result=event_data.get("expected_result")
            )
        except Exception as e:
            logger.warning(f"Test step generation failed: {e}", exc_info=True)
            test_step = {"step_number": len(session.test_steps) + 1, "action": f"User {event_type}", "expected_result": "N/A"}
        
        try:
            accessibility_panel = self.realtime_generator.generate_accessibility_panel(wcag_snapshot)
        except Exception as e:
            logger.warning(f"Accessibility panel generation failed: {e}", exc_info=True)
            accessibility_panel = {"total_issues": 0, "critical": 0, "serious": 0, "issues": []}
        
        try:
            performance_panel = self.realtime_generator.generate_performance_panel(perf_snapshot)
        except Exception as e:
            logger.warning(f"Performance panel generation failed: {e}", exc_info=True)
            performance_panel = {"page_score": 0, "metrics": []}
        
        # Update session outputs
        session.playwright_code.append(playwright_line)
        session.test_steps.append(test_step)
        # Only extend if violations is a list
        violations = wcag_snapshot.get("violations", [])
        if isinstance(violations, list):
            session.wcag_issues.extend(violations)
        elif violations:
            # If it's a single violation dict, wrap it in a list
            session.wcag_issues.append(violations)
        session.performance_metrics.append(perf_snapshot)
        
        return {
            "session_id": session_id,
            "node_id": node_id,
            "real_time_outputs": {
                "playwright_code": playwright_line,
                "test_step": test_step,
                "accessibility_panel": accessibility_panel,
                "performance_panel": performance_panel
            },
            "snapshots": {
                "dom": dom_snapshot.get("dom_snapshot_id"),
                "wcag": wcag_snapshot.get("wcag_snapshot_id"),
                "performance": perf_snapshot.get("performance_snapshot_id")
            }
        }
    
    async def stop_session(
        self,
        session_id: str,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Stop Flowstral session and generate all 6 artifacts"""
        session = flowstral_session_manager.get_session(session_id)
        if not session:
            # Log at WARNING level since this is expected when:
            # - Session was never created via /start
            # - Session expired or backend restarted
            # - Stop called before start
            logger.warning(f"[WARNING] Session {session_id} not found in session manager")
            logger.debug(f"Available sessions: {list(flowstral_session_manager.sessions.keys())}")
            logger.debug(f"Total sessions in manager: {len(flowstral_session_manager.sessions)}")
            logger.debug(f"This usually means:")
            logger.debug(f"  1. The session was never properly created")
            logger.debug(f"  2. The session was cleaned up/expired")
            logger.debug(f"  3. The browser extension is not sending events to /api/flowstral/capture-event")
            logger.debug(f"  4. Check browser console for errors when capturing events")
            
            # Return a minimal response instead of error
            return {
                "session_id": session_id,
                "stop_result": {
                    "session_id": session_id,
                    "already_stopped": True,
                    "message": "Session not found or already stopped. Make sure you started recording and captured some events before stopping."
                },
                "artifacts": {
                    "artifacts": {},
                    "warnings": [
                        "Session not found. This usually means:",
                        "1) The session was never started properly",
                        "2) The session expired or was cleaned up",
                        "3) No events were captured during recording",
                        "4) Check browser console for errors when capturing events",
                        f"5) Check if events are being sent to /api/flowstral/capture-event endpoint"
                    ],
                    "generated_at": datetime.utcnow().isoformat()
                },
                "real_time_outputs": {}
            }
        
        # Stop session (handles already-stopped case gracefully)
        try:
            stop_result = flowstral_session_manager.stop_session(session_id)
        except ValueError as e:
            if "not active" in str(e).lower():
                logger.warning(f"Session {session_id} already stopped")
                stop_result = {
                    "session_id": session_id,
                    "already_stopped": True
                }
            else:
                raise
        
        # Check if we have any nodes/edges to generate artifacts from
        nodes_count = len(session.nodes) if hasattr(session, 'nodes') and session.nodes else 0
        edges_count = len(session.edges) if hasattr(session, 'edges') and session.edges else 0
        
        logger.info(f"Session check: nodes={nodes_count}, edges={edges_count}")
        logger.info(f"Session nodes: {[n.get('event_type', 'unknown') for n in session.nodes[:5]] if session.nodes else 'empty'}")
        logger.info(f"Session edges: {[e.get('action', 'unknown') for e in session.edges[:5]] if session.edges else 'empty'}")
        
        if nodes_count == 0:
            logger.warning(f"Session {session_id} has no nodes - cannot generate artifacts")
            logger.warning(f"Session state: is_active={session.is_active if hasattr(session, 'is_active') else 'unknown'}")
            logger.warning(f"This usually means no events were captured. Check if the browser extension is sending events to the backend.")
            return {
                "session_id": session_id,
                "stop_result": stop_result,
                "artifacts": {
                    "artifacts": {},
                    "warnings": [
                        "No actions recorded - cannot generate artifacts.",
                        "Make sure you: 1) Started recording, 2) Interacted with the page (clicked buttons, filled forms, etc.), 3) Check browser console for errors"
                    ],
                    "generated_at": datetime.utcnow().isoformat()
                },
                "real_time_outputs": session.get_real_time_outputs() if hasattr(session, 'get_real_time_outputs') else {}
            }
        
        # Get action graph data from session
        action_graph_data = session.get_action_graph()
        
        # Reconstruct action graph object from session data
        action_graph = ActionGraph(session_id)
        # Load nodes and edges from session data, preserving original IDs
        action_graph.load_from_session_data(
            nodes_data=action_graph_data.get("nodes", []),
            edges_data=action_graph_data.get("edges", [])
        )
        
        logger.info(f"Reconstructed action graph with {len(action_graph.nodes)} nodes and {len(action_graph.edges)} edges")
        
        # Log session data for debugging
        logger.info(f"Session has {len(session.nodes)} nodes, {len(session.edges)} edges")
        logger.info(f"Session has {len(session.wcag_issues)} WCAG issues, {len(session.performance_metrics)} performance metrics")
        
        # Generate all 6 artifacts with progress updates
        logger.info(f"Starting artifact generation for session {session_id}")
        logger.info(f"Session has {len(session.nodes)} nodes, {len(session.edges)} edges")
        logger.info(f"Project ID: {project_id}, Tenant ID: {tenant_id}")
        
        # Set up progress callback for WebSocket updates
        from app.services.flowstral.flowstral_websocket_manager import flowstral_ws_manager
        
        async def progress_callback(message: str, progress: int, artifact: str = None, status: str = "processing"):
            try:
                await flowstral_ws_manager.send_progress(
                    session_id=session_id,
                    message=message,
                    progress=progress,
                    artifact=artifact,
                    status=status
                )
                logger.debug(f"Progress sent: {message} ({progress}%)")
            except Exception as e:
                logger.warning(f"Failed to send progress via WebSocket: {e}")
        
        try:
            # Add timeout to prevent hanging (max 5 minutes for artifact generation)
            import asyncio
            logger.info(f"Starting artifact generation with timeout (5 minutes max)")
            artifacts = await asyncio.wait_for(
                self.artifacts_generator.generate_all_artifacts(
                    session_id=session_id,
                    action_graph=action_graph,
                    dom_snapshots=[],  # Would load from storage
                    wcag_snapshots=session.wcag_issues,  # Simplified
                    performance_snapshots=session.performance_metrics,
                    project_id=project_id,
                    tenant_id=tenant_id,
                    progress_callback=progress_callback
                ),
                timeout=300.0  # 5 minutes max
            )
            logger.info("[OK] Artifact generation completed successfully")
        except asyncio.TimeoutError:
            logger.error("[ERROR] Artifact generation timed out after 5 minutes")
            artifacts = {
                "artifacts": {
                    "action_graph": {"error": "Generation timed out", "type": "action_graph"},
                    "playwright_script": {"error": "Generation timed out", "type": "playwright_script"},
                    "test_cases": {"error": "Generation timed out - LLM call took too long", "type": "test_cases"},
                    "accessibility_report": {"error": "Generation timed out", "type": "accessibility_report"},
                    "performance_report": {"error": "Generation timed out", "type": "performance_report"},
                    "defects": {"error": "Generation timed out", "type": "defects"}
                },
                "warnings": ["Artifact generation timed out after 5 minutes. Check LLM connection and model availability."],
                "generated_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"[ERROR] Artifact generation failed: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            # Return empty artifacts with error
            artifacts = {
                "artifacts": {},
                "warnings": [f"Artifact generation failed: {str(e)}"],
                "generated_at": datetime.utcnow().isoformat()
            }
        
        # Extract artifacts from the result (generate_all_artifacts returns {artifacts: {...}, ...})
        artifacts_dict = artifacts.get('artifacts', {})
        logger.info(f"Artifact generation completed. Artifacts keys: {list(artifacts_dict.keys())}")
        if artifacts.get('warnings'):
            logger.warning(f"Artifact generation warnings: {artifacts.get('warnings')}")
        
        # Log artifact counts for debugging
        artifact_count = 0
        for artifact_name, artifact_data in artifacts_dict.items():
            if isinstance(artifact_data, dict) and 'error' not in artifact_data:
                logger.info(f"  [OK] {artifact_name}: Generated successfully")
                artifact_count += 1
            elif isinstance(artifact_data, dict) and 'error' in artifact_data:
                logger.warning(f"  [ERROR] {artifact_name}: Error - {artifact_data.get('error', 'Unknown')}")
            else:
                logger.info(f"  [OK] {artifact_name}: Generated (type: {type(artifact_data).__name__})")
                artifact_count += 1
        
        if artifact_count == 0:
            logger.error(f"[ERROR] ZERO artifacts generated! This usually means:")
            logger.error(f"  1. Session had no nodes/edges (no events captured)")
            logger.error(f"  2. Artifact generation failed silently")
            logger.error(f"  3. Check if browser extension is sending events to /api/flowstral/capture-event")
        
        # Store artifacts in session for later retrieval
        session.artifacts = artifacts_dict
        session.artifacts_generated_at = datetime.utcnow().isoformat()
        logger.info(f"[OK] Stored artifacts in session {session_id} for later retrieval")
        logger.info(f"[OK] Stored artifacts keys: {list(artifacts_dict.keys())}")
        logger.info(f"[OK] Artifacts count: {len(artifacts_dict)}")
        logger.info(f"[OK] Session.artifacts type: {type(session.artifacts)}")
        logger.info(f"[OK] Session.artifacts is None: {session.artifacts is None}")
        logger.info(f"[OK] Session still in manager: {session_id in flowstral_session_manager.sessions}")
        logger.info(f"[OK] Total sessions in manager: {len(flowstral_session_manager.sessions)}")
        
        # Verify storage
        if session.artifacts is None:
            logger.error(f"[ERROR] CRITICAL: session.artifacts is None after assignment!")
        elif not isinstance(session.artifacts, dict):
            logger.error(f"[ERROR] CRITICAL: session.artifacts is not a dict, it's {type(session.artifacts)}")
        elif len(session.artifacts) == 0:
            logger.warning(f"[WARNING] session.artifacts is an empty dict")
        else:
            logger.info(f"[OK] Verified: session.artifacts is a dict with {len(session.artifacts)} keys")
        
        # PERSIST ARTIFACTS TO DATABASE for long-term storage
        try:
            from app.services.storage.postgres_direct import execute_insert, execute_query
            import uuid
            
            # Get session's database ID if it exists
            # First, try to find session in database
            db_session_id = None
            try:
                session_query = """
                    SELECT id FROM flowstral_sessions 
                    WHERE id::text = %s OR project_id::text = %s
                    ORDER BY created_at DESC LIMIT 1
                """
                # Try to find by session_id (UUID string) or project_id
                session_result = await execute_query(session_query, (session_id, session.project_id or ""))
                if session_result and len(session_result) > 0:
                    db_session_id = session_result[0].get("id")
                    logger.info(f"[OK] Found database session ID: {db_session_id}")
            except Exception as e:
                logger.warning(f"[WARNING] Could not find session in database: {e}")
            
            # Store each artifact type in database
            stored_count = 0
            for artifact_type, artifact_data in artifacts_dict.items():
                try:
                    artifact_record = {
                        "session_id": db_session_id or session_id,  # Use DB ID if available, else string ID
                        "tenant_id": tenant_id,
                        "artifact_type": artifact_type,
                        "artifact_data": artifact_data,  # JSONB field
                        "export_format": "json"
                    }
                    
                    artifact_id = await execute_insert("flowstral_artifacts", artifact_record)
                    if artifact_id:
                        stored_count += 1
                        logger.info(f"[OK] Persisted {artifact_type} to database with ID: {artifact_id}")
                    else:
                        logger.warning(f"[WARNING] Failed to persist {artifact_type} to database")
                except Exception as e:
                    logger.error(f"[ERROR] Failed to persist {artifact_type} to database: {e}")
                    # Continue with other artifacts
            
            if stored_count > 0:
                logger.info(f"[OK] Persisted {stored_count}/{len(artifacts_dict)} artifacts to database")
            else:
                logger.warning(f"[WARNING] No artifacts were persisted to database")
        except Exception as e:
            logger.error(f"[ERROR] Failed to persist artifacts to database: {e}", exc_info=True)
            # Don't fail the whole operation if DB persistence fails
        
        return {
            "session_id": session_id,
            "stop_result": stop_result,
            "artifacts": artifacts,  # Keep full structure including warnings
            "real_time_outputs": session.get_real_time_outputs()
        }
    
    def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get current session status"""
        session = flowstral_session_manager.get_session(session_id)
        if not session:
            return {"status": "not_found"}
        
        return {
            "session_id": session_id,
            "status": "active" if session.is_active else "stopped",
            "start_timestamp": session.start_timestamp.isoformat() if session.start_timestamp else None,
            "total_nodes": len(session.nodes),
            "total_edges": len(session.edges),
            "real_time_outputs": session.get_real_time_outputs()
        }

