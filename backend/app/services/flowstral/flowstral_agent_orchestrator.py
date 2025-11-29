"""
Flowstral Agent Orchestrator
Phase 2.4: Orchestrates agents based on Action Graph
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import asyncio

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.core.agent_registry import agent_registry
from app.schemas.agent_schemas import AgentType, AgentTaskRequest, AgentTaskResult

logger = logging.getLogger(__name__)


class FlowstralAgentOrchestrator:
    """
    Orchestrates agents for Flowstral workflows
    
    Responsibilities:
    1. Trigger agents based on Action Graph
    2. Coordinate agent execution (parallel where possible)
    3. Aggregate results from all agents
    4. Handle agent failures gracefully
    """
    
    def __init__(self):
        self.agent_registry = agent_registry
    
    async def generate_from_action_graph(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None,
        agent_options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate all artifacts from Action Graph using agents
        
        Args:
            action_graph: The Flowstral Action Graph
            project_id: Project ID
            tenant_id: Tenant ID
            agent_options: Options for which agents to run:
                {
                    "requirements": True,
                    "test_cases": True,
                    "automation": True,
                    "accessibility": True,
                    "performance": True,
                    "security": False,
                    "defects": True
                }
        
        Returns:
            {
                "requirements": [...],
                "test_cases": [...],
                "playwright_script": "...",
                "accessibility_report": {...},
                "performance_report": {...},
                "security_report": {...},
                "defects": [...]
            }
        """
        options = agent_options or {
            "requirements": True,
            "test_cases": True,
            "automation": True,
            "accessibility": True,
            "performance": True,
            "security": False,
            "defects": True
        }
        
        results = {}
        
        # Run agents in parallel where possible
        tasks = []
        
        # Requirements Agent
        if options.get("requirements", True):
            tasks.append(("requirements", self._generate_requirements(action_graph, project_id, tenant_id)))
        
        # Test Case Agent
        if options.get("test_cases", True):
            tasks.append(("test_cases", self._generate_test_cases(action_graph, project_id, tenant_id)))
        
        # Automation Agent
        if options.get("automation", True):
            tasks.append(("automation", self._generate_automation(action_graph, project_id, tenant_id)))
        
        # Accessibility Agent
        if options.get("accessibility", True):
            tasks.append(("accessibility", self._generate_accessibility_report(action_graph, project_id, tenant_id)))
        
        # Performance Agent
        if options.get("performance", True):
            tasks.append(("performance", self._generate_performance_report(action_graph, project_id, tenant_id)))
        
        # Security Agent (optional)
        if options.get("security", False):
            tasks.append(("security", self._generate_security_report(action_graph, project_id, tenant_id)))
        
        # Defect Agent
        if options.get("defects", True):
            tasks.append(("defects", self._generate_defects(action_graph, project_id, tenant_id)))
        
        # Execute all tasks in parallel
        if tasks:
            task_results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
            
            for (name, _), result in zip(tasks, task_results):
                if isinstance(result, Exception):
                    logger.error(f"Agent {name} failed: {result}", exc_info=True)
                    results[name] = {"error": str(result)}
                else:
                    results[name] = result
        
        return results
    
    async def _generate_requirements(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate requirements from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.REQUIREMENTS):
                logger.warning("Requirements agent not registered")
                return {"requirements": [], "error": "Agent not registered"}
            
            # Convert Action Graph to requirements agent input
            graph_dict = action_graph.to_dict()
            
            task_request = AgentTaskRequest(
                agent_type=AgentType.REQUIREMENTS,
                operation="infer_requirements_from_flow",
                input_data={
                    "action_graph": graph_dict,
                    "project_id": project_id
                },
                tenant_id=tenant_id
            )
            
            result = await self.agent_registry.execute_task(task_request)
            
            return {
                "requirements": result.output_data.get("requirements", []),
                "suggested_acceptance_criteria": result.output_data.get("suggested_acceptance_criteria", []),
                "traceability": result.output_data.get("traceability", {})
            }
        
        except Exception as e:
            logger.error(f"Requirements generation failed: {e}", exc_info=True)
            return {"requirements": [], "error": str(e)}
    
    async def _generate_test_cases(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate test cases from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.TEST_DESIGN):
                logger.warning("Test Design agent not registered")
                return {"test_cases": [], "error": "Agent not registered"}
            
            # Convert Action Graph to test design agent input
            graph_dict = action_graph.to_dict()
            
            task_request = AgentTaskRequest(
                agent_type=AgentType.TEST_DESIGN,
                operation="generate_from_action_graph",
                input_data={
                    "action_graph": graph_dict,
                    "project_id": project_id
                },
                tenant_id=tenant_id
            )
            
            result = await self.agent_registry.execute_task(task_request)
            
            return {
                "test_cases": result.output_data.get("test_cases", []),
                "total": len(result.output_data.get("test_cases", []))
            }
        
        except Exception as e:
            logger.error(f"Test case generation failed: {e}", exc_info=True)
            return {"test_cases": [], "error": str(e)}
    
    async def _generate_automation(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate automation scripts from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.AUTOMATION):
                logger.warning("Automation agent not registered")
                return {"playwright_script": "", "error": "Agent not registered"}
            
            # Convert Action Graph to automation agent input
            graph_dict = action_graph.to_dict()
            
            task_request = AgentTaskRequest(
                agent_type=AgentType.AUTOMATION,
                operation="generate_from_action_graph",
                input_data={
                    "action_graph": graph_dict,
                    "project_id": project_id,
                    "framework": "playwright"
                },
                tenant_id=tenant_id
            )
            
            result = await self.agent_registry.execute_task(task_request)
            
            return {
                "playwright_script": result.output_data.get("test_code", ""),
                "page_objects": result.output_data.get("page_objects", []),
                "locators": result.output_data.get("locators", {})
            }
        
        except Exception as e:
            logger.error(f"Automation generation failed: {e}", exc_info=True)
            return {"playwright_script": "", "error": str(e)}
    
    async def _generate_accessibility_report(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate accessibility report from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.ACCESSIBILITY):
                logger.warning("Accessibility agent not registered")
                return {"violations": [], "error": "Agent not registered"}
            
            # Extract WCAG snapshots from Action Graph
            wcag_issues = []
            for node in action_graph.nodes:
                if node.wcag_snapshot_id:
                    # In production, load snapshot from DB
                    # For now, use metadata
                    if node.metadata.get("wcag_violations_count", 0) > 0:
                        wcag_issues.append({
                            "node_id": node.id,
                            "url": node.url,
                            "violations_count": node.metadata.get("wcag_violations_count", 0)
                        })
            
            # Aggregate a11y impacts from edges
            a11y_impacts = []
            for edge in action_graph.edges:
                if edge.a11y_impacts:
                    a11y_impacts.extend(edge.a11y_impacts)
            
            return {
                "total_violations": sum(issue["violations_count"] for issue in wcag_issues),
                "nodes_with_issues": len(wcag_issues),
                "issues_by_node": wcag_issues,
                "a11y_impacts": list(set(a11y_impacts))  # Deduplicate
            }
        
        except Exception as e:
            logger.error(f"Accessibility report generation failed: {e}", exc_info=True)
            return {"violations": [], "error": str(e)}
    
    async def _generate_performance_report(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate performance report from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.PERFORMANCE):
                logger.warning("Performance agent not registered")
                return {"metrics": [], "error": "Agent not registered"}
            
            # Extract performance metrics from Action Graph
            perf_metrics = []
            for node in action_graph.nodes:
                if node.performance_snapshot_id:
                    # In production, load snapshot from DB
                    # For now, use metadata
                    latency = node.metadata.get("latency_ms", 0)
                    if latency > 0:
                        perf_metrics.append({
                            "node_id": node.id,
                            "url": node.url,
                            "latency_ms": latency
                        })
            
            # Aggregate performance metrics from edges
            edge_metrics = []
            for edge in action_graph.edges:
                if edge.perf_metrics:
                    edge_metrics.append({
                        "edge_id": edge.id,
                        "action": edge.action_type,
                        "metrics": edge.perf_metrics
                    })
            
            avg_latency = sum(m["latency_ms"] for m in perf_metrics) / len(perf_metrics) if perf_metrics else 0
            
            return {
                "average_latency_ms": avg_latency,
                "total_nodes": len(perf_metrics),
                "metrics_by_node": perf_metrics,
                "edge_metrics": edge_metrics,
                "bottlenecks": [m for m in perf_metrics if m["latency_ms"] > 1000]
            }
        
        except Exception as e:
            logger.error(f"Performance report generation failed: {e}", exc_info=True)
            return {"metrics": [], "error": str(e)}
    
    async def _generate_security_report(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate security report from Action Graph"""
        try:
            # Security agent is optional - return basic analysis
            security_issues = []
            
            # Check for potential security issues in Action Graph
            for node in action_graph.nodes:
                url = node.url or ""
                # Check for common security patterns
                if "password" in url.lower() or "login" in url.lower():
                    security_issues.append({
                        "node_id": node.id,
                        "url": url,
                        "issue": "Potential authentication endpoint",
                        "severity": "info"
                    })
            
            return {
                "total_issues": len(security_issues),
                "issues": security_issues,
                "note": "Basic security analysis. Full security agent not implemented yet."
            }
        
        except Exception as e:
            logger.error(f"Security report generation failed: {e}", exc_info=True)
            return {"issues": [], "error": str(e)}
    
    async def _generate_defects(
        self,
        action_graph: ActionGraph,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate defects from Action Graph"""
        try:
            if not self.agent_registry.is_agent_registered(AgentType.DEFECT):
                logger.warning("Defect agent not registered")
                return {"defects": [], "error": "Agent not registered"}
            
            # Identify potential defects from Action Graph
            defects = []
            
            # Check for WCAG violations
            for node in action_graph.nodes:
                if node.metadata.get("wcag_violations_count", 0) > 0:
                    defects.append({
                        "type": "accessibility",
                        "node_id": node.id,
                        "url": node.url,
                        "description": f"WCAG violations detected: {node.metadata.get('wcag_violations_count')}",
                        "severity": "medium"
                    })
            
            # Check for performance issues
            for node in action_graph.nodes:
                latency = node.metadata.get("latency_ms", 0)
                if latency > 2000:  # 2 seconds threshold
                    defects.append({
                        "type": "performance",
                        "node_id": node.id,
                        "url": node.url,
                        "description": f"High latency detected: {latency}ms",
                        "severity": "low"
                    })
            
            # Check for warnings in edges
            for edge in action_graph.edges:
                if edge.warnings:
                    defects.append({
                        "type": "warning",
                        "edge_id": edge.id,
                        "description": "; ".join(edge.warnings),
                        "severity": "low"
                    })
            
            return {
                "defects": defects,
                "total": len(defects),
                "by_type": {
                    "accessibility": len([d for d in defects if d["type"] == "accessibility"]),
                    "performance": len([d for d in defects if d["type"] == "performance"]),
                    "warning": len([d for d in defects if d["type"] == "warning"])
                }
            }
        
        except Exception as e:
            logger.error(f"Defect generation failed: {e}", exc_info=True)
            return {"defects": [], "error": str(e)}


# Global orchestrator instance
flowstral_agent_orchestrator = FlowstralAgentOrchestrator()

