#!/usr/bin/env python3
"""
Compare FlowstralTemplateEngine vs Current System for test case generation
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from dateutil import parser

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge
from app.services.engines.flowstral_template_engine import FlowstralTemplateEngine
from app.services.engines.test_case_engine import TestCaseEngine

# Full action graph from user
FULL_ACTION_GRAPH = {
    "action_graph": {
        "session_id": "test-session",
        "nodes": [
            {
                "id": "2dacc27a-9007-43b2-977c-c08cf29597d3",
                "event_type": "session_start",
                "target_selector": None,
                "target_text": None,
                "url": None,
                "url_pattern": None,
                "title": "Flowstral session started",
                "timestamp": "2025-11-23T02:24:44.000000",
                "metadata": {}
            },
            {
                "id": "a3056fad-0e04-4708-af89-f0eef41a022a",
                "event_type": "page_load",
                "target_selector": None,
                "target_text": None,
                "url": "https://www.walmart.com/",
                "url_pattern": "/",
                "title": "Page load: https://www.walmart.com/",
                "timestamp": "2025-11-23T02:24:44.100000",
                "metadata": {}
            },
            {
                "id": "cf360b57-8973-49d6-adfc-b6bb622e6c05",
                "event_type": "click",
                "target_selector": ".flex.items-center.no-underline.desktop-header-trigger.lh-title.b.navy.secondary-nav-flyout-trigger.redesign-secondary-nav-flyout-button-v2.pointer.sans-serif.bg-transparent.b--none",
                "target_text": "Services",
                "url": "https://www.walmart.com/",
                "url_pattern": "/",
                "title": "CLICK: Services",
                "timestamp": "2025-11-23T02:24:44.200000",
                "metadata": {}
            },
            {
                "id": "83b9a692-9877-49d7-8351-045b8f667b50",
                "event_type": "wcag_scan",
                "target_selector": None,
                "target_text": None,
                "url": "https://www.walmart.com/",
                "url_pattern": "/",
                "title": "User wcag_scan",
                "timestamp": "2025-11-23T02:24:44.300000",
                "metadata": {}
            },
            {
                "id": "85368679-25bb-4bd8-911e-425802c78748",
                "event_type": "click",
                "target_selector": ".mid-gray.no-underline.subcategory-item-link",
                "target_text": "Buy Tires & Schedule Installation",
                "url": "https://www.walmart.com/",
                "url_pattern": "/",
                "title": "CLICK: Buy Tires & Schedule Installation",
                "timestamp": "2025-11-23T02:24:44.400000",
                "metadata": {}
            },
            {
                "id": "3270b8c3-7c12-4cb2-bd63-ffd27976d7c0",
                "event_type": "wcag_scan",
                "target_selector": None,
                "target_text": None,
                "url": "https://www.walmart.com/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "url_pattern": "/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "title": "User wcag_scan",
                "timestamp": "2025-11-23T02:24:44.500000",
                "metadata": {}
            },
            {
                "id": "db76a31f-d165-4392-826a-9e216f0fb9b2",
                "event_type": "scroll",
                "target_selector": None,
                "target_text": None,
                "url": "https://www.walmart.com/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "url_pattern": "/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "title": "User scroll",
                "timestamp": "2025-11-23T02:24:44.600000",
                "metadata": {}
            },
            {
                "id": "1f4e905e-2f0c-402d-970a-ed5c4d3c9e05",
                "event_type": "click",
                "target_selector": ".mr2",
                "target_text": "Add",
                "url": "https://www.walmart.com/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "url_pattern": "/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "title": "CLICK: SPAN - Add",
                "timestamp": "2025-11-23T02:24:44.700000",
                "metadata": {}
            },
            {
                "id": "8cbb783d-b628-4a53-9dfe-5121f0a02aa2",
                "event_type": "click",
                "target_selector": ".mr2",
                "target_text": "Add",
                "url": "https://www.walmart.com/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "url_pattern": "/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "title": "CLICK: SPAN - Add",
                "timestamp": "2025-11-23T02:24:44.728070",
                "metadata": {}
            },
            {
                "id": "efe8d219-17df-47ac-9b52-bc9390017542",
                "event_type": "click",
                "target_selector": ".db.nowrap.cart-total.redesigned-cart-total",
                "target_text": "$296.57",
                "url": "https://www.walmart.com/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "url_pattern": "/browse/auto-tires/car-tires/91083_1077064_8752379_4838964_1063465",
                "title": "CLICK: SPAN - $296.57",
                "timestamp": "2025-11-23T02:24:49.854844",
                "metadata": {}
            },
            {
                "id": "116feec3-0fed-46f1-b831-f594767485c4",
                "event_type": "page_load",
                "target_selector": None,
                "target_text": None,
                "url": "https://www.walmart.com/cart",
                "url_pattern": "/cart",
                "title": "Page load: https://www.walmart.com/cart",
                "timestamp": "2025-11-23T02:24:49.860000",
                "metadata": {}
            },
            {
                "id": "ecaf96b9-f406-4c14-a9f4-a44995db719a",
                "event_type": "click",
                "target_selector": ".w_hhLG.w_DZvO.w_0_LY.bn.sans-serif.pa0.bg-transparent.tc.f6.black.underline.w5.mr4.mr5.pa1",
                "target_text": "Remove",
                "url": "https://www.walmart.com/cart",
                "url_pattern": "/cart",
                "title": "CLICK_BUTTON: BUTTON - Remove",
                "timestamp": "2025-11-23T02:24:49.902054",
                "metadata": {}
            },
            {
                "id": "7386f72d-6cf2-4cf6-a326-edbe6966df3b",
                "event_type": "click",
                "target_selector": "#Continue to checkout button",
                "target_text": "Continue to checkout",
                "url": "https://www.walmart.com/cart",
                "url_pattern": "/cart",
                "title": "CHECKOUT: BUTTON#Continue to checkout button - Continue to checkout",
                "timestamp": "2025-11-23T02:24:49.955067",
                "metadata": {}
            },
            {
                "id": "5213745b-f759-471f-8e4b-b9b26ddee56a",
                "event_type": "page_load",
                "target_selector": None,
                "target_text": None,
                "url": "https://identity.walmart.com/account/login",
                "url_pattern": "/account/login",
                "title": "Page load: https://identity.walmart.com/account/login",
                "timestamp": "2025-11-23T02:24:49.970767",
                "metadata": {}
            }
        ],
        "edges": [
            {
                "id": "e1",
                "from_node_id": "a3056fad-0e04-4708-af89-f0eef41a022a",
                "to_node_id": "cf360b57-8973-49d6-adfc-b6bb622e6c05",
                "action": "click",
                "description": "User clicks 'Services'"
            },
            {
                "id": "e2",
                "from_node_id": "cf360b57-8973-49d6-adfc-b6bb622e6c05",
                "to_node_id": "85368679-25bb-4bd8-911e-425802c78748",
                "action": "click",
                "description": "User clicks 'Buy Tires & Schedule Installation'"
            },
            {
                "id": "e3",
                "from_node_id": "85368679-25bb-4bd8-911e-425802c78748",
                "to_node_id": "3270b8c3-7c12-4cb2-bd63-ffd27976d7c0",
                "action": "navigate",
                "description": "Navigate to car tires page"
            },
            {
                "id": "e4",
                "from_node_id": "3270b8c3-7c12-4cb2-bd63-ffd27976d7c0",
                "to_node_id": "db76a31f-d165-4392-826a-9e216f0fb9b2",
                "action": "scroll",
                "description": "User scroll"
            },
            {
                "id": "e5",
                "from_node_id": "db76a31f-d165-4392-826a-9e216f0fb9b2",
                "to_node_id": "1f4e905e-2f0c-402d-970a-ed5c4d3c9e05",
                "action": "click",
                "description": "User clicks 'Add'"
            },
            {
                "id": "e6",
                "from_node_id": "1f4e905e-2f0c-402d-970a-ed5c4d3c9e05",
                "to_node_id": "8cbb783d-b628-4a53-9dfe-5121f0a02aa2",
                "action": "click",
                "description": "User clicks 'Add'"
            },
            {
                "id": "e7",
                "from_node_id": "8cbb783d-b628-4a53-9dfe-5121f0a02aa2",
                "to_node_id": "efe8d219-17df-47ac-9b52-bc9390017542",
                "action": "click",
                "description": "User clicks cart total '$296.57'"
            },
            {
                "id": "e8",
                "from_node_id": "efe8d219-17df-47ac-9b52-bc9390017542",
                "to_node_id": "116feec3-0fed-46f1-b831-f594767485c4",
                "action": "navigate",
                "description": "Navigate to cart page"
            },
            {
                "id": "e9",
                "from_node_id": "116feec3-0fed-46f1-b831-f594767485c4",
                "to_node_id": "ecaf96b9-f406-4c14-a9f4-a44995db719a",
                "action": "click",
                "description": "User clicks 'Remove'"
            },
            {
                "id": "e10",
                "from_node_id": "ecaf96b9-f406-4c14-a9f4-a44995db719a",
                "to_node_id": "7386f72d-6cf2-4cf6-a326-edbe6966df3b",
                "action": "click",
                "description": "User clicks 'Continue to checkout'"
            },
            {
                "id": "e11",
                "from_node_id": "7386f72d-6cf2-4cf6-a326-edbe6966df3b",
                "to_node_id": "5213745b-f759-471f-8e4b-b9b26ddee56a",
                "action": "navigate",
                "description": "Navigate to login page"
            }
        ]
    }
}

def create_action_graph_from_data(data):
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
            url_pattern=node_data.get("url_pattern"),
            title=node_data.get("title"),
            action_description=node_data.get("action_description", node_data.get("title", "")),
            metadata=node_data.get("metadata", {}),
            node_id=node_data.get("id"),
            timestamp=timestamp
        )
        action_graph.nodes.append(node)
        action_graph.node_map[node.id] = node
    
    # Create edges
    edges_data = data.get("edges", [])
    for edge_data in edges_data:
        edge = ActionGraphEdge(
            from_node_id=edge_data.get("from_node_id"),
            to_node_id=edge_data.get("to_node_id"),
            action=edge_data.get("action", "unknown"),
            description=edge_data.get("description", ""),
            edge_id=edge_data.get("id")
        )
        action_graph.edges.append(edge)
    
    return action_graph

def print_test_case(tc, prefix=""):
    """Pretty print a test case"""
    print(f"\n{prefix}Title: {tc.get('title', 'N/A')}")
    print(f"{prefix}Description: {tc.get('description', 'N/A')}")
    print(f"{prefix}Test Type: {tc.get('test_type', 'N/A')}")
    print(f"{prefix}Priority: {tc.get('priority', 'N/A')}")
    steps = tc.get('steps') or tc.get('test_steps', [])
    print(f"{prefix}Steps ({len(steps)}):")
    for step in steps:
        print(f"{prefix}  Step {step.get('step_number', '?')}: {step.get('action', 'N/A')}")
        if step.get('expected_result'):
            print(f"{prefix}    Expected: {step.get('expected_result')}")
        if step.get('element_name'):
            print(f"{prefix}    Element: {step.get('element_name')}")

def main():
    print("=" * 80)
    print("TEST CASE GENERATION COMPARISON")
    print("=" * 80)
    
    # Create action graph
    print("\n1. Creating ActionGraph from provided data...")
    ag_data = FULL_ACTION_GRAPH["action_graph"]
    action_graph = create_action_graph_from_data(ag_data)
    print(f"   ✓ Created graph with {len(action_graph.nodes)} nodes and {len(action_graph.edges)} edges")
    
    # Generate with FlowstralTemplateEngine
    print("\n2. Generating test cases with FlowstralTemplateEngine...")
    try:
        flowstral_engine = FlowstralTemplateEngine()
        flowstral_result = flowstral_engine.generate_test_cases_from_action_graph(action_graph)
        flowstral_cases = flowstral_result.get("test_cases", {}).get("manual", [])
        print(f"   ✓ Generated {len(flowstral_cases)} test case(s)")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        flowstral_cases = []
    
    # Generate with current system
    print("\n3. Generating test cases with current TestCaseEngine...")
    try:
        current_engine = TestCaseEngine()
        current_result = current_engine.generate_test_cases(
            action_graph=action_graph,
            output_format="istqb",
            optimize=True
        )
        current_cases = current_result.get("test_cases", [])
        print(f"   ✓ Generated {len(current_cases)} test case(s)")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        current_cases = []
    
    # Print comparison
    print("\n" + "=" * 80)
    print("FLOWSTRAL TEMPLATE ENGINE OUTPUT")
    print("=" * 80)
    for i, tc in enumerate(flowstral_cases, 1):
        print_test_case(tc, f"TC{i}: ")
    
    print("\n" + "=" * 80)
    print("CURRENT SYSTEM OUTPUT")
    print("=" * 80)
    for i, tc in enumerate(current_cases, 1):
        print_test_case(tc, f"TC{i}: ")
    
    # Analyze gaps
    print("\n" + "=" * 80)
    print("GAP ANALYSIS")
    print("=" * 80)
    
    print("\n1. FLUENT LANGUAGE QUALITY:")
    flowstral_actions = []
    for tc in flowstral_cases:
        for step in (tc.get('steps') or []):
            action = step.get('action', '')
            if action:
                flowstral_actions.append(action)
    
    current_actions = []
    for tc in current_cases:
        for step in (tc.get('steps') or tc.get('test_steps', [])):
            action = step.get('action', '')
            if action:
                current_actions.append(action)
    
    print(f"   Flowstral examples:")
    for action in flowstral_actions[:3]:
        print(f"     - {action}")
    print(f"   Current examples:")
    for action in current_actions[:3]:
        print(f"     - {action}")
    
    print("\n2. EXPECTED RESULTS:")
    flowstral_has_expected = any(
        step.get('expected_result')
        for tc in flowstral_cases
        for step in (tc.get('steps') or [])
    )
    current_has_expected = any(
        step.get('expected_result')
        for tc in current_cases
        for step in (tc.get('steps') or tc.get('test_steps', []))
    )
    print(f"   Flowstral: {'✓ Has expected results' if flowstral_has_expected else '✗ Missing'}")
    print(f"   Current: {'✓ Has expected results' if current_has_expected else '✗ Missing'}")
    
    print("\n3. CONTEXT ENRICHMENT:")
    print("   Flowstral: Enriches with page_label, product_type, user_role, intent")
    print("   Current: Uses basic element extraction")
    
    print("\n4. SCENARIO TEMPLATES:")
    print("   Flowstral: Matches to predefined scenario templates")
    print("   Current: Uses rule-based generation")
    
    print("\n5. PHRASE VARIATION:")
    print("   Flowstral: Random selection from phrase banks")
    print("   Current: Fixed templates")

if __name__ == "__main__":
    main()







