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


# ========== Enterprise Features ==========

@router.post("/load-profiles/create")
async def create_load_profile(request: Request, body: dict):
    """Create advanced load profile (spike, stress, endurance, etc.)"""
    try:
        profile_type = body.get("profile_type", "linear")
        
        if profile_type == "spike":
            profile = performance_engine.load_profile_manager.create_spike_profile(
                base_vus=body.get("base_vus", 10),
                spike_vus=body.get("spike_vus", 500),
                spike_duration=body.get("spike_duration", 10),
                spike_interval=body.get("spike_interval", 60),
                duration=body.get("duration", 300)
            )
        elif profile_type == "stress":
            profile = performance_engine.load_profile_manager.create_stress_profile(
                initial_vus=body.get("initial_vus", 10),
                peak_vus=body.get("peak_vus", 100),
                increment=body.get("increment", 10),
                interval=body.get("interval", 30),
                max_vus=body.get("max_vus", 1000),
                ramp_up=body.get("ramp_up", 60)
            )
        elif profile_type == "endurance":
            profile = performance_engine.load_profile_manager.create_endurance_profile(
                vus=body.get("vus", 50),
                duration_hours=body.get("duration_hours", 24),
                ramp_up=body.get("ramp_up", 60)
            )
        elif profile_type == "capacity":
            profile = performance_engine.load_profile_manager.create_capacity_profile(
                initial_vus=body.get("initial_vus", 10),
                max_vus=body.get("max_vus", 500),
                ramp_up=body.get("ramp_up", 300),
                hold=body.get("hold", 600),
                ramp_down=body.get("ramp_down", 300)
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported profile type: {profile_type}")
        
        return {
            "status": "success",
            "profile_type": profile.profile_type.value,
            "message": f"Created {profile_type} load profile"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating load profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-pools/create")
async def create_data_pool(request: Request, body: dict):
    """Create data parameterization pool from CSV/JSON"""
    try:
        pool_id = body.get("pool_id")
        name = body.get("name")
        data_source = body.get("data_source")
        access_mode = body.get("access_mode", "sequential")
        columns = body.get("columns")
        
        if not pool_id or not name or not data_source:
            raise HTTPException(status_code=400, detail="pool_id, name, and data_source are required")
        
        from app.services.performance.data_parameterization import DataAccessMode
        
        mode_map = {
            "sequential": DataAccessMode.SEQUENTIAL,
            "random": DataAccessMode.RANDOM,
            "unique": DataAccessMode.UNIQUE,
            "shared": DataAccessMode.SHARED
        }
        
        mode = mode_map.get(access_mode, DataAccessMode.SEQUENTIAL)
        
        pool = await performance_engine.data_parameterization.create_pool(
            pool_id=pool_id,
            name=name,
            data_source=data_source,
            access_mode=mode,
            columns=columns
        )
        
        return {
            "status": "success",
            "pool_id": pool.pool_id,
            "row_count": len(pool.data)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating data pool: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system-metrics")
async def get_system_metrics(request: Request):
    """Get system resource metrics"""
    try:
        dashboard = performance_engine.system_monitor.get_dashboard_data()
        return {
            "status": "success",
            "metrics": dashboard
        }
    
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/generate")
async def generate_report(request: Request, body: dict):
    """Generate comprehensive test report"""
    try:
        test_id = body.get("test_id")
        test_data = body.get("test_data", {})
        system_metrics = body.get("system_metrics")
        
        if not test_id:
            raise HTTPException(status_code=400, detail="test_id is required")
        
        report = performance_engine.reporting_engine.generate_report(
            test_id=test_id,
            test_data=test_data,
            system_metrics=system_metrics
        )
        
        return {
            "status": "success",
            "report": {
                "test_id": report.test_id,
                "test_name": report.test_name,
                "recommendations": report.recommendations,
                "baseline_comparison": report.baseline_comparison
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reports/baseline")
async def set_baseline(request: Request, body: dict):
    """Set baseline for comparison"""
    try:
        scenario_id = body.get("scenario_id")
        test_id = body.get("test_id")
        test_data = body.get("test_data", {})
        
        if not scenario_id or not test_id:
            raise HTTPException(status_code=400, detail="scenario_id and test_id are required")
        
        performance_engine.reporting_engine.set_baseline(
            scenario_id=scenario_id,
            test_id=test_id,
            test_data=test_data
        )
        
        return {
            "status": "success",
            "message": f"Baseline set for scenario {scenario_id}"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting baseline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/trends/{scenario_id}")
async def get_trend_analysis(request: Request, scenario_id: str, days: int = 30):
    """Get trend analysis for a scenario"""
    try:
        trends = performance_engine.reporting_engine.generate_trend_analysis(
            scenario_id=scenario_id,
            days=days
        )
        
        return {
            "status": "success",
            "trends": trends
        }
    
    except Exception as e:
        logger.error(f"Error getting trend analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/create")
async def create_alert(request: Request, body: dict):
    """Create performance alert"""
    try:
        from app.services.performance.alerting_service import AlertSeverity
        
        alert = performance_engine.alerting_service.create_alert(
            alert_id=body.get("alert_id"),
            name=body.get("name"),
            condition=body.get("condition"),
            severity=AlertSeverity(body.get("severity", "warning")),
            channels=body.get("channels", []),
            recipients=body.get("recipients", []),
            webhook_url=body.get("webhook_url"),
            cooldown_seconds=body.get("cooldown_seconds", 300)
        )
        
        return {
            "status": "success",
            "alert_id": alert.alert_id
        }
    
    except Exception as e:
        logger.error(f"Error creating alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedules/create")
async def create_schedule(request: Request, body: dict):
    """Create scheduled test"""
    try:
        from app.services.performance.test_scheduler import ScheduleType
        
        schedule = performance_engine.test_scheduler.create_schedule(
            schedule_id=body.get("schedule_id"),
            name=body.get("name"),
            scenario_id=body.get("scenario_id"),
            test_config=body.get("test_config", {}),
            schedule_type=ScheduleType(body.get("schedule_type", "once")),
            run_at=body.get("run_at"),
            cron_expression=body.get("cron_expression"),
            interval_seconds=body.get("interval_seconds"),
            max_runs=body.get("max_runs")
        )
        
        return {
            "status": "success",
            "schedule_id": schedule.schedule_id,
            "next_run": schedule.next_run.isoformat() if schedule.next_run else None
        }
    
    except Exception as e:
        logger.error(f"Error creating schedule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions/breakdown")
async def get_transaction_breakdown(request: Request, transaction_name: Optional[str] = None):
    """Get transaction breakdown analysis"""
    try:
        breakdown = performance_engine.transaction_analyzer.get_transaction_breakdown(
            transaction_name=transaction_name
        )
        
        return {
            "status": "success",
            "breakdown": breakdown
        }
    
    except Exception as e:
        logger.error(f"Error getting transaction breakdown: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/errors/analysis")
async def get_error_analysis(request: Request):
    """Get error analysis"""
    try:
        analyses = performance_engine.transaction_analyzer.analyze_errors()
        summary = performance_engine.transaction_analyzer.get_error_summary()
        
        return {
            "status": "success",
            "analyses": [
                {
                    "error_type": a.error_type,
                    "count": a.count,
                    "percentage": a.percentage,
                    "root_cause": a.root_cause
                }
                for a in analyses
            ],
            "summary": summary
        }
    
    except Exception as e:
        logger.error(f"Error getting error analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
