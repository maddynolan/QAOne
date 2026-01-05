"""
Performance Engine - Main orchestrator for performance testing
Ties together all components: load generation, monitoring, correlation, etc.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

from .load_generator import LoadGenerator, LoadScenario
from .scenario_designer import ScenarioDesigner, TestScenario
from .monitoring_service import MonitoringService
from .protocol_handler import ProtocolHandler, HTTPHandler, create_protocol_handler
from .correlation_engine import CorrelationEngine
from .distributed_controller import DistributedController
from .load_profiles import LoadProfileManager, LoadProfile, LoadProfileType
from .data_parameterization import DataParameterizationEngine
from .system_monitoring import SystemMonitor
from .reporting_engine import ReportingEngine
from .alerting_service import AlertingService, AlertSeverity
from .test_scheduler import TestScheduler, ScheduleType
from .transaction_analyzer import TransactionAnalyzer
from .advanced_protocols import create_advanced_protocol_handler
from .test_templates import TestTemplateLibrary
from .network_simulation import NetworkSimulator, NetworkProfile
from .apm_integration import APMIntegration, APMProvider

logger = logging.getLogger(__name__)


class PerformanceEngine:
    """
    Main Performance Testing Engine
    Orchestrates load generation, monitoring, correlation, reporting, and all enterprise features
    """
    
    def __init__(self):
        self.load_generator = LoadGenerator()
        self.scenario_designer = ScenarioDesigner()
        self.monitoring_service = MonitoringService()
        self.correlation_engine = CorrelationEngine()
        self.distributed_controller = DistributedController()
        
        # Enterprise features
        self.load_profile_manager = LoadProfileManager()
        self.data_parameterization = DataParameterizationEngine()
        self.system_monitor = SystemMonitor()
        self.reporting_engine = ReportingEngine()
        self.alerting_service = AlertingService()
        self.test_scheduler = TestScheduler()
        self.transaction_analyzer = TransactionAnalyzer()
        self.test_templates = TestTemplateLibrary()
        self.network_simulator = NetworkSimulator()
        self.apm_integration = APMIntegration()
        
        self.active_tests: Dict[str, Dict[str, Any]] = {}
        self.test_results: Dict[str, Dict[str, Any]] = {}
    
    async def create_scenario_from_flowstral(
        self,
        flowstral_session: Dict[str, Any],
        scenario_name: Optional[str] = None
    ) -> str:
        """
        Create a performance test scenario from Flowstral recording
        
        Args:
            flowstral_session: Flowstral session data with action graph
            scenario_name: Optional name for the scenario
            
        Returns:
            Scenario ID
        """
        scenario_id = self.scenario_designer.import_from_flowstral(flowstral_session)
        
        if scenario_name:
            scenario = self.scenario_designer.get_scenario(scenario_id)
            if scenario:
                scenario.name = scenario_name
        
        logger.info(f"Created scenario from Flowstral: {scenario_id}")
        return scenario_id
    
    async def create_scenario(
        self,
        name: str,
        description: str = ""
    ) -> str:
        """Create a new test scenario"""
        return self.scenario_designer.create_scenario(name, description)
    
    async def add_http_request_to_scenario(
        self,
        scenario_id: str,
        name: str,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Any] = None,
        correlation_rules: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Add HTTP request step to scenario"""
        step = self.scenario_designer.create_http_request_step(
            name=name,
            method=method,
            url=url,
            headers=headers,
            body=body,
            correlation_rules=correlation_rules
        )
        
        return self.scenario_designer.add_step(scenario_id, step)
    
    async def run_load_test(
        self,
        scenario_id: str,
        virtual_users: int = 10,
        ramp_up_seconds: int = 60,
        duration_seconds: int = 300,
        ramp_down_seconds: int = 30,
        think_time_ms: int = 2000,
        base_url: Optional[str] = None,
        protocol: str = "http",
        thresholds: Optional[Dict[str, Any]] = None,
        sla_thresholds: Optional[Dict[str, Any]] = None,
        use_distributed: bool = False
    ) -> str:
        """
        Run a load test
        
        Args:
            scenario_id: Scenario ID to run
            virtual_users: Number of virtual users
            ramp_up_seconds: Ramp-up duration
            duration_seconds: Test duration
            ramp_down_seconds: Ramp-down duration
            think_time_ms: Think time between actions
            base_url: Base URL for requests
            protocol: Protocol to use (http, websocket)
            thresholds: Performance thresholds
            sla_thresholds: SLA thresholds
            use_distributed: Use distributed load generation
            
        Returns:
            Test run ID
        """
        # Get scenario
        test_scenario = self.scenario_designer.get_scenario(scenario_id)
        if not test_scenario:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        # Convert to load scenario
        load_scenario = self.scenario_designer.convert_to_load_scenario(
            scenario_id=scenario_id,
            virtual_users=virtual_users,
            ramp_up_seconds=ramp_up_seconds,
            duration_seconds=duration_seconds,
            ramp_down_seconds=ramp_down_seconds,
            think_time_ms=think_time_ms,
            thresholds=thresholds or {}
        )
        
        # Create protocol handler
        protocol_handler = create_protocol_handler(protocol, base_url=base_url)
        
        # Setup monitoring
        async def metrics_callback(metrics):
            """Callback for real-time metrics"""
            self.monitoring_service.update_metrics(metrics)
        
        # Start monitoring
        await self.monitoring_service.start_monitoring(
            metrics_callback=metrics_callback
        )
        
        # Set SLA thresholds
        if sla_thresholds:
            self.monitoring_service.set_sla_thresholds(sla_thresholds)
        
        # Create test ID first so we can return it immediately
        test_id = f"test_{uuid.uuid4()}"
        
        # Store test info BEFORE starting (so status polling works)
        self.active_tests[test_id] = {
            "scenario_id": scenario_id,
            "start_time": datetime.utcnow(),
            "status": "running"
        }
        
        logger.info(f"Starting load test: {test_id}")
        
        if use_distributed and self.distributed_controller.get_available_nodes():
            # Run distributed test
            scenario_config = {
                "name": load_scenario.name,
                "virtual_users": virtual_users,
                "ramp_up_seconds": ramp_up_seconds,
                "duration_seconds": duration_seconds
            }
            
            test_id = await self.distributed_controller.start_distributed_test(scenario_config)
        else:
            # Run local test as BACKGROUND TASK (don't await - return immediately!)
            async def run_test_background():
                try:
                    async with protocol_handler:
                        # Add scenario to load generator
                        await self.load_generator.add_scenario(load_scenario)
                        
                        # Start test (this blocks until test completes)
                        await self.load_generator.start_load_test(
                            scenario_names=[load_scenario.name],
                            protocol_handler=protocol_handler,
                            metrics_callback=metrics_callback
                        )
                    
                    # Test completed
                    self.active_tests[test_id]["status"] = "completed"
                    self.active_tests[test_id]["end_time"] = datetime.utcnow()
                    logger.info(f"Load test completed: {test_id}")
                except Exception as e:
                    logger.error(f"Load test error: {test_id} - {e}", exc_info=True)
                    self.active_tests[test_id]["status"] = "error"
                    self.active_tests[test_id]["error"] = str(e)
            
            # Start as background task - DON'T AWAIT!
            asyncio.create_task(run_test_background())
        
        # Return test_id immediately so frontend can start polling
        return test_id
    
    async def stop_test(self, test_id: str) -> Dict[str, Any]:
        """Stop a running test"""
        if test_id not in self.active_tests:
            raise ValueError(f"Test {test_id} not found")
        
        # Stop load generator
        await self.load_generator.stop_load_test()
        
        # Stop monitoring
        await self.monitoring_service.stop_monitoring()
        
        # Get final report
        report = self.load_generator.get_final_report()
        
        # Store results
        self.test_results[test_id] = report
        self.active_tests[test_id]["status"] = "stopped"
        self.active_tests[test_id]["end_time"] = datetime.utcnow()
        
        return report
    
    async def get_test_status(self, test_id: str) -> Dict[str, Any]:
        """Get current test status"""
        if test_id not in self.active_tests:
            raise ValueError(f"Test {test_id} not found")
        
        test_info = self.active_tests[test_id]
        
        if test_info["status"] == "running":
            # Get current metrics
            metrics = self.load_generator.get_current_metrics()
            dashboard = self.monitoring_service.get_dashboard_data()
            
            return {
                "test_id": test_id,
                "status": "running",
                "start_time": test_info["start_time"].isoformat(),
                "current_metrics": metrics,
                "dashboard": dashboard
            }
        else:
            # Return final results
            if test_id in self.test_results:
                return {
                    "test_id": test_id,
                    "status": "completed",
                    "start_time": test_info["start_time"].isoformat(),
                    "end_time": test_info.get("end_time", datetime.utcnow()).isoformat(),
                    "results": self.test_results[test_id]
                }
            else:
                return {
                    "test_id": test_id,
                    "status": test_info["status"],
                    "start_time": test_info["start_time"].isoformat()
                }
    
    async def get_test_report(self, test_id: str) -> Dict[str, Any]:
        """Get final test report"""
        if test_id not in self.test_results:
            # Try to generate from current state
            if test_id in self.active_tests:
                report = self.load_generator.get_final_report()
                self.test_results[test_id] = report
            else:
                raise ValueError(f"Test {test_id} not found")
        
        return self.test_results[test_id]
    
    async def get_real_time_metrics(self) -> Dict[str, Any]:
        """Get real-time metrics dashboard"""
        return self.monitoring_service.get_dashboard_data()
    
    async def get_metrics_history(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get metrics history"""
        history = self.monitoring_service.get_metrics_history(
            start_time=start_time,
            end_time=end_time,
            limit=limit
        )
        
        return [
            {
                "timestamp": m.timestamp.isoformat(),
                "virtual_users": m.virtual_users,
                "response_times": m.response_times,
                "throughput": m.throughput,
                "error_rate": m.error_rate,
                "active_requests": m.active_requests
            }
            for m in history
        ]
    
    def add_correlation_rule(
        self,
        variable_name: str,
        extract_type: str,
        extract_value: str
    ):
        """Add correlation rule"""
        from .correlation_engine import CorrelationRule
        
        rule = CorrelationRule(
            variable_name=variable_name,
            extract_type=extract_type,
            extract_value=extract_value
        )
        
        self.correlation_engine.add_rule(rule)
    
    def list_scenarios(self) -> List[Dict[str, Any]]:
        """List all test scenarios"""
        return self.scenario_designer.list_scenarios()
    
    def get_scenario(self, scenario_id: str) -> Optional[TestScenario]:
        """Get scenario details"""
        return self.scenario_designer.get_scenario(scenario_id)
    
    async def export_scenario(self, scenario_id: str) -> str:
        """Export scenario to JSON"""
        return self.scenario_designer.export_to_json(scenario_id)
    
    async def import_scenario(self, json_data: str) -> str:
        """Import scenario from JSON"""
        return self.scenario_designer.import_from_json(json_data)

