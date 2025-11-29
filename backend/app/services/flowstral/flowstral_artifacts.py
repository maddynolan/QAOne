"""
Flowstral Artifacts Generator
Generates the 6 major artifacts from Flowstral session
"""

import logging
import time
import asyncio
import os
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from uuid import uuid4
import json

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.flowstral.flowstral_realtime_output import RealTimeOutputGenerator
from app.services.flowstral.flowstral_wcag_pipeline import WCAGPipeline
from app.services.flowstral.flowstral_performance_pipeline import PerformancePipeline
from app.services.agents.automation_agent import AutomationAgent
from app.services.agents.test_design_agent import TestDesignAgent
from app.services.agents.defect_agent import DefectAgent
from app.services.flowstral.flowstral_session import flowstral_session_manager
from app.services.engines.test_case_enhancements import TestCaseEnhancements
from app.services.engines.scenario_skeleton_generator import ScenarioSkeletonGenerator
from app.services.llm.test_case_rewrite_service import (
    TestCaseRewriteService, 
    RewriteRequest,
    ScenarioSkeleton
)
from app.services.automation.locator_engine import get_locator_engine
from app.services.automation.auto_healing_service import get_auto_healing_service
from app.services.automation.script_converter import get_script_converter
from app.services.automation.test_execution_service import get_test_execution_service

logger = logging.getLogger(__name__)


class FlowstralArtifactsGenerator:
    """
    Generates the 6 major artifacts:
    1. Action Graph Model
    2. Full Playwright Automation Script
    3. Structured Test Cases
    4. Accessibility Report (WCAG)
    5. Performance Report
    6. Auto Defects
    """
    
    def __init__(self):
        self.wcag_pipeline = WCAGPipeline()
        self.performance_pipeline = PerformancePipeline()
        self.automation_agent = AutomationAgent()
        self.test_design_agent = TestDesignAgent()
        self.defect_agent = DefectAgent()
        self.test_case_enhancements = TestCaseEnhancements()
        self.skeleton_generator = ScenarioSkeletonGenerator()
        self.rewrite_service = TestCaseRewriteService()
        # Industry-standard automation services
        self.locator_engine = get_locator_engine()
        self.auto_healing_service = get_auto_healing_service()
        self.script_converter = get_script_converter()
        self.test_execution_service = get_test_execution_service()
    
    async def generate_all_artifacts(
        self,
        session_id: str,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]],
        wcag_snapshots: List[Dict[str, Any]],
        performance_snapshots: List[Dict[str, Any]],
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        progress_callback: Optional[Callable[[str, int, Optional[str], str], None]] = None
    ) -> Dict[str, Any]:
        """Generate all 6 artifacts with error handling"""
        
        artifacts = {}
        errors = []
        
        # Helper to send progress updates
        async def send_progress(message: str, progress: int, artifact: str = None, status: str = "processing"):
            if progress_callback:
                try:
                    await progress_callback(message, progress, artifact, status)
                    logger.debug(f"Progress sent: {message} ({progress}%)")
                except Exception as e:
                    logger.warning(f"Failed to send progress update: {e}")
            else:
                logger.warning(f"Progress callback not available: {message} ({progress}%)")
        
        # Artifact 1: Action Graph Model
        try:
            await send_progress("Generating Action Graph model...", 5, "action_graph")
            artifacts["action_graph"] = self.generate_action_graph_model(action_graph)
            await send_progress("Action Graph completed", 15, "action_graph", "completed")
        except Exception as e:
            logger.error(f"Failed to generate action graph: {e}", exc_info=True)
            artifacts["action_graph"] = {"error": str(e), "type": "action_graph"}
            errors.append(f"Action Graph: {str(e)}")
            await send_progress(f"Action Graph error: {str(e)}", 15, "action_graph", "error")
        
        # Artifact 2: Full Playwright Script
        try:
            await send_progress("Generating Playwright script...", 20, "playwright_script")
            playwright_result = await self.generate_playwright_script(
                action_graph,
                dom_snapshots,
                tenant_id=tenant_id
            )
            # Ensure it always has a 'code' property, even if empty
            if not playwright_result.get("code"):
                logger.warning("Playwright script generated but 'code' is empty, creating fallback")
                playwright_result["code"] = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  // No actions were recorded
  await page.goto('about:blank');
});"""
            artifacts["playwright_script"] = playwright_result
            await send_progress("Playwright script completed", 30, "playwright_script", "completed")
        except Exception as e:
            logger.error(f"Failed to generate Playwright script: {e}", exc_info=True)
            # Return a valid structure with error, but still include a basic script
            artifacts["playwright_script"] = {
                "type": "playwright_script",
                "format": "javascript",
                "code": f"""import {{ test, expect }} from '@playwright/test';

test('Flowstral Recorded Test', async ({{ page }}) => {{
  // Error during generation: {str(e)}
  await page.goto('about:blank');
}});""",
                "error": str(e),
                "export_format": "script_code.js"
            }
            errors.append(f"Playwright Script: {str(e)}")
            await send_progress(f"Playwright script error: {str(e)}", 30, "playwright_script", "error")
        
        # Artifact 3: Structured Test Cases
        try:
            await send_progress("Generating test cases (LLM processing)...", 35, "test_cases")
            logger.info("Starting test case generation...")
            test_cases_result = await self.generate_structured_test_cases(
                artifacts.get("playwright_script", {}),
                action_graph,
                project_id,
                tenant_id
            )
            # Validate result before accessing
            if test_cases_result is None:
                logger.error("Test case generation returned None")
                test_cases_result = {
                    "type": "test_cases",
                    "format": "structured",
                    "test_cases": {
                        "automated": [],
                        "manual": [],
                        "accessibility": [],
                        "performance": []
                    },
                    "total_count": 0,
                    "stored_count": 0,
                    "stored_test_case_ids": [],
                    "export_format": "test_cases.json",
                    "error": "Test case generation returned None"
                }
            
            if not isinstance(test_cases_result, dict):
                logger.error(f"Test case generation returned invalid type: {type(test_cases_result)}")
                test_cases_result = {
                    "type": "test_cases",
                    "format": "structured",
                    "test_cases": {
                        "automated": [],
                        "manual": [],
                        "accessibility": [],
                        "performance": []
                    },
                    "total_count": 0,
                    "stored_count": 0,
                    "stored_test_case_ids": [],
                    "export_format": "test_cases.json",
                    "error": f"Invalid return type: {type(test_cases_result)}"
                }
            
            logger.info(f"Test case generation completed. Result keys: {list(test_cases_result.keys()) if isinstance(test_cases_result, dict) else 'not a dict'}")
            # Safe access to nested structure
            test_cases_dict = test_cases_result.get('test_cases', {}) if isinstance(test_cases_result, dict) else {}
            if isinstance(test_cases_dict, dict):
                logger.info(f"Test cases structure: automated={len(test_cases_dict.get('automated', []))}, manual={len(test_cases_dict.get('manual', []))}")
            artifacts["test_cases"] = test_cases_result
            await send_progress("Test cases completed", 50, "test_cases", "completed")
        except Exception as e:
            logger.error(f"Failed to generate test cases: {e}", exc_info=True)
            import traceback
            logger.error(f"Test case generation traceback: {traceback.format_exc()}")
            # Ensure error structure matches expected format with test_cases key
            artifacts["test_cases"] = {
                "type": "test_cases",
                "format": "structured",
                "test_cases": {
                    "automated": [],
                    "manual": [],
                    "accessibility": [],
                    "performance": []
                },
                "total_count": 0,
                "stored_count": 0,
                "stored_test_case_ids": [],
                "export_format": "test_cases.json",
                "error": str(e)
            }
            errors.append(f"Test Cases: {str(e)}")
            await send_progress(f"Test cases error: {str(e)}", 50, "test_cases", "error")
        
        # Artifact 4: Accessibility Report
        try:
            await send_progress("Generating accessibility report...", 55, "accessibility_report")
            # Get WCAG issues from session
            session = flowstral_session_manager.get_session(session_id)
            wcag_issues = session.wcag_issues if session else []
            artifacts["accessibility_report"] = await self.generate_accessibility_report(wcag_snapshots, wcag_issues)
            await send_progress("Accessibility report completed", 70, "accessibility_report", "completed")
        except Exception as e:
            logger.error(f"Failed to generate accessibility report: {e}", exc_info=True)
            artifacts["accessibility_report"] = {"error": str(e), "type": "accessibility_report"}
            errors.append(f"Accessibility Report: {str(e)}")
            await send_progress(f"Accessibility report error: {str(e)}", 70, "accessibility_report", "error")
        
        # Artifact 5: Performance Report
        try:
            await send_progress("Generating performance report...", 75, "performance_report")
            artifacts["performance_report"] = await self.generate_performance_report(performance_snapshots)
            await send_progress("Performance report completed", 85, "performance_report", "completed")
        except Exception as e:
            logger.error(f"Failed to generate performance report: {e}", exc_info=True)
            artifacts["performance_report"] = {"error": str(e), "type": "performance_report"}
            errors.append(f"Performance Report: {str(e)}")
            await send_progress(f"Performance report error: {str(e)}", 85, "performance_report", "error")
        
        # Artifact 6: Auto Defects
        try:
            await send_progress("Generating defects...", 90, "defects")
            artifacts["defects"] = await self.generate_auto_defects(
                action_graph,
                wcag_snapshots,
                performance_snapshots,
                project_id,
                tenant_id
            )
            await send_progress("Defects completed", 95, "defects", "completed")
        except Exception as e:
            logger.error(f"Failed to generate defects: {e}", exc_info=True)
            artifacts["defects"] = {"error": str(e), "type": "defects"}
            errors.append(f"Defects: {str(e)}")
            await send_progress(f"Defects error: {str(e)}", 95, "defects", "error")
        
        await send_progress("All artifacts generated successfully!", 100, None, "completed")
        
        result = {
            "session_id": session_id,
            "artifacts": artifacts,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        if errors:
            result["warnings"] = errors
            logger.warning(f"Artifact generation completed with {len(errors)} errors: {errors}")
        
        return result
    
    def _extract_first_real_url_from_graph(self, action_graph: ActionGraph) -> Optional[str]:
        """Extract first real URL from action graph, filtering out internal browser URLs."""
        import re
        if not action_graph or not action_graph.nodes:
            return None
        
        # Internal browser URL patterns
        internal_patterns = ['chrome://', 'about:', 'edge://', 'newtab', 'blank']
        
        for node in action_graph.nodes:
            url = node.url or (node.url_pattern if hasattr(node, 'url_pattern') else None)
            if url and isinstance(url, str) and len(url) > 5:
                url_lower = url.lower()
                # Skip internal URLs
                if any(pattern in url_lower for pattern in internal_patterns):
                    continue
                # Skip localhost/dev ports if Flowstral/QA platform
                if 'flowstral' in url_lower or 'qa' in url_lower or 'platform' in url_lower:
                    continue
                # Check for localhost with dev ports
                if 'localhost' in url_lower or '127.0.0.1' in url_lower:
                    if re.search(r':(8080|8081|3000|5173|4200)', url_lower):
                        continue
                # Valid URL found
                if url.startswith("http://") or url.startswith("https://"):
                    return url
        
        return None
    
    def _extract_clean_page_name(self, url_or_pattern: str) -> str:
        """
        Extract a clean, readable page name from URL or pattern.
        Filters out Flowstral internal patterns, GUIDs, and meaningless parts.
        """
        import re
        
        if not url_or_pattern or url_or_pattern == "Page":
            return "Page"
        
        # Remove Flowstral patterns
        text = url_or_pattern
        text = re.sub(r'Page load:\s*', '', text, flags=re.I)
        text = re.sub(r'^https?://', '', text)
        text = re.sub(r'^www\.', '', text)
        
        # Extract meaningful parts from URL
        # Example: "www.walmart.com/shop/deals/flash-deals" -> "Flash Deals"
        parts = text.split('/')
        if len(parts) > 1:
            # Get the last meaningful part
            last_part = parts[-1].split('?')[0]  # Remove query params
            last_part = last_part.replace('-', ' ').replace('_', ' ')
            # Capitalize words
            last_part = ' '.join(word.capitalize() for word in last_part.split() if word)
            if last_part and len(last_part) > 2:
                return last_part
        
        # Fallback: use domain name or first meaningful part
        domain_match = re.search(r'([a-zA-Z0-9-]+\.(com|net|org|io|edu))', text)
        if domain_match:
            domain = domain_match.group(1)
            # Extract site name (e.g., "walmart" from "walmart.com")
            site_name = domain.split('.')[0].capitalize()
            return f"{site_name} Home"
        
        # Final fallback
        return text[:50] if len(text) > 50 else text
    
    def generate_action_graph_model(self, action_graph: ActionGraph) -> Dict[str, Any]:
        """Artifact 1: Action Graph Model"""
        graph_dict = action_graph.to_dict()
        statistics = action_graph.get_statistics()
        
        return {
            "type": "action_graph",
            "format": "json",
            "data": graph_dict,
            "statistics": statistics,
            "export_format": "action_graph.json"
        }
    
    async def generate_playwright_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Artifact 2: Full Playwright Automation Script"""
        generator = RealTimeOutputGenerator()
        
        # If no nodes, return empty script template
        if not action_graph.nodes or len(action_graph.nodes) == 0:
            script = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  // No actions recorded
  await page.goto('about:blank');
});"""
        else:
            # Flowstral internal events to filter out
            INTERNAL_EVENTS = {
                "wcag_scan", "scroll", "api_request", "page_load", 
                "change", "session_start", "session_end", "dom_snapshot"
            }
            
            # Generate Playwright code for each node (only user interactions)
            initial_url = None
            for node in action_graph.nodes:
                # Skip internal Flowstral events
                if node.event_type in INTERNAL_EVENTS:
                    continue
                    
                if node.event_type == "navigate":
                    if node.url:
                        initial_url = node.url
                        generator.generate_playwright_line("navigate", None, None, node.url)
                elif node.event_type == "click" and node.target_selector:
                    generator.generate_playwright_line("click", node.target_selector)
                elif node.event_type in ["type", "input"] and node.target_selector:
                    value = node.metadata.get("value", "") if node.metadata else ""
                    # Skip masked passwords
                    if value != "***MASKED***":
                        generator.generate_playwright_line("type", node.target_selector, value)
                elif node.event_type == "select" and node.target_selector:
                    value = node.metadata.get("value", "") if node.metadata else ""
                    generator.generate_playwright_line("select", node.target_selector, value)
            
            # If no initial URL was set but we have nodes, use the first node's URL
            if not initial_url and action_graph.nodes:
                first_node = action_graph.nodes[0]
                if first_node.url:
                    initial_url = first_node.url
                    # Prepend navigation
                    generator.playwright_lines.insert(0, f'  await page.goto("{first_node.url}");')
            
            # Get the full script
            script = generator.get_full_playwright_script("Flowstral Recorded Test")
            
            # Ensure script has proper structure
            if not script or "async ({ page })" not in script:
                script = f"""import {{ test, expect }} from '@playwright/test';

test('Flowstral Recorded Test', async ({{ page }}) => {{
  await page.goto('{initial_url or "about:blank"}');
{chr(10).join(generator.playwright_lines) if generator.playwright_lines else "  // No actions recorded"}
}});"""
        
        # Use OpenAI/Ollama to generate high-quality Playwright code from action graph
        if script and len(action_graph.nodes) > 0:
            try:
                # Use new PlaywrightCodeService for LLM-based generation
                from app.services.llm.playwright_code_service import get_playwright_code_service
                playwright_service = get_playwright_code_service()
                
                # Convert ActionGraph to dict for service
                graph_dict = action_graph.to_dict()
                
                logger.info("[LLM] Generating Playwright code using LLM (OpenAI/Ollama)...")
                
                # Generate code with LLM (60 second timeout for code generation)
                try:
                    result = await asyncio.wait_for(
                        playwright_service.generate_playwright_code(
                            action_graph=graph_dict,
                            test_name="Flowstral Recorded Test",
                            timeout=60.0
                        ),
                        timeout=65.0  # Add 5s buffer
                    )
                    
                    llm_code = result.get("code", "")
                    metrics = result.get("metrics", {})
                    
                    if llm_code and self._validate_playwright_code_structure(llm_code):
                        # CRITICAL: Sanitize code before storing (filter internal URLs, fix syntax)
                        from app.services.automation.test_execution_service import get_test_execution_service
                        import re
                        test_execution_service = get_test_execution_service()
                        llm_code = test_execution_service._sanitize_playwright_code(llm_code)
                        
                        # Also ensure we have a valid URL or placeholder
                        if not re.search(r'await\s+page\.goto\(', llm_code):
                            # No goto found after sanitization - add placeholder
                            logger.warning("No page.goto() found after sanitization, adding placeholder")
                            real_url = self._extract_first_real_url_from_graph(action_graph)
                            if real_url:
                                # Insert goto at the start of test
                                llm_code = re.sub(
                                    r'(test\([^)]+\)\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*\{)',
                                    rf'\1\n  await page.goto("{real_url}");\n  await expect(page).toHaveURL(/.*/);',
                                    llm_code,
                                    count=1
                                )
                            else:
                                # Add placeholder
                                llm_code = re.sub(
                                    r'(test\([^)]+\)\s*async\s*\(\s*\{\s*page\s*\}\s*\)\s*\{)',
                                    r'\1\n  // TODO: Add the website URL - no URL was found in the recording\n  // await page.goto("https://example.com");',
                                    llm_code,
                                    count=1
                                )
                        
                        script = llm_code
                        logger.info(
                            f"[OK] LLM generated Playwright code (sanitized) "
                            f"({metrics.get('provider', 'unknown')}, "
                            f"{metrics.get('latency_ms', 0):.0f}ms, "
                            f"{metrics.get('tokens_used', 'N/A')} tokens)"
                        )
                    else:
                        logger.warning("LLM generated invalid code structure, using original script")
                        # Keep original script if LLM broke it
                        
                except asyncio.TimeoutError:
                    logger.warning("Playwright code generation timed out after 65s, using original script")
                    # Keep original script
                except Exception as e:
                    logger.warning(f"LLM code generation failed: {e}, using original script")
                    # Keep original script
                    
            except Exception as e:
                logger.warning(f"Failed to generate Playwright code with LLM: {e}, using original script")
                # Continue with original script - ensure it's valid
                if not script or "async ({ page })" not in script:
                    # Rebuild script if needed
                    script = f"""import {{ test, expect }} from '@playwright/test';

test('Flowstral Recorded Test', async ({{ page }}) => {{
  await page.goto('{initial_url or "about:blank"}');
{chr(10).join(generator.playwright_lines) if generator.playwright_lines else "  // No actions recorded"}
}});"""
        
        # Final validation - ensure script always has proper structure
        if not script:
            script = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  // No actions recorded
  await page.goto('about:blank');
});"""
        elif "async ({ page })" not in script and "async ({ page }" not in script:
            # Script is missing page parameter - rebuild it
            logger.warning("Playwright script missing 'page' parameter, rebuilding...")
            # Try to extract actions from broken script
            import re
            action_lines = []
            goto_match = re.search(r'page\.goto\(["\']([^"\']+)["\']', script)
            if goto_match:
                initial_url = goto_match.group(1)
            else:
                initial_url = "about:blank"
            
            # Extract other actions
            click_matches = re.findall(r'page\.click\(["\']([^"\']+)["\']', script)
            for selector in click_matches:
                action_lines.append(f'  await page.click("{selector}");')
            
            fill_matches = re.findall(r'page\.fill\(["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']', script)
            for selector, value in fill_matches:
                action_lines.append(f'  await page.fill("{selector}", "{value}");')
            
            script = f"""import {{ test, expect }} from '@playwright/test';

test('Flowstral Recorded Test', async ({{ page }}) => {{
  await page.goto('{initial_url}');
{chr(10).join(action_lines) if action_lines else "  // No actions recorded"}
}});"""
        
        return {
            "type": "playwright_script",
            "format": "javascript",
            "code": script,
            "export_format": "script_code.js",
            "selector_strategy": "ARIA → CSS → Text fallback → XPath"
        }
    
    def _validate_playwright_code_structure(self, code: str) -> bool:
        """Validate that Playwright code has proper structure."""
        import re
        required_patterns = [
            r"import.*@playwright/test",
            r"(test|describe)\s*\(",
            r"async\s*\(\s*\{\s*page\s*\}\s*\)"
        ]
        
        for pattern in required_patterns:
            if not re.search(pattern, code, re.IGNORECASE):
                return False
        
        return True
    
    async def generate_structured_test_cases(
        self,
        playwright_artifact: Dict[str, Any],
        action_graph: ActionGraph,
        project_id: Optional[str],
        tenant_id: Optional[str],
        use_enhanced_engine: bool = True
    ) -> Dict[str, Any]:
        """
        Generate structured test cases with automatic quality improvement.
        - Uses deterministic engine first (fast)
        - Falls back to LLM if quality is poor or engine fails
        - Always stores test cases in database if project_id is valid
        """
        # Validate and get correct project_id
        from app.utils.endpoint_helpers import ensure_default_org_project
        import uuid
        try:
            # Check if project_id is a valid UUID format
            is_valid_uuid = False
            if project_id:
                try:
                    uuid.UUID(project_id)
                    is_valid_uuid = True
                except (ValueError, AttributeError):
                    is_valid_uuid = False
            
            if not project_id or not is_valid_uuid:
                # Invalid project_id - get default
                logger.warning(f"Invalid project_id '{project_id}', using default project")
                _, project_id = await ensure_default_org_project()
                logger.info(f"Using default project_id: {project_id}")
        except Exception as e:
            logger.warning(f"Failed to get default project_id: {e}, continuing with provided project_id")
        
        """
        Artifact 3: Structured Test Cases - OPTIMIZED FOR SPEED
        
        Uses enhanced TestCaseEngine with all optimization rules:
        - Action graph analysis (clustering, intent recognition, critical paths)
        - Test case synthesis (preconditions, steps, expected results)
        - Standards compliance (ISTQB, Gherkin)
        - Efficiency optimization (deduplication, smart assertions)
        - Quality enhancement (confidence scores, metrics)
        """
        try:
            # NEW: Try LLM-enhanced flow first (scenario skeletons + LLM rewrite)
            use_llm_rewrite = os.getenv("USE_LLM_REWRITE", "true").lower() == "true"
            
            if use_llm_rewrite and use_enhanced_engine and action_graph and len(action_graph.nodes) > 0:
                try:
                    logger.info("[LLM] Using LLM-Enhanced Test Case Generation (Scenario Skeletons + LLM Rewrite)")
                    
                    # Step 1: Generate scenario skeletons
                    logger.info("Step 1: Generating scenario skeletons from action graph...")
                    skeleton_result = self.skeleton_generator.generate_scenario_skeletons(
                        action_graph=action_graph,
                        session_id=action_graph.session_id if hasattr(action_graph, 'session_id') else None,
                        project_name=None,  # Could extract from project_id if needed
                        application_name=None  # Will be inferred from URLs
                    )
                    
                    scenarios = skeleton_result.get("scenarios", [])
                    if not scenarios:
                        logger.warning("No scenarios generated from skeleton generator, falling back to deterministic engine")
                        raise ValueError("No scenarios generated")
                    
                    logger.info(f"Generated {len(scenarios)} scenario skeletons")
                    
                    # Step 2: Rewrite scenarios using LLM in parallel
                    logger.info(f"Step 2: Rewriting {len(scenarios)} scenarios using LLM (parallel processing)...")
                    
                    async def rewrite_scenario(skeleton: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
                        """Rewrite a single scenario using LLM"""
                        try:
                            req = RewriteRequest(
                                project_name=skeleton_result.get("project_name"),
                                application_name=skeleton_result.get("application_name"),
                                skeleton=ScenarioSkeleton(**skeleton)
                            )
                            
                            # Use quick mode for speed (7B model) or OpenAI if configured
                            # Provider selection is handled by rewrite_service (auto: OpenAI first, Ollama fallback)
                            test_case_out = await asyncio.wait_for(
                                self.rewrite_service.rewrite_test_case(
                                    req=req,
                                    mode="quick",  # Fast 7B model (only used for Ollama)
                                    timeout=30.0  # 30 second timeout per scenario
                                ),
                                timeout=35.0  # Add extra 5s buffer for wrapper timeout
                            )
                            
                            # Log metrics if available
                            if test_case_out.generation_metrics:
                                metrics = test_case_out.generation_metrics
                                cost_str = f"${metrics.get('cost_usd', 0):.6f}" if metrics.get('cost_usd') else "N/A"
                                logger.info(
                                    f"[METRICS] Scenario {skeleton.get('scenario_id')}: "
                                    f"provider={metrics.get('provider')}, "
                                    f"model={metrics.get('model')}, "
                                    f"latency={metrics.get('latency_ms', 0):.0f}ms, "
                                    f"tokens={metrics.get('tokens_used', 'N/A')}, "
                                    f"cost={cost_str}"
                                )
                            
                            # Convert to test case format
                            test_case = {
                                "test_case_id": f"TC_{uuid4().hex[:8].upper()}",
                                "title": test_case_out.title,
                                "description": test_case_out.description,
                                "test_type": test_case_out.test_type,
                                "priority": test_case_out.priority,
                                "preconditions": [],
                                "steps": [
                                    {
                                        "step_number": step.step_number,
                                        "action": step.action,
                                        "expected_result": step.expected_result,
                                        "element_name": step.element_name,
                                        "selector": step.selector
                                    }
                                    for step in test_case_out.steps
                                ],
                                "postconditions": [],
                                "tags": ["flowstral", "recorded", "llm-enhanced"],
                                "source": "action_graph",
                                "scenario_id": skeleton.get("scenario_id"),
                                "generation_metrics": test_case_out.generation_metrics  # Include metrics
                            }
                            
                            logger.info(f"[OK] LLM rewrote scenario {skeleton.get('scenario_id')} -> '{test_case['title']}' ({len(test_case['steps'])} steps)")
                            return test_case
                            
                        except asyncio.TimeoutError as e:
                            logger.error(f"[TIMEOUT] Scenario {skeleton.get('scenario_id', index)} rewrite timed out after 35s: {e}")
                            return None
                        except TimeoutError as e:
                            logger.error(f"[TIMEOUT] Scenario {skeleton.get('scenario_id', index)} rewrite timed out: {e}")
                            return None
                        except Exception as e:
                            logger.warning(f"[ERROR] Failed to rewrite scenario {skeleton.get('scenario_id', index)}: {type(e).__name__}: {e}")
                            return None
                    
                    # Process scenarios in parallel (batch processing)
                    batch_size = 10  # Process 10 scenarios in parallel
                    all_test_cases = []
                    
                    for i in range(0, len(scenarios), batch_size):
                        batch = scenarios[i:i + batch_size]
                        logger.info(f"Processing batch {i//batch_size + 1}/{(len(scenarios) + batch_size - 1)//batch_size} ({len(batch)} scenarios)")
                        
                        # Create tasks for parallel execution
                        tasks = [rewrite_scenario(skeleton, i + j) for j, skeleton in enumerate(batch)]
                        # Use asyncio module directly (already imported at top)
                        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
                        
                        # Filter out None and exceptions
                        for result in batch_results:
                            if isinstance(result, Exception):
                                logger.warning(f"Exception in parallel rewrite: {result}")
                            elif result:
                                all_test_cases.append(result)
                    
                    if not all_test_cases:
                        logger.warning("No test cases generated from LLM rewrite, falling back to deterministic engine")
                        raise ValueError("No test cases from LLM rewrite")
                    
                    logger.info(f"[OK] LLM rewrite completed: {len(all_test_cases)} test cases generated")
                    
                    # Step 3: Apply enhancements and store
                    enhanced_automated = []
                    enhanced_manual = []
                    
                    for tc in all_test_cases:
                        # Apply universal enhancements
                        if action_graph:
                            tc = self.test_case_enhancements.enhance_test_case(tc, action_graph)
                        
                        # Categorize by test_type
                        if tc.get("test_type", "automated") == "manual":
                            enhanced_manual.append(tc)
                        else:
                            enhanced_automated.append(tc)
                    
                    # Store test cases in database
                    stored_test_case_ids = []
                    if project_id:
                        try:
                            # Get playwright script from artifact if available
                            playwright_script_content = ""
                            if playwright_artifact and isinstance(playwright_artifact, dict):
                                playwright_script_content = playwright_artifact.get("code", "") or playwright_artifact.get("playwright_script", "")
                            
                            # Store all test cases
                            for test_case in enhanced_automated + enhanced_manual:
                                if test_case and isinstance(test_case, dict):
                                    try:
                                        test_case_id = await self.test_design_agent._store_test_case(
                                            test_case=test_case,
                                            playwright_script=playwright_script_content if test_case.get("test_type") != "manual" else "",
                                            requirement_id=None,
                                            project_id=project_id,
                                            tenant_id=tenant_id
                                        )
                                        if test_case_id:
                                            stored_test_case_ids.append(test_case_id)
                                            logger.info(f"[OK] Stored LLM-enhanced test case '{test_case.get('title', 'Unknown')}' with ID: {test_case_id}")
                                    except Exception as e:
                                        logger.warning(f"Failed to store LLM-enhanced test case: {e}")
                            
                            logger.info(f"[OK] Stored {len(stored_test_case_ids)} LLM-enhanced test cases in database for project {project_id}")
                        except Exception as e:
                            logger.error(f"Failed to store LLM-enhanced test cases in database: {e}", exc_info=True)
                    else:
                        logger.warning("No project_id provided - LLM-enhanced test cases will not be stored in database")
                    
                    return {
                        "type": "test_cases",
                        "format": "structured",
                        "test_cases": {
                            "automated": enhanced_automated,
                            "manual": enhanced_manual,
                            "accessibility": [],
                            "performance": []
                        },
                        "statistics": {
                            "total_test_cases": len(all_test_cases),
                            "scenarios_processed": len(scenarios),
                            "llm_rewrite_enabled": True
                        },
                        "generation_method": "llm_enhanced",
                        "total_count": len(all_test_cases),
                        "stored_count": len(stored_test_case_ids),
                        "stored_test_case_ids": stored_test_case_ids,
                        "export_format": "test_cases.json"
                    }
                    
                except Exception as e:
                    logger.error(f"LLM-enhanced generation failed: {e}", exc_info=True)
                    logger.warning("Falling back to deterministic engine")
                    # Fall through to deterministic engine
            
            # Fallback: Try enhanced engine (deterministic only)
            if use_enhanced_engine and action_graph and len(action_graph.nodes) > 0:
                try:
                    logger.info("[ENGINE] Using Enhanced Test Case Engine (DETERMINISTIC - NO LLM) with optimization rules")
                    # Extract DOM snapshots from action graph if available
                    dom_snapshots_dict = {}
                    if hasattr(action_graph, 'nodes'):
                        for node in action_graph.nodes:
                            if node.dom_snapshot_id:
                                # Try to get DOM snapshot from session manager or storage
                                # For now, pass None and let engine use node data
                                pass
                    
                    result = self.test_design_agent.generate_from_action_graph(
                        action_graph=action_graph,
                        dom_snapshots=dom_snapshots_dict if dom_snapshots_dict else None,
                        output_format="istqb",
                        use_enhanced_engine=True  # Uses deterministic engine only
                    )
                    
                    # Convert to expected format
                    if result and result.get("test_cases"):
                        automated_cases = []
                        manual_cases = []
                        
                        for tc in result["test_cases"]:
                            if tc.get("test_type") == "manual":
                                manual_cases.append(tc)
                            else:
                                automated_cases.append(tc)
                        
                        # Use first automated case as main
                        automated_result = None
                        if automated_cases:
                            automated_result = {
                                "status": "success",
                                "test_case_id": automated_cases[0].get("test_case_id"),
                                "test_case": automated_cases[0],
                                "created_at": datetime.utcnow().isoformat()
                            }
                        
                        # DISABLED: Accessibility and Performance test cases - commented out for now
                        # Focus on manual and Playwright test cases only
                        enhanced_a11y = []  # Empty - disabled
                        enhanced_perf = []  # Empty - disabled
                        
                        # Filter out a11y/perf from enhanced engine results (if any)
                        for tc in result.get("test_cases", []):
                            if tc.get("test_type") in ["accessibility", "performance"]:
                                # Skip a11y/perf test cases
                                continue
                        
                        logger.info(f"Enhanced engine generated {len(automated_cases)} automated, {len(manual_cases)} manual test cases (a11y/perf disabled)")
                        
                        # QUALITY VALIDATION: Clean test cases before returning (use same function as below)
                        # Define cleaning function inline (will be defined again below, but needed here too)
                        def clean_test_case_actions_enhanced(tc: Dict[str, Any]) -> Dict[str, Any]:
                            """Clean test case actions - same logic as clean_test_case_actions below"""
                            if not isinstance(tc, dict):
                                return tc
                            steps = tc.get("steps") or tc.get("test_steps", [])
                            if not steps:
                                return tc
                            import re
                            cleaned_steps = []
                            for step in steps:
                                if not isinstance(step, dict):
                                    cleaned_steps.append(step)
                                    continue
                                action = step.get("action", "")
                                if not action:
                                    cleaned_steps.append(step)
                                    continue
                                # Check for bad format: "click: .selector" or "fill: #selector"
                                bad_format_match = re.match(r'^(click|fill|type|select|navigate):\s*(.+)$', action, re.I)
                                if bad_format_match:
                                    detected_action = bad_format_match.group(1).lower()
                                    detected_selector = bad_format_match.group(2).strip()
                                    element_name = None
                                    if detected_selector.startswith('#'):
                                        element_id = detected_selector[1:].split('.')[0].split('[')[0]
                                        element_name = element_id.replace("_", " ").replace("-", " ")
                                        element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)
                                        element_name = element_name.title()
                                        name_lower = element_name.lower()
                                        if "vehicle" in name_lower:
                                            if "year" in name_lower:
                                                element_name = "Vehicle Year"
                                            elif "make" in name_lower:
                                                element_name = "Vehicle Make"
                                            elif "model" in name_lower:
                                                element_name = "Vehicle Model"
                                            elif "sub" in name_lower and "model" in name_lower:
                                                element_name = "Vehicle Submodel"
                                        elif "tire" in name_lower and "size" in name_lower:
                                            element_name = "Tire Size"
                                        elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                                            element_name = "Smart Submodel"
                                        elif "continue" in name_lower and "checkout" in name_lower:
                                            element_name = "Continue to Checkout Button"
                                        elif "continue" in name_lower:
                                            element_name = "Continue Button"
                                    elif detected_selector and detected_selector.startswith('.'):
                                        classes = re.findall(r'\.([a-zA-Z0-9_-]+)', detected_selector)
                                        meaningful_classes = [c for c in classes if len(c) > 3 and c.lower() not in ['ld', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'pa', 'ph', 'pv', 'ma', 'mh', 'mv', 'tc', 'tl', 'tr', 'db', 'dn', 'flex', 'items', 'justify', 'center', 'w', 'h', 'bg', 'f', 'sans', 'serif', 'bn', 'pointer', 'shadow', 'nowrap', 'underline', 'redesigned', 'cart', 'total', 'mid', 'gray', 'no', 'underline']]
                                        if meaningful_classes:
                                            best_class = max(meaningful_classes, key=len)
                                            name = best_class.replace("_", " ").replace("-", " ")
                                            name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
                                            element_name = name.title()
                                            name_lower = element_name.lower()
                                            if "chevron" in name_lower or "dropdown" in name_lower:
                                                element_name = "Dropdown Arrow"
                                            elif "plus" in name_lower or "add" in name_lower:
                                                element_name = "Add Button"
                                            elif "checkout" in name_lower:
                                                element_name = "Checkout Button"
                                            elif "continue" in name_lower:
                                                element_name = "Continue Button"
                                            elif "cart" in name_lower:
                                                element_name = "Cart Button"
                                            elif "subcategory" in name_lower or "category" in name_lower:
                                                element_name = "Category Link"
                                        else:
                                            element_name = "Button" if detected_action == "click" else ("Input Field" if detected_action in ["fill", "type", "input"] else "Element")
                                    actor = "user"
                                    test_data = step.get("test_data", "")
                                    if detected_action == "click":
                                        step["action"] = f"{actor} clicks {element_name}" if element_name else f"{actor} clicks button"
                                    elif detected_action in ["fill", "type", "input"]:
                                        if test_data:
                                            step["action"] = f'{actor} enters "{test_data}" in {element_name}' if element_name else f'{actor} enters "{test_data}"'
                                        else:
                                            step["action"] = f"{actor} enters text in {element_name}" if element_name else f"{actor} enters text"
                                    elif detected_action == "select":
                                        if test_data:
                                            step["action"] = f'{actor} selects "{test_data}" from {element_name}' if element_name else f'{actor} selects "{test_data}"'
                                        else:
                                            step["action"] = f"{actor} selects option from {element_name}" if element_name else f"{actor} selects option"
                                    if element_name:
                                        step["element_name"] = element_name
                                    logger.info(f"Enhanced engine: Cleaned action: '{step['action']}' with element_name: '{element_name}'")
                                # Fix generic expected results
                                expected = step.get("expected_result", "")
                                action_lower = action.lower()  # Define action_lower before using it
                                if expected == "Action completes successfully" or not expected or len(expected) < 5:
                                    if "click" in action_lower:
                                        if "dropdown" in action_lower or "chevron" in action_lower:
                                            step["expected_result"] = "Dropdown menu opens"
                                        elif "button" in action_lower:
                                            step["expected_result"] = "Button is clicked and action is triggered"
                                        elif "checkout" in action_lower:
                                            step["expected_result"] = "Checkout page is displayed"
                                        elif "continue" in action_lower:
                                            step["expected_result"] = "User proceeds to next step"
                                        else:
                                            step["expected_result"] = "Element is clicked successfully"
                                    elif "select" in action_lower:
                                        element_name = step.get("element_name", "dropdown")
                                        step["expected_result"] = f"Option is selected from {element_name}"
                                    elif "enter" in action_lower or "fill" in action_lower or "input" in action_lower:
                                        element_name = step.get("element_name", "field")
                                        step["expected_result"] = f"Value is entered in {element_name}"
                                    else:
                                        step["expected_result"] = "Action completes successfully"
                                cleaned_steps.append(step)
                            if "steps" in tc:
                                tc["steps"] = cleaned_steps
                            if "test_steps" in tc:
                                tc["test_steps"] = cleaned_steps
                            return tc
                        
                        # Clean test cases from enhanced engine
                        enhanced_automated = [clean_test_case_actions_enhanced(automated_result["test_case"])] if automated_result else []
                        enhanced_manual = [clean_test_case_actions_enhanced(tc) for tc in manual_cases]
                        
                        # Apply universal enhancements (entry point, element names, expected results)
                        logger.info(f"[ENHANCE] Applying universal enhancements to enhanced engine test cases...")
                        if action_graph:
                            enhanced_automated = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in enhanced_automated]
                            enhanced_manual = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in enhanced_manual]
                        
                        # QUALITY CHECK: Only filter out test cases with extremely poor quality
                        # Lower threshold significantly to avoid filtering out all test cases
                        quality_threshold = 0.05  # Very low threshold - only filter extremely poor quality
                        filtered_automated = []
                        original_count = len(enhanced_automated)
                        for tc in enhanced_automated:
                            confidence = tc.get("confidence_score", 1.0)
                            quality_metrics = tc.get("quality_metrics", {})
                            completeness = quality_metrics.get("completeness", 1.0)
                            
                            # Only skip test cases with extremely poor quality (both very low confidence AND very low completeness)
                            # This ensures we don't filter out all test cases - be very permissive
                            if confidence < quality_threshold and completeness < 0.1:
                                logger.warning(f"Skipping test case '{tc.get('title', 'Unknown')}' due to extremely poor quality (confidence: {confidence}, completeness: {completeness})")
                                continue
                            
                            # Additional quality checks: filter out test cases with meaningless element names
                            steps = tc.get("steps") or tc.get("test_steps", [])
                            
                            # If test case has no steps at all, skip it
                            if not steps or len(steps) == 0:
                                logger.warning(f"Skipping test case '{tc.get('title', 'Unknown')}' - no steps found")
                                continue
                            
                            poor_element_count = 0
                            for step in steps:
                                element_name = step.get("element_name", "").strip()
                                # Check for meaningless names
                                if not element_name or len(element_name) < 2 or element_name.lower() in ["i", "div", "span", "button", "input", "element", "user api_request", "loading", "ld"]:
                                    poor_element_count += 1
                            
                            # If more than 80% of steps have poor element names, skip (more lenient)
                            if steps and (poor_element_count / len(steps)) > 0.8:
                                logger.warning(f"Skipping test case '{tc.get('title', 'Unknown')}' due to poor element names ({poor_element_count}/{len(steps)} steps)")
                                continue
                            
                            filtered_automated.append(tc)
                        
                        enhanced_automated = filtered_automated
                        filtered_count = original_count - len(enhanced_automated)
                        logger.info(f"[ENHANCE] Finished applying enhancements. Filtered to {len(enhanced_automated)} quality test cases from {original_count} total (filtered out {filtered_count})")
                        
                        # Store test cases in database
                        stored_test_case_ids = []
                        if project_id:
                            try:
                                # Get playwright script from artifact if available
                                playwright_script_content = ""
                                if playwright_artifact and isinstance(playwright_artifact, dict):
                                    playwright_script_content = playwright_artifact.get("code", "") or playwright_artifact.get("playwright_script", "")
                                
                                # Store automated test cases
                                for test_case in enhanced_automated:
                                    if test_case and isinstance(test_case, dict):
                                        try:
                                            test_case_id = await self.test_design_agent._store_test_case(
                                                test_case=test_case,
                                                playwright_script=playwright_script_content if automated_result else "",
                                                requirement_id=None,
                                                project_id=project_id,
                                                tenant_id=tenant_id
                                            )
                                            if test_case_id:
                                                stored_test_case_ids.append(test_case_id)
                                                logger.info(f"[OK] Stored enhanced automated test case '{test_case.get('title', 'Unknown')}' with ID: {test_case_id}")
                                        except Exception as e:
                                            logger.warning(f"Failed to store enhanced automated test case: {e}")
                                
                                # Store manual test cases
                                for test_case in enhanced_manual:
                                    if test_case and isinstance(test_case, dict):
                                        try:
                                            test_case_id = await self.test_design_agent._store_test_case(
                                                test_case=test_case,
                                                playwright_script="",  # Manual cases don't have scripts
                                                requirement_id=None,
                                                project_id=project_id,
                                                tenant_id=tenant_id
                                            )
                                            if test_case_id:
                                                stored_test_case_ids.append(test_case_id)
                                                logger.info(f"[OK] Stored enhanced manual test case '{test_case.get('title', 'Unknown')}' with ID: {test_case_id}")
                                        except Exception as e:
                                            logger.warning(f"Failed to store enhanced manual test case: {e}")
                                
                                logger.info(f"[OK] Stored {len(stored_test_case_ids)} enhanced test cases in database for project {project_id}")
                            except Exception as e:
                                logger.error(f"Failed to store enhanced test cases in database: {e}", exc_info=True)
                        else:
                            logger.warning("No project_id provided - enhanced test cases will not be stored in database")
                        
                        return {
                            "type": "test_cases",
                            "format": "structured",
                            "test_cases": {
                                "automated": enhanced_automated,
                                "manual": enhanced_manual,
                                "accessibility": [],  # Disabled
                                "performance": []     # Disabled
                            },
                            "statistics": result.get("statistics", {}),
                            "generation_method": "enhanced_engine",
                            "total_count": len(enhanced_automated) + len(enhanced_manual),
                            "stored_count": len(stored_test_case_ids),
                            "stored_test_case_ids": stored_test_case_ids,
                            "export_format": "test_cases.json"
                        }
                except Exception as e:
                    logger.error(f"Enhanced engine failed: {e}", exc_info=True)
                    logger.warning("Falling back to LLM-based generation for better quality")
                    # Fall through to LLM-based generation
            
            # Handle None or invalid playwright_artifact
            if playwright_artifact is None or not isinstance(playwright_artifact, dict):
                logger.warning(f"Invalid playwright_artifact: {type(playwright_artifact)}, creating fallback")
                playwright_artifact = {}
            
            playwright_script = playwright_artifact.get("code", "") if isinstance(playwright_artifact, dict) else ""
            
            # OPTIMIZATION: Run automated and manual test case generation in PARALLEL
            # asyncio is already imported at top of file (line 8)
            from app.services.llm.model_gateway import get_model_gateway, GenerationRequest
            model_gateway = get_model_gateway()
            
            # Prepare manual test case prompt (build once, use for parallel call)
            manual_test_case_prompt = None
            if action_graph.nodes and len(action_graph.nodes) > 0:
                graph_dict = action_graph.to_dict()
                max_nodes = 40 if len(graph_dict.get("nodes", [])) > 50 else len(graph_dict.get("nodes", []))
                max_edges = 40 if len(graph_dict.get("edges", [])) > 50 else len(graph_dict.get("edges", []))
                
                import json as json_module
                
                # OPTIMIZATION Strategy 3: Create concise summary instead of full JSON
                # (Removed limited_graph JSON - using summary instead)
                # Build flow summary (concise)
                flow_summary = []
                for i, node in enumerate(action_graph.nodes[:25], 1):  # Reduced from 30 to 25
                    parts = []
                    if node.title:
                        parts.append(f"Screen: {node.title}")
                    if node.url_pattern:
                        # Extract domain only for brevity
                        try:
                            from urllib.parse import urlparse
                            domain = urlparse(node.url_pattern).netloc or node.url_pattern[:50]
                            parts.append(f"URL: {domain}")
                        except:
                            parts.append(f"URL: {node.url_pattern[:50]}")
                    if node.target_text:
                        parts.append(f"Element: {node.target_text[:40]}")
                    if parts:
                        flow_summary.append(f"Step {i}: {' | '.join(parts)}")
                
                # Extract semantic actions (concise)
                semantic_actions = []
                for edge in action_graph.edges[:20]:  # Reduced from 30 to 20
                    action_desc = edge.description or edge.action
                    if action_desc and action_desc != edge.action:
                        semantic_actions.append(f"- {action_desc[:60]}")
                    if edge.expected_outcome:
                        semantic_actions.append(f"  → {edge.expected_outcome[:50]}")
                
                # Create graph statistics summary instead of full JSON
                first_url = action_graph.nodes[0].url_pattern if action_graph.nodes and action_graph.nodes[0].url_pattern else "N/A"
                last_url = action_graph.nodes[-1].url_pattern if action_graph.nodes and action_graph.nodes[-1].url_pattern else "N/A"
                
                graph_stats = {
                    "total_nodes": len(action_graph.nodes),
                    "total_edges": len(action_graph.edges),
                    "session_id": action_graph.session_id,
                    "first_url": first_url,
                    "last_url": last_url,
                    "key_screens": [n.title for n in action_graph.nodes[:10] if n.title],
                    "action_types": list(set([e.action for e in action_graph.edges[:20]]))
                }
                
                # OPTIMIZATION: Ultra-concise prompt (reduce from ~2000 to ~400 tokens for 5-10x speedup)
                key_actions = [f"{i+1}. {edge.description or edge.action}" for i, edge in enumerate(action_graph.edges[:12])]
                key_urls = [n.url_pattern for n in action_graph.nodes[:3] if n.url_pattern]
                
                # Safe string slicing - handle None values
                first_url_safe = (first_url[:50] if first_url and first_url != "N/A" else "N/A")
                last_url_safe = (last_url[:50] if last_url and last_url != "N/A" else "N/A")
                
                manual_test_case_prompt = f"""Generate 3-5 manual test cases from this recorded flow.

FLOW: {first_url_safe} → {last_url_safe} ({graph_stats['total_nodes']} screens)

ACTIONS:
{chr(10).join(key_actions[:10])}

Return JSON array. Each test case: {{"title": "...", "description": "...", "test_type": "manual", "priority": "medium", "steps": [{{"step_number": 1, "action": "...", "expected_result": "..."}}], "tags": []}}

Return ONLY valid JSON array, no explanations."""
            
            async def generate_automated_test_case():
                """Generate automated test case from Playwright script with action graph enrichment"""
                try:
                    # Use action graph to enrich the test case with semantic names
                    return await self.test_design_agent.convert_script_to_test_case(
                        playwright_script=playwright_script,
                        recording_data={"action_graph": action_graph.to_dict() if action_graph else None},
                        project_id=project_id,
                        tenant_id=tenant_id
                    )
                except Exception as e:
                    logger.warning(f"Failed to store test case in database, generating in-memory only: {e}. This is usually due to an invalid project_id or database connection issue. The test case will still be included in artifacts.")
                    parsed = self.test_design_agent._parse_playwright_script(playwright_script)
                    return {
                        "status": "success",
                        "test_case_id": None,
                        "test_case": {
                            "title": parsed.get("test_name", "Flowstral Recorded Test"),
                            "description": f"Recorded test with {len(action_graph.nodes)} actions",
                            "test_type": "functional",
                            "priority": "medium",
                            "steps": [
                                {
                                    "step_number": i + 1,
                                    "action": f"user performs {action.get('type', 'unknown')} action",
                                    "expected_result": "Action completes successfully",
                                    "element_name": "Element",
                                    "selector": action.get('selector', '')
                                }
                                for i, action in enumerate(parsed.get("actions", []))
                            ]
                        },
                        "created_at": datetime.utcnow().isoformat()
                    }
            
            async def generate_manual_test_cases():
                """Generate manual test cases from Action Graph - DISABLED LLM: Using deterministic engine only"""
                # DISABLED LLM: Commented out LLM-based generation
                # Using deterministic engine instead which generates both automated and manual test cases
                logger.info("[ENGINE] DISABLED LLM: Using deterministic engine for manual test cases (no LLM calls)")
                
                # Return empty list - manual test cases will be generated by deterministic engine if needed
                # The enhanced engine can generate manual test cases by setting test_type="manual"
                return []
                
                # ORIGINAL LLM CODE (COMMENTED OUT):
                # if not manual_test_case_prompt:
                #     return []
                # 
                # try:
                #     # OPTIMIZATION: Generate ALL test cases in ONE LLM call (batch) instead of individual calls
                #     # This is 5-10x faster than generating them one-by-one
                #     logger.info("🚀 Generating all manual test cases in single batch call (faster)")
                #     
                #     gen_request = GenerationRequest(
                #         prompt=manual_test_case_prompt,
                #         mode="quick",
                #         validate_json=True,
                #         task_type="test_design",
                #         max_tokens=2000,  # Enough for 3-5 test cases
                #         use_fast_model=True  # Use 7B model if available, otherwise 30B
                #     )
                #     
                #     from app.services.llm.model_gateway import get_model_gateway
                #     model_gateway = get_model_gateway()
                #     result = await model_gateway.generate(gen_request, tenant_id=tenant_id)
                #     
                #     # Add detailed logging to debug model response
                #     if result:
                #         logger.info(f"🔍 Manual test cases - Model response received: model={result.model}, response_length={len(result.response) if result.response else 0}, has_response={result.response is not None}")
                #     else:
                #         logger.warning("🔍 Manual test cases - Model gateway returned None result")
                #     
                #     if not result or not result.response or not result.response.strip():
                #         logger.warning(f"Empty response for batch test case generation - result={result is not None}, has_response={result.response is not None if result else False}, response_length={len(result.response) if result and result.response else 0}")
                #         return []
                #     
                #     try:
                #         import json as json_module
                #         import re
                #         
                #         # Try to extract JSON from markdown code blocks if present
                #         response_text = result.response
                #         if "```json" in response_text or "```" in response_text:
                #             # Extract JSON from markdown code blocks
                #             json_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', response_text, re.DOTALL | re.IGNORECASE)
                #             if json_match:
                #                 response_text = json_match.group(1).strip()
                #                 logger.info(f"Extracted JSON from markdown code block (length: {len(response_text)})")
                #             else:
                #                 # Try to find JSON array or object
                #                 array_match = re.search(r'\[.*?\]', response_text, re.DOTALL)
                #                 if array_match:
                #                     response_text = array_match.group(0)
                #                     logger.info(f"Extracted JSON array from response (length: {len(response_text)})")
                #         
                #         manual_cases = json_module.loads(response_text)
                #         if isinstance(manual_cases, list) and len(manual_cases) > 0:
                #             # Filter out None values and non-dict items
                #             filtered_cases = [case for case in manual_cases if case is not None and isinstance(case, dict)]
                #             if filtered_cases:
                #                 logger.info(f"✅ Generated {len(filtered_cases)} manual test cases in batch (fast!)")
                #                 return filtered_cases
                #             else:
                #                 logger.warning("LLM returned list but all items were None or invalid")
                #                 return []
                #         elif isinstance(manual_cases, dict):
                #             # Sometimes LLM returns single object instead of array
                #             return [manual_cases]
                #         else:
                #             logger.warning("LLM returned invalid format for batch test cases")
                #             return []
                #     except json_module.JSONDecodeError as je:
                #         logger.warning(f"Failed to parse batch test cases JSON: {je}")
                #         logger.debug(f"LLM response: {result.response[:500]}")
                #         return []
                # 
                # except Exception as e:
                #     logger.warning(f"Failed to generate batch test cases: {e}")
                #     return []
            
            # OPTIMIZATION: Run both LLM calls in PARALLEL using asyncio.gather
            logger.info("[PARALLEL] Running automated and manual test case generation in PARALLEL for speed...")
            logger.info("   Automated test case should use 7B model (qwen2.5-coder:7b)")
            start_time = time.time()
            
            # Add timeout to prevent hanging - increased to 5 minutes to accommodate 30B model fallback
            # 7B model should take ~30-60s, but 30B can take 2-3 minutes, so we need buffer
            test_case_timeout = float(os.getenv("TEST_CASE_GENERATION_TIMEOUT", "300.0"))  # 5 minutes default
            logger.info(f"   Timeout set to {test_case_timeout}s ({test_case_timeout/60:.1f} minutes)")
            
            try:
                gather_result = await asyncio.wait_for(
                    asyncio.gather(
                        generate_automated_test_case(),
                        generate_manual_test_cases(),
                        return_exceptions=True
                    ),
                    timeout=test_case_timeout
                )
                # Safely unpack results with None checks
                if not isinstance(gather_result, (list, tuple)) or len(gather_result) != 2:
                    logger.error(f"Unexpected gather result format: {type(gather_result)}, length: {len(gather_result) if hasattr(gather_result, '__len__') else 'N/A'}")
                    automated_result = None
                    manual_cases_list = []
                else:
                    automated_result = gather_result[0]
                    manual_cases_list = gather_result[1]
            except asyncio.TimeoutError:
                elapsed = time.time() - start_time
                logger.error(f"[ERROR] Test case generation timed out after {elapsed:.1f}s ({elapsed/60:.1f} minutes)")
                logger.error(f"   Timeout limit was {test_case_timeout}s ({test_case_timeout/60:.1f} minutes)")
                logger.error("   This usually means the LLM is not responding or taking too long. Check:")
                logger.error("   1. Ollama connection (OLLAMA_URL)")
                logger.error("   2. Model availability (qwen2.5-coder:7b or qwen3-coder:30b)")
                logger.error("   3. SSH tunnel to spark server")
                logger.error("   4. Model performance (30B model can take 2-3 minutes)")
                logger.error(f"   5. Consider increasing TEST_CASE_GENERATION_TIMEOUT (current: {test_case_timeout}s)")
                # Return fallback results
                automated_result = {
                    "status": "error",
                    "test_case_id": None,
                    "test_case": {
                        "title": "Test Case Generation Timed Out",
                        "description": f"LLM call timed out after {elapsed:.1f}s. This may happen with 30B model or slow connections.",
                        "test_type": "automated",
                        "error": f"Generation timed out after {elapsed:.1f}s - check LLM connection and model performance"
                    },
                    "created_at": datetime.utcnow().isoformat()
                }
                manual_cases_list = []
            
            elapsed = time.time() - start_time
            logger.info(f"[OK] Parallel test case generation completed in {elapsed:.1f}s (vs sequential ~{elapsed*2:.1f}s)")
            
            # Handle None results FIRST (before checking for exceptions)
            if automated_result is None:
                logger.warning("Automated test case generation returned None - creating fallback")
                parsed = self.test_design_agent._parse_playwright_script(playwright_script)
                automated_result = {
                    "status": "error",
                    "test_case_id": None,
                    "test_case": {
                        "title": parsed.get("test_name", "Flowstral Recorded Test") if isinstance(parsed, dict) else "Flowstral Recorded Test",
                        "description": f"Recorded test with {len(action_graph.nodes)} actions",
                        "test_type": "functional",
                        "priority": "medium",
                        "steps": []
                    },
                    "created_at": datetime.utcnow().isoformat()
                }
            
            if manual_cases_list is None:
                logger.warning("Manual test case generation returned None - using empty list")
                manual_cases_list = []
            
            # Handle exceptions
            if isinstance(automated_result, Exception):
                logger.error(f"Automated test case generation failed: {automated_result}")
                parsed = self.test_design_agent._parse_playwright_script(playwright_script)
                automated_result = {
                    "status": "success",
                    "test_case_id": None,
                    "test_case": {
                        "title": parsed.get("test_name", "Flowstral Recorded Test"),
                        "description": f"Recorded test with {len(action_graph.nodes)} actions",
                        "test_type": "functional",
                        "priority": "medium",
                        "steps": []
                    },
                    "created_at": datetime.utcnow().isoformat()
                }
            
            if isinstance(manual_cases_list, Exception):
                logger.error(f"Manual test case generation failed: {manual_cases_list}")
                manual_cases_list = []
            
            # Note: None checks are already done above (line 658-676)
            
            # Ensure automated_result is a dict before accessing
            if not isinstance(automated_result, dict):
                logger.warning(f"Automated result is not a dict: {type(automated_result)} - creating fallback")
                automated_result = {
                    "status": "error",
                    "test_case_id": None,
                    "test_case": {
                        "title": "Flowstral Recorded Test",
                        "description": "Test case generation returned invalid format",
                        "test_type": "functional",
                        "priority": "medium",
                        "steps": []
                    },
                    "created_at": datetime.utcnow().isoformat()
                }
            
            # Ensure test_case is never None - handle case where key exists but value is None
            test_case = automated_result.get("test_case") if isinstance(automated_result, dict) else None
            if test_case is None or not isinstance(test_case, dict):
                test_case = {}
            
            # Ensure additional_cases is a list and filter out None values
            additional_cases = manual_cases_list if isinstance(manual_cases_list, list) else []
            # Filter out None values that might come from malformed LLM responses
            additional_cases = [case for case in additional_cases if case is not None and isinstance(case, dict)]
            
            # Flowstral internal events to filter out
            INTERNAL_EVENTS = {
                "wcag_scan", "scroll", "api_request", "page_load", 
                "change", "session_start", "session_end", "dom_snapshot"
            }
            
            # User interaction events that should generate test cases
            USER_INTERACTION_EVENTS = {
                "click", "input", "type", "select", "submit", 
                "navigate", "keydown", "keyup", "keypress"
            }
            
            # DISABLED: Accessibility and Performance test cases - commented out for now
            # Focus on manual and Playwright test cases only
            # TODO: Re-enable after fixing quality issues
            # 
            # # Accessibility test cases - only for actual user interactions
            # # Group by page/URL to avoid duplicates
            # a11y_pages_seen = set()
            # for node in action_graph.nodes:
            #     # Check if this is an internal event by checking both event_type AND action_description
            #     is_internal = (
            #         node.event_type in INTERNAL_EVENTS or
            #         (node.action_description and any(
            #             pattern in node.action_description.lower() 
            #             for pattern in ["wcag_scan", "user wcag_scan", "user scroll", "user api_request", 
            #                           "api_request", "page_load", "session_start", "session_end"]
            #         ))
            #     )
            #     
            #     # Only generate for user interactions, not internal events
            #     if (node.wcag_snapshot_id and 
            #         not is_internal and
            #         node.event_type in USER_INTERACTION_EVENTS):
            #         
            #         # Use URL pattern as key to avoid duplicates per page
            #         page_key = node.url_pattern or node.url or "unknown"
            #         if page_key not in a11y_pages_seen:
            #             a11y_pages_seen.add(page_key)
            #             # Extract clean page name
            #             page_name = self._extract_clean_page_name(node.url_pattern or node.url or "Page")
            #             additional_cases.append({
            #                 "title": f"Accessibility Check: {page_name}",
            #                 "description": "Verify WCAG compliance for user interactions",
            #                 "test_type": "accessibility",
            #                 "priority": "high",
            #                 "tags": ["accessibility", "wcag"],
            #                 "steps": [
            #                     {
            #                         "step_number": 1,
            #                         "action": f"Navigate to {page_name}",
            #                         "expected_result": "Page loads successfully"
            #                     },
            #                     {
            #                         "step_number": 2,
            #                         "action": "Run WCAG accessibility scan",
            #                         "expected_result": "No critical or serious violations"
            #                     }
            #                 ]
            #             })
            # 
            # # Performance test cases - only for actual user interactions
            # # Group by page/URL to avoid duplicates
            # perf_pages_seen = set()
            # for node in action_graph.nodes:
            #     # Check if this is an internal event by checking both event_type AND action_description
            #     is_internal = (
            #         node.event_type in INTERNAL_EVENTS or
            #         (node.action_description and any(
            #             pattern in node.action_description.lower() 
            #             for pattern in ["wcag_scan", "user wcag_scan", "user scroll", "user api_request", 
            #                           "api_request", "page_load", "session_start", "session_end"]
            #         ))
            #     )
            #     
            #     # Only generate for user interactions, not internal events
            #     if (node.performance_snapshot_id and 
            #         not is_internal and
            #         node.event_type in USER_INTERACTION_EVENTS):
            #         
            #         # Use URL pattern as key to avoid duplicates per page
            #         page_key = node.url_pattern or node.url or "unknown"
            #         if page_key not in perf_pages_seen:
            #             perf_pages_seen.add(page_key)
            #             # Extract clean page name
            #             page_name = self._extract_clean_page_name(node.url_pattern or node.url or "Page")
            #             additional_cases.append({
            #                 "title": f"Performance Check: {page_name}",
            #                 "description": "Verify performance metrics meet SLA",
            #                 "test_type": "performance",
            #                 "priority": "medium",
            #                 "tags": ["performance", "web-vitals"],
            #                 "steps": [
            #                     {
            #                         "step_number": 1,
            #                         "action": f"Navigate to {page_name}",
            #                         "expected_result": "Page loads successfully"
            #                     },
            #                     {
            #                         "step_number": 2,
            #                         "action": "Measure LCP, FCP, CLS, TBT",
            #                         "expected_result": "All metrics within acceptable thresholds"
            #                     }
            #                 ]
            #             })
            
            # KEY FIX: Store ALL test cases in database so they appear in the website
            stored_test_case_ids = []
            # Initialize categorization variables to ensure they're always defined
            manual_cases = []
            a11y_cases = []
            perf_cases = []
            
            if project_id:
                try:
                    # Store the main automated test case
                    if isinstance(automated_result, dict):
                        main_test_case_id = automated_result.get("test_case_id")
                        # If test case wasn't stored yet, store it now
                        if not main_test_case_id and test_case:
                            try:
                                main_test_case_id = await self.test_design_agent._store_test_case(
                                    test_case=test_case,
                                    playwright_script=playwright_script,
                                    requirement_id=None,
                                    project_id=project_id,
                                    tenant_id=tenant_id
                                )
                                logger.info(f"Stored main test case '{test_case.get('title', 'Unknown')}' with ID: {main_test_case_id}")
                            except Exception as e:
                                logger.warning(f"Failed to store main test case: {e}")
                        
                        if main_test_case_id:
                            stored_test_case_ids.append(main_test_case_id)
                    
                    # Categorize additional test cases by type
                    # (manual_cases, a11y_cases, perf_cases already initialized above)
                    
                    for additional_case in additional_cases:
                        # Safety check: ensure additional_case is a dict before accessing
                        if not isinstance(additional_case, dict):
                            logger.warning(f"Skipping invalid test case (not a dict): {type(additional_case)}")
                            continue
                        test_type = additional_case.get("test_type", "manual")
                        if test_type == "accessibility":
                            a11y_cases.append(additional_case)
                        elif test_type == "performance":
                            perf_cases.append(additional_case)
                        else:
                            manual_cases.append(additional_case)
                        
                        # Store each additional test case in database
                        try:
                            additional_id = await self.test_design_agent._store_test_case(
                                test_case=additional_case,
                                playwright_script="",  # Manual/a11y/perf cases don't have Playwright scripts
                                requirement_id=None,
                                project_id=project_id,
                                tenant_id=tenant_id
                            )
                            if additional_id:
                                stored_test_case_ids.append(additional_id)
                                logger.info(f"Stored additional test case '{additional_case.get('title', 'Unknown')}' with ID: {additional_id}")
                        except Exception as e:
                            logger.warning(f"Failed to store additional test case '{additional_case.get('title', 'Unknown')}': {e}")
                            # Continue storing other test cases
                    
                    logger.info(f"[OK] Stored {len(stored_test_case_ids)} test cases in database for project {project_id}")
                except Exception as e:
                    logger.error(f"Failed to store test cases in database: {e}", exc_info=True)
                    # Fallback: categorize without storing (filter out None and non-dict values)
                    manual_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") != "accessibility" and tc.get("test_type") != "performance"]
                    a11y_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") == "accessibility"]
                    perf_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") == "performance"]
            else:
                logger.warning("No project_id provided - test cases will not be stored in database (in-memory only)")
                # Categorize without storing (filter out None and non-dict values)
                manual_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") != "accessibility" and tc.get("test_type") != "performance"]
                a11y_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") == "accessibility"]
                perf_cases = [tc for tc in additional_cases if isinstance(tc, dict) and tc.get("test_type") == "performance"]
            
            # Structure test cases to match frontend expectations
            # Ensure test_case is valid before including it
            automated_list = [test_case] if test_case and isinstance(test_case, dict) else []
            total_count = len(automated_list) + len(additional_cases)
            
            # Ensure all categorization lists are actually lists (defensive programming)
            if not isinstance(manual_cases, list):
                logger.warning(f"manual_cases is not a list: {type(manual_cases)}, converting to empty list")
                manual_cases = []
            if not isinstance(a11y_cases, list):
                logger.warning(f"a11y_cases is not a list: {type(a11y_cases)}, converting to empty list")
                a11y_cases = []
            if not isinstance(perf_cases, list):
                logger.warning(f"perf_cases is not a list: {type(perf_cases)}, converting to empty list")
                perf_cases = []
            
            # Final safety check - ensure no None values in lists
            manual_cases = [tc for tc in manual_cases if tc is not None and isinstance(tc, dict)]
            a11y_cases = [tc for tc in a11y_cases if tc is not None and isinstance(tc, dict)]
            perf_cases = [tc for tc in perf_cases if tc is not None and isinstance(tc, dict)]
            
            # QUALITY VALIDATION: Clean and fix test cases before returning
            def clean_test_case_actions(test_case: Dict[str, Any]) -> Dict[str, Any]:
                """Clean test case actions to ensure quality - fix bad formats like 'click: .selector'"""
                if not isinstance(test_case, dict):
                    return test_case
                
                steps = test_case.get("steps") or test_case.get("test_steps", [])
                if not steps:
                    return test_case
                
                import re
                cleaned_steps = []
                seen_step_signatures = set()  # Track seen steps to remove duplicates
                
                # Build selector to node mapping from action graph for better element names
                selector_to_node = {}
                selector_to_edge = {}
                if action_graph and hasattr(action_graph, 'nodes') and hasattr(action_graph, 'edges'):
                    for node in action_graph.nodes:
                        if node.target_selector:
                            normalized = node.target_selector.strip().strip('"').strip("'")
                            selector_to_node[normalized] = node
                            selector_to_node[f'"{normalized}"'] = node
                            selector_to_node[f"'{normalized}'"] = node
                            if normalized.startswith('#'):
                                selector_to_node[normalized[1:]] = node
                    
                    for edge in action_graph.edges:
                        if edge.locators and edge.locators.get("primary"):
                            selector = edge.locators["primary"].strip().strip('"').strip("'")
                            selector_to_edge[selector] = edge
                        # Also map by from_node target_selector
                        from_node = action_graph.node_map.get(edge.from_node_id)
                        if from_node and from_node.target_selector:
                            normalized = from_node.target_selector.strip().strip('"').strip("'")
                            selector_to_edge[normalized] = edge
                            # Also try partial matches for complex selectors
                            if normalized.startswith('.'):
                                # Extract key class names
                                classes = normalized.split('.')
                                for cls in classes:
                                    if cls and len(cls) > 3:
                                        selector_to_edge[cls] = edge
                                        selector_to_edge[f'.{cls}'] = edge
                
                for step in steps:
                    if not isinstance(step, dict):
                        cleaned_steps.append(step)
                        continue
                    
                    action = step.get("action", "")
                    selector = step.get("selector", "")
                    element_name = step.get("element_name", "")
                    
                    if not action:
                        cleaned_steps.append(step)
                        continue
                    
                    # Check if action is generic and needs cleaning
                    is_generic_action = (
                        "performs" in action.lower() and "action" in action.lower() and
                        (element_name == "Element" or not element_name or element_name == "")
                    )
                    
                    # Check for bad format: "click: .selector" or "fill: #selector" (with or without space after colon)
                    # Also check for formats like "click:selector" or "click:.selector"
                    bad_format_match = re.match(r'^(click|fill|type|select|navigate)\s*:\s*(.+)$', action, re.I)
                    
                    # Also check for generic actions like "user performs click action"
                    generic_action_match = None
                    if is_generic_action and selector:
                        generic_action_match = re.match(r'user\s+performs\s+(\w+)\s+action', action, re.I)
                    
                    if bad_format_match or (generic_action_match and selector):
                        if bad_format_match:
                            logger.info(f"[CLEAN] Found bad format action: '{action}' - cleaning it...")
                            detected_action = bad_format_match.group(1).lower()
                            detected_selector = bad_format_match.group(2).strip()
                        elif generic_action_match:
                            logger.info(f"[CLEAN] Found generic action: '{action}' with selector '{selector}' - cleaning it...")
                            detected_action = generic_action_match.group(1).lower()
                            detected_selector = selector.strip()
                        else:
                            detected_action = None
                            detected_selector = None
                        
                        # Extract element name from selector - try action graph first, then fallback to selector parsing
                        element_name = None
                        destination_page = None
                        edge_expected_outcome = None
                        
                        # Filter out transient states and internal text
                        TRANSIENT_STATES = ["loading", "loading…", "loading...", "please wait", "processing", "...", "…"]
                        
                        # SPECIAL HANDLING: Cart total selectors should map to "Cart Button" not price
                        if detected_selector and ("cart-total" in detected_selector.lower() or "redesigned-cart-total" in detected_selector.lower()):
                            element_name = "Cart Button"
                            logger.debug(f"[CLEAN] Mapped cart-total selector to 'Cart Button'")
                        
                        # Try to find node/edge in action graph for better context
                        if detected_selector and action_graph:
                            # Try exact match first
                            node = selector_to_node.get(detected_selector)
                            edge = selector_to_edge.get(detected_selector)
                            
                            if not node or not edge:
                                normalized = detected_selector.strip().strip('"').strip("'")
                                if not node:
                                    node = selector_to_node.get(normalized)
                                    if not node and normalized.startswith('#'):
                                        node = selector_to_node.get(normalized[1:])
                                
                                if not edge:
                                    edge = selector_to_edge.get(normalized)
                                    # Try partial match for complex CSS selectors
                                    if not edge and normalized.startswith('.'):
                                        # Extract meaningful class names and try to match
                                        classes = [c for c in normalized.split('.') if c and len(c) > 3]
                                        for cls in classes:
                                            potential_edge = selector_to_edge.get(f'.{cls}')
                                            if potential_edge:
                                                edge = potential_edge
                                                break
                            
                            # Try to get element name from edge description first (often has better text)
                            if edge and not element_name:
                                if edge.description:
                                    # Extract text from descriptions like "User clicks 'Services'", "Click on Auto Care Center Services"
                                    desc = edge.description
                                    # Pattern: "User clicks 'Text'" or "Click on Text"
                                    text_match = re.search(r"(?:clicks|click|on)\s+['\"]([^'\"]+)['\"]", desc, re.I)
                                    if text_match:
                                        candidate_text = text_match.group(1).strip()
                                        # Filter out transient states
                                        if candidate_text.lower() not in TRANSIENT_STATES and not candidate_text.endswith("…") and not candidate_text.endswith("..."):
                                            element_name = candidate_text
                                    # Pattern: "Click on Text" (without quotes)
                                    elif "on " in desc.lower():
                                        parts = desc.lower().split("on ", 1)
                                        if len(parts) > 1:
                                            candidate_text = parts[1].strip().title()
                                            if candidate_text.lower() not in TRANSIENT_STATES and not candidate_text.endswith("…") and not candidate_text.endswith("..."):
                                                element_name = candidate_text
                                    # Pattern: "CLICK_BUTTON: BUTTON - Text"
                                    elif ":" in desc and "-" in desc:
                                        parts = desc.split("-", 1)
                                        if len(parts) > 1:
                                            candidate_text = parts[-1].strip()
                                            if candidate_text.lower() not in TRANSIENT_STATES and not candidate_text.endswith("…") and not candidate_text.endswith("..."):
                                                element_name = candidate_text
                                    if element_name:
                                        logger.debug(f"[CLEAN] Found element name from edge.description: '{element_name}'")
                            
                            if node and not element_name:
                                # Use target_text from node (best source) - but filter out transient states and long concatenated text
                                if node.target_text:
                                    candidate_text = node.target_text.strip()
                                    # Filter out loading states and other transient text
                                    TRANSIENT_STATES = ["loading", "loading…", "loading...", "please wait", "processing", "...", "…"]
                                    # FILTER OUT PRICES - these are not clickable elements
                                    if re.match(r'^\$?[\d,]+\.?\d*$', candidate_text.strip()):
                                        # This is a price - infer from selector instead
                                        logger.debug(f"[CLEAN] Filtered out price '{candidate_text}' from node.target_text")
                                        candidate_text = None
                                    
                                    if candidate_text and candidate_text.lower() not in TRANSIENT_STATES and not candidate_text.endswith("…") and not candidate_text.endswith("..."):
                                        # Filter out very long concatenated text (likely from dropdowns with all options)
                                        # If text is > 50 chars and has multiple capitalized words in a row, it's likely concatenated
                                        if len(candidate_text) > 50:
                                            # Check if it looks like concatenated dropdown options (multiple words in ALL CAPS or Title Case)
                                            words = candidate_text.split()
                                            if len(words) > 5:
                                                # Try to extract just the first meaningful part
                                                # Look for patterns like "Choose Sub ModelHigh Country..." -> "Choose Sub Model"
                                                import re
                                                # Match pattern: "Choose X" or "Select X" followed by concatenated text
                                                match = re.match(r'^(Choose|Select)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)', candidate_text)
                                                if match:
                                                    element_name = match.group(0).strip()
                                                    logger.debug(f"[CLEAN] Extracted element name from long concatenated text: '{candidate_text[:50]}...' -> '{element_name}'")
                                                else:
                                                    # Just take first 3-4 words
                                                    element_name = " ".join(words[:4])
                                                    logger.debug(f"[CLEAN] Truncated long element name: '{candidate_text[:50]}...' -> '{element_name}'")
                                            else:
                                                element_name = candidate_text
                                        else:
                                            element_name = candidate_text
                                        logger.debug(f"[CLEAN] Found element name from node.target_text: '{element_name}'")
                                    else:
                                        logger.debug(f"[CLEAN] Filtered out transient state: '{candidate_text}'")
                                # Fallback to action_description
                                elif node.action_description:
                                    desc = node.action_description
                                    # Extract from patterns like "CLICK_BUTTON: BUTTON - Text" or "FILL_INPUT: INPUT#id[value]"
                                    if ":" in desc and "-" in desc:
                                        parts = desc.split("-", 1)
                                        if len(parts) > 1:
                                            element_name = parts[-1].strip()
                                    elif ":" in desc:
                                        parts = desc.split(":", 1)
                                        if len(parts) > 1:
                                            element_name = parts[-1].strip()
                                    # Clean up
                                    if element_name:
                                        element_name = element_name.replace("CLICK_BUTTON:", "").replace("CLICK:", "").replace("BUTTON", "").strip()
                                        element_name = element_name.strip("-").strip()
                            
                            if edge:
                                if edge.expected_outcome:
                                    edge_expected_outcome = edge.expected_outcome
                                # Get destination page from to_node - skip Flowstral internal events
                                to_node = action_graph.node_map.get(edge.to_node_id)
                                if to_node:
                                    # Filter out Flowstral internal events
                                    INTERNAL_EVENTS = {"wcag_scan", "api_request", "page_load", "dom_snapshot", "session_start", "session_end", "change"}
                                    if to_node.event_type not in INTERNAL_EVENTS:
                                        # Check if title contains internal event patterns
                                        title_lower = (to_node.title or "").lower()
                                        if not any(pattern in title_lower for pattern in ["wcag_scan", "api_request", "page_load", "dom_snapshot", "session"]):
                                            if to_node.title:
                                                destination_page = to_node.title
                                            elif to_node.url_pattern:
                                                # Extract clean page name from URL
                                                from urllib.parse import urlparse
                                                parsed = urlparse(to_node.url_pattern)
                                                path = parsed.path.strip('/')
                                                if path:
                                                    destination_page = path.replace('/', ' ').replace('-', ' ').replace('_', ' ').title()
                                                else:
                                                    destination_page = "Home"
                                    
                                    # If we didn't find a good destination, look ahead to next non-internal node
                                    if not destination_page:
                                        # Traverse forward to find next real page
                                        current_node = to_node
                                        visited = set()
                                        for _ in range(5):  # Look ahead max 5 nodes
                                            if current_node.id in visited:
                                                break
                                            visited.add(current_node.id)
                                            # Find next edge from this node
                                            next_edges = [e for e in action_graph.edges if e.from_node_id == current_node.id]
                                            if next_edges:
                                                next_edge = next_edges[0]
                                                next_node = action_graph.node_map.get(next_edge.to_node_id)
                                                if next_node and next_node.event_type not in INTERNAL_EVENTS:
                                                    title_lower = (next_node.title or "").lower()
                                                    if not any(pattern in title_lower for pattern in ["wcag_scan", "api_request", "page_load"]):
                                                        if next_node.title:
                                                            destination_page = next_node.title
                                                        elif next_node.url_pattern:
                                                            from urllib.parse import urlparse
                                                            parsed = urlparse(next_node.url_pattern)
                                                            path = parsed.path.strip('/')
                                                            if path:
                                                                destination_page = path.replace('/', ' ').replace('-', ' ').replace('_', ' ').title()
                                                        break
                                                current_node = next_node
                                            else:
                                                break
                        
                        # Fallback to selector parsing if action graph didn't provide element name
                        if not element_name:
                            if detected_selector and detected_selector.startswith('#'):
                                element_id = detected_selector[1:].split('.')[0].split('[')[0]
                                element_name = element_id.replace("_", " ").replace("-", " ")
                                element_name = re.sub(r'([a-z])([A-Z])', r'\1 \2', element_name)
                                element_name = element_name.title()
                                # Apply mappings
                                name_lower = element_name.lower()
                                if "vehicle" in name_lower:
                                    if "year" in name_lower:
                                        element_name = "Vehicle Year"
                                    elif "make" in name_lower:
                                        element_name = "Vehicle Make"
                                    elif "model" in name_lower:
                                        element_name = "Vehicle Model"
                                    elif "sub" in name_lower and "model" in name_lower:
                                        element_name = "Vehicle Submodel"
                                elif "tire" in name_lower and "size" in name_lower:
                                    element_name = "Tire Size"
                                elif "smart" in name_lower and "sub" in name_lower and "model" in name_lower:
                                    element_name = "Smart Submodel"
                                elif "continue" in name_lower and "checkout" in name_lower:
                                    element_name = "Continue to Checkout Button"
                                elif "continue" in name_lower:
                                    element_name = "Continue Button"
                                
                                # Detect element type from selector to fix element name
                                if detected_selector and ("#vehicleModel" in detected_selector or "#SmartSubModel" in detected_selector or "#TireSize" in detected_selector):
                                    # These are select elements, not buttons
                                    if "model" in name_lower and "sub" not in name_lower:
                                        element_name = "Vehicle Model Dropdown"
                                    elif "submodel" in name_lower or ("sub" in name_lower and "model" in name_lower):
                                        element_name = "Vehicle Submodel Dropdown"
                                    elif "tire" in name_lower and "size" in name_lower:
                                        element_name = "Tire Size Dropdown"
                            elif detected_selector and detected_selector.startswith('.'):
                                # CSS class selector - extract meaningful class (filter out utility classes)
                                classes = re.findall(r'\.([a-zA-Z0-9_-]+)', detected_selector)
                                
                                # Special handling for icon classes like .ld.ld-Plus, .ld.ld-Cart (case-insensitive)
                                selector_lower = detected_selector.lower()
                                if "ld-plus" in selector_lower or ".ld.ld-plus" in selector_lower:
                                    element_name = "Add Button"
                                elif "ld-cart" in selector_lower or ".ld.ld-cart" in selector_lower:
                                    element_name = "Cart Button"
                                elif "ld-chevron" in selector_lower or ".ld.ld-chevron" in selector_lower or "chevron" in selector_lower:
                                    element_name = "Dropdown Arrow"
                                elif not element_name:  # Only proceed if we didn't already set element_name
                                    # Extended list of utility classes to filter out (but keep ld-* icon classes)
                                    utility_classes = ['ld', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr', 'pa', 'ph', 'pv', 'ma', 'mh', 'mv', 
                                                      'tc', 'tl', 'tr', 'db', 'dn', 'flex', 'items', 'justify', 'center', 
                                                      'w', 'h', 'bg', 'f', 'sans', 'serif', 'bn', 'pointer', 'shadow', 
                                                      'nowrap', 'underline', 'redesigned', 'cart', 'total', 'mid', 'gray', 
                                                      'no', 'underline', 'transparent', 'b--none', 'lh', 'title', 'navy', 
                                                      'white', 'black', 'f6', 'w5', 'mr4', 'mr5', 'pa1', 'pa0', 'mb1', 'mr1', 'mr2']
                                    # Keep ld-* classes (icon classes) but filter out standalone 'ld'
                                    meaningful_classes = [c for c in classes if (c.startswith('ld-') or (len(c) > 3 and c.lower() not in utility_classes))]
                                if meaningful_classes:
                                    # Prefer longer, more descriptive classes
                                    best_class = max(meaningful_classes, key=lambda x: (len(x), x.count('-'), x.count('_')))
                                    name = best_class.replace("_", " ").replace("-", " ")
                                    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
                                    element_name = name.title()
                                    # Apply mappings - check selector first for better accuracy
                                    selector_lower = detected_selector.lower()
                                    name_lower = element_name.lower()
                                    
                                    # Check selector for specific patterns first (more reliable)
                                    if "ld-plus" in selector_lower or selector_lower.endswith(".ld-plus") or (".ld.ld-plus" in selector_lower):
                                        element_name = "Add Button"
                                    elif "ld-cart" in selector_lower or (".ld.ld-cart" in selector_lower):
                                        element_name = "Cart Button"
                                    elif "ld-chevron" in selector_lower or (".ld.ld-chevron" in selector_lower):
                                        element_name = "Dropdown Arrow"
                                    elif "checkout" in selector_lower:
                                        element_name = "Continue to Checkout Button"
                                    elif "continue" in selector_lower and "checkout" in selector_lower:
                                        element_name = "Continue to Checkout Button"
                                    elif "continue" in selector_lower:
                                        element_name = "Continue Button"
                                    elif "remove" in selector_lower:
                                        element_name = "Remove Button"
                                    # Fallback to name-based mappings
                                    elif "chevron" in name_lower or "chevron" in best_class.lower() or "dropdown" in name_lower:
                                        element_name = "Dropdown Arrow"
                                    elif "plus" in name_lower or "plus" in best_class.lower() or "add" in name_lower:
                                        element_name = "Add Button"
                                    elif "checkout" in name_lower:
                                        element_name = "Checkout Button"
                                    elif "continue" in name_lower:
                                        element_name = "Continue Button"
                                    elif "cart" in name_lower or "cart" in best_class.lower():
                                        element_name = "Cart Button"
                                    elif "subcategory" in name_lower or "category" in name_lower or "subcategory" in best_class.lower():
                                        element_name = "Category Link"
                                    elif "secondary" in name_lower and "nav" in name_lower:
                                        element_name = "Navigation Menu"
                                    elif "header" in name_lower and "trigger" in name_lower:
                                        element_name = "Header Menu"
                                else:
                                    # Generic class - infer from action
                                    if detected_action == "click":
                                        element_name = "Button"
                                    elif detected_action in ["fill", "type", "input"]:
                                        element_name = "Input Field"
                                    else:
                                        element_name = "Element"
                        
                        # Rebuild action description only if we detected an action
                        if detected_action:
                            actor = "user"
                            test_data = step.get("test_data", "")
                            
                            # Final check: filter out transient states, single characters, and URL strings from element_name
                            if element_name:
                                element_name_lower = element_name.lower()
                                
                                # Filter out transient states
                                if element_name_lower in TRANSIENT_STATES or element_name.endswith("…") or element_name.endswith("..."):
                                    logger.debug(f"[CLEAN] Filtering out transient state from final element_name: '{element_name}'")
                                    element_name = None
                                
                                # Filter out single characters (like "I")
                                elif len(element_name.strip()) <= 1:
                                    logger.debug(f"[CLEAN] Filtering out single character element_name: '{element_name}'")
                                    element_name = None
                                
                                # Filter out URL strings (contain http, https, redirect_uri, etc.)
                                elif any(pattern in element_name_lower for pattern in ["http://", "https://", "redirect_uri", "code_challenge", "tenant_id", "state=", "scope="]):
                                    logger.debug(f"[CLEAN] Filtering out URL string from element_name: '{element_name[:50]}...'")
                                    element_name = None
                                
                                # Filter out GUIDs and long random strings
                                elif len(element_name) > 50 and ("-" in element_name or "_" in element_name):
                                    # Check if it looks like a GUID or random string
                                    if re.match(r'^[a-f0-9-]{20,}$', element_name_lower) or element_name.count("-") > 3:
                                        logger.debug(f"[CLEAN] Filtering out GUID/random string from element_name: '{element_name[:50]}...'")
                                        element_name = None
                                
                                # If element_name was filtered out, try to infer from selector
                                if not element_name and detected_selector:
                                    selector_lower = detected_selector.lower()
                                    if "ld-plus" in selector_lower or "plus" in selector_lower or selector_lower.endswith(".ld-plus"):
                                        element_name = "Add Button"
                                    elif "ld-cart" in selector_lower or ("cart" in selector_lower and "ld" in selector_lower):
                                        element_name = "Cart Button"
                                    elif "checkout" in selector_lower:
                                        element_name = "Continue to Checkout Button"
                                    elif "remove" in selector_lower:
                                        element_name = "Remove Button"
                                    elif "continue" in selector_lower:
                                        element_name = "Continue Button"
                                    else:
                                        element_name = "Button" if detected_action == "click" else "Element"
                            
                            if detected_action == "click":
                                step["action"] = f"{actor} clicks {element_name}" if element_name else f"{actor} clicks button"
                            elif detected_action in ["fill", "type", "input"]:
                                if test_data:
                                    step["action"] = f'{actor} enters "{test_data}" in {element_name}' if element_name else f'{actor} enters "{test_data}"'
                                else:
                                    step["action"] = f"{actor} enters text in {element_name}" if element_name else f"{actor} enters text"
                            elif detected_action == "select":
                                if test_data:
                                    step["action"] = f'{actor} selects "{test_data}" from {element_name}' if element_name else f'{actor} selects "{test_data}"'
                                else:
                                    step["action"] = f"{actor} selects option from {element_name}" if element_name else f"{actor} selects option"
                            
                            # Update element_name in step
                            if element_name:
                                step["element_name"] = element_name
                            
                            logger.info(f"[CLEAN] Cleaned action: '{action}' -> '{step['action']}' with element_name: '{element_name}'")
                    
                    # Check for duplicate steps before adding
                    action_text = step.get("action", "").lower()
                    element_name_text = step.get("element_name", "").lower()
                    selector_text = step.get("selector", "").lower()
                    
                    # Create signature: action + element_name (selector is optional for exact duplicates)
                    step_signature = f"{action_text}:{element_name_text}"
                    step_signature_with_selector = f"{action_text}:{element_name_text}:{selector_text}"
                    
                    # Check if this is an exact duplicate (same action, element, and selector)
                    if step_signature_with_selector in seen_step_signatures:
                        logger.debug(f"[CLEAN] Skipping exact duplicate step: '{step.get('action')}' on '{step.get('element_name')}' with selector '{step.get('selector')}'")
                        continue
                    
                    # Check if this is a functional duplicate (same action and element, different selector)
                    # Only skip if we've seen the same action+element recently (within last 2 steps)
                    if step_signature in seen_step_signatures:
                        # Check if this is a consecutive duplicate (same action+element in sequence)
                        recent_signatures = list(seen_step_signatures)[-2:]  # Last 2 signatures
                        if step_signature in recent_signatures:
                            logger.debug(f"[CLEAN] Skipping consecutive duplicate step: '{step.get('action')}' on '{step.get('element_name')}'")
                            continue
                    
                    # Add to seen signatures
                    seen_step_signatures.add(step_signature_with_selector)
                    seen_step_signatures.add(step_signature)  # Also track without selector for consecutive check
                    
                    # Fix generic expected results - use action graph context if available
                    expected = step.get("expected_result", "")
                    
                    # Filter out bad expected results (click:, click_button:, select:, submit_form:, scroll page, etc.)
                    BAD_EXPECTED_PATTERNS = [
                        "click:", "click_button:", "select:", "submit_form:", "fill_input:", "input:",
                        "scroll page", "scroll", "user scroll", "wcag_scan", "api_request", "page_load", "dom_snapshot", "session",
                        "choose model", "choose sub model", "choose sub modelhigh"
                    ]
                    if expected:
                        # Remove "scroll page" specifically
                        expected = re.sub(r'\bscroll\s+page\b', '', expected, flags=re.I)
                        expected = re.sub(r'\buser\s+is\s+navigated\s+to\s+scroll\s+page\b', '', expected, flags=re.I)
                        expected = re.sub(r'\buser\s+scroll\b', '', expected, flags=re.I)
                        expected = re.sub(r'\s+', ' ', expected).strip()  # Normalize whitespace
                        
                        if any(bad_pattern in expected.lower() for bad_pattern in BAD_EXPECTED_PATTERNS):
                            expected = None  # Force regeneration
                            step["expected_result"] = ""  # Clear bad expected result
                            logger.debug(f"[CLEAN] Filtered out bad expected result")
                        
                        # If expected is now empty or just "scroll", regenerate it
                        if not expected or expected.lower() in ["scroll", "page", "user"]:
                            expected = None
                            step["expected_result"] = ""
                    if expected == "Action completes successfully" or expected == "Element is clicked successfully" or not expected or len(expected) < 5:
                        # Filter out Flowstral internal events from expected results
                        INTERNAL_EVENT_PATTERNS = ["wcag_scan", "api_request", "page_load", "dom_snapshot", "session"]
                        
                        # Use edge expected_outcome if available and not internal
                        if edge_expected_outcome:
                            if not any(pattern in edge_expected_outcome.lower() for pattern in INTERNAL_EVENT_PATTERNS):
                                step["expected_result"] = edge_expected_outcome
                        
                        # Use destination page if available and not internal
                        if (not step.get("expected_result") or step.get("expected_result") == expected) and destination_page:
                            # Filter out internal event pages
                            if not any(pattern in destination_page.lower() for pattern in INTERNAL_EVENT_PATTERNS):
                                if "cart" in destination_page.lower() or "cart" in step.get("element_name", "").lower():
                                    step["expected_result"] = f"User is navigated to cart page"
                                elif "checkout" in destination_page.lower() or "checkout" in step.get("element_name", "").lower():
                                    step["expected_result"] = f"User is navigated to checkout page"
                                elif "tire" in destination_page.lower() or "tire" in step.get("element_name", "").lower():
                                    step["expected_result"] = f"User is navigated to tire selection page"
                                elif "auto" in destination_page.lower() or "care" in destination_page.lower():
                                    step["expected_result"] = f"User is navigated to auto care services page"
                                else:
                                    # Clean up destination page name - remove "User " prefix if present
                                    clean_page = destination_page.replace("User ", "").replace("user ", "").strip()
                                    if clean_page and len(clean_page) > 2:
                                        step["expected_result"] = f"User is navigated to {clean_page.lower()} page"
                        # Generate better expected result based on action and element
                        if not step.get("expected_result") or step.get("expected_result") == expected:
                            # Also check if current expected result is bad (contains "click:", "scroll page", etc.)
                            current_expected = step.get("expected_result", "")
                            BAD_EXPECTED_PATTERNS = [
                                "click:", "click_button:", "select:", "submit_form:", "fill_input:", "input:",
                                "scroll page", "wcag_scan", "api_request", "page_load", "dom_snapshot", "session",
                                "choose model", "choose sub model", "choose sub modelhigh"
                            ]
                            if current_expected and any(bad_pattern in current_expected.lower() for bad_pattern in BAD_EXPECTED_PATTERNS):
                                current_expected = None  # Force regeneration
                                step["expected_result"] = ""  # Clear bad expected result
                                logger.debug(f"[CLEAN] Filtered out bad expected result: '{current_expected}'")
                            
                            if not current_expected or current_expected == expected:
                                action_lower = step.get("action", "").lower()
                                element_name_lower = step.get("element_name", "").lower()
                                selector_lower = step.get("selector", "").lower()
                                
                                if "click" in action_lower:
                                    # Check selector for specific patterns first
                                    if "ld-plus" in selector_lower or "plus" in selector_lower:
                                        step["expected_result"] = "Item is added to cart"
                                    elif "ld-cart" in selector_lower or ("cart" in selector_lower and "ld" in selector_lower):
                                        step["expected_result"] = "User is navigated to cart page"
                                    elif "checkout" in selector_lower or "checkout" in element_name_lower:
                                        step["expected_result"] = "User is navigated to checkout page"
                                    elif "remove" in selector_lower or "remove" in element_name_lower:
                                        step["expected_result"] = "Item is removed from cart"
                                    elif "save" in selector_lower or "save" in element_name_lower:
                                        step["expected_result"] = "Changes are saved successfully"
                                    elif "change" in selector_lower or "change" in element_name_lower or "edit" in selector_lower or "edit" in element_name_lower:
                                        step["expected_result"] = "Edit form is displayed"
                                    elif "dropdown" in action_lower or "chevron" in action_lower or "dropdown" in element_name_lower:
                                        step["expected_result"] = "Dropdown menu opens"
                                    elif "cart" in element_name_lower:
                                        step["expected_result"] = "User is navigated to cart page"
                                    elif "category" in element_name_lower or "link" in element_name_lower:
                                        step["expected_result"] = "Category page is displayed"
                                    elif "add" in element_name_lower or "plus" in element_name_lower:
                                        step["expected_result"] = "Item is added to cart"
                                    elif "button" in action_lower or "button" in element_name_lower:
                                        step["expected_result"] = "Button is clicked and action is triggered"
                                    else:
                                        step["expected_result"] = "Element is clicked successfully"
                                elif "select" in action_lower:
                                    # For select actions, expect the option to be selected
                                    if "vehicle" in element_name_lower or "model" in element_name_lower or "tire" in element_name_lower:
                                        step["expected_result"] = f"Option is selected from {element_name}"
                                    else:
                                        step["expected_result"] = f"Option is selected from dropdown"
                            elif "enter" in action_lower or "fill" in action_lower or "input" in action_lower:
                                element_name = step.get("element_name", "field")
                                step["expected_result"] = f"Value is entered in {element_name}"
                            elif "select" in action_lower:
                                element_name = step.get("element_name", "dropdown")
                                step["expected_result"] = f"Option is selected from {element_name}"
                            else:
                                step["expected_result"] = "Action completes successfully"
                    
                    # Renumber steps after deduplication
                    step["step_number"] = len(cleaned_steps) + 1
                    cleaned_steps.append(step)
                
                # Update test case with cleaned steps
                if "steps" in test_case:
                    test_case["steps"] = cleaned_steps
                if "test_steps" in test_case:
                    test_case["test_steps"] = cleaned_steps
                
                return test_case
            
            # Clean all test cases before returning
            logger.info(f"[CLEAN] Cleaning {len(automated_list)} automated test cases before returning...")
            automated_list = [clean_test_case_actions(tc) for tc in automated_list]
            logger.info(f"[CLEAN] Cleaning {len(manual_cases)} manual test cases before returning...")
            manual_cases = [clean_test_case_actions(tc) for tc in manual_cases]
            logger.info(f"[CLEAN] Cleaning {len(a11y_cases)} accessibility test cases before returning...")
            a11y_cases = [clean_test_case_actions(tc) for tc in a11y_cases]
            logger.info(f"[CLEAN] Cleaning {len(perf_cases)} performance test cases before returning...")
            perf_cases = [clean_test_case_actions(tc) for tc in perf_cases]
            logger.info(f"[CLEAN] Finished cleaning all test cases")
            
            # Apply universal enhancements (entry point, element names, expected results)
            logger.info(f"[ENHANCE] Applying universal enhancements to all test cases...")
            if action_graph:
                automated_list = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in automated_list]
                manual_cases = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in manual_cases]
                a11y_cases = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in a11y_cases]
                perf_cases = [self.test_case_enhancements.enhance_test_case(tc, action_graph) for tc in perf_cases]
            logger.info(f"[ENHANCE] Finished applying enhancements")
            
            result = {
                "type": "test_cases",
                "format": "structured",
                "test_cases": {
                    "automated": automated_list,
                    "manual": manual_cases,
                    "accessibility": a11y_cases,
                    "performance": perf_cases
                },
                "total_count": total_count,
                "stored_count": len(stored_test_case_ids),
                "stored_test_case_ids": stored_test_case_ids,  # IDs of test cases stored in database
                "export_format": "test_cases.json"
            }
            
            # Final validation - ensure result structure is correct
            if not isinstance(result, dict) or "test_cases" not in result:
                logger.error(f"Invalid result structure: {type(result)}, keys: {list(result.keys()) if isinstance(result, dict) else 'not a dict'}")
                result = {
                    "type": "test_cases",
                    "format": "structured",
                    "test_cases": {
                        "automated": [],
                        "manual": [],
                        "accessibility": [],
                        "performance": []
                    },
                    "total_count": 0,
                    "stored_count": 0,
                    "stored_test_case_ids": [],
                    "export_format": "test_cases.json",
                    "error": "Invalid result structure generated"
                }
            
            # Safe access to test_cases structure for logging
            test_cases_dict = result.get('test_cases', {}) if isinstance(result, dict) else {}
            if isinstance(test_cases_dict, dict):
                automated_count = len(test_cases_dict.get('automated', []))
                manual_count = len(test_cases_dict.get('manual', []))
                a11y_count = len(test_cases_dict.get('accessibility', []))
                perf_count = len(test_cases_dict.get('performance', []))
                logger.info(f"[OK] Returning test cases structure: automated={automated_count}, manual={manual_count}, a11y={a11y_count}, perf={perf_count}")
            else:
                logger.warning(f"[WARNING] test_cases is not a dict: {type(test_cases_dict)}")
            
            # Final validation - ensure result is always a dict
            if not isinstance(result, dict):
                logger.error(f"Result is not a dict: {type(result)}, creating fallback")
                result = {
                    "type": "test_cases",
                    "format": "structured",
                    "test_cases": {
                        "automated": [],
                        "manual": [],
                        "accessibility": [],
                        "performance": []
                    },
                    "total_count": 0,
                    "stored_count": 0,
                    "stored_test_case_ids": [],
                    "export_format": "test_cases.json",
                    "error": f"Invalid result type: {type(result)}"
                }
            
            return result
        except Exception as e:
            logger.error(f"[ERROR] CRITICAL: generate_structured_test_cases failed: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            # ALWAYS return a valid dict structure, never None
            return {
                "type": "test_cases",
                "format": "structured",
                "test_cases": {
                    "automated": [],
                    "manual": [],
                    "accessibility": [],
                    "performance": []
                },
                "total_count": 0,
                "stored_count": 0,
                "stored_test_case_ids": [],
                "export_format": "test_cases.json",
                "error": f"'NoneType' object is not subscriptable - {str(e)}"
            }
    
    def _deduplicate_test_cases(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate test cases based on title similarity"""
        if not test_cases:
            return []
        
        deduplicated = []
        seen_titles = set()
        
        for test_case in test_cases:
            title = test_case.get("title", "").lower().strip()
            
            # Skip if title is empty
            if not title:
                continue
            
            # Check for exact duplicate
            if title in seen_titles:
                logger.debug(f"Skipping duplicate test case: {test_case.get('title')}")
                continue
            
            # Check for similar titles (fuzzy matching)
            is_duplicate = False
            for seen_title in seen_titles:
                # If titles are very similar (80%+ overlap), consider it a duplicate
                similarity = self._calculate_title_similarity(title, seen_title)
                if similarity > 0.8:
                    logger.debug(f"Skipping similar test case: {test_case.get('title')} (similarity: {similarity:.2f} with '{seen_title}')")
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                deduplicated.append(test_case)
                seen_titles.add(title)
        
        return deduplicated
    
    def _calculate_title_similarity(self, title1: str, title2: str) -> float:
        """Calculate similarity between two titles (0.0 to 1.0)"""
        # Simple word-based similarity
        words1 = set(title1.split())
        words2 = set(title2.split())
        
        if not words1 or not words2:
            return 0.0
        
        # Calculate Jaccard similarity
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    async def generate_accessibility_report(self, wcag_snapshots: List[Dict[str, Any]], wcag_issues: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Artifact 4: Accessibility Report (WCAG) with OpenAI enhancement"""
        all_violations = []
        all_reports = []
        
        # Step 1: Collect base violations (deterministic)
        valid_snapshots = []
        for s in wcag_snapshots:
            if s is None:
                continue
            if isinstance(s, dict):
                valid_snapshots.append(s)
            elif isinstance(s, list):
                all_violations.extend(s)
        
        if wcag_issues:
            for issue in wcag_issues:
                if isinstance(issue, dict):
                    if "id" in issue or "rule" in issue:
                        all_violations.append(issue)
                    elif "violations" in issue:
                        violations = issue.get("violations", [])
                        if isinstance(violations, list):
                            all_violations.extend(violations)
                elif isinstance(issue, list):
                    all_violations.extend(issue)
        
        if not valid_snapshots and not all_violations:
            return {
                "type": "accessibility_report",
                "format": "wcag_2.1_aa",
                "summary": {
                    "total_violations": 0,
                    "critical": 0,
                    "serious": 0,
                    "moderate": 0,
                    "minor": 0
                },
                "violations_by_rule": [],
                "detailed_reports": [],
                "compliance_status": "no_data",
                "export_format": "accessibility_report.json",
                "note": "No WCAG scans performed during recording"
            }
        
        for snapshot in valid_snapshots:
            try:
                if not snapshot or not isinstance(snapshot, dict):
                    continue
                if "violations" in snapshot:
                    violations = snapshot.get("violations", [])
                    if violations and isinstance(violations, list):
                        all_violations.extend(violations)
                    if snapshot.get("summary"):
                        all_reports.append({
                            "url": snapshot.get("url", "unknown"),
                            "violations_count": snapshot.get("summary", {}).get("total", 0),
                            "timestamp": snapshot.get("timestamp")
                        })
                else:
                    try:
                        report = self.wcag_pipeline.generate_accessibility_report(snapshot)
                        if report and isinstance(report, dict):
                            all_reports.append(report)
                    except Exception as pipe_error:
                        logger.debug(f"Pipeline report generation failed: {pipe_error}")
                        if "violations" in snapshot:
                            violations = snapshot.get("violations", [])
                            if violations and isinstance(violations, list):
                                all_violations.extend(violations)
            except Exception as e:
                logger.warning(f"Failed to process WCAG snapshot: {e}")
                continue
        
        # Aggregate violations
        violations_by_rule = {}
        for violation in all_violations:
            rule_id = violation.get("id", "unknown")
            if rule_id not in violations_by_rule:
                violations_by_rule[rule_id] = {
                    "rule": violation.get("rule", ""),
                    "impact": violation.get("impact", "minor"),
                    "count": 0,
                    "violations": [],
                    "suggested_fix": violation.get("suggested_fix", "")
                }
            violations_by_rule[rule_id]["count"] += 1
            violations_by_rule[rule_id]["violations"].append(violation)
        
        # Calculate totals
        total_critical = sum(1 for v in all_violations if v.get("impact") == "critical")
        total_serious = sum(1 for v in all_violations if v.get("impact") == "serious")
        total_moderate = sum(1 for v in all_violations if v.get("impact") == "moderate")
        total_minor = sum(1 for v in all_violations if v.get("impact") == "minor")
        
        # Step 2: Use OpenAI to generate enhanced report with insights
        enhanced_report = None
        report_metrics = None
        
        try:
            from app.services.llm.accessibility_report_service import get_accessibility_report_service
            a11y_service = get_accessibility_report_service()
            
            logger.info("[LLM] Generating enhanced Accessibility report with OpenAI...")
            
            result = await asyncio.wait_for(
                a11y_service.generate_report(
                    wcag_violations=all_violations,
                    timeout=30.0
                ),
                timeout=35.0
            )
            
            enhanced_report = result.get("report", {})
            report_metrics = result.get("metrics", {})
            
            logger.info(
                f"[OK] Generated Accessibility report "
                f"({report_metrics.get('provider', 'unknown')}, "
                f"{report_metrics.get('latency_ms', 0):.0f}ms)"
            )
            
        except Exception as e:
            logger.warning(f"LLM Accessibility report generation failed: {e}, using base report")
            enhanced_report = None
        
        # Merge enhanced report with base data
        base_summary = {
            "total_violations": len(all_violations),
            "critical": total_critical,
            "serious": total_serious,
            "moderate": total_moderate,
            "minor": total_minor
        }
        
        return {
            "type": "accessibility_report",
            "format": "wcag_2.1_aa",
            "summary": enhanced_report.get("summary", base_summary) if enhanced_report else base_summary,
            "violations_by_rule": list(violations_by_rule.values()),
            "detailed_reports": all_reports,
            "enhanced_report": enhanced_report,  # LLM-generated insights
            "findings": enhanced_report.get("findings", []) if enhanced_report else [],
            "recommendations": enhanced_report.get("recommendations", []) if enhanced_report else [],
            "compliance_breakdown": enhanced_report.get("compliance_breakdown", {}) if enhanced_report else {},
            "compliance_status": enhanced_report.get("summary", {}).get("compliance_status", "non_compliant" if total_critical > 0 else "needs_improvement" if total_serious > 5 else "mostly_compliant") if enhanced_report else ("non_compliant" if total_critical > 0 else "needs_improvement" if total_serious > 5 else "mostly_compliant"),
            "generation_metrics": report_metrics,
            "export_format": "accessibility_report.json"
        }
    
    async def generate_performance_report(self, performance_snapshots: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Artifact 5: Performance Report with OpenAI enhancement"""
        all_bottlenecks = []
        api_latency_matrix = {}
        page_timelines = []
        
        # Step 1: Collect base metrics (deterministic)
        for snapshot in performance_snapshots:
            # Collect bottlenecks
            all_bottlenecks.extend(snapshot.get("bottlenecks", []))
            
            # Build API latency matrix
            network_calls = snapshot.get("network_calls", {})
            for endpoint in network_calls.get("endpoints", []):
                key = f"{endpoint.get('method')} {endpoint.get('url')}"
                if key not in api_latency_matrix:
                    api_latency_matrix[key] = {
                        "url": endpoint.get("url"),
                        "method": endpoint.get("method"),
                        "calls": [],
                        "avg_latency": 0
                    }
                api_latency_matrix[key]["calls"].append({
                    "duration": endpoint.get("avg_duration", 0),
                    "timestamp": snapshot.get("timestamp")
                })
            
            # Page timeline
            page_level = snapshot.get("page_level", {})
            page_timelines.append({
                "url": snapshot.get("url"),
                "timestamp": snapshot.get("timestamp"),
                "metrics": {
                    "lcp": page_level.get("lcp", 0),
                    "fcp": page_level.get("fcp", 0),
                    "cls": page_level.get("cls", 0),
                    "tbt": page_level.get("tbt", 0),
                    "ttfb": page_level.get("ttfb", 0)
                }
            })
        
        # Calculate averages for API matrix
        for endpoint_data in api_latency_matrix.values():
            if endpoint_data["calls"]:
                endpoint_data["avg_latency"] = sum(c["duration"] for c in endpoint_data["calls"]) / len(endpoint_data["calls"])
        
        # Step 2: Use OpenAI to generate enhanced report with insights
        base_metrics = {
            "average_latency_ms": sum(p["metrics"].get("lcp", 0) for p in page_timelines) / len(page_timelines) if page_timelines else 0,
            "total_nodes": len(page_timelines),
            "metrics_by_node": [
                {
                    "node_id": f"node_{i}",
                    "url": p["url"],
                    "latency_ms": p["metrics"].get("lcp", 0)
                }
                for i, p in enumerate(page_timelines)
            ],
            "bottlenecks": all_bottlenecks,
            "edge_metrics": list(api_latency_matrix.values())
        }
        
        enhanced_report = None
        report_metrics = None
        
        try:
            from app.services.llm.performance_report_service import get_performance_report_service
            perf_service = get_performance_report_service()
            
            logger.info("[LLM] Generating enhanced Performance report with OpenAI...")
            
            result = await asyncio.wait_for(
                perf_service.generate_report(
                    performance_metrics=base_metrics,
                    timeout=30.0
                ),
                timeout=35.0
            )
            
            enhanced_report = result.get("report", {})
            report_metrics = result.get("metrics", {})
            
            logger.info(
                f"[OK] Generated Performance report "
                f"({report_metrics.get('provider', 'unknown')}, "
                f"{report_metrics.get('latency_ms', 0):.0f}ms)"
            )
            
        except Exception as e:
            logger.warning(f"LLM Performance report generation failed: {e}, using base report")
            # Fallback to basic recommendations
            recommendations = self._generate_performance_recommendations(all_bottlenecks, api_latency_matrix)
            enhanced_report = {
                "summary": {
                    "overall_status": "warning" if all_bottlenecks else "good",
                    "average_latency_ms": base_metrics["average_latency_ms"],
                    "total_pages_tested": len(page_timelines),
                    "bottlenecks_count": len(all_bottlenecks)
                },
                "findings": [
                    {
                        "page_url": b.get("url", ""),
                        "latency_ms": b.get("value", 0),
                        "issue": b.get("description", ""),
                        "severity": b.get("severity", "medium"),
                        "description": b.get("description", "")
                    }
                    for b in all_bottlenecks[:10]
                ],
                "recommendations": [
                    {"priority": "high", "category": "Performance", "recommendation": r, "expected_improvement": "20-30% improvement"}
                    for r in recommendations[:5]
                ],
                "bottlenecks": all_bottlenecks[:10]
            }
        
        # Merge enhanced report with base metrics
        return {
            "type": "performance_report",
            "format": "web_vitals",
            "api_latency_matrix": list(api_latency_matrix.values()),
            "page_timelines": page_timelines,
            "bottlenecks": all_bottlenecks,
            "enhanced_report": enhanced_report,  # LLM-generated insights
            "summary": enhanced_report.get("summary", {
                "total_bottlenecks": len(all_bottlenecks),
                "high_severity": len([b for b in all_bottlenecks if b.get("severity") == "high"]),
                "api_endpoints_tested": len(api_latency_matrix),
                "pages_tested": len(page_timelines)
            }),
            "findings": enhanced_report.get("findings", []),
            "recommendations": enhanced_report.get("recommendations", []),
            "generation_metrics": report_metrics,
            "export_format": "performance_report.json"
        }
    
    def _generate_performance_recommendations(
        self,
        bottlenecks: List[Dict[str, Any]],
        api_matrix: Dict[str, Any]
    ) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Page-level recommendations
        page_bottlenecks = [b for b in bottlenecks if b.get("type") == "page_level"]
        if page_bottlenecks:
            recommendations.append("Optimize page load performance: reduce render-blocking resources, optimize images")
        
        # Component recommendations
        component_bottlenecks = [b for b in bottlenecks if b.get("type") == "component"]
        if component_bottlenecks:
            recommendations.append("Optimize component rendering: use code splitting, lazy loading, memoization")
        
        # API recommendations
        network_bottlenecks = [b for b in bottlenecks if b.get("type") == "network"]
        if network_bottlenecks:
            recommendations.append("Optimize API endpoints: add caching, reduce payload size, use compression")
        
        # Slow endpoints
        slow_endpoints = [e for e in api_matrix.values() if e.get("avg_latency", 0) > 1000]
        if slow_endpoints:
            recommendations.append(f"Optimize {len(slow_endpoints)} slow API endpoints: consider caching or query optimization")
        
        return recommendations
    
    async def generate_auto_defects(
        self,
        action_graph: ActionGraph,
        wcag_snapshots: List[Dict[str, Any]],
        performance_snapshots: List[Dict[str, Any]],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Artifact 6: Auto Defects with OpenAI Security Report Enhancement"""
        defects = []
        
        # Step 1: Collect base defects (deterministic)
        # Check for WCAG issues exceeding threshold
        total_wcag_violations = sum(len(s.get("violations", [])) for s in wcag_snapshots)
        critical_wcag = sum(
            len([v for v in s.get("violations", []) if v.get("impact") == "critical"])
            for s in wcag_snapshots
        )
        
        if critical_wcag > 0 or total_wcag_violations > 10:
            wcag_defect = {
                "type": "accessibility",
                "title": f"WCAG Compliance Issues: {critical_wcag} critical, {total_wcag_violations} total",
                "description": f"Flowstral detected {total_wcag_violations} WCAG violations, including {critical_wcag} critical issues",
                "severity": "high" if critical_wcag > 0 else "medium",
                "category": "accessibility",
                "reproduction_steps": self._extract_reproduction_steps(action_graph),
                "action_graph_snippet": self._get_action_graph_snippet(action_graph),
                "wcag_violations": [v for s in wcag_snapshots for v in s.get("violations", [])]
            }
            defects.append(wcag_defect)
        
        # Check for performance issues
        performance_bottlenecks = [b for s in performance_snapshots for b in s.get("bottlenecks", [])]
        high_severity_bottlenecks = [b for b in performance_bottlenecks if b.get("severity") == "high"]
        
        if high_severity_bottlenecks:
            perf_defect = {
                "type": "performance",
                "title": f"Performance Issues: {len(high_severity_bottlenecks)} high-severity bottlenecks",
                "description": f"Flowstral detected {len(high_severity_bottlenecks)} high-severity performance bottlenecks",
                "severity": "high",
                "category": "performance",
                "reproduction_steps": self._extract_reproduction_steps(action_graph),
                "action_graph_snippet": self._get_action_graph_snippet(action_graph),
                "bottlenecks": high_severity_bottlenecks
            }
            defects.append(perf_defect)
        
        # Step 2: Use OpenAI to generate enhanced security report
        security_report = None
        report_metrics = None
        
        try:
            from app.services.llm.security_report_service import get_security_report_service
            security_service = get_security_report_service()
            
            logger.info("[LLM] Generating enhanced Security report with OpenAI...")
            
            # Convert action graph to dict for context
            action_graph_dict = {
                "nodes": [{"id": n.id, "url": n.url, "event_type": n.event_type} for n in action_graph.nodes[:20]],
                "edges": [{"id": e.id, "from": e.from_node_id, "to": e.to_node_id} for e in action_graph.edges[:20]]
            }
            
            result = await asyncio.wait_for(
                security_service.generate_report(
                    defects=defects,
                    action_graph=action_graph_dict,
                    timeout=30.0
                ),
                timeout=35.0
            )
            
            security_report = result.get("report", {})
            report_metrics = result.get("metrics", {})
            
            logger.info(
                f"[OK] Generated Security report "
                f"({report_metrics.get('provider', 'unknown')}, "
                f"{report_metrics.get('latency_ms', 0):.0f}ms)"
            )
            
        except Exception as e:
            logger.warning(f"LLM Security report generation failed: {e}, using base defects")
            security_report = None
        
        # Merge security report with base defects
        return {
            "type": "defects",
            "format": "auto_generated",
            "defects": defects,
            "total_count": len(defects),
            "security_report": security_report,  # LLM-generated security insights
            "findings": security_report.get("findings", []) if security_report else [],
            "recommendations": security_report.get("recommendations", []) if security_report else [],
            "compliance": security_report.get("compliance", {}) if security_report else {},
            "generation_metrics": report_metrics,
            "export_format": "defects.json"
        }
    
    def _extract_reproduction_steps(self, action_graph: ActionGraph) -> List[str]:
        """Extract reproduction steps from action graph"""
        steps = []
        for i, node in enumerate(action_graph.nodes, 1):
            if node.event_type != "session_start" and node.event_type != "session_end":
                steps.append(f"{i}. {node.action_description}")
        return steps
    
    def _get_action_graph_snippet(self, action_graph: ActionGraph) -> Dict[str, Any]:
        """Get a snippet of the action graph for defect context"""
        return {
            "total_nodes": len(action_graph.nodes),
            "total_edges": len(action_graph.edges),
            "event_types": list(set(node.event_type for node in action_graph.nodes)),
            "urls": list(set(node.url for node in action_graph.nodes if node.url))
        }

