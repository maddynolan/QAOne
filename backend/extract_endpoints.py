"""Script to analyze endpoints in main.py for refactoring"""
import re
from collections import defaultdict

with open('app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all endpoints
endpoints = re.findall(r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']', content)

print(f"Total endpoints: {len(endpoints)}")

# Group by prefix
groups = defaultdict(list)
for method, path in endpoints:
    prefix = path.split('/')[1] if '/' in path else 'root'
    groups[prefix].append((method, path))

# Sort by count
for prefix, endpoints_list in sorted(groups.items(), key=lambda x: -len(x[1])):
    print(f"{prefix}: {len(endpoints_list)} endpoints")
    for method, path in endpoints_list[:5]:  # Show first 5
        print(f"  {method.upper()} {path}")
    if len(endpoints_list) > 5:
        print(f"  ... and {len(endpoints_list) - 5} more")


