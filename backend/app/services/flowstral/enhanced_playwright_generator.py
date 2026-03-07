"""
Enhanced Playwright Generator - Best Practices Implementation
Incorporates recommendations from Playwright best practices:
1. Semantic Locators (getByRole, getByText, getByTestId)
2. Chained Locators (scoped searches)
3. Filtering/nth for duplicate elements
4. Auto-waiting (no fixed waits)
5. Web-first assertions
6. Network synchronization
7. Context-aware (frames, shadow DOM)
8. State synchronization
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import re

from app.services.flowstral.flowstral_action_graph import ActionGraph

logger = logging.getLogger(__name__)


class EnhancedPlaywrightGenerator:
    """
    Enhanced Playwright script generator following industry best practices.
    
    Key Features:
    - Semantic locators (getByRole, getByText, getByTestId)
    - Chained locators for scoped searches
    - Filtering for duplicate elements
    - Auto-waiting (no fixed waits)
    - Web-first assertions
    - Network synchronization
    - Context-aware (frames, shadow DOM)
    """
    
    def __init__(self):
        self.weak_selectors = []  # Track weak selectors for reporting
        self.ACTION_TIMEOUT = 10000  # 10 seconds
        self.NETWORK_TIMEOUT = 3000  # 3 seconds
        self.session_element_models: Optional[Dict[str, Any]] = None  # In-memory element models from session
    
    async def generate_script(
        self,
        action_graph: ActionGraph,
        dom_snapshots: List[Dict[str, Any]] = None,
        raw_events: Optional[List[Dict[str, Any]]] = None,
        session_element_models: Optional[Dict[str, Any]] = None  # In-memory element models from session
    ) -> Dict[str, Any]:
        """
        Generate enhanced Playwright script with best practices.
        
        Returns:
            {
                "script": "...",
                "action_count": 5,
                "generation_time_ms": 1800,
                "strategies_used": [...],
                "warnings": [...]
            }
        """
        start_time = datetime.now()
        
        logger.info(f"[ENHANCED] Generating script from {len(action_graph.nodes)} nodes")
        
        # Log all node event types for debugging
        all_event_types = [self._get_node_property(node, 'event_type') for node in action_graph.nodes]
        logger.info(f"[ENHANCED] Node event types: {all_event_types}")
        
        # Log detailed node information for first 10 nodes
        logger.info(f"[ENHANCED] === DETAILED NODE ANALYSIS ===")
        for idx, node in enumerate(action_graph.nodes[:10]):
            event_type = self._get_node_property(node, 'event_type')
            target_selector = self._get_node_property(node, 'target_selector')
            target_text = self._get_node_property(node, 'target_text')
            action_desc = self._get_node_property(node, 'action_description')
            url = self._get_node_property(node, 'url')
            logger.info(f"[ENHANCED] Node {idx}: event_type={event_type}, selector={target_selector}, text={target_text}, url={url}, desc={action_desc}")
        logger.info(f"[ENHANCED] === END NODE ANALYSIS ===")
        
        # Generate script with best practices
        script_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            "// Configuration",
            f"const ACTION_TIMEOUT = {self.ACTION_TIMEOUT};  // 10 seconds",
            f"const NETWORK_TIMEOUT = {self.NETWORK_TIMEOUT};  // 3 seconds",
            "",
            "test('Flowstral Recorded Test', async ({ page }) => {"
        ]
        
        # Reset weak selectors tracking
        self.weak_selectors = []
        
        strategies_used = set()
        warnings = []
        
        # Get initial URL
        initial_url = self._get_initial_url(action_graph)
        if initial_url:
            script_lines.append(f"  // Navigate to initial page")
            script_lines.append(f"  await page.goto('{self._escape_string(initial_url)}');")
            script_lines.append(f"  await page.waitForLoadState('networkidle');")
            strategies_used.add("network_synchronization")
        else:
            script_lines.append("  // TODO: Add initial URL")
            warnings.append("No initial URL found")
        
        script_lines.append("")
        
        # Process nodes with best practices
        # CRITICAL: Process nodes in EXACT order they were recorded (preserve sequence)
        processed_count = 0
        skipped_count = 0
        previous_context = None  # Track frame/shadow DOM context
        
        # CRITICAL FIX: Industry-standard deduplication - ONLY remove consecutive duplicates
        # Like Tosca, MABL, Testim - preserve order, only deduplicate immediate repeats
        def deduplicate_nodes(nodes):
            """
            Remove ONLY consecutive duplicate actions (industry standard approach).
            Preserves exact order and allows legitimate repeated actions.
            
            Industry tools (Tosca, MABL, Testim) only remove consecutive duplicates,
            not recent ones, because users may legitimately click the same button
            multiple times in different contexts.
            """
            if not nodes:
                return nodes
            
            deduplicated = []
            last_action_key = None
            
            for node in nodes:
                event_type = self._get_node_property(node, 'event_type')
                target_selector = self._get_node_property(node, 'target_selector')
                target_text = self._get_node_property(node, 'target_text')
                
                # Create key for this action (exact match only)
                action_key = (event_type, target_selector, target_text)
                
                # ONLY skip if this is EXACTLY the same as the immediately previous action
                # This is how industry tools work - they preserve order and allow repeats
                if action_key == last_action_key:
                    logger.info(f"[ENHANCED] ⏭️  Skipping consecutive duplicate: {event_type} on {target_selector or target_text}")
                    continue
                
                # Add to deduplicated list (preserves order)
                deduplicated.append(node)
                last_action_key = action_key
            
            return deduplicated
        
        # Filter out internal events FIRST (before deduplication)
        # Industry standard: Only record user actions (click, type, select, navigate)
        USER_ACTIONS = {"click", "click_button", "input", "type", "fill_field", "select", "navigate", "submit"}
        INTERNAL_EVENTS = {
            "session_start", "session_end", "wcag_scan", "dom_snapshot", 
            "page_load", "scroll", "mousemove", "mouseover", "mouseout",
            "focus", "blur", "resize", "visibilitychange", "api_request", "change"
        }
        
        # Filter to only user actions (preserve order)
        user_action_nodes = []
        for node in action_graph.nodes:
            event_type = self._get_node_property(node, 'event_type')
            # Normalize event type for checking
            normalized = event_type
            if event_type == "click_button":
                normalized = "click"
            elif event_type == "fill_field":
                normalized = "input"
            
            # Only include user actions, skip internal events
            if normalized in USER_ACTIONS:
                user_action_nodes.append(node)
            elif event_type not in INTERNAL_EVENTS:
                # Unknown event type - include it (might be a new user action type)
                logger.warning(f"[ENHANCED] Unknown event type '{event_type}' - including as user action")
                user_action_nodes.append(node)
            else:
                logger.debug(f"[ENHANCED] Filtering out internal event: {event_type}")
        
        logger.info(f"[ENHANCED] Filtered {len(action_graph.nodes)} nodes to {len(user_action_nodes)} user actions")
        
        # Deduplicate ONLY consecutive duplicates (industry standard)
        original_count = len(user_action_nodes)
        deduplicated_nodes = deduplicate_nodes(user_action_nodes)
        if len(deduplicated_nodes) < original_count:
            logger.info(f"[ENHANCED] Deduplicated {original_count} nodes to {len(deduplicated_nodes)} nodes ({original_count - len(deduplicated_nodes)} consecutive duplicates removed)")
        
        # Log node order for debugging (AFTER deduplication)
        logger.info(f"[ENHANCED] Processing {len(deduplicated_nodes)} nodes in recorded order")
        for idx, node in enumerate(deduplicated_nodes[:5]):  # Log first 5
            event_type = self._get_node_property(node, 'event_type')
            target_text = self._get_node_property(node, 'target_text')
            logger.info(f"[ENHANCED] Node {idx}: {event_type} - {target_text}")
        
        # Store session element models for use in action generation
        self.session_element_models = session_element_models
        
        # Process nodes in EXACT order (no reordering)
        for i, node in enumerate(deduplicated_nodes):
            try:
                # Skip internal Flowstral events
                event_type = self._get_node_property(node, 'event_type')
                target_selector = self._get_node_property(node, 'target_selector')
                target_text = self._get_node_property(node, 'target_text')
                action_desc = self._get_node_property(node, 'action_description')
                url = self._get_node_property(node, 'url')
                
                logger.info(f"[ENHANCED] Node {i}/{len(action_graph.nodes)}: event_type={event_type}, target_selector={target_selector}, target_text={target_text}, url={url}")
                logger.info(f"[ENHANCED]   action_description={action_desc}")
                
                # Skip internal Flowstral events (but allow coalesced actions like "click_button", "fill_field")
                if event_type in ["session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]:
                    skipped_count += 1
                    logger.info(f"[ENHANCED] ⏭️  Skipping internal event: {event_type}")
                    continue
                
                logger.info(f"[ENHANCED] ✅ Processing node {i}: event_type={event_type}, target_selector={target_selector}, target_text={target_text}")
                
                action_code, strategy, context_info = await self._generate_enhanced_action(
                    node, 
                    previous_context,
                    i < len(action_graph.nodes) - 1,  # Check if there's a next node
                    session_element_models  # Pass session element models
                )
                
                if action_code:
                    script_lines.extend(action_code)
                    script_lines.append("")
                    if strategy:
                        strategies_used.add(strategy)
                    if context_info:
                        previous_context = context_info
                    processed_count += 1
                    logger.info(f"[ENHANCED] ✅ Generated {len(action_code)} lines for node {i} ({event_type})")
                else:
                    # CRITICAL: For click/input events, this should NEVER happen
                    # If it does, log detailed info for debugging
                    logger.error(f"[ENHANCED] ❌ No code generated for node {i} ({event_type})")
                    logger.error(f"[ENHANCED]   target_selector={target_selector}")
                    logger.error(f"[ENHANCED]   target_text={target_text}")
                    logger.error(f"[ENHANCED]   action_description={self._get_node_property(node, 'action_description')}")
                    logger.error(f"[ENHANCED]   metadata={self._get_node_property(node, 'metadata')}")
                    skipped_count += 1
                    
            except Exception as e:
                logger.error(f"[ENHANCED] ❌ Failed to generate code for node {i}: {e}", exc_info=True)
                warnings.append(f"Failed to generate code for node {i}: {str(e)}")
                skipped_count += 1
                continue
        
        logger.info(f"[ENHANCED] Summary: {processed_count} processed, {skipped_count} skipped, {len(action_graph.nodes)} total")
        
        script_lines.append("});")
        
        script = "\n".join(script_lines)
        generation_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Basic validation: check for common syntax errors
        validation_errors = self._validate_script_syntax(script)
        if validation_errors:
            logger.error(f"[ENHANCED] Script validation errors: {validation_errors}")
            warnings.extend([f"Syntax warning: {err}" for err in validation_errors])
        
        # Optional: Full validation pipeline (if available)
        try:
            from tests.flowstral.validation_pipeline import get_playwright_validator
            validator = get_playwright_validator()
            validation_result = await validator.validate(script, strict=False)
            if not validation_result["valid"]:
                logger.warning(f"[ENHANCED] Validation pipeline found issues: {validation_result['errors']}")
                warnings.extend([f"Validation: {err}" for err in validation_result["errors"]])
            if validation_result.get("warnings"):
                warnings.extend([f"Validation: {warn}" for warn in validation_result["warnings"]])
        except ImportError:
            # Validation pipeline not available (tests not installed)
            pass
        except Exception as e:
            logger.debug(f"[ENHANCED] Validation pipeline error (non-critical): {e}")
        
        # Add warnings for weak selectors
        if self.weak_selectors:
            warnings.append(
                f"Found {len(self.weak_selectors)} steps with weak selectors (quality < 70%). "
                f"Consider adding data-testid attributes for better reliability."
            )
        
        # Add warning if no user interactions were captured
        if processed_count == 0 and len(action_graph.nodes) > 0:
            # Check if we only have internal events
            internal_event_count = sum(
                1 for node in action_graph.nodes
                if self._get_node_property(node, 'event_type') in ["session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]
            )
            if internal_event_count == len(action_graph.nodes):
                warnings.append(
                    "No user interactions were captured during recording. "
                    "The script only contains navigation because no clicks, inputs, or other user actions were recorded. "
                    "Please check: 1) Browser extension is loaded, 2) You interacted with the page (clicked buttons, filled forms), "
                    "3) Browser console for Flowstral extension messages, 4) Network tab for /api/flowstral/capture-event requests."
                )
                logger.warning(f"[ENHANCED] No user interactions captured - only {internal_event_count} internal events found")
        
        logger.info(f"[ENHANCED] Generated script: {processed_count} actions, {generation_time:.0f}ms")
        
        return {
            "script": script,
            "action_count": processed_count,
            "total_nodes": len(action_graph.nodes),
            "generation_time_ms": generation_time,
            "strategies_used": list(strategies_used),
            "warnings": warnings,
            "weak_selectors": self.weak_selectors
        }
    
    def _get_initial_url(self, action_graph: ActionGraph) -> Optional[str]:
        """Get initial URL from action graph.
        
        Priority:
        1. base_url from session metadata (USER SPECIFIED - most reliable!)
        2. session_start node URL (if valid test URL)
        3. FIRST USER ACTION (click/input) URL - this is where user started interacting
        4. First navigate event URL
        5. Fallback to first valid URL
        
        Key insight: base_url is explicitly specified by the user before recording.
        This is the most reliable source for where the test should start.
        """
        if not action_graph.nodes:
            return None
        
        # ArisTrace URLs should NOT be used as test target
        EXCLUDED_URL_PATTERNS = [
            'localhost:8080',  # ArisTrace platform
            'localhost:8081',  # ArisTrace API
            '127.0.0.1:8080',
            '127.0.0.1:8081',
        ]
        
        def is_valid_test_url(url: str) -> bool:
            """Check if URL is a valid test target (not ArisTrace itself)"""
            if not url:
                return False
            for pattern in EXCLUDED_URL_PATTERNS:
                if pattern in url:
                    return False
            return True
        
        # PRIORITY 0: Check for base_url in session_start metadata
        # This is what the USER explicitly specified - most reliable!
        for node in action_graph.nodes:
            event_type = self._get_node_property(node, 'event_type')
            if event_type == 'session_start':
                metadata = self._get_node_property(node, 'metadata') or {}
                base_url = metadata.get('base_url')
                if base_url and is_valid_test_url(base_url):
                    logger.info(f"[URL] ✅ Using USER-SPECIFIED base_url: {base_url}")
                    return base_url
        
        # Collect all URLs with their event types and indices
        url_candidates = []
        for idx, node in enumerate(action_graph.nodes):
            event_type = self._get_node_property(node, 'event_type')
            url = self._get_node_property(node, 'url')
            if url and is_valid_test_url(url):
                url_candidates.append({
                    'index': idx,
                    'event_type': event_type,
                    'url': url
                })
        
        if not url_candidates:
            logger.warning("[URL] No valid initial URL found in action graph!")
            return None
        
        # Priority 1: session_start with valid URL
        for candidate in url_candidates:
            if candidate['event_type'] == 'session_start':
                logger.info(f"[URL] Found initial URL from session_start: {candidate['url']}")
                return candidate['url']
        
        # Priority 2: FIRST USER ACTION (click, input, click_button, fill_field)
        # This is the page where the user STARTED interacting - most reliable!
        USER_ACTIONS = {'click', 'click_button', 'input', 'fill_field', 'type', 'select'}
        for candidate in url_candidates:
            if candidate['event_type'] in USER_ACTIONS:
                logger.info(f"[URL] Found initial URL from first user action ({candidate['event_type']}): {candidate['url']}")
                return candidate['url']
        
        # Priority 3: First valid URL (any event type)
        first_candidate = url_candidates[0]
        logger.info(f"[URL] Using first valid URL from {first_candidate['event_type']}: {first_candidate['url']}")
        return first_candidate['url']
    
    async def _generate_enhanced_action(
        self,
        node: Any,
        previous_context: Optional[Dict[str, Any]],
        has_next_node: bool,
        session_element_models: Optional[Dict[str, Any]] = None  # In-memory element models from session
    ) -> Tuple[List[str], Optional[str], Optional[Dict[str, Any]]]:
        """
        Generate enhanced action code following best practices.
        
        Returns:
            (code_lines, strategy_used, context_info)
        """
        code_lines = []
        strategy = None
        context_info = None
        
        event_type = self._get_node_property(node, 'event_type')
        if not event_type:
            return [], None, None
        
        # Normalize event type: coalesced actions -> original event types
        # Coalescer generates "click_button", "fill_field", "unknown" - we need to map these
        normalized_event_type = event_type
        if event_type == "click_button":
            normalized_event_type = "click"
        elif event_type == "fill_field":
            normalized_event_type = "input"
        elif event_type == "unknown":
            # Try to infer from action_description
            action_desc = self._get_node_property(node, 'action_description') or ""
            if "click" in action_desc.lower():
                normalized_event_type = "click"
            elif "input" in action_desc.lower() or "fill" in action_desc.lower():
                normalized_event_type = "input"
            # Keep as "unknown" if we can't infer
        
        logger.info(f"[ENHANCED] Event type: {event_type} -> normalized: {normalized_event_type}")
        
        # Get element metadata
        element_data = self._extract_element_data(node)
        
        # Detect application type from node metadata or session
        app_type = None
        from app.services.automation.application_detector import ApplicationDetector, ApplicationType, get_application_detector
        app_detector = get_application_detector()
        
        # Try to get app type from node metadata first
        if node.metadata and 'application_type' in node.metadata:
            try:
                app_type = ApplicationType(node.metadata['application_type'])
                logger.info(f"[ENHANCED] Using application type from node: {app_type.value}")
            except:
                pass
        
        # If not in node, try to detect from element data or URL
        if not app_type:
            url = self._get_node_property(node, 'url') or ''
            # Try to detect from element data if it has HTML structure
            if element_data.get('html_snippet'):
                app_type = app_detector.detect_application(element_data.get('html_snippet', ''), url)
            else:
                # Default to generic if we can't detect
                app_type = ApplicationType.GENERIC
        
        logger.info(f"[ENHANCED] Application type: {app_type.value}")
        
        # Check for context (frame, shadow DOM)
        context = self._detect_context(node, element_data)
        if context:
            context_info = context
            code_lines.extend(self._generate_context_switch(context))
        
        # PRIORITY 0: Check for element model (Tosca-style element model system)
        # If element_model_id exists in metadata, use element model identifiers
        locator_chain = []
        element_model_id = None
        metadata = self._get_node_property(node, 'metadata') or {}
        if isinstance(metadata, dict):
            # Check in interacted_element metadata (where we store it during recording)
            interacted_element = metadata.get("interacted_element") or {}
            if isinstance(interacted_element, dict):
                element_model_id = interacted_element.get("metadata", {}).get("element_model_id")
            # Also check directly in metadata
            if not element_model_id:
                element_model_id = metadata.get("element_model_id")
        
        if element_model_id:
            logger.info(f"[ENHANCED] Found element_model_id: {element_model_id}, retrieving element model")
            element_model = None
            
            # CRITICAL: Try session memory first (works without database)
            if session_element_models and element_model_id in session_element_models:
                element_model = session_element_models[element_model_id]
                logger.info(f"[ENHANCED] ✅ Retrieved element model from session memory: {element_model.get('element_name')}")
            
            # Fallback to database if not in session memory
            if not element_model:
                try:
                    from app.services.flowstral.element_model_service import get_element_model_service
                    element_model_service = get_element_model_service()
                    
                    # Get element model with all identifiers
                    element_model = await element_model_service.get_element_model(element_model_id)
                    logger.info(f"[ENHANCED] ✅ Retrieved element model from database: {element_model.get('element_name') if element_model else 'None'}")
                except Exception as e:
                    logger.warning(f"[ENHANCED] Could not retrieve element model from database: {e}")
            
            if element_model and element_model.get("identifiers"):
                identifiers = element_model.get("identifiers", [])
                app_type_str = app_type.value if app_type else element_model.get("application_type", "generic")
                
                # Filter identifiers by app type (if app_specific, must match)
                # Otherwise, use all identifiers
                app_identifiers = [
                    id for id in identifiers
                    if not id.get("app_specific", False) or id.get("app_type") == app_type_str
                ]
                
                # If no app-specific identifiers, use all identifiers
                if not app_identifiers:
                    app_identifiers = identifiers
                
                # Sort by priority (lower = higher priority), then by confidence
                app_identifiers.sort(key=lambda x: (
                    x.get("priority", 999),
                    -x.get("confidence", 0.0)  # Negative for descending
                ))
                
                # Build locator chain from element model identifiers
                for identifier in app_identifiers:
                    playwright_locator = identifier.get("playwright_locator")
                    if playwright_locator:
                        identifier_type = identifier.get("type", "element_model")
                        confidence = identifier.get("confidence", 0.95)
                        locator_chain.append((
                            playwright_locator,
                            f"element_model_{identifier_type}"
                        ))
                        logger.info(f"[ENHANCED]   Added element model identifier: {identifier_type} (priority: {identifier.get('priority')}, confidence: {confidence})")
                
                if locator_chain:
                    logger.info(f"[ENHANCED] ✅ Using {len(locator_chain)} element model identifiers (highest priority)")
                else:
                    logger.warning(f"[ENHANCED] Element model {element_model_id} found but no valid identifiers with playwright_locator")
            elif element_model:
                logger.warning(f"[ENHANCED] Element model {element_model_id} found but no identifiers available")
        
        # CRITICAL FIX: Always prioritize target_selector/target_text from orchestrator
        # These are set directly from the event capture and are most reliable
        target_selector = self._get_node_property(node, 'target_selector')
        target_text = self._get_node_property(node, 'target_text')
        
        # CRITICAL: For Salesforce, ALWAYS prioritize Salesforce-specific selectors FIRST
        # Salesforce selectors (title, href, data-*) are more reliable than generic selectors
        if not locator_chain and app_type == ApplicationType.SALESFORCE and element_data:
            # For Salesforce, use application detector to get best selectors
            analysis = app_detector.analyze_element(element_data)
            if analysis.get('selectors'):
                # Build Salesforce locator chain from analysis (prioritize title, href, data-*)
                salesforce_locators = []
                for sel in analysis['selectors']:
                    selector_code = sel['selector']
                    if sel['type'] == 'attribute':
                        # For Salesforce, title attribute is most reliable
                        # Format: button[title="Button Text"] or a[title="Link Text"]
                        salesforce_locators.append((f"page.locator('{selector_code}')", "salesforce_attribute"))
                        logger.info(f"[ENHANCED] Salesforce attribute selector: {selector_code}")
                    elif sel['type'] == 'semantic':
                        # Already in Playwright format
                        salesforce_locators.append((selector_code, "salesforce_semantic"))
                        logger.info(f"[ENHANCED] Salesforce semantic selector: {selector_code}")
                
                if salesforce_locators:
                    locator_chain = salesforce_locators
                    logger.info(f"[ENHANCED] ✅ Using {len(salesforce_locators)} Salesforce-specific selectors (highest priority)")
        
        # Generate semantic locators as fallback (if Salesforce didn't provide any)
        if not locator_chain:
            semantic_locators = self._generate_locator_fallback_chain(element_data, node)
        else:
            semantic_locators = []  # Don't generate if we already have Salesforce selectors
        
        # Priority 1: ALWAYS use target_selector FIRST if it's an ID selector (#id)
        # ID selectors are very reliable and should be prioritized
        if not locator_chain and target_selector and target_selector.strip():
            # Check if target_selector is an ID selector (#id) or contains ID pattern
            is_id_selector = target_selector.strip().startswith('#')
            contains_id_pattern = any(pattern in target_selector.lower() for pattern in ['radio-', 'checkbox-', 'input-', 'button-'])
            
            # CRITICAL: For ID selectors, use them immediately (they're very reliable)
            if is_id_selector or contains_id_pattern:
                escaped_selector = self._escape_string(target_selector)
                if target_selector.startswith("page."):
                    locator_chain = [(target_selector, "playwright_locator_id")]
                else:
                    # Ensure it starts with # if it's an ID pattern
                    if contains_id_pattern and not target_selector.startswith('#'):
                        # Extract ID from pattern like "radio-1-71" -> "#radio-1-71"
                        import re
                        id_match = re.search(r'(radio|checkbox|input|button)-[\w-]+', target_selector, re.IGNORECASE)
                        if id_match:
                            escaped_selector = f"#{id_match.group(0)}"
                        else:
                            escaped_selector = f"#{target_selector}"
                    locator_chain = [(f"page.locator('{escaped_selector}')", "css_selector_id")]
                logger.info(f"[ENHANCED] ✅ Using target_selector ID selector: {escaped_selector}")
            # For non-ID selectors, prefer semantic locators when available
            elif semantic_locators:
                # Use semantic as primary, target_selector as fallback
                escaped_selector = self._escape_string(target_selector)
                if target_selector.startswith("page."):
                    locator_chain = semantic_locators + [(target_selector, "playwright_locator_fallback")]
                else:
                    locator_chain = semantic_locators + [(f"page.locator('{escaped_selector}')", "css_selector_fallback")]
                logger.info(f"[ENHANCED] Using semantic locators (primary) with target_selector as fallback: {target_selector}")
            else:
                # No semantic locators available - use target_selector
                if target_selector.startswith("page."):
                    locator_chain = [(target_selector, "playwright_locator")]
                    logger.info(f"[ENHANCED] Using target_selector as Playwright locator (no semantic available): {target_selector}")
                else:
                    escaped_selector = self._escape_string(target_selector)
                    locator_chain = [(f"page.locator('{escaped_selector}')", "css_selector")]
                    logger.info(f"[ENHANCED] Using target_selector as CSS selector (no semantic available): {escaped_selector}")
        
        # Priority 2: Use target_text if no selector
        if not locator_chain and target_text and target_text.strip():
            escaped_text = self._escape_string(target_text.strip()[:50])
            # CRITICAL: Check element_data to determine if it's a link or button
            # This ensures "Get involved" and "Join the donor registry" links use getByRole('link')
            # and "Next" button uses getByRole('button')
            tag_name = (element_data.get("tag_name") or "").lower() if element_data else ""
            role = (element_data.get("role") or "").lower() if element_data else ""
            
            if normalized_event_type == "click":
                # Determine if this is a link or button based on element_data
                is_link = tag_name == "a" or role == "link" or "link" in (action_desc or "").lower()
                is_button = tag_name == "button" or role == "button" or "button" in (action_desc or "").lower()
                
                if is_link:
                    # This is a link - prioritize link role
                    locator_chain = [
                        (f"page.getByRole('link', {{ name: '{escaped_text}' }})", "role_link"),
                        (f"page.getByText('{escaped_text}')", "text_fallback")
                    ]
                elif is_button or "next" in target_text.lower() or "button" in (action_desc or "").lower():
                    # This is a button - prioritize button role
                    locator_chain = [
                        (f"page.getByRole('button', {{ name: '{escaped_text}' }})", "role_button"),
                        (f"page.getByText('{escaped_text}')", "text_fallback")
                    ]
                else:
                    # Unknown - try both link and button, then text
                    locator_chain = [
                        (f"page.getByRole('link', {{ name: '{escaped_text}' }})", "role_link"),
                        (f"page.getByRole('button', {{ name: '{escaped_text}' }})", "role_button"),
                        (f"page.getByText('{escaped_text}')", "text_fallback")
                    ]
            else:
                locator_chain = [(f"page.getByText('{escaped_text}')", "text_fallback")]
            logger.info(f"[ENHANCED] Using target_text as locator: {escaped_text} (tag={tag_name}, role={role})")
        
        # Priority 3: Try semantic locators from element_data (if not already tried above)
        if not locator_chain:
            logger.info(f"[ENHANCED] No target_selector/target_text, trying semantic locators")
            if not semantic_locators:
                semantic_locators = self._generate_locator_fallback_chain(element_data, node)
            locator_chain = semantic_locators
        
        # Priority 4: Extract ID from action_description or target_text (e.g., "Radio 1 71" -> "#radio-1-71")
        if not locator_chain:
            action_desc = self._get_node_property(node, 'action_description')
            logger.warning(f"[ENHANCED] No locator found - target_selector={target_selector}, target_text={target_text}, action_description={action_desc}")
            
            # CRITICAL: Try to extract ID pattern from action_description or target_text
            # Patterns like "Radio 1 71", "Checkbox 91", "Input 175" should become "#radio-1-71", "#checkbox-91", "#input-175"
            import re
            id_patterns = [
                (r'radio\s+(\d+)\s+(\d+)', r'#radio-\1-\2'),  # "Radio 1 71" -> "#radio-1-71"
                (r'checkbox\s+(\d+)', r'#checkbox-\1'),  # "Checkbox 91" -> "#checkbox-91"
                (r'input\s+(\d+)', r'#input-\1'),  # "Input 175" -> "#input-175"
                (r'button\s+(\d+)', r'#button-\1'),  # "Button 123" -> "#button-123"
            ]
            
            text_to_check = (action_desc or "") + " " + (target_text or "")
            for pattern, replacement in id_patterns:
                match = re.search(pattern, text_to_check, re.IGNORECASE)
                if match:
                    id_selector = re.sub(pattern, replacement, match.group(0), flags=re.IGNORECASE)
                    locator_chain = [(f"page.locator('{id_selector}')", "extracted_id_from_description")]
                    logger.info(f"[ENHANCED] ✅ Extracted ID selector from description: {id_selector}")
                    break
            
            # Try to extract selector from action_description (e.g., "CLICK: SPAN span.slds-checkbox_faux")
            if not locator_chain and action_desc and ":" in action_desc:
                parts = action_desc.split(":", 1)
                if len(parts) > 1:
                    after_colon = parts[1].strip()
                    # Try multiple extraction strategies
                    potential_selector = None
                    
                    # Strategy 1: Get first word (simple)
                    first_word = after_colon.split()[0] if after_colon.split() else None
                    if first_word and len(first_word) > 1:
                        potential_selector = first_word
                    
                    # Strategy 2: Look for CSS selector patterns (#id, .class, tag#id, tag.class)
                    if not potential_selector or len(potential_selector) < 3:
                        import re
                        # Look for common selector patterns
                        selector_match = re.search(r'([A-Z]+\s+)?([#\.]?[\w-]+|[\w-]+\.[\w-]+|[\w-]+#[\w-]+)', after_colon)
                        if selector_match:
                            potential_selector = selector_match.group(0).strip()
                    
                    if potential_selector and len(potential_selector) > 1:
                        escaped_selector = self._escape_string(potential_selector)
                        locator_chain = [(f"page.locator('{escaped_selector}')", "extracted_from_description")]
                        logger.info(f"[ENHANCED] Extracted selector from description: {escaped_selector}")
        
        # AGGRESSIVE FALLBACK: For click/input events, ALWAYS generate code
        # Even if we don't have a perfect locator, we'll use a generic one
        if not locator_chain:
            if normalized_event_type in ["click", "input", "type"]:
                # Last resort: use a generic locator based on event type
                action_desc = self._get_node_property(node, 'action_description') or ""
                
                # Try to extract ANY selector from action_description
                if action_desc:
                    # Pattern: "CLICK: SPAN span.slds-checkbox_faux" or "FILL_INPUT: INPUT#checkbox-84"
                    if ":" in action_desc:
                        parts = action_desc.split(":", 1)
                        if len(parts) > 1:
                            # Get everything after the colon and extract first selector-like string
                            after_colon = parts[1].strip()
                            # Try to find selector patterns: #id, .class, tag, tag#id, tag.class
                            import re
                            selector_patterns = [
                                r'#[\w-]+',  # #id
                                r'\.[\w-]+',  # .class
                                r'[A-Z]+\#[\w-]+',  # TAG#id
                                r'[A-Z]+\.[\w-]+',  # TAG.class
                                r'[a-z]+\.[\w-]+',  # tag.class
                                r'[A-Z]+',  # TAG
                            ]
                            for pattern in selector_patterns:
                                match = re.search(pattern, after_colon)
                                if match:
                                    potential_selector = match.group(0)
                                    escaped_selector = self._escape_string(potential_selector)
                                    locator_chain = [(f"page.locator('{escaped_selector}')", "extracted_from_description")]
                                    logger.warning(f"[ENHANCED] Using extracted selector from description: {escaped_selector}")
                                    break
                
                # If still no locator, use a generic one based on event type
                if not locator_chain:
                    if normalized_event_type == "click":
                        # Generic button/clickable element
                        locator_chain = [(f"page.locator('button, a, [role=\"button\"]').first()", "generic_clickable")]
                    elif normalized_event_type in ["input", "type"]:
                        # Generic input field - use visible inputs to avoid hidden fields
                        locator_chain = [(f"page.locator('input:visible, textarea:visible').first()", "generic_input")]
                    logger.warning(f"[ENHANCED] Using generic locator for {event_type} (normalized: {normalized_event_type}) - no specific selector found")
            else:
                # For non-click/input events, we still need a locator
                logger.error(f"[ENHANCED] ❌ Cannot generate code for {event_type} (normalized: {normalized_event_type}) - no locator available (target_selector={target_selector}, target_text={target_text})")
                return [], None, None
        
        # Safety check: ensure we have a locator
        if not locator_chain:
            logger.error(f"[ENHANCED] ❌ No locator generated for {event_type} - cannot proceed")
            return [], None, None
        
        # Use primary locator and score quality
        locator_code, strategy = locator_chain[0]
        quality_score = self._score_selector_quality(locator_code, element_data)
        if quality_score < 0.70:
            self.weak_selectors.append({
                "step": len(code_lines),
                "selector": locator_code,
                "strategy": strategy,
                "quality": quality_score,
                "event_type": event_type
            })
        
        # Generate action based on event type (using normalized_event_type from above)
        if event_type == "navigate" or normalized_event_type == "navigate":
            url = self._get_node_property(node, 'url')
            if url:
                code_lines.append(f"  // Navigate to: {url}")
                code_lines.append(f"  await page.goto('{self._escape_string(url)}');")
                code_lines.append(f"  await page.waitForLoadState('networkidle');")
                strategy = "network_synchronization"
        
        elif normalized_event_type == "click":
            # Generate click with fallback chain and explicit waits
            click_code = self._generate_click_with_fallbacks(locator_chain, node, len(code_lines))
            code_lines.extend(click_code)
            strategy = strategy or "semantic_locator"
        
        elif normalized_event_type in ["input", "type"]:
            # CRITICAL FIX: Validate that the selector is a fillable element
            # "body", "html", "div" without context are NOT valid fill targets
            INVALID_FILL_SELECTORS = ["body", "html", "document", "window"]
            
            # Check if the current locator is invalid for filling
            current_locator = locator_chain[0][0] if locator_chain else ""
            is_invalid_fill_target = any(
                invalid in current_locator.lower() 
                for invalid in INVALID_FILL_SELECTORS
            )
            
            if is_invalid_fill_target:
                logger.warning(f"[ENHANCED] ⚠️ Invalid fill target detected: {current_locator}")
                logger.warning(f"[ENHANCED] Replacing with proper input selector")
                # Use a proper input selector instead
                locator_chain = [(f"page.locator('input:visible, textarea:visible').first()", "fixed_input")]
            
            # CRITICAL FIX: Check element type BEFORE generating fill code
            # Radio buttons, checkboxes, buttons, and links cannot be filled
            tag_name = (element_data.get("tag_name") or "").lower()
            element_type = element_data.get("type", "").lower()
            role = (element_data.get("role") or "").lower()
            
            # Check if this is actually a radio button or checkbox - those should be clicked, not filled
            is_radio_or_checkbox = (
                element_type in ["radio", "checkbox"] or 
                role in ["radio", "checkbox"] or
                tag_name in ["input"] and element_type in ["radio", "checkbox"]
            )
            
            # Check if this is a button or link - those should be clicked, not filled
            is_button_or_link = (
                tag_name in ["button", "a"] or 
                role in ["button", "link"]
            )
            
            # Check if this is a non-input element (span, div, etc.) - cannot be filled
            is_non_input = tag_name not in ["input", "textarea", "select"] and not is_radio_or_checkbox
            
            if is_radio_or_checkbox:
                logger.info(f"[ENHANCED] Converting input/fill to click for {element_type}/{role} element (radio/checkbox)")
                # Generate click instead of fill
                click_code = self._generate_click_with_fallbacks(locator_chain, node, len(code_lines))
                code_lines.extend(click_code)
                strategy = strategy or "semantic_locator"
            elif is_button_or_link:
                logger.warning(f"[ENHANCED] Attempted to fill {tag_name}/{role} element - converting to click")
                # Generate click instead of fill
                click_code = self._generate_click_with_fallbacks(locator_chain, node, len(code_lines))
                code_lines.extend(click_code)
                strategy = strategy or "semantic_locator"
            elif is_non_input:
                logger.error(f"[ENHANCED] Cannot fill {tag_name} element - skipping this action")
                code_lines.append(f"  // ERROR: Cannot fill {tag_name} element - element type mismatch, skipping")
                # Don't generate fill code for non-input elements
            else:
                # This is a valid input element - generate fill code
                value = self._get_input_value(node)
                if value and value != "***MASKED***":
                    escaped_value = self._escape_string(value)
                    fill_code = self._generate_fill_with_fallbacks(locator_chain, node, escaped_value, len(code_lines))
                    code_lines.extend(fill_code)
                else:
                    fill_code = self._generate_fill_with_fallbacks(locator_chain, node, "TEST_VALUE", len(code_lines))
                    code_lines.extend(fill_code)
                strategy = strategy or "semantic_locator"
        
        elif event_type == "select" or normalized_event_type == "select":
            value = self._get_input_value(node)
            if value:
                escaped_value = self._escape_string(value)
                code_lines.append(f"  // Select: {self._get_action_description(node)}")
                code_lines.append(f"  await {locator_code}.selectOption('{escaped_value}');")
                strategy = strategy or "semantic_locator"
        
        # Add network synchronization after clicks (simplified)
        if normalized_event_type in ["click", "submit"] or event_type in ["click_button", "submit"]:
            # Simple wait for navigation or network idle
            code_lines.append("  // Wait for navigation or network to settle")
            code_lines.append("  await page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {});")
            strategy = "network_synchronization"
        
        return code_lines, strategy, context_info
    
    def _generate_locator_fallback_chain(
        self,
        element_data: Dict[str, Any],
        node: Any
    ) -> List[Tuple[str, str]]:
        """
        Generate multiple locator strategies in priority order for fallback chain.
        IMPLEMENTED: Salesforce Experience Cloud-specific strategies based on best practices.
        
        Returns:
            List of (locator_code, strategy_name) tuples in priority order
        """
        locators = []
        
        # CRITICAL: Detect Salesforce Experience Cloud more intelligently
        url = self._get_node_property(node, 'url') or ""
        classes = (element_data.get("class") or "").split()
        attributes = element_data.get("attributes") or {}
        if isinstance(attributes, str):
            attributes = {}
        
        # Enhanced Salesforce detection
        is_salesforce = (
            any('slds-' in cls or 'lwc-' in cls for cls in classes) or
            '/s/' in url or  # Salesforce Experience Cloud URL pattern
            'salesforce' in url.lower() or
            any('data-menubar-item' in str(attr) or 'data-menulist-item' in str(attr) for attr in [classes, attributes]) or
            any('lightning-' in cls for cls in classes)  # Lightning Web Components
        )
        
        tag_name = (element_data.get("tag_name") or "").lower()
        text_content = element_data.get("text_content") or ""
        href = element_data.get("href") or ""
        title = element_data.get("title") or ""
        
        # ============================================================
        # SALESFORCE EXPERIENCE CLOUD SPECIFIC STRATEGIES
        # Based on best practices: getByTitle, href, filter({hasText}), scoping
        # ============================================================
        
        if is_salesforce:
            logger.info(f"[SALESFORCE] Generating Experience Cloud locators for {tag_name}")
            
            # PRIORITY 1: getByTitle() - Most robust for Salesforce menu items
            # Title attribute is stable and explicitly set by Salesforce
            if title and len(title) > 5 and not title.endswith('...'):
                escaped_title = self._escape_string(title[:100])
                locators.append((
                    f"page.getByTitle('{escaped_title}')",
                    "salesforce_getByTitle"
                ))
                logger.info(f"[SALESFORCE] ✅ Priority 1: getByTitle('{escaped_title[:50]}')")
            
            # PRIORITY 2: href attribute for links (very stable, route-based)
            if tag_name == "a" and href and href != "#" and not href.startswith("javascript:"):
                escaped_href = self._escape_string(href)
                # Option 2a: Simple href (if unique)
                locators.append((
                    f"page.locator('a[href=\"{escaped_href}\"]')",
                    "salesforce_href"
                ))
                # Option 2b: Scoped to header/nav (more specific)
                locators.append((
                    f"page.locator('header a[href=\"{escaped_href}\"]')",
                    "salesforce_href_scoped_header"
                ))
                logger.info(f"[SALESFORCE] ✅ Priority 2: href='{escaped_href}'")
            
            # PRIORITY 3: getByRole().filter({ hasText: '...' }) - Works with Shadow DOM
            # This is the recommended pattern for Salesforce LWC (bypasses ARIA computation issues)
            if text_content and len(text_content.strip()) > 0:
                escaped_text = self._escape_string(text_content.strip()[:100])
                
                # Determine correct role based on tag_name
                if tag_name == "a":
                    role = "link"
                elif tag_name == "button" or tag_name in ["button", "input"] and element_data.get("type") == "button":
                    role = "button"
                else:
                    role = "button"  # Default for clickable elements
                
                # Use filter({ hasText }) instead of { name: ... } - works with Shadow DOM
                locators.append((
                    f"page.getByRole('{role}').filter({{ hasText: '{escaped_text}' }})",
                    "salesforce_role_filter_hasText"
                ))
                logger.info(f"[SALESFORCE] ✅ Priority 3: getByRole('{role}').filter({{ hasText: '{escaped_text[:50]}' }})")
            
            # PRIORITY 4: Lightning Component selectors (lightning-input, lightning-button)
            # Pattern: lightning-input:has-text('Email'), lightning-button:has-text('Log In')
            if text_content and len(text_content.strip()) > 0:
                escaped_text = self._escape_string(text_content.strip()[:100])
                
                # Check if parent is a Lightning component
                parent_tag = element_data.get("parent_tag") or ""
                if "lightning-input" in parent_tag.lower() or "lightning-input" in str(classes):
                    locators.append((
                        f"page.locator('lightning-input:has-text(\"{escaped_text}\")')",
                        "salesforce_lightning_input_hasText"
                    ))
                    logger.info(f"[SALESFORCE] ✅ Priority 4a: lightning-input:has-text('{escaped_text[:50]}')")
                elif "lightning-button" in parent_tag.lower() or "lightning-button" in str(classes):
                    locators.append((
                        f"page.locator('lightning-button:has-text(\"{escaped_text}\")')",
                        "salesforce_lightning_button_hasText"
                    ))
                    logger.info(f"[SALESFORCE] ✅ Priority 4b: lightning-button:has-text('{escaped_text[:50]}')")
            
            # PRIORITY 5: data-menulist-item + text filter (for menu items)
            if isinstance(attributes, dict) and attributes.get("data-menulist-item") is not None:
                if text_content and len(text_content.strip()) > 0:
                    escaped_text = self._escape_string(text_content.strip()[:100])
                    # Scoped to header first, then global
                    locators.append((
                        f"page.locator('header a[data-menulist-item]').filter({{ hasText: '{escaped_text}' }})",
                        "salesforce_menulist_scoped"
                    ))
                    locators.append((
                        f"page.locator('a[data-menulist-item]').filter({{ hasText: '{escaped_text}' }})",
                        "salesforce_menulist_global"
                    ))
                    logger.info(f"[SALESFORCE] ✅ Priority 5: data-menulist-item + filter(hasText)")
            
            # PRIORITY 6: Combined title + href (for links)
            if tag_name == "a" and title and href and href != "#":
                escaped_title = self._escape_string(title[:100])
                escaped_href = self._escape_string(href)
                locators.append((
                    f"page.locator('a[data-menulist-item][href=\"{escaped_href}\"][title=\"{escaped_title}\"]')",
                    "salesforce_combined_title_href"
                ))
                logger.info(f"[SALESFORCE] ✅ Priority 6: Combined title + href")
            
            # PRIORITY 7: Scoped to visible dropdown
            if text_content and len(text_content.strip()) > 0:
                escaped_text = self._escape_string(text_content.strip()[:100])
                locators.append((
                    f"page.locator('.slds-dropdown-visible').locator('a').filter({{ hasText: '{escaped_text}' }})",
                    "salesforce_scoped_dropdown"
                ))
                logger.info(f"[SALESFORCE] ✅ Priority 7: Scoped to visible dropdown")
            
            # Return Salesforce-specific locators (don't continue to generic strategies)
            if locators:
                logger.info(f"[SALESFORCE] Generated {len(locators)} Salesforce-specific locators")
                return locators
        
        # ============================================================
        # GENERIC STRATEGIES (for non-Salesforce or fallback)
        # ============================================================
        
        # Priority 1: data-testid (GOLD)
        test_id = element_data.get("data_testid") or element_data.get("data-testid")
        if test_id:
            locators.append((f"page.getByTestId('{test_id}')", "testid"))
        
        # Priority 2: Role + filter({ hasText }) - Works better than { name: ... } for Shadow DOM
        if text_content and len(text_content.strip()) > 0:
            escaped_text = self._escape_string(text_content.strip()[:100])
            # Determine role
            if tag_name == "a":
                role = "link"
            elif tag_name == "button":
                role = "button"
            else:
                role = element_data.get("role") or "button"
            
            locators.append((
                f"page.getByRole('{role}').filter({{ hasText: '{escaped_text}' }})",
                "role_filter_hasText"
            ))
        
        # Priority 3: Tag + text filter
        if tag_name and text_content and len(text_content.strip()) > 0:
            escaped_text = self._escape_string(text_content.strip()[:100])
            locators.append((
                f"page.locator('{tag_name}').filter({{ hasText: '{escaped_text}' }})",
                "tag_text_filter"
            ))
        
        # Priority 4: getByLabel (for form inputs)
        label_text = element_data.get("label_text") or element_data.get("aria-label")
        if label_text and tag_name in ["input", "textarea", "select"]:
            escaped_label = self._escape_string(label_text[:100])
            locators.append((
                f"page.getByLabel('{escaped_label}')",
                "label"
            ))
        
        # Priority 5: Role + Name (traditional, may fail with Shadow DOM)
        name = (
            element_data.get("aria_label") or 
            element_data.get("aria-label") or 
            element_data.get("title") or
            element_data.get("text_content")
        )
        
        if name:
            name = ' '.join(name.split())  # Normalize whitespace
            name = name.strip()[:100]
            
            if name and len(name) > 0:
                escaped_name = self._escape_string(name)
                
                if tag_name == "a":
                    locators.append((
                        f"page.getByRole('link', {{ name: '{escaped_name}' }})",
                        "role_link_name"
                    ))
                elif tag_name == "button":
                    locators.append((
                        f"page.getByRole('button', {{ name: '{escaped_name}' }})",
                        "role_button_name"
                    ))
        
        return locators
    
    def _generate_semantic_locator(
        self,
        element_data: Dict[str, Any],
        node: Any
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate semantic locator following priority:
        1. data-testid -> getByTestId
        2. Role + Name -> getByRole
        3. Label -> getByLabel
        4. Text -> getByText
        5. Chained locator (parent + child)
        6. Filtering for duplicates
        """
        
        # Priority 1: data-testid
        test_id = element_data.get("data_testid") or element_data.get("data-testid")
        if test_id:
            return f"page.getByTestId('{test_id}')", "data_testid"
        
        # Priority 2: Role + Name (semantic locator)
        role = element_data.get("role")
        name = element_data.get("aria_label") or element_data.get("aria-label") or element_data.get("text_content")
        if role and name:
            # Clean role (button, link, textbox, etc.)
            clean_role = self._normalize_role(role)
            if clean_role:
                return f"page.getByRole('{clean_role}', {{ name: '{self._escape_string(name[:50])}' }})", "role_with_name"
        
        # Priority 3: Label (for form fields)
        label = element_data.get("label_text") or element_data.get("associated_label")
        tag_name = (element_data.get("tag_name") or "").lower()
        if label and tag_name in ["input", "select", "textarea"]:
            return f"page.getByLabel('{self._escape_string(label)}')", "label"
        
        # Priority 4: Text (for clickable elements)
        text_content = element_data.get("text_content")
        if text_content and tag_name in ["button", "a", "link"]:
            # Use chained locator if parent context exists
            parent_context = self._get_parent_context(node)
            if parent_context:
                parent_locator = self._generate_parent_locator(parent_context)
                return f"{parent_locator}.getByText('{self._escape_string(text_content[:50])}')", "chained_text"
            else:
                return f"page.getByText('{self._escape_string(text_content[:50])}')", "text"
        
        # Priority 5: Chained locator (parent + child)
        parent_context = self._get_parent_context(node)
        if parent_context:
            parent_locator = self._generate_parent_locator(parent_context)
            child_selector = self._generate_fallback_selector(element_data)
            if child_selector:
                return f"{parent_locator}.locator('{child_selector}')", "chained_locator"
        
        # Priority 6: Filtering for duplicates
        if self._has_duplicates(node, element_data):
            filter_locator = self._generate_filter_locator(element_data)
            if filter_locator:
                return filter_locator, "filtering"
        
        # Fallback: ID or name
        element_id = element_data.get("id")
        if element_id and not self._is_unstable_id(element_id):
            return f"page.locator('#{element_id}')", "id"
        
        element_name = element_data.get("name")
        if element_name and tag_name in ["input", "select", "textarea"]:
            return f"page.locator('{tag_name}[name=\"{element_name}\"]')", "name"
        
        # Last resort: CSS selector (minimal)
        css_selector = self._generate_minimal_css(element_data)
        if css_selector:
            return f"page.locator('{css_selector}')", "css_fallback"
        
        logger.warning(f"[ENHANCED] Could not generate semantic locator for element")
        return None, None
    
    def _generate_context_switch(self, context: Dict[str, Any]) -> List[str]:
        """Generate code for context switch (frame, shadow DOM)"""
        code_lines = []
        
        if context.get("type") == "frame":
            frame_selector = context.get("frame_selector")
            if frame_selector:
                code_lines.append(f"  // Switch to frame: {frame_selector}")
                code_lines.append(f"  const frame = page.frameLocator('{frame_selector}');")
                return code_lines
        
        elif context.get("type") == "shadow_dom":
            shadow_host = context.get("shadow_host")
            if shadow_host:
                code_lines.append(f"  // Access Shadow DOM: {shadow_host}")
                code_lines.append(f"  // Playwright automatically pierces open Shadow DOM")
                # Note: Playwright handles this automatically, but we document it
        
        return code_lines
    
    def _generate_network_sync(self, network_info: Dict[str, Any]) -> List[str]:
        """Generate network synchronization code"""
        code_lines = []
        
        url_pattern = network_info.get("url_pattern")
        method = network_info.get("method", "GET")
        
        if url_pattern:
            code_lines.append(f"  // Wait for network request: {method} {url_pattern}")
            code_lines.append(f"  await page.waitForResponse(response => response.url().includes('{url_pattern}') && response.request().method() === '{method}');")
        
        return code_lines
    
    def _detect_context(self, node: Any, element_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detect if element is in frame or shadow DOM"""
        metadata = self._get_node_property(node, 'metadata') or {}
        
        # Check for frame
        if metadata.get("frame_id") or metadata.get("frame_selector"):
            return {
                "type": "frame",
                "frame_selector": metadata.get("frame_selector") or f"iframe#{metadata.get('frame_id')}"
            }
        
        # Check for shadow DOM
        if metadata.get("shadow_host") or element_data.get("shadow_host"):
            return {
                "type": "shadow_dom",
                "shadow_host": metadata.get("shadow_host") or element_data.get("shadow_host")
            }
        
        return None
    
    def _detect_network_dependency(self, node: Any) -> Optional[Dict[str, Any]]:
        """Detect if action depends on network request"""
        metadata = self._get_node_property(node, 'metadata') or {}
        
        # Check if action triggers API call
        if metadata.get("triggers_api") or metadata.get("network_request"):
            return {
                "url_pattern": metadata.get("api_url") or metadata.get("network_url"),
                "method": metadata.get("http_method", "POST")
            }
        
        return None
    
    def _has_duplicates(self, node: Any, element_data: Dict[str, Any]) -> bool:
        """Check if element might have duplicates"""
        # If text content is generic or common, likely duplicates
        text = element_data.get("text_content") or ""
        common_texts = ["submit", "save", "cancel", "delete", "edit", "add", "remove"]
        if text and text.lower() in common_texts:
            return True
        
        # If no unique identifier, might have duplicates
        if not element_data.get("id") and not element_data.get("data_testid"):
            return True
        
        return False
    
    def _generate_filter_locator(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate filter locator for duplicate elements"""
        # Use getByRole with filter
        role = element_data.get("role")
        text = element_data.get("text_content")
        
        if role and text:
            clean_role = self._normalize_role(role)
            if clean_role:
                return f"page.getByRole('{clean_role}').filter({{ hasText: '{self._escape_string(text[:50])}' }})"
        
        # Use row filter for tables
        if element_data.get("parent_tag") == "tr":
            return f"page.getByRole('row').filter({{ hasText: '{self._escape_string(text[:50])}' }})"
        
        return None
    
    def _generate_parent_locator(self, parent_context: Dict[str, Any]) -> str:
        """Generate locator for parent element"""
        parent_id = parent_context.get("id")
        parent_role = parent_context.get("role")
        parent_testid = parent_context.get("data_testid")
        
        if parent_testid:
            return f"page.getByTestId('{parent_testid}')"
        elif parent_id:
            return f"page.locator('#{parent_id}')"
        elif parent_role:
            return f"page.getByRole('{parent_role}')"
        else:
            return "page"
    
    def _get_parent_context(self, node: Any) -> Optional[Dict[str, Any]]:
        """Get parent element context"""
        metadata = self._get_node_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
        return interacted_element.get("parent_element")
    
    def _normalize_role(self, role: str) -> Optional[str]:
        """Normalize role to Playwright's role list"""
        if not role:
            return None
        
        role_lower = role.lower()
        
        # Valid Playwright roles
        valid_roles = [
            "button", "link", "textbox", "checkbox", "radio", "combobox",
            "option", "heading", "img", "listbox", "menuitem", "menuitemcheckbox",
            "menuitemradio", "progressbar", "slider", "switch", "tab", "tabpanel"
        ]
        
        if role_lower in valid_roles:
            return role_lower
        
        # Map common roles
        role_map = {
            "submit": "button",
            "input": "textbox",
            "a": "link",
            "h1": "heading",
            "h2": "heading",
            "h3": "heading",
            "h4": "heading",
            "h5": "heading",
            "h6": "heading"
        }
        
        return role_map.get(role_lower)
    
    def _generate_fallback_selector(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate fallback CSS selector"""
        tag_name = (element_data.get("tag_name") or "").lower()
        element_id = element_data.get("id")
        element_class = element_data.get("class")
        
        if element_id and not self._is_unstable_id(element_id):
            return f"#{element_id}"
        elif element_class and not self._is_unstable_class(element_class):
            # Use first stable class
            stable_class = self._get_stable_class(element_class)
            if stable_class:
                return f"{tag_name}.{stable_class}"
        
        return tag_name if tag_name else None
    
    def _generate_minimal_css(self, element_data: Dict[str, Any]) -> Optional[str]:
        """Generate minimal CSS selector as last resort"""
        tag_name = (element_data.get("tag_name") or "").lower()
        element_id = element_data.get("id")
        
        if element_id and not self._is_unstable_id(element_id):
            return f"#{element_id}"
        
        return tag_name if tag_name else "div"
    
    def _is_unstable_id(self, element_id: str) -> bool:
        """Check if ID is unstable (generated by framework)"""
        unstable_patterns = [
            r'^react-', r'^vue-', r'^angular-', r'^ember-',
            r'-\d+$', r'_\d+$',  # Ends with numbers
            r'^id-\d+', r'^generated-', r'^temp-'
        ]
        
        for pattern in unstable_patterns:
            if re.match(pattern, element_id, re.IGNORECASE):
                return True
        
        return False
    
    def _is_unstable_class(self, class_name: str) -> bool:
        """Check if class name is unstable"""
        unstable_patterns = [
            r'^css-', r'^styled-', r'^makeStyles-',
            r'-\d+$', r'_\d+$'
        ]
        
        for pattern in unstable_patterns:
            if re.match(pattern, class_name, re.IGNORECASE):
                return True
        
        return False
    
    def _get_stable_class(self, class_names: str) -> Optional[str]:
        """Get first stable class from class list"""
        classes = class_names.split()
        for cls in classes:
            if not self._is_unstable_class(cls):
                return cls
        return None
    
    def _extract_element_data(self, node: Any) -> Dict[str, Any]:
        """Extract element data from node"""
        element_data = {}
        
        metadata = self._get_node_property(node, 'metadata') or {}
        interacted_element = metadata.get("interacted_element") or {}
        
            # Extract from interacted_element
        if isinstance(interacted_element, dict):
            element_data.update({
                "tag_name": interacted_element.get("tag_name"),
                "id": interacted_element.get("id"),
                "name": interacted_element.get("name"),
                "type": interacted_element.get("type"),  # CRITICAL: For radio/checkbox detection
                "class": interacted_element.get("class") or interacted_element.get("className"),
                "role": interacted_element.get("role"),
                "aria_label": interacted_element.get("aria_label") or interacted_element.get("aria-label"),
                "text_content": interacted_element.get("text_content") or interacted_element.get("textContent"),
                "data_testid": interacted_element.get("data_testid") or interacted_element.get("data-testid"),
                "label_text": interacted_element.get("label_text"),
                "associated_label": interacted_element.get("associated_label"),
                "title": interacted_element.get("title"),  # CRITICAL: For Salesforce selectors
                "href": interacted_element.get("href"),  # For link detection
                "attributes": interacted_element.get("attributes", {}),  # Full attributes dict
                "parent_tag": interacted_element.get("parent_tag") or interacted_element.get("parentTag"),  # For Lightning components
                "parent_class": interacted_element.get("parent_class") or interacted_element.get("parentClass")  # For Lightning components
            })
            
            # Extract type from attributes if not directly available
            if not element_data.get("type") and element_data.get("attributes"):
                attrs = element_data.get("attributes", {})
                element_data["type"] = attrs.get("type") or attrs.get("Type")
            
            # CRITICAL: Extract title from attributes if not directly available (for Salesforce)
            # Title is the MOST reliable selector for Salesforce buttons/links
            if not element_data.get("title") and element_data.get("attributes"):
                attrs = element_data.get("attributes", {})
                # Try multiple variations
                element_data["title"] = (
                    attrs.get("title") or 
                    attrs.get("Title") or 
                    attrs.get("TITLE") or
                    attrs.get("data-title") or
                    attrs.get("data-original-title")
                )
            
            # Also check if title is in the attributes dict directly (nested)
            if not element_data.get("title") and isinstance(element_data.get("attributes"), dict):
                attrs = element_data.get("attributes", {})
                if isinstance(attrs, dict):
                    element_data["title"] = attrs.get("title") or attrs.get("Title")
            
            # CRITICAL: Extract href from attributes if not directly available (for links)
            if not element_data.get("href") and element_data.get("attributes"):
                attrs = element_data.get("attributes", {})
                element_data["href"] = (
                    attrs.get("href") or 
                    attrs.get("Href") or 
                    attrs.get("HREF")
                )
            
            # CRITICAL: Ensure text_content is extracted properly (may be nested in children)
            # For Salesforce, text might be in child elements, so we need to get the full text
            if not element_data.get("text_content") or len(element_data.get("text_content", "").strip()) == 0:
                # Try to get from innerText or textContent in attributes
                if element_data.get("attributes"):
                    attrs = element_data.get("attributes", {})
                    element_data["text_content"] = (
                        element_data.get("text_content") or
                        attrs.get("innerText") or
                        attrs.get("textContent") or
                        attrs.get("inner_text") or
                        attrs.get("text_content")
                    )
        
        # Fallback to node properties
        if not element_data.get("tag_name"):
            element_data["tag_name"] = self._get_node_property(node, 'target_selector')
        if not element_data.get("text_content"):
            element_data["text_content"] = self._get_node_property(node, 'target_text')
        
        return element_data
    
    def _get_node_property(self, node: Any, prop: str) -> Any:
        """Get property from node (handles both object and dict)"""
        if hasattr(node, prop):
            return getattr(node, prop)
        elif isinstance(node, dict):
            return node.get(prop)
        return None
    
    def _get_input_value(self, node: Any) -> Optional[str]:
        """Get input value from node"""
        metadata = self._get_node_property(node, 'metadata') or {}
        return metadata.get("value") or metadata.get("input_value")
    
    def _get_action_description(self, node: Any) -> str:
        """Get human-readable action description - CRITICAL: Use actual element text, not generic action_description"""
        event_type = self._get_node_property(node, 'event_type')
        target_text = self._get_node_property(node, 'target_text')
        target_selector = self._get_node_property(node, 'target_selector')
        action_desc = self._get_node_property(node, 'action_description')
        
        # CRITICAL FIX: Extract actual element text from element_data, not from action_description
        # action_description might say "User clicks 'Get involved'" but the actual element is "Join the donor registry"
        element_data = self._extract_element_data(node)
        actual_text = (
            element_data.get("text_content") or 
            element_data.get("aria_label") or 
            element_data.get("aria-label") or
            element_data.get("title") or
            target_text
        )
        
        # Clean up the text
        if actual_text:
            # Remove common prefixes like "User clicks", "Click on", etc.
            cleaned_text = re.sub(r'^(user\s+)?(clicks?\s+)?(on\s+)?(the\s+)?', '', actual_text.strip(), flags=re.I)
            cleaned_text = cleaned_text.strip()
            if cleaned_text:
                # Use the actual element text
                if event_type == "click" or event_type == "click_button":
                    return f"User clicks '{cleaned_text[:50]}'"
                elif event_type in ["input", "type", "fill_field"]:
                    return f"User enters text in '{cleaned_text[:50]}'"
                else:
                    return f"User {event_type} '{cleaned_text[:50]}'"
        
        # Fallback to target_text if available
        if target_text:
            cleaned = re.sub(r'^(user\s+)?(clicks?\s+)?(on\s+)?', '', target_text.strip(), flags=re.I).strip()
            if cleaned:
                return f"User clicks '{cleaned[:50]}'"
        
        # Last resort: use action_description but clean it
        if action_desc:
            # Extract quoted text from action_description if it exists
            quoted_match = re.search(r"'([^']+)'", action_desc)
            if quoted_match:
                return f"User clicks '{quoted_match.group(1)[:50]}'"
            return action_desc
        
        # Final fallback
        return f"User {event_type}"
    
    def _generate_click_with_fallbacks(
        self,
        locator_chain: List[Tuple[str, str]],
        node: Any,
        step_index: int
    ) -> List[str]:
        """Generate simple, reliable click action"""
        code_lines = []
        desc = self._get_action_description(node)
        
        if not locator_chain:
            logger.error(f"[ENHANCED] No locator available for click action: {desc}")
            return code_lines
        
        # Use the first (best) locator - Playwright handles retries automatically
        primary_locator, primary_strategy = locator_chain[0]
        
        code_lines.append(f"  // Click: {desc}")
        code_lines.append(f"  await {primary_locator}.click({{ timeout: ACTION_TIMEOUT }});")
        
        return code_lines
    
    def _generate_fill_with_fallbacks(
        self,
        locator_chain: List[Tuple[str, str]],
        node: Any,
        value: str,
        step_index: int
    ) -> List[str]:
        """Generate simple, reliable fill action"""
        code_lines = []
        desc = self._get_action_description(node)
        escaped_value = self._escape_string(value)
        
        # Use the primary locator - Playwright handles retries automatically
        primary_locator, _ = locator_chain[0]
        
        code_lines.append(f"  // Fill: {desc}")
        code_lines.append(f"  await {primary_locator}.fill('{escaped_value}', {{ timeout: ACTION_TIMEOUT }});")
        
        return code_lines
    
    def _generate_network_wait_after_action(self) -> List[str]:
        """Generate network wait after action"""
        return [
            "    // Wait for any navigation or network activity",
            "    await Promise.race([",
            "      page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {}),",
            "      page.waitForTimeout(500)"
            "    ]);"
        ]
    
    def _score_selector_quality(self, selector: str, element_data: Dict[str, Any]) -> float:
        """
        Score selector reliability (0.0 - 1.0)
        Higher = more reliable
        """
        if 'getByTestId' in selector:
            return 0.98
        elif 'getByRole' in selector and 'name:' in selector:
            return 0.95
        elif 'getByLabel' in selector:
            return 0.90
        elif 'getByText' in selector:
            return 0.75
        elif selector.startswith('page.locator(\'#') and not self._is_unstable_id(selector.split('#')[1].split('\'')[0]):
            return 0.80
        elif '[name=' in selector:
            return 0.75
        else:
            return 0.50
    
    def _escape_string(self, s: str) -> str:
        """Escape string for JavaScript/TypeScript"""
        if not s:
            return ""
        # Escape backslashes first, then single quotes, then other special chars
        return (s.replace("\\", "\\\\")  # Escape backslashes
                .replace("'", "\\'")      # Escape single quotes
                .replace('"', '\\"')      # Escape double quotes
                .replace("\n", "\\n")     # Escape newlines
                .replace("\r", "\\r")     # Escape carriage returns
                .replace("\t", "\\t"))    # Escape tabs
    
    def _validate_script_syntax(self, script: str) -> List[str]:
        """Basic validation for common syntax errors"""
        errors = []
        
        # Check for unmatched quotes
        single_quotes = script.count("'") - script.count("\\'")
        if single_quotes % 2 != 0:
            errors.append("Unmatched single quotes detected")
        
        # Check for unmatched braces
        open_braces = script.count("{")
        close_braces = script.count("}")
        if open_braces != close_braces:
            errors.append(f"Unmatched braces: {open_braces} open, {close_braces} close")
        
        # Check for unmatched parentheses
        open_parens = script.count("(")
        close_parens = script.count(")")
        if open_parens != close_parens:
            errors.append(f"Unmatched parentheses: {open_parens} open, {close_parens} close")
        
        # Check for basic structure
        if "test('Flowstral Recorded Test', async ({ page }) => {" not in script:
            errors.append("Missing test function structure")
        
        # Check for unclosed async functions
        async_count = script.count("async")
        await_count = script.count("await")
        if async_count > 0 and await_count == 0:
            errors.append("Async function without await statements")
        
        return errors


# Global instance
_enhanced_generator = None

def get_enhanced_playwright_generator() -> EnhancedPlaywrightGenerator:
    """Get or create global EnhancedPlaywrightGenerator instance"""
    global _enhanced_generator
    if _enhanced_generator is None:
        _enhanced_generator = EnhancedPlaywrightGenerator()
    return _enhanced_generator

