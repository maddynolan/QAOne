"""
Script to update imports after service reorganization

This script updates import statements across the codebase to reflect
the new domain-based service organization.
"""

import os
import re
from pathlib import Path

# Mapping of old imports to new imports
IMPORT_MAPPINGS = {
    # Agents
    "from app.services.requirements_agent": "from app.services.agents.requirements_agent",
    "from app.services.test_design_agent": "from app.services.agents.test_design_agent",
    "from app.services.automation_agent": "from app.services.agents.automation_agent",
    "from app.services.accessibility_agent": "from app.services.agents.accessibility_agent",
    "from app.services.performance_agent": "from app.services.agents.performance_agent",
    "from app.services.security_agent": "from app.services.agents.security_agent",
    "from app.services.defect_agent": "from app.services.agents.defect_agent",
    "from app.services.accessibility_compliance": "from app.services.agents.accessibility_compliance",
    
    # Connectors
    "from app.services.jira_connector": "from app.services.connectors.jira_connector",
    "from app.services.github_connector": "from app.services.connectors.github_connector",
    "from app.services.confluence_connector": "from app.services.connectors.confluence_connector",
    "from app.services.azure_devops_connector": "from app.services.connectors.azure_devops_connector",
    "from app.services.cicd_connector": "from app.services.connectors.cicd_connector",
    
    # Executors
    "from app.services.playwright_executor": "from app.services.executors.playwright_executor",
    "from app.services.playwright_runner": "from app.services.executors.playwright_runner",
    "from app.services.k6_executor": "from app.services.executors.k6_executor",
    "from app.services.zap_executor": "from app.services.executors.zap_executor",
    "from app.services.test_runner_service": "from app.services.executors.test_runner_service",
    "from app.services.unified_runner_service": "from app.services.executors.unified_runner_service",
    "from app.services.test_executor_queue": "from app.services.executors.test_executor_queue",
    
    # LLM
    "from app.services.model_gateway": "from app.services.llm.model_gateway",
    "from app.services.ollama_service": "from app.services.llm.ollama_service",
    "from app.services.vllm_service": "from app.services.llm.vllm_service",
    "from app.services.llm_service": "from app.services.llm.llm_service",
    "from app.services.enhanced_generation_service": "from app.services.llm.enhanced_generation_service",
    "from app.services.model_registry": "from app.services.llm.model_registry",
    "from app.services.model_router": "from app.services.llm.model_router",
    
    # Prompts
    "from app.services.prompt_builders": "from app.services.llm.prompt.prompt_builders",
    "from app.services.prompt_templates": "from app.services.llm.prompt.prompt_templates",
    "from app.services.prompt_template_service": "from app.services.llm.prompt.prompt_template_service",
    
    # Flowstral
    "from app.services.flowstral_action_graph": "from app.services.flowstral.flowstral_action_graph",
    "from app.services.flowstral_action_graph_builder": "from app.services.flowstral.flowstral_action_graph_builder",
    "from app.services.flowstral_artifacts": "from app.services.flowstral.flowstral_artifacts",
    "from app.services.flowstral_dom_pipeline": "from app.services.flowstral.flowstral_dom_pipeline",
    "from app.services.flowstral_gateway": "from app.services.flowstral.flowstral_gateway",
    "from app.services.flowstral_orchestrator": "from app.services.flowstral.flowstral_orchestrator",
    "from app.services.flowstral_performance_pipeline": "from app.services.flowstral.flowstral_performance_pipeline",
    "from app.services.flowstral_realtime_output": "from app.services.flowstral.flowstral_realtime_output",
    "from app.services.flowstral_session": "from app.services.flowstral.flowstral_session",
    "from app.services.flowstral_wcag_pipeline": "from app.services.flowstral.flowstral_wcag_pipeline",
    "from app.services.flowstral_websocket_manager": "from app.services.flowstral.flowstral_websocket_manager",
    "from app.services.flowstral_agent_orchestrator": "from app.services.flowstral.flowstral_agent_orchestrator",
    
    # Storage
    "from app.services.database": "from app.services.storage.database",
    "from app.services.postgres_direct": "from app.services.storage.postgres_direct",
    "from app.services.ai_storage": "from app.services.storage.ai_storage",
    "from app.services.object_store": "from app.services.storage.object_store",
    "from app.services.test_results_storage": "from app.services.storage.test_results_storage",
    
    # Core
    "from app.services.orchestrator": "from app.services.core.orchestrator",
    "from app.services.agent_registry": "from app.services.core.agent_registry",
    "from app.services.agent_registration": "from app.services.core.agent_registration",
    "from app.services.cache_service": "from app.services.core.cache_service",
    "from app.services.metrics_service": "from app.services.core.metrics_service",
    "from app.services.observability_service": "from app.services.core.observability_service",
    "from app.services.tenant_service": "from app.services.core.tenant_service",
    "from app.services.rbac_service": "from app.services.core.rbac_service",
    "from app.services.app_first_flow_orchestrator": "from app.services.core.app_first_flow_orchestrator",
    "from app.services.plugin_service": "from app.services.core.plugin_service",
    
    # Utils
    "from app.services.code_validator": "from app.services.utils.code_validator",
    "from app.services.dom_recorder": "from app.services.utils.dom_recorder",
    "from app.services.embedding_service": "from app.services.utils.embedding_service",
    "from app.services.rag_service": "from app.services.utils.rag_service",
    "from app.services.q_index": "from app.services.utils.q_index",
    "from app.services.self_healing": "from app.services.utils.self_healing",
    "from app.services.style_codes": "from app.services.utils.style_codes",
    "from app.services.synthetic_requirements": "from app.services.utils.synthetic_requirements",
    "from app.services.template_service": "from app.services.utils.template_service",
    "from app.services.test_generation_optimizer": "from app.services.utils.test_generation_optimizer",
    "from app.services.run_matrix": "from app.services.utils.run_matrix",
    "from app.services.planner": "from app.services.utils.planner",
}

# Also handle import statements
IMPORT_MAPPINGS.update({
    "import app.services.requirements_agent": "import app.services.agents.requirements_agent",
    "import app.services.test_design_agent": "import app.services.agents.test_design_agent",
    # Add more as needed
})


def update_file_imports(file_path: Path) -> bool:
    """Update imports in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        updated = False
        
        for old_import, new_import in IMPORT_MAPPINGS.items():
            if old_import in content:
                content = content.replace(old_import, new_import)
                if content != original_content:
                    updated = True
        
        if updated:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error updating {file_path}: {e}")
        return False


def main():
    """Update imports across the codebase"""
    backend_dir = Path(__file__).parent
    app_dir = backend_dir / "app"
    
    updated_files = []
    
    # Update Python files
    for py_file in app_dir.rglob("*.py"):
        if update_file_imports(py_file):
            updated_files.append(py_file)
            print(f"Updated: {py_file.relative_to(backend_dir)}")
    
    print(f"\n[OK] Updated {len(updated_files)} files")
    print("\n[WARN] Please review the changes and test the application!")


if __name__ == "__main__":
    main()

