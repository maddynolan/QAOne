"""
Agents API Router
Handles agent execution and health checks
"""
import logging
import uuid
from fastapi import APIRouter, HTTPException, Request
from app.services.core.agent_registry import agent_registry
from app.schemas.agent_schemas import AgentTaskRequest, AgentType

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/execute")
async def execute_agent_task(request: Request, body: dict):
    """Execute a task using an agent via the agent registry"""
    try:
        task_request = AgentTaskRequest(
            task_id=body.get("task_id", str(uuid.uuid4())),
            agent_type=AgentType(body.get("agent_type")),
            tenant_id=body.get("tenant_id"),
            project_id=body.get("project_id"),
            org_id=body.get("org_id"),
            input_data=body.get("input_data", {}),
            timeout_seconds=body.get("timeout_seconds", 300),
            max_retries=body.get("max_retries", 3),
            priority=body.get("priority", 5),
            metadata=body.get("metadata", {})
        )
        
        result = await agent_registry.execute_task(task_request)
        
        return {
            "status": "success",
            "result": result.dict()
        }
    except Exception as e:
        logger.error(f"Agent task execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_agents():
    """List all registered agents"""
    try:
        agents = agent_registry.list_agents()
        
        return {
            "status": "success",
            "count": len(agents),
            "agents": [agent.dict() for agent in agents]
        }
    except Exception as e:
        logger.error(f"Failed to list agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{agent_type}/health")
async def get_agent_health(agent_type: str):
    """Get health status for an agent"""
    try:
        health = agent_registry.get_health(AgentType(agent_type))
        
        if not health:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        return {
            "status": "success",
            "health": health[AgentType(agent_type)].dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get agent health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def get_all_agents_health():
    """Get health status for all agents"""
    try:
        health = agent_registry.get_health()
        
        return {
            "status": "success",
            "health": {k.value: v.dict() for k, v in health.items()}
        }
    except Exception as e:
        logger.error(f"Failed to get agents health: {e}")
        raise HTTPException(status_code=500, detail=str(e))


