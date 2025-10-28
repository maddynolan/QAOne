# QA AI Platform - Development Setup Guide

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Git

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd qa-ai-platform
cp env.example .env
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready
docker-compose ps
```

### 3. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Newman and Playwright
npm install -g newman playwright
playwright install --with-deps

# Run database migrations
psql -h localhost -U qaai -d qaai -f sql/init.sql

# Start backend server
uvicorn app.main:app --reload
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 5. Verify Installation

- Backend API: http://localhost:8000/health
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## Project Structure

```
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API endpoints
│   │   ├── core/           # Core configuration
│   │   ├── models/         # Pydantic schemas & SQLAlchemy models
│   │   ├── services/       # Business logic
│   │   └── runners/        # Test execution engines
│   ├── sql/                # Database initialization
│   └── requirements.txt
├── frontend/               # Next.js application
│   ├── pages/              # Web portal pages
│   ├── components/         # React components
│   └── lib/                # Utilities
├── .github/workflows/      # CI/CD pipelines
└── docker-compose.yml      # Development environment
```

## API Endpoints

### Core Workflow
1. `POST /generate_test_plan` - Create test plan from specification
2. `POST /create_tests` - Generate test artifacts (Postman/Playwright)
3. `POST /run_tests` - Execute test suites
4. `POST /triage_failures` - Analyze failures and suggest fixes
5. `POST /update_tests` - Generate patches for test updates
6. `GET /reports` - Retrieve test reports and metrics

### Management
- `GET /plans` - List test plans
- `GET /suites` - List test suites
- `GET /runs` - List test runs
- `GET /triage/{run_id}` - Get triage results

## Development Workflow

### 1. Create Test Plan
```bash
curl -X POST http://localhost:8000/generate_test_plan \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce API Tests",
    "description": "Test plan for e-commerce API",
    "source": "OpenAPI specification content...",
    "targets": {"endpoints": ["/products", "/orders"]},
    "api_ui": {"api": true, "ui": false},
    "priority": 1
  }'
```

### 2. Create Test Suite
```bash
curl -X POST http://localhost:8000/create_tests \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan-123",
    "name": "API Test Suite",
    "test_type": "postman",
    "artifacts": [{"type": "postman", "path": "collection.json"}]
  }'
```

### 3. Run Tests
```bash
curl -X POST http://localhost:8000/run_tests \
  -H "Content-Type: application/json" \
  -d '{
    "suite_id": "suite-456",
    "name": "Test Run"
  }'
```

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v --cov=app
```

### Frontend Tests
```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

### Integration Tests
```bash
# Start services
docker-compose up -d

# Run integration tests
python backend/tests/integration/test_api_flow.py
```

## GitHub Actions

The project includes comprehensive CI/CD workflows:

- **CI/CD Pipeline** (`.github/workflows/ci-cd.yml`):
  - Backend tests with coverage
  - Frontend tests and build
  - Integration tests
  - Security scanning
  - Staging/production deployment

- **E2E Test** (`.github/workflows/e2e-test.yml`):
  - Complete workflow test: Plan → Create → Run → Triage → Update
  - Manual trigger with custom parameters

## Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` - OpenAI API key for LLM features
- `VLLM_BASE_URL` - vLLM server URL for local LLM
- `SECRET_KEY` - JWT secret key
- `DEBUG` - Enable debug mode

### Database Schema
The platform uses PostgreSQL with the following main tables:
- `plans` - Test plans
- `suites` - Test suites
- `runs` - Test execution results
- `triage_results` - Failure analysis
- `patches` - Test update patches
- `events` - Audit trail
- `embeddings` - Vector storage for memory

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check connection
   psql -h localhost -U qaai -d qaai -c "SELECT 1;"
   ```

2. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :8000
   lsof -i :3000
   ```

3. **Node Modules Issues**
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Python Dependencies**
   ```bash
   cd backend
   pip install --upgrade pip
   pip install -r requirements.txt --force-reinstall
   ```

### Logs
- Backend logs: Check terminal running `uvicorn`
- Frontend logs: Check terminal running `npm run dev`
- Database logs: `docker-compose logs postgres`
- Redis logs: `docker-compose logs redis`

## Next Steps

1. **Week 1-2**: Complete MVP with basic endpoints and web portal
2. **Week 3-4**: Integrate vLLM with Llama-2 models
3. **Week 5-6**: Add auto-update and Jira integration
4. **Week 7-8**: Implement self-healing and reporting
5. **Week 9-10**: Add enterprise features and security
6. **Week 11-12**: Complete migration toolkit and performance testing

## Support

For issues and questions:
- Check the logs first
- Review the API documentation at `/docs`
- Test individual endpoints with curl/Postman
- Run the E2E test workflow for complete validation
