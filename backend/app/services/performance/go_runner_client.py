"""
Go Runner Client - Communication layer between Python Controller and Go Runner

Handles:
- gRPC communication with Go runner (when available)
- HTTP fallback for simpler deployments  
- Local process management for embedded runner
"""

import asyncio
import json
import logging
import subprocess
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass, asdict
import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class RunnerMetrics:
    """Metrics snapshot from Go runner"""
    active_vus: int = 0
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    requests_per_second: float = 0.0
    
    response_time_avg: float = 0.0
    response_time_p50: float = 0.0
    response_time_p95: float = 0.0
    response_time_p99: float = 0.0
    response_time_min: float = 0.0
    response_time_max: float = 0.0
    
    bytes_sent: int = 0
    bytes_received: int = 0
    
    host_cpu_percent: float = 0.0
    host_memory_percent: float = 0.0
    
    go_goroutines: int = 0
    go_heap_bytes: int = 0


@dataclass
class RunnerStatus:
    """Status of a Go runner"""
    agent_id: str
    hostname: str
    port: int
    status: str  # "online", "busy", "offline"
    max_vus: int
    current_vus: int
    available_vus: int
    cpu_percent: float
    memory_percent: float
    active_runs: List[str]


class GoRunnerClient:
    """
    Client for communicating with Go Runner instances.
    
    Supports:
    - Local embedded runner (spawned as subprocess)
    - Remote distributed runners (via gRPC/HTTP)
    """
    
    def __init__(self):
        self.runners: Dict[str, RunnerStatus] = {}
        self.local_runner_process: Optional[subprocess.Popen] = None
        self.local_runner_port: int = 50051
        self._metrics_callbacks: List[Callable[[str, RunnerMetrics], None]] = []
        
        # Path to Go runner binary
        self.runner_binary = self._find_runner_binary()
        
        # Auto-discover local runner on init
        self._try_discover_local_runner()
    
    def _find_runner_binary(self) -> Optional[Path]:
        """Find the Go runner binary"""
        # Check common locations
        possible_paths = [
            # Built runner in runner directory (default location after go build)
            Path(__file__).parent.parent.parent.parent.parent / "runner" / "runner.exe",
            Path(__file__).parent.parent.parent.parent.parent / "runner" / "runner",
            # Source location
            Path(__file__).parent.parent.parent.parent.parent / "runner" / "cmd" / "runner" / "runner.exe",
            Path(__file__).parent.parent.parent.parent.parent / "runner" / "cmd" / "runner" / "runner",
            # User home locations
            Path.home() / ".aristrace" / "runner" / "runner.exe",
            Path.home() / ".aristrace" / "runner" / "runner",
        ]
        
        for path in possible_paths:
            if path.exists():
                logger.info(f"Found Go runner binary at: {path}")
                return path
        
        logger.warning(f"Go runner binary not found. Checked paths: {[str(p) for p in possible_paths]}")
        return None
    
    def _try_discover_local_runner(self):
        """Try to discover an already-running local Go runner"""
        import socket
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)  # Short timeout
            result = sock.connect_ex(('localhost', self.local_runner_port))
            sock.close()
            
            if result == 0:
                # Something is listening on the port - assume it's the Go runner
                logger.info(f"Discovered existing Go runner on port {self.local_runner_port}")
                self.runners["local"] = RunnerStatus(
                    agent_id="local",
                    hostname="localhost",
                    port=self.local_runner_port,
                    status="online",
                    max_vus=1000,  # Default assumption
                    current_vus=0,
                    available_vus=1000,
                    cpu_percent=0.0,
                    memory_percent=0.0,
                    active_runs=[]
                )
            else:
                logger.debug(f"No Go runner found on port {self.local_runner_port}")
        except Exception as e:
            logger.debug(f"Error discovering local runner: {e}")
    
    async def start_local_runner(self, max_vus: int = 1000) -> bool:
        """Start the local embedded Go runner"""
        if self.local_runner_process is not None:
            logger.warning("Local runner already running")
            return True
        
        if self.runner_binary is None or not self.runner_binary.exists():
            logger.warning("Go runner binary not found - using Python fallback")
            return False
        
        try:
            self.local_runner_process = subprocess.Popen(
                [
                    str(self.runner_binary),
                    "--port", str(self.local_runner_port),
                    "--max-vus", str(max_vus)
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Wait for startup
            await asyncio.sleep(1)
            
            if self.local_runner_process.poll() is not None:
                stderr = self.local_runner_process.stderr.read().decode()
                logger.error(f"Go runner failed to start: {stderr}")
                return False
            
            # Register local runner
            self.runners["local"] = RunnerStatus(
                agent_id="local",
                hostname="localhost",
                port=self.local_runner_port,
                status="online",
                max_vus=max_vus,
                current_vus=0,
                available_vus=max_vus,
                cpu_percent=0.0,
                memory_percent=0.0,
                active_runs=[]
            )
            
            logger.info(f"Local Go runner started on port {self.local_runner_port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start local runner: {e}")
            return False
    
    async def stop_local_runner(self):
        """Stop the local Go runner"""
        if self.local_runner_process is not None:
            self.local_runner_process.terminate()
            try:
                self.local_runner_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.local_runner_process.kill()
            self.local_runner_process = None
            
            if "local" in self.runners:
                del self.runners["local"]
            
            logger.info("Local Go runner stopped")
    
    async def register_runner(self, agent_id: str, hostname: str, port: int, max_vus: int):
        """Register a remote Go runner"""
        self.runners[agent_id] = RunnerStatus(
            agent_id=agent_id,
            hostname=hostname,
            port=port,
            status="online",
            max_vus=max_vus,
            current_vus=0,
            available_vus=max_vus,
            cpu_percent=0.0,
            memory_percent=0.0,
            active_runs=[]
        )
        logger.info(f"Registered runner {agent_id} at {hostname}:{port}")
    
    async def start_run(self, run_id: str, scenario_json: bytes, 
                       config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Start a load test run on available runner(s).
        
        For distributed runs, will split VUs across multiple runners.
        """
        total_vus = config.get("virtual_users", 10)
        
        # Find available runners
        available = [r for r in self.runners.values() if r.status == "online" and r.available_vus > 0]
        
        if not available:
            return {
                "success": False,
                "error": "No available runners",
                "use_fallback": True
            }
        
        # For now, use single runner (extend for distributed)
        runner = max(available, key=lambda r: r.available_vus)
        
        if runner.available_vus < total_vus:
            logger.warning(f"Runner {runner.agent_id} has fewer VUs ({runner.available_vus}) than requested ({total_vus})")
        
        # Start run on runner
        try:
            result = await self._send_start_run(runner, run_id, scenario_json, config)
            
            if result.get("success"):
                runner.active_runs.append(run_id)
                runner.current_vus += min(total_vus, runner.available_vus)
                runner.available_vus = runner.max_vus - runner.current_vus
                runner.status = "busy" if runner.available_vus == 0 else "online"
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to start run on {runner.agent_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "use_fallback": True
            }
    
    async def stop_run(self, run_id: str, graceful: bool = True) -> Dict[str, Any]:
        """Stop a running test"""
        # Find runner with this run
        runner = None
        for r in self.runners.values():
            if run_id in r.active_runs:
                runner = r
                break
        
        if runner is None:
            return {"success": False, "error": "Run not found on any runner"}
        
        try:
            result = await self._send_stop_run(runner, run_id, graceful)
            
            if result.get("success"):
                runner.active_runs.remove(run_id)
                # VU count will be updated via metrics
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to stop run: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_metrics(self, run_id: str) -> Optional[RunnerMetrics]:
        """Get current metrics for a run"""
        runner = None
        for r in self.runners.values():
            if run_id in r.active_runs:
                runner = r
                break
        
        if runner is None:
            return None
        
        try:
            return await self._fetch_metrics(runner, run_id)
        except Exception as e:
            logger.error(f"Failed to get metrics: {e}")
            return None
    
    def on_metrics(self, callback: Callable[[str, RunnerMetrics], None]):
        """Register callback for streaming metrics"""
        self._metrics_callbacks.append(callback)
    
    async def _send_start_run(self, runner: RunnerStatus, run_id: str,
                              scenario_json: bytes, config: Dict[str, Any]) -> Dict[str, Any]:
        """Send start run command to runner via HTTP"""
        url = f"http://{runner.hostname}:{runner.port}/api/run/start"
        
        async with aiohttp.ClientSession() as session:
            payload = {
                "run_id": run_id,
                "scenario": scenario_json.decode('utf-8'),
                "config": config
            }
            
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    return {"success": False, "error": error}
    
    async def _send_stop_run(self, runner: RunnerStatus, run_id: str,
                             graceful: bool) -> Dict[str, Any]:
        """Send stop run command to runner via HTTP"""
        url = f"http://{runner.hostname}:{runner.port}/api/run/stop"
        
        async with aiohttp.ClientSession() as session:
            payload = {
                "run_id": run_id,
                "graceful": graceful
            }
            
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    return await resp.json()
                else:
                    error = await resp.text()
                    return {"success": False, "error": error}
    
    async def _fetch_metrics(self, runner: RunnerStatus, run_id: str) -> RunnerMetrics:
        """Fetch metrics from runner via HTTP"""
        url = f"http://{runner.hostname}:{runner.port}/api/run/{run_id}/metrics"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return RunnerMetrics(**data)
                else:
                    raise Exception(f"Failed to fetch metrics: {resp.status}")
    
    def get_available_capacity(self) -> int:
        """Get total available VU capacity across all runners"""
        return sum(r.available_vus for r in self.runners.values() if r.status != "offline")
    
    def get_runner_count(self) -> int:
        """Get count of online runners"""
        return sum(1 for r in self.runners.values() if r.status != "offline")
    
    def is_go_runner_available(self) -> bool:
        """Check if Go runner is available"""
        return len(self.runners) > 0 or self.runner_binary is not None


# Singleton instance
_client_instance = None

def get_go_runner_client() -> GoRunnerClient:
    """Get singleton client instance"""
    global _client_instance
    if _client_instance is None:
        _client_instance = GoRunnerClient()
    return _client_instance

