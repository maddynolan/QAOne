# Deployment & Data Architecture Guide

> **Where does my data go, who can see it, and how do I deploy?**
> Covers SaaS, on-prem, hybrid, desktop, and air-gapped deployments.
> Last updated: 2026-02-24

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Deployment Options & Cost Comparison](#2-deployment-options--cost-comparison)
3. [Data Architecture — Where Everything Is Stored](#3-data-architecture--where-everything-is-stored)
4. [Multi-Team Access & Organization Model](#4-multi-team-access--organization-model)
5. [Test Data by Type](#5-test-data-by-type)
6. [Version Control for No-Code Tests](#6-version-control-for-no-code-tests)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Storage Comparison Matrix](#8-storage-comparison-matrix)

---

## 1. Overview & Architecture

Flowstral uses the same Docker images across all deployment modes. The only differences are environment variables and which services are enabled.

```
                          Flowstral Platform
                          ==================

  +--------------------+  +---------------------+  +--------------------+
  |   SaaS (Cloud)     |  |   On-Prem (Docker)  |  | Desktop (Electron) |
  |                    |  |                     |  |                    |
  | React SPA          |  | React SPA (nginx)   |  | React SPA (file://) |
  | (Cloudflare Pages) |  | (Docker container)  |  | (BrowserWindow)    |
  |        |           |  |        |            |  |        |           |
  |    FastAPI         |  |    FastAPI          |  |   SQLite (local)   |
  |   (Railway)        |  |   (Docker)          |  |   better-sqlite3   |
  |        |           |  |        |            |  |        |           |
  |  PostgreSQL        |  |  PostgreSQL 16      |  |   Sync Queue ----->+
  |  (Supabase)        |  |  (pgvector)         |  |   to Cloud/On-Prem |
  |        |           |  |        |            |  +--------------------+
  |  Supabase Storage  |  |  MinIO (S3)         |
  |  (S3-compatible)   |  |  Redis (queues)     |
  +--------------------+  +---------------------+
                               |
                          +----+------+
                          | Air-Gapped |
                          | (no net)   |
                          | + Ollama   |
                          | (local LLM)|
                          +-----------+
```

**Key Principle:** One codebase, four deployment modes. Test cases, runs, and defects are stored in PostgreSQL everywhere (Supabase in cloud, self-hosted in on-prem, SQLite in desktop). The desktop app syncs to whichever backend is configured.

---

## 2. Deployment Options & Cost Comparison

### 2.1 Deployment Tool Comparison

| Deployment Stack | Best For | Monthly Cost | Hybrid Ready | Config File |
|-----------------|----------|-------------|-------------|-------------|
| **Cloudflare Pages + Railway + Supabase** | SaaS free trials | **$5/mo** | No | Current stack |
| **Hetzner + Coolify** | Budget SaaS + on-prem | **$15-25/mo** | Yes | `docker-compose.full.yml` |
| **Kamal + Hetzner** | True hybrid (same tool, cloud + on-prem) | **$10-25/mo** | Yes | Same Docker images |
| **Railway + Vercel + Supabase** | Current production SaaS | $50-100/mo | No | Railway dashboard |
| **Kubernetes + Helm** | Enterprise on-prem (50+ users) | $100+/mo (infra) | Yes | `helm/qaai/values.yaml` |
| **Docker Compose** | Small on-prem (5-20 users) | $5-20/mo (VPS) | Partial | `docker-compose.full.yml` |
| **Air-Gapped Docker** | Regulated/classified environments | Hardware only | No | `docker-compose.air-gapped.yml` |

### 2.2 Recommended Phased Approach

#### Phase 1: Free Trials ($5/month)

| Component | Tool | Cost | Why |
|-----------|------|------|-----|
| Frontend | Cloudflare Pages | Free | Unlimited bandwidth, global CDN, Git deploys |
| Backend | Railway Hobby | $5/mo | $5 credit included, Git-push deploys |
| Database | Supabase Free | Free | 500 MB, 50K MAU, auth built-in |
| Redis | Upstash Free | Free | 10K commands/day, serverless |
| Object Storage | Cloudflare R2 | Free | 10 GB free, zero egress fees |
| CI/CD | GitHub Actions | Free | 2,000 min/month, workflows already built |

#### Phase 2: First Paying Customers ($20-40/month)

| Component | Upgrade To | Cost |
|-----------|-----------|------|
| Frontend | Cloudflare Pages (still free) | $0 |
| Backend + DB + Redis | **Hetzner CX33 + Coolify** | $8/mo |
| Database | Self-hosted PostgreSQL 16 on Hetzner | $0 (same server) |
| Object Storage | Cloudflare R2 | $1-3/mo |
| On-Prem Option | Same Docker images on customer hardware | $0 |

**Why Coolify?** Web dashboard (like Vercel), Git-push deploys, auto-SSL, and the same Docker containers work on any server -- cloud or on-prem.

#### Phase 3: Scale & Enterprise ($40-100/month)

| Component | Scale To | Cost |
|-----------|---------|------|
| Frontend | Cloudflare Pages + Pro CDN | $0-20/mo |
| Backend | Hetzner CX43 (8 vCPU, 16 GB) | $16/mo |
| Database | Dedicated Hetzner server + PG 16 | $8-16/mo |
| Object Storage | Cloudflare R2 | $5-15/mo |
| On-Prem Enterprise | Helm chart (`helm/qaai/`) on customer K8s | $0 (customer hardware) |
| Air-Gapped | `docker-compose.air-gapped.yml` + Ollama | $0 (customer hardware) |

### 2.3 Per-Deployment Configuration

#### SaaS (Cloud)

```
Frontend:  Cloudflare Pages or Vercel (static React build)
Backend:   Railway or Hetzner+Coolify (FastAPI container)
Database:  Supabase PostgreSQL (managed, with RLS)
Storage:   Supabase Storage or Cloudflare R2 (S3-compatible)
Auth:      Supabase Auth (JWT + OAuth)
LLM:       OpenAI gpt-4o-mini (OPENAI_API_KEY required)
Redis:     Upstash (serverless) or self-hosted
```

#### On-Prem (Docker Compose)

```bash
# File: docker-compose.full.yml
# Services: PostgreSQL 16 (pgvector), MinIO, Redis, Backend, Frontend, Test Workers
docker-compose -f docker-compose.full.yml up -d

# Environment:
DATABASE_URL=postgresql://qaai:password@postgres:5432/qaai
S3_ENDPOINT_URL=http://minio:9000
REDIS_URL=redis://redis:6379
DEFAULT_LLM_PROVIDER=openai          # Cloud API keys still needed
```

#### On-Prem (Kubernetes / Helm)

```bash
# File: helm/qaai/values.yaml
# Features: autoscaling (2-10 replicas), resource limits, ingress with TLS
helm install qaai ./helm/qaai \
  --namespace qaai \
  --set backend.image.tag=v3.13.0 \
  --set ingress.hosts[0].host=flowstral.company.com
```

#### Air-Gapped (No Internet)

```bash
# File: docker-compose.air-gapped.yml
# Additional: Ollama with local LLM model (no cloud API calls)
AIR_GAPPED_MODE=true
DEFAULT_LLM_PROVIDER=local_qwen      # Uses Ollama locally
OLLAMA_URL=http://ollama:11434
# No OPENAI_API_KEY or ANTHROPIC_API_KEY needed
```

#### Desktop (Electron)

```
Storage:   SQLite (better-sqlite3) at ~/.config/Flowstral/data/flowstral.db
Settings:  electron-store at ~/.config/Flowstral/Electron Store/config.json
Sync:      CloudConnector WebSocket to configured backend URL
LLM:       Via backend API (cloud or on-prem, configured in settings)
```

### 2.4 Tool Recommendations

**Coolify** (recommended for most teams):
- Free, self-hosted on any VPS (Hetzner $8/mo is the sweet spot)
- Web dashboard with Git-push deploys, auto-SSL, monitoring
- Same Docker containers work in cloud AND on customer hardware
- 280+ one-click services (PostgreSQL, Redis, MinIO all included)

**Kamal** (recommended for hybrid):
- From 37signals (runs Basecamp & HEY in production)
- Zero server-side overhead -- deploys via SSH + Docker
- Same YAML config deploys to cloud VPS or customer bare metal
- Zero-downtime deploys, canary releases, rolling restarts

**Cloudflare R2** (recommended for all deployments):
- S3-compatible API, drop-in replacement
- **Zero egress fees** (vs AWS S3 at $0.09/GB)
- 10 GB free tier, then $0.015/GB/month
- Use for test artifacts (screenshots, videos, HAR files)

---

## 3. Data Architecture -- Where Everything Is Stored

### 3.1 Database Schema (30 Supabase Migrations)

```
organizations (id, name, slug, settings JSONB)
    |
    +-- org_memberships (org_id, user_id, role: owner|admin|member|viewer)
    |
    +-- tenant_config (tenant_id, org_id, llm_provider, max_storage_gb, features JSONB)
    |
    +-- projects (id, org_id, name, slug, settings JSONB)
            |
            +-- project_memberships (project_id, user_id, role)
            |
            +-- test_plans (id, project_id, name, status, milestone, sprint)
            |       |
            |       +-- test_cases (id, project_id, plan_id, title, steps JSONB,
            |               test_type, status, tags[], priority, created_by)
            |
            +-- test_runs (id, project_id, plan_id, status, environment, branch)
            |       |
            |       +-- test_run_steps (id, run_id, case_id, status, duration_ms)
            |       |       |
            |       |       +-- artifacts (id, run_id, step_id, type, url, size_bytes)
            |       |
            |       +-- triage_analysis (id, run_id, step_id, root_cause, category)
            |
            +-- defects (id, project_id, run_id, step_id, title, severity, status)
            |
            +-- requirements (id, project_id, title, acceptance_criteria)
            |       +-- test_case_requirements (test_case_id, requirement_id)  M:N
            |       +-- requirement_embeddings (requirement_id, embedding vector)
            |
            +-- flowstral_sessions (id, project_id, user_id, initial_url)
            |       +-- action_graph_nodes (id, session_id, event_type, selector)
            |       |       +-- dom_snapshots (html_structure, css_state JSONB)
            |       |       +-- wcag_snapshots (violations JSONB)
            |       |       +-- performance_snapshots (page_level JSONB)
            |       +-- action_graph_edges (from_node_id, to_node_id)
            |       +-- flowstral_artifacts (artifact_type, artifact_data JSONB)
            |
            +-- element_models (element_name, identifiers JSONB, success_rate)
            |       +-- element_model_usage (element_id, identifier_used, success)
            |
            +-- page_objects (name, url_pattern)
            |       +-- page_elements (selector_layer1_gold ... layer5_clay)
            |               +-- test_case_element_mappings (test_case_id, step_index)
            |
            +-- perf_runs (test_script, options JSONB, result JSONB)
            |       +-- perf_metrics (metric_name, value, unit, timestamp)
            |       +-- perf_findings (finding_type, severity)
            |
            +-- accessibility_scans (url, project_id)
            |       +-- accessibility_issues (rule, impact, wcag_criterion)
            |       +-- a11y_findings (issue_type, severity, element)
            |
            +-- exploration_runs (base_url, total_pages_discovered)
            |       +-- capability_maps (capability_data JSONB)
            |
            +-- secrets (name, encrypted_value BYTEA)  -- Fernet encryption
            +-- compliance_mappings (test_case_id, framework, requirement_id)
            +-- compliance_reports (frameworks JSONB, report_data JSONB)

users (id, email, name, avatar_url, preferences JSONB)
roles (id, name, permissions JSONB, tenant_id)
user_roles (user_id, role_id, tenant_id)
audit_logs (tenant_id, user_id, action, resource_type, details JSONB, hash SHA-256)
ai_generation_audit (project_id, model, prompt_tokens, cost_usd)
sync_queue (entity_type, entity_id, operation, status)  -- offline sync
```

### 3.2 Storage Tiers

| Tier | Technology | What It Stores | When Used |
|------|-----------|----------------|-----------|
| **PostgreSQL** | Supabase (SaaS) or pgvector/pg16 (on-prem) | All structured data: test cases, runs, plans, defects, requirements, recordings, element models, audit logs | Always -- primary store |
| **S3 / MinIO** | Supabase Storage (SaaS) or MinIO (on-prem) or Cloudflare R2 | Screenshots, videos, HAR files, traces, log files | Test run artifacts |
| **Redis** | Upstash (SaaS) or Redis 7 (on-prem) | Job queue, LLM response cache, session data | On-prem and scale deployments |
| **SQLite** | better-sqlite3 in Electron | Test cases, steps, runs, folders, sync queue | Desktop app (offline-first) |
| **Zustand + localStorage** | Browser storage | API collections, mobile flows, perf history, UI state | Frontend client-side |
| **In-memory** | Python dicts / deques | All entities (fallback when no DB) | Development / emergency fallback |
| **Filesystem** | Backend local disk | Visual testing baselines, actuals, diff images | Visual regression testing |

### 3.3 Key JSONB Structures

**Test case steps** (stored in `test_cases.steps`):
```json
[
  {
    "action": "click",
    "selector": "button#submit",
    "expectedResult": "Form submits successfully",
    "testData": { "username": "testuser" },
    "isAutomated": true,
    "automationCode": "await page.click('#submit')"
  }
]
```

**Element model identifiers** (stored in `element_models.identifiers`):
```json
[
  { "type": "data-testid", "value": "submit-btn", "priority": 1, "confidence": 0.98 },
  { "type": "role",        "value": "button",     "priority": 2, "confidence": 0.90 },
  { "type": "text",        "value": "Submit",     "priority": 3, "confidence": 0.85 },
  { "type": "css",         "value": "#submit",    "priority": 4, "confidence": 0.70 },
  { "type": "xpath",       "value": "//button",   "priority": 5, "confidence": 0.50 }
]
```

---

## 4. Multi-Team Access & Organization Model

### 4.1 Hierarchy

```
Acme Corp (Organization)
    |
    +-- Mobile App Team (Project "acme-mobile")
    |       +-- owner:  CTO (Sarah)
    |       +-- admin:  QA Lead (James)
    |       +-- member: 5 testers (create/edit tests, run tests)
    |       +-- viewer: 3 developers (read-only access)
    |
    +-- Web Portal Team (Project "acme-web")
    |       +-- owner:  CTO (Sarah)           -- inherited from org
    |       +-- admin:  Different QA Lead (Maria)
    |       +-- member: 8 testers
    |       +-- viewer: 5 developers
    |
    +-- API Platform Team (Project "acme-api")
            +-- owner:  CTO (Sarah)           -- inherited from org
            +-- admin:  API Lead (David)
            +-- member: 4 testers
            +-- viewer: 10 developers
```

### 4.2 Role Permissions

| Permission | Owner | Admin | Member | Viewer |
|-----------|-------|-------|--------|--------|
| View test cases | Yes | Yes | Yes | Yes |
| Create/edit test cases | Yes | Yes | Yes | No |
| Delete test cases | Yes | Yes | No | No |
| Execute test runs | Yes | Yes | Yes | No |
| Manage defects | Yes | Yes | Yes | No |
| Manage test plans/releases | Yes | Yes | No | No |
| Manage project settings | Yes | Yes | No | No |
| Manage members/roles | Yes | Yes | No | No |
| Manage organization | Yes | No | No | No |
| Configure tenant (LLM, limits) | Yes | No | No | No |

### 4.3 How Isolation Works

**Three enforcement layers:**

1. **Backend Middleware** (`backend/app/middleware/tenant_middleware.py`):
   - Extracts `tenant_id` from JWT token or `X-Tenant-ID` header
   - Sets `request.state.tenant_id` and `request.state.user_id`
   - Every API call is scoped to the authenticated tenant

2. **RBAC Middleware** (`backend/app/middleware/rbac_middleware.py`):
   - Loads user permissions per tenant from `roles` + `user_roles` tables
   - Route decorators: `@require_permission("test_cases:create")`, `@require_role("admin")`
   - Enforced BEFORE request handler executes

3. **Database RLS** (Supabase Row-Level Security on 13+ tables):
   ```sql
   -- Users can only see data in their organizations
   CREATE POLICY "Users can view own org test cases"
     ON test_cases FOR SELECT
     USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
   ```

4. **Frontend Guard** (`src/components/ProtectedRoute.tsx`):
   - Role hierarchy: owner (4) > admin (3) > member (2) > viewer (1)
   - Routes with `requiredRole="admin"` redirect viewers/members to UnauthorizedPage
   - `WorkspaceSwitcher` component allows org/project switching in sidebar

### 4.4 Data Isolation by Deployment

| Deployment | Isolation Method | Boundary |
|-----------|-----------------|----------|
| **SaaS** | Supabase RLS policies + JWT tenant claims | Row-level (shared database) |
| **On-Prem** | TenantContextMiddleware + RLS + network isolation | Row-level + network |
| **Dedicated On-Prem** | Separate PostgreSQL instance per customer | Database-level |
| **Desktop** | SQLite is per-installation on local device | Physical device |
| **Air-Gapped** | Complete physical network isolation | Network-level |

### 4.5 How Teams Switch Projects

The frontend provides `WorkspaceSwitcher` (`src/modules/platform/components/WorkspaceSwitcher.tsx`) with two dropdowns:

1. **OrganizationSwitcher** -- lists all orgs the user belongs to
2. **ProjectSwitcher** -- lists projects within the selected org

Switching updates `AuthContext` (`currentOrg`, `currentProject`), which triggers all data queries to re-fetch with the new project scope. The backend uses `project_id` from JWT claims to filter all responses.

---

## 5. Test Data by Type

### 5.1 Automated (Browser) Tests

| Data | Storage | Location |
|------|---------|----------|
| Test case definition | PostgreSQL `test_cases` table | `test_type = 'automated'`, steps JSONB with selectors |
| Recording sessions | PostgreSQL `flowstral_sessions` + action graph tables | DOM snapshots, WCAG violations, performance metrics per action |
| Element models | PostgreSQL `element_models` table | 5-layer selector strategy (gold/silver/bronze/iron/clay), success_rate tracking |
| Generated Playwright scripts | PostgreSQL `flowstral_artifacts` | `artifact_type = 'playwright_script'` |
| Execution results | PostgreSQL `test_runs` + `test_run_steps` | Per-step status, duration, error messages |
| Screenshots during execution | S3/MinIO via `artifacts` table | `type = 'screenshot'`, stored as PNG |
| Self-healing data | PostgreSQL `element_model_usage` | Tracks which identifier was used, success/failure, execution time |
| Failure analysis | PostgreSQL `triage_analysis` | AI-categorized root cause (locator/timing/network/data/environment) |

### 5.2 Manual Tests

| Data | Storage | Location |
|------|---------|----------|
| Test case definition | PostgreSQL `test_cases` table | `test_type = 'manual'`, steps as human-readable JSONB |
| Execution evidence | S3/MinIO via `artifacts` table | Screenshots, files uploaded during manual walkthrough |
| Step results | PostgreSQL `test_run_steps` | Pass/fail per step with notes |
| Comments | PostgreSQL `test_comments` table | Threaded comments on runs, cases, and steps |
| Defects raised | PostgreSQL `defects` table | Linked to `run_id` + `step_id` |

### 5.3 API Tests

| Data | Storage | Location |
|------|---------|----------|
| Collections & requests | **Browser localStorage** via Zustand | `apiTestingStore` with `persist` + `immer` middleware |
| Environments & variables | **Browser localStorage** via Zustand | Dev/staging/prod configs with variable substitution |
| Request chains | **Browser localStorage** via Zustand | Multi-step chains with JSONPath variable extraction |
| Execution results | **In-memory** (backend returns directly) | Not persisted to DB by default |
| Imported specs | **In-memory** during import | OpenAPI/Swagger/Postman specs parsed on-the-fly |
| Database connections | **In-memory** per session | Schema browsing via live queries to connected DB |

**Note:** API test collections are currently client-side only. They persist across browser sessions via localStorage but are not synced to the server database. Each user's collections are local to their browser.

### 5.4 Performance Tests

| Data | Storage | Location |
|------|---------|----------|
| Test history | **Browser localStorage** | Key: `flowstral-perf-history`, max 50 entries |
| Load configurations | **Browser localStorage** | Key: `load_test_configs` (VirtualUserGenerator) |
| Server-side scenarios | PostgreSQL `perf_runs` table | `test_script`, `options` JSONB, `result` JSONB |
| Time-series metrics | PostgreSQL `perf_metrics` table | `metric_name`, `value`, `unit`, `timestamp` per run |
| Performance findings | PostgreSQL `perf_findings` table | Severity, threshold comparisons |
| HAR imports | **In-memory** during import | Parsed and converted to test steps |

**Note:** In-browser execution (up to 20 VUs) stores results only in localStorage. Server-side execution (up to 10,000 VUs) persists to PostgreSQL.

### 5.5 Visual Tests

| Data | Storage | Location |
|------|---------|----------|
| Baseline images | **Backend filesystem** | `visual_testing/baselines/` directory |
| Actual screenshots | **Backend filesystem** | `visual_testing/actuals/` directory |
| Diff images | **Backend filesystem** | `visual_testing/diffs/` directory |
| Comparison metadata | **Backend filesystem** | `visual_testing/metadata/` directory |
| Comparison results | **In-memory** (returned to client) | Pass/fail, diff %, SSIM score, mismatch regions |

**Note:** Visual testing data is entirely filesystem-based on the backend. No database tables for visual results. Baselines are PNG files managed via REST API endpoints (`/api/visual-testing/baselines`).

### 5.6 Accessibility Tests

| Data | Storage | Location |
|------|---------|----------|
| Scan records | PostgreSQL `accessibility_scans` table | URL, project_id, timestamp |
| Violations | PostgreSQL `accessibility_issues` table | Rule, impact (critical/serious/moderate/minor), WCAG criterion |
| Detailed findings | PostgreSQL `a11y_findings` table | Issue type, severity, element snippet, suggested fix |
| Reports | **Generated on-demand** | HTML/JSON/Markdown format, not persisted |

### 5.7 Mobile Tests

| Data | Storage | Location |
|------|---------|----------|
| Test flows (YAML) | **Browser localStorage** via Zustand | `mobileTestingStore` with `persist` middleware |
| Flow folders | **Browser localStorage** via Zustand | Folder organization for flows |
| Test run results | **Browser localStorage** via Zustand | Status, duration, step pass/fail counts |
| Device screenshots | **In-memory** (base64 via IPC) | Real-time from device, not persisted |
| Device logs | **In-memory** (streamed via IPC) | logcat/syslog streamed in real-time |
| Element hierarchy | **In-memory** (parsed XML) | `uiautomator dump` XML parsed on-demand |
| Saved locations/profiles | **Browser localStorage** via Zustand | Deep links, geo locations, network profiles |

**Note:** Mobile test data is entirely client-side (Zustand + localStorage). The Electron desktop app communicates with devices via IPC → Maestro CLI / ADB / xcrun. No backend database tables for mobile-specific data.

---

## 6. Version Control for No-Code Tests

### 6.1 Current State

The platform currently tracks test case changes through:

| Mechanism | What It Tracks | Limitation |
|-----------|---------------|-----------|
| `status` enum | `draft` -> `active` -> `archived` -> `deprecated` | No rollback to previous content |
| `updated_at` timestamp | When the last edit happened | Not what changed |
| `created_by` field | Who created the test case | Not who made each edit |
| `audit_logs` table | User actions with SHA-256 hash (immutable) | Logs the event, not the content diff |
| `ai_generation_audit` | AI-generated test provenance (model, prompt, cost) | Only for AI-generated tests |
| Element model `success_rate` | Selector reliability over time | Element-level, not test-level |

**What is missing:**
- No `test_case_versions` or history table
- No diff tracking between edits (steps are a single JSONB blob)
- No branching/merging of test case variants
- No "undo" or "revert to version N" capability

### 6.2 How It Works Today

```
Create Test Case       Edit Test Case        Archive Test Case
     |                      |                      |
     v                      v                      v
status: "draft"        status: "active"       status: "archived"
steps: [...]           steps: [...updated]    steps: [...frozen]
updated_at: T1         updated_at: T2         updated_at: T3
                                              (immutable reference)

audit_log: "test_case.created"  "test_case.updated"  "test_case.archived"
```

The archived status effectively creates an immutable snapshot. Teams commonly duplicate a test case before major edits to preserve the original.

### 6.3 Recommended Version Control Architecture

A future implementation should add:

**New table: `test_case_versions`**
```sql
CREATE TABLE test_case_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id  UUID REFERENCES test_cases(id),
  version       INTEGER NOT NULL,
  change_type   VARCHAR(20),  -- 'created', 'modified', 'status_change'
  changed_by    UUID REFERENCES users(id),
  snapshot      JSONB NOT NULL, -- Full test case state at this version
  diff_summary  TEXT,           -- Human-readable: "Changed step 3 selector"
  parent_version_id UUID,       -- For branching: forked from which version
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(test_case_id, version)
);
```

**How it would work:**
1. Every save creates a new version row with the full JSONB snapshot
2. `diff_summary` computed by comparing consecutive versions
3. UI shows version timeline with "Revert to version N" button
4. `parent_version_id` enables branching (fork a test case for a feature branch)
5. Integrates with existing `audit_logs` for "who changed what when"
6. Desktop sync queue would include version snapshots for offline editing

**Git-like metaphor for teams:**
- `main` version = the `active` test case
- `draft` = working branch (editable)
- `archived` = tagged release (immutable)
- Fork = duplicate with `parent_version_id` linking back to original

---

## 7. Data Flow Diagrams

### 7.1 SaaS Data Flow

```
User Browser / Chrome Extension
        |
        | HTTPS
        v
Cloudflare Pages (CDN) -----> React SPA (static assets)
        |
        | axios (HTTPS)
        v
Railway (FastAPI backend)
        |
        +--------+--------+---------+
        |        |        |         |
        v        v        v         v
  Supabase   Supabase   OpenAI   Upstash
  PostgreSQL  Storage   gpt-4o   Redis
  (data)     (artifacts) (AI)    (queues)
```

### 7.2 Desktop Offline-First Data Flow

```
React SPA (in Electron BrowserWindow)
        |
   electron-bridge.ts (IPC abstraction)
        |
   webapp-preload.js (context bridge)
        |
   Main Process (index.js)
        |
   +----+----+
   |         |
   v         v
SQLite    CloudConnector
(WAL mode)  (WebSocket)
   |         |
   +-- test_cases          |
   +-- test_steps          |
   +-- test_runs           |
   +-- folders             |
   +-- sync_queue -------->+
       (pending ops)       |
                           v
                    Backend API (Railway or On-Prem)
                           |
                    Mark synced in SQLite
```

**Sync behavior:**
- All writes go to SQLite immediately (no network dependency)
- Writes also add an entry to `sync_queue` with `operation` (create/update/delete)
- `CloudConnector` watches the queue and POSTs to the configured backend when online
- On success, the queue entry is marked as `synced`
- On failure, retries with exponential backoff
- Full-text search via SQLite FTS5 works entirely offline

### 7.3 Hybrid Data Flow

```
CLOUD (Hetzner/Railway)              ON-PREM (Customer DC)
+-------------------------+          +-------------------------+
| Coolify / Kamal manages |          | Same Docker images      |
|                         |          |                         |
| FastAPI (Docker)        |          | FastAPI (Docker)        |
| PostgreSQL (Docker)     |          | PostgreSQL (Docker)     |
| MinIO (Docker)          |          | MinIO (Docker)          |
| Redis (Docker)          |          | Redis (Docker)          |
|                         |          |                         |
| SaaS customers -------->|          |<-------- On-prem teams  |
+-------------------------+          +-------------------------+
         ^                                    ^
         |                                    |
    Desktop Agents                      Desktop Agents
    (sync to cloud)                     (sync to on-prem)

    Configured via Settings:            Configured via Settings:
    API URL = cloud.flowstral.com       API URL = flowstral.internal
```

**Key hybrid principle:** Desktop agents can point to either cloud or on-prem backends via the Settings page. The `API_BASE_URL` in the Electron app determines where data syncs. Teams at the same company can have some users on cloud and others on on-prem -- the backend APIs are identical.

---

## 8. Storage Comparison Matrix

### Where Each Data Type Lives

| Data Type | SaaS | On-Prem | Desktop | Air-Gapped |
|-----------|------|---------|---------|------------|
| **Test cases** | Supabase PG | Docker PG 16 | SQLite + sync queue | Docker PG 16 |
| **Test steps** | JSONB in test_cases | JSONB in test_cases | SQLite test_steps table | JSONB in test_cases |
| **Test plans** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Test suites** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Releases** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Test runs/results** | Supabase PG | Docker PG 16 | SQLite + sync queue | Docker PG 16 |
| **Screenshots/videos** | Supabase Storage (S3) | MinIO | Local filesystem | MinIO |
| **API collections** | Browser localStorage | Browser localStorage | Browser localStorage | Browser localStorage |
| **API environments** | Browser localStorage | Browser localStorage | Browser localStorage | Browser localStorage |
| **Perf test history** | Browser localStorage | Browser localStorage + PG | Browser localStorage | Browser localStorage + PG |
| **Visual baselines** | Backend filesystem | Backend filesystem | Not available | Backend filesystem |
| **A11y scan results** | Supabase PG | Docker PG 16 | Not available (web only) | Docker PG 16 |
| **Mobile flows (YAML)** | Browser localStorage | Browser localStorage | Zustand + IPC | Browser localStorage |
| **Recordings** | Supabase PG (JSONB) | Docker PG 16 | SQLite | Docker PG 16 |
| **Action graphs** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Element models** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Defects** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Requirements** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Secrets** | Supabase PG (pgcrypto) | Docker PG 16 (pgcrypto) | Not available | Docker PG 16 (pgcrypto) |
| **Audit logs** | Supabase PG (immutable) | Docker PG 16 (immutable) | Not available | Docker PG 16 (immutable) |
| **AI generation logs** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **Embeddings (RAG)** | Supabase PG (pgvector) | Docker PG 16 (pgvector) | Not available | Docker PG 16 (pgvector) |
| **Full-text search** | PG full-text search | PG full-text search | SQLite FTS5 | PG full-text search |
| **Compliance reports** | Supabase PG | Docker PG 16 | Not available | Docker PG 16 |
| **LLM provider** | OpenAI gpt-4o-mini | OpenAI/Anthropic (cloud keys) | Via backend API | Ollama (local Qwen) |

### Storage Limits by Deployment

| Resource | SaaS (Supabase Free) | SaaS (Supabase Pro) | On-Prem | Desktop |
|----------|---------------------|--------------------|---------|---------|
| Database | 500 MB | 8 GB (expandable) | Unlimited (disk) | Unlimited (SQLite) |
| File storage | 1 GB | 100 GB | Unlimited (MinIO) | Local disk |
| Bandwidth | 2 GB/month | 250 GB/month | Unlimited (LAN) | N/A |
| MAU (auth) | 50,000 | Unlimited | Unlimited | N/A |
| Realtime connections | 200 concurrent | 500 concurrent | Unlimited | 1 (local) |

---

## Appendix A: Supabase Migration Files

| # | File | Key Tables/Changes |
|---|------|-------------------|
| 001 | `initial_schema.sql` | organizations, projects, users, memberships, test_plans, test_cases, test_runs, test_run_steps, artifacts, defects, requirements, sync_queue, RLS policies |
| 002 | `ai_generation_tracking.sql` | ai_generations (LLM call logging for fine-tuning) |
| 003 | `self_healing_tracking.sql` | healing_attempts, healing_results |
| 004 | `requirement_embeddings.sql` | requirement_embeddings (pgvector), checksum deduplication |
| 005 | `test_comments.sql` | test_comments (threaded comments on runs/cases/steps) |
| 006 | `test_data_management.sql` | test_data, test_data_templates |
| 007-011 | Various enhancements | Indexes, views, performance optimizations |
| 012 | `tenant_config.sql` | tenant_config (per-tenant LLM, limits, features), auto-populate triggers |
| 013 | `requirement_traceability.sql` | test_case_requirements M:N junction |
| 014-016 | Security & compliance | secrets (Fernet encrypted), compliance_mappings |
| 017 | `perf_test_results.sql` | perf_runs, perf_metrics, perf_findings |
| 018 | `accessibility_results.sql` | accessibility_scans, accessibility_issues |
| 019-020 | Accessibility v2 | a11y_findings, enhanced violation tracking |
| 021 | `flowstral_action_graph.sql` | flowstral_sessions, action_graph_nodes/edges, dom/wcag/performance_snapshots |
| 022-025 | Exploration & mapping | exploration_runs, capability_maps, blaze sessions |
| 026 | `audit_log.sql` | audit_logs (immutable, SHA-256 hashed) |
| 027-028 | Page object model | page_objects, page_elements (5-layer selectors), test_case_element_mappings |
| 029 | `element_models.sql` | element_models (Tosca-style), element_model_usage |
| 030 | `compliance_reports.sql` | compliance_reports, framework mappings |

---

## Appendix B: Related Documentation

| Document | Content |
|----------|---------|
| [Enterprise Security Guide](./ENTERPRISE-SECURITY-GUIDE.md) | Authentication, RBAC, encryption, rate limiting, container security |
| [On-Prem Deployment Runbook](./ON-PREM-DEPLOYMENT-RUNBOOK.md) | Docker Compose, Kubernetes, air-gapped deployment steps |
| [SaaS Deployment Guide](./SAAS-DEPLOYMENT-GUIDE.md) | Railway, Vercel, Supabase setup and scaling |
| [Platform Master Document](./PLATFORM_MASTER_DOCUMENT.md) | Complete platform architecture reference |

---

## Appendix C: Key Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.full.yml` | On-prem production stack (PG, MinIO, Redis, backend, frontend, workers) |
| `docker-compose.air-gapped.yml` | Air-gapped stack with Ollama |
| `helm/qaai/values.yaml` | Kubernetes Helm chart (autoscaling, resources, ingress) |
| `.github/workflows/ci.yml` | CI pipeline (build + test + Docker) |
| `.github/workflows/deploy-production.yml` | Production deploy on release |
| `nginx/default.conf` | OWASP security headers, API proxy, rate limiting |
| `backend/app/middleware/tenant_middleware.py` | Multi-tenant isolation |
| `backend/app/middleware/rbac_middleware.py` | Permission enforcement |
| `backend/app/middleware/rate_limit_middleware.py` | API rate limiting |
| `flowstral-desktop/src/main/sqlite-storage.js` | Desktop SQLite schema + FTS5 |
| `flowstral-desktop/src/main/cloud-connector.js` | Desktop ↔ cloud sync |
| `src/lib/supabase-service.ts` | Frontend Supabase client + typed services |
| `src/lib/api-config.ts` | API endpoint definitions + base URL resolution |
