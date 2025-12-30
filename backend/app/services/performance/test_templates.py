"""
Test Templates - Pre-built test scenario templates
Common performance test patterns ready to use
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class TemplateType(Enum):
    """Types of test templates"""
    API_LOAD = "api_load"
    SPIKE_TEST = "spike_test"
    STRESS_TEST = "stress_test"
    ENDURANCE_TEST = "endurance_test"
    CAPACITY_TEST = "capacity_test"
    SOAK_TEST = "soak_test"
    SMOKE_TEST = "smoke_test"


@dataclass
class TestTemplate:
    """Test template definition"""
    template_id: str
    name: str
    description: str
    template_type: TemplateType
    scenario_config: Dict[str, Any]
    load_profile_config: Dict[str, Any]
    default_thresholds: Dict[str, Any]


class TestTemplateLibrary:
    """
    Test Template Library
    Provides pre-built test templates for common scenarios
    """
    
    def __init__(self):
        self.templates: Dict[str, TestTemplate] = {}
        self._initialize_default_templates()
    
    def _initialize_default_templates(self):
        """Initialize default test templates"""
        
        # API Load Test Template
        self.templates["api_load"] = TestTemplate(
            template_id="api_load",
            name="API Load Test",
            description="Standard API load test with gradual ramp-up",
            template_type=TemplateType.API_LOAD,
            scenario_config={
                "think_time_ms": 2000,
                "think_time_variance": 0.3
            },
            load_profile_config={
                "profile_type": "linear",
                "initial_vus": 10,
                "peak_vus": 100,
                "ramp_up_seconds": 60,
                "duration_seconds": 300,
                "ramp_down_seconds": 30
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 500},
                "error_rate": {"operator": "<", "value": 0.01}
            }
        )
        
        # Spike Test Template
        self.templates["spike_test"] = TestTemplate(
            template_id="spike_test",
            name="Spike Test",
            description="Test system behavior under sudden load spikes",
            template_type=TemplateType.SPIKE_TEST,
            scenario_config={
                "think_time_ms": 1000
            },
            load_profile_config={
                "profile_type": "spike",
                "base_vus": 10,
                "spike_vus": 500,
                "spike_duration": 10,
                "spike_interval": 60,
                "duration_seconds": 600
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 2000},
                "error_rate": {"operator": "<", "value": 0.05}
            }
        )
        
        # Stress Test Template
        self.templates["stress_test"] = TestTemplate(
            template_id="stress_test",
            name="Stress Test",
            description="Gradually increase load to find breaking point",
            template_type=TemplateType.STRESS_TEST,
            scenario_config={
                "think_time_ms": 1500
            },
            load_profile_config={
                "profile_type": "stress",
                "initial_vus": 10,
                "peak_vus": 100,
                "increment": 10,
                "interval": 30,
                "max_vus": 1000,
                "ramp_up": 60
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 3000},
                "error_rate": {"operator": "<", "value": 0.1}
            }
        )
        
        # Endurance Test Template
        self.templates["endurance_test"] = TestTemplate(
            template_id="endurance_test",
            name="Endurance Test",
            description="Long-running stability test",
            template_type=TemplateType.ENDURANCE_TEST,
            scenario_config={
                "think_time_ms": 2000
            },
            load_profile_config={
                "profile_type": "endurance",
                "vus": 50,
                "duration_hours": 24,
                "ramp_up": 60
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 1000},
                "error_rate": {"operator": "<", "value": 0.01},
                "memory_leak": {"operator": "<", "value": 0.1}  # Memory growth rate
            }
        )
        
        # Capacity Test Template
        self.templates["capacity_test"] = TestTemplate(
            template_id="capacity_test",
            name="Capacity Planning Test",
            description="Find maximum sustainable load",
            template_type=TemplateType.CAPACITY_TEST,
            scenario_config={
                "think_time_ms": 2000
            },
            load_profile_config={
                "profile_type": "capacity",
                "initial_vus": 10,
                "max_vus": 500,
                "ramp_up": 300,
                "hold": 600,
                "ramp_down": 300
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 1000},
                "error_rate": {"operator": "<", "value": 0.01}
            }
        )
        
        # Smoke Test Template
        self.templates["smoke_test"] = TestTemplate(
            template_id="smoke_test",
            name="Smoke Test",
            description="Quick validation test with minimal load",
            template_type=TemplateType.SMOKE_TEST,
            scenario_config={
                "think_time_ms": 1000
            },
            load_profile_config={
                "profile_type": "linear",
                "initial_vus": 1,
                "peak_vus": 5,
                "ramp_up_seconds": 10,
                "duration_seconds": 60,
                "ramp_down_seconds": 10
            },
            default_thresholds={
                "response_time_p95": {"operator": "<", "value": 500},
                "error_rate": {"operator": "<", "value": 0.0}
            }
        )
    
    def get_template(self, template_id: str) -> Optional[TestTemplate]:
        """Get template by ID"""
        return self.templates.get(template_id)
    
    def list_templates(self) -> List[Dict[str, Any]]:
        """List all available templates"""
        return [
            {
                "template_id": t.template_id,
                "name": t.name,
                "description": t.description,
                "template_type": t.template_type.value
            }
            for t in self.templates.values()
        ]
    
    def create_test_from_template(
        self,
        template_id: str,
        scenario_id: str,
        customizations: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a test configuration from a template"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        
        customizations = customizations or {}
        
        # Merge template config with customizations
        scenario_config = {**template.scenario_config, **customizations.get("scenario_config", {})}
        load_profile_config = {**template.load_profile_config, **customizations.get("load_profile_config", {})}
        thresholds = {**template.default_thresholds, **customizations.get("thresholds", {})}
        
        return {
            "scenario_id": scenario_id,
            "scenario_config": scenario_config,
            "load_profile_config": load_profile_config,
            "thresholds": thresholds,
            "template_id": template_id,
            "template_name": template.name
        }




