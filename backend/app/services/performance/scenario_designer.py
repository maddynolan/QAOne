"""
Scenario Designer - Code-less and script-based test scenario creation
Similar to Neoload's drag-and-drop interface
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ActionType(Enum):
    """Types of actions in a test scenario"""
    HTTP_REQUEST = "http_request"
    WEBSOCKET_SEND = "websocket_send"
    WEBSOCKET_RECEIVE = "websocket_receive"
    DELAY = "delay"
    VALIDATION = "validation"
    CORRELATION = "correlation"
    LOOP = "loop"
    CONDITION = "condition"
    TRANSACTION = "transaction"


@dataclass
class TestStep:
    """A single step in a test scenario"""
    step_id: str
    name: str
    action_type: ActionType
    parameters: Dict[str, Any] = field(default_factory=dict)
    validation: Optional[Dict[str, Any]] = None
    correlation_rules: List[Dict[str, Any]] = field(default_factory=list)
    on_error: str = "continue"  # continue, stop, retry
    retry_count: int = 0
    retry_delay_ms: int = 1000


@dataclass
class TestScenario:
    """Complete test scenario definition"""
    scenario_id: str
    name: str
    description: str = ""
    steps: List[TestStep] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    data_source: Optional[str] = None
    think_time_ms: int = 2000
    think_time_variance: float = 0.3
    load_profile: Dict[str, Any] = field(default_factory=dict)


class ScenarioDesigner:
    """
    Scenario Designer - Create test scenarios via code-less interface or scripts
    """
    
    def __init__(self):
        self.scenarios: Dict[str, TestScenario] = {}
    
    def create_scenario(
        self,
        name: str,
        description: str = "",
        scenario_id: Optional[str] = None
    ) -> str:
        """Create a new test scenario"""
        if not scenario_id:
            import uuid
            scenario_id = str(uuid.uuid4())
        
        scenario = TestScenario(
            scenario_id=scenario_id,
            name=name,
            description=description
        )
        
        self.scenarios[scenario_id] = scenario
        logger.info(f"Created scenario: {name} ({scenario_id})")
        
        return scenario_id
    
    def add_step(
        self,
        scenario_id: str,
        step: TestStep
    ) -> str:
        """Add a step to a scenario"""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        scenario = self.scenarios[scenario_id]
        scenario.steps.append(step)
        
        logger.debug(f"Added step {step.step_id} to scenario {scenario_id}")
        return step.step_id
    
    def create_http_request_step(
        self,
        name: str,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Any] = None,
        content_type: str = "application/json",
        validation: Optional[Dict[str, Any]] = None,
        correlation_rules: Optional[List[Dict[str, Any]]] = None
    ) -> TestStep:
        """Create an HTTP request step"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.HTTP_REQUEST,
            parameters={
                "method": method.upper(),
                "url": url,
                "headers": headers or {},
                "body": body,
                "content_type": content_type
            },
            validation=validation,
            correlation_rules=correlation_rules or []
        )
    
    def create_delay_step(
        self,
        name: str,
        delay_ms: int
    ) -> TestStep:
        """Create a delay step"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.DELAY,
            parameters={"delay_ms": delay_ms}
        )
    
    def create_validation_step(
        self,
        name: str,
        validation_type: str,
        expected_value: Any,
        actual_path: str
    ) -> TestStep:
        """Create a validation step"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.VALIDATION,
            parameters={
                "validation_type": validation_type,  # equals, contains, regex, etc.
                "expected_value": expected_value,
                "actual_path": actual_path
            }
        )
    
    def create_correlation_step(
        self,
        name: str,
        variable_name: str,
        extract_type: str,
        extract_value: str
    ) -> TestStep:
        """Create a correlation step"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.CORRELATION,
            parameters={
                "variable_name": variable_name,
                "extract_type": extract_type,
                "extract_value": extract_value
            },
            correlation_rules=[{
                "variable_name": variable_name,
                "extract_type": extract_type,
                "extract_value": extract_value
            }]
        )
    
    def create_loop_step(
        self,
        name: str,
        loop_count: int,
        steps: List[TestStep]
    ) -> TestStep:
        """Create a loop step"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.LOOP,
            parameters={
                "loop_count": loop_count,
                "steps": [s.step_id for s in steps]
            }
        )
    
    def create_transaction_step(
        self,
        name: str,
        steps: List[TestStep]
    ) -> TestStep:
        """Create a transaction step (group of steps)"""
        import uuid
        step_id = str(uuid.uuid4())
        
        return TestStep(
            step_id=step_id,
            name=name,
            action_type=ActionType.TRANSACTION,
            parameters={
                "steps": [s.step_id for s in steps]
            }
        )
    
    def convert_to_load_scenario(
        self,
        scenario_id: str,
        virtual_users: int = 10,
        ramp_up_seconds: int = 60,
        duration_seconds: int = 300,
        ramp_down_seconds: int = 30,
        think_time_ms: int = 2000,
        thresholds: Optional[Dict[str, Any]] = None
    ):
        """Convert TestScenario to LoadScenario format"""
        from .load_generator import LoadScenario
        
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        test_scenario = self.scenarios[scenario_id]
        
        # Convert steps to user journey format
        user_journey = []
        for step in test_scenario.steps:
            journey_step = {
                "step_id": step.step_id,
                "name": step.name,
                "action_type": step.action_type.value,
                "parameters": step.parameters,
                "validation": step.validation,
                "correlation_rules": step.correlation_rules,
                "on_error": step.on_error,
                "retry_count": step.retry_count
            }
            user_journey.append(journey_step)
        
        # Create LoadScenario
        load_scenario = LoadScenario(
            name=test_scenario.name,
            user_journey=user_journey,
            virtual_users=virtual_users,
            ramp_up_seconds=ramp_up_seconds,
            duration_seconds=duration_seconds,
            ramp_down_seconds=ramp_down_seconds,
            think_time_ms=think_time_ms or test_scenario.think_time_ms,
            data_source=test_scenario.data_source,
            correlation_rules=self._extract_correlation_rules(test_scenario),
            thresholds=thresholds or {}
        )
        
        return load_scenario
    
    def _extract_correlation_rules(self, scenario: TestScenario) -> List[Dict[str, Any]]:
        """Extract all correlation rules from scenario steps"""
        rules = []
        for step in scenario.steps:
            rules.extend(step.correlation_rules)
        return rules
    
    def import_from_flowstral(
        self,
        flowstral_session: Dict[str, Any]
    ) -> str:
        """Import scenario from Flowstral recording"""
        import uuid
        
        scenario_id = str(uuid.uuid4())
        scenario_name = f"Flowstral Import - {flowstral_session.get('session_id', 'unknown')}"
        
        scenario = TestScenario(
            scenario_id=scenario_id,
            name=scenario_name,
            description="Imported from Flowstral recording"
        )
        
        # Convert Flowstral action graph to test steps
        nodes = flowstral_session.get("action_graph", {}).get("nodes", [])
        
        for node in nodes:
            event_type = node.get("event_type", "")
            url = node.get("url", "")
            
            if event_type == "navigation" or event_type == "page_load":
                # HTTP GET request
                step = self.create_http_request_step(
                    name=f"Navigate to {url}",
                    method="GET",
                    url=url
                )
                scenario.steps.append(step)
            
            elif event_type == "click":
                # If it's a form submission, might be POST
                # For now, treat as navigation
                target_url = node.get("target_url") or url
                if target_url:
                    step = self.create_http_request_step(
                        name=f"Click - {node.get('target_text', 'element')}",
                        method="GET",
                        url=target_url
                    )
                    scenario.steps.append(step)
            
            elif event_type == "api_call":
                # API call from network monitoring
                api_url = node.get("api_url", url)
                api_method = node.get("api_method", "GET")
                api_body = node.get("api_body")
                
                step = self.create_http_request_step(
                    name=f"API {api_method} {api_url}",
                    method=api_method,
                    url=api_url,
                    body=api_body
                )
                scenario.steps.append(step)
            
            # Add delay based on timing
            if node.get("timestamp"):
                # Calculate delay from previous node
                delay_ms = node.get("delay_ms", 500)
                if delay_ms > 0:
                    delay_step = self.create_delay_step(
                        name="Think time",
                        delay_ms=delay_ms
                    )
                    scenario.steps.append(delay_step)
        
        self.scenarios[scenario_id] = scenario
        logger.info(f"Imported Flowstral session as scenario: {scenario_id}")
        
        return scenario_id
    
    def export_to_json(self, scenario_id: str) -> str:
        """Export scenario to JSON"""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        scenario = self.scenarios[scenario_id]
        
        export_data = {
            "scenario_id": scenario.scenario_id,
            "name": scenario.name,
            "description": scenario.description,
            "steps": [
                {
                    "step_id": step.step_id,
                    "name": step.name,
                    "action_type": step.action_type.value,
                    "parameters": step.parameters,
                    "validation": step.validation,
                    "correlation_rules": step.correlation_rules,
                    "on_error": step.on_error,
                    "retry_count": step.retry_count,
                    "retry_delay_ms": step.retry_delay_ms
                }
                for step in scenario.steps
            ],
            "variables": scenario.variables,
            "data_source": scenario.data_source,
            "think_time_ms": scenario.think_time_ms,
            "think_time_variance": scenario.think_time_variance,
            "load_profile": scenario.load_profile
        }
        
        return json.dumps(export_data, indent=2)
    
    def import_from_json(self, json_data: str) -> str:
        """Import scenario from JSON"""
        import uuid
        
        data = json.loads(json_data)
        
        scenario_id = data.get("scenario_id") or str(uuid.uuid4())
        
        scenario = TestScenario(
            scenario_id=scenario_id,
            name=data.get("name", "Imported Scenario"),
            description=data.get("description", ""),
            variables=data.get("variables", {}),
            data_source=data.get("data_source"),
            think_time_ms=data.get("think_time_ms", 2000),
            think_time_variance=data.get("think_time_variance", 0.3),
            load_profile=data.get("load_profile", {})
        )
        
        # Import steps
        for step_data in data.get("steps", []):
            step = TestStep(
                step_id=step_data.get("step_id", str(uuid.uuid4())),
                name=step_data.get("name", "Unnamed Step"),
                action_type=ActionType(step_data.get("action_type", "http_request")),
                parameters=step_data.get("parameters", {}),
                validation=step_data.get("validation"),
                correlation_rules=step_data.get("correlation_rules", []),
                on_error=step_data.get("on_error", "continue"),
                retry_count=step_data.get("retry_count", 0),
                retry_delay_ms=step_data.get("retry_delay_ms", 1000)
            )
            scenario.steps.append(step)
        
        self.scenarios[scenario_id] = scenario
        logger.info(f"Imported scenario from JSON: {scenario_id}")
        
        return scenario_id
    
    def get_scenario(self, scenario_id: str) -> Optional[TestScenario]:
        """Get scenario by ID"""
        return self.scenarios.get(scenario_id)
    
    def list_scenarios(self) -> List[Dict[str, Any]]:
        """List all scenarios"""
        return [
            {
                "scenario_id": scenario.scenario_id,
                "name": scenario.name,
                "description": scenario.description,
                "step_count": len(scenario.steps)
            }
            for scenario in self.scenarios.values()
        ]
    
    def delete_scenario(self, scenario_id: str):
        """Delete a scenario"""
        if scenario_id in self.scenarios:
            del self.scenarios[scenario_id]
            logger.info(f"Deleted scenario: {scenario_id}")




