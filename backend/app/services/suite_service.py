from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional
import uuid
import json
from datetime import datetime

from app.models.schemas import SuiteArtifactsCreate, SuiteArtifactsResponse, PaginatedResponse
from app.models.database import Suite, Plan, Event
from app.services.test_plan_service import TestPlanService

class SuiteService:
    """Service for managing test suites"""
    
    def __init__(self):
        self.test_plan_service = TestPlanService()
    
    async def create_suite(self, db: Session, suite_data: SuiteArtifactsCreate) -> Suite:
        """Create a new test suite"""
        try:
            # Verify plan exists
            plan = await self.test_plan_service.get_plan_by_id(db, str(suite_data.plan_id))
            if not plan:
                raise ValueError(f"Plan with ID {suite_data.plan_id} not found")
            
            # Generate unique suite ID
            suite_id = f"suite-{uuid.uuid4().hex[:8]}"
            
            # Create suite record
            suite = Suite(
                suite_id=suite_id,
                plan_id=suite_data.plan_id,
                name=suite_data.name,
                description=suite_data.description,
                test_type=suite_data.test_type,
                artifacts=[artifact.dict() for artifact in suite_data.artifacts],
                path=suite_data.path,
                status="draft",
                created_by="system"  # TODO: Get from auth context
            )
            
            db.add(suite)
            db.commit()
            db.refresh(suite)
            
            # Log event
            await self._log_event(db, "suite_created", "suite", suite.id, {
                "suite_id": suite_id,
                "plan_id": str(suite_data.plan_id),
                "test_type": suite_data.test_type
            })
            
            return suite
            
        except Exception as e:
            db.rollback()
            raise e
    
    async def get_suite_by_id(self, db: Session, suite_id: str) -> Optional[Suite]:
        """Get a suite by its suite_id"""
        return db.query(Suite).filter(Suite.suite_id == suite_id).first()
    
    async def get_suites(
        self, 
        db: Session, 
        page: int = 1, 
        size: int = 20, 
        plan_id: Optional[str] = None
    ) -> PaginatedResponse:
        """Get paginated list of suites"""
        query = db.query(Suite)
        
        if plan_id:
            # Find plan by plan_id and filter suites
            plan = await self.test_plan_service.get_plan_by_id(db, plan_id)
            if plan:
                query = query.filter(Suite.plan_id == plan.id)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * size
        suites = query.order_by(desc(Suite.created_at)).offset(offset).limit(size).all()
        
        # Calculate pagination info
        pages = (total + size - 1) // size
        has_next = page < pages
        has_prev = page > 1
        
        # Convert to response format
        items = [
            SuiteArtifactsResponse(
                suite_id=suite.suite_id,
                name=suite.name,
                test_type=suite.test_type,
                status=suite.status,
                artifact_count=len(suite.artifacts) if suite.artifacts else 0,
                created_at=suite.created_at
            ) for suite in suites
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
    
    async def update_suite_status(self, db: Session, suite_id: str, status: str) -> Optional[Suite]:
        """Update suite status"""
        suite = await self.get_suite_by_id(db, suite_id)
        if suite:
            suite.status = status
            suite.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(suite)
            
            # Log event
            await self._log_event(db, "suite_status_updated", "suite", suite.id, {
                "suite_id": suite_id,
                "old_status": suite.status,
                "new_status": status
            })
        
        return suite
    
    async def delete_suite(self, db: Session, suite_id: str) -> bool:
        """Delete a suite"""
        suite = await self.get_suite_by_id(db, suite_id)
        if suite:
            db.delete(suite)
            db.commit()
            
            # Log event
            await self._log_event(db, "suite_deleted", "suite", suite.id, {"suite_id": suite_id})
            return True
        
        return False
    
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
