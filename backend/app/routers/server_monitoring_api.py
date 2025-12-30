"""
Server Resource Monitoring API - Like LoadRunner's SiteScope

Monitor TARGET SERVERS during load tests:
- Response Time vs Server CPU correlation
- Memory pressure detection
- Bottleneck identification
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum

from app.services.performance.server_resource_monitor import (
    get_server_monitor,
    ServerCredentials,
    ServerType,
    ServerMetrics
)

router = APIRouter(prefix="/api/srm", tags=["Server Resource Monitoring"])


class ServerTypeEnum(str, Enum):
    linux_ssh = "linux_ssh"
    windows_wmi = "windows_wmi"
    windows_powershell = "windows_powershell"
    aws_cloudwatch = "aws_cloudwatch"
    azure_monitor = "azure_monitor"
    prometheus = "prometheus"


class AddServerRequest(BaseModel):
    """Request to add a server for monitoring"""
    alias: Optional[str] = None
    server_type: ServerTypeEnum
    host: str
    port: int = 22
    
    # SSH credentials
    username: Optional[str] = None
    password: Optional[str] = None
    private_key_path: Optional[str] = None
    
    # Windows credentials
    domain: Optional[str] = None
    
    # Cloud credentials
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    region: Optional[str] = None
    instance_id: Optional[str] = None


class StartMonitoringRequest(BaseModel):
    """Request to start server monitoring"""
    interval_seconds: float = 5.0


class RecordResponseTimeRequest(BaseModel):
    """Record a response time for correlation"""
    response_time_ms: float
    transaction_name: Optional[str] = None
    status: str = "pass"


@router.post("/servers")
async def add_server(request: AddServerRequest):
    """
    Add a server to monitor during load tests
    
    Like LoadRunner's "Add Resource Monitor" - configure servers
    to track their CPU/memory while running your load test.
    """
    monitor = get_server_monitor()
    
    credentials = ServerCredentials(
        server_type=ServerType(request.server_type.value),
        host=request.host,
        port=request.port,
        username=request.username,
        password=request.password,
        private_key_path=request.private_key_path,
        domain=request.domain,
        access_key=request.access_key,
        secret_key=request.secret_key,
        region=request.region,
        instance_id=request.instance_id
    )
    
    monitor.add_server(credentials, alias=request.alias)
    
    return {
        "status": "success",
        "message": f"Added server {request.alias or request.host} for monitoring",
        "server_type": request.server_type.value,
        "total_servers": len(monitor.servers)
    }


@router.delete("/servers/{server_id}")
async def remove_server(server_id: str):
    """Remove a server from monitoring"""
    monitor = get_server_monitor()
    monitor.remove_server(server_id)
    
    return {
        "status": "success",
        "message": f"Removed server {server_id}",
        "remaining_servers": len(monitor.servers)
    }


@router.get("/servers")
async def list_servers():
    """List all configured servers"""
    monitor = get_server_monitor()
    
    servers = []
    for server_id, creds in monitor.servers.items():
        servers.append({
            "server_id": server_id,
            "host": creds.host,
            "server_type": creds.server_type.value,
            "port": creds.port
        })
    
    return {
        "servers": servers,
        "is_monitoring": monitor.is_monitoring
    }


@router.post("/start")
async def start_monitoring(request: StartMonitoringRequest):
    """
    Start monitoring all configured servers
    
    Call this BEFORE starting your load test.
    Metrics will be collected every {interval_seconds}.
    """
    monitor = get_server_monitor()
    
    if not monitor.servers:
        raise HTTPException(
            status_code=400,
            detail="No servers configured. Add servers first using POST /api/srm/servers"
        )
    
    await monitor.start_monitoring(interval_seconds=request.interval_seconds)
    
    return {
        "status": "started",
        "message": f"Monitoring {len(monitor.servers)} server(s)",
        "interval_seconds": request.interval_seconds,
        "servers": list(monitor.servers.keys())
    }


@router.post("/stop")
async def stop_monitoring():
    """
    Stop monitoring and get summary
    
    Call this AFTER your load test completes.
    Returns summary statistics for all servers.
    """
    monitor = get_server_monitor()
    summary = await monitor.stop_monitoring()
    
    return {
        "status": "stopped",
        "summary": summary
    }


@router.get("/current")
async def get_current_metrics():
    """
    Get current metrics from all monitored servers
    
    Use during load test to see real-time server health.
    """
    monitor = get_server_monitor()
    
    all_metrics = monitor.get_all_current_metrics()
    
    result = {}
    for server_id, metrics in all_metrics.items():
        if metrics:
            result[server_id] = {
                "timestamp": metrics.timestamp.isoformat(),
                "host": metrics.host,
                "cpu_percent": metrics.cpu_percent,
                "memory_percent": metrics.memory_percent,
                "memory_used_mb": metrics.memory_used_mb,
                "disk_percent": metrics.disk_percent,
                "load_average": metrics.load_average_1m,
                "process_count": metrics.process_count,
                "top_processes": metrics.top_processes[:3]  # Top 3
            }
        else:
            result[server_id] = {"error": "No metrics available"}
    
    return {
        "is_monitoring": monitor.is_monitoring,
        "servers": result
    }


@router.post("/record-response-time")
async def record_response_time(request: RecordResponseTimeRequest):
    """
    Record a response time measurement for correlation
    
    Call this from your load test after each transaction
    to correlate response times with server metrics.
    
    Example:
        After each HTTP request in your test:
        POST /api/srm/record-response-time
        {"response_time_ms": 450, "transaction_name": "Login"}
    """
    monitor = get_server_monitor()
    
    monitor.record_response_time(
        response_time_ms=request.response_time_ms,
        transaction_name=request.transaction_name,
        status=request.status
    )
    
    return {"status": "recorded"}


@router.get("/correlation")
async def get_correlation():
    """
    Get response time vs server metrics correlation
    
    THE KEY FEATURE - shows you:
    - When response times went up, what was the server CPU/memory?
    - Did high CPU cause slow responses?
    - Is there a memory leak causing degradation?
    
    Like LoadRunner's "Web Page Diagnostics" breakdown.
    """
    monitor = get_server_monitor()
    
    chart_data = monitor.get_correlation_chart_data()
    
    if "error" in chart_data:
        return {
            "status": "no_data",
            "message": "Run a load test with response time recording first",
            "tip": "Call POST /api/srm/record-response-time during your load test"
        }
    
    return {
        "status": "success",
        "correlation": chart_data
    }


@router.get("/summary/{server_id}")
async def get_server_summary(server_id: str):
    """Get summary statistics for a specific server"""
    monitor = get_server_monitor()
    
    if server_id not in monitor.servers:
        raise HTTPException(status_code=404, detail=f"Server {server_id} not found")
    
    return monitor.get_server_summary(server_id)


@router.get("/summary")
async def get_all_summaries():
    """
    Get summary statistics for all servers
    
    Returns CPU, memory, disk averages and max values
    for each monitored server.
    """
    monitor = get_server_monitor()
    return monitor.get_all_server_summaries()


@router.get("/health-check")
async def server_health_check():
    """
    Quick health check - is anything concerning?
    
    Returns warnings if:
    - Server CPU > 80%
    - Server Memory > 85%
    - Server is unreachable
    """
    monitor = get_server_monitor()
    
    all_metrics = monitor.get_all_current_metrics()
    
    health_status = "healthy"
    warnings = []
    critical = []
    
    for server_id, metrics in all_metrics.items():
        if not metrics:
            critical.append({
                "server": server_id,
                "issue": "Server unreachable or no metrics"
            })
            health_status = "critical"
            continue
        
        if metrics.cpu_percent > 90:
            critical.append({
                "server": server_id,
                "issue": f"CPU critical: {metrics.cpu_percent:.1f}%"
            })
            health_status = "critical"
        elif metrics.cpu_percent > 80:
            warnings.append({
                "server": server_id,
                "issue": f"CPU high: {metrics.cpu_percent:.1f}%"
            })
            if health_status == "healthy":
                health_status = "warning"
        
        if metrics.memory_percent > 90:
            critical.append({
                "server": server_id,
                "issue": f"Memory critical: {metrics.memory_percent:.1f}%"
            })
            health_status = "critical"
        elif metrics.memory_percent > 85:
            warnings.append({
                "server": server_id,
                "issue": f"Memory high: {metrics.memory_percent:.1f}%"
            })
            if health_status == "healthy":
                health_status = "warning"
        
        if metrics.disk_percent > 90:
            warnings.append({
                "server": server_id,
                "issue": f"Disk space low: {metrics.disk_percent:.1f}% used"
            })
            if health_status == "healthy":
                health_status = "warning"
    
    return {
        "status": health_status,
        "servers_monitored": len(all_metrics),
        "warnings": warnings,
        "critical": critical,
        "is_monitoring": monitor.is_monitoring
    }


@router.get("/comparison")
async def compare_loadrunner():
    """
    How Flowstral SRM compares to LoadRunner/NeoLoad
    
    Feature comparison and usage guide.
    """
    return {
        "title": "Flowstral Server Resource Monitoring",
        "comparison_with_loadrunner": {
            "what_we_monitor": {
                "target_server_cpu": "✅ Yes - via SSH/WMI/CloudWatch",
                "target_server_memory": "✅ Yes - total, used, percent",
                "target_server_disk": "✅ Yes - usage percent, I/O",
                "target_server_network": "✅ Yes - bytes in/out",
                "load_average": "✅ Yes - 1m, 5m, 15m (Linux)",
                "top_processes": "✅ Yes - CPU hogs identified",
                "response_time_correlation": "✅ Yes - THE KEY FEATURE"
            },
            "protocols_supported": {
                "ssh_linux": "✅ Connect to Linux/Unix servers",
                "wmi_windows": "✅ Connect to Windows servers",
                "aws_cloudwatch": "✅ Monitor EC2 instances",
                "prometheus": "✅ Scrape /metrics endpoints",
                "snmp": "🔜 Coming soon for network devices"
            },
            "key_difference": "LoadRunner bundles SiteScope ($$$), we include it FREE"
        },
        "usage_workflow": {
            "step_1": "POST /api/srm/servers - Add your app server(s)",
            "step_2": "POST /api/srm/start - Start monitoring before load test",
            "step_3": "Run load test, POST /api/srm/record-response-time for each request",
            "step_4": "POST /api/srm/stop - Stop monitoring after test",
            "step_5": "GET /api/srm/correlation - See response time vs CPU/memory graph"
        },
        "what_you_discover": [
            "Is CPU causing slow responses?",
            "Is memory pressure building up?",
            "Which server in the cluster is the bottleneck?",
            "Are response times OK but server about to fall over?",
            "Is there an external dependency causing slowness?"
        ]
    }



