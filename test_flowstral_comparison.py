#!/usr/bin/env python3
"""
Test script to compare FlowstralTemplateEngine output vs current system
"""

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.services.flowstral.flowstral_action_graph import ActionGraph
from app.services.engines.flowstral_template_engine import FlowstralTemplateEngine
from app.services.engines.test_case_engine import TestCaseEngine

# Sample action graph from user
action_graph_data = {
    "session_id": "test-session",
    "nodes": [
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
            "from_node_id": "8cbb783d-b628-4a53-9dfe-5121f0a02aa2",
            "to_node_id": "efe8d219-17df-47ac-9b52-bc9390017542",
            "action": "click",
            "description": "User clicks cart total"
        },
        {
            "id": "e2",
            "from_node_id": "efe8d219-17df-47ac-9b52-bc9390017542",
            "to_node_id": "ecaf96b9-f406-4c14-a9f4-a44995db719a",
            "action": "navigate",
            "description": "Navigate to cart"
        },
        {
            "id": "e3",
            "from_node_id": "ecaf96b9-f406-4c14-a9f4-a44995db719a",
            "to_node_id": "7386f72d-6cf2-4cf6-a326-edbe6966df3b",
            "action": "click",
            "description": "User clicks Remove"
        },
        {
            "id": "e4",
            "from_node_id": "7386f72d-6cf2-4cf6-a326-edbe6966df3b",
            "to_node_id": "5213745b-f759-471f-8e4b-b9b26ddee56a",
            "action": "click",
            "description": "User clicks Continue to checkout"
        }
    ]
}

def create_action_graph_from_data(data):
    """Create ActionGraph from provided data"""
    action_graph = ActionGraph(data.get("session_id", "test-session"))
    
    # Load nodes
    nodes_data = data.get("nodes", [])
    edges_data = data.get("edges", [])
    
    action_graph.load_from_session_data(nodes_data=nodes_data, edges_data=edges_data)
    
    return action_graph

def generate_with_flowstral_engine(action_graph):
    """Generate test cases using FlowstralTemplateEngine"""
    engine = FlowstralTemplateEngine()
    result = engine.generate_test_cases_from_action_graph(action_graph)
    return result

def generate_with_current_system(action_graph):
    """Generate test cases using current TestCaseEngine"""
    engine = TestCaseEngine()
    result = engine.generate_test_cases(
        action_graph=action_graph,
        output_format="istqb",
        optimize=True
    )
    return result

def print_comparison(flowstral_result, current_result):
    """Print comparison of results"""
    print("=" * 80)
    print("FLOWSTRAL TEMPLATE ENGINE OUTPUT")
    print("=" * 80)
    
    flowstral_cases = flowstral_result.get("test_cases", {}).get("manual", [])
    for i, tc in enumerate(flowstral_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"  Title: {tc.get('title', 'N/A')}")
        print(f"  Description: {tc.get('description', 'N/A')}")
        print(f"  Test Type: {tc.get('test_type', 'N/A')}")
        print(f"  Priority: {tc.get('priority', 'N/A')}")
        print(f"  Steps ({len(tc.get('steps', []))}):")
        for step in tc.get('steps', []):
            print(f"    Step {step.get('step_number', '?')}: {step.get('action', 'N/A')}")
            if step.get('expected_result'):
                print(f"      Expected: {step.get('expected_result')}")
    
    print("\n" + "=" * 80)
    print("CURRENT SYSTEM OUTPUT")
    print("=" * 80)
    
    current_cases = current_result.get("test_cases", [])
    for i, tc in enumerate(current_cases, 1):
        print(f"\nTest Case {i}:")
        print(f"  Title: {tc.get('title', 'N/A')}")
        print(f"  Description: {tc.get('description', 'N/A')}")
        print(f"  Priority: {tc.get('priority', 'N/A')}")
        steps = tc.get('steps') or tc.get('test_steps', [])
        print(f"  Steps ({len(steps)}):")
        for step in steps:
            print(f"    Step {step.get('step_number', '?')}: {step.get('action', 'N/A')}")
            if step.get('expected_result'):
                print(f"      Expected: {step.get('expected_result')}")
    
    print("\n" + "=" * 80)
    print("COMPARISON & GAPS")
    print("=" * 80)
    
    # Analyze gaps
    print("\n1. FLUENT LANGUAGE:")
    print("   Flowstral: Uses natural phrases with variation")
    print("   Current: May use more technical/robotic language")
    
    print("\n2. EXPECTED RESULTS:")
    flowstral_has_expected = any(
        step.get('expected_result') 
        for tc in flowstral_cases 
        for step in tc.get('steps', [])
    )
    current_has_expected = any(
        step.get('expected_result')
        for tc in current_cases
        for step in (tc.get('steps') or tc.get('test_steps', []))
    )
    print(f"   Flowstral: {'✓ Has expected results' if flowstral_has_expected else '✗ Missing expected results'}")
    print(f"   Current: {'✓ Has expected results' if current_has_expected else '✗ Missing expected results'}")
    
    print("\n3. CONTEXT VARIABLES:")
    print("   Flowstral: Enriches with page_label, product_type, user_role, intent")
    print("   Current: May not use all context variables")
    
    print("\n4. SCENARIO TEMPLATES:")
    print("   Flowstral: Matches scenarios to predefined templates")
    print("   Current: Uses rule-based generation")
    
    print("\n5. PHRASE VARIATION:")
    print("   Flowstral: Random selection from phrase banks prevents repetition")
    print("   Current: May repeat same phrases")

if __name__ == "__main__":
    # Load full action graph from user's data
    with open("action_graph_full.json", "w") as f:
        json.dump(action_graph_data, f, indent=2)
    
    print("Creating action graph...")
    action_graph = create_action_graph_from_data(action_graph_data)
    
    print("Generating with FlowstralTemplateEngine...")
    flowstral_result = generate_with_flowstral_engine(action_graph)
    
    print("Generating with current system...")
    try:
        current_result = generate_with_current_system(action_graph)
    except Exception as e:
        print(f"Error with current system: {e}")
        current_result = {"test_cases": []}
    
    print_comparison(flowstral_result, current_result)




