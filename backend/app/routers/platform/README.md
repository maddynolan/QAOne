# Platform Routers

Backend API routers for cross-cutting platform concerns including dashboard metrics, database operations, defect tracking, requirements management, project management, license administration, secrets vault, CI/CD, security scanning, monitoring, and authentication. This is the largest router subdirectory with 219 endpoints across 21 routers.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `database_api.py` | 1,059 | `/api/db` | 72 | Database CRUD operations, table management, migrations |
| `license_api.py` | 1,034 | `/license` | 15 | License activation, validation, feature gating, usage tracking |
| `project_management_api.py` | 694 | `/api/projects` | 21 | Project CRUD, team management, settings, member roles |
| `framework_analyzer_api.py` | 683 | `/api/framework-analyzer` | 16 | Test framework detection, analysis, migration recommendations |
| `dashboard_api.py` | 533 | `/dashboard` | 6 | Dashboard metrics, summary, trends, recent activity |
| `traceability_api.py` | 530 | `/traceability` | 4 | Requirements-to-tests-to-defects traceability matrix |
| `server_monitoring_api.py` | 405 | `/api/srm` | 12 | Server resource monitoring -- CPU, memory, disk, network |
| `requirements_api.py` | 387 | `/requirements` | 5 | Requirements CRUD, status tracking, linking |
| `oauth2_api.py` | 338 | `/api/oauth2` | 10 | OAuth2 authentication flows for external integrations |
| `leads_api.py` | 343 | `/api/leads` | 6 | Lead management for sales/marketing |
| `system_monitoring_api.py` | 304 | `/api/monitoring` | 7 | System health monitoring, alerts, thresholds |
| `defects_api.py` | 292 | `/defects` | 5 | Defect CRUD, severity, assignment, status tracking |
| `secrets_api.py` | 285 | `/api/secrets` | 7 | Secure secrets management for API keys and tokens |
| `owasp_security_api.py` | 273 | `/api/security` | 5 | OWASP API security scanning and compliance |
| `code_alchemy_api.py` | 270 | `/api/code-alchemy` | 8 | Repository import and code analysis for test generation |
| `plugin_api.py` | 230 | `/api/plugins` | 4 | Plugin installation, configuration, lifecycle |
| `health_api.py` | 217 | -- | 5 | System health checks, database connectivity, dependency status |
| `app_first_flow.py` | 200 | `/api/app-first` | 4 | App-first onboarding flow for new users |
| `download_api.py` | 127 | `/download` | 2 | File download endpoints |
| `tenants_api.py` | 94 | `/tenants` | 4 | Multi-tenant management |
| `metrics_api.py` | 30 | `/metrics` | 1 | Prometheus-style metrics endpoint |

**Total: 219 endpoints across 21 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/dashboard/summary` | GET | dashboard_api | Overall project health summary |
| `/api/projects` | GET/POST | project_management_api | Project listing and creation |
| `/defects` | GET/POST | defects_api | Defect listing and creation |
| `/requirements` | GET/POST | requirements_api | Requirements listing and creation |
| `/api/secrets` | GET/POST | secrets_api | Secrets vault operations |
| `/license/activate` | POST | license_api | Activate license key |
| `/license/status` | GET | license_api | Check license and feature flags |
| `/api/db/{table}` | GET/POST/PUT/DELETE | database_api | Generic database table CRUD |
| `/api/code-alchemy/import` | POST | code_alchemy_api | Import repository for analysis |
| `/api/framework-analyzer/analyze` | POST | framework_analyzer_api | Analyze test framework |
| `/api/oauth2/authorize` | GET | oauth2_api | Start OAuth2 authorization flow |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/storage/` | Database client, PostgreSQL direct, in-memory fallback |
| `backend/app/services/core/` | Project management, test data service |
| `backend/app/middleware/` | RBAC, tenant isolation, trace logging |

## Related Frontend Module

- `src/modules/platform/` -- 23 pages covering settings, integrations, CI/CD, defects, requirements, secrets, etc.
- `src/modules/dashboard/` -- Dashboard, Analytics, Results pages (consumes `/dashboard/*` endpoints)
