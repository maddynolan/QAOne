"""
Smart Scheduling Service
Manages automated test runs using cron-like scheduling.
Can be integrated with Celery Beat or run as a standalone service.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from croniter import croniter
import json

from app.services.core.test_plan_service import get_test_plan_service
from app.services.automation.test_execution_service import get_test_execution_service
from app.services.storage.postgres_direct import get_postgres_pool

logger = logging.getLogger(__name__)


class SchedulerService:
    """
    Service for scheduling automated test runs.
    Supports cron-like scheduling expressions.
    """
    
    def __init__(self):
        self.is_running = False
        self.scheduled_tasks = {}
    
    async def create_schedule(
        self,
        test_plan_id: str,
        cron_expression: str,
        name: Optional[str] = None,
        environment: str = "staging",
        enabled: bool = True
    ) -> Dict[str, Any]:
        """
        Create a scheduled test run.
        
        Args:
            test_plan_id: Test plan ID to run
            cron_expression: Cron expression (e.g., "0 2 * * *" for daily at 2 AM)
            name: Schedule name
            environment: Environment to run in
            enabled: Whether schedule is enabled
            
        Returns:
            Created schedule dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        # Validate cron expression
        try:
            croniter(cron_expression)
        except Exception as e:
            raise Exception(f"Invalid cron expression: {e}")
        
        schedule_id = str(datetime.now().timestamp())
        
        schedule = {
            "schedule_id": schedule_id,
            "test_plan_id": test_plan_id,
            "cron_expression": cron_expression,
            "name": name or f"Schedule for plan {test_plan_id}",
            "environment": environment,
            "enabled": enabled,
            "created_at": datetime.utcnow().isoformat(),
            "next_run": self._calculate_next_run(cron_expression)
        }
        
        # Store in database (simplified - in production, use a schedules table)
        self.scheduled_tasks[schedule_id] = schedule
        
        logger.info(f"Created schedule {schedule_id}: {cron_expression} for plan {test_plan_id}")
        
        return schedule
    
    def _calculate_next_run(self, cron_expression: str) -> str:
        """Calculate next run time from cron expression"""
        cron = croniter(cron_expression, datetime.utcnow())
        next_run = cron.get_next(datetime)
        return next_run.isoformat()
    
    async def trigger_scheduled_run(
        self,
        schedule_id: str
    ) -> Dict[str, Any]:
        """
        Trigger a scheduled test run.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Test run result
        """
        schedule = self.scheduled_tasks.get(schedule_id)
        if not schedule:
            raise Exception(f"Schedule {schedule_id} not found")
        
        if not schedule.get("enabled"):
            logger.info(f"Schedule {schedule_id} is disabled, skipping")
            return {"status": "skipped", "reason": "disabled"}
        
        test_plan_id = schedule["test_plan_id"]
        environment = schedule["environment"]
        
        logger.info(f"Triggering scheduled run for plan {test_plan_id}")
        
        try:
            test_execution_service = get_test_execution_service()
            
            # Create test run
            test_run = await test_execution_service.create_test_run(
                test_plan_id=test_plan_id,
                name=f"Scheduled: {schedule.get('name', 'Automated Run')}",
                environment=environment,
                triggered_by="scheduler",
                metadata={
                    "schedule_id": schedule_id,
                    "cron_expression": schedule["cron_expression"]
                }
            )
            
            # Execute test run
            execution_result = await test_execution_service.execute_test_run(
                test_run_id=test_run.get("test_run_id")
            )
            
            # Update next run time
            schedule["next_run"] = self._calculate_next_run(schedule["cron_expression"])
            schedule["last_run"] = datetime.utcnow().isoformat()
            schedule["last_run_status"] = execution_result.get("status", "unknown")
            
            return {
                "status": "success",
                "test_run_id": test_run.get("test_run_id"),
                "execution_result": execution_result
            }
        
        except Exception as e:
            logger.error(f"Failed to trigger scheduled run {schedule_id}: {e}")
            schedule["last_run"] = datetime.utcnow().isoformat()
            schedule["last_run_status"] = "error"
            schedule["last_run_error"] = str(e)
            
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def check_and_trigger_schedules(self):
        """
        Check all schedules and trigger any that are due.
        This should be called periodically (e.g., every minute).
        """
        now = datetime.utcnow()
        
        for schedule_id, schedule in self.scheduled_tasks.items():
            if not schedule.get("enabled"):
                continue
            
            next_run_str = schedule.get("next_run")
            if not next_run_str:
                continue
            
            try:
                next_run = datetime.fromisoformat(next_run_str.replace('Z', '+00:00'))
                if next_run <= now:
                    logger.info(f"Schedule {schedule_id} is due, triggering run")
                    await self.trigger_scheduled_run(schedule_id)
            except Exception as e:
                logger.error(f"Error checking schedule {schedule_id}: {e}")
    
    async def start_scheduler(self):
        """Start the scheduler loop"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
        
        self.is_running = True
        logger.info("Scheduler started")
        
        while self.is_running:
            try:
                await self.check_and_trigger_schedules()
                # Check every minute
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(60)
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        self.is_running = False
        logger.info("Scheduler stopped")
    
    async def list_schedules(
        self,
        test_plan_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all schedules"""
        schedules = list(self.scheduled_tasks.values())
        
        if test_plan_id:
            schedules = [s for s in schedules if s.get("test_plan_id") == test_plan_id]
        
        return schedules


# Global instance
_scheduler_service = None

def get_scheduler_service() -> SchedulerService:
    """Get or create global SchedulerService instance"""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = SchedulerService()
    return _scheduler_service

