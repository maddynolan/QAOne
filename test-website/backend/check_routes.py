# Quick diagnostic - check if routes work when app is imported
from main import app
print("App created successfully")
print(f"Total routes: {len(app.routes)}")
api_routes = [r for r in app.routes if hasattr(r, "path") and "/api/" in r.path]
print(f"API routes: {len(api_routes)}")
print("\nFirst 10 API routes:")
for r in api_routes[:10]:
    print(f"  {r.path} - {r.methods if hasattr(r, 'methods') else 'N/A'}")
