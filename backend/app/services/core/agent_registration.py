"""
Agent Registration - Register all agents with the registry
Phase 2-4: All Agents
"""

import logging
from app.services.core.agent_registry import agent_registry
from app.schemas.agent_schemas import AgentType, AgentCapability

# Import agent handlers
from app.services.agents.requirements_agent import requirements_agent_handler
from app.services.agents.automation_agent import automation_agent_handler
from app.services.executors.test_runner_service import test_runner_agent_handler
from app.services.agents.performance_agent import performance_agent_handler
from app.services.agents.accessibility_agent import accessibility_agent_handler
from app.services.agents.security_agent import security_agent_handler
from app.services.agents.defect_agent import defect_agent_handler
from app.services.agents.test_design_agent import test_design_agent_handler

logger = logging.getLogger(__name__)


def register_all_agents():
    """Register all agents with the agent registry"""
    
    # Requirements Agent
    agent_registry.register_agent(
        agent_type=AgentType.REQUIREMENTS,
        capability=AgentCapability(
            agent_type=AgentType.REQUIREMENTS,
            name="Requirements Intelligence Agent",
            description="Syncs requirements from Jira/Confluence/Azure DevOps, implements RAG, generates test cases",
            version="1.0.0",
            supported_operations=[
                "sync_jira",
                "sync_confluence",
                "sync_azure_devops",
                "generate_tests",
                "traceability",
                "detect_duplicates",
                "detect_conflicts"
            ],
            required_inputs=["operation"],
            optional_inputs=["project_key", "space_key", "requirement_id", "similarity_threshold"],
            estimated_latency_ms=5000,
            max_concurrent_tasks=5
        ),
        handler=requirements_agent_handler
    )
    
    # Automation Agent
    agent_registry.register_agent(
        agent_type=AgentType.AUTOMATION,
        capability=AgentCapability(
            agent_type=AgentType.AUTOMATION,
            name="Automation Agent",
            description="Generates and executes Playwright tests with self-healing",
            version="1.0.0",
            supported_operations=[
                "generate",
                "run",
                "heal",
                "maintenance_suggestions"
            ],
            required_inputs=["operation"],
            optional_inputs=["requirement_id", "recording_id", "description", "test_code", "test_id"],
            estimated_latency_ms=10000,
            max_concurrent_tasks=3
        ),
        handler=automation_agent_handler
    )
    
    # Test Runner Agent
    agent_registry.register_agent(
        agent_type=AgentType.TEST_RUNNER,
        capability=AgentCapability(
            agent_type=AgentType.TEST_RUNNER,
            name="Test Runner Service",
            description="Queue-based test execution with Docker workers",
            version="1.0.0",
            supported_operations=[
                "submit",
                "status",
                "cancel",
                "list",
                "artifacts"
            ],
            required_inputs=["operation"],
            optional_inputs=["test_case_ids", "job_id", "browser", "status", "limit"],
            estimated_latency_ms=30000,
            max_concurrent_tasks=10
        ),
        handler=test_runner_agent_handler
    )
    
    # Performance Agent
    agent_registry.register_agent(
        agent_type=AgentType.PERFORMANCE,
        capability=AgentCapability(
            agent_type=AgentType.PERFORMANCE,
            name="Performance Testing Agent",
            description="Executes k6 performance tests and tracks metrics",
            version="1.0.0",
            supported_operations=[
                "execute",
                "generate_script",
                "metrics",
                "sla_status"
            ],
            required_inputs=["operation"],
            optional_inputs=["test_script", "endpoints", "run_id", "start_date", "end_date"],
            estimated_latency_ms=60000,
            max_concurrent_tasks=2
        ),
        handler=performance_agent_handler
    )
    
    # Accessibility Agent
    agent_registry.register_agent(
        agent_type=AgentType.ACCESSIBILITY,
        capability=AgentCapability(
            agent_type=AgentType.ACCESSIBILITY,
            name="Accessibility Agent",
            description="Scans pages for accessibility issues and generates fixes",
            version="1.0.0",
            supported_operations=[
                "scan",
                "generate_fixes",
                "get_issues"
            ],
            required_inputs=["operation"],
            optional_inputs=["url", "issue_id", "severity", "limit"],
            estimated_latency_ms=15000,
            max_concurrent_tasks=5
        ),
        handler=accessibility_agent_handler
    )
    
    # Security Agent
    agent_registry.register_agent(
        agent_type=AgentType.SECURITY,
        capability=AgentCapability(
            agent_type=AgentType.SECURITY,
            name="Security Agent",
            description="Executes ZAP security scans with intelligent triage",
            version="1.0.0",
            supported_operations=[
                "scan",
                "deduplicate",
                "explain_risk",
                "generate_test"
            ],
            required_inputs=["operation"],
            optional_inputs=["target_url", "scan_type", "findings", "finding_id"],
            estimated_latency_ms=120000,
            max_concurrent_tasks=1
        ),
        handler=security_agent_handler
    )
    
    # Defect Agent
    agent_registry.register_agent(
        agent_type=AgentType.DEFECT,
        capability=AgentCapability(
            agent_type=AgentType.DEFECT,
            name="Defect Agent",
            description="Captures and files defects automatically from test failures",
            version="1.0.0",
            supported_operations=[
                "capture_and_file"
            ],
            required_inputs=["operation", "test_run_id", "test_case_id", "failure_message"],
            optional_inputs=["failure_step", "screenshot", "logs", "steps", "file_to_jira", "jira_project_key"],
            estimated_latency_ms=8000,
            max_concurrent_tasks=10
        ),
        handler=defect_agent_handler
    )
    
    # Test Design Agent
    agent_registry.register_agent(
        agent_type=AgentType.TEST_DESIGN,
        capability=AgentCapability(
            agent_type=AgentType.TEST_DESIGN,
            name="Test Design Agent",
            description="Converts Playwright scripts to structured test cases",
            version="1.0.0",
            supported_operations=[
                "convert_script"
            ],
            required_inputs=["operation", "playwright_script"],
            optional_inputs=["recording_data", "requirement_id"],
            estimated_latency_ms=12000,
            max_concurrent_tasks=5
        ),
        handler=test_design_agent_handler
    )
    
    logger.debug("All agents registered successfully")


# Auto-register on import
register_all_agents()

