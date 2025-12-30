"""
Server Resource Monitor (SRM) - Like LoadRunner/NeoLoad
Monitors REMOTE server CPU, memory, disk during load tests

Supports:
- SSH (Linux/Unix servers)
- WMI/PowerShell Remoting (Windows servers)
- Cloud APIs (AWS CloudWatch, Azure Monitor, GCP)
- SNMP (Network devices)
"""

import logging
import asyncio
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from collections import deque
import subprocess
import platform

logger = logging.getLogger(__name__)


class ServerType(Enum):
    """Server type for monitoring protocol selection"""
    LINUX_SSH = "linux_ssh"
    WINDOWS_WMI = "windows_wmi"
    WINDOWS_POWERSHELL = "windows_powershell"
    AWS_CLOUDWATCH = "aws_cloudwatch"
    AZURE_MONITOR = "azure_monitor"
    GCP_MONITORING = "gcp_monitoring"
    SNMP = "snmp"
    PROMETHEUS_ENDPOINT = "prometheus"


@dataclass
class ServerCredentials:
    """Credentials for connecting to remote servers"""
    server_type: ServerType
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
    
    # SNMP credentials
    community_string: Optional[str] = None
    snmp_version: str = "2c"


@dataclass
class ServerMetrics:
    """Server resource metrics from remote server"""
    timestamp: datetime
    host: str
    cpu_percent: float
    cpu_per_core: List[float]
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    disk_read_mb_sec: float
    disk_write_mb_sec: float
    network_in_mb_sec: float
    network_out_mb_sec: float
    load_average_1m: Optional[float] = None
    load_average_5m: Optional[float] = None
    load_average_15m: Optional[float] = None
    process_count: Optional[int] = None
    top_processes: List[Dict[str, Any]] = field(default_factory=list)
    custom_metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorrelatedMetric:
    """Response time correlated with server metrics"""
    timestamp: datetime
    response_time_ms: float
    server_cpu_percent: float
    server_memory_percent: float
    server_disk_percent: float
    transaction_name: Optional[str] = None
    status: str = "pass"


class ServerResourceMonitor:
    """
    Server Resource Monitor (SRM)
    
    Like LoadRunner's SiteScope/SRM, monitors the TARGET SERVER
    during load tests to correlate response times with server health.
    
    Example:
        monitor = ServerResourceMonitor()
        
        # Add servers to monitor
        monitor.add_server(ServerCredentials(
            server_type=ServerType.LINUX_SSH,
            host="app-server.example.com",
            username="monitor",
            private_key_path="/path/to/key"
        ))
        
        # Start monitoring during load test
        await monitor.start_monitoring(interval_seconds=5)
        
        # After test, get correlation data
        correlation = monitor.get_response_time_correlation()
    """
    
    def __init__(self, history_size: int = 3600):
        self.servers: Dict[str, ServerCredentials] = {}
        self.metrics_history: Dict[str, deque] = {}
        self.history_size = history_size
        self.is_monitoring = False
        self.monitoring_task: Optional[asyncio.Task] = None
        self.interval_seconds = 5.0
        
        # Response time data for correlation
        self.response_times: List[Dict[str, Any]] = []
        
        # Baseline for network/disk deltas
        self.baselines: Dict[str, Dict[str, float]] = {}
    
    def add_server(self, credentials: ServerCredentials, alias: Optional[str] = None):
        """Add a server to monitor"""
        server_id = alias or credentials.host
        self.servers[server_id] = credentials
        self.metrics_history[server_id] = deque(maxlen=self.history_size)
        logger.info(f"Added server to monitor: {server_id} ({credentials.server_type.value})")
    
    def remove_server(self, server_id: str):
        """Remove a server from monitoring"""
        if server_id in self.servers:
            del self.servers[server_id]
            del self.metrics_history[server_id]
            logger.info(f"Removed server from monitoring: {server_id}")
    
    async def start_monitoring(self, interval_seconds: float = 5.0):
        """Start monitoring all configured servers"""
        if self.is_monitoring:
            logger.warning("Server monitoring already started")
            return
        
        if not self.servers:
            logger.warning("No servers configured for monitoring")
            return
        
        self.is_monitoring = True
        self.interval_seconds = interval_seconds
        
        # Capture baselines
        for server_id in self.servers:
            try:
                baseline = await self._collect_baseline(server_id)
                if baseline:
                    self.baselines[server_id] = baseline
            except Exception as e:
                logger.error(f"Failed to capture baseline for {server_id}: {e}")
        
        self.monitoring_task = asyncio.create_task(self._monitoring_loop())
        logger.info(f"Started server resource monitoring for {len(self.servers)} servers")
    
    async def stop_monitoring(self) -> Dict[str, Any]:
        """Stop monitoring and return summary"""
        self.is_monitoring = False
        
        if self.monitoring_task:
            self.monitoring_task.cancel()
            try:
                await self.monitoring_task
            except asyncio.CancelledError:
                pass
        
        summary = self.get_all_server_summaries()
        logger.info("Stopped server resource monitoring")
        return summary
    
    async def _monitoring_loop(self):
        """Main monitoring loop - collects from all servers"""
        while self.is_monitoring:
            try:
                # Collect from all servers in parallel
                tasks = [
                    self._collect_server_metrics(server_id)
                    for server_id in self.servers
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in server monitoring loop: {e}")
                await asyncio.sleep(self.interval_seconds)
    
    async def _collect_server_metrics(self, server_id: str) -> Optional[ServerMetrics]:
        """Collect metrics from a single server"""
        credentials = self.servers.get(server_id)
        if not credentials:
            return None
        
        try:
            if credentials.server_type == ServerType.LINUX_SSH:
                metrics = await self._collect_via_ssh(server_id, credentials)
            elif credentials.server_type in [ServerType.WINDOWS_WMI, ServerType.WINDOWS_POWERSHELL]:
                metrics = await self._collect_via_windows(server_id, credentials)
            elif credentials.server_type == ServerType.AWS_CLOUDWATCH:
                metrics = await self._collect_via_cloudwatch(server_id, credentials)
            elif credentials.server_type == ServerType.PROMETHEUS_ENDPOINT:
                metrics = await self._collect_via_prometheus(server_id, credentials)
            else:
                logger.warning(f"Unsupported server type: {credentials.server_type}")
                return None
            
            if metrics:
                self.metrics_history[server_id].append(metrics)
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to collect metrics from {server_id}: {e}")
            return None
    
    async def _collect_baseline(self, server_id: str) -> Optional[Dict[str, float]]:
        """Collect baseline values for delta calculations"""
        credentials = self.servers.get(server_id)
        if not credentials:
            return None
        
        # Collect initial network/disk counters for delta calculation
        return {
            "network_bytes_in": 0,
            "network_bytes_out": 0,
            "disk_read_bytes": 0,
            "disk_write_bytes": 0,
            "timestamp": datetime.utcnow().timestamp()
        }
    
    async def _collect_via_ssh(self, server_id: str, creds: ServerCredentials) -> Optional[ServerMetrics]:
        """
        Collect metrics via SSH from Linux/Unix server
        
        Uses standard Linux commands:
        - top/mpstat for CPU
        - free for memory
        - df for disk
        - /proc/net/dev for network
        """
        try:
            # Build SSH command
            ssh_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"]
            
            if creds.private_key_path:
                ssh_cmd.extend(["-i", creds.private_key_path])
            
            if creds.port != 22:
                ssh_cmd.extend(["-p", str(creds.port)])
            
            ssh_cmd.append(f"{creds.username}@{creds.host}")
            
            # Single command to get all metrics (efficient)
            metrics_script = """
echo "===CPU==="
cat /proc/stat | head -1
echo "===CPUPER==="
mpstat -P ALL 1 1 2>/dev/null | tail -n +4 | head -n -1 || top -bn1 | grep "Cpu(s)"
echo "===MEMORY==="
free -b
echo "===DISK==="
df -B1 / | tail -1
echo "===LOAD==="
cat /proc/loadavg
echo "===NETWORK==="
cat /proc/net/dev | grep -E "eth0|ens|enp"
echo "===PROCS==="
ps aux --no-headers | wc -l
echo "===TOP5==="
ps aux --sort=-%cpu | head -6 | tail -5
"""
            full_cmd = ssh_cmd + [metrics_script]
            
            # Run SSH command asynchronously
            process = await asyncio.create_subprocess_exec(
                *full_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=30.0
            )
            
            if process.returncode != 0:
                logger.error(f"SSH command failed for {server_id}: {stderr.decode()}")
                return None
            
            return self._parse_linux_metrics(server_id, creds.host, stdout.decode())
            
        except asyncio.TimeoutError:
            logger.error(f"SSH timeout for {server_id}")
            return None
        except Exception as e:
            logger.error(f"SSH collection failed for {server_id}: {e}")
            return None
    
    def _parse_linux_metrics(self, server_id: str, host: str, output: str) -> ServerMetrics:
        """Parse Linux command output into ServerMetrics"""
        sections = {}
        current_section = None
        current_lines = []
        
        for line in output.split('\n'):
            if line.startswith("===") and line.endswith("==="):
                if current_section:
                    sections[current_section] = current_lines
                current_section = line.strip("=")
                current_lines = []
            else:
                current_lines.append(line)
        
        if current_section:
            sections[current_section] = current_lines
        
        # Parse CPU
        cpu_percent = 0.0
        cpu_per_core = []
        if "CPUPER" in sections:
            for line in sections["CPUPER"]:
                if "all" in line.lower() or "cpu(s)" in line.lower():
                    parts = line.split()
                    try:
                        # mpstat format: %idle is usually last numeric
                        idle = float([p for p in parts if p.replace('.', '').isdigit()][-1])
                        cpu_percent = 100.0 - idle
                    except:
                        pass
        
        # Parse memory
        memory_percent = 0.0
        memory_used_mb = 0.0
        memory_total_mb = 0.0
        if "MEMORY" in sections:
            for line in sections["MEMORY"]:
                if line.lower().startswith("mem:"):
                    parts = line.split()
                    try:
                        memory_total_mb = int(parts[1]) / (1024 * 1024)
                        memory_used_mb = int(parts[2]) / (1024 * 1024)
                        memory_percent = (memory_used_mb / memory_total_mb) * 100 if memory_total_mb > 0 else 0
                    except:
                        pass
        
        # Parse disk
        disk_percent = 0.0
        if "DISK" in sections:
            for line in sections["DISK"]:
                parts = line.split()
                if len(parts) >= 5:
                    try:
                        disk_percent = float(parts[4].rstrip('%'))
                    except:
                        pass
        
        # Parse load average
        load_1m, load_5m, load_15m = None, None, None
        if "LOAD" in sections:
            for line in sections["LOAD"]:
                parts = line.split()
                if len(parts) >= 3:
                    try:
                        load_1m = float(parts[0])
                        load_5m = float(parts[1])
                        load_15m = float(parts[2])
                    except:
                        pass
        
        # Parse process count
        process_count = None
        if "PROCS" in sections:
            for line in sections["PROCS"]:
                try:
                    process_count = int(line.strip())
                except:
                    pass
        
        # Parse top processes
        top_processes = []
        if "TOP5" in sections:
            for line in sections["TOP5"]:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    try:
                        top_processes.append({
                            "user": parts[0],
                            "pid": parts[1],
                            "cpu_percent": float(parts[2]),
                            "memory_percent": float(parts[3]),
                            "command": parts[10][:50]
                        })
                    except:
                        pass
        
        return ServerMetrics(
            timestamp=datetime.utcnow(),
            host=host,
            cpu_percent=cpu_percent,
            cpu_per_core=cpu_per_core,
            memory_percent=memory_percent,
            memory_used_mb=memory_used_mb,
            memory_total_mb=memory_total_mb,
            disk_percent=disk_percent,
            disk_read_mb_sec=0.0,  # Would need iostat
            disk_write_mb_sec=0.0,
            network_in_mb_sec=0.0,  # Would need delta calculation
            network_out_mb_sec=0.0,
            load_average_1m=load_1m,
            load_average_5m=load_5m,
            load_average_15m=load_15m,
            process_count=process_count,
            top_processes=top_processes
        )
    
    async def _collect_via_windows(self, server_id: str, creds: ServerCredentials) -> Optional[ServerMetrics]:
        """
        Collect metrics via PowerShell Remoting from Windows server
        
        Uses:
        - Get-Counter for performance counters
        - Get-CimInstance for WMI data
        """
        try:
            # PowerShell script to collect metrics
            ps_script = """
$cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples[0].CookedValue
$mem = Get-CimInstance Win32_OperatingSystem
$memUsed = ($mem.TotalVisibleMemorySize - $mem.FreePhysicalMemory) * 1024
$memTotal = $mem.TotalVisibleMemorySize * 1024
$memPercent = ($memUsed / $memTotal) * 100
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$diskPercent = (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100
$procs = (Get-Process).Count

@{
    cpu_percent = [math]::Round($cpu, 2)
    memory_percent = [math]::Round($memPercent, 2)
    memory_used_mb = [math]::Round($memUsed / 1MB, 2)
    memory_total_mb = [math]::Round($memTotal / 1MB, 2)
    disk_percent = [math]::Round($diskPercent, 2)
    process_count = $procs
} | ConvertTo-Json
"""
            # Build PowerShell Remoting command
            if creds.domain:
                user = f"{creds.domain}\\{creds.username}"
            else:
                user = creds.username
            
            # Use PowerShell remoting
            cmd = [
                "powershell", "-Command",
                f"Invoke-Command -ComputerName {creds.host} -Credential (New-Object PSCredential('{user}', (ConvertTo-SecureString '{creds.password}' -AsPlainText -Force))) -ScriptBlock {{ {ps_script} }}"
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=30.0
            )
            
            if process.returncode != 0:
                logger.error(f"PowerShell command failed for {server_id}: {stderr.decode()}")
                return None
            
            data = json.loads(stdout.decode())
            
            return ServerMetrics(
                timestamp=datetime.utcnow(),
                host=creds.host,
                cpu_percent=data.get("cpu_percent", 0),
                cpu_per_core=[],
                memory_percent=data.get("memory_percent", 0),
                memory_used_mb=data.get("memory_used_mb", 0),
                memory_total_mb=data.get("memory_total_mb", 0),
                disk_percent=data.get("disk_percent", 0),
                disk_read_mb_sec=0.0,
                disk_write_mb_sec=0.0,
                network_in_mb_sec=0.0,
                network_out_mb_sec=0.0,
                process_count=data.get("process_count")
            )
            
        except Exception as e:
            logger.error(f"Windows collection failed for {server_id}: {e}")
            return None
    
    async def _collect_via_cloudwatch(self, server_id: str, creds: ServerCredentials) -> Optional[ServerMetrics]:
        """
        Collect metrics via AWS CloudWatch
        
        Requires: boto3
        """
        try:
            import boto3
            from datetime import timedelta
            
            cloudwatch = boto3.client(
                'cloudwatch',
                aws_access_key_id=creds.access_key,
                aws_secret_access_key=creds.secret_key,
                region_name=creds.region
            )
            
            now = datetime.utcnow()
            start_time = now - timedelta(minutes=5)
            
            # Get CPU utilization
            cpu_response = cloudwatch.get_metric_statistics(
                Namespace='AWS/EC2',
                MetricName='CPUUtilization',
                Dimensions=[{'Name': 'InstanceId', 'Value': creds.instance_id}],
                StartTime=start_time,
                EndTime=now,
                Period=60,
                Statistics=['Average']
            )
            
            cpu_percent = 0.0
            if cpu_response['Datapoints']:
                cpu_percent = cpu_response['Datapoints'][-1]['Average']
            
            # Get memory (requires CloudWatch agent)
            mem_response = cloudwatch.get_metric_statistics(
                Namespace='CWAgent',
                MetricName='mem_used_percent',
                Dimensions=[{'Name': 'InstanceId', 'Value': creds.instance_id}],
                StartTime=start_time,
                EndTime=now,
                Period=60,
                Statistics=['Average']
            )
            
            memory_percent = 0.0
            if mem_response['Datapoints']:
                memory_percent = mem_response['Datapoints'][-1]['Average']
            
            return ServerMetrics(
                timestamp=datetime.utcnow(),
                host=creds.instance_id,
                cpu_percent=cpu_percent,
                cpu_per_core=[],
                memory_percent=memory_percent,
                memory_used_mb=0,
                memory_total_mb=0,
                disk_percent=0,
                disk_read_mb_sec=0,
                disk_write_mb_sec=0,
                network_in_mb_sec=0,
                network_out_mb_sec=0
            )
            
        except ImportError:
            logger.error("boto3 not installed - cannot use CloudWatch")
            return None
        except Exception as e:
            logger.error(f"CloudWatch collection failed for {server_id}: {e}")
            return None
    
    async def _collect_via_prometheus(self, server_id: str, creds: ServerCredentials) -> Optional[ServerMetrics]:
        """
        Collect metrics from Prometheus endpoint
        
        Useful for Kubernetes/containerized apps with metrics endpoints
        """
        try:
            import aiohttp
            
            async with aiohttp.ClientSession() as session:
                url = f"http://{creds.host}:{creds.port}/metrics"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        return None
                    
                    text = await response.text()
                    
                    # Parse Prometheus format
                    cpu_percent = 0.0
                    memory_percent = 0.0
                    
                    for line in text.split('\n'):
                        if line.startswith('process_cpu_seconds_total'):
                            # Would need delta calculation
                            pass
                        elif line.startswith('process_resident_memory_bytes'):
                            try:
                                parts = line.split()
                                memory_bytes = float(parts[-1])
                                memory_percent = memory_bytes / (1024 * 1024 * 1024) * 100  # Rough estimate
                            except:
                                pass
                    
                    return ServerMetrics(
                        timestamp=datetime.utcnow(),
                        host=creds.host,
                        cpu_percent=cpu_percent,
                        cpu_per_core=[],
                        memory_percent=memory_percent,
                        memory_used_mb=0,
                        memory_total_mb=0,
                        disk_percent=0,
                        disk_read_mb_sec=0,
                        disk_write_mb_sec=0,
                        network_in_mb_sec=0,
                        network_out_mb_sec=0
                    )
                    
        except ImportError:
            logger.error("aiohttp not installed - cannot use Prometheus endpoint")
            return None
        except Exception as e:
            logger.error(f"Prometheus collection failed for {server_id}: {e}")
            return None
    
    def record_response_time(self, response_time_ms: float, transaction_name: Optional[str] = None, status: str = "pass"):
        """
        Record a response time measurement for correlation
        
        Call this during load test to correlate response times with server metrics
        """
        self.response_times.append({
            "timestamp": datetime.utcnow(),
            "response_time_ms": response_time_ms,
            "transaction_name": transaction_name,
            "status": status
        })
    
    def get_current_metrics(self, server_id: str) -> Optional[ServerMetrics]:
        """Get current metrics for a specific server"""
        if server_id in self.metrics_history and self.metrics_history[server_id]:
            return self.metrics_history[server_id][-1]
        return None
    
    def get_all_current_metrics(self) -> Dict[str, Optional[ServerMetrics]]:
        """Get current metrics for all servers"""
        return {
            server_id: self.get_current_metrics(server_id)
            for server_id in self.servers
        }
    
    def get_server_summary(self, server_id: str) -> Dict[str, Any]:
        """Get summary statistics for a server"""
        if server_id not in self.metrics_history or not self.metrics_history[server_id]:
            return {"error": "No data available"}
        
        history = list(self.metrics_history[server_id])
        
        cpu_values = [m.cpu_percent for m in history]
        mem_values = [m.memory_percent for m in history]
        disk_values = [m.disk_percent for m in history]
        
        return {
            "server_id": server_id,
            "host": history[0].host if history else None,
            "data_points": len(history),
            "time_range": {
                "start": history[0].timestamp.isoformat() if history else None,
                "end": history[-1].timestamp.isoformat() if history else None
            },
            "cpu": {
                "avg": sum(cpu_values) / len(cpu_values) if cpu_values else 0,
                "max": max(cpu_values) if cpu_values else 0,
                "min": min(cpu_values) if cpu_values else 0,
                "p90": sorted(cpu_values)[int(len(cpu_values) * 0.9)] if cpu_values else 0,
                "p95": sorted(cpu_values)[int(len(cpu_values) * 0.95)] if cpu_values else 0
            },
            "memory": {
                "avg": sum(mem_values) / len(mem_values) if mem_values else 0,
                "max": max(mem_values) if mem_values else 0,
                "min": min(mem_values) if mem_values else 0
            },
            "disk": {
                "avg": sum(disk_values) / len(disk_values) if disk_values else 0,
                "max": max(disk_values) if disk_values else 0
            },
            "load_average": {
                "1m": history[-1].load_average_1m if history else None,
                "5m": history[-1].load_average_5m if history else None,
                "15m": history[-1].load_average_15m if history else None
            }
        }
    
    def get_all_server_summaries(self) -> Dict[str, Dict[str, Any]]:
        """Get summaries for all servers"""
        return {
            server_id: self.get_server_summary(server_id)
            for server_id in self.servers
        }
    
    def get_response_time_correlation(self) -> List[CorrelatedMetric]:
        """
        Correlate response times with server metrics
        
        This is the KEY feature - like LoadRunner's "Web Page Diagnostics"
        Shows response time alongside server CPU/memory at that moment
        """
        correlated = []
        
        for rt_data in self.response_times:
            timestamp = rt_data["timestamp"]
            
            # Find closest server metrics for each server
            server_metrics = {}
            for server_id, history in self.metrics_history.items():
                closest = None
                min_diff = float('inf')
                
                for metrics in history:
                    diff = abs((metrics.timestamp - timestamp).total_seconds())
                    if diff < min_diff:
                        min_diff = diff
                        closest = metrics
                
                if closest and min_diff < 10:  # Within 10 seconds
                    server_metrics[server_id] = closest
            
            # Use average server metrics if multiple servers
            if server_metrics:
                avg_cpu = sum(m.cpu_percent for m in server_metrics.values()) / len(server_metrics)
                avg_mem = sum(m.memory_percent for m in server_metrics.values()) / len(server_metrics)
                avg_disk = sum(m.disk_percent for m in server_metrics.values()) / len(server_metrics)
            else:
                avg_cpu = avg_mem = avg_disk = 0
            
            correlated.append(CorrelatedMetric(
                timestamp=timestamp,
                response_time_ms=rt_data["response_time_ms"],
                server_cpu_percent=avg_cpu,
                server_memory_percent=avg_mem,
                server_disk_percent=avg_disk,
                transaction_name=rt_data.get("transaction_name"),
                status=rt_data.get("status", "pass")
            ))
        
        return correlated
    
    def get_correlation_chart_data(self) -> Dict[str, Any]:
        """
        Get data formatted for correlation charts
        
        Perfect for graphs showing:
        - Response Time vs Server CPU
        - Response Time vs Memory
        - Throughput vs Resource Usage
        """
        correlated = self.get_response_time_correlation()
        
        if not correlated:
            return {"error": "No correlation data available"}
        
        return {
            "timestamps": [c.timestamp.isoformat() for c in correlated],
            "response_times": [c.response_time_ms for c in correlated],
            "server_cpu": [c.server_cpu_percent for c in correlated],
            "server_memory": [c.server_memory_percent for c in correlated],
            "server_disk": [c.server_disk_percent for c in correlated],
            "transactions": [c.transaction_name for c in correlated],
            "statuses": [c.status for c in correlated],
            "analysis": self._analyze_correlation(correlated)
        }
    
    def _analyze_correlation(self, correlated: List[CorrelatedMetric]) -> Dict[str, Any]:
        """Analyze correlation between response time and server metrics"""
        if not correlated or len(correlated) < 3:
            return {"insufficient_data": True}
        
        response_times = [c.response_time_ms for c in correlated]
        server_cpus = [c.server_cpu_percent for c in correlated]
        server_mems = [c.server_memory_percent for c in correlated]
        
        # Simple correlation analysis
        avg_rt = sum(response_times) / len(response_times)
        avg_cpu = sum(server_cpus) / len(server_cpus)
        avg_mem = sum(server_mems) / len(server_mems)
        
        # Find high response time periods
        high_rt_threshold = avg_rt * 1.5
        high_rt_periods = [c for c in correlated if c.response_time_ms > high_rt_threshold]
        
        # Analyze what was happening during high response times
        findings = []
        
        if high_rt_periods:
            high_rt_avg_cpu = sum(c.server_cpu_percent for c in high_rt_periods) / len(high_rt_periods)
            high_rt_avg_mem = sum(c.server_memory_percent for c in high_rt_periods) / len(high_rt_periods)
            
            if high_rt_avg_cpu > 80:
                findings.append({
                    "type": "cpu_bottleneck",
                    "severity": "high",
                    "message": f"High CPU ({high_rt_avg_cpu:.1f}%) correlates with slow response times",
                    "recommendation": "Consider scaling up CPU or optimizing application code"
                })
            
            if high_rt_avg_mem > 85:
                findings.append({
                    "type": "memory_pressure",
                    "severity": "high",
                    "message": f"High memory usage ({high_rt_avg_mem:.1f}%) during slow periods",
                    "recommendation": "Check for memory leaks or increase memory allocation"
                })
            
            if high_rt_avg_cpu < 50 and high_rt_avg_mem < 50:
                findings.append({
                    "type": "external_dependency",
                    "severity": "medium",
                    "message": "Server resources OK but response times high",
                    "recommendation": "Check database queries, external API calls, or network latency"
                })
        
        # Check for resource trends
        if len(server_cpus) > 10:
            first_half_cpu = sum(server_cpus[:len(server_cpus)//2]) / (len(server_cpus)//2)
            second_half_cpu = sum(server_cpus[len(server_cpus)//2:]) / (len(server_cpus) - len(server_cpus)//2)
            
            if second_half_cpu > first_half_cpu * 1.3:
                findings.append({
                    "type": "cpu_trend",
                    "severity": "warning",
                    "message": f"CPU usage trending up during test ({first_half_cpu:.1f}% → {second_half_cpu:.1f}%)",
                    "recommendation": "Potential resource exhaustion under sustained load"
                })
        
        return {
            "avg_response_time_ms": avg_rt,
            "avg_server_cpu": avg_cpu,
            "avg_server_memory": avg_mem,
            "high_response_time_periods": len(high_rt_periods),
            "total_measurements": len(correlated),
            "findings": findings,
            "health_score": self._calculate_health_score(avg_rt, avg_cpu, avg_mem, findings)
        }
    
    def _calculate_health_score(self, avg_rt: float, avg_cpu: float, avg_mem: float, findings: List) -> int:
        """Calculate overall health score (0-100)"""
        score = 100
        
        # Penalize for high resource usage
        if avg_cpu > 80:
            score -= 20
        elif avg_cpu > 60:
            score -= 10
        
        if avg_mem > 85:
            score -= 20
        elif avg_mem > 70:
            score -= 10
        
        # Penalize for findings
        for finding in findings:
            if finding["severity"] == "high":
                score -= 15
            elif finding["severity"] == "medium":
                score -= 10
            else:
                score -= 5
        
        return max(0, min(100, score))


# Singleton instance
_server_monitor: Optional[ServerResourceMonitor] = None


def get_server_monitor() -> ServerResourceMonitor:
    """Get or create the server resource monitor singleton"""
    global _server_monitor
    if _server_monitor is None:
        _server_monitor = ServerResourceMonitor()
    return _server_monitor



