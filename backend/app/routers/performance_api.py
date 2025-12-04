"""
Performance Testing API - REST endpoints for performance testing tool
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

from app.services.performance.performance_engine import PerformanceEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])

# Global performance engine instance
performance_engine = PerformanceEngine()


@router.post("/scenarios")
async def create_scenario(request: Request, body: dict):
    """Create a new test scenario"""
    try:
        name = body.get("name", "Untitled Scenario")
        description = body.get("description", "")
        
        scenario_id = await performance_engine.create_scenario(name, description)
        
        return {
            "status": "success",
            "scenario_id": scenario_id,
            "name": name
        }
    
    except Exception as e:
        logger.error(f"Error creating scenario: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/from-flowstral")
async def create_scenario_from_flowstral(request: Request, body: dict):
    """
    Create performance test scenario from Flowstral recording.
    
    Enhanced integration:
    - Extracts HTTP requests from action graph
    - Converts user interactions to performance test steps
    - Preserves timing and think time
    - Links scenario to Flowstral session
    """
    try:
        session_id = body.get("session_id")
        scenario_name = body.get("scenario_name")
        project_id = body.get("project_id")
        
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        # Get Flowstral session data
        from app.services.flowstral.flowstral_session import flowstral_session_manager
        session = flowstral_session_manager.get_session(session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Flowstral session {session_id} not found")
        
        # Convert session to performance scenario
        flowstral_data = {
            "session_id": session_id,
            "project_id": session.project_id,
            "nodes": session.nodes,
            "edges": session.edges,
            "initial_url": session.initial_url if hasattr(session, 'initial_url') else None
        }
        
        scenario_id = await performance_engine.create_scenario_from_flowstral(
            flowstral_data,
            scenario_name or f"Flowstral Session {session_id[:8]}"
        )
        
        # Link scenario to Flowstral session (store in metadata)
        scenario = performance_engine.get_scenario(scenario_id)
        if scenario:
            if not hasattr(scenario, 'metadata'):
                scenario.metadata = {}
            scenario.metadata["flowstral_session_id"] = session_id
            scenario.metadata["flowstral_project_id"] = project_id or session.project_id
        
        return {
            "status": "success",
            "scenario_id": scenario_id,
            "session_id": session_id,
            "message": "Performance scenario created from Flowstral recording"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating scenario from Flowstral: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scenarios")
async def list_scenarios(request: Request):
    """List all scenarios"""
    try:
        scenarios = performance_engine.list_scenarios()
        return {
            "status": "success",
            "scenarios": scenarios
        }
    
    except Exception as e:
        logger.error(f"Error listing scenarios: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scenarios/{scenario_id}")
async def get_scenario(request: Request, scenario_id: str):
    """
    Get scenario details including Flowstral integration info.
    """
    try:
        scenario = performance_engine.get_scenario(scenario_id)
        
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        response = {
            "status": "success",
            "scenario": {
                "scenario_id": scenario.scenario_id,
                "name": scenario.name,
                "description": scenario.description,
                "steps": [
                    {
                        "step_id": step.step_id,
                        "name": step.name,
                        "action_type": step.action_type.value,
                        "parameters": step.parameters
                    }
                    for step in scenario.steps
                ]
            }
        }
        
        # Add Flowstral integration info if available
        if hasattr(scenario, 'metadata') and scenario.metadata:
            response["scenario"]["flowstral_integration"] = {
                "session_id": scenario.metadata.get("flowstral_session_id"),
                "project_id": scenario.metadata.get("flowstral_project_id"),
                "imported_from_flowstral": bool(scenario.metadata.get("flowstral_session_id"))
            }
        
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting scenario: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/{scenario_id}/steps")
async def add_step(request: Request, scenario_id: str, body: dict):
    """Add a step to a scenario"""
    try:
        step_type = body.get("step_type", "http_request")
        
        if step_type == "http_request":
            step_id = await performance_engine.add_http_request_to_scenario(
                scenario_id=scenario_id,
                name=body.get("name", "HTTP Request"),
                method=body.get("method", "GET"),
                url=body.get("url", ""),
                headers=body.get("headers"),
                body=body.get("body"),
                correlation_rules=body.get("correlation_rules")
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported step type: {step_type}")
        
        return {
            "status": "success",
            "step_id": step_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding step: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tests/run")
async def run_test(request: Request, body: dict):
    """Run a load test"""
    try:
        scenario_id = body.get("scenario_id")
        if not scenario_id:
            raise HTTPException(status_code=400, detail="scenario_id is required")
        
        test_id = await performance_engine.run_load_test(
            scenario_id=scenario_id,
            virtual_users=body.get("virtual_users", 10),
            ramp_up_seconds=body.get("ramp_up_seconds", 60),
            duration_seconds=body.get("duration_seconds", 300),
            ramp_down_seconds=body.get("ramp_down_seconds", 30),
            think_time_ms=body.get("think_time_ms", 2000),
            base_url=body.get("base_url"),
            protocol=body.get("protocol", "http"),
            thresholds=body.get("thresholds"),
            sla_thresholds=body.get("sla_thresholds"),
            use_distributed=body.get("use_distributed", False)
        )
        
        return {
            "status": "success",
            "test_id": test_id,
            "message": "Load test started"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running test: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tests/{test_id}/stop")
async def stop_test(request: Request, test_id: str):
    """Stop a running test"""
    try:
        report = await performance_engine.stop_test(test_id)
        
        return {
            "status": "success",
            "test_id": test_id,
            "report": report
        }
    
    except Exception as e:
        logger.error(f"Error stopping test: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tests/{test_id}/status")
async def get_test_status(request: Request, test_id: str):
    """Get test status"""
    try:
        status = await performance_engine.get_test_status(test_id)
        return {
            "status": "success",
            "test": status
        }
    
    except Exception as e:
        logger.error(f"Error getting test status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tests/{test_id}/report")
async def get_test_report(request: Request, test_id: str):
    """Get test report"""
    try:
        report = await performance_engine.get_test_report(test_id)
        return {
            "status": "success",
            "report": report
        }
    
    except Exception as e:
        logger.error(f"Error getting test report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/realtime")
async def get_real_time_metrics(request: Request):
    """Get real-time metrics dashboard"""
    try:
        metrics = await performance_engine.get_real_time_metrics()
        return {
            "status": "success",
            "metrics": metrics
        }
    
    except Exception as e:
        logger.error(f"Error getting real-time metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/history")
async def get_metrics_history(
    request: Request,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    limit: Optional[int] = None
):
    """Get metrics history"""
    try:
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = datetime.fromisoformat(end_time) if end_time else None
        
        history = await performance_engine.get_metrics_history(
            start_time=start_dt,
            end_time=end_dt,
            limit=limit
        )
        
        return {
            "status": "success",
            "history": history
        }
    
    except Exception as e:
        logger.error(f"Error getting metrics history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correlation/rules")
async def add_correlation_rule(request: Request, body: dict):
    """Add correlation rule"""
    try:
        performance_engine.add_correlation_rule(
            variable_name=body.get("variable_name"),
            extract_type=body.get("extract_type"),
            extract_value=body.get("extract_value")
        )
        
        return {
            "status": "success",
            "message": "Correlation rule added"
        }
    
    except Exception as e:
        logger.error(f"Error adding correlation rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/{scenario_id}/export")
async def export_scenario(request: Request, scenario_id: str):
    """Export scenario to JSON"""
    try:
        json_data = await performance_engine.export_scenario(scenario_id)
        return {
            "status": "success",
            "scenario_json": json_data
        }
    
    except Exception as e:
        logger.error(f"Error exporting scenario: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scenarios/import")
async def import_scenario(request: Request, body: dict):
    """Import scenario from JSON"""
    try:
        json_data = body.get("scenario_json")
        if not json_data:
            raise HTTPException(status_code=400, detail="scenario_json is required")
        
        scenario_id = await performance_engine.import_scenario(json_data)
        
        return {
            "status": "success",
            "scenario_id": scenario_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing scenario: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

