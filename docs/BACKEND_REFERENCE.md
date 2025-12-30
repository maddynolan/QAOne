# Backend API Reference

> **Detailed Backend Documentation**  
> FastAPI Application Structure and Service Layer

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Main Application](#main-application)
3. [API Routers](#api-routers)
4. [Service Layer](#service-layer)
5. [Database Operations](#database-operations)
6. [WebSocket Handlers](#websocket-handlers)
7. [Configuration](#configuration)

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI app entry point (7000+ lines)
│   │
│   ├── config/
│   │   └── llm_config.py           # LLM provider configuration
│   │
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── rbac_middleware.py      # Role-based access control
│   │   └── tenant_middleware.py    # Multi-tenant isolation
│   │
│   ├── decorators/
│   │   ├── __init__.py
│   │   ├── audit.py                # Audit logging decorator
│   │   └── permissions.py          # Permission checking decorator
│   │
│   ├── routers/                    # API endpoint handlers (50+ files)
│   │   ├── test_cases_crud_api.py  # Test case CRUD operations
│   │   ├── test_runs_api.py        # Test run management
│   │   ├── flowstral_api.py        # Recording session management
│   │   ├── playwright_recorder_api.py  # Script execution
│   │   ├── llm_api.py              # AI generation endpoints
│   │   └── ...
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── agent_schemas.py        # Agent-related Pydantic models
│   │   └── requirement_schemas.py  # Requirement Pydantic models
│   │
│   ├── services/                   # Business logic (165+ files)
│   │   ├── automation/             # Test execution & self-healing
│   │   ├── flowstral/              # Recording pipeline
│   │   ├── llm/                    # AI/LLM services
│   │   ├── storage/                # Database operations
│   │   ├── core/                   # System services
│   │   ├── engines/                # Test engines
│   │   ├── executors/              # Test runners
│   │   ├── exploration/            # Exploratory testing
│   │   └── ...
│   │
│   └── utils/
│       ├── endpoint_helpers.py     # Common endpoint utilities
│       ├── rls_query.py            # Row-level security helpers
│       └── variation_marker.py     # Test variation utilities
│
├── logs/                           # Application log files
│   └── app.log                     # Rotating log (10MB, 5 backups)
│
├── requirements.txt                # Python dependencies
└── .env                            # Environment configuration
```

---

## Main Application

### File: `app/main.py`

The main FastAPI application file handles:
- Application initialization and lifecycle
- Router registration
- CORS configuration
- Global exception handling
- Legacy endpoint definitions

### Initialization Sequence

```python
# 1. Windows asyncio policy (for Playwright subprocess)
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# 2. Logging setup
logging.basicConfig(
    level=logging.INFO,
    handlers=[
        RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)

# 3. Environment loading
load_dotenv()

# 4. Service imports (after env loaded)
from app.services.llm.ollama_service import OllamaService

# 5. Agent registration
from app.services.core.agent_registration import register_all_agents
register_all_agents()

# 6. FastAPI app creation with lifespan
app = FastAPI(lifespan=lifespan)
```

### Lifespan Handler

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting QA AI Backend...")
    from app.services.storage.database_service import init_database
    await init_database()
    logger.info("SQLite database initialized")
    yield
    # Shutdown
    logger.info("Shutting down...")
```

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## API Routers

### Test Cases (`routers/test_cases_crud_api.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/test-cases` | GET | List all test cases |
| `/test-cases` | POST | Create test case |
| `/test-cases/{id}` | GET | Get test case by ID |
| `/test-cases/{id}` | PUT | Update test case |
| `/test-cases/{id}` | DELETE | Delete test case |

**Request/Response Models:**

```python
# Create Test Case Request
{
    "title": "Login Test",
    "description": "Test user login flow",
    "priority": "high",  # critical, high, medium, low
    "status": "draft",   # draft, active, deprecated
    "test_type": "automated",  # manual, automated, unified
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

# Response
{
    "id": "abc123",
    "title": "Login Test",
    "createdAt": "2024-12-15T00:00:00Z",
    ...
}
```

### Test Runs (`routers/test_runs_api.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/test-runs` | GET | List all test runs |
| `/test-runs` | POST | Create test run |
| `/test-runs/{id}` | GET | Get run details |
| `/test-runs/{id}` | PUT | Update run |
| `/test-runs/ws/{execution_id}` | WS | Real-time updates |

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

### Flowstral Recording (`routers/flowstral_api.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/flowstral/sessions` | POST | Create recording session |
| `/api/flowstral/sessions/{id}` | GET | Get session details |
| `/api/flowstral/events/batch` | POST | Submit batch events |
| `/api/flowstral/sessions/{id}/script` | GET | Get generated script |
| `/api/flowstral/analyze` | POST | Analyze page elements |

### Playwright Execution (`routers/playwright_recorder_api.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/playwright-recorder/execute` | POST | Execute Playwright script |
| `/api/playwright-recorder/generate-script` | POST | Generate script from events |

**Execute Request:**

```python
{
    "script": "def test_login(page): ...",
    "language": "python",  # python, typescript
    "browser": "chromium",  # chromium, firefox, webkit
    "headless": false,
    "execution_id": "exec_123",
    "workflow_name": "Login Test"
}
```

### LLM API (`routers/llm_api.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llm/generate-test` | POST | Generate test from requirement |
| `/api/llm/generate-script` | POST | Generate Playwright script |
| `/api/llm/usage-stats` | GET | Get usage statistics |
| `/api/llm/cache/stats` | GET | Get cache statistics |
| `/api/llm/cache/clear` | POST | Clear cache |

---

## Service Layer

### Automation Services (`services/automation/`)

#### TestExecutionService

**File:** `test_execution_service.py` (1600+ lines)

```python
class TestExecutionService:
    """
    Core test execution engine with self-healing support.
    
    Responsibilities:
    - Create temporary test directories
    - Write test files (Python/TypeScript)
    - Install dependencies (pytest, playwright)
    - Execute tests via subprocess
    - Parse results and screenshots
    - Attempt self-healing on failure
    - Emit WebSocket progress events
    """
    
    async def execute_test(
        self,
        test_code: str,
        language: str = "python",
        browser: str = "chromium",
        headless: bool = False,
        test_name: str = "test",
        execution_id: str = None,
        step_names: List[str] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for test execution.
        
        Returns:
            {
                "status": "passed" | "failed",
                "exit_code": 0,
                "stdout": "...",
                "stderr": "...",
                "duration": 5.2,
                "screenshots": ["path/to/screenshot.png"],
                "healed_selectors": [...]
            }
        """
```

**Execution Flow:**

```
1. Create temp directory
   └─ C:\Users\...\AppData\Local\Temp\flowstral_test_results\{name}_{timestamp}\

2. Write test file
   └─ test_{name}.py

3. Ensure Playwright setup
   ├─ Create requirements.txt
   ├─ Create conftest.py (with screenshot-on-failure hook)
   ├─ Install pytest, pytest-playwright
   └─ Install Playwright browsers

4. Execute test
   └─ python -m pytest test_{name}.py -v --headed --browser=chromium

5. Parse results
   ├─ Check exit code
   ├─ Parse stdout/stderr
   └─ Find screenshots in test-results/

6. Self-heal if failed
   ├─ Detect selector failure pattern
   ├─ Extract failed selector
   ├─ Apply healing strategies
   └─ Retry execution

7. Return results
```

#### IntelligentSelfHealingEngine

**File:** `intelligent_self_healing.py`

```python
class IntelligentSelfHealingEngine:
    """
    AI-powered self-healing for broken selectors.
    
    Strategies (in priority order):
    1. AI regeneration - Use LLM to suggest new selector
    2. Text fallback - get_by_text with element text
    3. Role fallback - get_by_role with accessible name
    4. Fuzzy attribute match - Similar attributes
    5. Structural similarity - DOM position analysis
    """
    
    async def heal_selector(
        self,
        failed_selector: str,
        page_html: str,
        error_message: str
    ) -> Optional[str]:
        """Attempt to heal a broken selector."""
```

#### AutoHealingService

**File:** `auto_healing_service.py`

```python
class AutoHealingService:
    """
    Simpler self-healing for common patterns.
    
    Handles:
    - ID changes
    - Class name changes
    - Text content changes
    - Attribute updates
    """
```

### Flowstral Services (`services/flowstral/`)

#### FlowstralGateway

**File:** `flowstral_gateway.py` (1200+ lines)

```python
class FlowstralGateway:
    """
    Central coordinator for recording sessions.
    
    Manages:
    - Session lifecycle (create, update, close)
    - Event processing from browser extension
    - Script generation from recorded events
    - Element model building
    """
    
    async def create_session(
        self,
        page_url: str,
        user_agent: str = None
    ) -> str:
        """Create new recording session, returns session_id."""
    
    async def process_events(
        self,
        session_id: str,
        events: List[Dict]
    ) -> Dict:
        """Process batch of DOM events."""
    
    async def generate_script(
        self,
        session_id: str,
        framework: str = "playwright-python"
    ) -> str:
        """Generate test script from recorded events."""
```

#### FlowstralSession

**File:** `flowstral_session.py`

```python
class FlowstralSession:
    """
    Individual recording session state.
    
    Stores:
    - Session metadata (ID, URL, start time)
    - Recorded events list
    - Element models
    - Generated artifacts
    """
```

#### EnhancedPlaywrightGenerator

**File:** `enhanced_playwright_generator.py`

```python
class EnhancedPlaywrightGenerator:
    """
    Generates Playwright scripts from recorded events.
    
    Features:
    - Smart selector generation (data-testid, role, text)
    - Wait state handling
    - Assertion generation
    - Error handling wrappers
    """
```

### LLM Services (`services/llm/`)

#### OllamaService

**File:** `ollama_service.py`

```python
class OllamaService:
    """
    Local Ollama LLM integration.
    
    Supports:
    - Model selection (qwen2.5, llama, etc.)
    - Streaming responses
    - Template-based prompts
    """
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv("OLLAMA_URL", "http://localhost:11434")
    
    async def generate(
        self,
        prompt: str,
        model: str = "qwen2.5:7b",
        stream: bool = False
    ) -> str:
        """Generate response from Ollama."""
```

#### CachedClaudeService

**File:** `cached_claude_service.py`

```python
class CachedClaudeService:
    """
    Anthropic Claude with multi-tier caching.
    
    Cache Layers:
    1. Exact match - Identical prompts
    2. Normalized match - Whitespace/format normalized
    3. Semantic match - Similar meaning (embeddings)
    
    Cost Optimization:
    - 90%+ cache hit rate typical
    - Per-task TTLs (test gen: 24h, analysis: 1h)
    - Model tiering (haiku for simple, opus for complex)
    """
```

#### PromptCache

**File:** `prompt_cache.py`

```python
class PromptCache:
    """
    SQLite-backed persistent cache for LLM responses.
    
    Schema:
        CREATE TABLE cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            task_type TEXT,
            created_at TIMESTAMP,
            expires_at TIMESTAMP
        );
    
    Methods:
    - get(key, task_type) -> Optional[str]
    - set(key, value, task_type, ttl)
    - get_stats() -> CacheStats
    """
```

### Storage Services (`services/storage/`)

#### DatabaseService

**File:** `database_service.py`

```python
# SQLite-based storage for development/fallback

async def init_database():
    """Initialize SQLite database with schema."""

async def create_test_case(data: dict) -> dict:
    """Create test case in SQLite."""

async def get_test_cases() -> List[dict]:
    """Get all test cases from SQLite."""
```

#### PostgresDirect

**File:** `postgres_direct.py`

```python
# Direct PostgreSQL queries (psycopg2)

async def execute_query(query: str, params: tuple) -> List[dict]:
    """Execute SQL query with parameters."""

async def execute_many(query: str, params_list: List[tuple]) -> int:
    """Execute batch insert/update."""
```

### Core Services (`services/core/`)

#### AgentRegistry

**File:** `agent_registry.py`

```python
class AgentRegistry:
    """
    Registry for AI agents.
    
    Agent Types:
    - Test Generator
    - Requirement Analyzer
    - Gap Analyzer
    - Script Refiner
    """
```

#### Orchestrator

**File:** `orchestrator.py`

```python
class Orchestrator:
    """
    Coordinates multi-agent workflows.
    
    Example Flow:
    1. Requirement Agent analyzes input
    2. Generator Agent creates tests
    3. Refiner Agent improves code
    4. Validator Agent checks quality
    """
```

---

## Database Operations

### PostgreSQL (Production)

**Connection:**
```python
from app.services.storage.database import get_database_client

pool = get_database_client()
conn = pool.getconn()
cursor = conn.cursor()
cursor.execute("SELECT * FROM test_cases WHERE project_id = %s", (project_id,))
results = cursor.fetchall()
pool.putconn(conn)
```

### SQLite (Development/Fallback)

**Location:** `backend/qa_platform.db`

**Schema defined in:** `database_service.py`

```python
# Tables created on init:
- test_cases
- test_case_steps
- test_runs
- test_run_steps
- requirements
- defects
```

### In-Memory (Last Resort)

When both PostgreSQL and SQLite fail:

```python
# In routers
_test_cases_store: Dict[str, Dict[str, Any]] = {}

def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available."""
    try:
        from app.services.storage.database import get_database_client
        pool = get_database_client()
        return pool is not None
    except:
        return False
```

---

## WebSocket Handlers

### ExecutionWebSocketManager

**File:** `services/execution_websocket_manager.py`

```python
class ExecutionWebSocketManager:
    """
    Manages WebSocket connections for real-time test updates.
    
    Events:
    - step_start(execution_id, step, name)
    - step_complete(execution_id, step, status, duration, error, screenshot)
    - self_healing(execution_id, step, original, healed, strategy)
    - screenshot(execution_id, step, type, base64_data, path)
    - execution_complete(execution_id, status, total_steps, passed, failed)
    - log(execution_id, level, message)
    """
    
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, execution_id: str, websocket: WebSocket):
        """Register new WebSocket connection."""
    
    async def disconnect(self, execution_id: str, websocket: WebSocket):
        """Remove WebSocket connection."""
    
    async def send_step_start(self, execution_id: str, step: int, name: str):
        """Broadcast step start to all connected clients."""
```

### FlowstralWebSocketManager

**File:** `services/flowstral/flowstral_websocket_manager.py`

```python
class FlowstralWebSocketManager:
    """
    WebSocket manager for recording session updates.
    
    Events:
    - event_received(session_id, event_type, element_info)
    - script_generated(session_id, script)
    - session_closed(session_id)
    """
```

---

## Configuration

### Environment Variables

```bash
# LLM Configuration
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
OLLAMA_URL=http://localhost:11434      # Local Ollama URL
OPENAI_API_KEY=sk-...                  # Optional OpenAI key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/qaai
SQLITE_PATH=./qa_platform.db           # Fallback SQLite

# Security
SECRET_KEY=your-jwt-secret-key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Feature Flags
ENABLE_SELF_HEALING=true
ENABLE_AI_GENERATION=true
ENABLE_CACHE=true
```

### LLM Configuration

**File:** `app/config/llm_config.py`

```python
LLM_CONFIG = {
    "default_provider": "anthropic",  # anthropic, ollama, openai
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
        "test_generation": 86400,  # 24 hours
        "analysis": 3600,          # 1 hour
        "default": 7200            # 2 hours
    }
}
```

---

## Logging

### Configuration

```python
# Rotating file handler
RotatingFileHandler(
    "logs/app.log",
    maxBytes=10*1024*1024,  # 10MB per file
    backupCount=5           # Keep 5 backups
)

# Format
'%(asctime)s - %(name)s - %(levelname)s - %(message)s'
```

### Log Levels

| Level | Usage |
|-------|-------|
| DEBUG | Detailed execution flow |
| INFO | Normal operations |
| WARNING | Non-critical issues |
| ERROR | Failures requiring attention |

### Viewing Logs

```powershell
# Windows
Get-Content backend\logs\app.log -Tail 100

# Or follow in real-time
Get-Content backend\logs\app.log -Wait -Tail 50
```

---

*Last updated: December 2024*












