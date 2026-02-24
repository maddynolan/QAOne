"""
Test Execution Queue Service
Manages job queue for test execution with artifact streaming.

Supports two backends:
  - In-memory asyncio.Queue (default fallback)
  - Redis-backed queue (activated when REDIS_URL env var is set)

Redis storage layout:
  - Hash  `flowstral:jobs`   — job_id → JSON-serialized job dict
  - List  `flowstral:queue`  — FIFO list of job_ids awaiting processing
"""

import asyncio
import logging
import json
import os
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

REDIS_JOBS_HASH = "flowstral:jobs"
REDIS_QUEUE_LIST = "flowstral:queue"


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

    def to_dict(self) -> Dict[str, Any]:
        """Serialize job to a JSON-safe dictionary."""
        return {
            "job_id": self.job_id,
            "test_cases": self.test_cases,
            "test_type": self.test_type,
            "project_id": self.project_id,
            "org_id": self.org_id,
            "executor_type": self.executor_type,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "artifacts": self.artifacts,
            "logs": self.logs,
            "error": self.error,
            "results": self.results,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TestJob":
        """Deserialize a job from a dictionary (e.g. loaded from Redis)."""
        job = cls(
            job_id=data["job_id"],
            test_cases=data.get("test_cases", []),
            test_type=data.get("test_type", ""),
            project_id=data.get("project_id", ""),
            org_id=data.get("org_id", ""),
            executor_type=data.get("executor_type", "ui-runner"),
        )
        job.status = JobStatus(data.get("status", "queued"))
        job.created_at = (
            datetime.fromisoformat(data["created_at"])
            if data.get("created_at")
            else datetime.utcnow()
        )
        job.started_at = (
            datetime.fromisoformat(data["started_at"])
            if data.get("started_at")
            else None
        )
        job.completed_at = (
            datetime.fromisoformat(data["completed_at"])
            if data.get("completed_at")
            else None
        )
        job.artifacts = data.get("artifacts", [])
        job.logs = data.get("logs", [])
        job.error = data.get("error")
        job.results = data.get("results", [])
        return job


# ---------------------------------------------------------------------------
# Redis helper
# ---------------------------------------------------------------------------

async def _try_connect_redis(redis_url: str):
    """
    Attempt to create and verify a redis.asyncio connection.
    Returns the Redis client on success, or None on failure.
    """
    try:
        import redis.asyncio as aioredis
        client = aioredis.from_url(redis_url, decode_responses=True)
        await client.ping()
        logger.info("Redis connection established for job queue at %s", redis_url)
        return client
    except ImportError:
        logger.warning(
            "redis package not installed — falling back to in-memory queue. "
            "Install with: pip install redis"
        )
        return None
    except Exception as exc:
        logger.warning(
            "Could not connect to Redis at %s (%s) — falling back to in-memory queue",
            redis_url,
            exc,
        )
        return None


# ---------------------------------------------------------------------------
# In-memory queue backend
# ---------------------------------------------------------------------------

class InMemoryQueueBackend:
    """Original asyncio.Queue-based backend (always available)."""

    def __init__(self):
        self.jobs: Dict[str, TestJob] = {}
        self.queue: asyncio.Queue = asyncio.Queue()

    async def save_job(self, job: TestJob) -> None:
        self.jobs[job.job_id] = job

    async def enqueue(self, job_id: str) -> None:
        job = self.jobs.get(job_id)
        if job:
            await self.queue.put(job)

    async def dequeue(self, timeout: float = 1.0) -> Optional[TestJob]:
        try:
            return await asyncio.wait_for(self.queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    async def task_done(self) -> None:
        self.queue.task_done()

    async def update_job(self, job: TestJob) -> None:
        self.jobs[job.job_id] = job

    async def get_job(self, job_id: str) -> Optional[TestJob]:
        return self.jobs.get(job_id)

    async def restore_pending_jobs(self) -> List[TestJob]:
        """In-memory backend has nothing to restore on startup."""
        return []

    async def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Redis queue backend
# ---------------------------------------------------------------------------

class RedisQueueBackend:
    """
    Redis-backed queue backend.

    Jobs are stored as JSON in the ``flowstral:jobs`` hash (keyed by job_id).
    The FIFO queue is a Redis list ``flowstral:queue`` with job_ids pushed
    to the right and popped from the left.
    """

    def __init__(self, redis_client):
        self._redis = redis_client
        # Local cache so we can avoid round-trips for hot reads during
        # worker processing.  Authoritative data is always in Redis.
        self._local_cache: Dict[str, TestJob] = {}

    async def save_job(self, job: TestJob) -> None:
        """Persist the job to Redis and local cache."""
        self._local_cache[job.job_id] = job
        await self._redis.hset(
            REDIS_JOBS_HASH, job.job_id, json.dumps(job.to_dict())
        )

    async def enqueue(self, job_id: str) -> None:
        """Push the job_id onto the Redis queue list."""
        await self._redis.rpush(REDIS_QUEUE_LIST, job_id)

    async def dequeue(self, timeout: float = 1.0) -> Optional[TestJob]:
        """
        Blocking-pop from the Redis queue with *timeout* seconds.
        Returns the hydrated TestJob or None if the queue is empty.
        """
        result = await self._redis.blpop(REDIS_QUEUE_LIST, timeout=int(max(timeout, 1)))
        if result is None:
            return None
        # blpop returns (key, value)
        _, job_id = result
        return await self.get_job(job_id)

    async def task_done(self) -> None:
        # Redis list pops are atomic; nothing extra needed.
        pass

    async def update_job(self, job: TestJob) -> None:
        """Write updated job state back to Redis."""
        self._local_cache[job.job_id] = job
        await self._redis.hset(
            REDIS_JOBS_HASH, job.job_id, json.dumps(job.to_dict())
        )

    async def get_job(self, job_id: str) -> Optional[TestJob]:
        """Load job from local cache first, then Redis."""
        if job_id in self._local_cache:
            return self._local_cache[job_id]
        raw = await self._redis.hget(REDIS_JOBS_HASH, job_id)
        if raw is None:
            return None
        job = TestJob.from_dict(json.loads(raw))
        self._local_cache[job_id] = job
        return job

    async def restore_pending_jobs(self) -> List[TestJob]:
        """
        On startup, scan the jobs hash for any jobs that were QUEUED or
        RUNNING (interrupted) and re-enqueue them so they get retried.
        """
        restored: List[TestJob] = []
        try:
            all_jobs = await self._redis.hgetall(REDIS_JOBS_HASH)
            for job_id, raw in all_jobs.items():
                data = json.loads(raw)
                status = data.get("status", "")
                if status in (JobStatus.QUEUED.value, JobStatus.RUNNING.value):
                    # Reset running jobs back to queued
                    data["status"] = JobStatus.QUEUED.value
                    data["started_at"] = None
                    job = TestJob.from_dict(data)
                    self._local_cache[job_id] = job
                    await self._redis.hset(
                        REDIS_JOBS_HASH, job_id, json.dumps(job.to_dict())
                    )
                    await self._redis.rpush(REDIS_QUEUE_LIST, job_id)
                    restored.append(job)
                    logger.info("Restored pending job %s from Redis", job_id)
        except Exception as exc:
            logger.error("Error restoring pending jobs from Redis: %s", exc)
        return restored

    async def close(self) -> None:
        """Gracefully close the Redis connection."""
        try:
            await self._redis.aclose()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Unified TestExecutorQueue
# ---------------------------------------------------------------------------

class TestExecutorQueue:
    """
    Job queue for test execution.

    On construction the queue checks for a ``REDIS_URL`` environment variable.
    If present (and the ``redis`` package is installed and the server is
    reachable) a :class:`RedisQueueBackend` is used.  Otherwise the queue
    falls back to the original :class:`InMemoryQueueBackend`.

    The public API is identical regardless of which backend is active.
    """

    def __init__(self):
        self._backend: Optional[Any] = None
        self.workers: List[asyncio.Task] = []
        self.is_running = False
        self._initialized = False
        # Eagerly set a backend so callers that don't await _ensure_backend
        # still get the in-memory fallback.
        self._backend = InMemoryQueueBackend()

    async def _ensure_backend(self) -> None:
        """Lazily initialize the backend (Redis or in-memory)."""
        if self._initialized:
            return
        self._initialized = True

        redis_url = os.environ.get("REDIS_URL")
        if not redis_url:
            logger.info("REDIS_URL not set — using in-memory job queue")
            return  # already defaulted to InMemoryQueueBackend

        client = await _try_connect_redis(redis_url)
        if client is not None:
            self._backend = RedisQueueBackend(client)
            # Restore any pending jobs from a previous process
            restored = await self._backend.restore_pending_jobs()
            if restored:
                logger.info("Restored %d pending job(s) from Redis", len(restored))
        # else: keep the InMemoryQueueBackend that was set in __init__

    @property
    def backend_type(self) -> str:
        """Return a human-readable description of the active backend."""
        if isinstance(self._backend, RedisQueueBackend):
            return "redis"
        return "in-memory"

    async def push_job(
        self,
        test_cases: List[Dict[str, Any]],
        test_type: str,
        project_id: str,
        org_id: str,
        executor_type: str = "ui-runner",
    ) -> str:
        """Add a job to the queue."""
        await self._ensure_backend()

        job_id = f"job_{datetime.utcnow().timestamp()}"
        job = TestJob(
            job_id=job_id,
            test_cases=test_cases,
            test_type=test_type,
            project_id=project_id,
            org_id=org_id,
            executor_type=executor_type,
        )

        await self._backend.save_job(job)
        await self._backend.enqueue(job_id)
        logger.info("Job %s queued (backend=%s)", job_id, self.backend_type)
        return job_id

    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a job."""
        await self._ensure_backend()

        job = await self._backend.get_job(job_id)
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
            "error": job.error,
        }

    async def start_worker(self, executor_callback: Callable):
        """Start a worker to process jobs from the queue."""
        await self._ensure_backend()

        self.is_running = True
        logger.info("Queue worker started (backend=%s)", self.backend_type)

        while self.is_running:
            try:
                job = await self._backend.dequeue(timeout=1.0)
                if job is None:
                    continue

                job.status = JobStatus.RUNNING
                job.started_at = datetime.utcnow()
                await self._backend.update_job(job)

                logger.info("Processing job %s", job.job_id)

                try:
                    result = await executor_callback(job)
                    job.results = result.get("results", [])
                    job.artifacts = result.get("artifacts", [])
                    job.logs.extend(result.get("logs", []))
                    job.status = JobStatus.COMPLETED
                except Exception as e:
                    logger.error("Job %s failed: %s", job.job_id, e)
                    job.status = JobStatus.FAILED
                    job.error = str(e)
                finally:
                    job.completed_at = datetime.utcnow()
                    await self._backend.update_job(job)
                    await self._backend.task_done()

            except asyncio.CancelledError:
                logger.info("Queue worker cancelled")
                break
            except Exception as e:
                logger.error("Worker error: %s", e)

    def stop_workers(self):
        """Stop all workers."""
        self.is_running = False

    async def close(self):
        """Shutdown the queue and release backend resources."""
        self.stop_workers()
        if self._backend:
            await self._backend.close()


# ---------------------------------------------------------------------------
# Global singleton
# ---------------------------------------------------------------------------

_executor_queue: Optional[TestExecutorQueue] = None


def get_executor_queue() -> TestExecutorQueue:
    """Get or create executor queue instance."""
    global _executor_queue
    if _executor_queue is None:
        _executor_queue = TestExecutorQueue()
    return _executor_queue
