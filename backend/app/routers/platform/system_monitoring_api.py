"""
System Monitoring API - Track CPU, Memory, Disk, Network during performance tests

Endpoints:
- POST /api/monitoring/start - Start monitoring
- POST /api/monitoring/stop - Stop monitoring
- GET /api/monitoring/current - Get current metrics
- GET /api/monitoring/history - Get metrics history
- GET /api/monitoring/summary - Get summary statistics
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import logging

from app.services.performance.system_monitoring import SystemMonitor, SystemMetrics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["system-monitoring"])

# Global monitor instance
_monitor: Optional[SystemMonitor] = None


def get_monitor() -> SystemMonitor:
    """Get or create system monitor instance"""
    global _monitor
    if _monitor is None:
        _monitor = SystemMonitor(history_size=3600)  # Keep 1 hour at 1/sec
    return _monitor


def metrics_to_dict(m: SystemMetrics) -> Dict[str, Any]:
    """Convert SystemMetrics to dict for JSON response"""
    return {
        "timestamp": m.timestamp.isoformat(),
        "cpu": m.cpu,
        "memory": m.memory,
        "disk": m.disk,
        "network": m.network,
        "process_count": m.process_count,
        "load_average": m.load_average
    }


@router.post("/start")
async def start_monitoring(interval_seconds: float = Query(1.0, ge=0.1, le=60)):
    """
    Start system resource monitoring.
    
    Collects CPU, memory, disk, and network metrics at the specified interval.
    Use this during load tests to correlate response times with system resources.
    
    Args:
        interval_seconds: How often to collect metrics (default: 1 second)
    """
    monitor = get_monitor()
    
    if monitor.is_monitoring:
        return {
            "status": "already_running",
            "message": "System monitoring is already running",
            "interval_seconds": monitor.interval_seconds
        }
    
    await monitor.start_monitoring(interval_seconds)
    
    return {
        "status": "started",
        "message": "System monitoring started",
        "interval_seconds": interval_seconds
    }


@router.post("/stop")
async def stop_monitoring():
    """
    Stop system resource monitoring.
    
    Returns summary statistics from the monitoring session.
    """
    monitor = get_monitor()
    
    if not monitor.is_monitoring:
        return {
            "status": "not_running",
            "message": "System monitoring was not running"
        }
    
    await monitor.stop_monitoring()
    
    # Get summary
    summary = monitor.get_summary_statistics()
    
    return {
        "status": "stopped",
        "message": "System monitoring stopped",
        "summary": summary
    }


@router.get("/current")
async def get_current_metrics():
    """
    Get current system metrics snapshot.
    
    Returns:
        - CPU: Overall percentage, per-core percentages
        - Memory: Total, used, available, percent
        - Disk: Read/write bytes, IOPS
        - Network: Bytes sent/received, packets sent/received
        - Process count
    """
    monitor = get_monitor()
    
    # Collect fresh metrics even if not monitoring
    import psutil
    from datetime import datetime
    
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_per_core = psutil.cpu_percent(interval=None, percpu=True)
    
    # Memory
    memory = psutil.virtual_memory()
    
    # Disk
    disk_io = psutil.disk_io_counters()
    
    # Network
    net_io = psutil.net_io_counters()
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "cpu": {
            "percent": cpu_percent,
            "per_core": cpu_per_core,
            "count": psutil.cpu_count(),
            "count_logical": psutil.cpu_count(logical=True)
        },
        "memory": {
            "total_gb": round(memory.total / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "percent": memory.percent
        },
        "disk": {
            "read_mb": round(disk_io.read_bytes / (1024**2), 2) if disk_io else 0,
            "write_mb": round(disk_io.write_bytes / (1024**2), 2) if disk_io else 0,
            "read_count": disk_io.read_count if disk_io else 0,
            "write_count": disk_io.write_count if disk_io else 0
        },
        "network": {
            "bytes_sent_mb": round(net_io.bytes_sent / (1024**2), 2),
            "bytes_recv_mb": round(net_io.bytes_recv / (1024**2), 2),
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv
        },
        "processes": len(psutil.pids()),
        "monitoring_active": monitor.is_monitoring
    }


@router.get("/history")
async def get_metrics_history(
    minutes: int = Query(5, ge=1, le=60, description="Minutes of history to return"),
    limit: Optional[int] = Query(None, ge=1, le=3600, description="Max number of samples")
):
    """
    Get historical system metrics.
    
    Args:
        minutes: How many minutes of history to return
        limit: Maximum number of data points to return
    """
    monitor = get_monitor()
    
    if not monitor.metrics_history:
        return {
            "message": "No metrics history available. Start monitoring first.",
            "monitoring_active": monitor.is_monitoring,
            "data": []
        }
    
    start_time = datetime.utcnow() - timedelta(minutes=minutes)
    history = monitor.get_metrics_history(start_time=start_time, limit=limit)
    
    return {
        "monitoring_active": monitor.is_monitoring,
        "sample_count": len(history),
        "time_range_minutes": minutes,
        "data": [metrics_to_dict(m) for m in history]
    }


@router.get("/summary")
async def get_monitoring_summary():
    """
    Get summary statistics from monitoring session.
    
    Returns min, max, avg for CPU, memory, etc.
    Useful for understanding resource usage during load tests.
    """
    monitor = get_monitor()
    
    summary = monitor.get_summary_statistics()
    
    if not summary:
        return {
            "message": "No metrics collected yet. Start monitoring first.",
            "monitoring_active": monitor.is_monitoring
        }
    
    return {
        "monitoring_active": monitor.is_monitoring,
        "samples_collected": len(monitor.metrics_history),
        "summary": summary
    }


@router.get("/health-check")
async def health_check():
    """
    Quick health check - are resources healthy?
    
    Returns warnings if CPU > 80% or Memory > 85%
    """
    import psutil
    
    cpu = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    warnings = []
    status = "healthy"
    
    if cpu > 80:
        warnings.append(f"High CPU usage: {cpu}%")
        status = "warning"
    
    if memory.percent > 85:
        warnings.append(f"High memory usage: {memory.percent}%")
        status = "warning"
    
    if disk.percent > 90:
        warnings.append(f"Low disk space: {disk.percent}% used")
        status = "critical"
    
    return {
        "status": status,
        "cpu_percent": cpu,
        "memory_percent": memory.percent,
        "disk_percent": disk.percent,
        "warnings": warnings
    }


@router.get("/correlation")
async def get_correlation_data(
    test_id: Optional[str] = None,
    minutes: int = Query(5, ge=1, le=60)
):
    """
    Get data formatted for correlating response times with system metrics.
    
    Use this to overlay response time graphs with CPU/memory graphs
    to identify resource bottlenecks.
    """
    monitor = get_monitor()
    
    start_time = datetime.utcnow() - timedelta(minutes=minutes)
    history = monitor.get_metrics_history(start_time=start_time)
    
    # Format for easy charting
    timestamps = []
    cpu_data = []
    memory_data = []
    network_data = []
    
    for m in history:
        timestamps.append(m.timestamp.isoformat())
        cpu_data.append(m.cpu.get("percent", 0))
        memory_data.append(m.memory.get("percent", 0))
        network_data.append(m.network.get("bytes_recv", 0))
    
    return {
        "test_id": test_id,
        "time_range_minutes": minutes,
        "sample_count": len(history),
        "chart_data": {
            "timestamps": timestamps,
            "cpu_percent": cpu_data,
            "memory_percent": memory_data,
            "network_bytes_recv": network_data
        },
        "summary": {
            "cpu_avg": round(sum(cpu_data) / len(cpu_data), 2) if cpu_data else 0,
            "cpu_max": max(cpu_data) if cpu_data else 0,
            "memory_avg": round(sum(memory_data) / len(memory_data), 2) if memory_data else 0,
            "memory_max": max(memory_data) if memory_data else 0
        }
    }
