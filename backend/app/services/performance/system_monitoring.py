"""
System Resource Monitoring - Monitor CPU, memory, network, disk
Provides system-level metrics during performance tests
"""

import logging
import psutil
import platform
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import deque
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class SystemMetrics:
    """System resource metrics snapshot"""
    timestamp: datetime
    cpu: Dict[str, float]  # percent, per_core
    memory: Dict[str, Any]  # total, available, percent, used
    disk: Dict[str, Any]  # read/write bytes, IOPS
    network: Dict[str, Any]  # bytes_sent, bytes_recv, packets_sent, packets_recv
    process_count: int
    load_average: Optional[float] = None  # Unix only


class SystemMonitor:
    """
    System Resource Monitor
    Collects CPU, memory, disk, and network metrics
    """
    
    def __init__(self, history_size: int = 3600):
        """
        Initialize system monitor
        
        Args:
            history_size: Number of metric snapshots to keep
        """
        self.history_size = history_size
        self.metrics_history: deque = deque(maxlen=history_size)
        self.is_monitoring: bool = False
        self.monitoring_task: Optional[asyncio.Task] = None
        self.interval_seconds: float = 1.0
        
        # Network baseline (for calculating deltas)
        self.network_baseline: Optional[Dict[str, int]] = None
    
    async def start_monitoring(self, interval_seconds: float = 1.0):
        """Start system monitoring"""
        if self.is_monitoring:
            logger.warning("System monitoring already started")
            return
        
        self.is_monitoring = True
        self.interval_seconds = interval_seconds
        
        # Capture network baseline
        net_io = psutil.net_io_counters()
        self.network_baseline = {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv
        }
        
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Started system resource monitoring")
    
    async def stop_monitoring(self):
        """Stop system monitoring"""
        self.is_monitoring = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Stopped system resource monitoring")
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                metrics = self._collect_metrics()
                self.metrics_history.append(metrics)
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in system monitoring loop: {e}")
                await asyncio.sleep(self.interval_seconds)
    
    def _collect_metrics(self) -> SystemMetrics:
        """Collect current system metrics"""
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_per_core = psutil.cpu_percent(interval=None, percpu=True)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        memory_metrics = {
            "total": memory.total,
            "available": memory.available,
            "used": memory.used,
            "percent": memory.percent,
            "free": memory.free
        }
        
        # Disk metrics
        disk_io = psutil.disk_io_counters()
        disk_metrics = {
            "read_bytes": disk_io.read_bytes if disk_io else 0,
            "write_bytes": disk_io.write_bytes if disk_io else 0,
            "read_count": disk_io.read_count if disk_io else 0,
            "write_count": disk_io.write_count if disk_io else 0
        }
        
        # Network metrics (delta from baseline)
        net_io = psutil.net_io_counters()
        if self.network_baseline:
            network_metrics = {
                "bytes_sent": net_io.bytes_sent - self.network_baseline["bytes_sent"],
                "bytes_recv": net_io.bytes_recv - self.network_baseline["bytes_recv"],
                "packets_sent": net_io.packets_sent - self.network_baseline["packets_sent"],
                "packets_recv": net_io.packets_recv - self.network_baseline["packets_recv"]
            }
        else:
            network_metrics = {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv
            }
        
        # Process count
        process_count = len(psutil.pids())
        
        # Load average (Unix only)
        load_avg = None
        if platform.system() != "Windows":
            try:
                load_avg = psutil.getloadavg()[0]  # 1-minute load average
            except:
                pass
        
        return SystemMetrics(
            timestamp=datetime.utcnow(),
            cpu={
                "percent": cpu_percent,
                "per_core": cpu_per_core,
                "count": psutil.cpu_count()
            },
            memory=memory_metrics,
            disk=disk_metrics,
            network=network_metrics,
            process_count=process_count,
            load_average=load_avg
        )
    
    def get_current_metrics(self) -> Optional[SystemMetrics]:
        """Get most recent system metrics"""
        if self.metrics_history:
            return self.metrics_history[-1]
        return None
    
    def get_metrics_history(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[SystemMetrics]:
        """Get metrics history with optional filtering"""
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
        """Get summary statistics from metrics history"""
        if not self.metrics_history:
            return {}
        
        history = list(self.metrics_history)
        
        # Aggregate CPU
        cpu_values = [m.cpu["percent"] for m in history]
        cpu_per_core_values = [m.cpu["per_core"] for m in history]
        
        # Aggregate memory
        memory_percent_values = [m.memory["percent"] for m in history]
        memory_used_values = [m.memory["used"] for m in history]
        
        # Aggregate network
        network_sent_values = [m.network["bytes_sent"] for m in history]
        network_recv_values = [m.network["bytes_recv"] for m in history]
        
        return {
            "time_range": {
                "start": history[0].timestamp.isoformat() if history else None,
                "end": history[-1].timestamp.isoformat() if history else None,
                "duration_seconds": (history[-1].timestamp - history[0].timestamp).total_seconds() if len(history) > 1 else 0
            },
            "cpu": {
                "avg_percent": sum(cpu_values) / len(cpu_values) if cpu_values else 0.0,
                "max_percent": max(cpu_values) if cpu_values else 0.0,
                "min_percent": min(cpu_values) if cpu_values else 0.0
            },
            "memory": {
                "avg_percent": sum(memory_percent_values) / len(memory_percent_values) if memory_percent_values else 0.0,
                "max_percent": max(memory_percent_values) if memory_percent_values else 0.0,
                "avg_used_bytes": sum(memory_used_values) / len(memory_used_values) if memory_used_values else 0,
                "max_used_bytes": max(memory_used_values) if memory_used_values else 0
            },
            "network": {
                "total_bytes_sent": max(network_sent_values) if network_sent_values else 0,
                "total_bytes_recv": max(network_recv_values) if network_recv_values else 0,
                "avg_bytes_sent_per_sec": self._calculate_rate(network_sent_values) if network_sent_values else 0.0,
                "avg_bytes_recv_per_sec": self._calculate_rate(network_recv_values) if network_recv_values else 0.0
            },
            "process_count": {
                "avg": sum([m.process_count for m in history]) / len(history) if history else 0,
                "max": max([m.process_count for m in history]) if history else 0
            }
        }
    
    def _calculate_rate(self, values: List[float]) -> float:
        """Calculate average rate per second"""
        if not values or len(values) < 2:
            return 0.0
        
        total_delta = max(values) - min(values)
        time_span = len(values) * self.interval_seconds
        
        return total_delta / time_span if time_span > 0 else 0.0
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get data formatted for dashboard display"""
        current = self.get_current_metrics()
        
        if not current:
            return {
                "status": "no_data",
                "timestamp": datetime.utcnow().isoformat()
            }
        
        summary = self.get_summary_statistics()
        
        return {
            "status": "active",
            "timestamp": current.timestamp.isoformat(),
            "current": {
                "cpu_percent": current.cpu["percent"],
                "memory_percent": current.memory["percent"],
                "memory_used_mb": current.memory["used"] / (1024 * 1024),
                "network_sent_mb": current.network["bytes_sent"] / (1024 * 1024),
                "network_recv_mb": current.network["bytes_recv"] / (1024 * 1024),
                "process_count": current.process_count,
                "load_average": current.load_average
            },
            "summary": summary
        }




