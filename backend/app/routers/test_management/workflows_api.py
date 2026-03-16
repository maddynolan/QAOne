"""
Workflows API Router
Handles workflow creation and execution
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from app.services.core.orchestrator import orchestrator, WORKFLOW_TEMPLATES
from app.utils.endpoint_helpers import ensure_default_org_project
from app.dependencies import get_current_project, get_current_user, get_current_tenant

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.post("/multi-agent")
async def create_multi_agent_workflow(request: Request, body: dict):
    """Create a multi-agent workflow"""
    try:
        # Get actual org/project IDs from database
        default_org_id, default_project_id = await ensure_default_org_project()
        workflow_id = await orchestrator.create_multi_agent_workflow(
            org_id=body.get("org_id", default_org_id),
            project_id=body.get("project_id", default_project_id),
            agent_tasks=body.get("agent_tasks", []),
            metadata=body.get("metadata", {})
        )
        
        return {
            "status": "success",
            "workflow_id": workflow_id
        }
    except Exception as e:
        logger.error(f"Failed to create multi-agent workflow: {e}")
        raise HTTPException(status_code=500, detail="Workflow operation failed")


@router.post("/create")
async def create_workflow(request: Request, body: dict):
    """Create a new workflow"""
    try:
        # Get actual org/project IDs from database
        default_org_id, default_project_id = await ensure_default_org_project()
        org_id = body.get("org_id", default_org_id)
        project_id = body.get("project_id", default_project_id)
        workflow_type = body.get("workflow_type", "test_execution")
        steps = body.get("steps")
        metadata = body.get("metadata", {})
        
        if not steps:
            # Use template if available
            template = WORKFLOW_TEMPLATES.get(workflow_type)
            if template:
                steps = template["steps"]
            else:
                raise HTTPException(status_code=400, detail="No steps provided and no template found")
        
        workflow_id = await orchestrator.create_workflow(
            org_id=org_id,
            project_id=project_id,
            workflow_type=workflow_type,
            steps=steps,
            metadata=metadata
        )
        
        return {"workflow_id": workflow_id, "status": "created"}
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to create workflow")


@router.post("/{workflow_id}/execute")
async def execute_workflow(request: Request, workflow_id: str):
    """Execute a workflow"""
    try:
        result = await orchestrator.execute_workflow(workflow_id)
        return result
    except ValueError as e:
        logger.error(f"Workflow not found: {e}")
        raise HTTPException(status_code=404, detail="Workflow not found")
    except Exception as e:
        logger.error(f"Error executing workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute workflow")


@router.get("/{workflow_id}")
async def get_workflow(request: Request, workflow_id: str):
    """Get workflow by ID"""
    try:
        from dataclasses import asdict
        
        workflow = orchestrator.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        return {
            "status": "success",
            "workflow": asdict(workflow)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")


