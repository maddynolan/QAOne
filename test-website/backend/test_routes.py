from fastapi import FastAPI
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
print("Testing /api/categories...")
response = client.get("/api/categories")
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}")
