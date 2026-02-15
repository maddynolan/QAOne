"""
CodeAlchemy API
===============

REST API endpoints for the Repository-to-Test-Case transformation pipeline.

Endpoints:
- POST /api/code-alchemy/analyze - Analyze a repository
- GET /api/code-alchemy/branches - List branches for a repository
- GET /api/code-alchemy/analysis/{id} - Get analysis result
- GET /api/code-alchemy/analysis/{id}/preview - Get test cases preview
- GET /api/code-alchemy/analysis/{id}/tags - Get available tags
- POST /api/code-alchemy/import - Import test cases
- GET /api/code-alchemy/import/{job_id} - Get import job status
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.code_alchemy import (
    CodeAlchemyService,
    get_code_alchemy_service
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/code-alchemy", tags=["CodeAlchemy"])


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class AnalyzeRequest(BaseModel):
    """Request to analyze a repository."""
    url: str
    branch: str = "main"
    token: Optional[str] = None
    path: Optional[str] = None


class BranchesRequest(BaseModel):
    """Request to list branches."""
    url: str
    token: Optional[str] = None


class ImportRequest(BaseModel):
    """Request to import test cases."""
    analysis_id: str
    selected_ids: List[str]
    target_suite_id: Optional[str] = None
    target_suite_name: str = "Imported Test Cases"
    options: Optional[dict] = None


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/analyze")
async def analyze_repository(request: AnalyzeRequest):
    """
    Analyze a repository and extract all test methods.
    
    Supports:
    - GitHub (public & private)
    - GitLab (cloud & self-hosted)
    - Bitbucket (cloud & server)
    - Azure DevOps
    
    Returns analysis result with:
    - Framework detection
    - Test method count
    - Test cases preview (no code)
    """
    try:
        logger.info(f"CodeAlchemy: Analyzing {request.url}")
        
        service = get_code_alchemy_service()
        result = await service.analyze_repository(
            url=request.url,
            branch=request.branch,
            token=request.token,
            path=request.path
        )
        
        if not result.success:
            raise HTTPException(status_code=400, detail=result.error_message)
        
        return result.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/branches")
async def list_branches(request: BranchesRequest):
    """
    List available branches for a repository.
    
    Useful for letting users select which branch to analyze.
    """
    try:
        service = get_code_alchemy_service()
        branches = await service.detect_branches(
            url=request.url,
            token=request.token
        )
        
        return {"branches": branches}
        
    except Exception as e:
        logger.error(f"Failed to list branches: {e}")
        # Return default branches on failure
        return {"branches": ["main", "master"]}


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """
    Get a cached analysis result.
    
    Returns the full analysis result including all test cases.
    """
    try:
        service = get_code_alchemy_service()
        result = service.get_analysis_result(analysis_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return result.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{analysis_id}/preview")
async def get_test_cases_preview(
    analysis_id: str,
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter"),
    priority: Optional[str] = Query(None, description="Priority filter"),
    search: Optional[str] = Query(None, description="Search in name/description")
):
    """
    Get test cases preview (no code shown).
    
    Returns minimal info for UI display:
    - id, name, description, priority, tags
    - step_count, assertion_count
    - original_file (filename only)
    
    Supports filtering by tags, priority, and search.
    """
    try:
        service = get_code_alchemy_service()
        
        filter_tags = tags.split(",") if tags else None
        
        previews = service.get_test_cases_preview(
            analysis_id=analysis_id,
            filter_tags=filter_tags,
            filter_priority=priority,
            search=search
        )
        
        return {
            "testCases": previews,
            "total": len(previews)
        }
        
    except Exception as e:
        logger.error(f"Failed to get preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{analysis_id}/tags")
async def get_available_tags(analysis_id: str):
    """
    Get all unique tags from the analysis result.
    
    Useful for building filter UI.
    """
    try:
        service = get_code_alchemy_service()
        tags = service.get_available_tags(analysis_id)
        
        return {"tags": tags}
        
    except Exception as e:
        logger.error(f"Failed to get tags: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import")
async def import_test_cases(request: ImportRequest):
    """
    Import selected test cases into the Builder database.
    
    The imported test cases are FULLY EXECUTABLE - they can run
    just like tests created manually in the Builder.
    
    Returns an import job for tracking progress.
    """
    try:
        logger.info(f"CodeAlchemy: Importing {len(request.selected_ids)} test cases")
        
        service = get_code_alchemy_service()
        job = await service.import_test_cases(
            analysis_id=request.analysis_id,
            selected_ids=request.selected_ids,
            target_suite_id=request.target_suite_id,
            target_suite_name=request.target_suite_name,
            options=request.options
        )
        
        return job.to_dict()
        
    except Exception as e:
        logger.error(f"Import failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/import/{job_id}")
async def get_import_status(job_id: str):
    """
    Get the status of an import job.
    
    Returns:
    - status (pending, importing, completed, failed)
    - progress_percent
    - imported_count
    - errors
    """
    try:
        service = get_code_alchemy_service()
        job = service.get_import_job_status(job_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        return job.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get import status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "CodeAlchemy",
        "version": "1.0.0"
    }



