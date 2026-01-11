# Backend API Reference

> **Complete Backend Documentation**  
> FastAPI Application - 50+ Routers, 165+ Services  
> Version 3.0 | Last Updated: January 11, 2026

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [API Routers](#api-routers)
4. [Service Layer](#service-layer)
5. [Database Operations](#database-operations)
6. [WebSocket Handlers](#websocket-handlers)
7. [Configuration](#configuration)
8. [Middleware](#middleware)

---

## Overview

The QAAI backend is a FastAPI application with 50+ routers and 165+ services providing:

- Test case management and execution
- Multi-protocol API testing
- Performance testing with virtual users
- Accessibility scanning (WCAG)
- Visual regression testing
- Security scanning (OWASP)
- AI-powered test generation
- Real-time WebSocket updates

### Quick Stats

| Component | Count |
|-----------|-------|
| **Routers** | 50+ |
| **Services** | 165+ |
| **AI Agents** | 6+ |
| **API Protocols** | 8 |
| **Load Patterns** | 8 |

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI entry (7000+ lines)
│   │
│   ├── config/
│   │   └── llm_config.py           # LLM configuration
│   │
│   ├── middleware/
│   │   ├── rbac_middleware.py      # Role-based access
│   │   └── tenant_middleware.py    # Multi-tenancy
│   │
│   ├── routers/                    # 50+ API routers
│   ├── schemas/                    # Pydantic models
│   ├── services/                   # 165+ services
│   └── utils/                      # Helpers
│
├── logs/                           # App logs
└── requirements.txt                # Dependencies
```

---

## API Routers

### Core Test Management

| Router | Prefix | Description |
|--------|--------|-------------|
| `test_cases_crud_api` | `/test-cases` | Test case CRUD |
| `test_runs_api` | `/test-runs` | Execution management |
| `test_plans_api` | `/test-plans` | Test plan management |
| `requirements_api` | `/requirements` | Requirements CRUD |
| `defects_api` | `/defects` | Defect tracking |
| `traceability_api` | `/traceability` | Coverage matrix |

### Recording & Execution

| Router | Prefix | Description |
|--------|--------|-------------|
| `flowstral_api` | `/api/flowstral` | Recording sessions |
| `flowstral_engine_api` | `/api/flowstral-engine` | Engine control |
| `flowstral_config_api` | `/api/flowstral/config` | Configuration |
| `playwright_recorder_api` | `/api/playwright-recorder` | Script execution |
| `cdp_recorder_api` | `/api/cdp` | Chrome DevTools Protocol |

### API Testing

| Router | Prefix | Description |
|--------|--------|-------------|
| `enhanced_api_testing_api` | `/api/v2/testing` | Multi-protocol testing |
| `api_import_api` | `/api/specs` | OpenAPI/WSDL import |
| `request_chaining_api` | `/api/chains` | Request sequences |
| `oauth2_api` | `/api/oauth2` | OAuth2 flows |

### Performance Testing

| Router | Prefix | Description |
|--------|--------|-------------|
| `performance_api` | `/api/performance` | Load testing |
| `protocol_recording_api` | `/api/protocol` | Protocol capture |

### Quality & Compliance

| Router | Prefix | Description |
|--------|--------|-------------|
| `accessibility_api` | `/api/accessibility` | WCAG scanning |
| `accessibility_scan_api` | `/api/a11y` | Quick scans |
| `visual_testing_api` | `/api/visual-testing` | Visual regression |
| `owasp_security_api` | `/api/security` | Security scanning |
| `compliance_api` | `/api/compliance` | Compliance reports |

### AI & Generation

| Router | Prefix | Description |
|--------|--------|-------------|
| `llm_api` | `/api/llm` | LLM operations |
| `ai_generation_api` | `/api/ai` | Test generation |
| `agents_api` | `/agents` | AI agents |
| `test_case_rewrite_api` | `/api/rewrite` | AI refactoring |
| `gherkin_api` | `/api/gherkin` | BDD conversion |
| `requirement_to_testcase_api` | `/api/req-to-tc` | Auto generation |

### Salesforce

| Router | Prefix | Description |
|--------|--------|-------------|
| `salesforce_api` | `/api/salesforce` | SF operations |
| `salesforce_auth` | `/api/salesforce/auth` | OAuth flow |

### Utilities

| Router | Prefix | Description |
|--------|--------|-------------|
| `code_alchemy_api` | `/api/code-alchemy` | Repo analyzer |
| `framework_analyzer_api` | `/api/framework` | Framework detection |
| `complex_verifications` | `/api/complex-verify` | Email/PDF/File |
| `vision_healing_api` | `/api/vision` | Visual healing |
| `ocr_fallback_api` | `/api/ocr` | OCR backup |
| `secrets_api` | `/api/secrets` | Credential vault |

### Integration

| Router | Prefix | Description |
|--------|--------|-------------|
| `dashboard_api` | `/dashboard` | Dashboard data |
| `metrics_api` | `/metrics` | System metrics |
| `health_api` | `/health` | Health checks |
| `plugin_api` | `/plugins` | Plugin system |

---

## Detailed API Endpoints

### Test Cases (`/test-cases`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/test-cases` | List all test cases |
| POST | `/test-cases` | Create test case |
| GET | `/test-cases/{id}` | Get by ID |
| PUT | `/test-cases/{id}` | Update |
| DELETE | `/test-cases/{id}` | Delete |
| GET | `/test-cases/scale-data` | Bulk data for UI |

**Request Body (Create):**
```json
{
  "title": "Login Test",
  "description": "Verify user login",
  "priority": "high",
  "status": "draft",
  "test_type": "automated",
  "steps": [
    {
      "step_number": 1,
      "action": "Navigate to login page",
      "expected_result": "Page loads",
      "test_data": ""
    }
  ],
  "tags": ["login", "auth"]
}
```

### Test Runs (`/test-runs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/test-runs` | List all runs |
| POST | `/test-runs` | Create run |
| GET | `/test-runs/{id}` | Get run details |
| PUT | `/test-runs/{id}` | Update run |
| WS | `/test-runs/ws/{execution_id}` | Real-time updates |

**WebSocket Messages:**
```json
// step_start
{"type": "step_start", "step": 1, "name": "Navigate to URL"}

// step_complete
{"type": "step_complete", "step": 1, "status": "passed", "duration_ms": 1234}

// self_healing
{"type": "self_healing", "step": 2, "original": "...", "healed": "..."}

// execution_complete
{"type": "execution_complete", "status": "passed", "total_steps": 5}
```

### Playwright Execution (`/api/playwright-recorder`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/execute` | Execute script |
| POST | `/generate-script` | Generate from events |

**Execute Request:**
```json
{
  "script": "def test_login(page): ...",
  "language": "python",
  "browser": "chromium",
  "headless": false,
  "execution_id": "exec_123",
  "workflow_name": "Login Test"
}
```

### Enhanced API Testing (`/api/v2/testing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/test-suite/generate` | Generate comprehensive suite |
| POST | `/execute` | Execute test suite |
| POST | `/load-test` | Run load test |
| GET | `/environments` | List environments |
| POST | `/environments` | Create environment |
| POST | `/virtual-services` | Create mock service |
| POST | `/database/connect` | Connect to DB |
| POST | `/database/query` | Execute query |

**Generate Test Suite:**
```json
{
  "api_spec": { /* OpenAPI/Swagger spec */ },
  "spec_format": "openapi",
  "protocol": "REST",
  "test_options": {
    "include_security": true,
    "include_performance": true,
    "data_driven": true
  }
}
```

**Supported Protocols:**
- REST
- SOAP
- GraphQL
- gRPC
- Kafka
- MQTT
- WebSocket
- AMQP

### Performance Testing (`/api/performance`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scenarios` | Create scenario |
| GET | `/scenarios` | List scenarios |
| GET | `/scenarios/{id}` | Get scenario |
| POST | `/scenarios/from-flowstral` | From recording |
| POST | `/scenarios/{id}/run` | Execute |
| GET | `/scenarios/{id}/results` | Get results |
| POST | `/scenarios/{id}/stop` | Stop running |

**Load Test Configuration:**
```json
{
  "scenario_id": "scn_123",
  "config": {
    "pattern": "ramp_up",
    "virtual_users": 100,
    "duration_seconds": 300,
    "ramp_up_seconds": 60,
    "think_time": { "min": 1000, "max": 3000 }
  }
}
```

**Load Patterns:**
- `constant` - Steady state
- `ramp_up` - Gradual increase
- `ramp_down` - Gradual decrease
- `spike` - Sudden burst
- `stress` - Beyond capacity
- `soak` - Extended duration
- `breakpoint` - Find limits
- `wave` - Cyclic pattern

### Accessibility (`/api/accessibility`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scan` | Full page scan |
| POST | `/component-scan` | Component scan |
| POST | `/site-audit` | Multi-page audit |
| POST | `/vpat/generate` | Generate VPAT |
| GET | `/standards` | List standards |

**Scan Request:**
```json
{
  "url": "https://example.com",
  "scan_type": "full_page",
  "component_selector": null,
  "standards": ["wcag2aa", "wcag21aa"]
}
```

**Standards Supported:**
- WCAG 2.0 A/AA/AAA
- WCAG 2.1 A/AA/AAA
- Section 508
- Best practices

### Visual Testing (`/api/visual-testing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/compare` | Compare two images |
| POST | `/compare-by-name` | Against stored baseline |
| POST | `/baseline` | Save baseline |
| GET | `/baselines` | List baselines |
| PUT | `/baseline/{name}` | Update baseline |
| DELETE | `/baseline/{name}` | Delete baseline |
| POST | `/batch-compare` | Multiple comparisons |

**Comparison Modes:**
- `pixel_perfect` - Exact match
- `anti_aliased` - Font tolerance
- `perceptual` - Hash-based
- `structural` - SSIM
- `layout` - Position only

**Compare Request:**
```json
{
  "baseline": "base64_or_path",
  "actual": "base64_or_path",
  "mode": "anti_aliased",
  "threshold": 0.1,
  "ignore_regions": [
    {"x": 10, "y": 10, "width": 100, "height": 50, "reason": "timestamp"}
  ]
}
```

### Security Testing (`/api/security`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scan` | Full OWASP scan |
| POST | `/quick-scan` | Quick scan |
| GET | `/scan/{id}` | Get results |
| GET | `/categories` | List scan types |

**Scan Types (OWASP API Top 10):**
- `bola` - Broken Object Level Authorization
- `broken_auth` - Broken Authentication
- `bopla` - Broken Object Property Level Auth
- `resource_consumption` - Unrestricted Resources
- `bfla` - Broken Function Level Auth
- `ssrf` - Server-Side Request Forgery
- `misconfig` - Security Misconfiguration
- `inventory` - Improper Inventory Management

### AI/LLM (`/api/llm`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate-test` | Generate from requirement |
| POST | `/generate-script` | Generate Playwright |
| POST | `/improve-test` | Enhance existing |
| GET | `/usage-stats` | Token usage |
| GET | `/cache/stats` | Cache metrics |
| POST | `/cache/clear` | Clear cache |
| GET | `/providers` | Available LLMs |

**Generate Request:**
```json
{
  "requirement": "User should be able to login with valid credentials",
  "framework": "playwright-python",
  "include_assertions": true,
  "app_type": "salesforce"
}
```

### AI Agents (`/agents`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/execute` | Execute agent task |
| GET | `/` | List agents |
| GET | `/{type}/health` | Agent health |
| GET | `/health` | All agents health |

**Agent Types:**
- `test_design` - Test strategy creation
- `requirements` - Requirement parsing
- `defect` - Bug triage
- `performance` - Results analysis
- `security` - Finding review
- `accessibility` - WCAG guidance

### Complex Verifications (`/api/complex-verify`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/capabilities` | Installed libraries |
| POST | `/email/initialize` | Setup email provider |
| POST | `/email/verify` | Verify email |
| POST | `/email/check-latest` | Debug: get emails |
| POST | `/pdf/verify` | Verify PDF |
| POST | `/pdf/parse` | Extract PDF text |
| POST | `/file/verify` | Verify file |

**Email Verification:**
```json
{
  "provider": "microsoft_365",
  "inbox": "test@company.com",
  "subject_filter": "verification code",
  "timeout_seconds": 60,
  "assertions": [
    {"type": "subject_contains", "expected": "verification"}
  ],
  "extract_otp": {"store_as": "otpCode"}
}
```

**PDF Verification:**
```json
{
  "source": "https://example.com/doc.pdf",
  "source_type": "url",
  "assertions": [
    {"type": "contains_text", "expected": "Invoice"},
    {"type": "page_count", "expected": "2"}
  ]
}
```

### Code Alchemy (`/api/code-alchemy`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Analyze repository |
| POST | `/branches` | List branches |
| GET | `/analysis/{id}` | Get analysis |
| GET | `/analysis/{id}/preview` | Preview tests |
| POST | `/import` | Import test cases |
| GET | `/import/{job_id}` | Import status |

**Analyze Request:**
```json
{
  "url": "https://github.com/org/repo",
  "branch": "main",
  "token": "ghp_xxx",
  "path": "src/tests"
}
```

### Salesforce (`/api/salesforce`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/status` | Connection status |
| POST | `/auth/token` | Set credentials |
| GET | `/auth/oauth/url` | Get OAuth URL |
| POST | `/auth/oauth/callback` | OAuth callback |
| POST | `/proxy` | Proxy API calls |
| GET | `/objects` | List SObjects |
| GET | `/objects/{name}` | Describe object |
| POST | `/query` | Execute SOQL |
| POST | `/apex/execute` | Run Apex |
| GET | `/tests` | List Apex tests |
| POST | `/tests/run` | Run Apex tests |

---

## Service Layer

### Automation Services (`services/automation/`)

| Service | Purpose |
|---------|---------|
| `test_execution_service.py` | Core test runner (1600+ lines) |
| `intelligent_self_healing.py` | AI selector healing |
| `auto_healing_service.py` | Pattern-based healing |
| `visual_testing_engine.py` | Image comparison |
| `locator_engine.py` | Selector generation |
| `enhanced_selector_engine.py` | Smart selectors |
| `script_converter.py` | Framework conversion |

### Flowstral Services (`services/flowstral/`)

| Service | Purpose |
|---------|---------|
| `flowstral_gateway.py` | Recording coordinator (1200+ lines) |
| `flowstral_session.py` | Session management |
| `enhanced_playwright_generator.py` | Script generation |
| `flowstral_websocket_manager.py` | WebSocket handling |
| `flowstral_wcag_pipeline.py` | Accessibility pipeline |

### LLM Services (`services/llm/`)

| Service | Purpose |
|---------|---------|
| `ollama_service.py` | Local Ollama |
| `cached_claude_service.py` | Claude with caching |
| `prompt_cache.py` | SQLite cache |
| `unified_llm_gateway.py` | Provider routing |
| `vllm_service.py` | vLLM integration |

### API Testing (`services/api_testing/`)

| Service | Purpose |
|---------|---------|
| `enhanced_api_test_engine.py` | Multi-protocol engine |
| `request_chaining.py` | Property transfer |
| `oauth2_authenticator.py` | OAuth flows |
| `owasp_api_security.py` | Security scanning |
| `service_virtualization.py` | Mock services |
| `database_connector.py` | DB operations |

### Performance (`services/performance/`)

| Service | Purpose |
|---------|---------|
| `performance_engine.py` | Core engine |
| `scenario_compiler.py` | Script compilation |
| `go_runner_client.py` | Go-based executor |
| `virtual_user_manager.py` | VU simulation |
| `metrics_collector.py` | Results aggregation |

### AI Agents (`services/agents/`)

| Agent | Purpose |
|-------|---------|
| `test_design_agent.py` | Test strategy |
| `requirements_agent.py` | Requirement parsing |
| `defect_agent.py` | Bug triage |
| `performance_agent.py` | Results analysis |
| `security_agent.py` | Finding review |
| `accessibility_agent.py` | WCAG guidance |

### Storage (`services/storage/`)

| Service | Purpose |
|---------|---------|
| `database_service.py` | SQLite operations |
| `postgres_direct.py` | PostgreSQL queries |
| `ai_storage.py` | AI artifact storage |

---

## Database Operations

### PostgreSQL (Production)

```python
from app.services.storage.database import get_database_client

pool = get_database_client()
conn = pool.getconn()
cursor = conn.cursor()
cursor.execute("SELECT * FROM test_cases WHERE project_id = %s", (project_id,))
results = cursor.fetchall()
pool.putconn(conn)
```

### SQLite (Development)

```python
from app.services.storage.database_service import init_database

# Tables created on init:
# - test_cases, test_case_steps
# - test_runs, test_run_steps
# - requirements, defects
# - traceability_links
```

### In-Memory (Fallback)

```python
# In routers when DB unavailable
_test_cases_store: Dict[str, Dict[str, Any]] = {}
```

---

## WebSocket Handlers

### ExecutionWebSocketManager

```python
class ExecutionWebSocketManager:
    """Real-time test execution updates"""
    
    async def connect(execution_id: str, websocket: WebSocket)
    async def disconnect(execution_id: str, websocket: WebSocket)
    
    async def send_step_start(execution_id: str, step: int, name: str)
    async def send_step_complete(execution_id: str, step: int, status: str, duration: int)
    async def send_self_healing(execution_id: str, step: int, original: str, healed: str)
    async def send_screenshot(execution_id: str, step: int, path: str)
    async def send_execution_complete(execution_id: str, status: str)
```

### FlowstralWebSocketManager

```python
class FlowstralWebSocketManager:
    """Recording session updates"""
    
    async def send_event_received(session_id: str, event: dict)
    async def send_script_generated(session_id: str, script: str)
    async def send_session_closed(session_id: str)
```

---

## Configuration

### Environment Variables

```bash
# LLM
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/qaai
SQLITE_PATH=./qa_platform.db

# Security
SECRET_KEY=your-jwt-secret
CORS_ORIGINS=http://localhost:5173

# Feature Flags
ENABLE_SELF_HEALING=true
ENABLE_AI_GENERATION=true
ENABLE_CACHE=true
```

### LLM Configuration

```python
# app/config/llm_config.py
LLM_CONFIG = {
    "default_provider": "anthropic",
    "models": {
        "anthropic": {
            "default": "claude-3-5-sonnet-20241022",
            "fast": "claude-3-haiku-20240307",
            "powerful": "claude-3-opus-20240229"
        },
        "ollama": {
            "default": "qwen2.5:7b",
            "code": "qwen2.5-coder:7b"
        }
    },
    "cache_ttl": {
        "test_generation": 86400,
        "analysis": 3600,
        "default": 7200
    }
}
```

---

## Middleware

### RBAC Middleware

```python
class RBACMiddleware:
    """Role-based access control"""
    
    # Roles: admin, manager, tester, viewer
    # Permissions checked per endpoint
```

### Tenant Middleware

```python
class TenantContextMiddleware:
    """Multi-tenant isolation"""
    
    # Extract tenant from JWT/header
    # Inject into request context
    # Apply RLS filters
```

---

## Logging

### Configuration

```python
# Rotating file handler
RotatingFileHandler(
    "logs/app.log",
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)

# Format
'%(asctime)s - %(name)s - %(levelname)s - %(message)s'
```

### Viewing Logs

```powershell
# Windows
Get-Content backend\logs\app.log -Tail 100

# Real-time
Get-Content backend\logs\app.log -Wait -Tail 50
```

---

*Last updated: January 11, 2026*
