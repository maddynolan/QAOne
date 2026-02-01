"""
Workload Models - Open and Closed workload model implementations
Comparable to k6 executors and Gatling injection profiles

Supports:
- Closed Model (VU-based): Fixed number of concurrent virtual users
- Open Model (Arrival Rate): Control rate of new users/requests
- Ramping Arrival Rate: Gradually increase arrival rate
- Shared Iterations: Split total iterations across VUs
- Per-VU Iterations: Each VU runs fixed iterations
- Constant Arrival Rate: Fixed requests/second
"""

import logging
import asyncio
import time
import math
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)


class WorkloadModelType(Enum):
    """Types of workload models (like k6 executors)"""
    # Closed Models (VU-based)
    CONSTANT_VUS = "constant_vus"  # Fixed VUs for duration
    RAMPING_VUS = "ramping_vus"  # VUs ramp up/down over stages
    PER_VU_ITERATIONS = "per_vu_iterations"  # Each VU runs N iterations
    SHARED_ITERATIONS = "shared_iterations"  # Total iterations split across VUs
    
    # Open Models (Arrival Rate based)
    CONSTANT_ARRIVAL_RATE = "constant_arrival_rate"  # Fixed requests/sec
    RAMPING_ARRIVAL_RATE = "ramping_arrival_rate"  # Ramp arrival rate over stages


@dataclass
class Stage:
    """Stage definition for ramping workloads"""
    duration_seconds: int
    target: int  # Target VUs or rate depending on model
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "duration_seconds": self.duration_seconds,
            "target": self.target
        }


@dataclass 
class WorkloadConfig:
    """Configuration for workload models"""
    model_type: WorkloadModelType
    
    # For closed models
    vus: int = 10
    duration_seconds: int = 60
    iterations: Optional[int] = None  # For iteration-based models
    
    # For open models
    rate: int = 10  # Requests per second
    pre_allocated_vus: int = 10  # Pre-allocated VU pool
    max_vus: int = 100  # Maximum VUs to spawn
    
    # For ramping models
    stages: List[Stage] = field(default_factory=list)
    
    # Common
    start_time: int = 0  # When to start (for scenario orchestration)
    graceful_stop: int = 30  # Graceful shutdown time
    
    # Think time
    think_time_min_ms: int = 0
    think_time_max_ms: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_type": self.model_type.value,
            "vus": self.vus,
            "duration_seconds": self.duration_seconds,
            "iterations": self.iterations,
            "rate": self.rate,
            "pre_allocated_vus": self.pre_allocated_vus,
            "max_vus": self.max_vus,
            "stages": [s.to_dict() for s in self.stages],
            "start_time": self.start_time,
            "graceful_stop": self.graceful_stop,
            "think_time_min_ms": self.think_time_min_ms,
            "think_time_max_ms": self.think_time_max_ms
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WorkloadConfig':
        stages = [Stage(**s) for s in data.get("stages", [])]
        return cls(
            model_type=WorkloadModelType(data.get("model_type", "constant_vus")),
            vus=data.get("vus", 10),
            duration_seconds=data.get("duration_seconds", 60),
            iterations=data.get("iterations"),
            rate=data.get("rate", 10),
            pre_allocated_vus=data.get("pre_allocated_vus", 10),
            max_vus=data.get("max_vus", 100),
            stages=stages,
            start_time=data.get("start_time", 0),
            graceful_stop=data.get("graceful_stop", 30),
            think_time_min_ms=data.get("think_time_min_ms", 0),
            think_time_max_ms=data.get("think_time_max_ms", 0)
        )


class WorkloadController:
    """
    Controls workload based on the configured model.
    Manages VU spawning/despawning and rate limiting.
    """
    
    def __init__(self, config: WorkloadConfig):
        self.config = config
        self.start_time: Optional[float] = None
        self.is_running: bool = False
        self.current_vus: int = 0
        self.total_iterations: int = 0
        self.iterations_completed: int = 0
        self._vu_semaphore: Optional[asyncio.Semaphore] = None
        self._rate_limiter: Optional[asyncio.Semaphore] = None
        self._iteration_lock = asyncio.Lock()
        
    async def start(self):
        """Start the workload controller"""
        self.start_time = time.time()
        self.is_running = True
        self.iterations_completed = 0
        
        if self.config.model_type in [
            WorkloadModelType.SHARED_ITERATIONS,
            WorkloadModelType.PER_VU_ITERATIONS
        ]:
            self.total_iterations = self.config.iterations or 1000
        
        # Initialize rate limiter for open models
        if self.config.model_type in [
            WorkloadModelType.CONSTANT_ARRIVAL_RATE,
            WorkloadModelType.RAMPING_ARRIVAL_RATE
        ]:
            self._rate_limiter = asyncio.Semaphore(self.config.rate)
            # Start rate replenishment task
            asyncio.create_task(self._replenish_rate_limiter())
        
        logger.info(f"Started workload controller: {self.config.model_type.value}")
    
    async def stop(self):
        """Stop the workload controller"""
        self.is_running = False
        logger.info("Stopped workload controller")
    
    def get_target_vus(self, elapsed_seconds: float) -> int:
        """Calculate target VUs at a given time"""
        if not self.is_running:
            return 0
        
        model = self.config.model_type
        
        if model == WorkloadModelType.CONSTANT_VUS:
            return self.config.vus
        
        elif model == WorkloadModelType.RAMPING_VUS:
            return self._calculate_ramping_target(elapsed_seconds, is_rate=False)
        
        elif model == WorkloadModelType.PER_VU_ITERATIONS:
            # Return configured VUs until all iterations complete
            if self.iterations_completed >= self.total_iterations:
                return 0
            return self.config.vus
        
        elif model == WorkloadModelType.SHARED_ITERATIONS:
            # Return VUs until all iterations complete
            if self.iterations_completed >= self.total_iterations:
                return 0
            return self.config.vus
        
        elif model in [WorkloadModelType.CONSTANT_ARRIVAL_RATE, 
                       WorkloadModelType.RAMPING_ARRIVAL_RATE]:
            # For arrival rate models, VUs are dynamically spawned
            return min(self.current_vus + 1, self.config.max_vus)
        
        return self.config.vus
    
    def get_current_rate(self, elapsed_seconds: float) -> float:
        """Get current arrival rate (for open models)"""
        model = self.config.model_type
        
        if model == WorkloadModelType.CONSTANT_ARRIVAL_RATE:
            return float(self.config.rate)
        
        elif model == WorkloadModelType.RAMPING_ARRIVAL_RATE:
            return float(self._calculate_ramping_target(elapsed_seconds, is_rate=True))
        
        return 0.0
    
    def _calculate_ramping_target(self, elapsed_seconds: float, is_rate: bool = False) -> int:
        """Calculate target for ramping models based on stages"""
        if not self.config.stages:
            return self.config.rate if is_rate else self.config.vus
        
        accumulated_time = 0.0
        previous_target = self.config.vus if not is_rate else 0
        
        for stage in self.config.stages:
            stage_end = accumulated_time + stage.duration_seconds
            
            if elapsed_seconds <= stage_end:
                # We're in this stage
                stage_progress = (elapsed_seconds - accumulated_time) / stage.duration_seconds
                stage_progress = max(0, min(1, stage_progress))
                
                # Linear interpolation between previous and target
                return int(previous_target + (stage.target - previous_target) * stage_progress)
            
            accumulated_time = stage_end
            previous_target = stage.target
        
        # After all stages, return last target
        return self.config.stages[-1].target if self.config.stages else previous_target
    
    async def acquire_iteration(self) -> bool:
        """
        Acquire permission to run an iteration (for iteration-based models).
        Returns False when no more iterations should run.
        """
        if self.config.model_type not in [
            WorkloadModelType.SHARED_ITERATIONS,
            WorkloadModelType.PER_VU_ITERATIONS
        ]:
            return True  # No iteration limit
        
        async with self._iteration_lock:
            if self.iterations_completed >= self.total_iterations:
                return False
            self.iterations_completed += 1
            return True
    
    async def acquire_rate_slot(self) -> bool:
        """
        Acquire permission to make a request (for arrival rate models).
        Blocks until rate slot is available.
        """
        if self._rate_limiter is None:
            return True
        
        await self._rate_limiter.acquire()
        return True
    
    async def _replenish_rate_limiter(self):
        """Replenish rate limiter tokens at configured rate"""
        while self.is_running:
            elapsed = time.time() - (self.start_time or time.time())
            current_rate = self.get_current_rate(elapsed)
            
            if current_rate > 0:
                interval = 1.0 / current_rate
                await asyncio.sleep(interval)
                
                if self._rate_limiter and self._rate_limiter.locked():
                    self._rate_limiter.release()
            else:
                await asyncio.sleep(0.1)
    
    def should_continue(self) -> bool:
        """Check if test should continue"""
        if not self.is_running:
            return False
        
        elapsed = time.time() - (self.start_time or time.time())
        
        # Check duration limit
        if self.config.model_type in [
            WorkloadModelType.CONSTANT_VUS,
            WorkloadModelType.CONSTANT_ARRIVAL_RATE
        ]:
            if elapsed >= self.config.duration_seconds:
                return False
        
        # Check iteration limit
        if self.config.model_type in [
            WorkloadModelType.SHARED_ITERATIONS,
            WorkloadModelType.PER_VU_ITERATIONS
        ]:
            if self.iterations_completed >= self.total_iterations:
                return False
        
        # Check stages completion for ramping models
        if self.config.model_type in [
            WorkloadModelType.RAMPING_VUS,
            WorkloadModelType.RAMPING_ARRIVAL_RATE
        ]:
            total_stage_duration = sum(s.duration_seconds for s in self.config.stages)
            if elapsed >= total_stage_duration:
                return False
        
        return True
    
    def get_status(self) -> Dict[str, Any]:
        """Get current controller status"""
        elapsed = time.time() - (self.start_time or time.time())
        
        return {
            "model_type": self.config.model_type.value,
            "is_running": self.is_running,
            "elapsed_seconds": elapsed,
            "current_vus": self.current_vus,
            "target_vus": self.get_target_vus(elapsed),
            "iterations_completed": self.iterations_completed,
            "total_iterations": self.total_iterations if self.config.iterations else None,
            "current_rate": self.get_current_rate(elapsed),
            "should_continue": self.should_continue()
        }


class WorkloadModelFactory:
    """Factory for creating workload configurations"""
    
    @staticmethod
    def constant_vus(vus: int, duration: int) -> WorkloadConfig:
        """Create constant VUs workload (k6 equivalent: constant-vus)"""
        return WorkloadConfig(
            model_type=WorkloadModelType.CONSTANT_VUS,
            vus=vus,
            duration_seconds=duration
        )
    
    @staticmethod
    def ramping_vus(stages: List[Dict[str, int]], graceful_stop: int = 30) -> WorkloadConfig:
        """
        Create ramping VUs workload (k6 equivalent: ramping-vus)
        
        Example stages: [
            {"duration_seconds": 60, "target": 100},  # Ramp to 100 VUs
            {"duration_seconds": 120, "target": 100},  # Hold at 100 VUs
            {"duration_seconds": 60, "target": 0}  # Ramp down to 0
        ]
        """
        stage_objects = [Stage(**s) for s in stages]
        return WorkloadConfig(
            model_type=WorkloadModelType.RAMPING_VUS,
            stages=stage_objects,
            graceful_stop=graceful_stop
        )
    
    @staticmethod
    def shared_iterations(iterations: int, vus: int, max_duration: int = 3600) -> WorkloadConfig:
        """
        Create shared iterations workload (k6 equivalent: shared-iterations)
        Total iterations are split across VUs.
        """
        return WorkloadConfig(
            model_type=WorkloadModelType.SHARED_ITERATIONS,
            iterations=iterations,
            vus=vus,
            duration_seconds=max_duration
        )
    
    @staticmethod
    def per_vu_iterations(iterations_per_vu: int, vus: int, max_duration: int = 3600) -> WorkloadConfig:
        """
        Create per-VU iterations workload (k6 equivalent: per-vu-iterations)
        Each VU runs specified number of iterations.
        """
        return WorkloadConfig(
            model_type=WorkloadModelType.PER_VU_ITERATIONS,
            iterations=iterations_per_vu * vus,
            vus=vus,
            duration_seconds=max_duration
        )
    
    @staticmethod
    def constant_arrival_rate(
        rate: int,
        duration: int,
        pre_allocated_vus: int = 10,
        max_vus: int = 100
    ) -> WorkloadConfig:
        """
        Create constant arrival rate workload (k6 equivalent: constant-arrival-rate)
        Controls the rate at which new requests/iterations start.
        """
        return WorkloadConfig(
            model_type=WorkloadModelType.CONSTANT_ARRIVAL_RATE,
            rate=rate,
            duration_seconds=duration,
            pre_allocated_vus=pre_allocated_vus,
            max_vus=max_vus
        )
    
    @staticmethod
    def ramping_arrival_rate(
        stages: List[Dict[str, int]],
        pre_allocated_vus: int = 10,
        max_vus: int = 100
    ) -> WorkloadConfig:
        """
        Create ramping arrival rate workload (k6 equivalent: ramping-arrival-rate)
        
        Example stages: [
            {"duration_seconds": 60, "target": 100},  # Ramp to 100 req/s
            {"duration_seconds": 120, "target": 500},  # Ramp to 500 req/s
            {"duration_seconds": 60, "target": 0}  # Ramp down to 0
        ]
        """
        stage_objects = [Stage(**s) for s in stages]
        return WorkloadConfig(
            model_type=WorkloadModelType.RAMPING_ARRIVAL_RATE,
            stages=stage_objects,
            pre_allocated_vus=pre_allocated_vus,
            max_vus=max_vus
        )
    
    @staticmethod
    def from_k6_options(options: Dict[str, Any]) -> WorkloadConfig:
        """
        Convert k6-style options to WorkloadConfig.
        
        Supports:
        - vus + duration
        - stages
        - iterations
        - scenarios with executors
        """
        # Check for stages (ramping-vus)
        if "stages" in options:
            stages = [
                {"duration_seconds": _parse_duration(s.get("duration", "0s")), 
                 "target": s.get("target", 0)}
                for s in options["stages"]
            ]
            return WorkloadModelFactory.ramping_vus(stages)
        
        # Check for iterations (shared-iterations)
        if "iterations" in options:
            return WorkloadModelFactory.shared_iterations(
                iterations=options["iterations"],
                vus=options.get("vus", 1)
            )
        
        # Default: constant-vus
        return WorkloadModelFactory.constant_vus(
            vus=options.get("vus", 1),
            duration=_parse_duration(options.get("duration", "30s"))
        )


def _parse_duration(duration_str: str) -> int:
    """Parse duration string like '30s', '5m', '1h' to seconds"""
    if isinstance(duration_str, int):
        return duration_str
    
    duration_str = str(duration_str).strip().lower()
    
    if duration_str.endswith('s'):
        return int(duration_str[:-1])
    elif duration_str.endswith('m'):
        return int(duration_str[:-1]) * 60
    elif duration_str.endswith('h'):
        return int(duration_str[:-1]) * 3600
    
    try:
        return int(duration_str)
    except ValueError:
        return 30  # Default 30 seconds
