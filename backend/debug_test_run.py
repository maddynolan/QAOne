"""
Debug script to test test run retrieval
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.services.postgres_direct import execute_query, get_postgres_pool

async def debug_test_run(run_id: str):
    """Debug a specific test run"""
    print(f"\n{'='*60}")
    print(f"DEBUGGING TEST RUN: {run_id}")
    print(f"{'='*60}\n")
    
    # 1. Check if run exists
    print("1. Checking if test run exists...")
    run_query = """
        SELECT id, project_id, plan_id, name, status, environment, started_at, completed_at, created_at
        FROM test_runs 
        WHERE id = %s
    """
    run_results = await execute_query(run_query, (run_id,))
    if not run_results or len(run_results) == 0:
        print(f"❌ Test run {run_id} not found!")
        return
    print(f"✅ Found test run: {run_results[0].get('name')}")
    print(f"   Status: {run_results[0].get('status')}")
    
    # 2. Check test_run_steps with direct UUID
    print("\n2. Checking test_run_steps with UUID...")
    steps_query1 = """
        SELECT id, case_id, title, status, created_at
        FROM test_run_steps
        WHERE run_id = %s
        ORDER BY case_id, created_at
        LIMIT 10
    """
    steps1 = await execute_query(steps_query1, (run_id,))
    print(f"   Found {len(steps1) if steps1 else 0} steps with UUID query")
    if steps1:
        for step in steps1[:3]:
            print(f"   - case_id: {step.get('case_id')}, title: {step.get('title')[:50]}")
    
    # 3. Check test_run_steps with text cast
    print("\n3. Checking test_run_steps with text cast...")
    steps_query2 = """
        SELECT id, case_id, title, status, created_at
        FROM test_run_steps
        WHERE run_id::text = %s
        ORDER BY case_id, created_at
        LIMIT 10
    """
    steps2 = await execute_query(steps_query2, (str(run_id),))
    print(f"   Found {len(steps2) if steps2 else 0} steps with text cast query")
    if steps2:
        for step in steps2[:3]:
            print(f"   - case_id: {step.get('case_id')}, title: {step.get('title')[:50]}")
    
    # 4. Check all test_run_steps (no filter)
    print("\n4. Checking ALL test_run_steps (last 10)...")
    all_steps_query = """
        SELECT run_id, case_id, title, status, created_at
        FROM test_run_steps
        ORDER BY created_at DESC
        LIMIT 10
    """
    all_steps = await execute_query(all_steps_query, None)
    print(f"   Found {len(all_steps) if all_steps else 0} total steps in table")
    if all_steps:
        for step in all_steps:
            print(f"   - run_id: {step.get('run_id')}, case_id: {step.get('case_id')}, title: {step.get('title')[:50]}")
    
    # 5. Get distinct case_ids
    print("\n5. Getting distinct case_ids for this run...")
    case_ids_query = """
        SELECT DISTINCT case_id 
        FROM test_run_steps 
        WHERE run_id = %s
    """
    case_ids = await execute_query(case_ids_query, (run_id,))
    print(f"   Found {len(case_ids) if case_ids else 0} distinct case_ids")
    if case_ids:
        for row in case_ids:
            print(f"   - case_id: {row.get('case_id')}")
    
    # 6. Check test_cases table
    if case_ids:
        print("\n6. Checking test_cases table...")
        for row in case_ids[:3]:
            case_id = row.get('case_id')
            tc_query = """
                SELECT id, title, steps
                FROM test_cases 
                WHERE id = %s
            """
            tc_result = await execute_query(tc_query, (case_id,))
            if tc_result:
                tc = tc_result[0]
                steps = tc.get('steps', [])
                if isinstance(steps, str):
                    import json
                    try:
                        steps = json.loads(steps)
                    except:
                        steps = []
                print(f"   - case_id {case_id}: title='{tc.get('title')}', steps_count={len(steps) if isinstance(steps, list) else 0}")
            else:
                print(f"   - case_id {case_id}: NOT FOUND in test_cases table")
    
    print(f"\n{'='*60}\n")

if __name__ == "__main__":
    # Get run_id from command line or use a test one
    if len(sys.argv) > 1:
        run_id = sys.argv[1]
    else:
        # Get the most recent test run
        async def get_latest_run():
            query = """
                SELECT id, name 
                FROM test_runs 
                ORDER BY created_at DESC 
                LIMIT 1
            """
            result = await execute_query(query, None)
            if result:
                return result[0].get('id')
            return None
        
        run_id = asyncio.run(get_latest_run())
        if not run_id:
            print("No test runs found in database")
            sys.exit(1)
        print(f"Using latest test run: {run_id}")
    
    asyncio.run(debug_test_run(run_id))






