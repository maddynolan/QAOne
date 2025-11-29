# Main.py Refactoring - Complete Summary

## ✅ Completed Routers (10 routers, 54 endpoints)

1. **Health API** (`routers/health_api.py`) - 3 endpoints ✅
2. **Test Cases CRUD** (`routers/test_cases_crud_api.py`) - 6 endpoints ✅
3. **Test Runs** (`routers/test_runs_api.py`) - 14 endpoints ✅
4. **Test Plans** (`routers/test_plans_api.py`) - 4 endpoints ✅
5. **Defects** (`routers/defects_api.py`) - 5 endpoints ✅
6. **Requirements** (`routers/requirements_api.py`) - 5 endpoints ✅
7. **Tenants** (`routers/tenants_api.py`) - 4 endpoints ✅
8. **Agents** (`routers/agents_api.py`) - 4 endpoints ✅
9. **Workflows** (`routers/workflows_api.py`) - 4 endpoints ✅
10. **Models** (`routers/models_api.py`) - 5 endpoints ✅

**Total Endpoints Extracted: 54 out of 106 (51%)**

## 🔄 Remaining Work

### AI Generation Router (25 endpoints, ~3000+ lines)
**File:** `routers/ai_generation_api.py`

**Endpoints to extract (excluding models which are already done):**
1. `/ai/generate-tests` (line 437) - Generate tests from requirements
2. `/ai/triage` (line 671) - Analyze test failures (first implementation)
3. `/ai/jira-to-testcases` (line 1007) - Convert Jira to test cases
4. `/ai/testcase-to-playwright` (line 1228) - Convert test case to Playwright
5. `/ai/api-tests` (line 1274) - Generate API tests
6. `/ai/perf-tests` (line 1325) - Generate performance tests
7. `/ai/a11y-tests` (line 1370) - Generate accessibility tests
8. `/ai/a11y-tests-old` (line 1412) - Old accessibility tests
9. `/ai/triage` (line 1463) - Analyze test failures (second implementation - consolidate with #2)
10. `/ai/templates` GET (line 1539) - Get AI templates
11. `/ai/templates` POST (line 1582) - Save AI templates
12. `/ai/generations/{generation_id}/rate` (line 1630) - Rate generation
13. `/ai/generations/{generation_id}/correct` (line 1685) - Correct generation
14. `/ai/gateway/generate` (line 1742) - Model gateway generate
15. `/ai/gateway/chat` (line 1781) - Model gateway chat
16. `/ai/gateway/embedding` (line 1817) - Model gateway embedding
17. `/ai/gateway/usage` (line 1850) - Get LLM usage stats
18. `/ai/training-data/export` (line 2162) - Export training data
19. `/ai/generate-tests-enhanced` (line 4824) - **VERY LARGE** (~620 lines)
20. `/ai/generate-test-plan` (line 5444) - Generate test plan
21. `/ai/generate-tests` (line 5480) - Generate tests (second implementation - different from #1)
22. `/ai/url-discover` (line 5516) - URL discovery
23. `/ai/convert-to-playwright` (line 5790) - Convert to Playwright
24. `/ai/generate-and-execute-automated` (line 5847) - **VERY LARGE** (~475 lines)
25. `/ai/evaluation-summary` (line 6358) - Get evaluation summary

**Note:** Models endpoints (lines 2270-2424) are already in `routers/models_api.py` ✅

## 📋 Required Dependencies for AI Router

### Imports Needed:
```python
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import time
import json
import asyncio
import os
from datetime import datetime
import logging
import concurrent.futures
from fastapi.responses import Response

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
```

### Pydantic Models Needed (from main.py lines 146-216):
- `GenerateTestsRequest`
- `GenerateTestsResponse`
- `TestStep`
- `TestCase`
- `AuditInfo`
- `TriageRequest`
- `TriageResponse`

### Helper Functions Needed:
- `map_priority` (from main.py line 4799) - Already in `endpoint_helpers.py` ✅
- `estimate_tokens` (from main.py line 4809) - Already in `endpoint_helpers.py` ✅
- `_query_usage_sync` (from main.py line 1911) - Should be in router file

## 🎯 Next Steps

1. Create `routers/ai_generation_api.py` with all 25 endpoints
2. Comment out old AI endpoints in `main.py` (lines 437-6358, excluding models)
3. Register router in `main.py`
4. Test imports and functionality

## 📊 Progress

- **Routers Created:** 10/11 (91%)
- **Endpoints Extracted:** 54/106 (51%)
- **Remaining:** 25 AI generation endpoints + ~27 other endpoints


