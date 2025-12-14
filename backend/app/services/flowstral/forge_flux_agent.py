"""
Forge Flux Agent - Production-Grade Minimal Script Generator
Based on Forge v2 principles: Trust Playwright, heal only when needed.

Golden Rules:
1. Generate <60 lines per flow
2. Use only getBy* queries (getByRole, getByTestId, etc.)
3. Add tiny heal() wrapper that only triggers on failure
4. Store intent, not just selectors
5. Generation time: <4 seconds
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.automation.forge_selector_engine import get_forge_selector_engine

logger = logging.getLogger(__name__)


class ForgeFluxAgent:
    """
    Minimal, production-grade script generator.
    
    Follows Forge v2 principles:
    - Trust Playwright first
    - Max 2 candidates (primary + one fallback)
    - Tiny heal() wrapper for runtime healing
    - Intent-preserving
    - Fast (<4s generation)
    """
    
    def __init__(self):
        self.selector_engine = get_forge_selector_engine()
    
    async def generate_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate minimal, production-grade Playwright script.
        
        Returns:
            {
                "script": "...",
                "action_count": 5,
                "generation_time_ms": 1800,
                "intents": [...]
            }
        """
        start_time = datetime.now()
        
        logger.info(f"[FORGE] Generating script from {len(action_graph.nodes)} nodes")
        
        # Generate heal wrapper (tiny, only triggers on failure)
        heal_wrapper = self._generate_heal_wrapper()
        
        # Generate test script
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            heal_wrapper,
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
        # CRITICAL: Normalize event types - coalescer generates "click_button", "fill_field", "unknown"
        meaningful_events = ["click", "click_button", "input", "type", "fill_field", "select", "navigate", "unknown"]
        processed_actions = []  # Track (event_type, selector) to avoid duplicates
        processed_count = 0
        intents = []
        
        for node in action_graph.nodes:
            # Get event_type - handle both object and dict
            event_type = None
            if hasattr(node, 'event_type'):
                event_type = node.event_type
            elif isinstance(node, dict):
                event_type = node.get('event_type')
            else:
                event_type = getattr(node, 'event_type', None)
            
            if not event_type:
                continue
            
            # Normalize event type (coalescer generates click_button, fill_field, unknown)
            normalized_event_type = event_type
            if event_type == "click_button":
                normalized_event_type = "click"
            elif event_type == "fill_field":
                normalized_event_type = "input"
            elif event_type == "unknown":
                # Try to infer from action_description or metadata
                action_desc = None
                if hasattr(node, 'action_description'):
                    action_desc = node.action_description
                elif isinstance(node, dict):
                    action_desc = node.get('action_description')
                else:
                    action_desc = getattr(node, 'action_description', None)
                
                if action_desc:
                    action_lower = action_desc.lower()
                    if "click" in action_lower or "button" in action_lower:
                        normalized_event_type = "click"
                    elif "fill" in action_lower or "input" in action_lower or "type" in action_lower:
                        normalized_event_type = "input"
                    else:
                        # Default to click for unknown
                        normalized_event_type = "click"
                else:
                    # Default to click for unknown
                    normalized_event_type = "click"
            
            # Check if normalized event type is meaningful
            if normalized_event_type not in ["click", "input", "select", "navigate"]:
                logger.debug(f"[FORGE] Skipping event type: {event_type} (normalized: {normalized_event_type})")
                continue
            
            # Use normalized event type for processing
            event_type = normalized_event_type
            
            # Create unique key for deduplication
            target_selector = getattr(node, 'target_selector', None) or (node.get('target_selector') if isinstance(node, dict) else "")
            target_text = getattr(node, 'target_text', None) or (node.get('target_text') if isinstance(node, dict) else "")
            action_key = (event_type, target_selector, target_text)
            
            # Skip if we've seen this exact action recently (within last 3 actions)
            if action_key in processed_actions[-3:]:
                logger.debug(f"[FORGE] Skipping duplicate action: {node.event_type}")
                continue
            
            # Generate action code (pass normalized event_type)
            try:
                # Temporarily set normalized event_type on node for _generate_action_code
                original_event_type = None
                if hasattr(node, 'event_type'):
                    original_event_type = node.event_type
                    node.event_type = normalized_event_type
                elif isinstance(node, dict):
                    original_event_type = node.get('event_type')
                    node['event_type'] = normalized_event_type
                
                action_code, intent = self._generate_action_code(node)
                
                # Restore original event_type
                if original_event_type is not None:
                    if hasattr(node, 'event_type'):
                        node.event_type = original_event_type
                    elif isinstance(node, dict):
                        node['event_type'] = original_event_type
                
                if action_code:
                    script_lines.extend(action_code)
                    script_lines.append("")
                    processed_actions.append(action_key)
                    processed_count += 1
                    if intent:
                        intents.append(intent)
            except Exception as e:
                logger.warning(f"[FORGE] Failed to generate code for node: {e}")
                continue
        
        script_lines.append("});")
        
        script = "\n".join(script_lines)
        
        generation_time = (datetime.now() - start_time).total_seconds() * 1000
        
        logger.info(f"[FORGE] Generated script: {processed_count} actions, {generation_time:.0f}ms")
        
        return {
            "script": script,
            "action_count": processed_count,
            "total_nodes": len(action_graph.nodes),
            "generation_time_ms": generation_time,
            "intents": intents
        }
    
    def _generate_heal_wrapper(self) -> str:
        """Generate tiny heal() wrapper that only triggers on failure"""
        return """// Tiny heal wrapper - only triggers when Playwright actually fails
async function clickRobust(locator, intent) {
  try {
    await locator.click({ timeout: 8000 });
  } catch (e) {
    console.warn(`Healing click for: ${intent}`);
    // TODO: Call self-healing service with DOM snapshot + screenshot
    // For now, just retry with force
    await locator.click({ timeout: 8000, force: true });
  }
}

async function fillRobust(locator, value, intent) {
  try {
    await locator.fill(value, { timeout: 8000 });
  } catch (e) {
    console.warn(`Healing fill for: ${intent}`);
    await locator.fill(value, { timeout: 8000, force: true });
  }
}"""
    
    def _generate_action_code(self, node: Any) -> Tuple[List[str], Optional[str]]:
        """
        Generate minimal action code for a node.
        
        Returns:
            (code_lines, intent)
        """
        code_lines = []
        intent = None
        
        # Get element data
        element_data = {}
        if hasattr(node, 'metadata') and node.metadata:
            interacted_element = node.metadata.get("interacted_element")
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
        
        # Generate selector using Forge engine
        event_type = getattr(node, 'event_type', 'unknown')
        target_text = getattr(node, 'target_text', None)
        
        # Infer intent
        intent = f"{event_type}: {target_text or getattr(node, 'target_selector', 'element')}"
        
        # Get selector result
        try:
            selector_result = self.selector_engine.generate_selector(element_data, intent=intent)
            primary = selector_result.get("primary") or selector_result.get("selector")
            fallback = selector_result.get("fallback")
            intent = selector_result.get("intent", intent)
            
            # CRITICAL: If no selector generated, create a basic one from target_text or target_selector
            if not primary:
                if target_text:
                    # Use getByText as fallback (fix f-string backslash issue)
                    escaped_text = target_text.replace("'", "\\'")
                    primary = f"page.getByText('{escaped_text}')"
                elif getattr(node, 'target_selector', None):
                    # Use target_selector directly
                    primary = f"page.locator('{getattr(node, 'target_selector')}')"
                else:
                    logger.warning(f"[FORGE] No selector generated for {event_type} - skipping")
                    return [], None
        except Exception as e:
            logger.warning(f"[FORGE] Selector generation failed: {e} - using fallback")
            # Fallback to basic selector
            if target_text:
                primary = f"page.getByText('{target_text.replace(\"'\", \"\\'\")}')"
            elif getattr(node, 'target_selector', None):
                primary = f"page.locator('{getattr(node, 'target_selector')}')"
            else:
                return [], None
        
        if event_type == "navigate":
            url = getattr(node, 'url', None)
            if url:
                code_lines.append(f"  // Navigate to: {url}")
                code_lines.append(f"  await page.goto('{url}');")
                code_lines.append(f"  await page.waitForLoadState('networkidle');")
        
        elif event_type == "click":
            # Use clickRobust wrapper (heals on failure)
            # NO fixed waits - Playwright auto-waits for element to be ready
            code_lines.append(f"  // {intent}")
            if fallback:
                # Use primary, with fallback in comment
                code_lines.append(f"  await clickRobust({primary}, '{intent}');")
                code_lines.append(f"  // Fallback: {fallback}")
            else:
                code_lines.append(f"  await clickRobust({primary}, '{intent}');")
            # Removed fixed wait - Playwright's auto-waiting handles timing
        
        elif event_type == "input":
            # Get value from metadata
            value = None
            if hasattr(node, 'metadata') and node.metadata:
                value = node.metadata.get("value")
            if not value and element_data:
                value = element_data.get("value")
            
            if value and value != "***MASKED***":
                escaped_value = str(value).replace("'", "\\'").replace("\n", "\\n")
                code_lines.append(f"  // {intent}")
                if fallback:
                    code_lines.append(f"  await fillRobust({primary}, '{escaped_value}', '{intent}');")
                    code_lines.append(f"  // Fallback: {fallback}")
                else:
                    code_lines.append(f"  await fillRobust({primary}, '{escaped_value}', '{intent}');")
                # Removed fixed wait - Playwright's auto-waiting handles timing
            else:
                code_lines.append(f"  // {intent} [masked]")
                code_lines.append(f"  await fillRobust({primary}, 'TEST_VALUE', '{intent}');")
                code_lines.append(f"  await page.waitForTimeout(200); // Brief pause")
        
        elif event_type == "select":
            value = None
            if hasattr(node, 'metadata') and node.metadata:
                value = node.metadata.get("value")
            if not value and element_data:
                value = element_data.get("value")
            
            if value:
                escaped_value = str(value).replace("'", "\\'")
                code_lines.append(f"  // {intent}")
                # Playwright auto-waits, but we keep timeout for explicit control
                code_lines.append(f"  await {primary}.selectOption('{escaped_value}');")
                # Removed fixed wait - Playwright's auto-waiting handles timing
        
        return code_lines, intent
    
    def _infer_tag_from_selector(self, selector: Optional[str]) -> str:
        """Infer tag name from selector"""
        if not selector:
            return "div"
        
        if "button" in selector.lower() or "getByRole('button'" in selector:
            return "button"
        if "link" in selector.lower() or "getByRole('link'" in selector:
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
_forge_flux = None

def get_forge_flux_agent() -> ForgeFluxAgent:
    """Get or create global ForgeFluxAgent instance"""
    global _forge_flux
    if _forge_flux is None:
        _forge_flux = ForgeFluxAgent()
    return _forge_flux

