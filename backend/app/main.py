from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import uuid
from datetime import datetime
import time

from app.core.config import settings, get_db, get_redis
from app.models.schemas import (
    TestPlan, TestPlanCreate, TestPlanResponse,
    SuiteArtifacts, SuiteArtifactsCreate, SuiteArtifactsResponse,
    RunResult, RunResultCreate, RunResultResponse,
    TriageResult, TriageResultCreate, TriageResultResponse,
    PatchGet, PatchCreate, PatchResponse,
    APIResponse, ErrorResponse, PaginationParams, PaginatedResponse
)
from app.models.database import Plan, Suite, Run, TriageResult as TriageResultDB, Patch
from app.services.test_plan_service import TestPlanService
from app.services.suite_service import SuiteService
from app.services.run_service import RunService
from app.services.triage_service import TriageService
from app.services.patch_service import PatchService
from app.tasks import (
    create_test_plan_task,
    create_test_suite_task,
    execute_test_run_task,
    triage_failures_task,
    generate_patches_task
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description=settings.api_description,
    debug=settings.debug
)

# Add security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID middleware for tracing
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add request ID to response headers
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.method == "POST":
        redis_client = get_redis()
        client_ip = request.client.host
        current_time = int(time.time())
        
        # Simple sliding window rate limiting
        key = f"rate_limit:{client_ip}:{current_time // 60}"
        current_requests = redis_client.incr(key)
        
        if current_requests == 1:
            redis_client.expire(key, 60)  # Expire after 1 minute
        
        if current_requests > settings.rate_limit_per_minute:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"error": "Rate limit exceeded"}
            )
    
    response = await call_next(request)
    return response

# Initialize services
test_plan_service = TestPlanService()
suite_service = SuiteService()
run_service = RunService()
triage_service = TriageService()
patch_service = PatchService()

# Health check endpoint
@app.get("/health")
async def health_check(request: Request):
    """Enhanced health check with queue status"""
    try:
        redis_client = get_redis()
        redis_status = "healthy" if redis_client.ping() else "unhealthy"
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "request_id": getattr(request.state, 'request_id', None),
            "services": {
                "database": "healthy",  # TODO: Add actual DB health check
                "redis": redis_status,
                "celery": "healthy"  # TODO: Add actual Celery health check
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "error": str(e)}
        )

# Test Plan endpoints with async job processing
@app.post("/generate_test_plan", response_model=APIResponse)
async def generate_test_plan(
    plan_data: TestPlanCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Generate a test plan from specification (async)"""
    try:
        # Add request ID to plan data for tracing
        plan_data_dict = plan_data.dict()
        plan_data_dict["request_id"] = getattr(request.state, 'request_id', None)
        
        # Submit to Celery queue
        task = create_test_plan_task.delay(plan_data_dict)
        
        logger.info(f"Submitted test plan creation task {task.id}")
        
        return APIResponse(
            success=True,
            message="Test plan generation started",
            data={
                "task_id": task.id,
                "status": "processing",
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
    except Exception as e:
        logger.error(f"Error submitting test plan creation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit test plan creation: {str(e)}"
        )

@app.get("/plans", response_model=PaginatedResponse)
async def get_plans(
    page: int = 1,
    size: int = 20,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all test plans with pagination"""
    try:
        plans = await test_plan_service.get_plans(db, page, size, status_filter)
        return plans
    except Exception as e:
        logger.error(f"Error fetching plans: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch plans: {str(e)}"
        )

@app.get("/plans/{plan_id}", response_model=APIResponse)
async def get_plan(plan_id: str, db: Session = Depends(get_db)):
    """Get a specific test plan by ID"""
    try:
        plan = await test_plan_service.get_plan_by_id(db, plan_id)
        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test plan not found"
            )
        return APIResponse(
            success=True,
            data=TestPlanResponse(
                plan_id=plan.plan_id,
                name=plan.name,
                description=plan.description,
                status=plan.status,
                created_at=plan.created_at,
                updated_at=plan.updated_at
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching plan {plan_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch plan: {str(e)}"
        )

# Suite endpoints with async processing
@app.post("/create_tests", response_model=APIResponse)
async def create_tests(
    suite_data: SuiteArtifactsCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Create test artifacts from a test plan (async)"""
    try:
        suite_data_dict = suite_data.dict()
        suite_data_dict["request_id"] = getattr(request.state, 'request_id', None)
        
        task = create_test_suite_task.delay(suite_data_dict)
        
        logger.info(f"Submitted test suite creation task {task.id}")
        
        return APIResponse(
            success=True,
            message="Test suite creation started",
            data={
                "task_id": task.id,
                "status": "processing",
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
    except Exception as e:
        logger.error(f"Error submitting test suite creation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit test suite creation: {str(e)}"
        )

@app.get("/suites", response_model=PaginatedResponse)
async def get_suites(
    page: int = 1,
    size: int = 20,
    plan_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all test suites with pagination"""
    try:
        suites = await suite_service.get_suites(db, page, size, plan_id)
        return suites
    except Exception as e:
        logger.error(f"Error fetching suites: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch suites: {str(e)}"
        )

# Run endpoints with async processing
@app.post("/run_tests", response_model=APIResponse)
async def run_tests(
    run_data: RunResultCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Execute a test suite (async)"""
    try:
        run_data_dict = run_data.dict()
        run_data_dict["request_id"] = getattr(request.state, 'request_id', None)
        
        task = execute_test_run_task.delay(run_data_dict)
        
        logger.info(f"Submitted test execution task {task.id}")
        
        return APIResponse(
            success=True,
            message="Test execution started",
            data={
                "task_id": task.id,
                "status": "processing",
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
    except Exception as e:
        logger.error(f"Error submitting test execution: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit test execution: {str(e)}"
        )

@app.get("/runs", response_model=PaginatedResponse)
async def get_runs(
    page: int = 1,
    size: int = 20,
    suite_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all test runs with pagination"""
    try:
        runs = await run_service.get_runs(db, page, size, suite_id, status_filter)
        return runs
    except Exception as e:
        logger.error(f"Error fetching runs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch runs: {str(e)}"
        )

# Triage endpoints with async processing
@app.post("/triage_failures", response_model=APIResponse)
async def triage_failures(
    triage_data: TriageResultCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Analyze test failures and suggest fixes (async)"""
    try:
        triage_data_dict = triage_data.dict()
        triage_data_dict["request_id"] = getattr(request.state, 'request_id', None)
        
        task = triage_failures_task.delay(triage_data_dict)
        
        logger.info(f"Submitted triage task {task.id}")
        
        return APIResponse(
            success=True,
            message="Failure triage started",
            data={
                "task_id": task.id,
                "status": "processing",
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
    except Exception as e:
        logger.error(f"Error submitting triage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit triage: {str(e)}"
        )

@app.get("/triage/{run_id}", response_model=APIResponse)
async def get_triage(run_id: str, db: Session = Depends(get_db)):
    """Get triage results for a specific run"""
    try:
        triage = await triage_service.get_triage_by_run_id(db, run_id)
        if not triage:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Triage results not found"
            )
        return APIResponse(
            success=True,
            data=TriageResultResponse(
                run_id=triage.run_id,
                name=triage.name,
                cluster_count=len(triage.clusters),
                confidence_score=triage.confidence_score,
                status=triage.status,
                created_at=triage.created_at
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching triage for run {run_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch triage results: {str(e)}"
        )

# Patch endpoints with async processing
@app.post("/update_tests", response_model=APIResponse)
async def update_tests(
    patch_data: PatchCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Generate patches for test updates (async)"""
    try:
        patch_data_dict = patch_data.dict()
        patch_data_dict["request_id"] = getattr(request.state, 'request_id', None)
        
        task = generate_patches_task.delay(patch_data_dict)
        
        logger.info(f"Submitted patch generation task {task.id}")
        
        return APIResponse(
            success=True,
            message="Patch generation started",
            data={
                "task_id": task.id,
                "status": "processing",
                "request_id": getattr(request.state, 'request_id', None)
            }
        )
        
    except Exception as e:
        logger.error(f"Error submitting patch generation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit patch generation: {str(e)}"
        )

# Reports endpoint
@app.get("/reports", response_model=APIResponse)
async def get_reports(
    suite_id: Optional[str] = None,
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get test reports and metrics"""
    try:
        reports = await run_service.get_reports(db, suite_id, days)
        return APIResponse(
            success=True,
            data=reports
        )
    except Exception as e:
        logger.error(f"Error fetching reports: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch reports: {str(e)}"
        )

# Task status endpoint
@app.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a Celery task"""
    try:
        from celery.result import AsyncResult
        
        result = AsyncResult(task_id)
        
        return {
            "task_id": task_id,
            "status": result.status,
            "result": result.result if result.ready() else None,
            "info": result.info if not result.ready() else None
        }
        
    except Exception as e:
        logger.error(f"Error fetching task status {task_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch task status: {str(e)}"
        )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc):
    request_id = getattr(request.state, 'request_id', None)
    logger.error(f"Unhandled exception [{request_id}]: {str(exc)}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            success=False,
            message="Internal server error",
            errors=[str(exc)],
            details={"request_id": request_id}
        ).dict()
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)