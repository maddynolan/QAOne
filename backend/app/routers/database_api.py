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
    TestCase, TestSuite, TestRun, TestPlan, Recording, Element, Defect,
    Environment, TestCaseVersion, GlobalVariable, ApiCollection,
    ApiWorkspace, ApiCollectionV2, ApiChain, ApiTestRunRecord
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

class SaveApiCollectionRequest(BaseModel):
    """Full API test suite payload (test_cases, folders, base_url, metadata, etc.)."""
    payload: Dict[str, Any] = {}

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

class CreateEnvironmentRequest(BaseModel):
    name: str
    env_type: str = "development"
    base_url: str = ""
    variables: List[Dict[str, Any]] = []
    auth: Dict[str, Any] = {}
    headers: Dict[str, Any] = {}
    timeouts: Dict[str, Any] = {}
    project_id: Optional[str] = None

class UpdateEnvironmentRequest(BaseModel):
    name: Optional[str] = None
    env_type: Optional[str] = None
    base_url: Optional[str] = None
    variables: Optional[List[Dict[str, Any]]] = None
    auth: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    timeouts: Optional[Dict[str, Any]] = None

class CreateGlobalVariableRequest(BaseModel):
    key: str
    value: str = ""
    var_type: str = "default"
    description: Optional[str] = None


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
    """Update a test case. Automatically creates a version snapshot before updating."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    # Auto-snapshot before update (version tracking)
    try:
        existing = await db.test_cases.get(id)
        if existing:
            versions = await db.test_case_versions.get_all(filters={"test_case_id": id})
            next_version = max([v.version_number for v in versions], default=0) + 1
            changed_fields = ", ".join(updates.keys())
            snapshot = TestCaseVersion(
                id=f"tcv_{str(uuid.uuid4())[:8]}",
                test_case_id=id,
                version_number=next_version,
                name=existing.name,
                description=existing.description,
                steps=existing.steps,
                status=existing.status,
                priority=existing.priority,
                category=existing.category,
                tags=existing.tags,
                script=existing.script,
                metadata=existing.metadata,
                change_summary=f"Auto-snapshot before update ({changed_fields})",
            )
            await db.test_case_versions.create(snapshot)
    except Exception as e:
        logger.warning(f"Failed to create version snapshot for test case {id}: {e}")
    
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


# ==================== API COLLECTIONS (API tab source of truth) ====================

DEFAULT_API_COLLECTION_ID = "default"

@router.get("/api-collections", response_model=List[Dict[str, Any]])
async def get_api_collections(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
):
    """List all API collections (stored test suites for API Testing tab)."""
    items = await db.api_collections.get_all(limit=limit, offset=offset)
    return [item.model_dump() for item in items]

@router.get("/api-collections/default", response_model=Dict[str, Any])
async def get_default_api_collection():
    """Get the default API collection payload. Returns empty suite if none saved yet."""
    item = await db.api_collections.get(DEFAULT_API_COLLECTION_ID)
    if not item:
        return {"id": DEFAULT_API_COLLECTION_ID, "name": "default", "payload": {}, "created_at": "", "updated_at": ""}
    return item.model_dump()

@router.put("/api-collections/default", response_model=Dict[str, Any])
async def save_default_api_collection(request: SaveApiCollectionRequest):
    """Create or update the default API collection (full test suite from API tab)."""
    now = datetime.utcnow().isoformat() + "Z"
    existing = await db.api_collections.get(DEFAULT_API_COLLECTION_ID)
    if existing:
        await db.api_collections.update(DEFAULT_API_COLLECTION_ID, {"payload": request.payload, "updated_at": now})
        updated = await db.api_collections.get(DEFAULT_API_COLLECTION_ID)
        return updated.model_dump()
    coll = ApiCollection(
        id=DEFAULT_API_COLLECTION_ID,
        name="default",
        payload=request.payload,
        created_at=now,
        updated_at=now,
    )
    created = await db.api_collections.create(coll)
    return created.model_dump()


# ==================== API WORKSPACES (multi-collection support) ====================

@router.get("/api-workspaces", response_model=List[Dict[str, Any]])
async def get_api_workspaces():
    """List all API testing workspaces."""
    items = await db.api_workspaces.get_all(limit=100, offset=0)
    return [item.model_dump() for item in items]

@router.post("/api-workspaces", response_model=Dict[str, Any])
async def create_api_workspace(request: Dict[str, Any]):
    """Create a new API testing workspace."""
    now = datetime.utcnow().isoformat() + "Z"
    ws = ApiWorkspace(
        id=request.get("id", str(uuid.uuid4())),
        name=request.get("name", "My Workspace"),
        description=request.get("description", ""),
        collections=request.get("collections", []),
        created_at=request.get("created_at", now),
        updated_at=now,
    )
    created = await db.api_workspaces.create(ws)
    return created.model_dump()

@router.put("/api-workspaces/{workspace_id}", response_model=Dict[str, Any])
async def update_api_workspace(workspace_id: str, request: Dict[str, Any]):
    """Update an API testing workspace."""
    now = datetime.utcnow().isoformat() + "Z"
    request["updated_at"] = now
    await db.api_workspaces.update(workspace_id, request)
    updated = await db.api_workspaces.get(workspace_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return updated.model_dump()

@router.delete("/api-workspaces/{workspace_id}")
async def delete_api_workspace(workspace_id: str):
    """Delete an API testing workspace and its collections."""
    await db.api_workspaces.delete(workspace_id)
    return {"status": "deleted", "id": workspace_id}


# ==================== API COLLECTIONS V2 (granular, workspace-scoped) ====================

@router.get("/api-collections-v2", response_model=List[Dict[str, Any]])
async def get_api_collections_v2(
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
):
    """List API collections, optionally filtered by workspace."""
    items = await db.api_collections_v2.get_all(limit=limit, offset=offset)
    result = [item.model_dump() for item in items]
    if workspace_id:
        result = [c for c in result if c.get("workspace_id") == workspace_id]
    return result

@router.get("/api-collections-v2/{collection_id}", response_model=Dict[str, Any])
async def get_api_collection_v2(collection_id: str):
    """Get a single API collection with all its requests, folders, and chains."""
    item = await db.api_collections_v2.get(collection_id)
    if not item:
        raise HTTPException(status_code=404, detail="Collection not found")
    return item.model_dump()

@router.post("/api-collections-v2", response_model=Dict[str, Any])
async def create_api_collection_v2(request: Dict[str, Any]):
    """Create a new API collection."""
    now = datetime.utcnow().isoformat() + "Z"
    coll = ApiCollectionV2(
        id=request.get("id", str(uuid.uuid4())),
        workspace_id=request.get("workspace_id", ""),
        name=request.get("name", "New Collection"),
        description=request.get("description", ""),
        base_url=request.get("base_url", ""),
        folders=request.get("folders", []),
        requests=request.get("requests", []),
        chains=request.get("chains", []),
        environment_ids=request.get("environment_ids", []),
        variables=request.get("variables", {}),
        metadata=request.get("metadata", {}),
        created_at=request.get("created_at", now),
        updated_at=now,
    )
    created = await db.api_collections_v2.create(coll)
    return created.model_dump()

@router.put("/api-collections-v2/{collection_id}", response_model=Dict[str, Any])
async def update_api_collection_v2(collection_id: str, request: Dict[str, Any]):
    """Update an API collection (supports partial updates)."""
    now = datetime.utcnow().isoformat() + "Z"
    request["updated_at"] = now
    await db.api_collections_v2.update(collection_id, request)
    updated = await db.api_collections_v2.get(collection_id)
    if not updated:
        # If not found, create it (upsert behavior for frontend compatibility)
        request["id"] = collection_id
        request["created_at"] = request.get("created_at", now)
        coll = ApiCollectionV2(**request)
        created = await db.api_collections_v2.create(coll)
        return created.model_dump()
    return updated.model_dump()

@router.delete("/api-collections-v2/{collection_id}")
async def delete_api_collection_v2(collection_id: str):
    """Delete an API collection and its chains."""
    # Also delete associated chains
    try:
        chains = await db.api_chains.get_all(limit=1000, offset=0)
        for chain in chains:
            if chain.collection_id == collection_id:
                await db.api_chains.delete(chain.id)
    except Exception:
        pass
    await db.api_collections_v2.delete(collection_id)
    return {"status": "deleted", "id": collection_id}


# ==================== API CHAINS (DB-persisted, replaces localStorage) ====================

@router.get("/api-chains", response_model=List[Dict[str, Any]])
async def get_api_chains(
    collection_id: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
):
    """List API chains, optionally filtered by collection."""
    items = await db.api_chains.get_all(limit=limit, offset=0)
    result = [item.model_dump() for item in items]
    if collection_id:
        result = [c for c in result if c.get("collection_id") == collection_id]
    return result

@router.get("/api-chains/{chain_id}", response_model=Dict[str, Any])
async def get_api_chain(chain_id: str):
    """Get a single API chain."""
    item = await db.api_chains.get(chain_id)
    if not item:
        raise HTTPException(status_code=404, detail="Chain not found")
    return item.model_dump()

@router.post("/api-chains", response_model=Dict[str, Any])
async def create_api_chain(request: Dict[str, Any]):
    """Create a new API chain."""
    now = datetime.utcnow().isoformat() + "Z"
    chain = ApiChain(
        id=request.get("id", str(uuid.uuid4())),
        collection_id=request.get("collection_id", ""),
        name=request.get("name", "New Chain"),
        description=request.get("description", ""),
        steps=request.get("steps", []),
        variables=request.get("variables", {}),
        tags=request.get("tags", []),
        last_run=request.get("last_run", {}),
        created_at=request.get("created_at", now),
        updated_at=now,
    )
    created = await db.api_chains.create(chain)
    return created.model_dump()

@router.put("/api-chains/{chain_id}", response_model=Dict[str, Any])
async def update_api_chain(chain_id: str, request: Dict[str, Any]):
    """Update an API chain."""
    now = datetime.utcnow().isoformat() + "Z"
    request["updated_at"] = now
    await db.api_chains.update(chain_id, request)
    updated = await db.api_chains.get(chain_id)
    if not updated:
        request["id"] = chain_id
        request["created_at"] = request.get("created_at", now)
        chain = ApiChain(**request)
        created = await db.api_chains.create(chain)
        return created.model_dump()
    return updated.model_dump()

@router.delete("/api-chains/{chain_id}")
async def delete_api_chain(chain_id: str):
    """Delete an API chain."""
    await db.api_chains.delete(chain_id)
    return {"status": "deleted", "id": chain_id}


# ==================== API TEST RUNS (persistent execution history) ====================

@router.get("/api-test-runs", response_model=List[Dict[str, Any]])
async def get_api_test_runs(
    collection_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
):
    """List API test runs with optional filtering. Sorted by created_at descending."""
    items = await db.api_test_runs.get_all(limit=limit, offset=offset)
    result = [item.model_dump() for item in items]
    if collection_id:
        result = [r for r in result if r.get("collection_id") == collection_id]
    if status:
        result = [r for r in result if r.get("status") == status]
    # Sort by created_at descending for most recent first
    result.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return result

@router.get("/api-test-runs/{run_id}", response_model=Dict[str, Any])
async def get_api_test_run(run_id: str):
    """Get a single API test run with full results."""
    item = await db.api_test_runs.get(run_id)
    if not item:
        raise HTTPException(status_code=404, detail="Test run not found")
    return item.model_dump()

@router.post("/api-test-runs", response_model=Dict[str, Any])
async def create_api_test_run(request: Dict[str, Any]):
    """Create a new API test run record."""
    now = datetime.utcnow().isoformat() + "Z"
    run = ApiTestRunRecord(
        id=request.get("id", str(uuid.uuid4())),
        collection_id=request.get("collection_id", ""),
        name=request.get("name", ""),
        status=request.get("status", "pending"),
        mode=request.get("mode", "automated"),
        environment_id=request.get("environment_id"),
        request_ids=request.get("request_ids", []),
        results=request.get("results", []),
        started_at=request.get("started_at", now),
        completed_at=request.get("completed_at"),
        duration_ms=request.get("duration_ms", 0),
        created_at=request.get("created_at", now),
    )
    created = await db.api_test_runs.create(run)
    return created.model_dump()

@router.put("/api-test-runs/{run_id}", response_model=Dict[str, Any])
async def update_api_test_run(run_id: str, request: Dict[str, Any]):
    """Update an API test run (status, results, completion)."""
    await db.api_test_runs.update(run_id, request)
    updated = await db.api_test_runs.get(run_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Test run not found")
    return updated.model_dump()

@router.delete("/api-test-runs/{run_id}")
async def delete_api_test_run(run_id: str):
    """Delete an API test run."""
    await db.api_test_runs.delete(run_id)
    return {"status": "deleted", "id": run_id}


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
    tables = ["test_cases", "test_suites", "test_runs", "test_plans", "defects", "recordings", "environments", "test_case_versions", "global_variables", "api_collections", "api_workspaces", "api_collections_v2", "api_chains", "api_test_runs"]
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


# ==================== ENVIRONMENTS ====================

@router.get("/environments", response_model=List[Dict[str, Any]])
async def get_environments(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    env_type: Optional[str] = None,
):
    """Get all environments with variables and auth config."""
    filters = {'env_type': env_type} if env_type else None
    items = await db.environments.get_all(limit=limit, offset=offset, filters=filters)
    return [item.model_dump() for item in items]

@router.get("/environments/{id}", response_model=Dict[str, Any])
async def get_environment(id: str):
    """Get a single environment."""
    item = await db.environments.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Environment not found")
    return item.model_dump()

@router.post("/environments", response_model=Dict[str, Any])
async def create_environment(request: CreateEnvironmentRequest):
    """Create a new environment with variables and auth."""
    env = Environment(
        id=f"env_{str(uuid.uuid4())[:8]}",
        **request.model_dump()
    )
    created = await db.environments.create(env)
    return created.model_dump()

@router.put("/environments/{id}", response_model=Dict[str, Any])
async def update_environment(id: str, request: UpdateEnvironmentRequest):
    """Update an environment (variables, auth, base_url, etc.)."""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    updated = await db.environments.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Environment not found")
    return updated.model_dump()

@router.delete("/environments/{id}")
async def delete_environment(id: str):
    """Delete an environment."""
    deleted = await db.environments.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"status": "deleted", "id": id}


# ==================== TEST CASE VERSIONS ====================

@router.get("/test-cases/{test_case_id}/versions", response_model=List[Dict[str, Any]])
async def get_test_case_versions(
    test_case_id: str,
    limit: int = Query(50, le=200),
):
    """Get version history for a test case (newest first)."""
    items = await db.test_case_versions.get_all(
        limit=limit, filters={"test_case_id": test_case_id}
    )
    return [item.model_dump() for item in items]

@router.get("/test-case-versions/{id}", response_model=Dict[str, Any])
async def get_test_case_version(id: str):
    """Get a specific version snapshot."""
    item = await db.test_case_versions.get(id)
    if not item:
        raise HTTPException(status_code=404, detail="Version not found")
    return item.model_dump()

@router.post("/test-cases/{test_case_id}/snapshot")
async def create_test_case_snapshot(test_case_id: str, change_summary: str = "Manual snapshot"):
    """
    Create a version snapshot of a test case's current state.
    Called automatically before updates, or manually for important checkpoints.
    """
    tc = await db.test_cases.get(test_case_id)
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    # Get the next version number
    existing = await db.test_case_versions.get_all(filters={"test_case_id": test_case_id})
    next_version = max([v.version_number for v in existing], default=0) + 1
    
    version = TestCaseVersion(
        id=f"tcv_{str(uuid.uuid4())[:8]}",
        test_case_id=test_case_id,
        version_number=next_version,
        name=tc.name,
        description=tc.description,
        steps=tc.steps,
        status=tc.status,
        priority=tc.priority,
        category=tc.category,
        tags=tc.tags,
        script=tc.script,
        metadata=tc.metadata,
        change_summary=change_summary,
    )
    created = await db.test_case_versions.create(version)
    return created.model_dump()


# ==================== GLOBAL VARIABLES ====================

@router.get("/global-variables", response_model=List[Dict[str, Any]])
async def get_global_variables():
    """Get all global variables (shared across environments)."""
    items = await db.global_variables.get_all(limit=500)
    return [item.model_dump() for item in items]

@router.post("/global-variables", response_model=Dict[str, Any])
async def create_global_variable(request: CreateGlobalVariableRequest):
    """Create or update a global variable."""
    # Check if key already exists
    existing = await db.global_variables.get_all(filters={"key": request.key})
    if existing:
        # Update existing
        updated = await db.global_variables.update(existing[0].id, {
            "value": request.value,
            "var_type": request.var_type,
            "description": request.description,
        })
        return updated.model_dump()
    
    gv = GlobalVariable(
        id=f"gv_{str(uuid.uuid4())[:8]}",
        key=request.key,
        value=request.value,
        var_type=request.var_type,
        enabled=1,
        description=request.description,
    )
    created = await db.global_variables.create(gv)
    return created.model_dump()

@router.put("/global-variables/{id}", response_model=Dict[str, Any])
async def update_global_variable(id: str, updates: Dict[str, Any]):
    """Update a global variable."""
    updated = await db.global_variables.update(id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Global variable not found")
    return updated.model_dump()

@router.delete("/global-variables/{id}")
async def delete_global_variable(id: str):
    """Delete a global variable."""
    deleted = await db.global_variables.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Global variable not found")
    return {"status": "deleted", "id": id}

