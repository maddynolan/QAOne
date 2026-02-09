"""
Database API Router

Provides REST endpoints for all database operations with fast caching.
"""

import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime
import uuid

from ..services.storage.database_service import (
    db, init_database,
    TestCase, TestSuite, TestRun, TestPlan, Recording, Element, Defect
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/db", tags=["Database"])


# ==================== REQUEST MODELS ====================

class CreateTestCaseRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    steps: List[Dict[str, Any]] = []
    status: str = "draft"
    priority: str = "medium"
    category: str = "functional"
    tags: List[str] = []
    script: Optional[str] = None
    metadata: Dict[str, Any] = {}
    project_id: Optional[str] = None
    suite_id: Optional[str] = None

class UpdateTestCaseRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    script: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    suite_id: Optional[str] = None

class CreateTestSuiteRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    test_case_ids: List[str] = []
    project_id: Optional[str] = None

class CreateTestRunRequest(BaseModel):
    name: str
    suite_id: Optional[str] = None
    test_case_ids: List[str] = []
    browser: str = "chromium"
    environment: str = "local"
    project_id: Optional[str] = None

class CreateTestPlanRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    suite_ids: List[str] = []
    test_case_ids: List[str] = []
    status: str = "draft"
    project_id: Optional[str] = None

class UpdateTestPlanRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    suite_ids: Optional[List[str]] = None
    test_case_ids: Optional[List[str]] = None
    status: Optional[str] = None

class CreateDefectRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    severity: str = "medium"
    status: str = "open"
    test_case_id: Optional[str] = None
    test_run_id: Optional[str] = None
    screenshot: Optional[str] = None

class UpdateDefectRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    test_case_id: Optional[str] = None
    test_run_id: Optional[str] = None

class CreateRecordingRequest(BaseModel):
    name: str
    url: str
    actions: List[Dict[str, Any]] = []
    script: Optional[str] = None
    app_type: str = "generic"
    framework: str = "playwright-python"
    metadata: Dict[str, Any] = {}

class CreateElementRequest(BaseModel):
    name: str
    selector: str
    selector_type: str = "css"
    page_name: Optional[str] = None
    app_type: str = "generic"
    attributes: Dict[str, Any] = {}


# ==================== INITIALIZATION ====================

@router.on_event("startup")
async def startup():
    """Initialize database on startup."""
    await init_database()
    logger.debug("Database API initialized")


# ==================== TEST CASES ====================

@router.get("/test-cases", response_model=List[Dict[str, Any]])
async def get_test_cases(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    suite_id: Optional[str] = None,
):
    """Get all test cases with filtering."""
    filters = {}
    if status:
        filters['status'] = status
    if priority:
        filters['priority'] = priority
    if category:
        filters['category'] = category
    if suite_id:
        filters['suite_id'] = suite_id
    
    items = await db.test_cases.get_all(limit=limit, offset=offset, filters=filters if filters else None)
    return [item.model_dump() for item in items]

@router.get("/test-cases/{id}", response_model=Dict[str, Any])
async def get_test_case(id: str):
    """Get a single test case."""
    item = await db.test_cases.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Test case not found")
    return item.model_dump()

@router.post("/test-cases", response_model=Dict[str, Any])
async def create_test_case(request: CreateTestCaseRequest):
    """Create a new test case."""
    test_case = TestCase(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.test_cases.create(test_case)
    return created.model_dump()

@router.put("/test-cases/{id}", response_model=Dict[str, Any])
async def update_test_case(id: str, request: UpdateTestCaseRequest):
    """Update a test case."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    updated = await db.test_cases.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Test case not found")
    return updated.model_dump()

@router.delete("/test-cases/{id}")
async def delete_test_case(id: str):
    """Delete a test case."""
    deleted = await db.test_cases.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test case not found")
    return {"status": "deleted", "id": id}

@router.get("/test-cases/search/{query}")
async def search_test_cases(query: str):
    """Search test cases by name or description."""
    items = await db.test_cases.search(query, ['name', 'description'])
    return [item.model_dump() for item in items]


# ==================== TEST SUITES ====================

@router.get("/test-suites", response_model=List[Dict[str, Any]])
async def get_test_suites(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
):
    """Get all test suites."""
    filters = {'status': status} if status else None
    items = await db.test_suites.get_all(limit=limit, offset=offset, filters=filters)
    return [item.model_dump() for item in items]

@router.get("/test-suites/{id}", response_model=Dict[str, Any])
async def get_test_suite(id: str):
    """Get a single test suite with its test cases."""
    suite = await db.test_suites.get(id)
    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")
    
    # Load test cases
    test_cases = []
    for tc_id in suite.test_case_ids:
        tc = await db.test_cases.get(tc_id)
        if tc:
            test_cases.append(tc.model_dump())
    
    result = suite.model_dump()
    result['test_cases'] = test_cases
    return result

@router.post("/test-suites", response_model=Dict[str, Any])
async def create_test_suite(request: CreateTestSuiteRequest):
    """Create a new test suite."""
    suite = TestSuite(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.test_suites.create(suite)
    return created.model_dump()

@router.put("/test-suites/{id}", response_model=Dict[str, Any])
async def update_test_suite(id: str, updates: Dict[str, Any]):
    """Update a test suite."""
    updated = await db.test_suites.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Test suite not found")
    return updated.model_dump()

@router.delete("/test-suites/{id}")
async def delete_test_suite(id: str):
    """Delete a test suite."""
    deleted = await db.test_suites.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test suite not found")
    return {"status": "deleted", "id": id}

@router.post("/test-suites/{id}/add-test-case/{test_case_id}")
async def add_test_case_to_suite(id: str, test_case_id: str):
    """Add a test case to a suite."""
    suite = await db.test_suites.get(id)
    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")
    
    if test_case_id not in suite.test_case_ids:
        suite.test_case_ids.append(test_case_id)
        await db.test_suites.update(id, {'test_case_ids': suite.test_case_ids})
    
    # Also update the test case's suite_id
    await db.test_cases.update(test_case_id, {'suite_id': id})
    
    return {"status": "added", "suite_id": id, "test_case_id": test_case_id}


# ==================== TEST RUNS ====================

@router.get("/test-runs", response_model=List[Dict[str, Any]])
async def get_test_runs(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
):
    """Get all test runs."""
    filters = {'status': status} if status else None
    items = await db.test_runs.get_all(limit=limit, offset=offset, filters=filters)
    return [item.model_dump() for item in items]

@router.get("/test-runs/{id}", response_model=Dict[str, Any])
async def get_test_run(id: str):
    """Get a single test run."""
    item = await db.test_runs.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Test run not found")
    return item.model_dump()

@router.post("/test-runs", response_model=Dict[str, Any])
async def create_test_run(request: CreateTestRunRequest):
    """Create a new test run."""
    run = TestRun(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.test_runs.create(run)
    return created.model_dump()

@router.put("/test-runs/{id}", response_model=Dict[str, Any])
async def update_test_run(id: str, updates: Dict[str, Any]):
    """Update a test run (e.g., status, results)."""
    updated = await db.test_runs.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Test run not found")
    return updated.model_dump()


# ==================== RECORDINGS ====================

@router.get("/recordings", response_model=List[Dict[str, Any]])
async def get_recordings(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
):
    """Get all recordings."""
    filters = {'status': status} if status else None
    items = await db.recordings.get_all(limit=limit, offset=offset, filters=filters)
    return [item.model_dump() for item in items]

@router.get("/recordings/{id}", response_model=Dict[str, Any])
async def get_recording(id: str):
    """Get a single recording."""
    item = await db.recordings.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Recording not found")
    return item.model_dump()

@router.post("/recordings", response_model=Dict[str, Any])
async def create_recording(request: CreateRecordingRequest):
    """Create a new recording."""
    recording = Recording(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.recordings.create(recording)
    return created.model_dump()

@router.delete("/recordings/{id}")
async def delete_recording(id: str):
    """Delete a recording."""
    deleted = await db.recordings.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"status": "deleted", "id": id}


# ==================== ELEMENTS ====================

@router.get("/elements", response_model=List[Dict[str, Any]])
async def get_elements(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    page_name: Optional[str] = None,
    app_type: Optional[str] = None,
):
    """Get all elements."""
    filters = {}
    if page_name:
        filters['page_name'] = page_name
    if app_type:
        filters['app_type'] = app_type
    
    items = await db.elements.get_all(limit=limit, offset=offset, filters=filters if filters else None)
    return [item.model_dump() for item in items]

@router.post("/elements", response_model=Dict[str, Any])
async def create_element(request: CreateElementRequest):
    """Create a new element."""
    element = Element(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.elements.create(element)
    return created.model_dump()


# ==================== TEST PLANS ====================

@router.get("/test-plans", response_model=List[Dict[str, Any]])
async def get_test_plans(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
):
    """Get all test plans."""
    filters = {'status': status} if status else None
    items = await db.test_plans.get_all(limit=limit, offset=offset, filters=filters)
    return [item.model_dump() for item in items]

@router.get("/test-plans/{id}", response_model=Dict[str, Any])
async def get_test_plan(id: str):
    """Get a single test plan with its suites and test cases."""
    plan = await db.test_plans.get(id)
    if not plan:
        raise HTTPException(status_code=404, detail="Test plan not found")
    result = plan.model_dump()
    # Optionally load linked test cases
    test_cases = []
    for tc_id in (plan.test_case_ids or []):
        tc = await db.test_cases.get(tc_id)
        if tc:
            test_cases.append(tc.model_dump())
    result['test_cases'] = test_cases
    return result

@router.post("/test-plans", response_model=Dict[str, Any])
async def create_test_plan(request: CreateTestPlanRequest):
    """Create a new test plan."""
    plan = TestPlan(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.test_plans.create(plan)
    return created.model_dump()

@router.put("/test-plans/{id}", response_model=Dict[str, Any])
async def update_test_plan(id: str, request: UpdateTestPlanRequest):
    """Update a test plan."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updated = await db.test_plans.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Test plan not found")
    return updated.model_dump()

@router.delete("/test-plans/{id}")
async def delete_test_plan(id: str):
    """Delete a test plan."""
    deleted = await db.test_plans.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test plan not found")
    return {"status": "deleted", "id": id}


# ==================== TEST RUN DELETE ====================

@router.delete("/test-runs/{id}")
async def delete_test_run(id: str):
    """Delete a test run."""
    deleted = await db.test_runs.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Test run not found")
    return {"status": "deleted", "id": id}


# ==================== DEFECTS ====================

@router.get("/defects", response_model=List[Dict[str, Any]])
async def get_defects(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
    severity: Optional[str] = None,
):
    """Get all defects."""
    filters = {}
    if status:
        filters['status'] = status
    if severity:
        filters['severity'] = severity
    
    items = await db.defects.get_all(limit=limit, offset=offset, filters=filters if filters else None)
    return [item.model_dump() for item in items]

@router.get("/defects/{id}", response_model=Dict[str, Any])
async def get_defect(id: str):
    """Get a single defect."""
    item = await db.defects.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Defect not found")
    return item.model_dump()

@router.post("/defects", response_model=Dict[str, Any])
async def create_defect(request: CreateDefectRequest):
    """Create a new defect."""
    defect = Defect(
        id=str(uuid.uuid4())[:8],
        **request.model_dump()
    )
    created = await db.defects.create(defect)
    return created.model_dump()

@router.put("/defects/{id}", response_model=Dict[str, Any])
async def update_defect(id: str, request: UpdateDefectRequest):
    """Update a defect."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updated = await db.defects.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Defect not found")
    return updated.model_dump()

@router.delete("/defects/{id}")
async def delete_defect(id: str):
    """Delete a defect."""
    deleted = await db.defects.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Defect not found")
    return {"status": "deleted", "id": id}


# ==================== STATS & ADMIN ====================

@router.get("/stats")
async def get_database_stats():
    """Get database statistics."""
    return await db.get_stats()

@router.post("/backup")
async def backup_database():
    """Create a database backup."""
    backup_path = await db.backup()
    return {"status": "success", "backup_path": backup_path}

@router.post("/clear-cache")
async def clear_cache():
    """Clear all caches."""
    db.clear_all_caches()
    return {"status": "success", "message": "All caches cleared"}

@router.post("/migrate")
async def migrate_from_json():
    """Migrate data from JSON files to database."""
    count = await db.migrate_from_json()
    return {"status": "success", "migrated_count": count}


@router.post("/clear-all")
async def clear_all_data():
    """Clear ALL test data from all tables. Use with caution - enterprise reset."""
    tables = ["test_cases", "test_suites", "test_runs", "test_plans", "defects", "recordings"]
    deleted = {}
    
    for table in tables:
        try:
            async with db.connection() as conn:
                cursor = await conn.execute(f"SELECT COUNT(*) FROM {table}")
                row = await cursor.fetchone()
                count = row[0] if row else 0
                await conn.execute(f"DELETE FROM {table}")
                await conn.commit()
                deleted[table] = count
        except Exception as e:
            deleted[table] = f"error: {str(e)}"
    
    # Clear all caches
    db.clear_all_caches()
    
    return {"status": "success", "deleted": deleted, "message": "All test data cleared"}

