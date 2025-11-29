"""
Orchestrator Service - Workflow Engine for Test Execution
Manages test execution workflows, state machines, and retries.
Inspired by Temporal/Argo Workflows but lightweight for MVP.
"""

from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import json
import asyncio
import logging
from uuid import uuid4

logger = logging.getLogger(__name__)


class WorkflowStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowStep:
    """Represents a single step in a workflow"""
    step_id: str
    name: str
    step_type: str  # 'ingestion', 'planning', 'generation', 'execution', 'triage', 'self_heal', 'report'
    status: StepStatus = StepStatus.PENDING
    input_data: Dict[str, Any] = None
    output_data: Dict[str, Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    timeout_seconds: int = 300

    def __post_init__(self):
        if self.input_data is None:
            self.input_data = {}


@dataclass
class Workflow:
    """Represents a complete workflow"""
    workflow_id: str
    org_id: str
    project_id: str
    workflow_type: str  # 'test_generation', 'test_execution', 'triage', 'self_heal'
    status: WorkflowStatus = WorkflowStatus.PENDING
    steps: List[WorkflowStep] = None
    current_step_index: int = 0
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.steps is None:
            self.steps = []
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}


class Orchestrator:
    """
    Lightweight workflow orchestrator for test execution and generation.
    Manages state, retries, timeouts, and step dependencies.
    Enhanced with agent interface for Phase 1.2.
    """

    def __init__(self):
        self.workflows: Dict[str, Workflow] = {}
        self.step_handlers: Dict[str, Callable] = {}
        
        # Agent registry integration (Phase 1.2)
        self._agent_registry = None

    def register_step_handler(self, step_type: str, handler: Callable):
        """Register a handler function for a specific step type"""
        self.step_handlers[step_type] = handler

    async def create_workflow(
        self,
        org_id: str,
        project_id: str,
        workflow_type: str,
        steps: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create a new workflow"""
        workflow_id = str(uuid4())
        
        workflow_steps = []
        for step_def in steps:
            step = WorkflowStep(
                step_id=str(uuid4()),
                name=step_def.get("name", "unnamed"),
                step_type=step_def.get("type", "unknown"),
                timeout_seconds=step_def.get("timeout_seconds", 300),
                max_retries=step_def.get("max_retries", 3),
                input_data=step_def.get("input", {})
            )
            workflow_steps.append(step)

        workflow = Workflow(
            workflow_id=workflow_id,
            org_id=org_id,
            project_id=project_id,
            workflow_type=workflow_type,
            steps=workflow_steps,
            metadata=metadata or {}
        )

        self.workflows[workflow_id] = workflow
        logger.info(f"Created workflow {workflow_id} of type {workflow_type}")
        
        return workflow_id

    async def execute_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """Execute a workflow from start to finish"""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow.status = WorkflowStatus.RUNNING
        workflow.started_at = datetime.utcnow()

        try:
            for step_index, step in enumerate(workflow.steps):
                workflow.current_step_index = step_index
                
                # Execute step with retry logic
                await self._execute_step_with_retry(workflow, step)

                # Check if step failed and workflow should stop
                if step.status == StepStatus.FAILED:
                    workflow.status = WorkflowStatus.FAILED
                    workflow.error = step.error
                    break

            if workflow.status == WorkflowStatus.RUNNING:
                workflow.status = WorkflowStatus.COMPLETED
                workflow.completed_at = datetime.utcnow()

        except Exception as e:
            workflow.status = WorkflowStatus.FAILED
            workflow.error = str(e)
            logger.error(f"Workflow {workflow_id} failed: {e}", exc_info=True)

        return asdict(workflow)

    async def _execute_step_with_retry(self, workflow: Workflow, step: WorkflowStep):
        """Execute a step with retry logic"""
        step.status = StepStatus.RUNNING
        step.started_at = datetime.utcnow()

        while step.retry_count <= step.max_retries:
            try:
                # Get handler for this step type
                handler = self.step_handlers.get(step.step_type)
                if not handler:
                    raise ValueError(f"No handler registered for step type: {step.step_type}")

                # Execute step with timeout
                result = await asyncio.wait_for(
                    handler(workflow, step),
                    timeout=step.timeout_seconds
                )

                step.output_data = result
                step.status = StepStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                return

            except asyncio.TimeoutError:
                step.error = f"Step timed out after {step.timeout_seconds}s"
                step.retry_count += 1
                if step.retry_count <= step.max_retries:
                    logger.warning(f"Step {step.step_id} timed out, retrying ({step.retry_count}/{step.max_retries})")
                    await asyncio.sleep(2 ** step.retry_count)  # Exponential backoff
                else:
                    step.status = StepStatus.FAILED
                    break

            except Exception as e:
                step.error = str(e)
                step.retry_count += 1
                if step.retry_count <= step.max_retries:
                    logger.warning(f"Step {step.step_id} failed, retrying ({step.retry_count}/{step.max_retries}): {e}")
                    await asyncio.sleep(2 ** step.retry_count)
                else:
                    step.status = StepStatus.FAILED
                    logger.error(f"Step {step.step_id} failed after {step.max_retries} retries: {e}")
                    break

    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        """Get workflow by ID"""
        return self.workflows.get(workflow_id)

    def get_workflows_by_project(self, project_id: str) -> List[Workflow]:
        """Get all workflows for a project"""
        return [w for w in self.workflows.values() if w.project_id == project_id]

    def cancel_workflow(self, workflow_id: str):
        """Cancel a running workflow"""
        workflow = self.workflows.get(workflow_id)
        if workflow:
            workflow.status = WorkflowStatus.CANCELLED
            logger.info(f"Cancelled workflow {workflow_id}")
    
    # ==================== Agent Interface (Phase 1.2) ====================
    
    def set_agent_registry(self, agent_registry):
        """Set the agent registry for agent-based workflows"""
        self._agent_registry = agent_registry
    
    async def execute_agent_task(self, task_request) -> Dict[str, Any]:
        """
        Execute a task using the agent registry
        
        Args:
            task_request: AgentTaskRequest from agent_schemas
            
        Returns:
            AgentTaskResult as dict
        """
        if not self._agent_registry:
            from app.services.core.agent_registry import agent_registry
            self._agent_registry = agent_registry
        
        result = await self._agent_registry.execute_task(task_request)
        return result.dict()
    
    async def create_multi_agent_workflow(
        self,
        org_id: str,
        project_id: str,
        agent_tasks: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a workflow that executes multiple agents in sequence
        
        Args:
            org_id: Organization ID
            project_id: Project ID
            agent_tasks: List of agent task definitions
            metadata: Additional metadata
            
        Returns:
            Workflow ID
        """
        from app.schemas.agent_schemas import AgentType, AgentTaskRequest
        from uuid import uuid4
        
        workflow_id = str(uuid4())
        workflow_steps = []
        
        for task_def in agent_tasks:
            # Create agent task request
            task_id = str(uuid4())
            agent_type = AgentType(task_def.get("agent_type"))
            
            task_request = AgentTaskRequest(
                task_id=task_id,
                agent_type=agent_type,
                tenant_id=task_def.get("tenant_id"),
                project_id=project_id,
                org_id=org_id,
                input_data=task_def.get("input_data", {}),
                timeout_seconds=task_def.get("timeout_seconds", 300),
                max_retries=task_def.get("max_retries", 3),
                metadata=task_def.get("metadata", {})
            )
            
            # Create workflow step
            step = WorkflowStep(
                step_id=task_id,
                name=task_def.get("name", f"{agent_type.value} task"),
                step_type=f"agent_{agent_type.value}",
                timeout_seconds=task_request.timeout_seconds,
                max_retries=task_request.max_retries,
                input_data={"task_request": task_request.dict()}
            )
            workflow_steps.append(step)
        
        workflow = Workflow(
            workflow_id=workflow_id,
            org_id=org_id,
            project_id=project_id,
            workflow_type="multi_agent",
            steps=workflow_steps,
            metadata=metadata or {}
        )
        
        self.workflows[workflow_id] = workflow
        logger.info(f"Created multi-agent workflow {workflow_id} with {len(workflow_steps)} agents")
        
        return workflow_id
    
    def register_agent_handler(self, agent_type: str, handler: Callable):
        """
        Register a handler for agent-based workflow steps
        
        Args:
            agent_type: Type of agent (e.g., "requirements", "automation")
            handler: Handler function that takes (workflow, step) and executes agent task
        """
        step_type = f"agent_{agent_type}"
        self.register_step_handler(step_type, handler)
    
    async def _execute_agent_step(self, workflow: Workflow, step: WorkflowStep):
        """
        Default handler for agent-based workflow steps
        Extracts task_request from step input and executes via agent registry
        """
        if not self._agent_registry:
            from app.services.core.agent_registry import agent_registry
            self._agent_registry = agent_registry
        
        from app.schemas.agent_schemas import AgentTaskRequest
        
        # Extract task request from step input
        task_request_dict = step.input_data.get("task_request", {})
        task_request = AgentTaskRequest(**task_request_dict)
        
        # Execute via agent registry
        result = await self._agent_registry.execute_task(task_request)
        
        # Store result in step output
        return result.dict()


# Global orchestrator instance
orchestrator = Orchestrator()


# Predefined workflow templates
WORKFLOW_TEMPLATES = {
    "test_generation": {
        "steps": [
            {"name": "Ingestion", "type": "ingestion", "timeout_seconds": 60},
            {"name": "Planning", "type": "planning", "timeout_seconds": 120},
            {"name": "Generation", "type": "generation", "timeout_seconds": 300},
            {"name": "Report", "type": "report", "timeout_seconds": 30}
        ]
    },
    "test_execution": {
        "steps": [
            {"name": "Planning", "type": "planning", "timeout_seconds": 60},
            {"name": "Execution", "type": "execution", "timeout_seconds": 600},
            {"name": "Triage", "type": "triage", "timeout_seconds": 120},
            {"name": "Self-Heal", "type": "self_heal", "timeout_seconds": 180},
            {"name": "Report", "type": "report", "timeout_seconds": 30}
        ]
    },
    "triage_only": {
        "steps": [
            {"name": "Triage", "type": "triage", "timeout_seconds": 120},
            {"name": "Report", "type": "report", "timeout_seconds": 30}
        ]
    },
    # Multi-agent workflow templates (Phase 1.2)
    "requirements_to_tests": {
        "agent_tasks": [
            {
                "name": "Requirements Analysis",
                "agent_type": "requirements",
                "timeout_seconds": 120,
                "input_data": {}
            },
            {
                "name": "Test Generation",
                "agent_type": "automation",
                "timeout_seconds": 300,
                "input_data": {}
            }
        ]
    },
    "full_test_lifecycle": {
        "agent_tasks": [
            {
                "name": "Requirements Sync",
                "agent_type": "requirements",
                "timeout_seconds": 60
            },
            {
                "name": "Test Generation",
                "agent_type": "automation",
                "timeout_seconds": 300
            },
            {
                "name": "Test Execution",
                "agent_type": "test_runner",
                "timeout_seconds": 600
            },
            {
                "name": "Failure Triage",
                "agent_type": "triage",
                "timeout_seconds": 120
            }
        ]
    }
}




