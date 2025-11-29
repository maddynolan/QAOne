# Flowstral Architecture Specification

## 1. Flowstral in One Sentence

**Flowstral is a Chrome-based "Action Graph Builder" that watches real user flows in any web app, converts them into a structured Flowstral Action Graph, and then uses custom LLMs to automatically generate & maintain: requirements, test cases, automation scripts (Playwright/API/perf/security), accessibility & performance findings, and defects.**

## 2. High-Level Architecture

Think of 4 main layers:

### Layer 1: Browser Extension (Flowstral Chrome Extension)
- Captures user interactions & page context
- Shows a small side panel to the tester
- Streams "raw events" to backend

### Layer 2: Ingestion & Orchestration API (Backend)
- Auth, tenant routing, rate limiting
- Transforms raw events into Flowstral Action Graph
- Triggers LLM pipelines & analysis agents

### Layer 3: LLM & Agent Layer (Custom Models)
- Action normalizer & intent classifier
- Test case generator
- Requirements generator/refiner
- Code generator (Playwright/perf/accessibility/security)
- Maintenance & flakiness analyzer

### Layer 4: QA Platform & Storage
- Requirements store (Jira / your own DB)
- Test cases & test runs
- Automation repo integration (GitHub/GitLab/Azure)
- Reporting & dashboards

## 3. Chrome Extension Architecture

### 3.1 Extension Components

#### a) Manifest (v3)
Declares:
- `content_scripts` (for recording)
- `background.service_worker` (brains in the browser)
- Optional `devtools_page` or `sidePanel`
- Permissions: `activeTab`, `scripting`, `tabs`, `storage`, `webNavigation`, optional host permissions (`https://*.clientdomain.com/*`)

#### b) Content Script ("Flowstral Recorder Runtime")
Injected into allowed pages to observe & annotate interactions.

**Responsibilities:**
- **Event capture (semantically):**
  - Clicks: element, text, DOM path, accessibility name, ARIA role
  - Input: field label, field type (email/password/text), value pattern (but never raw sensitive values)
  - Navigation: URL changes, route changes (SPA), hash changes
  - Network timing hooks (via PerformanceObserver and window.performance)
  - Basic layout & viewport info

- **Accessibility snapshot:**
  - Read ARIA attributes, roles, contrast, missing alt, labels, etc.
  - Build a light accessibility tree summary per screen

- **Performance snapshot:**
  - First Contentful Paint, Largest Contentful Paint, resource timings for XHR/fetch
  - Per "action" – how long did the page take to respond?

- **DOM metadata for robust selectors:**
  - `data-testid`, `aria-*`, `id`, `name`, `placeholder`, visible text

- **Privacy guard in content script:**
  - Don't log keystrokes for password, credit card, SSN patterns
  - Hash or mask values for PII fields
  - Apply simple regex-based redaction before sending

All of this is sent as raw events to the background script through `chrome.runtime.sendMessage` or via a long-lived port.

#### c) Background Service Worker ("Flowstral Orchestrator in Browser")
This is the extension's backend in the browser.

**Responsibilities:**
- **Session management:**
  - Start / pause / resume / stop recording sessions
  - Assign session IDs, handle multiple tabs
  - Buffer events & batch them for backend (e.g., every N events or on stop)

- **Domain allowlisting:**
  - Enforce client-configured "allowed domains" (no capture on personal Gmail, banking, etc)

- **Network communication with backend:**
  - Secure HTTPS calls to Ingestion API
  - Attach auth token (per-tenant API key, OAuth, etc)
  - Handle retries, backoff, offline queue if needed

- **Security & policy enforcement in browser:**
  - Local check for forbidden patterns (no sending HTML of entire page, no cookies/localStorage values)
  - Support "pixelated screenshot" mode for sensitive pages (optional)

#### d) UI Surface (Side Panel / Popup / DevTools Panel)
A small UX surface the tester interacts with:

- **Buttons:** Start Flowstral, Pause, Stop & Generate, Discard
- **Session info:** current step count, current page name, approximate duration
- **After stop:**
  - Show "Flowstral Action Graph preview" (steps list + page thumbnails)
  - Options to:
    - "Generate Test Cases"
    - "Generate Automation Scripts"
    - "Generate Requirements & Defects"
  - Status: "Sending events…", "Building action graph…", "Generated X test cases"

You can build this UI in React and ship as extension HTML page.

## 4. Backend & LLM Pipeline

### 4.1 Ingestion API (Gateway)

**Service:** `flowstral-gateway`

Receives batched event payloads:
```json
{
  "tenantId": "...",
  "sessionId": "...",
  "userId": "...",
  "events": [ ... ],
  "clientConfigVersion": "v3"
}
```

**Validates:**
- Tenant & user auth
- Domain allowlist
- Max session length, event count limits

**Writes raw events to Event Store** (e.g., Kafka / Kinesis / DB table)

### 4.2 Action Graph Builder

**Service:** `flowstral-action-graph-builder`

**Input:** ordered list of events  
**Output:** Flowstral Action Graph

Where your first LLM is used heavily.

**Responsibilities:**

1. **Session segmentation**
   - Group events into screens and steps
   - Detect page transitions, modal opens, wizards, etc.

2. **Semantic action labeling via LLM**
   - Call your LLM with compressed event chunks to produce:
     - `actionType` (Login, Search, AddToCart, SubmitForm, NavigateToPage, etc)
     - `humanStepName` ("User logs in with valid credentials")
     - `intent` (Positive path / Negative / Edge case)
   
   **Model I/O pattern:**
   - Input: JSON list of raw events with DOM metadata
   - Output: normalized "Actions" with metadata

3. **Graph construction**
   - Nodes = Screens/States (identified by URL pattern + key DOM features)
   - Edges = Actions (source node → target node)
   - Attach:
     - DOM locators
     - accessibility/perf metrics
     - captured data (sanitized)
     - screenshot references

**Flowstral Action Graph is now your single source of truth for that flow.**

### 4.3 Test & Requirement Generation (Agents)

Now you layer separate agents on top of the Action Graph.

Each agent is a service orchestrated by an "Agent Orchestrator":

**Service:** `flowstral-agent-orchestrator`

**Agents (each can map to one or more LLM chains):**

#### Requirements Agent
- **Input:** action graph
- **Output:**
  - High-level requirements (user stories / acceptance criteria)
  - Traceability mapping: requirement ↔ actions ↔ pages

#### Test Case Agent
- **Input:** action graph + requirements
- **Output:**
  - Structured test cases (Given/When/Then or step-based)
  - Variants: positive, negative, boundary, edge flows
  - Tags: priority, risk, area

#### Automation Agent (Playwright / API / etc.)
- **Input:** action graph + test cases + locator hints
- **Output:**
  - Playwright scripts (JS/TS)
  - API test skeletons (Postman / REST-assured / etc.) when network data is available
- **Uses LLM to:**
  - Choose robust locators (playwright locators, by role/test-id, not brittle XPaths)
  - Split flows into reusable functions/page objects

#### Accessibility Agent
- **Input:** accessibility segments from action graph
- **Output:**
  - WCAG 2.x / Section 508 issues ("Button lacks accessible name", "Color contrast too low")
  - Suggested fixes

#### Performance Agent
- **Input:** performance metrics per action
- **Output:**
  - Calls out slow endpoints / components
  - Suggestions: caching, lazy loading, bundling improvements

#### Security Agent (optional / phased)
- **Input:** network patterns, form fields, URLs
- **Output:**
  - Basic security test ideas (SQL injection, XSS entry points, auth boundaries)
  - **Do NOT run real exploits without explicit config** – only generate tests

#### Defect/Anomaly Agent
- **Input:** action graph + known failures (e.g., from manual "Mark Step Failed")
- **Output:**
  - Draft defect descriptions with repro steps, expected vs actual, screenshots
  - Direct integration with Jira / Azure DevOps

Each agent is stateless and triggered via messages:
- from the Action Graph Builder,
- or from UI actions ("Generate Tests", "Generate Defects").

### 4.4 Storage & Integration Layer

- **Graph Store** – Flowstral Action Graphs (e.g., Neo4j, PostgreSQL with JSONB, or a graph DB)
- **QA DB** – requirements, test cases, runs, defects
- **Code Repo Integration:**
  - GitHub/GitLab/Azure DevOps connectors
  - Push generated scripts as PRs
  - Link tests ↔ files ↔ flows

## 5. Flowstral Action Graph – Core Schema

You don't need to overcomplicate, but you need consistent fields.

### Node (Screen/State):
```json
{
  "id": "...",
  "urlPattern": "/checkout",
  "title": "Checkout Page",
  "keyElements": ["Order Summary", "Payment Form", "Submit Button"],
  "screenshotUrl": "...",
  "a11ySummary": { "violations": 2, "critical": 0 },
  "perfSummary": { "lcp": 1200, "fcp": 800 },
  "metadata": {
    "app": "E-commerce App",
    "environment": "staging",
    "timestamp": "2025-11-17T20:00:00Z"
  }
}
```

### Edge (Action):
```json
{
  "id": "...",
  "fromNodeId": "...",
  "toNodeId": "...",
  "actionType": "ClickButton",
  "description": "User clicks 'Place Order'",
  "locators": {
    "primary": "button[data-testid='place-order']",
    "fallback": "button:has-text('Place Order')"
  },
  "inputs": { "sanitized": true },
  "expectedOutcome": "Order confirmation page loads",
  "perfMetrics": { "latency": 450, "errorCodes": [] },
  "a11yImpacts": ["Button has accessible name"]
}
```

**Everything your QA product does is derived from this graph.**

## 6. End-to-End User Flows

### 6.1 Record-First Flow (Ideal Demo & Adoption Flow)

1. User opens app under test
2. Opens Flowstral extension → clicks **Start Flowstral**
3. Content script records actions + metrics
4. User finishes flow → clicks **Stop & Generate**
5. Extension uploads events → backend builds Action Graph
6. Agent Orchestrator triggers:
   - Requirements Agent
   - Test Case Agent
   - Automation Agent
   - A11y & Perf Agents
7. UI (your QA platform) shows:
   - Flowstral Action Graph visualization
   - Generated requirements
   - Generated test cases with linked scripts
   - Detected issues (accessibility/perf)
8. User:
   - Edits/approves test cases
   - Pushes automation scripts to repo
   - Logs any suggested defects straight to Jira

### 6.2 Requirements-First Flow (For Teams with Existing Specs)

1. Import requirements from Jira / Confluence via your main QA platform
2. LLM uses requirements to suggest:
   - Candidate flows
   - Missing coverage
3. User can:
   - Generate initial test cases
   - Then use Flowstral extension to bind real flows to those test cases:
     - "Attach Flowstral recording to Requirement #123"
4. After recording, you:
   - Update test cases with precise steps
   - Generate robust scripts

**You don't have to choose one** — but Flowstral's unique value is the record-first, multi-dimensional analysis (test + a11y + perf + security hints).

## 7. Handling Cross-Origin & Enterprise Constraints

### 7.1 How Extension Improves Cross-Origin

**Content scripts run in the page context:**
- They can access the DOM of the page they are injected into (subject to host permissions)

**For iframes:**
- You can access iframes that share the same origin
- For third-party iframes (strict cross-origin), you:
  - Still see high-level events (click positions, focus changes)
  - Can fall back to visual/screenshot + hints instead of deep DOM

**For network:**
- Use `performance.getEntriesByType("resource")` in the page
- Or `chrome.devtools` API (if you add a devtools panel) for network logs

### 7.2 Enterprise Concerns & Approvals

**Design the extension to be enterprise-friendly:**

**Support two modes:**
- **Cloud** – calls your SaaS backend (for SMB / cloud clients)
- **On-Prem** – all endpoints configurable, pointing to client's own cluster (no data leaves their network)

**Permissions:**
- Minimize host permissions; allow admins to configure allowlisted domains
- Provide a "Security & Privacy Whitepaper":
  - No PII recording
  - No cookies/session tokens
  - Optional self-hosted endpoints

**Publishing:**
- Chrome Web Store listing for general use
- Alternatively, enterprise distribution:
  - Provide CRX and update URL for internal deployment (G Suite / MDM)

## 8. Flowstral "Do & Don't" Rules (Product Guardrails)

### 8.1 Do

✅ **Do record semantic actions, not raw noise:**
- Merge low-level events into meaningful steps

✅ **Do capture context:**
- DOM attributes for robust selectors
- A11y + perf + network metrics per action

✅ **Do provide immediate feedback in the extension:**
- Show step count, last action description

✅ **Do allow testers to annotate:**
- "Mark this step as bug"
- "Add note / expected result"

✅ **Do support partial uploads:**
- Long flows can be chunked/streamed

✅ **Do version everything:**
- Action Graph version
- Test case version
- Script version; maintain traceability

### 8.2 Don't

❌ **Don't record sensitive values:**
- Passwords, credit cards, tokens, SSNs – always masked/hashed/ignored

❌ **Don't capture full HTML or raw network bodies by default:**
- Only minimal metadata; leave deep captures as opt-in

❌ **Don't auto-run destructive flows on production:**
- "Delete user", "Charge card", etc. should be flagged, require explicit confirmation

❌ **Don't generate flake-prone locators:**
- Avoid pure XPaths or dynamic indexes

❌ **Don't block the tester's UI:**
- Recording must feel lightweight (no "freeze while we upload")

❌ **Don't tie extension tightly to a single backend URL:**
- Make endpoints configurable per-tenant for on-prem

## 9. On-Prem & Multi-Client Scaling Pattern

### 9.1 Standardized On-Prem Package

Deliver a Helm chart or Terraform module with:
- `flowstral-gateway` (ingestion/API)
- `flowstral-action-graph-builder`
- `flowstral-agent-orchestrator`
- `llm-proxy` (talks to:
  - client's GPU cluster
  - or their chosen LLM provider behind firewall)
- `qa-platform-core` (if they host your whole app on-prem)
- vector-db / DB (Postgres + pgvector / OpenSearch)
- Observability (Prometheus/Grafana dashboards pre-wired)

### 9.2 Multi-Tenant Pattern

Each client has its own environment (namespace / cluster or at least separate DB).

The same extension is used everywhere; only the base URL + tenantId change.

**Provisioning flow:**
1. Customer signs
2. You deploy standard stack with minimal config (domain, certs, LLM endpoint, storage)
3. Provide them:
   - Extension configuration file (points to their endpoint)
   - SSO setup instructions

### 9.3 Where Your LLMs Fit In On-Prem

`llm-proxy` container inside client infra:
- Talks to:
  - Their GPU (DGX, etc.), or
  - Their private API endpoints (OpenAI/Azure, Anthropic, etc. through a VNET)
- Your agents call `llm-proxy`, not public internet

This keeps the rest of your code identical between cloud and on-prem.

## 10. Where to Use Your LLMs Specifically (Quick Mapping)

### Action Normalization & Intent Detection
- Turn raw DOM events → semantic steps & action types

### Flowstral Action Graph Summarization
- Name screens & flows
- Group low-value noise into meaningful segments

### Requirements Generation
- Derive user stories & acceptance criteria from action graph

### Test Case Authoring
- Generate BDD / step-based test cases with clear preconditions & assertions

### Automation Code Synthesis
- Generate Playwright / Cypress / REST / performance scripts
- Suggest page objects & reusable functions

### A11y & Perf Narrative
- Turn raw metrics into human-readable recommendations

### Defect Drafting
- Convert failed steps into bug reports with repro steps, expected vs actual

### Maintenance / Drift Handling (Future Kicker Feature)
- Compare old Action Graph vs new recording:
  - Suggest updates to locators
  - Explain impact on existing tests
  - Auto-patch scripts (PR to repo)

---

## Implementation Checklist

- [ ] Chrome Extension (Manifest v3, Content Script, Background Worker, Side Panel UI)
- [ ] Ingestion API (Gateway with auth, validation, event batching)
- [ ] Action Graph Builder (Session segmentation, LLM-based semantic labeling, graph construction)
- [ ] Agent Orchestrator (Requirements, Test Case, Automation, A11y, Perf, Security, Defect agents)
- [ ] Storage Layer (Graph store, QA DB, repo integration)
- [ ] Privacy Guards (PII masking, sensitive field detection)
- [ ] Enterprise Features (On-prem config, domain allowlisting, multi-tenant)
- [ ] Record-First Flow (Default demo flow)
- [ ] Requirements-First Flow (Alternative flow for teams with existing specs)
- [ ] Action Graph Schema (Nodes as Screens/States, Edges as Actions)



