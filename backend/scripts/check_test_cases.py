#!/usr/bin/env python3
"""Check test cases in database"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage.postgres_direct import execute_query

async def check_test_cases():
    project_id = "11111111-1111-1111-1111-111111111111"
    result = await execute_query(
        "SELECT id, title, test_type, created_at, tags FROM test_cases WHERE project_id = %s ORDER BY created_at DESC LIMIT 10",
        (project_id,)
    )
    
    print(f"\n=== Test Cases in Database (Project: {project_id}) ===")
    if result:
        print(f"Found {len(result)} test cases:\n")
        for i, tc in enumerate(result, 1):
            print(f"{i}. {tc.get('title', 'N/A')}")
            print(f"   ID: {tc.get('id', 'N/A')}")
            print(f"   Type: {tc.get('test_type', 'N/A')}")
            print(f"   Tags: {tc.get('tags', [])}")
            print(f"   Created: {tc.get('created_at', 'N/A')}")
            print()
    else:
        print("No test cases found in database")
    
    # Check for Flowstral test cases specifically
    flowstral_result = await execute_query(
        "SELECT id, title, test_type, created_at FROM test_cases WHERE project_id = %s AND (tags @> ARRAY['flowstral']::text[] OR tags @> ARRAY['recorded']::text[]) ORDER BY created_at DESC LIMIT 10",
        (project_id,)
    )
    
    print(f"\n=== Flowstral Test Cases ===")
    if flowstral_result:
        print(f"Found {len(flowstral_result)} Flowstral test cases")
        for tc in flowstral_result:
            print(f"  - {tc.get('title', 'N/A')} ({tc.get('test_type', 'N/A')})")
    else:
        print("No Flowstral test cases found")

if __name__ == "__main__":
    asyncio.run(check_test_cases())

