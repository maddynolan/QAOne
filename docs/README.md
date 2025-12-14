# ArisTrace - Quick Reference

> For full documentation, see [DOCUMENTATION.md](../DOCUMENTATION.md)

## Quick Start

```bash
# Frontend
npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Extension
# Load flowstral-extension folder in Chrome (chrome://extensions)
```

## Ports

| Service | Port |
|---------|------|
| Frontend | 5173 (dev) / 8080 (prod) |
| Backend | 8000 |
| Test Website | 3000 |
| E-commerce Demo | 8002 |

## Key URLs

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Overview & KPIs |
| Trace (Record) | `/flowstral` | Record browser sessions |
| Workflow Editor | `/flowstral/workflow-editor` | Visual test builder |
| Test Cases | `/cases` | Test case library |
| Test Execution | `/execution` | Releases, Plans, Runs |
| Traceability | `/traceability` | Coverage matrix |
| Requirements | `/requirements` | Requirement management |
| Defects | `/defects` | Bug tracking |
| Performance & Load | `/load-testing` | Load testing |
| API Testing | `/enhanced-api-testing` | API testing |
| Settings | `/settings` | Configuration & data management |

## Core Workflow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TEST MANAGEMENT LIFECYCLE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  REQUIREMENTS ──► TEST CASES ──► TEST PLANS ──► TEST RUNS ──► DEFECTS  │
│       ↓              ↓              ↓              ↓            ↓      │
│    Define        Create         Organize        Execute        Track   │
│    (REQ-xxx)     (TC-xxx)       (TP-xxx)        (TR-xxx)       (DEF-xx)│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Recording Workflow

```
Extension → Trace Page → Workflow Editor → Test Case → Test Plan → Execute
    ↓           ↓              ↓              ↓            ↓          ↓
  Record     Review        Edit Flow       Approve      Organize   Run Tests
             + Assert      + Add Steps     + Save       + Group    + Evidence
```

## Test Execution Hierarchy

```
Release (Test Cycle)
 └── Test Plans (Smoke, Regression, Functional, etc.)
      └── Test Cases (Linked from library)
           └── Test Runs (Execution records)
                └── Defects (From failed steps)
```

## Quick Actions

| Action | Path | Description |
|--------|------|-------------|
| Create Test Case | `/cases/new` | New manual/automated test |
| Create Requirement | `/requirements/new` | New requirement |
| Create Defect | `/defects/new` | Report a bug |
| Run Test | `/execution` → Select Plan → Execute | Step-by-step execution |

## API Endpoints

```
# Sessions/Recordings
GET  /api/flowstral/sessions             # List recordings
POST /api/flowstral/save-session         # Save recording
GET  /api/flowstral/session/{id}/artifacts  # Get session details

# Test Cases
GET  /test-cases                         # List test cases
POST /test-cases                         # Create test case

# Requirements
GET  /requirements                       # List requirements
POST /requirements                       # Create requirement

# Defects
GET  /defects                            # List defects
POST /defects                            # Create defect

# Traceability
GET  /api/traceability                   # Get traceability matrix

# Sample Data
POST /api/sample-data/load               # Load sample data
```

## Data Storage

- **Primary**: Backend API (in-memory/SQLite)
- **Fallback**: localStorage (for offline/dev)
- **Clear Data**: Settings → Data Management → Clear All Data

## File Structure

```
QAAI/
├── src/
│   ├── pages/               # React pages
│   │   ├── Flowstral.tsx    # Trace (Record)
│   │   ├── TestExecution.tsx # Releases/Plans/Runs
│   │   ├── TestCaseExecutor.tsx # Step-by-step execution
│   │   ├── Traceability.tsx # Coverage matrix
│   │   └── ...
│   ├── components/          # Reusable components
│   └── lib/                 # Services & utilities
├── backend/app/
│   ├── routers/             # API endpoints
│   └── services/            # Business logic
├── flowstral-extension/     # Chrome extension
├── DOCUMENTATION.md         # Full docs (living document)
└── docs/README.md           # This file (quick reference)
```

## Common Commands

```bash
# Start frontend
npm run dev

# Start backend
cd backend && uvicorn app.main:app --reload --port 8000

# Check for linting errors
npm run lint

# Build for production
npm run build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save (in editors) |
| `Esc` | Close dialogs |
| `Enter` | Confirm/Submit |

---

*Last Updated: December 12, 2024*

*See [DOCUMENTATION.md](../DOCUMENTATION.md) for complete documentation*
