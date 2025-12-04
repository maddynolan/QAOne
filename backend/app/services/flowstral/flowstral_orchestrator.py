"""
Flowstral Main Orchestrator
Coordinates all pipelines and generates real-time outputs
"""

import logging
import asyncio
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from app.services.flowstral.flowstral_session import FlowstralSession, flowstral_session_manager
from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.flowstral.flowstral_dom_pipeline import DOMSnapshotPipeline
from app.services.flowstral.flowstral_wcag_pipeline import WCAGPipeline
from app.services.flowstral.flowstral_performance_pipeline import PerformancePipeline
from app.services.flowstral.flowstral_realtime_output import RealTimeOutputGenerator
from app.services.flowstral.flowstral_artifacts import FlowstralArtifactsGenerator
from app.services.flowstral.flowstral_event_coalescer import get_event_coalescer, Event
from app.services.flowstral.flowstral_snapshot_deduplicator import get_snapshot_deduplicator
from app.services.flowstral.flowstral_project_config import get_project_config_service

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
        self.config_service = get_project_config_service()
    
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
        # FILTER OUT NOISY EVENTS BEFORE PROCESSING (reduce nodes from 1000+ to ~50-100)
        noisy_events = {
            'scroll', 'mousemove', 'mouseover', 'mouseout', 
            'focus', 'blur', 'resize', 'visibilitychange',
            'wcag_scan', 'dom_snapshot', 'api_request', 'page_load',
            'change'  # Change events are captured with input events
        }
        
        if event_type.lower() in noisy_events:
            logger.debug(f"[CAPTURE] Skipping noisy event: {event_type}")
            return {
                "status": "skipped",
                "reason": f"Event type '{event_type}' is filtered out (noisy event)"
            }
        
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
        
        # Get project configuration
        project_id = session.project_id
        config = await self.config_service.get_config(project_id)
        
        # Extract event data
        html = event_data.get("html", "")
        url = event_data.get("url", "")
        interacted_element = event_data.get("interacted_element")
        page_metrics = event_data.get("page_metrics")
        component_metrics = event_data.get("component_metrics")
        network_calls = event_data.get("network_calls")
        screenshot = event_data.get("screenshot")  # Base64 data URL from extension
        
        # Store raw event for potential coalescing
        raw_event = Event(
            event_id=f"{session_id}_{event_type}_{datetime.utcnow().timestamp()}",
            event_type=event_type,
            timestamp=datetime.utcnow().timestamp(),
            element_id=interacted_element.get("id") if interacted_element else None,
            element_selector=interacted_element.get("selector") if interacted_element else None,
            value=event_data.get("value"),
            url=url,
            metadata={
                "interacted_element": interacted_element,
                "action_description": event_data.get("action_description", ""),
                "text_content": interacted_element.get("text_content") if interacted_element else None
            }
        )
        
        # Add to session's event buffer for coalescing
        if not hasattr(session, 'event_buffer'):
            session.event_buffer = []
        session.event_buffer.append(raw_event)
        
        # Check if we should coalesce events
        should_coalesce = config.event_coalescing.enabled
        coalesce_window_ms = config.event_coalescing.window_ms
        
        # Check if enough time has passed or if this is a significant event
        should_process_now = False
        if not session.event_buffer:
            should_process_now = True
        elif len(session.event_buffer) > 0:
            last_event_time = session.event_buffer[-1].timestamp
            time_since_last = (raw_event.timestamp - last_event_time) * 1000
            # Process if time window exceeded or significant event
            if time_since_last > coalesce_window_ms or event_type in ['navigate', 'submit', 'page_load']:
                should_process_now = True
        
        # If not time to process, just store and return
        if should_coalesce and not should_process_now:
            return {
                "status": "buffered",
                "message": "Event buffered for coalescing",
                "buffer_size": len(session.event_buffer)
            }
        
        # Process events (coalesced or single)
        events_to_process = session.event_buffer if should_coalesce else [raw_event]
        session.event_buffer = []  # Clear buffer
        
        # Coalesce events if enabled
        coalesced_actions = []
        if should_coalesce and len(events_to_process) > 0:
            coalescer_config = {
                "coalescing_window_ms": config.event_coalescing.window_ms,
                "input_debounce_ms": config.event_coalescing.input_debounce_ms,
                "max_click_count": config.event_coalescing.max_click_count
            }
            coalescer = get_event_coalescer(coalescer_config)
            coalesced_actions = coalescer.coalesce_events(events_to_process)
        else:
            # Convert single event to action format
            from app.services.flowstral.flowstral_event_coalescer import CoalescedAction
            from uuid import uuid4
            coalesced_actions = [CoalescedAction(
                action_id=str(uuid4()),
                action_type=event_type,
                description=event_data.get("action_description", f"User {event_type}"),
                element_id=raw_event.element_id,
                element_selector=raw_event.element_selector,
                value=raw_event.value,
                url=raw_event.url,
                start_timestamp=raw_event.timestamp,
                end_timestamp=raw_event.timestamp,
                raw_events=[raw_event]
            )]
        
        # Process each coalesced action
        results = []
        for action in coalesced_actions:
            result = await self._process_coalesced_action(
                session_id, action, html, url, interacted_element,
                page_metrics, component_metrics, network_calls, screenshot, config
            )
            results.append(result)
        
        # Return result from last action (or combined result)
        return results[-1] if results else {"status": "processed"}
    
    async def _process_coalesced_action(
        self,
        session_id: str,
        action,
        html: str,
        url: str,
        interacted_element: Optional[Dict[str, Any]],
        page_metrics: Optional[Dict[str, Any]],
        component_metrics: Optional[Dict[str, Any]],
        network_calls: Optional[List[Dict[str, Any]]],
        screenshot: Optional[str],
        config
    ) -> Dict[str, Any]:
        """
        Process a coalesced action through all pipelines
        This is the core processing logic extracted from capture_event
        """
        from app.services.flowstral.flowstral_event_coalescer import CoalescedAction
        
        session = flowstral_session_manager.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        # Use action's event type or default
        event_type = action.action_type if isinstance(action, CoalescedAction) else action.get("action_type", "unknown")
        
        # Get interacted element from action if available
        if isinstance(action, CoalescedAction) and action.raw_events:
            # Use last event's interacted element
            last_event = action.raw_events[-1]
            if not interacted_element and last_event.metadata:
                interacted_element = last_event.metadata.get("interacted_element")
        
        # Run all 4 pipelines in parallel with error handling
        async def safe_dom_capture():
            try:
                # Get previous HTML for deduplication
                previous_html = None
                if config.storage.deduplication_enabled and session.nodes:
                    # Try to get previous DOM snapshot HTML
                    last_node = session.nodes[-1]
                    if last_node.get("dom_snapshot_id"):
                        # In production, would fetch HTML from storage using dom_snapshot_id
                        # For now, we'll pass None and deduplicator will handle it
                        pass
                
                # Capture snapshot with deduplication if enabled
                return await self.dom_pipeline.capture_snapshot(
                    html=html,
                    url=url,
                    interacted_element=interacted_element,
                    previous_html=previous_html,
                    deduplication_enabled=config.storage.deduplication_enabled,
                    compression_algorithm=config.storage.compression_algorithm
                )
            except Exception as e:
                logger.warning(f"DOM snapshot failed: {e}", exc_info=True)
                return {"dom_snapshot_id": None, "selector_set": {}, "error": str(e)}
        
        async def safe_wcag_scan():
            try:
                # Check pipeline configuration
                wcag_config = config.pipelines.get("wcag", {})
                if not wcag_config.get("enabled", True):
                    return {"wcag_snapshot_id": None, "violations": [], "summary": {"total": 0}, "skipped": True}
                
                # Check if should run based on event type
                wcag_run_on = wcag_config.get("run_on", ["navigate", "page_load", "submit"])
                if event_type not in wcag_run_on and event_type not in ["navigate", "page_load", "submit"]:
                    # Skip WCAG scan for this event
                    return {"wcag_snapshot_id": None, "violations": [], "summary": {"total": 0}, "skipped": True}
                
                return await self.wcag_pipeline.scan_page(html, url)
            except Exception as e:
                logger.warning(f"WCAG scan failed: {e}", exc_info=True)
                return {"wcag_snapshot_id": None, "violations": [], "summary": {"total": 0}, "error": str(e)}
        
        async def safe_perf_capture():
            try:
                # Check pipeline configuration
                perf_config = config.pipelines.get("performance", {})
                if not perf_config.get("enabled", True):
                    return {"performance_snapshot_id": None, "bottlenecks": [], "summary": {}, "skipped": True}
                
                # Check if should run based on event count
                max_events = perf_config.get("max_events_per_page", 5)
                # In production, would track events per page
                # For now, run on significant events
                if event_type not in ["navigate", "page_load", "submit"]:
                    # Skip performance scan for minor events
                    return {"performance_snapshot_id": None, "bottlenecks": [], "summary": {}, "skipped": True}
                
                return await self.performance_pipeline.capture_metrics(url, page_metrics, component_metrics, network_calls)
            except Exception as e:
                logger.warning(f"Performance capture failed: {e}", exc_info=True)
                return {"performance_snapshot_id": None, "bottlenecks": [], "summary": {}, "error": str(e)}
        
        dom_snapshot, wcag_snapshot, perf_snapshot = await asyncio.gather(
            safe_dom_capture(), safe_wcag_scan(), safe_perf_capture()
        )
        
        # Generate BEST selector IMMEDIATELY at capture time (like Playwright Codegen)
        selector = None
        playwright_locator = None
        fallback_selectors = []
        
        if interacted_element:
            selector_set = dom_snapshot.get("selector_set", {})
            
            # Use primary Playwright locator if available (best practice)
            playwright_locator = selector_set.get("primary_selector")
            fallback_selectors = selector_set.get("fallback_selectors", [])
            
            # Fallback to recommended selector
            if not playwright_locator:
                recommended = selector_set.get("recommended")
                if recommended:
                    selector = recommended.get("selector")
                    # Try to convert to Playwright locator
                    playwright_locator = recommended.get("playwright_locator")
            
            # If still no selector, generate from element attributes directly
            if not playwright_locator and not selector:
                element_id = interacted_element.get("id")
                data_testid = interacted_element.get("data_testid") or interacted_element.get("data-testid")
                element_name = interacted_element.get("name")
                tag_name = interacted_element.get("tag_name", "").lower()
                
                # Priority: data-testid > ID > name
                if data_testid:
                    playwright_locator = f"page.getByTestId('{data_testid}')"
                    selector = f'[data-testid="{data_testid}"]'
                elif element_id and not any(p in element_id.lower() for p in ["react", "vue", "angular", "generated"]):
                    playwright_locator = f"page.locator('#{element_id}')"
                    selector = f"#{element_id}"
                elif element_name and tag_name in ["input", "select", "textarea", "button"]:
                    playwright_locator = f"page.locator('{tag_name}[name=\"{element_name}\"]')"
                    selector = f'{tag_name}[name="{element_name}"]'
            
            logger.info(f"[SELECTOR] Generated selector: {playwright_locator or selector} for {event_type}")
        
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
            
            # Priority 5: Extract from action description if available
            if not target_text and isinstance(action, CoalescedAction):
                action_desc = action.description
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
        
        # Use action description if available
        action_description = action.description if isinstance(action, CoalescedAction) else f"User {event_type}"
        action_value = action.value if isinstance(action, CoalescedAction) else None
        
        # Log what we extracted for debugging
        if target_text:
            logger.debug(f"Extracted target_text: '{target_text}' from event_type={event_type}, selector={selector}")
        else:
            logger.debug(f"No target_text extracted for event_type={event_type}, selector={selector}")
        
        # Store raw events for Flux high-fidelity generation
        import time
        if isinstance(action, CoalescedAction):
            for raw_event_obj in action.raw_events:
                raw_event = {
                    "event_type": raw_event_obj.event_type,
                    "timestamp": raw_event_obj.timestamp,
                    "event_data": raw_event_obj.metadata,
                    "selector": selector,
                    "target_text": target_text,
                    "url": raw_event_obj.url or url,
                    "dom_snapshot_id": dom_snapshot.get("dom_snapshot_id"),
                    "screenshot": screenshot
                }
                session.raw_events.append(raw_event)
        else:
            raw_event = {
                "event_type": event_type,
                "timestamp": time.time(),
                "event_data": {},
                "selector": selector,
                "target_text": target_text,
                "url": url,
                "dom_snapshot_id": dom_snapshot.get("dom_snapshot_id"),
                "screenshot": screenshot
            }
            session.raw_events.append(raw_event)
        
        # Add node to action graph with screenshot
        # Store the BEST selector (Playwright locator) for immediate use
        node_id = session.add_node(
            event_type=event_type,
            target_selector=playwright_locator or selector,
            target_text=target_text,
            url=url,
            dom_snapshot_id=dom_snapshot.get("dom_snapshot_id"),
            wcag_snapshot_id=wcag_snapshot.get("wcag_snapshot_id"),
            performance_snapshot_id=perf_snapshot.get("performance_snapshot_id"),
            action_description=action_description,
            screenshot_url=screenshot,
            metadata={
                "value": action_value,
                "latency_ms": perf_snapshot.get("summary", {}).get("avg_latency", 0),
                "wcag_violations_count": wcag_snapshot.get("summary", {}).get("total", 0),
                "performance_issues_count": len(perf_snapshot.get("bottlenecks", [])),
                "timestamp": time.time(),
                "interacted_element": interacted_element,
                "playwright_locator": playwright_locator,
                "css_selector": selector,
                "fallback_selectors": fallback_selectors,
                "selector_set": dom_snapshot.get("selector_set", {}),
                "coalesced": isinstance(action, CoalescedAction),
                "event_count": action.event_count if isinstance(action, CoalescedAction) else 1
            }
        )
        
        logger.info(f"[OK] Added node {node_id} to session {session_id}. Total nodes: {len(session.nodes)}, Total edges: {len(session.edges)}")
        
        # Generate real-time outputs
        try:
            playwright_line = self.realtime_generator.generate_playwright_line(
                event_type=event_type,
                selector=selector,
                value=action_value,
                url=url if event_type == "navigate" else None
            )
        except Exception as e:
            logger.warning(f"Playwright line generation failed: {e}", exc_info=True)
            playwright_line = f"// Error generating playwright code: {e}"
        
        try:
            test_step = self.realtime_generator.generate_test_step(
                step_number=len(session.test_steps) + 1,
                event_type=event_type,
                action_description=action_description,
                expected_result=None
            )
        except Exception as e:
            logger.warning(f"Test step generation failed: {e}", exc_info=True)
            test_step = {"step_number": len(session.test_steps) + 1, "action": action_description, "expected_result": "N/A"}
        
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
        violations = wcag_snapshot.get("violations", [])
        if isinstance(violations, list):
            session.wcag_issues.extend(violations)
        elif violations:
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
            },
            "coalesced": isinstance(action, CoalescedAction),
            "action_description": action_description
        }
    
    def _extract_coordinates(self, event_data: Dict[str, Any]) -> Optional[Tuple[int, int]]:
        """Extract mouse coordinates from event data."""
        interacted_element = event_data.get("interacted_element", {})
        if isinstance(interacted_element, dict):
            # Check for mouse coordinates in event data
            if "mouse_x" in event_data and "mouse_y" in event_data:
                return (int(event_data["mouse_x"]), int(event_data["mouse_y"]))
            elif "clientX" in event_data and "clientY" in event_data:
                return (int(event_data["clientX"]), int(event_data["clientY"]))
        return None
    
    def _extract_hover_duration(self, event_data: Dict[str, Any]) -> float:
        """Extract hover duration from event data."""
        if "hover_duration_ms" in event_data:
            return float(event_data["hover_duration_ms"])
        # Default hover before click (natural user behavior)
        return 150.0 if event_data.get("event_type") == "click" else 0.0
    
    def _extract_scroll_position(self, event_data: Dict[str, Any]) -> Optional[Tuple[int, int]]:
        """Extract scroll position from event data."""
        if "scrollY" in event_data and "scrollX" in event_data:
            return (int(event_data["scrollX"]), int(event_data["scrollY"]))
        return None
    
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
        
        # Log detailed node information for debugging
        if action_graph.nodes:
            logger.info(f"Action graph node event types: {[n.event_type for n in action_graph.nodes]}")
            logger.info(f"Action graph node URLs: {[n.url for n in action_graph.nodes if n.url]}")
            logger.info(f"Action graph node selectors: {[n.target_selector for n in action_graph.nodes if n.target_selector]}")
        else:
            logger.warning(f"[WARNING] Action graph has NO NODES! This means no events were captured.")
        
        # Get raw events for Flux high-fidelity generation
        raw_events = session.raw_events if hasattr(session, 'raw_events') else None
        logger.info(f"Session has {len(raw_events) if raw_events else 0} raw events for Flux agent")
        
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
                    progress_callback=progress_callback,
                    raw_events=raw_events  # Pass raw events for Flux high-fidelity generation
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

