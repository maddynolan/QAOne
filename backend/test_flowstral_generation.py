"""
Test script to verify Flowstral test case generation doesn't throw NoneType errors
"""
import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Load .env
from dotenv import load_dotenv
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"[OK] Loaded .env from: {env_path}")

from app.services.flowstral.flowstral_artifacts import FlowstralArtifactsGenerator
from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode, ActionGraphEdge

def create_mock_action_graph():
    """Create a minimal action graph for testing"""
    graph = ActionGraph(session_id="test-session-123")
    
    # Add a few nodes
    node1 = ActionGraphNode(
        node_id="node1",
        event_type="navigate",
        url_pattern="https://example.com",
        url="https://example.com",
        action_description="Navigate to example.com",
        title="Example Page"
    )
    node2 = ActionGraphNode(
        node_id="node2",
        event_type="click",
        target_selector="button#submit",
        action_description="Click submit button",
        title="Example Page"
    )
    
    graph.nodes = [node1, node2]
    
    # Add an edge
    edge1 = ActionGraphEdge(
        edge_id="edge1",
        from_node_id=node1.id,
        to_node_id=node2.id,
        action="click",
        description="User clicks submit button"
    )
    graph.edges = [edge1]
    
    return graph

async def test_generate_structured_test_cases():
    """Test generate_structured_test_cases with various edge cases"""
    print("\n" + "="*70)
    print("Testing Flowstral Test Case Generation - NoneType Error Fix")
    print("="*70)
    
    generator = FlowstralArtifactsGenerator()
    action_graph = create_mock_action_graph()
    
    test_cases = [
        {
            "name": "Normal case - valid playwright artifact",
            "playwright_artifact": {
                "code": """import { test, expect } from '@playwright/test';

test('Example Test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('button#submit');
});""",
                "type": "playwright_script"
            },
            "project_id": "test-project",
            "tenant_id": None
        },
        {
            "name": "Edge case - None playwright_artifact",
            "playwright_artifact": None,
            "project_id": "test-project",
            "tenant_id": None
        },
        {
            "name": "Edge case - Empty dict playwright_artifact",
            "playwright_artifact": {},
            "project_id": "test-project",
            "tenant_id": None
        },
        {
            "name": "Edge case - playwright_artifact without 'code' key",
            "playwright_artifact": {"type": "playwright_script"},
            "project_id": "test-project",
            "tenant_id": None
        },
        {
            "name": "Edge case - Empty code",
            "playwright_artifact": {"code": ""},
            "project_id": "test-project",
            "tenant_id": None
        },
        {
            "name": "Edge case - No project_id",
            "playwright_artifact": {
                "code": "test('Test', async ({ page }) => {});"
            },
            "project_id": None,
            "tenant_id": None
        }
    ]
    
    results = []
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[{i}/{len(test_cases)}] Testing: {test_case['name']}")
        print("-" * 70)
        
        try:
            result = await generator.generate_structured_test_cases(
                playwright_artifact=test_case['playwright_artifact'],
                action_graph=action_graph,
                project_id=test_case['project_id'],
                tenant_id=test_case['tenant_id']
            )
            
            # Verify result is never None
            if result is None:
                print(f"[FAIL] Result is None!")
                results.append({"test": test_case['name'], "status": "FAILED", "error": "Result is None"})
                continue
            
            # Verify result is a dict
            if not isinstance(result, dict):
                print(f"[FAIL] Result is not a dict, got: {type(result)}")
                results.append({"test": test_case['name'], "status": "FAILED", "error": f"Result is {type(result)}"})
                continue
            
            # Verify result has required structure
            if "test_cases" not in result:
                print(f"[FAIL] Result missing 'test_cases' key")
                results.append({"test": test_case['name'], "status": "FAILED", "error": "Missing 'test_cases' key"})
                continue
            
            # Verify test_cases is a dict
            test_cases_dict = result.get("test_cases")
            if not isinstance(test_cases_dict, dict):
                print(f"[FAIL] test_cases is not a dict, got: {type(test_cases_dict)}")
                results.append({"test": test_case['name'], "status": "FAILED", "error": f"test_cases is {type(test_cases_dict)}"})
                continue
            
            # Check structure
            automated = test_cases_dict.get("automated", [])
            manual = test_cases_dict.get("manual", [])
            a11y = test_cases_dict.get("accessibility", [])
            perf = test_cases_dict.get("performance", [])
            
            print(f"[PASS] Result is valid dict")
            print(f"   Structure: automated={len(automated)}, manual={len(manual)}, a11y={len(a11y)}, perf={len(perf)}")
            print(f"   Keys: {list(result.keys())}")
            
            # Check if test cases were actually generated
            if len(automated) > 0:
                print(f"   [SUCCESS] Generated {len(automated)} automated test case(s)!")
                if automated[0].get('title'):
                    print(f"      First test case: {automated[0].get('title')[:60]}")
            if len(manual) > 0:
                print(f"   [SUCCESS] Generated {len(manual)} manual test case(s)!")
            
            if "error" in result:
                print(f"   [WARN] Has error field: {result['error']}")
                print(f"   [NOTE] Test cases may be empty due to error, but structure is valid")
            
            results.append({"test": test_case['name'], "status": "PASSED", "result": result})
            
        except Exception as e:
            print(f"[EXCEPTION] {type(e).__name__}: {e}")
            import traceback
            print(f"   Traceback: {traceback.format_exc()[:500]}")
            results.append({"test": test_case['name'], "status": "EXCEPTION", "error": str(e)})
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for r in results if r['status'] == 'PASSED')
    failed = sum(1 for r in results if r['status'] == 'FAILED')
    exceptions = sum(1 for r in results if r['status'] == 'EXCEPTION')
    
    print(f"[PASS] Passed: {passed}/{len(test_cases)}")
    if failed > 0:
        print(f"[FAIL] Failed: {failed}/{len(test_cases)}")
    if exceptions > 0:
        print(f"[EXCEPTION] Exceptions: {exceptions}/{len(test_cases)}")
    
    print("\nDetailed Results:")
    for r in results:
        status_icon = "[PASS]" if r['status'] == 'PASSED' else "[FAIL]" if r['status'] == 'FAILED' else "[EXCEPTION]"
        print(f"  {status_icon} {r['test']}: {r['status']}")
        if 'error' in r:
            print(f"     Error: {r['error']}")
    
    print("\n" + "="*70)
    
    if failed == 0 and exceptions == 0:
        print("[SUCCESS] ALL TESTS PASSED! NoneType error should be fixed!")
        return 0
    else:
        print("[WARN] Some tests failed. Check errors above.")
        return 1

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(test_generate_structured_test_cases())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

