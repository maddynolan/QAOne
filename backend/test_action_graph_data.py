"""
Test script to verify action graph data extraction
Checks if edge descriptions and node target_text contain the expected DOM text
"""
import asyncio
import json
import sys
from app.services.flowstral.flowstral_session import FlowstralSessionManager
from app.services.flowstral.flowstral_action_graph import ActionGraph

async def test_action_graph_data(session_id: str):
    """Test what data is in the action graph"""
    manager = FlowstralSessionManager()
    session = manager.get_session(session_id)
    
    if not session:
        print(f"❌ Session {session_id} not found")
        return
    
    # Get action graph
    action_graph_dict = session.get_action_graph()
    action_graph = ActionGraph(session_id)
    nodes_data = action_graph_dict.get("nodes", [])
    edges_data = action_graph_dict.get("edges", [])
    action_graph.load_from_session_data(nodes_data=nodes_data, edges_data=edges_data)
    
    print(f"\n{'='*80}")
    print(f"ACTION GRAPH DATA VERIFICATION")
    print(f"{'='*80}\n")
    print(f"Total Nodes: {len(action_graph.nodes)}")
    print(f"Total Edges: {len(action_graph.edges)}\n")
    
    # Check nodes
    print(f"{'='*80}")
    print("NODES (checking target_text):")
    print(f"{'='*80}")
    for i, node in enumerate(action_graph.nodes[:10], 1):  # First 10 nodes
        print(f"\nNode {i} (ID: {node.id[:8]}...):")
        print(f"  Event Type: {node.event_type}")
        print(f"  Target Selector: {node.target_selector}")
        print(f"  Target Text: {node.target_text}")
        print(f"  Action Description: {node.action_description}")
        print(f"  URL: {node.url_pattern or node.url}")
    
    # Check edges
    print(f"\n{'='*80}")
    print("EDGES (checking descriptions):")
    print(f"{'='*80}")
    for i, edge in enumerate(action_graph.edges[:10], 1):  # First 10 edges
        from_node = action_graph.node_map.get(edge.from_node_id)
        to_node = action_graph.node_map.get(edge.to_node_id)
        print(f"\nEdge {i} (ID: {edge.id[:8]}...):")
        print(f"  Action: {edge.action}")
        print(f"  Description: {edge.description}")
        print(f"  From Node Target Text: {from_node.target_text if from_node else 'N/A'}")
        print(f"  To Node Target Text: {to_node.target_text if to_node else 'N/A'}")
        print(f"  Locators: {edge.locators}")
        print(f"  Expected Outcome: {edge.expected_outcome}")
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY:")
    print(f"{'='*80}")
    nodes_with_text = sum(1 for n in action_graph.nodes if n.target_text)
    edges_with_description = sum(1 for e in action_graph.edges if e.description and e.description != e.action)
    print(f"Nodes with target_text: {nodes_with_text}/{len(action_graph.nodes)}")
    print(f"Edges with custom description: {edges_with_description}/{len(action_graph.edges)}")
    
    # Check for specific selectors from user's test case
    print(f"\n{'='*80}")
    print("CHECKING USER'S SELECTORS:")
    print(f"{'='*80}")
    user_selectors = [
        ".ld.ld-ChevronDown.pl2",
        ".b--none.bg-transparent.lh-copy.mid-gray.ph4.pv2.relative.sans-serif.tl.w-100.header-flyout__department-button--active",
        ".mid-gray.no-underline.subcategory-item-link",
        ".mr2",
        "#cart-badge",
        "#Continue to checkout button"
    ]
    
    for selector in user_selectors:
        print(f"\nSelector: {selector}")
        # Find nodes with this selector
        matching_nodes = [n for n in action_graph.nodes if n.target_selector == selector]
        if matching_nodes:
            for node in matching_nodes:
                print(f"  ✓ Found node: target_text='{node.target_text}', action_description='{node.action_description}'")
        else:
            print(f"  ✗ No node found with this selector")
        
        # Find edges with this selector in locators
        matching_edges = [e for e in action_graph.edges if e.locators and e.locators.get("primary") == selector]
        if matching_edges:
            for edge in matching_edges:
                print(f"  ✓ Found edge: description='{edge.description}'")
        else:
            print(f"  ✗ No edge found with this selector")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_action_graph_data.py <session_id>")
        print("\nTo get session_id, check the logs or use the /api/flowstral/start endpoint response")
        sys.exit(1)
    
    session_id = sys.argv[1]
    asyncio.run(test_action_graph_data(session_id))


