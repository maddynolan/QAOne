# QAAI Platform Architecture

> **Comprehensive Technical Documentation**  
> Version 3.0 | Last Updated: January 11, 2026

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Browser Extension (Flowstral)](#browser-extension-flowstral)
7. [AI/ML Architecture](#aiml-architecture)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Core Features](#core-features)
11. [Data Flow](#data-flow)
12. [Deployment](#deployment)

---

## System Overview

QAAI/ArisTrace is an enterprise-grade QA automation platform combining AI-powered test generation, visual workflow building, self-healing test execution, and comprehensive multi-protocol API testing.

### Platform Statistics

| Component | Count | Description |
|-----------|-------|-------------|
| **Frontend Pages** | 60+ | React TypeScript components |
| **Backend Routers** | 50+ | FastAPI API endpoints |
| **Services** | 165+ | Business logic modules |
| **UI Components** | 70+ | shadcn/ui + custom |
| **AI Agents** | 6+ | Specialized task handlers |

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Visual Test Recording** | Browser extension records user interactions and generates Playwright scripts |
| **AI Test Generation** | Generate tests from requirements using LLM (Claude, Ollama, OpenAI) |
| **Self-Healing Tests** | Automatically fix broken selectors during test execution |
| **Multi-Framework Support** | Export to Playwright (Python/TS), Selenium, Cypress, K6 |
| **Multi-Protocol API Testing** | REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, AMQP |
| **Performance Testing** | Virtual user simulation with 8 load patterns |
| **Accessibility Scanning** | WCAG 2.1 AA/AAA compliance with VPAT generation |
| **Visual Regression** | 5 comparison modes with intelligent diff detection |
| **Security Testing** | OWASP API Security Top 10 scanning |
| **Enterprise App Support** | 25+ applications (Salesforce, ServiceNow, Workday, SAP, etc.) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           QAAI/ArisTrace Platform Architecture                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐            │
│  │   React Frontend │────▶│  FastAPI Backend │────▶│   PostgreSQL/    │            │
│  │   (TypeScript)   │◀────│    (Python)      │◀────│   SQLite DB      │            │
│  │   60+ Pages      │     │   50+ Routers    │     │                  │            │
│  │   70+ Components │     │   165+ Services  │     │                  │            │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘            │
│          │                        │                                                  │
│          │                        ├────────────────────────────────────┐            │
│          │                        │                                    │            │
│          │                        ▼                                    ▼            │
│          │              ┌──────────────────┐              ┌──────────────────┐     │
│          │              │   AI Layer       │              │  Test Execution  │     │
│          │              │ ┌──────────────┐ │              │ ┌──────────────┐ │     │
│          │              │ │ Claude       │ │              │ │ Playwright   │ │     │
│          │              │ │ Ollama       │ │              │ │ Selenium     │ │     │
│          │              │ │ OpenAI       │ │              │ │ K6/Artillery │ │     │
│          │              │ │ vLLM         │ │              │ │ ZAP Scanner  │ │     │
│          │              │ └──────────────┘ │              │ └──────────────┘ │     │
│          │              └──────────────────┘              └──────────────────┘     │
│          │                        │                                                  │
│          │                        │                                                  │
│          ▼                        ▼                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                                        │
│  │ Flowstral Chrome │   │   AI Agents      │                                        │
│  │    Extension     │   │ ┌──────────────┐ │                                        │
│  │  Visual Recorder │   │ │ Test Design  │ │                                        │
│  └──────────────────┘   │ │ Requirements │ │                                        │
│                         │ │ Defect       │ │                                        │
│                         │ │ Performance  │ │                                        │
│                         │ │ Security     │ │                                        │
│                         │ │ Accessibility│ │                                        │
│                         │ └──────────────┘ │                                        │
│                         └──────────────────┘                                        │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.100+ | High-performance async API |
| Runtime | Python | 3.10+ | Backend execution |
| Database | PostgreSQL / SQLite | 15+ / 3 | Persistent storage |
| ORM | Direct SQL (psycopg2) | - | Database operations |
| WebSocket | FastAPI WebSocket | - | Real-time communication |
| Test Execution | Playwright | 1.40+ | Browser automation |
| Performance | K6 + Go Runner | - | Load testing |
| Security | OWASP ZAP | - | Vulnerability scanning |
| Accessibility | Axe-core | 4.8+ | WCAG compliance |

### Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 18+ | UI framework |
| Language | TypeScript | 5+ | Type safety |
| Build Tool | Vite | 5+ | Fast development |
| State Management | React Query + Zustand | - | Data & UI state |
| UI Components | shadcn/ui + Tailwind | - | Professional design |
| Routing | React Router | 6+ | Navigation |
| Editor | Monaco Editor | - | Code editing |
| Charts | Recharts | - | Data visualization |

### Browser Extension

| Component | Technology | Purpose |
|-----------|------------|---------|
| Platform | Chrome Extension (Manifest V3) | Recording interface |
| UI | Vanilla JavaScript | Side panel interface |
| Communication | Chrome APIs + WebSocket | Backend sync |

### AI/ML Stack

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude 3.5 Sonnet/Opus/Haiku | Primary cloud LLM |
| Ollama | Qwen 2.5, LLaMA, Mistral | Local/air-gapped |
| OpenAI | GPT-4, GPT-3.5 | Alternative cloud |
| vLLM | Custom fine-tuned | Enterprise-specific |

---

## Backend Architecture

### Directory Structure

```
backend/
├── app/
│   ├── main.py                     # FastAPI application entry (7000+ lines)
│   │
│   ├── config/
│   │   └── llm_config.py           # LLM provider configuration
│   │
│   ├── middleware/
│   │   ├── rbac_middleware.py      # Role-based access control
│   │   └── tenant_middleware.py    # Multi-tenant isolation
│   │
│   ├── decorators/
│   │   ├── audit.py                # Audit logging
│   │   └── permissions.py          # Permission checking
│   │
│   ├── routers/                    # API endpoint handlers (50+ files)
│   │   ├── test_cases_crud_api.py  # Test case CRUD
│   │   ├── test_runs_api.py        # Test execution
│   │   ├── flowstral_api.py        # Recording sessions
│   │   ├── playwright_recorder_api.py
│   │   ├── enhanced_api_testing_api.py
│   │   ├── performance_api.py
│   │   ├── accessibility_api.py
│   │   ├── visual_testing_api.py
│   │   ├── owasp_security_api.py
│   │   ├── salesforce_api.py
│   │   ├── llm_api.py
│   │   ├── agents_api.py
│   │   ├── traceability_api.py
│   │   ├── code_alchemy_api.py
│   │   ├── complex_verifications.py
│   │   └── ... (35+ more)
│   │
│   ├── schemas/
│   │   ├── agent_schemas.py
│   │   └── requirement_schemas.py
│   │
│   ├── services/                   # Business logic (165+ files)
│   │   ├── automation/             # Test execution & self-healing
│   │   │   ├── test_execution_service.py
│   │   │   ├── intelligent_self_healing.py
│   │   │   ├── auto_healing_service.py
│   │   │   ├── visual_testing_engine.py
│   │   │   └── ... (15+ files)
│   │   │
│   │   ├── flowstral/              # Recording pipeline
│   │   │   ├── flowstral_gateway.py
│   │   │   ├── flowstral_session.py
│   │   │   ├── enhanced_playwright_generator.py
│   │   │   └── ... (25+ files)
│   │   │
│   │   ├── llm/                    # AI services
│   │   │   ├── ollama_service.py
│   │   │   ├── cached_claude_service.py
│   │   │   ├── prompt_cache.py
│   │   │   ├── unified_llm_gateway.py
│   │   │   └── ... (20+ files)
│   │   │
│   │   ├── api_testing/            # API testing engine
│   │   │   ├── enhanced_api_test_engine.py
│   │   │   ├── request_chaining.py
│   │   │   ├── oauth2_authenticator.py
│   │   │   ├── owasp_api_security.py
│   │   │   └── ... (10+ files)
│   │   │
│   │   ├── performance/            # Performance testing
│   │   │   ├── performance_engine.py
│   │   │   ├── scenario_compiler.py
│   │   │   ├── go_runner_client.py
│   │   │   └── ... (25+ files)
│   │   │
│   │   ├── accessibility/          # WCAG scanning
│   │   │   ├── axe_core_scanner.py
│   │   │   └── accessibility_report_generator.py
│   │   │
│   │   ├── agents/                 # AI agents
│   │   │   ├── test_design_agent.py
│   │   │   ├── requirements_agent.py
│   │   │   ├── defect_agent.py
│   │   │   ├── performance_agent.py
│   │   │   ├── security_agent.py
│   │   │   └── accessibility_agent.py
│   │   │
│   │   ├── storage/                # Database operations
│   │   │   ├── database_service.py
│   │   │   ├── postgres_direct.py
│   │   │   └── ... (9 files)
│   │   │
│   │   ├── core/                   # System services
│   │   │   ├── agent_registry.py
│   │   │   ├── orchestrator.py
│   │   │   ├── cache_service.py
│   │   │   ├── secrets_service.py
│   │   │   └── ... (15+ files)
│   │   │
│   │   ├── connectors/             # External integrations
│   │   │   ├── jira_connector.py
│   │   │   ├── github_connector.py
│   │   │   ├── azure_devops_connector.py
│   │   │   └── ... (6 files)
│   │   │
│   │   └── complex_verifications/  # Email/PDF/File verification
│   │       ├── email_service.py
│   │       ├── pdf_service.py
│   │       └── file_service.py
│   │
│   └── utils/
│       ├── endpoint_helpers.py
│       ├── rls_query.py
│       └── ... (10+ files)
│
├── logs/                           # Application logs
│   └── app.log                     # Rotating (10MB, 5 backups)
│
└── requirements.txt                # Python dependencies
```

### Key Services

#### Test Execution Service

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
        execution_id: str = None
    ) -> dict
```

#### Self-Healing Engine

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
    ) -> Optional[str]
```

#### API Test Engine

```python
class EnhancedAPITestEngine:
    """
    Enterprise-grade API testing comparable to ReadyAPI.
    
    Supports:
    - REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket, AMQP
    - Functional, Security, Performance, Integration tests
    - Data-driven testing
    - Request chaining with property transfer
    - Service virtualization
    """
```

#### Performance Engine

```python
class PerformanceEngine:
    """
    Virtual user simulation with 8 load patterns.
    
    Patterns:
    - Constant, Ramp Up, Ramp Down, Spike
    - Stress, Soak, Breakpoint, Wave
    
    Integrations:
    - K6 for HTTP load testing
    - Go Runner for custom protocols
    - Flowstral session conversion
    """
```

---

## Frontend Architecture

### Directory Structure

```
src/
├── App.tsx                         # Root component with routes
├── main.tsx                        # Application entry point
├── index.css                       # Global styles (Tailwind)
│
├── components/                     # 70+ components
│   ├── Layout.tsx                  # Main layout wrapper
│   ├── StreamlinedLayout.tsx       # Sidebar + content layout
│   ├── AppSidebar.tsx              # Navigation sidebar
│   ├── TopNav.tsx                  # Top navigation bar
│   ├── ProtectedRoute.tsx          # Route guards
│   ├── AIConfiguration.tsx         # LLM settings panel
│   ├── TraceabilityMatrix.tsx      # Coverage visualization
│   │
│   ├── FlowstralWorkflowEditor/    # Workflow editor components
│   │   ├── FlowstralWorkflowEditor.tsx
│   │   ├── WorkflowNodes.tsx
│   │   ├── LocatorBuilder.tsx
│   │   ├── TestRunner.tsx
│   │   ├── VariableStore.tsx
│   │   ├── ScheduleManager.tsx
│   │   └── CICDExporter.tsx
│   │
│   ├── salesforce/                 # 15+ SF components
│   │   ├── SFContextDashboard.tsx
│   │   ├── SmartSOQLBuilder.tsx
│   │   ├── StageTransitionTester.tsx
│   │   └── MetadataAssertions.tsx
│   │
│   ├── verifications/              # Complex verification UI
│   │   ├── EmailVerifyStepConfig.tsx
│   │   ├── PDFVerifyStepConfig.tsx
│   │   └── FileVerifyStepConfig.tsx
│   │
│   └── ui/                         # shadcn/ui components (50+)
│       ├── button.tsx, card.tsx, dialog.tsx
│       └── ... (50+ components)
│
├── pages/                          # 60+ page components
│   ├── Dashboard.tsx               # Main dashboard
│   ├── Analytics.tsx               # Analytics overview
│   ├── Results.tsx                 # Test results
│   │
│   ├── PlaywrightRecorderPage.tsx  # Test recording
│   ├── UnifiedWorkflowEditor.tsx   # Visual test builder (3100+ lines)
│   │
│   ├── TestRepository.tsx          # Test case management
│   ├── TestCases.tsx               # Test case list
│   ├── TestCaseExecution.tsx       # Manual execution
│   ├── TestRuns.tsx                # Run history
│   ├── TestSuites.tsx              # Suite management
│   ├── TestPlans.tsx               # Plan management
│   │
│   ├── EnhancedAPITesting.tsx      # API testing
│   ├── VirtualUserGenerator.tsx    # Performance testing (2700+ lines)
│   ├── Accessibility.tsx           # WCAG scanning
│   ├── VisualTestingPage.tsx       # Visual regression
│   │
│   ├── SalesforceToolsPage.tsx     # SF tools (2500+ lines)
│   ├── CodeAlchemy.tsx             # Repository analyzer
│   ├── FrameworkAnalyzer.tsx       # Framework detection
│   │
│   ├── Requirements.tsx            # Requirements management
│   ├── Defects.tsx                 # Defect tracking
│   ├── Traceability.tsx            # Coverage matrix
│   │
│   ├── Integrations.tsx            # External integrations
│   ├── CICDIntegration.tsx         # CI/CD configuration
│   ├── SecretsVault.tsx            # Credential management
│   │
│   ├── Settings.tsx                # Application settings
│   └── marketing/                  # Marketing pages
│       ├── LandingPage.tsx
│       ├── PricingPage.tsx
│       └── ... (12 more)
│
├── hooks/                          # Custom React hooks
│   ├── useExecutionWebSocket.ts    # Real-time updates
│   ├── use-toast.ts                # Notifications
│   └── use-mobile.tsx              # Responsive detection
│
├── lib/                            # Services & utilities
│   ├── api-config.ts               # API endpoint config
│   ├── data-storage.ts             # Data persistence
│   ├── test-execution-service.ts   # Execution client
│   ├── results-ingestion-service.ts # Results storage
│   ├── salesforce-api.ts           # SF API client
│   ├── salesforce-test-data-factory.ts
│   └── utils.ts                    # Helpers
│
├── contexts/                       # React contexts
│   ├── AuthContext.tsx             # Authentication
│   ├── ThemeContext.tsx            # Dark/light mode
│   └── AIContext.tsx               # AI provider settings
│
└── types/                          # TypeScript definitions
    └── api.d.ts
```

### Key Pages

#### Unified Workflow Editor (3100+ lines)

Primary test building interface:

```typescript
interface UnifiedTestCase {
  id: string;
  name: string;
  description: string;
  type: 'ui' | 'api' | 'database' | 'performance' | 'manual';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  steps: TestStep[];
  preconditions: PreconditionRef[];
  requirements: string[];
}

interface TestStep {
  id: string;
  type: 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'api' | 'database';
  target: string;           // Human-readable
  selector?: string;        // Technical (hidden in no-code)
  value?: string;
  expectedResult?: string;
  elementIndex?: number;    // For nth() selector
  assertionType?: string;
  assertionTarget?: string;
  assertionValue?: string;
}
```

Features:
- No-Code / Code View toggle
- Multi-export (Automation, API, Database, Performance, Manual)
- Save / Save As functionality
- Assertion builder with 20+ types
- Import test cases as preconditions
- Documentation export (ISTQB, Gherkin, Markdown)
- Duplicate element handling (nth selector)

#### Virtual User Generator (2700+ lines)

Performance testing interface:

```typescript
const LOAD_PATTERNS = {
  constant: { name: "Constant Load", icon: "➡️" },
  ramp_up: { name: "Ramp Up", icon: "📈" },
  ramp_down: { name: "Ramp Down", icon: "📉" },
  spike: { name: "Spike Test", icon: "⚡" },
  stress: { name: "Stress Test", icon: "🔥" },
  soak: { name: "Soak/Endurance", icon: "🕐" },
  breakpoint: { name: "Breakpoint", icon: "💥" },
  wave: { name: "Wave Pattern", icon: "🌊" }
};

const USER_PERSONAS = {
  casual: { thinkTime: { min: 3000, max: 8000 } },
  normal: { thinkTime: { min: 1000, max: 3000 } },
  power: { thinkTime: { min: 500, max: 1500 } },
  automated: { thinkTime: { min: 0, max: 100 } }
};
```

---

## Browser Extension (Flowstral)

### Architecture

```
flowstral-extension/
├── manifest.json              # Extension manifest (V3)
├── src/
│   ├── content/
│   │   └── content.js         # Page injection, event capture
│   ├── background/
│   │   └── background.js      # Service worker
│   └── sidepanel/
│       ├── sidepanel.html     # UI
│       └── sidepanel.js       # Logic
└── icons/                     # Extension icons
```

### Recording Flow

```
User Interaction ──▶ Content Script ──▶ Background ──▶ Backend API
                     (DOM Events)    (Chrome Msgs)    (HTTP/WS)
                          │                │               │
                          ▼                ▼               ▼
                    Event Capture    Session Mgmt    Script Gen
```

### Selector Generation Priority

1. `data-testid` (most stable)
2. `id` attribute (unique)
3. `name` attribute (forms)
4. `aria-label` (accessibility)
5. `role + name` (Playwright recommended)
6. Text content (visible text)
7. CSS path (fallback)

---

## AI/ML Architecture

### LLM Services

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified LLM Gateway                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Claude    │  │   Ollama    │  │   OpenAI    │         │
│  │ (Anthropic) │  │  (Local)    │  │  (Cloud)    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Multi-Tier Prompt Cache                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │ Exact    │  │Normalized│  │ Semantic │           │   │
│  │  │ Match    │  │  Match   │  │  Match   │           │   │
│  │  │ (100%)   │  │  (95%)   │  │  (80%)   │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### AI Agents

| Agent | Purpose | Input | Output |
|-------|---------|-------|--------|
| Test Design | Create test strategies | Requirements | Test scenarios |
| Requirements | Parse and structure | Natural language | Structured reqs |
| Defect | Triage and prioritize | Bug reports | Severity/priority |
| Performance | Analyze results | Metrics | Recommendations |
| Security | Review findings | Scan results | Remediation |
| Accessibility | Interpret violations | WCAG issues | Fix guidance |

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
    test_case_id UUID REFERENCES test_cases(id),
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    environment VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    metadata JSONB
);

-- Requirements
CREATE TABLE requirements (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    priority VARCHAR(50),
    status VARCHAR(50) DEFAULT 'draft'
);

-- Defects
CREATE TABLE defects (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open',
    test_case_id UUID REFERENCES test_cases(id)
);

-- Traceability Links
CREATE TABLE traceability_links (
    id UUID PRIMARY KEY,
    requirement_id UUID REFERENCES requirements(id),
    test_case_id UUID REFERENCES test_cases(id),
    link_type VARCHAR(50)
);
```

### Storage Fallback

```
Priority:
1. PostgreSQL (production)
2. SQLite (development/fallback)
3. In-memory (last resort)
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
| WS | `/test-runs/ws/{execution_id}` | Real-time updates |
| GET | `/test-runs` | List test runs |
| GET | `/test-runs/{id}` | Get run details |

### API Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/testing/test-suite/generate` | Generate API tests |
| POST | `/api/v2/testing/execute` | Execute API tests |
| POST | `/api/v2/testing/load-test` | Run load test |
| GET | `/api/v2/testing/environments` | List environments |

### Performance Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/performance/scenarios` | Create scenario |
| POST | `/api/performance/scenarios/from-flowstral` | From recording |
| POST | `/api/performance/scenarios/{id}/run` | Run scenario |
| GET | `/api/performance/scenarios/{id}/results` | Get results |

### Accessibility

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accessibility/scan` | Scan URL |
| POST | `/api/accessibility/component-scan` | Scan component |
| POST | `/api/accessibility/site-audit` | Site-wide audit |
| POST | `/api/accessibility/vpat/generate` | Generate VPAT |

### Visual Testing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/visual-testing/compare` | Compare images |
| POST | `/api/visual-testing/baseline` | Save baseline |
| GET | `/api/visual-testing/baselines` | List baselines |
| POST | `/api/visual-testing/batch-compare` | Batch comparison |

### Security

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/security/scan` | OWASP scan |
| POST | `/api/security/quick-scan` | Quick scan |
| GET | `/api/security/scan/{id}` | Get results |

### AI/LLM

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/llm/generate-test` | Generate test |
| POST | `/api/llm/generate-script` | Generate script |
| GET | `/api/llm/usage-stats` | Usage stats |
| GET | `/api/llm/cache/stats` | Cache stats |

---

## Core Features

### Self-Healing Test Execution

```
1. Execute test normally
2. On selector failure:
   └─ Detect error pattern
   
3. Apply healing strategies (in order):
   ├─ AI regeneration
   ├─ Text fallback (get_by_text)
   ├─ Role fallback (get_by_role)
   ├─ Attribute fuzzy match
   └─ Structural similarity
   
4. Retry with healed selector
5. Update test case
6. Report healing in results
```

### Multi-Framework Export

| Framework | Language | Extension |
|-----------|----------|-----------|
| Playwright | Python | `.py` |
| Playwright | TypeScript | `.ts` |
| Selenium | Java | `.java` |
| Selenium | Python | `.py` |
| Cypress | JavaScript | `.js` |
| K6 | JavaScript | `.js` |

### LLM Cost Optimization

- Multi-tier caching (90%+ hit rate)
- Model tiering (Haiku → Sonnet → Opus)
- Response truncation
- Task-specific TTLs

---

## Data Flow

### Test Recording & Execution

```
┌──────────────────────────────────────────────────────────────────────┐
│                        TEST CREATION FLOW                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐   Record   ┌──────────┐   Generate  ┌──────────┐      │
│  │ Browser  │ ─────────▶ │ Flowstral│ ──────────▶ │ Workflow │      │
│  │ Extension│            │ Backend  │             │ Editor   │      │
│  └──────────┘            └──────────┘             └──────────┘      │
│                                                        │             │
│                                                        │ Edit & Save │
│                                                        ▼             │
│  ┌──────────┐   Execute  ┌──────────┐   Results   ┌──────────┐      │
│  │ Results  │ ◀───────── │ Test     │ ◀────────── │ Test     │      │
│  │ Dashboard│            │ Executor │             │ Case     │      │
│  └──────────┘            └──────────┘             └──────────┘      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### WebSocket Communication

```
Frontend                          Backend
   │                                │
   │ ───── Connect WS ────────────▶│
   │                                │
   │ ◀───── step_start ───────────│
   │ ◀───── step_complete ────────│
   │ ◀───── self_healing ─────────│
   │ ◀───── screenshot ───────────│
   │ ◀───── execution_complete ───│
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
npm install
npm run dev

# Extension
# Load flowstral-extension/ as unpacked in Chrome
```

### Environment Variables

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_URL=http://localhost:11434
DATABASE_URL=postgresql://...
SECRET_KEY=your-jwt-secret

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

### Production

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

*Last updated: January 11, 2026*
