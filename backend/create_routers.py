"""
Script to help extract endpoint code from main.py into router files.
This is a helper script - actual extraction will be done manually for accuracy.
"""
import re
import sys

def extract_endpoint_code(content, endpoint_path):
    """Extract the code for a specific endpoint"""
    # Find the endpoint decorator
    pattern = rf'@app\.(get|post|put|delete|patch)\(["\']{re.escape(endpoint_path)}["\']\)'
    match = re.search(pattern, content)
    if not match:
        return None
    
    start = match.start()
    # Find the function definition
    func_match = re.search(r'async def \w+\(', content[start:])
    if not func_match:
        return None
    
    func_start = start + func_match.start()
    
    # Find the end of the function (next @app. or end of file)
    next_endpoint = re.search(r'@app\.(get|post|put|delete|patch)\(', content[func_start + 100:])
    if next_endpoint:
        func_end = func_start + 100 + next_endpoint.start()
    else:
        func_end = len(content)
    
    # Extract the function
    func_code = content[func_start:func_end].rstrip()
    
    # Clean up - remove trailing empty lines and comments
    lines = func_code.split('\n')
    # Remove trailing empty lines
    while lines and not lines[-1].strip():
        lines.pop()
    
    return '\n'.join(lines)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python create_routers.py <endpoint_path>")
        sys.exit(1)
    
    endpoint_path = sys.argv[1]
    
    with open('app/main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    code = extract_endpoint_code(content, endpoint_path)
    if code:
        print(code)
    else:
        print(f"Endpoint {endpoint_path} not found")


