"""
AI Testing Module v2.0

Agentic AI-driven testing that combines:
- Natural Language commands (TestRigor style)
- Human Element Finder (Playwright getByRole/getByText/getByLabel)
- Vision AI fallback (GPT-4V)
- Self-healing agentic loop

v1.0 (legacy): ai_testing_orchestrator.py - CSS selector based
v2.0 (current): agentic_orchestrator.py - Human-readable, vision AI, self-healing
"""

# v2.0 - Agentic Orchestrator (primary)
from .agentic_orchestrator import (
    AgenticOrchestrator,
    create_agentic_orchestrator,
)

# v1.0 - Legacy (kept for backward compat)
from .ai_testing_orchestrator import (
    AITestingOrchestrator,
    create_orchestrator as create_legacy_orchestrator,
)

# Default: Use v2.0
create_orchestrator = create_agentic_orchestrator

__all__ = [
    "AgenticOrchestrator",
    "create_agentic_orchestrator",
    "create_orchestrator",
    "AITestingOrchestrator",
    "create_legacy_orchestrator",
]
