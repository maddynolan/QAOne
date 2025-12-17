"""
Distributed Load Test Controller

Orchestrates load tests across multiple worker nodes (VMs/containers)
to achieve 1000+ virtual users - similar to LoadRunner's architecture
but with automatic correlation and modern protocols.

Architecture:
    Controller (this service)
        ↓
    Worker Nodes (k6, Locust, or custom HTTP executor)
        ↓
    Target Application

Key Differences from LoadRunner:
- No proxy needed (HAR-based)
- Auto-correlation (no manual scripting)
- Container-native (Kubernetes ready)
- Real-time WebSocket metrics
- Open source executors (k6, Locust)
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import aiohttp
import logging

logger = logging.getLogger(__name__)


class WorkerStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class LoadProfile(Enum):
    CONSTANT = "constant"       # Steady load
    RAMP_UP = "ramp_up"        # Gradual increase
    SPIKE = "spike"            # Sudden burst
    STEP = "step"              # Incremental steps
    CUSTOM = "custom"          # User-defined


@dataclass
class WorkerNode:
    """Represents a load generator machine/container"""
    id: str
    host: str
    port: int
    status: WorkerStatus = WorkerStatus.IDLE
    allocated_users: int = 0
    current_rps: float = 0.0
    error_count: int = 0
    last_heartbeat: datetime = field(default_factory=datetime.now)
    
    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"
    
    @property
    def is_healthy(self) -> bool:
        """Check if worker responded recently"""
        return (datetime.now() - self.last_heartbeat).seconds < 30


@dataclass
class LoadTestConfig:
    """Configuration for distributed load test"""
    test_id: str
    name: str
    
    # Target
    target_url: str
    
    # Load settings
    total_virtual_users: int
    ramp_up_seconds: int
    duration_seconds: int
    load_profile: LoadProfile
    
    # Protocol data (from HAR)
    har_data: Optional[Dict] = None
    requests: List[Dict] = field(default_factory=list)
    
    # Auto-detected correlations
    correlations: List[Dict] = field(default_factory=list)
    
    # Parameterization data
    parameters: Dict[str, List[str]] = field(default_factory=dict)
    
    # Think time (user delays)
    think_time_min_ms: int = 1000
    think_time_max_ms: int = 5000
    
    # Thresholds
    max_response_time_ms: int = 5000
    max_error_rate_percent: float = 5.0


@dataclass
class LoadTestMetrics:
    """Real-time metrics aggregated from all workers"""
    timestamp: datetime
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    requests_per_second: float = 0.0
    avg_response_time_ms: float = 0.0
    p50_response_time_ms: float = 0.0
    p95_response_time_ms: float = 0.0
    p99_response_time_ms: float = 0.0
    active_users: int = 0
    error_rate_percent: float = 0.0
    
    # Per-request breakdown
    request_metrics: Dict[str, Dict] = field(default_factory=dict)


class DistributedLoadController:
    """
    Orchestrates load tests across multiple worker nodes.
    
    Similar to LoadRunner Controller but:
    - Uses HAR files instead of C scripts
    - Auto-correlates dynamic values
    - Supports modern protocols (HTTP/2, WebSocket, GraphQL)
    - Container-native deployment
    """
    
    def __init__(self):
        self.workers: Dict[str, WorkerNode] = {}
        self.active_tests: Dict[str, LoadTestConfig] = {}
        self.metrics_history: Dict[str, List[LoadTestMetrics]] = {}
        self._metrics_callbacks: List[callable] = []
        
    # =========================================================================
    # WORKER MANAGEMENT
    # =========================================================================
    
    def register_worker(self, host: str, port: int) -> WorkerNode:
        """Register a new load generator worker"""
        worker_id = f"worker_{uuid.uuid4().hex[:8]}"
        worker = WorkerNode(
            id=worker_id,
            host=host,
            port=port,
            status=WorkerStatus.IDLE
        )
        self.workers[worker_id] = worker
        logger.info(f"Registered worker: {worker_id} at {host}:{port}")
        return worker
    
    def get_available_workers(self) -> List[WorkerNode]:
        """Get workers that are healthy and idle"""
        return [
            w for w in self.workers.values()
            if w.status == WorkerStatus.IDLE and w.is_healthy
        ]
    
    def calculate_user_distribution(
        self, 
        total_users: int, 
        workers: List[WorkerNode]
    ) -> Dict[str, int]:
        """
        Distribute virtual users across workers.
        
        LoadRunner typically supports 200-500 users per load generator.
        We can handle more with efficient async HTTP.
        """
        if not workers:
            raise ValueError("No available workers")
        
        # Even distribution
        users_per_worker = total_users // len(workers)
        remainder = total_users % len(workers)
        
        distribution = {}
        for i, worker in enumerate(workers):
            users = users_per_worker + (1 if i < remainder else 0)
            distribution[worker.id] = users
            
        return distribution
    
    # =========================================================================
    # LOAD TEST EXECUTION
    # =========================================================================
    
    async def start_load_test(self, config: LoadTestConfig) -> str:
        """
        Start a distributed load test across all available workers.
        
        This is equivalent to LoadRunner's "Run" button, but:
        - No VuGen scripts needed
        - Uses HAR data directly
        - Auto-applies correlations
        """
        test_id = config.test_id or f"test_{uuid.uuid4().hex[:8]}"
        config.test_id = test_id
        
        logger.info(f"Starting load test: {test_id} with {config.total_virtual_users} users")
        
        # Get available workers
        workers = self.get_available_workers()
        if not workers:
            # Start local worker if none available
            workers = [await self._start_local_worker()]
        
        # Calculate user distribution
        distribution = self.calculate_user_distribution(
            config.total_virtual_users, 
            workers
        )
        
        logger.info(f"User distribution: {distribution}")
        
        # Convert HAR to executable requests with correlations applied
        executable_requests = self._prepare_requests(config)
        
        # Start test on each worker
        start_tasks = []
        for worker_id, user_count in distribution.items():
            worker = self.workers[worker_id]
            worker.allocated_users = user_count
            worker.status = WorkerStatus.RUNNING
            
            task = self._start_worker_test(
                worker=worker,
                config=config,
                requests=executable_requests,
                user_count=user_count
            )
            start_tasks.append(task)
        
        # Start all workers in parallel
        await asyncio.gather(*start_tasks)
        
        # Store active test
        self.active_tests[test_id] = config
        self.metrics_history[test_id] = []
        
        # Start metrics collection
        asyncio.create_task(self._collect_metrics(test_id))
        
        return test_id
    
    async def stop_load_test(self, test_id: str):
        """Stop a running load test"""
        if test_id not in self.active_tests:
            raise ValueError(f"Test {test_id} not found")
        
        logger.info(f"Stopping load test: {test_id}")
        
        # Stop all workers
        stop_tasks = []
        for worker in self.workers.values():
            if worker.status == WorkerStatus.RUNNING:
                stop_tasks.append(self._stop_worker_test(worker, test_id))
        
        await asyncio.gather(*stop_tasks)
        
        # Clean up
        del self.active_tests[test_id]
    
    def _prepare_requests(self, config: LoadTestConfig) -> List[Dict]:
        """
        Prepare requests for execution.
        
        This is where QAAI shines vs LoadRunner:
        - Auto-applies correlations
        - Handles dynamic tokens automatically
        - No manual scripting required
        """
        requests = []
        
        # Get requests from HAR or direct config
        source_requests = config.requests
        if config.har_data:
            source_requests = self._extract_requests_from_har(config.har_data)
        
        for req in source_requests:
            prepared = {
                'id': req.get('id', str(uuid.uuid4())),
                'method': req.get('method', 'GET'),
                'url': req.get('url', ''),
                'headers': req.get('headers', {}),
                'body': req.get('body'),
                
                # Correlation markers
                'extract': [],  # Values to extract from response
                'substitute': [],  # Values to substitute from previous extractions
            }
            
            # AUTO-CORRELATION: Find and mark dynamic values
            for corr in config.correlations:
                corr_name = corr.get('name')
                corr_pattern = corr.get('pattern')
                
                # If this request needs a correlated value
                if self._request_uses_correlation(req, corr_name):
                    prepared['substitute'].append({
                        'name': corr_name,
                        'location': corr.get('location', 'header'),  # header, body, url
                    })
                
                # If this request's response contains a correlated value
                if corr.get('source_request') == req.get('id'):
                    prepared['extract'].append({
                        'name': corr_name,
                        'pattern': corr_pattern,
                        'location': corr.get('response_location', 'body'),
                    })
            
            requests.append(prepared)
        
        return requests
    
    def _request_uses_correlation(self, request: Dict, corr_name: str) -> bool:
        """Check if request uses a correlated value"""
        # Check URL
        url = request.get('url', '')
        if f'{{{corr_name}}}' in url or corr_name in url:
            return True
        
        # Check headers
        headers = request.get('headers', {})
        for value in headers.values():
            if f'{{{corr_name}}}' in str(value):
                return True
        
        # Check body
        body = request.get('body', '')
        if body and f'{{{corr_name}}}' in str(body):
            return True
        
        return False
    
    def _extract_requests_from_har(self, har_data: Dict) -> List[Dict]:
        """Convert HAR entries to executable requests"""
        requests = []
        entries = har_data.get('log', {}).get('entries', [])
        
        for i, entry in enumerate(entries):
            req = entry.get('request', {})
            requests.append({
                'id': f'req_{i}',
                'method': req.get('method', 'GET'),
                'url': req.get('url', ''),
                'headers': {
                    h['name']: h['value'] 
                    for h in req.get('headers', [])
                    if h['name'].lower() not in ['host', 'content-length']
                },
                'body': req.get('postData', {}).get('text'),
            })
        
        return requests
    
    # =========================================================================
    # WORKER COMMUNICATION
    # =========================================================================
    
    async def _start_worker_test(
        self,
        worker: WorkerNode,
        config: LoadTestConfig,
        requests: List[Dict],
        user_count: int
    ):
        """Send test configuration to a worker node"""
        payload = {
            'test_id': config.test_id,
            'virtual_users': user_count,
            'ramp_up_seconds': config.ramp_up_seconds,
            'duration_seconds': config.duration_seconds,
            'requests': requests,
            'think_time': {
                'min_ms': config.think_time_min_ms,
                'max_ms': config.think_time_max_ms,
            },
            'thresholds': {
                'max_response_time_ms': config.max_response_time_ms,
                'max_error_rate_percent': config.max_error_rate_percent,
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{worker.url}/start",
                    json=payload,
                    timeout=30
                ) as response:
                    if response.status != 200:
                        raise Exception(f"Worker start failed: {await response.text()}")
                    logger.info(f"Worker {worker.id} started with {user_count} users")
        except Exception as e:
            logger.error(f"Failed to start worker {worker.id}: {e}")
            worker.status = WorkerStatus.ERROR
            raise
    
    async def _stop_worker_test(self, worker: WorkerNode, test_id: str):
        """Stop test on a worker node"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{worker.url}/stop",
                    json={'test_id': test_id},
                    timeout=10
                ) as response:
                    worker.status = WorkerStatus.IDLE
                    worker.allocated_users = 0
                    logger.info(f"Worker {worker.id} stopped")
        except Exception as e:
            logger.error(f"Failed to stop worker {worker.id}: {e}")
    
    async def _start_local_worker(self) -> WorkerNode:
        """Start a local worker for single-machine testing"""
        # In production, this would spin up a container
        worker = self.register_worker("localhost", 8001)
        logger.info("Started local worker for single-machine testing")
        return worker
    
    # =========================================================================
    # METRICS COLLECTION
    # =========================================================================
    
    async def _collect_metrics(self, test_id: str):
        """
        Aggregate metrics from all workers in real-time.
        
        This runs continuously during the test, similar to
        LoadRunner's Controller metrics display.
        """
        while test_id in self.active_tests:
            aggregated = LoadTestMetrics(timestamp=datetime.now())
            
            # Collect from each worker
            for worker in self.workers.values():
                if worker.status != WorkerStatus.RUNNING:
                    continue
                
                try:
                    metrics = await self._get_worker_metrics(worker)
                    if metrics:
                        aggregated.total_requests += metrics.get('total_requests', 0)
                        aggregated.successful_requests += metrics.get('successful_requests', 0)
                        aggregated.failed_requests += metrics.get('failed_requests', 0)
                        aggregated.active_users += metrics.get('active_users', 0)
                        # TODO: Proper percentile aggregation
                        
                except Exception as e:
                    logger.warning(f"Failed to get metrics from {worker.id}: {e}")
            
            # Calculate derived metrics
            if aggregated.total_requests > 0:
                aggregated.error_rate_percent = (
                    aggregated.failed_requests / aggregated.total_requests * 100
                )
            
            # Store and broadcast
            self.metrics_history[test_id].append(aggregated)
            await self._broadcast_metrics(test_id, aggregated)
            
            await asyncio.sleep(1)  # Collect every second
    
    async def _get_worker_metrics(self, worker: WorkerNode) -> Optional[Dict]:
        """Get current metrics from a worker"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{worker.url}/metrics",
                    timeout=5
                ) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception:
            pass
        return None
    
    async def _broadcast_metrics(self, test_id: str, metrics: LoadTestMetrics):
        """Send metrics to all registered callbacks (WebSocket clients)"""
        for callback in self._metrics_callbacks:
            try:
                await callback(test_id, metrics)
            except Exception as e:
                logger.warning(f"Metrics callback failed: {e}")
    
    def register_metrics_callback(self, callback: callable):
        """Register a callback for real-time metrics"""
        self._metrics_callbacks.append(callback)
    
    # =========================================================================
    # REPORTING
    # =========================================================================
    
    def get_test_summary(self, test_id: str) -> Dict:
        """
        Generate test summary report.
        
        Similar to LoadRunner Analysis but computed in real-time.
        """
        if test_id not in self.metrics_history:
            return {}
        
        history = self.metrics_history[test_id]
        if not history:
            return {}
        
        # Aggregate all metrics
        total_requests = sum(m.total_requests for m in history)
        total_successful = sum(m.successful_requests for m in history)
        total_failed = sum(m.failed_requests for m in history)
        
        duration_seconds = (history[-1].timestamp - history[0].timestamp).total_seconds()
        
        return {
            'test_id': test_id,
            'duration_seconds': duration_seconds,
            'total_requests': total_requests,
            'successful_requests': total_successful,
            'failed_requests': total_failed,
            'requests_per_second': total_requests / duration_seconds if duration_seconds > 0 else 0,
            'error_rate_percent': total_failed / total_requests * 100 if total_requests > 0 else 0,
            'peak_users': max(m.active_users for m in history),
            'avg_response_time_ms': sum(m.avg_response_time_ms for m in history) / len(history),
        }


# =============================================================================
# COMPARISON: LoadRunner vs QAAI
# =============================================================================
"""
LOADRUNNER ARCHITECTURE:
========================
1. VuGen (Recording)
   - Proxy-based capture
   - Generates C scripts
   - Manual correlation required
   
2. Controller
   - Orchestrates test
   - License-limited users
   - Windows-based
   
3. Load Generators
   - Physical/Virtual machines
   - 200-500 users per machine
   - Requires LoadRunner agent

4. Analysis
   - Post-test reports
   - Complex licensing


QAAI ARCHITECTURE:
==================
1. Recording (Browser Extension)
   - Native chrome.webRequest
   - Outputs HAR format
   - Auto-correlation
   
2. Controller (This Service)
   - Orchestrates test
   - No license limits
   - Container-native
   
3. Load Workers
   - Docker containers / K8s pods
   - 500-1000+ users per container
   - Uses k6/Locust/custom executor

4. Real-time Analysis
   - WebSocket streaming
   - Live dashboards
   - No separate tool needed


WHY QAAI IS BETTER:
===================
| Aspect            | LoadRunner           | QAAI                    |
|-------------------|----------------------|-------------------------|
| Recording         | Proxy + certs        | Browser-native          |
| Correlation       | Manual C scripting   | Automatic detection     |
| User Capacity     | ~500/machine         | ~1000+/container        |
| Deployment        | Windows servers      | Docker/Kubernetes       |
| Scaling           | Buy more licenses    | Add more containers     |
| Cost              | $50K-$500K/year      | Open source             |
| Cloud-native      | Limited              | AWS/GCP/Azure ready     |
"""


# Singleton instance
_controller: Optional[DistributedLoadController] = None

def get_load_controller() -> DistributedLoadController:
    """Get or create the distributed load controller"""
    global _controller
    if _controller is None:
        _controller = DistributedLoadController()
    return _controller
