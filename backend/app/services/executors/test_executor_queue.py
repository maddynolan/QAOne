"""
Test Execution Queue Service
Manages job queue for test execution with artifact streaming
"""

import asyncio
import logging
import json
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TestJob:
    """Represents a test execution job"""
    
    def __init__(
        self,
        job_id: str,
        test_cases: List[Dict[str, Any]],
        test_type: str,
        project_id: str,
        org_id: str,
        executor_type: str = "ui-runner"
    ):
        self.job_id = job_id
        self.test_cases = test_cases
        self.test_type = test_type
        self.project_id = project_id
        self.org_id = org_id
        self.executor_type = executor_type
        self.status = JobStatus.QUEUED
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None
        self.artifacts: List[Dict[str, Any]] = []
        self.logs: List[str] = []
        self.error: Optional[str] = None
        self.results: List[Dict[str, Any]] = []

class TestExecutorQueue:
    """
    In-memory job queue for test execution
    In production, replace with Redis or RabbitMQ
    """
    
    def __init__(self):
        self.jobs: Dict[str, TestJob] = {}
        self.queue: asyncio.Queue = asyncio.Queue()
        self.workers: List[asyncio.Task] = []
        self.is_running = False
    
    async def push_job(
        self,
        test_cases: List[Dict[str, Any]],
        test_type: str,
        project_id: str,
        org_id: str,
        executor_type: str = "ui-runner"
    ) -> str:
        """Add a job to the queue"""
        job_id = f"job_{datetime.utcnow().timestamp()}"
        job = TestJob(
            job_id=job_id,
            test_cases=test_cases,
            test_type=test_type,
            project_id=project_id,
            org_id=org_id,
            executor_type=executor_type
        )
        
        self.jobs[job_id] = job
        await self.queue.put(job)
        logger.info(f"Job {job_id} queued")
        
        return job_id
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a job"""
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "logs": job.logs[-50:],  # Last 50 log lines
            "artifacts": job.artifacts,
            "results": job.results,
            "error": job.error
        }
    
    async def start_worker(self, executor_callback: Callable):
        """Start a worker to process jobs"""
        self.is_running = True
        while self.is_running:
            try:
                job = await asyncio.wait_for(self.queue.get(), timeout=1.0)
                job.status = JobStatus.RUNNING
                job.started_at = datetime.utcnow()
                
                logger.info(f"Processing job {job.job_id}")
                
                try:
                    # Execute job
                    result = await executor_callback(job)
                    job.results = result.get("results", [])
                    job.artifacts = result.get("artifacts", [])
                    job.logs.extend(result.get("logs", []))
                    job.status = JobStatus.COMPLETED
                except Exception as e:
                    logger.error(f"Job {job.job_id} failed: {e}")
                    job.status = JobStatus.FAILED
                    job.error = str(e)
                finally:
                    job.completed_at = datetime.utcnow()
                    self.queue.task_done()
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker error: {e}")
    
    def stop_workers(self):
        """Stop all workers"""
        self.is_running = False

# Global queue instance
_executor_queue = None

def get_executor_queue() -> TestExecutorQueue:
    """Get or create executor queue instance"""
    global _executor_queue
    if _executor_queue is None:
        _executor_queue = TestExecutorQueue()
    return _executor_queue


