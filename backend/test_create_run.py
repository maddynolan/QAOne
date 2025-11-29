"""
Test script to create a test run with test cases and verify steps are stored
"""
import asyncio
import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))

from app.services.postgres_direct import execute_query, execute_insert
from app.services.test_results_storage import store_test_run_step

async def test_create_run():
    """Test creating a test run with steps"""
    print("\n" + "="*60)
    print("TESTING TEST RUN CREATION")
    print("="*60 + "\n")
    
    # 1. Create a test run
    print("1. Creating test run...")
    run_data = {
        "project_id": "11111111-1111-1111-1111-111111111111",
        "name": "Test Run: Debug Test",
        "status": "pending",
        "environment": "local",
        "created_by": "22222222-2222-2222-2222-222222222222"
    }
    run_id = await execute_insert("test_runs", run_data)
    print(f"✅ Created test run: {run_id}")
    
    # 2. Create test cases with steps
    print("\n2. Creating test cases with steps...")
    test_cases = [
        {
            "id": "test-case-1",
            "title": "Test Case 1",
            "steps": [
                {"action": "Step 1 action", "expectedResult": "Step 1 expected"},
                {"action": "Step 2 action", "expectedResult": "Step 2 expected"}
            ]
        },
        {
            "id": "test-case-2", 
            "title": "Test Case 2",
            "steps": [
                {"action": "Step 1 action", "expectedResult": "Step 1 expected"}
            ]
        }
    ]
    
    # 3. Store steps for each test case
    print("\n3. Storing test_run_steps...")
    total_steps = 0
    for test_case in test_cases:
        case_id = test_case["id"]
        steps = test_case.get("steps", [])
        print(f"   Processing test case {case_id} with {len(steps)} steps")
        
        for step_idx, step in enumerate(steps):
            step_title = f"{test_case['title']} - Step {step_idx + 1}: {step.get('action', '')}"
            print(f"      Creating step: {step_title[:50]}")
            
            step_id = await store_test_run_step(
                run_id=run_id,
                case_id=case_id,
                title=step_title,
                status="pending",
                duration_ms=0,
                error_message=None,
                stdout=None,
                stderr=None,
                started_at=None,
                completed_at=None
            )
            
            if step_id:
                print(f"      ✅ Created step with ID: {step_id}")
                total_steps += 1
            else:
                print(f"      ❌ Failed to create step")
    
    # 4. Verify steps were stored
    print(f"\n4. Verifying {total_steps} steps were stored...")
    verify_query = """
        SELECT id, case_id, title, status
        FROM test_run_steps
        WHERE run_id = %s
        ORDER BY case_id, created_at
    """
    stored_steps = await execute_query(verify_query, (run_id,))
    
    if stored_steps:
        print(f"✅ Found {len(stored_steps)} steps in database:")
        for step in stored_steps:
            print(f"   - case_id: {step.get('case_id')}, title: {step.get('title')[:60]}")
    else:
        print(f"❌ NO STEPS FOUND in database!")
    
    print(f"\n{'='*60}\n")
    return run_id

if __name__ == "__main__":
    run_id = asyncio.run(test_create_run())
    print(f"Test run ID: {run_id}")
    print("You can now test the GET endpoint with this run_id")






