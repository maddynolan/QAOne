from celery import Celery
from app.core.config import celery_app, settings
from app.services.test_plan_service import TestPlanService
from app.services.suite_service import SuiteService
from app.services.run_service import RunService
from app.services.triage_service import TriageService
from app.services.patch_service import PatchService
from sqlalchemy.orm import Session
from app.core.config import SessionLocal
import logging
import uuid
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Initialize services
test_plan_service = TestPlanService()
suite_service = SuiteService()
run_service = RunService()
triage_service = TriageService()
patch_service = PatchService()

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def create_test_plan_task(self, plan_data: Dict[str, Any]):
    """Celery task for creating test plans with retry logic"""
    try:
        db = SessionLocal()
        try:
            # Add run_id to context for tracing
            run_id = str(uuid.uuid4())
            logger.info(f"Starting test plan creation task {run_id}")
            
            # Create plan
            plan = test_plan_service.create_plan(db, plan_data)
            
            logger.info(f"Successfully created test plan {plan.plan_id}")
            return {
                "success": True,
                "plan_id": plan.plan_id,
                "run_id": run_id
            }
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Test plan creation failed: {str(exc)}")
        
        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            retry_delay = settings.job_retry_delay * (settings.job_backoff_factor ** self.request.retries)
            logger.info(f"Retrying test plan creation in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            logger.error(f"Test plan creation failed after {self.max_retries} retries")
            return {
                "success": False,
                "error": str(exc),
                "run_id": run_id if 'run_id' in locals() else None
            }

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def create_test_suite_task(self, suite_data: Dict[str, Any]):
    """Celery task for creating test suites"""
    try:
        db = SessionLocal()
        try:
            run_id = str(uuid.uuid4())
            logger.info(f"Starting test suite creation task {run_id}")
            
            suite = suite_service.create_suite(db, suite_data)
            
            logger.info(f"Successfully created test suite {suite.suite_id}")
            return {
                "success": True,
                "suite_id": suite.suite_id,
                "run_id": run_id
            }
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Test suite creation failed: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = settings.job_retry_delay * (settings.job_backoff_factor ** self.request.retries)
            logger.info(f"Retrying test suite creation in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            logger.error(f"Test suite creation failed after {self.max_retries} retries")
            return {
                "success": False,
                "error": str(exc),
                "run_id": run_id if 'run_id' in locals() else None
            }

@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def execute_test_run_task(self, run_data: Dict[str, Any]):
    """Celery task for executing test runs with timeout handling"""
    try:
        db = SessionLocal()
        try:
            run_id = str(uuid.uuid4())
            logger.info(f"Starting test execution task {run_id}")
            
            # Execute tests
            run = run_service.create_and_execute_run(db, run_data)
            
            logger.info(f"Successfully executed test run {run.run_id}")
            return {
                "success": True,
                "run_id": run.run_id,
                "task_run_id": run_id
            }
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Test execution failed: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = settings.job_retry_delay * (settings.job_backoff_factor ** self.request.retries)
            logger.info(f"Retrying test execution in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            logger.error(f"Test execution failed after {self.max_retries} retries")
            return {
                "success": False,
                "error": str(exc),
                "task_run_id": run_id if 'run_id' in locals() else None
            }

@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def triage_failures_task(self, triage_data: Dict[str, Any]):
    """Celery task for triaging test failures"""
    try:
        db = SessionLocal()
        try:
            run_id = str(uuid.uuid4())
            logger.info(f"Starting triage task {run_id}")
            
            triage = triage_service.create_triage(db, triage_data)
            
            logger.info(f"Successfully completed triage {triage.id}")
            return {
                "success": True,
                "triage_id": str(triage.id),
                "run_id": run_id
            }
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Triage failed: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = settings.job_retry_delay * (settings.job_backoff_factor ** self.request.retries)
            logger.info(f"Retrying triage in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            logger.error(f"Triage failed after {self.max_retries} retries")
            return {
                "success": False,
                "error": str(exc),
                "run_id": run_id if 'run_id' in locals() else None
            }

@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def generate_patches_task(self, patch_data: Dict[str, Any]):
    """Celery task for generating test patches"""
    try:
        db = SessionLocal()
        try:
            run_id = str(uuid.uuid4())
            logger.info(f"Starting patch generation task {run_id}")
            
            patch = patch_service.create_patch(db, patch_data)
            
            logger.info(f"Successfully generated patches {patch.id}")
            return {
                "success": True,
                "patch_id": str(patch.id),
                "run_id": run_id
            }
            
        finally:
            db.close()
            
    except Exception as exc:
        logger.error(f"Patch generation failed: {str(exc)}")
        
        if self.request.retries < self.max_retries:
            retry_delay = settings.job_retry_delay * (settings.job_backoff_factor ** self.request.retries)
            logger.info(f"Retrying patch generation in {retry_delay} seconds")
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            logger.error(f"Patch generation failed after {self.max_retries} retries")
            return {
                "success": False,
                "error": str(exc),
                "run_id": run_id if 'run_id' in locals() else None
            }

# Dead letter queue handler
@celery_app.task
def handle_failed_task(task_id: str, error: str, traceback: str):
    """Handle tasks that have failed after all retries"""
    logger.error(f"Task {task_id} permanently failed: {error}")
    logger.error(f"Traceback: {traceback}")
    
    # TODO: Send alert to monitoring system
    # TODO: Store failure in database for analysis
    # TODO: Notify user of failure

# Task monitoring
@celery_app.task
def monitor_queue_health():
    """Monitor queue health and alert on issues"""
    try:
        from celery import current_app
        
        # Get queue statistics
        inspect = current_app.control.inspect()
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        
        total_active = sum(len(tasks) for tasks in active_tasks.values()) if active_tasks else 0
        total_scheduled = sum(len(tasks) for tasks in scheduled_tasks.values()) if scheduled_tasks else 0
        
        logger.info(f"Queue health: {total_active} active, {total_scheduled} scheduled")
        
        # Alert if queue is getting too deep
        if total_active > settings.max_concurrent_runs * 2:
            logger.warning(f"Queue depth high: {total_active} active tasks")
            # TODO: Send alert
        
        return {
            "active_tasks": total_active,
            "scheduled_tasks": total_scheduled,
            "healthy": total_active < settings.max_concurrent_runs * 2
        }
        
    except Exception as exc:
        logger.error(f"Queue health check failed: {str(exc)}")
        return {"error": str(exc)}
