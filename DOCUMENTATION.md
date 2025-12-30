# ArisTrace Platform Documentation

> **Living Document** - Last Updated: December 12, 2024
> 
> This document is continuously updated as features are added or modified.

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Core Workflow](#core-workflow)
5. [Features](#features)
   - [Trace (Record)](#trace-record)
   - [Workflow Editor](#workflow-editor)
   - [Test Cases](#test-cases)
   - [Requirements](#requirements)
   - [Test Execution (Releases, Plans, Runs)](#test-execution)
   - [Test Case Executor](#test-case-executor)
   - [Traceability](#traceability)
   - [Defects](#defects)
   - [Performance & Load Testing](#performance--load-testing)
   - [API Testing (APEX)](#api-testing-apex)
   - [Blaze (Exploration)](#blaze-exploration)
   - [Project Management](#project-management)
   - [Settings & Data Management](#settings--data-management)
6. [Data Models](#data-models)
7. [API Reference](#api-reference)
8. [Browser Extension](#browser-extension)
9. [PDF Verification](#pdf-verification)
10. [Configuration](#configuration)
11. [Troubleshooting](#troubleshooting)

---

## Platform Overview

ArisTrace is a comprehensive QA platform that combines:
- **Recording-based test creation** via browser extension
- **Visual workflow editing** for test flows
- **Complete test execution** with step-by-step executor
- **Performance & load testing** with virtual users
- **Full traceability** from requirements to defects
- **Project management** with Jira-like capabilities

### Key Differentiators

| Feature | ArisTrace | Traditional Tools |
|---------|-----------|-------------------|
| Recording → Test Case | Automatic approval workflow | Manual copy/paste |
| Test Execution | Step-by-step with evidence capture | Pass/Fail only |
| Load Testing | Import from Test Cases library | Separate scripts |
| Traceability | Built-in matrix with gap analysis | External plugins |
| Defect Linking | Link at step level | Test level only |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                         │
│                              Port: 5173 (dev) / 8080 (prod)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/                                                                        │
│  ├── components/          # Reusable UI components                          │
│  │   ├── AppSidebar.tsx   # Navigation sidebar                              │
│  │   ├── FlowstralWorkflowEditor/  # Visual workflow editor                 │
│  │   └── ui/              # shadcn/ui components                            │
│  ├── pages/               # Route components                                │
│  │   ├── Flowstral.tsx    # Trace (Record) page                             │
│  │   ├── TestExecution.tsx # Releases, Plans management                     │
│  │   ├── TestCaseExecutor.tsx # Step-by-step test execution                 │
│  │   ├── TestPlanDetail.tsx # Test plan details & execution                 │
│  │   ├── Traceability.tsx # Traceability matrix                             │
│  │   ├── CreateTestCase.tsx # Test case creation                            │
│  │   ├── CreateRequirement.tsx # Requirement creation                       │
│  │   ├── CreateDefect.tsx # Defect creation                                 │
│  │   └── Settings.tsx     # Settings & data management                      │
│  └── lib/                 # Services and utilities                          │
│      ├── data-storage.ts  # Data models & storage                           │
│      └── test-management-service.ts  # Test management API                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (FastAPI + Python)                      │
│                              Port: 8000                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  backend/app/                                                                │
│  ├── routers/             # API endpoints                                   │
│  │   ├── playwright_recorder_api.py  # Recording & script generation        │
│  │   ├── requirements_api.py         # Requirements CRUD                    │
│  │   ├── defects_api.py              # Defects CRUD                         │
│  │   ├── test_case_api.py            # Test case CRUD                       │
│  │   ├── traceability_api.py         # Traceability matrix                  │
│  │   ├── sample_data_api.py          # Sample data loading                  │
│  │   └── ...                                                                │
│  └── services/            # Business logic                                  │
│      ├── flowstral/       # Recording processing                            │
│      └── llm/             # AI services (Ollama)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER EXTENSION                                  │
│                           flowstral-extension/                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  src/                                                                        │
│  ├── sidepanel/           # Extension UI                                    │
│  │   ├── sidepanel.html   # Side panel HTML (Base URL + controls)           │
│  │   └── sidepanel.js     # Side panel logic                                │
│  ├── content/             # Page injection scripts                          │
│  │   └── content.js       # Captures user interactions                      │
│  └── background/          # Service worker                                  │
│      └── background.js    # Backend communication, saves sessions           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- Chrome/Edge browser (for extension)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd QAAI

# Install frontend
npm install

# Install backend
cd backend
pip install -r requirements.txt

# Start services
npm run dev          # Frontend on :5173 or :8080
uvicorn app.main:app --reload --port 8000  # Backend
```

### Load Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `flowstral-extension` folder

---

## Core Workflow

### Test Management Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE TEST LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REQUIREMENTS ──────► TEST CASES ──────► TEST PLANS ──────► TEST RUNS       │
│       │                    │                  │                  │           │
│       │                    │                  │                  │           │
│       └────────────────────┴──────────────────┴──────────────────┴───────┐  │
│                                                                          │  │
│                              DEFECTS ◄───────────────────────────────────┘  │
│                                  │                                          │
│                                  └──► Linked to Requirements                │
│                                                                              │
│                           TRACEABILITY MATRIX                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recording to Test Case Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECORDING → TEST CASE WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. RECORD                    2. REVIEW                   3. APPROVE        │
│  ┌─────────────┐             ┌─────────────┐             ┌─────────────┐    │
│  │ Extension   │────────────►│ Trace Page  │────────────►│ Test Case   │    │
│  │             │             │             │             │ Library     │    │
│  │ • Base URL  │             │ • View steps│             │             │    │
│  │ • Record    │             │ • Add asserts│            │ • Automated │    │
│  │ • Stop      │             │ • Edit flow │             │ • Manual    │    │
│  └─────────────┘             └─────────────┘             └─────────────┘    │
│                                                                │            │
│                                                                ▼            │
│  4. EXECUTE                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │  Test Plans    │    Test Runs    │    Load Testing    │    CI/CD   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Test Execution Hierarchy

```
Release (Test Cycle)           e.g., "December 2024 Release", "Sprint 24"
 │
 └── Test Plans                e.g., Smoke, Regression, Functional
      │
      └── Test Cases           Linked from test case library
           │
           └── Test Runs       Individual execution records
                │
                └── Defects    Created from failed steps (step-level linking)
```

### Recording Statuses

| Status | Description | Next Action |
|--------|-------------|-------------|
| 🟡 Draft | Just recorded | Review or Approve |
| 🔵 In Review | Being reviewed | Edit Flow or Approve |
| 🟢 Approved | Ready for use | Linked to Test Case |
| 🔴 Rejected | Needs re-recording | Delete or Re-record |

---

## Features

### Trace (Record)

**Path:** `/flowstral`

The main recording interface showing all recorded sessions from the browser extension.

#### Recording a Test

1. **Open Extension** - Click extension icon, opens side panel
2. **Set Base URL** - Enter the starting URL for your test (e.g., `http://localhost:3000`)
3. **Start Recording** - Click "Start Recording"
4. **Perform Actions** - Navigate, click, type on the page
5. **Stop Recording** - Click "Stop & Save"
6. **View in Trace** - Recording appears in Trace page (auto-refreshes every 5 seconds)

#### Session Actions

| Action | Description |
|--------|-------------|
| 👁 View | See recording details and steps |
| ⚡ Edit Flow | Open in Workflow Editor for visual editing |
| ✅ Approve → Test Case | Create test case from recording |
| ❌ Reject | Mark as rejected |

#### Quick Assertions

Add assertions directly in session details:
- Text is visible on page
- Element is visible
- URL contains
- Page title equals

---

### Workflow Editor

**Path:** `/flowstral/workflow-editor?sessionId=xxx` or `/flowstral/workflow-editor?import=trace`

Visual editor for test flows with drag-and-drop capabilities.

#### Features

- **Drag & drop** step reordering
- **Add/edit/delete** steps
- **Add assertion** nodes
- **Visual flow** diagram
- **Export** to Playwright code
- **Auto-load** from URL parameters (sessionId or import source)

#### Loading Workflows

| Source | URL Parameter | Description |
|--------|---------------|-------------|
| Direct session | `?sessionId=xxx` | Load by session ID |
| From Trace page | `?import=trace` | Load from localStorage |
| From Extension | `?import=extension` | Load pending import |

---

### Test Cases

**Path:** `/cases`

Central library of all test cases (manual and automated).

#### Creating Test Cases

**Path:** `/cases/new`

Modern interface with:
- **Templates** (Login Flow, CRUD Operations, E2E Flow, API Testing)
- **Drag-and-drop** step reordering
- **Import steps** from previous test cases
- **Flowstral integration** for automated tests
- **Requirement linking** for traceability

#### Test Case Fields

```typescript
interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automated';
  category: 'functional' | 'regression' | 'smoke' | 'e2e' | 'integration' | 'api';
  status: 'draft' | 'active' | 'deprecated';
  priority: 'low' | 'medium' | 'high' | 'critical';
  steps: Array<{
    stepNumber: number;
    action: string;
    testData?: string;
    expectedResult: string;
  }>;
  preconditions: string[];
  expectedResult: string;
  linkedRequirements: string[];  // REQ IDs for traceability
  tags: string[];
  automationScript?: string;    // Playwright code for automated tests
  source?: {
    type: 'manual' | 'flowstral' | 'import';
    recordingId?: string;
  };
}
```

---

### Requirements

**Path:** `/requirements`

#### Creating Requirements

**Path:** `/requirements/new`

Features:
- **Templates** (User Story, Functional, Non-Functional, Business Rule)
- **Acceptance Criteria** builder with "Given/When/Then" format
- **Traceability** links to test cases
- **Drag-and-drop** criteria reordering

#### Requirement Fields

```typescript
interface Requirement {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non_functional' | 'business' | 'technical';
  priority: 'must_have' | 'should_have' | 'could_have' | 'wont_have';
  status: 'draft' | 'approved' | 'implemented' | 'verified' | 'rejected';
  acceptanceCriteria: Array<{
    id: string;
    description: string;
    type: 'given' | 'when' | 'then';
  }>;
  linkedTestCases: string[];  // TC IDs
  tags: string[];
  source: 'jira' | 'manual' | 'import';
  source_ref?: string;        // External reference
}
```

---

### Test Execution

**Path:** `/execution`

Comprehensive test execution management following TestRail/Zephyr standards.

#### Tabs

| Tab | Purpose |
|-----|---------|
| **Releases** | Manage test cycles (versions, sprints) |
| **Test Plans** | Organize test cases by objective |
| **Execute** | View and run linked test cases |
| **Results** | View execution history |

#### Release (Test Cycle)

A release represents a version, sprint, or time-bounded testing period.

| Field | Description |
|-------|-------------|
| Name | e.g., "December 2024 Release", "Sprint 24", "v2.1.0" |
| Start/End Date | Testing period boundaries |
| Status | Planning → Active → Completed |
| Test Plans | Plans assigned to this release |

#### Test Plans

Group test cases by testing objective within a release.

| Plan Type | Purpose |
|-----------|---------|
| 🔥 Smoke | Critical path verification |
| 🔄 Regression | Ensure no breaking changes |
| ⚙️ Functional | Feature-specific testing |
| 🔗 Integration | System interaction testing |
| 🎯 E2E | Full user journey testing |

#### Test Plan Detail Page

**Path:** `/execution/plan/{planId}`

Features:
- **Overview stats** (total, passed, failed, pending)
- **Test case list** with multi-select
- **Import Test Cases** from library
- **Create New** test case
- **Execute Selected** (batch execution)
- **Individual Execute** buttons
- **Remove from Plan** (keeps test case in library)

---

### Test Case Executor

**Path:** `/execution/run/{testCaseId}?planId=xxx&releaseId=xxx`

Step-by-step test execution interface.

#### Features

| Feature | Description |
|---------|-------------|
| **Step-by-step execution** | Mark each step Pass/Fail/Blocked/Skipped |
| **Actual results** | Record what actually happened |
| **Notes** | Add observations per step |
| **Screenshot capture** | Capture evidence (via paste or upload) |
| **Defect linking** | Link existing defects or create new ones |
| **Multi-test queue** | Execute multiple tests in sequence |
| **Auto-populate defects** | Failed step details auto-fill defect form |

#### Execution Queue (Multi-test)

When executing multiple tests from a plan:
1. All selected tests appear in collapsible queue panel
2. Click any test to switch to it (progress is saved)
3. **Save & Exit** - Save current, return to plan
4. **Save & Next** - Save current, move to next in queue
5. **Complete All** - Mark remaining as completed/skipped

#### Defect Creation from Step

When creating a defect from a failed step:
- **Title** pre-filled: `[Test Name] Step X Failed`
- **Description** pre-filled with failure context
- **Steps to Reproduce** auto-populated with all test steps up to failure point
- **Linked automatically** to the test case and step

---

### Traceability

**Path:** `/traceability`

Full traceability matrix from requirements to defects.

#### Tabs

| Tab | Description |
|-----|-------------|
| **Overview** | Stats, coverage %, recent activity |
| **Matrix** | Requirement ↔ Test Case ↔ Test Run ↔ Defect links |
| **Gaps** | Missing test coverage, untested requirements |
| **Impact** | Change impact analysis |

#### Coverage Calculation

```
Requirement Coverage % = 
  (Requirements with at least 1 linked Test Case with at least 1 passed Test Run) 
  / (Total Requirements) × 100

Test Coverage Status:
- FULL: Has test cases, in plan, executed, passed
- PARTIAL: Has test cases but not executed or failed
- NONE: No test cases linked
```

#### Gap Analysis

Each requirement shows gaps:
- "No test cases linked"
- "Not in any test plan"
- "Not executed yet"
- "All test runs failed"

#### Navigation

All elements are clickable:
- Click requirement → `/requirements/{id}`
- Click test case → `/cases/{id}`
- Click defect → `/defects/{id}`
- Coverage stats → Filter matrix

---

### Defects

**Path:** `/defects`

Bug tracking with full traceability.

#### Creating Defects

**Path:** `/defects/new`

Features:
- **Templates** (Functional Bug, UI Issue, Performance, Security)
- **Steps to Reproduce** builder
- **Traceability** links to test cases, requirements
- **Priority/Severity** matrix
- **Attachments** support

#### Defect Fields

```typescript
interface Defect {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'trivial';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'deferred';
  stepsToReproduce: string[];
  expectedResult: string;
  actualResult: string;
  environment?: string;
  linkedTestCases: string[];
  linkedRequirements: string[];
  linkedTestSteps?: Array<{ testCaseId: string; stepNumber: number }>;
  assignee?: string;
  reporter: string;
  attachments?: string[];
  deferredToRelease?: string;  // For deferred defects
}
```

#### What Happens with Deferred Defects?

1. Defect marked as "Deferred" with target release
2. Original requirement shows "Known Issue" status
3. Defect auto-appears in next release's scope
4. Creates audit trail for postponement reason

---

### Performance & Load Testing

**Path:** `/load-testing`

Comprehensive performance testing with virtual users.

#### Quick Start Scenarios

| Scenario | Users | Duration | Purpose |
|----------|-------|----------|---------|
| 🚀 API Load Test | 50 | 60s | Normal load |
| ⚡ Spike Test | 200 | 120s | Sudden traffic |
| 🔥 Stress Test | 500 | 180s | Breaking point |
| ⏱️ Endurance Test | 30 | 600s | Memory leaks |
| 💨 Quick Smoke | 5 | 30s | Health check |

#### Importing Test Cases

1. Go to Load Testing → Import
2. Select **Test Cases** tab (supports multi-select!)
3. Check test cases to include
4. Click "Import X Test Cases"

#### Metrics Collected

- Response Time (avg, min, max, p50, p90, p95, p99)
- Throughput (requests/second)
- Error Rate
- Active Users
- Bytes Sent/Received
- Failed Requests (with details)

#### How It Works

- Uses browser-level simulation (like real users)
- Executes test steps with configurable delays
- Tracks response times and failures
- Supports ramp-up patterns (Linear, Step, Spike, Custom)

---

### API Testing (APEX)

**Path:** `/enhanced-api-testing`

Enterprise API testing capabilities.

#### Features

- OpenAPI/Swagger import
- Request builder (GET, POST, PUT, DELETE, PATCH)
- Environment variables
- Test chaining
- Response validation
- Mock services
- Import from Flowstral recordings

---

### Blaze (Exploration)

**Path:** `/nexus`

Autonomous exploratory testing.

#### How It Works

1. Enter target URL
2. Configure exploration depth
3. Start exploration
4. AI navigates and discovers bugs
5. Review findings

---

### Project Management

**Path:** `/project-management`

Jira-like project management with drag-and-drop.

#### Tabs

| Tab | Purpose |
|-----|---------|
| **Issues** | Bugs, tasks, stories |
| **Board** | Kanban view (drag-and-drop) |
| **Requirements** | Quick requirement management |
| **Gherkin** | BDD test generation with templates |

#### Gherkin Templates

| Template | Description |
|----------|-------------|
| Login Flow | Authentication scenarios |
| CRUD Operations | Create, Read, Update, Delete |
| E2E Flow | End-to-end user journey |
| API Testing | API endpoint scenarios |
| Error Handling | Error and edge cases |

#### Quick Actions

- **New Requirement** → `/requirements/new`
- **New Test Case** → `/cases/new`
- **New Defect** → `/defects/new`

---

### Settings & Data Management

**Path:** `/settings`

Configuration and data management.

#### Data Management Section

| Action | Description |
|--------|-------------|
| **Clear All Data** | Removes all localStorage and sessionStorage data |
| **View Counts** | Shows stored items (Releases, Plans, Runs, Cases, Requirements, Defects) |

#### When to Use Clear All Data

- Testing fresh scenarios
- Resetting after development
- Clearing cached/stale data
- Troubleshooting data issues

---

## Data Models

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA STORAGE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Backend API (Primary)          localStorage (Fallback/Offline)    │
│  ├── In-memory stores           ├── releases                       │
│  │   ├── _requirements_store    ├── test_plans                     │
│  │   ├── _test_cases_store      ├── test_runs                      │
│  │   ├── _defects_store         ├── test_cases                     │
│  │   └── _sessions (recordings) ├── requirements                   │
│  └── SQLite (optional)          ├── defects                        │
│                                 └── execution_queue                │
│                                                                     │
│  Merged on Load: API + localStorage → Deduplicated → Display       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recording Session

```typescript
interface RecordingSession {
  session_id: string;
  name: string;
  initial_url: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected';
  actions: RecordingAction[];
  action_graph?: {
    nodes: Node[];
    edges: Edge[];
  };
  script?: string;           // Generated Playwright code
  start_timestamp: string;
  created_at: string;
  metadata: {
    baseUrl?: string;
    browser?: string;
  };
}
```

### Test Plan

```typescript
interface TestPlan {
  id: string;
  name: string;
  description: string;
  type: 'smoke' | 'regression' | 'functional' | 'integration' | 'e2e';
  status: 'draft' | 'active' | 'completed' | 'archived';
  releaseId: string;
  testCaseIds: string[];
  environment: string;
}
```

### Test Run

```typescript
interface TestRun {
  id: string;
  testCaseId: string;
  testPlanId: string;
  releaseId: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'blocked' | 'skipped';
  executedBy: string;
  executedAt: string;
  duration?: number;
  stepResults: Array<{
    stepNumber: number;
    status: 'passed' | 'failed' | 'blocked' | 'skipped';
    actualResult?: string;
    notes?: string;
    defectIds?: string[];
    attachments?: string[];
  }>;
}
```

---

## API Reference

### Base URL

```
http://localhost:8000
```

### Recording Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flowstral/sessions` | List all recordings |
| POST | `/api/flowstral/save-session` | Save new recording |
| GET | `/api/flowstral/session/{id}/status` | Get recording status |
| PATCH | `/api/flowstral/session/{id}/status` | Update status |
| DELETE | `/api/flowstral/session/{id}` | Delete recording |
| GET | `/api/flowstral/session/{id}/artifacts` | Get generated artifacts & action_graph |

### Test Case Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/test-cases` | List test cases |
| POST | `/test-cases` | Create test case |
| GET | `/test-cases/{id}` | Get test case |
| PUT | `/test-cases/{id}` | Update test case |
| DELETE | `/test-cases/{id}` | Delete test case |

### Requirement Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/requirements` | List requirements |
| POST | `/requirements` | Create requirement |
| GET | `/requirements/{id}` | Get requirement |
| PUT | `/requirements/{id}` | Update requirement |
| DELETE | `/requirements/{id}` | Delete requirement |

### Defect Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/defects` | List defects |
| POST | `/defects` | Create defect |
| GET | `/defects/{id}` | Get defect |
| PUT | `/defects/{id}` | Update defect |
| DELETE | `/defects/{id}` | Delete defect |

### Traceability Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/traceability` | Get full matrix |
| GET | `/api/traceability/gaps` | Get coverage gaps |
| GET | `/api/traceability/impact/{req_id}` | Get change impact |
| POST | `/api/traceability/link` | Create link |

### Sample Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sample-data/load` | Load sample data (10 reqs, 10 cases, 10 defects) |

---

## Browser Extension

### UI Overview

```
┌─────────────────────────────────────────┐
│ 🎬 Flowstral Recorder                   │
│                                         │
│ Base URL: [http://localhost:3000    ]   │
│                                         │
│ [▶ Start Recording]                     │
│                                         │
│ Recording: 5 steps                      │
│ Duration: 00:32                         │
│                                         │
│ [⏹ Stop & Save]                        │
│                                         │
│ Status: Recording saved ✓               │
└─────────────────────────────────────────┘
```

### How Recording Works

1. **Start Recording** - Extension injects content script
2. **Capture Events** - Click, type, navigate events captured
3. **Build Selectors** - Smart selectors generated for each element
4. **Stop & Save** - Session sent to backend `/api/flowstral/save-session`
5. **View in Trace** - Appears in Trace page (auto-refresh enabled)

### Selector Generation

The extension generates robust selectors in this priority:
1. `data-testid` or `data-cy` attributes
2. Unique `id` attribute
3. `name` attribute for form fields
4. `aria-label` for accessibility
5. Role-based (e.g., `getByRole('button', { name: 'Submit' })`)
6. CSS path as fallback

---

## PDF Verification

ArisTrace supports PDF verification in automated tests using various approaches:

### Text Content Verification (Python)

```python
import PyPDF2

def verify_pdf_text(pdf_path, expected_text):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text()
        
        assert expected_text in full_text, f"Expected text not found in PDF"
        return True
```

### With Playwright (Download & Verify)

```python
from playwright.sync_api import sync_playwright
import PyPDF2

def test_pdf_download_and_verify(page):
    # Click download button and wait for download
    with page.expect_download() as download_info:
        page.click("button#download-pdf")
    
    download = download_info.value
    pdf_path = download.path()
    
    # Verify PDF content
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = reader.pages[0].extract_text()
        
        assert "Invoice #12345" in text
        assert "Total: $100.00" in text
```

### Supported Libraries

| Language | Libraries |
|----------|-----------|
| Python | PyPDF2, pdfplumber, PyMuPDF |
| Java | Apache PDFBox, iText |
| JavaScript | pdf-parse, pdf.js |
| C# | iTextSharp, PdfSharp |

---

## Configuration

### Environment Variables

```bash
# Backend (.env)
ENABLE_POSTGRES=false        # Set to true to enable PostgreSQL
DATABASE_URL=sqlite:///./qaai.db
SECRET_KEY=your-secret-key

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

### Extension Settings

- **Server URL**: Backend API URL (default: http://localhost:8000)
- **Base URL**: Test application URL (entered before each recording)

---

## Troubleshooting

### Recording Issues

**Problem:** Recording not showing in Trace page
- **Solution:** 
  1. Check backend is running (`http://localhost:8000/health`)
  2. Check browser console for errors
  3. Wait for auto-refresh (5 seconds) or manually refresh

**Problem:** `body` selector in generated script
- **Solution:** Extension content script issue. Ensure you're clicking on actual input elements, not the page background.

**Problem:** Initial URL not captured
- **Solution:** Set Base URL in extension before recording

### Workflow Editor Issues

**Problem:** Shows cached/old workflow instead of selected recording
- **Solution:** Fixed in v2024-12-12. Editor auto-loads from URL params. Clear localStorage if persists.

**Problem:** "No action graph found" error
- **Solution:** Session may not have recorded actions. Check Trace page for step count.

### Load Testing Issues

**Problem:** No test cases in import dialog
- **Solution:** Create test cases first (either manually or by approving recordings)

**Problem:** Test shows 0 requests / empty results
- **Solution:** Ensure steps have valid URLs/actions. Check console for errors.

### Test Execution Issues

**Problem:** Test runs showing after deletion
- **Solution:** Fixed cascade delete in v2024-12-12. Use "Clear All Execution Data" in Test Execution dropdown.

**Problem:** Previous test cases showing in Execute tab
- **Solution:** Execute tab only shows test cases linked to selected plan. Select a plan first.

### Data Issues

**Problem:** Stale data showing
- **Solution:** Go to Settings → Data Management → Clear All Data

**Problem:** Requirements showing undefined source
- **Solution:** Fixed in v2024-12-12. Sample data now includes source field.

### Extension Issues

**Problem:** Extension not connecting
- **Solution:** Check backend is running on port 8000

**Problem:** Recording stops unexpectedly
- **Solution:** Check browser console for errors, ensure page allows scripting

---

## Sidebar Navigation

```
Overview
├── 📊 Dashboard
├── 📁 Projects
└── 📈 Analytics

Create & Build
├── 🎬 Trace (Record) ★
├── 🔀 Workflow Editor
└── 🖱️ Elements

Exploration
├── ⚡ Blaze (Auto) ★
└── 🧭 Discovery

Execute
├── 🚀 Test Execution ★    (Releases, Plans, Runs)
└── ✅ Test Cases

Quality
├── 🔗 Traceability ★
├── 📖 Requirements
└── 🐛 Defects

Tools
├── 🌐 API Testing
├── ⚡ Performance & Load
├── ♿ Accessibility
├── 📝 Gherkin
└── 🔬 Framework Analyzer

Configure
├── 🔄 CI/CD Pipeline
├── 🔌 Integrations
└── ⚙️ Settings
```

★ = Key Features (highlighted in sidebar)

---

## Version History

| Date | Changes |
|------|---------|
| 2024-12-12 | Added PDF verification documentation |
| 2024-12-12 | Fixed recordings not showing in Trace page |
| 2024-12-12 | Fixed Workflow Editor loading from Trace page |
| 2024-12-12 | Added Settings page with Clear All Data |
| 2024-12-12 | Enhanced Test Case Executor with multi-test queue |
| 2024-12-12 | Auto-populate defect form with test steps |
| 2024-12-12 | Fixed cascade delete for releases/plans |
| 2024-12-12 | Improved Traceability accuracy and navigation |
| 2024-12-12 | Fixed localStorage fallback for all entities |
| 2024-12-11 | Created lightweight EditTestCase.tsx |
| 2024-12-11 | Fixed Workflow Editor auto-load from sessionId URL param |
| 2024-12-11 | Merged Load Testing + Performance pages |
| 2024-12-11 | Added recording approval workflow |
| 2024-12-11 | Added multi-select Test Case import for load testing |
| 2024-12-11 | Simplified extension UI |
| 2024-12-11 | Added quick assertions to Trace page |
| 2024-12-11 | Added Traceability matrix with gap analysis |
| 2024-12-11 | Reorganized sidebar navigation |

---

*This is a living document. Update it whenever features change.*
