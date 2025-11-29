"""
Test Runner Service - Queue-based test execution with Docker workers
Phase 2.3: Test Runner Service
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json
import time

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)

logger = logging.getLogger(__name__)


class TestRunnerService:
    """
    Service for managing test execution jobs:
    - Queue-based execution
    - Docker worker management
    - Multi-browser support
    - Artifact collection
    """
    
    def __init__(self):
        # Queue system (Redis/Celery would be used in production)
        # For now, we'll use an in-memory queue
        self._queue: asyncio.Queue = asyncio.Queue()
        self._workers: List[Dict[str, Any]] = []
        self._jobs: Dict[str, Dict[str, Any]] = {}
    
    async def submit_job(
        self,
        test_case_ids: List[str],
        browser: str = "chromium",
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Submit a test execution job"""
        job_id = str(uuid4())
        
        job = {
            "job_id": job_id,
            "test_case_ids": test_case_ids,
            "browser": browser,
            "project_id": project_id,
            "tenant_id": tenant_id,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        # Store job
        self._jobs[job_id] = job
        
        # Add to queue
        await self._queue.put(job)
        
        # Store in database
        await self._store_job(job)
        
        return {
            "status": "submitted",
            "job_id": job_id,
            "test_count": len(test_case_ids)
        }
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of a test job"""
        # Check in-memory first
        if job_id in self._jobs:
            return self._jobs[job_id]
        
        # Check database
        job = await self._get_job(job_id)
        if job:
            return job
        
        raise ValueError(f"Job {job_id} not found")
    
    async def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """Cancel a pending or running job"""
        job = await self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        if job.get("status") in ["completed", "failed", "cancelled"]:
            return {
                "status": "error",
                "message": f"Job is already {job.get('status')}"
            }
        
        # Update job status
        job["status"] = "cancelled"
        job["cancelled_at"] = datetime.utcnow().isoformat()
        
        await self._update_job(job)
        
        return {
            "status": "cancelled",
            "job_id": job_id
        }
    
    async def list_jobs(
        self,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List test jobs"""
        return await self._list_jobs(project_id, tenant_id, status, limit)
    
    async def get_job_artifacts(self, job_id: str) -> Dict[str, Any]:
        """Get artifacts (screenshots, logs, videos) for a job"""
        job = await self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")
        
        # Get artifacts from object store
        artifacts = await self._get_artifacts(job_id)
        
        return {
            "job_id": job_id,
            "artifacts": artifacts
        }
    
    # ==================== Worker Management ====================
    
    async def start_worker(self, worker_id: str, capacity: int = 5) -> Dict[str, Any]:
        """Start a test execution worker"""
        worker = {
            "worker_id": worker_id,
            "capacity": capacity,
            "active_jobs": 0,
            "status": "running",
            "started_at": datetime.utcnow().isoformat()
        }
        
        self._workers.append(worker)
        
        # Start worker loop
        asyncio.create_task(self._worker_loop(worker_id))
        
        return {
            "status": "started",
            "worker_id": worker_id
        }
    
    async def _worker_loop(self, worker_id: str):
        """Worker execution loop"""
        worker = next((w for w in self._workers if w["worker_id"] == worker_id), None)
        if not worker:
            return
        
        while worker["status"] == "running":
            try:
                # Get job from queue (with timeout)
                job = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                
                if job.get("status") == "cancelled":
                    continue
                
                # Check capacity
                if worker["active_jobs"] >= worker["capacity"]:
                    await self._queue.put(job)  # Put back
                    await asyncio.sleep(1)
                    continue
                
                # Execute job
                worker["active_jobs"] += 1
                asyncio.create_task(self._execute_job(job, worker_id))
            
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker {worker_id} error: {e}", exc_info=True)
                await asyncio.sleep(1)
    
    async def _execute_job(self, job: Dict[str, Any], worker_id: str):
        """Execute a test job"""
        job_id = job["job_id"]
        
        try:
            # Update job status
            job["status"] = "running"
            job["worker_id"] = worker_id
            job["started_at"] = datetime.utcnow().isoformat()
            await self._update_job(job)
            
            # Execute tests
            results = []
            for test_case_id in job["test_case_ids"]:
                result = await self._execute_test_case(
                    test_case_id,
                    job["browser"],
                    job_id,
                    job.get("tenant_id")
                )
                results.append(result)
            
            # Update job status
            job["status"] = "completed"
            job["completed_at"] = datetime.utcnow().isoformat()
            job["results"] = results
            
            # Calculate summary
            passed = sum(1 for r in results if r.get("status") == "passed")
            failed = sum(1 for r in results if r.get("status") == "failed")
            
            job["summary"] = {
                "total": len(results),
                "passed": passed,
                "failed": failed,
                "duration_ms": sum(r.get("duration_ms", 0) for r in results)
            }
            
            await self._update_job(job)
        
        except Exception as e:
            logger.error(f"Job {job_id} execution failed: {e}", exc_info=True)
            job["status"] = "failed"
            job["error"] = str(e)
            job["completed_at"] = datetime.utcnow().isoformat()
            await self._update_job(job)
        
        finally:
            # Release worker capacity
            worker = next((w for w in self._workers if w["worker_id"] == worker_id), None)
            if worker:
                worker["active_jobs"] = max(0, worker["active_jobs"] - 1)
    
    async def _execute_test_case(
        self,
        test_case_id: str,
        browser: str,
        job_id: str,
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Execute a single test case"""
        # Get test case
        test_case = await self._get_test_case(test_case_id)
        if not test_case:
            return {
                "test_case_id": test_case_id,
                "status": "failed",
                "error": "Test case not found"
            }
        
        # Execute using Playwright runner
        # In production, this would run in a Docker container
        from app.services.executors.playwright_runner import PlaywrightRunner, TestCase, TestStep
        
        runner = PlaywrightRunner()
        
        # Convert test case to Playwright format
        playwright_test = TestCase(
            case_id=test_case_id,
            title=test_case.get("title", ""),
            description=test_case.get("description", ""),
            steps=[
                TestStep(
                    action=step.get("action", ""),
                    data=step.get("data", {}),
                    expected=step.get("expected", "")
                )
                for step in test_case.get("steps", [])
            ]
        )
        
        try:
            result = await runner.run_test(
                test_case=playwright_test,
                browser=browser,
                headless=True
            )
            
            return {
                "test_case_id": test_case_id,
                "status": "passed" if result.status == "passed" else "failed",
                "duration_ms": result.duration,
                "error": result.error,
                "screenshots": result.screenshots,
                "logs": result.logs
            }
        
        except Exception as e:
            logger.error(f"Test case {test_case_id} execution failed: {e}", exc_info=True)
            return {
                "test_case_id": test_case_id,
                "status": "failed",
                "error": str(e),
                "duration_ms": 0
            }
    
    # ==================== Database Methods ====================
    
    async def _store_job(self, job: Dict[str, Any]):
        """Store job in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_job_sync,
                pool,
                job
            )
    
    def _store_job_sync(self, pool, job: Dict[str, Any]):
        """Synchronous job insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO test_jobs
                    (id, project_id, test_case_ids, browser, status, metadata, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        job["job_id"],
                        job.get("project_id"),
                        json.dumps(job["test_case_ids"]),
                        job["browser"],
                        job["status"],
                        json.dumps(job.get("metadata", {})),
                        job.get("tenant_id"),
                        job["created_at"]
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_job_sync,
                pool,
                job_id
            )
        return result
    
    def _get_job_sync(self, pool, job_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous job query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM test_jobs WHERE id = %s",
                    (job_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("test_case_ids"):
                    result["test_case_ids"] = json.loads(result["test_case_ids"]) if isinstance(result["test_case_ids"], str) else result["test_case_ids"]
                
                if result.get("metadata"):
                    result["metadata"] = json.loads(result["metadata"]) if isinstance(result["metadata"], str) else result["metadata"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _update_job(self, job: Dict[str, Any]):
        """Update job in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._update_job_sync,
                pool,
                job
            )
    
    def _update_job_sync(self, pool, job: Dict[str, Any]):
        """Synchronous job update"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE test_jobs
                    SET status = %s,
                        worker_id = %s,
                        started_at = %s,
                        completed_at = %s,
                        results = %s,
                        summary = %s,
                        error = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        job.get("status"),
                        job.get("worker_id"),
                        job.get("started_at"),
                        job.get("completed_at"),
                        json.dumps(job.get("results", [])) if job.get("results") else None,
                        json.dumps(job.get("summary", {})) if job.get("summary") else None,
                        job.get("error"),
                        job["job_id"]
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _list_jobs(
        self,
        project_id: Optional[str],
        tenant_id: Optional[str],
        status: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """List jobs from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._list_jobs_sync,
                pool,
                project_id,
                tenant_id,
                status,
                limit
            )
        return results
    
    def _list_jobs_sync(
        self,
        pool,
        project_id: Optional[str],
        tenant_id: Optional[str],
        status: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Synchronous jobs list query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT * FROM test_jobs WHERE 1=1"
                params = []
                
                if project_id:
                    query += " AND project_id = %s"
                    params.append(project_id)
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                if status:
                    query += " AND status = %s"
                    params.append(status)
                
                query += " ORDER BY created_at DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                results = []
                
                for row in cur.fetchall():
                    result = dict(zip(columns, row))
                    if result.get("test_case_ids"):
                        result["test_case_ids"] = json.loads(result["test_case_ids"]) if isinstance(result["test_case_ids"], str) else result["test_case_ids"]
                    if result.get("metadata"):
                        result["metadata"] = json.loads(result["metadata"]) if isinstance(result["metadata"], str) else result["metadata"]
                    results.append(result)
                
                return results
        finally:
            pool.putconn(conn)
    
    async def _get_test_case(self, test_case_id: str) -> Optional[Dict[str, Any]]:
        """Get test case from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_test_case_sync,
                pool,
                test_case_id
            )
        return result
    
    def _get_test_case_sync(self, pool, test_case_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous test case query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM test_cases WHERE id = %s",
                    (test_case_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("steps"):
                    result["steps"] = json.loads(result["steps"]) if isinstance(result["steps"], str) else result["steps"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _get_artifacts(self, job_id: str) -> Dict[str, Any]:
        """Get artifacts from object store"""
        # In production, this would fetch from S3/MinIO
        # For now, return empty structure
        return {
            "screenshots": [],
            "videos": [],
            "logs": []
        }


# Agent handler function
async def test_runner_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Test Runner Agent tasks"""
    start_time = time.time()
    
    service = TestRunnerService()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "submit":
            result = await service.submit_job(
                test_case_ids=request.input_data.get("test_case_ids", []),
                browser=request.input_data.get("browser", "chromium"),
                project_id=request.project_id,
                tenant_id=request.tenant_id,
                metadata=request.input_data.get("metadata")
            )
        
        elif operation == "status":
            result = await service.get_job_status(
                job_id=request.input_data.get("job_id")
            )
        
        elif operation == "cancel":
            result = await service.cancel_job(
                job_id=request.input_data.get("job_id")
            )
        
        elif operation == "list":
            result = await service.list_jobs(
                project_id=request.project_id,
                tenant_id=request.tenant_id,
                status=request.input_data.get("status"),
                limit=request.input_data.get("limit", 50)
            )
        
        elif operation == "artifacts":
            result = await service.get_job_artifacts(
                job_id=request.input_data.get("job_id")
            )
        
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.COMPLETED,
            output_data=result,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )
    
    except Exception as e:
        logger.error(f"Test runner agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

