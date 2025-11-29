"""
Flowstral Action Graph Builder with LLM Semantic Labeling
Phase 2.2: Session segmentation, semantic action labeling, intent classification
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest

logger = logging.getLogger(__name__)


class FlowstralActionGraphBuilder:
    """
    Enhanced Action Graph Builder with LLM-based semantic labeling
    
    Responsibilities:
    1. Session segmentation - Group events into screens and steps
    2. Semantic action labeling via LLM
    3. Intent classification (Positive/Negative/Edge case)
    4. Graph construction with Screens/States as nodes
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
    
    async def build_action_graph_from_events(
        self,
        events: List[Dict[str, Any]],
        session_id: str,
        tenant_id: Optional[str] = None
    ) -> ActionGraph:
        """
        Build Action Graph from raw events with LLM-based semantic labeling
        
        Args:
            events: List of raw events from extension
            session_id: Session ID
            tenant_id: Tenant ID for LLM calls
        
        Returns:
            ActionGraph with semantically labeled nodes and edges
        """
        action_graph = ActionGraph(session_id)
        
        if not events:
            return action_graph
        
        # Step 1: Session segmentation - Group events into screens/steps
        segments = self._segment_events(events)
        logger.info(f"Segmented {len(events)} events into {len(segments)} screens/steps")
        
        # Step 2: Process each segment with LLM semantic labeling
        previous_node_id = None
        
        for segment_idx, segment in enumerate(segments):
            try:
                # Use LLM to label the segment semantically
                labeled_segment = await self._label_segment_with_llm(
                    segment=segment,
                    segment_index=segment_idx,
                    previous_segment=segments[segment_idx - 1] if segment_idx > 0 else None,
                    tenant_id=tenant_id
                )
                
                # Create node from labeled segment
                node = self._create_node_from_segment(labeled_segment, action_graph)
                
                if node:
                    action_graph.add_node(
                        event_type=node.get("event_type", "unknown"),
                        url=node.get("url", ""),
                        target_selector=node.get("target_selector"),
                        target_text=node.get("target_text"),
                        dom_snapshot_id=node.get("dom_snapshot_id"),
                        wcag_snapshot_id=node.get("wcag_snapshot_id"),
                        performance_snapshot_id=node.get("performance_snapshot_id"),
                        action_description=node.get("action_description", ""),
                        metadata=node.get("metadata", {})
                    )
                    
                    # Create edge from previous node
                    if previous_node_id:
                        # Extract locators and inputs from event data
                        events = labeled_segment.get("events", [])
                        main_event = events[-1] if events else {}
                        event_data = main_event.get("event_data", {})
                        interacted_element = event_data.get("interacted_element", {})
                        enhanced_selectors = interacted_element.get("enhanced_selectors", {})
                        
                        # Build locators dict
                        locators = {}
                        if enhanced_selectors.get("dataTestId"):
                            locators["primary"] = enhanced_selectors["dataTestId"]
                        if enhanced_selectors.get("ariaLabel"):
                            locators["fallback"] = enhanced_selectors["ariaLabel"]
                        elif enhanced_selectors.get("id"):
                            locators["fallback"] = enhanced_selectors["id"]
                        
                        # Extract sanitized inputs
                        inputs = {}
                        if event_data.get("is_masked"):
                            inputs["sanitized"] = True
                        if event_data.get("value"):
                            inputs["value"] = event_data.get("value")
                        
                        # Extract performance and a11y metrics
                        perf_metrics = {
                            "latency": event_data.get("page_metrics", {}).get("first_contentful_paint", 0),
                            "errorCodes": []
                        }
                        
                        a11y_impacts = []
                        a11y_tree = interacted_element.get("accessibility", {})
                        if a11y_tree.get("issues"):
                            a11y_impacts = a11y_tree["issues"]
                        
                        action_graph.add_edge(
                            from_node_id=previous_node_id,
                            to_node_id=action_graph.current_node.id,
                            action=labeled_segment.get("action_type", "unknown"),
                            action_type=labeled_segment.get("action_type", "unknown"),
                            description=labeled_segment.get("human_step_name", ""),
                            locators=locators,
                            inputs=inputs,
                            expected_outcome=labeled_segment.get("expected_outcome"),
                            perf_metrics=perf_metrics,
                            a11y_impacts=a11y_impacts
                        )
                    
                    previous_node_id = action_graph.current_node.id if action_graph.current_node else None
                    
            except Exception as e:
                logger.warning(f"Failed to process segment {segment_idx}: {e}", exc_info=True)
                # Continue with next segment
                continue
        
        return action_graph
    
    def _segment_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Segment events into screens/steps
        Groups events by:
        - URL changes (navigation)
        - Significant time gaps
        - Modal/form interactions
        """
        if not events:
            return []
        
        segments = []
        current_segment = {
            "events": [],
            "url": None,
            "start_time": None,
            "end_time": None
        }
        
        for event in events:
            event_data = event.get("event_data", {})
            event_url = event_data.get("url", "")
            event_type = event.get("event_type", "")
            timestamp = event.get("timestamp", 0)
            
            # Check if this is a new screen (navigation)
            if event_type == "navigate" or event_type == "page_load":
                # Save current segment if it has events
                if current_segment["events"]:
                    segments.append(current_segment)
                
                # Start new segment
                current_segment = {
                    "events": [event],
                    "url": event_url,
                    "start_time": timestamp,
                    "end_time": timestamp
                }
            else:
                # Add to current segment
                current_segment["events"].append(event)
                current_segment["end_time"] = timestamp
                
                # Check for significant time gap (more than 5 seconds)
                if len(current_segment["events"]) > 1:
                    prev_timestamp = current_segment["events"][-2].get("timestamp", 0)
                    if timestamp - prev_timestamp > 5000:
                        # Time gap detected - start new segment
                        segments.append(current_segment)
                        current_segment = {
                            "events": [event],
                            "url": event_url,
                            "start_time": timestamp,
                            "end_time": timestamp
                        }
        
        # Add final segment
        if current_segment["events"]:
            segments.append(current_segment)
        
        return segments
    
    async def _label_segment_with_llm(
        self,
        segment: Dict[str, Any],
        segment_index: int,
        previous_segment: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Use LLM to semantically label a segment
        
        Returns:
            {
                "action_type": "Login" | "Search" | "AddToCart" | etc,
                "human_step_name": "User logs in with valid credentials",
                "intent": "Positive" | "Negative" | "Edge case",
                "expected_outcome": "User is redirected to dashboard"
            }
        """
        events = segment.get("events", [])
        if not events:
            return {
                "action_type": "UNKNOWN",
                "human_step_name": "Unknown action",
                "intent": "Positive",
                "expected_outcome": None
            }
        
        # Compress event data for LLM
        compressed_events = []
        for event in events[:10]:  # Limit to first 10 events per segment
            event_data = event.get("event_data", {})
            compressed_events.append({
                "event_type": event.get("event_type"),
                "url": event_data.get("url"),
                "action_description": event_data.get("action_description"),
                "semantic_action": event_data.get("semantic_action"),  # From extension
                "interacted_element": {
                    "tag": event_data.get("interacted_element", {}).get("tag_name"),
                    "text": event_data.get("interacted_element", {}).get("text_content", "")[:50]
                } if event_data.get("interacted_element") else None
            })
        
        # Build prompt for LLM
        previous_context = ""
        if previous_segment:
            prev_events = previous_segment.get("events", [])
            if prev_events:
                prev_desc = prev_events[-1].get("event_data", {}).get("action_description", "")
                previous_context = f"Previous step: {prev_desc}\n"
        
        prompt = f"""Analyze this user interaction segment and provide semantic labeling:

{previous_context}Current segment events:
{json.dumps(compressed_events, indent=2)}

Provide a JSON response with:
{{
  "action_type": "One of: Login, Logout, Search, AddToCart, Checkout, SubmitForm, NavigateToPage, Filter, Select, ClickButton, FillInput, or UNKNOWN",
  "human_step_name": "Clear, human-readable description of what the user is doing (e.g., 'User logs in with valid credentials')",
  "intent": "One of: Positive, Negative, Edge case",
  "expected_outcome": "What should happen after this action (e.g., 'User is redirected to dashboard')"
}}

Respond with ONLY valid JSON, no explanations."""
        
        try:
            gen_request = GenerationRequest(
                prompt=prompt,
                mode="ui",
                validate_json=True,
                task_type="action_labeling"
            )
            
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            if result and result.response:
                # Parse JSON response
                try:
                    labeled = json.loads(result.response)
                    # Merge with segment data
                    labeled.update({
                        "url": segment.get("url"),
                        "events": segment.get("events"),
                        "start_time": segment.get("start_time"),
                        "end_time": segment.get("end_time")
                    })
                    return labeled
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse LLM response as JSON: {result.response}")
            
        except Exception as e:
            logger.warning(f"LLM labeling failed: {e}", exc_info=True)
        
        # Fallback: Use semantic_action from extension if available
        fallback_action = events[0].get("event_data", {}).get("semantic_action", "UNKNOWN")
        return {
            "action_type": fallback_action,
            "human_step_name": events[0].get("event_data", {}).get("action_description", "Unknown action"),
            "intent": "Positive",
            "expected_outcome": None,
            "url": segment.get("url"),
            "events": segment.get("events"),
            "start_time": segment.get("start_time"),
            "end_time": segment.get("end_time")
        }
    
    def _create_node_from_segment(
        self,
        labeled_segment: Dict[str, Any],
        action_graph: ActionGraph
    ) -> Optional[Dict[str, Any]]:
        """
        Create Action Graph node from labeled segment
        """
        events = labeled_segment.get("events", [])
        if not events:
            return None
        
        # Use the most significant event (usually the last one)
        main_event = events[-1]
        event_data = main_event.get("event_data", {})
        interacted_element = event_data.get("interacted_element", {})
        
        # Extract metadata
        metadata = {
            "action_type": labeled_segment.get("action_type"),
            "intent": labeled_segment.get("intent"),
            "semantic_action": event_data.get("semantic_action"),
            "framework": interacted_element.get("framework"),
            "component_hierarchy": interacted_element.get("component_hierarchy", [])
        }
        
        # Extract selectors
        target_selector = interacted_element.get("selector") or interacted_element.get("enhanced_selectors", {}).get("dataTestId")
        target_text = interacted_element.get("text_content", "")[:100]
        
        return {
            "event_type": main_event.get("event_type", "unknown"),
            "url": labeled_segment.get("url") or event_data.get("url", ""),
            "target_selector": target_selector,
            "target_text": target_text,
            "dom_snapshot_id": None,  # Will be set by orchestrator
            "wcag_snapshot_id": None,  # Will be set by orchestrator
            "performance_snapshot_id": None,  # Will be set by orchestrator
            "action_description": labeled_segment.get("human_step_name", event_data.get("action_description", "")),
            "metadata": metadata
        }


# Global builder instance
flowstral_action_graph_builder = FlowstralActionGraphBuilder()

