"""
Enterprise Scale API Router
===========================
Production-ready endpoints for large-scale test management.

Features:
- Paginated queries (default 50 items/page)
- Server-side search and filtering
- Automatic caching via ScaleDataService
- Optimized for 100K+ test cases

Endpoints:
- GET /api/v2/summary          - Quick counts (cached 1 min)
- GET /api/v2/test-cases       - Paginated list (cached 2 min)
- GET /api/v2/test-cases/{id}  - Single test case with steps (cached 5 min)
- GET /api/v2/suites           - Paginated suites
- GET /api/v2/plans            - Paginated plans
- GET /api/v2/releases         - Paginated releases
- POST /api/v2/cache/invalidate - Clear cache
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.services.storage import get_scale_data_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2", tags=["Enterprise Scale API"])


@router.get("/summary")
async def get_summary():
    """
    Get summary counts for dashboard.
    
    Returns counts of test cases, suites, plans, releases.
    Cached for 60 seconds for instant response.
    """
    service = get_scale_data_service()
    return await service.get_summary()


@router.get("/test-cases")
async def get_test_cases(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    priority: Optional[str] = Query(None, description="Filter by priority: high, medium, low"),
    status: Optional[str] = Query(None, description="Filter by automation status: none, partial, full"),
    folder_id: Optional[str] = Query(None, description="Filter by folder ID"),
    sort_by: str = Query("updated_at", description="Sort field: name, priority, updated_at, created_at"),
    sort_order: str = Query("desc", description="Sort order: asc, desc")
):
    """
    Get paginated test cases.
    
    Optimized for large datasets - returns lightweight list items without steps.
    Use GET /test-cases/{id} to get full test case with steps.
    
    Example:
        /api/v2/test-cases?page=1&limit=50&search=login&priority=high
    """
    service = get_scale_data_service()
    return await service.get_test_cases(
        page=page,
        limit=limit,
        search=search,
        priority=priority,
        status=status,
        folder_id=folder_id,
        sort_by=sort_by,
        sort_order=sort_order
    )


@router.get("/test-cases/{test_case_id}")
async def get_test_case(test_case_id: str):
    """
    Get single test case with full details including all steps.
    
    Use this endpoint when opening a test case in the builder/editor.
    Cached for 5 minutes.
    """
    service = get_scale_data_service()
    result = await service.get_test_case(test_case_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Test case not found")
    
    return result


@router.get("/suites")
async def get_suites(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200)
):
    """Get paginated test suites."""
    service = get_scale_data_service()
    return await service.get_suites(page=page, limit=limit)


@router.get("/plans")
async def get_plans(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200)
):
    """Get paginated test plans."""
    service = get_scale_data_service()
    return await service.get_plans(page=page, limit=limit)


@router.get("/releases")
async def get_releases(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200)
):
    """Get paginated releases."""
    service = get_scale_data_service()
    return await service.get_releases(page=page, limit=limit)


@router.post("/cache/invalidate")
async def invalidate_cache(pattern: str = "scale:*"):
    """
    Invalidate cache entries.
    
    Call this after bulk data changes to ensure fresh data.
    Default pattern 'scale:*' clears all scale data cache.
    """
    service = get_scale_data_service()
    await service.invalidate_cache(pattern)
    return {"status": "ok", "message": f"Cache invalidated for pattern: {pattern}"}


# Health check for the scale service
@router.get("/health")
async def health_check():
    """Check if scale data service is healthy."""
    try:
        service = get_scale_data_service()
        summary = await service.get_summary()
        return {
            "status": "healthy",
            "database": "connected",
            "counts": summary
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }




