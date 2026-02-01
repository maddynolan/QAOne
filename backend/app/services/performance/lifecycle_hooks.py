"""
Lifecycle Hooks - Setup and teardown for performance tests
Comparable to k6's setup() and teardown() functions

Features:
- Global setup (runs once before all VUs)
- Global teardown (runs once after all VUs)
- Per-VU setup (runs once per VU before iterations)
- Per-VU teardown (runs once per VU after iterations)
- Pre-request hooks (before each request)
- Post-request hooks (after each request)
- Data sharing between setup and VUs
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import threading

logger = logging.getLogger(__name__)


class HookType(Enum):
    """Types of lifecycle hooks"""
    GLOBAL_SETUP = "global_setup"
    GLOBAL_TEARDOWN = "global_teardown"
    VU_SETUP = "vu_setup"
    VU_TEARDOWN = "vu_teardown"
    PRE_REQUEST = "pre_request"
    POST_REQUEST = "post_request"
    PRE_ITERATION = "pre_iteration"
    POST_ITERATION = "post_iteration"
    ON_ERROR = "on_error"


@dataclass
class HookResult:
    """Result of a hook execution"""
    hook_type: HookType
    hook_name: str
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hook_type": self.hook_type.value,
            "hook_name": self.hook_name,
            "success": self.success,
            "data": str(self.data)[:500] if self.data else None,
            "error": self.error,
            "duration_ms": self.duration_ms,
            "timestamp": self.timestamp.isoformat()
        }


class LifecycleHooks:
    """
    Manages lifecycle hooks for performance tests.
    
    Usage:
        hooks = LifecycleHooks()
        
        # Register global setup (runs once before test)
        @hooks.setup
        async def global_setup():
            # Create test data, authenticate, etc.
            return {"token": "auth-token-123"}
        
        # Register global teardown (runs once after test)
        @hooks.teardown
        async def global_teardown(data):
            # Cleanup resources
            print(f"Test completed with data: {data}")
        
        # Register per-VU setup
        @hooks.vu_setup
        async def vu_setup(vu_id: str, global_data: dict):
            # Setup per VU (e.g., unique user)
            return {"user": f"user_{vu_id}"}
        
        # Register pre-request hook
        @hooks.pre_request
        async def before_request(request: dict, vu_data: dict):
            # Modify request before sending
            request["headers"]["Authorization"] = f"Bearer {vu_data['token']}"
            return request
        
        # Execute hooks during test
        data = await hooks.run_global_setup()
        vu_data = await hooks.run_vu_setup("vu_1", data)
        await hooks.run_global_teardown(data)
    """
    
    def __init__(self):
        self._hooks: Dict[HookType, List[tuple]] = {
            hook_type: [] for hook_type in HookType
        }
        self._global_data: Dict[str, Any] = {}
        self._vu_data: Dict[str, Dict[str, Any]] = {}
        self._results: List[HookResult] = []
        self._lock = threading.Lock()
    
    # ==================== Decorator Registration ====================
    
    def setup(self, func: Callable = None, name: str = None):
        """Decorator to register global setup hook"""
        def decorator(f):
            self._register_hook(HookType.GLOBAL_SETUP, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def teardown(self, func: Callable = None, name: str = None):
        """Decorator to register global teardown hook"""
        def decorator(f):
            self._register_hook(HookType.GLOBAL_TEARDOWN, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def vu_setup(self, func: Callable = None, name: str = None):
        """Decorator to register per-VU setup hook"""
        def decorator(f):
            self._register_hook(HookType.VU_SETUP, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def vu_teardown(self, func: Callable = None, name: str = None):
        """Decorator to register per-VU teardown hook"""
        def decorator(f):
            self._register_hook(HookType.VU_TEARDOWN, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def pre_request(self, func: Callable = None, name: str = None):
        """Decorator to register pre-request hook"""
        def decorator(f):
            self._register_hook(HookType.PRE_REQUEST, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def post_request(self, func: Callable = None, name: str = None):
        """Decorator to register post-request hook"""
        def decorator(f):
            self._register_hook(HookType.POST_REQUEST, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def pre_iteration(self, func: Callable = None, name: str = None):
        """Decorator to register pre-iteration hook"""
        def decorator(f):
            self._register_hook(HookType.PRE_ITERATION, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def post_iteration(self, func: Callable = None, name: str = None):
        """Decorator to register post-iteration hook"""
        def decorator(f):
            self._register_hook(HookType.POST_ITERATION, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def on_error(self, func: Callable = None, name: str = None):
        """Decorator to register error handler hook"""
        def decorator(f):
            self._register_hook(HookType.ON_ERROR, f, name or f.__name__)
            return f
        return decorator(func) if func else decorator
    
    def _register_hook(self, hook_type: HookType, func: Callable, name: str):
        """Register a hook function"""
        with self._lock:
            self._hooks[hook_type].append((name, func))
            logger.debug(f"Registered {hook_type.value} hook: {name}")
    
    # ==================== Manual Registration ====================
    
    def register(self, hook_type: HookType, func: Callable, name: str = None):
        """Manually register a hook"""
        self._register_hook(hook_type, func, name or func.__name__)
    
    def unregister(self, hook_type: HookType, name: str):
        """Unregister a hook by name"""
        with self._lock:
            self._hooks[hook_type] = [
                (n, f) for n, f in self._hooks[hook_type] if n != name
            ]
    
    # ==================== Hook Execution ====================
    
    async def run_global_setup(self) -> Dict[str, Any]:
        """Run global setup hooks"""
        for name, func in self._hooks[HookType.GLOBAL_SETUP]:
            result = await self._execute_hook(
                HookType.GLOBAL_SETUP, name, func
            )
            
            if result.success and result.data:
                self._global_data.update(
                    result.data if isinstance(result.data, dict) else {"data": result.data}
                )
        
        logger.info(f"Global setup complete. Data keys: {list(self._global_data.keys())}")
        return self._global_data
    
    async def run_global_teardown(self, data: Dict[str, Any] = None):
        """Run global teardown hooks"""
        teardown_data = data or self._global_data
        
        for name, func in self._hooks[HookType.GLOBAL_TEARDOWN]:
            await self._execute_hook(
                HookType.GLOBAL_TEARDOWN, name, func, teardown_data
            )
        
        logger.info("Global teardown complete")
    
    async def run_vu_setup(self, vu_id: str, global_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Run per-VU setup hooks"""
        setup_data = global_data or self._global_data
        vu_data = {"vu_id": vu_id}
        
        for name, func in self._hooks[HookType.VU_SETUP]:
            result = await self._execute_hook(
                HookType.VU_SETUP, name, func, vu_id, setup_data
            )
            
            if result.success and result.data:
                vu_data.update(
                    result.data if isinstance(result.data, dict) else {"data": result.data}
                )
        
        with self._lock:
            self._vu_data[vu_id] = vu_data
        
        logger.debug(f"VU setup complete for {vu_id}")
        return vu_data
    
    async def run_vu_teardown(self, vu_id: str, vu_data: Dict[str, Any] = None):
        """Run per-VU teardown hooks"""
        with self._lock:
            teardown_data = vu_data or self._vu_data.get(vu_id, {})
        
        for name, func in self._hooks[HookType.VU_TEARDOWN]:
            await self._execute_hook(
                HookType.VU_TEARDOWN, name, func, vu_id, teardown_data
            )
        
        with self._lock:
            self._vu_data.pop(vu_id, None)
        
        logger.debug(f"VU teardown complete for {vu_id}")
    
    async def run_pre_request(
        self,
        request: Dict[str, Any],
        vu_id: str = None,
        vu_data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Run pre-request hooks"""
        with self._lock:
            context_data = vu_data or self._vu_data.get(vu_id, {})
        
        modified_request = request.copy()
        
        for name, func in self._hooks[HookType.PRE_REQUEST]:
            result = await self._execute_hook(
                HookType.PRE_REQUEST, name, func, modified_request, context_data
            )
            
            if result.success and result.data and isinstance(result.data, dict):
                modified_request = result.data
        
        return modified_request
    
    async def run_post_request(
        self,
        request: Dict[str, Any],
        response: Dict[str, Any],
        vu_id: str = None,
        vu_data: Dict[str, Any] = None
    ):
        """Run post-request hooks"""
        with self._lock:
            context_data = vu_data or self._vu_data.get(vu_id, {})
        
        for name, func in self._hooks[HookType.POST_REQUEST]:
            await self._execute_hook(
                HookType.POST_REQUEST, name, func, request, response, context_data
            )
    
    async def run_pre_iteration(self, vu_id: str, iteration: int, vu_data: Dict[str, Any] = None):
        """Run pre-iteration hooks"""
        with self._lock:
            context_data = vu_data or self._vu_data.get(vu_id, {})
        
        for name, func in self._hooks[HookType.PRE_ITERATION]:
            await self._execute_hook(
                HookType.PRE_ITERATION, name, func, vu_id, iteration, context_data
            )
    
    async def run_post_iteration(self, vu_id: str, iteration: int, vu_data: Dict[str, Any] = None):
        """Run post-iteration hooks"""
        with self._lock:
            context_data = vu_data or self._vu_data.get(vu_id, {})
        
        for name, func in self._hooks[HookType.POST_ITERATION]:
            await self._execute_hook(
                HookType.POST_ITERATION, name, func, vu_id, iteration, context_data
            )
    
    async def run_on_error(self, error: Exception, context: Dict[str, Any] = None):
        """Run error handler hooks"""
        for name, func in self._hooks[HookType.ON_ERROR]:
            await self._execute_hook(
                HookType.ON_ERROR, name, func, error, context or {}
            )
    
    async def _execute_hook(
        self,
        hook_type: HookType,
        name: str,
        func: Callable,
        *args
    ) -> HookResult:
        """Execute a single hook"""
        import time
        start_time = time.time()
        
        try:
            # Support both async and sync functions
            if asyncio.iscoroutinefunction(func):
                result_data = await func(*args)
            else:
                result_data = func(*args)
            
            duration_ms = (time.time() - start_time) * 1000
            
            result = HookResult(
                hook_type=hook_type,
                hook_name=name,
                success=True,
                data=result_data,
                duration_ms=duration_ms
            )
        
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"Hook {name} failed: {e}")
            
            result = HookResult(
                hook_type=hook_type,
                hook_name=name,
                success=False,
                error=str(e),
                duration_ms=duration_ms
            )
        
        with self._lock:
            self._results.append(result)
        
        return result
    
    # ==================== Data Access ====================
    
    def get_global_data(self) -> Dict[str, Any]:
        """Get global data from setup"""
        with self._lock:
            return self._global_data.copy()
    
    def set_global_data(self, key: str, value: Any):
        """Set global data"""
        with self._lock:
            self._global_data[key] = value
    
    def get_vu_data(self, vu_id: str) -> Dict[str, Any]:
        """Get VU-specific data"""
        with self._lock:
            return self._vu_data.get(vu_id, {}).copy()
    
    def set_vu_data(self, vu_id: str, key: str, value: Any):
        """Set VU-specific data"""
        with self._lock:
            if vu_id not in self._vu_data:
                self._vu_data[vu_id] = {}
            self._vu_data[vu_id][key] = value
    
    # ==================== Results & Summary ====================
    
    def get_results(self) -> List[Dict[str, Any]]:
        """Get all hook execution results"""
        with self._lock:
            return [r.to_dict() for r in self._results]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of hook executions"""
        with self._lock:
            total = len(self._results)
            successes = sum(1 for r in self._results if r.success)
            failures = total - successes
            
            by_type = {}
            for hook_type in HookType:
                type_results = [r for r in self._results if r.hook_type == hook_type]
                if type_results:
                    by_type[hook_type.value] = {
                        "total": len(type_results),
                        "successes": sum(1 for r in type_results if r.success),
                        "failures": sum(1 for r in type_results if not r.success),
                        "avg_duration_ms": sum(r.duration_ms for r in type_results) / len(type_results)
                    }
            
            return {
                "total_executions": total,
                "successes": successes,
                "failures": failures,
                "success_rate": successes / total if total > 0 else 1.0,
                "by_type": by_type
            }
    
    def reset(self):
        """Reset all hooks and data"""
        with self._lock:
            for hook_type in HookType:
                self._hooks[hook_type].clear()
            self._global_data.clear()
            self._vu_data.clear()
            self._results.clear()


# Singleton instance
_lifecycle_hooks: Optional[LifecycleHooks] = None

def get_lifecycle_hooks() -> LifecycleHooks:
    """Get singleton lifecycle hooks"""
    global _lifecycle_hooks
    if _lifecycle_hooks is None:
        _lifecycle_hooks = LifecycleHooks()
    return _lifecycle_hooks
