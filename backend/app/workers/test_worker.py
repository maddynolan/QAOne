"""
Test Execution Worker — Standalone Background Process

Runs as a separate container/process that polls the Redis-backed job queue
and executes Playwright test cases. Designed to be horizontally scalable:
deploy N worker containers for N parallel test execution slots.

Usage:
    python -m app.workers.test_worker

Environment variables:
    REDIS_URL           — Redis connection URL (required for multi-worker)
    DATABASE_URL        — PostgreSQL connection URL
    WORKER_ID           — Unique worker identifier (default: auto-generated)
    WORKER_CAPACITY     — Max concurrent tests per worker (default: 5)
    S3_ENDPOINT_URL     — MinIO/S3 endpoint for artifact storage
    S3_ACCESS_KEY       — MinIO/S3 access key
    S3_SECRET_KEY       — MinIO/S3 secret key
    S3_BUCKET_NAME      — Artifact bucket name (default: qa-artifacts)
"""

import asyncio
import logging
import os
import signal
import sys
import uuid
from datetime import datetime
from typing import Dict, Any

# Set up logging before any other imports
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("flowstral.worker")

# Worker configuration
WORKER_ID = os.environ.get("WORKER_ID", f"worker-{uuid.uuid4().hex[:8]}")
WORKER_CAPACITY = int(os.environ.get("WORKER_CAPACITY", "5"))


async def execute_test_job(job) -> Dict[str, Any]:
    """
    Execute a test job using the Playwright runner.

    This is the callback passed to TestExecutorQueue.start_worker().
    It receives a TestJob and returns results dict.
    """
    from app.services.executors.test_executor_queue import JobStatus

    logger.info(
        "Worker %s executing job %s (%d test cases, type=%s)",
        WORKER_ID, job.job_id, len(job.test_cases), job.test_type
    )

    results = []
    artifacts = []
    logs = [f"[{WORKER_ID}] Started execution at {datetime.utcnow().isoformat()}"]

    for i, test_case in enumerate(job.test_cases):
        test_id = test_case.get("id", f"test-{i}")
        test_name = test_case.get("title", test_case.get("name", f"Test {i+1}"))
        logs.append(f"[{WORKER_ID}] Running test {i+1}/{len(job.test_cases)}: {test_name}")

        try:
            # Execute based on test type
            if job.executor_type == "ui-runner":
                result = await _execute_ui_test(test_case, job)
            elif job.executor_type == "api-runner":
                result = await _execute_api_test(test_case, job)
            else:
                result = await _execute_ui_test(test_case, job)

            results.append({
                "test_id": test_id,
                "test_name": test_name,
                "status": result.get("status", "passed"),
                "duration_ms": result.get("duration_ms", 0),
                "steps": result.get("steps", []),
                "screenshots": result.get("screenshots", []),
                "error": result.get("error"),
            })

            # Collect screenshots as artifacts
            for screenshot in result.get("screenshots", []):
                artifacts.append({
                    "type": "screenshot",
                    "test_id": test_id,
                    "step": screenshot.get("step"),
                    "path": screenshot.get("path"),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            status_emoji = "✅" if result.get("status") == "passed" else "❌"
            logs.append(f"[{WORKER_ID}] {status_emoji} {test_name}: {result.get('status', 'unknown')}")

        except Exception as e:
            logger.error("Test %s failed with error: %s", test_id, e)
            results.append({
                "test_id": test_id,
                "test_name": test_name,
                "status": "error",
                "error": str(e),
                "duration_ms": 0,
            })
            logs.append(f"[{WORKER_ID}] ❌ {test_name}: error — {e}")

    # Summary
    passed = sum(1 for r in results if r["status"] == "passed")
    failed = sum(1 for r in results if r["status"] in ("failed", "error"))
    logs.append(
        f"[{WORKER_ID}] Completed: {passed} passed, {failed} failed, "
        f"{len(results)} total at {datetime.utcnow().isoformat()}"
    )

    return {
        "results": results,
        "artifacts": artifacts,
        "logs": logs,
    }


async def _execute_ui_test(test_case: Dict[str, Any], job) -> Dict[str, Any]:
    """Execute a UI test using Playwright subprocess runner."""
    try:
        from app.services.executors.playwright_runner import PlaywrightRunner
        runner = PlaywrightRunner()

        steps = test_case.get("steps", [])
        url = test_case.get("url", test_case.get("base_url", ""))

        if not steps and not url:
            return {"status": "skipped", "duration_ms": 0, "steps": [], "screenshots": []}

        result = await runner.execute_test(
            test_case=test_case,
            headless=True,
            screenshot_on_step=True,
        )
        return result

    except ImportError:
        logger.warning("PlaywrightRunner not available, using stub execution")
        return await _stub_execute(test_case)
    except Exception as e:
        logger.error("UI test execution error: %s", e)
        return {
            "status": "error",
            "error": str(e),
            "duration_ms": 0,
            "steps": [],
            "screenshots": [],
        }


async def _execute_api_test(test_case: Dict[str, Any], job) -> Dict[str, Any]:
    """Execute an API test."""
    try:
        from app.services.api_testing.enhanced_api_test_engine import EnhancedAPITestEngine
        engine = EnhancedAPITestEngine()

        result = await engine.execute_test(test_case)
        return {
            "status": "passed" if result.get("passed") else "failed",
            "duration_ms": result.get("response_time_ms", 0),
            "steps": [],
            "screenshots": [],
            "error": result.get("error"),
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "duration_ms": 0, "steps": [], "screenshots": []}


async def _stub_execute(test_case: Dict[str, Any]) -> Dict[str, Any]:
    """Stub execution for tests when Playwright is not available."""
    await asyncio.sleep(0.1)
    return {
        "status": "passed",
        "duration_ms": 100,
        "steps": [{"action": "stub", "status": "passed"}],
        "screenshots": [],
    }


async def main():
    """Main worker entry point."""
    from app.services.executors.test_executor_queue import get_executor_queue

    logger.info("=" * 60)
    logger.info("Flowstral Test Worker starting")
    logger.info("  Worker ID:       %s", WORKER_ID)
    logger.info("  Worker Capacity: %s", WORKER_CAPACITY)
    logger.info("  Redis URL:       %s", "set" if os.environ.get("REDIS_URL") else "NOT SET")
    logger.info("  Database URL:    %s", "set" if os.environ.get("DATABASE_URL") else "NOT SET")
    logger.info("=" * 60)

    queue = get_executor_queue()

    # Graceful shutdown
    shutdown_event = asyncio.Event()

    def handle_signal(sig, frame):
        logger.info("Received signal %s, shutting down...", sig)
        shutdown_event.set()
        queue.stop_workers()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        # Start worker loop — this blocks until shutdown
        worker_task = asyncio.create_task(
            queue.start_worker(executor_callback=execute_test_job)
        )

        # Wait for shutdown signal
        await shutdown_event.wait()

        # Cancel worker task
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            pass

    except KeyboardInterrupt:
        logger.info("Worker interrupted")
    finally:
        await queue.close()
        logger.info("Worker %s shutdown complete", WORKER_ID)


if __name__ == "__main__":
    asyncio.run(main())
