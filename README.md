# QAAI/ArisTrace - Enterprise AI-Powered QA Platform

<p align="center">
  <img src="public/aristrace-logo.svg" alt="QAAI Logo" width="200">
</p>

<p align="center">
  <strong>The Most Comprehensive AI-Powered Test Automation Platform</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#modules">Modules</a>
</p>

---

## 🚀 Platform Highlights

| Metric | Value |
|--------|-------|
| **Frontend Pages** | 60+ |
| **Backend APIs** | 50+ routers |
| **Services** | 165+ |
| **Enterprise Apps** | 25+ supported |
| **API Protocols** | 8 (REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WS, AMQP) |
| **Load Patterns** | 8 types |
| **Visual Modes** | 5 comparison algorithms |

---

## ✨ Features

### 🎬 Test Recording & Automation
| Feature | Description |
|---------|-------------|
| **Visual Recording** | Browser extension captures interactions, generates Playwright scripts |
| **Self-Healing Tests** | Automatically fix broken selectors during execution |
| **Multi-Framework Export** | Playwright (Python/TS), Selenium, Cypress support |
| **Enterprise App Support** | Smart selectors for Salesforce, ServiceNow, Workday, SAP, etc. |

### 🤖 AI-Powered Testing
| Feature | Description |
|---------|-------------|
| **AI Test Generation** | Generate tests from requirements using Claude/Ollama/OpenAI |
| **Intelligent Self-Healing** | AI-based selector repair with 5 fallback strategies |
| **AI Agents** | Specialized agents for test design, defect triage, accessibility |
| **LLM Cost Optimization** | Multi-tier caching achieves 90%+ cache hit rate |

### 🌐 API Testing (Enterprise-Grade)
| Protocol | Support |
|----------|---------|
| REST | Full (GET, POST, PUT, DELETE, PATCH) |
| SOAP | Full (WSDL import, envelope generation) |
| GraphQL | Full (queries, mutations, subscriptions) |
| gRPC | Full (protobuf, streaming) |
| Kafka | Full (producer/consumer) |
| MQTT | Full (pub/sub) |
| WebSocket | Full (bi-directional) |
| AMQP | Full (RabbitMQ compatible) |

### ⚡ Performance Testing
| Pattern | Description |
|---------|-------------|
| Constant | Steady-state baseline |
| Ramp Up/Down | Gradual load changes |
| Spike | Sudden traffic burst |
| Stress | Beyond-capacity testing |
| Soak | Memory leak detection |
| Breakpoint | Find system limits |
| Wave | Cyclic load patterns |

### ♿ Accessibility & Compliance
- **WCAG 2.0/2.1** (A, AA, AAA levels)
- **Section 508** compliance
- **VPAT generation**
- **Site-wide audits**

### 👁️ Visual Regression Testing
- **5 comparison modes**: Pixel-perfect, Anti-aliased, Perceptual, Structural, Layout
- **Baseline management**
- **Ignore regions**
- **Diff visualization**

### 🔒 Security Testing
- **OWASP API Top 10** scanning
- BOLA, broken auth, SSRF detection
- Security misconfiguration checks

### 🌩️ Salesforce Testing (15+ Tools)
- Multi-org manager
- SOQL builder
- Apex test runner
- Test data factory
- Debug log analyzer
- Schema browser

---

## 🏁 Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.10+
- **Chrome** browser

### 1. Start Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Frontend

```bash
npm install
npm run dev
```

### 3. Access Application

- **Frontend**: http://localhost:8080
- **API Docs**: http://localhost:8000/docs

### 4. Install Browser Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `flowstral-extension` folder
5. Pin to toolbar

### 5. Configure AI (Optional)

```bash
# backend/.env

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Local Ollama
OLLAMA_URL=http://localhost:11434
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DOCUMENTATION.md](DOCUMENTATION.md) | Complete platform documentation |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture & design |
| [docs/BACKEND_REFERENCE.md](docs/BACKEND_REFERENCE.md) | API endpoints & services |
| [docs/FRONTEND_REFERENCE.md](docs/FRONTEND_REFERENCE.md) | Pages, components, hooks |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | Complete user guide |
| [docs/SALESFORCE_TESTING_GUIDE.md](docs/SALESFORCE_TESTING_GUIDE.md) | Salesforce testing |
| [docs/API_AND_PERFORMANCE_TESTING_GUIDE.md](docs/API_AND_PERFORMANCE_TESTING_GUIDE.md) | API & load testing |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QAAI/ArisTrace Platform                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   React Frontend │────▶│  FastAPI Backend │────▶│   PostgreSQL/    │    │
│  │   (TypeScript)   │◀────│    (Python)      │◀────│   SQLite DB      │    │
│  │   60+ Pages      │     │   50+ Routers    │     │                  │    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│          │                        │                                         │
│          │                        ├─────────────────────────────────────┐   │
│          ▼                        ▼                                     ▼   │
│  ┌──────────────────┐    ┌──────────────────┐             ┌─────────────┐  │
│  │ Flowstral Chrome │    │   LLM Services   │             │ Test Runners │  │
│  │    Extension     │    │ Claude/Ollama    │             │ Playwright   │  │
│  └──────────────────┘    └──────────────────┘             │ K6/ZAP       │  │
│                                                            └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Modules

### Core Modules

| Module | Path | Description |
|--------|------|-------------|
| **Recorder** | `/recorder` | Visual test recording |
| **Builder** | `/test-cases/builder` | No-code test creation |
| **Repository** | `/test-cases` | Test case management |
| **Execution** | `/test-runs` | Test run management |
| **API Testing** | `/api` | Multi-protocol API tests |
| **Performance** | `/performance` | Load & stress testing |
| **Salesforce** | `/salesforce` | SF-specific tools |

### Quality Modules

| Module | Path | Description |
|--------|------|-------------|
| **Accessibility** | `/accessibility` | WCAG scanning |
| **Visual Testing** | `/visual-testing` | Image comparison |
| **Self-Healing** | `/self-healing` | Selector repair |
| **Traceability** | `/traceability` | Coverage matrix |

### Management Modules

| Module | Path | Description |
|--------|------|-------------|
| **Dashboard** | `/dashboard` | Metrics overview |
| **Analytics** | `/analytics` | Trend analysis |
| **Requirements** | `/requirements` | Requirements CRUD |
| **Defects** | `/defects` | Bug tracking |
| **Integrations** | `/integrations` | CI/CD & tools |

---

## 🛠️ Project Structure

```
QAAI/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── main.py            # Application entry
│   │   ├── routers/           # 50+ API routers
│   │   ├── services/          # 165+ services
│   │   └── utils/             # Helpers
│   └── logs/                  # Application logs
│
├── src/                       # React TypeScript frontend
│   ├── pages/                 # 60+ pages
│   ├── components/            # 70+ components
│   ├── hooks/                 # Custom hooks
│   └── lib/                   # Services & utilities
│
├── flowstral-extension/       # Chrome recording extension
│   └── src/
│       ├── content/           # Page injection
│       ├── background/        # Service worker
│       └── sidepanel/         # Extension UI
│
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md
│   ├── BACKEND_REFERENCE.md
│   ├── FRONTEND_REFERENCE.md
│   └── USER_MANUAL.md
│
└── supabase/                  # Database migrations
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Backend (.env)
ANTHROPIC_API_KEY=sk-ant-...     # Claude API
OLLAMA_URL=http://localhost:11434 # Local Ollama
DATABASE_URL=postgresql://...     # PostgreSQL
SECRET_KEY=your-secret-key        # JWT signing

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

---

## 🧪 API Quick Reference

```bash
# Test Cases
GET    /test-cases           # List all
POST   /test-cases           # Create
GET    /test-cases/{id}      # Get one
PUT    /test-cases/{id}      # Update
DELETE /test-cases/{id}      # Delete

# Test Execution
POST   /api/playwright-recorder/execute  # Run test
WS     /test-runs/ws/{execution_id}      # Real-time updates

# API Testing
POST   /api/v2/testing/test-suite/generate  # Generate tests
POST   /api/v2/testing/execute              # Execute suite

# Performance
POST   /api/performance/scenarios           # Create scenario
POST   /api/performance/scenarios/{id}/run  # Run load test

# Accessibility
POST   /api/accessibility/scan              # WCAG scan
POST   /api/accessibility/vpat/generate     # Generate VPAT

# AI Generation
POST   /api/llm/generate-test              # AI test generation
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📜 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

- **Documentation**: `/docs` directory
- **API Reference**: http://localhost:8000/docs
- **Issues**: GitHub Issues

---

<p align="center">
  <strong>QAAI/ArisTrace - Enterprise QA Excellence</strong><br>
  <em>AI-Powered • Self-Healing • Multi-Protocol • Enterprise-Ready</em>
</p>

<p align="center">
  Made with ❤️ by the QAAI Team
</p>

---

*Last Updated: January 11, 2026*
