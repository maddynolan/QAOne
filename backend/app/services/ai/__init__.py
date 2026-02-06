"""
AI Services Module

Contains AI-powered features:
- Vision Self-Healing: GPT-4 Vision for element detection and self-healing
- AI Enhancements: False positive persistence, flaky step detection, AI failure explainer
"""

from .vision_self_healing import (
    VisionSelfHealingService,
    get_vision_healing_service,
    ElementLocation,
    HealingResult
)

from .ai_enhancements import (
    FalsePositivePersistence,
    FlakyStepTracker,
    AIFailureExplainer,
    get_false_positive_service,
    get_flaky_step_tracker,
    get_failure_explainer,
    FalsePositiveFlag,
    FixOption,
    FailureExplanation,
)

__all__ = [
    'VisionSelfHealingService',
    'get_vision_healing_service',
    'ElementLocation',
    'HealingResult',
    # AI Enhancements
    'FalsePositivePersistence',
    'FlakyStepTracker',
    'AIFailureExplainer',
    'get_false_positive_service',
    'get_flaky_step_tracker',
    'get_failure_explainer',
    'FalsePositiveFlag',
    'FixOption',
    'FailureExplanation',
]
