# DEPRECATED — Scheduled for removal (v3.20.0)
# The old 8-agent registry system is unused. Agent execution is handled by
# dedicated services (AgenticOrchestrator, BlazeExplorer, etc.) instead.
"""
Agent Registry - Registration and discovery system for agents
Phase 1.2: Agent Orchestrator Enhancement
"""

import logging
from typing import Dict, Optional, List, Callable, Any
from datetime import datetime, timedelta
from app.schemas.agent_schemas import (
    AgentType, AgentCapability, AgentHealth, AgentTaskRequest, AgentTaskResult
)

logger = logging.getLogger(__name__)


class AgentRegistry:
    """
    Registry for managing agent registration, discovery, and health monitoring
    """
    
    def __init__(self):
        # Registered agents: agent_type -> AgentCapability
        self.agents: Dict[AgentType, AgentCapability] = {}
        
        # Agent handlers: agent_type -> handler function
        self.handlers: Dict[AgentType, Callable] = {}
        
        # Health tracking: agent_type -> AgentHealth
        self.health: Dict[AgentType, AgentHealth] = {}
        
        # Task statistics
        self.task_stats: Dict[AgentType, Dict[str, Any]] = {}
        
        logger.debug("AgentRegistry initialized")
    
    def register_agent(
        self,
        agent_type: AgentType,
        capability: AgentCapability,
        handler: Callable[[AgentTaskRequest], Any]
    ):
        """
        Register an agent with its capability and handler
        
        Args:
            agent_type: Type of agent
            capability: Agent capability description
            handler: Async function that handles AgentTaskRequest and returns AgentTaskResult
        """
        self.agents[agent_type] = capability
        self.handlers[agent_type] = handler
        self.health[agent_type] = AgentHealth(
            agent_type=agent_type,
            is_healthy=True,
            last_heartbeat=datetime.utcnow()
        )
        self.task_stats[agent_type] = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "failed_tasks": 0,
            "latencies": []
        }
        
        logger.debug(f"Registered agent: {agent_type.value} - {capability.name}")
    
    def get_agent(self, agent_type: AgentType) -> Optional[AgentCapability]:
        """Get agent capability by type"""
        return self.agents.get(agent_type)
    
    def get_handler(self, agent_type: AgentType) -> Optional[Callable]:
        """Get agent handler by type"""
        return self.handlers.get(agent_type)
    
    def list_agents(self) -> List[AgentCapability]:
        """List all registered agents"""
        return list(self.agents.values())
    
    def is_agent_registered(self, agent_type: AgentType) -> bool:
        """Check if agent is registered"""
        return agent_type in self.agents
    
    async def execute_task(self, request: AgentTaskRequest) -> AgentTaskResult:
        """
        Execute a task using the appropriate agent
        
        Args:
            request: Agent task request
            
        Returns:
            AgentTaskResult with execution results
        """
        import time
        
        agent_type = request.agent_type
        handler = self.get_handler(agent_type)
        
        if not handler:
            return AgentTaskResult(
                task_id=request.task_id,
                agent_type=agent_type,
                status="failed",
                error=f"Agent {agent_type.value} not registered"
            )
        
        # Update health
        health = self.health.get(agent_type)
        if health:
            health.active_tasks += 1
            health.last_heartbeat = datetime.utcnow()
        
        # Update stats
        stats = self.task_stats.get(agent_type, {})
        stats["total_tasks"] = stats.get("total_tasks", 0) + 1
        
        start_time = time.time()
        started_at = datetime.utcnow()
        
        try:
            # Execute handler
            result = await handler(request)
            
            # If handler returns dict, convert to AgentTaskResult
            if isinstance(result, dict):
                result = AgentTaskResult(
                    task_id=request.task_id,
                    agent_type=agent_type,
                    status=result.get("status", "completed"),
                    output_data=result.get("output_data", {}),
                    error=result.get("error"),
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    duration_ms=(time.time() - start_time) * 1000,
                    metadata=result.get("metadata", {})
                )
            elif not isinstance(result, AgentTaskResult):
                # Wrap result in AgentTaskResult
                result = AgentTaskResult(
                    task_id=request.task_id,
                    agent_type=agent_type,
                    status="completed",
                    output_data={"result": result} if result else {},
                    started_at=started_at,
                    completed_at=datetime.utcnow(),
                    duration_ms=(time.time() - start_time) * 1000
                )
            
            # Update stats on success
            stats["completed_tasks"] = stats.get("completed_tasks", 0) + 1
            if result.duration_ms:
                stats.setdefault("latencies", []).append(result.duration_ms)
                # Keep only last 100 latencies
                if len(stats["latencies"]) > 100:
                    stats["latencies"] = stats["latencies"][-100:]
            
            # Update health
            if health:
                health.active_tasks = max(0, health.active_tasks - 1)
                health.completed_tasks_24h += 1
                if stats.get("latencies"):
                    health.average_latency_ms = sum(stats["latencies"]) / len(stats["latencies"])
            
            return result
            
        except Exception as e:
            logger.error(f"Agent {agent_type.value} task {request.task_id} failed: {e}", exc_info=True)
            
            # Update stats on failure
            stats["failed_tasks"] = stats.get("failed_tasks", 0) + 1
            
            # Update health
            if health:
                health.active_tasks = max(0, health.active_tasks - 1)
                health.failed_tasks_24h += 1
                total_24h = health.completed_tasks_24h + health.failed_tasks_24h
                if total_24h > 0:
                    health.error_rate = health.failed_tasks_24h / total_24h
                if health.error_rate > 0.5:
                    health.is_healthy = False
                    health.message = f"High error rate: {health.error_rate:.2%}"
            
            return AgentTaskResult(
                task_id=request.task_id,
                agent_type=agent_type,
                status="failed",
                error=str(e),
                started_at=started_at,
                completed_at=datetime.utcnow(),
                duration_ms=(time.time() - start_time) * 1000
            )
    
    def get_health(self, agent_type: Optional[AgentType] = None) -> Dict[AgentType, AgentHealth]:
        """Get health status for agent(s)"""
        if agent_type:
            health = self.health.get(agent_type)
            return {agent_type: health} if health else {}
        return self.health.copy()
    
    def update_health(self, agent_type: AgentType, is_healthy: bool, message: Optional[str] = None):
        """Manually update agent health"""
        if agent_type in self.health:
            self.health[agent_type].is_healthy = is_healthy
            self.health[agent_type].last_heartbeat = datetime.utcnow()
            if message:
                self.health[agent_type].message = message
    
    def get_stats(self, agent_type: Optional[AgentType] = None) -> Dict:
        """Get task statistics for agent(s)"""
        if agent_type:
            return self.task_stats.get(agent_type, {})
        return self.task_stats.copy()
    
    def reset_stats_24h(self):
        """Reset 24-hour statistics (call this daily)"""
        for agent_type in self.health:
            health = self.health[agent_type]
            health.completed_tasks_24h = 0
            health.failed_tasks_24h = 0
            health.error_rate = 0.0
            if health.is_healthy is False and health.error_rate < 0.3:
                health.is_healthy = True
                health.message = None


# Global registry instance
agent_registry = AgentRegistry()

