# QAAI/ArisTrace - Enterprise AI-Powered QA Platform

> **Complete Product Documentation**  
> Version 3.0 | Last Updated: January 11, 2026

<p align="center">
  <strong>The Most Comprehensive AI-Powered Test Automation Platform</strong>
</p>

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Overview](#platform-overview)
3. [Core Modules](#core-modules)
4. [Feature Deep Dive](#feature-deep-dive)
5. [AI & Intelligence Features](#ai--intelligence-features)
6. [Enterprise Capabilities](#enterprise-capabilities)
7. [Integrations](#integrations)
8. [Technical Specifications](#technical-specifications)
9. [Getting Started](#getting-started)
10. [Competitive Advantages](#competitive-advantages)

---

## Executive Summary

**QAAI/ArisTrace** is an enterprise-grade, AI-powered Quality Assurance platform that revolutionizes software testing through intelligent automation, self-healing capabilities, and comprehensive multi-protocol support. Built for modern enterprises, it combines the power of:

- **Visual Test Recording** - No-code test creation via browser extension
- **AI Test Generation** - LLM-powered test case generation from requirements
- **Self-Healing Execution** - Automatic selector repair during test runs
- **Multi-Protocol API Testing** - REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket
- **Performance Testing** - Virtual user generation with 8 load patterns
- **Accessibility Scanning** - WCAG 2.1 AA/AAA compliance with VPAT generation
- **Visual Regression** - 5 comparison modes with baseline management
- **Security Testing** - OWASP API Security Top 10 scanning
- **Salesforce-Native Tools** - 15+ specialized SF testing components

### Key Metrics

| Metric | Value |
|--------|-------|
| **Supported Frameworks** | Playwright, Selenium, Cypress, K6 |
| **Enterprise Apps Supported** | 25+ (Salesforce, ServiceNow, Workday, SAP, etc.) |
| **API Protocols** | 8 (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WS, AMQP) |
| **AI Providers** | Anthropic Claude, Ollama, OpenAI, vLLM |
| **Accessibility Standards** | WCAG 2.0/2.1 A/AA/AAA, Section 508 |
| **Visual Comparison Modes** | 5 (Pixel, Anti-aliased, Perceptual, Structural, Layout) |
| **Load Test Patterns** | 8 (Constant, Ramp, Spike, Stress, Soak, Breakpoint, Wave, Custom) |

---

## Platform Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           QAAI/ArisTrace Platform Architecture                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐                │
│  │   React Frontend │──▶│  FastAPI Backend │──▶│  PostgreSQL/     │                │
│  │   (TypeScript)   │◀──│    (Python)      │◀──│  SQLite DB       │                │
│  │   60+ Pages      │   │   50+ Routers    │   │                  │                │
│  │   70+ Components │   │   165+ Services  │   │                  │                │
│  └──────────────────┘   └──────────────────┘   └──────────────────┘                │
│          │                       │                                                   │
│          │                       ├────────────────────────────────────────┐         │
│          │                       │                                        │         │
│          │                       ▼                                        ▼         │
│          │             ┌──────────────────┐                    ┌──────────────────┐ │
│          │             │   AI Layer       │                    │  Test Execution  │ │
│          │             │ ┌──────────────┐ │                    │ ┌──────────────┐ │ │
│          │             │ │Claude/Ollama │ │                    │ │ Playwright   │ │ │
│          │             │ │ OpenAI/vLLM  │ │                    │ │ Selenium     │ │ │
│          │             │ └──────────────┘ │                    │ │ K6/Artillery │ │ │
│          │             └──────────────────┘                    │ │ ZAP Scanner  │ │ │
│          ▼                                                      │ └──────────────┘ │ │
│  ┌──────────────────┐                                          └──────────────────┘ │
│  │ Flowstral Chrome │                                                               │
│  │    Extension     │◀──────────────────────────────────────────────────────────────│
│  │  Visual Recorder │         Real-time WebSocket Communication                      │
│  └──────────────────┘                                                               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern UI with 60+ pages |
| **Styling** | Tailwind CSS + shadcn/ui | Professional enterprise design |
| **State** | React Query + Zustand | Efficient data management |
| **Backend** | FastAPI (Python 3.10+) | High-performance API server |
| **Database** | PostgreSQL / SQLite | Persistent data storage |
| **Real-time** | WebSocket | Live test execution updates |
| **AI/ML** | Claude, Ollama, OpenAI | Intelligent test generation |
| **Browser Automation** | Playwright | Cross-browser test execution |
| **Performance** | K6 / Go Runner | Virtual user simulation |
| **Security** | OWASP ZAP | Vulnerability scanning |

---

## Core Modules

### 1. 🎬 Test Recorder (Flowstral)

**Browser extension for visual test recording with enterprise app support.**

| Feature | Description |
|---------|-------------|
| **No-Code Recording** | Record user interactions without writing code |
| **Smart Selectors** | Automatic selector generation with 8+ strategies |
| **Enterprise Apps** | Optimized for Salesforce, ServiceNow, Workday, SAP |
| **Shadow DOM Support** | Penetrates complex component architectures |
| **Multi-Tab Recording** | Record across multiple browser tabs |
| **Event Capture** | Click, input, scroll, navigation, form submit |
| **Session Management** | Persistent sessions with auto-reconnect |

**Selector Generation Priority:**
1. `data-testid` (most stable)
2. `id` attribute
3. `name` attribute
4. `aria-label` (accessibility)
5. `role + name` (Playwright recommended)
6. Text content
7. CSS path (fallback)

### 2. 🔧 Visual Test Builder

**No-code/low-code test case construction with multi-framework export.**

| Feature | Description |
|---------|-------------|
| **No-Code View** | Human-readable step descriptions |
| **Code View** | Technical selector visibility |
| **Multi-Framework** | Export to Playwright, Selenium, Cypress |
| **Assertion Builder** | 20+ assertion types with visual configuration |
| **Variable Store** | Dynamic data across test steps |
| **Preconditions** | Import other test cases as setup |
| **Documentation Export** | ISTQB, Gherkin/BDD, Markdown formats |

**Supported Node Types:**
- Navigate, Click, Input, Wait, Scroll, Hover, Select
- Assert (visibility, text, URL, element count, value)
- API Call, Database Query
- Screenshot, Visual Comparison
- Conditional Logic, Loops

### 3. 📊 Test Repository

**Enterprise test management with full CRUD operations.**

| Feature | Description |
|---------|-------------|
| **Test Cases** | Create, edit, clone, delete with versioning |
| **Test Suites** | Logical grouping with batch execution |
| **Test Plans** | Release-based planning with scheduling |
| **Test Runs** | Execution history with detailed results |
| **Search & Filter** | Full-text search, tag-based filtering |
| **Import/Export** | JSON, CSV, Excel support |

### 4. 🚀 Test Execution Engine

**Self-healing test runner with real-time WebSocket updates.**

| Feature | Description |
|---------|-------------|
| **Multi-Browser** | Chromium, Firefox, WebKit |
| **Headed/Headless** | Visual or background execution |
| **Parallel Execution** | Concurrent test runs |
| **Self-Healing** | Automatic selector repair |
| **Screenshots** | Automatic capture on failure |
| **Video Recording** | Full execution capture (optional) |
| **Real-time Updates** | WebSocket progress streaming |

**Self-Healing Strategies:**
1. AI-based selector regeneration
2. Text-based fallback (`get_by_text`)
3. Role-based fallback (`get_by_role`)
4. Fuzzy attribute matching
5. Structural DOM similarity

### 5. 🌐 API Testing Suite

**Enterprise-grade API testing comparable to ReadyAPI.**

| Protocol | Support Level |
|----------|---------------|
| **REST** | Full (GET, POST, PUT, DELETE, PATCH) |
| **SOAP** | Full (WSDL import, envelope generation) |
| **GraphQL** | Full (queries, mutations, subscriptions) |
| **gRPC** | Full (protobuf support, streaming) |
| **Kafka** | Full (producer/consumer testing) |
| **MQTT** | Full (pub/sub testing) |
| **WebSocket** | Full (bi-directional) |
| **AMQP** | Full (RabbitMQ compatible) |

**API Testing Features:**
- OpenAPI/Swagger spec import
- Data-driven testing with CSV/JSON
- Request chaining with property transfer
- Environment management (dev/staging/prod)
- Service virtualization / mocking
- OAuth2/JWT authentication
- Response assertions (JSONPath, XPath)
- Test data generators (Faker integration)

### 6. ⚡ Performance Testing

**Virtual user simulation with 8 load patterns.**

| Load Pattern | Use Case |
|--------------|----------|
| **Constant** | Baseline steady-state testing |
| **Ramp Up** | Gradual user increase |
| **Ramp Down** | Graceful load decrease |
| **Spike** | Sudden traffic burst |
| **Stress** | Beyond-capacity testing |
| **Soak** | Memory leak detection |
| **Breakpoint** | Find system limits |
| **Wave** | Cyclic load patterns |

**User Personas:**
- Casual Browser (slow, exploratory)
- Normal User (average interaction)
- Power User (fast, experienced)
- Automated Bot (machine speed)

**Metrics Captured:**
- Response time (avg, p50, p95, p99)
- Throughput (requests/second)
- Error rate
- Concurrent users
- Resource utilization

### 7. ♿ Accessibility Testing

**WCAG compliance scanning with VPAT generation.**

| Standard | Supported Levels |
|----------|------------------|
| **WCAG 2.0** | A, AA, AAA |
| **WCAG 2.1** | A, AA, AAA |
| **Section 508** | Full compliance |
| **ADA** | Title III compliance |

**Scan Types:**
- Full page scan
- Component-specific scan
- Site-wide audit (multi-page)
- Continuous monitoring

**Outputs:**
- Violation reports with WCAG references
- Remediation suggestions
- VPAT document generation
- Accessibility score trending

### 8. 👁️ Visual Regression Testing

**Pixel-perfect comparison with intelligent diff detection.**

| Comparison Mode | Best For |
|-----------------|----------|
| **Pixel Perfect** | Exact match requirements |
| **Anti-Aliased** | Font rendering differences |
| **Perceptual** | Minor visual changes OK |
| **Structural** | Layout stability |
| **Layout Only** | Content-agnostic comparison |

**Features:**
- Baseline management (CRUD)
- Ignore regions (timestamps, ads)
- Threshold configuration
- Diff image generation
- Batch comparison
- Historical comparison

### 9. 🔒 Security Testing

**OWASP API Security Top 10 scanning.**

| Scan Type | OWASP Category |
|-----------|----------------|
| BOLA | Broken Object Level Authorization |
| Broken Auth | Broken Authentication |
| BOPLA | Broken Object Property Level Auth |
| Resource Consumption | Unrestricted Resource Consumption |
| BFLA | Broken Function Level Authorization |
| SSRF | Server-Side Request Forgery |
| Misconfig | Security Misconfiguration |
| Inventory | Improper Inventory Management |

### 10. 🌩️ Salesforce Testing Tools

**15+ specialized components for Salesforce testing.**

| Tool | Purpose |
|------|---------|
| **Multi-Org Manager** | Manage multiple SF org connections |
| **SOQL Builder** | Visual query builder |
| **Bulk Data Loader** | CSV import/export |
| **REST API Playground** | Test API calls |
| **Test Data Factory** | Generate realistic test data |
| **Schema Browser** | Explore objects and fields |
| **Record Inspector** | View record details |
| **Apex Test Runner** | Run and monitor tests |
| **Permission Analyzer** | Check user permissions |
| **Debug Log Analyzer** | Parse and analyze logs |
| **Relationship Visualizer** | ERD generation |
| **Record Cloner** | Deep clone with relationships |
| **Data Diff** | Compare record versions |
| **Assertion Builder** | SF-specific validations |
| **Stage Transition Tester** | Process automation testing |

---

## Feature Deep Dive

### Self-Healing Test Execution

When a selector fails during test execution:

```
1. Detect failure pattern
   └─ "Element not found", "Timeout", "Selector not visible"
   
2. Extract failed selector
   └─ Parse from error message or step definition
   
3. Apply healing strategies (in order):
   ├─ AI Regeneration (LLM suggests new selector)
   ├─ Text Fallback (get_by_text with element text)
   ├─ Role Fallback (get_by_role with accessible name)
   ├─ Attribute Fuzzy Match (similar attributes)
   └─ Structural Similarity (DOM position analysis)
   
4. Retry with healed selector
   └─ Update test case with new selector
   
5. Report healing in results
   └─ Original selector, healed selector, strategy used
```

### Complex Verifications

**Email Verification:**
- Microsoft 365 / Outlook integration
- Gmail integration
- Subject/sender filtering
- OTP extraction
- Link extraction
- Wait with timeout

**PDF Verification:**
- Text content assertions
- Page count validation
- Table data extraction
- Metadata verification
- Regex pattern matching

**File Verification:**
- CSV: Row count, column headers, cell values
- Excel: Sheet existence, cell values, formulas
- JSON: JSONPath assertions, array length
- XML: XPath validation
- Images: Dimensions, format verification

### Traceability Matrix

Comprehensive linking:
```
Requirements ──────┬──────▶ Test Plans
                   │
                   ├──────▶ Test Cases
                   │
                   ├──────▶ Test Runs
                   │
                   └──────▶ Defects

Coverage metrics:
- Requirements without test cases (gaps)
- Test cases without requirements (orphans)
- Requirements with failed tests (at-risk)
- Overall coverage percentage
```

### Code Alchemy (Repository Analyzer)

Import existing tests from any repository:

**Supported Platforms:**
- GitHub (public & private)
- GitLab (cloud & self-hosted)
- Bitbucket (cloud & server)
- Azure DevOps

**Detected Frameworks:**
- JUnit / TestNG (Java)
- pytest / unittest (Python)
- Jest / Mocha (JavaScript)
- RSpec (Ruby)
- NUnit / xUnit (.NET)

**Process:**
1. Analyze repository structure
2. Detect test frameworks
3. Extract test methods and assertions
4. Preview before import
5. Import selected tests to QAAI

---

## AI & Intelligence Features

### AI Test Generation

Generate tests from natural language requirements:

```
Input: "User should be able to login with valid credentials
        and see their dashboard with profile information"

Output:
- Navigate to login page
- Enter valid username
- Enter valid password  
- Click login button
- Verify URL contains /dashboard
- Verify profile name is visible
- Verify profile picture is displayed
```

### AI Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| **Anthropic Claude** | Claude 3.5 Sonnet, Opus, Haiku | Primary production LLM |
| **Ollama** | Qwen 2.5, LLaMA, Mistral | Local/air-gapped deployment |
| **OpenAI** | GPT-4, GPT-3.5 | Alternative cloud option |
| **vLLM** | Custom fine-tuned | Enterprise-specific models |

### LLM Cost Optimization

Multi-tier caching achieves 90%+ cache hit rate:

```
Cache Layers:
1. Exact Match - Identical prompts (100% savings)
2. Normalized Match - Whitespace/format normalized (95% savings)
3. Semantic Match - Similar meaning via embeddings (80% savings)

Model Tiering:
- Haiku for simple classification tasks
- Sonnet for standard generation
- Opus for complex reasoning

Response Truncation:
- Limit token output where appropriate
```

### AI Agents

| Agent | Purpose |
|-------|---------|
| **Test Design Agent** | Creates test strategies and scenarios |
| **Requirements Agent** | Parses and structures requirements |
| **Defect Agent** | Triages and prioritizes bugs |
| **Performance Agent** | Analyzes performance results |
| **Security Agent** | Reviews security scan findings |
| **Accessibility Agent** | Interprets WCAG violations |

---

## Enterprise Capabilities

### Multi-Tenancy

- Organization isolation
- Project-level access control
- Role-based permissions (RBAC)
- Row-level security (RLS)

### Integrations

| Category | Integrations |
|----------|-------------|
| **CI/CD** | Jenkins, GitHub Actions, GitLab CI, Azure DevOps, CircleCI |
| **Issue Tracking** | Jira, Azure Boards, GitHub Issues |
| **Documentation** | Confluence |
| **Messaging** | Slack, Microsoft Teams |
| **APM** | Datadog, New Relic, Dynatrace |
| **Source Control** | GitHub, GitLab, Bitbucket, Azure Repos |

### CI/CD Pipeline Export

Generate pipeline configurations:
- GitHub Actions YAML
- GitLab CI YAML
- Jenkins Groovy
- Azure DevOps YAML
- CircleCI config

### Scheduled Runs

- Cron-based scheduling
- Timezone support
- Email notifications
- Slack/Teams alerts
- Auto-retry on failure

### Secrets Vault

- Encrypted credential storage
- Environment-based secrets
- API key management
- Connection string storage
- Rotation support

---

## Technical Specifications

### Backend API Routers (50+)

| Router | Prefix | Purpose |
|--------|--------|---------|
| `test_cases_crud_api` | `/test-cases` | Test case CRUD |
| `test_runs_api` | `/test-runs` | Execution management |
| `flowstral_api` | `/api/flowstral` | Recording sessions |
| `playwright_recorder_api` | `/api/playwright-recorder` | Script execution |
| `enhanced_api_testing_api` | `/api/v2/testing` | API testing |
| `performance_api` | `/api/performance` | Load testing |
| `accessibility_api` | `/api/accessibility` | WCAG scanning |
| `visual_testing_api` | `/api/visual-testing` | Visual regression |
| `owasp_security_api` | `/api/security` | Security scanning |
| `salesforce_api` | `/api/salesforce` | SF integration |
| `llm_api` | `/api/llm` | AI generation |
| `agents_api` | `/agents` | AI agents |
| `traceability_api` | `/traceability` | Coverage matrix |
| `code_alchemy_api` | `/api/code-alchemy` | Repo analysis |
| `complex_verifications` | `/api/complex-verify` | Email/PDF/File verify |

### Frontend Pages (60+)

| Category | Pages |
|----------|-------|
| **Core** | Dashboard, Analytics, Results |
| **Test Cases** | Repository, Create, Edit, Builder |
| **Execution** | Test Runs, Test Case Execution |
| **Planning** | Test Plans, Test Suites, Scheduled Runs |
| **API** | Enhanced API Testing, Coverage Map |
| **Performance** | Virtual User Generator |
| **Quality** | Accessibility, Visual Testing, Self-Healing |
| **Salesforce** | SF Tools (15+ components) |
| **Integration** | Integrations, CI/CD, Secrets Vault |
| **Management** | Requirements, Defects, Traceability |
| **Tools** | Code Alchemy, Framework Analyzer, Element Repository |
| **Settings** | Settings, Project Management |

### Services (165+)

| Category | Services |
|----------|----------|
| **Automation** | Test execution, self-healing, selector engine |
| **Flowstral** | Recording gateway, script generation |
| **LLM** | Ollama, Claude, prompt caching, unified gateway |
| **API Testing** | Request chaining, virtualization, OAuth2 |
| **Performance** | Scenario compiler, Go runner, metrics |
| **Accessibility** | Axe-core scanner, WCAG pipeline |
| **Agents** | Test design, requirements, defect triage |
| **Storage** | PostgreSQL, SQLite, in-memory |

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Node.js** | 18+ | 20+ |
| **Python** | 3.10+ | 3.11+ |
| **RAM** | 4GB | 8GB+ |
| **Storage** | 10GB | 50GB+ |
| **Browser** | Chrome 100+ | Latest Chrome |

---

## Getting Started

### Quick Start (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/maddynolan/QAOne.git
cd QAOne

# 2. Start Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Start Frontend (new terminal)
cd ..  # back to root
npm install
npm run dev

# 4. Open browser
# Frontend: http://localhost:8080
# API Docs: http://localhost:8000/docs
```

### Install Browser Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `flowstral-extension` directory
5. Pin extension to toolbar

### Configure AI (Optional)

```bash
# backend/.env

# Anthropic Claude (recommended)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Local Ollama (air-gapped)
OLLAMA_URL=http://localhost:11434
```

---

## Competitive Advantages

### vs. Selenium IDE
- ✅ AI-powered test generation
- ✅ Self-healing execution
- ✅ Multi-framework export
- ✅ Enterprise app support
- ✅ API testing integration

### vs. Playwright Codegen
- ✅ Visual workflow builder
- ✅ Test management integration
- ✅ Real-time execution dashboard
- ✅ Self-healing on failure
- ✅ Documentation export

### vs. ReadyAPI
- ✅ UI test recording
- ✅ AI test generation
- ✅ Visual regression testing
- ✅ Accessibility scanning
- ✅ Single unified platform

### vs. Tricentis Tosca
- ✅ Modern cloud-native architecture
- ✅ Open-source friendly
- ✅ AI-first approach
- ✅ Lower total cost of ownership
- ✅ Rapid deployment

### vs. Micro Focus UFT
- ✅ Browser-based (no desktop install)
- ✅ Native Playwright support
- ✅ Modern UI/UX
- ✅ AI-powered maintenance
- ✅ Developer-friendly

---

## Support & Resources

| Resource | Location |
|----------|----------|
| **API Documentation** | `http://localhost:8000/docs` |
| **Architecture Guide** | `docs/ARCHITECTURE.md` |
| **Backend Reference** | `docs/BACKEND_REFERENCE.md` |
| **Frontend Reference** | `docs/FRONTEND_REFERENCE.md` |
| **User Manual** | `docs/USER_MANUAL.md` |
| **Salesforce Guide** | `docs/SALESFORCE_TESTING_GUIDE.md` |
| **API Testing Guide** | `docs/API_AND_PERFORMANCE_TESTING_GUIDE.md` |

---

## Changelog

### January 2026 (v3.0)
- Complete documentation refresh
- 60+ frontend pages documented
- 50+ backend routers documented
- 165+ services cataloged
- Competitive analysis updated

### December 2024 (v2.5)
- Unified Test Builder with No-Code/Code views
- Complex verifications (Email, PDF, File)
- Salesforce auto-connect
- Results ingestion service
- Dashboard real data integration

### November 2024 (v2.0)
- Performance testing with 8 load patterns
- Accessibility scanning with VPAT
- Visual regression with 5 modes
- Security scanning (OWASP Top 10)
- Code Alchemy repository analyzer

---

<p align="center">
  <strong>QAAI/ArisTrace - Enterprise QA Excellence</strong><br>
  <em>AI-Powered • Self-Healing • Multi-Protocol • Enterprise-Ready</em>
</p>

---

*This documentation is maintained as living documentation and updated regularly.*  
*Last Updated: January 11, 2026*
