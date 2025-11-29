# ⭐ FLOWSTRAL — MASTER SPEC (FINAL VERSION)

## The Action Graph Intelligence Engine

**Flowstral = Real-time capture → Multi-modal analysis → Action Graph → Automation → Test Cases → Insights (Perf + WCAG + Requirements + Defects)**

---

## 🔵 PHASE 1 — INITIATION (Starting Flowstral Session)

### 1. User clicks "Start Flowstral"

Flowstral starts a new session with:
- `session_id`
- `project_id`
- `user_id`
- `start_timestamp`

### 2. Browser Extension / WebDriver Hook Activates

Captures:
- URL
- Document ready state
- Initial DOM snapshot
- Immediate WCAG scan
- Initial page timing

### 3. Initialize Action Graph

Flowstral creates an empty graph:
- `nodes = []`
- `edges = []`
- Each node = DOM state + action + metadata

**API Endpoint:** `POST /api/flowstral/start`

---

## 🔵 PHASE 2 — REAL-TIME EVENT CAPTURE (Core Pipeline)

Flowstral listens for ALL user interactions:

### Captured Events
- Click
- Input
- Select
- Navigation (URL change)
- Scroll
- Hover (optional)
- Page load / route change
- API requests (XHR/fetch)
- Component hydration timings
- Errors / console logs

### Each event triggers 4 core micro-pipelines:

1. **DOM Snapshot Pipeline**
2. **WCAG Scan Pipeline**
3. **Performance Probe Pipeline**
4. **Action Graph Update Pipeline**

**API Endpoint:** `POST /api/flowstral/capture-event`

---

## 🔵 PIPELINE A — DOM SNAPSHOT PIPELINE

Triggered after every user event.

Flowstral captures:
- Full DOM tree
- Unique element selector candidates:
  - CSS
  - XPath
  - ARIA roles
  - Text fallback locators
- Element bounding box + visual location
- Component hierarchy (React/Vue/Angular if available)
- Screenshot of clicked element or viewport

Flowstral stores:
- `dom_snapshot_id`
- `html_structure`
- `css_state`
- `component_tree`
- `selector_set`
- `screenshot`

**Service:** `DOMSnapshotPipeline`

---

## 🔵 PIPELINE B — WCAG ACCESSIBILITY PIPELINE

Runs axe-core on:
- the full page OR
- the interacted component

Flowstral records:
- Violations (WCAG 2.1 AA)
- Impact (critical, serious, moderate)
- Suggested fix
- Related DOM nodes

Output stored in:
- `wcag_issues[]`
- `a11y_snapshot_id`

This becomes part of the Action Graph node (state metadata).

**Service:** `WCAGPipeline`

---

## 🔵 PIPELINE C — PERFORMANCE PROBE PIPELINE

Flowstral collects metrics:

### Page-level:
- TTFB
- DOMContentLoaded
- FCP
- LCP
- CLS
- Total blocking time

### Component/API-level:
- API latency per endpoint (XHR/fetch)
- Render time of interacted components
- Largest element render time
- JavaScript execution spikes
- Layout shifts

Stored as:
- `performance_metrics[]`
- `component_timing[]`
- `network_calls[]`

This will feed into perf test generation.

**Service:** `PerformancePipeline`

---

## 🔵 PIPELINE D — ACTION GRAPH UPDATE PIPELINE

Flowstral constructs and updates the live graph.

Each event becomes a Node:

```javascript
node = {
  id: node_id,
  event_type: "click" | "input" | "navigate" | ...,
  target_selector: "...",
  target_text: "...",
  state_before: dom_snapshot_before_id,
  state_after: dom_snapshot_after_id,
  wcag_snapshot: wcag_snapshot_id,
  performance_snapshot: performance_snapshot_id,
  action_description: "User clicks Login Button",
  timestamp: ...
}
```

Flowstral automatically:
- Adds node to graph
- Creates edge from previous node → new node
- Annotates edge with:
  - action
  - transition time
  - latency
  - any warnings / issues

**Service:** `ActionGraph`

---

## 🔵 PHASE 3 — REAL-TIME OUTPUT GENERATION

Flowstral begins generating real-time outputs in the UI:

### 1. Real-Time Playwright Code
```javascript
await page.click('button:has-text("Login")');
await expect(page.locator("h1")).toContainText("Dashboard");
```

### 2. Real-Time Test Steps
1. Navigate to Login page
2. Enter username
3. Enter password
4. Click Login
5. Verify Dashboard header becomes visible

### 3. Real-Time Accessibility Panel
⚠ Missing ARIA-label on #search-input
⚠ Low contrast text at .profile-menu

### 4. Real-Time Performance Panel
/login: FCP 1.2s
/dashboard: LCP 2.9s (warning)
"fetch /api/user" took 640ms (slow)

**WebSocket:** `WS /api/flowstral/ws/{session_id}`

---

## 🔵 PHASE 4 — SESSION END (Stop Flowstral)

User clicks "Stop Flowstral".

Flowstral finalizes all outputs.

**API Endpoint:** `POST /api/flowstral/stop`

---

## 🔵 PHASE 5 — FINAL OUTPUT ARTIFACTS (This is the magic)

Flowstral compiles everything into 6 major artifacts:

### Artifact 1 — Action Graph Model

The complete graph with:
- Nodes
- Edges
- State transitions
- Timing
- Issues (WCAG + perf)
- DOM changes

Stored as: `action_graph.json`

### Artifact 2 — Full Playwright Automation Script

Flowstral refines selectors (self-healing prioritization):
- ARIA → CSS → Text fallback → XPath

Outputs: `script_code.js`

### Artifact 3 — Structured Test Cases

Flowstral generates:
- Preconditions
- Steps
- Expected results
- Tags
- Risk Level
- Priority
- Functional + regression tests
- Error-handling tests
- Accessibility test cases
- Performance test cases

Stored in DB using your Test Case schema.

### Artifact 4 — Accessibility Report (WCAG)

Flowstral outputs:
- Critical issues
- Serious issues
- Suggested fixes
- Associated DOM nodes
- Impact analysis
- Screenshots

### Artifact 5 — Performance Report

Flowstral builds:
- API latency matrix
- Page rendering timelines
- Component slowdowns
- Bottleneck location
- Recommendations for optimization
- Automatically generated performance test scripts (Locust/k6)

### Artifact 6 — Auto Defects (If Issues Found)

Flowstral automatically files defects if:
- Script fails
- WCAG issues exceed threshold
- Performance > SLA
- Errors detected (console, network fails)

Defects include:
- Repro steps
- Action Graph snippet
- DOM snapshots
- Screenshots
- Logs

**API Endpoint:** `GET /api/flowstral/session/{session_id}/artifacts`

---

## 🔵 PHASE 6 — POST-PROCESSING (Optional but recommended)

### Requirement inference
- Derive requirements from flows
- Link test cases → nodes → pages → requirements

### Traceability graph
Flowstral builds:
- Requirement → Test Case → Action Graph Node → Automation Step → Defect

### Flow Insights
- Step complexity
- Flakiness likelihood
- Performance hotspots

---

## 🔵 PHASE 7 — STORAGE & REUSE

Flowstral stores all artifacts in:

### Database
- `flowstral_sessions`
- `action_graph_nodes`
- `action_graph_edges`
- `dom_snapshots`
- `wcag_snapshots`
- `performance_snapshots`
- `flowstral_artifacts`
- `test_cases`
- `defects`

### Object Storage
- Screenshots
- Videos (optional)
- DOM snapshots
- Reports

---

## 📁 Implementation Files

### Core Services
- `backend/app/services/flowstral_session.py` - Session management
- `backend/app/services/flowstral_action_graph.py` - Action Graph engine
- `backend/app/services/flowstral_dom_pipeline.py` - DOM snapshot pipeline
- `backend/app/services/flowstral_wcag_pipeline.py` - WCAG accessibility pipeline
- `backend/app/services/flowstral_performance_pipeline.py` - Performance probe pipeline
- `backend/app/services/flowstral_realtime_output.py` - Real-time output generation
- `backend/app/services/flowstral_orchestrator.py` - Main orchestrator
- `backend/app/services/flowstral_artifacts.py` - 6 artifacts generator

### API
- `backend/app/routers/flowstral_api.py` - Flowstral API endpoints

### Database
- `supabase/migrations/021_flowstral_tables.sql` - Flowstral tables

### Browser Recorder
- `tools/flowstral_recorder.html` - Browser-based Flowstral recorder

---

## 🚀 Quick Start

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Open Flowstral Recorder:**
   - Open `tools/flowstral_recorder.html` in your browser
   - Or inject into any webpage

3. **Start Flowstral:**
   - Enter Project ID
   - Click "Start Flowstral"
   - Interact with the website
   - Watch real-time outputs appear

4. **Stop and Get Artifacts:**
   - Click "Stop Flowstral"
   - All 6 artifacts are generated automatically
   - View in new window

---

## 📊 Architecture

```
User Interaction
    ↓
Flowstral Orchestrator
    ↓
┌─────────────────────────────────────┐
│  4 Parallel Pipelines              │
├─────────────────────────────────────┤
│  A. DOM Snapshot Pipeline          │
│  B. WCAG Scan Pipeline             │
│  C. Performance Probe Pipeline     │
│  D. Action Graph Update Pipeline   │
└─────────────────────────────────────┘
    ↓
Action Graph (Nodes + Edges)
    ↓
Real-Time Outputs
    ↓
6 Artifacts (on stop)
```

---

## ✅ Status

**Implemented:**
- ✅ Session management
- ✅ Action Graph engine
- ✅ DOM Snapshot Pipeline
- ✅ WCAG Pipeline (basic)
- ✅ Performance Pipeline
- ✅ Real-time output generation
- ✅ 6 Artifacts generator
- ✅ API endpoints
- ✅ WebSocket support
- ✅ Database schema
- ✅ Browser recorder

**Ready for:**
- Real-time testing on any website
- Client demos
- Production deployment



