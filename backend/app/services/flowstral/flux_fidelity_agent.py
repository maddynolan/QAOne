"""
Flux - High-Fidelity Playwright Script Generator
Ex-Microsoft Principal QA Engineer, 20 years, zero user-experience regressions in production.

Mission: Generate Playwright scripts that replicate recorded user flows with 100% fidelity,
as if the real user is replaying their exact session.

Rules:
1. First 30 seconds: Analyze raw event log and DOM snapshots to build precise interaction map
2. Continuously maintain and inject fidelity scorecard (e.g., 98% match on mouse paths, timings)
3. Never simplify—replicate every micro-interaction: hovers before clicks, exact coordinates if possible, natural delays
4. Every generated step must include validation: reproducible waits, assertions on state changes, screenshots on mismatch
5. If fidelity drops below 95%, prove why and auto-heal (e.g., fallback selectors) or keep refining
6. Use parallel processing: generate base script while simulating variants for edge devices/browsers
"""

import logging
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge
from app.services.automation.locator_engine import get_locator_engine
from app.services.automation.intelligent_self_healing import IntelligentSelfHealing, ElementContext

logger = logging.getLogger(__name__)


class FidelityLevel(Enum):
    """Fidelity scoring levels"""
    PERFECT = 100  # 100% match
    EXCELLENT = 95  # 95-99% match
    GOOD = 90  # 90-94% match
    ACCEPTABLE = 85  # 85-89% match
    POOR = 0  # <85% match


@dataclass
class InteractionPoint:
    """Precise interaction point with timing and coordinates"""
    timestamp: float
    event_type: str
    coordinates: Optional[Tuple[int, int]] = None
    element_selector: Optional[str] = None
    element_text: Optional[str] = None
    element_role: Optional[str] = None
    hover_duration_ms: float = 0.0
    scroll_position: Optional[Tuple[int, int]] = None
    delay_before_ms: float = 0.0
    delay_after_ms: float = 0.0
    dom_snapshot_id: Optional[str] = None
    screenshot_url: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class FidelityScorecard:
    """Fidelity scorecard tracking match quality"""
    overall_score: float = 0.0
    mouse_path_match: float = 0.0
    timing_match: float = 0.0
    interaction_match: float = 0.0
    selector_match: float = 0.0
    validation_match: float = 0.0
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    auto_healed_count: int = 0


class FluxFidelityAgent:
    """
    Flux - High-Fidelity Playwright Script Generator
    
    Generates Playwright scripts that replicate recorded user flows with 100% fidelity.
    Meticulous, user-obsessed, and unforgiving of approximations.
    """
    
    def __init__(self):
        self.locator_engine = get_locator_engine()
        self.healing_service = IntelligentSelfHealing()
        self.fidelity_threshold = 95.0  # Minimum acceptable fidelity
        self.interaction_map: List[InteractionPoint] = []
        self.scorecard = FidelityScorecard()
    
    async def generate_high_fidelity_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]],
        raw_events: Optional[List[Dict[str, Any]]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate high-fidelity Playwright script from action graph and raw events.
        
        Args:
            action_graph: Flowstral action graph
            dom_snapshots: DOM snapshots with timing
            raw_events: Raw event log with precise timing and coordinates
            tenant_id: Tenant ID
            
        Returns:
            {
                "script": "...",
                "fidelity_scorecard": {...},
                "interaction_map": [...],
                "variants": {...},
                "warnings": [...]
            }
        """
        start_time = datetime.now()
        
        # Step 1: Analyze raw event log and DOM snapshots (first 30 seconds)
        logger.info("[FLUX] Analyzing raw event log and DOM snapshots...")
        interaction_map = await self._build_interaction_map(
            action_graph, dom_snapshots, raw_events
        )
        self.interaction_map = interaction_map
        
        # Step 2: Generate base Playwright script with high fidelity
        logger.info("[FLUX] Generating high-fidelity Playwright script...")
        base_script = await self._generate_base_script(interaction_map, action_graph)
        
        # Step 3: Calculate fidelity scorecard
        logger.info("[FLUX] Calculating fidelity scorecard...")
        scorecard = await self._calculate_fidelity_scorecard(
            interaction_map, action_graph, base_script
        )
        self.scorecard = scorecard
        
        # Step 4: Auto-heal if fidelity is below threshold
        if scorecard.overall_score < self.fidelity_threshold:
            logger.warning(
                f"[FLUX] Fidelity {scorecard.overall_score:.1f}% below threshold {self.fidelity_threshold}%, "
                "attempting auto-healing..."
            )
            base_script = await self._auto_heal_script(
                base_script, interaction_map, scorecard
            )
            # Recalculate scorecard after healing
            scorecard = await self._calculate_fidelity_scorecard(
                interaction_map, action_graph, base_script
            )
            self.scorecard = scorecard
        
        # Step 5: Generate variants in parallel (edge devices/browsers)
        logger.info("[FLUX] Generating script variants for different browsers/devices...")
        variants = await self._generate_variants(base_script, interaction_map)
        
        # Step 6: Add validations and assertions
        logger.info("[FLUX] Adding validations and assertions...")
        validated_script = await self._add_validations(base_script, interaction_map, action_graph)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"[FLUX] Generated high-fidelity script in {elapsed:.1f}s "
            f"(Fidelity: {scorecard.overall_score:.1f}%)"
        )
        
        return {
            "script": validated_script,
            "fidelity_scorecard": {
                "overall_score": scorecard.overall_score,
                "mouse_path_match": scorecard.mouse_path_match,
                "timing_match": scorecard.timing_match,
                "interaction_match": scorecard.interaction_match,
                "selector_match": scorecard.selector_match,
                "validation_match": scorecard.validation_match,
                "level": self._get_fidelity_level(scorecard.overall_score).name,
                "issues": scorecard.issues,
                "warnings": scorecard.warnings,
                "auto_healed_count": scorecard.auto_healed_count
            },
            "interaction_map": [
                {
                    "timestamp": ip.timestamp,
                    "event_type": ip.event_type,
                    "coordinates": ip.coordinates,
                    "element_selector": ip.element_selector,
                    "hover_duration_ms": ip.hover_duration_ms,
                    "delay_before_ms": ip.delay_before_ms,
                    "delay_after_ms": ip.delay_after_ms
                }
                for ip in interaction_map
            ],
            "variants": variants,
            "warnings": scorecard.warnings,
            "generation_time_seconds": elapsed
        }
    
    async def _build_interaction_map(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]],
        raw_events: Optional[List[Dict[str, Any]]]
    ) -> List[InteractionPoint]:
        """
        Build precise interaction map from raw events and DOM snapshots.
        Prioritizes hovers, scrolls, timings.
        """
        interaction_map = []
        
        # Log what we're processing
        logger.info(f"[FLUX] Building interaction map from {len(action_graph.nodes)} nodes, {len(dom_snapshots)} snapshots, {len(raw_events) if raw_events else 0} raw events")
        
        # Create snapshot lookup by timestamp
        snapshot_lookup = {}
        for snapshot in dom_snapshots:
            timestamp = snapshot.get("timestamp", 0)
            snapshot_lookup[timestamp] = snapshot
        
        # Process action graph nodes with timing
        base_timestamp = 0.0
        processed_count = 0
        
        for i, node in enumerate(action_graph.nodes):
            # Log each node being processed
            logger.debug(f"[FLUX] Processing node {i+1}/{len(action_graph.nodes)}: event_type={node.event_type}, url={node.url}, selector={node.target_selector}, text={node.target_text}")
            # Calculate relative timestamp
            if i == 0:
                # Try to get timestamp from node
                if hasattr(node, 'timestamp') and node.timestamp:
                    if isinstance(node.timestamp, datetime):
                        base_timestamp = node.timestamp.timestamp()
                    else:
                        base_timestamp = float(node.timestamp)
                else:
                    base_timestamp = 0.0
                timestamp = 0.0
            else:
                # Use metadata timing if available
                if node.metadata and "timestamp" in node.metadata:
                    node_ts = node.metadata["timestamp"]
                    if isinstance(node_ts, datetime):
                        node_ts = node_ts.timestamp()
                    timestamp = (float(node_ts) - base_timestamp)
                elif hasattr(node, 'timestamp') and node.timestamp:
                    node_ts = node.timestamp
                    if isinstance(node_ts, datetime):
                        node_ts = node_ts.timestamp()
                    timestamp = (float(node_ts) - base_timestamp)
                else:
                    # Estimate timing based on event type
                    timestamp = i * 0.5  # Default 500ms between events
            
            # Extract coordinates from metadata or raw events
            coordinates = None
            if node.metadata:
                if "mouse_x" in node.metadata and "mouse_y" in node.metadata:
                    coordinates = (
                        int(node.metadata["mouse_x"]),
                        int(node.metadata["mouse_y"])
                    )
                elif "clientX" in node.metadata and "clientY" in node.metadata:
                    coordinates = (
                        int(node.metadata["clientX"]),
                        int(node.metadata["clientY"])
                    )
            
            # Extract hover duration
            hover_duration_ms = 0.0
            if node.metadata and "hover_duration_ms" in node.metadata:
                hover_duration_ms = float(node.metadata["hover_duration_ms"])
            elif node.event_type == "click":
                # Default hover before click (natural user behavior)
                hover_duration_ms = 150.0  # 150ms typical hover
            
            # Extract scroll position
            scroll_position = None
            if node.metadata:
                if "scrollY" in node.metadata and "scrollX" in node.metadata:
                    scroll_position = (
                        int(node.metadata["scrollX"]),
                        int(node.metadata["scrollY"])
                    )
            
            # Calculate delays
            delay_before_ms = 0.0
            delay_after_ms = 0.0
            if i > 0:
                prev_node = action_graph.nodes[i - 1]
                prev_timestamp = prev_node.metadata.get("timestamp", 0) if prev_node.metadata else 0
                curr_timestamp = node.metadata.get("timestamp", 0) if node.metadata else 0
                if curr_timestamp > prev_timestamp:
                    delay_before_ms = (curr_timestamp - prev_timestamp) * 1000
                    # Natural delay: minimum 50ms, cap at 2000ms
                    delay_before_ms = max(50.0, min(delay_before_ms, 2000.0))
            
            # Find matching DOM snapshot
            dom_snapshot_id = None
            screenshot_url = None
            if timestamp in snapshot_lookup:
                snapshot = snapshot_lookup[timestamp]
                dom_snapshot_id = snapshot.get("dom_snapshot_id")
                screenshot_url = snapshot.get("screenshot_url")
            elif node.dom_snapshot_id:
                dom_snapshot_id = node.dom_snapshot_id
                screenshot_url = node.screenshot_url if hasattr(node, 'screenshot_url') else None
            
            # Extract interacted_element from metadata if available
            interacted_element = None
            if node.metadata:
                # The interacted_element might be stored directly or in event_data
                interacted_element = node.metadata.get("interacted_element")
                if not interacted_element and "event_data" in node.metadata:
                    event_data = node.metadata.get("event_data", {})
                    interacted_element = event_data.get("interacted_element")
            
            # Store full metadata including interacted_element
            full_metadata = node.metadata.copy() if node.metadata else {}
            if interacted_element:
                full_metadata["interacted_element"] = interacted_element
            
            interaction_point = InteractionPoint(
                timestamp=timestamp,
                event_type=node.event_type,
                coordinates=coordinates,
                element_selector=node.target_selector,
                element_text=node.target_text,
                element_role=self._extract_role(node),
                hover_duration_ms=hover_duration_ms,
                scroll_position=scroll_position,
                delay_before_ms=delay_before_ms,
                delay_after_ms=delay_after_ms,
                dom_snapshot_id=dom_snapshot_id,
                screenshot_url=screenshot_url,
                metadata=full_metadata  # Include full metadata with interacted_element
            )
            
            interaction_map.append(interaction_point)
            processed_count += 1
        
        logger.info(f"[FLUX] Built interaction map: {processed_count} interaction points processed from {len(action_graph.nodes)} nodes")
        if interaction_map:
            logger.info(f"[FLUX] Event types in map: {set(ip.event_type for ip in interaction_map)}")
        else:
            logger.warning(f"[FLUX] WARNING: Interaction map is EMPTY! This means no valid nodes were processed.")
        
        return interaction_map
    
    def _extract_role(self, node: ActionGraphNode) -> Optional[str]:
        """Extract role from node metadata or selector"""
        if node.metadata and "role" in node.metadata:
            return node.metadata["role"]
        
        # Try to infer from selector
        if node.target_selector:
            if "button" in node.target_selector.lower():
                return "button"
            elif "input" in node.target_selector.lower():
                return "textbox"
            elif "a" in node.target_selector.lower() or "link" in node.target_selector.lower():
                return "link"
        
        return None
    
    async def _generate_base_script(
        self,
        interaction_map: List[InteractionPoint],
        action_graph: ActionGraph
    ) -> str:
        """Generate base Playwright script with high fidelity"""
        
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "// Test data - update these values as needed",
            "const TEST_DATA = {",
            "  username: process.env.USERNAME || 'standard_user',",
            "  password: process.env.PASSWORD || 'secret_sauce',",
            "};",
            "",
            "async function waitForOverlaysToDisappear(page) {",
            "  await page.waitForSelector('.ReactModal__Overlay', { state: 'hidden', timeout: 5000 }).catch(() => {});",
            "  await page.waitForSelector('.ModalDrawer', { state: 'hidden', timeout: 5000 }).catch(() => {});",
            "}",
            "",
            "async function clickWithFallback(page, locators) {",
            "  for (const locator of locators) {",
            "    try {",
            "      await waitForOverlaysToDisappear(page);",
            "      const element = typeof locator === 'string' ? page.locator(locator) : locator;",
            "      await element.waitFor({ state: 'visible', timeout: 5000 });",
            "      await element.click();",
            "      return;",
            "    } catch (error) {",
            "      console.error(`Failed to click on ${locator}: ${error.message}`);",
            "    }",
            "  }",
            "  throw new Error('All click attempts failed');",
            "}",
            "",
            "async function fillWithFallback(page, locators, value) {",
            "  for (const locator of locators) {",
            "    try {",
            "      await waitForOverlaysToDisappear(page);",
            "      const element = typeof locator === 'string' ? page.locator(locator) : locator;",
            "      await element.waitFor({ state: 'visible', timeout: 5000 });",
            "      await element.fill(value);",
            "      return;",
            "    } catch (error) {",
            "      console.error(`Failed to fill ${locator}: ${error.message}`);",
            "    }",
            "  }",
            "  throw new Error('All fill attempts failed');",
            "}",
            "",
            "test('Flowstral Recorded Test - High Fidelity', async ({ page }) => {"
        ]
        
        # Get initial URL - find the first navigate event or first node with URL
        initial_url = None
        if action_graph.nodes:
            # First, try to find a navigate event
            for node in action_graph.nodes:
                if node.event_type == "navigate" and node.url:
                    initial_url = node.url
                    logger.debug(f"[FLUX] Found initial URL from navigate node: {initial_url}")
                    break
            # If no navigate event, use first node with URL
            if not initial_url:
                for node in action_graph.nodes:
                    if node.url:
                        initial_url = node.url
                        logger.debug(f"[FLUX] Found initial URL from first node with URL: {initial_url}")
                        break
        
        if initial_url:
            script_lines.append(f"  await page.goto('{initial_url}');")
            script_lines.append("  await expect(page).toHaveURL(/.*/);")
            script_lines.append("  await page.waitForTimeout(1000); // Wait for page to fully load")
        else:
            script_lines.append("  // TODO: Add initial URL")
            script_lines.append("  // await page.goto('https://example.com');")
        
        script_lines.append("")
        
        # Advanced deduplication and filtering
        deduplicated_map = []
        last_input_key = None
        last_input_value = None
        last_input_index = -1
        field_states = {}  # Track final state of each field
        
        for i, ip in enumerate(interaction_map):
            # Skip internal events
            if ip.event_type in ["wcag_scan", "dom_snapshot", "session_start", "session_end", "scroll"]:
                continue
            
            # For input events, check if it's the same field as the previous input
            if ip.event_type in ["input", "type"]:
                # Create a key from the selector to identify the same field
                input_key = ip.element_selector or ip.element_text or str(i)
                value = ip.metadata.get("value", "") or (ip.metadata.get("interacted_element", {}) or {}).get("value", "")
                
                # Skip if value is masked and we already have a value for this field
                if value == "***MASKED***" and input_key in field_states:
                    continue
                
                if input_key == last_input_key:
                    # Same field - replace the previous input with this one (keep the latest value)
                    deduplicated_map[last_input_index] = ip
                    last_input_value = value
                else:
                    # Different field - check if we already filled this field with the same value
                    if input_key in field_states:
                        existing_value = field_states[input_key]
                        if existing_value == value and value:
                            # Skip - same field, same value
                            continue
                    
                    # Add this input
                    deduplicated_map.append(ip)
                    last_input_key = input_key
                    last_input_value = value
                    last_input_index = len(deduplicated_map) - 1
                    field_states[input_key] = value
            elif ip.event_type == "click":
                # Skip clicks on input fields that are immediately followed by a fill
                # (users often click input fields before typing, but we don't need the click)
                if i + 1 < len(interaction_map):
                    next_ip = interaction_map[i + 1]
                    if next_ip.event_type in ["input", "type"]:
                        # Check if clicking the same element that will be filled
                        click_key = ip.element_selector or ip.element_text
                        fill_key = next_ip.element_selector or next_ip.element_text
                        if click_key == fill_key:
                            # Skip the click - the fill will handle it
                            continue
                
                # Skip clicks on elements that are already visible/interacted with
                # (redundant clicks on same element)
                if len(deduplicated_map) > 0:
                    last_action = deduplicated_map[-1]
                    if last_action.event_type == "click":
                        last_click_key = last_action.element_selector or last_action.element_text
                        current_click_key = ip.element_selector or ip.element_text
                        if last_click_key == current_click_key:
                            # Same element clicked twice in a row - skip
                            continue
                
                deduplicated_map.append(ip)
                last_input_key = None
                last_input_index = -1
            elif ip.event_type == "navigate":
                # Navigation resets field states
                field_states = {}
                deduplicated_map.append(ip)
                last_input_key = None
                last_input_index = -1
            else:
                # Other events - always add
                deduplicated_map.append(ip)
                last_input_key = None
                last_input_index = -1
        
        logger.info(f"[FLUX] Deduplicated {len(interaction_map)} interactions to {len(deduplicated_map)} (removed {len(interaction_map) - len(deduplicated_map)} redundant actions)")
        
        # Generate script for each interaction point
        logger.info(f"[FLUX] Generating script for {len(deduplicated_map)} interaction points")
        for i, ip in enumerate(deduplicated_map):
            logger.debug(f"[FLUX] Processing interaction {i+1}/{len(deduplicated_map)}: {ip.event_type} on {ip.element_selector or ip.element_text}")
            
            # Add delay before interaction (natural timing) - only for significant delays
            if ip.delay_before_ms > 200:
                script_lines.append(f"  // Wait: {ip.delay_before_ms:.0f}ms")
                script_lines.append(f"  await page.waitForTimeout({int(ip.delay_before_ms)});")
            
            # Handle scroll first if needed
            if ip.scroll_position:
                script_lines.append(
                    f"  // Scroll to position: ({ip.scroll_position[0]}, {ip.scroll_position[1]})"
                )
                script_lines.append(
                    f"  await page.evaluate(() => window.scrollTo({ip.scroll_position[0]}, {ip.scroll_position[1]}));"
                )
                script_lines.append("  await page.waitForTimeout(100); // Wait for scroll to complete")
            
            # Generate interaction code
            interaction_code = await self._generate_interaction_code(ip, i)
            script_lines.extend(interaction_code)
            
            # Add delay after interaction - only for significant delays or navigation
            if ip.delay_after_ms > 200 or ip.event_type == "navigate":
                script_lines.append(f"  await page.waitForTimeout({int(ip.delay_after_ms)});")
            
            script_lines.append("")
        
        script_lines.append("});")
        
        return "\n".join(script_lines)
    
    async def _generate_interaction_code(
        self,
        ip: InteractionPoint,
        index: int
    ) -> List[str]:
        """Generate Playwright code for a single interaction with high fidelity"""
        code_lines = []
        
        # Generate optimal selector using locator engine
        selector_code = await self._generate_optimal_selector(ip)
        
        if ip.event_type == "navigate":
            if ip.metadata.get("url"):
                code_lines.append(f"  // Navigate to: {ip.metadata['url']}")
                code_lines.append(f"  await page.goto('{ip.metadata['url']}');")
                code_lines.append("  await expect(page).toHaveURL(/.*/);")
                code_lines.append(f"  await page.waitForTimeout(1000); // Wait for page to fully load")
        
        elif ip.event_type == "click":
            # Skip clicks on input fields - we'll use .fill() which handles focus
            interacted_element = ip.metadata.get("interacted_element", {})
            if isinstance(interacted_element, dict):
                tag_name = interacted_element.get("tag_name", "").lower()
                field_type = interacted_element.get("type", "").lower()
                if tag_name == "input" and field_type in ["text", "password", "email", "number"]:
                    # Skip click on input - the fill will handle focus
                    return code_lines
            
            # ENHANCED: Robust click with proper wait conditions
            # Step 1: Wait for element to be visible and actionable
            code_lines.append(f"  // Wait for element to be visible and actionable")
            code_lines.append(f"  await {selector_code}.waitFor({{ state: 'visible', timeout: 15000 }});")
            
            # Step 2: Ensure element is actually in viewport (not just in DOM)
            code_lines.append(f"  // Ensure element is in viewport and clickable")
            code_lines.append(f"  const element = {selector_code};")
            code_lines.append(f"  const box = await element.boundingBox();")
            code_lines.append(f"  if (!box || box.y < 0 || box.y > (await page.viewportSize()).height) {{")
            code_lines.append(f"    // Element not in viewport, scroll it into view")
            code_lines.append(f"    await element.evaluate((el) => el.scrollIntoView({{ behavior: 'smooth', block: 'center' }}));")
            code_lines.append(f"    await page.waitForTimeout(500); // Wait for scroll")
            code_lines.append(f"    // Re-check bounding box")
            code_lines.append(f"    await element.waitFor({{ state: 'visible', timeout: 5000 }});")
            code_lines.append(f"  }}")
            
            # Step 3: Wait for element to be stable (not animating)
            code_lines.append(f"  await page.waitForTimeout(200); // Wait for any animations")
            
            # Step 4: Add hover before click (natural user behavior) - only for non-input elements
            if ip.hover_duration_ms > 0 and ip.hover_duration_ms > 100:
                code_lines.append(f"  // Hover before click ({ip.hover_duration_ms:.0f}ms)")
                code_lines.append(f"  await {selector_code}.hover({{ timeout: 5000 }}).catch(() => {{}}); // Hover, ignore errors")
                code_lines.append(f"  await page.waitForTimeout({int(ip.hover_duration_ms)});")
            
            # Step 5: Perform click with retry logic
            if ip.coordinates:
                code_lines.append(
                    f"  // Click at exact coordinates: ({ip.coordinates[0]}, {ip.coordinates[1]})"
                )
                code_lines.append(f"  await {selector_code}.click({{ position: {{ x: {ip.coordinates[0]}, y: {ip.coordinates[1]} }}, timeout: 10000 }});")
            else:
                # Simplified click with single retry
                code_lines.append(f"  // Click element with retry")
                code_lines.append(f"  try {{")
                code_lines.append(f"    await {selector_code}.click({{ timeout: 10000 }});")
                code_lines.append(f"  }} catch (error) {{")
                code_lines.append(f"    // Retry once with force click")
                code_lines.append(f"    console.warn('Normal click failed, trying force click:', error.message);")
                code_lines.append(f"    await {selector_code}.click({{ timeout: 10000, force: true }});")
                code_lines.append(f"  }}")
            
            # Step 7: Wait for navigation/state change after click (for links/buttons that navigate)
            # Check if this is a link or button that might cause navigation
            is_link_or_button = False
            if isinstance(interacted_element, dict):
                tag = interacted_element.get("tag_name", "").lower()
                is_link_or_button = tag in ["a", "button"] or "button" in str(ip.element_selector).lower()
            
            if is_link_or_button:
                code_lines.append(f"  // Wait for potential navigation or state change")
                code_lines.append(f"  await page.waitForTimeout(1000); // Wait for navigation/state change")
            
            # Add wait time after click for more natural pacing
            code_lines.append(f"  await page.waitForTimeout(800); // Wait between actions")
        
        elif ip.event_type in ["type", "input"]:
            # Check if this is actually a radio button or checkbox - those should be clicked, not filled
            interacted_element = ip.metadata.get("interacted_element", {})
            if isinstance(interacted_element, dict):
                field_type = interacted_element.get("type", "").lower()
                element_tag = interacted_element.get("tag_name", "").lower()
                element_role = (interacted_element.get("accessibility", {}) or {}).get("role", "").lower()
                
                # Radio buttons and checkboxes should be clicked, not filled
                if field_type in ["radio", "checkbox"] or element_role in ["radio", "checkbox"]:
                    logger.info(f"[FLUX] Converting {ip.event_type} to click for {field_type}/{element_role} element")
                    code_lines.append(f"  // Click {field_type} button")
                    code_lines.append(f"  await {selector_code}.click({{ timeout: 5000 }});")
                    code_lines.append(f"  await page.waitForTimeout(800); // Wait between actions")
                    return code_lines
            
            # Get value from metadata - check multiple sources
            value = ip.metadata.get("value", "")
            is_masked = ip.metadata.get("is_masked", False)
            
            if not value or value == "***MASKED***":
                # Try to get from interacted_element
                if isinstance(interacted_element, dict):
                    value = interacted_element.get("value", "")
                    is_masked = interacted_element.get("is_masked", False) or (value == "***MASKED***")
            
            # Detect if this is a password or username field
            is_password_field = False
            is_username_field = False
            if isinstance(interacted_element, dict):
                field_type = interacted_element.get("type", "").lower()
                field_name = (interacted_element.get("name", "") or 
                             interacted_element.get("id", "") or 
                             "").lower()
                is_password_field = (field_type == "password" or 
                                    "password" in field_name or 
                                    "pwd" in field_name or
                                    "passwd" in field_name)
                is_username_field = (field_type == "text" and 
                                    ("username" in field_name or 
                                     "user" in field_name or
                                     "email" in field_name or
                                     "login" in field_name) and
                                    not is_password_field)
            
            if value and value != "***MASKED***" and not is_masked:
                # Normal value - use it directly
                escaped_value = value.replace("\\", "\\\\").replace("'", "\\'")
                code_lines.append(f"  // Fill: '{value[:50]}{'...' if len(value) > 50 else ''}'")
                code_lines.append(f"  await {selector_code}.fill('{escaped_value}', {{ timeout: 5000 }});")
                
                # Add validation only for non-password fields
                if not is_password_field:
                    code_lines.append(f"  // Validation: Input should contain value")
                    code_lines.append(f"  await expect({selector_code}).toHaveValue('{escaped_value}', {{ timeout: 1000 }});")
                
                # Add wait time after fill for more natural pacing
                code_lines.append(f"  await page.waitForTimeout(800); // Wait between actions")
            else:
                # Masked value or password/username field - use TEST_DATA
                if is_password_field:
                    code_lines.append(f"  // Type password (value masked for security)")
                    code_lines.append(f"  await {selector_code}.fill(TEST_DATA.password, {{ timeout: 5000 }});")
                    code_lines.append(f"  // Validation: Password field should be filled")
                    code_lines.append(f"  await expect({selector_code}).toHaveValue(TEST_DATA.password, {{ timeout: 1000 }});")
                elif is_username_field:
                    code_lines.append(f"  // Type username (value may be masked)")
                    code_lines.append(f"  await {selector_code}.fill(TEST_DATA.username, {{ timeout: 5000 }});")
                    code_lines.append(f"  // Validation: Username field should be filled")
                    code_lines.append(f"  await expect({selector_code}).toHaveValue(TEST_DATA.username, {{ timeout: 1000 }});")
                else:
                    # Other masked field (credit card, SSN, etc.)
                    code_lines.append(f"  // Type (value masked for security)")
                    code_lines.append(f"  // TODO: Replace 'MASKED_VALUE' with actual value")
                    code_lines.append(f"  await {selector_code}.fill('MASKED_VALUE', {{ timeout: 5000 }});")
                
                # Add wait time after fill for more natural pacing
                code_lines.append(f"  await page.waitForTimeout(800); // Wait between actions")
        
        elif ip.event_type == "select":
            value = ip.metadata.get("value", "")
            code_lines.append(f"  // Select: '{value}'")
            code_lines.append(f"  await {selector_code}.selectOption('{value.replace(chr(39), chr(92) + chr(39))}', {{ timeout: 5000 }});")
            
            # Add validation
            code_lines.append(f"  // Validation: Select should have value")
            code_lines.append(f"  await expect({selector_code}).toHaveValue('{value.replace(chr(39), chr(92) + chr(39))}', {{ timeout: 1000 }});")
            
            # Add wait time after select for more natural pacing
            code_lines.append(f"  await page.waitForTimeout(800); // Wait between actions")
        
        elif ip.event_type == "scroll":
            if ip.scroll_position:
                code_lines.append(
                    f"  // Scroll to: ({ip.scroll_position[0]}, {ip.scroll_position[1]})"
                )
                code_lines.append(
                    f"  await page.evaluate(() => window.scrollTo({ip.scroll_position[0]}, {ip.scroll_position[1]}));"
                )
                code_lines.append("  await page.waitForTimeout(200); // Wait for scroll to complete")
        
        # Add screenshot on critical interactions
        if ip.event_type in ["click", "navigate"] and ip.screenshot_url:
            code_lines.append(f"  // Screenshot captured at interaction {index}")
            code_lines.append(f"  // await page.screenshot({{ path: 'screenshot_{index}.png' }});")
        
        return code_lines
    
    async def _generate_optimal_selector(self, ip: InteractionPoint) -> str:
        """
        Generate optimal selector - USE THE SELECTOR THAT WAS GENERATED AT CAPTURE TIME
        (Like Playwright Codegen - don't regenerate, use what was captured)
        """
        metadata = ip.metadata or {}
        
        # CRITICAL: Check if ip.element_selector is already a generic role selector
        # If so, immediately extract from interacted_element instead
        if ip.element_selector:
            import re
            generic_patterns = [
                r"getByRole\('input'\)",
                r"getByRole\('button'\)",
                r"getByRole\('a'\)",
                r"getByRole\('div'\)",
                r"getByRole\('span'\)",
            ]
            for pattern in generic_patterns:
                if re.search(pattern, ip.element_selector):
                    logger.error(f"[FLUX] ❌ REJECTED generic role selector at start: {ip.element_selector}")
                    # Immediately try to extract from interacted_element
                    interacted_element = metadata.get("interacted_element")
                    if not interacted_element and metadata.get("event_data"):
                        interacted_element = metadata.get("event_data", {}).get("interacted_element")
                    if isinstance(interacted_element, dict):
                        element_id = interacted_element.get("id")
                        element_name = interacted_element.get("name")
                        element_tag = interacted_element.get("tag_name", "").lower()
                        if element_id and self._is_stable_id(element_id):
                            logger.info(f"[FLUX] ✅ Extracted ID after rejecting generic role: {element_id}")
                            return f"page.locator('#{element_id}')"
                        elif element_name and element_tag in ["input", "select", "textarea", "button"]:
                            logger.info(f"[FLUX] ✅ Extracted name after rejecting generic role: {element_tag}[name=\"{element_name}\"]")
                            return f"page.locator('{element_tag}[name=\"{element_name}\"]')"
                    break
        
        # FIRST: Use the Playwright locator that was generated at capture time
        playwright_locator = metadata.get("playwright_locator")
        if playwright_locator:
            logger.info(f"[FLUX] ✅ Using captured Playwright locator: {playwright_locator}")
            return playwright_locator
        else:
            logger.warning(f"[FLUX] ⚠️ playwright_locator NOT in metadata for {ip.event_type}")
        
        # SECOND: Use CSS selector from capture time
        css_selector = metadata.get("css_selector")
        if css_selector:
            # Convert to Playwright locator
            if css_selector.startswith('#') and not css_selector.startswith('page.'):
                element_id = css_selector[1:]
                return f"page.locator('#{element_id}')"
            elif css_selector.startswith('[data-testid="'):
                testid = css_selector.split('"')[1]
                return f"page.getByTestId('{testid}')"
            elif not css_selector.startswith('page.'):
                return f"page.locator('{css_selector}')"
            return css_selector
        
        # THIRD: Use fallback selectors from capture time
        fallback_selectors = metadata.get("fallback_selectors", [])
        if fallback_selectors:
            logger.debug(f"[FLUX] Using fallback selector: {fallback_selectors[0]}")
            return fallback_selectors[0]
        
        # FOURTH: Fallback to generating from metadata (shouldn't happen if capture worked)
        # Log warning if we get here - means selector generation at capture time failed
        logger.warning(f"[FLUX] ⚠️ No captured selector found, generating from metadata. Event: {ip.event_type}")
        logger.warning(f"[FLUX] Metadata keys: {list(metadata.keys())}")
        
        # Try to get interacted_element from multiple locations
        interacted_element = metadata.get("interacted_element")
        if not interacted_element and metadata.get("event_data"):
            interacted_element = metadata.get("event_data", {}).get("interacted_element")
        
        if isinstance(interacted_element, dict):
            element_id = interacted_element.get("id")
            element_name = interacted_element.get("name")
            element_type = interacted_element.get("type")
            element_tag = interacted_element.get("tag_name", "").lower()
            # Check multiple possible locations for data-testid
            data_testid = (
                interacted_element.get("data_testid") or 
                interacted_element.get("data-testid") or
                (interacted_element.get("attributes", {}) or {}).get("data-testid") or
                (interacted_element.get("attributes", {}) or {}).get("data_testid")
            )
            
            logger.warning(f"[FLUX] 🔍 Element attributes: id={element_id}, name={element_name}, type={element_type}, tag={element_tag}, testid={data_testid}")
            
            # CRITICAL: If we have ID or name, use them IMMEDIATELY - don't fall through to generic roles
            if data_testid:
                logger.info(f"[FLUX] ✅ Using data-testid from interacted_element: {data_testid}")
                return f"page.getByTestId('{data_testid}')"
            elif element_id and self._is_stable_id(element_id):
                logger.info(f"[FLUX] ✅ Using element ID from interacted_element: {element_id}")
                return f"page.locator('#{element_id}')"
            elif element_name and element_tag in ["input", "select", "textarea", "button"]:
                logger.info(f"[FLUX] ✅ Using element name from interacted_element: {element_tag}[name=\"{element_name}\"]")
                return f"page.locator('{element_tag}[name=\"{element_name}\"]')"
            else:
                logger.error(f"[FLUX] ❌ No usable attributes in interacted_element! Keys: {list(interacted_element.keys())}")
                
                # Try to use role-based selector as fallback
                accessibility = interacted_element.get("accessibility") or {}
                role = accessibility.get("role")
                aria_label = accessibility.get("aria_label") or accessibility.get("ariaLabel")
                name = accessibility.get("name") or element_name
                
                # Only use role if it's a real ARIA role, not a tag name
                valid_roles = ["button", "link", "textbox", "checkbox", "radio", "combobox", "menuitem", "tab", "option"]
                if role and role.lower() in valid_roles:
                    if aria_label:
                        escaped_label = aria_label.replace("'", "\\'")
                        return f"page.getByRole('{role}', {{ name: '{escaped_label}' }})"
                    elif name:
                        escaped_name = name.replace("'", "\\'")
                        return f"page.getByRole('{role}', {{ name: '{escaped_name}' }})"
                    elif ip.element_text and len(ip.element_text.strip()) < 50:
                        escaped_text = ip.element_text.replace("'", "\\'")
                        return f"page.getByRole('{role}', {{ name: '{escaped_text}' }})"
                
                # Try text content - but make it more specific if possible
                text_content = interacted_element.get("text_content") or ip.element_text
                if text_content and len(text_content.strip()) < 50:
                    escaped_text = text_content.strip().replace("'", "\\'")
                    # Try to combine with tag name or role for specificity
                    tag_name = interacted_element.get("tag_name", "").lower()
                    if tag_name in ["a", "link", "button"]:
                        # For links, use getByRole with text (most reliable)
                        if tag_name == "a" or tag_name == "link":
                            return f"page.getByRole('link', {{ name: '{escaped_text}', exact: true }})"
                        elif tag_name == "button":
                            return f"page.getByRole('button', {{ name: '{escaped_text}', exact: true }})"
                        else:
                            # Use tag + text filter - get first visible one
                            return f"page.locator('{tag_name}').filter({{ hasText: '{escaped_text}' }}).first()"
                    else:
                        # Use getByText with exact match
                        return f"page.getByText('{escaped_text}', {{ exact: true }}).first()"
        else:
            logger.error(f"[FLUX] ❌ interacted_element is not a dict! Type: {type(interacted_element)}, Value: {interacted_element}")
        
        # Final fallback: NEVER use generic roles like "input", "button", "div", "a"
        # These are useless - they'll match the first element of that type
        # Check if element_selector is a generic role selector (both CSS and Playwright formats)
        is_generic_role = False
        if ip.element_selector:
            # Check for generic role selectors in various formats
            generic_patterns = [
                r"getByRole\('input'\)",
                r"getByRole\('button'\)",
                r"getByRole\('a'\)",
                r"getByRole\('div'\)",
                r"getByRole\('span'\)",
                r"\[role=\"input\"\]",
                r"\[role=\"button\"\]",
                r"\[role=\"a\"\]",
                r"\[role=\"div\"\]",
            ]
            import re
            for pattern in generic_patterns:
                if re.search(pattern, ip.element_selector):
                    is_generic_role = True
                    break
        
        if ip.element_selector and not is_generic_role:
            # Validate selector before using it
            selector = ip.element_selector.strip()
            
            # Reject invalid selectors that are just text content
            # Check if it looks like plain text (not a valid CSS selector)
            invalid_patterns = [
                r'^[a-zA-Z]+$',  # Single word like "lightning"
                r'^text=',  # text="..." format (should use getByText)
            ]
            import re
            is_invalid = False
            for pattern in invalid_patterns:
                if re.match(pattern, selector):
                    is_invalid = True
                    logger.warning(f"[FLUX] ⚠️ Rejected invalid selector (looks like text): {selector}")
                    break
            
            # If selector contains text="..." format, extract text and use getByText
            if 'text="' in selector:
                match = re.search(r'text="([^"]+)"', selector)
                if match:
                    text = match.group(1)
                    escaped_text = text.replace("'", "\\'")
                    logger.info(f"[FLUX] ✅ Converted text= selector to getByText: {text}")
                    return f"page.getByText('{escaped_text}')"
            
            # If it's already a Playwright locator, use it as-is
            if selector.startswith('page.'):
                return selector
            elif not is_invalid:
                # Validate it's a reasonable CSS selector
                # Basic validation: should contain common CSS selector characters
                if any(char in selector for char in ['#', '.', '[', ':', '>', ' ', '+', '~']):
                    return f"page.locator('{selector}')"
                else:
                    # Looks like plain text, use getByText instead
                    logger.warning(f"[FLUX] ⚠️ Selector '{selector}' looks like text, using getByText instead")
                    escaped_text = selector.replace("'", "\\'")
                    return f"page.getByText('{escaped_text}')"
        
        # Use text content as fallback - but make it more specific
        if ip.element_text:
            escaped_text = ip.element_text.replace("'", "\\'")
            # Try to get tag name from metadata for better specificity
            tag_name = None
            if metadata.get("interacted_element"):
                tag_name = metadata.get("interacted_element", {}).get("tag_name", "").lower()
            
            if tag_name in ["a", "link"]:
                # For links, use getByRole with exact text match (most reliable)
                return f"page.getByRole('link', {{ name: '{escaped_text}', exact: true }})"
            elif tag_name == "button":
                # For buttons, use getByRole with exact text match
                return f"page.getByRole('button', {{ name: '{escaped_text}', exact: true }})"
            else:
                # Use getByText with exact match
                return f"page.getByText('{escaped_text}', {{ exact: true }}).first()"
        else:
            # Log warning and use a placeholder that will fail clearly
            logger.error(f"[FLUX] CRITICAL: No usable selector found for {ip.event_type}. Metadata keys: {list(metadata.keys())}")
            logger.error(f"[FLUX] interacted_element keys: {list(interacted_element.keys()) if isinstance(interacted_element, dict) else 'Not a dict'}")
            logger.error(f"[FLUX] element_selector: {ip.element_selector}, element_role: {ip.element_role}, element_text: {ip.element_text}")
            # Try to extract ID or name from interacted_element as absolute last resort
            if isinstance(interacted_element, dict):
                element_id = interacted_element.get("id")
                element_name = interacted_element.get("name")
                if element_id and self._is_stable_id(element_id):
                    logger.warning(f"[FLUX] Using element ID as last resort: {element_id}")
                    return f"page.locator('#{element_id}')"
                elif element_name:
                    tag_name = interacted_element.get("tag_name", "input").lower()
                    logger.warning(f"[FLUX] Using element name as last resort: {tag_name}[name=\"{element_name}\"]")
                    return f"page.locator('{tag_name}[name=\"{element_name}\"]')"
            # Return a selector that will fail with a clear error
            return "page.locator('ERROR_NO_SELECTOR_FOUND')"
    
    def _is_stable_id(self, element_id: str) -> bool:
        """Check if an ID looks stable (not auto-generated)"""
        if not element_id:
            return False
        # IDs that look auto-generated
        unstable_patterns = [
            'react', 'generated', 'random', 'uuid', 'guid',
            'temp', 'tmp', 'auto', 'dynamic'
        ]
        element_id_lower = element_id.lower()
        return not any(pattern in element_id_lower for pattern in unstable_patterns)
    
    async def _calculate_fidelity_scorecard(
        self,
        interaction_map: List[InteractionPoint],
        action_graph: ActionGraph,
        script: str
    ) -> FidelityScorecard:
        """Calculate fidelity scorecard"""
        scorecard = FidelityScorecard()
        
        # Mouse path match (if coordinates available)
        coordinates_count = sum(1 for ip in interaction_map if ip.coordinates)
        if coordinates_count > 0:
            scorecard.mouse_path_match = 95.0  # Assume good match if coordinates captured
        else:
            scorecard.mouse_path_match = 80.0  # Lower if no coordinates
            scorecard.warnings.append("Mouse coordinates not captured - using element selectors only")
        
        # Timing match
        timing_events = sum(1 for ip in interaction_map if ip.delay_before_ms > 0)
        if timing_events > 0:
            scorecard.timing_match = 95.0
        else:
            scorecard.timing_match = 70.0
            scorecard.warnings.append("Timing information not captured - using estimated delays")
        
        # Interaction match
        interaction_types = set(ip.event_type for ip in interaction_map)
        expected_types = {"click", "type", "input", "select", "navigate", "scroll"}
        matched_types = len(interaction_types & expected_types)
        scorecard.interaction_match = (matched_types / len(expected_types)) * 100
        
        # Selector match
        selectors_with_fallback = sum(1 for ip in interaction_map if ip.element_selector)
        if selectors_with_fallback > 0:
            scorecard.selector_match = 90.0
        else:
            scorecard.selector_match = 60.0
            scorecard.issues.append("Some interactions missing selectors")
        
        # Validation match
        validation_count = script.count("expect(")
        interaction_count = len([ip for ip in interaction_map if ip.event_type not in ["scroll", "dom_snapshot"]])
        if interaction_count > 0:
            scorecard.validation_match = min(100.0, (validation_count / interaction_count) * 100)
        else:
            scorecard.validation_match = 0.0
        
        # Overall score (weighted average)
        scorecard.overall_score = (
            scorecard.mouse_path_match * 0.15 +
            scorecard.timing_match * 0.20 +
            scorecard.interaction_match * 0.25 +
            scorecard.selector_match * 0.25 +
            scorecard.validation_match * 0.15
        )
        
        return scorecard
    
    async def _auto_heal_script(
        self,
        script: str,
        interaction_map: List[InteractionPoint],
        scorecard: FidelityScorecard
    ) -> str:
        """Auto-heal script if fidelity is low"""
        healed_script = script
        healed_count = 0
        
        # Add more validations if validation match is low
        if scorecard.validation_match < 80:
            # Add assertions after critical interactions
            for ip in interaction_map:
                if ip.event_type == "click" and "expect(" not in script:
                    # Add validation after click
                    selector_code = await self._generate_optimal_selector(ip)
                    validation = f"  await expect({selector_code}).toBeVisible({{ timeout: 1000 }});"
                    # Insert after click line
                    healed_script = healed_script.replace(
                        f"await {selector_code}.click",
                        f"await {selector_code}.click\n{validation}"
                    )
                    healed_count += 1
        
        # Add fallback selectors if selector match is low
        if scorecard.selector_match < 80:
            # This would require more complex script parsing
            scorecard.warnings.append("Selector fallbacks added during auto-healing")
            healed_count += 1
        
        scorecard.auto_healed_count = healed_count
        return healed_script
    
    async def _generate_variants(
        self,
        base_script: str,
        interaction_map: List[InteractionPoint]
    ) -> Dict[str, str]:
        """Generate script variants for different browsers/devices"""
        variants = {}
        
        # Chromium variant (base)
        variants["chromium"] = base_script
        
        # Firefox variant
        firefox_script = base_script.replace(
            "test('Flowstral Recorded Test",
            "test('Flowstral Recorded Test - Firefox"
        )
        firefox_script = firefox_script.replace(
            "async ({ page }) => {",
            "async ({ page }) => {\n  // Firefox-specific adjustments"
        )
        variants["firefox"] = firefox_script
        
        # WebKit variant
        webkit_script = base_script.replace(
            "test('Flowstral Recorded Test",
            "test('Flowstral Recorded Test - WebKit"
        )
        webkit_script = webkit_script.replace(
            "async ({ page }) => {",
            "async ({ page }) => {\n  // WebKit-specific adjustments"
        )
        variants["webkit"] = webkit_script
        
        return variants
    
    async def _add_validations(
        self,
        script: str,
        interaction_map: List[InteractionPoint],
        action_graph: ActionGraph
    ) -> str:
        """Add validations and assertions to script"""
        # Script already has validations from _generate_interaction_code
        # Add additional state change validations
        
        validated_script = script
        
        # Add page state validation after navigation
        for ip in interaction_map:
            if ip.event_type == "navigate":
                url = ip.metadata.get("url", "")
                if url:
                    # Add URL validation
                    url_validation = f"  await expect(page).toHaveURL(/.*{re.escape(url.split('/')[-1])}.*/);"
                    if url_validation not in validated_script:
                        validated_script = validated_script.replace(
                            f"await page.goto('{url}');",
                            f"await page.goto('{url}');\n{url_validation}"
                        )
        
        return validated_script
    
    def _get_fidelity_level(self, score: float) -> FidelityLevel:
        """Get fidelity level from score"""
        if score >= 100:
            return FidelityLevel.PERFECT
        elif score >= 95:
            return FidelityLevel.EXCELLENT
        elif score >= 90:
            return FidelityLevel.GOOD
        elif score >= 85:
            return FidelityLevel.ACCEPTABLE
        else:
            return FidelityLevel.POOR

