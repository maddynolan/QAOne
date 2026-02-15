"""
Test Case Generation API
Standalone endpoint for generating test cases from action graphs
"""

import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.engines.test_case_engine import TestCaseEngine
from app.services.engines.test_case_validator import TestCaseValidator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/test-cases", tags=["test-cases"])

engine = TestCaseEngine()
validator = TestCaseValidator()


# ==================== Request Models ====================

class TestCaseGenerationRequest(BaseModel):
    """Request to generate test cases from action graph"""
    action_graph: Dict[str, Any]  # ActionGraph dict representation
    output_format: str = "istqb"  # "istqb" or "gherkin"
    optimize: bool = True
    dom_snapshots: Optional[Dict[str, Any]] = None


# ==================== API Endpoints ====================

@router.post("/generate-from-action-graph")
async def generate_test_cases_from_action_graph(
    request: TestCaseGenerationRequest
):
    """
    Generate test cases from action graph using TestCaseEngine.
    
    This endpoint uses your sophisticated backend engine with:
    - Input grouping (character-by-character → full string)
    - Flowstral event filtering
    - Better element name extraction
    - Deduplication
    - Quality metrics
    
    Request Body:
    {
        "action_graph": {
            "session_id": "...",
            "nodes": [...],
            "edges": [...]
        },
        "output_format": "istqb" | "gherkin",
        "optimize": true,
        "dom_snapshots": {...}  // Optional
    }
    
    Response:
    {
        "status": "success",
        "test_cases": [...],
        "statistics": {
            "total_test_cases": 2,
            "average_confidence": 0.85,
            "average_steps": 8,
            "steps_reduced": 45,  // After grouping
            "flowstral_events_filtered": 12,
            "duplicates_removed": 8
        },
        "quality_metrics": {...},
        "generation_time_seconds": 1.23
    }
    """
    try:
        # Reconstruct ActionGraph object from dict
        session_id = request.action_graph.get("session_id", "standalone")
        action_graph = ActionGraph(session_id)
        
        # Load nodes and edges from dict
        nodes_data = request.action_graph.get("nodes", [])
        edges_data = request.action_graph.get("edges", [])
        action_graph.load_from_session_data(nodes_data=nodes_data, edges_data=edges_data)
        
        # Generate test cases using engine
        result = engine.generate_test_cases(
            action_graph=action_graph,
            dom_snapshots=request.dom_snapshots,
            output_format=request.output_format,
            optimize=request.optimize
        )
        
        # Enhance statistics with additional metrics
        stats = result.get("statistics", {})
        
        # Calculate steps reduced (if we track original count)
        # This would need to be tracked in the engine
        stats["steps_reduced"] = stats.get("steps_reduced", 0)
        stats["flowstral_events_filtered"] = stats.get("flowstral_events_filtered", 0)
        stats["duplicates_removed"] = stats.get("duplicates_removed", 0)
        
        # Validate test case quality
        test_cases = result.get("test_cases", [])
        validation_result = validator.validate_batch(test_cases, request.output_format)
        
        return {
            "status": "success",
            "test_cases": test_cases,
            "statistics": stats,
            "quality_metrics": result.get("quality_metrics", {}),
            "validation": validation_result,
            "generation_time_seconds": result.get("generation_time_seconds", 0),
            "output_format": request.output_format
        }
    
    except Exception as e:
        logger.error(f"Failed to generate test cases: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate test cases: {str(e)}")


@router.post("/convert-format")
async def convert_test_case_format(
    test_cases: List[Dict[str, Any]],
    target_format: str  # "istqb" or "gherkin"
):
    """
    Convert test cases between ISTQB and Gherkin formats.
    
    Useful for frontend format switching without regenerating.
    """
    try:
        from app.services.engines.standards_compliance import StandardsCompliance
        
        standards = StandardsCompliance()
        
        if target_format == "gherkin":
            converted = standards.format_multiple(test_cases, "gherkin")
        elif target_format == "istqb":
            converted = standards.format_multiple(test_cases, "istqb")
        else:
            raise ValueError(f"Unsupported format: {target_format}")
        
        # Re-validate after conversion
        validation_result = validator.validate_batch(converted, target_format)
        
        return {
            "status": "success",
            "test_cases": converted,
            "format": target_format,
            "validation": validation_result
        }
    
    except Exception as e:
        logger.error(f"Failed to convert format: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to convert format: {str(e)}")


@router.post("/validate")
async def validate_test_cases(
    test_cases: List[Dict[str, Any]],
    format: str = "istqb"
):
    """
    Validate test case quality without regenerating.
    
    Returns detailed validation report with:
    - Quality scores
    - Issues and warnings
    - Suggestions for improvement
    - Metrics breakdown
    """
    try:
        validation_result = validator.validate_batch(test_cases, format)
        
        return {
            "status": "success",
            "validation": validation_result
        }
    
    except Exception as e:
        logger.error(f"Failed to validate test cases: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to validate: {str(e)}")

