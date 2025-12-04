"""
Autonomous App Exploration Service
Provides agentic experience for automatically navigating and understanding applications.
"""

from .autonomous_explorer import AutonomousExplorer, ExplorationConfig, PageCapability
from .capability_map_builder import CapabilityMapBuilder, EntityCapability
from .requirement_comparator import RequirementComparator, RequirementMatch, SupportStatus

__all__ = [
    'AutonomousExplorer',
    'ExplorationConfig',
    'PageCapability',
    'CapabilityMapBuilder',
    'EntityCapability',
    'RequirementComparator',
    'RequirementMatch',
    'SupportStatus'
]




