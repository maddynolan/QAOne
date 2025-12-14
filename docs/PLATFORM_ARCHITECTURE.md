# QAAI Platform Architecture

## 🎯 Platform Overview

QAAI is a comprehensive QA automation platform that combines multiple testing approaches:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QAAI PLATFORM                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    WORKFLOW EDITOR (Central Hub)                     │    │
│  │  • Visual test builder                                               │    │
│  │  • Variables & Data-driven testing                                   │    │
│  │  • API & Database nodes                                              │    │
│  │  • Test Suite management                                             │    │
│  │  • Scheduling & CI/CD export                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│           ▲                    ▲                    ▲                        │
│           │                    │                    │                        │
│      ┌────┴────┐         ┌────┴────┐         ┌────┴────┐                    │
│      │  TRACE  │         │  BLAZE  │         │EXPLORATION│                  │
│      │Recording│         │Auto AI  │         │  Crawl   │                   │
│      └─────────┘         └─────────┘         └──────────┘                   │
│           │                    │                    │                        │
│           │                    ▼                    │                        │
│           │            ┌──────────────┐             │                        │
│           └───────────►│   ELEMENTS   │◄────────────┘                        │
│                        │ Repository   │                                      │
│                        └──────────────┘                                      │
│                               │                                              │
│                ┌──────────────┼──────────────┐                               │
│                ▼              ▼              ▼                               │
│          ┌─────────┐   ┌──────────┐   ┌──────────┐                          │
│          │  APEX   │   │PERFORMANCE│   │   CI/CD  │                         │
│          │  API    │   │   Load   │   │ Pipelines│                          │
│          └─────────┘   └──────────┘   └──────────┘                          │
│                               │                                              │
│                        ┌──────┴──────┐                                       │
│                        │  ANALYTICS  │                                       │
│                        │  Reports    │                                       │
│                        └─────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Tab Descriptions & Purposes

### 1. **Dashboard** (`/`)
- Overview metrics
- Quick access to recent tests
- Health indicators

### 2. **Analytics** (`/analytics`)
- Test execution trends
- Flaky test detection
- Self-healing statistics
- Performance metrics

### 3. **Workflow Editor** (`/workflow-editor`) ⭐ NEW
The central hub for building and managing tests:
- **Visual Builder**: Drag-drop nodes to create tests
- **Variables**: Store and reuse values across tests
- **Data-Driven**: Import CSV/JSON for multiple test iterations
- **API Nodes**: Make HTTP requests with validation
- **Database Nodes**: SQL/SOQL assertions
- **Test Suites**: Group workflows for organized execution
- **Environments**: Dev/QA/Staging/Prod configurations
- **Scheduling**: Cron-based test scheduling
- **CI/CD Export**: Generate GitHub Actions, GitLab CI, Jenkins, Azure Pipelines configs

### 4. **Elements** (`/elements`)
Centralized element repository (like Tosca):
- Store locators with fallback strategies
- Track element usage & success rates
- Self-healing locator suggestions
- Import from recordings

### 5. **Trace (Flowstral)** (`/flowstral`)
Session recording and analysis:
- Chrome extension for recording
- Action graph visualization
- Script generation (multi-framework)
- Export to Workflow Editor

### 6. **Blaze (Nexus)** (`/nexus`)
**Autonomous AI Testing** - the differentiator:
- Zero-input defect discovery
- Risk-based exploration
- AI-driven bug hunting
- Red team mode
- **Use Case**: "Find bugs I don't know about"

### 7. **Exploration** (`/exploration`)
Website crawling and capability mapping:
- Discover all pages/routes
- Build capability maps
- Generate test suggestions
- Detect defects during exploration
- **Use Case**: "Map out what's testable"

### 8. **Apex** (`/enhanced-api-testing`)
API Testing hub:
- OpenAPI/Swagger import
- SOAP/GraphQL support
- Database connections
- Virtual services/mocking
- Environment management

### 9. **Performance** (`/performance`)
Load and stress testing:
- Virtual user simulation
- Response time metrics
- Throughput analysis
- Templates (spike, stress, endurance)

---

## 🔄 How Components Connect

### Recording → Workflow Flow
```
1. User records in Trace (Chrome Extension)
2. Actions saved to backend
3. Click "Open in Workflow Editor"
4. Workflow Editor imports actions as nodes
5. User enhances with variables, assertions
6. Export to Playwright/Selenium/etc.
7. Save as Test Suite
8. Schedule for recurring execution
9. Export CI/CD pipeline config
```

### Blaze → Defects → Test Cases Flow
```
1. Blaze runs autonomous exploration
2. Discovers defects with screenshots
3. Defects saved to Defects page
4. User reviews and categorizes
5. Click "Create Test for Defect"
6. Opens in Workflow Editor
7. Saves as regression test
```

### Exploration → Capabilities → Tests Flow
```
1. Exploration crawls website
2. Builds capability map (entities, operations)
3. Generates test suggestions
4. User selects tests to create
5. Opens in Workflow Editor
6. Adds to Test Suite
```

### Elements → Workflow Flow
```
1. Elements captured during recording
2. Stored in Element Repository
3. Workflow Editor can "Import Element"
4. Uses Element Repository locators
5. Self-healing updates repository
```

---

## 🆚 Blaze vs Exploration

| Feature | Blaze | Exploration |
|---------|-------|-------------|
| **Purpose** | Find unknown defects | Map testable capabilities |
| **Input Required** | Just URL | URL + config |
| **Output** | Defects with proof | Capability map + suggested tests |
| **AI Usage** | Heavy (autonomous) | Moderate (analysis) |
| **Best For** | Security, edge cases | Coverage analysis |
| **When to Use** | "Find bugs for me" | "What can I test?" |

---

## 🏗️ New Workflow Editor Features

### Node Types (Phase 1-3)

#### Basic Actions
- `navigate` - Go to URL
- `click` - Click element
- `input` - Enter text
- `wait` - Wait time
- `assert` - Verify element

#### API & Data
- `api_request` - HTTP request (GET/POST/PUT/DELETE)
- `database_query` - SQL/SOQL query
- `set_variable` - Store value

#### Control Flow
- `condition` - If/Else branching
- `loop` - Fixed count loop
- `loop_data` - For-each over data
- `try_catch` - Error handling
- `wait_condition` - Wait until condition

#### Visual
- `screenshot` - Capture screen
- `visual_compare` - Compare to baseline

#### Advanced
- `import_element` - Use from Element Repository
- `call_workflow` - Run sub-workflow

### Test Suite Management
- Group workflows by purpose (smoke, regression, etc.)
- Enable/disable individual workflows
- Set execution order (sequential/parallel)
- Stop on failure option

### Environment Configuration
- Development, QA, Staging, Production
- Base URL per environment
- Environment variables
- Secrets management

### Scheduling
- Cron expressions
- Fixed intervals
- One-time runs
- Failure notifications

### CI/CD Export
- GitHub Actions
- GitLab CI
- Jenkins
- Azure Pipelines
- Bitbucket Pipelines

---

## 📁 File Structure

```
src/
├── components/
│   └── FlowstralWorkflowEditor/
│       ├── FlowstralWorkflowEditor.tsx  # Main editor
│       ├── WorkflowNodes.tsx            # Node type definitions
│       ├── TestSuiteManager.tsx         # Suite management
│       ├── VariableStore.tsx            # Variables & data
│       ├── ScheduleManager.tsx          # Scheduling
│       ├── CICDExporter.tsx             # CI/CD generation
│       ├── LocatorBuilder.tsx           # Selector builder
│       ├── TestRunner.tsx               # Test execution
│       └── index.ts                     # Exports
├── pages/
│   ├── EnhancedWorkflowEditor.tsx       # Enhanced editor page
│   ├── Analytics.tsx                    # Test analytics
│   ├── ElementRepository.tsx            # Element storage
│   ├── Exploration.tsx                  # Website crawling
│   ├── Nexus.tsx                        # Blaze (AI testing)
│   ├── Performance.tsx                  # Load testing
│   └── EnhancedAPITesting.tsx           # API testing
└── ...
```

---

## 🚀 Future Enhancements

1. **AI Test Generation** - Generate tests from requirements
2. **Visual Regression Dashboard** - Compare screenshots over time
3. **Mobile Testing** - Appium integration
4. **Performance Correlation** - Link perf metrics to tests
5. **Test Impact Analysis** - Identify tests affected by code changes
6. **Collaborative Editing** - Real-time workflow collaboration
7. **Version Control** - Track workflow changes
8. **Test Templates** - Pre-built workflows for common scenarios

