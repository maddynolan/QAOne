# 🔧 Codebase Refactoring Plan

## Current State Analysis

### Issues Identified
1. **main.py is massive** - 127 functions/classes, ~7000 lines
2. **Flat services structure** - 69 files in single directory (884KB)
3. **Duplicate functionality**:
   - `prompt_builders.py`, `prompt_templates.py`, `prompt_template_service.py`
   - Multiple runner services: `playwright_runner.py`, `playwright_executor.py`, `test_runner_service.py`, `unified_runner_service.py`
   - Multiple Flowstral services scattered
4. **Test files scattered** - test files in backend root instead of proper test directories
5. **No clear domain separation** - agents, connectors, executors all mixed together

## Refactoring Strategy

### Phase 1: Organize Services by Domain ✅
```
backend/app/services/
├── agents/           # All agent services
│   ├── requirements_agent.py
│   ├── test_design_agent.py
│   ├── automation_agent.py
│   ├── accessibility_agent.py
│   ├── performance_agent.py
│   ├── security_agent.py
│   └── defect_agent.py
├── connectors/       # External service integrations
│   ├── jira_connector.py
│   ├── github_connector.py
│   ├── confluence_connector.py
│   ├── azure_devops_connector.py
│   └── cicd_connector.py
├── executors/        # Test execution services
│   ├── playwright_executor.py
│   ├── k6_executor.py
│   └── zap_executor.py
├── llm/              # LLM-related services
│   ├── model_gateway.py
│   ├── ollama_service.py
│   ├── vllm_service.py
│   ├── llm_service.py
│   └── prompt/       # Prompt management
│       ├── prompt_builders.py
│       ├── prompt_templates.py
│       └── prompt_template_service.py
├── flowstral/        # Flowstral-specific services
│   ├── flowstral_action_graph.py
│   ├── flowstral_action_graph_builder.py
│   ├── flowstral_artifacts.py
│   ├── flowstral_dom_pipeline.py
│   ├── flowstral_gateway.py
│   ├── flowstral_orchestrator.py
│   ├── flowstral_performance_pipeline.py
│   ├── flowstral_session.py
│   ├── flowstral_wcag_pipeline.py
│   └── flowstral_websocket_manager.py
├── storage/          # Data storage services
│   ├── database.py
│   ├── postgres_direct.py
│   ├── ai_storage.py
│   ├── object_store.py
│   └── test_results_storage.py
├── core/             # Core infrastructure
│   ├── orchestrator.py
│   ├── agent_registry.py
│   ├── agent_registration.py
│   ├── cache_service.py
│   ├── metrics_service.py
│   ├── observability_service.py
│   └── tenant_service.py
└── utils/            # Utility services
    ├── code_validator.py
    ├── dom_recorder.py
    ├── embedding_service.py
    ├── rag_service.py
    └── q_index.py
```

### Phase 2: Split main.py into Routers ✅
```
backend/app/routers/
├── __init__.py
├── requirements.py      # Requirements endpoints
├── test_cases.py        # Test case endpoints
├── test_runs.py         # Test execution endpoints
├── flowstral.py         # Flowstral endpoints (already exists)
├── agents.py            # Agent endpoints
├── integrations.py      # Integration endpoints (Jira, GitHub, etc.)
├── projects.py          # Project management
└── health.py            # Health checks
```

### Phase 3: Consolidate Duplicate Services ✅
- Merge prompt services into single `prompt/` module
- Consolidate runner services into unified executor pattern
- Remove redundant code

### Phase 4: Create Shared Utilities ✅
```
backend/app/core/
├── __init__.py
├── config.py           # Configuration management
├── logging_config.py    # Centralized logging
├── exceptions.py       # Custom exceptions
└── base.py             # Base classes for services
```

### Phase 5: Organize Test Files ✅
```
backend/tests/
├── unit/
│   ├── services/
│   └── routers/
├── integration/
└── e2e/
```

## Implementation Order

1. ✅ Create domain subdirectories
2. ✅ Move services to appropriate domains
3. ✅ Update imports across codebase
4. ✅ Split main.py into routers
5. ✅ Consolidate duplicate services
6. ✅ Create shared utilities
7. ✅ Move test files
8. ✅ Update documentation

## Migration Strategy

- Use git for tracking changes
- Update imports incrementally
- Test after each major move
- Keep backward compatibility where possible



