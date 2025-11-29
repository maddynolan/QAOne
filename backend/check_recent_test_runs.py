"""
Quick script to check recent test run execution results
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

load_dotenv()

# Use same connection logic as backend
def get_connection_string():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    
    # Build from individual components
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "qaai")
    user = os.getenv("POSTGRES_USER", "qaai")
    password = os.getenv("POSTGRES_PASSWORD", "qaai123")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"

conn_string = get_connection_string()
print(f"🔵 Connecting to database...")

try:
    conn = psycopg2.connect(conn_string)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get most recent test run
        cur.execute("""
            SELECT id, name, status, started_at, completed_at, created_at
            FROM test_runs
            ORDER BY created_at DESC
            LIMIT 5
        """)
        runs = cur.fetchall()
        
        print("=" * 80)
        print("RECENT TEST RUNS")
        print("=" * 80)
        
        for run in runs:
            print(f"\n📋 Test Run: {run['name']}")
            print(f"   ID: {run['id']}")
            print(f"   Status: {run['status']}")
            print(f"   Started: {run['started_at']}")
            print(f"   Completed: {run['completed_at']}")
            
            # Get steps for this run
            cur.execute("""
                SELECT case_id, title, status, duration_ms, error_message, 
                       LEFT(stdout, 200) as stdout_preview
                FROM test_run_steps
                WHERE run_id = %s
                ORDER BY created_at
            """, (run['id'],))
            steps = cur.fetchall()
            
            if steps:
                print(f"   Steps ({len(steps)}):")
                for step in steps:
                    status_icon = "✅" if step['status'] == 'passed' else "❌"
                    print(f"      {status_icon} {step['title'][:60]}")
                    print(f"         Status: {step['status']}, Duration: {step['duration_ms']}ms")
                    if step['error_message']:
                        print(f"         Error: {step['error_message'][:100]}")
                    if step['stdout_preview']:
                        print(f"         Logs: {step['stdout_preview'][:100]}...")
            else:
                print("   No steps found")
        
        print("\n" + "=" * 80)
        
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    if conn:
        conn.close()

