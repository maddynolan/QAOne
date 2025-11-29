"""
Services package - organized by domain

This package contains all service modules organized into domain-specific subdirectories:
- agents/: Agent services (requirements, test design, automation, etc.)
- connectors/: External service integrations (Jira, GitHub, etc.)
- executors/: Test execution services (Playwright, k6, ZAP)
- llm/: LLM-related services (model gateway, Ollama, vLLM, prompts)
- flowstral/: Flowstral-specific services
- storage/: Data storage services (database, object store, etc.)
- core/: Core infrastructure (orchestrator, registry, cache, etc.)
- utils/: Utility services (validators, recorders, embeddings, etc.)
"""

# Import commonly used services for backward compatibility
# These will be updated as we migrate services to subdirectories

__all__ = []



