"""
Load Test Worker

Executes virtual users on a single machine/container.
Multiple workers can be distributed across VMs for scale.

Equivalent to LoadRunner's "Load Generator" but:
- Container-native (runs in Docker/K8s)
- Async HTTP for higher efficiency
- No LoadRunner agent license needed
- Handles 500-1000+ users per instance

Deployment Options:
1. Single machine: Run one worker locally
2. Distributed: Deploy workers via Docker/K8s
3. Cloud: Auto-scale workers in AWS/GCP/Azure
"""

import asyncio
import aiohttp
import json
import time
import random
import re
import statistics
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class VirtualUser:
    """
    Represents a single virtual user executing requests.
    
    LoadRunner calls these "Vusers" - we're doing the same
    but with async Python instead of C threads.
    """
    id: int
    session: aiohttp.ClientSession
    correlation_store: Dict[str, str] = field(default_factory=dict)
    request_count: int = 0
    error_count: int = 0
    response_times: List[float] = field(default_factory=list)
    
    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()


@dataclass
class WorkerMetrics:
    """Real-time metrics from this worker"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    active_users: int = 0
    response_times: List[float] = field(default_factory=list)
    errors_by_type: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    requests_by_endpoint: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    
    def to_dict(self) -> Dict:
        return {
            'total_requests': self.total_requests,
            'successful_requests': self.successful_requests,
            'failed_requests': self.failed_requests,
            'active_users': self.active_users,
            'avg_response_time_ms': statistics.mean(self.response_times) if self.response_times else 0,
            'p50_response_time_ms': statistics.median(self.response_times) if self.response_times else 0,
            'p95_response_time_ms': self._percentile(95) if self.response_times else 0,
            'p99_response_time_ms': self._percentile(99) if self.response_times else 0,
            'requests_per_second': len(self.response_times),  # Per collection interval
        }
    
    def _percentile(self, p: int) -> float:
        if not self.response_times:
            return 0
        sorted_times = sorted(self.response_times)
        idx = int(len(sorted_times) * p / 100)
        return sorted_times[min(idx, len(sorted_times) - 1)]


class LoadWorker:
    """
    Executes load test on a single machine.
    
    This is equivalent to LoadRunner's Load Generator, but:
    - Uses async HTTP (aiohttp) for efficiency
    - Handles correlation automatically
    - No licensing restrictions
    - Container-friendly
    
    Capacity: 500-1000+ virtual users per instance
    (LoadRunner: typically 200-500 per Load Generator)
    """
    
    def __init__(self):
        self.test_id: Optional[str] = None
        self.running = False
        self.users: List[VirtualUser] = []
        self.metrics = WorkerMetrics()
        self.requests: List[Dict] = []
        self.config: Dict = {}
        
    async def start_test(
        self,
        test_id: str,
        virtual_users: int,
        ramp_up_seconds: int,
        duration_seconds: int,
        requests: List[Dict],
        think_time: Dict,
        thresholds: Dict
    ):
        """
        Start executing virtual users.
        
        Equivalent to LoadRunner's "Initialize" + "Run" phases.
        """
        self.test_id = test_id
        self.running = True
        self.requests = requests
        self.config = {
            'virtual_users': virtual_users,
            'ramp_up_seconds': ramp_up_seconds,
            'duration_seconds': duration_seconds,
            'think_time': think_time,
            'thresholds': thresholds,
        }
        self.metrics = WorkerMetrics()
        
        logger.info(f"Starting test {test_id} with {virtual_users} users")
        
        # Calculate ramp-up schedule
        # Similar to LoadRunner's "ramp up X users every Y seconds"
        if ramp_up_seconds > 0:
            users_per_second = virtual_users / ramp_up_seconds
        else:
            users_per_second = virtual_users
        
        # Start users with ramp-up
        start_time = time.time()
        users_started = 0
        
        while self.running and users_started < virtual_users:
            # Calculate how many users should be running by now
            elapsed = time.time() - start_time
            target_users = min(
                int(elapsed * users_per_second) + 1,
                virtual_users
            )
            
            # Start more users if needed
            while users_started < target_users and self.running:
                user = await self._create_user(users_started)
                self.users.append(user)
                asyncio.create_task(self._run_user(user, duration_seconds))
                users_started += 1
                self.metrics.active_users = users_started
            
            await asyncio.sleep(0.1)
        
        logger.info(f"All {users_started} users started")
        
        # Wait for duration
        remaining = duration_seconds - (time.time() - start_time)
        if remaining > 0:
            await asyncio.sleep(remaining)
        
        # Stop test
        await self.stop_test()
    
    async def stop_test(self):
        """Stop all virtual users"""
        self.running = False
        
        # Close all user sessions
        for user in self.users:
            await user.close()
        
        self.users.clear()
        self.metrics.active_users = 0
        logger.info(f"Test {self.test_id} stopped")
    
    async def _create_user(self, user_id: int) -> VirtualUser:
        """Create a new virtual user with its own HTTP session"""
        # Each user gets its own session (like LoadRunner Vuser)
        # This maintains cookies, connection pools per user
        connector = aiohttp.TCPConnector(
            limit=10,  # Connection pool per user
            enable_cleanup_closed=True
        )
        session = aiohttp.ClientSession(
            connector=connector,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        
        return VirtualUser(
            id=user_id,
            session=session
        )
    
    async def _run_user(self, user: VirtualUser, duration_seconds: int):
        """
        Execute request sequence for a single user.
        
        This is like LoadRunner's Action() function that loops.
        """
        start_time = time.time()
        
        while self.running and (time.time() - start_time) < duration_seconds:
            # Execute all requests in sequence (like LoadRunner script)
            for request in self.requests:
                if not self.running:
                    break
                
                try:
                    await self._execute_request(user, request)
                except Exception as e:
                    logger.warning(f"User {user.id} request failed: {e}")
                    user.error_count += 1
                    self.metrics.failed_requests += 1
                    self.metrics.errors_by_type[type(e).__name__] += 1
                
                # Think time (user delay between requests)
                # Similar to lr_think_time() in LoadRunner
                think_time = random.randint(
                    self.config['think_time']['min_ms'],
                    self.config['think_time']['max_ms']
                ) / 1000.0
                await asyncio.sleep(think_time)
            
            # Iteration complete - loop back (like LoadRunner iterations)
    
    async def _execute_request(self, user: VirtualUser, request: Dict):
        """
        Execute a single HTTP request with correlation handling.
        
        This is equivalent to web_custom_request() in LoadRunner,
        but with automatic correlation applied.
        """
        method = request.get('method', 'GET')
        url = request.get('url', '')
        headers = dict(request.get('headers', {}))
        body = request.get('body')
        
        # SUBSTITUTE: Replace correlated values
        # In LoadRunner: {session_id} gets replaced
        # We do the same automatically
        for substitution in request.get('substitute', []):
            name = substitution['name']
            if name in user.correlation_store:
                value = user.correlation_store[name]
                
                # Replace in URL
                url = url.replace(f'{{{name}}}', value)
                url = url.replace(f'${{{name}}}', value)
                
                # Replace in headers
                for key, val in headers.items():
                    if f'{{{name}}}' in str(val):
                        headers[key] = val.replace(f'{{{name}}}', value)
                
                # Replace in body
                if body:
                    body = body.replace(f'{{{name}}}', value)
        
        # Execute request
        start_time = time.time()
        
        async with user.session.request(
            method=method,
            url=url,
            headers=headers,
            data=body if body else None,
            ssl=False  # For testing; enable in production
        ) as response:
            response_time = (time.time() - start_time) * 1000  # ms
            response_text = await response.text()
            response_headers = dict(response.headers)
            
            # Record metrics
            user.request_count += 1
            user.response_times.append(response_time)
            self.metrics.total_requests += 1
            self.metrics.response_times.append(response_time)
            self.metrics.requests_by_endpoint[url] += 1
            
            if response.status < 400:
                self.metrics.successful_requests += 1
            else:
                self.metrics.failed_requests += 1
                self.metrics.errors_by_type[f'HTTP_{response.status}'] += 1
            
            # EXTRACT: Save correlated values from response
            # In LoadRunner: web_reg_save_param()
            # We do this automatically based on patterns
            for extraction in request.get('extract', []):
                name = extraction['name']
                pattern = extraction.get('pattern', '')
                location = extraction.get('location', 'body')
                
                extracted_value = self._extract_value(
                    pattern=pattern,
                    response_body=response_text,
                    response_headers=response_headers,
                    location=location
                )
                
                if extracted_value:
                    user.correlation_store[name] = extracted_value
                    logger.debug(f"User {user.id} extracted {name}={extracted_value[:50]}...")
            
            return response_time
    
    def _extract_value(
        self,
        pattern: str,
        response_body: str,
        response_headers: Dict,
        location: str
    ) -> Optional[str]:
        """
        Extract a dynamic value from response.
        
        This replaces LoadRunner's manual web_reg_save_param():
        
        LoadRunner:
            web_reg_save_param("session_id",
                "LB=session_id\":\"",
                "RB=\"",
                LAST);
        
        QAAI:
            Auto-detects and extracts based on pattern
        """
        try:
            if location == 'header':
                # Extract from headers
                for key, value in response_headers.items():
                    match = re.search(pattern, f"{key}: {value}")
                    if match:
                        return match.group(1) if match.groups() else match.group()
            
            elif location == 'body':
                # Extract from body
                match = re.search(pattern, response_body)
                if match:
                    return match.group(1) if match.groups() else match.group()
            
            elif location == 'cookie':
                # Extract from Set-Cookie header
                cookies = response_headers.get('Set-Cookie', '')
                match = re.search(pattern, cookies)
                if match:
                    return match.group(1) if match.groups() else match.group()
        
        except Exception as e:
            logger.warning(f"Extraction failed for pattern {pattern}: {e}")
        
        return None
    
    def get_metrics(self) -> Dict:
        """Get current metrics for this worker"""
        return self.metrics.to_dict()


# =============================================================================
# HTTP SERVER FOR WORKER
# =============================================================================
# In production, this would be a FastAPI/Flask app
# that receives commands from the controller

async def run_worker_server(host: str = "0.0.0.0", port: int = 8001):
    """
    Run the worker as an HTTP server.
    
    Controller communicates with workers via:
    POST /start - Start test
    POST /stop  - Stop test
    GET /metrics - Get current metrics
    """
    from aiohttp import web
    
    worker = LoadWorker()
    
    async def handle_start(request):
        data = await request.json()
        asyncio.create_task(worker.start_test(
            test_id=data['test_id'],
            virtual_users=data['virtual_users'],
            ramp_up_seconds=data['ramp_up_seconds'],
            duration_seconds=data['duration_seconds'],
            requests=data['requests'],
            think_time=data['think_time'],
            thresholds=data['thresholds']
        ))
        return web.json_response({'status': 'started'})
    
    async def handle_stop(request):
        await worker.stop_test()
        return web.json_response({'status': 'stopped'})
    
    async def handle_metrics(request):
        return web.json_response(worker.get_metrics())
    
    async def handle_health(request):
        return web.json_response({'status': 'healthy'})
    
    app = web.Application()
    app.router.add_post('/start', handle_start)
    app.router.add_post('/stop', handle_stop)
    app.router.add_get('/metrics', handle_metrics)
    app.router.add_get('/health', handle_health)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    
    logger.info(f"Worker server running on {host}:{port}")
    
    # Keep running
    while True:
        await asyncio.sleep(3600)


# =============================================================================
# DOCKER/KUBERNETES DEPLOYMENT
# =============================================================================
"""
DEPLOYMENT FOR 1000+ USERS:

Option 1: Docker Compose (Small Scale)
--------------------------------------
version: '3'
services:
  controller:
    image: qaai/load-controller
    ports:
      - "8000:8000"
  
  worker-1:
    image: qaai/load-worker
    environment:
      - CONTROLLER_URL=http://controller:8000
      - WORKER_PORT=8001
  
  worker-2:
    image: qaai/load-worker
    environment:
      - CONTROLLER_URL=http://controller:8000
      - WORKER_PORT=8001


Option 2: Kubernetes (Large Scale)
----------------------------------
apiVersion: apps/v1
kind: Deployment
metadata:
  name: load-workers
spec:
  replicas: 10  # Scale to 10 workers = 10,000 users
  selector:
    matchLabels:
      app: load-worker
  template:
    metadata:
      labels:
        app: load-worker
    spec:
      containers:
      - name: worker
        image: qaai/load-worker
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"


Option 3: Cloud Auto-Scaling (AWS/GCP)
--------------------------------------
# AWS ECS with auto-scaling
resource "aws_appautoscaling_target" "load_workers" {
  max_capacity       = 20
  min_capacity       = 1
  resource_id        = "service/cluster/load-workers"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}


CAPACITY PLANNING:
==================
| Users    | Workers | Memory/Worker | Total Memory |
|----------|---------|---------------|--------------|
| 100      | 1       | 2 GB          | 2 GB         |
| 500      | 1       | 4 GB          | 4 GB         |
| 1,000    | 2       | 4 GB each     | 8 GB         |
| 5,000    | 5       | 4 GB each     | 20 GB        |
| 10,000   | 10      | 4 GB each     | 40 GB        |
| 50,000   | 50      | 4 GB each     | 200 GB       |

LoadRunner would require:
- 50,000 users = ~100 Load Generators
- Each LG needs LoadRunner agent license
- Cost: $200K+ in licensing alone
"""


if __name__ == "__main__":
    # Run as standalone worker
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker_server())
