"""
Get full error message from most recent test run
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import json

load_dotenv()

def get_connection_string():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url
    
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "qaai")
    user = os.getenv("POSTGRES_USER", "qaai")
    password = os.getenv("POSTGRES_PASSWORD", "qaai123")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"

conn_string = get_connection_string()

try:
    conn = psycopg2.connect(conn_string)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get most recent test run step
        cur.execute("""
            SELECT trs.*, tr.name as run_name
            FROM test_run_steps trs
            JOIN test_runs tr ON tr.id = trs.run_id
            ORDER BY trs.created_at DESC
            LIMIT 1
        """)
        step = cur.fetchone()
        
        if step:
            print("=" * 80)
            print(f"LATEST TEST EXECUTION: {step['run_name']}")
            print("=" * 80)
            print(f"\nTest Case: {step['title']}")
            print(f"Status: {step['status']}")
            print(f"Duration: {step['duration_ms']}ms")
            print(f"\n--- Full Error Message ---")
            print(step['error_message'] or "No error message")
            print(f"\n--- Full Logs (stdout) ---")
            if step['stdout']:
                # Try to parse as JSON if possible
                try:
                    logs_data = json.loads(step['stdout'])
                    if isinstance(logs_data, dict):
                        print(f"Status: {logs_data.get('status')}")
                        print(f"Duration: {logs_data.get('duration')}ms")
                        print(f"\nLogs:")
                        for log in logs_data.get('logs', []):
                            print(f"  - {log}")
                        if logs_data.get('error'):
                            print(f"\nError: {logs_data.get('error')}")
                    else:
                        print(step['stdout'])
                except:
                    print(step['stdout'])
            else:
                print("No logs")
            print("=" * 80)
        else:
            print("No test runs found")
        
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
finally:
    if conn:
        conn.close()






