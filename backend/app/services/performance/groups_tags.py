"""
Groups and Tags - Request organization for performance testing
Comparable to k6's group() function and tag system

Features:
- Groups: Logical grouping of requests (like user flows)
- Tags: Key-value labels for filtering and aggregation
- Nested groups support
- Group-level metrics
- Tag-based result filtering
"""

import logging
import time
import threading
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@dataclass
class GroupMetrics:
    """Metrics for a group"""
    name: str
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    duration_ms: float = 0.0
    request_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_response_time_ms: float = 0.0
    
    @property
    def avg_response_time_ms(self) -> float:
        return self.total_response_time_ms / self.request_count if self.request_count > 0 else 0.0
    
    @property
    def success_rate(self) -> float:
        return self.success_count / self.request_count if self.request_count > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_ms": self.duration_ms,
            "request_count": self.request_count,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "avg_response_time_ms": self.avg_response_time_ms,
            "success_rate": self.success_rate
        }


@dataclass
class TaggedValue:
    """A value with associated tags"""
    value: Any
    tags: Dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def has_tag(self, key: str, value: str = None) -> bool:
        """Check if has tag (optionally with specific value)"""
        if key not in self.tags:
            return False
        if value is not None:
            return self.tags[key] == value
        return True


class GroupManager:
    """
    Manages groups of requests for organized testing.
    
    Usage:
        manager = GroupManager()
        
        # Use as context manager (recommended)
        with manager.group("login_flow"):
            # Make requests here
            pass
        
        # Or manually
        manager.start_group("checkout_flow")
        # Make requests
        manager.end_group("checkout_flow")
        
        # Get group metrics
        metrics = manager.get_group_metrics("login_flow")
    """
    
    def __init__(self):
        self._groups: Dict[str, GroupMetrics] = {}
        self._active_groups: List[str] = []  # Stack for nested groups
        self._lock = threading.Lock()
    
    @contextmanager
    def group(self, name: str):
        """
        Context manager for groups (k6-style).
        
        Usage:
            with manager.group("login"):
                response = make_request(...)
        """
        self.start_group(name)
        try:
            yield self._groups.get(name)
        finally:
            self.end_group(name)
    
    def start_group(self, name: str):
        """Start a new group"""
        with self._lock:
            # Create full path for nested groups
            full_name = self._get_full_group_name(name)
            
            if full_name not in self._groups:
                self._groups[full_name] = GroupMetrics(name=full_name)
            
            self._groups[full_name].start_time = datetime.utcnow()
            self._active_groups.append(name)
            
            logger.debug(f"Started group: {full_name}")
    
    def end_group(self, name: str):
        """End a group"""
        with self._lock:
            if name in self._active_groups:
                # Get full path before removing
                full_name = self._get_full_group_name(name)
                
                # Remove from active
                self._active_groups = [g for g in self._active_groups if g != name]
                
                if full_name in self._groups:
                    group = self._groups[full_name]
                    group.end_time = datetime.utcnow()
                    group.duration_ms = (group.end_time - group.start_time).total_seconds() * 1000
                    
                    logger.debug(f"Ended group: {full_name} ({group.duration_ms:.2f}ms)")
    
    def _get_full_group_name(self, name: str) -> str:
        """Get full group name including parents"""
        if not self._active_groups:
            return name
        return "::".join(self._active_groups + [name])
    
    def get_current_group(self) -> Optional[str]:
        """Get current active group name"""
        with self._lock:
            if not self._active_groups:
                return None
            return "::".join(self._active_groups)
    
    def record_request(
        self,
        success: bool,
        response_time_ms: float,
        group_name: Optional[str] = None
    ):
        """Record a request within the current or specified group"""
        with self._lock:
            # Determine group name
            if group_name:
                full_name = group_name
            elif self._active_groups:
                full_name = "::".join(self._active_groups)
            else:
                return  # No group active
            
            if full_name not in self._groups:
                self._groups[full_name] = GroupMetrics(name=full_name)
            
            group = self._groups[full_name]
            group.request_count += 1
            group.total_response_time_ms += response_time_ms
            
            if success:
                group.success_count += 1
            else:
                group.failure_count += 1
    
    def get_group_metrics(self, name: str) -> Optional[Dict[str, Any]]:
        """Get metrics for a specific group"""
        with self._lock:
            if name in self._groups:
                return self._groups[name].to_dict()
            return None
    
    def get_all_group_metrics(self) -> Dict[str, Any]:
        """Get metrics for all groups"""
        with self._lock:
            return {
                name: group.to_dict()
                for name, group in self._groups.items()
            }
    
    def list_groups(self) -> List[str]:
        """List all group names"""
        with self._lock:
            return list(self._groups.keys())
    
    def reset(self):
        """Reset all groups"""
        with self._lock:
            self._groups.clear()
            self._active_groups.clear()


class TagManager:
    """
    Manages tags for filtering and aggregation.
    
    Usage:
        manager = TagManager()
        
        # Set global tags for all requests
        manager.set_global_tag("environment", "production")
        
        # Add tags to a request
        manager.tag_request(request_id, {"name": "login", "scenario": "checkout"})
        
        # Filter results by tag
        results = manager.filter_by_tag("scenario", "checkout")
    """
    
    def __init__(self):
        self._global_tags: Dict[str, str] = {}
        self._request_tags: Dict[str, Dict[str, str]] = {}
        self._tagged_values: List[TaggedValue] = []
        self._lock = threading.Lock()
    
    def set_global_tag(self, key: str, value: str):
        """Set a global tag applied to all requests"""
        with self._lock:
            self._global_tags[key] = value
    
    def remove_global_tag(self, key: str):
        """Remove a global tag"""
        with self._lock:
            self._global_tags.pop(key, None)
    
    def get_global_tags(self) -> Dict[str, str]:
        """Get all global tags"""
        with self._lock:
            return self._global_tags.copy()
    
    def tag_request(self, request_id: str, tags: Dict[str, str]):
        """Add tags to a specific request"""
        with self._lock:
            if request_id not in self._request_tags:
                self._request_tags[request_id] = {}
            
            # Merge global tags with request-specific tags
            self._request_tags[request_id].update(self._global_tags)
            self._request_tags[request_id].update(tags)
    
    def get_request_tags(self, request_id: str) -> Dict[str, str]:
        """Get all tags for a request"""
        with self._lock:
            tags = self._global_tags.copy()
            tags.update(self._request_tags.get(request_id, {}))
            return tags
    
    def record_value(self, value: Any, tags: Dict[str, str] = None):
        """Record a tagged value"""
        with self._lock:
            full_tags = self._global_tags.copy()
            if tags:
                full_tags.update(tags)
            
            self._tagged_values.append(TaggedValue(
                value=value,
                tags=full_tags
            ))
    
    def filter_by_tag(self, key: str, value: str = None) -> List[TaggedValue]:
        """Filter recorded values by tag"""
        with self._lock:
            return [
                tv for tv in self._tagged_values
                if tv.has_tag(key, value)
            ]
    
    def aggregate_by_tag(self, tag_key: str) -> Dict[str, List[TaggedValue]]:
        """Group values by a tag key"""
        with self._lock:
            result: Dict[str, List[TaggedValue]] = {}
            
            for tv in self._tagged_values:
                if tag_key in tv.tags:
                    tag_value = tv.tags[tag_key]
                    if tag_value not in result:
                        result[tag_value] = []
                    result[tag_value].append(tv)
            
            return result
    
    def get_unique_tag_values(self, tag_key: str) -> List[str]:
        """Get unique values for a tag key"""
        with self._lock:
            values = set()
            for tv in self._tagged_values:
                if tag_key in tv.tags:
                    values.add(tv.tags[tag_key])
            return list(values)
    
    def reset(self):
        """Reset all tags"""
        with self._lock:
            self._global_tags.clear()
            self._request_tags.clear()
            self._tagged_values.clear()


class TestContext:
    """
    Combined context for groups and tags during test execution.
    
    Usage:
        ctx = TestContext()
        
        # Set global context
        ctx.tags.set_global_tag("test_run_id", "run-123")
        
        # Use groups
        with ctx.groups.group("login_flow"):
            # Make requests with automatic tagging
            response = make_request(...)
            ctx.record_request(
                request_id="req-1",
                response_time_ms=150,
                success=True,
                tags={"name": "POST /login"}
            )
        
        # Get combined results
        summary = ctx.get_summary()
    """
    
    def __init__(self):
        self.groups = GroupManager()
        self.tags = TagManager()
        self._lock = threading.Lock()
    
    def record_request(
        self,
        request_id: str,
        response_time_ms: float,
        success: bool,
        tags: Dict[str, str] = None
    ):
        """Record a request with groups and tags"""
        with self._lock:
            # Record in current group
            self.groups.record_request(success, response_time_ms)
            
            # Tag the request
            full_tags = tags or {}
            
            # Add group as tag if in a group
            current_group = self.groups.get_current_group()
            if current_group:
                full_tags["group"] = current_group
            
            self.tags.tag_request(request_id, full_tags)
            
            # Record tagged value for aggregation
            self.tags.record_value({
                "request_id": request_id,
                "response_time_ms": response_time_ms,
                "success": success
            }, full_tags)
    
    def get_summary(self) -> Dict[str, Any]:
        """Get combined summary"""
        return {
            "groups": self.groups.get_all_group_metrics(),
            "global_tags": self.tags.get_global_tags(),
            "unique_tags": {
                "name": self.tags.get_unique_tag_values("name"),
                "group": self.tags.get_unique_tag_values("group"),
                "scenario": self.tags.get_unique_tag_values("scenario")
            }
        }
    
    def reset(self):
        """Reset context"""
        self.groups.reset()
        self.tags.reset()


# Singleton instances
_group_manager: Optional[GroupManager] = None
_tag_manager: Optional[TagManager] = None
_test_context: Optional[TestContext] = None

def get_group_manager() -> GroupManager:
    """Get singleton group manager"""
    global _group_manager
    if _group_manager is None:
        _group_manager = GroupManager()
    return _group_manager

def get_tag_manager() -> TagManager:
    """Get singleton tag manager"""
    global _tag_manager
    if _tag_manager is None:
        _tag_manager = TagManager()
    return _tag_manager

def get_test_context() -> TestContext:
    """Get singleton test context"""
    global _test_context
    if _test_context is None:
        _test_context = TestContext()
    return _test_context


# Convenience function (k6-style)
def group(name: str):
    """
    k6-style group context manager.
    
    Usage:
        with group("login"):
            make_request(...)
    """
    return get_group_manager().group(name)
