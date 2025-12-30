"""
Test Scheduler - Cron-based test scheduling
Supports recurring tests, scheduled runs, and CI/CD integration
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import croniter

logger = logging.getLogger(__name__)


class ScheduleType(Enum):
    """Types of schedules"""
    ONCE = "once"  # Run once at specific time
    RECURRING = "recurring"  # Cron-based recurring
    INTERVAL = "interval"  # Run every X minutes/hours/days


@dataclass
class ScheduledTest:
    """Scheduled test configuration"""
    schedule_id: str
    name: str
    schedule_type: ScheduleType
    scenario_id: str
    test_config: Dict[str, Any]  # Test parameters
    
    # For ONCE type
    run_at: Optional[datetime] = None
    
    # For RECURRING type
    cron_expression: Optional[str] = None  # e.g., "0 2 * * *" (daily at 2 AM)
    
    # For INTERVAL type
    interval_seconds: Optional[int] = None
    
    enabled: bool = True
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    max_runs: Optional[int] = None  # Stop after N runs
    
    # Callback when test should run
    on_run: Optional[Callable] = None


class TestScheduler:
    """
    Test Scheduler
    Manages scheduled and recurring performance tests
    """
    
    def __init__(self):
        self.schedules: Dict[str, ScheduledTest] = {}
        self.scheduler_task: Optional[asyncio.Task] = None
        self.is_running: bool = False
    
    async def start(self):
        """Start the scheduler"""
        if self.is_running:
            return
        
        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Test scheduler started")
    
    async def stop(self):
        """Stop the scheduler"""
        self.is_running = False
        
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Test scheduler stopped")
    
    async def _scheduler_loop(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                await self._check_schedules()
                await asyncio.sleep(60)  # Check every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler loop: {e}")
                await asyncio.sleep(60)
    
    async def _check_schedules(self):
        """Check all schedules and trigger tests if needed"""
        now = datetime.utcnow()
        
        for schedule in self.schedules.values():
            if not schedule.enabled:
                continue
            
            # Check if max runs reached
            if schedule.max_runs and schedule.run_count >= schedule.max_runs:
                continue
            
            should_run = False
            
            if schedule.schedule_type == ScheduleType.ONCE:
                if schedule.run_at and now >= schedule.run_at and schedule.last_run is None:
                    should_run = True
            
            elif schedule.schedule_type == ScheduleType.RECURRING:
                if schedule.cron_expression:
                    if schedule.next_run is None:
                        # Calculate next run
                        cron = croniter.croniter(schedule.cron_expression, now)
                        schedule.next_run = cron.get_next(datetime)
                    
                    if schedule.next_run and now >= schedule.next_run:
                        should_run = True
            
            elif schedule.schedule_type == ScheduleType.INTERVAL:
                if schedule.interval_seconds:
                    if schedule.last_run is None:
                        should_run = True
                    else:
                        next_run = schedule.last_run + timedelta(seconds=schedule.interval_seconds)
                        if now >= next_run:
                            should_run = True
                        schedule.next_run = next_run
            
            if should_run:
                await self._run_scheduled_test(schedule)
    
    async def _run_scheduled_test(self, schedule: ScheduledTest):
        """Execute a scheduled test"""
        logger.info(f"Running scheduled test: {schedule.name} ({schedule.schedule_id})")
        
        schedule.last_run = datetime.utcnow()
        schedule.run_count += 1
        
        # Calculate next run for recurring schedules
        if schedule.schedule_type == ScheduleType.RECURRING and schedule.cron_expression:
            cron = croniter.croniter(schedule.cron_expression, schedule.last_run)
            schedule.next_run = cron.get_next(datetime)
        
        # Call the callback
        if schedule.on_run:
            try:
                if asyncio.iscoroutinefunction(schedule.on_run):
                    await schedule.on_run(schedule.schedule_id, schedule.test_config)
                else:
                    schedule.on_run(schedule.schedule_id, schedule.test_config)
            except Exception as e:
                logger.error(f"Error executing scheduled test {schedule.schedule_id}: {e}")
    
    def create_schedule(
        self,
        schedule_id: str,
        name: str,
        scenario_id: str,
        test_config: Dict[str, Any],
        schedule_type: ScheduleType,
        run_at: Optional[datetime] = None,
        cron_expression: Optional[str] = None,
        interval_seconds: Optional[int] = None,
        max_runs: Optional[int] = None,
        on_run: Optional[Callable] = None
    ) -> ScheduledTest:
        """Create a new scheduled test"""
        schedule = ScheduledTest(
            schedule_id=schedule_id,
            name=name,
            schedule_type=schedule_type,
            scenario_id=scenario_id,
            test_config=test_config,
            run_at=run_at,
            cron_expression=cron_expression,
            interval_seconds=interval_seconds,
            max_runs=max_runs,
            on_run=on_run
        )
        
        # Calculate initial next_run
        if schedule_type == ScheduleType.ONCE:
            schedule.next_run = run_at
        elif schedule_type == ScheduleType.RECURRING and cron_expression:
            cron = croniter.croniter(cron_expression, datetime.utcnow())
            schedule.next_run = cron.get_next(datetime)
        elif schedule_type == ScheduleType.INTERVAL and interval_seconds:
            schedule.next_run = datetime.utcnow() + timedelta(seconds=interval_seconds)
        
        self.schedules[schedule_id] = schedule
        logger.info(f"Created schedule: {name} ({schedule_id})")
        
        return schedule
    
    def enable_schedule(self, schedule_id: str):
        """Enable a schedule"""
        if schedule_id in self.schedules:
            self.schedules[schedule_id].enabled = True
            logger.info(f"Enabled schedule: {schedule_id}")
    
    def disable_schedule(self, schedule_id: str):
        """Disable a schedule"""
        if schedule_id in self.schedules:
            self.schedules[schedule_id].enabled = False
            logger.info(f"Disabled schedule: {schedule_id}")
    
    def delete_schedule(self, schedule_id: str):
        """Delete a schedule"""
        if schedule_id in self.schedules:
            del self.schedules[schedule_id]
            logger.info(f"Deleted schedule: {schedule_id}")
    
    def get_schedule(self, schedule_id: str) -> Optional[ScheduledTest]:
        """Get schedule by ID"""
        return self.schedules.get(schedule_id)
    
    def list_schedules(self) -> List[Dict[str, Any]]:
        """List all schedules"""
        return [
            {
                "schedule_id": s.schedule_id,
                "name": s.name,
                "schedule_type": s.schedule_type.value,
                "scenario_id": s.scenario_id,
                "enabled": s.enabled,
                "last_run": s.last_run.isoformat() if s.last_run else None,
                "next_run": s.next_run.isoformat() if s.next_run else None,
                "run_count": s.run_count,
                "max_runs": s.max_runs
            }
            for s in self.schedules.values()
        ]




