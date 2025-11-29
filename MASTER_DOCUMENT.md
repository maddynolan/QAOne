# QA AI Platform - Master Living Document

> **This is the single source of truth for the QA AI Platform. Update this document with every change.**

**Last Updated:** 2025-01-XX  
**Version:** 2.0  
**Status:** Production Ready  
**Maintainer:** Development Team

---

## 📋 Table of Contents

1. [Quick Links](#quick-links)
2. [Version History & Changelog](#version-history--changelog)
3. [Project Overview](#project-overview)
4. [Technology Stack](#technology-stack)
5. [Architecture](#architecture)
6. [Core Features](#core-features)
7. [Enterprise Features](#enterprise-features)
8. [API Endpoints](#api-endpoints)
9. [Database Schema](#database-schema)
10. [Setup & Installation](#setup--installation)
11. [Configuration](#configuration)
12. [Development Guide](#development-guide)
13. [Deployment](#deployment)
14. [Roadmap](#roadmap)

---

## Quick Links

- **Comprehensive Documentation**: [`COMPREHENSIVE_DOCUMENTATION.md`](./COMPREHENSIVE_DOCUMENTATION.md)
- **Enterprise Improvements**: [`ENTERPRISE_IMPROVEMENTS_COMPLETE.md`](./ENTERPRISE_IMPROVEMENTS_COMPLETE.md)
- **Setup Guide**: [`ENTERPRISE_SETUP_COMPLETE.md`](./ENTERPRISE_SETUP_COMPLETE.md)
- **Architecture Details**: [`docs/FINAL_ARCHITECTURE.md`](./docs/FINAL_ARCHITECTURE.md)
- **Testing Guide**: [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)

---

## Version History & Changelog

> **Update this section with every change made to the platform**

### Version 2.0.1 - 2025-01-XX (Current)

#### Enterprise Features Added
- ✅ **Flowstral 5-Layer Selector Strategy**
  - Layer 1 (Gold): `data-testid`, `id`
  - Layer 2 (Silver): Accessibility Role + name
  - Layer 3 (Bronze): Text content
  - Layer 4 (Iron): CSS attributes
  - Layer 5 (Clay): XPath/CSS path fallback
  - Automatic wait heuristics (`expect(locator).toBeVisible()`)
  - Files: `src/pages/Flowstral.tsx`, `backend/app/services/flowstral/semantic_step_converter.py`, `backend/app/services/executors/playwright_executor_enhanced.py`

- ✅ **Semantic JSON Step Format**
  - Decoupled recording from script generation
  - Users can update test steps without re-recording
  - File: `backend/app/services/flowstral/semantic_step_converter.py`

- ✅ **Jira Two-Way Webhook Integration**
  - Automatically triggers test plans when tickets change to "Ready for QA"
  - Endpoint: `POST /integrations/jira/webhook`
  - File: `backend/app/routers/integrations/jira_webhook.py`

- ✅ **CI/CD CLI Tool (`qaai-cli`)**
  - `qaai-cli run --plan "Smoke Test" --wait --exit-code-on-fail`
  - `qaai-cli status --run-id <run-id>`
  - `qaai-cli plans --list`
  - Files: `qaai-cli/` directory

- ✅ **Remote Browser Grid Support**
  - Selenium Grid, Moon (K8s), BrowserStack, SauceLabs
  - File: `backend/app/services/executors/remote_grid_service.py`

- ✅ **Encrypted Secrets Management**
  - Encrypted storage using `pgcrypto`
  - Automatic injection into test execution environment
  - Tenant-isolated
  - Files: `supabase/migrations/027_secrets_management.sql`, `backend/app/services/core/secrets_service.py`

- ✅ **Page Object Repository (POM)**
  - Centralized element selector management
  - Update selectors once, all test cases automatically use new selectors
  - Files: `supabase/migrations/028_page_object_repository.sql`, `backend/app/services/core/page_object_service.py`

- ✅ **Smart Scheduling**
  - Cron-like scheduling expressions
  - Automatic test run triggering
  - File: `backend/app/services/core/scheduler_service.py`

#### Setup & Configuration
- ✅ Registered Jira webhook router in `main.py`
- ✅ Built and tested CLI tool
- ✅ Updated `env.example` with enterprise configuration
- ✅ Created migration script: `run_enterprise_migrations.ps1`

### Version 2.0.0 - 2024-12-XX

#### Tier-0 Enterprise Features
- ✅ **Row-Level Security (RLS) + Tenant Isolation**
  - Tenant context middleware
  - RLS query helpers
  - Files: `backend/app/middleware/tenant_middleware.py`, `backend/app/utils/rls_query.py`

- ✅ **JWT-based RBAC**
  - JWT service for token generation/validation
  - RBAC middleware and permission decorators
  - Default roles: Admin, QA Lead, Tester, Viewer, Auditor
  - Files: `backend/app/services/auth/jwt_service.py`, `backend/app/middleware/rbac_middleware.py`, `backend/app/decorators/permissions.py`, `backend/scripts/setup_default_roles.py`

- ✅ **Immutable Audit Trail**
  - `@audit_log_action` decorator
  - Immutable `audit_logs` table
  - Files: `backend/app/decorators/audit.py`, `supabase/migrations/026_immutable_audit.sql`

- ✅ **Air-Gapped Mode**
  - Blocks external LLM calls when enabled
  - Files: `backend/app/config/llm_config.py`, `backend/app/services/llm/model_gateway.py`, `docker-compose.air-gapped.yml`

- ✅ **Prometheus + Grafana Observability**
  - Prometheus metrics exporter
  - Pre-built Grafana dashboard
  - Files: `backend/app/services/observability/prometheus_exporter.py`, `backend/app/routers/metrics_api.py`, `grafana/dashboards/qa-ai-platform.json`

#### Core Features
- ✅ Multi-agent architecture (7 specialized agents)
- ✅ Flowstral real-time recording
- ✅ Nexus exploratory testing
- ✅ Autonomous app exploration
- ✅ Test case/plan/run management
- ✅ Requirements management
- ✅ Defect tracking
- ✅ API import tools
- ✅ Gherkin converter

---

## Project Overview

**QA AI Platform** is a comprehensive, AI-powered Quality Assurance testing management system that automates the entire QA lifecycle from test case generation to defect triage.

### Key Highlights

- **AI-Powered Test Generation**: Generate test cases from requirements, Jira stories, and user flows
- **Autonomous Testing**: Nexus exploratory testing and autonomous app exploration
- **Flowstral Recording**: Real-time user flow recording with action graph generation
- **Multi-Agent Architecture**: Specialized agents for different testing domains
- **Full Test Management**: Complete CRUD operations for test cases, plans, runs, and defects
- **Enterprise Ready**: RLS, RBAC, audit trails, air-gapped deployment, observability
- **Integration Ready**: Jira, GitHub, Azure DevOps, Confluence, and CI/CD integrations

---

## Technology Stack

### Frontend
- **React** 18.3.1 - UI Framework
- **TypeScript** 5.8.3 - Type Safety
- **Vite** 5.4.19 - Build Tool
- **Tailwind CSS** 3.4.17 - Styling
- **shadcn/ui** - UI Components
- **TanStack Query** 5.83.0 - Data Fetching
- **React Router DOM** 6.30.1 - Routing

### Backend
- **FastAPI** 0.104.1 - Web Framework
- **Python** 3.9+ - Language
- **PostgreSQL** 16 - Database
- **Playwright** 1.48.0 - Browser Automation
- **Redis** 5.0.0+ - Caching
- **Uvicorn** 0.24.0 - ASGI Server

### AI/LLM
- **Ollama** - Local LLM Serving (Qwen Models)
- **OpenAI API** - Cloud LLM (GPT-4)
- **Anthropic API** - Cloud LLM (Claude)
- **Model Gateway** - Unified LLM access

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Orchestration
- **Prometheus** - Metrics
- **Grafana** - Dashboards

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 8080)              │
│  - Dashboard, Test Cases, Plans, Runs, Defects            │
│  - Flowstral, Nexus, Exploration                          │
│  - Integrations (Jira, GitHub, ADO)                       │
└──────────────────────┬────────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼────────────────────────────────────┐
│              FastAPI Backend (Port 8000)                 │
│  - REST API Endpoints                                    │
│  - Multi-Agent Orchestrator                              │
│  - Model Gateway (Ollama/OpenAI/Anthropic)               │
│  - Test Execution Engine (Playwright)                    │
└──────┬──────────────┬──────────────┬──────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ PostgreSQL  │ │   Redis   │ │  Ollama   │
│  (Database) │ │  (Cache)  │ │  (LLM)    │
└─────────────┘ └───────────┘ └───────────┘
```

### Multi-Agent Architecture

1. **Requirements Agent** - Analyzes and structures requirements
2. **Automation Agent** - Generates automation code
3. **Performance Agent** - Performance testing scenarios
4. **Accessibility Agent** - WCAG compliance testing
5. **Security Agent** - Security vulnerability testing
6. **Defect Agent** - Defect analysis and triage
7. **Test Design Agent** - Test case design and optimization

---

## Core Features

### 1. Flowstral - Real-Time Flow Recording
- Real-time user interaction capture
- Action graph generation
- Multi-layer selector strategy (5 layers)
- Semantic JSON step format
- Automatic wait heuristics
- Self-healing test generation

### 2. Nexus - Autonomous Exploratory Testing
- Risk-based test prioritization
- Autonomous navigation
- Defect detection
- E2E validation
- Priority queue management

### 3. Autonomous App Exploration
- Systematic navigation
- Capability map building
- Requirement comparison
- Gap analysis
- Test suggestions

### 4. Test Management
- Test Cases: CRUD operations, AI generation
- Test Plans: Create, edit, execute
- Test Runs: Execution tracking, results
- Requirements: Tracking, Jira integration
- Defects: Tracking, severity, status

### 5. AI-Powered Features
- Test case generation from requirements
- Test plan expansion
- Test case to Playwright conversion
- API test generation
- Defect triage and analysis
- Requirement analysis

### 6. Integrations
- **Jira**: Two-way webhook, requirement sync, defect sync
- **GitHub**: PR gating, webhook support
- **Azure DevOps**: Work item sync
- **CI/CD**: CLI tool, webhook support

---

## Enterprise Features

### Security & Compliance
- ✅ **Row-Level Security (RLS)**: Tenant isolation at database level
- ✅ **JWT-based RBAC**: Granular role-based access control
- ✅ **Immutable Audit Trail**: Non-repudiable action logs
- ✅ **Encrypted Secrets**: Secure storage of API keys and passwords
- ✅ **Air-Gapped Mode**: No external LLM calls

### Scalability & Performance
- ✅ **Remote Browser Grid**: Selenium Grid, Moon, BrowserStack, SauceLabs
- ✅ **Prometheus Metrics**: Application and LLM metrics
- ✅ **Grafana Dashboards**: Pre-built monitoring dashboards
- ✅ **Smart Scheduling**: Cron-based automated test runs

### Maintainability
- ✅ **Page Object Repository**: Centralized element selector management
- ✅ **5-Layer Selector Strategy**: Self-healing test selectors
- ✅ **Semantic JSON Steps**: Decoupled test steps from UI

### Developer Experience
- ✅ **CLI Tool**: `qaai-cli` for CI/CD integration
- ✅ **API Documentation**: OpenAPI/Swagger at `/docs`
- ✅ **Migration Scripts**: Automated database migrations

---

## API Endpoints

### Core Endpoints
- `GET /api/test-cases` - List test cases
- `POST /api/test-cases` - Create test case
- `GET /api/test-plans` - List test plans
- `POST /api/test-runs` - Create test run
- `POST /api/test-runs/{id}/execute` - Execute test run

### AI Endpoints
- `POST /api/ai/generate-test-plan` - Generate test plan from requirements
- `POST /api/ai/generate-tests` - Generate test cases
- `POST /api/ai/jira-to-testcases` - Convert Jira story to test cases

### Flowstral Endpoints
- `POST /api/flowstral/start` - Start recording session
- `POST /api/flowstral/capture-event` - Capture user interaction
- `POST /api/flowstral/session/{id}/generate-artifacts` - Generate test artifacts

### Integration Endpoints
- `POST /integrations/jira/webhook` - Jira webhook handler
- `GET /integrations/jira/webhook/test` - Test webhook endpoint

### Metrics Endpoints
- `GET /metrics` - Prometheus metrics

---

## Database Schema

### Core Tables
- `test_cases` - Test case definitions
- `test_plans` - Test plan definitions
- `test_runs` - Test execution records
- `requirements` - Requirements tracking
- `defects` - Defect tracking
- `organizations` - Organization/tenant data
- `projects` - Project definitions
- `users` - User accounts

### Enterprise Tables
- `secrets` - Encrypted secrets storage
- `page_objects` - Page Object Model definitions
- `page_elements` - Element definitions with multi-layer selectors
- `audit_logs` - Immutable audit trail
- `roles` - RBAC roles
- `permissions` - RBAC permissions
- `user_roles` - User role assignments

### AI Tables
- `ai_generations` - AI generation history with quality scores
- `flowstral_sessions` - Flowstral recording sessions
- `nexus_sessions` - Nexus exploratory sessions

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 16
- Redis (optional)
- Ollama (for local LLM)

### Quick Start

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd QAAI
   ```

2. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Frontend Setup**
   ```bash
   npm install
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Run migrations
   .\run_enterprise_migrations.ps1
   # Or manually:
   psql -U qa_user -d qa_ai_platform -f supabase/migrations/027_secrets_management.sql
   psql -U qa_user -d qa_ai_platform -f supabase/migrations/028_page_object_repository.sql
   ```

5. **Start Services**
   ```bash
   # Backend
   cd backend
   python -m uvicorn app.main:app --reload

   # Frontend
   npm run dev
   ```

### CLI Tool Installation
```bash
cd qaai-cli
npm install
npm run build
npm link  # For global installation
```

---

## Configuration

### Environment Variables

#### Required
- `DATABASE_URL` - PostgreSQL connection string
- `SECRETS_ENCRYPTION_KEY` - 32-byte encryption key for secrets
- `JWT_SECRET` - JWT signing secret (min 32 chars)

#### Optional
- `GRID_PROVIDER` - Browser grid provider (local, selenium_grid, moon, browserstack, saucelabs)
- `AIR_GAPPED_MODE` - Block external LLM calls (true/false)
- `OLLAMA_URL` - Ollama server URL
- `REDIS_URL` - Redis connection string

See `env.example` for complete list.

---

## Development Guide

### Adding New Features

1. **Update this document** in the Changelog section
2. **Create/update code** following existing patterns
3. **Add tests** if applicable
4. **Update API documentation** if adding endpoints
5. **Run migrations** if database changes needed
6. **Commit with descriptive message**

### Code Structure
```
backend/
├── app/
│   ├── routers/          # API endpoints
│   ├── services/         # Business logic
│   ├── middleware/       # Request middleware
│   ├── decorators/       # Function decorators
│   └── schemas/          # Pydantic models
├── migrations/           # Database migrations
└── requirements.txt      # Python dependencies

frontend/
├── src/
│   ├── pages/           # Page components
│   ├── components/      # Reusable components
│   ├── lib/             # Utilities
│   └── contexts/         # React contexts
└── package.json         # Node dependencies
```

---

## Deployment

### Docker Compose
```bash
docker-compose up -d
```

### Kubernetes (Helm)
```bash
helm install qaai ./helm/qaai
```

### Air-Gapped Deployment
See `docs/AIR_GAPPED_DEPLOYMENT.md`

---

## Roadmap

### Tier-1 Features (Next 4-8 weeks)
- [ ] Kubernetes Helm chart + operator pattern
- [ ] Nexus "Red Team Mode" + OWASP ZAP integration
- [ ] Self-healing Playwright engine (98%+ reliability)
- [ ] Bi-directional Jira sync with custom field mapping
- [ ] GitHub/Azure DevOps PR gating workflow
- [ ] PDF/Excel executive reports
- [ ] White-label mode

### Tier-2 Features (Future)
- [ ] Mobile agent (Appium/Maestro)
- [ ] Visual regression (Percy/Resemble.js)
- [ ] LoRA fine-tuning portal
- [ ] On-prem model hosting service
- [ ] Marketplace for custom agents

---

## Maintenance Notes

### Updating This Document

**When to update:**
- Adding new features
- Changing architecture
- Updating dependencies
- Adding new endpoints
- Database schema changes
- Configuration changes

**How to update:**
1. Add entry to Version History & Changelog
2. Update relevant sections
3. Update "Last Updated" date
4. Commit with message: "Update MASTER_DOCUMENT.md: [description]"

### Document Structure
- Keep sections organized and up-to-date
- Use clear headings and subheadings
- Include file paths for reference
- Link to detailed documentation when available
- Keep changelog in reverse chronological order

---

**Last Updated:** 2025-01-XX  
**Next Review:** [Set review date]  
**Maintained By:** Development Team

