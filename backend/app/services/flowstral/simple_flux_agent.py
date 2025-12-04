"""
Simple Flux Agent - Robust Script Generator
Based on how professional tools work: simple, reliable, just works.

No complex logic, no 10 fallback strategies, just:
1. Generate good selector at capture time
2. Use it directly
3. Simple wait + click
4. Done
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.automation.simple_selector_engine import get_simple_selector_engine

logger = logging.getLogger(__name__)


class SimpleFluxAgent:
    """
    Simple, robust script generator.
    Generates Playwright scripts that just work.
    """
    
    def __init__(self):
        self.selector_engine = get_simple_selector_engine()
    
    async def generate_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate simple, reliable Playwright script.
        """
        logger.info(f"[SIMPLE-FLUX] Generating script from {len(action_graph.nodes)} nodes")
        
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        # Get initial URL
        initial_url = None
        if action_graph.nodes:
            for node in action_graph.nodes:
                # Try multiple ways to get URL (node might be dict or object)
                url = None
                if hasattr(node, 'url'):
                    url = node.url
                elif isinstance(node, dict):
                    url = node.get('url')
                else:
                    url = getattr(node, 'url', None)
                
                if url:
                    initial_url = url
                    break
        
        if initial_url:
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
        else:
            script_lines.append("  // TODO: Add initial URL")
        
        script_lines.append("")
        
        # Process nodes - only meaningful actions with deduplication
        meaningful_events = ["click", "input", "select", "navigate"]
        processed_actions = []  # Track (event_type, selector) to avoid duplicates
        processed_count = 0
        
        for node in action_graph.nodes:
            # Get event_type - handle both object and dict
            event_type = None
            if hasattr(node, 'event_type'):
                event_type = node.event_type
            elif isinstance(node, dict):
                event_type = node.get('event_type')
            else:
                event_type = getattr(node, 'event_type', None)
            
            if not event_type or event_type not in meaningful_events:
                continue
            
            # Create unique key for deduplication
            target_selector = getattr(node, 'target_selector', None) or (node.get('target_selector') if isinstance(node, dict) else "")
            target_text = getattr(node, 'target_text', None) or (node.get('target_text') if isinstance(node, dict) else "")
            action_key = (event_type, target_selector, target_text)
            
            # Skip if we've seen this exact action recently (within last 3 actions)
            if action_key in processed_actions[-3:]:
                logger.debug(f"[SIMPLE-FLUX] Skipping duplicate action: {node.event_type} on {node.target_selector}")
                continue
            
            # Generate action code
            try:
                action_code = self._generate_action_code(node)
                if action_code:
                    script_lines.extend(action_code)
                    script_lines.append("")
                    processed_actions.append(action_key)
                    processed_count += 1
            except Exception as e:
                logger.warning(f"[SIMPLE-FLUX] Failed to generate code for node {node.id}: {e}")
                continue
        
        script_lines.append("});")
        
        script = "\n".join(script_lines)
        
        logger.info(f"[SIMPLE-FLUX] Generated script with {processed_count} actions")
        
        return {
            "script": script,
            "action_count": processed_count,
            "total_nodes": len(action_graph.nodes)
        }
    
    def _generate_action_code(self, node: Any) -> List[str]:
        """Generate simple action code for a node"""
        code_lines = []
        
        # Get element data from node metadata or construct from node properties
        element_data = {}
        if hasattr(node, 'metadata') and node.metadata:
            interacted_element = node.metadata.get("interacted_element") or (node.metadata.get("event_data", {}) or {}).get("interacted_element")
            if isinstance(interacted_element, dict):
                element_data = interacted_element
        
        # If no element_data, construct from node properties
        if not element_data:
            element_data = {
                "tag_name": self._infer_tag_from_selector(getattr(node, 'target_selector', None)),
                "text_content": getattr(node, 'target_text', None),
                "id": self._extract_id_from_selector(getattr(node, 'target_selector', None)),
                "name": self._extract_name_from_selector(getattr(node, 'target_selector', None)),
            }
        
        # Generate selector using simple engine
        # If we have a playwright_locator in metadata, use it directly (generated at capture time)
        playwright_locator = None
        if hasattr(node, 'metadata') and node.metadata:
            playwright_locator = node.metadata.get("playwright_locator")
        
        # Also check target_selector - it might already be a playwright locator
        target_selector = getattr(node, 'target_selector', None)
        if target_selector and ("getByRole" in target_selector or "getByText" in target_selector or "getByTestId" in target_selector or "locator(" in target_selector):
            selector_code = target_selector
            logger.debug(f"[SIMPLE-FLUX] Using target_selector as playwright locator: {selector_code}")
        elif playwright_locator:
            selector_code = playwright_locator
            logger.debug(f"[SIMPLE-FLUX] Using captured playwright_locator: {playwright_locator}")
        else:
            try:
                selector_code = self.selector_engine.generate_selector(element_data)
                logger.debug(f"[SIMPLE-FLUX] Generated new selector: {selector_code}")
            except Exception as e:
                logger.warning(f"[SIMPLE-FLUX] Selector engine failed, using fallback: {e}")
                # Fallback to simple CSS selector or ID
                if target_selector:
                    selector_code = f"page.locator('{target_selector}')"
                else:
                    return []  # Can't generate code without selector
        
        event_type = getattr(node, 'event_type', 'unknown')
        target_text = getattr(node, 'target_text', None)
        target_selector = getattr(node, 'target_selector', None)
        url = getattr(node, 'url', None)
        
        if event_type == "navigate":
            if url:
                code_lines.append(f"  // Navigate to: {url}")
                code_lines.append(f"  await page.goto('{url}');")
                code_lines.append(f"  await page.waitForLoadState('networkidle');")
        
        elif event_type == "click":
            # Simple click - Playwright handles everything
            comment = target_text or target_selector or "element"
            code_lines.append(f"  // Click: {comment}")
            code_lines.append(f"  await {selector_code}.waitFor({{ state: 'visible', timeout: 10000 }});")
            code_lines.append(f"  await {selector_code}.click();")
            code_lines.append(f"  await page.waitForTimeout(500); // Brief pause")
        
        elif event_type == "input":
            # Get value from metadata
            value = None
            if hasattr(node, 'metadata') and node.metadata:
                value = node.metadata.get("value")
            if not value and element_data:
                value = element_data.get("value")
            
            if value and value != "***MASKED***":
                escaped_value = str(value).replace("'", "\\'").replace("\n", "\\n")
                code_lines.append(f"  // Fill: {escaped_value[:30]}")
                code_lines.append(f"  await {selector_code}.fill('{escaped_value}');")
                code_lines.append(f"  await page.waitForTimeout(300); // Brief pause")
            else:
                # Masked value - use placeholder
                code_lines.append(f"  // Fill: [masked value]")
                code_lines.append(f"  await {selector_code}.fill('TEST_VALUE');")
                code_lines.append(f"  await page.waitForTimeout(300); // Brief pause")
        
        elif event_type == "select":
            value = None
            if hasattr(node, 'metadata') and node.metadata:
                value = node.metadata.get("value")
            if not value and element_data:
                value = element_data.get("value")
            
            if value:
                escaped_value = str(value).replace("'", "\\'")
                code_lines.append(f"  // Select: {escaped_value}")
                code_lines.append(f"  await {selector_code}.selectOption('{escaped_value}');")
                code_lines.append(f"  await page.waitForTimeout(300); // Brief pause")
        
        return code_lines
    
    def _infer_tag_from_selector(self, selector: Optional[str]) -> str:
        """Infer tag name from selector"""
        if not selector:
            return "div"
        
        # Check for common patterns
        if "button" in selector.lower() or "getByRole('button'" in selector:
            return "button"
        if "link" in selector.lower() or "getByRole('link'" in selector or "getByText" in selector:
            return "a"
        if "input" in selector.lower():
            return "input"
        if "select" in selector.lower():
            return "select"
        
        return "div"
    
    def _extract_id_from_selector(self, selector: Optional[str]) -> Optional[str]:
        """Extract ID from selector"""
        if not selector:
            return None
        
        import re
        # Match #id or [id="..."]
        id_match = re.search(r'#([a-zA-Z][\w-]*)', selector)
        if id_match:
            return id_match.group(1)
        
        id_match = re.search(r'\[id=["\']([^"\']+)["\']', selector)
        if id_match:
            return id_match.group(1)
        
        return None
    
    def _extract_name_from_selector(self, selector: Optional[str]) -> Optional[str]:
        """Extract name from selector"""
        if not selector:
            return None
        
        import re
        name_match = re.search(r'\[name=["\']([^"\']+)["\']', selector)
        if name_match:
            return name_match.group(1)
        
        return None


# Global instance
_simple_flux = None

def get_simple_flux_agent() -> SimpleFluxAgent:
    """Get or create global SimpleFluxAgent instance"""
    global _simple_flux
    if _simple_flux is None:
        _simple_flux = SimpleFluxAgent()
    return _simple_flux

