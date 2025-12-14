"""
Persona Registry
Centralized registry for all agent personas.
"""

import logging
from typing import Dict, Type, Optional
from enum import Enum

from app.services.agents.persona_base import AgentPersona
from app.services.agents.personas import (
    ManualPersona,
    PerformancePersona,
    APIPersona,
    AccessibilityPersona,
    SecurityPersona
)

logger = logging.getLogger(__name__)


class PersonaType(str, Enum):
    """Available persona types"""
    MANUAL = "manual"  # Trace
    PERFORMANCE = "performance"  # Blaze
    API = "api"  # Rift
    ACCESSIBILITY = "accessibility"  # A11y
    SECURITY = "security"  # Void


class PersonaRegistry:
    """
    Centralized registry for agent personas.
    Provides singleton instances and factory methods.
    """
    
    _instance = None
    _personas: Dict[PersonaType, AgentPersona] = {}
    _persona_classes: Dict[PersonaType, Type[AgentPersona]] = {
        PersonaType.MANUAL: ManualPersona,
        PersonaType.PERFORMANCE: PerformancePersona,
        PersonaType.API: APIPersona,
        PersonaType.ACCESSIBILITY: AccessibilityPersona,
        PersonaType.SECURITY: SecurityPersona,
    }
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def get_persona(self, persona_type: PersonaType) -> AgentPersona:
        """
        Get persona instance (singleton pattern).
        
        Args:
            persona_type: Type of persona to get
            
        Returns:
            Persona instance
        """
        if persona_type not in self._personas:
            persona_class = self._persona_classes.get(persona_type)
            if not persona_class:
                raise ValueError(f"Unknown persona type: {persona_type}")
            
            logger.info(f"Creating persona instance: {persona_type.value}")
            self._personas[persona_type] = persona_class()
        
        return self._personas[persona_type]
    
    def get_persona_info(self, persona_type: PersonaType) -> Dict:
        """Get persona metadata."""
        persona = self.get_persona(persona_type)
        return persona.get_persona_info()
    
    def list_personas(self) -> Dict[str, Dict]:
        """List all available personas with their info."""
        return {
            persona_type.value: self.get_persona_info(persona_type)
            for persona_type in PersonaType
        }


# Global registry instance
persona_registry = PersonaRegistry()




