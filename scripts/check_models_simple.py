#!/usr/bin/env python3
"""Quick check of models on Spark"""

import requests

try:
    r = requests.get('http://localhost:31143/api/tags', timeout=5)
    models = r.json().get('models', [])
    print('Models on Spark:')
    for m in models:
        print(f'  - {m.get("name", "")}')
    
    has_7b = any('7b' in m.get('name', '').lower() for m in models)
    print(f'\n7B model found: {"YES" if has_7b else "NO"}')
    
    if not has_7b:
        print('\n⚠️  Need to load: ollama pull qwen2.5-coder:7b')
except Exception as e:
    print(f'Error: {e}')
    print('Make sure SSH tunnel is running: ssh -N -L 31143:127.0.0.1:11434 madhujanu@spark-d435.local')



