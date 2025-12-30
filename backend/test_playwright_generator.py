#!/usr/bin/env python3
"""
Test script to generate Playwright code from action graph
Run this to verify the enhanced playwright generator works correctly
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from dateutil import parser

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode
from app.services.flowstral.enhanced_playwright_generator import get_enhanced_playwright_generator

# Sample action graph data based on user's scenario (checkboxes, inputs, clicks)
SAMPLE_ACTION_GRAPH = {
    "session_id": "test-session-playwright",
    "nodes": [
        {
            "id": "node-1",
            "event_type": "session_start",
            "target_selector": None,
            "target_text": None,
            "url": None,
            "action_description": "Session started",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {}
        },
        {
            "id": "node-2",
            "event_type": "navigate",
            "target_selector": None,
            "target_text": None,
            "url": "https://my.nmdp.org/s/?language=en_US",
            "action_description": "Navigate to page",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {}
        },
        {
            "id": "node-3",
            "event_type": "click",
            "target_selector": "span.slds-checkbox_faux",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "CLICK: SPAN span.slds-checkbox_faux",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "interacted_element": {
                    "tag_name": "span",
                    "class": "slds-checkbox_faux",
                    "text_content": None
                }
            }
        },
        {
            "id": "node-4",
            "event_type": "click",
            "target_selector": "INPUT#checkbox-84",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "CLICK: INPUT#checkbox-84",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "interacted_element": {
                    "tag_name": "input",
                    "id": "checkbox-84",
                    "type": "checkbox",
                    "name": "Blood_Cancer_or_Disorder__c"
                }
            }
        },
        {
            "id": "node-5",
            "event_type": "input",
            "target_selector": "INPUT#checkbox-84",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "FILL_INPUT: INPUT#checkbox-84[Blood_Cancer_or_Disorder__c]",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "value": "true",
                "interacted_element": {
                    "tag_name": "input",
                    "id": "checkbox-84",
                    "type": "checkbox",
                    "name": "Blood_Cancer_or_Disorder__c"
                }
            }
        },
        {
            "id": "node-6",
            "event_type": "click",
            "target_selector": "span.slds-checkbox_faux",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "CLICK: SPAN span.slds-checkbox_faux",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "interacted_element": {
                    "tag_name": "span",
                    "class": "slds-checkbox_faux"
                }
            }
        },
        {
            "id": "node-7",
            "event_type": "click",
            "target_selector": "INPUT#checkbox-87",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "CLICK: INPUT#checkbox-87",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "interacted_element": {
                    "tag_name": "input",
                    "id": "checkbox-87",
                    "type": "checkbox",
                    "name": "Brain_Injury_Concussion_or_Surgery__c"
                }
            }
        },
        {
            "id": "node-8",
            "event_type": "input",
            "target_selector": "INPUT#checkbox-87",
            "target_text": None,
            "url": "https://my.nmdp.org/s/create-account-medical?language=en_US",
            "action_description": "FILL_INPUT: INPUT#checkbox-87[Brain_Injury_Concussion_or_Surgery__c]",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {
                "value": "true",
                "interacted_element": {
                    "tag_name": "input",
                    "id": "checkbox-87",
                    "type": "checkbox",
                    "name": "Brain_Injury_Concussion_or_Surgery__c"
                }
            }
        },
        {
            "id": "node-9",
            "event_type": "session_end",
            "target_selector": None,
            "target_text": None,
            "url": None,
            "action_description": "Session ended",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": {}
        }
    ],
    "edges": []
}


def create_action_graph_from_data(data: dict) -> ActionGraph:
    """Create ActionGraph from provided data"""
    action_graph = ActionGraph(data.get("session_id", "test-session"))
    
    # Create nodes
    nodes_data = data.get("nodes", [])
    for node_data in nodes_data:
        try:
            timestamp = parser.parse(node_data.get("timestamp", datetime.utcnow().isoformat()))
        except:
            timestamp = datetime.utcnow()
        
        node = ActionGraphNode(
            event_type=node_data.get("event_type", "unknown"),
            target_selector=node_data.get("target_selector"),
            target_text=node_data.get("target_text"),
            url=node_data.get("url"),
            action_description=node_data.get("action_description", ""),
            metadata=node_data.get("metadata", {}),
            node_id=node_data.get("id"),
            timestamp=timestamp
        )
        action_graph.nodes.append(node)
        action_graph.node_map[node.id] = node
    
    return action_graph


async def test_playwright_generation():
    """Test Playwright script generation"""
    print("=" * 80)
    print("TESTING ENHANCED PLAYWRIGHT GENERATOR")
    print("=" * 80)
    print()
    
    # Create action graph
    print("Creating action graph from sample data...")
    action_graph = create_action_graph_from_data(SAMPLE_ACTION_GRAPH)
    print(f"✓ Created action graph with {len(action_graph.nodes)} nodes")
    print()
    
    # Print node details
    print("Action Graph Nodes:")
    print("-" * 80)
    for i, node in enumerate(action_graph.nodes, 1):
        print(f"Node {i}:")
        print(f"  Event Type: {node.event_type}")
        print(f"  Target Selector: {node.target_selector}")
        print(f"  Target Text: {node.target_text}")
        print(f"  Action Description: {node.action_description}")
        print(f"  URL: {node.url}")
        print()
    
    # Generate Playwright script
    print("Generating Playwright script...")
    print("-" * 80)
    generator = get_enhanced_playwright_generator()
    result = await generator.generate_script(
        action_graph=action_graph,
        dom_snapshots=[],
        raw_events=None
    )
    
    print()
    print("=" * 80)
    print("GENERATED PLAYWRIGHT SCRIPT")
    print("=" * 80)
    print()
    print(result.get("script", ""))
    print()
    print("=" * 80)
    print("GENERATION STATISTICS")
    print("=" * 80)
    print(f"Action Count: {result.get('action_count', 0)}")
    print(f"Total Nodes: {result.get('total_nodes', 0)}")
    print(f"Generation Time: {result.get('generation_time_ms', 0):.0f}ms")
    print(f"Strategies Used: {', '.join(result.get('strategies_used', []))}")
    print()
    
    if result.get("warnings"):
        print("Warnings:")
        for warning in result.get("warnings", []):
            print(f"  - {warning}")
        print()
    
    if result.get("weak_selectors"):
        print(f"Weak Selectors ({len(result.get('weak_selectors', []))}):")
        for weak in result.get("weak_selectors", [])[:5]:
            print(f"  - Step {weak.get('step')}: {weak.get('selector')} (quality: {weak.get('quality', 0):.0%})")
        print()
    
    return result


if __name__ == "__main__":
    asyncio.run(test_playwright_generation())



