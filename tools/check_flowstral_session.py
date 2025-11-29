"""
Quick script to check Flowstral session status and artifacts
"""
import requests
import json
import sys

API_BASE = "http://localhost:8000/api/flowstral"

def check_session(session_id):
    """Check session status"""
    try:
        response = requests.get(f"{API_BASE}/session/{session_id}/status")
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Session Status:")
            print(f"   Session ID: {session_id}")
            print(f"   Status: {data.get('session', {}).get('status', 'unknown')}")
            print(f"   Total Nodes: {data.get('session', {}).get('total_nodes', 0)}")
            print(f"   Total Edges: {data.get('session', {}).get('total_edges', 0)}")
            print(f"   WCAG Issues: {data.get('session', {}).get('total_wcag_issues', 0)}")
            print(f"   Performance Metrics: {data.get('session', {}).get('total_performance_metrics', 0)}")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error checking session: {e}")
        return False

def get_artifacts(session_id):
    """Get artifacts for a session"""
    try:
        response = requests.get(f"{API_BASE}/session/{session_id}/artifacts")
        if response.status_code == 200:
            data = response.json()
            artifacts = data.get('artifacts', {})
            print(f"\n📊 Artifacts:")
            print(f"   Action Graph: {'✅' if artifacts.get('action_graph') else '❌'}")
            print(f"   Playwright Script: {'✅' if artifacts.get('playwright_script') else '❌'}")
            print(f"   Test Cases: {'✅' if artifacts.get('test_cases') else '❌'}")
            print(f"   Accessibility Report: {'✅' if artifacts.get('accessibility_report') else '❌'}")
            print(f"   Performance Report: {'✅' if artifacts.get('performance_report') else '❌'}")
            print(f"   Defects: {'✅' if artifacts.get('defects') else '❌'}")
            
            # Show artifact details
            for key, value in artifacts.items():
                if value:
                    if isinstance(value, dict) and value.get('error'):
                        print(f"\n   {key}: ❌ Error - {value.get('error')}")
                    else:
                        print(f"\n   {key}: ✅ Generated")
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error getting artifacts: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_flowstral_session.py <session_id>")
        print("\nExample:")
        print("  python check_flowstral_session.py 67ebee5e-4e2c-4d10-aced-79cd31941405")
        sys.exit(1)
    
    session_id = sys.argv[1]
    print(f"\n🔍 Checking Flowstral Session: {session_id}\n")
    
    check_session(session_id)
    get_artifacts(session_id)
    
    print("\n" + "="*60)



