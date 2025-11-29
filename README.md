# QA AI Platform - Comprehensive Testing Management System

> An intelligent Quality Assurance platform with AI-powered test generation, execution, and analysis. Built with React, FastAPI, PostgreSQL, and Ollama (Qwen models).

## 🚀 Project Overview

QA AI Platform is a full-stack testing management solution that combines modern web technologies with AI-powered capabilities. The platform streamlines the entire QA lifecycle from test case generation to defect triage, all backed by a robust PostgreSQL database and integrated with local LLM models via Ollama.

**Key Highlights:**
- **Multi-Agent Architecture**: Specialized agents for requirements, automation, performance, accessibility, and security
- **AI-Powered**: Model Gateway with local Qwen 30B (fine-tuned) + cloud API support
- **Full-Stack**: React frontend + FastAPI backend + PostgreSQL database
- **Multi-Tenant**: Full tenant isolation for enterprise deployments
- **On-Prem Ready**: Docker/Helm packaging for self-hosted deployments
- **Production Ready**: Complete CRUD APIs, database persistence, and error handling

**🚀 Architecture Status:** Currently implementing v2.0 multi-agent architecture. See [`docs/FINAL_ARCHITECTURE.md`](docs/FINAL_ARCHITECTURE.md) for details.

---

## ✨ Features

### 🤖 AI-Powered Features

1. **Test Generation from Jira Stories**
   - Convert Jira user stories to comprehensive test cases
   - Automatically stores requirements in database
   - Generates test steps, preconditions, and priority

2. **Test Plan Expansion**
   - Expand existing test plans with additional scenarios
   - AI suggests edge cases and negative tests
   - Maintains context across plan updates

3. **Test Case to Playwright Code**
   - Convert manual test cases to executable Playwright scripts
   - Generates locators and assertions automatically
   - Ready-to-run test automation code

4. **API Test Generation**
   - Generate API tests from OpenAPI specifications
   - Creates comprehensive API test suites
   - Includes positive and negative test cases

5. **Performance Test Generation**
   - Generate k6/JMeter performance tests
   - Load testing scripts from requirements
   - Configurable load patterns

6. **Accessibility Test Generation**
   - Generate Playwright + Axe accessibility tests
   - WCAG compliance testing automation
   - Accessibility scan scripts

7. **AI-Powered Defect Triage**
   - Analyze test failures with root cause identification
   - Suggest fixes and investigation steps
   - Categorize failures (locator, timing, network, etc.)
   - Flaky test detection

### 📋 Test Management

- **Test Cases**: Full CRUD operations with database persistence
- **Test Plans**: Organize test cases into executable plans
- **Test Runs**: Execute and track test runs with detailed results
- **Requirements Tracking**: Link test cases to source requirements (Jira, etc.)
- **Test Execution**: Execute Playwright tests with artifact storage

### 🐛 Defect Management

- **Defect Creation**: Comprehensive bug reporting
- **AI Triage**: Intelligent failure analysis
- **Defect Linking**: Connect defects to test runs and cases
- **Jira Integration**: Webhook support for defect sync

### 📊 Analytics & Reporting

- **AI Generation Tracking**: All LLM calls stored for fine-tuning
- **Test Run Analytics**: Pass/fail rates, duration tracking
- **Artifact Storage**: Screenshots, videos, logs linked to runs
- **Database Health Monitoring**: Connection and schema verification

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Routing**: React Router DOM v6
- **State**: React Hooks + Context API
- **HTTP**: Fetch API with async/await
- **Notifications**: Sonner toast notifications

### Backend
- **Framework**: FastAPI (Python)
- **Server**: Uvicorn ASGI server
- **Database**: PostgreSQL 16 (via Docker)
- **ORM**: Direct SQL with psycopg2
- **AI Integration**: Ollama API client
- **CORS**: Configured for frontend access

### AI/LLM
- **Model Gateway**: Unified LLM access layer
  - Local: Qwen 3-Coder-30B (fine-tuned for QA) via vLLM/Ollama
  - Cloud: OpenAI, Anthropic (optional)
  - Token & cost tracking
- **Model Routing**: Automatic selection based on task complexity
- **JSON Validation**: Retry logic for structured outputs
- **Fine-tuning Ready**: All prompts/outputs stored for training (LoRA fine-tuning on DGX)

### Database
- **Primary**: PostgreSQL 16 (Docker container)
- **Optional**: Supabase (for SaaS features)
- **Schema**: 16 tables with full relationships
- **Migrations**: SQL migration scripts for version control

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database**: PostgreSQL container
- **Ports**:
  - Frontend: 8080 (Vite)
  - Backend: 8001 (FastAPI)
  - PostgreSQL: 5432

---

## 🏗️ Architecture

### Current Architecture (v1.0)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │   FastAPI Backend│    │   PostgreSQL    │
│   (Port 8080)   │◄──►│   (Port 8001)    │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Ollama API    │              │
         └──────────────►│   (Qwen Models) │◄─────────────┘
                        └─────────────────┘
```

### Target Architecture (v2.0) - Multi-Agent Platform

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│  Dashboard | Test Cases | Runs | Requirements | Performance | Sec   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (FastAPI)                             │
└──────────────────────────────┬──────────────────────────────────────┘
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│    Agent Orchestrator        │  │     Model Gateway            │
│  • Workflow Engine           │  │  • Local LLM (Qwen 30B)     │
│  • Agent Coordination        │  │  • Cloud APIs (OpenAI/etc)  │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              ▼
        ┌─────────────────────────────────────┐
        │      Specialized Agents              │
        ├─────────────────────────────────────┤
        │ 1. Requirements Intelligence Agent   │
        │ 2. Functional Automation Agent       │
        │ 3. Performance Testing Agent         │
        │ 4. Accessibility Agent               │
        │ 5. Security Agent                    │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴───────────────────────┐
        ▼                                      ▼
┌──────────────────┐              ┌──────────────────┐
│  Test Runner     │              │  External Tools  │
│  Service         │              │  • Playwright    │
│  • Docker Workers│              │  • k6/Locust     │
│  • Queue System  │              │  • ZAP           │
└──────────────────┘              └──────────────────┘
```

**📖 For detailed architecture documentation, see:**
- [`docs/FINAL_ARCHITECTURE.md`](docs/FINAL_ARCHITECTURE.md) - Complete architecture specification
- [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) - Implementation plan

### Data Flow

1. **Frontend** → Makes API calls to FastAPI backend
2. **Backend** → Routes to Agent Orchestrator or Model Gateway
3. **Agents** → Use Model Gateway for LLM access (Qwen 30B or cloud)
4. **Test Runner** → Executes tests in Docker workers
5. **Database** → Persists all data (test cases, runs, AI outputs) with multi-tenant isolation

---

## 📁 Project Structure

```
QAAI/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py            # Main FastAPI application
│   │   └── services/          # Business logic services
│   │       ├── ollama_service.py      # Ollama LLM integration
│   │       ├── database.py            # Database connection
│   │       ├── postgres_direct.py     # Direct Postgres queries
│   │       ├── ai_storage.py          # AI generation storage
│   │       ├── test_results_storage.py # Test run storage
│   │       └── playwright_runner.py   # Test execution
│   ├── requirements.txt        # Python dependencies
│   └── run_migrations.py       # Migration helper script
├── src/                        # React frontend
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx
│   │   ├── TestCases.tsx
│   │   ├── CreateTestCase.tsx
│   │   ├── TestPlans.tsx
│   │   ├── TestRuns.tsx
│   │   ├── Triage.tsx
│   │   └── Settings.tsx
│   ├── lib/                   # Services and utilities
│   │   ├── data-storage.ts    # Backend API client
│   │   ├── test-execution-service.ts
│   │   └── custom-llm-service.ts
│   └── components/            # React components
├── supabase/
│   └── migrations/           # Database migrations
│       ├── 001_initial_schema.sql
│       ├── 002_ai_generations.sql
│       ├── 003_ai_templates.sql
│       ├── 004_requirements_table.sql
│       └── 005_fix_ai_generations.sql
├── docker-compose.yml         # PostgreSQL container
├── package.json              # Frontend dependencies
└── README.md                 # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Docker** and Docker Compose
- **Ollama** with Qwen models installed

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd QAAI
   ```

2. **Set up PostgreSQL (Docker)**
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL on port 5432.

3. **Run database migrations**
   ```bash
   # Using Docker exec
   Get-Content supabase\migrations\001_initial_schema.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
   Get-Content supabase\migrations\002_ai_generations.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
   Get-Content supabase\migrations\003_ai_templates.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
   Get-Content supabase\migrations\004_requirements_table.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
   Get-Content supabase\migrations\005_fix_ai_generations.sql -Raw | docker exec -i qa-postgres psql -U qaai -d qaai
   ```

4. **Set up Backend**
   ```bash
   cd backend
   python -m venv venv_new
   venv_new\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```

5. **Set up Frontend**
   ```bash
   npm install
   ```

6. **Configure Environment Variables**

   Create `.env` in root:
   ```env
   DATABASE_URL=postgres://qaai:qaai123@localhost:5432/qaai
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=qaai
   POSTGRES_USER=qaai
   POSTGRES_PASSWORD=qaai123
   OLLAMA_URL=http://localhost:11434
   ```

7. **Start Services**

   **Terminal 1 - Backend:**
   ```bash
   cd backend
   venv_new\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
   ```

   **Terminal 2 - Frontend:**
   ```bash
   npm run dev
   ```

8. **Access the Application**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:8001
   - API Docs: http://localhost:8001/docs
   - Health Check: http://localhost:8001/health
   - Database Health: http://localhost:8001/health/database

---

## 📊 Database Schema

### Core Tables

1. **organizations** - Multi-tenant organizations
2. **projects** - Projects within organizations
3. **users** - System users
4. **test_plans** - Test plan definitions
5. **test_cases** - Individual test cases
6. **test_runs** - Test execution runs
7. **test_run_steps** - Individual test step results
8. **requirements** - Source requirements (Jira, etc.)
9. **ai_generations** - All LLM calls for fine-tuning
10. **ai_templates** - Customizable prompt templates
11. **artifacts** - Screenshots, videos, logs
12. **defects** - Bug tracking
13. **triage_analysis** - AI failure analysis
14. **ai_generation_audit** - Usage tracking

### Relationships

- Organizations → Projects (1:N)
- Projects → Test Plans (1:N)
- Test Plans → Test Cases (1:N)
- Test Cases → Test Run Steps (1:N)
- Test Runs → Test Run Steps (1:N)
- Test Runs → Artifacts (1:N)

---

## 🔌 API Endpoints

### Test Cases
- `GET /test-cases` - List all test cases
- `GET /test-cases/{id}` - Get test case by ID
- `POST /test-cases` - Create new test case
- `PUT /test-cases/{id}` - Update test case
- `DELETE /test-cases/{id}` - Delete test case

### Test Runs
- `GET /test-runs` - List all test runs
- `GET /test-runs/{id}` - Get test run with details
- `POST /test-runs` - Create new test run
- `PUT /test-runs/{id}` - Update test run
- `DELETE /test-runs/{id}` - Delete test run

### Test Plans
- `GET /test-plans` - List all test plans
- `POST /test-plans` - Create new test plan
- `PUT /test-plans/{id}` - Update test plan
- `DELETE /test-plans/{id}` - Delete test plan

### AI Features
- `POST /ai/generate-tests` - Generate test cases from requirements
- `POST /ai/jira-to-testcases` - Convert Jira story to test cases
- `POST /ai/testcase-to-playwright` - Convert test case to Playwright code
- `POST /ai/api-tests` - Generate API tests from OpenAPI
- `POST /ai/perf-tests` - Generate performance tests
- `POST /ai/a11y-tests` - Generate accessibility tests
- `POST /ai/triage` - Analyze test failures
- `GET /ai/templates` - Get AI prompt templates
- `POST /ai/templates` - Save AI prompt templates

### Test Execution
- `POST /tests/execute` - Execute test cases
- `POST /runs/ingest` - Ingest test run results

### Health & Status
- `GET /health` - Backend health check
- `GET /health/database` - Database connection status

---

## 🎯 Usage Examples

### Creating a Test Case from Jira Story

1. Navigate to **Test Cases** page
2. Click **"Generate with AI"** button
3. Enter Jira story URL or description
4. AI generates test cases automatically
5. Review and save to database

### Generating Test Case

1. Go to **Create Test Case**
2. Enter feature description
3. Click **"Generate Test Case with AI"**
4. Review generated steps and expected results
5. Save test case

### Running Tests

1. Go to **Test Runs** page
2. Click **"Create Test Run"**
3. Select test cases to execute
4. Click **"Execute"**
5. View results with pass/fail status

### AI Defect Triage

1. Navigate to **Triage** page
2. Select failed test run
3. Click **"Analyze with AI"**
4. Review root cause analysis and suggested fixes

---

## 🔧 Configuration

### Ollama Setup

1. Install Ollama: https://ollama.ai
2. Download Qwen models:
   ```bash
   ollama pull qwen2.5-coder:7b
   ollama pull qwen2.5-coder:14b
   ollama pull qwen2.5-coder:32b
   ```
3. Start Ollama: `ollama serve`
4. Configure in `.env`: `OLLAMA_URL=http://localhost:11434`

### Database Connection

The system supports two modes:

1. **Direct PostgreSQL** (Current)
   - Uses psycopg2 for direct connections
   - Configured via `DATABASE_URL` or individual variables

2. **Supabase** (Future)
   - Set `SUPABASE_URL` and `SUPABASE_KEY`
   - Automatically switches to Supabase client

### Model Selection

AI requests are automatically routed to models based on complexity:
- **7B**: UI tasks, simple generation (fast)
- **14B**: General tasks, balanced (default)
- **32B**: Complex analysis, triage (thorough)

---

## 🧪 Testing

### Backend API Testing

```bash
# Health check
curl http://localhost:8001/health

# Database health
curl http://localhost:8001/health/database

# Create test case
curl -X POST http://localhost:8001/test-cases \
  -H "Content-Type: application/json" \
  -d '{"name": "Login Test", "description": "Test user login"}'
```

### Frontend Testing

```bash
npm test
```

---

## 🚀 Deployment

### Backend Deployment

1. Set environment variables
2. Run migrations on production database
3. Start with uvicorn:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8001
   ```

### Frontend Deployment

```bash
npm run build
# Deploy dist/ folder to hosting service
```

### Docker Deployment

The PostgreSQL container can be deployed:
```bash
docker-compose up -d
```

---

## 📈 Performance Considerations

- **Database Connection Pooling**: ThreadedConnectionPool (1-5 connections)
- **AI Response Caching**: Prompt templates cached in database
- **Async Operations**: All I/O operations are async
- **Error Handling**: Comprehensive error handling with fallbacks

---

## 🔮 Roadmap

### Completed ✅ (v1.0)
- ✅ Full CRUD APIs for test cases, runs, plans
- ✅ PostgreSQL database with migrations
- ✅ Ollama integration with model routing
- ✅ AI generation tracking for fine-tuning
- ✅ Requirements tracking from Jira
- ✅ Test run execution and storage
- ✅ Prompt template management
- ✅ Orchestrator service
- ✅ Run Matrix system
- ✅ Object Store (S3/MinIO)
- ✅ Self-healing service
- ✅ Q-Index quality scoring
- ✅ k6 and ZAP executors

### In Progress 🚧 (v2.0 - Multi-Agent Architecture)
- [ ] **Model Gateway** - Unified LLM access (Qwen 30B + cloud)
- [ ] **Agent Orchestrator Enhancement** - Standard agent interface
- [ ] **Multi-Tenant Data Model** - Full tenant isolation
- [ ] **Requirements Intelligence Agent** - Jira/Confluence connectors + RAG
- [ ] **Automation Agent Enhancement** - DOM recorder + self-healing
- [ ] **Test Runner Service** - Docker-based workers
- [ ] **Performance Testing Agent** - Metrics store + SLA tracking
- [ ] **Accessibility Agent** - WCAG compliance + reports
- [ ] **Security Agent** - Intelligent triage + SAST
- [ ] **Plugin API** - IDE/browser extensions
- [ ] **On-Prem Packaging** - Docker/Helm deployment
- [ ] **Observability & RBAC** - Logging, metrics, access control

**📖 See [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) for detailed timeline.**

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **FastAPI** - Modern Python web framework
- **React** - Frontend framework
- **PostgreSQL** - Robust database
- **Ollama** - Local LLM serving
- **Qwen** - AI models
- **shadcn/ui** - Beautiful UI components

---

## 📞 Support

- Create an issue in the repository
- Check documentation in `/docs`
- Review API docs at `/docs` endpoint

---

**Built with ❤️ for the QA community**
