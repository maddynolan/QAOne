import sys
sys.path.insert(0, ".")
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)
print("Testing /api/categories...")
try:
    response = client.get("/api/categories")
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        print("SUCCESS! Route works!")
        data = response.json()
        print(f"Found {len(data)} categories")
    else:
        print(f"Response: {response.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
