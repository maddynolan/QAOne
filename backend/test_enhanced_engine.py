"""
Test Enhanced Test Case Engine
Tests the deterministic engine without LLM calls.
Shows ISTQB and Gherkin formats with quality metrics.
"""

import asyncio
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(name)s - %(message)s'
)

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge
from app.services.engines.test_case_engine import TestCaseEngine


def create_sample_action_graph() -> ActionGraph:
    """Create a sample action graph for testing (e-commerce checkout flow)"""
    graph = ActionGraph(session_id="test-session-123")
    
    # Nodes representing pages/screens
    node1 = ActionGraphNode(
        node_id="node1",
        event_type="navigate",
        url_pattern="https://example.com/products",
        url="https://example.com/products",
        action_description="Navigate to products page",
        title="Products Page",
        timestamp=datetime.utcnow()
    )
    
    node2 = ActionGraphNode(
        node_id="node2",
        event_type="click",
        url_pattern="https://example.com/products",
        url="https://example.com/products",
        target_selector="button[data-test='add-to-cart']",
        action_description="Click add to cart button",
        title="Products Page",
        timestamp=datetime.utcnow()
    )
    
    node3 = ActionGraphNode(
        node_id="node3",
        event_type="navigate",
        url_pattern="https://example.com/cart",
        url="https://example.com/cart",
        action_description="Navigate to cart page",
        title="Shopping Cart",
        timestamp=datetime.utcnow()
    )
    
    node4 = ActionGraphNode(
        node_id="node4",
        event_type="click",
        url_pattern="https://example.com/cart",
        url="https://example.com/cart",
        target_selector="button[data-test='checkout']",
        action_description="Click checkout button",
        title="Shopping Cart",
        timestamp=datetime.utcnow()
    )
    
    node5 = ActionGraphNode(
        node_id="node5",
        event_type="navigate",
        url_pattern="https://example.com/checkout",
        url="https://example.com/checkout",
        action_description="Navigate to checkout page",
        title="Checkout Page",
        timestamp=datetime.utcnow()
    )
    
    node6 = ActionGraphNode(
        node_id="node6",
        event_type="input",
        url_pattern="https://example.com/checkout",
        url="https://example.com/checkout",
        target_selector="input[name='email']",
        action_description="Enter email address",
        title="Checkout Page",
        timestamp=datetime.utcnow()
    )
    
    node7 = ActionGraphNode(
        node_id="node7",
        event_type="input",
        url_pattern="https://example.com/checkout",
        url="https://example.com/checkout",
        target_selector="input[name='card-number']",
        action_description="Enter card number",
        title="Checkout Page",
        timestamp=datetime.utcnow()
    )
    
    node8 = ActionGraphNode(
        node_id="node8",
        event_type="click",
        url_pattern="https://example.com/checkout",
        url="https://example.com/checkout",
        target_selector="button[type='submit']",
        action_description="Submit payment",
        title="Checkout Page",
        timestamp=datetime.utcnow()
    )
    
    node9 = ActionGraphNode(
        node_id="node9",
        event_type="navigate",
        url_pattern="https://example.com/confirmation",
        url="https://example.com/confirmation",
        action_description="Navigate to confirmation page",
        title="Order Confirmation",
        timestamp=datetime.utcnow()
    )
    
    graph.nodes = [node1, node2, node3, node4, node5, node6, node7, node8, node9]
    
    # Edges representing actions
    edge1 = ActionGraphEdge(
        edge_id="edge1",
        from_node_id="node1",
        to_node_id="node2",
        action="click",
        description="User clicks add to cart button",
        locators={"primary": "button[data-test='add-to-cart']"},
        expected_outcome="Product added to cart"
    )
    
    edge2 = ActionGraphEdge(
        edge_id="edge2",
        from_node_id="node2",
        to_node_id="node3",
        action="navigate",
        description="Navigate to shopping cart",
        expected_outcome="Cart page displayed"
    )
    
    edge3 = ActionGraphEdge(
        edge_id="edge3",
        from_node_id="node3",
        to_node_id="node4",
        action="click",
        description="User clicks checkout button",
        locators={"primary": "button[data-test='checkout']"},
        expected_outcome="Navigate to checkout"
    )
    
    edge4 = ActionGraphEdge(
        edge_id="edge4",
        from_node_id="node4",
        to_node_id="node5",
        action="navigate",
        description="Navigate to checkout page",
        expected_outcome="Checkout page displayed"
    )
    
    edge5 = ActionGraphEdge(
        edge_id="edge5",
        from_node_id="node5",
        to_node_id="node6",
        action="input",
        description="User enters email address",
        locators={"primary": "input[name='email']"},
        inputs={"value": "user@example.com"},
        expected_outcome="Email field filled"
    )
    
    edge6 = ActionGraphEdge(
        edge_id="edge6",
        from_node_id="node6",
        to_node_id="node7",
        action="input",
        description="User enters card number",
        locators={"primary": "input[name='card-number']"},
        inputs={"value": "4111111111111111"},
        expected_outcome="Card number field filled"
    )
    
    edge7 = ActionGraphEdge(
        edge_id="edge7",
        from_node_id="node7",
        to_node_id="node8",
        action="click",
        description="User clicks submit payment button",
        locators={"primary": "button[type='submit']"},
        expected_outcome="Payment form submitted"
    )
    
    edge8 = ActionGraphEdge(
        edge_id="edge8",
        from_node_id="node8",
        to_node_id="node9",
        action="navigate",
        description="Navigate to confirmation page",
        expected_outcome="Order confirmation page displayed"
    )
    
    graph.edges = [edge1, edge2, edge3, edge4, edge5, edge6, edge7, edge8]
    
    # Build node map
    graph.node_map = {node.id: node for node in graph.nodes}
    
    return graph


def print_istqb_format(test_case: Dict[str, Any]):
    """Print test case in ISTQB format"""
    print("\n" + "="*80)
    print("ISTQB FORMAT")
    print("="*80)
    print(f"\nTest Case ID: {test_case.get('test_case_id', 'N/A')}")
    print(f"Title: {test_case.get('title', 'N/A')}")
    print(f"Description: {test_case.get('description', 'N/A')}")
    print(f"Priority: {test_case.get('priority', 'N/A')}")
    print(f"Test Type: {test_case.get('test_type', 'N/A')}")
    print(f"Tags: {', '.join(test_case.get('tags', []))}")
    
    print(f"\nPreconditions:")
    for precond in test_case.get('preconditions', []):
        print(f"  - {precond}")
    
    print(f"\nTest Steps:")
    # Check both "steps" and "test_steps" keys (ISTQB uses "test_steps")
    steps = test_case.get("test_steps", test_case.get("steps", []))
    print(f"  [DEBUG] Found {len(steps)} steps (keys: steps={len(test_case.get('steps', []))}, test_steps={len(test_case.get('test_steps', []))})")
    for step in steps:
        print(f"\n  Step {step.get('step_number', 'N/A')}:")
        print(f"    Action: {step.get('action', 'N/A')}")
        if step.get('test_data'):
            print(f"    Test Data: {step.get('test_data')}")
        if step.get('selector'):
            print(f"    Selector: {step.get('selector')}")
        print(f"    Expected Result: {step.get('expected_result', 'N/A')}")
    
    print(f"\nPostconditions:")
    for postcond in test_case.get('postconditions', []):
        print(f"  - {postcond}")
    
    # Quality metrics
    if 'confidence_score' in test_case:
        print(f"\nQuality Metrics:")
        print(f"  Confidence Score: {test_case.get('confidence_score', 0.0):.2f}")
        if 'quality_metrics' in test_case:
            metrics = test_case['quality_metrics']
            print(f"  Assertion Coverage: {metrics.get('assertion_coverage', 0.0):.2f}")
            print(f"  Element Identification Quality: {metrics.get('element_identification_quality', 0.0):.2f}")
            print(f"  Completeness: {metrics.get('completeness', 0.0):.2f}")
        print(f"  Requires Manual Review: {test_case.get('requires_manual_review', False)}")


def print_gherkin_format(test_case: Dict[str, Any], feature_name: str = "E-commerce Checkout"):
    """Print test case in Gherkin format"""
    print("\n" + "="*80)
    print("GHERKIN FORMAT")
    print("="*80)
    
    from app.services.engines.standards_compliance import StandardsCompliance
    standards = StandardsCompliance()
    gherkin = standards.format_gherkin(test_case, feature_name)
    
    print("\n" + gherkin)


def main():
    """Main test function"""
    print("="*80)
    print("ENHANCED TEST CASE ENGINE - DETERMINISTIC MODE (NO LLM)")
    print("="*80)
    print("\nCreating sample action graph (e-commerce checkout flow)...")
    
    # Create sample action graph
    action_graph = create_sample_action_graph()
    print(f"✅ Created action graph: {len(action_graph.nodes)} nodes, {len(action_graph.edges)} edges")
    
    # Debug: Print edge connections
    print("\n📋 Edge Connections:")
    for edge in action_graph.edges:
        from_node = action_graph.node_map.get(edge.from_node_id)
        to_node = action_graph.node_map.get(edge.to_node_id)
        print(f"  {edge.from_node_id} ({from_node.title if from_node else 'N/A'}) -> {edge.to_node_id} ({to_node.title if to_node else 'N/A'}) [{edge.action}]")
    
    # Create engine
    print("\nInitializing Test Case Engine...")
    engine = TestCaseEngine()
    
    # Generate test cases in ISTQB format
    print("\n" + "="*80)
    print("GENERATING TEST CASES (ISTQB FORMAT)")
    print("="*80)
    result_istqb = engine.generate_test_cases(
        action_graph=action_graph,
        dom_snapshots=None,
        output_format="istqb",
        optimize=True
    )
    
    print(f"\n✅ Generated {len(result_istqb['test_cases'])} test cases")
    print(f"⏱️  Generation time: {result_istqb.get('generation_time_seconds', 0):.2f} seconds")
    
    # Print statistics
    stats = result_istqb.get('statistics', {})
    print(f"\n📊 Statistics:")
    print(f"  Total test cases: {stats.get('total_test_cases', 0)}")
    print(f"  Average confidence: {stats.get('average_confidence', 0.0):.2f}")
    print(f"  Average steps per test: {stats.get('average_steps', 0):.1f}")
    print(f"  High confidence count: {stats.get('high_confidence_count', 0)}")
    print(f"  Requires review count: {stats.get('requires_review_count', 0)}")
    print(f"  Scenarios analyzed: {stats.get('scenarios_analyzed', 0)}")
    print(f"  Intents recognized: {stats.get('intents_recognized', 0)}")
    print(f"  Critical paths: {stats.get('critical_paths', 0)}")
    
    # Print first test case in ISTQB format
    if result_istqb['test_cases']:
        tc = result_istqb['test_cases'][0]
        # Debug: Print raw test case structure
        print(f"\n[DEBUG] Test case keys: {list(tc.keys())}")
        print(f"[DEBUG] Steps key exists: {'steps' in tc}, test_steps key exists: {'test_steps' in tc}")
        if 'steps' in tc:
            print(f"[DEBUG] Steps count: {len(tc['steps'])}, first step: {tc['steps'][0] if tc['steps'] else 'N/A'}")
        if 'test_steps' in tc:
            print(f"[DEBUG] Test_steps count: {len(tc['test_steps'])}, first step: {tc['test_steps'][0] if tc['test_steps'] else 'N/A'}")
        print_istqb_format(tc)
    
    # Generate test cases in Gherkin format
    print("\n" + "="*80)
    print("GENERATING TEST CASES (GHERKIN FORMAT)")
    print("="*80)
    result_gherkin = engine.generate_test_cases(
        action_graph=action_graph,
        dom_snapshots=None,
        output_format="gherkin",
        optimize=True
    )
    
    # Print first test case in Gherkin format
    if result_gherkin['test_cases']:
        print_gherkin_format(result_gherkin['test_cases'][0].get('test_case', result_gherkin['test_cases'][0]))
    
    # Show all test cases summary
    print("\n" + "="*80)
    print("ALL TEST CASES SUMMARY")
    print("="*80)
    for i, tc in enumerate(result_istqb['test_cases'], 1):
        print(f"\nTest Case {i}:")
        print(f"  ID: {tc.get('test_case_id', 'N/A')}")
        print(f"  Title: {tc.get('title', 'N/A')}")
        print(f"  Priority: {tc.get('priority', 'N/A')}")
        print(f"  Steps: {len(tc.get('steps', []))}")
        print(f"  Confidence: {tc.get('confidence_score', 0.0):.2f}")
        print(f"  Requires Review: {tc.get('requires_manual_review', False)}")
    
    print("\n" + "="*80)
    print("✅ TEST COMPLETE - All test cases generated using deterministic engine (NO LLM)")
    print("="*80)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

