"""
Automated script to extract all endpoints from main.py into router files.
This script reads main.py, identifies endpoint groups, and creates router files.
"""
import re
import os
from pathlib import Path
from typing import List, Tuple, Dict

def extract_endpoint_functions(content: str, endpoint_path: str) -> List[Tuple[int, int, str]]:
    """Extract all functions for a given endpoint path prefix"""
    functions = []
    
    # Find all endpoints matching the path
    pattern = rf'@app\.(get|post|put|delete|patch)\(["\']([^"\']*{re.escape(endpoint_path)}[^"\']*)["\']\)'
    
    for match in re.finditer(pattern, content):
        start = match.start()
        
        # Find the function definition
        func_match = re.search(r'async def \w+\(', content[start:start+500])
        if not func_match:
            continue
        
        func_start = start + func_match.start()
        
        # Find the end of the function (next @app. decorator or end of file)
        next_decorator = re.search(r'@app\.(get|post|put|delete|patch)\(', content[func_start+100:])
        if next_decorator:
            func_end = func_start + 100 + next_decorator.start()
        else:
            # Try to find end by indentation
            lines = content[func_start:].split('\n')
            func_lines = [lines[0]]  # First line (def statement)
            base_indent = len(lines[0]) - len(lines[0].lstrip())
            
            for i, line in enumerate(lines[1:], 1):
                if line.strip() and not line.startswith(' ' * (base_indent + 1)) and not line.startswith('\t'):
                    # Check if it's a comment or blank line
                    if line.strip().startswith('#') or not line.strip():
                        func_lines.append(line)
                        continue
                    # Otherwise, we've reached the next function/block
                    break
                func_lines.append(line)
            
            func_end = func_start + len('\n'.join(func_lines))
        
        func_code = content[func_start:func_end].rstrip()
        functions.append((func_start, func_end, func_code))
    
    return functions

def create_router_file(router_name: str, prefix: str, endpoints: List[Tuple[str, str, str]], imports: str) -> str:
    """Create a router file with the given endpoints"""
    
    router_content = f'''"""
{router_name} API Router
Auto-generated from main.py refactoring
"""
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from app.utils.endpoint_helpers import (
    ensure_default_org_project,
    map_priority_from_db,
    map_priority_to_db,
    DEFAULT_USER_ID,
    DEFAULT_ORG_ID,
    DEFAULT_PROJECT_ID
)
from app.services.storage.database import get_database_client
from app.services.storage.postgres_direct import execute_query, execute_insert, get_postgres_pool
import json
import uuid
import time
from datetime import datetime

{imports}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="{prefix}", tags=["{router_name.lower().replace(' ', '_')}"])

'''
    
    for method, path, code in endpoints:
        # Convert @app. to @router.
        code = code.replace('@app.', '@router.')
        # Remove prefix from path if it's in the path
        if prefix in path:
            path_without_prefix = path.replace(prefix, '').lstrip('/')
            if path_without_prefix:
                code = re.sub(rf'@router\.\w+\(["\'][^"\']*{re.escape(path)}[^"\']*["\']\)', 
                             f'@router.{method}("{path_without_prefix}")', code)
            else:
                code = re.sub(rf'@router\.\w+\(["\'][^"\']*{re.escape(path)}[^"\']*["\']\)', 
                             f'@router.{method}("")', code)
        
        router_content += code + '\n\n'
    
    return router_content

def main():
    """Main refactoring function"""
    main_py_path = Path('app/main.py')
    
    if not main_py_path.exists():
        print(f"Error: {main_py_path} not found")
        return
    
    with open(main_py_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Common imports needed by routers
    common_imports = '''# Additional imports as needed
'''
    
    # Define endpoint groups to extract
    endpoint_groups = {
        'test_runs': {
            'prefix': '/test-runs',
            'name': 'Test Runs',
            'endpoints': []
        },
        'test_plans': {
            'prefix': '/test-plans',
            'name': 'Test Plans',
            'endpoints': []
        },
        'defects': {
            'prefix': '/defects',
            'name': 'Defects',
            'endpoints': []
        },
        'requirements': {
            'prefix': '/requirements',
            'name': 'Requirements',
            'endpoints': []
        }
    }
    
    # Extract endpoints for each group
    for group_key, group_info in endpoint_groups.items():
        prefix = group_info['prefix']
        functions = extract_endpoint_functions(content, prefix)
        
        for func_start, func_end, func_code in functions:
            # Extract method and path from the decorator
            decorator_match = re.search(r'@app\.(\w+)\(["\']([^"\']+)["\']\)', func_code)
            if decorator_match:
                method = decorator_match.group(1)
                path = decorator_match.group(2)
                group_info['endpoints'].append((method, path, func_code))
        
        print(f"Found {len(group_info['endpoints'])} endpoints for {group_info['name']}")
    
    # Create router files
    routers_dir = Path('app/routers')
    routers_dir.mkdir(exist_ok=True)
    
    for group_key, group_info in endpoint_groups.items():
        if group_info['endpoints']:
            router_file = routers_dir / f"{group_key}_api.py"
            router_content = create_router_file(
                group_info['name'],
                group_info['prefix'],
                group_info['endpoints'],
                common_imports
            )
            
            with open(router_file, 'w', encoding='utf-8') as f:
                f.write(router_content)
            
            print(f"Created {router_file}")

if __name__ == '__main__':
    main()


