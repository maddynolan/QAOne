"""
FLOWSTRAL ENGINE API
====================
REST API for the Flowstral Automation Engine.

Endpoints:
- POST /flowstral/generate - Generate test code using the engine
- GET /flowstral/plugins - List available app plugins
- POST /flowstral/execute - Execute a test with the engine (future)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)

# Import the engine components
from app.services.flowstral_engine.code_generator import (
    FlowstralCodeGenerator,
    generate_test_from_steps
)
from app.services.flowstral_engine.plugins.enterprise_apps import (
    PLUGIN_REGISTRY,
    detect_app_type
)
from app.services.flowstral_engine.test_builder import (
    FlowstralTestBuilder,
    build_test_from_recording,
    build_test_from_test_case
)
from app.services.flowstral_engine.page_intelligence import (
    PageIntelligenceService,
    EnhancedTestWorkflow,
    process_page_analysis,
    generate_test_from_analysis
)

router = APIRouter(prefix="/flowstral", tags=["Flowstral Engine"])


# ============================================================
# MODELS
# ============================================================

class TestStep(BaseModel):
    """Single test step."""
    action: str  # click, fill, navigate, hover, sf_open_app, etc.
    description: str
    target: Optional[str] = None
    value: Optional[str] = None
    selector: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class GenerateTestRequest(BaseModel):
    """Request to generate test code."""
    test_name: str
    steps: List[TestStep]
    app_type: Optional[str] = "auto"  # salesforce, servicenow, etc.


class GenerateTestResponse(BaseModel):
    """Response with generated test code."""
    success: bool
    test_code: str
    test_name: str
    app_type: str
    step_count: int
    message: str


class PluginInfo(BaseModel):
    """Information about an app plugin."""
    name: str
    framework: str
    loading_selectors: List[str]
    component_count: int


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/generate", response_model=GenerateTestResponse)
async def generate_test(request: GenerateTestRequest):
    """
    Generate Playwright test code using the Flowstral Engine.
    
    The generated code uses intent-based element finding instead of
    brittle CSS selectors, making tests more robust and self-healing.
    """
    try:
        # Convert steps to dict format
        steps_dict = [
            {
                "action": step.action,
                "description": step.description,
                "target": step.target,
                "value": step.value,
                "selector": step.selector,
                "url": step.url,
            }
            for step in request.steps
        ]
        
        # Generate the test
        test_code = generate_test_from_steps(
            test_name=request.test_name,
            steps=steps_dict,
            app_type=request.app_type
        )
        
        return GenerateTestResponse(
            success=True,
            test_code=test_code,
            test_name=request.test_name,
            app_type=request.app_type,
            step_count=len(request.steps),
            message=f"Successfully generated test with {len(request.steps)} steps using Flowstral Engine"
        )
        
    except Exception as e:
        logger.error(f"Failed to generate test: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate test"
        )


@router.get("/plugins")
async def list_plugins():
    """
    List all available app plugins and their capabilities.
    """
    plugins = []
    
    for app_name, plugin_class in PLUGIN_REGISTRY.items():
        if isinstance(plugin_class, str):
            # Handle string reference (e.g., SalesforcePlugin)
            plugins.append({
                "name": app_name,
                "framework": "custom",
                "status": "available",
                "description": f"{app_name.capitalize()} plugin"
            })
        else:
            plugins.append({
                "name": app_name,
                "framework": getattr(plugin_class, 'FRAMEWORK', 'unknown'),
                "status": "available",
                "loading_selectors": getattr(plugin_class, 'LOADING_SELECTORS', []),
                "component_count": len(getattr(plugin_class, 'COMPONENTS', {})),
            })
    
    return {
        "total_plugins": len(plugins),
        "plugins": plugins,
        "supported_apps": list(PLUGIN_REGISTRY.keys())
    }


@router.post("/detect-app")
async def detect_application(url: str):
    """
    Detect the application type from a URL.
    """
    app_type = detect_app_type(url)
    
    return {
        "url": url,
        "detected_app_type": app_type,
        "plugin_available": app_type in PLUGIN_REGISTRY,
    }


@router.get("/component-library/{app_type}")
async def get_component_library(app_type: str):
    """
    Get the component library for a specific app type.
    
    Returns all known selectors and patterns for the app's UI components.
    """
    if app_type == "salesforce":
        from app.services.flowstral_engine.plugins.salesforce_plugin import SalesforcePlugin
        return {
            "app_type": app_type,
            "components": SalesforcePlugin.COMPONENTS,
            "description": "Salesforce Lightning Web Components (LWC) and Aura components"
        }
    
    plugin_class = PLUGIN_REGISTRY.get(app_type)
    if not plugin_class or isinstance(plugin_class, str):
        raise HTTPException(
            status_code=404,
            detail=f"Component library not found for: {app_type}"
        )
    
    return {
        "app_type": app_type,
        "components": getattr(plugin_class, 'COMPONENTS', {}),
        "loading_selectors": getattr(plugin_class, 'LOADING_SELECTORS', []),
    }


# ============================================================
# SALESFORCE-SPECIFIC ENDPOINTS
# ============================================================

@router.get("/salesforce/selectors")
async def get_salesforce_selectors():
    """
    Get all Salesforce component selectors.
    
    Useful for understanding what the engine can find automatically.
    """
    from app.services.flowstral_engine.plugins.salesforce_plugin import SalesforcePlugin
    
    return {
        "app": "salesforce",
        "framework": "Lightning (LWC/Aura)",
        "components": SalesforcePlugin.COMPONENTS,
        "total_component_types": len(SalesforcePlugin.COMPONENTS),
        "usage_tips": {
            "app_launcher": "Use engine.sf_open_app('AppName') for reliable App Launcher interaction",
            "global_search": "Use engine.sf_global_search('text') for global search",
            "tabs": "Use engine.sf_click_tab('TabName') for record page tabs",
            "save": "Use engine.sf_save() for Save button clicks",
        }
    }


@router.post("/convert-steps")
async def convert_steps_to_engine(steps: List[Dict[str, Any]]):
    """
    Convert recorded steps to engine-optimized format.
    
    This analyzes the steps and suggests the best engine methods to use.
    """
    converted = []
    
    for step in steps:
        action = step.get('action', '').lower()
        name = step.get('name', step.get('description', ''))
        value = step.get('value', '')
        selector = step.get('selector', '')
        
        # Detect Salesforce patterns
        name_lower = name.lower()
        
        # App Launcher detection
        if 'app launcher' in name_lower or 'waffle' in name_lower:
            if value:
                converted.append({
                    "original": step,
                    "engine_action": "sf_open_app",
                    "engine_params": {"app_name": value},
                    "reason": "Detected App Launcher pattern"
                })
                continue
        
        # Global search detection
        if 'search' in name_lower and action == 'fill':
            converted.append({
                "original": step,
                "engine_action": "sf_global_search",
                "engine_params": {"text": value},
                "reason": "Detected global search pattern"
            })
            continue
        
        # Tab detection
        if 'tab' in name_lower or any(tab in name_lower for tab in ['details', 'related', 'activity']):
            tab_name = name.replace('Click', '').replace('tab', '').strip().strip('"\'')
            converted.append({
                "original": step,
                "engine_action": "sf_click_tab",
                "engine_params": {"tab_name": tab_name},
                "reason": "Detected tab pattern"
            })
            continue
        
        # Save button detection
        if 'save' in name_lower and action == 'click':
            converted.append({
                "original": step,
                "engine_action": "sf_save",
                "engine_params": {},
                "reason": "Detected save button pattern"
            })
            continue
        
        # Default conversion
        if action == 'click':
            converted.append({
                "original": step,
                "engine_action": "click",
                "engine_params": {
                    "text": name,
                    "selector_hint": selector,
                    "description": name
                }
            })
        elif action in ['fill', 'input', 'type']:
            converted.append({
                "original": step,
                "engine_action": "fill",
                "engine_params": {
                    "value": value,
                    "selector_hint": selector,
                    "description": name
                }
            })
        else:
            converted.append({
                "original": step,
                "engine_action": action,
                "engine_params": step
            })
    
    return {
        "original_count": len(steps),
        "converted_count": len(converted),
        "converted_steps": converted
    }


# ============================================================
# TEST BUILDER ENDPOINTS
# ============================================================

class BuildFromRecordingRequest(BaseModel):
    """Request to build test from browser recording."""
    name: str
    url: str
    actions: List[Dict[str, Any]]
    app_type: Optional[str] = "auto"


class BuildFromTestCaseRequest(BaseModel):
    """Request to build test from test case."""
    name: str
    steps: List[Dict[str, Any]]
    startUrl: Optional[str] = ""
    app_type: Optional[str] = "auto"


@router.post("/build-from-recording")
async def build_from_recording(request: BuildFromRecordingRequest):
    """
    Build a robust Flowstral Engine test from a browser recording.
    
    This takes raw recorded actions and generates a self-contained,
    portable Python test file with:
    - Persistent session support (MFA bypass)
    - Smart element finding (intent-based)
    - Salesforce pattern detection (App Launcher, Global Search, etc.)
    - Automatic retries and self-healing
    """
    try:
        recording_data = {
            "name": request.name,
            "url": request.url,
            "actions": request.actions
        }
        
        test_code = build_test_from_recording(recording_data, request.app_type)
        
        return {
            "success": True,
            "test_code": test_code,
            "test_name": request.name,
            "detected_app_type": request.app_type,
            "action_count": len(request.actions),
            "message": f"Generated robust test with {len(request.actions)} steps"
        }
        
    except Exception as e:
        logger.error(f"Failed to build test from recording: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to build test"
        )


@router.post("/build-from-testcase")
async def build_from_testcase(request: BuildFromTestCaseRequest):
    """
    Build a robust Flowstral Engine test from a test case definition.
    
    Use this when you have a test case from the Unified Workflow Editor.
    """
    try:
        test_case = {
            "name": request.name,
            "steps": request.steps,
            "startUrl": request.startUrl
        }
        
        test_code = build_test_from_test_case(test_case, request.app_type)
        
        return {
            "success": True,
            "test_code": test_code,
            "test_name": request.name,
            "detected_app_type": request.app_type,
            "step_count": len(request.steps),
            "message": f"Generated robust test with {len(request.steps)} steps"
        }
        
    except Exception as e:
        logger.error(f"Failed to build test from test case: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to build test"
        )


# ============================================================
# PAGE INTELLIGENCE ENDPOINTS (Suggest Tab Integration)
# ============================================================

class PageAnalysisRequest(BaseModel):
    """Request containing page analysis from extension."""
    analysis: Dict[str, Any]
    suggestions: Optional[List[Dict[str, Any]]] = []
    assertions: Optional[List[Dict[str, Any]]] = []


@router.post("/process-analysis")
async def process_analysis_endpoint(request: PageAnalysisRequest):
    """
    Process page analysis from the browser extension's Suggest tab.
    
    This receives the PAGE_ANALYSIS data from the extension and
    returns structured information about discovered elements.
    """
    try:
        analysis_data = {
            "analysis": request.analysis,
            "suggestions": request.suggestions,
            "assertions": request.assertions
        }
        
        result = process_page_analysis(analysis_data)
        
        return {
            "success": True,
            "url": result.url,
            "page_type": result.page_type,
            "app_type": result.app_type,
            "element_counts": {
                "buttons": len(result.buttons),
                "links": len(result.links),
                "inputs": len(result.inputs),
                "headings": len(result.headings),
                "total": result.element_count
            },
            "suggestions": result.suggestions,
            "analysis_time_ms": result.analysis_time_ms
        }
        
    except Exception as e:
        logger.error(f"Failed to process analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process analysis"
        )


class GenerateFromAnalysisRequest(BaseModel):
    """Request to generate test from page analysis."""
    test_name: str
    analysis: Dict[str, Any]
    suggestions: Optional[List[Dict[str, Any]]] = []


@router.post("/generate-from-analysis")
async def generate_from_analysis_endpoint(request: GenerateFromAnalysisRequest):
    """
    Generate a robust test from the Suggest tab's page analysis.
    
    This is the ENHANCED workflow:
    1. Extension's PageAnalyzer analyzes the page
    2. This endpoint processes the analysis
    3. Generates smart test steps based on discovered elements
    4. Returns Flowstral Engine code with all the selectors
    
    Benefits over regular recording:
    - Gets ALL interactive elements, not just what user clicked
    - Multiple selector fallbacks per element
    - Shadow DOM pierced (critical for Salesforce LWC)
    - App-specific pattern detection
    """
    try:
        analysis_data = {
            "analysis": request.analysis,
            "suggestions": request.suggestions
        }
        
        test_code = generate_test_from_analysis(analysis_data, request.test_name)
        
        return {
            "success": True,
            "test_code": test_code,
            "test_name": request.test_name,
            "app_type": request.analysis.get("appType", "generic"),
            "page_type": request.analysis.get("pageType", "unknown"),
            "message": "Generated test from page analysis with discovered elements"
        }
        
    except Exception as e:
        logger.error(f"Failed to generate from analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate from analysis"
        )


@router.post("/suggest-actions")
async def suggest_actions(request: PageAnalysisRequest):
    """
    Get suggested test actions based on page analysis.
    
    Returns prioritized list of actions the tester might want to take,
    based on what's discovered on the page.
    """
    try:
        service = PageIntelligenceService()
        analysis_data = {
            "analysis": request.analysis,
            "suggestions": request.suggestions
        }
        
        result = service.process_extension_analysis(analysis_data)
        steps = service.generate_test_steps(result)
        
        return {
            "success": True,
            "page_type": result.page_type,
            "app_type": result.app_type,
            "suggested_steps": steps,
            "discovered_elements": {
                "buttons": [{"text": b.text, "selectors": b.selectors} for b in result.buttons[:10]],
                "inputs": [{"label": i.label, "placeholder": i.placeholder, "selectors": i.selectors} for i in result.inputs[:10]],
                "links": [{"text": l.text, "selectors": l.selectors} for l in result.links[:10]],
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to suggest actions: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to suggest actions"
        )
