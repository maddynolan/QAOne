"""
AI Services Module

Contains AI-powered features:
- Vision Self-Healing: GPT-4 Vision for element detection and self-healing
"""

from .vision_self_healing import (
    VisionSelfHealingService,
    get_vision_healing_service,
    ElementLocation,
    HealingResult
)

__all__ = [
    'VisionSelfHealingService',
    'get_vision_healing_service',
    'ElementLocation',
    'HealingResult'
]

