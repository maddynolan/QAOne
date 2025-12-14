"""
Persona Integration Examples
Shows how to integrate personas into existing agents and services.
"""

import logging
from typing import Dict, Any, Optional, List

from app.services.agents.persona_registry import persona_registry, PersonaType
from app.services.flowstral.flowstral_action_graph import ActionGraph

logger = logging.getLogger(__name__)


class PersonaIntegratedTestDesignAgent:
    """
    Example: Test Design Agent using Trace persona for manual test generation.
    """
    
    def __init__(self):
        self.trace_persona = persona_registry.get_persona(PersonaType.MANUAL)
    
    async def generate_manual_tests_from_action_graph(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate manual test cases using Trace persona."""
        
        # Convert action graph to input format
        input_data = {
            "action_graph": action_graph.to_dict(),
            "project_id": project_id,
            "generate_variations": True,
            "include_negative_cases": True,
            "include_boundary_tests": True
        }
        
        context = {
            "project_id": project_id,
            "tenant_id": tenant_id,
            "source": "flowstral_recording"
        }
        
        # Generate using Trace persona
        result = await self.trace_persona.generate(
            input_data=input_data,
            context=context,
            temperature=0.3,  # Lower temperature for more deterministic output
            tenant_id=tenant_id
        )
        
        # Convert to database format
        return {
            "test_cases": [
                {
                    "title": tc.title,
                    "description": tc.description,
                    "preconditions": tc.preconditions,
                    "steps": [
                        {
                            "step_number": step.step_number,
                            "action": step.action,
                            "expected_result": step.expected_result,
                            "data_values": step.data_values,
                            "variations": step.variations
                        }
                        for step in tc.steps
                    ],
                    "postconditions": tc.postconditions,
                    "traceability": tc.traceability,
                    "tags": tc.tags,
                    "priority": tc.priority
                }
                for tc in result.test_cases
            ],
            "total_steps": result.total_steps,
            "coverage_areas": result.coverage_areas,
            "traceability_map": result.traceability_map,
            "persona_info": self.trace_persona.get_persona_info()
        }


class PersonaIntegratedPerformanceAgent:
    """
    Example: Performance Agent using Blaze persona for load test generation.
    """
    
    def __init__(self):
        self.blaze_persona = persona_registry.get_persona(PersonaType.PERFORMANCE)
    
    async def generate_performance_tests(
        self,
        user_journeys: List[Dict[str, Any]],
        production_metrics: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate performance tests using Blaze persona."""
        
        input_data = {
            "user_journeys": user_journeys,
            "production_metrics": production_metrics,
            "target_throughput": production_metrics.get("requests_per_second", 1000),
            "target_p95_latency_ms": 300,
            "target_error_rate_percent": 0.1
        }
        
        context = {
            "environment": "production",
            "include_chaos_tests": True
        }
        
        result = await self.blaze_persona.generate(
            input_data=input_data,
            context=context,
            temperature=0.2,  # Very low temperature for deterministic performance scripts
            tenant_id=tenant_id
        )
        
        return {
            "k6_script": result.k6_script.script_content,
            "locust_script": result.locust_script.script_content,
            "grafana_dashboard": result.grafana_dashboard_json,
            "scaling_strategy": result.scaling_strategy,
            "duration_justification": result.duration_justification,
            "persona_info": self.blaze_persona.get_persona_info()
        }


class PersonaIntegratedAPIAgent:
    """
    Example: API Agent using Rift persona for API test generation.
    """
    
    def __init__(self):
        self.rift_persona = persona_registry.get_persona(PersonaType.API)
    
    async def generate_api_tests(
        self,
        openapi_spec: Dict[str, Any],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate API tests using Rift persona."""
        
        input_data = {
            "openapi_spec": openapi_spec,
            "include_security_tests": True,
            "include_performance_tests": True,
            "include_contract_tests": True
        }
        
        context = {
            "environment": "staging",
            "authentication_type": "JWT"
        }
        
        result = await self.rift_persona.generate(
            input_data=input_data,
            context=context,
            temperature=0.3,
            tenant_id=tenant_id
        )
        
        return {
            "test_cases": [
                {
                    "name": tc.name,
                    "endpoint": tc.endpoint,
                    "method": tc.method,
                    "test_type": tc.test_type,
                    "expected_status": tc.expected_status,
                    "assertions": tc.assertions
                }
                for tc in result.test_cases
            ],
            "security_tests": [
                {
                    "name": st.name,
                    "attack_type": st.attack_type,
                    "owasp_category": st.owasp_category
                }
                for st in result.security_tests
            ],
            "postman_collection": result.postman_collection,
            "newman_command": result.newman_command,
            "owasp_coverage": result.owasp_coverage,
            "persona_info": self.rift_persona.get_persona_info()
        }


class PersonaIntegratedAccessibilityAgent:
    """
    Example: Accessibility Agent using A11y persona for WCAG test generation.
    """
    
    def __init__(self):
        self.a11y_persona = persona_registry.get_persona(PersonaType.ACCESSIBILITY)
    
    async def generate_accessibility_tests(
        self,
        dom_snapshots: List[Dict[str, Any]],
        wcag_level: str = "AA",
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate accessibility tests using A11y persona."""
        
        input_data = {
            "dom_snapshots": dom_snapshots,
            "wcag_level": wcag_level,  # "A", "AA", "AAA"
            "include_keyboard_tests": True,
            "include_screen_reader_tests": True,
            "include_zoom_tests": True
        }
        
        context = {
            "target_browsers": ["Chrome", "Firefox", "Safari"],
            "screen_readers": ["NVDA", "VoiceOver"]
        }
        
        result = await self.a11y_persona.generate(
            input_data=input_data,
            context=context,
            temperature=0.3,
            tenant_id=tenant_id
        )
        
        return {
            "wcag_tests": [
                {
                    "wcag_criterion": test.wcag_criterion,
                    "level": test.level,
                    "test_name": test.test_name,
                    "severity": test.severity,
                    "remediation": test.remediation
                }
                for test in result.wcag_tests
            ],
            "axe_core_rules": result.axe_core_rules,
            "keyboard_only_tests": result.keyboard_only_tests,
            "screen_reader_tests": result.screen_reader_tests,
            "vpat_sections": result.vpat_sections,
            "remediation_instructions": result.remediation_instructions,
            "persona_info": self.a11y_persona.get_persona_info()
        }


class PersonaIntegratedSecurityAgent:
    """
    Example: Security Agent using Void persona for security test generation.
    """
    
    def __init__(self):
        self.void_persona = persona_registry.get_persona(PersonaType.SECURITY)
    
    async def generate_security_tests(
        self,
        application_info: Dict[str, Any],
        compliance_frameworks: List[str],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate security tests using Void persona."""
        
        input_data = {
            "application_info": application_info,
            "compliance_frameworks": compliance_frameworks,  # e.g., ["PCI DSS 4.0", "OWASP ASVS Level 3"]
            "include_business_logic_tests": True,
            "include_exploit_pocs": True
        }
        
        context = {
            "environment": "staging",
            "include_mitre_mapping": True
        }
        
        result = await self.void_persona.generate(
            input_data=input_data,
            context=context,
            temperature=0.2,  # Very low for security scripts
            tenant_id=tenant_id
        )
        
        return {
            "exploits": [
                {
                    "name": exp.name,
                    "vulnerability_type": exp.vulnerability_type,
                    "owasp_category": exp.owasp_category,
                    "severity": exp.severity,
                    "impact": exp.impact
                }
                for exp in result.exploits
            ],
            "mitigations": [
                {
                    "exploit_name": mit.exploit_name,
                    "mitigation": mit.mitigation,
                    "detection_rule": mit.detection_rule
                }
                for mit in result.mitigations
            ],
            "zap_scripts": result.zap_scripts,
            "nuclei_templates": result.nuclei_templates,
            "owasp_coverage": result.owasp_coverage,
            "mitre_attack_mapping": result.mitre_attack_mapping,
            "compliance_mappings": result.compliance_mappings,
            "persona_info": self.void_persona.get_persona_info()
        }




