"""
Script to extract AI endpoints from main.py to ai_generation_api.py router
This helps automate the extraction process
"""
import re

# Read main.py
with open('app/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all AI endpoints
ai_endpoints = []
lines = content.split('\n')

current_endpoint = None
current_start = None
in_endpoint = False
indent_level = 0

for i, line in enumerate(lines, 1):
    # Check if this is an AI endpoint decorator
    if re.match(r'@app\.(get|post|put|delete|patch)\(.*"/ai/', line):
        if current_endpoint:
            ai_endpoints.append({
                'start': current_start,
                'end': i - 1,
                'line': current_start
            })
        current_endpoint = line
        current_start = i
        in_endpoint = True
        indent_level = 0
    elif in_endpoint:
        # Track indentation to know when endpoint ends
        stripped = line.lstrip()
        if stripped:
            current_indent = len(line) - len(stripped)
            if current_indent == 0 and line.strip() and not line.strip().startswith('#'):
                # End of endpoint
                ai_endpoints.append({
                    'start': current_start,
                    'end': i - 1,
                    'line': current_start
                })
                current_endpoint = None
                in_endpoint = False

# Add last endpoint if exists
if current_endpoint:
    ai_endpoints.append({
        'start': current_start,
        'end': len(lines),
        'line': current_start
    })

print(f"Found {len(ai_endpoints)} AI endpoints:")
for ep in ai_endpoints:
    print(f"  Line {ep['start']}: {lines[ep['start']-1].strip()}")


