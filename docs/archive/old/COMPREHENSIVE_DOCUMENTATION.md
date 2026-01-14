# QA AI Platform - Comprehensive Documentation

**Last Updated:** December 2024  
**Version:** 2.0  
**Status:** Production Ready

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [Frontend Pages & Routes](#frontend-pages--routes)
6. [Backend API Endpoints](#backend-api-endpoints)
7. [Services & Components](#services--components)
8. [Database Schema](#database-schema)
9. [Implementation Details](#implementation-details)
10. [Deployment Guide](#deployment-guide)
11. [Development Guide](#development-guide)

---

## Project Overview

**QA AI Platform** is a comprehensive, AI-powered Quality Assurance testing management system that automates the entire QA lifecycle from test case generation to defect triage. The platform combines modern web technologies with advanced AI capabilities to deliver intelligent testing solutions.

### Key Highlights

- **AI-Powered Test Generation**: Generate test cases from requirements, Jira stories, and user flows
- **Autonomous Testing**: Nexus exploratory testing and autonomous app exploration
- **Flowstral Recording**: Real-time user flow recording with action graph generation
- **Multi-Agent Architecture**: Specialized agents for different testing domains
- **Full Test Management**: Complete CRUD operations for test cases, plans, runs, and defects
- **Integration Ready**: Jira, GitHub, Azure DevOps, Confluence, and CI/CD integrations
- **Production Ready**: PostgreSQL database, multi-tenant support, comprehensive error handling

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI Framework |
| **TypeScript** | 5.8.3 | Type Safety |
| **Vite** | 5.4.19 | Build Tool & Dev Server |
| **React Router DOM** | 6.30.1 | Client-side Routing |
| **Tailwind CSS** | 3.4.17 | Styling Framework |
| **shadcn/ui** | Latest | UI Component Library |
| **TanStack Query** | 5.83.0 | Data Fetching & Caching |
| **Zod** | 3.25.76 | Schema Validation |
| **React Hook Form** | 7.61.1 | Form Management |
| **Sonner** | 1.7.4 | Toast Notifications |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.104.1 | Web Framework |
| **Uvicorn** | 0.24.0 | ASGI Server |
| **Pydantic** | 2.5.0 | Data Validation |
| **Python** | 3.9+ | Programming Language |
| **PostgreSQL** | 16 | Primary Database |
| **psycopg2-binary** | 2.9.0+ | PostgreSQL Driver |
| **asyncpg** | 0.29.0+ | Async PostgreSQL Driver |
| **Playwright** | 1.48.0 | Browser Automation |
| **Redis** | 5.0.0+ | Caching & Queue |
| **sentence-transformers** | 2.2.0+ | NLP & Embeddings |

### AI/LLM Integration

| Technology | Purpose |
|------------|---------|
| **Ollama** | Local LLM Serving (Qwen Models) |
| **OpenAI API** | Cloud LLM (GPT-4, GPT-4o-mini) |
| **Anthropic API** | Cloud LLM (Claude) - Optional |
| **Model Gateway** | Unified LLM access layer with automatic routing |
| **Fine-tuning Ready** | All AI generations stored for LoRA fine-tuning |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **PostgreSQL** | Database container |
| **Supabase** | Optional SaaS database backend |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 8080)                  │
│  Dashboard | Flowstral | Nexus | Exploration | Test Cases | ...│
└────────────────────────────┬───────────────────────────────────┘
                             │ HTTP/REST API
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Port 8001)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Gateway & Router Layer                  │  │
│  │  • Health API • Flowstral API • Nexus API • ...          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │            Agent Orchestrator & Services                 │  │
│  │  • Requirements Agent • Automation Agent                │  │
│  │  • Performance Agent • Accessibility Agent              │  │
│  │  • Security Agent • Defect Agent                        │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │              Model Gateway                               │  │
│  │  • Local LLM (Ollama/Qwen) • Cloud APIs (OpenAI/etc)    │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         ▼                                  ▼
┌──────────────────┐            ┌──────────────────┐
│   PostgreSQL     │            │   External Tools  │
│   (Port 5432)    │            │  • Playwright    │
│                  │            │  • k6/Locust     │
│  • Test Cases    │            │  • ZAP           │
│  • Test Runs     │            │  • Ollama        │
│  • Requirements  │            └──────────────────┘
│  • Defects       │
│  • AI Generations│
└──────────────────┘
```

### Multi-Agent Architecture

The platform implements a sophisticated multi-agent system where specialized agents handle different aspects of testing:

1. **Requirements Intelligence Agent**: Analyzes requirements, generates test cases, converts Jira stories
2. **Functional Automation Agent**: Generates Playwright scripts, handles test execution
3. **Performance Testing Agent**: Generates k6/Locust scripts, analyzes performance metrics
4. **Accessibility Agent**: WCAG compliance testing, accessibility scan generation
5. **Security Agent**: Security testing, vulnerability detection, SAST integration
6. **Defect Agent**: Failure analysis, root cause identification, triage
7. **Test Design Agent**: Test case design, scenario generation, coverage analysis

---

## Core Features

### 1. Flowstral - Action Graph Builder

**Flowstral** is a Chrome-based recording system that captures real user flows and converts them into structured action graphs for automated test generation.

#### Key Features:
- **Real-time Event Capture**: Records clicks, inputs, navigation, API calls, errors
- **Action Graph Generation**: Builds structured graph of user actions and page states
- **Multi-Pipeline Analysis**: 
  - DOM Snapshot Pipeline
  - WCAG Accessibility Pipeline
  - Performance Probe Pipeline
  - Action Graph Update Pipeline
- **6 Artifact Generation**:
  1. Action Graph (JSON)
  2. Test Cases (Gherkin/Playwright)
  3. Requirements (Structured)
  4. Playwright Scripts
  5. Accessibility Report
  6. Performance Report
- **Browser Extension**: Chrome extension for seamless recording
- **WebSocket Support**: Real-time updates during recording

#### API Endpoints:
- `POST /api/flowstral/start` - Start recording session
- `POST /api/flowstral/capture-event` - Capture user event
- `POST /api/flowstral/stop` - Stop recording and generate artifacts
- `GET /api/flowstral/session/{session_id}` - Get session details
- `GET /api/flowstral/session/{session_id}/artifacts` - Get generated artifacts
- `POST /api/flowstral/session/{session_id}/execute-test` - Execute generated test

#### Implementation:
- **Backend Service**: `backend/app/services/flowstral/`
- **Frontend Page**: `src/pages/Flowstral.tsx`
- **API Router**: `backend/app/routers/flowstral_api.py`

---

### 2. Nexus - Autonomous Exploratory Testing

**Nexus** is an autonomous testing agent that discovers severe, non-obvious defects with zero human input after initialization.

#### Key Features:
- **Autonomous Operation**: Runs independently after start
- **Risk Heatmap**: Live risk assessment visualization
- **Priority Queue**: Stateful target management
- **E2E Flow Validation**: Validates critical business flows
- **Defect Detection**: Automatic defect detection and storage
- **Parallel Tool Calls**: Aggressive parallel execution
- **Completion Logic**: Intelligent completion detection

#### Tools Available:
1. `add_exploration_target` - Add new page/flow to explore
2. `validate_e2e_flow` - Validate end-to-end flow
3. `declare_exploration_complete` - Signal completion
4. `crawl_page` - Crawl and analyze page
5. `detect_defects_on_page` - Detect defects on current page
6. `update_risk_heatmap` - Update risk assessment

#### API Endpoints:
- `POST /api/nexus/start` - Start Nexus session
- `GET /api/nexus/status/{session_id}` - Get session status
- `GET /api/nexus/sessions` - List all sessions

#### Implementation:
- **Backend Service**: `backend/app/services/exploration/nexus_exploratory_service.py`
- **Frontend Page**: `src/pages/Nexus.tsx`
- **API Router**: `backend/app/routers/nexus_exploratory_api.py`

---

### 3. Autonomous App Exploration

**Autonomous Exploration** systematically navigates applications to build capability maps and compare requirements.

#### Key Features:
- **Systematic Navigation**: BFS/DFS exploration strategies
- **Capability Map Building**: Discovers entities, operations, and flows
- **Requirement Comparison**: Compares new requirements against discovered capabilities
- **Gap Analysis**: Identifies missing features and validations
- **Impact Assessment**: Determines impact type (UI, backend, data model)
- **Test Suggestions**: Auto-generates test cases for gaps

#### API Endpoints:
- `POST /api/exploration/start` - Start exploration
- `POST /api/exploration/compare-requirements` - Compare requirements
- `POST /api/exploration/complete-workflow` - Complete workflow (explore + test + report)
- `GET /api/exploration/report/{run_id}` - Get exploration report
- `GET /api/exploration/defects/stats` - Get defect statistics

#### Implementation:
- **Backend Services**: 
  - `backend/app/services/exploration/autonomous_explorer.py`
  - `backend/app/services/exploration/capability_map_builder.py`
  - `backend/app/services/exploration/requirement_comparator.py`
- **Frontend Page**: `src/pages/Exploration.tsx`
- **API Routers**: 
  - `backend/app/routers/exploration_api.py`
  - `backend/app/routers/exploration_workflow_api.py`
  - `backend/app/routers/exploration_test_generation_api.py`
  - `backend/app/routers/exploration_reporting_api.py`

---

### 4. Test Case Management

Complete CRUD operations for test cases with AI-powered generation.

#### Features:
- **Full CRUD**: Create, Read, Update, Delete test cases
- **AI Generation**: Generate test cases from requirements, Jira stories, or descriptions
- **Test Case Enhancement**: AI-powered test case improvement
- **Test Case Rewrite**: Convert manual test cases to automation scripts
- **Search & Filter**: Search by name, description, tags; filter by priority, type
- **Status Management**: Draft, Active, Archived, Deprecated
- **Steps Management**: JSON-based test steps with expected results

#### API Endpoints:
- `GET /test-cases` - List test cases
- `GET /test-cases/{id}` - Get test case by ID
- `POST /test-cases` - Create test case
- `PUT /test-cases/{id}` - Update test case
- `DELETE /test-cases/{id}` - Delete test case (soft delete)
- `POST /ai/generate-tests` - Generate test cases from requirements
- `POST /ai/jira-to-testcases` - Convert Jira story to test cases
- `POST /ai/testcase-to-playwright` - Convert test case to Playwright

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/TestCases.tsx`
  - `src/pages/CreateTestCase.tsx`
- **API Routers**: 
  - `backend/app/routers/test_cases_crud_api.py`
  - `backend/app/routers/test_case_api.py`
  - `backend/app/routers/test_case_rewrite_api.py`

---

### 5. Test Plan Management

Organize test cases into executable test plans.

#### Features:
- **Test Plan CRUD**: Create, edit, delete test plans
- **Test Case Association**: Link multiple test cases to plans
- **Plan Execution**: Execute all test cases in a plan
- **Plan Templates**: Reusable plan structures

#### API Endpoints:
- `GET /test-plans` - List test plans
- `GET /test-plans/{id}` - Get test plan by ID
- `POST /test-plans` - Create test plan
- `PUT /test-plans/{id}` - Update test plan
- `DELETE /test-plans/{id}` - Delete test plan

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/TestPlans.tsx`
  - `src/pages/CreateTestPlan.tsx`
  - `src/pages/EditTestPlan.tsx`
- **API Router**: `backend/app/routers/test_plans_api.py`

---

### 6. Test Run Management

Execute and track test runs with detailed results.

#### Features:
- **Test Run Creation**: Create runs from test plans or selected test cases
- **Execution Tracking**: Real-time execution status
- **Step-by-Step Results**: Detailed results for each test step
- **Artifact Storage**: Screenshots, videos, logs linked to runs
- **Defect Linking**: Link defects to failed test runs
- **Comments & Notes**: Add comments to test runs
- **Status Management**: Not Started, In Progress, Passed, Failed, Blocked

#### API Endpoints:
- `GET /test-runs` - List test runs
- `GET /test-runs/{id}` - Get test run with details
- `POST /test-runs` - Create test run
- `PUT /test-runs/{id}` - Update test run
- `POST /test-runs/{id}/start` - Start test run execution
- `POST /test-runs/{id}/execute-selected` - Execute selected test cases
- `POST /test-runs/{id}/steps/{step_id}/mark` - Mark step as pass/fail
- `POST /test-runs/{id}/steps/{step_id}/screenshot` - Attach screenshot
- `DELETE /test-runs/{id}` - Delete test run

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/TestRuns.tsx`
  - `src/pages/CreateTestRun.tsx`
  - `src/pages/TestRunDetail.tsx`
  - `src/pages/TestCaseExecution.tsx`
- **API Router**: `backend/app/routers/test_runs_api.py`
- **Execution Service**: `backend/app/services/automation/test_execution_service.py`

---

### 7. Requirements Management

Track and manage requirements from various sources (Jira, manual entry).

#### Features:
- **Requirement CRUD**: Create, read, update, delete requirements
- **Jira Integration**: Import requirements from Jira
- **Test Case Generation**: Generate test cases from requirements
- **Gherkin Conversion**: Convert requirements to Gherkin format
- **Traceability**: Link test cases to requirements

#### API Endpoints:
- `GET /requirements` - List requirements
- `GET /requirements/{id}` - Get requirement by ID
- `POST /requirements` - Create requirement
- `PUT /requirements/{id}` - Update requirement
- `POST /requirements/convert-to-gherkin/{id}` - Convert to Gherkin

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/Requirements.tsx`
  - `src/pages/CreateRequirement.tsx`
- **API Router**: `backend/app/routers/requirements_api.py`

---

### 8. Defect Management

Comprehensive bug tracking and management.

#### Features:
- **Defect CRUD**: Create, read, update, delete defects
- **Severity Management**: Critical, High, Medium, Low
- **Status Tracking**: New, In Progress, Resolved, Closed
- **Test Run Linking**: Link defects to test runs
- **Jira Sync**: Sync defects to Jira (webhook support)

#### API Endpoints:
- `GET /defects` - List defects
- `GET /defects/{id}` - Get defect by ID
- `POST /defects` - Create defect
- `PUT /defects/{id}` - Update defect
- `DELETE /defects/{id}` - Delete defect

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/Defects.tsx`
  - `src/pages/CreateDefect.tsx`
- **API Router**: `backend/app/routers/defects_api.py`

---

### 9. AI-Powered Features

#### 9.1 Test Generation from Jira Stories
- Converts Jira user stories to comprehensive test cases
- Automatically stores requirements in database
- Generates test steps, preconditions, and priority

#### 9.2 Test Case to Playwright Code
- Converts manual test cases to executable Playwright scripts
- Generates locators and assertions automatically
- Ready-to-run test automation code

#### 9.3 API Test Generation
- Generate API tests from OpenAPI specifications
- Creates comprehensive API test suites
- Includes positive and negative test cases

#### 9.4 Performance Test Generation
- Generate k6/JMeter performance tests
- Load testing scripts from requirements
- Configurable load patterns

#### 9.5 Accessibility Test Generation
- Generate Playwright + Axe accessibility tests
- WCAG compliance testing automation
- Accessibility scan scripts

#### 9.6 AI-Powered Defect Triage
- Analyze test failures with root cause identification
- Suggest fixes and investigation steps
- Categorize failures (locator, timing, network, etc.)
- Flaky test detection

#### API Endpoints:
- `POST /ai/generate-tests` - Generate test cases from requirements
- `POST /ai/generate-tests-enhanced` - Enhanced test generation
- `POST /ai/jira-to-testcases` - Convert Jira to test cases
- `POST /ai/testcase-to-playwright` - Convert test case to Playwright
- `POST /ai/api-tests` - Generate API tests
- `POST /ai/perf-tests` - Generate performance tests
- `POST /ai/a11y-tests` - Generate accessibility tests
- `POST /ai/triage` - Analyze test failures
- `GET /ai/templates` - Get AI prompt templates
- `POST /ai/templates` - Save AI prompt templates
- `POST /ai/generations/{id}/rate` - Rate AI generation
- `POST /ai/generations/{id}/correct` - Correct AI generation

#### Implementation:
- **API Router**: `backend/app/routers/ai_generation_api.py`
- **Services**: 
  - `backend/app/services/llm/` - LLM integration services
  - `backend/app/services/engines/` - Test generation engines

---

### 10. API Import Tool

Import API specifications and generate test cases.

#### Features:
- **Multiple Format Support**: OpenAPI/Swagger, WSDL, Postman, GraphQL
- **File Upload**: Upload specification files
- **Text Paste**: Paste specification directly
- **Test Generation**: Generate tests in multiple frameworks:
  - Playwright (TypeScript)
  - pytest (Python)
  - Postman Collection
- **Download Support**: Download generated test scripts

#### API Endpoints:
- `POST /api/import/spec` - Import specification from text
- `POST /api/import/spec/file` - Import specification from file
- `POST /api/import/generate-tests` - Generate tests from parsed spec

#### Implementation:
- **Frontend Page**: `src/pages/APIImport.tsx`
- **API Router**: `backend/app/routers/api_import_api.py`
- **Service**: `backend/app/services/connectors/api_spec_parser.py`

---

### 11. Gherkin Converter

Convert requirements to Gherkin feature files.

#### Features:
- **Single Requirement Conversion**: Convert one requirement to Gherkin
- **Text Conversion**: Convert requirement text directly
- **Batch Conversion**: Convert multiple requirements at once
- **Project-Based Conversion**: Convert all requirements in a project
- **Format Validation**: Ensures valid Gherkin syntax

#### API Endpoints:
- `POST /api/gherkin/convert` - Convert requirement to Gherkin
- `POST /api/gherkin/convert-batch` - Batch convert requirements

#### Implementation:
- **Frontend Page**: `src/pages/GherkinConverter.tsx`
- **API Router**: `backend/app/routers/gherkin_api.py`
- **Service**: `backend/app/services/engines/gherkin_converter.py`

---

### 12. Integrations

#### 12.1 Jira Integration
- Import requirements from Jira
- Sync defects to Jira
- Webhook support for real-time updates

#### 12.2 GitHub Integration
- Push test scripts to repositories
- Pull request integration
- Test result reporting

#### 12.3 Azure DevOps Integration
- Work item integration
- Test result publishing
- Pipeline integration

#### 12.4 Confluence Integration
- Import documentation
- Export test results

#### 12.5 CI/CD Integration
- Pipeline integration
- Test execution triggers
- Result reporting

#### Implementation:
- **Frontend Pages**: 
  - `src/pages/Integrations.tsx`
  - `src/pages/JiraIntegration.tsx`
  - `src/pages/GitHubIntegration.tsx`
  - `src/pages/AzureDevOpsIntegration.tsx`
  - `src/pages/ConfluenceIntegration.tsx`
  - `src/pages/CICDIntegration.tsx`
- **Services**: `backend/app/services/connectors/`

---

### 13. Automation & Test Execution

#### Features:
- **Playwright Execution**: Execute Playwright test scripts
- **Local Test Execution**: Run tests locally with artifact capture
- **Self-Healing**: Automatic locator recovery
- **Auto-Installation**: Automatic npm and Playwright installation
- **Artifact Management**: Screenshots, videos, logs

#### API Endpoints:
- `POST /tests/execute` - Execute test cases
- `POST /api/flowstral/session/{session_id}/execute-test` - Execute Flowstral test
- `POST /api/automation/execute` - Execute automation scripts

#### Implementation:
- **Frontend Page**: `src/pages/RunAutomation.tsx`
- **API Router**: `backend/app/routers/automation_api.py`
- **Services**: 
  - `backend/app/services/automation/test_execution_service.py`
  - `backend/app/services/automation/intelligent_self_healing.py`
  - `backend/app/services/executors/playwright_executor.py`

---

### 14. Triage & Analysis

#### Features:
- **Failure Analysis**: AI-powered root cause analysis
- **Flaky Test Detection**: Identify and categorize flaky tests
- **Failure Categorization**: Locator issues, timing issues, network issues
- **Fix Suggestions**: AI-generated fix recommendations

#### Implementation:
- **Frontend Page**: `src/pages/Triage.tsx`
- **Service**: `backend/app/services/agents/defect_agent.py`

---

## Frontend Pages & Routes

### Public Routes
- `/auth` - Authentication page

### Protected Routes

#### Core Pages
- `/` - Dashboard (overview, stats, recent runs)
- `/onboarding` - Onboarding page for new users

#### Test Management
- `/plans` - Test Plans list
- `/plans/create` - Create test plan
- `/plans/edit/:id` - Edit test plan
- `/cases` - Test Cases list
- `/cases/create` - Create test case
- `/cases/edit/:id` - Edit test case
- `/runs` - Test Runs list
- `/runs/create` - Create test run
- `/runs/:id` - Test Run detail
- `/runs/:id/execute` - Test case execution

#### AI-Powered Features
- `/flowstral` - Flowstral recording interface
- `/nexus` - Nexus autonomous testing
- `/exploration` - Autonomous app exploration

#### Requirements & Defects
- `/requirements` - Requirements list
- `/requirements/create` - Create requirement
- `/requirements/edit/:id` - Edit requirement
- `/defects` - Defects list
- `/defects/create` - Create defect
- `/defects/edit/:id` - Edit defect

#### Utilities
- `/api-import` - API Import tool
- `/gherkin` - Gherkin Converter
- `/automation` - Run Automation
- `/triage` - Triage & Analysis

#### Integrations
- `/integrations` - Integrations hub
- `/integrations/jira` - Jira integration
- `/integrations/github` - GitHub integration
- `/integrations/azure-devops` - Azure DevOps integration
- `/integrations/confluence` - Confluence integration
- `/integrations/cicd` - CI/CD integration

#### Settings
- `/settings` - User and organization settings

---

## Backend API Endpoints

### Health & Status
- `GET /health` - Backend health check
- `GET /health/database` - Database connection status
- `GET /health/metrics` - System metrics

### Test Cases
- `GET /test-cases` - List test cases
- `GET /test-cases/{id}` - Get test case
- `POST /test-cases` - Create test case
- `PUT /test-cases/{id}` - Update test case
- `DELETE /test-cases/{id}` - Delete test case

### Test Plans
- `GET /test-plans` - List test plans
- `GET /test-plans/{id}` - Get test plan
- `POST /test-plans` - Create test plan
- `PUT /test-plans/{id}` - Update test plan
- `DELETE /test-plans/{id}` - Delete test plan

### Test Runs
- `GET /test-runs` - List test runs
- `GET /test-runs/{id}` - Get test run
- `POST /test-runs` - Create test run
- `PUT /test-runs/{id}` - Update test run
- `POST /test-runs/{id}/start` - Start execution
- `POST /test-runs/{id}/execute-selected` - Execute selected
- `DELETE /test-runs/{id}` - Delete test run

### Requirements
- `GET /requirements` - List requirements
- `GET /requirements/{id}` - Get requirement
- `POST /requirements` - Create requirement
- `PUT /requirements/{id}` - Update requirement

### Defects
- `GET /defects` - List defects
- `GET /defects/{id}` - Get defect
- `POST /defects` - Create defect
- `PUT /defects/{id}` - Update defect
- `DELETE /defects/{id}` - Delete defect

### AI Generation
- `POST /ai/generate-tests` - Generate test cases
- `POST /ai/jira-to-testcases` - Convert Jira to tests
- `POST /ai/testcase-to-playwright` - Convert to Playwright
- `POST /ai/api-tests` - Generate API tests
- `POST /ai/perf-tests` - Generate performance tests
- `POST /ai/a11y-tests` - Generate accessibility tests
- `POST /ai/triage` - Analyze failures
- `GET /ai/templates` - Get templates
- `POST /ai/templates` - Save templates

### Flowstral
- `POST /api/flowstral/start` - Start session
- `POST /api/flowstral/capture-event` - Capture event
- `POST /api/flowstral/stop` - Stop session
- `GET /api/flowstral/session/{id}` - Get session
- `GET /api/flowstral/session/{id}/artifacts` - Get artifacts
- `POST /api/flowstral/session/{id}/execute-test` - Execute test

### Nexus
- `POST /api/nexus/start` - Start session
- `GET /api/nexus/status/{id}` - Get status
- `GET /api/nexus/sessions` - List sessions

### Exploration
- `POST /api/exploration/start` - Start exploration
- `POST /api/exploration/compare-requirements` - Compare requirements
- `POST /api/exploration/complete-workflow` - Complete workflow
- `GET /api/exploration/report/{id}` - Get report
- `GET /api/exploration/defects/stats` - Get defect stats

### API Import
- `POST /api/import/spec` - Import spec
- `POST /api/import/spec/file` - Import from file
- `POST /api/import/generate-tests` - Generate tests

### Gherkin
- `POST /api/gherkin/convert` - Convert requirement
- `POST /api/gherkin/convert-batch` - Batch convert

### Automation
- `POST /tests/execute` - Execute tests
- `POST /api/automation/execute` - Execute automation

### Agents
- `POST /agents/execute` - Execute agent
- `GET /agents` - List agents
- `GET /agents/{type}/health` - Agent health
- `GET /agents/health` - All agents health

### Workflows
- `POST /workflows/multi-agent` - Multi-agent workflow
- `POST /workflows/create` - Create workflow
- `POST /workflows/{id}/execute` - Execute workflow
- `GET /workflows/{id}` - Get workflow

### Models
- `GET /ai/models` - List models
- `GET /ai/models/{id}` - Get model
- `POST /ai/models/register` - Register model
- `POST /ai/models/{id}/deploy` - Deploy model
- `POST /ai/models/{id}/ab-test` - A/B test model

### Tenants
- `GET /tenants` - List tenants
- `GET /tenants/{id}` - Get tenant
- `POST /tenants` - Create tenant
- `PATCH /tenants/{id}/settings` - Update settings

---

## Services & Components

### Backend Services

#### Core Services
- **Orchestrator** (`core/orchestrator.py`): Coordinates multi-agent workflows
- **Agent Registry** (`core/agent_registry.py`): Manages agent registration
- **Tenant Service** (`core/tenant_service.py`): Multi-tenant isolation
- **RBAC Service** (`core/rbac_service.py`): Role-based access control
- **Cache Service** (`core/cache_service.py`): Caching layer
- **Metrics Service** (`core/metrics_service.py`): Metrics collection
- **Observability Service** (`core/observability_service.py`): Logging and monitoring

#### LLM Services
- **Ollama Service** (`llm/ollama_service.py`): Local LLM integration
- **OpenAI Service** (`llm/openai_service.py`): OpenAI API integration
- **Model Gateway** (`llm/model_gateway.py`): Unified LLM access
- **Enhanced Generation Service** (`llm/enhanced_generation_service.py`): Advanced generation

#### Automation Services
- **Test Execution Service** (`automation/test_execution_service.py`): Test execution
- **Self-Healing Service** (`automation/intelligent_self_healing.py`): Auto-healing
- **Locator Engine** (`automation/locator_engine.py`): Element discovery
- **Script Converter** (`automation/script_converter.py`): Script conversion

#### Exploration Services
- **Autonomous Explorer** (`exploration/autonomous_explorer.py`): App exploration
- **Capability Map Builder** (`exploration/capability_map_builder.py`): Capability mapping
- **Requirement Comparator** (`exploration/requirement_comparator.py`): Requirement comparison
- **Defect Detector** (`exploration/defect_detector.py`): Defect detection
- **Nexus Service** (`exploration/nexus_exploratory_service.py`): Nexus testing

#### Flowstral Services
- **Flowstral Session** (`flowstral/flowstral_session.py`): Session management
- **Flowstral Artifacts** (`flowstral/flowstral_artifacts.py`): Artifact generation
- **Action Graph Builder** (`flowstral/action_graph_builder.py`): Graph construction

#### Engine Services
- **Test Case Engine** (`engines/test_case_engine.py`): Test case generation
- **Test Case Synthesizer** (`engines/test_case_synthesizer.py`): Test synthesis
- **Gherkin Converter** (`engines/gherkin_converter.py`): Gherkin conversion
- **Quality Enhancer** (`engines/quality_enhancer.py`): Quality improvement
- **Flowstral Template Engine** (`engines/flowstral_template_engine.py`): Template-based generation

#### Storage Services
- **Database Service** (`storage/database.py`): Database operations
- **AI Storage** (`storage/ai_storage.py`): AI generation storage
- **Test Results Storage** (`storage/test_results_storage.py`): Test result storage
- **Postgres Direct** (`storage/postgres_direct.py`): Direct PostgreSQL access

#### Connector Services
- **Jira Connector** (`connectors/jira_connector.py`): Jira integration
- **GitHub Connector** (`connectors/github_connector.py`): GitHub integration
- **Azure DevOps Connector** (`connectors/azure_devops_connector.py`): Azure DevOps integration
- **Confluence Connector** (`connectors/confluence_connector.py`): Confluence integration
- **CI/CD Connector** (`connectors/cicd_connector.py`): CI/CD integration
- **API Spec Parser** (`connectors/api_spec_parser.py`): API spec parsing

#### Agent Services
- **Requirements Agent** (`agents/requirements_agent.py`): Requirements analysis
- **Automation Agent** (`agents/automation_agent.py`): Automation generation
- **Performance Agent** (`agents/performance_agent.py`): Performance testing
- **Accessibility Agent** (`agents/accessibility_agent.py`): Accessibility testing
- **Security Agent** (`agents/security_agent.py`): Security testing
- **Defect Agent** (`agents/defect_agent.py`): Defect analysis
- **Test Design Agent** (`agents/test_design_agent.py`): Test design

#### Executor Services
- **Playwright Executor** (`executors/playwright_executor.py`): Playwright execution
- **k6 Executor** (`executors/k6_executor.py`): k6 performance testing
- **ZAP Executor** (`executors/zap_executor.py`): Security testing
- **Unified Runner Service** (`executors/unified_runner_service.py`): Unified execution

### Frontend Components

#### Pages
All pages are in `src/pages/` directory

#### Shared Components
- **Layout** (`components/Layout.tsx`): Main layout wrapper
- **AppSidebar** (`components/AppSidebar.tsx`): Navigation sidebar
- **TopNav** (`components/TopNav.tsx`): Top navigation
- **ProtectedRoute** (`components/ProtectedRoute.tsx`): Route protection
- **TestCaseGenerator** (`components/TestCaseGenerator/`): Test case generation UI

#### UI Components
All shadcn/ui components in `src/components/ui/`

#### Services
- **Data Storage Service** (`lib/data-storage.ts`): Backend API client
- **Test Execution Service** (`lib/test-execution-service.ts`): Test execution
- **AI Service** (`lib/ai-service.ts`): AI integration
- **Jira Integration Service** (`lib/jira-integration-service.ts`): Jira integration
- **Supabase Service** (`lib/supabase-service.ts`): Supabase client

---

## Database Schema

### Core Tables

#### Organizations & Projects
- **organizations**: Multi-tenant organizations
- **projects**: Projects within organizations

#### Test Management
- **test_plans**: Test plan definitions
- **test_cases**: Individual test cases
- **test_runs**: Test execution runs
- **test_run_steps**: Individual test step results

#### Requirements & Defects
- **requirements**: Source requirements (Jira, etc.)
- **defects**: Bug tracking
- **triage_analysis**: AI failure analysis

#### AI & Storage
- **ai_generations**: All LLM calls for fine-tuning
- **ai_templates**: Customizable prompt templates
- **ai_generation_audit**: Usage tracking
- **artifacts**: Screenshots, videos, logs

#### Exploration & Flowstral
- **exploration_runs**: Exploration session data
- **capability_maps**: Discovered capability maps
- **flowstral_sessions**: Flowstral recording sessions
- **action_graphs**: Flowstral action graphs
- **nexus_sessions**: Nexus testing sessions

### Relationships

- Organizations → Projects (1:N)
- Projects → Test Plans (1:N)
- Test Plans → Test Cases (1:N)
- Test Cases → Test Run Steps (1:N)
- Test Runs → Test Run Steps (1:N)
- Test Runs → Artifacts (1:N)
- Requirements → Test Cases (1:N)
- Test Runs → Defects (1:N)

### Migration Files

Located in `supabase/migrations/`:
- `001_initial_schema.sql` - Core schema
- `002_ai_generations.sql` - AI storage
- `003_ai_templates.sql` - Template storage
- `004_requirements_table.sql` - Requirements
- `005_fix_ai_generations.sql` - AI fixes
- Additional migrations for exploration, flowstral, nexus

---

## Implementation Details

### Backend Architecture

#### Router Structure
The backend uses a modular router architecture with 25+ routers:

1. **Health API** - Health checks and metrics
2. **Flowstral API** - Flowstral recording endpoints
3. **Nexus API** - Nexus exploratory testing
4. **Exploration API** - Autonomous exploration
5. **Test Cases CRUD API** - Test case management
6. **Test Runs API** - Test run management
7. **Test Plans API** - Test plan management
8. **Requirements API** - Requirements management
9. **Defects API** - Defect management
10. **AI Generation API** - AI-powered features
11. **API Import API** - API specification import
12. **Gherkin API** - Gherkin conversion
13. **Automation API** - Test execution
14. **Agents API** - Agent management
15. **Workflows API** - Workflow orchestration
16. **Models API** - Model management
17. **Tenants API** - Tenant management
18. **Plugin API** - Plugin system
19. **App First Flow API** - App-first workflow
20. **Requirement to TestCase API** - Requirement conversion
21. **Exploration Test Generation API** - Test generation from exploration
22. **Exploration Reporting API** - Exploration reports
23. **Exploration Workflow API** - Complete exploration workflow

#### Service Layer
Services are organized by domain:
- **Core**: Orchestration, registry, tenant, RBAC
- **LLM**: Model integration and generation
- **Automation**: Test execution and self-healing
- **Exploration**: App exploration and capability mapping
- **Flowstral**: Recording and action graph generation
- **Engines**: Test generation engines
- **Storage**: Database and storage operations
- **Connectors**: External system integrations
- **Agents**: Specialized testing agents
- **Executors**: Test execution engines

### Frontend Architecture

#### Component Structure
- **Pages**: Route-level components
- **Components**: Reusable UI components
- **Services**: API clients and business logic
- **Contexts**: React context providers
- **Hooks**: Custom React hooks
- **Types**: TypeScript type definitions

#### State Management
- **React Query**: Server state management
- **React Context**: Global state (auth, theme)
- **Local State**: Component-level state with hooks

#### Routing
- **React Router DOM**: Client-side routing
- **Protected Routes**: Authentication guards
- **Public Routes**: Unauthenticated access

### AI Integration

#### Model Gateway
Unified access layer for LLM models:
- **Local Models**: Ollama with Qwen models (7B, 14B, 32B)
- **Cloud Models**: OpenAI (GPT-4, GPT-4o-mini), Anthropic (Claude)
- **Automatic Routing**: Based on task complexity
- **Token Tracking**: Usage and cost tracking
- **Retry Logic**: JSON validation and retry

#### Fine-tuning Ready
- All AI generations stored in `ai_generations` table
- Includes prompts, responses, ratings, corrections
- Ready for LoRA fine-tuning on DGX systems

### Test Execution

#### Playwright Integration
- **Browser Automation**: Chromium, Firefox, WebKit
- **Screenshot Capture**: Automatic screenshots on failure
- **Video Recording**: Optional video recording
- **Artifact Storage**: Linked to test runs
- **Self-Healing**: Automatic locator recovery

#### Local Execution
- **npm Integration**: Automatic npm install
- **Playwright Install**: Automatic Playwright installation
- **Error Handling**: Helpful error messages
- **Fallback Logic**: Multiple execution strategies

---

## Deployment Guide

### Prerequisites
- Node.js 18+
- Python 3.9+
- Docker and Docker Compose
- PostgreSQL 16 (or use Docker)
- Ollama (for local LLM) or OpenAI API key

### Environment Variables

Create `.env` file in root:

```env
# Database
DATABASE_URL=postgres://qaai:qaai123@localhost:5432/qaai
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=qaai
POSTGRES_USER=qaai
POSTGRES_PASSWORD=qaai123

# LLM
OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=your-openai-key  # Optional
ANTHROPIC_API_KEY=your-anthropic-key  # Optional

# Supabase (Optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key

# Security
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

### Database Setup

1. **Start PostgreSQL**:
```bash
docker-compose up -d
```

2. **Run Migrations**:
```bash
# Windows PowerShell
Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
Get-Content supabase\migrations\002_ai_generations.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
Get-Content supabase\migrations\003_ai_templates.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
Get-Content supabase\migrations\004_requirements_table.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
Get-Content supabase\migrations\005_fix_ai_generations.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
```

### Backend Setup

1. **Create Virtual Environment**:
```bash
cd backend
python -m venv venv_new
venv_new\Scripts\activate  # Windows
source venv_new/bin/activate  # Linux/Mac
```

2. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

3. **Start Backend**:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup

1. **Install Dependencies**:
```bash
npm install
```

2. **Start Development Server**:
```bash
npm run dev
```

3. **Build for Production**:
```bash
npm run build
```

### Ollama Setup

1. **Install Ollama**: https://ollama.ai

2. **Download Models**:
```bash
ollama pull qwen2.5-coder:7b
ollama pull qwen2.5-coder:14b
ollama pull qwen2.5-coder:32b
```

3. **Start Ollama**:
```bash
ollama serve
```

### Access Points

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Health Check**: http://localhost:8001/health
- **Database Health**: http://localhost:8001/health/database

---

## Development Guide

### Project Structure

```
QAAI/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # Main application
│   │   ├── routers/           # API routers
│   │   ├── services/          # Business logic
│   │   ├── models/            # Data models
│   │   └── schemas/           # Pydantic schemas
│   ├── requirements.txt        # Python dependencies
│   └── logs/                  # Application logs
├── src/                        # React frontend
│   ├── pages/                 # Page components
│   ├── components/            # Reusable components
│   ├── lib/                   # Services and utilities
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # Database migrations
├── tools/                     # Development tools
├── docker-compose.yml        # Docker configuration
├── package.json              # Frontend dependencies
└── README.md                 # Project README
```

### Code Style

#### Backend (Python)
- Follow PEP 8 style guide
- Use type hints
- Async/await for I/O operations
- Comprehensive error handling

#### Frontend (TypeScript)
- Use TypeScript strict mode
- Functional components with hooks
- Follow React best practices
- Use shadcn/ui components

### Testing

#### Backend Testing
```bash
# Run tests
pytest backend/tests/

# Run specific test
pytest backend/tests/unit/services/test_ollama_service.py
```

#### Frontend Testing
```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

### Contributing

1. Create feature branch
2. Make changes
3. Write tests
4. Update documentation
5. Submit pull request

---

## Summary

The QA AI Platform is a comprehensive, production-ready testing management system with:

- **25+ API Routers** covering all features
- **30+ Frontend Pages** for complete UI coverage
- **50+ Backend Services** for business logic
- **Multi-Agent Architecture** for specialized testing
- **AI-Powered Features** with local and cloud LLM support
- **Full Test Management** lifecycle
- **Integration Ready** with major tools
- **Production Ready** with PostgreSQL, multi-tenant, error handling

The platform is actively developed and ready for production deployment.

---

**For detailed API documentation, visit**: http://localhost:8001/docs  
**For architecture details, see**: `docs/FINAL_ARCHITECTURE.md`  
**For implementation roadmap, see**: `docs/IMPLEMENTATION_ROADMAP.md`

---

*Last Updated: December 2024*

