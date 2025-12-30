#!/usr/bin/env python3
"""Check if element_models table exists"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

async def check_table():
    from app.services.storage.postgres_direct import execute_query
    
    result = await execute_query("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'element_models';
    """)
    
    exists = bool(result and result[0].get('table_name'))
    print(f"element_models table exists: {exists}")
    
    if exists:
        # Check columns
        cols = await execute_query("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'element_models'
            ORDER BY ordinal_position;
        """)
        print(f"\nColumns ({len(cols)}):")
        for col in cols[:10]:  # Show first 10
            print(f"  - {col['column_name']}: {col['data_type']}")
    
    return exists

if __name__ == "__main__":
    exists = asyncio.run(check_table())
    sys.exit(0 if exists else 1)


