"""
Load Generator - Core engine for generating virtual users and load
Similar to Neoload/LoadRunner load generation capabilities
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import random
import json

logger = logging.getLogger(__name__)


class UserState(Enum):
    """Virtual user states"""
    INITIALIZING = "initializing"
    RUNNING = "running"
    THINKING = "thinking"
    WAITING = "waiting"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class VirtualUser:
    """Represents a single virtual user in the load test"""
    user_id: str
    scenario_name: str
    state: UserState = UserState.INITIALIZING
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    iterations: int = 0
    errors: int = 0
    response_times: List[float] = field(default_factory=list)
    throughput: float = 0.0
    last_action_time: Optional[float] = None
    session_data: Dict[str, Any] = field(default_factory=dict)
    correlation_data: Dict[str, Any] = field(default_factory=dict)
    
    def get_avg_response_time(self) -> float:
        """Calculate average response time"""
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)
    
    def get_min_response_time(self) -> float:
        """Get minimum response time"""
        return min(self.response_times) if self.response_times else 0.0
    
    def get_max_response_time(self) -> float:
        """Get maximum response time"""
        return max(self.response_times) if self.response_times else 0.0
    
    def get_p95_response_time(self) -> float:
        """Calculate 95th percentile response time"""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(len(sorted_times) * 0.95)
        return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]
    
    def get_p99_response_time(self) -> float:
        """Calculate 99th percentile response time"""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(len(sorted_times) * 0.99)
        return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]


@dataclass
class LoadScenario:
    """Defines a load test scenario"""
    name: str
    user_journey: List[Dict[str, Any]]  # List of actions/steps
    virtual_users: int = 10
    ramp_up_seconds: int = 60
    duration_seconds: int = 300
    ramp_down_seconds: int = 30
    think_time_ms: int = 2000
    think_time_variance: float = 0.3  # ±30% variance
    iterations: Optional[int] = None  # None = run for duration
    weight: float = 1.0  # Weight for mixed scenarios
    data_source: Optional[str] = None  # CSV, JSON, etc.
    correlation_rules: List[Dict[str, Any]] = field(default_factory=list)
    thresholds: Dict[str, Any] = field(default_factory=dict)
    
    def get_think_time(self) -> float:
        """Calculate think time with variance"""
        variance = random.uniform(-self.think_time_variance, self.think_time_variance)
        return self.think_time_ms * (1 + variance) / 1000.0


class LoadGenerator:
    """
    Core load generation engine
    Manages virtual users, executes scenarios, collects metrics
    """
    
    def __init__(self):
        self.virtual_users: Dict[str, VirtualUser] = {}
        self.scenarios: Dict[str, LoadScenario] = {}
        self.is_running: bool = False
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.metrics_collector: Optional[Callable] = None
        self.protocol_handler: Optional[Any] = None
        
    async def add_scenario(self, scenario: LoadScenario) -> str:
        """Add a test scenario"""
        self.scenarios[scenario.name] = scenario
        logger.info(f"Added scenario: {scenario.name} ({scenario.virtual_users} VUs)")
        return scenario.name
    
    async def start_load_test(
        self,
        scenario_names: Optional[List[str]] = None,
        protocol_handler: Optional[Any] = None,
        metrics_callback: Optional[Callable] = None
    ) -> str:
        """
        Start a load test with specified scenarios
        
        Args:
            scenario_names: List of scenario names to run (None = all)
            protocol_handler: Protocol handler for executing requests
            metrics_callback: Callback for real-time metrics
            
        Returns:
            Test run ID
        """
        if self.is_running:
            raise RuntimeError("Load test is already running")
        
        self.is_running = True
        self.start_time = time.time()
        self.protocol_handler = protocol_handler
        self.metrics_collector = metrics_callback
        
        # Select scenarios
        if scenario_names is None:
            scenario_names = list(self.scenarios.keys())
        
        # Calculate total VUs needed
        total_vus = sum(self.scenarios[name].virtual_users for name in scenario_names)
        logger.info(f"Starting load test with {total_vus} virtual users across {len(scenario_names)} scenarios")
        
        # Start virtual users
        tasks = []
        vu_counter = 0
        
        for scenario_name in scenario_names:
            scenario = self.scenarios[scenario_name]
            
            # Calculate ramp-up schedule
            vu_per_second = scenario.virtual_users / scenario.ramp_up_seconds if scenario.ramp_up_seconds > 0 else scenario.virtual_users
            
            for vu_index in range(scenario.virtual_users):
                vu_id = f"vu_{scenario_name}_{vu_index}"
                vu = VirtualUser(
                    user_id=vu_id,
                    scenario_name=scenario_name,
                    state=UserState.INITIALIZING
                )
                self.virtual_users[vu_id] = vu
                
                # Stagger VU start times for ramp-up
                delay = vu_index / vu_per_second if vu_per_second > 0 else 0
                
                task = asyncio.create_task(
                    self._run_virtual_user(vu, scenario, delay)
                )
                tasks.append(task)
                vu_counter += 1
        
        # Start metrics collection task
        metrics_task = asyncio.create_task(self._collect_metrics_loop())
        
        # Wait for all VUs to complete or duration to expire
        test_duration = max(
            (self.scenarios[name].duration_seconds for name in scenario_names),
            default=300
        )
        
        try:
            await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=test_duration + 60  # Add buffer
            )
        except asyncio.TimeoutError:
            logger.warning("Load test duration exceeded, stopping VUs")
        
        # Stop metrics collection
        metrics_task.cancel()
        
        self.end_time = time.time()
        self.is_running = False
        
        logger.info(f"Load test completed. Duration: {self.end_time - self.start_time:.2f}s")
        
        return f"test_{int(self.start_time)}"
    
    async def _run_virtual_user(
        self,
        vu: VirtualUser,
        scenario: LoadScenario,
        start_delay: float = 0.0
    ):
        """Execute a single virtual user's journey"""
        if start_delay > 0:
            await asyncio.sleep(start_delay)
        
        vu.state = UserState.RUNNING
        vu.start_time = time.time()
        
        try:
            end_time = vu.start_time + scenario.duration_seconds
            
            while True:
                # Check if duration exceeded
                if time.time() >= end_time:
                    break
                
                # Check iteration limit
                if scenario.iterations and vu.iterations >= scenario.iterations:
                    break
                
                # Execute user journey
                for step in scenario.user_journey:
                    if time.time() >= end_time:
                        break
                    
                    step_start = time.time()
                    
                    try:
                        # Execute step using protocol handler
                        if self.protocol_handler:
                            result = await self.protocol_handler.execute(
                                step,
                                vu.session_data,
                                vu.correlation_data
                            )
                            
                            # Update correlation data
                            if result.get("correlation_data"):
                                vu.correlation_data.update(result["correlation_data"])
                            
                            # Record response time
                            response_time = (time.time() - step_start) * 1000  # ms
                            vu.response_times.append(response_time)
                            
                            # Check for errors
                            if result.get("error"):
                                vu.errors += 1
                                logger.warning(f"VU {vu.user_id} error in step {step.get('name')}: {result['error']}")
                        
                        vu.iterations += 1
                        
                    except Exception as e:
                        vu.errors += 1
                        logger.error(f"VU {vu.user_id} exception in step {step.get('name')}: {e}")
                    
                    # Think time between steps
                    think_time = scenario.get_think_time()
                    if think_time > 0:
                        vu.state = UserState.THINKING
                        await asyncio.sleep(think_time)
                        vu.state = UserState.RUNNING
                
                # Think time between iterations
                think_time = scenario.get_think_time()
                if think_time > 0:
                    vu.state = UserState.THINKING
                    await asyncio.sleep(think_time)
                    vu.state = UserState.RUNNING
        
        except asyncio.CancelledError:
            logger.info(f"VU {vu.user_id} cancelled")
        except Exception as e:
            logger.error(f"VU {vu.user_id} failed: {e}", exc_info=True)
            vu.state = UserState.ERROR
        finally:
            vu.end_time = time.time()
            vu.state = UserState.COMPLETED
            
            # Calculate throughput
            duration = (vu.end_time - vu.start_time) if vu.start_time else 1.0
            vu.throughput = vu.iterations / duration if duration > 0 else 0.0
    
    async def _collect_metrics_loop(self):
        """Collect metrics periodically"""
        while self.is_running:
            try:
                await asyncio.sleep(1.0)  # Collect every second
                
                if self.metrics_collector:
                    metrics = self.get_current_metrics()
                    await self.metrics_collector(metrics)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in metrics collection: {e}")
    
    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current test metrics"""
        if not self.virtual_users:
            return {}
        
        active_vus = [vu for vu in self.virtual_users.values() if vu.state == UserState.RUNNING]
        total_vus = len(self.virtual_users)
        completed_vus = len([vu for vu in self.virtual_users.values() if vu.state == UserState.COMPLETED])
        error_vus = len([vu for vu in self.virtual_users.values() if vu.state == UserState.ERROR])
        
        # Aggregate response times
        all_response_times = []
        total_iterations = 0
        total_errors = 0
        
        for vu in self.virtual_users.values():
            all_response_times.extend(vu.response_times)
            total_iterations += vu.iterations
            total_errors += vu.errors
        
        # Calculate percentiles
        sorted_times = sorted(all_response_times) if all_response_times else []
        
        def percentile(p: float) -> float:
            if not sorted_times:
                return 0.0
            index = int(len(sorted_times) * p)
            return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]
        
        # Calculate throughput
        elapsed = (time.time() - self.start_time) if self.start_time else 1.0
        throughput = total_iterations / elapsed if elapsed > 0 else 0.0
        
        # Error rate
        error_rate = total_errors / total_iterations if total_iterations > 0 else 0.0
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "elapsed_seconds": elapsed,
            "virtual_users": {
                "total": total_vus,
                "active": len(active_vus),
                "completed": completed_vus,
                "error": error_vus
            },
            "iterations": {
                "total": total_iterations,
                "errors": total_errors,
                "error_rate": error_rate
            },
            "response_time": {
                "min": min(sorted_times) if sorted_times else 0.0,
                "max": max(sorted_times) if sorted_times else 0.0,
                "avg": sum(sorted_times) / len(sorted_times) if sorted_times else 0.0,
                "p50": percentile(0.50),
                "p75": percentile(0.75),
                "p90": percentile(0.90),
                "p95": percentile(0.95),
                "p99": percentile(0.99)
            },
            "throughput": {
                "rps": throughput,
                "total_requests": total_iterations
            }
        }
    
    def get_final_report(self) -> Dict[str, Any]:
        """Get final test report"""
        metrics = self.get_current_metrics()
        
        # Per-scenario breakdown
        scenario_metrics = {}
        for scenario_name in self.scenarios.keys():
            scenario_vus = [
                vu for vu in self.virtual_users.values()
                if vu.scenario_name == scenario_name
            ]
            
            scenario_response_times = []
            scenario_iterations = 0
            scenario_errors = 0
            
            for vu in scenario_vus:
                scenario_response_times.extend(vu.response_times)
                scenario_iterations += vu.iterations
                scenario_errors += vu.errors
            
            sorted_times = sorted(scenario_response_times) if scenario_response_times else []
            
            def percentile(p: float) -> float:
                if not sorted_times:
                    return 0.0
                index = int(len(sorted_times) * p)
                return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]
            
            scenario_metrics[scenario_name] = {
                "virtual_users": len(scenario_vus),
                "iterations": scenario_iterations,
                "errors": scenario_errors,
                "error_rate": scenario_errors / scenario_iterations if scenario_iterations > 0 else 0.0,
                "response_time": {
                    "min": min(sorted_times) if sorted_times else 0.0,
                    "max": max(sorted_times) if sorted_times else 0.0,
                    "avg": sum(sorted_times) / len(sorted_times) if sorted_times else 0.0,
                    "p95": percentile(0.95),
                    "p99": percentile(0.99)
                }
            }
        
        return {
            "test_id": f"test_{int(self.start_time)}" if self.start_time else "unknown",
            "start_time": datetime.fromtimestamp(self.start_time).isoformat() if self.start_time else None,
            "end_time": datetime.fromtimestamp(self.end_time).isoformat() if self.end_time else None,
            "duration_seconds": (self.end_time - self.start_time) if (self.start_time and self.end_time) else 0.0,
            "summary": metrics,
            "scenarios": scenario_metrics,
            "thresholds_passed": self._check_thresholds(metrics)
        }
    
    def _check_thresholds(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Check if thresholds are met"""
        results = {}
        
        for scenario_name, scenario in self.scenarios.items():
            if not scenario.thresholds:
                continue
            
            scenario_metrics = metrics.get("scenarios", {}).get(scenario_name, {})
            threshold_results = {}
            
            for threshold_name, threshold_config in scenario.thresholds.items():
                metric_value = self._get_metric_value(metrics, scenario_metrics, threshold_config.get("metric"))
                operator = threshold_config.get("operator", "<")
                threshold_value = threshold_config.get("value", 0)
                
                passed = self._evaluate_threshold(metric_value, operator, threshold_value)
                threshold_results[threshold_name] = {
                    "passed": passed,
                    "value": metric_value,
                    "threshold": threshold_value,
                    "operator": operator
                }
            
            results[scenario_name] = threshold_results
        
        return results
    
    def _get_metric_value(self, global_metrics: Dict, scenario_metrics: Dict, metric_path: str) -> float:
        """Extract metric value from nested structure"""
        parts = metric_path.split(".")
        value = global_metrics if not scenario_metrics else scenario_metrics
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part, 0)
            else:
                return 0.0
        
        return float(value) if value else 0.0
    
    def _evaluate_threshold(self, value: float, operator: str, threshold: float) -> bool:
        """Evaluate threshold condition"""
        if operator == "<":
            return value < threshold
        elif operator == "<=":
            return value <= threshold
        elif operator == ">":
            return value > threshold
        elif operator == ">=":
            return value >= threshold
        elif operator == "==":
            return abs(value - threshold) < 0.001
        else:
            return False
    
    async def stop_load_test(self):
        """Stop the running load test"""
        if not self.is_running:
            return
        
        logger.info("Stopping load test...")
        self.is_running = False
        
        # Cancel all VU tasks
        # Note: In a real implementation, you'd track tasks and cancel them properly
        # This is simplified for the structure
        
        self.end_time = time.time()




