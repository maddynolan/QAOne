"""Test script to verify manual test case generation with actual steps"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# Load .env - CRITICAL: Must load before importing services
from dotenv import load_dotenv
import os

# Set OLLAMA_URL directly if not set (FIX for port issue)
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path, override=True)
    # Also try backend/.env
    backend_env = Path(__file__).parent.parent / 'backend' / '.env'
    if backend_env.exists():
        load_dotenv(backend_env, override=True)
    
    # CRITICAL FIX: Set OLLAMA_URL directly if it exists in .env but wasn't loaded
    ollama_url = os.getenv('OLLAMA_URL')
    if not ollama_url:
        # Try reading .env file directly
        try:
            with open(env_path, 'r') as f:
                for line in f:
                    if line.strip().startswith('OLLAMA_URL='):
                        ollama_url = line.split('=', 1)[1].strip()
                        os.environ['OLLAMA_URL'] = ollama_url
                        print(f"[FIX] Manually set OLLAMA_URL from .env: {ollama_url}")
                        break
        except:
            pass
    
    ollama_url = os.getenv('OLLAMA_URL', 'NOT SET')
    print(f"[OK] Loaded .env from: {env_path}")
    print(f"[INFO] OLLAMA_URL: {ollama_url}")
    if ollama_url == 'NOT SET' or '11434' in ollama_url:
        print("[ERROR] OLLAMA_URL not set correctly!")
        print("[FIX] Setting OLLAMA_URL to http://localhost:31143 directly")
        os.environ['OLLAMA_URL'] = 'http://localhost:31143'
        print(f"[OK] OLLAMA_URL now set to: {os.getenv('OLLAMA_URL')}")
else:
    print(f"[ERROR] .env file not found at: {env_path}")
    print("[FIX] Setting OLLAMA_URL to http://localhost:31143 directly")
    os.environ['OLLAMA_URL'] = 'http://localhost:31143'

from app.services.flowstral.flowstral_artifacts import FlowstralArtifactsGenerator
from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

def create_test_action_graph():
    """Create a realistic action graph for testing"""
    graph = ActionGraph(session_id="test-session-manual")
    
    # Add nodes representing a login flow
    node1 = ActionGraphNode(
        node_id="node1",
        event_type="navigate",
        url_pattern="https://www.saucedemo.com/",
        url="https://www.saucedemo.com/",
        action_description="Navigate to login page",
        title="SauceDemo Login"
    )
    
    node2 = ActionGraphNode(
        node_id="node2",
        event_type="click",
        target_selector="input[data-test='username']",
        action_description="Click username field",
        title="SauceDemo Login"
    )
    
    node3 = ActionGraphNode(
        node_id="node3",
        event_type="type",
        target_selector="input[data-test='username']",
        action_description="Enter username",
        title="SauceDemo Login"
    )
    
    node4 = ActionGraphNode(
        node_id="node4",
        event_type="click",
        target_selector="input[data-test='password']",
        action_description="Click password field",
        title="SauceDemo Login"
    )
    
    node5 = ActionGraphNode(
        node_id="node5",
        event_type="type",
        target_selector="input[data-test='password']",
        action_description="Enter password",
        title="SauceDemo Login"
    )
    
    node6 = ActionGraphNode(
        node_id="node6",
        event_type="click",
        target_selector="input[data-test='login-button']",
        action_description="Click login button",
        title="Products"
    )
    
    graph.nodes = [node1, node2, node3, node4, node5, node6]
    
    # Add edges
    edge1 = ActionGraphEdge(
        edge_id="edge1",
        from_node_id=node1.id,
        to_node_id=node2.id,
        action="click",
        description="User clicks on username field"
    )
    edge2 = ActionGraphEdge(
        edge_id="edge2",
        from_node_id=node2.id,
        to_node_id=node3.id,
        action="type",
        description="User enters username 'standard_user'"
    )
    edge3 = ActionGraphEdge(
        edge_id="edge3",
        from_node_id=node3.id,
        to_node_id=node4.id,
        action="click",
        description="User clicks on password field"
    )
    edge4 = ActionGraphEdge(
        edge_id="edge4",
        from_node_id=node4.id,
        to_node_id=node5.id,
        action="type",
        description="User enters password 'secret_sauce'"
    )
    edge5 = ActionGraphEdge(
        edge_id="edge5",
        from_node_id=node5.id,
        to_node_id=node6.id,
        action="click",
        description="User clicks login button"
    )
    
    graph.edges = [edge1, edge2, edge3, edge4, edge5]
    
    return graph

async def test_manual_test_case_generation():
    """Test that manual test cases are actually generated with steps"""
    print("\n" + "="*70)
    print("Testing Manual Test Case Generation - Verifying Actual Steps")
    print("="*70)
    
    generator = FlowstralArtifactsGenerator()
    action_graph = create_test_action_graph()
    
    playwright_artifact = {
        "code": """test('SauceDemo Login', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.fill('input[data-test="username"]', 'standard_user');
  await page.fill('input[data-test="password"]', 'secret_sauce');
  await page.click('input[data-test="login-button"]');
  await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');
});""",
        "type": "playwright_script"
    }
    
    print("\n[INFO] Generating test cases...")
    print(f"[INFO] Action graph has {len(action_graph.nodes)} nodes and {len(action_graph.edges)} edges")
    
    import time
    start_time = time.time()
    
    try:
        result = await generator.generate_structured_test_cases(
            playwright_artifact=playwright_artifact,
            action_graph=action_graph,
            project_id="test-project-manual",
            tenant_id="test-tenant"
        )
        
        elapsed_time = time.time() - start_time
        print(f"\n[INFO] Total generation time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)")
        
        print("\n" + "="*70)
        print("RESULTS")
        print("="*70)
        
        if not result:
            print("[FAIL] Result is None!")
            return False
        
        test_cases = result.get("test_cases", {})
        manual_cases = test_cases.get("manual", [])
        automated_cases = test_cases.get("automated", [])
        
        print(f"\n[INFO] Automated test cases: {len(automated_cases)}")
        print(f"[INFO] Manual test cases: {len(manual_cases)}")
        
        if len(manual_cases) == 0:
            print("\n[FAIL] No manual test cases generated!")
            print("[INFO] This could mean:")
            print("  1. LLM returned empty response")
            print("  2. LLM response was not valid JSON")
            print("  3. Timeout occurred")
            return False
        
        print("\n" + "="*70)
        print("MANUAL TEST CASE DETAILS")
        print("="*70)
        
        for i, manual_case in enumerate(manual_cases, 1):  # Show ALL test cases
            print(f"\n{'='*70}")
            print(f"[Manual Test Case {i} of {len(manual_cases)}]")
            print(f"{'='*70}")
            print(f"  Title: {manual_case.get('title', 'N/A')}")
            print(f"  Description: {manual_case.get('description', 'N/A')}")
            print(f"  Test Type: {manual_case.get('test_type', 'N/A')}")
            print(f"  Priority: {manual_case.get('priority', 'N/A')}")
            
            steps = manual_case.get('steps', [])
            print(f"\n  Total Steps: {len(steps)}")
            
            if len(steps) == 0:
                print("  [WARN] No steps in this test case!")
                print("  [WARN] This is a fallback/empty test case, not a real LLM-generated one")
            else:
                print(f"\n  [SUCCESS] Test case has {len(steps)} steps! Showing ALL steps:")
                print(f"  {'-'*68}")
                for j, step in enumerate(steps, 1):
                    step_num = step.get('step_number', j)
                    action = step.get('action', 'N/A')
                    expected = step.get('expected_result', 'N/A')
                    print(f"\n    Step {step_num}:")
                    print(f"      Action: {action}")
                    print(f"      Expected Result: {expected}")
                print(f"  {'-'*68}")
        
        # Check if we have at least one manual test case with steps
        has_steps = any(len(case.get('steps', [])) > 0 for case in manual_cases)
        
        if has_steps:
            print("\n" + "="*70)
            print("[SUCCESS] Manual test cases were generated with actual steps!")
            print("="*70)
            return True
        else:
            print("\n" + "="*70)
            print("[FAIL] Manual test cases exist but have no steps!")
            print("[FAIL] This means LLM is not generating proper test cases")
            print("="*70)
            return False
            
    except Exception as e:
        print(f"\n[EXCEPTION] {type(e).__name__}: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()[:500]}")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(test_manual_test_case_generation())
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)

