# FastAPI Backend for QA AI Platform
# This will be the main backend service

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import logging
from datetime import datetime

# Import your custom LLM service
from app.services.llm_service import CustomLLMService
from app.services.test_generation_service import TestGenerationService
from app.services.defect_analysis_service import DefectAnalysisService
from app.services.test_execution_service import TestExecutionService
from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import *

# Initialize FastAPI app
app = FastAPI(
    title="QA AI Platform API",
    description="AI-powered Quality Assurance platform for automated test generation and analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Initialize services
llm_service = CustomLLMService()
test_generation_service = TestGenerationService(llm_service)
defect_analysis_service = DefectAnalysisService(llm_service)
test_execution_service = TestExecutionService()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {
            "llm": "connected",
            "database": "connected",
            "redis": "connected",
            "celery": "connected"
        }
    }

# Test Generation Endpoints
@app.post("/api/v1/test-cases/generate", response_model=TestGenerationResponse)
async def generate_test_case(
    request: TestGenerationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate AI-powered test case from feature description"""
    try:
        # Generate test case using custom LLM
        result = await test_generation_service.generate_test_case(request)
        
        # Store in database
        background_tasks.add_task(
            test_generation_service.store_test_case,
            result, db
        )
        
        return result
    except Exception as e:
        logger.error(f"Error generating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/test-plans/generate", response_model=TestPlanResponse)
async def generate_test_plan(
    request: TestPlanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate comprehensive test plan using AI"""
    try:
        result = await test_generation_service.generate_test_plan(request)
        
        # Store test plan and cases
        background_tasks.add_task(
            test_generation_service.store_test_plan,
            result, db
        )
        
        return result
    except Exception as e:
        logger.error(f"Error generating test plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Defect Analysis Endpoints
@app.post("/api/v1/defects/analyze", response_model=DefectAnalysisResponse)
async def analyze_defect(
    request: DefectAnalysisRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Analyze test failure and provide AI-powered insights"""
    try:
        result = await defect_analysis_service.analyze_defect(request)
        
        # Store analysis results
        background_tasks.add_task(
            defect_analysis_service.store_analysis,
            result, db
        )
        
        return result
    except Exception as e:
        logger.error(f"Error analyzing defect: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/triage/batch-analyze")
async def batch_analyze_defects(
    defects: List[DefectAnalysisRequest],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Batch analyze multiple defects for triage"""
    try:
        results = await defect_analysis_service.batch_analyze(defects)
        
        # Store all analyses
        background_tasks.add_task(
            defect_analysis_service.store_batch_analysis,
            results, db
        )
        
        return {"analyses": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Error in batch analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Test Execution Endpoints
@app.post("/api/v1/test-runs/execute")
async def execute_test_run(
    run_request: TestRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Execute test run with AI-powered monitoring"""
    try:
        # Start test execution
        run_id = await test_execution_service.start_test_run(run_request)
        
        # Execute tests in background
        background_tasks.add_task(
            test_execution_service.execute_tests,
            run_id, run_request, db
        )
        
        return {"run_id": run_id, "status": "started"}
    except Exception as e:
        logger.error(f"Error starting test run: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/test-runs/{run_id}/status")
async def get_test_run_status(run_id: str, db: Session = Depends(get_db)):
    """Get real-time test run status"""
    try:
        status = await test_execution_service.get_run_status(run_id, db)
        return status
    except Exception as e:
        logger.error(f"Error getting run status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# AI Optimization Endpoints
@app.post("/api/v1/optimization/suggest")
async def suggest_optimizations(
    test_results: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Get AI-powered test suite optimization suggestions"""
    try:
        suggestions = await test_generation_service.optimize_test_suite(test_results)
        
        # Store optimization suggestions
        background_tasks.add_task(
            test_generation_service.store_optimization_suggestions,
            suggestions, test_results, db
        )
        
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Error generating optimizations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# CRUD Endpoints for Test Management
@app.get("/api/v1/test-plans", response_model=List[TestPlan])
async def get_test_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all test plans"""
    try:
        plans = await test_generation_service.get_test_plans(skip, limit, db)
        return plans
    except Exception as e:
        logger.error(f"Error getting test plans: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/test-cases", response_model=List[TestCase])
async def get_test_cases(
    plan_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get test cases, optionally filtered by plan"""
    try:
        cases = await test_generation_service.get_test_cases(plan_id, skip, limit, db)
        return cases
    except Exception as e:
        logger.error(f"Error getting test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/test-runs", response_model=List[TestRun])
async def get_test_runs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get test runs"""
    try:
        runs = await test_execution_service.get_test_runs(skip, limit, db)
        return runs
    except Exception as e:
        logger.error(f"Error getting test runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Vector Search Endpoints (for pgvector integration)
@app.post("/api/v1/search/similar-tests")
async def find_similar_tests(
    query: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Find similar test cases using vector similarity"""
    try:
        similar_tests = await test_generation_service.find_similar_tests(query, limit, db)
        return {"similar_tests": similar_tests}
    except Exception as e:
        logger.error(f"Error finding similar tests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/search/similar-defects")
async def find_similar_defects(
    error_message: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Find similar defects using vector similarity"""
    try:
        similar_defects = await defect_analysis_service.find_similar_defects(error_message, limit, db)
        return {"similar_defects": similar_defects}
    except Exception as e:
        logger.error(f"Error finding similar defects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting QA AI Platform API...")
    
    # Initialize database connections
    await test_generation_service.initialize()
    await defect_analysis_service.initialize()
    await test_execution_service.initialize()
    
    logger.info("QA AI Platform API started successfully!")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down QA AI Platform API...")
    
    # Cleanup connections
    await test_generation_service.cleanup()
    await defect_analysis_service.cleanup()
    await test_execution_service.cleanup()
    
    logger.info("QA AI Platform API shutdown complete!")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
