# Flowstral Recording - Complete Step-by-Step Process

## Overview
Flowstral recording captures real user interactions and builds an Action Graph that represents the user flow as a structured graph of nodes (screens/states) and edges (actions/transitions).

---

## PHASE 1: SESSION INITIATION

### Step 1.1: User Starts Recording
- **Trigger**: User clicks "Start Flowstral" in browser extension or UI
- **API Endpoint**: `POST /api/flowstral/start`
- **Inputs**:
  - `project_id`: Project identifier
  - `user_id`: User identifier
  - `initial_url`: Starting URL
  - `initial_dom`: Optional initial DOM snapshot

### Step 1.2: Session Creation
- **Service**: `FlowstralSessionManager.create_session()`
- **Actions**:
  1. Generate unique `session_id` (UUID)
  2. Create `FlowstralSession` object
  3. Set `is_active = True`
  4. Store `start_timestamp`
  5. Initialize empty data structures:
     - `nodes: []` (Action Graph nodes)
     - `edges: []` (Action Graph edges)
     - `raw_events: []` (Raw event data for Flux agent)
     - `playwright_code: []` (Real-time code generation)
     - `test_steps: []` (Real-time test steps)
     - `wcag_issues: []` (Accessibility findings)
     - `performance_metrics: []` (Performance data)

### Step 1.3: Initialize Action Graph
- **Service**: `ActionGraph(session_id)`
- **Actions**:
  1. Create empty `ActionGraph` object
  2. Initialize:
     - `nodes: List[ActionGraphNode] = []`
     - `edges: List[ActionGraphEdge] = []`
     - `node_map: Dict[str, ActionGraphNode] = {}`
     - `current_node: Optional[ActionGraphNode] = None`

### Step 1.4: Capture Initial State
- **Orchestrator**: `FlowstralOrchestrator.start_session()`
- **Pipelines Executed** (in parallel):
  1. **DOM Snapshot Pipeline**: Capture initial DOM
  2. **WCAG Pipeline**: Run initial accessibility scan
  3. **Performance Pipeline**: Capture initial performance metrics
- **Result**: Create root node in Action Graph with:
  - `event_type: "session_start"`
  - `url: initial_url`
  - `dom_snapshot_id`
  - `wcag_snapshot_id`
  - `performance_snapshot_id`
  - `action_description: "Flowstral session started"`

---

## PHASE 2: REAL-TIME EVENT CAPTURE

### Step 2.1: Event Detection (Browser Extension)
- **Location**: Browser extension content script
- **Events Captured**:
  - `click` - Mouse clicks
  - `input` - Text input
  - `select` - Dropdown selections
  - `navigate` - URL changes
  - `submit` - Form submissions
  - `scroll` - Scroll events (filtered out)
  - `mousemove` - Mouse movements (filtered out)
  - `hover` - Hover events (optional)
  - `page_load` - Page load events
  - `api_request` - XHR/fetch calls (filtered out)

### Step 2.2: Event Filtering
- **Service**: `FlowstralOrchestrator.capture_event()`
- **Noisy Events Filtered Out**:
  - `scroll` - Too frequent, not meaningful actions
  - `mousemove` - Not user actions
  - `mouseover` / `mouseout` - Hover events (unless significant)
  - `focus` / `blur` - Captured with input events
  - `resize` - Window resize
  - `visibilitychange` - Tab visibility
  - `wcag_scan` - Internal events
  - `dom_snapshot` - Internal events
  - `api_request` - Captured separately
  - `page_load` - Handled separately
  - `change` - Captured with input events

### Step 2.3: Event Data Extraction
- **Data Extracted from Event**:
  - `event_type`: Type of interaction
  - `event_data`: Full event payload containing:
    - `html`: Full DOM HTML
    - `url`: Current page URL
    - `interacted_element`: Element that was interacted with
    - `page_metrics`: Performance metrics
    - `component_metrics`: Component-level metrics
    - `network_calls`: API call data
    - `screenshot`: Base64 screenshot (optional)
    - `action_description`: Human-readable description
    - `value`: Input value (for input events)
    - `expected_result`: Expected outcome

### Step 2.4: Event Sent to Backend
- **API Endpoint**: `POST /api/flowstral/capture-event`
- **Payload**:
  ```json
  {
    "session_id": "...",
    "event_type": "click",
    "event_data": {
      "html": "...",
      "url": "...",
      "interacted_element": {...},
      ...
    }
  }
  ```

---

## PHASE 3: PARALLEL PIPELINE EXECUTION

For each captured event, **4 pipelines run in parallel**:

### Pipeline A: DOM Snapshot Pipeline

#### Step 3.1.1: DOM Snapshot Capture
- **Service**: `DOMSnapshotPipeline.capture_snapshot()`
- **Inputs**:
  - `html`: Full DOM HTML
  - `url`: Current URL
  - `interacted_element`: Element that was interacted with
- **Actions**:
  1. Generate `dom_snapshot_id` (UUID)
  2. Parse HTML structure:
     - Count elements
     - Extract forms, inputs, buttons, links
     - Detect React/Vue/Angular frameworks
  3. Extract CSS state:
     - Inline styles
     - Style tags
     - External stylesheets
  4. Detect component framework:
     - React: `data-reactroot`, component names
     - Vue: `v-*` attributes, component names
     - Angular: `ng-*` attributes, component names

#### Step 3.1.2: Selector Generation (CRITICAL - Immediate Generation)
- **Service**: `DOMSnapshotPipeline._generate_selector_candidates()`
- **Priority Order** (Industry Standard):
  1. **data-testid** (99% stable) → `page.getByTestId('...')`
  2. **Stable ID** (95% stable) → `page.locator('#id')`
  3. **ARIA label** (90% stable) → `page.getByRole('...', { name: '...' })`
  4. **ARIA labelledby** (90% stable)
  5. **Role + name** (85% stable) → `page.getByRole('button', { name: '...' })`
  6. **Name attribute** (80% stable) → `page.locator('input[name="..."]')`
  7. **Text content** (70% stable) → `page.getByText('...')`
  8. **CSS selector** (60% stable) → `page.locator('.class')`
  9. **XPath** (50% stable - last resort) → `page.locator('xpath=...')`

- **Selector Engines Used** (in order):
  1. **SimpleSelectorEngine** (primary) - Generates ONE reliable selector
  2. **LocatorEngine** (fallback) - Multi-strategy selector generation
  3. **Basic fallback** - Direct attribute extraction

- **Output**: `selector_set` containing:
  - `primary_selector`: Best Playwright locator (e.g., `page.getByTestId('login-btn')`)
  - `fallback_selectors`: Array of fallback locators
  - `recommended`: Recommended selector with metadata
  - `candidates`: All selector candidates with priority/confidence
  - `stability_score`: 0.0-1.0 stability rating

#### Step 3.1.3: DOM Snapshot Storage
- **Stored Data**:
  - `dom_snapshot_id`
  - `html_structure`
  - `css_state`
  - `component_tree`
  - `selector_set` (CRITICAL: Generated immediately at capture time)
  - `timestamp`

---

### Pipeline B: WCAG Accessibility Pipeline

#### Step 3.2.1: WCAG Scan Execution
- **Service**: `WCAGPipeline.scan_page()`
- **Inputs**:
  - `html`: Full DOM HTML
  - `url`: Current URL
  - `wcag_scan_data`: Optional pre-scanned data from extension
- **Actions**:
  1. Run axe-core accessibility scanner
  2. Detect WCAG 2.1 AA violations
  3. Categorize by impact:
     - `critical`: Blocks users
     - `serious`: Major issues
     - `moderate`: Minor issues
  4. Extract:
     - Violation type
     - Affected elements
     - Suggested fixes
     - Related DOM nodes

#### Step 3.2.2: WCAG Snapshot Storage
- **Stored Data**:
  - `wcag_snapshot_id`
  - `violations`: Array of violations
  - `passes`: Array of passing checks
  - `incomplete`: Array of incomplete checks
  - `summary`: `{total: count, critical: count, serious: count, moderate: count}`

---

### Pipeline C: Performance Probe Pipeline

#### Step 3.3.1: Performance Metrics Capture
- **Service**: `PerformancePipeline.capture_metrics()`
- **Inputs**:
  - `url`: Current URL
  - `page_metrics`: Page-level metrics from extension
  - `component_metrics`: Component-level metrics
  - `network_calls`: API call data
- **Metrics Captured**:
  - **Page-level**:
    - TTFB (Time to First Byte)
    - DOMContentLoaded
    - FCP (First Contentful Paint)
    - LCP (Largest Contentful Paint)
    - CLS (Cumulative Layout Shift)
    - Total Blocking Time
  - **Component-level**:
    - Component render time
    - Largest element render time
    - JavaScript execution time
    - Layout shifts
  - **Network-level**:
    - API latency per endpoint
    - Request/response sizes
    - Error codes

#### Step 3.3.2: Performance Snapshot Storage
- **Stored Data**:
  - `performance_snapshot_id`
  - `bottlenecks`: Array of performance issues
  - `summary`: Aggregated metrics
  - `page_metrics`: Page-level data
  - `component_metrics`: Component-level data
  - `network_calls`: API call data

---

### Pipeline D: Action Graph Update Pipeline

#### Step 3.4.1: Extract Target Text
- **Service**: `FlowstralOrchestrator.capture_event()`
- **Priority Order**:
  1. `text_content` - Inner text of element
  2. `aria-label` - Accessibility label
  3. `name` attribute - Form field name
  4. `id` attribute - Cleaned up to readable text
  5. `action_description` - Extract from description string

#### Step 3.4.2: Extract Selector (IMMEDIATE - At Capture Time)
- **Service**: `FlowstralOrchestrator.capture_event()`
- **Source**: `dom_snapshot.selector_set` (generated in Pipeline A)
- **Priority**:
  1. `playwright_locator` from `selector_set.primary_selector`
  2. `css_selector` from `selector_set.recommended.selector`
  3. `fallback_selectors` from `selector_set.fallback_selectors`
  4. Direct extraction from `interacted_element` attributes

#### Step 3.4.3: Store Raw Event
- **Purpose**: For Flux high-fidelity script generation
- **Stored in**: `session.raw_events[]`
- **Data**:
  - `event_type`
  - `timestamp`
  - `event_data` (full payload)
  - `selector` (generated selector)
  - `target_text`
  - `url`
  - `coordinates` (mouse position)
  - `hover_duration_ms`
  - `scroll_position`
  - `dom_snapshot_id`
  - `screenshot` (base64)

#### Step 3.4.4: Create Action Graph Node
- **Service**: `FlowstralSession.add_node()`
- **Node Data**:
  ```python
  {
    "id": node_id (UUID),
    "event_type": "click" | "input" | "navigate" | ...,
    "target_selector": playwright_locator or css_selector,
    "target_text": extracted text,
    "url": current_url,
    "state_before": previous_node_id,
    "state_after": None (set by next node),
    "dom_snapshot_id": dom_snapshot_id,
    "wcag_snapshot_id": wcag_snapshot_id,
    "performance_snapshot_id": performance_snapshot_id,
    "action_description": "User clicks Login Button",
    "timestamp": ISO timestamp,
    "screenshot_url": base64_screenshot,
    "metadata": {
      "value": input_value (if input event),
      "latency_ms": performance_latency,
      "wcag_violations_count": violation_count,
      "performance_issues_count": bottleneck_count,
      "timestamp": raw_timestamp,
      "coordinates": (x, y),
      "hover_duration_ms": hover_time,
      "scroll_position": (x, y),
      "interacted_element": full_element_data,
      "event_data": full_event_data,
      # CRITICAL: Selector information (generated at capture time)
      "playwright_locator": "page.getByTestId('...')",
      "css_selector": "[data-testid='...']",
      "fallback_selectors": [...],
      "selector_set": full_selector_set
    }
  }
  ```

#### Step 3.4.5: Create Action Graph Edge
- **Service**: `ActionGraph._create_edge()`
- **Edge Data**:
  ```python
  {
    "id": edge_id (UUID),
    "from_node_id": previous_node_id,
    "to_node_id": current_node_id,
    "action": event_type,
    "action_type": semantic_action_type,
    "description": "User clicks 'Login Button'",
    "locators": {
      "primary": playwright_locator,
      "fallback": fallback_locator
    },
    "inputs": {
      "value": sanitized_input_value,
      "parameterized": True/False
    },
    "expected_outcome": "Login page loads",
    "transition_time_ms": time_between_nodes,
    "latency_ms": performance_latency,
    "perf_metrics": {
      "latency": latency_ms,
      "errorCodes": []
    },
    "a11y_impacts": ["Button has accessible name"],
    "warnings": ["High latency: 1200ms"]
  }
  ```

#### Step 3.4.6: Update Action Graph State
- **Actions**:
  1. Add node to `action_graph.nodes[]`
  2. Add node to `action_graph.node_map{}` for O(1) lookup
  3. Set `action_graph.current_node = new_node`
  4. Update previous node's `state_after = new_node.id`
  5. Create edge from previous node to new node
  6. Add edge to `action_graph.edges[]`

---

## PHASE 4: REAL-TIME OUTPUT GENERATION

### Step 4.1: Generate Playwright Code Line
- **Service**: `RealTimeOutputGenerator.generate_playwright_line()`
- **Inputs**:
  - `event_type`: Type of action
  - `selector`: Generated selector
  - `value`: Input value (if applicable)
  - `url`: URL (if navigation)
- **Output**: Single line of Playwright code
  ```javascript
  await page.getByTestId('login-btn').click();
  await page.locator('#username').fill('user@example.com');
  ```

### Step 4.2: Generate Test Step
- **Service**: `RealTimeOutputGenerator.generate_test_step()`
- **Output**: Structured test step
  ```json
  {
    "step_number": 1,
    "action": "User clicks Login Button",
    "expected_result": "Login form appears"
  }
  ```

### Step 4.3: Generate Accessibility Panel
- **Service**: `RealTimeOutputGenerator.generate_accessibility_panel()`
- **Output**: Summary of WCAG issues
  ```json
  {
    "total_issues": 3,
    "critical": 1,
    "serious": 2,
    "issues": [...]
  }
  ```

### Step 4.4: Generate Performance Panel
- **Service**: `RealTimeOutputGenerator.generate_performance_panel()`
- **Output**: Performance metrics summary
  ```json
  {
    "page_score": 85,
    "metrics": [...]
  }
  ```

### Step 4.5: Update Session Outputs
- **Stored in**: `FlowstralSession`
  - `playwright_code.append(playwright_line)`
  - `test_steps.append(test_step)`
  - `wcag_issues.extend(violations)`
  - `performance_metrics.append(perf_snapshot)`

---

## PHASE 5: SESSION STOP & ARTIFACT GENERATION

### Step 5.1: User Stops Recording
- **Trigger**: User clicks "Stop Flowstral"
- **API Endpoint**: `POST /api/flowstral/stop`
- **Inputs**:
  - `session_id`: Session identifier
  - `project_id`: Optional project ID
  - `tenant_id`: Optional tenant ID

### Step 5.2: Session Finalization
- **Service**: `FlowstralSessionManager.stop_session()`
- **Actions**:
  1. Set `session.is_active = False`
  2. Create end node:
     - `event_type: "session_end"`
     - `state_before: current_node_id`
  3. Create edge from last node to end node
  4. Calculate session duration

### Step 5.3: Reconstruct Action Graph Object
- **Service**: `ActionGraph.load_from_session_data()`
- **Actions**:
  1. Load nodes from `session.nodes[]`
  2. Load edges from `session.edges[]`
  3. Recreate `ActionGraphNode` objects with all metadata
  4. Recreate `ActionGraphEdge` objects with locators/inputs
  5. Rebuild `node_map` for O(1) lookups
  6. Set `current_node` to last node

### Step 5.4: Generate All 6 Artifacts
- **Service**: `FlowstralArtifactsGenerator.generate_all_artifacts()`
- **Progress Callback**: WebSocket updates for UI

#### Artifact 1: Action Graph Model
- **Service**: `generate_action_graph_model()`
- **Output**: Complete graph JSON
  ```json
  {
    "session_id": "...",
    "nodes": [...],
    "edges": [...],
    "metadata": {
      "total_nodes": 50,
      "total_edges": 49,
      ...
    }
  }
  ```

#### Artifact 2: Playwright Script
- **Service**: `generate_playwright_script()`
- **Uses**: Flux Fidelity Agent with raw events
- **Inputs**:
  - `action_graph`: Full action graph
  - `raw_events`: Raw event data
- **Output**: Complete Playwright test script

#### Artifact 3: Test Cases
- **Service**: `generate_test_cases()`
- **Output**: Structured test cases (Gherkin/JSON)

#### Artifact 4: Accessibility Report
- **Service**: `generate_accessibility_report()`
- **Output**: WCAG compliance report

#### Artifact 5: Performance Report
- **Service**: `generate_performance_report()`
- **Output**: Performance analysis report

#### Artifact 6: Defects
- **Service**: `generate_defects()`
- **Output**: Auto-generated defect reports (if issues found)

### Step 5.5: Persist to Database
- **Tables**:
  - `flowstral_sessions`: Session metadata
  - `flowstral_artifacts`: All 6 artifacts (JSONB)
  - `action_graph_nodes`: Node data
  - `action_graph_edges`: Edge data
  - `dom_snapshots`: DOM snapshots
  - `wcag_snapshots`: WCAG scan results
  - `performance_snapshots`: Performance data

---

## ACTION GRAPH BUILDING - DETAILED BREAKDOWN

### What is Used for Building Action Graph

#### 1. **Raw Events** (from browser extension)
- **Source**: Browser extension content script
- **Format**: Array of event objects
- **Fields**:
  - `event_type`: Type of interaction
  - `timestamp`: Event timestamp
  - `event_data`: Full event payload
  - `url`: Current URL
  - `html`: DOM HTML

#### 2. **DOM Snapshots** (from Pipeline A)
- **Purpose**: Capture page state at each action
- **Contains**:
  - Full DOM tree
  - Selector candidates (generated immediately)
  - Component hierarchy
  - CSS state
  - Framework detection

#### 3. **WCAG Snapshots** (from Pipeline B)
- **Purpose**: Accessibility state at each action
- **Contains**:
  - Violations
  - Passes
  - Incomplete checks
  - Summary statistics

#### 4. **Performance Snapshots** (from Pipeline C)
- **Purpose**: Performance state at each action
- **Contains**:
  - Page metrics (FCP, LCP, CLS, etc.)
  - Component metrics
  - Network calls
  - Bottlenecks

#### 5. **Selector Information** (CRITICAL - Generated at Capture Time)
- **Source**: DOM Pipeline selector generation
- **Priority Order**:
  1. `data-testid` → `page.getByTestId('...')`
  2. Stable `id` → `page.locator('#id')`
  3. `aria-label` → `page.getByRole('...', { name: '...' })`
  4. `role + name` → `page.getByRole('button', { name: '...' })`
  5. `name` attribute → `page.locator('input[name="..."]')`
  6. Text content → `page.getByText('...')`
  7. CSS selector → `page.locator('.class')`
  8. XPath → `page.locator('xpath=...')`

#### 6. **Target Text Extraction**
- **Priority Order**:
  1. `text_content` (innerText)
  2. `aria-label`
  3. `name` attribute
  4. `id` attribute (cleaned)
  5. `action_description` (parsed)

#### 7. **Metadata** (from all pipelines)
- Event coordinates
- Hover duration
- Scroll position
- Input values (sanitized)
- Screenshots (base64)
- Timestamps
- Performance metrics
- WCAG violation counts

### Action Graph Structure

#### Nodes (Screens/States)
- **Represents**: A screen or state in the application
- **Key Fields**:
  - `id`: Unique node identifier
  - `event_type`: Type of event that led to this state
  - `url`: Page URL
  - `url_pattern`: Normalized URL pattern (e.g., `/product/:id`)
  - `title`: Screen title
  - `key_elements`: Semantic summary of screen content
  - `target_selector`: Selector for interacted element
  - `target_text`: Text of interacted element
  - `dom_snapshot_id`: Reference to DOM snapshot
  - `wcag_snapshot_id`: Reference to WCAG snapshot
  - `performance_snapshot_id`: Reference to performance snapshot
  - `screenshot_url`: Screenshot reference
  - `state_before`: Previous node ID
  - `state_after`: Next node ID
  - `metadata`: Full event metadata including selectors

#### Edges (Actions/Transitions)
- **Represents**: An action that transitions from one state to another
- **Key Fields**:
  - `id`: Unique edge identifier
  - `from_node_id`: Source node
  - `to_node_id`: Target node
  - `action`: Action type (click, input, navigate, etc.)
  - `action_type`: Semantic action type (Login, Search, etc.)
  - `description`: Human-readable description
  - `locators`: Selector information
    - `primary`: Primary selector
    - `fallback`: Fallback selector
  - `inputs`: Input data
    - `value`: Input value
    - `parameterized`: Whether value was parameterized
  - `expected_outcome`: Expected result of action
  - `transition_time_ms`: Time between states
  - `latency_ms`: Performance latency
  - `perf_metrics`: Performance metrics
  - `a11y_impacts`: Accessibility impacts
  - `warnings`: Array of warnings

### Deterministic vs LLM-Based Building

#### Deterministic Building (80-90% of work)
- **Method**: `ActionGraph.build_deterministic_from_events()`
- **Steps**:
  1. Normalize and deduplicate events
  2. Identify pages/views (URL-based)
  3. Build nodes for each page
  4. Build edges for actions within page
  5. Build navigation edges
  6. Parameterize dynamic data
- **No LLM required** - Uses rules and patterns

#### LLM Enhancement (10-20% of work)
- **Method**: `FlowstralActionGraphBuilder.build_action_graph_from_events()`
- **Steps**:
  1. Segment events into screens/steps
  2. Use LLM for semantic labeling:
     - Action type classification
     - Human-readable step names
     - Intent classification (Positive/Negative/Edge case)
     - Expected outcome prediction
  3. Create nodes from labeled segments
  4. Create edges with semantic information

### Key Design Principles

1. **Immediate Selector Generation**: Selectors are generated **at capture time**, not later. This ensures:
   - Full DOM context available
   - Best selector chosen immediately
   - No context loss
   - Industry-standard approach (like Playwright Codegen)

2. **Hybrid Architecture**: 
   - Deterministic (80-90%): Fast, reliable, rule-based
   - LLM (10-20%): Semantic enhancement, beautification

3. **Multi-Modal Analysis**: Each event triggers 4 parallel pipelines:
   - DOM analysis
   - Accessibility analysis
   - Performance analysis
   - Action graph construction

4. **Real-Time Output**: As events are captured, real-time outputs are generated:
   - Playwright code
   - Test steps
   - Accessibility panel
   - Performance panel

5. **High-Fidelity Generation**: Raw events stored for Flux agent to generate high-quality scripts with full context

---

## Summary: Complete Flow

```
User Interaction
    ↓
Browser Extension Captures Event
    ↓
Event Sent to Backend (POST /api/flowstral/capture-event)
    ↓
Event Filtering (remove noisy events)
    ↓
┌─────────────────────────────────────┐
│  4 PARALLEL PIPELINES               │
├─────────────────────────────────────┤
│  A. DOM Snapshot Pipeline          │
│     → Generate selectors IMMEDIATELY│
│     → Parse HTML structure         │
│     → Detect frameworks            │
│                                     │
│  B. WCAG Scan Pipeline             │
│     → Run axe-core scanner         │
│     → Detect violations            │
│                                     │
│  C. Performance Probe Pipeline     │
│     → Capture metrics              │
│     → Detect bottlenecks           │
│                                     │
│  D. Action Graph Update Pipeline   │
│     → Extract target text          │
│     → Extract selector (from A)    │
│     → Create node                 │
│     → Create edge                 │
└─────────────────────────────────────┘
    ↓
Action Graph Updated (Node + Edge added)
    ↓
Real-Time Outputs Generated
    ↓
Session Updated
    ↓
[Repeat for each event]
    ↓
User Stops Recording
    ↓
Action Graph Finalized
    ↓
6 Artifacts Generated
    ↓
Persist to Database
```

---

## Key Takeaways

1. **Selectors are generated IMMEDIATELY at capture time** - not later. This is critical for reliability.

2. **4 pipelines run in parallel** for each event - DOM, WCAG, Performance, Action Graph.

3. **Action Graph is built incrementally** - each event adds a node and edge.

4. **Raw events are stored** for high-fidelity script generation by Flux agent.

5. **Hybrid approach**: Deterministic (80-90%) + LLM (10-20%) for best results.

6. **Real-time outputs** are generated as events are captured.

7. **6 artifacts** are generated when recording stops.




