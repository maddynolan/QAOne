"""Direct check for acceptance_criteria column"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.services.storage.postgres_direct import get_postgres_pool

pool = get_postgres_pool()
if not pool:
    print("❌ No connection")
    sys.exit(1)

conn = pool.getconn()
try:
    with conn.cursor() as cur:
        # Check if column exists
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'requirements' 
            AND column_name = 'acceptance_criteria'
        """)
        result = cur.fetchone()
        
        if result:
            print(f"✅ Column exists: {result}")
        else:
            print("❌ Column not found, trying to add it...")
            # Try to add it directly
            cur.execute("ALTER TABLE requirements ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;")
            conn.commit()
            print("✅ Column added!")
            
            # Verify again
            cur.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'requirements' 
                AND column_name = 'acceptance_criteria'
            """)
            result2 = cur.fetchone()
            if result2:
                print(f"✅ Verified: {result2}")
            else:
                print("❌ Still not found after adding")
finally:
    pool.putconn(conn)




