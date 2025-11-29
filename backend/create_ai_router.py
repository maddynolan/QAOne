"""
Script to extract AI generation endpoints from main.py and create ai_generation_api.py router
"""
import re
import os

# Read main.py
with open('app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find AI endpoint ranges (excluding models which are already extracted)
ai_endpoints_ranges = [
    (437, 670),   # /ai/generate-tests
    (671, 716),   # /ai/triage (first)
    (1007, 1227), # /ai/jira-to-testcases
    (1228, 1273), # /ai/testcase-to-playwright
    (1274, 1324), # /ai/api-tests
    (1325, 1369), # /ai/perf-tests
    (1370, 1411), # /ai/a11y-tests
    (1412, 1462), # /ai/a11y-tests-old
    (1463, 1538), # /ai/triage (second)
    (1539, 1581), # /ai/templates GET
    (1582, 1629), # /ai/templates POST
    (1630, 1684), # /ai/generations/{id}/rate
    (1685, 1741), # /ai/generations/{id}/correct
    (1742, 1780), # /ai/gateway/generate
    (1781, 1816), # /ai/gateway/chat
    (1817, 1849), # /ai/gateway/embedding
    (1850, 1910), # /ai/gateway/usage
    (2162, 2264), # /ai/training-data/export
    (4824, 5443), # /ai/generate-tests-enhanced (LARGE)
    (5444, 5479), # /ai/generate-test-plan
    (5480, 5515), # /ai/generate-tests (second)
    (5516, 5789), # /ai/url-discover
    (5790, 5846), # /ai/convert-to-playwright
    (5847, 6318), # /ai/generate-and-execute-automated (LARGE)
    (6358, 6436), # /ai/evaluation-summary
]

# Get imports and models from main.py
imports_section = []
models_section = []
in_imports = False
in_models = False

for i, line in enumerate(lines[:450], 1):
    if i <= 80:
        if line.strip().startswith('from ') or line.strip().startswith('import '):
            imports_section.append(line)
    if 146 <= i <= 340:
        if line.strip().startswith('class ') and ('Request' in line or 'Response' in line or 'TestCase' in line or 'TestStep' in line or 'AuditInfo' in line):
            # Include the class definition and its content
            models_section.append(line)
            j = i
            while j < len(lines) and (lines[j].strip().startswith('    ') or lines[j].strip() == '' or lines[j].strip().startswith('class ')):
                if j > i:
                    models_section.append(lines[j])
                j += 1
                if j >= 340:
                    break

# Build router file
router_content = '''"""
AI Generation API Router
Handles all AI-powered test generation, triage, templates, and model gateway endpoints
"""
import logging
import json
import uuid
import time
import asyncio
import os
import concurrent.futures
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

# Services
from app.services.llm.ollama_service import get_ollama_service
from app.services.storage.ai_storage import store_ai_generation
from app.services.storage.database import create_requirement, get_database_client
from app.services.llm.enhanced_generation_service import enhanced_generation_service
from app.services.executors.playwright_runner import PlaywrightRunner, TestCase as PlaywrightTestCase, TestStep
from app.services.storage.postgres_direct import execute_query, execute_update, get_postgres_pool
from app.services.storage.test_results_storage import store_test_run, store_test_run_step
from app.utils.endpoint_helpers import ensure_default_org_project, map_priority, estimate_tokens, DEFAULT_USER_ID
from app.schemas import (
    ReqToTestPlanRequest, ReqToTestPlanResponse,
    ReqToTestsRequest, ReqToTestsResponse
)
from app.services.llm.prompt.prompt_builders import build_req_to_testplan_prompt, build_req_to_tests_prompt

logger = logging.getLogger(__name__)

# Get ollama service instance
ollama_service = get_ollama_service()

# Pydantic Models
'''

# Add models
router_content += ''.join(models_section)

router_content += '''

router = APIRouter(prefix="/ai", tags=["ai-generation"])


def _query_usage_sync(pool, query, params):
    """Synchronous database query"""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description]
            results = [dict(zip(columns, row)) for row in cur.fetchall()]
            return results
    finally:
        pool.putconn(conn)


# ============================================================================
# TEST GENERATION ENDPOINTS
# ============================================================================
'''

# Extract endpoint code
for start, end in ai_endpoints_ranges:
    endpoint_lines = lines[start-1:end]
    # Replace @app with @router
    endpoint_code = ''.join(endpoint_lines)
    endpoint_code = endpoint_code.replace('@app.', '@router.')
    # Remove leading whitespace to match router indentation
    endpoint_code = endpoint_code.lstrip()
    router_content += endpoint_code + '\n\n'

# Write router file
router_path = 'app/routers/ai_generation_api.py'
os.makedirs(os.path.dirname(router_path), exist_ok=True)
with open(router_path, 'w', encoding='utf-8') as f:
    f.write(router_content)

print(f"Created {router_path}")
print(f"Total lines: {len(router_content.split(chr(10)))}")


