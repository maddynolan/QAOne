# QA AI Platform

A comprehensive hybrid AI-powered Quality Assurance platform for automated test generation, execution, and analysis.

## 🚀 Features

### Core Functionality
- **AI-Powered Test Generation**: Generate comprehensive test plans from API specifications
- **Multi-Framework Support**: Execute tests using Postman (API) and Playwright (UI/E2E)
- **Intelligent Triage**: AI-powered failure analysis and root cause identification
- **Automated Patching**: Generate fixes for failing tests
- **Real-time Monitoring**: Live test execution with detailed reporting

### Technical Stack
- **Backend**: FastAPI with Python 3.9+
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Database**: PostgreSQL with pgvector for embeddings
- **Caching**: Redis for performance optimization
- **Task Queue**: Celery for asynchronous job processing
- **Containerization**: Docker & Docker Compose

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Task Queue     │              │
         └──────────────►│   (Celery)      │◄─────────────┘
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Cache Layer   │
                        │   (Redis)       │
                        └─────────────────┘
```

## 🛠️ Installation & Setup

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd qa-ai-platform
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Local Development Setup

1. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up postgres redis -d
   
   # Run migrations (when available)
   alembic upgrade head
   ```

## 📁 Project Structure

```
qa-ai-platform/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── core/           # Configuration and settings
│   │   ├── models/         # Database models and schemas
│   │   ├── services/       # Business logic services
│   │   ├── runners/        # Test execution runners
│   │   ├── tasks.py        # Celery tasks
│   │   └── main.py         # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile         # Backend container
├── frontend/               # Next.js frontend
│   ├── components/        # React components
│   ├── pages/             # Next.js pages
│   ├── styles/            # CSS and styling
│   ├── package.json       # Node.js dependencies
│   └── Dockerfile         # Frontend container
├── docker-compose.yml     # Multi-service orchestration
├── .github/               # CI/CD workflows
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/qa_ai_platform
POSTGRES_USER=qa_user
POSTGRES_PASSWORD=qa_password
POSTGRES_DB=qa_ai_platform

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# API Configuration
API_V1_STR=/api/v1
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# LLM Configuration
OPENAI_API_KEY=your-openai-api-key
LLM_MODEL=gpt-4
LLM_TEMPERATURE=0.7

# Test Execution
POSTMAN_COLLECTION_PATH=/path/to/collections
PLAYWRIGHT_CONFIG_PATH=/path/to/playwright.config.js
```

## 🚀 Usage

### Creating Test Plans

1. Navigate to the Dashboard
2. Click "Create Test Plan"
3. Fill in the plan details:
   - Plan name and description
   - Test types (API, UI, Performance, Accessibility)
   - Priority level
   - Source specification (OpenAPI, user stories, etc.)
4. Submit to generate AI-powered test cases

### Running Tests

1. Go to the "Runs" section
2. Select a test suite
3. Configure execution parameters
4. Monitor real-time progress
5. Review detailed results and reports

### Analyzing Results

1. View comprehensive reports in the "Reports" section
2. Analyze failure patterns and trends
3. Review AI-generated triage suggestions
4. Apply automated patches for failing tests

## 🔄 CI/CD Integration

The platform includes GitHub Actions workflows for:

- **Continuous Integration**: Automated testing on pull requests
- **End-to-End Testing**: Comprehensive test suite execution
- **Deployment**: Automated deployment to staging/production

### Workflow Files
- `.github/workflows/ci-cd.yml` - Main CI/CD pipeline
- `.github/workflows/e2e-test.yml` - End-to-end testing

## 🧪 Testing

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

### Test Coverage

```bash
# Backend coverage
cd backend
pytest --cov=app

# Frontend coverage
cd frontend
npm run test:coverage
```

## 📊 Monitoring & Observability

- **Health Checks**: Built-in health monitoring endpoints
- **Metrics**: Prometheus-compatible metrics
- **Tracing**: OpenTelemetry integration for distributed tracing
- **Logging**: Structured logging with correlation IDs

## 🔒 Security

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting and throttling
- **Secrets Management**: Secure environment variable handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow PEP 8 for Python code
- Use TypeScript for frontend development
- Write comprehensive tests for new features
- Update documentation for API changes
- Follow conventional commit messages

## 📝 API Documentation

### Core Endpoints

- `GET /health` - Health check
- `GET /api/v1/plans` - List test plans
- `POST /api/v1/plans` - Create test plan
- `GET /api/v1/suites` - List test suites
- `POST /api/v1/runs` - Execute test run
- `GET /api/v1/reports` - Get test reports

### Interactive Documentation

Visit http://localhost:8000/docs for interactive API documentation with Swagger UI.

## 🐛 Troubleshooting

### Common Issues

1. **Port Conflicts**
   - Ensure ports 3000, 8000, 5432, and 6379 are available
   - Modify `docker-compose.yml` if needed

2. **Database Connection Issues**
   - Check PostgreSQL service status
   - Verify connection string in `.env`

3. **Redis Connection Issues**
   - Ensure Redis is running
   - Check Redis URL configuration

4. **Frontend Build Issues**
   - Clear `node_modules` and reinstall
   - Check Node.js version compatibility

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
docker-compose up
```

## 📈 Performance

### Optimization Features

- **Caching**: Redis-based caching for LLM responses and test results
- **Async Processing**: Celery-based task queue for non-blocking operations
- **Database Indexing**: Optimized database queries with proper indexing
- **CDN Integration**: Static asset optimization
- **Connection Pooling**: Database connection pooling for better performance

## 🔮 Roadmap

### Upcoming Features

- [ ] **Multi-tenant Support**: Organization and team management
- [ ] **Advanced Analytics**: Machine learning-based insights
- [ ] **Integration Hub**: Third-party tool integrations
- [ ] **Mobile App**: React Native mobile application
- [ ] **Advanced Reporting**: Custom dashboard creation
- [ ] **Test Data Management**: Synthetic data generation
- [ ] **Performance Testing**: Load testing capabilities

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FastAPI team for the excellent web framework
- Next.js team for the React framework
- PostgreSQL and Redis communities
- All open-source contributors

## 📞 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation at `/docs`
- Review the troubleshooting section above

---

**Built with ❤️ for the QA community**