# DEPRECATED — Scheduled for removal (v3.20.0)
# The old 8-agent registry system is unused. These schemas (AgentType,
# AgentTaskRequest, AgentTaskResult) are still imported by orchestrator.py,
# flowstral_agent_orchestrator.py, and test_runner_service.py — do NOT
# remove until those consumers are migrated.
"""
Agent Schemas - Standardized request/response models for agents
Phase 1.2: Agent Orchestrator Enhancement
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime


class AgentStatus(str, Enum):
    """Agent execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class AgentType(str, Enum):
    """Types of agents in the system"""
    REQUIREMENTS = "requirements"
    AUTOMATION = "automation"
    PERFORMANCE = "performance"
    ACCESSIBILITY = "accessibility"
    SECURITY = "security"
    TRIAGE = "triage"
    TEST_RUNNER = "test_runner"
    DEFECT = "defect"
    TEST_DESIGN = "test_design"


class AgentTaskRequest(BaseModel):
    """Standard request format for all agents"""
    task_id: str = Field(..., description="Unique task identifier")
    agent_type: AgentType = Field(..., description="Type of agent to execute")
    tenant_id: Optional[str] = Field(None, description="Tenant identifier (for multi-tenant)")
    project_id: Optional[str] = Field(None, description="Project identifier")
    org_id: Optional[str] = Field(None, description="Organization identifier")
    
    # Task input data
    input_data: Dict[str, Any] = Field(..., description="Task-specific input data")
    
    # Execution parameters
    timeout_seconds: int = Field(300, description="Maximum execution time")
    max_retries: int = Field(3, description="Maximum retry attempts")
    priority: int = Field(5, description="Task priority (1-10, higher is more urgent)")
    
    # Metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    created_by: Optional[str] = Field(None, description="User who created the task")
    
    class Config:
        use_enum_values = True


class AgentTaskResult(BaseModel):
    """Standard response format for all agents"""
    task_id: str = Field(..., description="Task identifier")
    agent_type: AgentType = Field(..., description="Agent that executed the task")
    status: AgentStatus = Field(..., description="Execution status")
    
    # Results
    output_data: Dict[str, Any] = Field(default_factory=dict, description="Task output data")
    error: Optional[str] = Field(None, description="Error message if failed")
    
    # Execution metadata
    started_at: Optional[datetime] = Field(None, description="When execution started")
    completed_at: Optional[datetime] = Field(None, description="When execution completed")
    duration_ms: Optional[float] = Field(None, description="Execution duration in milliseconds")
    retry_count: int = Field(0, description="Number of retries attempted")
    
    # Resource usage
    tokens_used: Optional[int] = Field(None, description="LLM tokens consumed")
    cost_usd: Optional[float] = Field(None, description="Cost in USD")
    
    # Additional metadata
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        use_enum_values = True


class AgentCapability(BaseModel):
    """Describes what an agent can do"""
    agent_type: AgentType
    name: str
    description: str
    version: str = "1.0.0"
    supported_operations: List[str] = Field(..., description="List of operations this agent supports")
    required_inputs: List[str] = Field(default_factory=list, description="Required input fields")
    optional_inputs: List[str] = Field(default_factory=list, description="Optional input fields")
    output_schema: Dict[str, Any] = Field(default_factory=dict, description="Expected output schema")
    estimated_latency_ms: Optional[float] = Field(None, description="Estimated execution time")
    max_concurrent_tasks: int = Field(1, description="Maximum concurrent tasks")


class AgentHealth(BaseModel):
    """Agent health status"""
    agent_type: AgentType
    is_healthy: bool
    last_heartbeat: Optional[datetime] = None
    active_tasks: int = 0
    completed_tasks_24h: int = 0
    failed_tasks_24h: int = 0
    average_latency_ms: Optional[float] = None
    error_rate: float = 0.0
    message: Optional[str] = None

