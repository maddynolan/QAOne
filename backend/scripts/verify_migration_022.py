"""Verify migration 022: Check if acceptance_criteria column exists"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import asyncio
from app.services.storage.postgres_direct import get_postgres_pool, execute_query

async def verify():
    pool = get_postgres_pool()
    if not pool:
        print("❌ No database connection")
        return False
    
    try:
        # Check if column exists
        result = await execute_query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'requirements' AND column_name = 'acceptance_criteria'",
            ()
        )
        
        if result and len(result) > 0:
            col = result[0]
            print(f"✅ Column 'acceptance_criteria' exists!")
            print(f"   Type: {col.get('data_type', 'unknown')}")
            return True
        else:
            print("❌ Column 'acceptance_criteria' NOT found")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(verify())
    sys.exit(0 if success else 1)







