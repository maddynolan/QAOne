"""
Flowstral Action Graph Intelligence Engine
Constructs and manages the Action Graph with nodes and edges
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
from dateutil import parser

logger = logging.getLogger(__name__)


class ActionGraphNode:
    """
    Represents a Screen/State in the Action Graph (Phase 2.3: Refactored Schema)
    Nodes = Screens/States identified by URL pattern + key DOM features
    """
    
    def __init__(
        self,
        event_type: str,
        target_selector: Optional[str] = None,
        target_text: Optional[str] = None,
        url: Optional[str] = None,
        dom_snapshot_id: Optional[str] = None,
        wcag_snapshot_id: Optional[str] = None,
        performance_snapshot_id: Optional[str] = None,
        action_description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        node_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        # Phase 2.3: New fields for Screen/State representation
        url_pattern: Optional[str] = None,
        title: Optional[str] = None,
        key_elements: Optional[List[str]] = None,
        screenshot_url: Optional[str] = None,
        a11y_summary: Optional[Dict[str, Any]] = None,
        perf_summary: Optional[Dict[str, Any]] = None
    ):
        self.id = node_id if node_id else str(uuid4())
        self.event_type = event_type  # Keep for backward compatibility
        self.target_selector = target_selector
        self.target_text = target_text
        self.url = url
        self.url_pattern = url_pattern or self._extract_url_pattern(url)  # e.g., /checkout, /product/:id
        self.title = title or action_description  # Screen title
        self.key_elements = key_elements or []  # Semantic summary of what's on screen
        self.screenshot_url = screenshot_url
        self.state_before: Optional[str] = None
        self.state_after: Optional[str] = None
        self.dom_snapshot_id = dom_snapshot_id
        self.wcag_snapshot_id = wcag_snapshot_id
        self.performance_snapshot_id = performance_snapshot_id
        self.action_description = action_description
        self.timestamp = timestamp if timestamp else datetime.utcnow()
        self.metadata = metadata or {}
        
        # Phase 2.3: Extract summaries from snapshots if available
        self.a11y_summary = a11y_summary or {}
        self.perf_summary = perf_summary or {}
    
    def _extract_url_pattern(self, url: Optional[str]) -> Optional[str]:
        """Extract URL pattern from full URL (e.g., /checkout from https://example.com/checkout)"""
        if not url:
            return None
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path
            # Remove query params and hash
            if '?' in path:
                path = path.split('?')[0]
            if '#' in path:
                path = path.split('#')[0]
            return path or "/"
        except Exception:
            return url
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert node to dictionary (Phase 2.3: Enhanced with Screen/State fields)"""
        return {
            "id": self.id,
            "event_type": self.event_type,  # Keep for backward compatibility
            "target_selector": self.target_selector,
            "target_text": self.target_text,
            "url": self.url,
            "url_pattern": self.url_pattern,  # Phase 2.3: New
            "title": self.title,  # Phase 2.3: New
            "key_elements": self.key_elements,  # Phase 2.3: New
            "screenshot_url": self.screenshot_url,  # Phase 2.3: New
            "state_before": self.state_before,
            "state_after": self.state_after,
            "dom_snapshot_id": self.dom_snapshot_id,
            "wcag_snapshot_id": self.wcag_snapshot_id,
            "performance_snapshot_id": self.performance_snapshot_id,
            "a11y_summary": self.a11y_summary,  # Phase 2.3: New
            "perf_summary": self.perf_summary,  # Phase 2.3: New
            "action_description": self.action_description,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


class ActionGraphEdge:
    """
    Represents an Action in the Action Graph (Phase 2.3: Refactored Schema)
    Edges = Actions (source node → target node)
    """
    
    def __init__(
        self,
        from_node_id: str,
        to_node_id: str,
        action: str,
        transition_time_ms: float = 0,
        latency_ms: float = 0,
        warnings: Optional[List[str]] = None,
        edge_id: Optional[str] = None,
        # Phase 2.3: New fields for Action representation
        action_type: Optional[str] = None,  # Login, Search, AddToCart, etc.
        description: Optional[str] = None,  # "User clicks 'Place Order'"
        locators: Optional[Dict[str, str]] = None,  # {primary: "...", fallback: "..."}
        inputs: Optional[Dict[str, Any]] = None,  # Sanitized inputs
        expected_outcome: Optional[str] = None,  # "Order confirmation page loads"
        perf_metrics: Optional[Dict[str, Any]] = None,  # {latency: 450, errorCodes: []}
        a11y_impacts: Optional[List[str]] = None  # ["Button has accessible name"]
    ):
        self.id = edge_id if edge_id else str(uuid4())
        self.from_node_id = from_node_id
        self.to_node_id = to_node_id
        self.action = action  # Keep for backward compatibility
        self.action_type = action_type or action  # Phase 2.3: Semantic action type
        self.description = description or action  # Phase 2.3: Human-readable description
        self.transition_time_ms = transition_time_ms
        self.latency_ms = latency_ms
        self.warnings = warnings or []
        self.locators = locators or {}  # Phase 2.3: Enhanced locators
        self.inputs = inputs or {}  # Phase 2.3: Sanitized inputs
        self.expected_outcome = expected_outcome  # Phase 2.3: Expected outcome
        self.perf_metrics = perf_metrics or {}  # Phase 2.3: Performance metrics
        self.a11y_impacts = a11y_impacts or []  # Phase 2.3: Accessibility impacts
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert edge to dictionary (Phase 2.3: Enhanced with Action fields)"""
        return {
            "id": self.id,
            "from_node_id": self.from_node_id,
            "to_node_id": self.to_node_id,
            "action": self.action,  # Keep for backward compatibility
            "action_type": self.action_type,  # Phase 2.3: New
            "description": self.description,  # Phase 2.3: New
            "locators": self.locators,  # Phase 2.3: New
            "inputs": self.inputs,  # Phase 2.3: New
            "expected_outcome": self.expected_outcome,  # Phase 2.3: New
            "transition_time_ms": self.transition_time_ms,
            "latency_ms": self.latency_ms,
            "perf_metrics": self.perf_metrics,  # Phase 2.3: New
            "a11y_impacts": self.a11y_impacts,  # Phase 2.3: New
            "warnings": self.warnings
        }


class ActionGraph:
    """
    Action Graph Intelligence Engine
    Manages nodes and edges with state transitions
    
    Hybrid Architecture:
    - Deterministic methods: Rule-based graph construction (80-90% of work)
    - LLM enhancement: Semantic labeling and beautification (10-20% of work)
    """
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.nodes: List[ActionGraphNode] = []
        self.edges: List[ActionGraphEdge] = []
        self.node_map: Dict[str, ActionGraphNode] = {}
        self.current_node: Optional[ActionGraphNode] = None
    
    # ==================== Deterministic Methods (Rule-Based) ====================
    
    def build_deterministic_from_events(self, events: List[Dict[str, Any]]) -> 'ActionGraph':
        """
        Build action graph deterministically from events (no LLM).
        Uses rules and patterns for 80-90% of graph construction.
        
        Args:
            events: Raw events from Flowstral extension
            
        Returns:
            Self (for chaining)
        """
        if not events:
            return self
        
        # Step 1: Normalize and deduplicate events
        normalized = self._normalize_events_deterministic(events)
        
        # Step 2: Identify pages/views (URL-based)
        pages = self._identify_pages_deterministic(normalized)
        
        # Step 3: Build nodes for each page
        for page_id, page_info in pages.items():
            page_events = [e for e in normalized if self._event_belongs_to_page(e, page_info)]
            
            node = self.add_node(
                event_type="navigate",
                url=page_info["url"],
                url_pattern=page_info["url_pattern"],
                title=page_info["title"],
                key_elements=self._extract_key_elements_deterministic(page_events),
                action_description=f"Navigate to {page_info['title']}",
                metadata={
                    "page_id": page_id,
                    "event_count": len(page_events),
                    "deterministic": True
                }
            )
            
            # Step 4: Build edges for actions within page
            self._build_page_actions_deterministic(node, page_events)
        
        # Step 5: Build navigation edges
        self._build_navigation_edges_deterministic(normalized, pages)
        
        # Step 6: Parameterize dynamic data
        self._parameterize_dynamic_data_deterministic()
        
        logger.info(f"Built deterministic action graph: {len(self.nodes)} nodes, {len(self.edges)} edges")
        return self
    
    def _normalize_events_deterministic(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize events using rules (no LLM) - FILTER OUT NOISY EVENTS"""
        normalized = []
        seen = set()
        
        # Events to skip (not meaningful for action graph)
        skip_event_types = {
            'scroll',  # Scroll events are too noisy
            'mousemove',  # Mouse movements are not actions
            'mouseover',  # Hover events (unless significant)
            'mouseout',  # Mouse out events
            'focus',  # Focus events (captured with input)
            'blur',  # Blur events (captured with input)
            'resize',  # Window resize
            'visibilitychange',  # Tab visibility
        }
        
        for event in events:
            # Check both 'event_type' and 'type' fields
            event_type = (event.get("event_type") or event.get("type") or "").lower()
            
            # Skip noisy events
            if event_type in skip_event_types:
                continue
            
            # Create signature for deduplication (use event_type if available, otherwise type)
            event_key = event.get("event_type") or event.get("type", "unknown")
            url = event.get("url", "") or (event.get("event_data", {}).get("url", ""))
            target = event.get("target", {}) or event.get("event_data", {}).get("interacted_element", {})
            selector = target.get("selector", "") if isinstance(target, dict) else ""
            
            sig = f"{event_key}:{url}:{selector}"
            if sig in seen:
                continue
            seen.add(sig)
            
            normalized.append({
                "type": event.get("type", "unknown"),
                "timestamp": self._parse_timestamp(event.get("timestamp")),
                "url": event.get("url", ""),
                "target": event.get("target", {}),
                "value": event.get("value", ""),
                "data": event.get("data", {})
            })
        
        return normalized
    
    def _parse_timestamp(self, ts: Any) -> datetime:
        """Parse timestamp to datetime"""
        if isinstance(ts, datetime):
            return ts
        if isinstance(ts, str):
            try:
                return parser.parse(ts)
            except:
                pass
        return datetime.utcnow()
    
    def _identify_pages_deterministic(self, events: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Identify distinct pages using URL patterns (rule-based)"""
        import re
        from urllib.parse import urlparse
        
        pages = {}
        
        for event in events:
            url = event.get("url", "")
            if not url:
                continue
            
            # Extract URL pattern (normalize dynamic segments)
            try:
                parsed = urlparse(url)
                path = parsed.path
                
                # Replace numeric IDs with :id
                path = re.sub(r'/\d+', '/:id', path)
                # Replace UUIDs with :uuid
                path = re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:uuid', path, re.I)
                
                url_pattern = f"{parsed.scheme}://{parsed.netloc}{path}"
                page_id = url_pattern.replace("://", "_").replace("/", "_").replace(":", "").replace("-", "_")
                
                if page_id not in pages:
                    # Extract title from DOM if available
                    title = self._extract_title_from_event(event) or self._title_from_url(url)
                    
                    pages[page_id] = {
                        "page_id": page_id,
                        "url": url,
                        "url_pattern": url_pattern,
                        "title": title,
                        "first_seen": event["timestamp"],
                        "last_seen": event["timestamp"]
                    }
                else:
                    if event["timestamp"] > pages[page_id]["last_seen"]:
                        pages[page_id]["last_seen"] = event["timestamp"]
            except:
                continue
        
        return pages
    
    def _extract_title_from_event(self, event: Dict[str, Any]) -> Optional[str]:
        """Extract page title from event data"""
        dom = event.get("data", {}).get("dom", {})
        if isinstance(dom, dict):
            return dom.get("title") or dom.get("pageTitle")
        return None
    
    def _title_from_url(self, url: str) -> str:
        """Generate title from URL"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if path:
            return path.replace("/", " ").replace("-", " ").title()
        return parsed.netloc
    
    def _event_belongs_to_page(self, event: Dict[str, Any], page_info: Dict[str, Any]) -> bool:
        """Check if event belongs to page"""
        import re
        from urllib.parse import urlparse
        
        event_url = event.get("url", "")
        if not event_url:
            return False
        
        try:
            parsed = urlparse(event_url)
            path = parsed.path
            path = re.sub(r'/\d+', '/:id', path)
            path = re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:uuid', path, re.I)
            event_pattern = f"{parsed.scheme}://{parsed.netloc}{path}"
            return event_pattern == page_info["url_pattern"]
        except:
            return False
    
    def _extract_key_elements_deterministic(self, events: List[Dict[str, Any]]) -> List[str]:
        """Extract key elements using rules"""
        key_elements = set()
        
        for event in events:
            event_type = event.get("type", "")
            target = event.get("target", {})
            
            if event_type in ["click", "input", "submit"]:
                tag = target.get("tag", "")
                text = target.get("text", "")
                selector = target.get("selector", "")
                
                if tag in ["button", "input", "form", "a", "select"]:
                    desc = tag
                    if text:
                        desc += f": {text[:30]}"
                    elif selector:
                        desc += f": {selector[:30]}"
                    key_elements.add(desc)
        
        return sorted(list(key_elements))[:10]
    
    def _build_page_actions_deterministic(self, page_node: ActionGraphNode, events: List[Dict[str, Any]]):
        """Build action edges within a page (deterministic)"""
        for event in events:
            event_type = event.get("type", "")
            if event_type in ["click", "input", "submit", "select"]:
                target = event.get("target", {})
                value = event.get("value", "")
                
                action_desc = self._describe_action_deterministic(event_type, target, value)
                
                edge = ActionGraphEdge(
                    from_node_id=page_node.id,
                    to_node_id=page_node.id,  # Same page for now
                    action=event_type,
                    description=action_desc,
                    locators={"primary": target.get("selector", "")} if target.get("selector") else {},
                    inputs={"value": value} if value else {}
                )
                self.edges.append(edge)
    
    def _describe_action_deterministic(self, event_type: str, target: Dict[str, Any], value: str) -> str:
        """Describe action using rules"""
        tag = target.get("tag", "")
        text = target.get("text", "")
        selector = target.get("selector", "")
        
        if event_type == "click":
            if text:
                return f"Click {text}"
            return f"Click {tag or 'element'}"
        elif event_type == "input":
            if value:
                return f"Enter '{value[:30]}' in {tag or 'field'}"
            return f"Input in {tag or 'field'}"
        elif event_type == "submit":
            return "Submit form"
        elif event_type == "select":
            return f"Select '{value}' from {tag or 'dropdown'}"
        return f"{event_type} on {tag or 'element'}"
    
    def _build_navigation_edges_deterministic(self, events: List[Dict[str, Any]], pages: Dict[str, Dict[str, Any]]):
        """Build edges between pages (navigation)"""
        nav_events = [e for e in events if e.get("type") in ["navigate", "url_change"]]
        
        node_map = {node.url_pattern: node for node in self.nodes if node.url_pattern}
        
        for i in range(1, len(nav_events)):
            prev_event = nav_events[i - 1]
            curr_event = nav_events[i]
            
            from_url = prev_event.get("url", "")
            to_url = curr_event.get("url", "")
            
            from_pattern = self._extract_url_pattern(from_url)
            to_pattern = self._extract_url_pattern(to_url)
            
            from_node = node_map.get(from_pattern)
            to_node = node_map.get(to_pattern)
            
            if from_node and to_node and from_node.id != to_node.id:
                edge = ActionGraphEdge(
                    from_node_id=from_node.id,
                    to_node_id=to_node.id,
                    action="navigate",
                    description=f"Navigate from {from_pattern} to {to_pattern}"
                )
                self.edges.append(edge)
    
    def _extract_url_pattern(self, url: str) -> str:
        """Extract URL pattern"""
        import re
        from urllib.parse import urlparse
        try:
            parsed = urlparse(url)
            path = parsed.path
            path = re.sub(r'/\d+', '/:id', path)
            path = re.sub(r'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:uuid', path, re.I)
            return f"{parsed.scheme}://{parsed.netloc}{path}"
        except:
            return url
    
    def _parameterize_dynamic_data_deterministic(self):
        """Parameterize dynamic data using patterns"""
        import re
        
        for edge in self.edges:
            if edge.inputs and edge.inputs.get("value"):
                value = edge.inputs["value"]
                
                # Email pattern
                if re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', value):
                    edge.inputs["value"] = "{{user.email}}"
                    edge.inputs["parameterized"] = True
                # UUID pattern
                elif re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', value, re.I):
                    edge.inputs["value"] = "{{uuid}}"
                    edge.inputs["parameterized"] = True
                # Numeric ID
                elif value.isdigit() and len(value) > 3:
                    edge.inputs["value"] = "{{id}}"
                    edge.inputs["parameterized"] = True
    
    def add_node(
        self,
        event_type: str,
        target_selector: Optional[str] = None,
        target_text: Optional[str] = None,
        url: Optional[str] = None,
        dom_snapshot_id: Optional[str] = None,
        wcag_snapshot_id: Optional[str] = None,
        performance_snapshot_id: Optional[str] = None,
        action_description: str = "",
        metadata: Optional[Dict[str, Any]] = None,
        # Phase 2.3: New parameters for Screen/State representation
        url_pattern: Optional[str] = None,
        title: Optional[str] = None,
        key_elements: Optional[List[str]] = None,
        screenshot_url: Optional[str] = None,
        a11y_summary: Optional[Dict[str, Any]] = None,
        perf_summary: Optional[Dict[str, Any]] = None
    ) -> ActionGraphNode:
        """Add a new node to the graph"""
        # Update previous node's state_after
        if self.current_node:
            self.current_node.state_after = None  # Will be set after DOM snapshot
        
        # Create new node (Phase 2.3: Enhanced with Screen/State fields)
        node = ActionGraphNode(
            event_type=event_type,
            target_selector=target_selector,
            target_text=target_text,
            url=url,
            dom_snapshot_id=dom_snapshot_id,
            wcag_snapshot_id=wcag_snapshot_id,
            performance_snapshot_id=performance_snapshot_id,
            action_description=action_description,
            metadata=metadata,
            url_pattern=url_pattern,
            title=title,
            key_elements=key_elements,
            screenshot_url=screenshot_url,
            a11y_summary=a11y_summary,
            perf_summary=perf_summary
        )
        
        # Set state_before to previous node
        if self.current_node:
            node.state_before = self.current_node.id
            self.current_node.state_after = node.id
        
        # Add node
        self.nodes.append(node)
        self.node_map[node.id] = node
        self.current_node = node
        
        # Create edge from previous node
        if len(self.nodes) > 1:
            previous_node = self.nodes[-2]
            edge = self._create_edge(previous_node, node, event_type)
            self.edges.append(edge)
        
        return node
    
    def _create_edge(
        self,
        from_node: ActionGraphNode,
        to_node: ActionGraphNode,
        action: str
    ) -> ActionGraphEdge:
        """Create an edge between two nodes"""
        # Calculate transition time
        transition_time = (to_node.timestamp - from_node.timestamp).total_seconds() * 1000
        
        # Extract latency from metadata if available
        latency_ms = to_node.metadata.get("latency_ms", 0)
        
        # Collect warnings
        warnings = []
        if latency_ms > 1000:
            warnings.append(f"High latency: {latency_ms}ms")
        if to_node.metadata.get("wcag_violations_count", 0) > 0:
            warnings.append(f"WCAG violations: {to_node.metadata.get('wcag_violations_count')}")
        if to_node.metadata.get("performance_issues_count", 0) > 0:
            warnings.append(f"Performance issues: {to_node.metadata.get('performance_issues_count')}")
        
        # Build description from node information - prioritize target_text
        description = None
        if to_node.target_text:
            # Use target_text directly for better readability
            description = f"User {action}s '{to_node.target_text}'" if action == "click" else f"{action} on {to_node.target_text}"
        elif to_node.action_description:
            # Extract text from action_description if it contains meaningful text
            desc = to_node.action_description
            # Pattern: "CLICK_BUTTON: BUTTON - Text" -> extract "Text"
            if " - " in desc:
                parts = desc.split(" - ", 1)
                if len(parts) > 1:
                    extracted_text = parts[-1].strip()
                    if extracted_text and len(extracted_text) > 2:
                        description = f"User {action}s '{extracted_text}'" if action == "click" else f"{action} on {extracted_text}"
            if not description:
                description = desc
        else:
            description = f"{action} on {to_node.title or 'element'}"
        
        # Build locators from target_selector
        locators = {}
        if to_node.target_selector:
            locators["primary"] = to_node.target_selector
        
        # Build inputs from metadata
        inputs = {}
        if to_node.metadata and to_node.metadata.get("value"):
            inputs["value"] = to_node.metadata.get("value")
        
        return ActionGraphEdge(
            from_node_id=from_node.id,
            to_node_id=to_node.id,
            action=action,
            description=description,
            locators=locators,
            inputs=inputs,
            transition_time_ms=transition_time,
            latency_ms=latency_ms,
            warnings=warnings
        )
    
    def get_node(self, node_id: str) -> Optional[ActionGraphNode]:
        """Get a node by ID"""
        return self.node_map.get(node_id)
    
    def get_path(self, from_node_id: str, to_node_id: str) -> List[ActionGraphNode]:
        """Get the path between two nodes"""
        # Simple BFS to find path
        visited = set()
        queue = [(from_node_id, [])]
        
        while queue:
            current_id, path = queue.pop(0)
            if current_id in visited:
                continue
            visited.add(current_id)
            
            current_node = self.node_map.get(current_id)
            if not current_node:
                continue
            
            new_path = path + [current_node]
            
            if current_id == to_node_id:
                return new_path
            
            # Find edges from this node
            for edge in self.edges:
                if edge.from_node_id == current_id:
                    queue.append((edge.to_node_id, new_path))
        
        return []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert graph to dictionary"""
        return {
            "session_id": self.session_id,
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
            "metadata": {
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
                "current_node_id": self.current_node.id if self.current_node else None
            }
        }
    
    def load_from_session_data(self, nodes_data: List[Dict[str, Any]], edges_data: List[Dict[str, Any]]):
        """Load nodes and edges from session data, preserving original IDs"""
        from dateutil import parser
        
        # Clear existing data
        self.nodes = []
        self.edges = []
        self.node_map = {}
        self.current_node = None
        
        # Load nodes with original IDs
        for node_data in nodes_data:
            node = ActionGraphNode(
                event_type=node_data.get("event_type", "unknown"),
                target_selector=node_data.get("target_selector"),
                target_text=node_data.get("target_text"),
                url=node_data.get("url"),
                dom_snapshot_id=node_data.get("dom_snapshot_id"),
                wcag_snapshot_id=node_data.get("wcag_snapshot_id"),
                performance_snapshot_id=node_data.get("performance_snapshot_id"),
                action_description=node_data.get("action_description", ""),
                metadata=node_data.get("metadata", {}),
                node_id=node_data.get("id"),  # Preserve original ID
                timestamp=parser.parse(node_data.get("timestamp")) if node_data.get("timestamp") else None,
                url_pattern=node_data.get("url_pattern"),
                title=node_data.get("title"),
                key_elements=node_data.get("key_elements"),
                screenshot_url=node_data.get("screenshot_url"),  # Preserve screenshot
                a11y_summary=node_data.get("a11y_summary"),
                perf_summary=node_data.get("perf_summary")
            )
            node.state_before = node_data.get("state_before")
            node.state_after = node_data.get("state_after")
            
            # Debug logging to verify data is loaded
            logger.debug(f"Loaded node {node.id}: event_type={node.event_type}, target_text={node.target_text}, "
                        f"target_selector={node.target_selector}, metadata.value={node.metadata.get('value')}, "
                        f"action_description={node.action_description[:50] if node.action_description else None}")
            
            self.nodes.append(node)
            self.node_map[node.id] = node
            
            # Set current node to last one
            self.current_node = node
        
        # Load edges - recreate them using _create_edge to ensure locators and inputs are populated
        # This is critical because session edges don't have locators/inputs, but nodes do
        for edge_data in edges_data:
            from_node_id = edge_data.get("from_node_id")
            to_node_id = edge_data.get("to_node_id")
            action = edge_data.get("action", "")
            
            from_node = self.node_map.get(from_node_id)
            to_node = self.node_map.get(to_node_id)
            
            if from_node and to_node:
                # Recreate edge using _create_edge to get proper locators and inputs
                edge = self._create_edge(from_node, to_node, action)
                # Preserve original edge ID if available
                if edge_data.get("id"):
                    edge.id = edge_data.get("id")
                # Preserve other edge data
                edge.transition_time_ms = edge_data.get("transition_time_ms", edge.transition_time_ms)
                edge.latency_ms = edge_data.get("latency_ms", edge.latency_ms)
                edge.warnings = edge_data.get("warnings", edge.warnings)
                
                logger.debug(f"Recreated edge {edge.id}: action={action}, has_locators={bool(edge.locators)}, "
                           f"has_inputs={bool(edge.inputs)}, description={edge.description[:50] if edge.description else None}")
            else:
                # Fallback: create edge directly if nodes not found (shouldn't happen)
                logger.warning(f"Could not find nodes for edge: from={from_node_id}, to={to_node_id}")
                edge = ActionGraphEdge(
                    from_node_id=from_node_id,
                    to_node_id=to_node_id,
                    action=action,
                    transition_time_ms=edge_data.get("transition_time_ms", 0),
                    latency_ms=edge_data.get("latency_ms", 0),
                    warnings=edge_data.get("warnings", []),
                    edge_id=edge_data.get("id"),
                    description=edge_data.get("description"),
                    locators=edge_data.get("locators", {}),
                    inputs=edge_data.get("inputs", {})
                )
            
            self.edges.append(edge)
        
        logger.info(f"Loaded {len(self.nodes)} nodes and recreated {len(self.edges)} edges from session data")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get graph statistics"""
        event_types = {}
        for node in self.nodes:
            event_types[node.event_type] = event_types.get(node.event_type, 0) + 1
        
        total_warnings = sum(len(edge.warnings) for edge in self.edges)
        avg_transition_time = sum(edge.transition_time_ms for edge in self.edges) / len(self.edges) if self.edges else 0
        avg_latency = sum(edge.latency_ms for edge in self.edges) / len(self.edges) if self.edges else 0
        
        return {
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "event_types": event_types,
            "total_warnings": total_warnings,
            "average_transition_time_ms": avg_transition_time,
            "average_latency_ms": avg_latency
        }

