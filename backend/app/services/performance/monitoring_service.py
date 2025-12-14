"""
Monitoring Service - Real-time metrics collection and analytics
Similar to Neoload/LoadRunner real-time dashboards
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from dataclasses import dataclass, field
from collections import deque
import time

logger = logging.getLogger(__name__)


@dataclass
class RealTimeMetrics:
    """Real-time metrics snapshot"""
    timestamp: datetime
    virtual_users: Dict[str, int]
    response_times: Dict[str, float]
    throughput: Dict[str, float]
    error_rate: float
    active_requests: int
    system_resources: Optional[Dict[str, Any]] = None
    custom_metrics: Dict[str, Any] = field(default_factory=dict)


class MonitoringService:
    """
    Real-time monitoring and analytics service
    Collects metrics, provides dashboards, detects anomalies
    """
    
    def __init__(self, history_size: int = 3600):
        """
        Initialize monitoring service
        
        Args:
            history_size: Number of metric snapshots to keep in memory
        """
        self.history_size = history_size
        self.metrics_history: deque = deque(maxlen=history_size)
        self.subscribers: List[Callable] = []
        self.is_monitoring: bool = False
        self.monitoring_task: Optional[asyncio.Task] = None
        self.custom_metrics: Dict[str, Any] = {}
        self.sla_thresholds: Dict[str, Any] = {}
        self.anomaly_detectors: List[Callable] = []
    
    async def start_monitoring(
        self,
        metrics_callback: Optional[Callable] = None,
        interval_seconds: float = 1.0
    ):
        """Start real-time monitoring"""
        if self.is_monitoring:
            logger.warning("Monitoring already started")
            return
        
        self.is_monitoring = True
        
        if metrics_callback:
            self.subscribers.append(metrics_callback)
        
        self.monitoring_task = asyncio.create_task(
            self._monitoring_loop(interval_seconds)
        )
        
        logger.info("Started real-time monitoring")
    
    async def stop_monitoring(self):
        """Stop monitoring"""
        self.is_monitoring = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Stopped monitoring")
    
    async def _monitoring_loop(self, interval_seconds: float):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                # Collect current metrics
                metrics = await self._collect_metrics()
                
                # Store in history
                self.metrics_history.append(metrics)
                
                # Notify subscribers
                for subscriber in self.subscribers:
                    try:
                        if asyncio.iscoroutinefunction(subscriber):
                            await subscriber(metrics)
                        else:
                            subscriber(metrics)
                    except Exception as e:
                        logger.error(f"Error in metrics subscriber: {e}")
                
                # Check for anomalies
                await self._check_anomalies(metrics)
                
                # Check SLA thresholds
                await self._check_sla_thresholds(metrics)
                
                await asyncio.sleep(interval_seconds)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(interval_seconds)
    
    async def _collect_metrics(self) -> RealTimeMetrics:
        """Collect current metrics"""
        # This would typically get metrics from the load generator
        # For now, return a placeholder structure
        
        return RealTimeMetrics(
            timestamp=datetime.utcnow(),
            virtual_users={
                "total": 0,
                "active": 0,
                "completed": 0,
                "error": 0
            },
            response_times={
                "min": 0.0,
                "max": 0.0,
                "avg": 0.0,
                "p95": 0.0,
                "p99": 0.0
            },
            throughput={
                "rps": 0.0,
                "total_requests": 0
            },
            error_rate=0.0,
            active_requests=0,
            custom_metrics=self.custom_metrics.copy()
        )
    
    def update_metrics(self, metrics: Dict[str, Any]):
        """Update metrics from external source (e.g., load generator)"""
        # Extract key metrics
        if "virtual_users" in metrics:
            self.custom_metrics["virtual_users"] = metrics["virtual_users"]
        
        if "response_time" in metrics:
            self.custom_metrics["response_time"] = metrics["response_time"]
        
        if "throughput" in metrics:
            self.custom_metrics["throughput"] = metrics["throughput"]
        
        if "iterations" in metrics:
            self.custom_metrics["iterations"] = metrics["iterations"]
    
    async def _check_anomalies(self, metrics: RealTimeMetrics):
        """Check for performance anomalies"""
        if not self.anomaly_detectors:
            return
        
        for detector in self.anomaly_detectors:
            try:
                anomaly = await detector(metrics, self.metrics_history)
                if anomaly:
                    logger.warning(f"Anomaly detected: {anomaly}")
            except Exception as e:
                logger.error(f"Error in anomaly detector: {e}")
    
    async def _check_sla_thresholds(self, metrics: RealTimeMetrics):
        """Check SLA threshold violations"""
        if not self.sla_thresholds:
            return
        
        violations = []
        
        # Check response time SLA
        if "max_response_time_ms" in self.sla_thresholds:
            max_rt = self.sla_thresholds["max_response_time_ms"]
            if metrics.response_times.get("p95", 0) > max_rt:
                violations.append({
                    "metric": "response_time_p95",
                    "value": metrics.response_times["p95"],
                    "threshold": max_rt,
                    "severity": "high"
                })
        
        # Check error rate SLA
        if "max_error_rate" in self.sla_thresholds:
            max_err = self.sla_thresholds["max_error_rate"]
            if metrics.error_rate > max_err:
                violations.append({
                    "metric": "error_rate",
                    "value": metrics.error_rate,
                    "threshold": max_err,
                    "severity": "critical"
                })
        
        # Check throughput SLA
        if "min_throughput_rps" in self.sla_thresholds:
            min_tp = self.sla_thresholds["min_throughput_rps"]
            if metrics.throughput.get("rps", 0) < min_tp:
                violations.append({
                    "metric": "throughput",
                    "value": metrics.throughput["rps"],
                    "threshold": min_tp,
                    "severity": "medium"
                })
        
        if violations:
            logger.warning(f"SLA violations detected: {violations}")
    
    def set_sla_thresholds(self, thresholds: Dict[str, Any]):
        """Set SLA thresholds"""
        self.sla_thresholds = thresholds
        logger.info(f"Updated SLA thresholds: {thresholds}")
    
    def add_anomaly_detector(self, detector: Callable):
        """Add custom anomaly detector"""
        self.anomaly_detectors.append(detector)
    
    def subscribe(self, callback: Callable):
        """Subscribe to real-time metrics"""
        self.subscribers.append(callback)
    
    def unsubscribe(self, callback: Callable):
        """Unsubscribe from metrics"""
        if callback in self.subscribers:
            self.subscribers.remove(callback)
    
    def get_metrics_history(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[RealTimeMetrics]:
        """Get metrics history"""
        history = list(self.metrics_history)
        
        # Filter by time range
        if start_time:
            history = [m for m in history if m.timestamp >= start_time]
        
        if end_time:
            history = [m for m in history if m.timestamp <= end_time]
        
        # Limit results
        if limit:
            history = history[-limit:]
        
        return history
    
    def get_summary_statistics(self) -> Dict[str, Any]:
        """Get summary statistics from history"""
        if not self.metrics_history:
            return {}
        
        history = list(self.metrics_history)
        
        # Aggregate response times
        all_p95 = [m.response_times.get("p95", 0) for m in history if m.response_times.get("p95")]
        all_error_rates = [m.error_rate for m in history]
        all_throughput = [m.throughput.get("rps", 0) for m in history if m.throughput.get("rps")]
        
        return {
            "total_samples": len(history),
            "time_range": {
                "start": history[0].timestamp.isoformat() if history else None,
                "end": history[-1].timestamp.isoformat() if history else None
            },
            "response_time_p95": {
                "min": min(all_p95) if all_p95 else 0.0,
                "max": max(all_p95) if all_p95 else 0.0,
                "avg": sum(all_p95) / len(all_p95) if all_p95 else 0.0
            },
            "error_rate": {
                "min": min(all_error_rates) if all_error_rates else 0.0,
                "max": max(all_error_rates) if all_error_rates else 0.0,
                "avg": sum(all_error_rates) / len(all_error_rates) if all_error_rates else 0.0
            },
            "throughput": {
                "min": min(all_throughput) if all_throughput else 0.0,
                "max": max(all_throughput) if all_throughput else 0.0,
                "avg": sum(all_throughput) / len(all_throughput) if all_throughput else 0.0
            }
        }
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data formatted for dashboard display"""
        latest = list(self.metrics_history)[-1] if self.metrics_history else None
        
        if not latest:
            return {
                "status": "no_data",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        return {
            "status": "active",
            "timestamp": latest.timestamp.isoformat(),
            "virtual_users": latest.virtual_users,
            "response_times": latest.response_times,
            "throughput": latest.throughput,
            "error_rate": latest.error_rate,
            "active_requests": latest.active_requests,
            "system_resources": latest.system_resources,
            "custom_metrics": latest.custom_metrics,
            "summary": self.get_summary_statistics()
        }




