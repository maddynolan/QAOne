"""
FLOWSTRAL UNIVERSAL AUTOMATION ENGINE
=====================================
A robust, self-healing automation engine that works across 25+ enterprise applications.

Key Features:
- Smart Element Finding (ML-inspired scoring)
- App Intelligence Plugins (Salesforce, ServiceNow, Workday, SAP, etc.)
- Self-Healing (learns from failures)
- State-Aware Waiting (no fixed timeouts)

Usage:
    from flowstral_engine import FlowstralEngine
    
    engine = FlowstralEngine(page)
    engine.click(text="Save", role="button")
    engine.fill(label="Account Name", value="Acme Corp")
"""

from .engine import FlowstralEngine
from .smart_finder import SmartElementFinder
from .intelligent_waiter import IntelligentWaiter
from .self_healer import SelfHealingController

__version__ = "1.0.0"
__all__ = [
    "FlowstralEngine",
    "SmartElementFinder", 
    "IntelligentWaiter",
    "SelfHealingController",
]

