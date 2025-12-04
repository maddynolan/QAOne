"""Test if Nexus tables exist"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.storage.postgres_direct import execute_query

async def test_tables():
    result = await execute_query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'nexus_%' ORDER BY table_name"
    )
    
    if result:
        print("✅ Nexus tables found:")
        for row in result:
            print(f"  - {row['table_name']}")
        return True
    else:
        print("❌ No Nexus tables found")
        return False

if __name__ == "__main__":
    asyncio.run(test_tables())

