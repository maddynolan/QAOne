from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional
import uuid
import json
from datetime import datetime

from app.models.schemas import TestPlanCreate, TestPlanResponse, PaginatedResponse
from app.models.database import Plan, Event
from app.core.config import settings

class TestPlanService:
    """Service for managing test plans"""
    
    async def create_plan(self, db: Session, plan_data: TestPlanCreate) -> Plan:
        """Create a new test plan"""
        try:
            # Generate unique plan ID
            plan_id = f"plan-{uuid.uuid4().hex[:8]}"
            
            # Create plan record
            plan = Plan(
                plan_id=plan_id,
                name=plan_data.name,
                description=plan_data.description,
                source=plan_data.source,
                targets=plan_data.targets.dict(),
                api_ui=plan_data.api_ui.dict(),
                path=plan_data.path,
                priority=plan_data.priority,
                status="draft",
                created_by="system"  # TODO: Get from auth context
            )
            
            db.add(plan)
            db.commit()
            db.refresh(plan)
            
            # Log event
            await self._log_event(db, "plan_created", "plan", plan.id, {"plan_id": plan_id})
            
            return plan
            
        except Exception as e:
            db.rollback()
            raise e
    
    async def get_plan_by_id(self, db: Session, plan_id: str) -> Optional[Plan]:
        """Get a plan by its plan_id"""
        return db.query(Plan).filter(Plan.plan_id == plan_id).first()
    
    async def get_plans(
        self, 
        db: Session, 
        page: int = 1, 
        size: int = 20, 
        status_filter: Optional[str] = None
    ) -> PaginatedResponse:
        """Get paginated list of plans"""
        query = db.query(Plan)
        
        if status_filter:
            query = query.filter(Plan.status == status_filter)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * size
        plans = query.order_by(desc(Plan.created_at)).offset(offset).limit(size).all()
        
        # Calculate pagination info
        pages = (total + size - 1) // size
        has_next = page < pages
        has_prev = page > 1
        
        # Convert to response format
        items = [
            TestPlanResponse(
                plan_id=plan.plan_id,
                name=plan.name,
                description=plan.description,
                status=plan.status,
                created_at=plan.created_at,
                updated_at=plan.updated_at
            ) for plan in plans
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
    
    async def update_plan_status(self, db: Session, plan_id: str, status: str) -> Optional[Plan]:
        """Update plan status"""
        plan = await self.get_plan_by_id(db, plan_id)
        if plan:
            plan.status = status
            plan.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(plan)
            
            # Log event
            await self._log_event(db, "plan_status_updated", "plan", plan.id, {
                "plan_id": plan_id,
                "old_status": plan.status,
                "new_status": status
            })
        
        return plan
    
    async def delete_plan(self, db: Session, plan_id: str) -> bool:
        """Delete a plan"""
        plan = await self.get_plan_by_id(db, plan_id)
        if plan:
            db.delete(plan)
            db.commit()
            
            # Log event
            await self._log_event(db, "plan_deleted", "plan", plan.id, {"plan_id": plan_id})
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
