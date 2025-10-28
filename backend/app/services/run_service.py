from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional, Dict, Any
import uuid
import json
import asyncio
from datetime import datetime, timedelta

from app.models.schemas import RunResultCreate, RunResultResponse, PaginatedResponse
from app.models.database import Run, Suite, Event
from app.services.suite_service import SuiteService
from app.runners.postman_runner import PostmanRunner
from app.runners.playwright_runner import PlaywrightRunner

class RunService:
    """Service for managing test runs"""
    
    def __init__(self):
        self.suite_service = SuiteService()
        self.postman_runner = PostmanRunner()
        self.playwright_runner = PlaywrightRunner()
    
    async def create_and_execute_run(self, db: Session, run_data: RunResultCreate) -> Run:
        """Create a new run and execute it"""
        try:
            # Verify suite exists
            suite = await self.suite_service.get_suite_by_id(db, str(run_data.suite_id))
            if not suite:
                raise ValueError(f"Suite with ID {run_data.suite_id} not found")
            
            # Generate unique run ID
            run_id = f"run-{uuid.uuid4().hex[:8]}"
            
            # Create run record
            run = Run(
                run_id=run_id,
                suite_id=run_data.suite_id,
                name=run_data.name,
                status="running",
                created_by="system"  # TODO: Get from auth context
            )
            
            db.add(run)
            db.commit()
            db.refresh(run)
            
            # Log event
            await self._log_event(db, "run_started", "run", run.id, {
                "run_id": run_id,
                "suite_id": str(run_data.suite_id)
            })
            
            # Execute tests asynchronously
            asyncio.create_task(self._execute_tests(db, run, suite))
            
            return run
            
        except Exception as e:
            db.rollback()
            raise e
    
    async def _execute_tests(self, db: Session, run: Run, suite: Suite):
        """Execute tests for a suite"""
        try:
            start_time = datetime.utcnow()
            
            # Update run status
            run.status = "running"
            run.started_at = start_time
            db.commit()
            
            # Execute based on test type
            if suite.test_type == "postman":
                result = await self.postman_runner.execute(suite.artifacts)
            elif suite.test_type == "playwright":
                result = await self.playwright_runner.execute(suite.artifacts)
            else:
                raise ValueError(f"Unsupported test type: {suite.test_type}")
            
            # Update run with results
            end_time = datetime.utcnow()
            duration = int((end_time - start_time).total_seconds())
            
            run.status = result["status"]
            run.pass_count = result["pass_count"]
            run.fail_count = result["fail_count"]
            run.skip_count = result["skip_count"]
            run.total_count = result["total_count"]
            run.duration_seconds = duration
            run.reports = result["reports"]
            run.logs = result["logs"]
            run.completed_at = end_time
            
            db.commit()
            
            # Log event
            await self._log_event(db, "run_completed", "run", run.id, {
                "run_id": run.run_id,
                "status": run.status,
                "duration": duration,
                "pass_count": run.pass_count,
                "fail_count": run.fail_count
            })
            
        except Exception as e:
            # Update run with error status
            run.status = "error"
            run.logs = str(e)
            run.completed_at = datetime.utcnow()
            db.commit()
            
            # Log event
            await self._log_event(db, "run_failed", "run", run.id, {
                "run_id": run.run_id,
                "error": str(e)
            })
    
    async def get_run_by_id(self, db: Session, run_id: str) -> Optional[Run]:
        """Get a run by its run_id"""
        return db.query(Run).filter(Run.run_id == run_id).first()
    
    async def get_runs(
        self, 
        db: Session, 
        page: int = 1, 
        size: int = 20, 
        suite_id: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> PaginatedResponse:
        """Get paginated list of runs"""
        query = db.query(Run)
        
        if suite_id:
            # Find suite by suite_id and filter runs
            suite = await self.suite_service.get_suite_by_id(db, suite_id)
            if suite:
                query = query.filter(Run.suite_id == suite.id)
        
        if status_filter:
            query = query.filter(Run.status == status_filter)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * size
        runs = query.order_by(desc(Run.started_at)).offset(offset).limit(size).all()
        
        # Calculate pagination info
        pages = (total + size - 1) // size
        has_next = page < pages
        has_prev = page > 1
        
        # Convert to response format
        items = [
            RunResultResponse(
                run_id=run.run_id,
                name=run.name,
                status=run.status,
                pass_count=run.pass_count,
                fail_count=run.fail_count,
                skip_count=run.skip_count,
                total_count=run.total_count,
                duration_seconds=run.duration_seconds,
                started_at=run.started_at,
                completed_at=run.completed_at
            ) for run in runs
        ]
        
        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
            has_next=has_next,
            has_prev=has_prev
        )
    
    async def get_reports(
        self, 
        db: Session, 
        suite_id: Optional[str] = None, 
        days: int = 30
    ) -> Dict[str, Any]:
        """Get test reports and metrics"""
        try:
            query = db.query(Run)
            
            if suite_id:
                suite = await self.suite_service.get_suite_by_id(db, suite_id)
                if suite:
                    query = query.filter(Run.suite_id == suite.id)
            
            # Filter by date range
            start_date = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Run.started_at >= start_date)
            
            runs = query.all()
            
            # Calculate metrics
            total_runs = len(runs)
            passed_runs = len([r for r in runs if r.status == "passed"])
            failed_runs = len([r for r in runs if r.status == "failed"])
            
            total_tests = sum(r.total_count for r in runs)
            passed_tests = sum(r.pass_count for r in runs)
            failed_tests = sum(r.fail_count for r in runs)
            
            # Calculate average duration
            completed_runs = [r for r in runs if r.duration_seconds is not None]
            avg_duration = sum(r.duration_seconds for r in completed_runs) / len(completed_runs) if completed_runs else 0
            
            # Calculate success rate
            success_rate = (passed_runs / total_runs * 100) if total_runs > 0 else 0
            
            return {
                "summary": {
                    "total_runs": total_runs,
                    "passed_runs": passed_runs,
                    "failed_runs": failed_runs,
                    "success_rate": round(success_rate, 2),
                    "avg_duration_seconds": round(avg_duration, 2)
                },
                "test_metrics": {
                    "total_tests": total_tests,
                    "passed_tests": passed_tests,
                    "failed_tests": failed_tests,
                    "test_success_rate": round((passed_tests / total_tests * 100) if total_tests > 0 else 0, 2)
                },
                "runs": [
                    {
                        "run_id": run.run_id,
                        "name": run.name,
                        "status": run.status,
                        "pass_count": run.pass_count,
                        "fail_count": run.fail_count,
                        "duration_seconds": run.duration_seconds,
                        "started_at": run.started_at.isoformat() if run.started_at else None,
                        "completed_at": run.completed_at.isoformat() if run.completed_at else None
                    } for run in runs
                ]
            }
            
        except Exception as e:
            raise e
    
    async def _log_event(
        self, 
        db: Session, 
        event_type: str, 
        entity_type: str, 
        entity_id: uuid.UUID, 
        details: dict
    ):
        """Log an event"""
        event = Event(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id="system",  # TODO: Get from auth context
            details=details
        )
        db.add(event)
        db.commit()
