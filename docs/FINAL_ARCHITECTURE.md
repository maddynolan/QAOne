# 🏗️ Final Architecture: Multi-Agent QA Platform

**Version:** 2.0  
**Status:** Baseline Established - Implementation In Progress  
**Last Updated:** 2025-01-XX

---

## 📋 Executive Summary

This document defines the **final locked architecture** for the QA AI Platform - a multi-agent, scalable, on-prem capable testing platform with specialized agents for requirements, automation, performance, accessibility, and security testing.

### Core Principles

1. **Multi-Agent Architecture**: Specialized agents for different QA domains
2. **Model Gateway**: Unified LLM access (local Qwen 30B + cloud APIs)
3. **Agent Orchestrator**: Central coordination for agent workflows
4. **On-Prem Ready**: Docker/Helm packaging for enterprise deployments
5. **Multi-Tenant**: Full tenant isolation at data and service level
6. **Plugin Ecosystem**: IDE and browser extensions for seamless integration

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│  Dashboard | Test Cases | Runs | Triage | Requirements | Settings   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (FastAPI)                             │
│  Auth | Projects | Test Cases | Runs | Defects | Traceability       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│    Agent Orchestrator        │  │     Model Gateway            │
│  • Workflow Engine           │  │  • Local LLM (Qwen 30B)     │
│  • Agent Coordination        │  │  • Cloud APIs (OpenAI/etc)  │
│  • Task Queue                │  │  • Token/Cost Tracking      │
└──────────────┬───────────────┘  └──────────────┬───────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              ▼
        ┌─────────────────────────────────────┐
        │      Specialized Agents              │
        ├─────────────────────────────────────┤
        │ 1. Requirements Intelligence Agent   │
        │ 2. Functional Automation Agent       │
        │ 3. Performance Testing Agent         │
        │ 4. Accessibility Agent               │
        │ 5. Security Agent                    │
        └──────────────┬───────────────────────┘
                       │
        ┌──────────────┴───────────────────────┐
        ▼                                      ▼
┌──────────────────┐              ┌──────────────────┐
│  Test Runner     │              │  External Tools  │
│  Service         │              │  • Playwright    │
│  • Docker Workers│              │  • k6/Locust     │
│  • Queue System  │              │  • ZAP           │
│  • Artifact Store│              │  • axe-core      │
└──────────────────┘              └──────────────────┘
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
        ┌─────────────────────────────────────┐
        │         Data Layer                   │
        │  • PostgreSQL (Multi-tenant)         │
        │  • Vector DB (pgvector/Qdrant)      │
        │  • Object Store (S3/MinIO)          │
        │  • Cache (Redis)                    │
        └─────────────────────────────────────┘
```

---

## 📊 Current State Assessment

### ✅ Already Implemented

#### Core Infrastructure
- ✅ **FastAPI Backend** (`backend/app/main.py`)
- ✅ **PostgreSQL Database** with migrations
- ✅ **Orchestrator Service** (`backend/app/services/orchestrator.py`)
- ✅ **Object Store** (`backend/app/services/object_store.py`)
- ✅ **Run Matrix System** (`backend/app/services/run_matrix.py`)
- ✅ **RAG Service** (`backend/app/services/rag_service.py`)
- ✅ **Embedding Service** (`backend/app/services/embedding_service.py`)

#### Executors & Tools
- ✅ **Playwright Runner** (`backend/app/services/playwright_runner.py`)
- ✅ **k6 Executor** (`backend/app/services/k6_executor.py`)
- ✅ **ZAP Executor** (`backend/app/services/zap_executor.py`)
- ✅ **Accessibility Compliance** (`backend/app/services/accessibility_compliance.py`)

#### AI & Generation
- ✅ **Ollama Service** (`backend/app/services/ollama_service.py`)
- ✅ **vLLM Service** (`backend/app/services/vllm_service.py`)
- ✅ **LLM Service** (`backend/app/services/llm_service.py`)
- ✅ **Model Router** (`backend/app/services/model_router.py`)
- ✅ **Style Codes** (`backend/app/services/style_codes.py`)
- ✅ **Synthetic Requirements** (`backend/app/services/synthetic_requirements.py`)

#### Quality & Self-Healing
- ✅ **Self-Healing Service** (`backend/app/services/self_healing.py`)
- ✅ **Q-Index** (`backend/app/services/q_index.py`)
- ✅ **Planner** (`backend/app/services/planner.py`)

#### Integrations
- ✅ **GitHub Connector** (`backend/app/services/github_connector.py`)
- ✅ **CI/CD Connector** (`backend/app/services/cicd_connector.py`)

#### Frontend
- ✅ **React Dashboard** with pages for Test Cases, Runs, Triage
- ✅ **API Client** (`src/lib/api-config.ts`)

---

## 🚧 What Needs to Be Built

### 1. Model Gateway Service ⚠️ **HIGH PRIORITY**

**Status:** Partially exists (`llm_service.py`, `model_router.py`) - needs unification

**What to Build:**
- Unified `/generate`, `/chat`, `/embedding` endpoints
- Provider-agnostic config (local/cloud)
- Token & cost accounting (`llm_usage` table)
- Route to Qwen 30B (vLLM/Ollama) or cloud APIs
- MCP-style tool call support (future)

**New Files:**
- `backend/app/services/model_gateway.py`
- `backend/app/models/llm_usage.py`
- Migration: `supabase/migrations/006_llm_usage.sql`

**API Endpoints:**
```
POST /model-gateway/generate
POST /model-gateway/chat
POST /model-gateway/embedding
GET  /model-gateway/usage/{tenant_id}
```

---

### 2. Agent Orchestrator Enhancement ⚠️ **HIGH PRIORITY**

**Status:** Exists (`orchestrator.py`) - needs agent interface standardization

**What to Build:**
- Standard `AgentTaskRequest` / `AgentTaskResult` schemas
- Agent registration system
- Workflow templates for multi-agent flows
- Task queue with retries
- Agent health monitoring

**Updates:**
- Enhance `backend/app/services/orchestrator.py`
- Add `backend/app/schemas/agent_schemas.py`
- Add agent registry: `backend/app/services/agent_registry.py`

**API Endpoints:**
```
POST /orchestrator/agents/register
POST /orchestrator/tasks/create
POST /orchestrator/tasks/{task_id}/execute
GET  /orchestrator/tasks/{task_id}
GET  /orchestrator/agents
```

---

### 3. Requirements Intelligence Agent 🆕 **NEW**

**Status:** Requirements table exists, but no agent

**What to Build:**
- Jira/Confluence/Azure DevOps connectors
- Requirements embedding & RAG
- Test case generation from requirements
- Traceability matrix (Req → Test → Run → Defect)
- Duplicate/conflict detection

**New Files:**
- `backend/app/services/requirements_agent.py`
- `backend/app/services/jira_connector.py`
- `backend/app/services/confluence_connector.py`
- `backend/app/services/azure_devops_connector.py`
- Migration: `supabase/migrations/007_requirements_embeddings.sql`

**API Endpoints:**
```
POST /agents/requirements/sync-jira
POST /agents/requirements/generate-tests
GET  /agents/requirements/traceability/{req_id}
POST /agents/requirements/analyze-conflicts
```

---

### 4. Functional Automation Agent Enhancement ⚠️ **ENHANCE**

**Status:** Playwright runner exists - needs agent wrapper + DOM recorder

**What to Build:**
- Agent wrapper around Playwright executor
- DOM snapshot & recorder endpoint
- Self-healing integration
- Test generation from recordings
- Maintenance suggestions

**New Files:**
- `backend/app/services/automation_agent.py`
- `backend/app/services/dom_recorder.py`
- Migration: `supabase/migrations/008_recordings.sql`
- Migration: `supabase/migrations/009_maintenance_suggestions.sql`

**API Endpoints:**
```
POST /agents/automation/generate
POST /agents/automation/run
POST /recordings/upload
GET  /recordings/{recording_id}
POST /agents/automation/heal
```

---

### 5. Performance Testing Agent 🆕 **NEW**

**Status:** k6 executor exists - needs agent wrapper + metrics store

**What to Build:**
- Agent wrapper around k6 executor
- Metrics time-series storage (Prometheus or Postgres)
- SLA tracking & alerts
- Performance recommendations
- Link to requirements/test cases

**New Files:**
- `backend/app/services/performance_agent.py`
- `backend/app/services/perf_metrics_store.py`
- Migration: `supabase/migrations/010_perf_runs.sql`
- Migration: `supabase/migrations/011_perf_metrics.sql`

**API Endpoints:**
```
POST /agents/performance/run
POST /agents/performance/define-sla
GET  /agents/performance/metrics/{run_id}
GET  /agents/performance/sla-status/{project_id}
```

---

### 6. Accessibility Agent 🆕 **NEW**

**Status:** `accessibility_compliance.py` exists - needs agent wrapper

**What to Build:**
- Agent wrapper around accessibility scanner
- Integration with Automation Agent
- Human-readable reports
- Prioritized fixes
- Code change suggestions

**New Files:**
- `backend/app/services/accessibility_agent.py`
- Migration: `supabase/migrations/012_accessibility_issues.sql`

**API Endpoints:**
```
POST /agents/accessibility/run
POST /agents/accessibility/scan-url
GET  /agents/accessibility/issues/{project_id}
GET  /agents/accessibility/debt/{project_id}
```

---

### 7. Security Agent 🆕 **NEW**

**Status:** ZAP executor exists - needs agent wrapper + intelligent triage

**What to Build:**
- Agent wrapper around ZAP executor
- SAST integration (optional)
- LLM-powered de-duplication
- Risk explanation in plain English
- Test case generation for exploitation scenarios

**New Files:**
- `backend/app/services/security_agent.py`
- `backend/app/services/sast_integration.py` (optional)
- Migration: `supabase/migrations/013_security_findings.sql`

**API Endpoints:**
```
POST /agents/security/run
POST /agents/security/scan-repo
GET  /agents/security/findings/{project_id}
GET  /agents/security/risk-overview/{project_id}
```

---

### 8. Test Runner Service 🆕 **NEW**

**Status:** Playwright runner exists - needs dedicated microservice

**What to Build:**
- Docker-based Playwright workers
- Queue system (Redis/Celery)
- Job status tracking
- Artifact collection (screenshots, videos, logs)
- Multi-browser support

**New Files:**
- `backend/app/services/test_runner_service.py`
- `backend/app/models/test_job.py`
- Migration: `supabase/migrations/014_test_jobs.sql`
- `docker/playwright-worker/Dockerfile`

**API Endpoints:**
```
POST /test-runner/jobs/create
GET  /test-runner/jobs/{job_id}
POST /test-runner/jobs/{job_id}/cancel
GET  /test-runner/jobs/{job_id}/artifacts
```

---

### 9. Multi-Tenant Data Model ⚠️ **CRITICAL**

**Status:** Organizations table exists - needs full tenant isolation

**What to Build:**
- Add `tenant_id` to ALL tables
- Tenant config table
- Row-level security (RLS) policies
- Tenant-scoped queries everywhere
- Optional: Separate schemas per tenant

**Migration:**
- `supabase/migrations/015_multi_tenant.sql` (adds tenant_id to all tables)
- `supabase/migrations/016_tenant_config.sql`

**Tables to Update:**
- `test_cases`, `test_runs`, `test_plans`
- `requirements`, `defects`
- `ai_generations`, `artifacts`
- All new tables (perf_runs, security_findings, etc.)

---

### 10. Plugin API 🆕 **NEW**

**Status:** None - completely new

**What to Build:**
- Unified REST/WebSocket API for IDE/browser plugins
- API key authentication
- Event streaming (SSE/WebSocket)
- Recording upload endpoint
- Test generation from plugin context

**New Files:**
- `backend/app/routers/plugin_api.py`
- `backend/app/services/plugin_service.py`
- `backend/app/models/api_key.py`
- Migration: `supabase/migrations/017_api_keys.sql`

**API Endpoints:**
```
POST /plugin/recording
POST /plugin/generate-tests
GET  /plugin/sync-status
WS   /plugin/events
```

---

### 11. On-Prem Packaging 🆕 **NEW**

**Status:** Docker Compose exists for DB only

**What to Build:**
- Docker images for all services
- Helm charts for Kubernetes
- docker-compose for full stack
- Tenant provisioning scripts
- Configuration management

**New Files:**
- `docker-compose.full.yml`
- `helm/qa-ai-platform/Chart.yaml`
- `helm/qa-ai-platform/values.yaml`
- `scripts/provision-tenant.sh`
- `docs/ON_PREM_DEPLOYMENT.md`

---

### 12. Observability & RBAC 🆕 **NEW**

**Status:** Basic logging exists

**What to Build:**
- Centralized logging (ELK/Cloud logging)
- Metrics (Prometheus)
- Tracing (OpenTelemetry)
- RBAC system (roles: Viewer, Tester, Lead, Admin)
- Audit logs

**New Files:**
- `backend/app/services/observability.py`
- `backend/app/services/rbac.py`
- Migration: `supabase/migrations/018_roles.sql`
- Migration: `supabase/migrations/019_audit_logs.sql`

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] **Model Gateway** - Unify LLM access
- [ ] **Agent Orchestrator Enhancement** - Standardize agent interface
- [ ] **Multi-Tenant Data Model** - Add tenant_id everywhere

### Phase 2: Core Agents (Week 3-4)
- [ ] **Requirements Intelligence Agent** - Jira connector + RAG
- [ ] **Automation Agent Enhancement** - DOM recorder + self-healing
- [ ] **Test Runner Service** - Docker workers + queue

### Phase 3: Specialized Agents (Week 5-6)
- [ ] **Performance Agent** - Metrics store + SLA tracking
- [ ] **Accessibility Agent** - Integration + reports
- [ ] **Security Agent** - Intelligent triage + SAST

### Phase 4: Integration & Packaging (Week 7-8)
- [ ] **Plugin API** - IDE/browser extensions
- [ ] **On-Prem Packaging** - Docker/Helm
- [ ] **Observability & RBAC** - Logging, metrics, access control

---

## 🔄 Migration Path

### Step 1: Model Gateway
1. Create `model_gateway.py` service
2. Migrate existing `ollama_service.py` calls to gateway
3. Add `llm_usage` table for tracking
4. Update all agents to use gateway

### Step 2: Agent Standardization
1. Define `AgentTaskRequest` / `AgentTaskResult` schemas
2. Update existing services to implement agent interface
3. Register agents with orchestrator
4. Create workflow templates

### Step 3: Multi-Tenant
1. Add `tenant_id` column to all tables
2. Update all queries to filter by tenant
3. Add RLS policies
4. Create tenant provisioning API

### Step 4: New Agents
1. Build Requirements Agent
2. Enhance Automation Agent
3. Build Performance/Accessibility/Security Agents
4. Integrate with orchestrator

---

## 📊 Data Model Extensions

### New Tables Needed

```sql
-- LLM Usage Tracking
CREATE TABLE llm_usage (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES organizations(id),
    model_name VARCHAR(100),
    provider VARCHAR(50), -- 'local' | 'openai' | 'anthropic'
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_estimate DECIMAL(10,4),
    created_at TIMESTAMP
);

-- Requirements Embeddings
CREATE TABLE requirements_embeddings (
    id UUID PRIMARY KEY,
    requirement_id UUID REFERENCES requirements(id),
    tenant_id UUID,
    embedding VECTOR(1536), -- or 768 for smaller models
    created_at TIMESTAMP
);

-- Test Jobs (for Test Runner Service)
CREATE TABLE test_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    project_id UUID,
    suite_id UUID,
    status VARCHAR(50), -- 'queued' | 'running' | 'completed' | 'failed'
    runner_type VARCHAR(50), -- 'web' | 'mobile' | 'api'
    logs TEXT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Performance Metrics
CREATE TABLE perf_runs (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    project_id UUID,
    test_run_id UUID,
    script_type VARCHAR(50), -- 'k6' | 'locust' | 'jmeter'
    vu_count INTEGER,
    duration_seconds INTEGER,
    created_at TIMESTAMP
);

CREATE TABLE perf_metrics (
    id UUID PRIMARY KEY,
    perf_run_id UUID REFERENCES perf_runs(id),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,2),
    timestamp TIMESTAMP
);

-- Accessibility Issues
CREATE TABLE accessibility_issues (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    project_id UUID,
    page_url TEXT,
    selector TEXT,
    rule_id VARCHAR(100),
    severity VARCHAR(20), -- 'critical' | 'serious' | 'moderate' | 'minor'
    description TEXT,
    created_at TIMESTAMP
);

-- Security Findings
CREATE TABLE security_findings (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    project_id UUID,
    finding_type VARCHAR(50), -- 'dast' | 'sast'
    severity VARCHAR(20), -- 'critical' | 'high' | 'medium' | 'low'
    cvss_score DECIMAL(3,1),
    affected_url TEXT,
    description TEXT,
    remediation TEXT,
    created_at TIMESTAMP
);

-- Recordings (for DOM recorder)
CREATE TABLE recordings (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    project_id UUID,
    user_id UUID,
    dom_snapshot JSONB,
    event_sequence JSONB,
    screenshots TEXT[],
    created_at TIMESTAMP
);

-- Maintenance Suggestions
CREATE TABLE maintenance_suggestions (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    test_case_id UUID,
    suggestion_type VARCHAR(50), -- 'selector_update' | 'flow_change'
    original_value TEXT,
    suggested_value TEXT,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP
);

-- Tenant Configuration
CREATE TABLE tenant_config (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES organizations(id),
    llm_provider VARCHAR(50),
    llm_model_name VARCHAR(100),
    max_tokens INTEGER,
    temperature DECIMAL(3,2),
    enabled_agents TEXT[], -- ['requirements', 'automation', 'perf', ...]
    git_endpoints JSONB,
    jira_endpoints JSONB,
    on_prem BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);

-- API Keys (for plugins)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    user_id UUID,
    key_hash TEXT, -- hashed API key
    name VARCHAR(100),
    permissions JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP
);

-- Roles & Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    name VARCHAR(50), -- 'viewer' | 'tester' | 'lead' | 'admin'
    permissions JSONB,
    created_at TIMESTAMP
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    role_id UUID REFERENCES roles(id),
    tenant_id UUID,
    assigned_at TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    user_id UUID,
    action VARCHAR(100), -- 'agent.triggered' | 'test.created' | 'config.updated'
    resource_type VARCHAR(50),
    resource_id UUID,
    changes JSONB,
    created_at TIMESTAMP
);
```

---

## 🔌 API Endpoint Summary

### Model Gateway
- `POST /model-gateway/generate` - Text generation
- `POST /model-gateway/chat` - Chat completion
- `POST /model-gateway/embedding` - Generate embeddings
- `GET /model-gateway/usage/{tenant_id}` - Usage stats

### Agent Orchestrator
- `POST /orchestrator/agents/register` - Register agent
- `POST /orchestrator/tasks/create` - Create task
- `POST /orchestrator/tasks/{task_id}/execute` - Execute task
- `GET /orchestrator/tasks/{task_id}` - Get task status
- `GET /orchestrator/agents` - List agents

### Requirements Agent
- `POST /agents/requirements/sync-jira` - Sync from Jira
- `POST /agents/requirements/sync-confluence` - Sync from Confluence
- `POST /agents/requirements/generate-tests` - Generate tests from reqs
- `GET /agents/requirements/traceability/{req_id}` - Get traceability
- `POST /agents/requirements/analyze-conflicts` - Find conflicts

### Automation Agent
- `POST /agents/automation/generate` - Generate Playwright from flow
- `POST /agents/automation/run` - Execute automation
- `POST /recordings/upload` - Upload DOM recording
- `GET /recordings/{recording_id}` - Get recording
- `POST /agents/automation/heal` - Self-heal selectors

### Performance Agent
- `POST /agents/performance/run` - Run performance test
- `POST /agents/performance/define-sla` - Define SLA
- `GET /agents/performance/metrics/{run_id}` - Get metrics
- `GET /agents/performance/sla-status/{project_id}` - Check SLA status

### Accessibility Agent
- `POST /agents/accessibility/run` - Run accessibility scan
- `POST /agents/accessibility/scan-url` - Scan specific URL
- `GET /agents/accessibility/issues/{project_id}` - List issues
- `GET /agents/accessibility/debt/{project_id}` - Get debt summary

### Security Agent
- `POST /agents/security/run` - Run security scan
- `POST /agents/security/scan-repo` - SAST scan
- `GET /agents/security/findings/{project_id}` - List findings
- `GET /agents/security/risk-overview/{project_id}` - Risk overview

### Test Runner Service
- `POST /test-runner/jobs/create` - Create test job
- `GET /test-runner/jobs/{job_id}` - Get job status
- `POST /test-runner/jobs/{job_id}/cancel` - Cancel job
- `GET /test-runner/jobs/{job_id}/artifacts` - Get artifacts

### Plugin API
- `POST /plugin/recording` - Upload recording
- `POST /plugin/generate-tests` - Generate tests from plugin
- `GET /plugin/sync-status` - Get sync status
- `WS /plugin/events` - WebSocket events

---

## 🚀 Next Steps

1. **Review this document** - Confirm architecture aligns with vision
2. **Prioritize features** - Decide which to build first
3. **Start with Model Gateway** - Foundation for all agents
4. **Implement multi-tenant** - Critical for scalability
5. **Build agents incrementally** - One at a time, test thoroughly

---

**This architecture is now LOCKED as the baseline for all future development.**



