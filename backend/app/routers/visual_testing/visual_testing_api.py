"""
Visual Testing API
==================

REST API endpoints for robust visual regression testing.

Features:
- Multiple comparison modes
- Baseline management (CRUD)
- Batch comparison
- Ignore region configuration
- Diff image generation
"""

import logging
import os
import re
import base64
import json
import asyncio
import subprocess
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/visual-testing", tags=["Visual Testing"])

# ==================== Security Constants ====================

MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB

_TEST_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_\-\.]+$')


def _validate_test_name(test_name: str) -> None:
    """Validate test_name does not contain path traversal characters."""
    if not _TEST_NAME_PATTERN.match(test_name):
        raise HTTPException(
            status_code=400,
            detail="test_name must contain only alphanumeric characters, underscores, hyphens, and dots"
        )


def _validate_base64_image_size(data: str, field_name: str = "image") -> None:
    """Validate that base64 image data doesn't exceed MAX_IMAGE_SIZE when decoded."""
    # base64 encodes 3 bytes into 4 characters; estimate decoded size
    estimated_size = len(data) * 3 // 4
    if estimated_size > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB"
        )


# ==================== Pydantic Models ====================

class IgnoreRegionModel(BaseModel):
    """Region to ignore during comparison"""
    x: int = Field(..., ge=0, le=100000, description="X coordinate")
    y: int = Field(..., ge=0, le=100000, description="Y coordinate")
    width: int = Field(..., ge=1, le=100000, description="Width in pixels")
    height: int = Field(..., ge=1, le=100000, description="Height in pixels")
    name: str = Field("", max_length=200, description="Optional name for the region")
    reason: str = Field("", max_length=500, description="Reason for ignoring (e.g., 'timestamp', 'ad')")


VALID_COMPARISON_MODES = {"pixel_perfect", "anti_aliased", "perceptual", "structural", "layout", "ai_semantic", "dynamic"}


class StepVisualAssertRequest(BaseModel):
    """Request to compare a step screenshot against its baseline, or save as new baseline."""
    test_name: str = Field(..., max_length=200, description="Test name for baseline grouping")
    step_index: int = Field(0, ge=0, le=100000, description="Step index within the test")
    screenshot: str = Field(..., description="Step screenshot as base64-encoded PNG")
    mode: str = Field("anti_aliased", description="Comparison mode")
    threshold: float = Field(0.1, ge=0.0, le=1.0, description="Allowed difference (0.0-1.0)")
    auto_baseline: bool = Field(True, description="Automatically save as baseline on first run")
    ignore_regions: List[IgnoreRegionModel] = Field(default_factory=list)


class CompareRequest(BaseModel):
    """Request to compare two images"""
    baseline: str = Field(..., description="Baseline image (path or base64)")
    actual: str = Field(..., description="Actual image (path or base64)")
    mode: str = Field("anti_aliased", description="Comparison mode")
    threshold: float = Field(0.1, ge=0.0, le=1.0, description="Allowed difference (0.0-1.0)")
    ignore_regions: List[IgnoreRegionModel] = Field(default_factory=list)
    test_name: str = Field("visual_test", max_length=200, description="Test name for reporting")


class CompareByNameRequest(BaseModel):
    """Request to compare actual image against stored baseline"""
    test_name: str = Field(..., max_length=200, description="Test name to match baseline")
    actual: str = Field(..., description="Actual image (base64)")
    mode: str = Field("anti_aliased", description="Comparison mode")
    threshold: float = Field(0.1, ge=0.0, le=1.0, description="Allowed difference (0.0-1.0)")
    ignore_regions: List[IgnoreRegionModel] = Field(default_factory=list)


class SaveBaselineRequest(BaseModel):
    """Request to save a new baseline"""
    test_name: str = Field(..., max_length=200, description="Unique test name")
    image: str = Field(..., description="Image as base64")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Optional metadata")


class UpdateBaselineRequest(BaseModel):
    """Request to update an existing baseline"""
    test_name: str = Field(..., max_length=200, description="Test name")
    image: str = Field(..., description="New baseline image as base64")
    reason: str = Field("", max_length=500, description="Reason for update")


class BatchCompareRequest(BaseModel):
    """Request to compare multiple images"""
    comparisons: List[CompareByNameRequest] = Field(..., max_length=50, description="List of comparisons (max 50)")


# ==================== API Endpoints ====================

@router.post("/step-assert")
async def step_visual_assert(request: StepVisualAssertRequest) -> Dict[str, Any]:
    """
    Compare a step screenshot against its baseline, or save as new baseline.

    Used by the test execution pipeline to add per-step visual assertions.
    On the first run (no baseline exists), the screenshot is saved as the baseline
    if auto_baseline is True. On subsequent runs, the screenshot is compared
    against the stored baseline using the specified comparison mode and threshold.
    """
    # Validate test_name for path traversal
    _validate_test_name(request.test_name)

    # Validate base64 image size
    _validate_base64_image_size(request.screenshot, "screenshot")

    # Build the composite baseline name: {test_name}_step_{step_index}
    baseline_name = f"{request.test_name}_step_{request.step_index}"

    # Validate the composite name as well
    _validate_test_name(baseline_name)

    try:
        from app.services.automation.visual_testing_engine import (
            VisualTestingEngine,
            ComparisonOptions,
            ComparisonMode,
            IgnoreRegion
        )

        engine = VisualTestingEngine()

        # Check if baseline exists
        baseline_path = engine.get_baseline(baseline_name)

        if not baseline_path:
            if request.auto_baseline:
                # First run — save as new baseline
                screenshot_bytes = base64.b64decode(request.screenshot)
                engine.save_baseline(screenshot_bytes, baseline_name, {
                    "source_test": request.test_name,
                    "step_index": request.step_index,
                    "auto_created": True
                })
                return {
                    "success": True,
                    "passed": True,
                    "baseline_saved": True,
                    "message": f"Baseline saved for step {request.step_index} (first run)"
                }
            else:
                return {
                    "success": True,
                    "passed": True,
                    "baseline_saved": False,
                    "message": "No baseline exists and auto_baseline is disabled"
                }

        # Baseline exists — compare against it
        screenshot_bytes = base64.b64decode(request.screenshot)

        # Parse comparison mode
        try:
            mode = ComparisonMode(request.mode)
        except ValueError:
            mode = ComparisonMode.ANTI_ALIASED

        # Build ignore regions
        regions = [
            IgnoreRegion(
                x=r.x, y=r.y, width=r.width, height=r.height,
                name=r.name, reason=r.reason
            )
            for r in request.ignore_regions
        ]

        options = ComparisonOptions(
            mode=mode,
            threshold=request.threshold,
            ignore_regions=regions,
            generate_diff=True
        )

        result = engine.compare(baseline_path, screenshot_bytes, options, baseline_name)

        return {
            "success": True,
            "passed": result.passed,
            "diff_percentage": result.diff_percentage,
            "diff_image_base64": result.diff_image_base64,
            "baseline_saved": False,
            "mode": request.mode,
            "threshold": request.threshold,
            "ssim_score": result.ssim_score
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in step visual assert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during step visual assertion")


@router.post("/compare")
async def compare_images(request: CompareRequest) -> Dict[str, Any]:
    """
    Compare two images and return detailed comparison result.

    Supports multiple comparison modes:
    - pixel_perfect: Strict pixel-by-pixel comparison
    - anti_aliased: Allows anti-aliasing differences (recommended)
    - perceptual: Perceptual hash comparison (tolerant of minor changes)
    - structural: SSIM-based structural comparison
    - layout: Focus on layout, ignore content changes
    """
    # Base64 image size validation (only for base64 inputs, not file paths)
    if len(request.baseline) > 200:
        _validate_base64_image_size(request.baseline, "baseline")
    if len(request.actual) > 200:
        _validate_base64_image_size(request.actual, "actual")

    try:
        from app.services.automation.visual_testing_engine import (
            VisualTestingEngine, 
            ComparisonOptions,
            ComparisonMode,
            IgnoreRegion
        )
        
        engine = VisualTestingEngine()
        
        # Parse mode
        try:
            mode = ComparisonMode(request.mode)
        except ValueError:
            mode = ComparisonMode.ANTI_ALIASED
        
        # Build ignore regions
        regions = [
            IgnoreRegion(
                x=r.x, y=r.y, width=r.width, height=r.height,
                name=r.name, reason=r.reason
            )
            for r in request.ignore_regions
        ]
        
        options = ComparisonOptions(
            mode=mode,
            threshold=request.threshold,
            ignore_regions=regions,
            generate_diff=True
        )
        
        # Handle base64 input
        baseline = request.baseline
        actual = request.actual
        
        if not Path(baseline).exists() and len(baseline) > 200:
            baseline = base64.b64decode(baseline)
        if not Path(actual).exists() and len(actual) > 200:
            actual = base64.b64decode(actual)
        
        result = engine.compare(baseline, actual, options, request.test_name)
        
        return {
            "success": True,
            "result": result.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Error comparing images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during image comparison")


@router.post("/compare-by-name")
async def compare_by_baseline_name(request: CompareByNameRequest) -> Dict[str, Any]:
    """
    Compare an actual image against a stored baseline by test name.

    This is the recommended approach for CI/CD pipelines.
    """
    # Path traversal prevention
    _validate_test_name(request.test_name)

    # Base64 image size validation
    _validate_base64_image_size(request.actual, "actual")

    try:
        from app.services.automation.visual_testing_engine import (
            VisualTestingEngine, 
            ComparisonOptions,
            ComparisonMode,
            IgnoreRegion
        )
        
        engine = VisualTestingEngine()
        
        # Get baseline path
        baseline_path = engine.get_baseline(request.test_name)
        
        if not baseline_path:
            # Return passed=False with is_new_baseline flag so CI pipelines
            # fail explicitly rather than silently passing with no comparison
            return {
                "success": True,
                "result": {
                    "passed": False,
                    "is_new_baseline": True,
                    "diff_percentage": 0.0,
                    "message": f"No baseline exists for '{request.test_name}'. Save a baseline first, then re-run."
                }
            }
        
        # Parse mode
        try:
            mode = ComparisonMode(request.mode)
        except ValueError:
            mode = ComparisonMode.ANTI_ALIASED
        
        # Build ignore regions
        regions = [
            IgnoreRegion(
                x=r.x, y=r.y, width=r.width, height=r.height,
                name=r.name, reason=r.reason
            )
            for r in request.ignore_regions
        ]
        
        options = ComparisonOptions(
            mode=mode,
            threshold=request.threshold,
            ignore_regions=regions,
            generate_diff=True
        )
        
        # Decode actual image
        actual_bytes = base64.b64decode(request.actual)
        
        result = engine.compare(baseline_path, actual_bytes, options, request.test_name)
        
        return {
            "success": True,
            "result": result.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Error comparing by name: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during baseline comparison")


@router.post("/batch-compare")
async def batch_compare(request: BatchCompareRequest) -> Dict[str, Any]:
    """
    Compare multiple images in batch.
    
    Useful for running visual regression tests for multiple pages/components.
    """
    try:
        results = []
        passed_count = 0
        failed_count = 0
        
        for comparison in request.comparisons:
            result = await compare_by_baseline_name(comparison)
            
            if result.get("result", {}).get("passed", False):
                passed_count += 1
            else:
                failed_count += 1
            
            results.append({
                "test_name": comparison.test_name,
                **result
            })
        
        return {
            "success": True,
            "summary": {
                "total": len(results),
                "passed": passed_count,
                "failed": failed_count,
                "pass_rate": passed_count / len(results) if results else 0
            },
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Error in batch compare: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during batch comparison")


# ==================== Baseline Management ====================

@router.get("/baselines")
async def list_baselines() -> Dict[str, Any]:
    """List all stored baselines with metadata"""
    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        
        engine = VisualTestingEngine()
        baselines = engine.list_baselines()
        
        return {
            "success": True,
            "count": len(baselines),
            "baselines": baselines
        }
        
    except Exception as e:
        logger.error(f"Error listing baselines: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while listing baselines")


@router.get("/baselines/{test_name}")
async def get_baseline(test_name: str) -> Dict[str, Any]:
    """Get baseline info and image for a specific test"""
    # Path traversal prevention
    _validate_test_name(test_name)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        from PIL import Image
        import io
        
        engine = VisualTestingEngine()
        baseline_path = engine.get_baseline(test_name)
        
        if not baseline_path:
            raise HTTPException(status_code=404, detail=f"Baseline '{test_name}' not found")
        
        metadata = engine.get_baseline_metadata(test_name)
        
        # Load and encode image
        with open(baseline_path, 'rb') as f:
            image_bytes = f.read()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        return {
            "success": True,
            "test_name": test_name,
            "path": str(baseline_path),
            "image_base64": image_base64,
            "metadata": metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving baseline")


@router.get("/baselines/{test_name}/image")
async def get_baseline_image(test_name: str):
    """Get baseline image file directly"""
    # Path traversal prevention
    _validate_test_name(test_name)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        
        engine = VisualTestingEngine()
        baseline_path = engine.get_baseline(test_name)
        
        if not baseline_path:
            raise HTTPException(status_code=404, detail=f"Baseline '{test_name}' not found")
        
        return FileResponse(
            baseline_path,
            media_type="image/png",
            filename=f"{test_name}.png"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting baseline image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving baseline image")


@router.post("/baselines")
async def save_baseline(request: SaveBaselineRequest) -> Dict[str, Any]:
    """Save a new baseline image"""
    # Path traversal prevention
    _validate_test_name(request.test_name)

    # Base64 image size validation
    _validate_base64_image_size(request.image)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine

        engine = VisualTestingEngine()

        # Check if baseline already exists
        existing = engine.get_baseline(request.test_name)
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Baseline '{request.test_name}' already exists. Use PUT to update."
            )
        
        # Decode image
        image_bytes = base64.b64decode(request.image)
        
        path = engine.save_baseline(
            image_bytes,
            request.test_name,
            request.metadata
        )
        
        return {
            "success": True,
            "message": f"Baseline saved successfully",
            "test_name": request.test_name,
            "path": path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while saving baseline")


@router.put("/baselines/{test_name}")
async def update_baseline(test_name: str, request: UpdateBaselineRequest) -> Dict[str, Any]:
    """Update an existing baseline (with history tracking)"""
    # Path traversal prevention
    _validate_test_name(test_name)

    # Base64 image size validation
    _validate_base64_image_size(request.image)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine

        engine = VisualTestingEngine()

        # Check if baseline exists
        existing = engine.get_baseline(test_name)
        if not existing:
            raise HTTPException(
                status_code=404,
                detail=f"Baseline '{test_name}' not found. Use POST to create a new baseline."
            )

        # Decode image
        image_bytes = base64.b64decode(request.image)

        path = engine.update_baseline(
            test_name,
            image_bytes,
            request.reason
        )

        return {
            "success": True,
            "message": f"Baseline updated successfully",
            "test_name": test_name,
            "path": path,
            "update_reason": request.reason
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while updating baseline")


@router.delete("/baselines/{test_name}")
async def delete_baseline(test_name: str) -> Dict[str, Any]:
    """Delete a baseline"""
    # Path traversal prevention
    _validate_test_name(test_name)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        
        engine = VisualTestingEngine()
        deleted = engine.delete_baseline(test_name)
        
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Baseline '{test_name}' not found")
        
        return {
            "success": True,
            "message": f"Baseline '{test_name}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while deleting baseline")


# ==================== Diff Management ====================

@router.get("/diffs")
async def list_diffs(
    test_name: Optional[str] = Query(None, description="Filter by test name"),
    limit: int = Query(50, description="Maximum number of diffs to return")
) -> Dict[str, Any]:
    """List generated diff images"""
    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        
        engine = VisualTestingEngine()
        
        diffs = []
        for path in sorted(engine.diffs_dir.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True):
            if test_name and test_name not in path.stem:
                continue
            
            diffs.append({
                "filename": path.name,
                "path": str(path),
                "created_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
                "size": path.stat().st_size
            })
            
            if len(diffs) >= limit:
                break
        
        return {
            "success": True,
            "count": len(diffs),
            "diffs": diffs
        }
        
    except Exception as e:
        logger.error(f"Error listing diffs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while listing diffs")


_DIFF_FILENAME_PATTERN = re.compile(r'^[a-zA-Z0-9_\-\.]+\.png$')


@router.get("/diffs/{filename}")
async def get_diff_image(filename: str):
    """Get a specific diff image"""
    # Path traversal prevention on diff filenames
    if not _DIFF_FILENAME_PATTERN.match(filename):
        raise HTTPException(
            status_code=400,
            detail="filename must contain only alphanumeric characters, underscores, hyphens, dots, and must end with .png"
        )

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine

        engine = VisualTestingEngine()
        diff_path = engine.diffs_dir / filename

        # Ensure resolved path is still within diffs_dir (defense in depth)
        try:
            diff_path.resolve().relative_to(engine.diffs_dir.resolve())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid filename")

        if not diff_path.exists():
            raise HTTPException(status_code=404, detail="Diff image not found")
        
        return FileResponse(
            diff_path,
            media_type="image/png",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting diff: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving diff")


# ==================== Configuration ====================

@router.get("/config")
async def get_config() -> Dict[str, Any]:
    """Get visual testing configuration"""
    try:
        from app.services.automation.visual_testing_engine import (
            VisualTestingEngine,
            ComparisonMode
        )
        
        engine = VisualTestingEngine()
        
        return {
            "success": True,
            "config": {
                "storage_path": str(engine.storage_path),
                "baselines_dir": str(engine.baselines_dir),
                "actuals_dir": str(engine.actuals_dir),
                "diffs_dir": str(engine.diffs_dir),
                "available_modes": [m.value for m in ComparisonMode],
                "recommended_mode": "anti_aliased",
                "default_threshold": 0.1
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while retrieving configuration")


# ==================== Upload Endpoints (for multipart form data) ====================

@router.post("/upload/compare")
async def upload_and_compare(
    baseline: UploadFile = File(..., description="Baseline image file"),
    actual: UploadFile = File(..., description="Actual image file"),
    mode: str = Form("anti_aliased", description="Comparison mode"),
    threshold: float = Form(0.1, description="Allowed difference"),
    test_name: str = Form("upload_test", description="Test name")
) -> Dict[str, Any]:
    """
    Upload two images and compare them.

    Useful for manual testing through Swagger UI or forms.
    """
    # Validate test_name for path traversal
    _validate_test_name(test_name)

    # Validate threshold bounds
    if not (0.0 <= threshold <= 1.0):
        raise HTTPException(status_code=400, detail="threshold must be between 0.0 and 1.0")

    try:
        from app.services.automation.visual_testing_engine import (
            VisualTestingEngine, 
            ComparisonOptions,
            ComparisonMode as CM
        )
        
        engine = VisualTestingEngine()
        
        # Read uploaded files with size validation
        baseline_bytes = await baseline.read()
        actual_bytes = await actual.read()

        if len(baseline_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail=f"Baseline image exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB")
        if len(actual_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail=f"Actual image exceeds maximum allowed size of {MAX_IMAGE_SIZE // (1024 * 1024)}MB")

        # Parse mode
        try:
            comparison_mode = CM(mode)
        except ValueError:
            comparison_mode = CM.ANTI_ALIASED
        
        options = ComparisonOptions(
            mode=comparison_mode,
            threshold=threshold,
            generate_diff=True
        )
        
        result = engine.compare(baseline_bytes, actual_bytes, options, test_name)
        
        return {
            "success": True,
            "result": result.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Error in upload compare: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during upload comparison")


@router.post("/upload/baseline")
async def upload_baseline(
    image: UploadFile = File(..., description="Baseline image file"),
    test_name: str = Form(..., description="Unique test name")
) -> Dict[str, Any]:
    """
    Upload and save a baseline image.
    """
    # Path traversal prevention
    _validate_test_name(test_name)

    try:
        from app.services.automation.visual_testing_engine import VisualTestingEngine
        
        engine = VisualTestingEngine()
        
        # Check if exists
        existing = engine.get_baseline(test_name)
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Baseline '{test_name}' already exists"
            )
        
        # Read and save
        image_bytes = await image.read()
        path = engine.save_baseline(image_bytes, test_name)
        
        return {
            "success": True,
            "message": "Baseline uploaded successfully",
            "test_name": test_name,
            "path": path
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while uploading baseline")


# ==================== Helper Endpoints ====================

@router.post("/capture")
async def capture_screenshot(
    url: str = Form(..., description="URL to capture"),
    test_name: str = Form(..., description="Test name for the screenshot"),
    full_page: bool = Form(True, description="Capture full page"),
    viewport_width: int = Form(1920, description="Viewport width"),
    viewport_height: int = Form(1080, description="Viewport height"),
    wait_for_selector: Optional[str] = Form(None, description="Wait for selector before capture"),
    save_as_baseline: bool = Form(False, description="Save as baseline")
) -> Dict[str, Any]:
    """
    Capture a screenshot from a URL.

    Uses Playwright to render the page and capture a screenshot.
    Optionally saves it as a baseline.

    SECURITY WARNING: Screenshots may contain PII (personally identifiable information)
    visible on the captured page. Screenshots are stored server-side and returned as
    base64. Ensure that screenshot storage is access-controlled and that screenshots
    of pages containing sensitive data (login forms, user profiles, financial data)
    are treated as sensitive artifacts. Consider using ignore regions to mask PII areas.
    """
    # SSRF prevention: validate URL before navigating
    from app.utils.url_validator import validate_url
    try:
        validate_url(url)
    except ValueError as url_err:
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(url_err)}")

    # Path traversal prevention
    _validate_test_name(test_name)

    try:
        import subprocess
        import sys
        import json as json_mod
        from app.services.automation.visual_testing_engine import VisualTestingEngine

        engine = VisualTestingEngine()

        # Run Playwright in a subprocess to avoid Windows asyncio event loop
        # incompatibilities with uvicorn (NotImplementedError on create_subprocess_exec)
        script_path = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "services", "automation", "visual_capture_subprocess.py"
        )
        script_path = os.path.abspath(script_path)

        cmd = [
            sys.executable, script_path,
            url,
            str(viewport_width),
            str(viewport_height),
            str(full_page),
            wait_for_selector or "None"
        ]

        logger.info(f"[Visual] Capturing screenshot via subprocess: {url}")
        result = await asyncio.to_thread(
            subprocess.run,
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.path.dirname(script_path)
        )

        if result.returncode != 0 or not result.stdout:
            error_msg = result.stderr[:500] if result.stderr else f"Capture exited with code {result.returncode}"
            logger.error(f"[Visual] Capture subprocess failed: {error_msg}")
            raise HTTPException(status_code=500, detail="Screenshot capture failed")

        data = json_mod.loads(result.stdout)
        if data.get("error"):
            logger.error(f"[Visual] Capture error: {data['error']}")
            raise HTTPException(status_code=500, detail="Screenshot capture failed")

        screenshot_bytes = base64.b64decode(data["screenshot_base64"])
        logger.info(f"[Visual] Screenshot captured: {len(screenshot_bytes)} bytes")

        # Save as baseline if requested
        if save_as_baseline:
            path = engine.save_baseline(screenshot_bytes, test_name, {
                "url": url,
                "viewport": f"{viewport_width}x{viewport_height}",
                "full_page": full_page
            })

            return {
                "success": True,
                "message": "Screenshot captured and saved as baseline",
                "test_name": test_name,
                "path": path,
                "image_base64": data["screenshot_base64"]
            }
        else:
            # Save to actuals directory
            safe_name = engine._safe_filename(test_name)
            actual_path = engine.actuals_dir / f"{safe_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"

            with open(actual_path, 'wb') as f:
                f.write(screenshot_bytes)

            return {
                "success": True,
                "message": "Screenshot captured",
                "path": str(actual_path),
                "image_base64": data["screenshot_base64"]
            }

    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        logger.error("[Visual] Screenshot capture timed out after 120s")
        raise HTTPException(status_code=504, detail="Screenshot capture timed out")
    except Exception as e:
        logger.error(f"Error capturing screenshot: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while capturing screenshot")



