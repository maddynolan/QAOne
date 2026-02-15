"""
Automation API Endpoints
Provides endpoints for script conversion, test execution, and locator analysis.
"""

import logging
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Optional
from pydantic import BaseModel

from app.services.automation.script_converter import get_script_converter
from app.services.automation.test_execution_service import get_test_execution_service
from app.services.automation.locator_engine import get_locator_engine
from app.services.automation.auto_healing_service import get_auto_healing_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/automation", tags=["automation"])


class ScriptConversionRequest(BaseModel):
    source_code: str
    source_framework: str = "auto"  # selenium, cypress, webdriverio, auto


class TestExecutionRequest(BaseModel):
    test_code: str
    test_name: str = "flowstral_test"
    browser: str = "chromium"  # chromium, firefox, webkit
    headless: bool = True
    timeout: int = 30000
    environment: str = "local"


class LocatorAnalysisRequest(BaseModel):
    element_html: str
    element_text: Optional[str] = None
    element_attributes: Optional[Dict[str, str]] = None
    context: Optional[Dict[str, Any]] = None


@router.post("/convert-script")
async def convert_script(request: ScriptConversionRequest) -> Dict[str, Any]:
    """
    Convert test script from another framework to Playwright.
    
    Supports: Selenium, Cypress, WebDriverIO
    """
    try:
        converter = get_script_converter()
        result = converter.convert_to_playwright(
            source_code=request.source_code,
            source_framework=request.source_framework
        )
        
        return {
            "status": "success",
            "converted_code": result["converted_code"],
            "source_framework": result["source_framework"],
            "target_framework": "playwright",
            "conversion_notes": result.get("conversion_notes", []),
            "message": f"Successfully converted {result['source_framework']} script to Playwright"
        }
    except Exception as e:
        logger.error(f"Script conversion failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Script conversion failed: {str(e)}")


@router.post("/execute-test")
async def execute_test(request: TestExecutionRequest) -> Dict[str, Any]:
    """
    Execute Playwright test code.
    
    Returns execution results with screenshots, videos, and traces.
    """
    try:
        execution_service = get_test_execution_service()
        result = await execution_service.execute_test(
            test_code=request.test_code,
            test_name=request.test_name,
            browser=request.browser,
            headless=request.headless,
            timeout=request.timeout,
            environment=request.environment
        )
        
        # Create a test run entry for tracking (same as Flowstral endpoint)
        test_run_id = None
        try:
            logger.info(f"[AUTOMATION EXECUTE] Attempting to create test run for test: {request.test_name}")
            from app.services.storage.postgres_direct import execute_insert, ensure_default_org_project
            import asyncio
            
            # Add timeout to prevent hanging
            try:
                org_id, project_id = await asyncio.wait_for(
                    ensure_default_org_project(),
                    timeout=5.0  # 5 second timeout
                )
                logger.info(f"[AUTOMATION EXECUTE] Got project_id: {project_id}, org_id: {org_id}")
            except asyncio.TimeoutError:
                logger.error(f"[AUTOMATION EXECUTE] ⚠️ ensure_default_org_project() timed out after 5 seconds")
                raise Exception("Database connection timeout - test run creation skipped")
            except Exception as e:
                logger.error(f"[AUTOMATION EXECUTE] ⚠️ ensure_default_org_project() failed: {e}")
                raise
            
            # Create test run entry
            run_data = {
                "project_id": project_id,
                "name": f"Automation Test - {request.test_name}",
                "status": "passed" if result.get("status") == "success" else "failed",
                "environment": request.environment or "local",
                "created_by": "22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
            }
            
            logger.info(f"[AUTOMATION EXECUTE] Creating test run with data: {run_data}")
            try:
                test_run_id = await asyncio.wait_for(
                    execute_insert("test_runs", run_data),
                    timeout=5.0  # 5 second timeout
                )
                if test_run_id:
                    logger.info(f"[AUTOMATION EXECUTE] ✅ Created test run {test_run_id} for test: {request.test_name}")
                else:
                    logger.warning(f"[AUTOMATION EXECUTE] ⚠️ execute_insert returned None for test run")
            except asyncio.TimeoutError:
                logger.error(f"[AUTOMATION EXECUTE] ⚠️ execute_insert() timed out after 5 seconds")
            except Exception as insert_error:
                logger.error(f"[AUTOMATION EXECUTE] ⚠️ execute_insert() failed: {insert_error}")
        except Exception as e:
            logger.error(f"[AUTOMATION EXECUTE] ❌ Failed to create test run entry: {e}", exc_info=True)
            # Don't fail the execution if test run creation fails
        
        return {
            "status": "success",
            "execution_result": result,
            "test_run_id": test_run_id,
            "message": f"Test execution completed with status: {result.get('status')}"
        }
    except Exception as e:
        logger.error(f"Test execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Test execution failed: {str(e)}")


@router.post("/analyze-locator")
async def analyze_locator(request: LocatorAnalysisRequest) -> Dict[str, Any]:
    """
    Analyze element and generate optimal locator with fallback chain.
    
    Returns industry-standard locator strategy with confidence scores.
    """
    try:
        locator_engine = get_locator_engine()
        result = locator_engine.generate_optimal_locator(
            element_html=request.element_html,
            element_text=request.element_text,
            element_attributes=request.element_attributes,
            context=request.context
        )
        
        return {
            "status": "success",
            "locator_info": result,
            "message": f"Generated locator with strategy: {result.get('strategy')}, confidence: {result.get('confidence', 0):.2%}"
        }
    except Exception as e:
        logger.error(f"Locator analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Locator analysis failed: {str(e)}")


@router.post("/generate-auto-healing-code")
async def generate_auto_healing_code(
    locator_info: Dict[str, Any] = Body(...),
    action: str = Body("click")
) -> Dict[str, Any]:
    """
    Generate Playwright code with auto-healing capabilities.
    
    Args:
        locator_info: Locator information from analyze-locator endpoint
        action: Action to perform (click, fill, select, check)
    """
    try:
        auto_healing_service = get_auto_healing_service()
        code = auto_healing_service.generate_auto_healing_code(
            locator_info=locator_info,
            action=action
        )
        
        return {
            "status": "success",
            "code": code,
            "message": f"Generated auto-healing code for {action} action"
        }
    except Exception as e:
        logger.error(f"Auto-healing code generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Auto-healing code generation failed: {str(e)}")


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check for automation services."""
    return {
        "status": "healthy",
        "services": {
            "script_converter": "available",
            "test_execution": "available",
            "locator_engine": "available",
            "auto_healing": "available"
        }
    }




