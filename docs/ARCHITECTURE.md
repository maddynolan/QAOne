# QAAI Platform Architecture

> **Comprehensive Technical Documentation**  
> Version 2.0 | Last Updated: December 2024

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Browser Extension (Flowstral)](#browser-extension-flowstral)
7. [Database Schema](#database-schema)
8. [API Reference](#api-reference)
9. [Core Features](#core-features)
10. [Data Flow](#data-flow)
11. [Deployment](#deployment)

---

## System Overview

QAAI is an enterprise-grade QA automation platform that combines AI-powered test generation with visual workflow building and self-healing test execution.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Visual Test Recording** | Browser extension records user interactions and generates Playwright scripts |
| **AI Test Generation** | Generate tests from requirements using LLM (Anthropic Claude, Ollama) |
| **Self-Healing Tests** | Automatically fix broken selectors during test execution |
| **Multi-Framework Support** | Export to Playwright (Python/TS), Selenium, Cypress |
| **Real-Time Execution** | WebSocket-based live test progress updates |
| **Results Dashboard** | Comprehensive analytics and self-healing statistics |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              QAAI Platform                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   React Frontend │────▶│  FastAPI Backend │────▶│   PostgreSQL/    │    │
│  │   (TypeScript)   │◀────│    (Python)      │◀────│   SQLite DB      │    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│          │                        │                                         │
│          │                        ├─────────────────────────────────────┐   │
│          │                        │                                     │   │
│          │                        ▼                                     ▼   │
│          │              ┌──────────────────┐              ┌─────────────┐  │
│          │              │   LLM Services   │              │  Playwright │  │
│          │              │ (Claude/Ollama)  │              │   Runtime   │  │
│          │              └──────────────────┘              └─────────────┘  │
│          │                                                                  │
│          ▼                                                                  │
│  ┌──────────────────┐                                                      │
│  │ Flowstral Chrome │                                                      │
│  │    Extension     │                                                      │
│  └──────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.100+ |
| Runtime | Python | 3.10+ |
| Database | PostgreSQL / SQLite | 15+ / 3 |
| ORM | Direct SQL (psycopg2) | - |
| WebSocket | FastAPI WebSocket | - |
| Test Execution | Playwright | 1.40+ |

### Frontend
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | React | 18+ |
| Language | TypeScript | 5+ |
| Build Tool | Vite | 5+ |
| State Management | React Query + Hooks | - |
| UI Components | shadcn/ui + Tailwind | - |
| Routing | React Router | 6+ |

### Browser Extension
| Component | Technology |
|-----------|------------|
| Platform | Chrome Extension (Manifest V3) |
| UI | Vanilla JavaScript |
| Communication | Chrome APIs + WebSocket |

---

## Backend Architecture

### Directory Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application entry point
│   ├── config/                 # Configuration management
│   │   └── llm_config.py       # LLM provider configuration
│   ├── middleware/             # Request/response middleware
│   │   ├── rbac_middleware.py  # Role-based access control
│   │   └── tenant_middleware.py # Multi-tenancy support
│   ├── routers/                # API endpoint handlers
│   │   ├── test_cases_crud_api.py
│   │   ├── test_runs_api.py
│   │   ├── flowstral_api.py
│   │   ├── playwright_recorder_api.py
│   │   └── ... (50+ routers)
│   ├── schemas/                # Pydantic models
│   │   ├── agent_schemas.py
│   │   └── requirement_schemas.py
│   ├── services/               # Business logic
│   │   ├── automation/         # Test execution & self-healing
│   │   ├── flowstral/          # Recording pipeline
│   │   ├── llm/                # AI services
│   │   ├── storage/            # Database operations
│   │   └── core/               # System services
│   └── utils/                  # Helper functions
├── logs/                       # Application logs
└── requirements.txt            # Python dependencies
```

### Key Services

#### 1. Test Execution Service (`services/automation/test_execution_service.py`)

Handles Playwright test execution with self-healing support.

```python
class TestExecutionService:
    """
    Responsibilities:
    - Execute Playwright tests (Python/TypeScript)
    - Auto-install dependencies (pytest, playwright)
    - Capture screenshots on failure
    - Emit real-time WebSocket updates
    - Self-heal broken selectors
    """
    
    async def execute_test(
        self,
        test_code: str,
        language: str = "python",
        browser: str = "chromium",
        headless: bool = False,
        execution_id: str = None
    ) -> dict:
        # 1. Create temp directory
        # 2. Write test file
        # 3. Ensure Playwright setup
        # 4. Run pytest/npx playwright test
        # 5. Parse results
        # 6. Attempt self-healing if failed
        # 7. Return execution result
```

#### 2. Flowstral Gateway (`services/flowstral/flowstral_gateway.py`)

Coordinates recording sessions between browser extension and backend.

```python
class FlowstralGateway:
    """
    Responsibilities:
    - Manage recording sessions
    - Process DOM events from extension
    - Generate Playwright scripts
    - Build element models
    """
```

#### 3. LLM Services (`services/llm/`)

| Service | Purpose |
|---------|---------|
| `ollama_service.py` | Local Ollama integration |
| `cached_claude_service.py` | Anthropic Claude with caching |
| `prompt_cache.py` | SQLite-backed prompt caching |
| `unified_llm_gateway.py` | Unified LLM routing |

#### 4. Self-Healing Engine (`services/automation/intelligent_self_healing.py`)

```python
class IntelligentSelfHealingEngine:
    """
    Strategies (in order):
    1. AI-based selector regeneration
    2. Text-based fallback (get_by_text)
    3. Role-based fallback (get_by_role)
    4. Fuzzy attribute matching
    5. Visual/structural similarity
    """
```

### API Routers

| Router | Prefix | Description |
|--------|--------|-------------|
| `test_cases_crud_api` | `/test-cases` | CRUD for test cases |
| `test_runs_api` | `/test-runs` | Test execution management |
| `flowstral_api` | `/api/flowstral` | Recording sessions |
| `playwright_recorder_api` | `/api/playwright-recorder` | Script execution |
| `llm_api` | `/api/llm` | AI generation endpoints |
| `requirements_api` | `/requirements` | Requirements management |
| `defects_api` | `/defects` | Defect tracking |

---

## Frontend Architecture

### Directory Structure

```
src/
├── App.tsx                    # Root component with routes
├── main.tsx                   # Application entry point
├── index.css                  # Global styles (Tailwind)
├── components/
│   ├── ui/                    # shadcn/ui components (50+)
│   ├── Layout.tsx             # Main layout wrapper
│   ├── AppSidebar.tsx         # Navigation sidebar
│   ├── FlowstralWorkflowEditor/  # Workflow editor components
│   └── ...
├── pages/                     # Route components (60+)
│   ├── Dashboard.tsx
│   ├── TestCases.tsx
│   ├── EnhancedWorkflowEditor.tsx
│   ├── TestResultsDashboard.tsx
│   └── ...
├── hooks/                     # Custom React hooks
│   ├── useExecutionWebSocket.ts
│   └── use-toast.ts
├── lib/                       # Utility libraries
│   ├── api-config.ts          # API endpoint configuration
│   ├── data-storage.ts        # Data persistence
│   ├── test-execution-service.ts
│   └── ...
├── contexts/                  # React contexts
│   └── AuthContext.tsx
└── types/                     # TypeScript definitions
```

### Key Pages

#### 1. Unified Test Builder (`pages/UnifiedWorkflowEditor.tsx`) - **NEW (Dec 2024)**

The primary test building interface with ~3100 lines of code, replacing the legacy workflow editor.

**Key Features:**
- **No-Code / Code View Toggle**: Switch between human-readable steps and technical selectors
- **Multi-Export Formats**: Automation (Playwright), API, Database, Performance (K6), Manual
- **Save / Save As**: Update existing test cases or create new ones
- **Assertion Builder**: Structured UI for defining expected results with auto-generated code
- **Import Test Cases as Preconditions**: Reuse common test flows
- **Documentation Formats**: Export to ISTQB, Gherkin/BDD, Markdown
- **Duplicate Element Handling**: Detect and target specific elements with nth() selector
- **Robust Failure Detection**: Screenshot on failure, error message extraction, failed step identification
- **Real Data Integration**: Dashboard shows actual test run results (not mock data)

**Unified Test Case Model:**
```typescript
interface UnifiedTestCase {
  id: string;
  name: string;
  description: string;
  type: 'ui' | 'api' | 'database' | 'performance' | 'manual';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  steps: TestStep[];
  preconditions: PreconditionRef[];  // Imported test cases
  requirements: string[];
  createdAt: string;
  updatedAt: string;
}

interface TestStep {
  id: string;
  type: 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'api' | 'database' | 'scroll' | 'hover' | 'select';
  target: string;           // Human-readable description
  selector?: string;        // Technical selector (hidden in No-Code view)
  value?: string;
  expectedResult?: string;  // Human-readable expected result
  elementIndex?: number;    // For duplicate elements (nth selector)
  
  // Assertion details
  assertionType?: string;   // element_visible, text_contains, url_equals, etc.
  assertionTarget?: string; // Element to verify
  assertionValue?: string;  // Expected value
  assertionDescription?: string;
}
```

**Core State Management:**
```typescript
// Test case state
const [testCase, setTestCase] = useState<UnifiedTestCase>({...});
const [savedTestCaseId, setSavedTestCaseId] = useState<string | null>(null);
const [viewMode, setViewMode] = useState<'no-code' | 'code'>('no-code');

// Execution state
const [isRunning, setIsRunning] = useState(false);
const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'passed' | 'failed'>('idle');
const [failedStep, setFailedStep] = useState<number | null>(null);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
```

**Code Generation with Duplicate Handling:**
```python
# Generated code for click with elementIndex
element = page.get_by_role("button", name="Create account")
if element.count() > 1:
    print(f"⚠️ Multiple elements found ({element.count()}), clicking index 2")
element.nth(2).click()  # Uses elementIndex from step
```

#### 2. Enhanced Workflow Editor (`pages/EnhancedWorkflowEditor.tsx`)

Legacy visual test builder with ~2800 lines of code (maintained for compatibility).

**Features:**
- Visual node-based workflow design
- Multi-framework code generation (Playwright Python/TS, Selenium, Cypress)
- Real-time test execution with WebSocket progress
- Self-healing feedback display
- Manual/Automated/Both test modes
- Assertion builder with 20+ assertion types

**State Management:**
```typescript
// Core state
const [nodes, setNodes] = useState<WorkflowNode[]>([]);
const [framework, setFramework] = useState('playwright-python');
const [testMode, setTestMode] = useState<'manual' | 'automated' | 'both'>('both');

// Execution state
const [isRunning, setIsRunning] = useState(false);
const [runResult, setRunResult] = useState<any>(null);
const [executionProgress, setExecutionProgress] = useState({...});

// WebSocket for real-time updates
const { connect, disconnect, progress } = useExecutionWebSocket({...});
```

**Code Generation:**
```typescript
const generateNodeCode = (node: WorkflowNode): string => {
  const frameworkSelector = convertSelectorToFramework(node.data.selector);
  
  switch (framework) {
    case 'playwright-python':
      return `page.${frameworkSelector}.click()`;
    case 'playwright-typescript':
      return `await page.${frameworkSelector}.click();`;
    // ... other frameworks
  }
};
```

#### 2. Test Results Dashboard (`pages/TestResultsDashboard.tsx`)

**Data Sources:**
- Backend API (`/test-runs`)
- localStorage (`workflow_test_history`)

**Key Metrics:**
- Total runs, pass rate, average duration
- Self-healing statistics
- Screenshot gallery for failures
- Environment comparison

#### 3. Test Cases Page (`pages/TestCases.tsx`)

**Data Flow:**
1. Load from localStorage (instant)
2. Fetch from backend API with timeout
3. Merge results, deduplicate by ID
4. Display in table with search/filter

### Custom Hooks

#### `useExecutionWebSocket`
```typescript
export function useExecutionWebSocket(callbacks: {
  onStepStart: (step: number, name: string) => void;
  onStepComplete: (step: number, status: string, duration: number) => void;
  onSelfHealing: (step: number, original: string, healed: string) => void;
  onComplete: (status: string) => void;
}) {
  // Manages WebSocket connection to /test-runs/ws/{execution_id}
  // Parses incoming messages and triggers callbacks
}
```

---

## Browser Extension (Flowstral)

### Directory Structure

```
flowstral-extension/
├── manifest.json              # Extension manifest (V3)
├── src/
│   ├── content/
│   │   └── content.js         # Injected into pages, captures events
│   ├── background/
│   │   └── background.js      # Service worker
│   └── sidepanel/
│       ├── sidepanel.html     # Side panel UI
│       └── sidepanel.js       # Side panel logic
└── icons/                     # Extension icons
```

### Recording Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User       │────▶│  Content    │────▶│  Background │────▶│  Backend    │
│  Interaction│     │  Script     │     │  Script     │     │  API        │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │                    │
                          │  DOM Event         │  Chrome Message    │  HTTP/WS
                          │  (click, input)    │  Passing           │  
                          ▼                    ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │  Event      │     │  Session    │     │  Script     │
                    │  Capture    │     │  Management │     │  Generation │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

### Event Types Captured

| Event | Data Captured |
|-------|---------------|
| Click | Element selector, coordinates, text |
| Input | Field selector, value entered |
| Navigation | URL, timestamp |
| Scroll | Position |
| Form Submit | Form data |

### Selector Generation Strategy

```javascript
// Priority order for selector generation
const SELECTOR_STRATEGIES = [
  'data-testid',      // Most stable
  'id',               // Unique identifier
  'name',             // Form inputs
  'aria-label',       // Accessibility
  'role + name',      // Playwright recommended
  'text content',     // Fallback
  'css path'          // Last resort
];
```

---

## Database Schema

### Core Tables

```sql
-- Organizations (Multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Test Cases
CREATE TABLE test_cases (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'draft',
    test_type VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Test Case Steps
CREATE TABLE test_case_steps (
    id UUID PRIMARY KEY,
    test_case_id UUID REFERENCES test_cases(id),
    step_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    expected_result TEXT,
    test_data JSONB
);

-- Test Runs
CREATE TABLE test_runs (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    environment VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Test Run Steps (Execution Results)
CREATE TABLE test_run_steps (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES test_runs(id),
    step_number INTEGER,
    status VARCHAR(50),
    duration_ms INTEGER,
    error TEXT,
    screenshot_path TEXT,
    healed_selector TEXT
);

-- Requirements
CREATE TABLE requirements (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Defects
CREATE TABLE defects (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open',
    test_case_id UUID REFERENCES test_cases(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### In-Memory Fallback

When PostgreSQL is unavailable, the system falls back to in-memory dictionaries:

```python
# In-memory storage (test_cases_crud_api.py)
_test_cases_store: Dict[str, Dict[str, Any]] = {}
_test_runs_store: Dict[str, Dict[str, Any]] = {}
```

---

## API Reference

### Test Cases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/test-cases` | List all test cases |
| GET | `/test-cases/{id}` | Get single test case |
| POST | `/test-cases` | Create test case |
| PUT | `/test-cases/{id}` | Update test case |
| DELETE | `/test-cases/{id}` | Delete test case |

### Test Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/playwright-recorder/execute` | Execute Playwright script |
| WS | `/test-runs/ws/{execution_id}` | Real-time execution updates |
| GET | `/test-runs` | List test runs |
| GET | `/test-runs/{id}` | Get run details |

### Flowstral Recording

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/flowstral/sessions` | Create recording session |
| POST | `/api/flowstral/events/batch` | Submit recorded events |
| GET | `/api/flowstral/sessions/{id}/script` | Get generated script |

### AI Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/llm/generate-test` | Generate test from requirement |
| GET | `/api/llm/usage-stats` | Get LLM usage statistics |
| GET | `/api/llm/cache/stats` | Get cache statistics |

---

## Core Features

### 1. Visual Workflow Editor

**Modes:**
- **Manual**: Creates human-readable test cases
- **Automated**: Generates executable Playwright scripts
- **Both**: Generates both simultaneously

**Node Types:**
- Navigate, Click, Input, Wait, Assert
- API calls, Database queries
- Conditions, Loops
- Screenshots, Visual comparison

### 2. Self-Healing Test Execution

**Process:**
1. Execute test normally
2. On selector failure, detect error pattern
3. Apply healing strategies in priority order
4. Update test with healed selector
5. Retry execution
6. Report healing in results

**Healing Strategies:**
```python
HEALING_STRATEGIES = [
    'ai_regeneration',      # Use LLM to suggest new selector
    'text_fallback',        # get_by_text with element text
    'role_fallback',        # get_by_role with accessible name
    'attribute_fuzzy',      # Match similar attributes
    'structural_similarity' # DOM structure analysis
]
```

### 3. Multi-Framework Export

**Supported Frameworks:**
| Framework | Language | File Extension |
|-----------|----------|----------------|
| Playwright | Python | `.py` |
| Playwright | TypeScript | `.ts` |
| Selenium | Java | `.java` |
| Selenium | Python | `.py` |
| Cypress | JavaScript | `.js` |

### 4. LLM Integration

**Providers:**
- Anthropic Claude (cloud)
- Ollama (local)
- OpenAI (optional)

**Caching:**
- Exact match: Identical prompts
- Normalized match: Similar prompts
- Semantic match: Related content

**Cost Optimization:**
- Multi-tier caching (90%+ cache hit rate)
- Model tiering (use smaller models when appropriate)
- Response truncation

---

## Data Flow

### Test Recording & Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEST CREATION FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐   Record   ┌──────────┐   Generate  ┌──────────┐             │
│  │ Browser  │ ─────────▶ │ Flowstral│ ──────────▶ │ Workflow │             │
│  │ Extension│            │ Backend  │             │ Editor   │             │
│  └──────────┘            └──────────┘             └──────────┘             │
│                                                         │                   │
│                                                         │ Edit & Save       │
│                                                         ▼                   │
│  ┌──────────┐   Execute  ┌──────────┐   Results   ┌──────────┐             │
│  │ Results  │ ◀───────── │ Test     │ ◀────────── │ Test     │             │
│  │ Dashboard│            │ Executor │             │ Case     │             │
│  └──────────┘            └──────────┘             └──────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### WebSocket Communication

```
Frontend                          Backend
   │                                │
   │ ───── Connect WS ────────────▶│
   │                                │
   │ ◀───── step_start ───────────│
   │                                │
   │ ◀───── step_complete ────────│
   │                                │
   │ ◀───── self_healing ─────────│  (if selector healed)
   │                                │
   │ ◀───── screenshot ───────────│  (if captured)
   │                                │
   │ ◀───── execution_complete ───│
   │                                │
```

---

## Deployment

### Development Setup

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd ..
npm install
npm run dev

# Extension
# Load flowstral-extension/ as unpacked extension in Chrome
```

### Environment Variables

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-...           # For Claude AI
OLLAMA_URL=http://localhost:11434  # For local Ollama
DATABASE_URL=postgresql://...       # PostgreSQL connection
SECRET_KEY=your-secret-key         # JWT signing

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

### Production Deployment

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      
  frontend:
    build: .
    ports:
      - "3000:3000"
      
  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data
```

---

## Appendix

### File Size Reference

| File | Lines | Description |
|------|-------|-------------|
| `backend/app/main.py` | 7000+ | Main FastAPI app (needs refactoring) |
| `EnhancedWorkflowEditor.tsx` | 2700+ | Visual test builder |
| `test_execution_service.py` | 1600+ | Test runner |
| `flowstral_gateway.py` | 1200+ | Recording orchestration |

### Performance Considerations

- **Database**: Use PostgreSQL for production, SQLite for development
- **Caching**: LLM responses cached in SQLite with TTL
- **WebSocket**: Connection pooling for concurrent executions
- **Screenshots**: Stored on disk, referenced by path in DB

---

*This documentation is auto-generated and maintained. Last updated: December 2024*












