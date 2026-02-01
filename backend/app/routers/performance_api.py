"""
Performance Testing API - REST endpoints for performance testing tool
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Dict, List, Any, Optional
from datetime import datetime
import json
import logging

from app.services.performance.performance_engine import PerformanceEngine
from app.services.performance.scenario_compiler import get_scenario_compiler, Config
from app.services.performance.go_runner_client import get_go_runner_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/performance", tags=["performance"])

# Global performance engine instance
performance_engine = PerformanceEngine()


def _scenario_to_k6_script(compiled_scenario: dict, base_url: str = "") -> str:
    """Generate a k6 script from a compiled scenario (for export / CI)."""
    config = compiled_scenario.get("config", {})
    steps = compiled_scenario.get("steps", [])
    vus = config.get("virtual_users", 50)
    duration = config.get("duration_seconds", 60)
    lines = [
        "import http from 'k6/http';",
        "import { check } from 'k6';",
        "",
        "export const options = {",
        f"  vus: {vus},",
        f"  duration: '{duration}s',",
        "};",
        "",
        "export default function () {",
        f"  const baseUrl = __ENV.BASE_URL || '{base_url or 'https://example.com'}';\n",
    ]
    for step in steps:
        if step.get("type") == "http" and step.get("url"):
            method = (step.get("method") or "GET").upper()
            url = step.get("url", "")
            if url.startswith("http"):
                url_js = json.dumps(url)
            else:
                path = url if url.startswith("/") else "/" + url.lstrip("/")
                url_js = "baseUrl + " + json.dumps(path)
            if method == "GET":
                lines.append(f"  const res = http.get({url_js});")
            elif method == "POST":
                body = step.get("body") or "{}"
                if isinstance(body, dict):
                    body = json.dumps(body)
                lines.append(f"  const res = http.post({url_js}, {json.dumps(body)});")
            else:
                lines.append(f"  const res = http.request('{method}', {url_js});")
            lines.append("  check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });")
            lines.append("")
    lines.append("}")
    return "\n".join(lines)


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


# ============================================================================
# SCENARIO COMPILER ENDPOINTS (For Go Runner)
# ============================================================================

@router.post("/compile/har")
async def compile_har(request: Request, body: dict):
    """
    Compile HAR file to CompiledScenario JSON for Go runner.
    
    Body:
        har_content: str - Raw HAR file content
        name: str - Scenario name
        config: dict - Optional load test configuration
    """
    try:
        har_content = body.get("har_content")
        if not har_content:
            raise HTTPException(status_code=400, detail="har_content is required")
        
        name = body.get("name", "HAR Import")
        config_data = body.get("config", {})
        
        config = Config(
            virtual_users=config_data.get("virtual_users", 10),
            duration_seconds=config_data.get("duration_seconds", 60),
            ramp_up_seconds=config_data.get("ramp_up_seconds", 10),
            ramp_down_seconds=config_data.get("ramp_down_seconds", 10),
            target_url=config_data.get("target_url", "")
        )
        
        compiler = get_scenario_compiler()
        scenario = compiler.compile_from_har(har_content, name, config)
        
        return {
            "status": "success",
            "scenario_id": scenario.scenario_id,
            "compiled_scenario": scenario.to_dict()
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error compiling HAR: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compile/recording")
async def compile_recording(request: Request, body: dict):
    """
    Compile recorded browser session to CompiledScenario JSON for Go runner.
    
    Body:
        recorded_steps: list - Steps from recorder
        network_requests: list - Network requests captured during recording
        name: str - Scenario name
        config: dict - Optional load test configuration
    """
    try:
        network_requests = body.get("network_requests", [])
        if not network_requests:
            raise HTTPException(status_code=400, detail="network_requests are required")
        
        recorded_steps = body.get("recorded_steps", [])
        name = body.get("name", "Recorded Session")
        config_data = body.get("config", {})
        
        config = Config(
            virtual_users=config_data.get("virtual_users", 10),
            duration_seconds=config_data.get("duration_seconds", 60),
            ramp_up_seconds=config_data.get("ramp_up_seconds", 10),
            target_url=config_data.get("target_url", "")
        )
        
        compiler = get_scenario_compiler()
        scenario = compiler.compile_from_recording(recorded_steps, network_requests, name, config)
        
        return {
            "status": "success",
            "scenario_id": scenario.scenario_id,
            "compiled_scenario": scenario.to_dict()
        }
    
    except Exception as e:
        logger.error(f"Error compiling recording: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compile/api-requests")
async def compile_api_requests(request: Request, body: dict):
    """
    Compile API requests (from API tab) to CompiledScenario JSON for Go runner.
    
    Body:
        requests: list - API requests with method, url, headers, body
        name: str - Scenario name
        config: dict - Optional load test configuration
    """
    try:
        requests_data = body.get("requests", [])
        if not requests_data:
            raise HTTPException(status_code=400, detail="requests are required")
        
        name = body.get("name", "API Test")
        config_data = body.get("config", {})
        
        config = Config(
            virtual_users=config_data.get("virtual_users", 10),
            duration_seconds=config_data.get("duration_seconds", 60),
            ramp_up_seconds=config_data.get("ramp_up_seconds", 10),
            target_url=config_data.get("target_url", "")
        )
        
        compiler = get_scenario_compiler()
        scenario = compiler.compile_from_api_requests(requests_data, name, config)
        
        return {
            "status": "success",
            "scenario_id": scenario.scenario_id,
            "compiled_scenario": scenario.to_dict()
        }
    
    except Exception as e:
        logger.error(f"Error compiling API requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compile/load-requests")
async def compile_load_requests(request: Request, body: dict):
    """
    Compile load test requests from Recorder (pendingLoadTestRequests) into a scenario.
    Same shape as Recorder: [{ method, url, headers?, body? }].
    
    Body:
        requests: list - Requests from recorder (method, url, headers?, body?)
        name: str - Scenario name (default: "From Recorder")
        config: dict - Optional { virtual_users, duration_seconds, ramp_up_seconds, target_url }
    """
    try:
        requests_data = body.get("requests", [])
        if not requests_data:
            raise HTTPException(status_code=400, detail="requests are required")
        
        name = body.get("name", "From Recorder")
        config_data = body.get("config", {})
        
        config = Config(
            virtual_users=config_data.get("virtual_users", 50),
            duration_seconds=config_data.get("duration_seconds", 60),
            ramp_up_seconds=config_data.get("ramp_up_seconds", 10),
            target_url=config_data.get("target_url", ""),
            think_time_min_ms=config_data.get("think_time_min_ms", 1000),
            think_time_max_ms=config_data.get("think_time_max_ms", 3000),
            stages=config_data.get("stages", []),
            arrival_rate=config_data.get("arrival_rate"),
        )
        
        compiler = get_scenario_compiler()
        scenario = compiler.compile_from_api_requests(requests_data, name, config)
        base_url = config.target_url or (scenario.config.target_url if scenario.config else "")
        out = {
            "status": "success",
            "scenario_id": scenario.scenario_id,
            "compiled_scenario": scenario.to_dict(),
            "base_url": base_url,
        }
        if body.get("export") == "k6":
            out["k6_script"] = _scenario_to_k6_script(scenario.to_dict(), base_url)
        return out
    
    except Exception as e:
        logger.error(f"Error compiling load requests: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DRAFTS - Backend persistence for load-test drafts (replaces sessionStorage)
# ============================================================================

from app.services.performance.draft_store import get_draft_store


@router.post("/drafts")
async def create_draft(request: Request, body: dict):
    """
    Create a load-test draft (captured requests). Shareable, durable, auditable.
    Recorder posts here and redirects to /performance?draft_id=...
    Body: requests (list), name (str), source (str), created_by (str), ttl_seconds (int)
    """
    try:
        requests_data = body.get("requests", [])
        if not requests_data:
            raise HTTPException(status_code=400, detail="requests are required")
        name = body.get("name", "From Recorder")
        source = body.get("source", "recorder")
        created_by = body.get("created_by")
        ttl_seconds = body.get("ttl_seconds", 24 * 3600)
        metadata = body.get("metadata", {})
        store = get_draft_store()
        draft = store.create(
            requests=requests_data,
            name=name,
            source=source,
            created_by=created_by,
            ttl_seconds=ttl_seconds,
            metadata=metadata,
        )
        return {
            "status": "success",
            "draft_id": draft.draft_id,
            "request_count": len(draft.requests),
            "message": "Draft created. Load in Perf tab with ?draft_id=" + draft.draft_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating draft: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drafts/{draft_id}")
async def get_draft(request: Request, draft_id: str):
    """Get a draft by ID. Returns 404 if expired or not found."""
    try:
        store = get_draft_store()
        draft = store.get(draft_id)
        if not draft:
            raise HTTPException(status_code=404, detail=f"Draft not found or expired: {draft_id}")
        return {"status": "success", "draft": draft.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting draft: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drafts")
async def list_drafts(request: Request, limit: int = 50):
    """List recent drafts (for UI or audit)."""
    try:
        store = get_draft_store()
        drafts = store.list_drafts(limit=limit)
        return {
            "status": "success",
            "drafts": [d.to_dict() for d in drafts],
            "count": len(drafts),
        }
    except Exception as e:
        logger.error(f"Error listing drafts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/drafts/{draft_id}")
async def delete_draft(request: Request, draft_id: str):
    """Delete a draft."""
    try:
        store = get_draft_store()
        if not store.delete(draft_id):
            raise HTTPException(status_code=404, detail=f"Draft not found: {draft_id}")
        return {"status": "success", "message": f"Draft {draft_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting draft: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GO RUNNER ENDPOINTS - Manage Go-based performance test runners
# ============================================================================

@router.get("/runner/status")
async def get_runner_status(request: Request):
    """Get Go runner status and capacity"""
    try:
        client = get_go_runner_client()
        
        return {
            "status": "success",
            "go_runner_available": client.is_go_runner_available(),
            "runner_count": client.get_runner_count(),
            "available_capacity": client.get_available_capacity(),
            "runners": [
                {
                    "agent_id": r.agent_id,
                    "hostname": r.hostname,
                    "port": r.port,
                    "status": r.status,
                    "max_vus": r.max_vus,
                    "current_vus": r.current_vus,
                    "available_vus": r.available_vus,
                    "active_runs": r.active_runs
                }
                for r in client.runners.values()
            ]
        }
    
    except Exception as e:
        logger.error(f"Error getting runner status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runner/start-local")
async def start_local_runner(request: Request, body: dict):
    """Start the local Go runner"""
    try:
        max_vus = body.get("max_vus", 1000)
        
        client = get_go_runner_client()
        success = await client.start_local_runner(max_vus)
        
        if success:
            return {
                "status": "success",
                "message": "Local Go runner started",
                "port": client.local_runner_port
            }
        else:
            return {
                "status": "fallback",
                "message": "Go runner not available - using Python fallback",
                "use_python_engine": True
            }
    
    except Exception as e:
        logger.error(f"Error starting local runner: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runner/register")
async def register_runner(request: Request, body: dict):
    """
    Register a Go runner (local or remote).
    
    Body:
    - hostname: Runner hostname/IP
    - port: Runner port (default 50051)
    - max_vus: Maximum VUs this runner can handle
    - agent_id: Optional agent ID (auto-generated if not provided)
    """
    try:
        hostname = body.get("hostname", "localhost")
        port = body.get("port", 50051)
        max_vus = body.get("max_vus", 1000)
        agent_id = body.get("agent_id", f"{hostname}:{port}")
        
        client = get_go_runner_client()
        await client.register_runner(agent_id, hostname, port, max_vus)
        
        return {
            "status": "success",
            "message": f"Runner {agent_id} registered",
            "agent_id": agent_id,
            "hostname": hostname,
            "port": port,
            "max_vus": max_vus
        }
    
    except Exception as e:
        logger.error(f"Error registering runner: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runner/discover")
async def discover_local_runner(request: Request):
    """
    Attempt to discover and register a locally running Go runner on port 50051.
    """
    try:
        import socket
        
        # Check if something is listening on port 50051
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 50051))
        sock.close()
        
        if result == 0:
            # Port is open, register the runner
            client = get_go_runner_client()
            await client.register_runner("local", "localhost", 50051, 1000)
            
            return {
                "status": "success",
                "message": "Local Go runner discovered and registered",
                "agent_id": "local",
                "port": 50051
            }
        else:
            return {
                "status": "not_found",
                "message": "No Go runner found on port 50051",
                "suggestion": "Start the runner with: runner.exe --port 50051"
            }
    
    except Exception as e:
        logger.error(f"Error discovering runner: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runner/stop-local")
async def stop_local_runner(request: Request):
    """Stop the local Go runner"""
    try:
        client = get_go_runner_client()
        await client.stop_local_runner()
        
        return {
            "status": "success",
            "message": "Local Go runner stopped"
        }
    
    except Exception as e:
        logger.error(f"Error stopping local runner: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runner/heartbeat")
async def runner_heartbeat(request: Request):
    """Runner heartbeat: current status for health checks and capacity-aware scheduling."""
    try:
        client = get_go_runner_client()
        runners = [
            {
                "agent_id": r.agent_id,
                "hostname": r.hostname,
                "port": r.port,
                "status": r.status,
                "available_vus": r.available_vus,
                "current_vus": r.current_vus,
                "max_vus": r.max_vus,
                "active_runs": r.active_runs,
            }
            for r in client.runners.values()
        ]
        return {
            "status": "success",
            "go_runner_available": client.is_go_runner_available(),
            "runner_count": len(runners),
            "available_capacity": client.get_available_capacity(),
            "runners": runners,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Runner heartbeat failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# LOAD TEST ENDPOINTS
# ============================================================================

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
            use_distributed=body.get("use_distributed", False),
            webhook_url=body.get("webhook_url"),
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


@router.post("/tests/run-mix")
async def run_test_mix(request: Request, body: dict):
    """
    Run a mix of scenarios with weights in one logical test.
    Body: scenario_mix: [{ scenario_id, weight_pct }], virtual_users, duration_seconds, ramp_up_seconds, ...
    Returns parent test_id; GET /tests/{parent_id}/status and /report aggregate children.
    """
    try:
        scenario_mix = body.get("scenario_mix")
        if not scenario_mix or not isinstance(scenario_mix, list):
            raise HTTPException(status_code=400, detail="scenario_mix (list of { scenario_id, weight_pct }) is required")
        
        parent_id = await performance_engine.run_load_test_mix(
            scenario_mix=scenario_mix,
            virtual_users=body.get("virtual_users", 100),
            ramp_up_seconds=body.get("ramp_up_seconds", 60),
            duration_seconds=body.get("duration_seconds", 300),
            ramp_down_seconds=body.get("ramp_down_seconds", 30),
            think_time_ms=body.get("think_time_ms", 2000),
            base_url=body.get("base_url"),
            protocol=body.get("protocol", "http"),
            thresholds=body.get("thresholds"),
            sla_thresholds=body.get("sla_thresholds"),
        )
        
        return {
            "status": "success",
            "test_id": parent_id,
            "message": "Load test mix started"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error running test mix: {e}", exc_info=True)
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


# ========== Run Manager - Test Run State Machine & Pass/Fail Gates ==========

from app.services.performance.run_manager import run_manager, RunState


@router.post("/runs/create")
async def create_run(request: Request, body: dict):
    """
    Create a new test run with state machine tracking.
    
    Request body:
    - scenario_id: ID of the scenario to run
    - scenario_name: Human-readable name
    - virtual_users: Number of VUs (default: 10)
    - duration_seconds: Test duration (default: 60)
    - target_url: Base URL for requests
    - thresholds: List of pass/fail thresholds (optional)
    - tags: List of tags for filtering (optional)
    """
    try:
        run = run_manager.create_run(
            scenario_id=body.get("scenario_id", "default"),
            scenario_name=body.get("scenario_name", "Load Test"),
            virtual_users=body.get("virtual_users", 10),
            duration_seconds=body.get("duration_seconds", 60),
            ramp_up_seconds=body.get("ramp_up_seconds", 10),
            target_url=body.get("target_url", ""),
            thresholds=body.get("thresholds"),
            created_by=body.get("created_by", ""),
            tags=body.get("tags")
        )
        
        return {
            "status": "success",
            "run_id": run.run_id,
            "state": run.state.value,
            "message": "Run created. Call /runs/{run_id}/start to begin."
        }
    
    except Exception as e:
        logger.error(f"Error creating run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/start")
async def start_run(request: Request, run_id: str):
    """Start a created run (transitions: CREATED -> RUNNING)"""
    try:
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
        
        # Transition to STARTING
        run_manager.transition_state(run_id, RunState.STARTING)
        
        # Start the actual load test (this would be async in production)
        # For now, transition to RUNNING
        run_manager.transition_state(run_id, RunState.RUNNING)
        
        return {
            "status": "success",
            "run_id": run_id,
            "state": "running",
            "message": "Load test started"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/stop")
async def stop_run(request: Request, run_id: str):
    """Stop a running test (transitions: RUNNING -> STOPPING -> FINISHED/FAILED)"""
    try:
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
        
        # Transition to STOPPING
        run_manager.transition_state(run_id, RunState.STOPPING)
        
        # Evaluate thresholds and determine verdict
        verdict = run_manager.evaluate_thresholds(run_id)
        
        # Transition to FINISHED
        run_manager.transition_state(run_id, RunState.FINISHED)
        
        return {
            "status": "success",
            "run_id": run_id,
            "state": "finished",
            "verdict": verdict,
            "verdict_reason": run.verdict_reason
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/metrics")
async def update_run_metrics(request: Request, run_id: str, body: dict):
    """Update metrics for a running test"""
    try:
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
        
        run_manager.update_metrics(run_id, body.get("metrics", {}))
        
        return {"status": "success", "run_id": run_id}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/{run_id}/evaluate")
async def evaluate_run_thresholds(request: Request, run_id: str):
    """Evaluate thresholds and return PASS/FAIL verdict"""
    try:
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
        
        verdict = run_manager.evaluate_thresholds(run_id)
        run = run_manager.get_run(run_id)  # Refresh
        
        return {
            "status": "success",
            "run_id": run_id,
            "verdict": verdict,
            "verdict_reason": run.verdict_reason,
            "threshold_results": [
                {
                    "metric": r.threshold.metric,
                    "name": r.threshold.name,
                    "expected": f"{r.threshold.operator.value} {r.threshold.value}",
                    "actual": r.actual_value,
                    "passed": r.passed,
                    "message": r.message
                }
                for r in run.threshold_results
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error evaluating thresholds: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}")
async def get_run(request: Request, run_id: str):
    """Get full run details including verdict"""
    try:
        summary = run_manager.get_run_summary(run_id)
        if not summary:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")
        
        return {
            "status": "success",
            "run": summary
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs")
async def list_runs(
    request: Request,
    scenario_id: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """List runs with filtering"""
    try:
        state_enum = RunState(state) if state else None
        runs = run_manager.list_runs(
            scenario_id=scenario_id,
            state=state_enum,
            limit=limit,
            offset=offset
        )
        
        return {
            "status": "success",
            "runs": runs,
            "count": len(runs)
        }
    
    except Exception as e:
        logger.error(f"Error listing runs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/history/{scenario_id}")
async def get_run_history(request: Request, scenario_id: str, days: int = 30):
    """Get run history for trend analysis"""
    try:
        history = run_manager.get_run_history(scenario_id, days)
        
        return {
            "status": "success",
            "scenario_id": scenario_id,
            "days": days,
            "runs": history
        }
    
    except Exception as e:
        logger.error(f"Error getting run history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs/compare")
async def compare_runs(request: Request, body: dict):
    """Compare multiple runs"""
    try:
        run_ids = body.get("run_ids", [])
        if len(run_ids) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 run IDs")
        
        comparison = run_manager.compare_runs(run_ids)
        
        return {
            "status": "success",
            "comparison": comparison
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing runs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/thresholds/defaults")
async def get_default_thresholds():
    """Get default pass/fail thresholds"""
    from app.services.performance.run_manager import RunManager
    
    return {
        "status": "success",
        "thresholds": RunManager.get_default_thresholds()
    }


# ============================================================================
# LIGHTHOUSE & PWA PERFORMANCE - Core Web Vitals, PWA URL audits
# ============================================================================

from app.services.performance.lighthouse_service import (
    run_lighthouse,
    run_lighthouse_hardened,
    get_lighthouse_report,
    get_lighthouse_result,
)


@router.post("/lighthouse/run")
async def lighthouse_run(request: Request, body: dict):
    """
    Run Google Lighthouse against a URL. Returns Performance score and Core Web Vitals
    (LCP, FCP, CLS, TBT, TTI). Integrates with load testing and PWA performance.
    
    Body:
        url: str - URL to audit (http/https)
        form_factor: str - "desktop" or "mobile" (default: desktop)
        timeout_seconds: int - Max run time (default: 120)
    """
    try:
        url = body.get("url", "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        form_factor = body.get("form_factor", "desktop")
        timeout_seconds = body.get("timeout_seconds", 120)
        
        result = await run_lighthouse(
            url=url,
            form_factor=form_factor,
            timeout_seconds=timeout_seconds,
        )
        return {"status": "success", **result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lighthouse run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lighthouse/run-hardened")
async def lighthouse_run_hardened(request: Request, body: dict):
    """
    Run Lighthouse multiple times and return median result (stability).
    Optional: save raw JSON artifacts to disk.
    Body: url, form_factor, timeout_seconds, runs (default 3), cache_strategy (cold|warm), save_artifacts (bool), artifacts_dir (str)
    """
    try:
        url = body.get("url", "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        form_factor = body.get("form_factor", "desktop")
        timeout_seconds = body.get("timeout_seconds", 120)
        runs = body.get("runs", 3)
        cache_strategy = body.get("cache_strategy", "cold")
        save_artifacts = body.get("save_artifacts", True)
        artifacts_dir = body.get("artifacts_dir")
        if not artifacts_dir:
            from pathlib import Path
            artifacts_dir = str(Path("data") / "lighthouse_artifacts")
        result = await run_lighthouse_hardened(
            url=url,
            form_factor=form_factor,
            timeout_seconds=timeout_seconds,
            runs=runs,
            cache_strategy=cache_strategy,
            save_artifacts=save_artifacts,
            artifacts_dir=artifacts_dir,
        )
        return {"status": "success", **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lighthouse hardened run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lighthouse/report/{run_id}")
async def lighthouse_report(request: Request, run_id: str):
    """Get stored Lighthouse report (full JSON) for a run_id."""
    try:
        stored = get_lighthouse_report(run_id)
        if not stored:
            raise HTTPException(status_code=404, detail=f"Lighthouse report not found: {run_id}")
        return {"status": "success", "run_id": run_id, "report": stored.get("report"), "result": stored.get("result")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Lighthouse report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lighthouse/result/{run_id}")
async def lighthouse_result(request: Request, run_id: str):
    """Get Lighthouse result summary (scores, Web Vitals) for a run_id."""
    try:
        result = get_lighthouse_result(run_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"Lighthouse result not found: {run_id}")
        return {"status": "success", **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Lighthouse result: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pwa/performance")
async def pwa_performance(request: Request, body: dict):
    """
    PWA-specific performance: run Lighthouse against the PWA URL.
    Use for PWA load-test pipeline (LCP/FCP/CLS under load or after load).
    Full PWA audit (manifest, service worker, offline) runs in Flowstral Desktop.
    
    Body:
        url: str - PWA URL (e.g. start_url or root)
        form_factor: str - "desktop" or "mobile"
        timeout_seconds: int - Max Lighthouse run time
    """
    try:
        url = body.get("url", "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        form_factor = body.get("form_factor", "mobile")
        timeout_seconds = body.get("timeout_seconds", 120)
        
        result = await run_lighthouse(
            url=url,
            form_factor=form_factor,
            timeout_seconds=timeout_seconds,
        )
        return {
            "status": "success",
            "pwa_url": url,
            "lighthouse": result,
            "message": "PWA performance (Lighthouse). For manifest/SW/offline audit use Flowstral Desktop PWA actions.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PWA performance run failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# WORKLOAD MODELS - k6-style executors
# ============================================================================

from app.services.performance.workload_models import (
    WorkloadModelFactory, WorkloadModelType, WorkloadConfig
)


@router.post("/workload/create")
async def create_workload(request: Request, body: dict):
    """
    Create a workload configuration (k6-style executor).
    
    Supported model types:
    - constant_vus: Fixed VUs for duration
    - ramping_vus: VUs ramp up/down over stages
    - per_vu_iterations: Each VU runs N iterations
    - shared_iterations: Total iterations split across VUs
    - constant_arrival_rate: Fixed requests/sec (open model)
    - ramping_arrival_rate: Ramp arrival rate over stages (open model)
    """
    try:
        model_type = body.get("model_type", "constant_vus")
        
        if model_type == "constant_vus":
            config = WorkloadModelFactory.constant_vus(
                vus=body.get("vus", 10),
                duration=body.get("duration_seconds", 60)
            )
        elif model_type == "ramping_vus":
            config = WorkloadModelFactory.ramping_vus(
                stages=body.get("stages", []),
                graceful_stop=body.get("graceful_stop", 30)
            )
        elif model_type == "shared_iterations":
            config = WorkloadModelFactory.shared_iterations(
                iterations=body.get("iterations", 1000),
                vus=body.get("vus", 10),
                max_duration=body.get("max_duration", 3600)
            )
        elif model_type == "per_vu_iterations":
            config = WorkloadModelFactory.per_vu_iterations(
                iterations_per_vu=body.get("iterations_per_vu", 10),
                vus=body.get("vus", 10),
                max_duration=body.get("max_duration", 3600)
            )
        elif model_type == "constant_arrival_rate":
            config = WorkloadModelFactory.constant_arrival_rate(
                rate=body.get("rate", 10),
                duration=body.get("duration_seconds", 60),
                pre_allocated_vus=body.get("pre_allocated_vus", 10),
                max_vus=body.get("max_vus", 100)
            )
        elif model_type == "ramping_arrival_rate":
            config = WorkloadModelFactory.ramping_arrival_rate(
                stages=body.get("stages", []),
                pre_allocated_vus=body.get("pre_allocated_vus", 10),
                max_vus=body.get("max_vus", 100)
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown model type: {model_type}")
        
        return {
            "status": "success",
            "workload_config": config.to_dict(),
            "message": f"Created {model_type} workload model"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workload: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workload/types")
async def list_workload_types():
    """List available workload model types with descriptions"""
    return {
        "status": "success",
        "types": [
            {
                "type": "constant_vus",
                "description": "Fixed number of VUs for duration (closed model)",
                "parameters": ["vus", "duration_seconds"]
            },
            {
                "type": "ramping_vus",
                "description": "VUs ramp up/down over stages (closed model)",
                "parameters": ["stages[{duration_seconds, target}]", "graceful_stop"]
            },
            {
                "type": "shared_iterations",
                "description": "Total iterations split across VUs (closed model)",
                "parameters": ["iterations", "vus", "max_duration"]
            },
            {
                "type": "per_vu_iterations",
                "description": "Each VU runs N iterations (closed model)",
                "parameters": ["iterations_per_vu", "vus", "max_duration"]
            },
            {
                "type": "constant_arrival_rate",
                "description": "Fixed requests/sec regardless of VUs (open model)",
                "parameters": ["rate", "duration_seconds", "pre_allocated_vus", "max_vus"]
            },
            {
                "type": "ramping_arrival_rate",
                "description": "Ramp arrival rate over stages (open model)",
                "parameters": ["stages[{duration_seconds, target}]", "pre_allocated_vus", "max_vus"]
            }
        ]
    }


# ============================================================================
# CHECKS ENGINE - k6-style inline assertions
# ============================================================================

from app.services.performance.checks_engine import (
    get_checks_engine, Check, CheckType, status_is, body_contains, response_time_below
)


@router.post("/checks/execute")
async def execute_checks(request: Request, body: dict):
    """
    Execute k6-style checks against a response.
    
    Body:
        response: {status, body, headers, response_time_ms}
        checks: [
            {"name": "status is 200", "type": "status", "expected": 200},
            {"name": "body contains success", "type": "body_contains", "expected": "success"},
            {"name": "response time < 500ms", "type": "response_time", "expected": 500, "operator": "<"}
        ]
        tags: {"scenario": "login", "name": "POST /login"}
    """
    try:
        engine = get_checks_engine()
        
        response_data = body.get("response", {})
        checks_data = body.get("checks", [])
        tags = body.get("tags", {})
        
        # Convert to Check objects
        checks = []
        for c in checks_data:
            checks.append(Check(
                name=c.get("name", "unnamed"),
                check_type=CheckType(c.get("type", "status")),
                expected=c.get("expected"),
                operator=c.get("operator", "=="),
                json_path=c.get("json_path"),
                header_name=c.get("header_name")
            ))
        
        # Execute checks
        results = engine.check(response_data, checks, tags)
        
        return {
            "status": "success",
            "results": [
                {
                    "check_name": r.check_name,
                    "passed": r.passed,
                    "message": r.message
                }
                for r in results
            ],
            "all_passed": all(r.passed for r in results)
        }
    
    except Exception as e:
        logger.error(f"Error executing checks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/checks/summary")
async def get_checks_summary():
    """Get summary of all checks executed during the test"""
    try:
        engine = get_checks_engine()
        return {
            "status": "success",
            "summary": engine.get_summary()
        }
    except Exception as e:
        logger.error(f"Error getting checks summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/checks/reset")
async def reset_checks():
    """Reset all check results"""
    try:
        engine = get_checks_engine()
        engine.reset()
        return {"status": "success", "message": "Checks reset"}
    except Exception as e:
        logger.error(f"Error resetting checks: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CUSTOM METRICS - k6-style Trend, Counter, Gauge, Rate
# ============================================================================

from app.services.performance.custom_metrics import get_metrics_registry


@router.post("/metrics/record")
async def record_custom_metric(request: Request, body: dict):
    """
    Record a value to a custom metric.
    
    Body:
        name: Metric name
        type: counter | gauge | rate | trend
        value: Value to record (number for counter/gauge/trend, bool for rate)
        tags: Optional tags
    """
    try:
        registry = get_metrics_registry()
        
        metric_name = body.get("name")
        metric_type = body.get("type", "counter")
        value = body.get("value")
        tags = body.get("tags", {})
        
        if not metric_name:
            raise HTTPException(status_code=400, detail="name is required")
        
        if metric_type == "counter":
            metric = registry.counter(metric_name)
            metric.add(float(value or 1), tags)
        elif metric_type == "gauge":
            metric = registry.gauge(metric_name)
            metric.set(float(value), tags)
        elif metric_type == "rate":
            metric = registry.rate(metric_name)
            metric.add(bool(value), tags)
        elif metric_type == "trend":
            metric = registry.trend(metric_name)
            metric.add(float(value), tags)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown metric type: {metric_type}")
        
        return {
            "status": "success",
            "metric": metric_name,
            "type": metric_type,
            "summary": metric.get_summary()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording metric: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/summary")
async def get_metrics_summary():
    """Get summary of all custom metrics"""
    try:
        registry = get_metrics_registry()
        return {
            "status": "success",
            "metrics": registry.get_all_summaries()
        }
    except Exception as e:
        logger.error(f"Error getting metrics summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics/prometheus")
async def export_metrics_prometheus():
    """Export metrics in Prometheus format"""
    from fastapi.responses import PlainTextResponse
    try:
        registry = get_metrics_registry()
        return PlainTextResponse(
            content=registry.export_prometheus(),
            media_type="text/plain"
        )
    except Exception as e:
        logger.error(f"Error exporting Prometheus metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/metrics/reset")
async def reset_metrics():
    """Reset all custom metrics"""
    try:
        registry = get_metrics_registry()
        registry.reset_all()
        return {"status": "success", "message": "Metrics reset"}
    except Exception as e:
        logger.error(f"Error resetting metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GROUPS AND TAGS - Request organization
# ============================================================================

from app.services.performance.groups_tags import get_group_manager, get_tag_manager


@router.post("/groups/start")
async def start_group(request: Request, body: dict):
    """Start a named group for organizing requests"""
    try:
        name = body.get("name")
        if not name:
            raise HTTPException(status_code=400, detail="name is required")
        
        manager = get_group_manager()
        manager.start_group(name)
        
        return {"status": "success", "group": name, "message": "Group started"}
    except Exception as e:
        logger.error(f"Error starting group: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/groups/end")
async def end_group(request: Request, body: dict):
    """End a named group"""
    try:
        name = body.get("name")
        if not name:
            raise HTTPException(status_code=400, detail="name is required")
        
        manager = get_group_manager()
        manager.end_group(name)
        
        return {"status": "success", "group": name, "message": "Group ended"}
    except Exception as e:
        logger.error(f"Error ending group: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/groups/summary")
async def get_groups_summary():
    """Get summary of all groups"""
    try:
        manager = get_group_manager()
        return {
            "status": "success",
            "groups": manager.get_all_group_metrics()
        }
    except Exception as e:
        logger.error(f"Error getting groups summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tags/global")
async def set_global_tags(request: Request, body: dict):
    """Set global tags applied to all requests"""
    try:
        tags = body.get("tags", {})
        manager = get_tag_manager()
        
        for key, value in tags.items():
            manager.set_global_tag(key, value)
        
        return {
            "status": "success",
            "global_tags": manager.get_global_tags()
        }
    except Exception as e:
        logger.error(f"Error setting global tags: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CAPABILITIES - Complete feature list
# ============================================================================

@router.get("/capabilities")
async def get_performance_capabilities():
    """Get complete list of performance testing capabilities"""
    return {
        "status": "success",
        "capabilities": {
            "load_generation": {
                "python_engine": True,
                "go_runner": True,
                "max_vus_python": 100,
                "max_vus_go": 10000,
                "distributed": True
            },
            "workload_models": [
                "constant_vus",
                "ramping_vus",
                "per_vu_iterations",
                "shared_iterations",
                "constant_arrival_rate",
                "ramping_arrival_rate"
            ],
            "load_profiles": [
                "linear", "step", "spike", "stress", 
                "endurance", "capacity", "custom"
            ],
            "protocols": [
                "HTTP/1.1", "HTTP/2", "WebSocket", "gRPC"
            ],
            "features": [
                "Correlation engine (JSONPath, Regex, Header, Cookie)",
                "Data parameterization (CSV, JSON, Sequential, Random, Unique)",
                "k6-style checks and assertions",
                "Custom metrics (Counter, Gauge, Rate, Trend)",
                "Groups and tags for organization",
                "Lifecycle hooks (setup, teardown, pre/post request)",
                "Network simulation (bandwidth, latency, packet loss)",
                "APM integration (Datadog, New Relic, Prometheus)",
                "Lighthouse/Core Web Vitals integration",
                "Server Resource Monitoring (SRM)",
                "CI/CD webhooks with pass/fail verdict",
                "k6 script export",
                "Scenario mix (multiple scenarios with weights)",
                "Test scheduling (once, cron, interval)"
            ],
            "comparison_to_k6": {
                "workload_models": "Full parity (6 executor types)",
                "checks": "Full parity (inline assertions)",
                "custom_metrics": "Full parity (Trend, Counter, Gauge, Rate)",
                "groups_tags": "Full parity",
                "lifecycle_hooks": "Full parity (setup, teardown, pre/post)",
                "thresholds": "Full parity",
                "distributed": "Supported via Go runner"
            },
            "comparison_to_gatling": {
                "injection_profiles": "Full parity (open/closed models)",
                "assertions": "Full parity",
                "scenarios": "Full parity",
                "simulations": "Full parity"
            },
            "comparison_to_loadrunner": {
                "correlation": "Full parity",
                "parameterization": "Full parity",
                "protocols": "Partial (HTTP, WebSocket, gRPC)",
                "analysis": "Good (Lighthouse, SRM, trending)"
            }
        }
    }
