"""
Persona Registry
All agent personas for the QA AI Platform.
"""

from app.services.agents.personas.manual_persona import ManualPersona, ManualTestSuite, ManualTestCase, TestStep
from app.services.agents.personas.performance_persona import (
    PerformancePersona, PerformanceTestSuite, PerformanceTestScript, LoadScenario, ChaosScenario
)
from app.services.agents.personas.api_persona import APIPersona, APITestSuite, APITestCase, SecurityTest
from app.services.agents.personas.accessibility_persona import (
    AccessibilityPersona, AccessibilityTestSuite, WCAGTest
)
from app.services.agents.personas.security_persona import (
    SecurityPersona, SecurityTestSuite, SecurityExploit, SecurityMitigation
)

__all__ = [
    # Manual Testing
    "ManualPersona",
    "ManualTestSuite",
    "ManualTestCase",
    "TestStep",
    # Performance Testing
    "PerformancePersona",
    "PerformanceTestSuite",
    "PerformanceTestScript",
    "LoadScenario",
    "ChaosScenario",
    # API Testing
    "APIPersona",
    "APITestSuite",
    "APITestCase",
    "SecurityTest",
    # Accessibility Testing
    "AccessibilityPersona",
    "AccessibilityTestSuite",
    "WCAGTest",
    # Security Testing
    "SecurityPersona",
    "SecurityTestSuite",
    "SecurityExploit",
    "SecurityMitigation",
]




