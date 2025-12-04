"""
Flowstral Event Coalescing Service
Coalesces low-level events into semantic user actions
"""

import logging
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Event types"""
    CLICK = "click"
    INPUT = "input"
    SELECT = "select"
    SUBMIT = "submit"
    NAVIGATE = "navigate"
    FOCUS = "focus"
    BLUR = "blur"
    CHANGE = "change"
    KEYDOWN = "keydown"
    KEYUP = "keyup"


@dataclass
class Event:
    """Raw event from browser"""
    event_id: str
    event_type: str
    timestamp: float
    element_id: Optional[str] = None
    element_selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EventGroup:
    """Group of related events"""
    events: List[Event] = field(default_factory=list)
    element_id: Optional[str] = None
    element_selector: Optional[str] = None
    start_timestamp: Optional[float] = None
    last_timestamp: Optional[float] = None
    compatible_types: Set[str] = field(default_factory=set)
    
    def __post_init__(self):
        if self.events:
            first_event = self.events[0]
            self.element_id = first_event.element_id
            self.element_selector = first_event.element_selector
            self.start_timestamp = first_event.timestamp
            self.last_timestamp = first_event.timestamp
            self.compatible_types = {first_event.event_type}
    
    def add_event(self, event: Event):
        """Add event to group"""
        self.events.append(event)
        self.last_timestamp = event.timestamp
        self.compatible_types.add(event.event_type)
    
    def get_duration_ms(self) -> float:
        """Get duration of event group in milliseconds"""
        if not self.start_timestamp or not self.last_timestamp:
            return 0.0
        return (self.last_timestamp - self.start_timestamp) * 1000


@dataclass
class CoalescedAction:
    """Coalesced semantic action"""
    action_id: str
    action_type: str  # "fill_field", "click_button", "submit_form", etc.
    description: str
    element_id: Optional[str] = None
    element_selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    start_timestamp: float = 0.0
    end_timestamp: float = 0.0
    duration_ms: float = 0.0
    event_count: int = 0
    raw_events: List[Event] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class EventCoalescer:
    """
    Coalesces low-level events into semantic user actions
    
    Examples:
    - focus → input → input → blur → "User fills Email field"
    - click → click → click (rapid) → "User clicks Submit (3 times)"
    - input → input → input (same field) → "User types in Username field"
    """
    
    # Compatible event types that can be grouped
    COMPATIBLE_GROUPS = {
        "input_sequence": {EventType.FOCUS, EventType.INPUT, EventType.CHANGE, EventType.BLUR},
        "click_sequence": {EventType.CLICK},
        "key_sequence": {EventType.KEYDOWN, EventType.KEYUP},
    }
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.coalescing_window_ms = self.config.get('coalescing_window_ms', 500)
        self.max_click_count = self.config.get('max_click_count', 5)
        self.input_debounce_ms = self.config.get('input_debounce_ms', 300)
    
    def coalesce_events(self, events: List[Event]) -> List[CoalescedAction]:
        """
        Coalesce events into semantic actions
        
        Args:
            events: List of raw events from browser
            
        Returns:
            List of coalesced actions
        """
        if not events:
            return []
        
        # Sort events by timestamp
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        
        coalesced = []
        current_group: Optional[EventGroup] = None
        
        for event in sorted_events:
            if self._should_start_new_group(event, current_group):
                # Finalize current group
                if current_group:
                    action = self._create_action_from_group(current_group)
                    coalesced.append(action)
                
                # Start new group
                current_group = EventGroup([event])
            else:
                # Add to current group
                current_group.add_event(event)
        
        # Finalize last group
        if current_group:
            action = self._create_action_from_group(current_group)
            coalesced.append(action)
        
        logger.info(f"Coalesced {len(events)} events into {len(coalesced)} actions")
        return coalesced
    
    def _should_start_new_group(
        self,
        event: Event,
        current_group: Optional[EventGroup]
    ) -> bool:
        """Determine if event should start a new action group"""
        if not current_group:
            return True
        
        # Different element → new group
        if event.element_id and current_group.element_id:
            if event.element_id != current_group.element_id:
                return True
        
        # Different selector → new group
        if event.element_selector and current_group.element_selector:
            if event.element_selector != current_group.element_selector:
                return True
        
        # Time gap too large → new group
        if current_group.last_timestamp:
            time_gap_ms = (event.timestamp - current_group.last_timestamp) * 1000
            if time_gap_ms > self.coalescing_window_ms:
                return True
        
        # Navigation always starts new group
        if event.event_type == EventType.NAVIGATE.value:
            return True
        
        # Submit always starts new group
        if event.event_type == EventType.SUBMIT.value:
            return True
        
        # Check compatibility
        if not self._are_compatible(event, current_group):
            return True
        
        return False
    
    def _are_compatible(self, event: Event, group: EventGroup) -> bool:
        """Check if event is compatible with current group"""
        event_type_enum = self._get_event_type_enum(event.event_type)
        if not event_type_enum:
            return False
        
        # Check if event type is compatible with group
        for group_name, compatible_types in self.COMPATIBLE_GROUPS.items():
            if event_type_enum in compatible_types:
                # Check if any existing event in group is also compatible
                for existing_event in group.events:
                    existing_type = self._get_event_type_enum(existing_event.event_type)
                    if existing_type and existing_type in compatible_types:
                        return True
        
        return False
    
    def _get_event_type_enum(self, event_type: str) -> Optional[EventType]:
        """Convert string event type to enum"""
        try:
            return EventType(event_type.lower())
        except ValueError:
            return None
    
    def _create_action_from_group(self, group: EventGroup) -> CoalescedAction:
        """Create coalesced action from event group"""
        import uuid
        
        # Determine action type and description
        action_type, description = self._infer_action_type(group)
        
        # Extract value (for input actions)
        value = None
        if action_type in ["fill_field", "select_option"]:
            # Get value from last input/select event
            for event in reversed(group.events):
                if event.value:
                    value = event.value
                    break
        
        # Count clicks if multiple
        click_count = sum(1 for e in group.events if e.event_type == EventType.CLICK.value)
        
        # Build metadata
        metadata = {
            "event_count": len(group.events),
            "event_types": list(set(e.event_type for e in group.events)),
            "duration_ms": group.get_duration_ms()
        }
        
        if click_count > 1:
            metadata["click_count"] = click_count
        
        return CoalescedAction(
            action_id=str(uuid.uuid4()),
            action_type=action_type,
            description=description,
            element_id=group.element_id,
            element_selector=group.element_selector,
            value=value,
            url=group.events[-1].url if group.events else None,
            start_timestamp=group.start_timestamp or 0.0,
            end_timestamp=group.last_timestamp or 0.0,
            duration_ms=group.get_duration_ms(),
            event_count=len(group.events),
            raw_events=group.events,
            metadata=metadata
        )
    
    def _infer_action_type(self, group: EventGroup) -> tuple[str, str]:
        """Infer action type and description from event group"""
        event_types = set(e.event_type for e in group.events)
        first_event = group.events[0]
        last_event = group.events[-1]
        
        # Input sequence (focus → input → blur)
        if EventType.FOCUS.value in event_types and EventType.INPUT.value in event_types:
            field_name = self._extract_field_name(first_event)
            return "fill_field", f"User fills {field_name} field"
        
        # Select option
        if EventType.SELECT.value in event_types:
            field_name = self._extract_field_name(first_event)
            value = last_event.value or "option"
            return "select_option", f"User selects '{value}' from {field_name}"
        
        # Submit form
        if EventType.SUBMIT.value in event_types:
            return "submit_form", "User submits form"
        
        # Multiple clicks (rapid)
        click_count = sum(1 for e in group.events if e.event_type == EventType.CLICK.value)
        if click_count > 1:
            button_name = self._extract_element_name(first_event)
            return "click_button", f"User clicks {button_name} ({click_count} times)"
        
        # Single click
        if EventType.CLICK.value in event_types:
            button_name = self._extract_element_name(first_event)
            return "click_button", f"User clicks {button_name}"
        
        # Navigation
        if EventType.NAVIGATE.value in event_types:
            url = last_event.url or "page"
            return "navigate", f"User navigates to {url}"
        
        # Default: use first event type
        return "unknown", f"User {first_event.event_type}"
    
    def _extract_field_name(self, event: Event) -> str:
        """Extract field name from event"""
        # Try metadata first
        if event.metadata.get("field_name"):
            return event.metadata["field_name"]
        
        # Try element selector
        if event.element_selector:
            # Extract from selector (e.g., "#email" -> "Email")
            selector = event.element_selector
            if selector.startswith("#"):
                return selector[1:].replace("-", " ").replace("_", " ").title()
            if selector.startswith("[name="):
                name = selector.split("=")[1].split("]")[0].strip('"\'')
                return name.replace("-", " ").replace("_", " ").title()
        
        # Try element ID
        if event.element_id:
            return event.element_id.replace("-", " ").replace("_", " ").title()
        
        return "field"
    
    def _extract_element_name(self, event: Event) -> str:
        """Extract element name from event"""
        # Try metadata first
        if event.metadata.get("element_name"):
            return event.metadata["element_name"]
        
        # Try text content
        if event.metadata.get("text_content"):
            text = event.metadata["text_content"]
            if len(text) < 50:
                return f"'{text}'"
        
        # Try element selector
        if event.element_selector:
            selector = event.element_selector
            if selector.startswith("#"):
                return selector[1:].replace("-", " ").replace("_", " ").title()
        
        # Try element ID
        if event.element_id:
            return event.element_id.replace("-", " ").replace("_", " ").title()
        
        return "element"


# Global instance
_event_coalescer: Optional[EventCoalescer] = None


def get_event_coalescer(config: Optional[Dict[str, Any]] = None) -> EventCoalescer:
    """Get global event coalescer instance"""
    global _event_coalescer
    if _event_coalescer is None:
        _event_coalescer = EventCoalescer(config)
    return _event_coalescer

